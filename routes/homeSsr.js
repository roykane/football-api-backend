/**
 * Homepage + /live SSR — full HTML for crawlers.
 *
 * Why: pre-batch verification showed the SPA shell is what Googlebot sees on
 * `/`, the most-crawled URL of the entire site, and `/live`, the page that
 * targets the highest-volume keyword ("livescore" / "tỷ số trực tiếp"). Both
 * need real content for Google to surface anything beyond a brand snippet.
 *
 * Strategy: render today's MatchCache fixtures + the most-recent published
 * articles. Both are already kept warm by other parts of the system, so the
 * SSR adds no new database load that wasn't already there.
 */

const express = require('express');
const router = express.Router();
const MatchCache = require('../models/MatchCache');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const Article = require('../models/Article');
const siteHeader = require('../utils/siteHeader');
const { LEAGUES } = require('../utils/leagueSlugs');
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
    .layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}.main{min-width:0}
    .hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:24px 20px;border-radius:8px;margin-bottom:16px}
    .hero h1{font-size:28px;font-weight:800;margin-bottom:6px;line-height:1.2}
    .hero .meta{font-size:14px;color:#cbd5e1}
    .hero .quick{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    .hero .quick a{background:rgba(255,255,255,0.15);color:#fff;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600}
    .hero .quick a:hover{background:rgba(251,191,36,0.3);text-decoration:none}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #eff6ff}
    .card p{margin-bottom:10px;color:#334155;font-size:15px;line-height:1.7}
    .day-group{margin-bottom:16px}
    .day-header{font-size:14px;font-weight:700;color:#1e3a8a;background:#eff6ff;padding:8px 12px;border-radius:6px;margin-bottom:8px}
    .match{display:grid;grid-template-columns:55px 1fr 60px 1fr 50px;gap:8px;align-items:center;padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:14px}
    .match:last-child{border-bottom:none}
    .match-time{color:#0066FF;font-weight:700;text-align:center;font-size:13px}
    .match-status{color:#94a3b8;font-size:11px;text-align:center}
    .match-team{display:flex;align-items:center;gap:6px;min-width:0}
    .match-team.away{justify-content:flex-end;text-align:right}
    .match-team a{color:#0f172a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .match-team img{width:20px;height:20px;object-fit:contain;flex-shrink:0}
    .match-score{font-weight:800;color:#0f172a;text-align:center;background:#f8fafc;border-radius:4px;padding:4px 0}
    .match-score.live{background:#fee2e2;color:#dc2626}
    .article-row{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9}
    .article-row:last-child{border-bottom:none}
    .article-row img{width:96px;height:64px;object-fit:cover;border-radius:6px;flex-shrink:0;background:#f1f5f9}
    .article-row .title{font-size:15px;font-weight:700;color:#0f172a;line-height:1.4;margin-bottom:4px}
    .article-row .title a{color:#0f172a}
    .article-row .meta{font-size:12px;color:#64748b}
    .league-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:8px}
    .league-grid a{display:block;background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px;font-size:14px;font-weight:600;color:#0f172a}
    .league-grid a:hover{background:#eff6ff;border-color:#1e3a8a;text-decoration:none}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .empty{text-align:center;padding:24px;color:#94a3b8;font-size:14px}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}.sidebar{order:2}}
    @media(max-width:768px){
      .hero h1{font-size:22px}
      .match{grid-template-columns:45px 1fr 50px 1fr;font-size:12px}
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
  const isLive = match.matchStatus === 'live';
  const isFinished = match.matchStatus === 'finished';
  const status = match.statusCode || (isFinished ? 'FT' : isLive ? 'LIVE' : 'TBD');

  const slug = buildMatchSlug(homeName, awayName, match.matchDate);
  const matchUrl = slug ? `/tran-dau/${slug}` : `/tran-dau/${match.fixtureId}`;

  const score = (isFinished || isLive) && (homeGoals != null && awayGoals != null)
    ? `<a href="${matchUrl}" class="match-score${isLive ? ' live' : ''}">${homeGoals} - ${awayGoals}</a>`
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

function groupByDay(matches) {
  const groups = new Map();
  for (const m of matches) {
    const key = dayKey(m.matchDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderMatchesByDay(matches, emptyMsg) {
  if (!matches.length) return `<div class="empty">${emptyMsg}</div>`;
  const groups = groupByDay(matches);
  return groups.map(([key, arr]) => `
    <div class="day-group">
      <div class="day-header">${dayLabel(key)}</div>
      ${arr.map(m => renderMatchRow(m)).join('')}
    </div>
  `).join('');
}

async function loadHomepageData() {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowEnd = new Date(todayStart.getTime() + 48 * 3600 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);

  const [todayMatches, recentResults, hotArticles, latestNews] = await Promise.all([
    MatchCache.find({
      matchDate: { $gte: todayStart, $lte: tomorrowEnd },
    }).sort({ matchDate: 1 }).limit(20).lean().catch(() => []),
    MatchCache.find({
      matchDate: { $gte: yesterdayStart, $lte: todayStart },
      matchStatus: 'finished',
    }).sort({ matchDate: -1 }).limit(10).lean().catch(() => []),
    SoiKeoArticle.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('slug title thumbnail createdAt matchInfo')
      .lean().catch(() => []),
    Article.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('slug title thumbnail category createdAt')
      .lean().catch(() => []),
  ]);

  return { todayMatches, recentResults, hotArticles, latestNews };
}

function renderArticleRow(article, prefix) {
  const url = `/${prefix}/${article.slug}`;
  const thumb = article.thumbnail || `${SITE_URL}/og-image.jpg`;
  return `<div class="article-row">
    <a href="${url}"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(article.title)}" loading="lazy"></a>
    <div>
      <div class="title"><a href="${url}">${escapeHtml(article.title)}</a></div>
      <div class="meta">${formatDateVi(article.createdAt)}</div>
    </div>
  </div>`;
}

router.get('/', async (req, res) => {
  const { todayMatches, recentResults, hotArticles, latestNews } = await loadHomepageData();
  const url = SITE_URL;
  const dates = getEntityDates({});

  const orgSchema = {
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'ScoreLine', url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    description: 'ScoreLine.io — tỷ số trực tiếp, lịch thi đấu, kết quả, BXH và nhận định bóng đá.',
    sameAs: [],
  };
  const websiteSchema = {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: 'ScoreLine', url: SITE_URL,
    inLanguage: 'vi-VN',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const og = pickOgImage({}, { alt: 'ScoreLine - Tỷ số trực tiếp bóng đá' });

  const leagueGrid = LEAGUES.map(l => `<a href="/giai-dau/${l.slug}">🏆 ${escapeHtml(l.viName)}</a>`).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ScoreLine - Tỷ Số Trực Tiếp, Lịch Thi Đấu, BXH Bóng Đá</title>
  <meta name="description" content="ScoreLine.io: tỷ số trực tiếp, lịch thi đấu, kết quả, bảng xếp hạng và nhận định bóng đá. Cập nhật real-time các giải đấu hàng đầu thế giới và Việt Nam.">
  <meta name="keywords" content="tỷ số trực tiếp, livescore, lịch thi đấu bóng đá, bảng xếp hạng, nhận định bóng đá, kết quả bóng đá">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="ScoreLine - Tỷ Số Trực Tiếp, Lịch Thi Đấu, BXH Bóng Đá">
  <meta property="og:description" content="Tỷ số trực tiếp, lịch thi đấu, kết quả, bảng xếp hạng và nhận định bóng đá các giải đấu hàng đầu thế giới và Việt Nam.">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(websiteSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <div class="hero">
      <h1>⚽ Tỷ Số Trực Tiếp & Bóng Đá Hôm Nay</h1>
      <div class="meta">Cập nhật real-time tỷ số, lịch thi đấu, BXH và nhận định các giải đấu hàng đầu — từ Ngoại Hạng Anh, La Liga đến V.League và World Cup 2026.</div>
      <div class="quick">
        <a href="/live">📺 Live</a>
        <a href="/lich-thi-dau">📅 Lịch thi đấu</a>
        <a href="/ket-qua-bong-da">✅ Kết quả</a>
        <a href="/bang-xep-hang">📊 BXH</a>
        <a href="/nhan-dinh">🎯 Nhận định</a>
        <a href="/world-cup-2026">🌍 World Cup 2026</a>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        <div class="card">
          <h2>⚽ Lịch thi đấu hôm nay</h2>
          ${renderMatchesByDay(todayMatches, 'Chưa có lịch thi đấu cho hôm nay. Xem <a href="/lich-thi-dau">Lịch thi đấu đầy đủ</a>.')}
          <p style="margin-top:10px"><a href="/lich-thi-dau">Xem lịch thi đấu đầy đủ →</a></p>
        </div>

        ${recentResults.length ? `<div class="card">
          <h2>✅ Kết quả gần nhất</h2>
          ${recentResults.map(m => renderMatchRow(m)).join('')}
          <p style="margin-top:10px"><a href="/ket-qua-bong-da">Xem tất cả kết quả →</a></p>
        </div>` : ''}

        ${hotArticles.length ? `<div class="card">
          <h2>🎯 Nhận định mới nhất</h2>
          ${hotArticles.map(a => renderArticleRow(a, 'nhan-dinh')).join('')}
          <p style="margin-top:10px"><a href="/nhan-dinh">Xem tất cả nhận định →</a></p>
        </div>` : ''}

        ${latestNews.length ? `<div class="card">
          <h2>📰 Tin tức bóng đá</h2>
          ${latestNews.map(a => renderArticleRow(a, a.category === 'transfer' ? 'chuyen-nhuong' : a.category === 'analysis' ? 'phan-tich' : 'tin-bong-da')).join('')}
          <p style="margin-top:10px"><a href="/tin-bong-da">Xem tin tức bóng đá đầy đủ →</a></p>
        </div>` : ''}

        <div class="card">
          <h2>🏆 Các giải đấu</h2>
          <p>Theo dõi BXH, lịch thi đấu, kết quả và top ghi bàn các giải đấu hàng đầu thế giới và Việt Nam:</p>
          <div class="league-grid">${leagueGrid}</div>
        </div>
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/live">📺 Tỷ số trực tiếp</a>
          <a class="sidebar-link" href="/lich-thi-dau">📅 Lịch thi đấu hôm nay</a>
          <a class="sidebar-link" href="/ket-qua-bong-da">✅ Kết quả mới nhất</a>
          <a class="sidebar-link" href="/bang-xep-hang">📊 Bảng xếp hạng</a>
          <a class="sidebar-link" href="/top-ghi-ban">👟 Top ghi bàn</a>
          <a class="sidebar-link" href="/thong-ke">📈 Thống kê mùa giải</a>
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">⭐ Chuyên mục</div>
          <a class="sidebar-link" href="/nhan-dinh">🎯 Nhận định bóng đá</a>
          <a class="sidebar-link" href="/tin-bong-da">📰 Tin tức</a>
          <a class="sidebar-link" href="/chuyen-nhuong">💼 Chuyển nhượng</a>
          <a class="sidebar-link" href="/phan-tich">🔍 Phân tích chuyên sâu</a>
          <a class="sidebar-link" href="/cau-thu">⚽ Cầu thủ Việt Nam</a>
          <a class="sidebar-link" href="/huan-luyen-vien">👔 Huấn luyện viên</a>
          <a class="sidebar-link" href="/kien-thuc-bong-da">📚 Kiến thức bóng đá</a>
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🌍 Sự kiện đặc biệt</div>
          <a class="sidebar-link" href="/world-cup-2026">🏆 World Cup 2026</a>
          <a class="sidebar-link" href="/world-cup-2026/doi-tuyen-viet-nam">🇻🇳 ĐT Việt Nam WC 2026</a>
        </div>
      </aside>
    </div>

    ${authorByline({ publishedIso: dates.datePublished, modifiedIso: dates.dateModified, icon: '⚽', bio: 'Đội ngũ biên tập ScoreLine cập nhật tỷ số, kết quả, lịch thi đấu real-time từ API-Sports và các nguồn chính thức như FIFA, AFC, VFF. Bài nhận định và phân tích được biên tập viên kiểm chứng dữ liệu trước khi xuất bản.' })}

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá<br><a href="/about">Giới thiệu</a> · <a href="/privacy">Bảo mật</a> · <a href="/terms">Điều khoản</a> · <a href="/help">Trợ giúp</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=600'); // 10 min — homepage data changes through the day
  res.send(html);
});

router.get('/live', async (req, res) => {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  let liveMatches = [];
  let todayUpcoming = [];
  let todayFinished = [];
  try {
    const [live, upcoming, finished] = await Promise.all([
      MatchCache.find({ matchStatus: 'live' }).sort({ matchDate: 1 }).limit(40).lean(),
      MatchCache.find({
        matchDate: { $gte: now, $lte: dayEnd },
        matchStatus: { $in: ['scheduled', 'live'] },
      }).sort({ matchDate: 1 }).limit(40).lean(),
      MatchCache.find({
        matchDate: { $gte: dayStart, $lte: now },
        matchStatus: 'finished',
      }).sort({ matchDate: -1 }).limit(40).lean(),
    ]);
    liveMatches = live;
    todayUpcoming = upcoming.filter(u => u.matchStatus !== 'live');
    todayFinished = finished;
  } catch (err) { /* graceful empty */ }

  const url = `${SITE_URL}/live`;
  const dates = getEntityDates({});
  const og = pickOgImage({}, { alt: 'Tỷ số trực tiếp bóng đá' });

  const totalLive = liveMatches.length;
  const total = totalLive + todayUpcoming.length + todayFinished.length;

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tỷ số trực tiếp', item: url },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tỷ Số Trực Tiếp Bóng Đá Hôm Nay - Livescore | ScoreLine</title>
  <meta name="description" content="${totalLive > 0 ? `${totalLive} trận đang diễn ra trực tiếp` : 'Tỷ số trực tiếp bóng đá hôm nay'} — cập nhật real-time tỷ số, kết quả các giải Ngoại Hạng Anh, La Liga, Champions League, V.League.">
  <meta name="keywords" content="tỷ số trực tiếp, livescore, kết quả bóng đá hôm nay, lịch thi đấu hôm nay, score bóng đá">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="Tỷ Số Trực Tiếp Bóng Đá Hôm Nay - Livescore">
  <meta property="og:description" content="${totalLive > 0 ? `${totalLive} trận đang đá trực tiếp.` : ''} Tỷ số real-time các giải đấu hàng đầu.">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Tỷ số trực tiếp</span></nav>

    <div class="hero">
      <h1>📺 Tỷ Số Trực Tiếp Bóng Đá Hôm Nay</h1>
      <div class="meta">${total > 0 ? `${total} trận hôm nay · ${totalLive} đang đá trực tiếp · ${todayFinished.length} đã đấu xong · ${todayUpcoming.length} sắp đá` : 'Hiện chưa có trận nào trong ngày — xem lịch thi đấu sắp tới bên dưới.'}</div>
    </div>

    <div class="layout">
      <div class="main">
        ${liveMatches.length ? `<div class="card">
          <h2>🔴 Đang đá trực tiếp (${liveMatches.length})</h2>
          ${liveMatches.map(m => renderMatchRow(m)).join('')}
        </div>` : ''}

        ${todayUpcoming.length ? `<div class="card">
          <h2>⏰ Sắp diễn ra hôm nay (${todayUpcoming.length})</h2>
          ${todayUpcoming.map(m => renderMatchRow(m)).join('')}
        </div>` : ''}

        ${todayFinished.length ? `<div class="card">
          <h2>✅ Đã kết thúc hôm nay (${todayFinished.length})</h2>
          ${todayFinished.map(m => renderMatchRow(m)).join('')}
        </div>` : ''}

        ${total === 0 ? `<div class="card">
          <p>Hôm nay chưa có trận đấu nào được lên lịch trong các giải đấu ScoreLine theo dõi.</p>
          <p>Xem <a href="/lich-thi-dau">Lịch thi đấu</a> để biết các trận sắp tới, hoặc <a href="/ket-qua-bong-da">Kết quả</a> để xem các trận gần đây.</p>
        </div>` : ''}

        <div class="card">
          <h2>Về tỷ số trực tiếp ScoreLine</h2>
          <p>Tỷ số trên trang này được đồng bộ từ API-Sports với độ trễ thường dưới 30 giây so với thực tế. Bao gồm các giải đấu lớn: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, World Cup, V.League và một số giải khu vực.</p>
          <p>Click vào tên đội bóng để xem trang riêng (lịch thi đấu, BXH, phong độ). Click vào tỷ số để xem chi tiết trận đấu (lineup, sự kiện ghi bàn, thẻ phạt, tỷ lệ kèo).</p>
          <p>Để biết các trận sắp diễn ra: <a href="/lich-thi-dau">Lịch thi đấu</a>. Để xem kết quả các ngày trước: <a href="/ket-qua-bong-da">Kết quả</a>. Phân tích trước trận: <a href="/nhan-dinh">Nhận định</a>.</p>
        </div>

        ${authorByline({ publishedIso: dates.datePublished, modifiedIso: dates.dateModified, icon: '📺' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/lich-thi-dau">📅 Lịch thi đấu</a>
          <a class="sidebar-link" href="/ket-qua-bong-da">✅ Kết quả mới nhất</a>
          <a class="sidebar-link" href="/bang-xep-hang">📊 Bảng xếp hạng</a>
          <a class="sidebar-link" href="/top-ghi-ban">👟 Top ghi bàn</a>
          <a class="sidebar-link" href="/nhan-dinh">🎯 Nhận định</a>
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🏆 Theo giải đấu</div>
          ${LEAGUES.slice(0, 6).map(l => `<a class="sidebar-link" href="/giai-dau/${l.slug}">${escapeHtml(l.viName)}</a>`).join('')}
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=60'); // 1 min — live data shifts every minute
  res.send(html);
});

module.exports = router;
