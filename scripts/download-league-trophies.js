/**
 * One-shot: download 4 missing league/competition trophy photos from
 * Wikimedia Commons, convert to webp, save into public/images/<slug>.webp.
 *
 * The other 5 league trophies (premier-league, la-liga, serie-a,
 * bundesliga, ligue-1) are already committed by hand. This script fills
 * the gaps for /giai-dau and /lich-su-vo-dich style cards.
 *
 * Usage: node scripts/download-league-trophies.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const sharp = require('sharp');

const OUT_DIR = path.join(__dirname, '..', 'public', 'images');

const SOURCES = [
  {
    slug: 'uefa-champions-league',
    title: 'UEFA Champions League Trophy',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/95/UEFA_Champions_League_Trophy_-_cropped.JPG',
  },
  {
    slug: 'europa-league',
    title: 'UEFA Europa League Trophy',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/2011_UEFA_Europa_League_trophy_at_Museu_FC_Porto.jpg/960px-2011_UEFA_Europa_League_trophy_at_Museu_FC_Porto.jpg',
  },
  {
    slug: 'world-cup',
    title: 'FIFA World Cup Trophy',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FIFA_World_Cup_Trophy_%28Ank_Kumar%2C_Infosys_Limited%29_03.jpg/960px-FIFA_World_Cup_Trophy_%28Ank_Kumar%2C_Infosys_Limited%29_03.jpg',
  },
  {
    slug: 'v-league-1',
    title: 'V.League 1 Logo',
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Eximbank_V-League.png',
  },
];

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'ScoreLineLeagueTrophyBot/1.0 (https://scoreline.io; contact@scoreline.io)',
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          return resolve(
            fetchBuffer(new URL(res.headers.location, url).href, redirects + 1),
          );
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const s of SOURCES) {
    const outPath = path.join(OUT_DIR, `${s.slug}.webp`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) {
      console.log(`✓ ${s.slug} (cached, ${fs.statSync(outPath).size} bytes)`);
      continue;
    }
    try {
      console.log(`↓ ${s.slug} ← ${s.title}`);
      const raw = await fetchBuffer(s.url);
      const out = await sharp(raw)
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
      fs.writeFileSync(outPath, out);
      console.log(`  saved ${out.length} bytes → ${path.relative(process.cwd(), outPath)}`);
    } catch (err) {
      console.error(`✗ ${s.slug}: ${err.message}`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
