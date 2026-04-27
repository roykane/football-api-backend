/**
 * Stats SSR — bot-only HTML for /thong-ke
 *
 * Cross-league overview: highest-scoring league, most-points-leading team
 * across the top divisions, biggest goal difference. The page acts as a
 * statistics landing surface that stitches together the per-league hubs.
 */

const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const siteHeader = require('../utils/siteHeader');
const { LEAGUES } = require('../utils/leagueSlugs');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

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
    .hero{background:linear-gradient(135deg,#581c87,#7e22ce);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px}
    .hero h1{font-size:24px;font-weight:800;margin-bottom:4px}
    .hero .meta{font-size:13px;color:#e9d5ff}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #f3e8ff}
    .card p{margin-bottom:10px;color:#334155;font-size:15px}
    .stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
    .stat-card{background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:14px;text-align:center}
    .stat-card .num{font-size:28px;font-weight:800;color:#7e22ce;display:block;margin-bottom:4px}
    .stat-card .label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.3px}
    .stat-card a{color:#7e22ce;font-size:13px;font-weight:600;display:inline-block;margin-top:6px}
    .table{width:100%;border-collapse:collapse;font-size:13px}
    .table th,.table td{padding:8px;text-align:center;border-bottom:1px solid #f1f5f9}
    .table th{background:#faf5ff;color:#581c87;font-weight:700;font-size:11px;text-transform:uppercase}
    .table td.team{text-align:left;font-weight:600;color:#0f172a}
    .table td.team img{width:18px;height:18px;vertical-align:middle;margin-right:4px;object-fit:contain}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .hero h1{font-size:20px}
    }
  `;
}

function aggregateLeague(teams) {
  let totalGoals = 0, totalGames = 0;
  let leader = null, mostGoals = null, bestDiff = null;
  for (const t of teams) {
    const s = t.standings || {};
    totalGoals += (s.goalsFor || 0);
    totalGames += (s.played || 0);
    if (!leader || (s.points || 0) > (leader.standings?.points || 0)) leader = t;
    if (!mostGoals || (s.goalsFor || 0) > (mostGoals.standings?.goalsFor || 0)) mostGoals = t;
    if (!bestDiff || (s.goalsDiff || 0) > (bestDiff.standings?.goalsDiff || 0)) bestDiff = t;
  }
  // played counts both legs of each fixture, so divide by 2 for actual matches
  const matchesPlayed = totalGames / 2;
  const avgGoals = matchesPlayed > 0 ? (totalGoals / matchesPlayed).toFixed(2) : '-';
  return { teams, leader, mostGoals, bestDiff, totalGoals, matchesPlayed, avgGoals };
}

router.get('/thong-ke', async (req, res) => {
  // For each league we have actual sync coverage for, pull aggregate stats.
  const slugsWithData = ['premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1'];
  const leagueStats = [];
  for (const slug of slugsWithData) {
    const league = LEAGUES.find(l => l.slug === slug);
    if (!league) continue;
    let teams = [];
    try {
      teams = await Team.find({ 'league.slug': slug })
        .sort({ 'standings.rank': 1 })
        .select('slug name logo standings')
        .lean();
    } catch { teams = []; }
    if (teams.length) leagueStats.push({ league, ...aggregateLeague(teams) });
  }

  const url = `${SITE_URL}/thong-ke`;
  const title = 'Thống Kê Bóng Đá - Số Liệu Mùa Giải Top 5 Châu Âu';
  const description = 'Thống kê tổng hợp bóng đá: đội điểm cao nhất, ghi bàn nhiều nhất, hiệu số tốt nhất tại Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1.';

  const { datePublished, dateModified } = getEntityDates({});
  const og = pickOgImage({}, { alt: title });
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Thống kê', item: url },
    ],
  };

  const sectionsHtml = leagueStats.length === 0
    ? '<div class="card"><p style="color:#94a3b8">Số liệu thống kê đang được cập nhật.</p></div>'
    : leagueStats.map(({ league, leader, mostGoals, bestDiff, totalGoals, matchesPlayed, avgGoals, teams }) => {
        const top5 = teams.slice(0, 5);
        const top5Html = `<table class="table">
          <thead><tr><th>#</th><th style="text-align:left">Đội</th><th>Trận</th><th>Điểm</th><th>HS</th></tr></thead>
          <tbody>${top5.map(t => {
            const s = t.standings || {};
            return `<tr>
              <td>${s.rank ?? '-'}</td>
              <td class="team"><a href="/doi-bong/${escapeHtml(t.slug)}">${t.logo ? `<img src="${escapeHtml(t.logo)}" alt="${escapeHtml(t.name)}" loading="lazy">` : ''}${escapeHtml(t.name)}</a></td>
              <td>${s.played ?? '-'}</td>
              <td><strong>${s.points ?? '-'}</strong></td>
              <td>${typeof s.goalsDiff === 'number' ? (s.goalsDiff > 0 ? `+${s.goalsDiff}` : s.goalsDiff) : '-'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>`;

        return `<div class="card">
          <h2>📊 ${escapeHtml(league.name)}</h2>
          <div class="stat-grid">
            <div class="stat-card">
              <span class="num">${matchesPlayed > 0 ? Math.round(matchesPlayed) : '-'}</span>
              <span class="label">Trận đã đấu</span>
            </div>
            <div class="stat-card">
              <span class="num">${totalGoals}</span>
              <span class="label">Tổng bàn thắng</span>
            </div>
            <div class="stat-card">
              <span class="num">${avgGoals}</span>
              <span class="label">Bàn / trận</span>
            </div>
            <div class="stat-card">
              <span class="num" style="font-size:18px">${leader ? escapeHtml(leader.name) : '-'}</span>
              <span class="label">Dẫn đầu BXH</span>
              ${leader ? `<a href="/doi-bong/${escapeHtml(leader.slug)}">Xem CLB →</a>` : ''}
            </div>
            <div class="stat-card">
              <span class="num" style="font-size:18px">${mostGoals ? escapeHtml(mostGoals.name) : '-'}</span>
              <span class="label">Ghi nhiều nhất (${mostGoals?.standings?.goalsFor ?? 0})</span>
              ${mostGoals ? `<a href="/doi-bong/${escapeHtml(mostGoals.slug)}">Xem CLB →</a>` : ''}
            </div>
            <div class="stat-card">
              <span class="num" style="font-size:18px">${bestDiff ? escapeHtml(bestDiff.name) : '-'}</span>
              <span class="label">Hiệu số tốt nhất (${typeof bestDiff?.standings?.goalsDiff === 'number' ? (bestDiff.standings.goalsDiff > 0 ? `+${bestDiff.standings.goalsDiff}` : bestDiff.standings.goalsDiff) : 0})</span>
              ${bestDiff ? `<a href="/doi-bong/${escapeHtml(bestDiff.slug)}">Xem CLB →</a>` : ''}
            </div>
          </div>
          <div style="margin-top:14px">
            <h3 style="font-size:15px;margin-bottom:8px;color:#0f172a">Top 5 đội ${escapeHtml(league.viName)}</h3>
            ${top5Html}
            <p style="margin-top:8px;font-size:13px"><a href="/bang-xep-hang/${escapeHtml(league.slug)}">Xem bảng xếp hạng đầy đủ →</a> · <a href="/top-ghi-ban/${escapeHtml(league.slug)}">Top ghi bàn →</a></p>
          </div>
        </div>`;
      }).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="thống kê bóng đá, số liệu mùa giải, top 5 châu âu, ngoại hạng anh, la liga">
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
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Thống kê</span></nav>
    <div class="hero">
      <h1>📊 Thống Kê Bóng Đá</h1>
      <div class="meta">Số liệu mùa giải hiện tại các giải đấu hàng đầu — cập nhật theo dữ liệu BXH.</div>
    </div>

    <div class="layout">
      <div class="main">
        ${sectionsHtml}
        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '📊' })}
      </div>
      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          <a class="sidebar-link" href="/bang-xep-hang">Tất cả BXH</a>
          <a class="sidebar-link" href="/top-ghi-ban">Top ghi bàn các giải</a>
          <a class="sidebar-link" href="/giai-dau">Tất cả giải đấu</a>
          <a class="sidebar-link" href="/lich-thi-dau">Lịch thi đấu</a>
        </div>
      </aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

module.exports = router;
