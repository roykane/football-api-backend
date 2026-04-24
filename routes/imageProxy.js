/**
 * Image proxy — fetches remote logos, resizes with sharp, caches to disk,
 * serves WebP when the client accepts it (else PNG).
 *
 * Motivation: team logos from api-sports.io are 150×150 PNG (~80-90KB each)
 * but the UI displays them at 16-72px, so each homepage shipped ~2MB of
 * wasted bytes. This route collapses them to the real displayed width.
 *
 * Usage:  /api/img?url=<encoded remote url>&w=56
 *   w ∈ [16, 512], defaults to 64
 *   q ∈ [40, 95],  defaults to 82
 *
 * Security: url host MUST be on the ALLOWED_HOSTS list. Anything else → 400.
 * Cache:   disk {hash}.{webp|png}; HTTP Cache-Control: 1 year immutable.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️  sharp not installed — /api/img will no-op until `npm i sharp`');
}

const router = express.Router();

const CACHE_DIR = path.join(__dirname, '..', 'public', 'img-cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Only proxy images from these hosts. Extend if you onboard more sources.
const ALLOWED_HOSTS = new Set([
  'media.api-sports.io',
  'media-4.api-sports.io',
  'media-3.api-sports.io',
  'media-2.api-sports.io',
  'media-1.api-sports.io',
]);

const MIN_W = 16;
const MAX_W = 512;
const DEFAULT_W = 64;
const DEFAULT_Q = 82;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function cacheKey(url, w, format) {
  return crypto.createHash('sha1').update(`${url}|${w}|${format}`).digest('hex');
}

function wantsWebp(req) {
  const accept = req.headers.accept || '';
  return accept.includes('image/webp');
}

router.get('/', async (req, res) => {
  if (!sharp) return res.status(503).send('sharp not available');

  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).send('missing url');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).send('invalid url');
  }

  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return res.status(400).send('host not allowed');
  }

  const w = clamp(parseInt(req.query.w, 10) || DEFAULT_W, MIN_W, MAX_W);
  const q = clamp(parseInt(req.query.q, 10) || DEFAULT_Q, 40, 95);
  const format = wantsWebp(req) ? 'webp' : 'png';
  const key = cacheKey(rawUrl, w, format);
  const cachePath = path.join(CACHE_DIR, `${key}.${format}`);

  // Hit the disk cache first.
  if (fs.existsSync(cachePath)) {
    res.type(format);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Cache', 'HIT');
    return fs.createReadStream(cachePath).pipe(res);
  }

  // Miss: fetch the remote, resize, encode, write to disk, stream back.
  try {
    const { data: buf } = await axios.get(rawUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      // Some CDNs reject requests without a UA.
      headers: { 'User-Agent': 'Mozilla/5.0 ScoreLine-ImageProxy/1.0' },
    });

    let pipeline = sharp(Buffer.from(buf))
      .resize(w, w, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

    if (format === 'webp') {
      pipeline = pipeline.webp({ quality: q, effort: 4 });
    } else {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality: q });
    }

    const out = await pipeline.toBuffer();
    // Best-effort write to disk; don't block the response if it fails.
    fs.writeFile(cachePath, out, (err) => {
      if (err) console.warn('[img-proxy] cache write failed:', err.message);
    });

    res.type(format);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Cache', 'MISS');
    return res.send(out);
  } catch (err) {
    console.warn(`[img-proxy] failed ${rawUrl} (w=${w}): ${err.message}`);
    // On upstream failure, 302 to the original so the UI still shows something.
    return res.redirect(302, rawUrl);
  }
});

module.exports = router;
