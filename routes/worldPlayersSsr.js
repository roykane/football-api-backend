/**
 * World Players SEO Pages
 *   GET /cau-thu-the-gioi           → list of world stars
 *   GET /cau-thu-the-gioi/:slug     → player detail (SSR for bots)
 *
 * Mirrors the structure of vietnamesePlayers.js but for the curated
 * 30-player list of active world stars (Messi, Ronaldo, Mbappe, Haaland,
 * Bellingham, Vinicius, Salah, Lewandowski, etc.). Images are self-hosted
 * at /world-player-images/<slug>.<ext> via the download script.
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { players } = require('../data/worldPlayers');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

const SITE = SITE_URL;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function calculateAge(dob) {
  const b = new Date(dob); const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age;
}

function formatDob(dob) {
  return new Date(dob).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0066FF;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}.main{min-width:0}
    .player-hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px;display:flex;gap:20px;align-items:center;border:1px solid rgba(251,191,36,0.3)}
    .player-hero img{width:96px;height:96px;border-radius:50%;object-fit:cover;background:#f1f5f9;flex-shrink:0;border:3px solid #fbbf24}
    .player-hero .info{flex:1;min-width:0}
    .player-hero h1{font-size:24px;font-weight:800;margin-bottom:4px;line-height:1.2;color:#fbbf24}
    .player-hero .meta{font-size:13px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 14px}
    .card p{margin-bottom:12px;color:#334155;font-size:15px}
    .card ul{margin:12px 0;padding-left:22px}.card li{margin-bottom:8px;color:#334155;font-size:15px}
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
    .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;text-align:center}
    .info-num{font-size:22px;font-weight:800;color:#0f172a;display:block}
    .info-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
    .stat-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
    .stat-table th,.stat-table td{padding:8px 10px;text-align:center;border-bottom:1px solid #e2e8f0}
    .stat-table th{background:#fef3c7;color:#92400e;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
    .stat-table td:first-child,.stat-table th:first-child{text-align:left}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .player-link{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;text-decoration:none}
    .player-link:last-child{border-bottom:none}
    .player-link img{width:42px;height:42px;border-radius:50%;background:#f1f5f9;object-fit:cover}
    .player-link .name{font-size:14px;font-weight:600;color:#1e293b}
    .player-link .pos{font-size:11px;color:#94a3b8}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){
      .player-hero{flex-direction:column;text-align:center}
      .player-hero img{width:84px;height:84px}
      .player-hero h1{font-size:20px}
      .info-grid{grid-template-columns:repeat(2,1fr)}
    }
  `;
}

router.get('/cau-thu-the-gioi/:slug', (req, res) => {
  const player = players.find(p => p.slug === req.params.slug);
  if (!player) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy cầu thủ | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/cau-thu-the-gioi">Danh sách cầu thủ thế giới</a></p></body></html>`);
  }

  const url = `${SITE}/cau-thu-the-gioi/${player.slug}`;
  const age = calculateAge(player.dob);
  const title = `${player.name} - ${player.position} ${player.nationalTeam} | Tiểu Sử, Sự Nghiệp & Thống Kê`;
  const description = `${player.name} (${age} tuổi, ${player.position} ${player.currentClub}): tiểu sử, sự nghiệp đỉnh cao, ${player.caps} trận ĐTQG, ${player.goals} bàn thắng. ${player.bio.slice(0, 100)}...`;

  const { datePublished, dateModified } = getEntityDates(player);
  const og = pickOgImage(player, { alt: `${player.name} — ${player.position}` });

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    alternateName: player.fullName,
    birthDate: player.dob,
    birthPlace: { '@type': 'Place', name: player.birthplace },
    height: { '@type': 'QuantitativeValue', value: player.height, unitText: 'CM' },
    weight: { '@type': 'QuantitativeValue', value: player.weight, unitText: 'KG' },
    jobTitle: `${player.position} bóng đá`,
    image: player.image && /^https?:\/\//.test(player.image) ? player.image : `${SITE}${player.image}`,
    url,
    inLanguage: 'vi-VN',
    memberOf: [
      { '@type': 'SportsTeam', name: player.currentClub },
      { '@type': 'SportsTeam', name: `Đội tuyển bóng đá ${player.nationalTeam}` },
    ],
    award: player.highlights?.slice(0, 5),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Cầu thủ thế giới', item: `${SITE}/cau-thu-the-gioi` },
      { '@type': 'ListItem', position: 3, name: player.name, item: url },
    ],
  };

  const dobVi = formatDob(player.dob);
  const positionLower = (player.position || '').toLowerCase();
  const footLower = (player.foot || '').toLowerCase();

  const faqs = [
    {
      question: `${player.name} sinh năm bao nhiêu?`,
      answer: `${player.name} sinh ngày ${dobVi} tại ${player.birthplace}, hiện ${age} tuổi.`,
    },
    {
      question: `${player.name} cao bao nhiêu?`,
      answer: `${player.name} cao ${player.height}cm và nặng ${player.weight}kg.`,
    },
    {
      question: `${player.name} chơi cho đội nào?`,
      answer: `${player.name} hiện thi đấu cho ${player.currentClub} ở vị trí ${positionLower}, mang áo số ${player.shirtNumber}. Tại đội tuyển quốc gia, anh khoác áo ${player.nationalTeam}.`,
    },
    {
      question: `${player.name} đã ghi bao nhiêu bàn cho ĐTQG?`,
      answer: `${player.name} đã ghi ${player.goals} bàn sau ${player.caps} trận khoác áo đội tuyển ${player.nationalTeam}.`,
    },
    {
      question: `${player.name} chơi ở vị trí nào?`,
      answer: `${player.name} là ${positionLower}, chân thuận ${footLower}.`,
    },
  ];

  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const quickAnswer = `${player.name} (sinh ${dobVi}, ${age} tuổi) là ${positionLower} người ${player.nationalTeam}, hiện thi đấu cho ${player.currentClub} với áo số ${player.shirtNumber}. Cao ${player.height}cm, nặng ${player.weight}kg, chân thuận ${footLower}. Đã ra sân ${player.caps} trận và ghi ${player.goals} bàn cho ĐTQG.`;

  const others = players.filter(p => p.slug !== player.slug).slice(0, 5);
  const sidebarPlayers = others.map(p => `
    <a href="/cau-thu-the-gioi/${p.slug}" class="player-link">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div><div class="name">${escapeHtml(p.name)}</div><div class="pos">${escapeHtml(p.position)} · ${escapeHtml(p.nationalTeam)}</div></div>
    </a>`).join('');

  const highlightsHtml = player.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('');
  const careerSummaryHtml = player.careerSummary.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('');

  const statsRows = Object.entries(player.keyStats).map(([season, stats]) => {
    const headers = Object.keys(stats);
    const cols = headers.map(k => `<td>${stats[k]}</td>`).join('');
    return { season, headers, cols };
  });
  const statsHeaders = statsRows[0]?.headers || [];
  const statsTable = statsHeaders.length ? `
    <table class="stat-table">
      <thead><tr><th>Giải đấu</th>${statsHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${statsRows.map(r => `<tr><td><strong>${escapeHtml(r.season)}</strong></td>${r.cols}</tr>`).join('')}</tbody>
    </table>` : '';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(player.tags.join(', '))}, cầu thủ bóng đá thế giới">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(personSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/cau-thu-the-gioi">Cầu thủ thế giới</a> &rsaquo; <span>${escapeHtml(player.name)}</span></nav>

    <div class="player-hero">
      <img src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}" width="96" height="96" loading="eager">
      <div class="info">
        <h1>${escapeHtml(player.name)}</h1>
        <div class="meta">${escapeHtml(player.position)} · ${escapeHtml(player.currentClub)} · ĐT ${escapeHtml(player.nationalTeam)} · #${player.shirtNumber}</div>
      </div>
    </div>

    <div style="background:#fffbeb;border-left:4px solid #fbbf24;border-radius:6px;padding:14px 16px;margin-bottom:16px;color:#1e293b;font-size:15px;line-height:1.7;">${escapeHtml(quickAnswer)}</div>

    <div class="layout">
      <main class="main">
        <div class="card">
          <h2>📋 Thông tin cá nhân</h2>
          <div class="info-grid">
            <div class="info-box"><span class="info-num">${age}</span><span class="info-label">Tuổi</span></div>
            <div class="info-box"><span class="info-num">${player.height}cm</span><span class="info-label">Chiều cao</span></div>
            <div class="info-box"><span class="info-num">${player.weight}kg</span><span class="info-label">Cân nặng</span></div>
            <div class="info-box"><span class="info-num">${player.caps}</span><span class="info-label">Trận ĐTQG</span></div>
            <div class="info-box"><span class="info-num">${player.goals}</span><span class="info-label">Bàn ĐTQG</span></div>
            <div class="info-box"><span class="info-num">${escapeHtml(player.foot)}</span><span class="info-label">Chân thuận</span></div>
          </div>
          <p><strong>Tên đầy đủ:</strong> ${escapeHtml(player.fullName)}</p>
          <p><strong>Ngày sinh:</strong> ${formatDob(player.dob)}</p>
          <p><strong>Nơi sinh:</strong> ${escapeHtml(player.birthplace)}</p>
          <p><strong>CLB hiện tại:</strong> ${escapeHtml(player.currentClub)}</p>
          <p><strong>Số áo:</strong> #${player.shirtNumber}</p>
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
          ${careerSummaryHtml}
        </div>

        ${statsTable ? `<div class="card">
          <h2>📊 Thống kê mùa giải hiện tại</h2>
          ${statsTable}
        </div>` : ''}

        <div class="card">
          <h2>❓ Câu hỏi thường gặp về ${escapeHtml(player.name)}</h2>
          ${faqs.map(f => `<div style="margin-bottom:14px"><h3 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px">${escapeHtml(f.question)}</h3><p style="color:#334155;font-size:14px;line-height:1.7;margin:0">${escapeHtml(f.answer)}</p></div>`).join('')}
        </div>

        <div class="card">
          <h2>🔗 Liên kết liên quan</h2>
          <p>Xem thêm: <a href="/cau-thu-the-gioi">Danh sách cầu thủ thế giới</a> · <a href="/cau-thu">Cầu thủ Việt Nam</a> · <a href="/huan-luyen-vien">Huấn luyện viên</a> · <a href="/world-cup-2026">World Cup 2026</a></p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '⚽', bio: `Hồ sơ ${escapeHtml(player.name)} tổng hợp từ FIFA, UEFA, các CLB và truyền thông quốc tế (Marca, AS, Mundo Deportivo, BBC, Sky Sports). Thống kê mùa giải được đối chiếu với Opta và API-Sports.` })}
      </main>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">⭐ Cầu thủ khác</div>
          ${sidebarPlayers}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/cau-thu-the-gioi">Danh sách cầu thủ thế giới</a>
          <a class="sidebar-link" href="/cau-thu">Cầu thủ Việt Nam</a>
          <a class="sidebar-link" href="/huan-luyen-vien">Huấn luyện viên</a>
          <a class="sidebar-link" href="/giai-dau">Giải đấu</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

router.get('/cau-thu-the-gioi', (req, res) => {
  const url = `${SITE}/cau-thu-the-gioi`;
  const title = 'Cầu Thủ Bóng Đá Thế Giới - Messi, Ronaldo, Mbappé, Haaland';
  const description = `Danh sách ${players.length} cầu thủ bóng đá hàng đầu thế giới: Messi, Ronaldo, Mbappé, Haaland, Bellingham, Vinicius, Salah, Lewandowski, De Bruyne, Modric. Tiểu sử, thành tích, thống kê.`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Cầu thủ thế giới', item: url },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: players.length,
    itemListElement: players.map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE}/cau-thu-the-gioi/${p.slug}`, name: p.name,
    })),
  };

  const playersHtml = players.map(p => `
    <a href="/cau-thu-the-gioi/${p.slug}" class="card" style="display:flex;gap:16px;align-items:center;text-decoration:none;margin-bottom:12px">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;background:#f1f5f9;border:2px solid #fbbf24" loading="lazy">
      <div style="flex:1">
        <h3 style="color:#0f172a;font-size:18px;margin-bottom:4px">${escapeHtml(p.name)}</h3>
        <div style="font-size:14px;color:#64748b;margin-bottom:6px">${escapeHtml(p.position)} · ${escapeHtml(p.currentClub)} · ĐT ${escapeHtml(p.nationalTeam)}</div>
        <div style="font-size:13px;color:#475569">#${p.shirtNumber} · ${p.caps} trận ĐTQG · ${p.goals} bàn</div>
      </div>
    </a>
  `).join('');

  const og = pickOgImage({}, { alt: title });

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="cầu thủ thế giới, messi, ronaldo, mbappe, haaland, bellingham, vinicius, salah, lewandowski, de bruyne, modric">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Cầu thủ thế giới</span></nav>
    <div class="card">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:8px">⭐ Cầu Thủ Bóng Đá Thế Giới</h1>
      <p style="color:#475569">Tiểu sử, sự nghiệp và thống kê các siêu sao bóng đá đỉnh cao. Từ Lionel Messi và Cristiano Ronaldo đến thế hệ vàng mới Mbappé, Haaland, Bellingham, Vinicius Júnior, Lamine Yamal — ${players.length} cầu thủ định hình bóng đá đương đại.</p>
    </div>
    ${playersHtml}
    <div class="footer"><a href="${SITE}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
