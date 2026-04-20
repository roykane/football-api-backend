/**
 * Rename article slugs from soi-keo-* to nhan-dinh-*
 * Also update category field
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const DB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

async function main() {
  await mongoose.connect(DB_URI);
  console.log('Connected to MongoDB\n');

  const articles = await SoiKeoArticle.find({
    slug: /^soi-keo-/,
  }).select('slug category').lean();

  console.log(`Found ${articles.length} articles with old slug prefix\n`);

  let updated = 0;
  for (const article of articles) {
    const newSlug = article.slug.replace(/^soi-keo-/, 'nhan-dinh-');
    await SoiKeoArticle.updateOne(
      { _id: article._id },
      { $set: { slug: newSlug, category: 'nhan-dinh' } }
    );
    console.log(`${article.slug} → ${newSlug}`);
    updated++;
  }

  console.log(`\nDone: ${updated} slugs renamed`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
