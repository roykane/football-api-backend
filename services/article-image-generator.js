/**
 * Article image generator — composes a unique OG-ready (1200×630) image
 * per article so we don't ship the same stock football photo everywhere.
 *
 * Visual template:
 *   ┌──────────────────────────────────────────────┐
 *   │ [LEAGUE NAME] · [DATE]                       │ ← small top strip
 *   │                                              │
 *   │       ┌────┐          ┌────┐                 │
 *   │       │ ⚽ │   VS     │ ⚽ │                 │ ← circular logos
 *   │       └────┘          └────┘                 │
 *   │                                              │
 *   │  Big title wrapped into 2–3 lines            │
 *   │                                              │
 *   │                              SCORELINE.IO    │ ← brand watermark
 *   └──────────────────────────────────────────────┘
 *
 * Flow: download 2 team logos → composite onto gradient background →
 * overlay SVG with title + league text → save PNG → return public URL.
 *
 * Logos come from API-Sports CDN (already stored in Article.matchInfo).
 * Logos are cached on disk so repeat calls for the same team are fast.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// sharp is the only new hard dep. If not installed we defer — the caller can
// opt out of image generation without crashing the worker.
let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️  sharp not installed — article-image-generator will no-op until `npm i sharp`');
}

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'article-images');
const LOGO_CACHE_DIR = path.join(__dirname, '..', 'public', 'team-logos-cache');
const PUBLIC_URL_BASE = '/article-images';

// Ensure dirs exist.
for (const dir of [OUTPUT_DIR, LOGO_CACHE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const W = 1200;
const H = 630;
const LOGO_SIZE = 220;

// League-themed background palettes — lookup by league id/name keyword.
const LEAGUE_THEMES = {
  39:  ['#3d195b', '#ffffff'],       // EPL purple
  140: ['#ee8707', '#ff0000'],       // La Liga orange/red
  78:  ['#d20515', '#000000'],       // Bundesliga red/black
  135: ['#004b85', '#008fd7'],       // Serie A blue
  61:  ['#09154b', '#ef0b0b'],       // Ligue 1 navy/red
  2:   ['#001c58', '#eb0028'],       // UCL dark blue/red
  3:   ['#f58220', '#001733'],       // UEL orange/navy
  340: ['#d71a1a', '#ffd700'],       // V-League red/gold
  1:   ['#0f2f5f', '#c6a14a'],       // World Cup navy/gold
};
const DEFAULT_THEME = ['#0f172a', '#1d4ed8']; // navy → blue

function themeFor(leagueId) {
  return LEAGUE_THEMES[leagueId] || DEFAULT_THEME;
}

/** Download a remote logo once and cache under a hashed filename. */
async function getLogo(url) {
  if (!url) return null;
  const hash = crypto.createHash('md5').update(url).digest('hex');
  const cacheFile = path.join(LOGO_CACHE_DIR, `${hash}.png`);
  if (fs.existsSync(cacheFile)) return cacheFile;
  try {
    const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    // Normalize to a white-bg, padded, circular-masked PNG at LOGO_SIZE.
    const circle = Buffer.from(
      `<svg width="${LOGO_SIZE}" height="${LOGO_SIZE}"><circle cx="${LOGO_SIZE / 2}" cy="${LOGO_SIZE / 2}" r="${LOGO_SIZE / 2}" fill="white"/></svg>`
    );
    const logoPadding = 20;
    const innerSize = LOGO_SIZE - logoPadding * 2;

    // Resize logo to fit the inner area, centered on white circle.
    const resized = await sharp(Buffer.from(data))
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    await sharp(circle)
      .composite([{ input: resized, top: logoPadding, left: logoPadding }])
      .png()
      .toFile(cacheFile);

    return cacheFile;
  } catch (e) {
    console.warn(`⚠️  failed to fetch logo ${url}: ${e.message}`);
    return null;
  }
}

/** Escape text for safe inclusion in SVG. */
function escapeSvg(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Word-wrap `text` into lines that fit within `maxChars` chars. Simple greedy. */
function wrap(text, maxChars = 38, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // Truncate last line with ellipsis if we ran out of room.
  if (lines.length === maxLines) {
    const remainingWordIdx = words.indexOf(current) + current.split(/\s+/).length;
    if (remainingWordIdx < words.length) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.slice(0, maxChars - 1) + '…';
    }
  }
  return lines;
}

/**
 * Build the composed image.
 *
 * @param {Object} opts
 * @param {String} opts.title       — article title (required)
 * @param {String} opts.leagueName  — optional league name
 * @param {Number} opts.leagueId    — optional API-Sports league id (for theme)
 * @param {String} opts.homeLogoUrl — optional
 * @param {String} opts.awayLogoUrl — optional
 * @param {String} opts.articleId   — unique filename key (required)
 * @returns {Promise<string|null>}  — public URL path like /article-images/<id>.png
 */
