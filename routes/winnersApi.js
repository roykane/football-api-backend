/**
 * Public JSON API for league historical winners
 *   GET /api/winners                  → list of leagues with winner data
 *   GET /api/winners/:leagueSlug      → year-by-year + aggregated winners
 *
 * Combines data/winners.js (year → club for top-5 European leagues)
 * with utils/leagueSlugs.js so the FE can render league name/country/etc.
 */

const express = require('express');
const router = express.Router();
const { LEAGUE_WINNERS } = require('../data/winners');
const { LEAGUES, getLeagueBySlug } = require('../utils/leagueSlugs');

function aggregateByClub(yearsObj) {
  const counts = new Map();
  for (const [year, w] of Object.entries(yearsObj)) {
    if (!w?.name) continue;
    const key = w.slug || w.name;
    if (!counts.has(key)) counts.set(key, { name: w.name, slug: w.slug, image: w.image, count: 0, years: [] });
    counts.get(key).count++;
    counts.get(key).years.push(parseInt(year, 10));
  }
  return [...counts.values()]
    .map(c => ({ ...c, years: c.years.sort((a, b) => b - a) }))
    .sort((a, b) => b.count - a.count);
}

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  const items = LEAGUES
    .filter(l => LEAGUE_WINNERS[l.id])
    .map(l => {
      const yearsObj = LEAGUE_WINNERS[l.id];
      const years = Object.keys(yearsObj).map(y => +y).sort((a, b) => b - a);
      return {
        slug: l.slug,
        name: l.name,
        viName: l.viName,
        country: l.country,
        latestYear: years[0],
        earliestYear: years[years.length - 1],
        latest: yearsObj[years[0]],
        totalSeasons: years.length,
      };
    });
  res.json({ total: items.length, leagues: items });
});

router.get('/:leagueSlug', (req, res) => {
  const league = getLeagueBySlug(req.params.leagueSlug);
  if (!league || !LEAGUE_WINNERS[league.id]) {
    return res.status(404).json({ error: 'League winners not found' });
  }
  const yearsObj = LEAGUE_WINNERS[league.id];
  const yearsSorted = Object.keys(yearsObj).map(y => +y).sort((a, b) => b - a);
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({
    league: { slug: league.slug, name: league.name, viName: league.viName, country: league.country },
    totalSeasons: yearsSorted.length,
    earliestYear: yearsSorted[yearsSorted.length - 1],
    latestYear: yearsSorted[0],
    winners: yearsSorted.map(year => ({ year, ...yearsObj[year] })),
    mostWins: aggregateByClub(yearsObj),
  });
});

module.exports = router;
