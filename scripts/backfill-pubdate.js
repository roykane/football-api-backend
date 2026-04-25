/**
 * Backfill `pubDate` for articles published BEFORE the
 * "pubDate = event date" → "pubDate = publish time" fix.
 *
 * Affected sources:
 *   - transfer-news  (pubDate was set to transfer event date)
 *   - match-report   (pubDate was set to kickoff date)
 *
 * What we set: `pubDate = createdAt`. createdAt is mongoose-managed and
 * reflects when the article actually entered the database — that's the
 * correct "publish time" by every reasonable definition.
 *
 * Usage:
 *   node scripts/backfill-pubdate.js --dry-run   # preview only
 *   node scripts/backfill-pubdate.js             # apply changes
 *
 * Idempotent: only updates docs where pubDate ≠ createdAt by more than
 * 60 seconds, so re-running is safe.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const connectArticlesDB = require('../config/database');

const DRY_RUN = process.argv.includes('--dry-run');
const DRIFT_TOLERANCE_MS = 60 * 1000; // ignore sub-minute timestamp drift
const TARGET_SOURCES = ['transfer-news', 'match-report'];

async function run() {
  await connectArticlesDB();
  console.log(`[backfill-pubdate] mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);

  const docs = await Article.find({
    source: { $in: TARGET_SOURCES },
  }).select('_id source title pubDate createdAt').lean();

  console.log(`[backfill-pubdate] scanned ${docs.length} candidate articles`);

  let needsUpdate = 0;
  let skipped = 0;
  for (const a of docs) {
    if (!a.createdAt) { skipped++; continue; }
    const drift = Math.abs(new Date(a.pubDate || 0).getTime() - new Date(a.createdAt).getTime());
    if (drift <= DRIFT_TOLERANCE_MS) { skipped++; continue; }
    needsUpdate++;
    if (DRY_RUN) {
      console.log(`  WOULD: [${a.source}] "${(a.title || '').slice(0, 60)}" pubDate ${a.pubDate?.toISOString?.() || a.pubDate} → ${a.createdAt.toISOString()}`);
      continue;
    }
    await Article.updateOne({ _id: a._id }, { $set: { pubDate: a.createdAt } });
  }

  console.log(`[backfill-pubdate] ${DRY_RUN ? 'would update' : 'updated'} ${needsUpdate}, skipped ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[backfill-pubdate] error:', err);
  process.exit(1);
});
