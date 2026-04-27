/**
 * One-shot: pull every coach's `image` URL into public/coach-images/<slug>.<ext>
 * and rewrite data/coaches.js to point at the local file.
 *
 * Why: Wikipedia commons hotlinking is unreliable from third-party origins
 * (sporadic 403s, layered CDN issues), and any external dependency means
 * a broken image surface for users when the upstream rotates filenames.
 *
 * Run:
 *   node scripts/download-coach-images.js
 *
 * Idempotent — already-downloaded slugs skip the network hop.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const { coaches } = require('../data/coaches');

const OUT_DIR = path.join(__dirname, '..', 'public', 'coach-images');
const COACHES_PATH = path.join(__dirname, '..', 'data', 'coaches.js');
const PUBLIC_PREFIX = '/coach-images';

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
        // Wikipedia requires a user-agent identifying the caller, otherwise
        // it returns 403/451 for some thumbnails.
        'User-Agent': 'ScoreLineCoachImageBot/1.0 (https://scoreline.io; contact@scoreline.io)',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetch(new URL(res.headers.location, url).href));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
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

  for (const c of coaches) {
    if (!c.image) continue;
    // Skip already-local URLs.
    if (c.image.startsWith(PUBLIC_PREFIX) || c.image.startsWith('/')) continue;

    const ext = extFromUrl(c.image);
    const filename = `${c.slug}.${ext}`;
    const outPath = path.join(OUT_DIR, filename);
    const publicUrl = `${PUBLIC_PREFIX}/${filename}`;

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      console.log(`✓ ${c.slug} (cached, ${fs.statSync(outPath).size} bytes)`);
      updates.push({ slug: c.slug, oldUrl: c.image, newUrl: publicUrl });
      continue;
    }

    try {
      console.log(`↓ ${c.slug} ← ${c.image.slice(0, 80)}…`);
      const buf = await fetch(c.image);
      fs.writeFileSync(outPath, buf);
      console.log(`  saved ${buf.length} bytes`);
      updates.push({ slug: c.slug, oldUrl: c.image, newUrl: publicUrl });
    } catch (err) {
      console.error(`✗ ${c.slug}: ${err.message}`);
    }
  }

  // Rewrite coaches.js — string replacement is safer than regenerating
  // the file, since the file mixes data + Vietnamese text we shouldn't
  // mechanically touch.
  let src = fs.readFileSync(COACHES_PATH, 'utf-8');
  let changed = 0;
  for (const u of updates) {
    if (u.oldUrl === u.newUrl) continue;
    if (src.includes(u.oldUrl)) {
      src = src.replace(u.oldUrl, u.newUrl);
      changed++;
    }
  }
  fs.writeFileSync(COACHES_PATH, src);
  console.log(`\nUpdated coaches.js — ${changed} URL(s) rewritten to local paths.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
