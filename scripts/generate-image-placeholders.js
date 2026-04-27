/**
 * Fill the gaps left by failed Wikipedia downloads — for every entity in
 * data/worldPlayers.js, data/stadiums.js, data/awards.js whose `image`
 * field still points at upload.wikimedia.org (i.e. download script failed
 * with 404 or 429), generate a local SVG placeholder with the entity's
 * initials + name + a brand-coloured background, save to the public/
 * directory the SSR expects, and rewrite the data file to point at it.
 *
 * The result: every rendered page gets a same-origin image URL, no
 * remaining third-party hotlinks. Pages look clean (the SVG is on-brand)
 * and editors can drop a real photo over the placeholder later — the
 * filename is the slug, so future replacement is one-line.
 */

const fs = require('fs');
const path = require('path');

// Per-collection config — where to read entities + write SVGs + how to
// extract a "name" and "slug" from each entity.
const collections = [
  {
    name: 'worldPlayers',
    dataPath: path.join(__dirname, '..', 'data', 'worldPlayers.js'),
    outDir: path.join(__dirname, '..', 'public', 'world-player-images'),
    publicPrefix: '/world-player-images',
    accentBg: '#0a1628',
    accentFg: '#fbbf24',
    field: 'players',
    pickName: (e) => e.name,
    pickSlug: (e) => e.slug,
  },
  {
    name: 'stadiums',
    dataPath: path.join(__dirname, '..', 'data', 'stadiums.js'),
    outDir: path.join(__dirname, '..', 'public', 'stadium-images'),
    publicPrefix: '/stadium-images',
    accentBg: '#1e3a8a',
    accentFg: '#fff',
    field: 'stadiums',
    pickName: (e) => e.name,
    pickSlug: (e) => e.slug,
  },
  {
    name: 'awards',
    dataPath: path.join(__dirname, '..', 'data', 'awards.js'),
    outDir: path.join(__dirname, '..', 'public', 'trophy-images'),
    publicPrefix: '/trophy-images',
    accentBg: '#92400e',
    accentFg: '#fbbf24',
    field: 'awards',
    pickName: (e) => e.name,
    pickSlug: (e) => e.slug,
  },
];

function initials(name) {
  // Stripped-down initials helper. Keeps Vietnamese diacritics out so the
  // SVG renders in the simplest font path.
  const parts = String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function makeSvg({ name, bg, fg }) {
  const inits = initials(name);
  // Truncate long names so they fit a single line at this font-size.
  const shortName = name.length > 28 ? name.slice(0, 26) + '…' : name;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="300" cy="240" r="120" fill="${fg}" fill-opacity="0.12" stroke="${fg}" stroke-width="3"/>
  <text x="300" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="120" font-weight="900" fill="${fg}" text-anchor="middle">${inits}</text>
  <text x="300" y="450" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="32" font-weight="700" fill="#fff" text-anchor="middle"
        opacity="0.95">${shortName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
  <text x="300" y="500" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="18" font-weight="600" fill="${fg}" text-anchor="middle"
        opacity="0.7" letter-spacing="3">SCORELINE</text>
</svg>`;
}

function processCollection(cfg) {
  const mod = require(cfg.dataPath);
  const list = mod[cfg.field];
  if (!Array.isArray(list)) {
    console.warn(`[${cfg.name}] field "${cfg.field}" is not an array, skipping`);
    return;
  }

  if (!fs.existsSync(cfg.outDir)) fs.mkdirSync(cfg.outDir, { recursive: true });
  let src = fs.readFileSync(cfg.dataPath, 'utf-8');
  let written = 0;
  let rewritten = 0;

  for (const entity of list) {
    const slug = cfg.pickSlug(entity);
    const name = cfg.pickName(entity);
    if (!slug || !name) continue;

    // Skip if there's already a real (downloaded) image of any extension
    // for this slug — we don't want to overwrite a successful download.
    const existingExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const hasReal = existingExts.some(ext =>
      fs.existsSync(path.join(cfg.outDir, slug + ext))
    );
    if (hasReal) continue;

    const svgPath = path.join(cfg.outDir, slug + '.svg');
    const publicUrl = `${cfg.publicPrefix}/${slug}.svg`;

    if (!fs.existsSync(svgPath)) {
      const svg = makeSvg({ name, bg: cfg.accentBg, fg: cfg.accentFg });
      fs.writeFileSync(svgPath, svg);
      written++;
      console.log(`+ ${cfg.publicPrefix}/${slug}.svg`);
    }

    // Rewrite data file to point at the placeholder if it still refers
    // to the upstream Wikipedia URL.
    if (entity.image && /^https?:\/\//.test(entity.image)) {
      if (src.includes(entity.image)) {
        src = src.replace(entity.image, publicUrl);
        rewritten++;
      }
    }
  }

  fs.writeFileSync(cfg.dataPath, src);
  console.log(`[${cfg.name}] wrote ${written} placeholder(s), rewrote ${rewritten} URL(s) in data file.\n`);
}

for (const cfg of collections) processCollection(cfg);
