/**
 * National Teams SSR — bot-only HTML for /doi-tuyen and /doi-tuyen/:slug
 *
 * Renders SEO pages for ~25 national teams centred on the 2026 World Cup
 * field plus a few perennial powers. Data comes from data/nationalTeams.js
 * with flags self-hosted at /team-flags/<slug>.svg.
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { teams } = require('../data/nationalTeams');
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
    .team-hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:24px;border-radius:12px;margin-bottom:16px;display:flex;gap:20px;align-items:center;border:2px solid rgba(251,191,36,0.3)}
    .team-hero img{width:88px;height:64px;object-fit:cover;border-radius:6px;border:2px solid rgba(255,255,255,0.2);background:#fff}
    .team-hero h1{font-size:28px;font-weight:800;color:#fbbf24;margin-bottom:4px}
    .team-hero .nick{font-size:14px;color:#cbd5e1;margin-bottom:6px;font-style:italic}
    .team-hero .meta{font-size:13px;color:#94a3b8;display:flex;gap:14px;flex-wrap:wrap}
    .team-hero .meta strong{color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:22px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:10px;color:#334155;font-size:15px;line-height:1.7}
    .card strong{color:#0f172a}
    .titles{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
    .title-box{background:#fafbfc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}
    .title-num{font-size:28px;font-weight:800;color:#fbbf24;display:block}
    .title-name{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
    ul.players{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
    ul.players li{padding:8px 12px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;font-weight:600;color:#0f172a}
    .grid-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
    .team-card{display:flex;gap:14px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-decoration:none;transition:all .15s}
    .team-card:hover{border-color:#fbbf24;box-shadow:0 4px 12px rgba(251,191,36,0.2);transform:translateY(-2px);text-decoration:none}
    .team-card img{width:48px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;flex-shrink:0;background:#fafbfc}
    .team-card .name{font-weight:800;color:#0f172a;font-size:15px}
    .team-card .conf{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
    .conf-section{margin-bottom:24px}
    .conf-title{font-size:14px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;background:#0a1628;padding:8px 14px;border-radius:6px;margin-bottom:10px;display:inline-block}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){
      .team-hero{flex-direction:column;text-align:center;padding:18px}
      .team-hero h1{font-size:22px}
    }
  `;
}

const CONF_VI = {
  'UEFA': 'Châu Âu (UEFA)',
  'CONMEBOL': 'Nam Mỹ (CONMEBOL)',
  'CONCACAF': 'Bắc & Trung Mỹ (CONCACAF)',
  'AFC': 'Châu Á (AFC)',
  'CAF': 'Châu Phi (CAF)',
  'OFC': 'Châu Đại Dương (OFC)',
};

router.get('/doi-tuyen/:slug', (req, res) => {
  const team = teams.find(t => t.slug === req.params.slug);
  if (!team) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy đội tuyển | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/doi-tuyen">Tất cả đội tuyển</a></p></body></html>`);
  }

  const url = `${SITE_URL}/doi-tuyen/${team.slug}`;
  const title = `Đội Tuyển ${team.name} - Lịch Sử, Thành Tích & Đội Hình`;
  const description = `Đội tuyển bóng đá ${team.name} (${team.nameEn}, ${team.nickname}): lịch sử, thành tích World Cup, ${team.bestFinish}. HLV ${team.coach}. Cầu thủ chủ chốt: ${team.keyPlayers.slice(0, 3).join(', ')}.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({ image: team.flag }, { alt: `Cờ ${team.name}` });

  const orgSchema = {
    '@context': 'https://schema.org', '@type': 'SportsTeam',
    name: `Đội tuyển bóng đá ${team.name}`,
    alternateName: team.nameEn,
    url, sport: 'Soccer',
    foundingDate: String(team.foundedYear),
    coach: { '@type': 'Person', name: team.coach },
    award: Object.entries(team.titles).filter(([_, v]) => v > 0).map(([k, v]) => `${v}× ${k}`),
    inLanguage: 'vi-VN',
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Đội tuyển QG', item: `${SITE_URL}/doi-tuyen` },
      { '@type': 'ListItem', position: 3, name: team.name, item: url },
    ],
  };

  const titlesHtml = Object.entries(team.titles).map(([k, v]) => {
    const labels = {
      worldCup: 'World Cup', euro: 'Euro', copaAmerica: 'Copa America',
      asianCup: 'Asian Cup', goldCup: 'Gold Cup', africaCup: 'Africa Cup',
      affCup: 'AFF Cup', nationsLeague: 'Nations League', finalissima: 'Finalissima',
    };
    return `<div class="title-box">
      <span class="title-num">${v}</span>
      <span class="title-name">${labels[k] || k}</span>
    </div>`;
  }).join('');

  const playersHtml = team.keyPlayers.map(p => `<li>${escapeHtml(p)}</li>`).join('');

  const others = teams.filter(t => t.slug !== team.slug && t.confederation === team.confederation).slice(0, 6);
  const otherTeamsHtml = others.map(t => `<a class="sidebar-link" href="/doi-tuyen/${escapeHtml(t.slug)}">${escapeHtml(t.name)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="đội tuyển ${escapeHtml(team.name.toLowerCase())}, ${escapeHtml(team.nameEn.toLowerCase())} national team, ${escapeHtml(team.nickname.toLowerCase())}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/doi-tuyen">Đội tuyển QG</a> &rsaquo; <span>${escapeHtml(team.name)}</span></nav>

    <div class="team-hero">
      <img src="${escapeHtml(team.flag)}" alt="Cờ ${escapeHtml(team.name)}">
      <div>
        <h1>🌍 Đội Tuyển ${escapeHtml(team.name)}</h1>
        <div class="nick">${escapeHtml(team.nickname)}</div>
        <div class="meta">
          <span><strong>Liên đoàn:</strong> ${escapeHtml(CONF_VI[team.confederation] || team.confederation)}</span>
          <span><strong>Thành lập:</strong> ${team.foundedYear}</span>
          <span><strong>HLV trưởng:</strong> ${escapeHtml(team.coach)}</span>
        </div>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>📖 Giới thiệu đội tuyển ${escapeHtml(team.name)}</h2>
          <p>${escapeHtml(team.bio)}</p>
        </div>

        <div class="card">
          <h2>🏆 Thành tích</h2>
          <p style="margin-bottom:16px"><strong>Thành tích nổi bật:</strong> ${escapeHtml(team.bestFinish)}</p>
          <div class="titles">${titlesHtml}</div>
        </div>

        <div class="card">
          <h2>🌍 Lịch sử World Cup</h2>
          <p><strong>Lần dự gần nhất:</strong> ${team.lastWcAppearance ? `World Cup ${team.lastWcAppearance}` : 'Chưa từng dự'}</p>
          <p><strong>Kết quả:</strong> ${escapeHtml(team.lastWcResult)}</p>
        </div>

        <div class="card">
          <h2>⭐ Cầu thủ chủ chốt</h2>
          <ul class="players">${playersHtml}</ul>
          <p style="margin-top:12px;font-size:13px;color:#64748b">Đội hình thực tế ở các giải đấu lớn có thể thay đổi theo phong độ và chấn thương.</p>
        </div>

        <div class="card">
          <h2>🔗 Liên kết liên quan</h2>
          <p><a href="/doi-tuyen">Tất cả đội tuyển</a> · <a href="/world-cup-2026">World Cup 2026</a> · <a href="/cau-thu-the-gioi">Cầu thủ thế giới</a> · <a href="/huan-luyen-vien">Huấn luyện viên</a></p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🌍', bio: `Hồ sơ đội tuyển ${escapeHtml(team.name)} tổng hợp từ FIFA, Liên đoàn bóng đá quốc gia và truyền thông quốc tế. Thành tích đối chiếu với cơ sở dữ liệu RSSSF và FIFA.com.` })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🌍 Cùng ${escapeHtml(team.confederation)}</div>
          ${otherTeamsHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/doi-tuyen">Tất cả đội tuyển</a>
          <a class="sidebar-link" href="/world-cup-2026">World Cup 2026</a>
          <a class="sidebar-link" href="/cau-thu-the-gioi">Cầu thủ thế giới</a>
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

// Confederation accent colors — light-theme palette matching the SPA.
const CONF_COLOR = {
  UEFA:     { c: '#3b82f6' },
  CONMEBOL: { c: '#10b981' },
  CONCACAF: { c: '#f59e0b' },
  AFC:      { c: '#8b5cf6' },
  CAF:      { c: '#f97316' },
  OFC:      { c: '#0891b2' },
};

function listStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;min-height:100vh}
    a{color:#0f172a;text-decoration:none}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}

    /* Hero is a pre-baked banner image — no CSS hero needed */
    .heroBanner{width:100%;border-radius:14px;overflow:hidden;margin-bottom:20px;background:#0a1628;line-height:0}
    .heroBanner img{display:block;width:100%;height:auto}

    .confSection{margin-bottom:28px}
    .confHeader{display:inline-flex;align-items:center;gap:12px;padding:8px 18px 8px 10px;background:#fff;border-radius:999px;margin-bottom:16px;box-shadow:0 4px 12px rgba(15,23,42,0.06)}
    .confLogo{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;flex-shrink:0;font-weight:900;letter-spacing:.5px}
    .confName{font-size:15px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;line-height:1}
    @media(max-width:480px){.confName{font-size:13px;letter-spacing:.8px}}

    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    @media(max-width:1024px){.grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:480px){.grid{grid-template-columns:1fr}}
    .card{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#0f172a;transition:all .18s;overflow:hidden}
    .card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(15,23,42,0.08);text-decoration:none}
    .card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;transform:scaleX(0);transform-origin:left;transition:transform .25s}
    .card:hover::before{transform:scaleX(1)}
    .flagFrame{width:42px;height:52px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .flagFrame img{width:100%;height:100%;object-fit:cover;border-radius:6px;clip-path:polygon(0 0,100% 0,100% 70%,50% 100%,0 70%);box-shadow:0 4px 10px rgba(15,23,42,0.15)}
    .cardBody{min-width:0;flex:1}
    .cardName{font-size:17px;font-weight:900;color:#0f172a;letter-spacing:.3px;text-transform:uppercase;line-height:1.1;margin-bottom:4px;word-break:break-word}
    .cardNick{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600;line-height:1.3}
    @media(max-width:480px){.cardName{font-size:15px}}

    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
  `;
}

function escapeHtmlAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

router.get('/doi-tuyen', (req, res) => {
  const url = `${SITE_URL}/doi-tuyen`;
  const title = 'Đội Tuyển Bóng Đá Quốc Gia - 48 Đội World Cup 2026';
  const description = `${teams.length} đội tuyển quốc gia tham dự World Cup 2026: lịch sử, thành tích, cầu thủ chủ chốt và HLV trưởng. Tổ chức theo 5 liên đoàn lớn của FIFA.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Đội tuyển QG', item: url },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: teams.length,
    itemListElement: teams.map((t, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_URL}/doi-tuyen/${t.slug}`, name: t.name,
    })),
  };

  const grouped = {};
  for (const t of teams) {
    (grouped[t.confederation] ||= []).push(t);
  }
  const confOrder = ['UEFA', 'CONMEBOL', 'CONCACAF', 'AFC', 'CAF', 'OFC'];

  const sectionsHtml = confOrder.filter(c => grouped[c]).map(c => {
    const palette = CONF_COLOR[c] || { c: '#94a3b8' };
    const cardsHtml = grouped[c].map(t => `
      <a href="/doi-tuyen/${escapeHtml(t.slug)}" class="card" style="--accent:${palette.c}">
        <div class="flagFrame">
          ${t.flag ? `<img src="${escapeHtml(t.flag)}" alt="Cờ ${escapeHtml(t.name)}" loading="lazy">` : ''}
        </div>
        <div class="cardBody">
          <div class="cardName">${escapeHtml(t.name)}</div>
          <div class="cardNick">${escapeHtml(t.nickname || t.nameEn || '')}</div>
        </div>
      </a>
    `).join('');
    return `
      <section class="confSection" id="${c.toLowerCase()}">
        <div class="confHeader" style="border:1.5px solid ${palette.c}">
          <div class="confLogo" style="background:linear-gradient(135deg,${palette.c}cc,${palette.c})">${escapeHtml(c.slice(0, 4))}</div>
          <div class="confName" style="color:${palette.c}">${escapeHtml(CONF_VI[c] || c)}</div>
        </div>
        <div class="grid">${cardsHtml}</div>
      </section>
    `;
  }).join('');

  // Hover-stripe color via CSS custom property
  const cardHoverStyle = `<style>.card{border-color:#e2e8f0}.card:hover{border-color:var(--accent)}.card::before{background:var(--accent)}</style>`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="đội tuyển quốc gia, world cup 2026, FIFA, UEFA, CONMEBOL, CONCACAF, AFC, CAF">
  <meta name="robots" content="index, follow, max-image-preview:large">
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
  <style>${listStyles()}</style>
  ${cardHoverStyle}
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Đội tuyển QG</span></nav>

    <div class="heroBanner">
      <img src="/images/doi-tuyen.webp" alt="Đội Tuyển Quốc Gia — 48 đội World Cup 2026" width="1200" height="300">
    </div>

    ${sectionsHtml}

    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🌍' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
