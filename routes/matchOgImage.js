/**
 * GET /og/match/:slug.png — lazy on-demand match OG image.
 *
 * First request for a slug parses the readable form, generates the
 * 1200×630 PNG with team names + kickoff time, caches it on disk, and
 * streams the file. Subsequent requests serve directly from disk.
 *
 * Cache headers tell Cloudflare + browsers to keep the image for a
 * month — fixtures don't change identity once scheduled, so the image
 * is essentially immutable per slug.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { generate, OUTPUT_DIR } = require('../services/matchOgImage');

function titleCase(slug) {
  return String(slug || '').replace(/-/g, ' ').replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

// Mirror of seoMatchPages parseSlug — duplicated rather than shared so
// the OG-image route doesn't pull the seoMatchPages module's HTML
// dependencies. Both must stay in sync if the slug format changes.
function parseSlug(slug) {
  const m = slug.match(/^(.+?)-vs-(.+?)-(\d{2})h(\d{2})-ngay-(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, h, a, hh, mi, dd, mo, yy] = m;
  const utcMs = Date.UTC(+yy, +mo - 1, +dd, +hh, +mi);
  if (!Number.isFinite(utcMs)) return null;
  const vn = new Date(utcMs + 7 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    homeName: titleCase(h),
    awayName: titleCase(a),
    vnDateLabel: `${pad(vn.getUTCHours())}h${pad(vn.getUTCMinutes())} ngày ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`,
  };
}

router.get('/og/match/:slug.png', async (req, res) => {
  const slug = req.params.slug;
  const cached = path.join(OUTPUT_DIR, `${slug}.png`);

  // Fast path — file already on disk.
  if (fs.existsSync(cached)) {
    res.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable');
    return res.sendFile(cached);
  }

  const parsed = parseSlug(slug);
  if (!parsed) return res.status(404).send('Invalid slug');

  const file = await generate({ slug, ...parsed });
  if (!file) return res.status(500).send('Image generation failed');

  res.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable');
  res.sendFile(file);
});

module.exports = router;
