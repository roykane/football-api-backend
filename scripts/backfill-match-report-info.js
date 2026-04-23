/**
 * Backfill matchInfo + image (team logo) for existing match-report articles.
 *
 * For each Article with source='match-report' and fixtureId set:
 *   - Fetch /fixtures?id=X from API-Sports
 *   - Populate matchInfo (homeTeam, awayTeam, league, score, matchDate, venue, status)
 *   - Replace image (Unsplash stock) with home team logo
 *
 * Usage: node scripts/backfill-match-report-info.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Article = require('../models/Article');

const API_SPORTS_URL = 'https://v3.football.api-sports.io';
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  console.error('API_FOOTBALL_KEY not set');
  process.exit(1);
}

const footballApi = axios.create({
  baseURL: API_SPORTS_URL,
  headers: { 'x-apisports-key': apiKey },
  timeout: 15000,
});

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('DB connected');

  const articles = await Article.find({ source: 'match-report', fixtureId: { $exists: true, $ne: null } }).lean();
  console.log(`Found ${articles.length} match-report articles to backfill`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of articles) {
    // Skip if already has matchInfo
    if (a.matchInfo?.homeTeam?.name) {
      skipped++;
      continue;
    }

    try {
      const res = await footballApi.get('/fixtures', { params: { id: a.fixtureId } });
      const fixture = res.data?.response?.[0];
      if (!fixture) {
        console.error(`  ⚠ No fixture data for ${a.fixtureId}: ${a.title}`);
        failed++;
        continue;
      }

      const homeLogo = fixture.teams?.home?.logo || null;
      const awayLogo = fixture.teams?.away?.logo || null;
      const leagueLogo = fixture.league?.logo || null;

      const matchInfo = {
        homeTeam: {
          id: fixture.teams?.home?.id,
          name: fixture.teams?.home?.name,
          logo: homeLogo,
          score: fixture.goals?.home ?? null,
        },
        awayTeam: {
          id: fixture.teams?.away?.id,
          name: fixture.teams?.away?.name,
          logo: awayLogo,
          score: fixture.goals?.away ?? null,
        },
        league: {
          id: fixture.league?.id,
          name: fixture.league?.name,
          logo: leagueLogo,
          country: fixture.league?.country,
        },
        matchDate: new Date(fixture.fixture?.date || a.pubDate),
        venue: fixture.fixture?.venue?.name || null,
        status: fixture.fixture?.status?.short || 'FT',
      };

      // Replace image only if currently pointing at Unsplash stock (preserve custom images if any).
      const shouldReplaceImage = !a.image || a.image.includes('unsplash.com');
      const updates = { matchInfo };
      if (shouldReplaceImage && homeLogo) {
        updates.image = homeLogo;
      }

      await Article.updateOne({ _id: a._id }, { $set: updates });
      updated++;
      console.log(`  ✓ [${updated}/${articles.length}] ${a.title}`);

      // Respect rate limit: 300ms between calls (~200/min, safe below API-Sports limits)
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      failed++;
      console.error(`  ✗ ${a.fixtureId} failed:`, err.message);
    }
  }

  console.log('\n========== DONE ==========');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already has matchInfo): ${skipped}`);
  console.log(`Failed: ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
