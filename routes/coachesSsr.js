/**
 * Coaches SEO Pages
 *   GET /huan-luyen-vien           → list
 *   GET /huan-luyen-vien/:slug     → detail (SSR for bots)
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { coaches } = require('../data/coaches');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function calcAge(dob) {
  const b = new Date(dob); const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age;
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0f172a;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .coach-hero{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px;display:flex;gap:20px;align-items:center}
    .coach-hero img{width:96px;height:96px;border-radius:50%;object-fit:cover;background:#f1f5f9;flex-shrink:0;border:3px solid #fbbf24}
    .coach-hero h1{font-size:24px;font-weight:800;margin-bottom:4px;line-height:1.2}
    .coach-hero .meta{font-size:13px;color:#fbbf24}
    .coach-hero .sub{font-size:12px;color:#cbd5e1;margin-top:4px}
    .card{background:#fff;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:12px;color:#334155;font-size:15px;line-height:1.8}
    .card ul{margin:10px 0;padding-left:22px}.card li{margin-bottom:8px;color:#334155;font-size:15px;line-height:1.6}
    .card li::marker{color:#fbbf24;font-weight:700}
    .card strong{color:#0f172a;font-weight:700}
    .info-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px}
    .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;flex:1;min-width:120px}
    .info-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
    .info-value{font-size:15px;font-weight:700;color:#0f172a;margin-top:2px}
    .ach-item{display:flex;gap:14px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f1f5f9}
    .ach-item:last-child{border-bottom:none}
    .ach-year{flex:0 0 70px;font-weight:800;color:#d97706;font-size:14px}
    .ach-title{font-weight:600;color:#0f172a;font-size:15px}
    .ach-team{font-size:13px;color:#64748b;margin-top:2px}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .coach-link{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;text-decoration:none}
    .coach-link:last-child{border-bottom:none}
    .coach-link img{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#f1f5f9;flex-shrink:0}
    .coach-link .cname{font-size:14px;font-weight:600;color:#1e293b}
    .coach-link .cnat{font-size:11px;color:#94a3b8}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    .status-badge{display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
    .status-active{background:#16a34a;color:#fff}
    .status-former{background:#64748b;color:#fff}
    .status-deceased{background:#334155;color:#fbbf24}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .coach-hero{flex-direction:column;text-align:center;padding:20px 16px;gap:12px}
      .coach-hero img{width:84px;height:84px}.coach-hero h1{font-size:20px}
    }
  `;
}

router.get('/huan-luyen-vien/:slug', (req, res) => {
  const coach = coaches.find(c => c.slug === req.params.slug);
  if (!coach) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/huan-luyen-vien">Danh sách HLV</a></p></body></html>`);
  }

  const url = `${SITE_URL}/huan-luyen-vien/${coach.slug}`;
  const age = coach.status.includes('qua đời') ? null : calcAge(coach.dob);
  const title = `${coach.name} - ${coach.role} | Tiểu Sử, Thành Tích`;
  const description = `${coach.name} (${coach.nationality}) - ${coach.role}. Nhiệm kỳ: ${coach.tenure}. Tiểu sử, sự nghiệp và thành tích với bóng đá Việt Nam.`;

  const personSchema = {
    '@context': 'https://schema.org', '@type': 'Person',
    name: coach.name, birthDate: coach.dob,
    birthPlace: { '@type': 'Place', name: coach.birthplace },
    nationality: coach.nationality,
    jobTitle: coach.role, image: coach.image, url,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Huấn luyện viên', item: `${SITE_URL}/huan-luyen-vien` },
      { '@type': 'ListItem', position: 3, name: coach.name, item: url }
    ]
  };

  const statusClass = coach.status.includes('qua đời') ? 'status-deceased' : coach.status.includes('Đương nhiệm') ? 'status-active' : 'status-former';
  const highlightsHtml = coach.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('');
  const achievementsHtml = coach.achievements.map(a => `
    <div class="ach-item">
      <div class="ach-year">${escapeHtml(a.year)}</div>
      <div>
        <div class="ach-title">${escapeHtml(a.title)}</div>
        <div class="ach-team">${escapeHtml(a.team)}</div>
      </div>
    </div>`).join('');

  const others = coaches.filter(c => c.slug !== coach.slug).slice(0, 5);
  const sidebarHtml = others.map(c => `
    <a href="/huan-luyen-vien/${c.slug}" class="coach-link">
      <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy">
      <div><div class="cname">${escapeHtml(c.name)}</div><div class="cnat">${escapeHtml(c.nationality)}</div></div>
    </a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(coach.tags.join(', '))}, huấn luyện viên việt nam">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="${escapeHtml(coach.name)}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(personSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/huan-luyen-vien">Huấn luyện viên</a> &rsaquo; <span>${escapeHtml(coach.name)}</span></nav>

    <div class="coach-hero">
      <img src="${escapeHtml(coach.image)}" alt="${escapeHtml(coach.name)}" width="96" height="96" loading="eager">
      <div>
        <h1>${escapeHtml(coach.name)}</h1>
        <div class="meta">${escapeHtml(coach.role)}</div>
        <div class="sub">🌍 ${escapeHtml(coach.nationality)} · 📅 Nhiệm kỳ: ${escapeHtml(coach.tenure)} · <span class="status-badge ${statusClass}">${escapeHtml(coach.status)}</span></div>
      </div>
    </div>

    <div class="layout">
      <main class="main">
        <div class="card">
          <h2>📋 Thông tin cá nhân</h2>
          <div class="info-row">
            ${age !== null ? `<div class="info-box"><div class="info-label">Tuổi</div><div class="info-value">${age}</div></div>` : ''}
            <div class="info-box"><div class="info-label">Quốc tịch</div><div class="info-value">${escapeHtml(coach.nationality)}</div></div>
            <div class="info-box"><div class="info-label">Ngày sinh</div><div class="info-value">${new Date(coach.dob).toLocaleDateString('vi-VN')}</div></div>
            <div class="info-box"><div class="info-label">Nơi sinh</div><div class="info-value">${escapeHtml(coach.birthplace)}</div></div>
          </div>
        </div>

        <div class="card">
          <h2>📖 Tiểu sử</h2>
          <p>${escapeHtml(coach.bio)}</p>
        </div>

        <div class="card">
          <h2>🏆 Điểm nhấn sự nghiệp</h2>
          <ul>${highlightsHtml}</ul>
        </div>

        <div class="card">
          <h2>🛤️ Hành trình</h2>
          ${coach.careerSummary.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>

        ${achievementsHtml ? `
        <div class="card">
          <h2>🥇 Danh hiệu & Thành tích</h2>
          ${achievementsHtml}
        </div>` : ''}

        <div class="card">
          <h2>🔗 Liên kết</h2>
          <p>
            <a href="/cau-thu">Cầu thủ Việt Nam</a> ·
            <a href="/world-cup-2026/doi-tuyen-viet-nam">ĐT Việt Nam World Cup 2026</a> ·
            <a href="/huan-luyen-vien">Danh sách HLV</a>
          </p>
        </div>
      </main>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">👔 HLV khác</div>
          ${sidebarHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a href="/" class="sidebar-link">Trang chủ</a>
          <a href="/cau-thu" class="sidebar-link">Cầu thủ Việt Nam</a>
          <a href="/nhan-dinh" class="sidebar-link">Nhận định bóng đá</a>
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

router.get('/huan-luyen-vien', (req, res) => {
  const url = `${SITE_URL}/huan-luyen-vien`;
  const title = 'Huấn Luyện Viên Việt Nam - Park Hang-seo, Kim Sang-sik, Troussier';
  const description = 'Danh sách huấn luyện viên ĐT Việt Nam qua các thời kỳ: Kim Sang-sik, Park Hang-seo, Philippe Troussier, Alfred Riedl, Henrique Calisto, Mai Đức Chung.';

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Huấn luyện viên', item: url }
    ]
  };

  const listHtml = coaches.map(c => {
    const statusClass = c.status.includes('qua đời') ? 'status-deceased' : c.status.includes('Đương nhiệm') ? 'status-active' : 'status-former';
    return `
    <a href="/huan-luyen-vien/${c.slug}" class="card" style="display:flex;gap:16px;align-items:center;text-decoration:none;margin-bottom:12px">
      <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;background:#f1f5f9;border:2px solid #fbbf24" loading="lazy">
      <div style="flex:1">
        <h3 style="color:#0f172a;font-size:18px;margin-bottom:4px">${escapeHtml(c.name)}</h3>
        <div style="font-size:14px;color:#64748b;margin-bottom:6px">${escapeHtml(c.role)} · ${escapeHtml(c.nationality)}</div>
        <div style="font-size:13px;color:#475569">📅 ${escapeHtml(c.tenure)} · <span class="status-badge ${statusClass}">${escapeHtml(c.status)}</span></div>
      </div>
    </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="huấn luyện viên việt nam, park hang seo, kim sang sik, troussier, hlv đội tuyển việt nam">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Huấn luyện viên</span></nav>
    <div class="card">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:8px">👔 Huấn Luyện Viên Việt Nam</h1>
      <p style="color:#475569">Tiểu sử, sự nghiệp và thành tích của các HLV đã và đang dẫn dắt ĐT Việt Nam — từ Alfred Riedl huyền thoại đến Kim Sang-sik đương nhiệm.</p>
    </div>
    ${listHtml}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
