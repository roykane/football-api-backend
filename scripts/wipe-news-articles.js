/**
 * Wipe AI-generated news articles from the `Article` collection.
 *
 * Why: Current /tin-bong-da content was auto-generated from 30 hardcoded
 * fallback topics with random Unsplash images. That's low-value for SEO
 * and brand trust. Wipe it, disable auto-news-generator, and rebuild
 * later from real match data (league roundups, transfer tracker, etc).
 *
 * NOTE: This does NOT touch SoiKeoArticle (nhan-dinh) or AutoArticle
 * (preview/h2h). Only the `articles` collection used by /tin-bong-da.
 *
 * Usage:
 *   node scripts/wipe-news-articles.js                 # dry-run (default)
 *   node scripts/wipe-news-articles.js --execute       # hard delete
 *   node scripts/wipe-news-articles.js --execute --keep-recent=7
 *                                                     # delete all except
 *                                                     # last 7 days
 */

require('dotenv').config();
const connectArticlesDB = require('../config/database');
const Article = require('../models/Article');

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const keepRecentArg = args.find(a => a.startsWith('--keep-recent='));
const keepRecentDays = keepRecentArg ? parseInt(keepRecentArg.split('=')[1]) : 0;

async function main() {
  await connectArticlesDB();
  console.log(`Connected. Mode: ${execute ? 'HARD DELETE' : 'DRY-RUN'}`);
  if (keepRecentDays > 0) console.log(`Keep-recent filter: last ${keepRecentDays} days\n`);
  else console.log('');

  const query = {};
  if (keepRecentDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepRecentDays);
    query.pubDate = { $lt: cutoff };
  }

  const total = await Article.countDocuments({});
  const toDelete = await Article.countDocuments(query);
  const sample = await Article.find(query).select('title source pubDate category').sort({ pubDate: -1 }).limit(5).lean();

  console.log(`Total articles in DB:    ${total}`);
  console.log(`Will delete:             ${toDelete}`);
  console.log(`Will keep:               ${total - toDelete}\n`);

  if (sample.length) {
    console.log('Sample candidates:');
    sample.forEach((a, i) => {
      const date = a.pubDate ? new Date(a.pubDate).toISOString().slice(0, 10) : '???';
      console.log(`  ${i + 1}. [${date}] [${a.source || '?'}] ${a.title?.substring(0, 80)}`);
    });
    console.log('');
  }

  if (!toDelete) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  if (!execute) {
    console.log('Dry-run. Pass --execute to apply.');
    console.log('  --execute                      # delete all articles in `articles` collection');
    console.log('  --execute --keep-recent=7      # delete all except last 7 days');
    process.exit(0);
  }

  const result = await Article.deleteMany(query);
  console.log(`\n✅ Deleted ${result.deletedCount} articles.`);
  console.log('   /tin-bong-da list will show the empty-state card.');
  console.log('   Sitemap regenerates automatically on next request (15-min cache).');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