async function generate({ title, leagueName, leagueId, homeLogoUrl, awayLogoUrl, articleId, dateStr }) {
  if (!sharp) return null;
  if (!articleId || !title) {
    console.warn('article-image-generator: missing articleId/title');
    return null;
  }

  const outFile = path.join(OUTPUT_DIR, `${articleId}.png`);
  const publicUrl = `${PUBLIC_URL_BASE}/${articleId}.png`;

  const [c1, c2] = themeFor(leagueId);
  const titleLines = wrap(title, 42, 3);

  // Build background + text SVG in one go.
  const svgBg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="g2" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  <!-- subtle pattern lines -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="2">
    <line x1="0" y1="0" x2="${W}" y2="${H}"/>
    <line x1="${W}" y1="0" x2="0" y2="${H}"/>
  </g>
</svg>`;

  const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    .league { font: 700 22px sans-serif; fill: rgba(255,255,255,0.75); letter-spacing: 2px; }
    .vs     { font: 900 54px sans-serif; fill: #fbbf24; letter-spacing: 3px; }
    .title  { font: 800 44px sans-serif; fill: #ffffff; }
    .brand  { font: 900 26px sans-serif; fill: rgba(255,255,255,0.8); letter-spacing: 4px; }
    .date   { font: 600 22px sans-serif; fill: rgba(255,255,255,0.6); }
  </style>

  <text x="60" y="60" class="league">${escapeSvg((leagueName || '').toUpperCase())}</text>
  ${dateStr ? `<text x="${W - 60}" y="60" text-anchor="end" class="date">${escapeSvg(dateStr)}</text>` : ''}

  <!-- VS label between logos -->
  <text x="${W / 2}" y="280" text-anchor="middle" class="vs">VS</text>

  <!-- Title, wrapped into up to 3 lines. Center-aligned, bottom area. -->
  ${titleLines.map((line, i) => {
    const y = 450 + i * 54;
    return `<text x="${W / 2}" y="${y}" text-anchor="middle" class="title">${escapeSvg(line)}</text>`;
  }).join('\n  ')}

  <!-- Bottom brand watermark -->
  <text x="${W - 60}" y="${H - 40}" text-anchor="end" class="brand">SCORELINE.IO</text>
</svg>`;

  // Compose layers: bg → home logo → away logo → text overlay.
  const composites = [];

  const homeLogoPath = await getLogo(homeLogoUrl);
  const awayLogoPath = await getLogo(awayLogoUrl);

  if (homeLogoPath) {
    composites.push({
      input: homeLogoPath,
      top: 200,
      left: Math.floor(W / 2) - LOGO_SIZE - 80,
    });
  }
  if (awayLogoPath) {
    composites.push({
      input: awayLogoPath,
      top: 200,
      left: Math.floor(W / 2) + 80,
    });
  }

  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  try {
    await sharp(Buffer.from(svgBg))
      .composite(composites)
      .png({ quality: 90 })
      .toFile(outFile);
    return publicUrl;
  } catch (e) {
    console.error(`❌ article-image-generator failed for ${articleId}:`, e.message);
    return null;
  }
}

