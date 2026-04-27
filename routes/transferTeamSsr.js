/**
 * Per-club transfer hub SSR — bot-only HTML for /chuyen-nhuong/clb/:slug
 *
 * Filters published transfer-category articles whose `tags` contain the
 * team slug or whose title mentions the team. Targets queries like
 *   "tin chuyển nhượng MU"
 *   "chuyển nhượng real madrid"
 *   "barca mua ai"
 *
 * Falls back gracefully if no articles match — renders the team header,
 * cross-links to /doi-bong/<slug> + the editorial /chuyen-nhuong stream
 * so the URL still indexes meaningfully.
 */

const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Article = require('../models/Article');
const siteHeader = require('../utils/siteHeader');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL, formatDateVi } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function proxyImg(url, w = 32) {
  if (!url) return '';
  if (url.startsWith('/')) return url;
  if (/media[^.]*\.api-sports\.io/.test(url)) return `/api/img?url=${encodeURIComponent(url)}&w=${w}`;
  return url;
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0066FF;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}.main{min-width:0}
    .team-hero{background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #fbbf24}
    .team-hero img{width:64px;height:64px;object-fit:contain;background:#f8fafc;border-radius:8px;padding:6px}
    .team-hero h1{font-size:24px;font-weight:800;color:#0f172a;margin-bottom:4px}
    .team-hero .meta{font-size:13px;color:#64748b}
    .card{background:#fff;border-radius:8px;padding:18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #eff6ff}
    .article{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid #f1f5f9}
    .article:last-child{border-bottom:none}
    .article img{width:128px;height:80px;object-fit:cover;border-radius:6px;flex-shrink:0;background:#f1f5f9}
    .article .title{font-size:16px;font-weight:700;color:#0f172a;line-height:1.4;margin-bottom:6px}
    .article .title a{color:#0f172a}
    .article .desc{font-size:13px;color:#475569;line-height:1.5;margin-bottom:6px}
    .article .meta{font-size:12px;color:#94a3b8}
    .empty{text-align:center;padding:32px;color:#94a3b8}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){
      .team-hero{flex-direction:column;text-align:center;padding:16px}
      .team-hero h1{font-size:20px}
      .article{flex-direction:column}
      .article img{width:100%;height:160px}
    }
  `;
}

// Bare /chuyen-nhuong/clb (no slug) — there's no separate hub page yet,
// so 301 to the editorial transfer stream which lists tin chuyển nhượng
// for every club rather than serving a 404/410.
router.get('/chuyen-nhuong/clb', (req, res) => res.redirect(301, '/chuyen-nhuong'));
router.get('/chuyen-nhuong/clb/', (req, res) => res.redirect(301, '/chuyen-nhuong'));

router.get('/chuyen-nhuong/clb/:slug', async (req, res) => {
  const slug = req.params.slug;

  let team = null;
  try {
    team = await Team.findOne({ slug }).select('slug name logo country league').lean();
  } catch {}

  if (!team) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy CLB | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/chuyen-nhuong">Tin chuyển nhượng</a></p></body></html>`);
  }

  // Match articles either by tag containing the slug, or by team name in
  // title/description. Tag match is preferred (cleaner) but title match
  // catches articles auto-generated before tagging was consistent.
  const teamNameRegex = new RegExp(team.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  let articles = [];
  try {
    articles = await Article.find({
      status: 'published',
      category: 'transfer',
      $or: [
        { tags: slug },
        { tags: team.name },
        { title: teamNameRegex },
      ],
    })
      .sort({ pubDate: -1, createdAt: -1 })
      .limit(40)
      .select('slug title description image pubDate createdAt tags')
      .lean();
  } catch (err) { articles = []; }

  const url = `${SITE_URL}/chuyen-nhuong/clb/${slug}`;
  const title = `Tin Chuyển Nhượng ${team.name} - Mua Bán Cầu Thủ Mới Nhất`;
  const description = articles.length > 0
    ? `${articles.length} tin chuyển nhượng ${team.name} mới nhất: cầu thủ mới, đàm phán, hợp đồng, giá chuyển nhượng. ${team.league?.name ? team.league.name + ' · ' : ''}cập nhật real-time.`
    : `Tin chuyển nhượng ${team.name}: ScoreLine cập nhật mọi tin tức mua bán cầu thủ, hợp đồng, đàm phán liên quan đến CLB.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({ image: team.logo }, { alt: `Chuyển nhượng ${team.name}` });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Chuyển nhượng', item: `${SITE_URL}/chuyen-nhuong` },
      { '@type': 'ListItem', position: 3, name: team.name, item: url },
    ],
  };

  const articlesHtml = articles.length === 0
    ? `<div class="empty">Hiện chưa có tin chuyển nhượng ${escapeHtml(team.name)}. Xem <a href="/chuyen-nhuong">tin chuyển nhượng tổng hợp</a>.</div>`
    : articles.map(a => {
        const imageUrl = a.image && /^https?:\/\//.test(a.image) ? a.image : (a.image || `${SITE_URL}/og-image.jpg`);
        return `<div class="article">
          <a href="/chuyen-nhuong/${escapeHtml(a.slug)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(a.title)}" loading="lazy"></a>
          <div>
            <div class="title"><a href="/chuyen-nhuong/${escapeHtml(a.slug)}">${escapeHtml(a.title)}</a></div>
            <div class="desc">${escapeHtml((a.description || '').slice(0, 200))}${(a.description || '').length > 200 ? '…' : ''}</div>
            <div class="meta">${formatDateVi(a.pubDate || a.createdAt)}</div>
          </div>
        </div>`;
      }).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="chuyển nhượng ${escapeHtml(team.name.toLowerCase())}, ${escapeHtml(team.name.toLowerCase())} mua cầu thủ, tin transfer ${escapeHtml(slug)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/chuyen-nhuong">Chuyển nhượng</a> &rsaquo; <span>${escapeHtml(team.name)}</span></nav>

    <div class="team-hero">
      ${team.logo ? `<img src="${escapeHtml(proxyImg(team.logo, 96))}" alt="${escapeHtml(team.name)} logo">` : ''}
      <div>
        <h1>💼 Chuyển Nhượng ${escapeHtml(team.name)}</h1>
        <div class="meta">${escapeHtml(team.country || '')}${team.league?.name ? ' · ' + escapeHtml(team.league.name) : ''} · ${articles.length} bài viết</div>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>📰 Tin chuyển nhượng ${escapeHtml(team.name)} mới nhất</h2>
          ${articlesHtml}
        </div>

        <div class="card">
          <h2>Về ${escapeHtml(team.name)} trên thị trường chuyển nhượng</h2>
          <p style="font-size:14px;color:#475569">Trang này tổng hợp toàn bộ tin chuyển nhượng liên quan đến ${escapeHtml(team.name)} — bao gồm cầu thủ mới đến, cầu thủ ra đi, đàm phán, giá hợp đồng và tin đồn. Bài viết được lọc theo tag CLB và biên tập kiểm chứng từ các nguồn chính thức.</p>
          <p style="font-size:14px;color:#475569;margin-top:8px">Để xem thông tin chung về CLB: <a href="/doi-bong/${escapeHtml(slug)}">Trang ${escapeHtml(team.name)}</a>. Cho tin chuyển nhượng tất cả CLB: <a href="/chuyen-nhuong">Chuyển nhượng tổng hợp</a>.</p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '💼' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Về ${escapeHtml(team.name)}</div>
          <a class="sidebar-link" href="/doi-bong/${escapeHtml(slug)}">Trang CLB ${escapeHtml(team.name)}</a>
          ${team.league?.slug ? `<a class="sidebar-link" href="/bang-xep-hang/${escapeHtml(team.league.slug)}">BXH ${escapeHtml(team.league.name)}</a>` : ''}
          ${team.league?.slug ? `<a class="sidebar-link" href="/lich-thi-dau/${escapeHtml(team.league.slug)}">Lịch ${escapeHtml(team.league.name)}</a>` : ''}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">💼 Chuyển nhượng khác</div>
          <a class="sidebar-link" href="/chuyen-nhuong">Tất cả tin chuyển nhượng</a>
          <a class="sidebar-link" href="/tin-bong-da">Tin tức bóng đá</a>
          <a class="sidebar-link" href="/phan-tich">Phân tích chuyên sâu</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=1800'); // 30 min — transfer news ships frequently
  res.send(html);
});

module.exports = router;
