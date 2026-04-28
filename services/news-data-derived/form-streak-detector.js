/**
 * Form Streak Detector
 *
 * Weekly job: scan recent fixture results per team to detect notable streaks:
 *   - 5+ consecutive wins / losses / draws
 *   - 5+ consecutive clean sheets
 *   - 5+ consecutive matches without a goal scored
 *
 * Each streak yields one article. Dedup key includes ISO week so the same
 * streak can rotate up next week if it extends.
 *
 *   dedupKey = `streak-{type}-{teamId}-w{week}`
 */

const Article = require('../../models/Article');
const { writeArticle } = require('./llm-writer');
const {
  TARGET_LEAGUES,
  FORM_STREAK_MIN,
  pickFallbackImage,
  currentSeason,
} = require('./constants');

function isoWeek(d = new Date()) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round((target - firstThursday) / 604800000);
}

async function getRecentFixtures(footballApi, leagueId, season) {
  const res = await footballApi.get('/fixtures', {
    params: { league: leagueId, season, last: 60 },
  });
  return res.data?.response || [];
}

function groupByTeam(fixtures) {
  const map = new Map();
  for (const f of fixtures) {
    if (f.fixture?.status?.short !== 'FT' && f.fixture?.status?.short !== 'AET' && f.fixture?.status?.short !== 'PEN') continue;
    const home = f.teams?.home;
    const away = f.teams?.away;
    if (!home?.id || !away?.id) continue;
    const homeScore = f.goals?.home ?? 0;
    const awayScore = f.goals?.away ?? 0;
    const ts = new Date(f.fixture.date).getTime();

    const homeRow = {
      ts,
      teamId: home.id,
      teamName: home.name,
      teamLogo: home.logo,
      goalsFor: homeScore,
      goalsAgainst: awayScore,
      result: homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D',
      opponent: away.name,
    };
    const awayRow = {
      ts,
      teamId: away.id,
      teamName: away.name,
      teamLogo: away.logo,
      goalsFor: awayScore,
      goalsAgainst: homeScore,
      result: awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D',
      opponent: home.name,
    };
    if (!map.has(home.id)) map.set(home.id, []);
    if (!map.has(away.id)) map.set(away.id, []);
    map.get(home.id).push(homeRow);
    map.get(away.id).push(awayRow);
  }
  for (const arr of map.values()) arr.sort((a, b) => b.ts - a.ts);
  return map;
}

function detectStreaks(byTeam, leagueName) {
  const out = [];
  for (const [teamId, rows] of byTeam.entries()) {
    if (rows.length < FORM_STREAK_MIN) continue;
    const teamName = rows[0].teamName;
    const teamLogo = rows[0].teamLogo;

    const checks = [
      { type: 'wins', label: 'thắng liên tiếp', test: r => r.result === 'W' },
      { type: 'losses', label: 'thua liên tiếp', test: r => r.result === 'L' },
      { type: 'unbeaten', label: 'bất bại liên tiếp', test: r => r.result !== 'L' },
      { type: 'clean-sheets', label: 'giữ sạch lưới liên tiếp', test: r => r.goalsAgainst === 0 },
      { type: 'goalless', label: 'tịt ngòi liên tiếp', test: r => r.goalsFor === 0 },
    ];

    for (const c of checks) {
      let n = 0;
      for (const r of rows) {
        if (c.test(r)) n++;
        else break;
      }
      if (n >= FORM_STREAK_MIN) {
        out.push({
          type: c.type,
          label: c.label,
          length: n,
          teamId,
          teamName,
          teamLogo,
          leagueName,
          recentMatches: rows.slice(0, n).map(r => ({
            opponent: r.opponent,
            score: `${r.goalsFor}-${r.goalsAgainst}`,
          })),
        });
      }
    }
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

function buildFacts(s) {
  const matches = s.recentMatches
    .map((m, i) => `  ${i + 1}. vs ${m.opponent}: ${m.score}`)
    .join('\n');
  return [
    `CLB: ${s.teamName}`,
    `Giải đấu: ${s.leagueName}`,
    `Loại chuỗi: ${s.label}`,
    `Số trận trong chuỗi: ${s.length}`,
    `Các trận gần nhất (mới nhất → cũ nhất):`,
    matches,
  ].join('\n');
}

async function generateForStreak(s) {
  const ai = await writeArticle({
    systemContext: 'Bạn là phóng viên thể thao chuyên nghiệp viết bài phân tích chuỗi phong độ bằng tiếng Việt.',
    factsBlock: buildFacts(s),
    titleHint: { subject: s.teamName },
    minWords: 320,
    structureBlock: [
      '   ## Chuỗi phong độ',
      `   (100-150 từ) Tóm tắt: ${s.teamName} đã có chuỗi ${s.length} trận ${s.label} tại ${s.leagueName}.`,
      '',
      '   ## Diễn biến gần đây',
      '   (140-180 từ) Liệt kê các kết quả trong chuỗi (theo thứ tự mới nhất tới cũ nhất). Dùng bullet list nếu liệt kê ≥3 trận.',
      '',
      '   ## Ý nghĩa',
      `   (80-120 từ) Chuỗi này có ý nghĩa gì với vị thế của ${s.teamName} ở giải — chỉ nêu sự kiện khách quan.`,
    ].join('\n'),
  });
  return ai;
}

async function run(footballApi, slotsAvailable = 3) {
  if (slotsAvailable <= 0) return 0;
  const season = currentSeason();
  const week = isoWeek();

  console.log(`📰 [streak] season=${season} week=${week} slots=${slotsAvailable}`);

  const allStreaks = [];
  for (const leagueId of TARGET_LEAGUES) {
    if (allStreaks.length >= slotsAvailable * 4) break;
    try {
      const fixtures = await getRecentFixtures(footballApi, leagueId, season);
      if (!fixtures.length) continue;
      const leagueName = fixtures[0]?.league?.name || `League ${leagueId}`;
      const byTeam = groupByTeam(fixtures);
      const streaks = detectStreaks(byTeam, leagueName);
      for (const s of streaks) allStreaks.push(s);
    } catch (err) {
      console.warn(`[streak] league ${leagueId} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  allStreaks.sort((a, b) => b.length - a.length);

  if (!allStreaks.length) {
    console.log('[streak] no notable streaks');
    return 0;
  }

  let created = 0;
  for (const s of allStreaks) {
    if (created >= slotsAvailable) break;
    const dedupKey = `streak-${s.type}-${s.teamId}-w${week}`;
    if (await Article.existsByDedupKey(dedupKey)) continue;

    let ai;
    try {
      ai = await generateForStreak(s);
    } catch (err) {
      console.warn(`[streak] LLM fail ${s.teamName}/${s.type}:`, err.message);
      continue;
    }

    const image = s.teamLogo || pickFallbackImage();
    const article = new Article({
      originalTitle: ai.title,
      source: 'data-derived/form-streak',
      title: ai.title,
      description: ai.description,
      content: ai.content,
      tags: ai.tags.length ? ai.tags : [s.teamName, s.leagueName],
      image,
      category: 'analysis',
      status: 'draft',
      pubDate: new Date(),
      aiModel: 'claude-haiku-4-5-20251001',
      metadata: { dedupKey, type: 'form-streak' },
    });

    try {
      await article.save();
      console.log(`   ✅ [streak] ${s.teamName} ${s.length}× ${s.type} — ${article.title}`);
      created++;
    } catch (err) {
      console.warn(`   ❌ save failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  return created;
}

module.exports = { run };
