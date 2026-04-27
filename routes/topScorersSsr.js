/**
 * Top Scorers SSR — bot-only HTML for /top-ghi-ban/:slug
 *
 * Fetches /players/topscorers from API-Sports, caches in-process for 6 hours
 * (data only changes after each matchday), and renders a full HTML leaderboard
 * for Googlebot. Browser path stays on the SPA.
 *
 * If API-Sports fails or no key configured, we degrade gracefully — the page
 * renders the league header + cross-links so the URL still indexes meaningfully
 * rather than 404.
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

async function fetchTopScorers(leagueId, season) {
  const key = `${leagueId}-${season}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  if (!API_KEY) return [];

  try {
    const { data } = await footballApi.get('/players/topscorers', {
      params: { league: leagueId, season },
    });
    const list = (data?.response || []).slice(0, 25).map(item => ({
      name: item.player?.name || '',
      photo: item.player?.photo || '',
      age: item.player?.age,
      nationality: item.player?.nationality,
      teamName: item.statistics?.[0]?.team?.name || '',
      teamLogo: item.statistics?.[0]?.team?.logo || '',
      goals: item.statistics?.[0]?.goals?.total ?? 0,
      assists: item.statistics?.[0]?.goals?.assists ?? 0,
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
    .hero{background:linear-gradient(135deg,#92400e,#d97706);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px}
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px}
    .hero .meta{font-size:13px;color:#fed7aa}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .card p{margin-bottom:10px;color:#334155;font-size:15px}
    .card strong{color:#0f172a}
    table.scorers{width:100%;border-collapse:collapse;font-size:14px}
    table.scorers th,table.scorers td{padding:10px 8px;text-align:center;border-bottom:1px solid #f1f5f9}
    table.scorers th{background:#fef3c7;color:#92400e;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
    table.scorers td.player{text-align:left;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:10px}
    table.scorers td.player img{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#f8fafc;flex-shrink:0}
    table.scorers td.team{text-align:left;color:#475569;font-size:13px}
    table.scorers td.team img{width:18px;height:18px;vertical-align:middle;margin-right:4px;object-fit:contain}
    .rank-1{color:#d97706;font-weight:800;font-size:16px}
    .rank-2,.rank-3{color:#a16207;font-weight:700}
    .goals-cell{font-weight:800;color:#d97706;font-size:16px}
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
      table.scorers{font-size:12px}
      table.scorers td.player img{width:24px;height:24px}
      table.scorers th,table.scorers td{padding:6px 4px}
    }
  `;
}

function renderTable(scorers) {
  if (!scorers.length) {
    return `<div class="empty">Bảng xếp hạng vua phá lưới đang được cập nhật. Vui lòng quay lại sau giờ thi đấu kế tiếp.</div>`;
  }
  const rows = scorers.map((s, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank <= 3 ? 'rank-2' : '';
    return `<tr>
      <td class="${rankClass}">${rank}</td>
      <td class="player">
        ${s.photo ? `<img src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.name)}" loading="lazy">` : ''}
        <span>${escapeHtml(s.name)}${s.age ? ` <span style="color:#94a3b8;font-weight:400">(${s.age})</span>` : ''}</span>
      </td>
      <td class="team">${s.teamLogo ? `<img src="${escapeHtml(s.teamLogo)}" alt="${escapeHtml(s.teamName)}" loading="lazy">` : ''}${escapeHtml(s.teamName)}</td>
      <td>${s.appearances}</td>
      <td class="goals-cell">${s.goals}</td>
      <td>${s.assists}</td>
    </tr>`;
  }).join('');
  return `<table class="scorers">
    <thead><tr><th>#</th><th style="text-align:left">Cầu thủ</th><th style="text-align:left">CLB</th><th>Trận</th><th>Bàn thắng</th><th>Kiến tạo</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

router.get('/top-ghi-ban/:slug', async (req, res) => {
  const slug = req.params.slug;
  const league = getLeagueBySlug(slug);
  if (!league) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy giải đấu | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/top-ghi-ban">Quay lại</a></p></body></html>`);
  }

  const season = currentSeasonForLeague(league);
  const scorers = await fetchTopScorers(league.id, season);

  const url = `${SITE_URL}/top-ghi-ban/${slug}`;
  const seasonStr = ` ${season}/${season + 1}`;
  const top1 = scorers[0];
  const title = `Top Ghi Bàn ${league.name}${seasonStr} - Vua Phá Lưới`;
  const description = top1
    ? `Vua phá lưới ${league.viName}${seasonStr}: ${top1.name} (${top1.teamName}) đang dẫn đầu với ${top1.goals} bàn thắng. Top ${scorers.length} cầu thủ ghi nhiều nhất.`
    : `Bảng xếp hạng top ghi bàn ${league.viName}${seasonStr}: vua phá lưới, top kiến tạo, danh sách cầu thủ ghi nhiều bàn nhất mùa giải.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: `Top ghi bàn ${league.name}` });

  const itemListSchema = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title, url, numberOfItems: scorers.length,
    itemListElement: scorers.map((s, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'Person', name: s.name, affiliation: { '@type': 'SportsTeam', name: s.teamName } },
    })),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Top ghi bàn', item: `${SITE_URL}/top-ghi-ban` },
      { '@type': 'ListItem', position: 3, name: league.name, item: url },
    ],
  };

  const otherLeagues = LEAGUES.filter(l => l.slug !== slug).slice(0, 8);
  const otherLeaguesHtml = otherLeagues.map(l => `<a class="sidebar-link" href="/top-ghi-ban/${l.slug}">${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="vua phá lưới ${escapeHtml(league.viName.toLowerCase())}, top ghi bàn ${escapeHtml(slug)}, top scorer ${escapeHtml(league.name.toLowerCase())}">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/top-ghi-ban">Top ghi bàn</a> &rsaquo; <span>${escapeHtml(league.viName)}</span></nav>

    <div class="hero">
      <h1>👟 Vua Phá Lưới ${escapeHtml(league.name)}${escapeHtml(seasonStr)}</h1>
      <div class="meta">${escapeHtml(league.country)} · Top ${scorers.length || 0} cầu thủ ghi bàn nhiều nhất</div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>Bảng xếp hạng vua phá lưới</h2>
          ${renderTable(scorers)}
        </div>

        <div class="card">
          <h2>Về cuộc đua vua phá lưới ${escapeHtml(league.name)}</h2>
          ${top1 ? `<p><strong>${escapeHtml(top1.name)}</strong> (${escapeHtml(top1.teamName)}) hiện dẫn đầu danh sách ghi bàn ${escapeHtml(league.name)} mùa ${seasonStr.trim()} với <strong>${top1.goals} bàn thắng</strong> sau ${top1.appearances} trận. ${scorers[1] ? `Theo sau là ${escapeHtml(scorers[1].name)} (${scorers[1].goals} bàn).` : ''}</p>` : ''}
          <p>Bảng xếp hạng cập nhật sau mỗi vòng đấu. Click tên đội để xem trang riêng và phân tích phong độ.</p>
          <p>Xem thêm: <a href="/bang-xep-hang/${slug}">BXH ${escapeHtml(league.viName)}</a> · <a href="/lich-thi-dau/${slug}">Lịch ${escapeHtml(league.viName)}</a> · <a href="/ket-qua-bong-da/${slug}">Kết quả ${escapeHtml(league.viName)}</a></p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '👟' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">👟 Top ghi bàn giải khác</div>
          ${otherLeaguesHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/bang-xep-hang/${slug}">BXH ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/lich-thi-dau/${slug}">Lịch ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/ket-qua-bong-da/${slug}">Kết quả ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/cau-thu">Cầu thủ Việt Nam</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=10800'); // 3h — same window where data shifts after a matchday
  res.send(html);
});

router.get('/top-ghi-ban', async (req, res) => {
  const url = `${SITE_URL}/top-ghi-ban`;
  const title = 'Top Ghi Bàn - Vua Phá Lưới Các Giải Đấu Hàng Đầu';
  const description = 'Bảng xếp hạng vua phá lưới các giải đấu lớn: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, V.League. Cập nhật sau từng vòng.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Top ghi bàn', item: url },
    ],
  };

  const cardsHtml = LEAGUES.map(l => `
    <a href="/top-ghi-ban/${l.slug}" class="card" style="display:block;text-decoration:none;padding:16px;margin-bottom:0">
      <h2 style="font-size:16px;margin-bottom:4px;border:0;padding:0">👟 ${escapeHtml(l.name)}</h2>
      <div style="font-size:12px;color:#64748b">${escapeHtml(l.country)} · Vua phá lưới mùa hiện tại</div>
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Top ghi bàn</span></nav>
    <div class="hero">
      <h1>👟 Top Ghi Bàn Bóng Đá</h1>
      <div class="meta">Cuộc đua vua phá lưới tại các giải đấu hàng đầu — chọn giải để xem chi tiết.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">${cardsHtml}</div>
    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '👟' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

module.exports = router;
