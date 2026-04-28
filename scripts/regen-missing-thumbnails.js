#!/usr/bin/env node
/**
 * Regenerate missing article thumbnails using article-image-generator.
 *
 * For each Article / SoiKeoArticle / AutoArticle where the thumbnail
 * is empty AND matchInfo has team logos, call the existing generator
 * to compose a hero from team logos and league name. Saves to
 * /public/article-images/<id>.png and writes the public URL back to
 * the doc's image/thumbnail field.
 *
 * Idempotent — already-set thumbnails are skipped.
 *
 * Usage:
 *   node scripts/regen-missing-thumbnails.js                 # all collections
 *   node scripts/regen-missing-thumbnails.js soi-keo         # specific
 *   node scripts/regen-missing-thumbnails.js article         # specific
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');
const connectArticlesDB = require('../config/database');
const { generateForArticle } = require('../services/article-image-generator');

const SLEEP_MS = 600; // throttle so sharp + logo download don't peak CPU

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Adapter: take a doc + its image-field name, run the generator, write
 * the URL back. Returns { ok, skipped, reason }.
 */
async function regenForDoc(doc, fieldName, label) {
  const id = String(doc._id);
  const current = doc[fieldName];
  if (current && typeof current === 'string' && current.trim()) {
    return { skipped: true, reason: 'already has thumbnail' };
  }
  const info = doc.matchInfo || {};
  if (!info.homeTeam?.logo || !info.awayTeam?.logo) {
    return { skipped: true, reason: 'no team logos in matchInfo' };
  }

  const url = await generateForArticle(doc);
  if (!url) return { skipped: true, reason: 'generator returned null' };

  doc[fieldName] = url;
  if ('imageReviewed' in doc) doc.imageReviewed = false; // generated, not reviewed yet
  await doc.save();
  console.log(`  ✅ [${label}] ${doc.slug || id} → ${url}`);
  return { ok: true };
}

async function processCollection(Model, fieldName, label, filter = {}) {
  console.log(`\n[${label}] scanning…`);
  const query = {
    ...filter,
    $or: [{ [fieldName]: { $exists: false } }, { [fieldName]: null }, { [fieldName]: '' }],
    'matchInfo.homeTeam.logo': { $exists: true, $ne: null },
    'matchInfo.awayTeam.logo': { $exists: true, $ne: null },
  };
  const docs = await Model.find(query);
  console.log(`[${label}] candidates: ${docs.length}`);

  let regen = 0, skipped = 0;
  for (const d of docs) {
    try {
      const r = await regenForDoc(d, fieldName, label);
      if (r.ok) regen++;
      else { skipped++; console.log(`  ⏭️  ${d.slug || d._id}: ${r.reason}`); }
    } catch (err) {
      skipped++;
      console.warn(`  ❌ ${d.slug || d._id}: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }
  console.log(`[${label}] done — regen=${regen} skipped=${skipped}`);
}

async function main() {
  const target = process.argv[2] || 'all';
  console.log(`target: ${target}`);
  await connectArticlesDB();

  if (target === 'all' || target === 'article') {
    await processCollection(Article, 'image', 'Article.image', { status: 'published' });
  }
  if (target === 'all' || target === 'soi-keo') {
    await processCollection(SoiKeoArticle, 'thumbnail', 'SoiKeoArticle.thumbnail', { status: 'published' });
  }
  if (target === 'all' || target === 'auto') {
    await processCollection(AutoArticle, 'thumbnail', 'AutoArticle.thumbnail', { status: 'published' });
  }

  await mongoose.disconnect();
  console.log('\ndone.');
}

main().catch(err => {
  console.error('regen failed:', err);
  process.exit(1);
});
