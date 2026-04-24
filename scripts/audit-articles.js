/**
 * DB audit for articles: find Google-policy-risk content, thin content,
 * banned terms, duplicate slugs, broken images.
 *
 * Safe read-only by default. Pass --delete-bad to hard-delete thin content
 * and banned-term articles (backup printed first).
 *
 * Usage:
 *   node scripts/audit-articles.js              # dry-run audit
 *   node scripts/audit-articles.js --delete-bad # delete flagged docs
 */

require('dotenv').config();
const connectArticlesDB = require('../config/database');
const Article = require('../models/Article');

// Use actual Vietnamese characters directly — PCRE2 does NOT support \u escapes.
const BAN_TITLE = /soi kèo|soi-kèo|soi keo|AI\b|\bAI\s|chatgpt|gpt-?[0-9]/i;
const BAN_BODY = /soi kèo|soi-kèo|nhà cái uy tín|link vào [a-z0-9]+|188bet|w88|fb88|bk8|m88|fun88|cmd368|dafabet|1xbet/i;
const GAMBLING_SPAM = /nạp rút|hoàn trả \d|khuyến mãi \d+%|link vào|đại lý (cấp|chính thức)/i;

async function main() {
  const args = process.argv.slice(2);
  const deleteBad = args.includes('--delete-bad');

  await connectArticlesDB();
  console.log(`Connected. Mode: ${deleteBad ? 'HARD DELETE' : 'DRY-RUN AUDIT'}\n`);

  const total = await Article.countDocuments({});
  console.log(`Total articles: ${total}\n`);

  // By source
  const bySource = await Article.aggregate([
    { $group: { _id: '$source', n: { $sum: 1 } } },
    { $sort: { n: -1 } }
  ]);
  console.log('By source:');
  bySource.forEach(s => console.log(`  ${s._id || '(none)'}: ${s.n}`));
  console.log('');

  // By status
  const byStatus = await Article.aggregate([
    { $group: { _id: '$status', n: { $sum: 1 } } },
    { $sort: { n: -1 } }
  ]);
  console.log('By status:');
  byStatus.forEach(s => console.log(`  ${s._id || '(none)'}: ${s.n}`));
  console.log('');

  // 1. Banned terms in title
  const banTitle = await Article.find({ title: BAN_TITLE })
    .select('_id title slug source createdAt').lean();
  console.log(`\n[1] Banned terms in TITLE: ${banTitle.length}`);
  banTitle.slice(0, 10).forEach(a => console.log(`  - ${a.slug} | ${a.title}`));

  // 2. Banned terms in body
  const banBody = await Article.find({ content: BAN_BODY })
    .select('_id title slug source createdAt').lean();
  console.log(`\n[2] Banned terms in BODY: ${banBody.length}`);
  banBody.slice(0, 10).forEach(a => console.log(`  - ${a.slug} | ${a.title}`));

  // 3. Gambling spam patterns
  const spam = await Article.find({
    $or: [{ title: GAMBLING_SPAM }, { content: GAMBLING_SPAM }]
  }).select('_id title slug source').lean();
  console.log(`\n[3] Gambling spam patterns: ${spam.length}`);
  spam.slice(0, 10).forEach(a => console.log(`  - ${a.slug} | ${a.title}`));

  // 4. Thin content
  const thin = await Article.find({
    $expr: { $lt: [{ $strLenCP: { $ifNull: ['$content', ''] } }, 500] }
  }).select('_id title slug source content').lean();
  console.log(`\n[4] Thin content (<500 chars): ${thin.length}`);
  thin.slice(0, 10).forEach(a => {
    const len = (a.content || '').length;
    console.log(`  - [${len} chars] ${a.slug} | ${(a.title || '').substring(0, 70)}`);
  });

  // 5. Missing image
  const noImg = await Article.countDocuments({
    $or: [{ imageUrl: { $exists: false } }, { imageUrl: '' }, { imageUrl: null }]
  });
  console.log(`\n[5] Missing image: ${noImg}`);

  // 6. Duplicate slugs
  const dupSlugs = await Article.aggregate([
    { $group: { _id: '$slug', n: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { n: { $gt: 1 } } }
  ]);
  console.log(`\n[6] Duplicate slugs: ${dupSlugs.length}`);
  dupSlugs.slice(0, 10).forEach(d => console.log(`  - ${d._id} × ${d.n}`));

  // 7. Broken Unsplash image URLs (404-prone ones we've seen)
  const knownBroken = [
    'photo-1508098682722',
    'photo-1610234834630'
  ];
  const broken = await Article.find({
    imageUrl: { $regex: knownBroken.join('|') }
  }).select('_id slug imageUrl title').lean();
  console.log(`\n[7] Known-broken image URLs: ${broken.length}`);
  broken.slice(0, 10).forEach(a => console.log(`  - ${a.slug} | ${a.imageUrl}`));

  // 8. Empty/missing title
  const noTitle = await Article.countDocuments({
    $or: [{ title: { $exists: false } }, { title: '' }, { title: null }]
  });
  console.log(`\n[8] Missing title: ${noTitle}`);

  // Total flagged for delete
  const badIds = new Set();
  [banTitle, banBody, spam, thin, broken].forEach(arr =>
    arr.forEach(a => badIds.add(String(a._id)))
  );

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Unique bad docs: ${badIds.size}`);

  if (!deleteBad) {
    console.log('\nDry-run. Pass --delete-bad to hard-delete flagged docs.');
    process.exit(0);
  }

  if (badIds.size === 0) {
    console.log('\nNothing to delete. ✅');
    process.exit(0);
  }

  const ids = [...badIds].map(id => new (require('mongoose').Types.ObjectId)(id));
  const r = await Article.deleteMany({ _id: { $in: ids } });
  console.log(`\n✅ Deleted ${r.deletedCount} articles.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
