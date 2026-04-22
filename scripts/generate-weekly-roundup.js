/**
 * Generate weekly league roundup articles for /tin-bong-da.
 *
 * Usage:
 *   node scripts/generate-weekly-roundup.js --league=premier-league
 *   node scripts/generate-weekly-roundup.js --all            # all 7 leagues
 *   node scripts/generate-weekly-roundup.js --all --auto-publish
 *   node scripts/generate-weekly-roundup.js --league=v-league-1 --dry-run
 *
 * Defaults: status=draft (editor review required). Use --auto-publish
 * only if you have an editorial layer downstream.
 *
 * Prereqs:
 *   - ANTHROPIC_API_KEY set
 *   - API_FOOTBALL_KEY set
 *   - MongoDB connection via MONGODB_URI / DATABASE_URL
 */

require('dotenv').config();
const connectArticlesDB = require('../config/database');
const { LEAGUES, generateRoundupForLeague } = require('../services/real-news-generator');

const args = process.argv.slice(2);
const leagueArg = args.find(a => a.startsWith('--league='))?.split('=')[1];
const allFlag = args.includes('--all');
const autoPublish = args.includes('--auto-publish');
const dryRun = args.includes('--dry-run');

async function main() {
  if (!leagueArg && !allFlag) {
    console.log('Usage:');
    console.log('  --league=<slug>     generate for one league');
    console.log('  --all               generate for all 7 leagues');
    console.log('  --auto-publish      skip editor gate (default: draft)');
    console.log('  --dry-run           no DB write, just fetch data + show counts');
    console.log('');
    console.log('Available leagues:');
    LEAGUES.forEach(l => console.log(`  ${l.slug.padEnd(20)} ${l.vnName}`));
    process.exit(0);
  }

  await connectArticlesDB();
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : (autoPublish ? 'AUTO-PUBLISH' : 'DRAFT')}\n`);

  const targets = allFlag ? LEAGUES : [LEAGUES.find(l => l.slug === leagueArg)].filter(Boolean);
  if (!targets.length) {
    console.error(`Unknown league slug: ${leagueArg}`);
    process.exit(1);
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;
  for (const league of targets) {
    if (dryRun) {
      const { fetchWeekData } = require('../services/real-news-generator');
      const data = await fetchWeekData(league);
      console.log(`[${league.slug}] ${data.fixtures.length} fixtures, ${data.standings.length} standings, ${data.topScorers.length} scorers`);
      continue;
    }
    try {
      const result = await generateRoundupForLeague(league, { autoPublish });
      if (result.skipped) skipped++;
      else if (result.success) success++;
      else failed++;
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      failed++;
    }
    // Rate limit between Claude calls
    if (targets.length > 1) await new Promise(r => setTimeout(r, 3000));
  }

  if (!dryRun) {
    console.log('\n========================================');
    console.log(`Done: ${success} ok, ${skipped} skipped, ${failed} failed`);
    if (!autoPublish && success > 0) {
      console.log(`\n⚠️  ${success} bài status='draft'. Editor cần:`);
      console.log(`    db.articles.find({ status: 'draft' })              // list drafts`);
      console.log(`    db.articles.updateOne({ slug: '...' }, { $set: { status: 'published' } })`);
    }
    console.log('========================================');
  }
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
