/**
 * One-shot backfill: generate `slug` for every Article that doesn't have one.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/backfill-article-slugs.js --dry-run
 *   node scripts/backfill-article-slugs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');

const DB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(DB_URI);
  console.log(`Connected. Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}`);

  const missing = await Article.find({ $or: [{ slug: null }, { slug: { $exists: false } }] })
    .select('_id title')
    .lean();

  console.log(`Articles missing slug: ${missing.length}`);
  if (!missing.length) { process.exit(0); }

  let done = 0;
  const used = new Set();
  // Load existing slugs so we avoid collisions if any were pre-populated
  const existing = await Article.find({ slug: { $exists: true, $ne: null } }).select('slug').lean();
  for (const e of existing) used.add(e.slug);

  for (const a of missing) {
    let slug = Article.slugifyFromTitle(a.title, String(a._id));
    // On the (very unlikely) off chance of collision, append random
    let tries = 0;
    while (used.has(slug) && tries < 5) {
      slug = Article.slugifyFromTitle(a.title, Math.random().toString(36).slice(-6));
      tries++;
    }
    used.add(slug);

    if (dryRun) {
      console.log(`  [DRY] ${a._id} → ${slug}`);
    } else {
      await Article.updateOne({ _id: a._id }, { $set: { slug } });
      console.log(`  ✓ ${a._id} → ${slug}`);
    }
    done++;
  }

  console.log(`\nDone. ${done} articles ${dryRun ? 'would be' : ''} updated.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
