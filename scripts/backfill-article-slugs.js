/**
 * One-shot backfill: generate `slug` for every Article that doesn't have one.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/backfill-article-slugs.js --dry-run
 *   node scripts/backfill-article-slugs.js
 */

require('dotenv').config();
const connectArticlesDB = require('../config/database');
const Article = require('../models/Article');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await connectArticlesDB();
  console.log(`Connected. Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}`);

  // Load documents (not .lean()) so we can call .save() and trigger the
  // pre-save hook which handles slug + collision fallback (clean → +date → +random).
  const missing = await Article.find({ $or: [{ slug: null }, { slug: { $exists: false } }] });

  console.log(`Articles missing slug: ${missing.length}`);
  if (!missing.length) { process.exit(0); }

  let done = 0;
  for (const a of missing) {
    if (dryRun) {
      const preview = Article.slugifyFromTitle(a.title);
      console.log(`  [DRY] ${a._id} → ${preview} (+date/random on collision)`);
    } else {
      a.slug = undefined; // force pre-save hook to generate
      await a.save();
      console.log(`  ✓ ${a._id} → ${a.slug}`);
    }
    done++;
  }

  console.log(`\nDone. ${done} articles ${dryRun ? 'would be' : ''} updated.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
