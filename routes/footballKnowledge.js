/**
 * Football Knowledge SSR — AdSense-safe content
 * Routes:
 *   GET /kien-thuc-bong-da — hub/list page
 *   GET /kien-thuc-bong-da/:slug — article detail
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { articles } = require('../data/footballKnowledge');

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
    .hub-hero{background:linear-gradient(135deg,#0ea5e9,#1e40af);color:#fff;padding:36px 28px;border-radius:8px;margin-bottom:16px;text-align:center}
    .hub-hero h1{font-size:28px;font-weight:800;margin-bottom:8px}
    .hub-hero .sub{font-size:14px;color:#bae6fd}
    .article-card{background:#fff;border-radius:8px;padding:20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);display:flex;gap:16px;align-items:flex-start;text-decoration:none}
    .article-card .icon{font-size:36px;flex-shrink:0}
    .article-card h2{color:#0f172a;font-size:19px;margin-bottom:6px}
    .article-card .cat{display:inline-block;font-size:11px;color:#0369a1;background:#e0f2fe;padding:2px 8px;border-radius:3px;margin-bottom:6px}
    .article-card p{color:#475569;font-size:14px;margin:0}
    .card{background:#fff;border-radius:8px;padding:28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h1{font-size:26px;font-weight:800;color:#0f172a;margin-bottom:12px;line-height:1.3}
    .card h2{font-size:22px;font-weight:800;color:#0f172a;margin:22px 0 12px;padding-bottom:6px;border-bottom:2px solid #e0f2fe}
    .card h3{font-size:18px;font-weight:700;color:#1e293b;margin:16px 0 8px}
    .card p{margin-bottom:12px;color:#334155;font-size:15.5px}
    .card ul{margin:10px 0;padding-left:22px}
    .card li{margin-bottom:6px;color:#334155;font-size:15px}
    .card strong{color:#0f172a}
    .card a{color:#0ea5e9;font-weight:500}
    .article-meta{font-size:13px;color:#94a3b8;padding-bottom:12px;border-bottom:1px solid #e2e8f0;margin-bottom:16px}
    .faq-item{background:#f8fafc;border-radius:6px;padding:14px 16px;margin-bottom:10px;border-left:3px solid #0ea5e9}
    .faq-item .q{font-weight:700;color:#0f172a;margin-bottom:6px;font-size:15px}
    .faq-item .a{color:#475569;font-size:14px}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){.layout{grid-template-columns:1fr}.sidebar{order:2}.card{padding:18px 16px}.card h1{font-size:22px}}
  `;
}

// ===== Article detail =====
router.get('/kien-thuc-bong-da/:slug', (req, res) => {
  const article = articles.find(a => a.slug === req.params.slug);
  if (!article) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/kien-thuc-bong-da">Quay lại Kiến Thức Bóng Đá</a></p></body></html>`);
  }
  const url = `${SITE_URL}/kien-thuc-bong-da/${article.slug}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Kiến thức bóng đá', item: `${SITE_URL}/kien-thuc-bong-da` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url }
    ]
  };
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: article.title, description: article.metaDesc, url,
    datePublished: '2026-04-21T00:00:00Z', dateModified: new Date().toISOString(),
    author: { '@type': 'Organization', name: 'ScoreLine', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'ScoreLine', logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 } },
    image: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 },
    mainEntityOfPage: url,
    articleSection: article.category
  };
  const faqSchema = article.faqs?.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: article.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  } : null;

  const otherArticles = articles.filter(a => a.slug !== article.slug).slice(0, 6);
  const sidebarLinks = otherArticles.map(a => `<a href="/kien-thuc-bong-da/${a.slug}" class="sidebar-link">${a.icon} ${escapeHtml(a.title.split(' - ')[0])}</a>`).join('');

  const faqsHtml = article.faqs?.length ? `
    <div class="card">
      <h2>❓ Câu hỏi thường gặp</h2>
      ${article.faqs.map(f => `<div class="faq-item"><div class="q">${escapeHtml(f.q)}</div><div class="a">${escapeHtml(f.a)}</div></div>`).join('')}
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(article.title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(article.metaDesc)}">
  <meta name="keywords" content="${escapeHtml(article.keywords)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(article.title)}">
  <meta property="og:description" content="${escapeHtml(article.metaDesc)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="${escapeHtml(article.title)}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.title)}">
  <meta name="twitter:description" content="${escapeHtml(article.metaDesc)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/kien-thuc-bong-da">Kiến thức bóng đá</a> &rsaquo; <span>${escapeHtml(article.title.split(' - ')[0])}</span></nav>
    <div class="layout">
      <main class="main">
        <div class="card">
          <h1>${article.icon} ${escapeHtml(article.title.split(' - ')[0])}</h1>
          <div class="article-meta">📂 ${escapeHtml(article.category)} · ⏱ Cập nhật 2026-04-21</div>
          ${markdownToHtml(article.body)}
        </div>
        ${faqsHtml}
        <div class="card">
          <h2>🔗 Bài viết liên quan</h2>
          <p>
            ${otherArticles.slice(0, 4).map(a => `<a href="/kien-thuc-bong-da/${a.slug}">${a.icon} ${escapeHtml(a.title.split(' - ')[0])}</a>`).join(' · ')}
          </p>
        </div>
      </main>
      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">📚 Kiến thức khác</div>
          ${sidebarLinks}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a href="/" class="sidebar-link">Trang chủ</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định bóng đá</a>
          <a href="/world-cup-2026" class="sidebar-link">🏆 World Cup 2026</a>
          <a href="/cau-thu" class="sidebar-link">Cầu thủ Việt Nam</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Kiến thức bóng đá và tỷ số trực tiếp</div>
  </div>
</body>
</html>`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

// ===== Hub page =====
router.get('/kien-thuc-bong-da', (req, res) => {
  const url = `${SITE_URL}/kien-thuc-bong-da`;
  const title = 'Kiến Thức Bóng Đá - Luật, Chiến Thuật, Lịch Sử, Công Nghệ';
  const description = 'Kiến thức bóng đá toàn diện: 17 điều luật FIFA, các sơ đồ chiến thuật (4-3-3, 4-2-3-1), lịch sử World Cup, công nghệ VAR, danh sách giải đấu lớn nhất thế giới.';
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Kiến thức bóng đá', item: url }
    ]
  };
  const articlesHtml = articles.map(a => `
    <a href="/kien-thuc-bong-da/${a.slug}" class="article-card">
      <div class="icon">${a.icon}</div>
      <div>
        <div class="cat">${escapeHtml(a.category)}</div>
        <h2>${escapeHtml(a.title.split(' - ')[0])}</h2>
        <p>${escapeHtml(a.metaDesc)}</p>
      </div>
    </a>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="kiến thức bóng đá, luật bóng đá, chiến thuật bóng đá, lịch sử world cup, var, giải đấu bóng đá">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="Kiến thức bóng đá">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Kiến thức bóng đá</span></nav>
    <div class="hub-hero">
      <h1>📚 Kiến Thức Bóng Đá</h1>
      <div class="sub">Luật FIFA · Sơ đồ chiến thuật · Lịch sử World Cup · VAR · Giải đấu</div>
    </div>
    ${articlesHtml}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Kiến thức bóng đá và tỷ số trực tiếp</div>
  </div>
</body>
</html>`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
module.exports.articleSlugs = articles.map(a => a.slug);
