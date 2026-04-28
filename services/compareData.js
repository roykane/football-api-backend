/**
 * Compare data service — single source of truth for /api/compare/teams JSON
 * AND the SSR HTML pages at /so-sanh/<slug>. Both must show identical
 * numbers to avoid Google's "rendered vs. crawled mismatch" penalty.
 */

const Team = require('../models/Team');

const CACHE = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cacheGet(key) {
  const e = CACHE.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet(key, value) {
  CACHE.set(key, { ts: Date.now(), value });
}

function summariseTeam(t) {
  if (!t) return null;
  return {
    slug: t.slug,
    teamId: t.teamId,
    name: t.name,
    shortName: t.shortName,
    logo: t.logo,
    country: t.country,
    founded: t.founded,
    venue: t.venue,
  };
}

function summariseH2H(matches, teamAId, teamBId) {
  let teamAWins = 0, teamBWins = 0, draws = 0;
  let goalsA = 0, goalsB = 0;
  const lastMeetings = [];

  for (const m of matches) {
    const fx = m.fixture || {};
    const teams = m.teams || {};
    const goals = m.goals || {};
    const homeId = teams.home?.id;
    const awayId = teams.away?.id;
    const homeScore = goals.home;
    const awayScore = goals.away;
    if (homeScore == null || awayScore == null) continue;

    const aIsHome = homeId === teamAId;
    const bIsHome = homeId === teamBId;
    if (!aIsHome && !bIsHome) continue;

    const teamAGoals = aIsHome ? homeScore : awayScore;
    const teamBGoals = aIsHome ? awayScore : homeScore;
    goalsA += teamAGoals;
    goalsB += teamBGoals;

    if (teamAGoals > teamBGoals) teamAWins++;
    else if (teamBGoals > teamAGoals) teamBWins++;
    else draws++;

    if (lastMeetings.length < 10) {
      lastMeetings.push({
        date: fx.date,
        league: m.league?.name,
        leagueLogo: m.league?.logo,
        homeName: teams.home?.name,
        awayName: teams.away?.name,
        homeLogo: teams.home?.logo,
        awayLogo: teams.away?.logo,
        homeScore,
        awayScore,
        winnerId: teamAGoals > teamBGoals ? teamAId : teamBGoals > teamAGoals ? teamBId : null,
        venue: fx.venue?.name,
      });
    }
  }

  return {
    total: teamAWins + teamBWins + draws,
    teamAWins,
    teamBWins,
    draws,
    goalsFor: { teamA: goalsA, teamB: goalsB },
    lastMeetings,
  };
}

function summariseForm(fixtures, teamId) {
  const last5 = [];
  let points = 0;
  let scored = 0;
  let conceded = 0;

  const sorted = [...fixtures].sort((a, b) => {
    const ta = new Date(a.fixture?.date || 0).getTime();
    const tb = new Date(b.fixture?.date || 0).getTime();
    return tb - ta;
  }).slice(0, 5);

  for (const m of sorted) {
    const goals = m.goals || {};
    const teams = m.teams || {};
    const homeId = teams.home?.id;
    const homeScore = goals.home;
    const awayScore = goals.away;
    if (homeScore == null || awayScore == null) continue;

    const isHome = homeId === teamId;
    const teamGoals = isHome ? homeScore : awayScore;
    const oppGoals = isHome ? awayScore : homeScore;
    scored += teamGoals;
    conceded += oppGoals;

    if (teamGoals > oppGoals) { last5.push('W'); points += 3; }
    else if (teamGoals < oppGoals) { last5.push('L'); }
    else { last5.push('D'); points += 1; }
  }

  return { last5, points, scored, conceded };
}

async function getCompareTeamsData({ slugA, slugB, footballApi }) {
  if (!slugA || !slugB || slugA === slugB) {
    return { error: 'INVALID_SLUGS', message: 'slugA and slugB required and must differ' };
  }
  const cacheKey = `teams:${[slugA, slugB].sort().join('|')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { data: cached };

  const [teamA, teamB] = await Promise.all([
    Team.findOne({ slug: slugA }).lean(),
    Team.findOne({ slug: slugB }).lean(),
  ]);
  if (!teamA || !teamB) {
    return { error: 'NOT_FOUND', message: 'Team not found' };
  }

  if (!footballApi) {
    return { error: 'UPSTREAM_UNAVAILABLE', message: 'Upstream API unavailable' };
  }

  const [h2hRes, formAa, formBb] = await Promise.allSettled([
    footballApi.get('/fixtures/headtohead', {
      params: { h2h: `${teamA.teamId}-${teamB.teamId}`, last: 30 },
    }),
    footballApi.get('/fixtures', { params: { team: teamA.teamId, last: 5 } }),
    footballApi.get('/fixtures', { params: { team: teamB.teamId, last: 5 } }),
  ]);

  const h2hMatches = h2hRes.status === 'fulfilled' ? (h2hRes.value.data?.response || []) : [];
  const teamAFixtures = formAa.status === 'fulfilled' ? (formAa.value.data?.response || []) : [];
  const teamBFixtures = formBb.status === 'fulfilled' ? (formBb.value.data?.response || []) : [];

  const data = {
    teamA: summariseTeam(teamA),
    teamB: summariseTeam(teamB),
    h2h: summariseH2H(h2hMatches, teamA.teamId, teamB.teamId),
    form: {
      teamA: summariseForm(teamAFixtures, teamA.teamId),
      teamB: summariseForm(teamBFixtures, teamB.teamId),
    },
    generatedAt: new Date().toISOString(),
  };

  cacheSet(cacheKey, data);
  return { data };
}

const POPULAR_PAIRS = [
  { slugA: 'manchester-united', slugB: 'liverpool', label: 'Derby Bắc Anh' },
  { slugA: 'manchester-united', slugB: 'manchester-city', label: 'Derby Manchester' },
  { slugA: 'arsenal', slugB: 'tottenham', label: 'Derby Bắc London' },
  { slugA: 'chelsea', slugB: 'arsenal', label: 'Đại chiến London' },
  { slugA: 'liverpool', slugB: 'manchester-city', label: 'Đại chiến đỉnh bảng' },
  { slugA: 'real-madrid', slugB: 'barcelona', label: 'El Clasico' },
  { slugA: 'real-madrid', slugB: 'atletico-madrid', label: 'Derby Madrileño' },
  { slugA: 'barcelona', slugB: 'atletico-madrid', label: 'Top 3 La Liga' },
  { slugA: 'inter', slugB: 'ac-milan', label: 'Derby della Madonnina' },
  { slugA: 'juventus', slugB: 'inter', label: "Derby d'Italia" },
  { slugA: 'juventus', slugB: 'ac-milan', label: 'Đại chiến Serie A' },
  { slugA: 'as-roma', slugB: 'lazio', label: 'Derby della Capitale' },
  { slugA: 'bayern-munchen', slugB: 'borussia-dortmund', label: 'Der Klassiker' },
  { slugA: 'paris-saint-germain', slugB: 'marseille', label: 'Le Classique' },
  { slugA: 'bayern-munchen', slugB: 'real-madrid', label: 'Đại chiến Champions League' },
  { slugA: 'manchester-city', slugB: 'real-madrid', label: 'Đại chiến châu Âu' },
  { slugA: 'liverpool', slugB: 'real-madrid', label: 'Đại chiến châu Âu' },
  { slugA: 'liverpool', slugB: 'chelsea', label: 'Đại chiến Anh' },
  { slugA: 'manchester-city', slugB: 'tottenham', label: 'Top 4 Premier League' },
  { slugA: 'arsenal', slugB: 'manchester-city', label: 'Đại chiến đỉnh bảng' },
  { slugA: 'manchester-united', slugB: 'chelsea', label: 'Đại chiến Anh' },
  { slugA: 'manchester-united', slugB: 'arsenal', label: 'Đại chiến Anh' },
  { slugA: 'newcastle', slugB: 'arsenal', label: 'Top Premier League' },
  { slugA: 'real-madrid', slugB: 'manchester-united', label: 'Đại chiến lịch sử' },
  { slugA: 'barcelona', slugB: 'manchester-united', label: 'Đại chiến Champions League' },
  { slugA: 'atletico-madrid', slugB: 'manchester-united', label: 'Đại chiến châu Âu' },
  { slugA: 'bayern-munchen', slugB: 'manchester-city', label: 'Đại chiến châu Âu' },
  { slugA: 'paris-saint-germain', slugB: 'real-madrid', label: 'Đại chiến châu Âu' },
  { slugA: 'paris-saint-germain', slugB: 'manchester-city', label: 'Đại chiến châu Âu' },
  { slugA: 'paris-saint-germain', slugB: 'liverpool', label: 'Đại chiến châu Âu' },
];

async function getPopularComparisons() {
  const slugs = new Set();
  for (const p of POPULAR_PAIRS) {
    slugs.add(p.slugA);
    slugs.add(p.slugB);
  }
  const teams = await Team.find({ slug: { $in: Array.from(slugs) } })
    .select('slug name logo country')
    .lean();
  const bySlug = new Map(teams.map(t => [t.slug, t]));

  const items = [];
  for (const p of POPULAR_PAIRS) {
    const a = bySlug.get(p.slugA);
    const b = bySlug.get(p.slugB);
    if (!a || !b) continue;
    items.push({
      slug: `${p.slugA}-vs-${p.slugB}`,
      slugA: p.slugA,
      slugB: p.slugB,
      label: p.label,
      teamA: { slug: a.slug, name: a.name, logo: a.logo, country: a.country },
      teamB: { slug: b.slug, name: b.name, logo: b.logo, country: b.country },
    });
  }
  return items;
}

module.exports = {
  getCompareTeamsData,
  getPopularComparisons,
  POPULAR_PAIRS,
  summariseTeam,
  summariseH2H,
  summariseForm,
};
