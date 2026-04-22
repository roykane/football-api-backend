/**
 * Delete old template-style nhan-dinh articles — forever.
 *
 * Why: Past-match articles generated with the old prompt (stale template
 * patterns like "Trận đấu giữa X và Y...") have zero forward SEO value —
 * search volume for a fixture drops to near zero the day after kickoff.
 * Regenerating them wastes API credit. Deleting them shrinks the site's
 * thin-content footprint and lets Google re-evaluate remaining articles.
 *
 * Matches same old-style pattern as regenerate-articles.js so the two stay
 * in sync.
 *
 * Usage:
 *   node scripts/delete-old-template-articles.js                 # DRY-RUN, shows what would delete
 *   node scripts/delete-old-template-articles.js --execute       # actually delete
 *   node scripts/delete-old-template-articles.js --only-past     # only delete articles for matches already played
 *   node scripts/delete-old-template-articles.js --archive       # soft-delete (status=archived) instead of hard delete
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SoiKeoArticle = require('../models/SoiKeoArticle');

const DB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const onlyPast = args.includes('--only-past');
const archive = args.includes('--archive');

const OLD_STYLE_QUERY = {
  status: 'published',
  $or: [
    { title: /^Nhận định .+ vs .+ \d{2}:\d{2} ngày/ },
    { 'content.introduction': /^Trận đấu giữa/ },
    { 'content.prediction': /^(\*\*)?Dự Đoán Tỷ Số Chi Tiết|^Dựa trên (toàn bộ )?phân tích/ },
  ],
};

async function main() {
  await mongoose.connect(DB_URI);
  console.log(`Connected. Mode: ${execute ? (archive ? 'ARCHIVE (soft)' : 'HARD DELETE') : 'DRY-RUN'}`);
  console.log(`Past-only filter: ${onlyPast ? 'YES (matchDate < now)' : 'NO (all old-style)'}\n`);

  let query = OLD_STYLE_QUERY;
  if (onlyPast) {
    query = { ...query, 'matchInfo.matchDate': { $lt: new Date() } };
  }

  const candidates = await SoiKeoArticle.find(query)
    .select('_id slug title matchInfo.matchDate createdAt')
    .sort({ createdAt: -1 })
    .lean();

  if (!candidates.length) {
    console.log('No articles match. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${candidates.length} old-style articles:\n`);
  candidates.slice(0, 10).forEach((a, i) => {
    const matchDate = a.matchInfo?.matchDate ? new Date(a.matchInfo.matchDate).toISOString().slice(0, 10) : '???';
    console.log(`  ${i + 1}. [${matchDate}] ${a.title?.substring(0, 80)}`);
  });
  if (candidates.length > 10) console.log(`  ... and ${candidates.length - 10} more\n`);
  else console.log('');

  if (!execute) {
    console.log('Dry-run. Pass --execute to apply. Recommended flags:');
    console.log('  --execute --archive              # safe, reversible (status=archived)');
    console.log('  --execute                        # hard delete');
    console.log('  --execute --only-past            # only past matches');
    process.exit(0);
  }

  const ids = candidates.map(a => a._id);

  if (archive) {
    const result = await SoiKeoArticle.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'archived', updatedAt: new Date() } },
    );
    console.log(`\n✅ Archived ${result.modifiedCount} articles (status=archived).`);
    console.log('   These now return 404 on /nhan-dinh/:slug and drop from sitemap.');
    console.log('   To restore: db.soikeoarticles.updateMany({status:"archived"}, {$set:{status:"published"}})');
  } else {
    const result = await SoiKeoArticle.deleteMany({ _id: { $in: ids } });
    console.log(`\n✅ Hard-deleted ${result.deletedCount} articles.`);
    console.log('   Google will de-index these URLs over 2-4 weeks as it hits 404.');
    console.log('   Consider returning 410 Gone instead of 404 to speed up de-indexing (optional).');
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
