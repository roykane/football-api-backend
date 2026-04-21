/**
 * World Cup 2026 SEO sub-pages
 * Routes: /world-cup-2026/:section
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { sections } = require('../data/worldCup2026');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markdownToHtml(text) {
  if (!text) return '';
  const blocks = text.split(/\n\n+/);
  return blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^###\s+/.test(trimmed)) return trimmed.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    if (/^##\s+/.test(trimmed)) return trimmed.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    if (/^#\s+/.test(trimmed)) return trimmed.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
    if (/^- /.test(trimmed)) {
      const items = trimmed.replace(/^- (.+)$/gm, '<li>$1</li>');
      return '<ul>' + items + '</ul>';
    }
    let html = trimmed
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }).join('\n');
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.8;color:#1e293b;background:#f1f5f9}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#2563eb}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .wc-hero{background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;padding:36px 28px;border-radius:8px;margin-bottom:16px;text-align:center}
    .wc-hero .flags{font-size:32px;letter-spacing:8px;margin-bottom:10px}
    .wc-hero h1{font-size:30px;font-weight:800;margin-bottom:8px}
    .wc-hero .sub{font-size:14px;color:#fecaca}
    .card{background:#fff;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:22px;font-weight:800;color:#0f172a;margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid #fee2e2}
    .card h3{font-size:18px;font-weight:700;color:#1e293b;margin:14px 0 8px}
    .card p{margin-bottom:12px;color:#334155;font-size:15px}
    .card ul{margin:10px 0;padding-left:22px}
    .card li{margin-bottom:6px;color:#334155;font-size:15px}
    .card strong{color:#0f172a}
    .card a{color:#dc2626;font-weight:500}
    .intro{font-size:16px;color:#475569;padding:16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:16px}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .sidebar-link:hover{color:#dc2626}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){.layout{grid-template-columns:1fr}.sidebar{order:2}.wc-hero h1{font-size:24px}}
  `;
}

function renderSection(req, res, section) {
  const url = `${SITE_URL}/world-cup-2026/${section.slug}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'World Cup 2026', item: `${SITE_URL}/world-cup-2026` },
      { '@type': 'ListItem', position: 3, name: section.title.split(' - ')[0] || section.title, item: url }
    ]
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: section.h1,
    description: section.metaDesc,
    url,
    datePublished: '2026-04-21T00:00:00Z',
    dateModified: new Date().toISOString(),
    author: { '@type': 'Organization', name: 'ScoreLine', url: SITE_URL },
    publisher: {
      '@type': 'Organization', name: 'ScoreLine',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 }
    },
    image: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 },
    mainEntityOfPage: url
  };

  const siblings = Object.values(sections).filter(s => s.slug !== section.slug);
  const sidebarLinks = siblings.map(s => `<a href="/world-cup-2026/${s.slug}" class="sidebar-link">${escapeHtml(s.h1)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(section.title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(section.metaDesc)}">
  <meta name="keywords" content="${escapeHtml(section.keywords)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(section.title)}">
  <meta property="og:description" content="${escapeHtml(section.metaDesc)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="World Cup 2026">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(section.title)}">
  <meta name="twitter:description" content="${escapeHtml(section.metaDesc)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo; <a href="/world-cup-2026">World Cup 2026</a> &rsaquo; <span>${escapeHtml(section.h1)}</span>
    </nav>

    <div class="wc-hero">
      <div class="flags">🇺🇸 🇲🇽 🇨🇦</div>
      <h1>${escapeHtml(section.h1)}</h1>
      <div class="sub">11/6 - 19/7/2026 · 48 đội · 104 trận · 16 thành phố</div>
    </div>

    <div class="layout">
      <main class="main">
        <div class="intro">${escapeHtml(section.intro)}</div>
        <div class="card">
          ${markdownToHtml(section.body)}
        </div>
      </main>
      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🏆 World Cup 2026</div>
          <a href="/world-cup-2026" class="sidebar-link"><strong>Trang chủ WC 2026</strong></a>
          ${sidebarLinks}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a href="/lich-thi-dau" class="sidebar-link">Lịch thi đấu</a>
          <a href="/ket-qua-bong-da" class="sidebar-link">Kết quả</a>
          <a href="/cau-thu" class="sidebar-link">Cầu thủ Việt Nam</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định bóng đá</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Cập nhật World Cup 2026 và bóng đá thế giới</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=43200');
  res.send(html);
}

router.get('/world-cup-2026/:section', (req, res) => {
  const section = sections[req.params.section];
  if (!section) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404 - Trang không tồn tại</h1><p><a href="/world-cup-2026">Về trang World Cup 2026</a></p></body></html>`);
  }
  renderSection(req, res, section);
});

module.exports = router;
module.exports.sectionSlugs = Object.keys(sections);
