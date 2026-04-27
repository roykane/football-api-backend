/**
 * SEO Hub Pages — server-rendered HTML for the article-list hubs that
 * previously fell through to the SPA shell (Googlebot got the index.html
 * template, no h1, no schema, no actual article cards). Pattern mirrors
 * /tin-bong-da hub in seoNewsPages.js but adapted to:
 *   /nhan-dinh   ← SoiKeoArticle
 *   /preview     ← AutoArticle type='round-preview'
 *   /doi-dau     ← AutoArticle type='h2h-analysis' (de-listed but still served)
 *
 * Real users still get the SPA via Nginx try_files. Bot UAs are routed here
 * by the regex location blocks (~ ^/nhan-dinh(/.*)?$ etc.) once the nginx
 * config is updated.
 */

const express = require('express');
const router = express.Router();

const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');
const siteHeader = require('../utils/siteHeader');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const PAGE_SIZE = 20;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n) { return String(n).padStart(2, '0'); }
function formatHHmmDDMMYYYY(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatDDMMYYYY(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    img{max-width:100%;height:auto}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#2563eb}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .hub-hero{padding:28px 24px;border-radius:8px;margin-bottom:16px;color:#fff}
    .hub-hero h1{font-size:26px;font-weight:800;margin-bottom:6px}
    .hub-hero .sub{font-size:14px;opacity:.9}
    .news-card{display:flex;gap:14px;background:#fff;border-radius:8px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(15,23,42,0.04);border:1px solid #e2e8f0;transition:border-color .15s}
    .news-card:hover{border-color:#cbd5e1;text-decoration:none}
    .news-card .thumb{width:140px;height:90px;flex-shrink:0;overflow:hidden;border-radius:6px;background:#0f172a;display:flex;align-items:center;justify-content:center}
    .news-card .thumb img{max-width:100%;max-height:100%;object-fit:cover}
    .news-card .thumb-vs{display:flex;align-items:center;gap:8px;color:#fff;font-weight:800;font-size:11px}
    .news-card .thumb-logo{width:32px;height:32px;background:#fff;border-radius:50%;padding:3px;display:flex;align-items:center;justify-content:center}
    .news-card .thumb-logo img{max-width:80%;max-height:80%}
    .news-card .body{flex:1;min-width:0}
    .news-card .cat{display:inline-block;font-size:11px;padding:2px 8px;border-radius:3px;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
    .news-card h2{color:#0f172a;font-size:16px;line-height:1.4;margin-bottom:6px;font-weight:700}
    .news-card p{color:#64748b;font-size:13px;line-height:1.5;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .news-card .meta{font-size:12px;color:#94a3b8}
    .news-card .meta .league{color:#475569;font-weight:600}
    .pagination{display:flex;justify-content:center;gap:8px;margin:24px 0}
    .pagination a,.pagination span{padding:8px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;font-size:14px;color:#475569;font-weight:600}
    .pagination a:hover{background:#eff6ff;border-color:#bfdbfe;color:#2563eb;text-decoration:none}
    .pagination .current{background:#2563eb;border-color:#2563eb;color:#fff}
    .pagination .disabled{opacity:.4;pointer-events:none}
    .sidebar-card{background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:12px;border:1px solid #e2e8f0}
    .sidebar-title{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
    .sidebar-link{display:block;padding:8px 0;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border:none}.sidebar-link:hover{color:#2563eb}
    .footer{text-align:center;padding:24px 0;color:#94a3b8;font-size:12px}
    @media (max-width:900px){.layout{grid-template-columns:1fr}.news-card .thumb{width:96px;height:64px}.news-card h2{font-size:14px}}
  `;
}

function commonHead({ title, description, canonicalUrl, ogImage, schemas, prevLink, nextLink }) {
  const ld = (Array.isArray(schemas) ? schemas : [schemas])
    .filter(Boolean)
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n  ');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}">
  ${prevLink || ''}
  ${nextLink || ''}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage || `${SITE_URL}/og-image.jpg`)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage || `${SITE_URL}/og-image.jpg`)}">
  ${ld}
  <style>${baseStyles()}</style>
</head>`;
}

// ─── Shared card renderer for match-based articles ────────────────────────
function renderMatchCard({ href, title, excerpt, thumbnail, homeLogo, awayLogo, leagueName, leagueLogo, matchDate, badge, badgeColor }) {
  const thumbHtml = thumbnail
    ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" width="140" height="90" loading="lazy" decoding="async">`
    : (homeLogo && awayLogo)
      ? `<div class="thumb-vs"><div class="thumb-logo"><img src="${escapeHtml(homeLogo)}" alt="" loading="lazy"></div>VS<div class="thumb-logo"><img src="${escapeHtml(awayLogo)}" alt="" loading="lazy"></div></div>`
      : `<div style="font-size:24px;color:#94a3b8">⚽</div>`;
  const dateStr = matchDate ? formatHHmmDDMMYYYY(matchDate) : '';
  const cat = badge
    ? `<span class="cat" style="color:${badgeColor || '#2563eb'};background:${(badgeColor || '#2563eb')}14">${escapeHtml(badge)}</span>`
    : '';
  return `
    <a href="${href}" class="news-card">
      <div class="thumb">${thumbHtml}</div>
      <div class="body">
        ${cat}
        <h2>${escapeHtml(title)}</h2>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ''}
        <div class="meta">
          ${leagueName ? `<span class="league">${escapeHtml(leagueName)}</span>` : ''}
          ${leagueName && dateStr ? ' · ' : ''}
          ${dateStr ? `<time datetime="${new Date(matchDate).toISOString()}">${escapeHtml(dateStr)}</time>` : ''}
        </div>
      </div>
    </a>
  `;
}

function paginationHtml(basePath, page, totalPages) {
  if (totalPages <= 1) return '';
  const qs = (p) => (p > 1 ? `?page=${p}` : '');
  const prev = page > 1
    ? `<a href="${basePath}${qs(page - 1)}" rel="prev">← Trước</a>`
    : `<span class="disabled">← Trước</span>`;
  const next = page < totalPages
    ? `<a href="${basePath}${qs(page + 1)}" rel="next">Sau →</a>`
    : `<span class="disabled">Sau →</span>`;
  return `<div class="pagination">${prev}<span class="current">Trang ${page}/${totalPages}</span>${next}</div>`;
}

function sidebarHtml(extraLinks = []) {
  const links = [
    { href: '/', label: '⚽ Trang chủ — Tỷ số trực tiếp' },
    { href: '/lich-thi-dau', label: '📅 Lịch thi đấu' },
    { href: '/ket-qua-bong-da', label: '🏁 Kết quả' },
    { href: '/nhan-dinh', label: '📊 Nhận định' },
    { href: '/tin-bong-da', label: '📰 Tin bóng đá' },
    { href: '/preview', label: '🏆 Preview vòng đấu' },
    ...extraLinks,
  ];
  return `
    <div class="sidebar-card">
      <div class="sidebar-title">🔗 Truy cập nhanh</div>
      ${links.map((l) => `<a href="${l.href}" class="sidebar-link">${l.label}</a>`).join('')}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════════════
// /nhan-dinh — match preview hub (SoiKeoArticle)
// Sort matches "today first → tomorrow → past 3 days" so the hub mirrors
// what /api/soi-keo/hot returns (same ordering the SPA uses).
// ════════════════════════════════════════════════════════════════════════
router.get('/nhan-dinh', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const now = new Date();
    const twoH = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const threeD = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const [upcoming, past] = await Promise.all([
      SoiKeoArticle.find({ status: 'published', 'matchInfo.matchDate': { $gte: twoH } })
        .sort({ 'matchInfo.matchDate': 1 })
        .select('slug title excerpt thumbnail matchInfo createdAt')
        .lean(),
      SoiKeoArticle.find({ status: 'published', 'matchInfo.matchDate': { $gte: threeD, $lt: twoH } })
        .sort({ 'matchInfo.matchDate': -1 })
        .select('slug title excerpt thumbnail matchInfo createdAt')
        .lean(),
    ]);
    const all = [...upcoming, ...past];
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const canonicalUrl = `${SITE_URL}/nhan-dinh${page > 1 ? `?page=${page}` : ''}`;
    const today = formatDDMMYYYY(new Date());
    const title = `Nhận Định Bóng Đá Hôm Nay ${today} — Phân Tích & Dự Đoán | ScoreLine`;
    const description = 'Nhận định bóng đá hôm nay: phân tích phong độ, đối đầu H2H, dự đoán tỷ số chi tiết. Cập nhật mỗi ngày trên ScoreLine.';

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Nhận định', item: `${SITE_URL}/nhan-dinh` },
      ],
    };
    const itemListSchema = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: items.map((a, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE_URL}/nhan-dinh/${a.slug}`,
        name: a.title,
      })),
    };

    const cardsHtml = items.length ? items.map((a) => renderMatchCard({
      href: `/nhan-dinh/${a.slug}`,
      title: a.title,
      excerpt: a.excerpt,
      thumbnail: a.thumbnail && !a.thumbnail.includes('media.api-sports.io/football/teams/') ? a.thumbnail : null,
      homeLogo: a.matchInfo?.homeTeam?.logo,
      awayLogo: a.matchInfo?.awayTeam?.logo,
      leagueName: a.matchInfo?.league?.name,
      leagueLogo: a.matchInfo?.league?.logo,
      matchDate: a.matchInfo?.matchDate,
      badge: 'Nhận định',
      badgeColor: '#059669',
    })).join('') : `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:40px 28px;text-align:center">
        <div style="font-size:42px;margin-bottom:12px">📊</div>
        <h2 style="color:#0f172a;font-size:20px;margin-bottom:8px">Chưa có bài nhận định</h2>
        <p style="color:#64748b;font-size:14px;margin-bottom:16px">Quay lại sau hoặc xem các chuyên mục khác.</p>
        <div><a href="/lich-thi-dau" style="padding:8px 16px;background:#059669;color:#fff;border-radius:6px;font-weight:600;font-size:14px">📅 Lịch thi đấu</a></div>
      </div>
    `;

    const prevLink = page > 1 ? `<link rel="prev" href="${SITE_URL}/nhan-dinh${page - 1 > 1 ? `?page=${page - 1}` : ''}">` : '';
    const nextLink = page < totalPages ? `<link rel="next" href="${SITE_URL}/nhan-dinh?page=${page + 1}">` : '';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');
    res.send(`${commonHead({
      title, description, canonicalUrl,
      schemas: [breadcrumbSchema, itemListSchema],
      prevLink, nextLink,
    })}
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Nhận định</span></nav>
    <div class="hub-hero" style="background:linear-gradient(135deg,#059669,#047857)">
      <h1>Nhận Định Bóng Đá Hôm Nay</h1>
      <div class="sub">${escapeHtml(description)}</div>
    </div>
    <div class="layout">
      <main class="main">
        ${cardsHtml}
        ${paginationHtml('/nhan-dinh', page, totalPages)}
      </main>
      <aside class="sidebar">${sidebarHtml()}</aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Tỷ số trực tiếp & nhận định bóng đá</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[SEO Hubs] /nhan-dinh error:', err);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

// ════════════════════════════════════════════════════════════════════════
// /preview — round preview hub (AutoArticle type='round-preview')
// ════════════════════════════════════════════════════════════════════════
router.get('/preview', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = { type: 'round-preview', status: 'published' };
    const [items, total] = await Promise.all([
      AutoArticle.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        .select('slug title excerpt thumbnail leagueInfo matchInfo round createdAt')
        .lean(),
      AutoArticle.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const canonicalUrl = `${SITE_URL}/preview${page > 1 ? `?page=${page}` : ''}`;
    const title = 'Preview Vòng Đấu — Phân Tích Vòng Đấu Sắp Tới | ScoreLine';
    const description = 'Preview các vòng đấu hot trên thế giới: NHA, La Liga, Champions League, V-League. Phân tích đội hình, kèo nổi bật, dự đoán kết quả từng trận.';

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Preview vòng đấu', item: `${SITE_URL}/preview` },
      ],
    };
    const itemListSchema = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: items.map((a, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE_URL}/preview/${a.slug}`,
        name: a.title,
      })),
    };

    const cardsHtml = items.length ? items.map((a) => renderMatchCard({
      href: `/preview/${a.slug}`,
      title: a.title,
      excerpt: a.excerpt,
      thumbnail: a.thumbnail || null,
      homeLogo: a.matchInfo?.homeTeam?.logo,
      awayLogo: a.matchInfo?.awayTeam?.logo,
      leagueName: a.leagueInfo?.name || a.matchInfo?.league?.name,
      leagueLogo: a.leagueInfo?.logo || a.matchInfo?.league?.logo,
      matchDate: a.matchInfo?.matchDate || a.createdAt,
      badge: a.round || 'Preview',
      badgeColor: '#dc2626',
    })).join('') : `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:40px 28px;text-align:center">
        <div style="font-size:42px;margin-bottom:12px">🏆</div>
        <h2 style="color:#0f172a;font-size:20px;margin-bottom:8px">Chưa có bài preview</h2>
        <p style="color:#64748b;font-size:14px">Vòng đấu kế tiếp sẽ được cập nhật sớm.</p>
      </div>
    `;

    const prevLink = page > 1 ? `<link rel="prev" href="${SITE_URL}/preview${page - 1 > 1 ? `?page=${page - 1}` : ''}">` : '';
    const nextLink = page < totalPages ? `<link rel="next" href="${SITE_URL}/preview?page=${page + 1}">` : '';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');
    res.send(`${commonHead({
      title, description, canonicalUrl,
      schemas: [breadcrumbSchema, itemListSchema],
      prevLink, nextLink,
    })}
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Preview vòng đấu</span></nav>
    <div class="hub-hero" style="background:linear-gradient(135deg,#dc2626,#b91c1c)">
      <h1>Preview Vòng Đấu</h1>
      <div class="sub">${escapeHtml(description)}</div>
    </div>
    <div class="layout">
      <main class="main">
        ${cardsHtml}
        ${paginationHtml('/preview', page, totalPages)}
      </main>
      <aside class="sidebar">${sidebarHtml()}</aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Tỷ số trực tiếp & preview vòng đấu</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[SEO Hubs] /preview error:', err);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

// ════════════════════════════════════════════════════════════════════════
// /doi-dau — H2H hub (AutoArticle type='h2h-analysis')
// Generation is paused (apr-2026 freeze) but existing archive is still
// served. Hub stays index'd at user request — no noindex here.
// ════════════════════════════════════════════════════════════════════════
router.get('/doi-dau', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = { type: 'h2h-analysis', status: 'published' };
    const [items, total] = await Promise.all([
      AutoArticle.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        .select('slug title excerpt thumbnail matchInfo h2hStats createdAt')
        .lean(),
      AutoArticle.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const canonicalUrl = `${SITE_URL}/doi-dau${page > 1 ? `?page=${page}` : ''}`;
    const title = 'Đối Đầu H2H — Lịch Sử & Thống Kê Đối Đầu Bóng Đá | ScoreLine';
    const description = 'Phân tích đối đầu H2H giữa hai đội: lịch sử giao hữu, phong độ, thống kê thắng-hòa-thua. Tổng hợp dữ liệu trên ScoreLine.';

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Đối đầu H2H', item: `${SITE_URL}/doi-dau` },
      ],
    };
    const itemListSchema = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: items.map((a, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE_URL}/doi-dau/${a.slug}`,
        name: a.title,
      })),
    };

    const cardsHtml = items.length ? items.map((a) => renderMatchCard({
      href: `/doi-dau/${a.slug}`,
      title: a.title,
      excerpt: a.excerpt,
      thumbnail: a.thumbnail || null,
      homeLogo: a.matchInfo?.homeTeam?.logo,
      awayLogo: a.matchInfo?.awayTeam?.logo,
      leagueName: a.matchInfo?.league?.name,
      matchDate: a.matchInfo?.matchDate || a.createdAt,
      badge: a.h2hStats?.totalMatches ? `H2H ${a.h2hStats.totalMatches} trận` : 'Đối đầu',
      badgeColor: '#f59e0b',
    })).join('') : `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:40px 28px;text-align:center">
        <div style="font-size:42px;margin-bottom:12px">⚔️</div>
        <h2 style="color:#0f172a;font-size:20px;margin-bottom:8px">Chưa có bài phân tích đối đầu</h2>
      </div>
    `;

    const prevLink = page > 1 ? `<link rel="prev" href="${SITE_URL}/doi-dau${page - 1 > 1 ? `?page=${page - 1}` : ''}">` : '';
    const nextLink = page < totalPages ? `<link rel="next" href="${SITE_URL}/doi-dau?page=${page + 1}">` : '';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');
    res.send(`${commonHead({
      title, description, canonicalUrl,
      schemas: [breadcrumbSchema, itemListSchema],
      prevLink, nextLink,
    })}
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Đối đầu H2H</span></nav>
    <div class="hub-hero" style="background:linear-gradient(135deg,#f59e0b,#b45309)">
      <h1>Đối Đầu H2H</h1>
      <div class="sub">${escapeHtml(description)}</div>
    </div>
    <div class="layout">
      <main class="main">
        ${cardsHtml}
        ${paginationHtml('/doi-dau', page, totalPages)}
      </main>
      <aside class="sidebar">${sidebarHtml()}</aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Đối đầu H2H bóng đá</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[SEO Hubs] /doi-dau error:', err);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

module.exports = router;
