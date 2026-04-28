/**
 * Suspension Watch
 *
 * Detects players approaching the yellow-card suspension line in target leagues
 * and writes a short news brief. Strategy each run:
 *
 *   1. Pick the league bucket for today (round-robin across TARGET_LEAGUES)
 *   2. Pull next-round fixtures → unique team set (max 10 teams)
 *   3. For each team query /players?team=&season= → squad with season stats
 *   4. Filter players where cards.yellow >= SUSPENSION_YELLOW_THRESHOLD
 *      AND cards.yellowred === null/0 (still active, not already suspended)
 *   5. For top N candidates: write 350-500 word article, save status='draft'
 *
 * Dedup: metadata.dedupKey = `suspension-{playerId}-{leagueId}-{season}-{week}`
 * where {week} is ISO-week, so the same warning resets next week if still
 * pending. Prevents re-writing the same alert twice in 7 days.
 */

const Article = require('../../models/Article');
const { writeArticle } = require('./llm-writer');
const {
  TARGET_LEAGUES,
  SUSPENSION_YELLOW_THRESHOLD,
  pickFallbackImage,
  currentSeason,
} = require('./constants');

function isoWeek(d = new Date()) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}

async function getNextFixtureTeams(footballApi, leagueId, season) {
  const res = await footballApi.get('/fixtures', {
    params: { league: leagueId, season, next: 10 },
  });
  const fixtures = res.data?.response || [];
  const teams = new Map();
  for (const f of fixtures) {
    const home = f.teams?.home;
    const away = f.teams?.away;
    const nextOpponent = (teamId, oppName) => ({ teamId, oppName });
    if (home?.id && !teams.has(home.id)) {
      teams.set(home.id, { ...home, nextFixture: f, opponent: away?.name });
    }
    if (away?.id && !teams.has(away.id)) {
      teams.set(away.id, { ...away, nextFixture: f, opponent: home?.name });
    }
  }
  return Array.from(teams.values()).slice(0, 10);
}

async function getSquadCardStats(footballApi, teamId, season) {
  const res = await footballApi.get('/players', {
    params: { team: teamId, season },
  });
  return res.data?.response || [];
}

function pickAtRisk(squadResp, leagueId) {
  const out = [];
  for (const item of squadResp) {
    const player = item.player;
    const stats = (item.statistics || []).find(s => s.league?.id === leagueId);
    if (!stats) continue;
    const yellow = stats.cards?.yellow ?? 0;
    const yellowRed = stats.cards?.yellowred ?? 0;
    if (yellow >= SUSPENSION_YELLOW_THRESHOLD && yellowRed === 0) {
      out.push({
        playerId: player.id,
        playerName: player.name,
        playerPhoto: player.photo,
        position: stats.games?.position,
        appearances: stats.games?.appearences ?? 0,
        yellow,
        leagueId,
        leagueName: stats.league?.name,
        teamName: stats.team?.name,
        teamLogo: stats.team?.logo,
      });
    }
  }
  out.sort((a, b) => b.yellow - a.yellow);
  return out;
}

function buildFacts(c, opponent) {
  return [
    `Cầu thủ: ${c.playerName}`,
    `Vị trí: ${c.position || 'không rõ'}`,
    `CLB: ${c.teamName}`,
    `Giải đấu: ${c.leagueName}`,
    `Số trận đã đá mùa này: ${c.appearances}`,
    `Số thẻ vàng tích luỹ: ${c.yellow}`,
    `Đối thủ kế tiếp: ${opponent || 'chưa xác định'}`,
    `Quy định: tích đủ thẻ vàng theo quy định giải sẽ bị treo giò trận kế tiếp.`,
  ].join('\n');
}

async function generateForCandidate(c, opponent) {
  const ai = await writeArticle({
    systemContext: 'Bạn là phóng viên thể thao chuyên nghiệp viết tin cảnh báo treo giò bằng tiếng Việt.',
    factsBlock: buildFacts(c, opponent),
    titleHint: { subject: c.playerName },
    minWords: 280,
    structureBlock: [
      '   ## Cảnh báo',
      `   (80-120 từ) Tóm tắt: ${c.playerName} của ${c.teamName} đã có ${c.yellow} thẻ vàng tại ${c.leagueName}, có nguy cơ vắng mặt trận kế tiếp gặp ${opponent || 'đối thủ tiếp theo'}.`,
      '',
      '   ## Tình hình hiện tại',
      `   (100-150 từ) Vai trò của ${c.playerName} ở vị trí ${c.position || 'không rõ'}, đã đá ${c.appearances} trận mùa này.`,
      '',
      '   ## Ảnh hưởng tới CLB',
      `   (100-150 từ) Việc thiếu vắng cầu thủ này nếu nhận thẻ vàng tiếp theo có thể ảnh hưởng tới đội hình ${c.teamName}.`,
    ].join('\n'),
  });
  return ai;
}

async function run(footballApi, slotsAvailable = 3) {
  if (slotsAvailable <= 0) return 0;
  const season = currentSeason();
  const week = isoWeek();
  const dayOfWeek = new Date().getDay();
  const leagueId = TARGET_LEAGUES[dayOfWeek % TARGET_LEAGUES.length];

  console.log(`📰 [suspension] league=${leagueId} season=${season} week=${week} slots=${slotsAvailable}`);

  let teams;
  try {
    teams = await getNextFixtureTeams(footballApi, leagueId, season);
  } catch (err) {
    console.error('[suspension] fetch fixtures failed:', err.message);
    return 0;
  }
  if (!teams.length) {
    console.log('[suspension] no upcoming fixtures');
    return 0;
  }

  const candidates = [];
  for (const team of teams) {
    if (candidates.length >= slotsAvailable * 3) break;
    try {
      const squad = await getSquadCardStats(footballApi, team.id, season);
      const atRisk = pickAtRisk(squad, leagueId);
      for (const c of atRisk) {
        candidates.push({ ...c, opponent: team.opponent });
      }
    } catch (err) {
      console.warn(`[suspension] squad ${team.id} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  if (!candidates.length) {
    console.log('[suspension] no players at risk');
    return 0;
  }

  let created = 0;
  for (const c of candidates) {
    if (created >= slotsAvailable) break;
    const dedupKey = `suspension-${c.playerId}-${c.leagueId}-${season}-w${week}`;
    if (await Article.existsByDedupKey(dedupKey)) continue;

    let ai;
    try {
      ai = await generateForCandidate(c, c.opponent);
    } catch (err) {
      console.warn(`[suspension] LLM fail for ${c.playerName}:`, err.message);
      continue;
    }

    const image = c.playerPhoto || c.teamLogo || pickFallbackImage();
    const article = new Article({
      originalTitle: ai.title,
      source: 'data-derived/suspension',
      title: ai.title,
      description: ai.description,
      content: ai.content,
      tags: ai.tags.length ? ai.tags : [c.playerName, c.teamName, c.leagueName],
      image,
      category: 'general',
      status: 'draft',
      pubDate: new Date(),
      aiModel: 'claude-haiku-4-5-20251001',
      metadata: { dedupKey, type: 'suspension' },
    });

    try {
      await article.save();
      console.log(`   ✅ [suspension] ${c.playerName} (${c.yellow}🟨) — ${article.title}`);
      created++;
    } catch (err) {
      console.warn(`   ❌ save failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  return created;
}

module.exports = { run };
