/**
 * Match URL slug — server-side mirror of football-frontend/src/utils/match-slug.ts.
 *
 * Format: <home>-vs-<away>-HHhMM-ngay-DD-MM-YYYY (UTC).
 * Both sides must use UTC time components so the same fixture renders
 * the same slug everywhere (sitemap → SSR → SPA → API).
 */

function normaliseTeamName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function buildMatchSlug(homeName, awayName, matchDate) {
  if (!homeName || !awayName || !matchDate) return null;
  const d = new Date(matchDate);
  if (Number.isNaN(d.getTime())) return null;
  const homeSlug = normaliseTeamName(homeName);
  const awaySlug = normaliseTeamName(awayName);
  if (!homeSlug || !awaySlug) return null;
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  const dd = pad2(d.getUTCDate());
  const mo = pad2(d.getUTCMonth() + 1);
  const yy = d.getUTCFullYear();
  return `${homeSlug}-vs-${awaySlug}-${hh}h${mm}-ngay-${dd}-${mo}-${yy}`;
}

module.exports = { buildMatchSlug };
