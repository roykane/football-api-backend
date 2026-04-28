/**
 * Milestone Tracker
 *
 * Weekly job: scan top scorers from each target league for players
 * approaching round-number milestones (50/100/150 appearances; 25/50/75/100
 * goals at the current club / in the current season).
 *
 * Detection threshold: within 1 of a milestone (exact match preferred,
 * within 2 acceptable so we can publish in advance of the match).
 *
 *   dedupKey = `milestone-{playerId}-{kind}-{value}`
 */

const Article = require('../../models/Article');
const { writeArticle } = require('./llm-writer');
const {
  TARGET_LEAGUES,
  MILESTONE_APPEARANCES,
  MILESTONE_GOALS,
  pickFallbackImage,
  currentSeason,
} = require('./constants');

async function getTopScorers(footballApi, leagueId, season) {
  const res = await footballApi.get('/players/topscorers', {
    params: { league: leagueId, season },
  });
  return res.data?.response || [];
}

function detectMilestones(topScorers) {
  const out = [];
  for (const item of topScorers) {
    const player = item.player;
    const stats = item.statistics?.[0];
    if (!stats) continue;
    const appearances = stats.games?.appearences ?? 0;
    const goals = stats.goals?.total ?? 0;
    const teamName = stats.team?.name;
    const teamLogo = stats.team?.logo;
    const leagueName = stats.league?.name;
    const leagueId = stats.league?.id;

    for (const m of MILESTONE_APPEARANCES) {
      if (appearances === m || appearances === m - 1) {
        out.push({
          kind: 'appearances',
          kindVi: 'lần ra sân',
          value: m,
          current: appearances,
          isExact: appearances === m,
          playerId: player.id,
          playerName: player.name,
          playerPhoto: player.photo,
          teamName,
          teamLogo,
          leagueName,
          leagueId,
        });
      }
    }
    for (const m of MILESTONE_GOALS) {
      if (goals === m || goals === m - 1) {
        out.push({
          kind: 'goals',
          kindVi: 'bàn thắng',
          value: m,
          current: goals,
          isExact: goals === m,
          playerId: player.id,
          playerName: player.name,
          playerPhoto: player.photo,
          teamName,
          teamLogo,
          leagueName,
          leagueId,
        });
      }
    }
  }
  out.sort((a, b) => (b.isExact - a.isExact) || (b.value - a.value));
  return out;
}

function buildFacts(m) {
  const status = m.isExact
    ? `Vừa cán mốc ${m.value} ${m.kindVi}`
    : `Còn 1 ${m.kindVi} nữa để cán mốc ${m.value}`;
  return [
    `Cầu thủ: ${m.playerName}`,
    `CLB: ${m.teamName}`,
    `Giải đấu: ${m.leagueName}`,
    `Mốc: ${m.value} ${m.kindVi} (mùa hiện tại)`,
    `Hiện tại: ${m.current} ${m.kindVi}`,
    `Trạng thái: ${status}`,
  ].join('\n');
}

async function generateForMilestone(m) {
  const ai = await writeArticle({
    systemContext: 'Bạn là phóng viên thể thao chuyên nghiệp viết bài kỷ niệm cột mốc cầu thủ bằng tiếng Việt.',
    factsBlock: buildFacts(m),
    titleHint: { subject: m.playerName },
    minWords: 280,
    structureBlock: [
      '   ## Cột mốc',
      `   (90-130 từ) ${m.playerName} của ${m.teamName} ${m.isExact ? 'vừa cán' : 'sắp cán'} mốc ${m.value} ${m.kindVi} tại ${m.leagueName}.`,
      '',
      '   ## Đóng góp',
      `   (110-160 từ) Vai trò của ${m.playerName} trong đội hình ${m.teamName} mùa này — chỉ nêu sự kiện khách quan từ data.`,
      '',
      '   ## Ý nghĩa',
      `   (80-120 từ) Cột mốc ${m.value} ${m.kindVi} có ý nghĩa gì cho cá nhân ${m.playerName} và CLB ${m.teamName}.`,
    ].join('\n'),
  });
  return ai;
}

async function run(footballApi, slotsAvailable = 3) {
  if (slotsAvailable <= 0) return 0;
  const season = currentSeason();

  console.log(`📰 [milestone] season=${season} slots=${slotsAvailable}`);

  const all = [];
  for (const leagueId of TARGET_LEAGUES) {
    if (all.length >= slotsAvailable * 5) break;
    try {
      const top = await getTopScorers(footballApi, leagueId, season);
      const ms = detectMilestones(top);
      for (const m of ms) all.push(m);
    } catch (err) {
      console.warn(`[milestone] league ${leagueId} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  if (!all.length) {
    console.log('[milestone] no candidates');
    return 0;
  }

  let created = 0;
  for (const m of all) {
    if (created >= slotsAvailable) break;
    const dedupKey = `milestone-${m.playerId}-${m.kind}-${m.value}`;
    if (await Article.existsByDedupKey(dedupKey)) continue;

    let ai;
    try {
      ai = await generateForMilestone(m);
    } catch (err) {
      console.warn(`[milestone] LLM fail ${m.playerName}:`, err.message);
      continue;
    }

    const image = m.playerPhoto || m.teamLogo || pickFallbackImage();
    const article = new Article({
      originalTitle: ai.title,
      source: 'data-derived/milestone',
      title: ai.title,
      description: ai.description,
      content: ai.content,
      tags: ai.tags.length ? ai.tags : [m.playerName, m.teamName, m.leagueName],
      image,
      category: 'general',
      status: 'draft',
      pubDate: new Date(),
      aiModel: 'claude-haiku-4-5-20251001',
      metadata: { dedupKey, type: 'milestone' },
    });

    try {
      await article.save();
      console.log(`   ✅ [milestone] ${m.playerName} ${m.value} ${m.kindVi} — ${article.title}`);
      created++;
    } catch (err) {
      console.warn(`   ❌ save failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  return created;
}

module.exports = { run };
