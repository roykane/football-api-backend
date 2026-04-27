/**
 * Match OG-image generator — composes a 1200×630 PNG per /tran-dau slug
 * so social-share previews show "<Home> vs <Away>" instead of the
 * site-wide og-image.jpg logo.
 *
 * Pure text composition (no team-logo download): the slug only carries
 * team names + kickoff time, and a logo lookup would require an API
 * call per share-preview hit. Text-only keeps the route synchronous-ish
 * and lets us cache aggressively (matches don't change identity once
 * scheduled).
 */

const fs = require('fs');
const path = require('path');

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️  sharp not installed — match-og-image will no-op');
}

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'match-og');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const W = 1200;
const H = 630;

function escapeSvg(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fitFont(name, max = 380, base = 88) {
  // Rough heuristic: long names shrink so they fit the half-card width.
  if (!name) return base;
  const len = name.length;
  if (len <= 12) return base;
  if (len <= 18) return Math.round(base * 0.78);
  if (len <= 24) return Math.round(base * 0.62);
  return Math.round(base * 0.5);
}

/**
 * Build (or return cached) PNG for a match.
 *
 * @param {Object} opts
 * @param {String} opts.slug         filename key (e.g. cagliari-vs-atalanta-16h30-ngay-27-04-2026)
 * @param {String} opts.homeName     "Cagliari"
 * @param {String} opts.awayName     "Atalanta"
 * @param {String} opts.vnDateLabel  "23h30 ngày 27/04/2026"
 * @returns {Promise<string|null>}   absolute path to the PNG, or null if sharp missing
 */
async function generate({ slug, homeName, awayName, vnDateLabel }) {
  if (!sharp || !slug || !homeName || !awayName) return null;

  const outFile = path.join(OUTPUT_DIR, `${slug}.png`);
  if (fs.existsSync(outFile)) return outFile;

  const homeFont = fitFont(homeName);
  const awayFont = fitFont(awayName);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="rgba(251,191,36,0.18)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- subtle pitch stripes -->
  <g opacity="0.05" stroke="#ffffff" stroke-width="2">
    <line x1="0" y1="0" x2="${W}" y2="${H}"/>
    <line x1="${W}" y1="0" x2="0" y2="${H}"/>
  </g>

  <!-- top strip: brand + date -->
  <text x="60" y="65" font-family="Roboto, Arial, sans-serif" font-weight="900" font-size="26" fill="#fbbf24" letter-spacing="3">SCORELINE.IO</text>
  <text x="${W - 60}" y="65" text-anchor="end" font-family="Roboto, Arial, sans-serif" font-weight="600" font-size="22" fill="rgba(255,255,255,0.7)" letter-spacing="0.5">${escapeSvg(vnDateLabel || '')}</text>

  <!-- divider line -->
  <line x1="60" y1="100" x2="${W - 60}" y2="100" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

  <!-- VS in centre with gold accent ring -->
  <circle cx="${W / 2}" cy="${H / 2}" r="78" fill="#0f172a" stroke="#fbbf24" stroke-width="4"/>
  <text x="${W / 2}" y="${H / 2 + 22}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="64" fill="#fbbf24">VS</text>

  <!-- Home (left) -->
  <text x="${W / 4}" y="${H / 2 + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="${homeFont}" fill="#ffffff">${escapeSvg(homeName)}</text>

  <!-- Away (right) -->
  <text x="${(W / 4) * 3}" y="${H / 2 + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="${awayFont}" fill="#ffffff">${escapeSvg(awayName)}</text>

  <!-- Bottom CTA strip -->
  <rect x="0" y="${H - 70}" width="${W}" height="70" fill="rgba(0,0,0,0.5)"/>
  <text x="${W / 2}" y="${H - 26}" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-weight="700" font-size="22" fill="rgba(255,255,255,0.9)" letter-spacing="2">TỶ SỐ TRỰC TIẾP · ĐỘI HÌNH · H2H · DỰ ĐOÁN</text>
</svg>`;

  try {
    await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(outFile);
    return outFile;
  } catch (err) {
    console.error('[matchOgImage] generate failed:', err.message);
    return null;
  }
}

module.exports = { generate, OUTPUT_DIR };
