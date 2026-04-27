/**
 * One-shot: pull every world-player image into
 * public/world-player-images/<slug>.<ext> and rewrite data/worldPlayers.js
 * to point at the local file. Same idempotent pattern as
 * download-coach-images.js + download-player-images.js.
 *
 * Run:
 *   node scripts/download-world-player-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const { players } = require('../data/worldPlayers');

const OUT_DIR = path.join(__dirname, '..', 'public', 'world-player-images');
const DATA_PATH = path.join(__dirname, '..', 'data', 'worldPlayers.js');
const PUBLIC_PREFIX = '/world-player-images';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function extFromUrl(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'jpg';
  if (clean.endsWith('.webp')) return 'webp';
  return 'jpg';
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'ScoreLineWorldPlayerImageBot/1.0 (https://scoreline.io; contact@scoreline.io)',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetch(new URL(res.headers.location, url).href));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

async function run() {
  const updates = [];

  for (const p of players) {
    if (!p.image) continue;
    if (p.image.startsWith(PUBLIC_PREFIX) || p.image.startsWith('/')) continue;

    const ext = extFromUrl(p.image);
    const filename = `${p.slug}.${ext}`;
    const outPath = path.join(OUT_DIR, filename);
    const publicUrl = `${PUBLIC_PREFIX}/${filename}`;

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      console.log(`✓ ${p.slug} (cached, ${fs.statSync(outPath).size} bytes)`);
      updates.push({ slug: p.slug, oldUrl: p.image, newUrl: publicUrl });
      continue;
    }

    try {
      console.log(`↓ ${p.slug} ← ${p.image.slice(0, 80)}…`);
      const buf = await fetch(p.image);
      fs.writeFileSync(outPath, buf);
      console.log(`  saved ${buf.length} bytes`);
      updates.push({ slug: p.slug, oldUrl: p.image, newUrl: publicUrl });
    } catch (err) {
      console.error(`✗ ${p.slug}: ${err.message}`);
    }
  }

  let src = fs.readFileSync(DATA_PATH, 'utf-8');
  let changed = 0;
  for (const u of updates) {
    if (u.oldUrl === u.newUrl) continue;
    if (src.includes(u.oldUrl)) {
      src = src.replace(u.oldUrl, u.newUrl);
      changed++;
    }
  }
  fs.writeFileSync(DATA_PATH, src);
  console.log(`\nUpdated worldPlayers.js — ${changed} URL(s) rewritten to local paths.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
