/**
 * Fixtures + Results SSR — bot-only HTML for /lich-thi-dau/:slug and
 * /ket-qua-bong-da/:slug.
 *
 * Same data shape (MatchCache documents) — just split by date pivot:
 *   /lich-thi-dau/:slug → matches in [now, now+14d], status scheduled
 *   /ket-qua-bong-da/:slug → matches in [now-30d, now], status finished
 *
 * Bot UA only — browser path falls through to the Vite SPA via nginx.
 */

const express = require('express');
const router = express.Router();
const MatchCache = require('../models/MatchCache');
const siteHeader = require('../utils/siteHeader');
const { getLeagueBySlug, LEAGUES } = require('../utils/leagueSlugs');
const { buildMatchSlug } = require('../utils/matchSlug');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL, formatDateVi } = require('../utils/seoCommon');

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
    .hero{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px}
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px;line-height:1.2}
    .hero .meta{font-size:13px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #eff6ff}
    .day-group{margin-bottom:16px}
    .day-header{font-size:14px;font-weight:700;color:#1e3a8a;background:#eff6ff;padding:8px 12px;border-radius:6px;margin-bottom:8px}
    .match{display:grid;grid-template-columns:60px 1fr 60px 1fr 60px;gap:8px;align-items:center;padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:14px}
    .match:last-child{border-bottom:none}
    .match-time{color:#0066FF;font-weight:700;text-align:center;font-size:13px}
    .match-status{color:#94a3b8;font-size:11px;text-align:center}
    .match-team{display:flex;align-items:center;gap:6px;min-width:0}
    .match-team.away{justify-content:flex-end;text-align:right}
    .match-team a{color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .match-team img{width:20px;height:20px;object-fit:contain;flex-shrink:0}
    .match-score{font-weight:800;color:#0f172a;text-align:center;background:#f8fafc;border-radius:4px;padding:4px 0}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    .empty{text-align:center;padding:32px;color:#94a3b8;font-size:14px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .hero h1{font-size:20px}
      .match{grid-template-columns:50px 1fr 50px 1fr;font-size:12px}
      .match-status{display:none}
      .match-team img{display:none}
    }
  `;
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][date.getUTCDay()];
  return `${dow}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function groupByDay(matches) {
  const groups = new Map();
  for (const m of matches) {
    const key = dayKey(m.matchDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderMatchRow(match, mode) {
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
  const status = match.statusCode || (mode === 'results' ? 'FT' : 'TBD');

  const slug = buildMatchSlug(homeName, awayName, match.matchDate);
  const matchUrl = slug ? `/tran-dau/${slug}` : `/tran-dau/${match.fixtureId}`;

  const score = mode === 'results' && (homeGoals != null && awayGoals != null)
    ? `<a href="${matchUrl}" class="match-score">${homeGoals} - ${awayGoals}</a>`
    : `<a href="${matchUrl}" class="match-score">vs</a>`;

  return `<div class="match">
    <div class="match-time">${time}</div>
    <div class="match-team home">
      ${homeLogo ? `<img src="${escapeHtml(homeLogo)}" alt="${escapeHtml(homeName)}" loading="lazy">` : ''}
      <a href="${matchUrl}">${escapeHtml(homeName)}</a>
    </div>
    ${score}
    <div class="match-team away">
      <a href="${matchUrl}">${escapeHtml(awayName)}</a>
      ${awayLogo ? `<img src="${escapeHtml(awayLogo)}" alt="${escapeHtml(awayName)}" loading="lazy">` : ''}
    </div>
    <div class="match-status">${escapeHtml(status)}</div>
  </div>`;
}

async function renderListPage(req, res, mode /* 'fixtures' | 'results' */) {
  const slug = req.params.slug;
  const league = getLeagueBySlug(slug);
  if (!league) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy giải đấu | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/${mode === 'fixtures' ? 'lich-thi-dau' : 'ket-qua-bong-da'}">Quay lại</a></p></body></html>`);
  }

  const now = new Date();
  let matches = [];
  try {
    if (mode === 'fixtures') {
      const future = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
      matches = await MatchCache.find({
        leagueId: league.id,
        matchDate: { $gte: now, $lte: future },
      }).sort({ matchDate: 1 }).limit(80).lean();
    } else {
      const past = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      matches = await MatchCache.find({
        leagueId: league.id,
        matchDate: { $gte: past, $lte: now },
        matchStatus: 'finished',
      }).sort({ matchDate: -1 }).limit(80).lean();
    }
  } catch (err) { matches = []; }

  const isFixtures = mode === 'fixtures';
  const url = `${SITE_URL}/${isFixtures ? 'lich-thi-dau' : 'ket-qua-bong-da'}/${slug}`;
  const labelMain = isFixtures ? 'Lịch Thi Đấu' : 'Kết Quả';
  const title = `${labelMain} ${league.name} - Cập Nhật Mới Nhất`;
  const description = isFixtures
    ? `Lịch thi đấu ${league.viName} 14 ngày tới: giờ kick-off, sân vận động, đội đối đầu. ${matches.length} trận đã được lên lịch.`
    : `Kết quả ${league.viName} 30 ngày gần đây: tỷ số chung cuộc, đội ghi bàn, ${matches.length} trận đã đấu.`;

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: `${labelMain} ${league.name}` });

  const groups = groupByDay(matches);
  const groupsHtml = groups.length === 0
    ? `<div class="empty">${isFixtures ? `Chưa có lịch thi đấu ${league.viName} cho 14 ngày tới.` : `Chưa có kết quả ${league.viName} trong 30 ngày qua.`}</div>`
    : groups.map(([key, dayMatches]) => `
      <div class="day-group">
        <div class="day-header">${dayLabel(key)}</div>
        ${dayMatches.map(m => renderMatchRow(m, mode)).join('')}
      </div>
    `).join('');

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: labelMain, item: `${SITE_URL}/${isFixtures ? 'lich-thi-dau' : 'ket-qua-bong-da'}` },
      { '@type': 'ListItem', position: 3, name: league.name, item: url },
    ],
  };

  const otherLeagues = LEAGUES.filter(l => l.slug !== slug).slice(0, 8);
  const otherLeaguesHtml = otherLeagues.map(l => `<a class="sidebar-link" href="/${isFixtures ? 'lich-thi-dau' : 'ket-qua-bong-da'}/${l.slug}">${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${isFixtures ? 'lịch thi đấu' : 'kết quả'} ${escapeHtml(league.viName.toLowerCase())}, ${escapeHtml(slug)}, ${escapeHtml(league.name.toLowerCase())}">
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
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/${isFixtures ? 'lich-thi-dau' : 'ket-qua-bong-da'}">${labelMain}</a> &rsaquo;
      <span>${escapeHtml(league.viName)}</span>
    </nav>

    <div class="hero">
      <h1>${isFixtures ? '📅' : '✅'} ${escapeHtml(labelMain)} ${escapeHtml(league.name)}</h1>
      <div class="meta">${escapeHtml(league.country)} · ${matches.length} trận · ${isFixtures ? '14 ngày tới' : '30 ngày qua'}</div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>${isFixtures ? `Lịch ${escapeHtml(league.viName)}` : `Kết quả ${escapeHtml(league.viName)}`}</h2>
          ${groupsHtml}
        </div>

        <div class="card">
          <h2>Theo dõi ${escapeHtml(league.name)}</h2>
          <p>Trang ${labelMain.toLowerCase()} ${escapeHtml(league.name)} cập nhật theo lịch chính thức của giải đấu. Mỗi trận click vào để xem chi tiết, lineup, tỷ lệ kèo và phân tích phong độ đối đầu.</p>
          <p>Xem thêm: <a href="/bang-xep-hang/${slug}">Bảng xếp hạng ${escapeHtml(league.viName)}</a> · <a href="/${isFixtures ? 'ket-qua-bong-da' : 'lich-thi-dau'}/${slug}">${isFixtures ? 'Kết quả gần đây' : 'Lịch sắp tới'}</a> · <a href="/top-ghi-ban/${slug}">Top ghi bàn</a></p>
        </div>

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: isFixtures ? '📅' : '✅' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">${isFixtures ? '📅 Lịch giải khác' : '✅ Kết quả giải khác'}</div>
          ${otherLeaguesHtml}
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/bang-xep-hang/${slug}">BXH ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/top-ghi-ban/${slug}">Top ghi bàn ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/${isFixtures ? 'ket-qua-bong-da' : 'lich-thi-dau'}/${slug}">${isFixtures ? 'Kết quả' : 'Lịch'} ${escapeHtml(league.viName)}</a>
          <a class="sidebar-link" href="/giai-dau">Tất cả giải đấu</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=900'); // 15 min — schedules & results shift through the day
  res.send(html);
}

async function renderHubPage(req, res, mode) {
  const isFixtures = mode === 'fixtures';
  const url = `${SITE_URL}/${isFixtures ? 'lich-thi-dau' : 'ket-qua-bong-da'}`;
  const title = isFixtures
    ? 'Lịch Thi Đấu Bóng Đá - Top 5 Châu Âu, V.League, Cúp Quốc Tế'
    : 'Kết Quả Bóng Đá - Tỷ Số Trận Đấu Mới Nhất';
  const description = isFixtures
    ? 'Lịch thi đấu các giải bóng đá hàng đầu: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, V.League. Giờ kick-off, sân vận động, vòng đấu.'
    : 'Kết quả bóng đá mới nhất: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, V.League. Tỷ số chung cuộc, ghi bàn, thẻ phạt.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: isFixtures ? 'Lịch thi đấu' : 'Kết quả', item: url },
    ],
  };

  const cardsHtml = LEAGUES.map(l => `
    <a href="/${isFixtures ? 'lich-thi-dau' : 'ket-qua-bong-da'}/${l.slug}" class="card" style="display:block;text-decoration:none;padding:16px;margin-bottom:0">
      <h2 style="font-size:16px;margin-bottom:4px;border:0;padding:0">${isFixtures ? '📅' : '✅'} ${escapeHtml(l.name)}</h2>
      <div style="font-size:12px;color:#64748b">${escapeHtml(l.country)} · ${isFixtures ? 'Lịch thi đấu sắp tới' : 'Kết quả mới nhất'}</div>
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>${isFixtures ? 'Lịch thi đấu' : 'Kết quả'}</span></nav>
    <div class="hero">
      <h1>${isFixtures ? '📅 Lịch Thi Đấu Bóng Đá' : '✅ Kết Quả Bóng Đá'}</h1>
      <div class="meta">${isFixtures ? 'Lịch thi đấu cập nhật mỗi giờ — chọn giải đấu để xem chi tiết.' : 'Kết quả mới nhất từ các giải đấu lớn — chọn giải đấu để xem chi tiết.'}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">${cardsHtml}</div>
    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: isFixtures ? '📅' : '✅' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
}

router.get('/lich-thi-dau', (req, res) => renderHubPage(req, res, 'fixtures'));
router.get('/ket-qua-bong-da', (req, res) => renderHubPage(req, res, 'results'));
router.get('/lich-thi-dau/:slug', (req, res) => renderListPage(req, res, 'fixtures'));
router.get('/ket-qua-bong-da/:slug', (req, res) => renderListPage(req, res, 'results'));

module.exports = router;
