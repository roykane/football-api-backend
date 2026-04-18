/**
 * Update old soi-keo article titles
 * Replace gambling keywords in title, metaTitle, metaDescription, excerpt, tags
 *
 * Usage: node scripts/update-article-titles.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SoiKeoArticle = require('../models/SoiKeoArticle');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football-odds';
const isDryRun = process.argv.includes('--dry-run');

function cleanText(text) {
  if (!text) return text;
  return text
    .replace(/Soi kèo/g, 'Nhận định')
    .replace(/soi kèo/g, 'nhận định')
    .replace(/Soi Kèo/g, 'Nhận Định')
    .replace(/SOI KÈO/g, 'NHẬN ĐỊNH');
}

function cleanTags(tags) {
  if (!tags || !Array.isArray(tags)) return tags;
  return tags.map(tag => {
    return tag
      .replace(/soi kèo/gi, 'nhận định')
      .replace(/tỷ lệ kèo/gi, 'phân tích trận đấu')
      .replace(/kèo nhà cái/gi, 'dự đoán bóng đá');
  });
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const articles = await SoiKeoArticle.find({
    $or: [
      { title: /[Ss]oi kèo/i },
      { metaTitle: /[Ss]oi kèo/i },
      { metaDescription: /[Ss]oi kèo|kèo nhà cái|tỷ lệ kèo/i },
      { excerpt: /[Ss]oi kèo|kèo nhà cái|tỷ lệ kèo/i },
    ]
  });

  console.log(`Found ${articles.length} articles to update`);

  if (isDryRun) {
    console.log('\n--- DRY RUN (no changes saved) ---\n');
    for (const article of articles.slice(0, 5)) {
      console.log(`[${article.slug}]`);
      console.log(`  title:    "${article.title}"`);
      console.log(`  → new:    "${cleanText(article.title)}"`);
      if (article.metaTitle) {
        console.log(`  meta:     "${article.metaTitle}"`);
        console.log(`  → new:    "${cleanText(article.metaTitle)}"`);
      }
      console.log('');
    }
    console.log(`... and ${Math.max(0, articles.length - 5)} more`);
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const article of articles) {
    const updates = {};

    if (article.title && /soi kèo/i.test(article.title)) {
      updates.title = cleanText(article.title);
    }
    if (article.metaTitle && /soi kèo/i.test(article.metaTitle)) {
      updates.metaTitle = cleanText(article.metaTitle);
    }
    if (article.metaDescription && /soi kèo|kèo nhà cái|tỷ lệ kèo/i.test(article.metaDescription)) {
      updates.metaDescription = cleanText(article.metaDescription);
    }
    if (article.excerpt && /soi kèo|kèo nhà cái|tỷ lệ kèo/i.test(article.excerpt)) {
      updates.excerpt = cleanText(article.excerpt);
    }
    if (article.tags && article.tags.some(t => /soi kèo|kèo nhà cái|tỷ lệ kèo/i.test(t))) {
      updates.tags = cleanTags(article.tags);
    }

    if (Object.keys(updates).length > 0) {
      await SoiKeoArticle.updateOne({ _id: article._id }, { $set: updates });
      updated++;
    }
  }

  console.log(`Updated ${updated} articles`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
