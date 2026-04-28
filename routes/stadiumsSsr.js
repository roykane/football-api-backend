/**
 * Stadiums SSR — bot-only HTML for /san-van-dong and /san-van-dong/:slug
 *
 * 20 most iconic football stadiums worldwide. Targets keywords like
 * "old trafford", "camp nou", "santiago bernabeu", "san siro".
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { stadiums } = require('../data/stadiums');
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
    /* Hero photo full-bleed (no overlay) — like a feature article banner. */
    .hero-frame{width:100%;border-radius:12px 12px 0 0;overflow:hidden;background:#0a1628;aspect-ratio:21/9;max-height:440px}
    .hero-frame img{width:100%;height:100%;object-fit:cover;display:block}
    .info-bar{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:18px 22px;border-radius:0 0 12px 12px;margin-bottom:16px;border:1px solid rgba(251,191,36,0.3);border-top:none}
    .info-bar h1{font-size:30px;font-weight:900;color:#fbbf24;margin-bottom:4px;line-height:1.15}
    .info-bar .alias{font-size:13px;color:#cbd5e1;margin-bottom:10px;font-style:italic}
    .info-bar .meta{font-size:13px;color:#e2e8f0;display:flex;gap:18px;flex-wrap:wrap}
    .info-bar .meta strong{color:#fbbf24;font-weight:800}
    @media(max-width:768px){.hero-frame{aspect-ratio:16/9}.info-bar{padding:14px 16px}.info-bar h1{font-size:22px}.info-bar .meta{gap:10px;font-size:12px}}
    .card{background:#fff;border-radius:8px;padding:22px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:10px;color:#334155;font-size:15px;line-height:1.7}
    .card strong{color:#0f172a}
    .card ul{padding-left:22px;margin:8px 0}
    .card li{margin-bottom:8px;color:#334155}
    .specs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:14px 0}
    .spec{background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;padding:12px}
    .spec-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .spec-value{font-size:16px;font-weight:700;color:#0f172a}
    .grid-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:14px}
    .stadium-card{background:#fff;border-radius:10px;overflow:hidden;text-decoration:none;border:1px solid #e2e8f0;transition:all .15s}
    .stadium-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.08);text-decoration:none;border-color:#fbbf24}
    .stadium-card img{width:100%;height:160px;object-fit:cover;background:#f8fafc}
    .stadium-card .body{padding:14px}
    .stadium-card .name{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px}
    .stadium-card .meta{font-size:12px;color:#64748b}
    .stadium-card .cap{display:inline-block;margin-top:6px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;letter-spacing:.3px}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    /* Stadium thumbnail row in sidebar — photo + name + city */
    .stadium-row{display:flex;gap:10px;align-items:center;padding:8px;margin:0 -8px;border-radius:8px;text-decoration:none;color:inherit;transition:background .15s}
    .stadium-row:hover{background:#fffbeb;text-decoration:none}
    .stadium-row img{width:72px;height:54px;object-fit:cover;border-radius:6px;flex-shrink:0;background:#f1f5f9;border:1px solid #e2e8f0}
    .stadium-row .info{min-width:0;flex:1}
    .stadium-row .row-name{font-size:13px;font-weight:700;color:#0f172a;line-height:1.25;margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .stadium-row .row-city{font-size:11px;color:#94a3b8}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
  `;
}

router.get('/san-van-dong/:slug', (req, res) => {
  const stadium = stadiums.find(s => s.slug === req.params.slug);
  if (!stadium) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy sân | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/san-van-dong">Tất cả sân vận động</a></p></body></html>`);
  }

  const url = `${SITE_URL}/san-van-dong/${stadium.slug}`;
  const title = `Sân ${stadium.name} - ${stadium.homeTeam} | Sức Chứa, Lịch Sử`;
  const description = `Sân ${stadium.name} (${stadium.aliases}) tại ${stadium.city}, ${stadium.country}. Sức chứa ${stadium.capacity.toLocaleString('vi-VN')} chỗ, khánh thành ${stadium.opened}. Sân nhà của ${stadium.homeTeam}.`;

  const { datePublished, dateModified } = getEntityDates({});
  // pickOgImage requires absolute URL — convert local /sanvandong/... path.
  const ogCandidate = stadium.image && /^https?:\/\//.test(stadium.image)
    ? stadium.image
    : `${SITE_URL}${stadium.image}`;
  const og = pickOgImage({ image: ogCandidate }, { alt: `Sân ${stadium.name}` });

  const placeSchema = {
    '@context': 'https://schema.org',
    '@type': 'StadiumOrArena',
    name: stadium.name,
    alternateName: stadium.aliases,
    url,
    image: stadium.image && /^https?:\/\//.test(stadium.image) ? stadium.image : `${SITE_URL}${stadium.image}`,
    address: { '@type': 'PostalAddress', addressLocality: stadium.city, addressCountry: stadium.country },
    maximumAttendeeCapacity: stadium.capacity,
    foundingDate: String(stadium.opened),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Sân vận động', item: `${SITE_URL}/san-van-dong` },
      { '@type': 'ListItem', position: 3, name: stadium.name, item: url },
    ],
  };

  const matchesHtml = stadium.famousMatches.map(m => `<li>${escapeHtml(m)}</li>`).join('');

  // Always fill the 5-row sidebar — start with same-country stadiums for
  // local relevance, then top up with rest-of-world if we run short.
  const sameCountry = stadiums.filter(s => s.slug !== stadium.slug && s.country === stadium.country);
  const elsewhere = stadiums.filter(s => s.slug !== stadium.slug && s.country !== stadium.country);
  const others = [...sameCountry, ...elsewhere].slice(0, 5);
  // Thumb + name + city per row instead of plain text link — visual sidebar.
  const othersHtml = others.map(s => `
    <a class="stadium-row" href="/san-van-dong/${escapeHtml(s.slug)}">
      ${s.image ? `<img src="${escapeHtml(s.image)}" alt="Sân ${escapeHtml(s.name)}" loading="lazy" width="72" height="54">` : ''}
      <div class="info">
        <div class="row-name">${escapeHtml(s.name)}</div>
        <div class="row-city">📍 ${escapeHtml(s.city)}, ${escapeHtml(s.country)}</div>
      </div>
    </a>
  `).join('') + `<a class="sidebar-link" href="/san-van-dong" style="padding-top:10px;margin-top:4px;font-weight:600;color:#0f172a">Xem tất cả sân →</a>`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="sân ${escapeHtml(stadium.name.toLowerCase())}, ${escapeHtml(stadium.slug)}, stadium, sức chứa">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(placeSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/san-van-dong">Sân vận động</a> &rsaquo; <span>${escapeHtml(stadium.name)}</span></nav>

    <div class="hero-frame">
      <img src="${escapeHtml(stadium.image)}" alt="Sân ${escapeHtml(stadium.name)}" loading="eager">
    </div>
    <div class="info-bar">
      <h1>🏟️ ${escapeHtml(stadium.name)}</h1>
      <div class="alias">${escapeHtml(stadium.aliases)}</div>
      <div class="meta">
        <span><strong>${stadium.capacity.toLocaleString('vi-VN')}</strong> chỗ ngồi</span>
        <span>📍 ${escapeHtml(stadium.city)}, ${escapeHtml(stadium.country)}</span>
        <span>🏗️ Khánh thành ${stadium.opened}</span>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>📖 Giới thiệu sân ${escapeHtml(stadium.name)}</h2>
          <p>${escapeHtml(stadium.bio)}</p>
        </div>

        <div class="card">
          <h2>📋 Thông số kỹ thuật</h2>
          <div class="specs-grid">
            <div class="spec">
              <div class="spec-label">Sức chứa</div>
              <div class="spec-value">${stadium.capacity.toLocaleString('vi-VN')}</div>
            </div>
            <div class="spec">
              <div class="spec-label">Khánh thành</div>
              <div class="spec-value">${stadium.opened}</div>
            </div>
            <div class="spec">
              <div class="spec-label">Mặt sân</div>
              <div class="spec-value" style="font-size:13px">${escapeHtml(stadium.surface)}</div>
            </div>
            <div class="spec">
              <div class="spec-label">Kiến trúc sư</div>
              <div class="spec-value" style="font-size:13px">${escapeHtml(stadium.architect)}</div>
            </div>
          </div>
          <p><strong>Thành phố:</strong> ${escapeHtml(stadium.city)}, ${escapeHtml(stadium.country)}</p>
          <p><strong>Sân nhà của:</strong> ${stadium.homeTeamSlug ? `<a href="/doi-bong/${escapeHtml(stadium.homeTeamSlug)}">${escapeHtml(stadium.homeTeam)}</a>` : escapeHtml(stadium.homeTeam)}</p>
        </div>

        <div class="card">
          <h2>⚽ Trận đấu lịch sử tại ${escapeHtml(stadium.name)}</h2>
          <ul>${matchesHtml}</ul>
        </div>

        <div class="card">
          <h2>🔗 Liên kết liên quan</h2>
          <p><a href="/san-van-dong">Tất cả sân vận động</a> · ${stadium.homeTeamSlug ? `<a href="/doi-bong/${escapeHtml(stadium.homeTeamSlug)}">Trang ${escapeHtml(stadium.homeTeam)}</a> · ` : ''}${stadium.countrySlug ? `<a href="/doi-tuyen/${escapeHtml(stadium.countrySlug)}">ĐT ${escapeHtml(stadium.country)}</a>` : ''}</p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏟️', bio: `Hồ sơ sân ${escapeHtml(stadium.name)} tổng hợp từ FIFA, UEFA, CLB chủ sở hữu và Wikipedia. Thông số kỹ thuật được đối chiếu với hồ sơ chính thức.` })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🏟️ Sân khác</div>
          ${othersHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/doi-tuyen">🌍 Đội tuyển QG</a>
          <a class="sidebar-link" href="/cau-thu-the-gioi">⭐ Cầu thủ thế giới</a>
          <a class="sidebar-link" href="/giai-thuong">🏆 Giải thưởng</a>
          <a class="sidebar-link" href="/world-cup-2026">🌎 World Cup 2026</a>
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

router.get('/san-van-dong', (req, res) => {
  const url = `${SITE_URL}/san-van-dong`;
  const title = 'Sân Vận Động Bóng Đá - Camp Nou, Bernabéu, Old Trafford & Hơn Thế';
  const description = `${stadiums.length} sân vận động bóng đá biểu tượng thế giới: Camp Nou, Santiago Bernabéu, Old Trafford, Wembley, San Siro, Anfield, Allianz Arena. Sức chứa, lịch sử và trận đấu nổi tiếng.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Sân vận động', item: url },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: stadiums.length,
    itemListElement: stadiums.map((s, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_URL}/san-van-dong/${s.slug}`, name: s.name,
    })),
  };

  const cardsHtml = stadiums.map(s => `
    <a href="/san-van-dong/${s.slug}" class="stadium-card">
      <img src="${escapeHtml(s.image)}" alt="Sân ${escapeHtml(s.name)}" loading="lazy">
      <div class="body">
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="meta">📍 ${escapeHtml(s.city)}, ${escapeHtml(s.country)}</div>
        <span class="cap">${s.capacity.toLocaleString('vi-VN')} chỗ</span>
      </div>
    </a>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="sân vận động, camp nou, santiago bernabeu, old trafford, wembley, san siro, anfield, sân bóng đá">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Sân vận động</span></nav>
    <div class="card">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:6px">🏟️ Sân Vận Động Bóng Đá</h1>
      <p style="color:#475569">${stadiums.length} sân vận động biểu tượng của bóng đá thế giới — kiến trúc, sức chứa, các trận đấu lịch sử và CLB chủ sở hữu.</p>
    </div>
    <div class="grid-list">${cardsHtml}</div>
    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏟️' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(html);
});

module.exports = router;
