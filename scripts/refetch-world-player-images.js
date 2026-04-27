/**
 * Re-fetch world-player photos from Wikipedia.
 *
 * The first download script (download-world-player-images.js) used hand-
 * coded Wikipedia URLs that I'd guessed — most 404'd. This script does it
 * properly: hits the Wikipedia REST page-summary endpoint, picks the
 * `originalimage.source` (or `thumbnail.source` if missing), and downloads
 * that. Page-summary returns the canonical image regardless of how the
 * uploaded file is named.
 *
 * Behaviour:
 *   - Skips slugs that already have a non-SVG file (won't re-download).
 *   - 4-second delay between every Wikipedia call to stay under the soft
 *     rate-limit. Total runtime ≈ 4 min for 28 placeholders.
 *   - Tries `player.name` first, then `player.fullName` if the short form
 *     hits a disambiguation or 404.
 *   - On success: writes the new file, deletes the .svg placeholder,
 *     rewrites data/worldPlayers.js to point at the new URL.
 *
 * Run:
 *   node scripts/refetch-world-player-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const { players } = require('../data/worldPlayers');

const OUT_DIR = path.join(__dirname, '..', 'public', 'world-player-images');
const DATA_PATH = path.join(__dirname, '..', 'data', 'worldPlayers.js');
const PUBLIC_PREFIX = '/world-player-images';
const DELAY_MS = 4000;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'ScoreLineImageBot/1.0 (https://scoreline.io; contact@scoreline.io)',
        'Accept': 'application/json',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchJson(new URL(res.headers.location, url).href));
      }
      if (res.statusCode === 404) return resolve(null);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    }).on('error', reject).setTimeout(15000, function () { this.destroy(new Error('timeout')); });
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'ScoreLineImageBot/1.0 (https://scoreline.io; contact@scoreline.io)',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchBuffer(new URL(res.headers.location, url).href));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject).setTimeout(20000, function () { this.destroy(new Error('timeout')); });
  });
}

function extFromUrl(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.svg')) return 'svg';
  return 'jpg';
}

async function lookupWikipedia(title) {
  // Underscores instead of spaces — both work, underscores avoid an extra
  // redirect for multi-word titles.
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const data = await fetchJson(url);
  if (!data) return null;
  return data?.originalimage?.source || data?.thumbnail?.source || null;
}

function realImageExists(slug) {
  return ['jpg', 'jpeg', 'png', 'webp'].some(ext =>
    fs.existsSync(path.join(OUT_DIR, `${slug}.${ext}`))
  );
}

async function run() {
  const updates = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of players) {
    if (realImageExists(p.slug)) {
      console.log(`✓ ${p.slug} (already has real image)`);
      skipped++;
      continue;
    }

    try {
      console.log(`🔍 ${p.slug} → Wikipedia: "${p.name}"`);
      let imgUrl = await lookupWikipedia(p.name);
      await sleep(DELAY_MS);

      if (!imgUrl && p.fullName && p.fullName !== p.name) {
        console.log(`   ↳ trying fullName: "${p.fullName}"`);
        imgUrl = await lookupWikipedia(p.fullName);
        await sleep(DELAY_MS);
      }

      if (!imgUrl) {
        console.log(`   ✗ no photo on Wikipedia`);
        failed++;
        continue;
      }

      console.log(`   ↓ ${imgUrl.slice(0, 80)}…`);
      const buf = await fetchBuffer(imgUrl);
      const ext = extFromUrl(imgUrl);
      const outPath = path.join(OUT_DIR, `${p.slug}.${ext}`);
      fs.writeFileSync(outPath, buf);
      console.log(`   ✅ saved ${buf.length} bytes`);

      // Replace SVG path → new real-image path in the data file.
      const oldPublic = `${PUBLIC_PREFIX}/${p.slug}.svg`;
      const newPublic = `${PUBLIC_PREFIX}/${p.slug}.${ext}`;
      updates.push({ slug: p.slug, oldUrl: oldPublic, newUrl: newPublic });

      // Remove the now-obsolete SVG placeholder so the directory is clean.
      const svgPath = path.join(OUT_DIR, `${p.slug}.svg`);
      if (fs.existsSync(svgPath)) {
        fs.unlinkSync(svgPath);
        console.log(`   🗑  removed ${p.slug}.svg`);
      }
      downloaded++;
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`✗ ${p.slug}: ${err.message}`);
      failed++;
      await sleep(DELAY_MS);
    }
  }

  if (updates.length > 0) {
    let src = fs.readFileSync(DATA_PATH, 'utf-8');
    let changed = 0;
    for (const u of updates) {
      if (src.includes(u.oldUrl)) {
        src = src.replace(u.oldUrl, u.newUrl);
        changed++;
      }
    }
    fs.writeFileSync(DATA_PATH, src);
    console.log(`\nUpdated worldPlayers.js — ${changed} URL(s) rewritten.`);
  }

  console.log(`\nSummary:`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped (already real): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${players.length}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
