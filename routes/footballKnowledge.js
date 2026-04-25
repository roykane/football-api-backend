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
    .hub-hero{background:linear-gradient(135deg,#0ea5e9,#1e40af);color:#fff;padding:36px 28px;border-radius:8px;margin-bottom:16px;text-align:center}
    .hub-hero h1{font-size:28px;font-weight:800;margin-bottom:8px}
    .hub-hero .sub{font-size:14px;color:#bae6fd}
    .article-card{background:#fff;border-radius:8px;padding:20px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);display:flex;gap:16px;align-items:flex-start;text-decoration:none}
    .article-card .icon{font-size:36px;flex-shrink:0}
    .article-card h2{color:#0f172a;font-size:19px;margin-bottom:6px}
    .article-card .cat{display:inline-block;font-size:11px;color:#0369a1;background:#e0f2fe;padding:2px 8px;border-radius:3px;margin-bottom:6px}
    .article-card p{color:#475569;font-size:14px;margin:0}
    .header-card{background:#fff;border-radius:8px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #0ea5e9}
    .header-card h1{font-size:26px;font-weight:800;color:#0f172a;margin-bottom:8px;line-height:1.3}
    .intro-box{background:#fff;border-radius:8px;padding:18px 20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #e0f2fe}
    .intro-box p{color:#475569;font-size:15px;line-height:1.7;margin:0}
    .section-card{background:#fff;border-radius:8px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .section-card h2{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #e0f2fe;display:flex;align-items:center;gap:8px}
    .section-card h3{font-size:17px;font-weight:700;color:#1e293b;margin:18px 0 8px}
    .section-card p{margin-bottom:12px;color:#334155;font-size:15.5px;line-height:1.8}
    .section-card ul,.section-card ol{margin:10px 0;padding-left:24px}
    .section-card li{margin-bottom:6px;color:#334155;font-size:15px;line-height:1.6}
    .section-card li::marker{color:#0ea5e9;font-weight:700}
    .section-card strong{color:#0f172a;font-weight:700}
    .section-card a{color:#0ea5e9;font-weight:500}
    .section-card a:hover{text-decoration:underline}
    .article-meta{font-size:13px;color:#94a3b8}
    .faq-item{background:#f8fafc;border-radius:6px;padding:14px 16px;margin-bottom:10px;border-left:3px solid #0ea5e9}
    .faq-item .q{font-weight:700;color:#0f172a;margin-bottom:6px;font-size:15px}
    .faq-item .a{color:#475569;font-size:14px}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){.layout{grid-template-columns:1fr}.sidebar{order:2}.section-card,.header-card{padding:18px 16px}.header-card h1{font-size:22px}}
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
  const { datePublished, dateModified } = getEntityDates(article);
  const og = pickOgImage(article, { alt: article.title });
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: article.title, description: article.metaDesc, url,
    datePublished, dateModified,
    inLanguage: 'vi-VN',
    author: { '@type': 'Organization', name: 'Ban Biên Tập ScoreLine', url: `${SITE_URL}/about` },
    publisher: { '@type': 'Organization', name: 'ScoreLine', logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 } },
    image: og.knownDimensions
      ? { '@type': 'ImageObject', url: og.url, width: og.width, height: og.height }
      : { '@type': 'ImageObject', url: og.url },
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
    <div class="section-card">
      <h2 id="cau-hoi-thuong-gap">❓ Câu hỏi thường gặp</h2>
      ${article.faqs.map(f => `<div class="faq-item"><div class="q">${escapeHtml(f.q)}</div><div class="a">${escapeHtml(f.a)}</div></div>`).join('')}
    </div>` : '';

  // Build TOC from both ## and ### headings — single-H2 articles like
  // "17 Điều luật" need H3 entries (Điều 1, 2, …) to be navigable.
  const slugify = (str) => String(str || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);

  // Scan the raw markdown for headings + assign unique ids (suffix on collision).
  const headings = [];
  const idSeen = Object.create(null);
  for (const line of String(article.body || '').split('\n')) {
    const trimmed = line.trim();
    let depth = 0, title = '';
    if (/^##\s+/.test(trimmed)) { depth = 2; title = trimmed.replace(/^##\s+/, ''); }
    else if (/^###\s+/.test(trimmed)) { depth = 3; title = trimmed.replace(/^###\s+/, ''); }
    if (!depth) continue;
    let id = slugify(title) || `sec-${headings.length + 1}`;
    if (idSeen[id]) id = `${id}-${idSeen[id] + 1}`;
    idSeen[id] = (idSeen[id] || 0) + 1;
    headings.push({ depth, title, id });
  }
  const sections = splitBySections(article.body).filter(sec => sec.title && sec.title.trim());

  const tocItems = headings.map(h => ({ id: h.id, title: h.title, depth: h.depth }));
  if (article.faqs?.length) tocItems.push({ id: 'cau-hoi-thuong-gap', title: 'Câu hỏi thường gặp', depth: 2 });

  const tocHtml = tocItems.length >= 3 ? `
    <div class="sidebar-card toc-card">
      <div class="sidebar-title">📑 Mục lục bài viết</div>
      <ol class="toc-list">
        ${tocItems.map((t, i) => `<li class="toc-d${t.depth}"><a href="#${t.id}" class="toc-link">${t.depth === 2 ? `<span class="toc-num">${i + 1}.</span> ` : ''}${escapeHtml(t.title)}</a></li>`).join('')}
      </ol>
    </div>` : '';

  const tocItemList = tocItems.length >= 3 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Mục lục: ${article.title}`,
    itemListElement: tocItems.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.title,
      url: `${url}#${t.id}`,
    })),
  } : null;

  // Inject the matching id onto every <h2>/<h3> the markdown renderer emits.
  // We pop ids in document order — same order they were extracted in.
  const injectHeadingIds = (html) => {
    const queue = headings.slice();
    return String(html).replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (m, tag) => {
      const next = queue.shift();
      if (!next) return m;
      return m.replace(`<${tag}>`, `<${tag} id="${next.id}">`);
    });
  };

  const sectionCardsHtml = sections.length
    ? sections.map(sec => `<div class="section-card">
        ${injectHeadingIds(`<h2>${escapeHtml(sec.title)}</h2>\n${markdownToHtml(sec.body)}`)}
      </div>`).join('\n')
    : splitBySections(article.body).map(sec => {
        if (!sec.title && !sec.body.trim()) return '';
        return `<div class="section-card">${injectHeadingIds(markdownToHtml(sec.body))}</div>`;
      }).join('\n');

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
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta property="article:published_time" content="${datePublished}">
  <meta property="article:modified_time" content="${dateModified}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.title)}">
  <meta name="twitter:description" content="${escapeHtml(article.metaDesc)}">
  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  ${tocItemList ? `<script type="application/ld+json">${JSON.stringify(tocItemList)}</script>` : ''}
  <style>${baseStyles()}
    html{scroll-behavior:smooth}
    .toc-list{list-style:none;padding:0;margin:0}
    .toc-list li{padding:0;margin:0}
    .toc-d3{padding-left:18px}
    .toc-link{display:block;padding:5px 0;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;line-height:1.45;text-decoration:none}
    .toc-d2 .toc-link{font-size:13.5px;font-weight:600;color:#0f172a}
    .toc-list li:last-child .toc-link{border-bottom:none}
    .toc-link:hover{color:#0ea5e9}
    .toc-num{display:inline-block;min-width:22px;color:#94a3b8;font-weight:700}
    .section-card h2,.section-card h3{scroll-margin-top:80px}
  </style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/kien-thuc-bong-da">Kiến thức bóng đá</a> &rsaquo; <span>${escapeHtml(article.title.split(' - ')[0])}</span></nav>
    <div class="layout">
      <main class="main">
        <div class="header-card">
          <h1>${article.icon} ${escapeHtml(article.title.split(' - ')[0])}</h1>
          <div class="article-meta">📂 ${escapeHtml(article.category)} · ${dateModified !== datePublished
            ? `⏱ Cập nhật <time datetime="${dateModified}">${formatDateVi(dateModified)}</time>`
            : `📅 Đăng <time datetime="${datePublished}">${formatDateVi(datePublished)}</time>`
          }</div>
        </div>
        <div class="intro-box"><p>${escapeHtml(article.metaDesc)}</p></div>
        ${sectionCardsHtml}
        ${faqsHtml}
        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '📚', bio: 'Bài viết tổng hợp & biên soạn bởi đội ngũ ScoreLine, đối chiếu với tài liệu chính thức của FIFA và các Liên đoàn bóng đá quốc gia. Phản ánh sai sót xin gửi qua trang <a href="/about">Giới thiệu</a>.' })}
        <div class="section-card">
          <h2>🔗 Bài viết liên quan</h2>
          <p>
            ${otherArticles.slice(0, 4).map(a => `<a href="/kien-thuc-bong-da/${a.slug}">${a.icon} ${escapeHtml(a.title.split(' - ')[0])}</a>`).join(' · ')}
          </p>
        </div>
      </main>
      <aside class="sidebar">
        ${tocHtml}
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
