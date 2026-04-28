#!/usr/bin/env node
/**
 * Cleanup orphaned thumbnail / image references.
 *
 * For each article doc whose `thumbnail` or `image` starts with
 * `/article-images/`, verify the file exists on disk. If not, clear the
 * field so the FE falls back to its existing league-logo / emoji
 * placeholder instead of rendering a broken image icon.
 *
 * Run with `node scripts/cleanup-missing-thumbnails.js`.
 *
 * Idempotent — safe to re-run any time.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..');
const ARTICLE_IMAGES_DIR = path.join(ROOT, 'public', 'article-images');

const Article = require('../models/Article');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');
const connectArticlesDB = require('../config/database');

const cache = new Map();
function fileExists(rel) {
  if (!rel || typeof rel !== 'string') return true;
  if (!rel.startsWith('/article-images/')) return true;
  if (cache.has(rel)) return cache.get(rel);
  const filename = rel.replace(/^\/article-images\//, '').split('?')[0];
  const ok = fs.existsSync(path.join(ARTICLE_IMAGES_DIR, filename));
  cache.set(rel, ok);
  return ok;
}

async function cleanCollection(Model, fieldName, label) {
  const docs = await Model.find({ [fieldName]: { $regex: '^/article-images/' } })
    .select(`_id ${fieldName} title slug`)
    .lean();
  console.log(`\n[${label}] candidates with ${fieldName} pointing to /article-images/: ${docs.length}`);
  let cleared = 0;
  let kept = 0;
  for (const d of docs) {
    const rel = d[fieldName];
    if (fileExists(rel)) { kept++; continue; }
    await Model.updateOne({ _id: d._id }, { $unset: { [fieldName]: '' } });
    cleared++;
    console.log(`  cleared ${d.slug || d._id} — was: ${rel}`);
  }
  console.log(`[${label}] cleared=${cleared} kept=${kept}`);
}

async function main() {
  console.log('connecting...');
  await connectArticlesDB();
  console.log(`articles dir: ${ARTICLE_IMAGES_DIR}`);
  console.log(`exists: ${fs.existsSync(ARTICLE_IMAGES_DIR)}`);

  await cleanCollection(AutoArticle, 'thumbnail', 'AutoArticle.thumbnail');
  await cleanCollection(SoiKeoArticle, 'thumbnail', 'SoiKeoArticle.thumbnail');
  await cleanCollection(Article, 'image', 'Article.image');

  await mongoose.disconnect();
  console.log('\ndone.');
}

main().catch(err => {
  console.error('cleanup failed:', err);
  process.exit(1);
});
