/**
 * Long-form analysis SSR.
 *
 *   GET /phan-tich            — analysis hub / list
 *   GET /phan-tich/:slug      — analysis article detail
 *
 * Same Article collection as /tin-bong-da, filtered to category='analysis'.
 * Schema is the generic Article (not NewsArticle): these are evergreen
 * deep-dives, not Google-News-format breaking-news pieces, so the
 * `max-image-preview:large` and `news_keywords` directives that the news
 * hub ships are dropped here. changefreq is monthly to match the cadence
 * Google should expect.
 */

const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const siteHeader = require('../utils/siteHeader');
const { authorByline } = require('../utils/seoCommon');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const PAGE_SIZE = 20;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateVi(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Markdown → HTML (## h2, ### h3, paragraphs, **bold**, [link]).
function toHtml(text) {
  if (!text) return '';
  const lines = String(text).split('\n');
  const out = [];
  let para = [];
  let listBuf = [];
  let listTag = null;
  const flushPara = () => { if (para.length) { out.push('<p>' + renderInline(para.join(' ').trim()) + '</p>'); para = []; } };
  const flushList = () => { if (listBuf.length && listTag) { out.push('<' + listTag + '>' + listBuf.map((it) => '<li>' + renderInline(it) + '</li>').join('') + '</' + listTag + '>'); listBuf = []; listTag = null; } };
  const flushAll = () => { flushPara(); flushList(); };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flushAll(); continue; }
    const h3 = t.match(/^###\s+(.+)$/);
    const h2 = t.match(/^##\s+(.+)$/);
    const ul = t.match(/^-\s+(.+)$/);
    const ol = t.match(/^\d+\.\s+(.+)$/);
    if (h3) { flushAll(); out.push(`<h3>${renderInline(h3[1])}</h3>`); continue; }
    if (h2) { flushAll(); out.push(`<h2>${renderInline(h2[1])}</h2>`); continue; }
    if (ul) { flushPara(); if (listTag && listTag !== 'ul') flushList(); listTag = 'ul'; listBuf.push(ul[1]); continue; }
    if (ol) { flushPara(); if (listTag && listTag !== 'ol') flushList(); listTag = 'ol'; listBuf.push(ol[1]); continue; }
    flushList();
    para.push(t);
  }
  flushAll();
  return out.join('\n');
}

function renderInline(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function readingTimeMinutes(text) {
  if (!text) return 0;
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 220)); // 220 wpm average for VN
}

// Slug-friendly id (for in-article anchor links).
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.75;color:#1e293b;background:#f1f5f9}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1200px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#2563eb}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}.main{min-width:0}
    .hub-hero{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:32px 26px;border-radius:10px;margin-bottom:18px}
    .hub-hero h1{font-size:28px;font-weight:800;margin-bottom:6px;letter-spacing:-0.3px}
    .hub-hero .sub{font-size:14px;color:#cbd5e1;line-height:1.6;max-width:680px}
    .article-card{background:#fff;border-radius:10px;padding:22px 24px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:grid;grid-template-columns:240px 1fr;gap:20px;align-items:center;text-decoration:none;color:inherit;transition:box-shadow 0.15s}
    .article-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.08)}
    .article-card:hover h2{color:#2563eb}
    .article-card .thumb{width:240px;aspect-ratio:16/10;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,#1e293b,#334155);display:flex;align-items:center;justify-content:center;color:#fff;font-size:42px}
    .article-card .thumb img{width:100%;height:100%;object-fit:cover}
    .article-card .body{display:flex;flex-direction:column;gap:8px;min-width:0}
    .article-card .pill{display:inline-block;align-self:flex-start;padding:2px 9px;font-size:10.5px;font-weight:800;color:#059669;border:1px solid #059669;background:#05966914;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px}
    .article-card h2{font-size:18px;font-weight:700;color:#0f172a;line-height:1.4;margin:0;letter-spacing:-0.2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .article-card .desc{font-size:13.5px;color:#64748b;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .article-card .meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8}
    @media(max-width:768px){.article-card{grid-template-columns:140px 1fr;padding:14px;gap:12px}.article-card .thumb{width:140px}.article-card h2{font-size:15px}.layout{grid-template-columns:1fr}.sidebar{order:2}}

    /* Detail page */
    .header-card{background:#fff;border-radius:10px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #059669}
    .header-card h1{font-size:26px;font-weight:800;color:#0f172a;line-height:1.3;letter-spacing:-0.4px;margin-bottom:10px}
    .header-card .meta{display:flex;flex-wrap:wrap;gap:10px;font-size:13px;color:#64748b}
    .hero-img{width:100%;height:auto;aspect-ratio:1200/630;border-radius:10px;margin-bottom:16px;object-fit:cover;display:block}
    .section-card{background:#fff;border-radius:10px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .section-card h2{font-size:21px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid #d1fae5;display:flex;align-items:center;gap:8px;scroll-margin-top:80px}
    .section-card h3{font-size:17px;font-weight:700;color:#1e293b;margin:18px 0 8px;scroll-margin-top:80px}
    .section-card p{margin-bottom:14px;color:#334155;font-size:15.5px;line-height:1.85}
    .section-card ul,.section-card ol{margin:12px 0;padding-left:24px}
    .section-card li{margin-bottom:8px;color:#334155;font-size:15px;line-height:1.7}
    .section-card li::marker{color:#059669;font-weight:700}
    .section-card strong{color:#0f172a;font-weight:700}
    .section-card a{color:#059669;border-bottom:1px dashed #6ee7b7}

    /* Sidebar */
    .sidebar{display:flex;flex-direction:column;gap:14px}
    .sidebar-card{background:#fff;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9;text-decoration:none}
    .sidebar-link:last-child{border-bottom:none}
    .sidebar-link:hover{color:#059669}
    .toc-list{list-style:none;padding:0;margin:0}
    .toc-list li{padding:0;margin:0}
    .toc-d3{padding-left:18px}
    .toc-link{display:block;padding:5px 0;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;line-height:1.45;text-decoration:none}
    .toc-d2 .toc-link{font-size:13.5px;font-weight:600;color:#0f172a}
    .toc-list li:last-child .toc-link{border-bottom:none}
    .toc-link:hover{color:#059669}
    .toc-num{display:inline-block;min-width:22px;color:#94a3b8;font-weight:700}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){.header-card,.section-card{padding:16px;border-radius:8px}.header-card h1{font-size:20px}.section-card h2{font-size:18px}}
  `;
}

// ===== HUB =====
router.get('/phan-tich', async (req, res) => {
  try {
    const url = `${SITE_URL}/phan-tich`;
    const articles = await Article.find({ status: 'published', category: 'analysis' })
      .sort({ pubDate: -1, createdAt: -1 })
      .limit(50)
      .select('slug title description image pubDate createdAt updatedAt content')
      .lean();

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Phân tích', item: url },
      ],
    };
    const itemListSchema = articles.length ? {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Phân tích chuyên sâu — ScoreLine',
      itemListElement: articles.slice(0, 20).map((a, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE_URL}/phan-tich/${a.slug}`,
        name: a.title,
      })),
    } : null;

    const cardsHtml = articles.map((a) => {
      const dateStr = formatDateVi(a.pubDate || a.createdAt);
      const reading = readingTimeMinutes(a.content);
      const img = a.image && !a.image.includes('media.api-sports.io/football/teams/')
        ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" loading="lazy" decoding="async">`
        : '📊';
      return `<a href="/phan-tich/${escapeHtml(a.slug)}" class="article-card">
        <div class="thumb">${img}</div>
        <div class="body">
          <span class="pill">PHÂN TÍCH</span>
          <h2>${escapeHtml(a.title)}</h2>
          ${a.description ? `<p class="desc">${escapeHtml(a.description)}</p>` : ''}
          <div class="meta">
            <span>📅 ${dateStr}</span>
            <span>•</span>
            <span>⏱ ${reading} phút đọc</span>
          </div>
        </div>
      </a>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Phân Tích Chuyên Sâu Bóng Đá — ScoreLine</title>
  <meta name="description" content="Phân tích chuyên sâu bóng đá: chiến thuật, lịch sử, sơ đồ, công nghệ VAR, top cầu thủ, top huấn luyện viên. Bài dài, dữ liệu chi tiết.">
  <meta name="keywords" content="phân tích bóng đá, chiến thuật bóng đá, sơ đồ chiến thuật, top cầu thủ, top huấn luyện viên, var">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="Phân Tích Chuyên Sâu Bóng Đá — ScoreLine">
  <meta property="og:description" content="Phân tích chuyên sâu bóng đá: chiến thuật, lịch sử, sơ đồ, công nghệ, top cầu thủ và HLV. Bài dài, dữ liệu chi tiết.">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Phân Tích Chuyên Sâu Bóng Đá — ScoreLine">
  <meta name="twitter:description" content="Phân tích chuyên sâu bóng đá: chiến thuật, lịch sử, top cầu thủ và HLV.">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  ${itemListSchema ? `<script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>` : ''}
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Phân tích</span></nav>
    <div class="hub-hero">
      <h1>📊 Phân Tích Chuyên Sâu</h1>
      <div class="sub">Bài viết dài, dữ liệu chi tiết về chiến thuật, lịch sử, công nghệ và những con người làm nên bóng đá hiện đại. Cập nhật khi có chủ đề đáng phân tích — không chạy theo tin trong ngày.</div>
    </div>
    <div class="layout">
      <main class="main">
        ${cardsHtml || '<div class="article-card" style="grid-template-columns:1fr;text-align:center;padding:40px;color:#94a3b8;">Chưa có bài phân tích nào. Quay lại sau.</div>'}
      </main>
      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">📚 Khám phá thêm</div>
          <a href="/kien-thuc-bong-da" class="sidebar-link">Kiến thức bóng đá</a>
          <a href="/cau-thu" class="sidebar-link">Cầu thủ Việt Nam</a>
          <a href="/huan-luyen-vien" class="sidebar-link">Huấn luyện viên</a>
          <a href="/world-cup-2026" class="sidebar-link">🏆 World Cup 2026</a>
          <a href="/tin-bong-da" class="sidebar-link">Tin bóng đá</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Phân tích chuyên sâu, dữ liệu chi tiết</div>
  </div>
</body>
</html>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800');
    res.send(html);
  } catch (err) {
    console.error('[seoAnalysisPages hub] error:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

// ===== DETAIL =====
router.get('/phan-tich/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug, status: 'published', category: 'analysis' }).lean();
    if (!article) {
      // Fall back: maybe the slug was published under a different category in
      // the past — look it up and 301 to the right hub if so. Otherwise 404.
      const any = await Article.findOne({ slug: req.params.slug, status: 'published' }).select('category').lean();
      if (any) return res.redirect(301, `/tin-bong-da/${req.params.slug}`);
      return res.status(404).send('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>Bài viết không tồn tại</h1><p><a href="/phan-tich">Về danh sách phân tích</a></p></body></html>');
    }

    Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    const url = `${SITE_URL}/phan-tich/${article.slug}`;
    const datePublished = new Date(article.pubDate || article.createdAt || Date.now()).toISOString();
    const dateModified = new Date(article.updatedAt || article.pubDate || article.createdAt || Date.now()).toISOString();
    const reading = readingTimeMinutes(article.content);
    const img = article.image && !article.image.includes('media.api-sports.io/football/teams/')
      ? article.image : `${SITE_URL}/og-image.jpg`;
    const isOgFallback = img === `${SITE_URL}/og-image.jpg`;

    // Build TOC + inject ids on h2/h3 the same way the knowledge hub does.
    const headings = [];
    const idSeen = Object.create(null);
    for (const line of String(article.content || '').split('\n')) {
      const t = line.trim();
      let depth = 0, title = '';
      if (/^##\s+/.test(t)) { depth = 2; title = t.replace(/^##\s+/, ''); }
      else if (/^###\s+/.test(t)) { depth = 3; title = t.replace(/^###\s+/, ''); }
      if (!depth) continue;
      let id = slugify(title) || `sec-${headings.length + 1}`;
      if (idSeen[id]) id = `${id}-${idSeen[id] + 1}`;
      idSeen[id] = (idSeen[id] || 0) + 1;
      headings.push({ depth, title, id });
    }
    const injectIds = (html) => {
      const queue = headings.slice();
      return String(html).replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (m, tag) => {
        const next = queue.shift();
        if (!next) return m;
        return m.replace(`<${tag}>`, `<${tag} id="${next.id}">`);
      });
    };

    const tocItems = headings.map((h) => ({ id: h.id, title: h.title, depth: h.depth }));
    const tocHtml = tocItems.length >= 3 ? `
      <div class="sidebar-card">
        <div class="sidebar-title">📑 Mục lục bài viết</div>
        <ol class="toc-list">
          ${tocItems.map((t, i) => `<li class="toc-d${t.depth}"><a href="#${t.id}" class="toc-link">${t.depth === 2 ? `<span class="toc-num">${i + 1}.</span> ` : ''}${escapeHtml(t.title)}</a></li>`).join('')}
        </ol>
      </div>` : '';
    const tocItemList = tocItems.length >= 3 ? {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `Mục lục: ${article.title}`,
      itemListElement: tocItems.map((t, i) => ({
        '@type': 'ListItem', position: i + 1, name: t.title, url: `${url}#${t.id}`,
      })),
    } : null;

    const articleSchema = {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: article.title,
      description: article.description || '',
      url, datePublished, dateModified,
      inLanguage: 'vi-VN',
      author: { '@type': 'Organization', name: 'Ban Biên Tập ScoreLine', url: `${SITE_URL}/about` },
      publisher: { '@type': 'Organization', name: 'ScoreLine', logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 } },
      image: isOgFallback
        ? { '@type': 'ImageObject', url: img, width: 1200, height: 630 }
        : { '@type': 'ImageObject', url: img },
      mainEntityOfPage: url,
      articleSection: 'Phân tích',
    };
    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Phân tích', item: `${SITE_URL}/phan-tich` },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    };

    const related = await Article.find({
      status: 'published', category: 'analysis', _id: { $ne: article._id },
    }).sort({ pubDate: -1 }).limit(5).select('slug title').lean();
    const sidebarRelated = related.length ? `
      <div class="sidebar-card">
        <div class="sidebar-title">📊 Phân tích khác</div>
        ${related.map((r) => `<a href="/phan-tich/${escapeHtml(r.slug)}" class="sidebar-link">${escapeHtml(r.title)}</a>`).join('')}
      </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(article.title)} | Phân tích | ScoreLine</title>
  <meta name="description" content="${escapeHtml((article.description || '').slice(0, 180))}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  ${!isOgFallback ? `<link rel="preload" as="image" href="${escapeHtml(img)}" fetchpriority="high">` : ''}
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(article.title)}">
  <meta property="og:description" content="${escapeHtml((article.description || '').slice(0, 180))}">
  <meta property="og:image" content="${escapeHtml(img)}">
  ${isOgFallback ? '<meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta property="og:image:type" content="image/jpeg">' : ''}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta property="article:published_time" content="${datePublished}">
  <meta property="article:modified_time" content="${dateModified}">
  <meta property="article:section" content="Phân tích">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.title)}">
  <meta name="twitter:description" content="${escapeHtml((article.description || '').slice(0, 180))}">
  <meta name="twitter:image" content="${escapeHtml(img)}">
  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  ${tocItemList ? `<script type="application/ld+json">${JSON.stringify(tocItemList)}</script>` : ''}
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/phan-tich">Phân tích</a> &rsaquo;
      <span>${escapeHtml(article.title.slice(0, 60))}${article.title.length > 60 ? '…' : ''}</span>
    </nav>
    <div class="layout">
      <main class="main">
        <div class="header-card">
          <h1>${escapeHtml(article.title)}</h1>
          <div class="meta">
            <span>📅 ${formatDateVi(article.pubDate || article.createdAt)}</span>
            <span>⏱ ${reading} phút đọc</span>
            <span>📂 Phân tích chuyên sâu</span>
          </div>
        </div>
        ${!isOgFallback ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(article.title)}" class="hero-img" loading="eager" decoding="async" fetchpriority="high">` : ''}
        <div class="section-card">
          ${injectIds(toHtml(article.content))}
        </div>
        ${authorByline({
          publishedIso: datePublished,
          modifiedIso: dateModified,
          icon: '📊',
          bio: 'Bài phân tích biên soạn bởi đội ngũ ScoreLine, đối chiếu với dữ liệu chính thức của FIFA, UEFA và các nguồn truyền thông quốc tế.',
        })}
      </main>
      <aside class="sidebar">
        ${tocHtml}
        ${sidebarRelated}
        <div class="sidebar-card">
          <div class="sidebar-title">📚 Khám phá thêm</div>
          <a href="/phan-tich" class="sidebar-link">Tất cả phân tích</a>
          <a href="/kien-thuc-bong-da" class="sidebar-link">Kiến thức bóng đá</a>
          <a href="/cau-thu" class="sidebar-link">Cầu thủ Việt Nam</a>
          <a href="/huan-luyen-vien" class="sidebar-link">Huấn luyện viên</a>
          <a href="/world-cup-2026" class="sidebar-link">🏆 World Cup 2026</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Phân tích chuyên sâu, dữ liệu chi tiết</div>
  </div>
</body>
</html>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800');
    res.send(html);
  } catch (err) {
    console.error('[seoAnalysisPages detail] error:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

module.exports = router;
