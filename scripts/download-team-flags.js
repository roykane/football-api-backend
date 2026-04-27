/**
 * One-shot: pull every national-team flag into public/team-flags/<slug>.<ext>
 * and rewrite data/nationalTeams.js to point at the local file.
 *
 * Run:
 *   node scripts/download-team-flags.js
 *
 * Note: Wikipedia flags are SVG which we save as-is. Browsers handle SVG,
 * search-engine bots see the file, and we skip the rasterisation cost.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const { teams } = require('../data/nationalTeams');

const OUT_DIR = path.join(__dirname, '..', 'public', 'team-flags');
const DATA_PATH = path.join(__dirname, '..', 'data', 'nationalTeams.js');
const PUBLIC_PREFIX = '/team-flags';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function extFromUrl(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.svg')) return 'svg';
  if (clean.endsWith('.png')) return 'png';
  return 'svg';
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'ScoreLineFlagBot/1.0 (https://scoreline.io; contact@scoreline.io)',
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
  for (const t of teams) {
    if (!t.flag) continue;
    if (t.flag.startsWith(PUBLIC_PREFIX) || t.flag.startsWith('/')) continue;

    const ext = extFromUrl(t.flag);
    const filename = `${t.slug}.${ext}`;
    const outPath = path.join(OUT_DIR, filename);
    const publicUrl = `${PUBLIC_PREFIX}/${filename}`;

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 200) {
      console.log(`✓ ${t.slug} (cached, ${fs.statSync(outPath).size} bytes)`);
      updates.push({ slug: t.slug, oldUrl: t.flag, newUrl: publicUrl });
      continue;
    }

    try {
      console.log(`↓ ${t.slug} ← ${t.flag.slice(0, 80)}…`);
      const buf = await fetch(t.flag);
      fs.writeFileSync(outPath, buf);
      console.log(`  saved ${buf.length} bytes`);
      updates.push({ slug: t.slug, oldUrl: t.flag, newUrl: publicUrl });
    } catch (err) {
      console.error(`✗ ${t.slug}: ${err.message}`);
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
  console.log(`\nUpdated nationalTeams.js — ${changed} URL(s) rewritten to local paths.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
