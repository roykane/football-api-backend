/**
 * Leagues SSR — bot-only HTML for /giai-dau and /giai-dau/:slug
 *
 * Hub-style page: each league gets a single landing URL that aggregates
 * standings preview + cross-links to /lich-thi-dau, /ket-qua-bong-da,
 * /top-ghi-ban, /bang-xep-hang. Acts as the canonical "league entry point"
 * Google can rank for queries like "ngoại hạng anh", "champions league".
 */

const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const siteHeader = require('../utils/siteHeader');
const { getLeagueBySlug, LEAGUES } = require('../utils/leagueSlugs');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0f172a;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .hero{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px}
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px}
    .hero .meta{font-size:13px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #eff6ff}
    .card p{margin-bottom:10px;color:#334155;font-size:15px}
    .card strong{color:#0f172a}
    .quick-links{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0}
    .quick-link{display:block;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;color:#0f172a;font-weight:600;font-size:14px}
    .quick-link:hover{background:#eff6ff;border-color:#1e3a8a;text-decoration:none}
    table.mini-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
    table.mini-table th,table.mini-table td{padding:6px;text-align:center;border-bottom:1px solid #f1f5f9}
    table.mini-table th{background:#f8fafc;color:#475569;font-weight:700;font-size:11px;text-transform:uppercase}
    table.mini-table td.team{text-align:left;font-weight:600;color:#0f172a}
    table.mini-table td.team img{width:18px;height:18px;vertical-align:middle;margin-right:4px;object-fit:contain}
    .league-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
    .league-card{display:block;background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #1e3a8a;text-decoration:none}
    .league-card:hover{box-shadow:0 4px 12px rgba(30,58,138,0.15);text-decoration:none}
    .league-card h3{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px}
    .league-card .desc{font-size:12px;color:#64748b}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .quick-links{grid-template-columns:1fr}
      .hero h1{font-size:20px}
    }
  `;
}

router.get('/giai-dau/:slug', async (req, res) => {
  const slug = req.params.slug;
  const league = getLeagueBySlug(slug);
  if (!league) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy giải đấu | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/giai-dau">Tất cả giải đấu</a></p></body></html>`);
  }

  let topTeams = [];
  try {
    topTeams = await Team.find({ 'league.slug': slug })
      .sort({ 'standings.rank': 1 })
      .limit(8)
      .select('slug name logo standings')
      .lean();
  } catch (err) { topTeams = []; }

  const url = `${SITE_URL}/giai-dau/${slug}`;
  const seasonYear = topTeams[0]?.seasonYear;
  const seasonStr = seasonYear ? ` ${seasonYear}/${seasonYear + 1}` : '';
  const title = `${league.name}${seasonStr} - Lịch, BXH, Top Ghi Bàn, Tin Tức`;
  const description = `Cổng thông tin ${league.viName}: bảng xếp hạng, lịch thi đấu, kết quả, vua phá lưới và tin tức mới nhất. ${topTeams.length || ''} đội tham dự${seasonStr}.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: league.name });

  const sportsOrgSchema = {
    '@context': 'https://schema.org', '@type': 'SportsOrganization',
    name: league.name, url, sport: 'Soccer',
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Giải đấu', item: `${SITE_URL}/giai-dau` },
      { '@type': 'ListItem', position: 3, name: league.name, item: url },
    ],
  };

  const miniTable = topTeams.length ? `<table class="mini-table">
    <thead><tr><th>#</th><th style="text-align:left">Đội</th><th>Tr</th><th>Đ</th><th>HS</th></tr></thead>
    <tbody>
      ${topTeams.map(t => {
        const s = t.standings || {};
        return `<tr>
          <td>${s.rank ?? '-'}</td>
          <td class="team"><a href="/doi-bong/${escapeHtml(t.slug)}">${t.logo ? `<img src="${escapeHtml(t.logo)}" alt="${escapeHtml(t.name)}" loading="lazy">` : ''}${escapeHtml(t.name)}</a></td>
          <td>${s.played ?? '-'}</td>
          <td><strong>${s.points ?? '-'}</strong></td>
          <td>${typeof s.goalsDiff === 'number' ? (s.goalsDiff > 0 ? `+${s.goalsDiff}` : s.goalsDiff) : '-'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : '<p style="color:#94a3b8;font-size:13px">Bảng xếp hạng đang được cập nhật.</p>';

  const otherLeagues = LEAGUES.filter(l => l.slug !== slug).slice(0, 8);
  const otherLeaguesHtml = otherLeagues.map(l => `<a class="sidebar-link" href="/giai-dau/${l.slug}">${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(league.viName.toLowerCase())}, ${escapeHtml(league.name.toLowerCase())}, ${escapeHtml(slug)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(sportsOrgSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/giai-dau">Giải đấu</a> &rsaquo; <span>${escapeHtml(league.viName)}</span></nav>

    <div class="hero">
      <h1>🏆 ${escapeHtml(league.name)}${escapeHtml(seasonStr)}</h1>
      <div class="meta">${escapeHtml(league.country)} · Cổng thông tin tổng hợp</div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>Truy cập nhanh</h2>
          <div class="quick-links">
            <a class="quick-link" href="/bang-xep-hang/${slug}">📊 Bảng xếp hạng</a>
            <a class="quick-link" href="/lich-thi-dau/${slug}">📅 Lịch thi đấu</a>
            <a class="quick-link" href="/ket-qua-bong-da/${slug}">✅ Kết quả</a>
            <a class="quick-link" href="/top-ghi-ban/${slug}">👟 Top ghi bàn</a>
          </div>
        </div>

        <div class="card">
          <h2>Top đội ${escapeHtml(league.viName)}</h2>
          ${miniTable}
          <p style="margin-top:10px"><a href="/bang-xep-hang/${slug}">Xem bảng xếp hạng đầy đủ →</a></p>
        </div>

        <div class="card">
          <h2>Về ${escapeHtml(league.name)}</h2>
          <p>${escapeHtml(league.name)} là giải đấu cao nhất của ${escapeHtml(league.country)}, được ScoreLine theo dõi chặt chẽ qua dữ liệu chính thức. Trang này là cổng tổng hợp dẫn đến tất cả thông tin về giải: bảng xếp hạng cập nhật theo từng vòng, lịch thi đấu 14 ngày tới, kết quả 30 ngày qua, và bảng vua phá lưới.</p>
          <p>Nhấn vào <strong>Bảng xếp hạng</strong> để xem chi tiết hiệu số, điểm và phong độ của từng đội. Nhấn <strong>Lịch thi đấu</strong> để xem giờ kick-off các trận sắp tới. Mỗi trận đấu có trang riêng với phân tích đối đầu, lineup, tỷ lệ kèo và dự đoán.</p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏆' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🏆 Giải đấu khác</div>
          ${otherLeaguesHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/bang-xep-hang">Tất cả BXH</a>
          <a class="sidebar-link" href="/lich-thi-dau">Tất cả lịch</a>
          <a class="sidebar-link" href="/ket-qua-bong-da">Tất cả kết quả</a>
          <a class="sidebar-link" href="/top-ghi-ban">Top ghi bàn các giải</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

router.get('/giai-dau', async (req, res) => {
  const url = `${SITE_URL}/giai-dau`;
  const title = 'Giải Đấu Bóng Đá - Top 5 Châu Âu, V.League, Cúp Quốc Tế';
  const description = 'Tổng hợp các giải đấu bóng đá hàng đầu: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, World Cup, V.League. Lịch, BXH, kết quả, vua phá lưới.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: 'Giải đấu bóng đá' });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Giải đấu', item: url },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: 'Giải đấu bóng đá', url, numberOfItems: LEAGUES.length,
    itemListElement: LEAGUES.map((l, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_URL}/giai-dau/${l.slug}`, name: l.name,
    })),
  };

  const cardsHtml = LEAGUES.map(l => `
    <a class="league-card" href="/giai-dau/${l.slug}">
      <h3>🏆 ${escapeHtml(l.name)}</h3>
      <div class="desc">${escapeHtml(l.country)} · BXH · Lịch · Kết quả · Top ghi bàn</div>
    </a>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
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
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Giải đấu</span></nav>
    <div class="hero">
      <h1>🏆 Giải Đấu Bóng Đá</h1>
      <div class="meta">Cổng tổng hợp ${LEAGUES.length} giải đấu hàng đầu thế giới và Việt Nam — chọn giải để xem chi tiết.</div>
    </div>
    <div class="league-grid">${cardsHtml}</div>
    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏆' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