/** Build image from an Article document (match-report / transfer / editorial). */
async function generateForArticle(article) {
  if (!sharp) return null;
  if (!article?._id) return null;

  const articleId = String(article._id);
  const title = article.title;
  const info = article.matchInfo || {};

  let leagueName = info.league?.name || '';
  let leagueId = info.league?.id || null;
  let homeLogoUrl = info.homeTeam?.logo || null;
  let awayLogoUrl = info.awayTeam?.logo || null;
  let dateStr = null;
  if (info.matchDate) {
    const d = new Date(info.matchDate);
    dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  return generate({ title, leagueName, leagueId, homeLogoUrl, awayLogoUrl, articleId, dateStr });
}

/**
 * Second variant: "Stats Card" for finished matches (big final score) or
 * "Preview Card" for upcoming matches (big date/time). Saved as
 * {articleId}-2.png so it doesn't collide with the hero image.
 */
async function generateVariant({
  variant = 'score', // 'score' | 'preview'
  title,
  leagueName,
  leagueId,
  homeName,
  awayName,
  homeLogoUrl,
  awayLogoUrl,
  articleId,
  homeScore,
  awayScore,
  dateStr,
  timeStr,
  badge,
}) {
  if (!sharp) return null;
  if (!articleId) return null;

  const outFile = path.join(OUTPUT_DIR, `${articleId}-2.png`);
  const publicUrl = `${PUBLIC_URL_BASE}/${articleId}-2.png`;

  // Reversed gradient for visual differentiation from hero image.
  const [c1, c2] = themeFor(leagueId);
  const titleLines = wrap(title, 44, 2);
  const badgeText = badge || (variant === 'score' ? 'KẾT QUẢ TRẬN ĐẤU' : 'TRƯỚC GIỜ BÓNG LĂN');

  const svgBg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g1" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c1}"/>
    </linearGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  <!-- horizontal pattern bars -->
  <g opacity="0.06" fill="#ffffff">
    <rect x="0" y="140" width="${W}" height="2"/>
    <rect x="0" y="490" width="${W}" height="2"/>
  </g>
</svg>`;

  const centerBig = variant === 'score'
    ? `${homeScore ?? 0} <tspan fill="rgba(255,255,255,0.45)">−</tspan> ${awayScore ?? 0}`
    : (timeStr || dateStr || 'VS');

  const bigFontSize = variant === 'score' ? 96 : 72;

  const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    .badge  { font: 800 20px sans-serif; fill: #0f172a; letter-spacing: 2px; }
    .league { font: 700 20px sans-serif; fill: rgba(255,255,255,0.8); letter-spacing: 1.5px; }
    .team   { font: 800 26px sans-serif; fill: #ffffff; }
    .big    { font: 900 ${bigFontSize}px sans-serif; fill: #fbbf24; letter-spacing: 2px; }
    .title  { font: 700 32px sans-serif; fill: rgba(255,255,255,0.95); }
    .brand  { font: 900 22px sans-serif; fill: rgba(255,255,255,0.7); letter-spacing: 3px; }
    .date   { font: 600 20px sans-serif; fill: rgba(255,255,255,0.65); }
  </style>

  <!-- Top-left badge pill -->
  <rect x="60" y="40" rx="14" ry="14" width="${Math.max(180, badgeText.length * 11 + 30)}" height="38" fill="#fbbf24"/>
  <text x="${60 + 16}" y="66" class="badge">${escapeSvg(badgeText)}</text>

  <!-- Top-right league or date -->
  <text x="${W - 60}" y="66" text-anchor="end" class="league">${escapeSvg((leagueName || '').toUpperCase())}</text>

  <!-- Center big number/time -->
  <text x="${W / 2}" y="300" text-anchor="middle" class="big">${centerBig}</text>

  <!-- Team names under logos -->
  <text x="${W / 2 - 260}" y="475" text-anchor="middle" class="team">${escapeSvg((homeName || '').slice(0, 20))}</text>
  <text x="${W / 2 + 260}" y="475" text-anchor="middle" class="team">${escapeSvg((awayName || '').slice(0, 20))}</text>

  <!-- Title line(s) at bottom -->
  ${titleLines.map((line, i) => {
    const y = 540 + i * 38;
    return `<text x="${W / 2}" y="${y}" text-anchor="middle" class="title">${escapeSvg(line)}</text>`;
  }).join('\n  ')}

  <!-- Bottom-left: date, bottom-right: brand -->
  ${dateStr ? `<text x="60" y="${H - 30}" class="date">${escapeSvg(dateStr)}</text>` : ''}
  <text x="${W - 60}" y="${H - 30}" text-anchor="end" class="brand">SCORELINE.IO</text>
</svg>`;

  const composites = [];

  // Smaller logos in variant (vs huge in hero)
  const smallLogoSize = 160;
  const homeLogoPath = await getLogo(homeLogoUrl);
  const awayLogoPath = await getLogo(awayLogoUrl);

  if (homeLogoPath) {
    // Need to resize down since cached logos are LOGO_SIZE=220
    const resized = await sharp(homeLogoPath).resize(smallLogoSize, smallLogoSize).toBuffer();
    composites.push({ input: resized, top: 250, left: Math.floor(W / 2) - 340 });
  }
  if (awayLogoPath) {
    const resized = await sharp(awayLogoPath).resize(smallLogoSize, smallLogoSize).toBuffer();
    composites.push({ input: resized, top: 250, left: Math.floor(W / 2) + 180 });
  }

  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  try {
    await sharp(Buffer.from(svgBg))
      .composite(composites)
      .png({ quality: 90 })
      .toFile(outFile);
    return publicUrl;
  } catch (e) {
    console.error(`❌ article-image-generator variant failed for ${articleId}:`, e.message);
    return null;
  }
}

/** Build "stats card" variant for an Article — picks 'score' vs 'preview' automatically. */
async function generateVariantForArticle(article) {
  if (!sharp) return null;
  if (!article?._id) return null;

  const articleId = String(article._id);
  const title = article.title;
  const info = article.matchInfo || {};
  const homeScore = info.homeTeam?.score;
  const awayScore = info.awayTeam?.score;
  const hasScore = homeScore != null && awayScore != null;

  let dateStr = null;
  let timeStr = null;
  if (info.matchDate) {
    const d = new Date(info.matchDate);
    dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return generateVariant({
    variant: hasScore ? 'score' : 'preview',
    title,
    leagueName: info.league?.name || '',
    leagueId: info.league?.id || null,
    homeName: info.homeTeam?.name || '',
    awayName: info.awayTeam?.name || '',
    homeLogoUrl: info.homeTeam?.logo || null,
    awayLogoUrl: info.awayTeam?.logo || null,
    articleId,
    homeScore,
    awayScore,
    dateStr,
    timeStr,
  });
}

module.exports = { generate, generateForArticle, generateVariant, generateVariantForArticle };
