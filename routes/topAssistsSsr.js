/**
 * Top Assists SSR — bot-only HTML for /top-kien-tao/:slug
 *
 * Mirror of topScorersSsr.js but pulls /players/topassists from API-Sports
 * and ranks by assists. Player and team photos are rewritten through the
 * local /api/img proxy so the rendered HTML never points at the third-party
 * CDN directly.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const siteHeader = require('../utils/siteHeader');
const { getLeagueBySlug, LEAGUES, currentSeasonForLeague } = require('../utils/leagueSlugs');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

const API_KEY = process.env.API_FOOTBALL_KEY;

const footballApi = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: API_KEY ? { 'x-apisports-key': API_KEY } : {},
  timeout: 10000,
});

const cache = new Map();
const TTL_MS = 6 * 60 * 60 * 1000;

// Wrap api-sports photo URLs through the local image proxy so the rendered
// HTML stays same-origin (no external hotlink). proxyImg falls back to the
// raw URL only for non-allowed hosts (no proxy defined).
function proxyImg(url, w = 64) {
  if (!url) return '';
  if (!/^https?:\/\//.test(url)) return url;
  if (url.includes('media') && url.includes('api-sports.io')) {
    return `/api/img?url=${encodeURIComponent(url)}&w=${w}`;
  }
  return url;
}

async function fetchTopAssists(leagueId, season) {
  const key = `${leagueId}-${season}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  if (!API_KEY) return [];

  try {
    const { data } = await footballApi.get('/players/topassists', {
      params: { league: leagueId, season },
    });
    const list = (data?.response || []).slice(0, 25).map(item => ({
      name: item.player?.name || '',
      photo: item.player?.photo || '',
      age: item.player?.age,
      nationality: item.player?.nationality,
      teamName: item.statistics?.[0]?.team?.name || '',
      teamLogo: item.statistics?.[0]?.team?.logo || '',
      assists: item.statistics?.[0]?.goals?.assists ?? 0,
      goals: item.statistics?.[0]?.goals?.total ?? 0,
      appearances: item.statistics?.[0]?.games?.appearences ?? 0,
      minutes: item.statistics?.[0]?.games?.minutes ?? 0,
    }));
    cache.set(key, { at: Date.now(), data: list });
    return list;
  } catch (err) {
    return [];
  }
}

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
    .hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px;border:1px solid rgba(251,191,36,0.3)}
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px;color:#fbbf24}
    .hero .meta{font-size:13px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:10px;color:#334155;font-size:15px}
    .card strong{color:#0f172a}
    table.list{width:100%;border-collapse:collapse;font-size:14px}
    table.list th,table.list td{padding:10px 8px;text-align:center;border-bottom:1px solid #f1f5f9}
    table.list th{background:#fef3c7;color:#92400e;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
    table.list td.player{text-align:left;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:10px}
    table.list td.player img{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#f8fafc;flex-shrink:0}
    table.list td.team{text-align:left;color:#475569;font-size:13px}
    table.list td.team img{width:18px;height:18px;vertical-align:middle;margin-right:4px;object-fit:contain}
    .rank-1{color:#fbbf24;font-weight:800;font-size:16px}
    .rank-2,.rank-3{color:#d97706;font-weight:700}
    .key-cell{font-weight:800;color:#fbbf24;font-size:16px;background:#0a1628}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .empty{text-align:center;padding:24px;color:#94a3b8;font-size:14px}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .hero h1{font-size:20px}
      table.list{font-size:12px}
      table.list td.player img{width:24px;height:24px}
      table.list th,table.list td{padding:6px 4px}
    }
  `;
}

function renderTable(rows) {
  if (!rows.length) {
    return `<div class="empty">Bảng xếp hạng top kiến tạo đang được cập nhật. Vui lòng quay lại sau giờ thi đấu kế tiếp.</div>`;
  }
  const html = rows.map((p, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank <= 3 ? 'rank-2' : '';
    return `<tr>
      <td class="${rankClass}">${rank}</td>
      <td class="player">
        ${p.photo ? `<img src="${escapeHtml(proxyImg(p.photo, 64))}" alt="${escapeHtml(p.name)}" loading="lazy">` : ''}
        <span>${escapeHtml(p.name)}${p.age ? ` <span style="color:#94a3b8;font-weight:400">(${p.age})</span>` : ''}</span>
      </td>
      <td class="team">${p.teamLogo ? `<img src="${escapeHtml(proxyImg(p.teamLogo, 32))}" alt="${escapeHtml(p.teamName)}" loading="lazy">` : ''}${escapeHtml(p.teamName)}</td>
      <td>${p.appearances}</td>
      <td class="key-cell" style="color:#fbbf24;background:#0a1628">${p.assists}</td>
      <td>${p.goals}</td>
    </tr>`;
  }).join('');
  return `<table class="list">
    <thead><tr><th>#</th><th style="text-align:left">Cầu thủ</th><th style="text-align:left">CLB</th><th>Trận</th><th>Kiến tạo</th><th>Bàn thắng</th></tr></thead>
    <tbody>${html}</tbody>
  </table>`;
}

router.get('/top-kien-tao/:slug', async (req, res) => {
  const slug = req.params.slug;
  const league = getLeagueBySlug(slug);
  if (!league) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy giải đấu | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/top-kien-tao">Quay lại</a></p></body></html>`);
  }

  const season = currentSeasonForLeague(league);
  const rows = await fetchTopAssists(league.id, season);

  const url = `${SITE_URL}/top-kien-tao/${slug}`;
  const seasonStr = ` ${season}/${season + 1}`;
  const top1 = rows[0];
  const title = `Top Kiến Tạo ${league.name}${seasonStr} - Vua Chuyền Bóng`;
  const description = top1
    ? `Vua kiến tạo ${league.viName}${seasonStr}: ${top1.name} (${top1.teamName}) đang dẫn đầu với ${top1.assists} đường kiến tạo. Top ${rows.length} cầu thủ kiến tạo nhiều nhất.`
    : `Bảng xếp hạng top kiến tạo ${league.viName}${seasonStr}: vua chuyền bóng, danh sách cầu thủ kiến tạo nhiều nhất mùa giải.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: `Top kiến tạo ${league.name}` });

  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: rows.length,
    itemListElement: rows.map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Person', name: p.name, affiliation: { '@type': 'SportsTeam', name: p.teamName } },
    })),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Top kiến tạo', item: `${SITE_URL}/top-kien-tao` },
      { '@type': 'ListItem', position: 3, name: league.name, item: url },
    ],
  };

  const otherLeagues = LEAGUES.filter(l => l.slug !== slug).slice(0, 8);
  const otherLeaguesHtml = otherLeagues.map(l => `<a class="sidebar-link" href="/top-kien-tao/${l.slug}">${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="vua kiến tạo ${escapeHtml(league.viName.toLowerCase())}, top kiến tạo ${escapeHtml(slug)}, top assists ${escapeHtml(league.name.toLowerCase())}">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/top-kien-tao">Top kiến tạo</a> &rsaquo; <span>${escapeHtml(league.viName)}</span></nav>

    <div class="hero">
      <h1>🎯 Vua Kiến Tạo ${escapeHtml(league.name)}${escapeHtml(seasonStr)}</h1>
      <div class="meta">${escapeHtml(league.country)} · Top ${rows.length || 0} cầu thủ kiến tạo nhiều nhất</div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>Bảng xếp hạng top kiến tạo</h2>
          ${renderTable(rows)}
        </div>

        <div class="card">
          <h2>Về cuộc đua kiến tạo ${escapeHtml(league.name)}</h2>
          ${top1 ? `<p><strong>${escapeHtml(top1.name)}</strong> (${escapeHtml(top1.teamName)}) hiện dẫn đầu danh sách kiến tạo ${escapeHtml(league.name)} mùa ${seasonStr.trim()} với <strong>${top1.assists} đường chuyền thành bàn</strong> sau ${top1.appearances} trận. ${rows[1] ? `Theo sau là ${escapeHtml(rows[1].name)} (${rows[1].assists} kiến tạo).` : ''}</p>` : ''}
          <p>Kiến tạo là chỉ số phản ánh khả năng tổ chức và đọc trận đấu — đường chuyền cuối tạo cơ hội ghi bàn cho đồng đội. Top kiến tạo thường tập trung ở nhóm tiền vệ tổ chức và tiền đạo lùi, tuy nhiên các hậu vệ cánh chất lượng cao cũng có thể chen chân.</p>
          <p>Xem thêm: <a href="/top-ghi-ban/${slug}">Vua phá lưới ${escapeHtml(league.viName)}</a> · <a href="/bang-xep-hang/${slug}">BXH ${escapeHtml(league.viName)}</a> · <a href="/lich-thi-dau/${slug}">Lịch ${escapeHtml(league.viName)}</a></p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🎯' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🎯 Top kiến tạo giải khác</div>
          ${otherLeaguesHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/top-ghi-ban/${slug}">Vua phá lưới ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/bang-xep-hang/${slug}">BXH ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/lich-thi-dau/${slug}">Lịch ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/cau-thu">Cầu thủ Việt Nam</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=10800');
  res.send(html);
});

router.get('/top-kien-tao', async (req, res) => {
  const url = `${SITE_URL}/top-kien-tao`;
  const title = 'Top Kiến Tạo - Vua Chuyền Bóng Các Giải Đấu Hàng Đầu';
  const description = 'Bảng xếp hạng vua kiến tạo các giải đấu lớn: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, V.League. Cập nhật sau từng vòng.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Top kiến tạo', item: url },
    ],
  };

  const cardsHtml = LEAGUES.map(l => `
    <a href="/top-kien-tao/${l.slug}" class="card" style="display:block;text-decoration:none;padding:16px;margin-bottom:0">
      <h2 style="font-size:16px;margin-bottom:4px;border:0;padding:0">🎯 ${escapeHtml(l.name)}</h2>
      <div style="font-size:12px;color:#64748b">${escapeHtml(l.country)} · Vua kiến tạo mùa hiện tại</div>
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Top kiến tạo</span></nav>
    <div class="hero">
      <h1>🎯 Top Kiến Tạo Bóng Đá</h1>
      <div class="meta">Cuộc đua vua chuyền bóng tại các giải đấu hàng đầu — chọn giải để xem chi tiết.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">${cardsHtml}</div>
    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '🎯' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

module.exports = router;
