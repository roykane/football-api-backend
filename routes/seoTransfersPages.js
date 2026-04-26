/**
 * Transfer-news hub.
 *
 *   GET /chuyen-nhuong          — list (paginated)
 *   GET /chuyen-nhuong/:slug    — detail
 *
 * Same Article collection as /tin-bong-da, filtered to category='transfer'.
 * Schema is **NewsArticle** (not the generic Article we use for /phan-tich)
 * because transfers ARE breaking news — short, time-sensitive, and we want
 * Google News eligibility. The hub itself ships a CollectionPage + ItemList
 * so Google sees this as a topical cluster, not a duplicate of /tin-bong-da.
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

function formatDateVi(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatRelative(date) {
  if (!date) return '';
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDateVi(date);
}

// Compact markdown → HTML for short transfer copy.
function toHtml(text) {
  if (!text) return '';
  const lines = String(text).split('\n');
  const out = [];
  let para = [];
  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + renderInline(para.join(' ').trim()) + '</p>');
      para = [];
    }
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flushPara(); continue; }
    const h2 = t.match(/^##\s+(.+)$/);
    const h3 = t.match(/^###\s+(.+)$/);
    if (h3) { flushPara(); out.push(`<h3>${renderInline(h3[1])}</h3>`); continue; }
    if (h2) { flushPara(); out.push(`<h2>${renderInline(h2[1])}</h2>`); continue; }
    para.push(t);
  }
  flushPara();
  return out.join('\n');
}

function renderInline(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1200px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#2563eb}
    .layout{display:grid;grid-template-columns:1fr 280px;gap:20px;align-items:start}.main{min-width:0}
    .hub-hero{background:linear-gradient(135deg,#7f1d1d,#dc2626);color:#fff;padding:28px 26px;border-radius:10px;margin-bottom:18px}
    .hub-hero h1{font-size:26px;font-weight:800;margin-bottom:6px;letter-spacing:-0.3px}
    .hub-hero .sub{font-size:14px;color:#fecaca;line-height:1.6;max-width:680px}
    .news-card{background:#fff;border-radius:10px;padding:16px 18px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:center;text-decoration:none;color:inherit;transition:box-shadow .15s}
    .news-card:hover{box-shadow:0 4px 14px rgba(0,0,0,0.08)}
    .news-card:hover h2{color:#dc2626}
    .news-card .thumb{width:200px;aspect-ratio:16/10;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,#7f1d1d,#dc2626);display:flex;align-items:center;justify-content:center;color:#fff;font-size:42px}
    .news-card .thumb img{width:100%;height:100%;object-fit:cover}
    .news-card .body{display:flex;flex-direction:column;gap:6px;min-width:0}
    .news-card .pill{display:inline-block;align-self:flex-start;padding:2px 9px;font-size:10.5px;font-weight:800;color:#dc2626;border:1px solid #dc2626;background:#dc262614;border-radius:999px;text-transform:uppercase;letter-spacing:.5px}
    .news-card h2{font-size:16px;font-weight:700;color:#0f172a;line-height:1.4;margin:0;letter-spacing:-0.2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .news-card .desc{font-size:13.5px;color:#64748b;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .news-card .meta{display:flex;align-items:center;gap:8px;font-size:12px;color:#94a3b8}
    @media(max-width:768px){.news-card{grid-template-columns:120px 1fr;gap:12px;padding:12px}.news-card .thumb{width:120px}.news-card h2{font-size:14px}.layout{grid-template-columns:1fr}.sidebar{order:2}}

    /* Detail page */
    .header-card{background:#fff;border-radius:10px;padding:22px 26px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #dc2626}
    .header-card h1{font-size:24px;font-weight:800;color:#0f172a;line-height:1.3;letter-spacing:-0.4px;margin-bottom:8px}
    .header-card .meta{display:flex;flex-wrap:wrap;gap:10px;font-size:13px;color:#64748b}
    .hero-img{width:100%;height:auto;aspect-ratio:1200/630;border-radius:10px;margin-bottom:14px;object-fit:cover;display:block}
    .section-card{background:#fff;border-radius:10px;padding:22px 26px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .section-card h2{font-size:19px;font-weight:800;color:#0f172a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #fee2e2;display:flex;align-items:center;gap:8px}
    .section-card h3{font-size:16px;font-weight:700;color:#1e293b;margin:14px 0 6px}
    .section-card p{margin-bottom:12px;color:#334155;font-size:15px;line-height:1.8}
    .section-card strong{color:#0f172a;font-weight:700}
    .section-card a{color:#dc2626;border-bottom:1px dashed #fca5a5}

    .sidebar{display:flex;flex-direction:column;gap:14px}
    .sidebar-card{background:#fff;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9;text-decoration:none}
    .sidebar-link:last-child{border-bottom:none}
    .sidebar-link:hover{color:#dc2626}
    .pagination{display:flex;align-items:center;justify-content:center;gap:14px;padding:16px 0}
    .pagination a,.pagination span{padding:7px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-weight:600;color:#475569;text-decoration:none}
    .pagination a:hover{border-color:#dc2626;color:#dc2626}
    .pagination .current{background:#dc2626;color:#fff;border-color:#dc2626}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){.header-card,.section-card{padding:14px;border-radius:8px}.header-card h1{font-size:18px}.section-card h2{font-size:17px}}
  `;
}

// ===== HUB =====
router.get('/chuyen-nhuong', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const url = `${SITE_URL}/chuyen-nhuong${page > 1 ? `?page=${page}` : ''}`;
    const canonical = `${SITE_URL}/chuyen-nhuong`;

    const [items, total] = await Promise.all([
      Article.find({ status: 'published', category: 'transfer' })
        .sort({ pubDate: -1, createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select('slug title description image pubDate createdAt updatedAt')
        .lean(),
      Article.countDocuments({ status: 'published', category: 'transfer' }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Chuyển nhượng', item: canonical },
      ],
    };

    // CollectionPage signals topical cluster — Google's preferred schema for
    // topic hubs over a bare ItemList.
    const collectionSchema = items.length ? {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Tin chuyển nhượng bóng đá',
      description: 'Tin chuyển nhượng cầu thủ mới nhất từ các giải bóng đá hàng đầu — Premier League, La Liga, Serie A, Bundesliga, Ligue 1, V-League.',
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: 'ScoreLine', url: SITE_URL },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: items.slice(0, 20).map((a, i) => ({
          '@type': 'ListItem', position: i + 1,
          url: `${SITE_URL}/chuyen-nhuong/${a.slug}`,
          name: a.title,
        })),
      },
    } : null;

    const cardsHtml = items.map((a) => {
      const date = formatRelative(a.pubDate || a.createdAt);
      const img = a.image && !a.image.includes('media.api-sports.io/football/teams/')
        ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" loading="lazy" decoding="async">`
        : '💸';
      return `<a href="/chuyen-nhuong/${escapeHtml(a.slug)}" class="news-card">
        <div class="thumb">${img}</div>
        <div class="body">
          <span class="pill">CHUYỂN NHƯỢNG</span>
          <h2>${escapeHtml(a.title)}</h2>
          ${a.description ? `<p class="desc">${escapeHtml(a.description.slice(0, 160))}</p>` : ''}
          <div class="meta"><span>📅 ${date}</span></div>
        </div>
      </a>`;
    }).join('');

    // rel=prev/next + canonical-without-page tells Google to consolidate.
    const prevHref = page > 1 ? `${SITE_URL}/chuyen-nhuong${page === 2 ? '' : `?page=${page - 1}`}` : null;
    const nextHref = page < totalPages ? `${SITE_URL}/chuyen-nhuong?page=${page + 1}` : null;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Tin Chuyển Nhượng Bóng Đá Hôm Nay${page > 1 ? ` — Trang ${page}` : ''} | ScoreLine</title>
  <meta name="description" content="Tin chuyển nhượng bóng đá mới nhất: cầu thủ chuyển CLB, hợp đồng mới, mượn cho thuê. Cập nhật từ Premier League, La Liga, Serie A, V-League và các giải hàng đầu.">
  <meta name="keywords" content="tin chuyển nhượng, chuyển nhượng bóng đá, mercato, chuyển nhượng hôm nay, tin transfer, mua bán cầu thủ">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(canonical)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}">
  ${prevHref ? `<link rel="prev" href="${escapeHtml(prevHref)}">` : ''}
  ${nextHref ? `<link rel="next" href="${escapeHtml(nextHref)}">` : ''}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:title" content="Tin Chuyển Nhượng Bóng Đá Hôm Nay | ScoreLine">
  <meta property="og:description" content="Tin chuyển nhượng bóng đá mới nhất từ các giải hàng đầu thế giới và V-League.">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Tin Chuyển Nhượng Bóng Đá Hôm Nay | ScoreLine">
  <meta name="twitter:description" content="Tin chuyển nhượng bóng đá mới nhất từ các giải hàng đầu.">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  ${collectionSchema ? `<script type="application/ld+json">${JSON.stringify(collectionSchema)}</script>` : ''}
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Chuyển nhượng</span></nav>
    <div class="hub-hero">
      <h1>💸 Tin Chuyển Nhượng Bóng Đá</h1>
      <div class="sub">Cầu thủ chuyển CLB, hợp đồng mới, mượn cho thuê — cập nhật mỗi 12 giờ từ Premier League, La Liga, Serie A, Bundesliga, Ligue 1 và V-League.</div>
    </div>
    <div class="layout">
      <main class="main">
        ${cardsHtml || '<div class="news-card" style="grid-template-columns:1fr;text-align:center;padding:40px;color:#94a3b8;">Chưa có tin chuyển nhượng. Quay lại sau.</div>'}
        ${totalPages > 1 ? `
        <nav class="pagination" aria-label="Phân trang">
          ${prevHref ? `<a href="${escapeHtml(prevHref)}">← Trang trước</a>` : '<span style="opacity:0.4">← Trang trước</span>'}
          <span class="current">Trang ${page} / ${totalPages}</span>
          ${nextHref ? `<a href="${escapeHtml(nextHref)}">Trang sau →</a>` : '<span style="opacity:0.4">Trang sau →</span>'}
        </nav>` : ''}
      </main>
      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">📰 Khám phá thêm</div>
          <a href="/tin-bong-da" class="sidebar-link">Tin trận đấu</a>
          <a href="/phan-tich" class="sidebar-link">Phân tích chuyên sâu</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định trận đấu</a>
          <a href="/cau-thu" class="sidebar-link">Cầu thủ Việt Nam</a>
          <a href="/huan-luyen-vien" class="sidebar-link">Huấn luyện viên</a>
          <a href="/world-cup-2026" class="sidebar-link">🏆 World Cup 2026</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Tin chuyển nhượng bóng đá mới nhất</div>
  </div>
</body>
</html>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=300');
    res.send(html);
  } catch (err) {
    console.error('[seoTransfersPages hub] error:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

// ===== DETAIL =====
router.get('/chuyen-nhuong/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug, status: 'published', category: 'transfer' }).lean();
    if (!article) {
      // If the slug exists under a different category, send the user to the
      // canonical home so signals consolidate.
      const any = await Article.findOne({ slug: req.params.slug, status: 'published' }).select('category').lean();
      if (any) {
        const target = any.category === 'analysis' ? `/phan-tich/${req.params.slug}` : `/tin-bong-da/${req.params.slug}`;
        return res.redirect(301, target);
      }
      res.set('X-Robots-Tag', 'noindex');
      return res.status(410).send('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>Tin chuyển nhượng đã được gỡ</h1><p><a href="/chuyen-nhuong">Về trang chuyển nhượng</a></p></body></html>');
    }

    Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    const url = `${SITE_URL}/chuyen-nhuong/${article.slug}`;
    const datePublished = new Date(article.pubDate || article.createdAt || Date.now()).toISOString();
    const dateModified = new Date(article.updatedAt || article.pubDate || article.createdAt || Date.now()).toISOString();
    const img = article.image && !article.image.includes('media.api-sports.io/football/teams/')
      ? article.image : `${SITE_URL}/og-image.jpg`;
    const isOgFallback = img === `${SITE_URL}/og-image.jpg`;

    // NewsArticle (not generic Article) so the article keeps Google News
    // eligibility — short transfer reports map exactly onto this schema.
    const newsArticleSchema = {
      '@context': 'https://schema.org', '@type': 'NewsArticle',
      headline: article.title,
      description: (article.description || '').slice(0, 200),
      url, datePublished, dateModified,
      inLanguage: 'vi-VN',
      articleSection: 'Chuyển nhượng',
      author: { '@type': 'Organization', name: 'Ban Biên Tập ScoreLine', url: `${SITE_URL}/about` },
      publisher: { '@type': 'Organization', name: 'ScoreLine', logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 } },
      image: isOgFallback
        ? { '@type': 'ImageObject', url: img, width: 1200, height: 630 }
        : { '@type': 'ImageObject', url: img },
      mainEntityOfPage: url,
    };
    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Chuyển nhượng', item: `${SITE_URL}/chuyen-nhuong` },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    };

    const related = await Article.find({
      status: 'published', category: 'transfer', _id: { $ne: article._id },
    }).sort({ pubDate: -1 }).limit(5).select('slug title').lean();
    const sidebarRelated = related.length ? `
      <div class="sidebar-card">
        <div class="sidebar-title">💸 Chuyển nhượng khác</div>
        ${related.map((r) => `<a href="/chuyen-nhuong/${escapeHtml(r.slug)}" class="sidebar-link">${escapeHtml(r.title)}</a>`).join('')}
      </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(article.title)} | Chuyển nhượng | ScoreLine</title>
  <meta name="description" content="${escapeHtml((article.description || '').slice(0, 180))}">
  <meta name="keywords" content="${escapeHtml(article.tags?.join(', ') || 'tin chuyển nhượng, chuyển nhượng bóng đá')}">
  <meta name="robots" content="index, follow, max-image-preview:large">
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
  <meta property="article:section" content="Chuyển nhượng">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(article.title)}">
  <meta name="twitter:description" content="${escapeHtml((article.description || '').slice(0, 180))}">
  <meta name="twitter:image" content="${escapeHtml(img)}">
  <script type="application/ld+json">${JSON.stringify(newsArticleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/chuyen-nhuong">Chuyển nhượng</a> &rsaquo;
      <span>${escapeHtml(article.title.slice(0, 60))}${article.title.length > 60 ? '…' : ''}</span>
    </nav>
    <div class="layout">
      <main class="main">
        <div class="header-card">
          <h1>${escapeHtml(article.title)}</h1>
          <div class="meta">
            <span>📅 ${formatDateVi(article.pubDate || article.createdAt)}</span>
            <span>📂 Chuyển nhượng</span>
          </div>
        </div>
        ${!isOgFallback ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(article.title)}" class="hero-img" loading="eager" decoding="async" fetchpriority="high">` : ''}
        <div class="section-card">
          ${toHtml(article.content || article.description || '')}
        </div>
        ${authorByline({
          publishedIso: datePublished,
          modifiedIso: dateModified,
          icon: '💸',
          bio: 'Tin chuyển nhượng tổng hợp từ dữ liệu API-Sports + truyền thông quốc tế. Dữ liệu được kiểm chứng trước khi xuất bản.',
        })}
      </main>
      <aside class="sidebar">
        ${sidebarRelated}
        <div class="sidebar-card">
          <div class="sidebar-title">📰 Khám phá thêm</div>
          <a href="/chuyen-nhuong" class="sidebar-link">Tất cả chuyển nhượng</a>
          <a href="/tin-bong-da" class="sidebar-link">Tin trận đấu</a>
          <a href="/phan-tich" class="sidebar-link">Phân tích chuyên sâu</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định trận đấu</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Tin chuyển nhượng bóng đá mới nhất</div>
  </div>
</body>
</html>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    res.send(html);
  } catch (err) {
    console.error('[seoTransfersPages detail] error:', err);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

module.exports = router;
