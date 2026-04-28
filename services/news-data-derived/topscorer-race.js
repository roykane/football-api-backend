/**
 * Top Scorer Race
 *
 * Weekly snapshot of /players/topscorers per league. Compares against the
 * previous week's snapshot (stored in NewsState collection) and writes one
 * "race update" article per league when the leader changed OR the gap
 * between #1 and #2 closed/widened by ≥2 goals.
 *
 *   dedupKey = `topscorer-race-{leagueId}-w{week}`
 *
 * Snapshot persistence uses a tiny ad-hoc collection `news_state` so we
 * don't bloat the Article model.
 */

const mongoose = require('mongoose');
const Article = require('../../models/Article');
const { writeArticle } = require('./llm-writer');
const { TARGET_LEAGUES, pickFallbackImage, currentSeason } = require('./constants');

const NewsState = mongoose.models.NewsState || mongoose.model('NewsState', new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  payload: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
}));

function isoWeek(d = new Date()) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round((target - firstThursday) / 604800000);
}

async function getTopScorers(footballApi, leagueId, season) {
  const res = await footballApi.get('/players/topscorers', {
    params: { league: leagueId, season },
  });
  return res.data?.response || [];
}

function summarize(top) {
  return top.slice(0, 5).map(item => ({
    playerId: item.player?.id,
    playerName: item.player?.name,
    playerPhoto: item.player?.photo,
    teamName: item.statistics?.[0]?.team?.name,
    goals: item.statistics?.[0]?.goals?.total ?? 0,
  }));
}

function diffStory(prev, curr) {
  if (!prev?.length || !curr?.length) return null;
  const leaderChanged = prev[0]?.playerId !== curr[0]?.playerId;
  const prevGap = (prev[0]?.goals ?? 0) - (prev[1]?.goals ?? 0);
  const currGap = (curr[0]?.goals ?? 0) - (curr[1]?.goals ?? 0);
  const gapDelta = Math.abs(prevGap - currGap);
  if (!leaderChanged && gapDelta < 2) return null;
  return { leaderChanged, prevGap, currGap, gapDelta };
}

function buildFacts(curr, prev, leagueName, story) {
  const top5 = curr.map((p, i) => `  ${i + 1}. ${p.playerName} (${p.teamName}) — ${p.goals} bàn`).join('\n');
  const prev5 = (prev || []).map((p, i) => `  ${i + 1}. ${p.playerName} (${p.teamName}) — ${p.goals} bàn`).join('\n')
    || '  (chưa có snapshot tuần trước)';
  const change = story.leaderChanged
    ? `Người dẫn đầu đã thay đổi: trước là ${prev[0]?.playerName}, nay là ${curr[0]?.playerName}.`
    : `Khoảng cách giữa #1 và #2 thay đổi ${story.gapDelta} bàn (từ ${story.prevGap} thành ${story.currGap}).`;
  return [
    `Giải đấu: ${leagueName}`,
    '',
    'Top 5 vua phá lưới hiện tại (mới nhất):',
    top5,
    '',
    'Top 5 tuần trước:',
    prev5,
    '',
    `Diễn biến: ${change}`,
  ].join('\n');
}

async function generateForLeague(curr, prev, leagueName, story) {
  const ai = await writeArticle({
    systemContext: 'Bạn là phóng viên thể thao chuyên nghiệp viết bài cập nhật cuộc đua Vua phá lưới bằng tiếng Việt.',
    factsBlock: buildFacts(curr, prev, leagueName, story),
    titleHint: { subject: `Vua phá lưới ${leagueName}` },
    minWords: 320,
    structureBlock: [
      '   ## Diễn biến',
      `   (100-150 từ) Tóm tắt thay đổi chính trong cuộc đua Vua phá lưới ${leagueName}.`,
      '',
      '   ## Top 5 hiện tại',
      '   (120-160 từ) Liệt kê 5 cầu thủ hàng đầu, dùng bullet list. Mỗi bullet: tên + CLB + số bàn.',
      '',
      '   ## So sánh tuần trước',
      '   (80-120 từ) Sự thay đổi vị trí, ai vươn lên, ai tụt xuống — chỉ nêu sự kiện khách quan.',
    ].join('\n'),
  });
  return ai;
}

async function run(footballApi, slotsAvailable = 3) {
  if (slotsAvailable <= 0) return 0;
  const season = currentSeason();
  const week = isoWeek();

  console.log(`📰 [topscorer-race] season=${season} week=${week} slots=${slotsAvailable}`);

  let created = 0;
  for (const leagueId of TARGET_LEAGUES) {
    if (created >= slotsAvailable) break;

    let topResp;
    try {
      topResp = await getTopScorers(footballApi, leagueId, season);
    } catch (err) {
      console.warn(`[topscorer-race] ${leagueId} fetch failed:`, err.message);
      continue;
    }
    if (!topResp.length) continue;

    const leagueName = topResp[0]?.statistics?.[0]?.league?.name || `League ${leagueId}`;
    const curr = summarize(topResp);

    const stateKey = `topscorer-race-${leagueId}-${season}`;
    const state = await NewsState.findOne({ key: stateKey }).lean();
    const prev = state?.payload?.top || null;

    const story = diffStory(prev, curr);

    if (prev && story) {
      const dedupKey = `topscorer-race-${leagueId}-w${week}`;
      const exists = await Article.existsByDedupKey(dedupKey);
      if (!exists) {
        let ai;
        try {
          ai = await generateForLeague(curr, prev, leagueName, story);
        } catch (err) {
          console.warn(`[topscorer-race] LLM fail ${leagueId}:`, err.message);
          ai = null;
        }
        if (ai) {
          const leader = curr[0];
          const image = leader?.playerPhoto || pickFallbackImage();
          const article = new Article({
            originalTitle: ai.title,
            source: 'data-derived/topscorer-race',
            title: ai.title,
            description: ai.description,
            content: ai.content,
            tags: ai.tags.length ? ai.tags : [leagueName, 'Vua phá lưới', leader?.playerName].filter(Boolean),
            image,
            category: 'analysis',
            status: 'draft',
            pubDate: new Date(),
            aiModel: 'claude-haiku-4-5-20251001',
            metadata: { dedupKey, type: 'topscorer-race' },
          });
          try {
            await article.save();
            console.log(`   ✅ [topscorer-race] ${leagueName} — ${article.title}`);
            created++;
          } catch (err) {
            console.warn(`   ❌ save failed:`, err.message);
          }
        }
      }
    } else if (!prev) {
      console.log(`[topscorer-race] ${leagueName} — first snapshot, no story yet`);
    } else {
      console.log(`[topscorer-race] ${leagueName} — no notable change`);
    }

    // Always update snapshot, even when no article was written
    await NewsState.updateOne(
      { key: stateKey },
      { $set: { payload: { top: curr, week }, updatedAt: new Date() } },
      { upsert: true },
    );

    await new Promise(r => setTimeout(r, 1500));
  }

  return created;
}

module.exports = { run };
