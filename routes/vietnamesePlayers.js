/**
 * Vietnamese Players SEO Pages
 * Routes:
 *   GET /cau-thu — list of top VN players
 *   GET /cau-thu/:slug — player detail (SSR for bots)
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { players } = require('../data/vietnamesePlayers');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBirthday(dob) {
  const d = new Date(dob);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calculateAge(dob) {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#2563eb}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .card{background:#fff;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 14px}
    .card h3{font-size:17px;font-weight:700;margin:18px 0 8px}
    .card p{margin-bottom:12px;color:#334155;font-size:15px}
    .card ul{margin:12px 0;padding-left:22px}.card li{margin-bottom:8px;color:#334155;font-size:15px}
    .player-hero{text-align:center;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:36px 24px;border-radius:8px;margin-bottom:16px}
    .player-hero img{width:140px;height:140px;border-radius:50%;object-fit:cover;background:#fff;margin-bottom:12px;border:4px solid #fff}
    .player-hero h1{font-size:32px;font-weight:800;margin-bottom:6px}
    .player-hero .meta{font-size:14px;color:#cbd5e1;margin-bottom:12px}
    .player-hero .shirt{display:inline-block;background:#ef4444;color:#fff;font-weight:800;font-size:20px;padding:4px 14px;border-radius:4px}
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
    .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}
    .info-num{font-size:22px;font-weight:800;color:#0066FF;display:block}
    .info-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px}
    .stat-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
    .stat-table th,.stat-table td{padding:8px 10px;text-align:center;border-bottom:1px solid #e2e8f0}
    .stat-table th{background:#f8fafc;color:#475569;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.5px}
    .stat-table td:first-child,.stat-table th:first-child{text-align:left}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
    .player-link{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;text-decoration:none}
    .player-link:last-child{border-bottom:none}
    .player-link img{width:42px;height:42px;border-radius:50%;background:#f1f5f9;object-fit:cover}
    .player-link .name{font-size:14px;font-weight:600;color:#1e293b}
    .player-link .pos{font-size:11px;color:#94a3b8}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .player-hero h1{font-size:26px}.info-grid{grid-template-columns:repeat(2,1fr)}
    }
  `;
}

// ===== Player detail page =====
router.get('/cau-thu/:slug', (req, res) => {
  const player = players.find(p => p.slug === req.params.slug);
  if (!player) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy cầu thủ | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>Không tìm thấy cầu thủ</h1><p><a href="/cau-thu">Danh sách cầu thủ</a></p></body></html>`);
  }

  const url = `${SITE_URL}/cau-thu/${player.slug}`;
  const age = calculateAge(player.dob);
  const title = `${player.name} - ${player.position} ${player.nationalTeam} | Tiểu sử, Số áo, Thành tích`;
  const description = `${player.name} (${age} tuổi, ${player.position} ${player.currentClub}): tiểu sử, sự nghiệp, thành tích cùng ĐT Việt Nam. ${player.caps} lần khoác áo ĐTQG, ${player.goals} bàn thắng.`;

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    birthDate: player.dob,
    birthPlace: { '@type': 'Place', name: player.birthplace },
    height: { '@type': 'QuantitativeValue', value: player.height, unitText: 'CM' },
    weight: { '@type': 'QuantitativeValue', value: player.weight, unitText: 'KG' },
    jobTitle: `${player.position} bóng đá`,
    image: player.image,
    url,
    memberOf: [
      { '@type': 'SportsTeam', name: player.currentClub },
      { '@type': 'SportsTeam', name: `Đội tuyển bóng đá ${player.nationalTeam}` }
    ]
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Cầu thủ', item: `${SITE_URL}/cau-thu` },
      { '@type': 'ListItem', position: 3, name: player.name, item: url }
    ]
  };

  const highlightsHtml = player.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('');
  const statsRows = Object.entries(player.keyStats).map(([season, stats]) => {
    const cols = Object.entries(stats).map(([k, v]) => `<td>${v}</td>`).join('');
    const headers = Object.keys(stats);
    return { season, headers, cols };
  });
  const statsHeaders = statsRows[0]?.headers || [];
  const statsTable = `
    <table class="stat-table">
      <thead><tr><th>Giải đấu</th>${statsHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${statsRows.map(r => `<tr><td><strong>${escapeHtml(r.season)}</strong></td>${r.cols}</tr>`).join('')}
      </tbody>
    </table>
  `;

  const otherPlayers = players.filter(p => p.slug !== player.slug).slice(0, 5);
  const sidebarPlayers = otherPlayers.map(p => `
    <a href="/cau-thu/${p.slug}" class="player-link">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div><div class="name">${escapeHtml(p.name)}</div><div class="pos">${escapeHtml(p.position)}</div></div>
    </a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(player.tags.join(', '))}, cầu thủ việt nam, bóng đá việt nam">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:type" content="profile">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="${escapeHtml(player.name)}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <meta name="twitter:image:alt" content="${escapeHtml(player.name)}">

  <script type="application/ld+json">${JSON.stringify(personSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/cau-thu">Cầu thủ</a> &rsaquo; <span>${escapeHtml(player.name)}</span></nav>

    <div class="player-hero">
      <img src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}" width="140" height="140">
      <h1>${escapeHtml(player.name)}</h1>
      <div class="meta">${escapeHtml(player.position)} · ${escapeHtml(player.currentClub)} · ${escapeHtml(player.nationalTeam)}</div>
      <span class="shirt">#${player.shirtNumber}</span>
    </div>

    <div class="layout">
      <main class="main">
        <div class="card">
          <h2>📋 Thông tin cá nhân</h2>
          <div class="info-grid">
            <div class="info-box"><span class="info-num">${age}</span><span class="info-label">Tuổi</span></div>
            <div class="info-box"><span class="info-num">${player.height}cm</span><span class="info-label">Chiều cao</span></div>
            <div class="info-box"><span class="info-num">${player.weight}kg</span><span class="info-label">Cân nặng</span></div>
            <div class="info-box"><span class="info-num">${player.caps}</span><span class="info-label">Trận ĐTQG</span></div>
            <div class="info-box"><span class="info-num">${player.goals}</span><span class="info-label">Bàn thắng</span></div>
            <div class="info-box"><span class="info-num">${escapeHtml(player.foot)}</span><span class="info-label">Chân thuận</span></div>
          </div>
          <p><strong>Ngày sinh:</strong> ${formatBirthday(player.dob)}</p>
          <p><strong>Nơi sinh:</strong> ${escapeHtml(player.birthplace)}</p>
          <p><strong>CLB hiện tại:</strong> <a href="/doi-bong/${player.currentClubSlug}">${escapeHtml(player.currentClub)}</a></p>
        </div>

        <div class="card">
          <h2>📖 Tiểu sử ${escapeHtml(player.name)}</h2>
          <p>${escapeHtml(player.bio)}</p>
        </div>

        <div class="card">
          <h2>🏆 Sự nghiệp nổi bật</h2>
          <ul>${highlightsHtml}</ul>
        </div>

        <div class="card">
          <h2>🛤️ Hành trình sự nghiệp</h2>
          ${player.careerSummary.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>

        <div class="card">
          <h2>📊 Thống kê mùa gần nhất</h2>
          ${statsTable}
        </div>

        <div class="card">
          <h2>🔗 Liên kết liên quan</h2>
          <p>
            Xem thêm:
            <a href="/doi-bong/${player.currentClubSlug}">CLB ${escapeHtml(player.currentClub)}</a> ·
            <a href="/cau-thu">Danh sách cầu thủ Việt Nam</a> ·
            <a href="/world-cup-2026/doi-tuyen-viet-nam">Đội tuyển Việt Nam World Cup 2026</a>
          </p>
        </div>
      </main>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">⭐ Cầu thủ khác</div>
          ${sidebarPlayers}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a href="/" class="sidebar-link">Trang chủ</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định bóng đá</a>
          <a href="/lich-thi-dau" class="sidebar-link">Lịch thi đấu</a>
          <a href="/world-cup-2026" class="sidebar-link">🏆 World Cup 2026</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

// ===== Player list page =====
router.get('/cau-thu', (req, res) => {
  const url = `${SITE_URL}/cau-thu`;
  const title = 'Cầu Thủ Việt Nam - Tiểu Sử, Thống Kê, Sự Nghiệp';
  const description = 'Danh sách cầu thủ Việt Nam nổi bật: Quang Hải, Công Phượng, Văn Lâm, Tiến Linh, Duy Mạnh, Hoàng Đức và nhiều ngôi sao khác của bóng đá Việt Nam.';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Cầu thủ', item: url }
    ]
  };

  const playersHtml = players.map(p => `
    <a href="/cau-thu/${p.slug}" class="card" style="display:flex;gap:16px;align-items:center;text-decoration:none;margin-bottom:12px">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;background:#f1f5f9">
      <div style="flex:1">
        <h3 style="color:#0f172a;font-size:18px;margin-bottom:4px">${escapeHtml(p.name)}</h3>
        <div style="font-size:14px;color:#64748b;margin-bottom:6px">${escapeHtml(p.position)} · ${escapeHtml(p.currentClub)} · Số áo #${p.shirtNumber}</div>
        <div style="font-size:13px;color:#475569">${p.caps} trận ĐTQG, ${p.goals} bàn thắng</div>
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
  <meta name="keywords" content="cầu thủ việt nam, cầu thủ bóng đá việt nam, quang hải, công phượng, văn lâm, tiến linh, hoàng đức, duy mạnh">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="Cầu thủ Việt Nam">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Cầu thủ</span></nav>
    <div class="card">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:8px">Cầu Thủ Việt Nam</h1>
      <p style="color:#475569">Tiểu sử, sự nghiệp và thống kê của những ngôi sao bóng đá Việt Nam. Từ thế hệ vàng HAGL đến thế hệ Thường Châu 2018 và đội hình ĐTQG hiện tại.</p>
    </div>
    ${playersHtml}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
module.exports.players = players;
