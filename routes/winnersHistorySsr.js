/**
 * Winners history SSR — bot-only HTML for /lich-su-vo-dich/:slug
 *
 * Renders the historical champions list for a given league using the
 * data already seeded in data/winners.js. Currently covers the Top 5
 * European leagues (Premier League, La Liga, Serie A, Bundesliga,
 * Ligue 1) for seasons 2010 → 2024.
 *
 * Targets long-tail evergreen searches like
 *   "vô địch ngoại hạng anh các năm"
 *   "lịch sử vô địch la liga"
 *   "premier league champions list"
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const { LEAGUES, getLeagueBySlug } = require('../utils/leagueSlugs');
const { LEAGUE_WINNERS } = require('../data/winners');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function proxyImg(url, w = 32) {
  if (!url) return '';
  if (url.startsWith('/')) return url;
  if (/media[^.]*\.api-sports\.io/.test(url)) {
    return `/api/img?url=${encodeURIComponent(url)}&w=${w}`;
  }
  return url;
}

// Aggregate winners list into per-club totals so we can render a
// "lịch sử vô địch nhiều nhất" leaderboard alongside the year-by-year list.
function aggregateByClub(yearsObj) {
  const counts = new Map();
  for (const [year, w] of Object.entries(yearsObj)) {
    if (!w?.name) continue;
    const key = w.slug || w.name;
    if (!counts.has(key)) counts.set(key, { name: w.name, slug: w.slug, image: w.image, count: 0, years: [] });
    counts.get(key).count++;
    counts.get(key).years.push(parseInt(year, 10));
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0f172a;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}.main{min-width:0}
    .hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px;border:1px solid rgba(251,191,36,0.3)}
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px;color:#fbbf24}
    .hero .meta{font-size:13px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:10px;color:#334155;font-size:15px}
    .card strong{color:#0f172a}
    table.list{width:100%;border-collapse:collapse;font-size:14px}
    table.list th,table.list td{padding:10px 8px;text-align:left;border-bottom:1px solid #f1f5f9}
    table.list th{background:#fef3c7;color:#92400e;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
    table.list td.year{font-weight:800;color:#0f172a;width:120px;font-family:'Courier New',monospace}
    table.list td.club{font-weight:600;color:#0f172a}
    table.list td.club img{width:28px;height:28px;vertical-align:middle;margin-right:8px;object-fit:contain}
    .top-clubs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
    .top-club{display:flex;gap:12px;align-items:center;padding:10px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:8px}
    .top-club img{width:40px;height:40px;object-fit:contain}
    .top-club .name{font-weight:700;color:#0f172a;font-size:14px}
    .top-club .count{font-weight:800;color:#fbbf24;font-size:18px}
    .top-club .years{font-size:11px;color:#94a3b8;margin-top:2px}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){.hero h1{font-size:20px}}
  `;
}

router.get('/lich-su-vo-dich/:slug', (req, res) => {
  const slug = req.params.slug;
  const league = getLeagueBySlug(slug);
  if (!league || !LEAGUE_WINNERS[league.id]) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không có dữ liệu lịch sử | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p>Lịch sử vô địch giải này đang được cập nhật.</p><p><a href="/lich-su-vo-dich">Xem các giải có lịch sử</a></p></body></html>`);
  }

  const yearsObj = LEAGUE_WINNERS[league.id];
  const yearsSorted = Object.keys(yearsObj).map(y => parseInt(y, 10)).sort((a, b) => b - a);
  const totalSeasons = yearsSorted.length;
  const earliestYear = yearsSorted[yearsSorted.length - 1];
  const latestYear = yearsSorted[0];
  const latest = yearsObj[latestYear];

  const aggregated = aggregateByClub(yearsObj);

  const url = `${SITE_URL}/lich-su-vo-dich/${slug}`;
  const title = `Lịch Sử Vô Địch ${league.name} - Tất Cả Nhà Vô Địch ${earliestYear}-${latestYear}`;
  const description = `Danh sách nhà vô địch ${league.viName} qua các năm từ ${earliestYear} đến ${latestYear}. CLB nào vô địch nhiều nhất, năm nào, đối thủ — tổng hợp lịch sử ${totalSeasons} mùa giải.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });

  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: totalSeasons,
    itemListElement: yearsSorted.map((year, i) => {
      const w = yearsObj[year];
      return {
        '@type': 'ListItem', position: i + 1,
        item: {
          '@type': 'SportsOrganization',
          name: w.name,
          ...(w.slug ? { url: `${SITE_URL}/doi-bong/${w.slug}` } : {}),
        },
      };
    }),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Lịch sử vô địch', item: `${SITE_URL}/lich-su-vo-dich` },
      { '@type': 'ListItem', position: 3, name: league.name, item: url },
    ],
  };

  const tableHtml = `<table class="list">
    <thead><tr><th>Mùa</th><th>Nhà vô địch</th></tr></thead>
    <tbody>
      ${yearsSorted.map(year => {
        const w = yearsObj[year];
        return `<tr>
          <td class="year">${year}/${(year + 1).toString().slice(-2)}</td>
          <td class="club">
            ${w.image ? `<img src="${escapeHtml(proxyImg(w.image, 56))}" alt="${escapeHtml(w.name)} logo" loading="lazy">` : ''}
            ${w.slug ? `<a href="/doi-bong/${escapeHtml(w.slug)}">${escapeHtml(w.name)}</a>` : escapeHtml(w.name)}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;

  const topClubsHtml = `<div class="top-clubs">
    ${aggregated.map(c => `
      <div class="top-club">
        ${c.image ? `<img src="${escapeHtml(proxyImg(c.image, 80))}" alt="${escapeHtml(c.name)}" loading="lazy">` : ''}
        <div>
          <div class="name">${c.slug ? `<a href="/doi-bong/${escapeHtml(c.slug)}" style="color:#0f172a">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)}</div>
          <div><span class="count">${c.count}</span> <span style="color:#64748b;font-size:12px">danh hiệu</span></div>
          <div class="years">${c.years.sort((a,b) => b - a).join(', ')}</div>
        </div>
      </div>
    `).join('')}
  </div>`;

  const otherLeaguesWithData = LEAGUES.filter(l => LEAGUE_WINNERS[l.id] && l.slug !== slug).slice(0, 8);
  const otherLeaguesHtml = otherLeaguesWithData.map(l => `<a class="sidebar-link" href="/lich-su-vo-dich/${escapeHtml(l.slug)}">${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="vô địch ${escapeHtml(league.viName.toLowerCase())}, lịch sử ${escapeHtml(slug)}, champions ${escapeHtml(league.name.toLowerCase())}, nhà vô địch các năm">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/lich-su-vo-dich">Lịch sử vô địch</a> &rsaquo; <span>${escapeHtml(league.viName)}</span></nav>

    <div class="hero">
      <h1>🏆 Lịch Sử Vô Địch ${escapeHtml(league.name)}</h1>
      <div class="meta">${totalSeasons} mùa giải · ${earliestYear} → ${latestYear} · ${aggregated.length} CLB từng vô địch</div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>📊 Vô địch nhiều nhất</h2>
          ${topClubsHtml}
        </div>

        <div class="card">
          <h2>📅 Tất cả nhà vô địch theo mùa</h2>
          ${tableHtml}
        </div>

        <div class="card">
          <h2>Nhà vô địch ${escapeHtml(league.name)} mùa gần nhất</h2>
          <p><strong>${escapeHtml(latest.name)}</strong> đăng quang ngôi vô địch ${escapeHtml(league.viName)} mùa ${latestYear}/${(latestYear + 1).toString().slice(-2)}. ${aggregated[0].name === latest.name ? `Đây là CLB đang dẫn đầu danh sách CLB vô địch nhiều nhất với ${aggregated[0].count} danh hiệu.` : `Đứng đầu danh sách vô địch nhiều nhất hiện vẫn là ${escapeHtml(aggregated[0].name)} với ${aggregated[0].count} lần.`}</p>
          ${latest.slug ? `<p><a href="/doi-bong/${escapeHtml(latest.slug)}">Xem trang ${escapeHtml(latest.name)} →</a></p>` : ''}
        </div>

        <div class="card">
          <h2>Liên kết liên quan</h2>
          <p><a href="/bang-xep-hang/${escapeHtml(slug)}">BXH ${escapeHtml(league.viName)} mùa hiện tại</a> · <a href="/giai-dau/${escapeHtml(slug)}">Tổng quan ${escapeHtml(league.viName)}</a> · <a href="/top-ghi-ban/${escapeHtml(slug)}">Vua phá lưới</a> · <a href="/top-kien-tao/${escapeHtml(slug)}">Vua kiến tạo</a></p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🏆' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🏆 Lịch sử giải khác</div>
          ${otherLeaguesHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/giai-dau/${escapeHtml(slug)}">Tổng quan ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/bang-xep-hang/${escapeHtml(slug)}">BXH ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/lich-thi-dau/${escapeHtml(slug)}">Lịch ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/top-ghi-ban/${escapeHtml(slug)}">Top ghi bàn</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400'); // 24h — winners only update once per season
  res.send(html);
});

// Brand styles per league — kept in sync with the SPA's LEAGUE_STYLE map
// in football-frontend/src/app/lich-su-vo-dich/page.tsx. Trophy graphics
// are self-hosted webp files served from the backend's /images route.
const LEAGUE_STYLE = {
  'premier-league': { gradient: 'linear-gradient(135deg,#3d1a78 0%,#1e3a8a 60%,#0a1628 100%)', accent: '#a78bfa', glow: 'rgba(167,139,250,0.35)', trophy: '/images/premier-league.webp' },
  'la-liga':        { gradient: 'linear-gradient(135deg,#7f1d1d 0%,#450a0a 60%,#1a1a1a 100%)', accent: '#fca5a5', glow: 'rgba(252,165,165,0.35)', trophy: '/images/la-liga.webp' },
  'serie-a':        { gradient: 'linear-gradient(135deg,#0c4a6e 0%,#1e293b 50%,#7f1d1d 100%)', accent: '#22d3ee', glow: 'rgba(34,211,238,0.35)',  trophy: '/images/serie-a.webp' },
  'bundesliga':     { gradient: 'linear-gradient(135deg,#991b1b 0%,#1f2937 60%,#0f172a 100%)', accent: '#fbbf24', glow: 'rgba(251,191,36,0.35)',  trophy: '/images/bundesliga.webp' },
  'ligue-1':        { gradient: 'linear-gradient(135deg,#1e3a8a 0%,#0c4a6e 50%,#854d0e 100%)', accent: '#facc15', glow: 'rgba(250,204,21,0.35)',  trophy: '/images/ligue-1.webp' },
};
const FALLBACK_STYLE = { gradient: 'linear-gradient(135deg,#1e293b,#0f172a)', accent: '#fbbf24', glow: 'rgba(251,191,36,0.3)', trophy: '' };

function hubStyles() {
  return `
    .hub-hero{width:100%;border-radius:16px;overflow:hidden;margin-bottom:28px;background:#0a1628;line-height:0;box-shadow:0 12px 40px rgba(0,0,0,0.45)}
    .hub-hero img{display:block;width:100%;height:auto}
    .hub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .hub-card{position:relative;display:block;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:22px 22px 70px;text-decoration:none;color:#fff;overflow:hidden;min-height:240px;box-shadow:0 8px 24px rgba(0,0,0,0.35)}
    .hub-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;opacity:0.7}
    .hub-card-trophy{position:absolute;top:50%;right:-12px;transform:translateY(-50%);height:78%;max-height:200px;width:auto;pointer-events:none}
    .hub-card-inner{position:relative;max-width:60%}
    .hub-card-name{font-size:22px;font-weight:900;letter-spacing:0.3px;line-height:1.1;text-transform:uppercase;margin-bottom:4px}
    .hub-card-country{font-size:11px;color:rgba(255,255,255,0.65);font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:18px}
    .hub-card-champ{font-size:14px;color:rgba(255,255,255,0.92);margin-bottom:12px;line-height:1.4}
    .hub-card-meta{display:flex;flex-direction:column;gap:6px;font-size:12px;color:rgba(255,255,255,0.78);font-weight:600}
    .hub-card-arrow{position:absolute;bottom:18px;right:18px;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;transform:rotate(-45deg);z-index:2}
    @media(max-width:1024px){.hub-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:640px){.hub-grid{grid-template-columns:1fr}.hub-card-name{font-size:18px}.hub-card-trophy{max-height:160px;right:-20px;opacity:0.7}.hub-card-inner{max-width:62%}}
  `;
}

router.get('/lich-su-vo-dich', (req, res) => {
  const url = `${SITE_URL}/lich-su-vo-dich`;
  const title = 'Lịch Sử Vô Địch Bóng Đá - Nhà Vô Địch Các Giải Đấu Lớn';
  const description = 'Tổng hợp lịch sử vô địch các giải đấu hàng đầu: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1. CLB nào vô địch nhiều nhất qua các năm.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title, preferred: `${SITE_URL}/images/lich-su-vo-dich.webp` });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Lịch sử vô địch', item: url },
    ],
  };

  const leaguesWithData = LEAGUES.filter(l => LEAGUE_WINNERS[l.id]);
  const cardsHtml = leaguesWithData.map(l => {
    const yearsObj = LEAGUE_WINNERS[l.id];
    const years = Object.keys(yearsObj).map(y => +y).sort((a, b) => b - a);
    const latest = yearsObj[years[0]];
    const seasonTag = `${years[0]}/${(years[0] + 1).toString().slice(-2)}`;
    const style = LEAGUE_STYLE[l.slug] || FALLBACK_STYLE;
    const country = l.country || '';
    return `<a href="/lich-su-vo-dich/${escapeHtml(l.slug)}" class="hub-card" style="background:${style.gradient}">
      <span style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${style.accent},transparent);opacity:0.7"></span>
      ${style.trophy ? `<img src="${escapeHtml(style.trophy)}" alt="Cúp vô địch ${escapeHtml(l.name)}" class="hub-card-trophy" style="filter:drop-shadow(0 6px 14px ${style.glow})" loading="lazy">` : ''}
      <div class="hub-card-inner">
        <div class="hub-card-name">${escapeHtml(l.name)}</div>
        ${country ? `<div class="hub-card-country">${escapeHtml(country)}</div>` : ''}
        <div class="hub-card-champ">Đương kim: <strong style="color:${style.accent};font-weight:900">${escapeHtml(latest.name)}</strong> (${seasonTag})</div>
        <div class="hub-card-meta"><span>📅 ${years.length} mùa</span><span>⏰ ${years[years.length-1]} - ${years[0]}</span></div>
      </div>
      <div class="hub-card-arrow" style="border:1px solid ${style.accent};color:${style.accent}">→</div>
    </a>`;
  }).join('');

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
  <style>${baseStyles()}${hubStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Lịch sử vô địch</span></nav>

    <h1 style="position:absolute;left:-9999px">Lịch Sử Vô Địch Bóng Đá</h1>
    <div class="hub-hero">
      <img src="/images/lich-su-vo-dich.webp" alt="Lịch sử vô địch bóng đá — nhà vô địch các giải đấu lớn" width="1200" height="300">
    </div>

    <div class="hub-grid">${cardsHtml}</div>

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
