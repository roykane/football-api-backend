/**
 * World Cup 2026 SEO sub-pages
 * Routes: /world-cup-2026/:section
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { sections } = require('../data/worldCup2026');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const { markdownToHtml, splitBySections } = require('../utils/markdown');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, formatDateVi } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    .section-card{background:#fff;border-radius:8px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .section-card h2{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fee2e2;display:flex;align-items:center;gap:8px}
    .section-card h3{font-size:17px;font-weight:700;color:#1e293b;margin:18px 0 8px}
    .section-card p{margin-bottom:12px;color:#334155;font-size:15.5px;line-height:1.8}
    .section-card ul,.section-card ol{margin:10px 0;padding-left:24px}
    .section-card li{margin-bottom:6px;color:#334155;font-size:15px;line-height:1.6}
    .section-card li::marker{color:#dc2626;font-weight:700}
    .section-card strong{color:#0f172a;font-weight:700}
    .section-card a{color:#dc2626;font-weight:500}
    .section-card a:hover{text-decoration:underline}
    .intro{font-size:15px;color:#475569;padding:16px 20px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:16px;line-height:1.7}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .sidebar-link:hover{color:#dc2626}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){.layout{grid-template-columns:1fr}.sidebar{order:2}.wc-hero h1{font-size:24px}.section-card{padding:18px 16px}}
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

  const { datePublished, dateModified } = getEntityDates(section);
  const og = pickOgImage(section, { alt: section.h1 });
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: section.h1,
    description: section.metaDesc,
    url,
    datePublished, dateModified,
    inLanguage: 'vi-VN',
    author: { '@type': 'Organization', name: 'Ban Biên Tập ScoreLine', url: `${SITE_URL}/about` },
    publisher: {
      '@type': 'Organization', name: 'ScoreLine',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 }
    },
    image: og.knownDimensions
      ? { '@type': 'ImageObject', url: og.url, width: og.width, height: og.height }
      : { '@type': 'ImageObject', url: og.url },
    mainEntityOfPage: url
  };

  const siblings = Object.values(sections).filter(s => s.slug !== section.slug);
  const sidebarLinks = siblings.map(s => `<a href="/world-cup-2026/${s.slug}" class="sidebar-link">${escapeHtml(s.h1)}</a>`).join('');

  const sectionCardsHtml = splitBySections(section.body).map(sec => {
    if (!sec.title && !sec.body.trim()) return '';
    return `<div class="section-card">
      ${sec.title ? `<h2>${escapeHtml(sec.title)}</h2>` : ''}
      ${markdownToHtml(sec.body)}
    </div>`;
  }).join('\n');

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
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta property="article:published_time" content="${datePublished}">
  <meta property="article:modified_time" content="${dateModified}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(section.title)}">
  <meta name="twitter:description" content="${escapeHtml(section.metaDesc)}">
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
        ${sectionCardsHtml}
        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏆', bio: 'Thông tin tổng hợp từ FIFA, US Soccer, Canada Soccer, FMF (Mexico) và truyền thông quốc tế. Cập nhật mỗi khi FIFA công bố lịch/bốc thăm/luật chơi mới.' })}
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
