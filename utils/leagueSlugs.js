/**
 * Single source of truth mapping URL slug ↔ league metadata.
 *
 * Why: SSR routers (/bang-xep-hang/:slug, /lich-thi-dau/:slug, …) need to
 * resolve slug → league id (for MatchCache/API queries) and slug → display
 * name (for h1, meta, schema). Without a shared map, each router risks
 * defining its own and drifting.
 *
 * Slugs here MUST match what the FE links emit and what sitemap.js declares.
 */

const LEAGUES = [
  { id: 39,  slug: 'premier-league',   name: 'Premier League',          country: 'Anh',         viName: 'Ngoại Hạng Anh',       seasonStart: 8 },
  { id: 140, slug: 'la-liga',          name: 'La Liga',                  country: 'Tây Ban Nha', viName: 'La Liga',              seasonStart: 8 },
  { id: 135, slug: 'serie-a',          name: 'Serie A',                  country: 'Ý',           viName: 'Serie A',              seasonStart: 8 },
  { id: 78,  slug: 'bundesliga',       name: 'Bundesliga',               country: 'Đức',         viName: 'Bundesliga',           seasonStart: 8 },
  { id: 61,  slug: 'ligue-1',          name: 'Ligue 1',                  country: 'Pháp',        viName: 'Ligue 1',              seasonStart: 8 },
  { id: 2,   slug: 'champions-league', name: 'UEFA Champions League',    country: 'Châu Âu',     viName: 'Champions League',     seasonStart: 9 },
  { id: 3,   slug: 'europa-league',    name: 'UEFA Europa League',       country: 'Châu Âu',     viName: 'Europa League',        seasonStart: 9 },
  { id: 1,   slug: 'world-cup',        name: 'FIFA World Cup',           country: 'Thế giới',    viName: 'World Cup',            seasonStart: 6 },
  { id: 253, slug: 'v-league-1',       name: 'V.League 1',               country: 'Việt Nam',    viName: 'V.League 1',           seasonStart: 9 },
];

const BY_SLUG = new Map(LEAGUES.map(l => [l.slug, l]));
const BY_ID = new Map(LEAGUES.map(l => [l.id, l]));

function getLeagueBySlug(slug) {
  return BY_SLUG.get(slug) || null;
}

function getLeagueById(id) {
  return BY_ID.get(Number(id)) || null;
}

/**
 * Best-effort current season year — leagues running Aug→May use the year of
 * kickoff; off-season requests fall back to the previous year so caches don't
 * spill over into the wrong window.
 */
function currentSeasonForLeague(league) {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  if (!league) return year;
  return month >= league.seasonStart ? year : year - 1;
}

module.exports = {
  LEAGUES,
  getLeagueBySlug,
  getLeagueById,
  currentSeasonForLeague,
};
