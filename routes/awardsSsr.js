/**
 * Awards SSR — bot-only HTML for /giai-thuong and /giai-thuong/:slug
 * 5 prestigious individual football awards with year-by-year winners.
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { awards } = require('../data/awards');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0066FF;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}.main{min-width:0}
    .award-hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:24px;border-radius:12px;margin-bottom:16px;display:flex;gap:24px;align-items:center;border:2px solid rgba(251,191,36,0.4)}
    .award-hero img{width:96px;height:96px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 4px 12px rgba(251,191,36,0.4))}
    .award-hero h1{font-size:26px;font-weight:900;color:#fbbf24;margin-bottom:4px}
    .award-hero .nameEn{font-size:14px;color:#cbd5e1;font-style:italic;margin-bottom:8px}
    .award-hero .meta{font-size:13px;color:#94a3b8}
    .award-hero .meta strong{color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:22px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:10px;color:#334155;font-size:15px;line-height:1.7}
    .card strong{color:#0f172a}
    table.list{width:100%;border-collapse:collapse;font-size:14px}
    table.list th,table.list td{padding:10px 12px;text-align:left;border-bottom:1px solid #f1f5f9}
    table.list th{background:#fef3c7;color:#92400e;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
    table.list td.year{font-weight:800;color:#0f172a;width:80px;font-family:'Courier New',monospace}
    table.list td.winner{font-weight:600;color:#0f172a}
    table.list td.team{color:#64748b;font-size:13px}
    .top-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
    .top-item{display:flex;align-items:center;gap:14px;padding:12px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:8px}
    .top-rank{font-size:24px;font-weight:900;color:#fbbf24;width:32px;text-align:center}
    .top-name{font-weight:700;color:#0f172a;font-size:15px}
    .top-count{font-size:12px;color:#64748b}
    .grid-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
    .award-card{display:flex;gap:16px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-decoration:none;transition:all .15s}
    .award-card:hover{border-color:#fbbf24;box-shadow:0 6px 16px rgba(251,191,36,0.15);transform:translateY(-2px);text-decoration:none}
    .award-card img{width:60px;height:60px;object-fit:contain;flex-shrink:0}
    .award-card .name{font-weight:800;color:#0f172a;font-size:15px;margin-bottom:2px}
    .award-card .org{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
    .award-card .latest{font-size:12px;color:#475569}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){
      .award-hero{flex-direction:column;text-align:center;padding:18px}
      .award-hero h1{font-size:22px}
    }
  `;
}

router.get('/giai-thuong/:slug', (req, res) => {
  const award = awards.find(a => a.slug === req.params.slug);
  if (!award) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy giải thưởng | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/giai-thuong">Tất cả giải thưởng</a></p></body></html>`);
  }

  const url = `${SITE_URL}/giai-thuong/${award.slug}`;
  const latest = award.recentWinners[0];
  const title = `${award.name} ${latest.year} - Lịch Sử & Người Đoạt Giải`;
  const description = `Lịch sử ${award.name} (${award.nameEn}) — giải thưởng ${award.organizer} từ ${award.foundedYear}. ${latest.year}: ${latest.winner}. Vĩnh viễn nhiều nhất: ${award.mostWins[0].name} (${award.mostWins[0].count} lần).`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({ image: award.image }, { alt: award.name });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Giải thưởng', item: `${SITE_URL}/giai-thuong` },
      { '@type': 'ListItem', position: 3, name: award.name, item: url },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: award.recentWinners.length,
    itemListElement: award.recentWinners.map((w, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Person', name: w.winner },
    })),
  };

  const winnersHtml = `<table class="list">
    <thead><tr><th>Năm</th><th>Người đoạt giải</th><th>CLB / ĐTQG</th>${award.recentWinners[0].goals ? '<th style="text-align:right">Bàn</th>' : ''}</tr></thead>
    <tbody>
      ${award.recentWinners.map(w => `<tr>
        <td class="year">${w.year}</td>
        <td class="winner">${escapeHtml(w.winner)}</td>
        <td class="team">${escapeHtml(w.team)}</td>
        ${w.goals !== undefined ? `<td style="text-align:right;font-weight:700;color:#fbbf24">${w.goals}</td>` : ''}
      </tr>`).join('')}
    </tbody>
  </table>`;

  const topHtml = `<div class="top-list">
    ${award.mostWins.map((m, i) => `
      <div class="top-item">
        <div class="top-rank">${i + 1}</div>
        <div>
          <div class="top-name">${escapeHtml(m.name)}</div>
          <div class="top-count">${m.count} lần đoạt giải</div>
        </div>
      </div>
    `).join('')}
  </div>`;

  const otherAwardsHtml = awards.filter(a => a.slug !== award.slug).map(a => `<a class="sidebar-link" href="/giai-thuong/${escapeHtml(a.slug)}">${escapeHtml(a.name)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(award.name.toLowerCase())}, ${escapeHtml(award.nameEn.toLowerCase())}, ${escapeHtml(award.slug)}">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/giai-thuong">Giải thưởng</a> &rsaquo; <span>${escapeHtml(award.name)}</span></nav>

    <div class="award-hero">
      <img src="${escapeHtml(award.image)}" alt="${escapeHtml(award.name)}">
      <div>
        <h1>🏆 ${escapeHtml(award.name)}</h1>
        <div class="nameEn">${escapeHtml(award.nameEn)}</div>
        <div class="meta">
          <strong>Tổ chức:</strong> ${escapeHtml(award.organizer)} · <strong>Từ năm:</strong> ${award.foundedYear} · <strong>Người đoạt mới nhất:</strong> ${escapeHtml(latest.winner)} (${latest.year})
        </div>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>📖 Giới thiệu ${escapeHtml(award.name)}</h2>
          <p>${escapeHtml(award.bio)}</p>
          <p>${escapeHtml(award.description)}</p>
        </div>

        <div class="card">
          <h2>📅 Người đoạt giải gần đây</h2>
          ${winnersHtml}
        </div>

        <div class="card">
          <h2>🏆 Đoạt giải nhiều nhất</h2>
          ${topHtml}
        </div>

        <div class="card">
          <h2>🔗 Giải thưởng khác</h2>
          <p>${awards.filter(a => a.slug !== award.slug).map(a => `<a href="/giai-thuong/${escapeHtml(a.slug)}">${escapeHtml(a.name)}</a>`).join(' · ')}</p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏆', bio: `Hồ sơ ${escapeHtml(award.name)} tổng hợp từ ${escapeHtml(award.organizer)} chính thức. Danh sách người đoạt giải đối chiếu với cơ sở dữ liệu lịch sử.` })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🏆 Giải thưởng khác</div>
          ${otherAwardsHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/cau-thu-the-gioi">Cầu thủ thế giới</a>
          <a class="sidebar-link" href="/lich-su-vo-dich">Lịch sử vô địch CLB</a>
          <a class="sidebar-link" href="/huan-luyen-vien">Huấn luyện viên</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

router.get('/giai-thuong', (req, res) => {
  const url = `${SITE_URL}/giai-thuong`;
  const title = 'Giải Thưởng Bóng Đá - Quả Bóng Vàng, FIFA The Best, Yashin';
  const description = `${awards.length} giải thưởng cá nhân danh giá nhất bóng đá: Quả Bóng Vàng (Ballon d'Or), FIFA The Best, Chiếc Giày Vàng Châu Âu, Puskás Award, Yashin Trophy. Lịch sử và người đoạt giải.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Giải thưởng', item: url },
    ],
  };

  const cardsHtml = awards.map(a => {
    const latest = a.recentWinners[0];
    return `<a href="/giai-thuong/${a.slug}" class="award-card">
      <img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.name)}" loading="lazy">
      <div>
        <div class="name">${escapeHtml(a.name)}</div>
        <div class="org">${escapeHtml(a.organizer)} · từ ${a.foundedYear}</div>
        <div class="latest">${latest.year}: <strong style="color:#0f172a">${escapeHtml(latest.winner)}</strong></div>
      </div>
    </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="quả bóng vàng, ballon d'or, fifa the best, chiếc giày vàng, puskas award, yashin trophy, giải thưởng bóng đá">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Giải thưởng</span></nav>
    <div class="card">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:6px">🏆 Giải Thưởng Cá Nhân Bóng Đá</h1>
      <p style="color:#475569">${awards.length} giải thưởng danh giá nhất tôn vinh cầu thủ xuất sắc nhất thế giới — từ Quả Bóng Vàng (Ballon d'Or) tới Puskás Award cho bàn thắng đẹp nhất.</p>
    </div>
    <div class="grid-list">${cardsHtml}</div>
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
