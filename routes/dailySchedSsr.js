/**
 * Daily fixtures SSR — bot-only HTML for /lich-thi-dau/ngay/:date
 *
 * Date format in the URL: YYYY-MM-DD (or 'hom-nay' / 'ngay-mai' / 'hom-qua').
 * Pulls all matches in the 24h window that day from MatchCache, groups by
 * league, and renders. Targets queries like "lịch bóng đá hôm nay",
 * "lịch bóng đá chủ nhật", "lịch ngày 27-04-2026".
 */

const express = require('express');
const router = express.Router();
const MatchCache = require('../models/MatchCache');
const siteHeader = require('../utils/siteHeader');
const { LEAGUES, getLeagueById } = require('../utils/leagueSlugs');
const { buildMatchSlug } = require('../utils/matchSlug');
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

// Parses an URL fragment into a UTC Date at the START of that day.
// Accepts:
//   YYYY-MM-DD       (canonical form)
//   hom-nay          (today)
//   ngay-mai         (tomorrow)
//   hom-qua          (yesterday)
function parseDateSlug(slug) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (slug === 'hom-nay') return todayUtc;
  if (slug === 'ngay-mai') return new Date(todayUtc.getTime() + 24 * 3600 * 1000);
  if (slug === 'hom-qua') return new Date(todayUtc.getTime() - 24 * 3600 * 1000);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slug);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

const VI_DOW = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function fmtDateLong(date) {
  const dow = VI_DOW[date.getUTCDay()];
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${dow}, ${d}/${m}/${y}`;
}
function fmtDateSlug(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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
    .nav-days{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    .nav-days a{padding:6px 12px;background:rgba(255,255,255,0.1);color:#fff;border-radius:6px;font-size:13px;font-weight:600}
    .nav-days a.current{background:rgba(251,191,36,0.25);color:#fbbf24}
    .card{background:#fff;border-radius:8px;padding:18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .league-block{margin-bottom:18px}
    .league-block:last-child{margin-bottom:0}
    .league-head{display:flex;align-items:center;gap:8px;background:#f8fafc;border-left:3px solid #fbbf24;padding:8px 12px;font-weight:700;color:#0f172a;font-size:14px;margin-bottom:6px;border-radius:0 6px 6px 0}
    .league-head a{color:#0f172a}
    .match{display:grid;grid-template-columns:55px 1fr 60px 1fr 50px;gap:8px;align-items:center;padding:9px 6px;border-bottom:1px solid #f1f5f9;font-size:14px}
    .match:last-child{border-bottom:none}
    .match-time{color:#0066FF;font-weight:700;text-align:center;font-size:13px}
    .match-status{color:#94a3b8;font-size:11px;text-align:center}
    .match-team{display:flex;align-items:center;gap:6px;min-width:0}
    .match-team.away{justify-content:flex-end;text-align:right}
    .match-team a{color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .match-team img{width:20px;height:20px;object-fit:contain;flex-shrink:0}
    .match-score{font-weight:800;color:#0f172a;text-align:center;background:#f8fafc;border-radius:4px;padding:4px 0}
    .match-score.live{background:#fee2e2;color:#dc2626}
    .empty{text-align:center;padding:32px;color:#94a3b8}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:7px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){
      .hero h1{font-size:18px}
      .match{grid-template-columns:45px 1fr 50px 1fr;font-size:12px}
      .match-status{display:none}
    }
  `;
}

