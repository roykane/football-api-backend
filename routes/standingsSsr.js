/**
 * Standings SSR — bot-only HTML for /bang-xep-hang/:slug
 *
 * Pulls Team rows from MongoDB (already kept fresh by team-sync.js) and
 * renders a full server-rendered standings table. Avoids hitting API-Sports
 * on every bot request — the table is keyed off the same data the FE shows.
 *
 * Browsers never reach this router; nginx forks bot UA → backend, browser →
 * SPA shell.
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
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px;line-height:1.2}
    .hero .meta{font-size:13px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #eff6ff}
    .card p{margin-bottom:10px;color:#334155;font-size:15px;line-height:1.7}
    .card strong{color:#0f172a}
    table.standings{width:100%;border-collapse:collapse;font-size:13px}
    table.standings th,table.standings td{padding:8px 6px;text-align:center;border-bottom:1px solid #f1f5f9}
    table.standings th{background:#f8fafc;color:#475569;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
    table.standings td.team{text-align:left;font-weight:600;color:#0f172a}
    table.standings td.team a{color:#0f172a}
    table.standings td.team img{width:20px;height:20px;vertical-align:middle;margin-right:6px;object-fit:contain}
    .form-cell{display:inline-flex;gap:2px}
    .form-pip{width:16px;height:16px;border-radius:3px;font-size:9px;line-height:16px;color:#fff;font-weight:700;text-align:center}
    .form-W{background:#16a34a}.form-D{background:#f59e0b}.form-L{background:#ef4444}
    .rank{font-weight:800;color:#0f172a}
    .pts{font-weight:800;color:#0f172a}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .hero h1{font-size:20px}
      table.standings{font-size:11px}
      table.standings th,table.standings td{padding:6px 3px}
    }
  `;
}

function formCell(form) {
  if (!form) return '-';
  return `<span class="form-cell">${form.split('').slice(-5).map(f => `<span class="form-pip form-${f}">${f === 'W' ? 'T' : f === 'D' ? 'H' : 'B'}</span>`).join('')}</span>`;
}

function renderTable(teams) {
  const rows = teams.map(t => {
    const s = t.standings || {};
    return `<tr>
      <td class="rank">${s.rank ?? '-'}</td>
      <td class="team"><a href="/doi-bong/${escapeHtml(t.slug)}">${t.logo ? `<img src="${escapeHtml(t.logo)}" alt="${escapeHtml(t.name)}" loading="lazy">` : ''}${escapeHtml(t.name)}</a></td>
      <td>${s.played ?? '-'}</td>
      <td>${s.win ?? '-'}</td>
      <td>${s.draw ?? '-'}</td>
      <td>${s.lose ?? '-'}</td>
      <td>${s.goalsFor ?? '-'}</td>
      <td>${s.goalsAgainst ?? '-'}</td>
      <td>${typeof s.goalsDiff === 'number' ? (s.goalsDiff > 0 ? `+${s.goalsDiff}` : s.goalsDiff) : '-'}</td>
      <td class="pts">${s.points ?? '-'}</td>
      <td>${formCell(s.form)}</td>
    </tr>`;
  }).join('');

  return `<table class="standings">
    <thead>
      <tr>
        <th>#</th><th style="text-align:left">Đội</th>
        <th>Trận</th><th>T</th><th>H</th><th>B</th>
        <th>BT</th><th>BB</th><th>HS</th><th>Điểm</th>
        <th>Phong độ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function notFound(res, slug) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy giải đấu | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p>Không tìm thấy giải đấu "${escapeHtml(slug)}".</p><p><a href="/bang-xep-hang">Xem các bảng xếp hạng</a></p></body></html>`);
}

router.get('/bang-xep-hang/:slug', async (req, res) => {
  const slug = req.params.slug;
  const league = getLeagueBySlug(slug);
  if (!league) return notFound(res, slug);

  let teams;
  try {
    teams = await Team.find({ 'league.slug': slug })
      .sort({ 'standings.rank': 1 })
      .select('slug name logo standings')
      .lean();
  } catch (err) {
    teams = [];
  }

  if (!teams.length) {
    return notFound(res, slug);
  }

  const url = `${SITE_URL}/bang-xep-hang/${slug}`;
  const seasonYear = teams[0]?.seasonYear;
  const seasonStr = seasonYear ? ` ${seasonYear}/${seasonYear + 1}` : '';
  const title = `Bảng Xếp Hạng ${league.name}${seasonStr}`;
  const description = `BXH ${league.viName}${seasonStr}: vị trí, điểm, hiệu số, phong độ 5 trận gần nhất của ${teams.length} đội. Cập nhật sau từng vòng đấu.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: `BXH ${league.name}` });

  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url,
    numberOfItems: teams.length,
    itemListElement: teams.map((t, i) => ({
      '@type': 'ListItem',
      position: t.standings?.rank || i + 1,
      url: `${SITE_URL}/doi-bong/${t.slug}`,
      name: t.name,
    })),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Bảng xếp hạng', item: `${SITE_URL}/bang-xep-hang` },
      { '@type': 'ListItem', position: 3, name: league.name, item: url },
    ],
  };

  const otherLeagues = LEAGUES.filter(l => l.slug !== slug).slice(0, 8);
  const otherLeaguesHtml = otherLeagues.map(l => `<a class="sidebar-link" href="/bang-xep-hang/${l.slug}">${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="bảng xếp hạng ${escapeHtml(league.viName.toLowerCase())}, bxh ${escapeHtml(slug)}, bxh ${escapeHtml(league.name.toLowerCase())}, ${escapeHtml(slug)} standings">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo; <a href="/bang-xep-hang">Bảng xếp hạng</a> &rsaquo; <span>${escapeHtml(league.viName)}</span>
    </nav>

    <div class="hero">
      <h1>📊 Bảng Xếp Hạng ${escapeHtml(league.name)}${escapeHtml(seasonStr)}</h1>
      <div class="meta">${escapeHtml(league.country)} · ${teams.length} đội · Cập nhật sau từng vòng đấu</div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>Bảng xếp hạng chi tiết</h2>
          ${renderTable(teams)}
          <p style="margin-top:14px;font-size:13px;color:#64748b">
            T = Thắng · H = Hòa · B = Bại · BT = Bàn thắng · BB = Bàn bại · HS = Hiệu số · Phong độ = 5 trận gần nhất
          </p>
        </div>

        <div class="card">
          <h2>Về giải đấu ${escapeHtml(league.name)}</h2>
          <p>${escapeHtml(league.name)} là giải đấu cao nhất của ${escapeHtml(league.country)}, hiện có ${teams.length} đội tham dự. ScoreLine cập nhật bảng xếp hạng tự động sau mỗi vòng đấu, kèm theo hiệu số bàn thắng/thua, điểm số và phong độ 5 trận gần nhất của từng đội.</p>
          <p>Click vào tên đội để xem trang riêng với lịch thi đấu, kết quả gần đây và phân tích phong độ. Để theo dõi lịch và kết quả theo vòng, xem <a href="/lich-thi-dau/${slug}">Lịch ${escapeHtml(league.viName)}</a> và <a href="/ket-qua-bong-da/${slug}">Kết quả ${escapeHtml(league.viName)}</a>.</p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '📊' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">📊 BXH giải khác</div>
          ${otherLeaguesHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/lich-thi-dau/${slug}">Lịch thi đấu ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/ket-qua-bong-da/${slug}">Kết quả ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/top-ghi-ban/${slug}">Top ghi bàn ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/giai-dau">Tất cả giải đấu</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=1800'); // 30 min — standings shift after each matchday
  res.send(html);
});

router.get('/bang-xep-hang', async (req, res) => {
  const url = `${SITE_URL}/bang-xep-hang`;
  const title = 'Bảng Xếp Hạng Bóng Đá - Top 5 Châu Âu, V.League';
  const description = 'Bảng xếp hạng các giải đấu hàng đầu: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, V.League. Cập nhật điểm số, hiệu số và phong độ sau từng vòng.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: 'Bảng xếp hạng bóng đá' });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Bảng xếp hạng', item: url },
    ],
  };

  const cardsHtml = LEAGUES.map(l => `
    <a href="/bang-xep-hang/${l.slug}" class="card" style="display:block;text-decoration:none;padding:16px;margin-bottom:0;border-left:4px solid #1e3a8a">
      <h2 style="font-size:16px;margin-bottom:4px;border:0;padding:0">${escapeHtml(l.name)}</h2>
      <div style="font-size:12px;color:#64748b">${escapeHtml(l.country)} · Bảng xếp hạng mùa hiện tại</div>
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
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Bảng xếp hạng</span></nav>
    <div class="hero">
      <h1>📊 Bảng Xếp Hạng Bóng Đá</h1>
      <div class="meta">Theo dõi vị trí, điểm số và phong độ các đội bóng tại các giải đấu hàng đầu thế giới và Việt Nam.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
      ${cardsHtml}
    </div>
    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '📊' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

module.exports = router;
