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

// Order matches the FE dropdown: international tournaments + Champions
// League surface first; the rest follow by tier. The slug must match
// what /api/standings emits and what nginx 301-redirect rules expect.
const LEAGUES = [
  // Tier 0 — international + continental
  { id: 1,   slug: 'world-cup',           name: 'FIFA World Cup',                 country: 'Thế giới',     viName: 'World Cup',                seasonStart: 6 },
  { id: 2,   slug: 'champions-league',    name: 'UEFA Champions League',          country: 'Châu Âu',      viName: 'Champions League',         seasonStart: 9 },
  { id: 3,   slug: 'europa-league',       name: 'UEFA Europa League',             country: 'Châu Âu',      viName: 'Europa League',            seasonStart: 9 },
  { id: 848, slug: 'conference-league',   name: 'UEFA Europa Conference League',  country: 'Châu Âu',      viName: 'Conference League',        seasonStart: 9 },
  { id: 4,   slug: 'euro',                name: 'Euro Championship',              country: 'Châu Âu',      viName: 'EURO',                     seasonStart: 6 },

  // Tier 1 — Top 5 European
  { id: 39,  slug: 'premier-league',      name: 'Premier League',                 country: 'Anh',          viName: 'Ngoại Hạng Anh',           seasonStart: 8 },
  { id: 140, slug: 'la-liga',             name: 'La Liga',                        country: 'Tây Ban Nha',  viName: 'La Liga',                  seasonStart: 8 },
  { id: 135, slug: 'serie-a',             name: 'Serie A',                        country: 'Ý',            viName: 'Serie A',                  seasonStart: 8 },
  { id: 78,  slug: 'bundesliga',          name: 'Bundesliga',                     country: 'Đức',          viName: 'Bundesliga',               seasonStart: 8 },
  { id: 61,  slug: 'ligue-1',             name: 'Ligue 1',                        country: 'Pháp',         viName: 'Ligue 1',                  seasonStart: 8 },

  // Tier 2 — other European top divisions
  { id: 94,  slug: 'primeira-liga',       name: 'Primeira Liga',                  country: 'Bồ Đào Nha',   viName: 'Primeira Liga',            seasonStart: 8 },
  { id: 88,  slug: 'eredivisie',          name: 'Eredivisie',                     country: 'Hà Lan',       viName: 'Eredivisie',               seasonStart: 8 },
  { id: 144, slug: 'jupiler-pro-league',  name: 'Jupiler Pro League',             country: 'Bỉ',           viName: 'Jupiler Pro League',       seasonStart: 8 },
  { id: 203, slug: 'super-lig',           name: 'Süper Lig',                      country: 'Thổ Nhĩ Kỳ',   viName: 'Süper Lig',                seasonStart: 8 },

  // Tier 2 — South America
  { id: 71,  slug: 'brasileirao',         name: 'Brasileirão Serie A',            country: 'Brazil',       viName: 'Brasileirão',              seasonStart: 4 },
  { id: 128, slug: 'liga-argentina',      name: 'Liga Profesional Argentina',     country: 'Argentina',    viName: 'Liga Argentina',           seasonStart: 1 },

  // Tier 3 — Americas
  { id: 253, slug: 'mls',                 name: 'Major League Soccer',            country: 'Mỹ',           viName: 'MLS',                      seasonStart: 2 },
  { id: 262, slug: 'liga-mx',             name: 'Liga MX',                        country: 'Mexico',       viName: 'Liga MX',                  seasonStart: 7 },

  // Tier 3 — European 2nd tiers
  { id: 40,  slug: 'championship',        name: 'Championship',                   country: 'Anh',          viName: 'Championship',             seasonStart: 8 },
  { id: 141, slug: 'la-liga-2',           name: 'LaLiga 2',                       country: 'Tây Ban Nha',  viName: 'LaLiga 2',                 seasonStart: 8 },

  // Tier 4 — Nordic / Eastern Europe
  { id: 113, slug: 'allsvenskan',         name: 'Allsvenskan',                    country: 'Thụy Điển',    viName: 'Allsvenskan',              seasonStart: 4 },
  { id: 103, slug: 'eliteserien',         name: 'Eliteserien',                    country: 'Na Uy',        viName: 'Eliteserien',              seasonStart: 4 },
  { id: 179, slug: 'scottish-premiership',name: 'Scottish Premiership',           country: 'Scotland',     viName: 'Scottish Premiership',     seasonStart: 8 },
  { id: 235, slug: 'russian-premier-league', name: 'Russian Premier League',      country: 'Nga',          viName: 'Russian Premier League',   seasonStart: 7 },
  { id: 119, slug: 'danish-superliga',    name: 'Superliga',                      country: 'Đan Mạch',     viName: 'Danish Superliga',         seasonStart: 7 },
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
