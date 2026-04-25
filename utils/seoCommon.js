/**
 * Shared SEO helpers for static-data SSR routes (knowledge, players, coaches,
 * world-cup-2026, etc.)
 *
 * Centralises three things every SSR page needs but tends to drift on:
 *   1. Date handling — pulls per-entity publishedAt/updatedAt or falls back
 *      to a constant. Avoids "Date.now()" lying about freshness.
 *   2. OG image selection — prefer entity-specific image; fall back gracefully.
 *   3. Author byline HTML — visible E-E-A-T signal users see in the rendered page.
 */

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

// Truthful seed date for the static-data hubs that were all published
// together on 2026-04-21. Editors can override per item by setting
// `publishedAt` on the data record. Putting it in the data layer (vs. the
// route) means future re-publishes don't lie.
const DEFAULT_PUBLISHED_AT = '2026-04-21T00:00:00Z';

function escapeHtmlBasic(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Return ISO datePublished + dateModified for a static-data entity.
 *   - publishedAt (item.publishedAt) → entity-specific publish date.
 *   - updatedAt (item.updatedAt) → only if explicitly set; otherwise
 *     dateModified equals datePublished (no fake "modified now" signal).
 */
function getEntityDates(entity) {
  const published = entity?.publishedAt
    ? new Date(entity.publishedAt).toISOString()
    : DEFAULT_PUBLISHED_AT;
  const modified = entity?.updatedAt
    ? new Date(entity.updatedAt).toISOString()
    : published;
  return { datePublished: published, dateModified: modified };
}

function formatDateVi(iso) {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Pick the best OG image for an entity.
 * - Prefer entity.image (player photo, coach photo, …) if it looks absolute.
 * - Optional override via opts.preferred (e.g. og-image-1200x630.jpg).
 * - Falls back to /og-image.jpg.
 *
 * Returns { url, alt, width, height } where width/height are only set when
 * the source is the standard fallback (which we know is 1200×630).
 */
function pickOgImage(entity, opts = {}) {
  const fallback = `${SITE_URL}/og-image.jpg`;
  const candidate = opts.preferred || entity?.ogImage || entity?.image;
  const alt = opts.alt || entity?.name || entity?.title || 'ScoreLine';

  if (candidate && /^https?:\/\//.test(candidate)) {
    return {
      url: candidate,
      alt,
      // Don't lie about dimensions — only emit when we know them.
      knownDimensions: !!opts.knownDimensions,
      width: opts.knownDimensions ? 1200 : null,
      height: opts.knownDimensions ? 630 : null,
    };
  }
  return { url: fallback, alt, knownDimensions: true, width: 1200, height: 630 };
}

/**
 * Render OG image meta tags. Width/height only included when known.
 */
function ogImageMeta(og) {
  const lines = [
    `<meta property="og:image" content="${escapeHtmlBasic(og.url)}">`,
    `<meta property="og:image:alt" content="${escapeHtmlBasic(og.alt)}">`,
  ];
  if (og.width && og.height) {
    lines.push(`<meta property="og:image:width" content="${og.width}">`);
    lines.push(`<meta property="og:image:height" content="${og.height}">`);
    lines.push(`<meta property="og:image:type" content="image/jpeg">`);
  }
  lines.push(`<meta name="twitter:image" content="${escapeHtmlBasic(og.url)}">`);
  lines.push(`<meta name="twitter:image:alt" content="${escapeHtmlBasic(og.alt)}">`);
  return lines.join('\n  ');
}

/**
 * Render author byline HTML. Visible E-E-A-T signal that complements the
 * Schema.org `author` field — users actually see it in the page.
 *
 * @param {Object} opts
 * @param {string} opts.publishedIso - ISO datePublished
 * @param {string} opts.modifiedIso - ISO dateModified
 * @param {string} [opts.bio] - Custom bio for the topic; falls back to a
 *   generic ScoreLine editorial line.
 * @param {string} [opts.icon='📝'] - Emoji avatar
 */
function authorByline({ publishedIso, modifiedIso, bio, icon = '📝' }) {
  const published = formatDateVi(publishedIso);
  const modified = formatDateVi(modifiedIso || publishedIso);
  const showModified = modifiedIso && modifiedIso !== publishedIso;
  const defaultBio = 'Đội ngũ biên tập ScoreLine kiểm chứng dữ liệu từ FIFA, AFC, các LĐBĐ quốc gia và nguồn chính thức trước khi xuất bản. Quy trình biên tập được mô tả tại <a href="/about">trang giới thiệu</a>.';
  return `
    <div style="background:#fff;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);display:flex;gap:12px;align-items:flex-start;">
      <div style="width:48px;height:48px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;"><a href="/about" style="color:#0f172a;">Ban Biên Tập ScoreLine</a></div>
        <div style="font-size:13px;color:#64748b;line-height:1.6;margin-top:2px;">${bio || defaultBio}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:6px;">
          Đăng: <time datetime="${publishedIso}">${published}</time>${showModified ? ` · Cập nhật: <time datetime="${modifiedIso}">${modified}</time>` : ''}
        </div>
      </div>
    </div>`;
}

module.exports = {
  SITE_URL,
  DEFAULT_PUBLISHED_AT,
  getEntityDates,
  pickOgImage,
  ogImageMeta,
  authorByline,
  formatDateVi,
};