function renderMatchRow(match) {
  const m = match.matchData || {};
  const home = m.homeTeam || m.teams?.home || {};
  const away = m.awayTeam || m.teams?.away || {};
  const homeName = home.name || '';
  const awayName = away.name || '';
  const homeLogo = home.logo || '';
  const awayLogo = away.logo || '';
  const homeGoals = m.homeScore ?? m.goals?.home ?? m.score?.home;
  const awayGoals = m.awayScore ?? m.goals?.away ?? m.score?.away;
  const dt = new Date(match.matchDate);
  const time = `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
  const isLive = match.matchStatus === 'live';
  const isFinished = match.matchStatus === 'finished';
  const status = match.statusCode || (isFinished ? 'FT' : isLive ? 'LIVE' : 'TBD');
  const slug = buildMatchSlug(homeName, awayName, match.matchDate);
  const matchUrl = slug ? `/tran-dau/${slug}` : `/tran-dau/${match.fixtureId}`;

  const score = (isFinished || isLive) && homeGoals != null && awayGoals != null
    ? `<a href="${matchUrl}" class="match-score${isLive ? ' live' : ''}">${homeGoals} - ${awayGoals}</a>`
    : `<a href="${matchUrl}" class="match-score">vs</a>`;

  return `<div class="match">
    <div class="match-time">${time}</div>
    <div class="match-team home">
      ${homeLogo ? `<img src="${escapeHtml(proxyImg(homeLogo))}" alt="${escapeHtml(homeName)}" loading="lazy">` : ''}
      <a href="${matchUrl}">${escapeHtml(homeName)}</a>
    </div>
    ${score}
    <div class="match-team away">
      <a href="${matchUrl}">${escapeHtml(awayName)}</a>
      ${awayLogo ? `<img src="${escapeHtml(proxyImg(awayLogo))}" alt="${escapeHtml(awayName)}" loading="lazy">` : ''}
    </div>
    <div class="match-status">${escapeHtml(status)}</div>
  </div>`;
}

router.get('/lich-thi-dau/ngay/:date', async (req, res) => {
  const slug = req.params.date;
  const date = parseDateSlug(slug);
  if (!date) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Ngày không hợp lệ | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p>Định dạng ngày không hợp lệ. Dùng <code>YYYY-MM-DD</code> hoặc <a href="/lich-thi-dau/ngay/hom-nay">hôm nay</a>.</p></body></html>`);
  }

  const dayStart = date;
  const dayEnd = new Date(date.getTime() + 24 * 3600 * 1000);
  const dateStr = fmtDateLong(date);
  const dateSlug = fmtDateSlug(date);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const isToday = date.getTime() === todayUtc.getTime();

  let matches = [];
  try {
    matches = await MatchCache.find({
      matchDate: { $gte: dayStart, $lte: dayEnd },
    }).sort({ leagueId: 1, matchDate: 1 }).limit(150).lean();
  } catch { matches = []; }

  // Group by league for cleaner UI
  const byLeague = new Map();
  for (const m of matches) {
    const lid = m.leagueId;
    if (!byLeague.has(lid)) byLeague.set(lid, { league: getLeagueById(lid) || { name: m.leagueName || 'Giải khác', slug: null }, items: [] });
    byLeague.get(lid).items.push(m);
  }
  // Sort leagues by our LEAGUES order, with unknown leagues at the end.
  const orderedGroups = [...byLeague.entries()].sort(([aId], [bId]) => {
    const aIdx = LEAGUES.findIndex(l => l.id === aId);
    const bIdx = LEAGUES.findIndex(l => l.id === bId);
    if (aIdx === -1 && bIdx === -1) return aId - bId;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const url = `${SITE_URL}/lich-thi-dau/ngay/${dateSlug}`;
  const title = isToday
    ? `Lịch Bóng Đá Hôm Nay (${dateStr}) - Tỷ Số & Giờ Đá`
    : `Lịch Bóng Đá ${dateStr} - Tất Cả Trận Đấu`;
  const description = matches.length > 0
    ? `${matches.length} trận đấu ${isToday ? 'hôm nay' : 'ngày ' + dateStr}: giờ kick-off, đội đối đầu, tỷ số trực tiếp các giải Ngoại Hạng Anh, La Liga, Champions League và nhiều giải khác.`
    : `Lịch thi đấu bóng đá ngày ${dateStr}. Cập nhật giờ đá, đội bóng và tỷ số real-time tại ScoreLine.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Lịch thi đấu', item: `${SITE_URL}/lich-thi-dau` },
      { '@type': 'ListItem', position: 3, name: dateStr, item: url },
    ],
  };

  const sectionsHtml = orderedGroups.length === 0
    ? `<div class="card"><div class="empty">Chưa có trận đấu nào trong ngày ${escapeHtml(dateStr)}. Xem <a href="/lich-thi-dau/ngay/hom-nay">hôm nay</a> hoặc <a href="/lich-thi-dau/ngay/ngay-mai">ngày mai</a>.</div></div>`
    : orderedGroups.map(([lid, group]) => `
      <div class="card">
        <div class="league-block">
          <div class="league-head">
            🏆 ${group.league.slug ? `<a href="/lich-thi-dau/${escapeHtml(group.league.slug)}">${escapeHtml(group.league.name)}</a>` : escapeHtml(group.league.name)}
            <span style="color:#94a3b8;font-weight:400;margin-left:auto;font-size:12px">${group.items.length} trận</span>
          </div>
          ${group.items.map(renderMatchRow).join('')}
        </div>
      </div>
    `).join('');

  // Day-navigation chips
  const yesterday = new Date(date.getTime() - 24 * 3600 * 1000);
  const tomorrow = new Date(date.getTime() + 24 * 3600 * 1000);
  const dayNav = `
    <a href="/lich-thi-dau/ngay/${fmtDateSlug(yesterday)}">← ${fmtDateLong(yesterday)}</a>
    <a href="/lich-thi-dau/ngay/hom-nay" class="${isToday ? 'current' : ''}">Hôm nay</a>
    <a href="/lich-thi-dau/ngay/${fmtDateSlug(tomorrow)}">${fmtDateLong(tomorrow)} →</a>
  `;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="lịch bóng đá ${escapeHtml(dateStr.toLowerCase())}, lịch thi đấu hôm nay, fixtures, lịch bóng đá hôm nay">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/lich-thi-dau">Lịch thi đấu</a> &rsaquo; <span>${escapeHtml(dateStr)}</span></nav>

    <div class="hero">
      <h1>📅 Lịch Bóng Đá ${escapeHtml(dateStr)}</h1>
      <div class="meta">${matches.length > 0 ? `${matches.length} trận đấu trên ${orderedGroups.length} giải` : 'Chưa có trận đấu trong ngày này'}</div>
      <div class="nav-days">${dayNav}</div>
    </div>

    <div class="layout">
      <div class="main">
        ${sectionsHtml}
        <div class="card">
          <h2 style="font-size:16px;margin-bottom:8px;color:#0f172a">Về lịch bóng đá ngày ${escapeHtml(dateStr)}</h2>
          <p style="font-size:14px;color:#475569;margin-bottom:8px">Trang này tổng hợp toàn bộ lịch thi đấu trong ngày từ các giải đấu lớn được ScoreLine theo dõi. Các trận được nhóm theo giải và sắp xếp theo giờ kick-off (UTC chuyển về múi giờ Việt Nam tự động trong app).</p>
          <p style="font-size:14px;color:#475569">Xem thêm: <a href="/lich-thi-dau">Lịch theo giải đấu</a> · <a href="/ket-qua-bong-da">Kết quả mới nhất</a> · <a href="/live">Tỷ số trực tiếp</a></p>
        </div>
        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '📅' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">📅 Lịch theo giải đấu</div>
          ${LEAGUES.slice(0, 8).map(l => `<a class="sidebar-link" href="/lich-thi-dau/${escapeHtml(l.slug)}">${escapeHtml(l.viName)}</a>`).join('')}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/live">📺 Tỷ số trực tiếp</a>
          <a class="sidebar-link" href="/ket-qua-bong-da">✅ Kết quả</a>
          <a class="sidebar-link" href="/bang-xep-hang">📊 BXH</a>
          <a class="sidebar-link" href="/nhan-dinh">🎯 Nhận định</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  // Cache shorter for today (live scores) than for past/future days.
  res.set('Cache-Control', isToday ? 'public, max-age=300' : 'public, max-age=3600');
  res.send(html);
});

module.exports = router;
