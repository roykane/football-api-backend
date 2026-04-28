/**
 * Stats SSR — bot-only HTML for /thong-ke (magazine-style infographic).
 *
 * Mirrors the SPA hub-page.tsx layout: dark hero with glowing ball,
 * one section per league with 6-card row (3 metric cards + 3 team
 * highlights), bottom feature strip.
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

function currentSeasonTag() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() < 7 ? y - 1 : y;
  return `${start}/${String(start + 1).slice(-2)}`;
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#e2e8f0;background:#0a0e1a;min-height:100vh}
    a{color:#94a3b8;text-decoration:none}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#94a3b8}

    /* HERO */
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes glow{0%,100%{filter:drop-shadow(0 0 24px rgba(59,130,246,0.5)) drop-shadow(0 0 48px rgba(251,191,36,0.3))}50%{filter:drop-shadow(0 0 36px rgba(59,130,246,0.7)) drop-shadow(0 0 72px rgba(251,191,36,0.5))}}
    .hero{position:relative;background:linear-gradient(135deg,#0a1628 0%,#1a2744 50%,#0f172a 100%);border-radius:14px;padding:36px 32px;margin-bottom:20px;overflow:hidden;border:1px solid rgba(251,191,36,0.25);min-height:200px;display:flex;align-items:center}
    .heroBg{position:absolute;inset:0;opacity:.35;background:radial-gradient(circle at 80% 50%,rgba(59,130,246,0.6) 0%,transparent 40%),radial-gradient(circle at 90% 50%,rgba(251,191,36,0.4) 0%,transparent 50%);pointer-events:none}
    .heroBall{position:absolute;right:-40px;top:50%;transform:translateY(-50%);font-size:200px;line-height:1;animation:float 4s ease-in-out infinite,glow 3s ease-in-out infinite;pointer-events:none}
    .heroContent{position:relative;z-index:1}
    .heroIcon{display:inline-block;font-size:32px;background:linear-gradient(135deg,#fbbf24,#f59e0b);width:50px;height:50px;border-radius:8px;text-align:center;line-height:50px;margin-right:14px;vertical-align:middle}
    .heroH1{display:inline;font-size:36px;font-weight:900;color:#fbbf24;letter-spacing:1px;text-transform:uppercase}
    .heroSub{margin-top:14px;font-size:15px;color:#cbd5e1;line-height:1.6;max-width:560px}
    .heroSub strong{color:#fbbf24}
    @media(max-width:768px){.hero{padding:24px 20px;min-height:140px}.heroH1{font-size:24px;letter-spacing:.5px}.heroIcon{width:40px;height:40px;font-size:24px;line-height:40px}.heroSub{font-size:13px}.heroBall{font-size:120px;right:-20px;opacity:.5}}
    @media(max-width:480px){.heroBall{display:none}}

    /* LEAGUE SECTION */
    .leagueSection{background:linear-gradient(180deg,rgba(15,23,42,0.6),rgba(10,14,26,0.6));border-radius:14px;padding:18px;margin-bottom:18px;border:1px solid rgba(99,102,241,0.18)}
    .leagueHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(99,102,241,0.2)}
    .leagueTitle{display:flex;align-items:center;gap:12px}
    .leagueIcon{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;flex-shrink:0;font-weight:800}
    .leagueName{font-size:18px;font-weight:900;color:#fff;letter-spacing:1px;text-transform:uppercase}
    .seasonTag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#cbd5e1;background:rgba(15,23,42,0.6);border:1px solid rgba(99,102,241,0.3);padding:6px 12px;border-radius:6px;letter-spacing:.5px}
    @media(max-width:480px){.leagueHeader{flex-direction:column;align-items:flex-start}.leagueName{font-size:15px}}

    /* 6-card row */
    .cardsGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
    @media(max-width:1280px){.cardsGrid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:640px){.cardsGrid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:380px){.cardsGrid{grid-template-columns:1fr}}
    .card{background:rgba(15,23,42,0.7);border:1px solid rgba(99,102,241,0.18);border-radius:10px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:200px;position:relative;overflow:hidden}
    .metricIcon{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;margin-bottom:14px}
    .metricIcon.purple{background:linear-gradient(135deg,#a78bfaaa,#a78bfa);box-shadow:0 6px 16px rgba(167,139,250,0.4)}
    .metricIcon.blue{background:linear-gradient(135deg,#3b82f6aa,#3b82f6);box-shadow:0 6px 16px rgba(59,130,246,0.4)}
    .metricIcon.teal{background:linear-gradient(135deg,#14b8a6aa,#14b8a6);box-shadow:0 6px 16px rgba(20,184,166,0.4)}
    .metricNum{font-size:36px;font-weight:900;line-height:1;letter-spacing:-1px;margin-bottom:6px}
    .metricNum.purple{color:#a78bfa;text-shadow:0 0 24px rgba(167,139,250,0.35)}
    .metricNum.blue{color:#3b82f6;text-shadow:0 0 24px rgba(59,130,246,0.35)}
    .metricNum.teal{color:#14b8a6;text-shadow:0 0 24px rgba(20,184,166,0.35)}
    .metricLabel{font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
    .spark{width:100%;height:32px;margin-top:auto;opacity:.5}

    /* Team highlight cards */
    .teamCard{border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:200px;position:relative;overflow:hidden}
    .teamCard.red{background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 50%,#0f172a 100%)}
    .teamCard.blue{background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 50%,#0f172a 100%)}
    .teamCard.green{background:linear-gradient(135deg,#14532d 0%,#15803d 50%,#0f172a 100%)}
    .teamCard::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,transparent,transparent 8px,rgba(255,255,255,0.04) 8px,rgba(255,255,255,0.04) 9px);pointer-events:none}
    .teamLogoFrame{width:64px;height:64px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));position:relative;z-index:1}
    .teamLogoFrame img{width:100%;height:100%;object-fit:contain}
    .teamName{font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.5px;line-height:1.2;margin-bottom:4px;position:relative;z-index:1;word-break:break-word}
    .teamLabel{font-size:10px;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:.5px;line-height:1.3;margin-bottom:auto;position:relative;z-index:1}
    .teamCta{margin-top:10px;display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.08);color:#fff;border-radius:5px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;text-decoration:none;position:relative;z-index:1}
    .teamCta.red{border:1px solid #fca5a5}.teamCta.red:hover{background:#fca5a5;color:#0a0e1a}
    .teamCta.blue{border:1px solid #93c5fd}.teamCta.blue:hover{background:#93c5fd;color:#0a0e1a}
    .teamCta.green{border:1px solid #86efac}.teamCta.green:hover{background:#86efac;color:#0a0e1a}

    /* Feature strip */
    .features{background:linear-gradient(180deg,rgba(15,23,42,0.6),rgba(10,14,26,0.8));border-radius:14px;padding:18px 24px;margin-top:20px;border:1px solid rgba(99,102,241,0.18);display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    @media(max-width:768px){.features{grid-template-columns:repeat(2,1fr);padding:16px}}
    @media(max-width:380px){.features{grid-template-columns:1fr}}
    .feat{display:flex;align-items:flex-start;gap:10px}
    .featIcon{width:32px;height:32px;border-radius:8px;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .featIcon.amber{background:rgba(251,191,36,0.13);border:1px solid rgba(251,191,36,0.4);color:#fbbf24}
    .featIcon.green{background:rgba(34,197,94,0.13);border:1px solid rgba(34,197,94,0.4);color:#22c55e}
    .featIcon.blue{background:rgba(59,130,246,0.13);border:1px solid rgba(59,130,246,0.4);color:#3b82f6}
    .featIcon.purple{background:rgba(167,139,250,0.13);border:1px solid rgba(167,139,250,0.4);color:#a78bfa}
    .featTitle{font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.5px;line-height:1;margin-bottom:4px}
    .featDesc{font-size:11px;color:#94a3b8;line-height:1.4}

    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
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
  const matchesPlayed = totalGames / 2;
  const avgGoals = matchesPlayed > 0 ? (totalGoals / matchesPlayed).toFixed(2) : '0';
  return { teams, leader, mostGoals, bestDiff, totalGoals, matchesPlayed, avgGoals };
}

const SPARK_PATH = 'M 0 24 L 10 20 L 20 22 L 30 14 L 40 18 L 50 8 L 60 12 L 70 6 L 80 10 L 90 4 L 100 7';

function sparkSvg(color) {
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none">
    <path d="${SPARK_PATH}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="${SPARK_PATH} L 100 28 L 0 28 Z" fill="${color}" fill-opacity="0.15" />
  </svg>`;
}

function barsSvg(color) {
  const heights = [12, 18, 8, 22, 14, 26, 10, 20, 16];
  const bars = heights.map((h, i) => `<rect x="${i * 11 + 2}" y="${28 - h}" width="8" height="${h}" fill="${color}" fill-opacity="0.6" rx="1" />`).join('');
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none">${bars}</svg>`;
}

router.get('/thong-ke', async (req, res) => {
  const slugsWithData = ['premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1'];
  const leagueStats = [];
  for (let i = 0; i < slugsWithData.length; i++) {
    const slug = slugsWithData[i];
    const league = LEAGUES.find(l => l.slug === slug);
    if (!league) continue;
    let teams = [];
    try {
      teams = await Team.find({ 'league.slug': slug })
        .sort({ 'standings.rank': 1 })
        .select('slug name logo standings')
        .lean();
    } catch { teams = []; }
    if (teams.length) leagueStats.push({ league, tier: i + 1, ...aggregateLeague(teams) });
  }

  const url = `${SITE_URL}/thong-ke`;
  const title = 'Thống Kê Bóng Đá - Số Liệu Mùa Giải Top 5 Châu Âu';
  const description = 'Thống kê tổng hợp bóng đá: đội điểm cao nhất, ghi bàn nhiều nhất, hiệu số tốt nhất tại Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Ligue 1.';
  const seasonTag = currentSeasonTag();

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
    ? '<div class="leagueSection"><div style="color:#94a3b8;text-align:center;padding:32px">Số liệu thống kê đang được cập nhật.</div></div>'
    : leagueStats.map(({ league, tier, leader, mostGoals, bestDiff, totalGoals, matchesPlayed, avgGoals }) => `
        <div class="leagueSection">
          <div class="leagueHeader">
            <div class="leagueTitle">
              <div class="leagueIcon">${tier}</div>
              <div class="leagueName">${escapeHtml(league.name)}</div>
            </div>
            <span class="seasonTag">📅 Mùa giải ${seasonTag}</span>
          </div>
          <div class="cardsGrid">
            <div class="card">
              <div class="metricIcon purple">🥅</div>
              <div class="metricNum purple">${matchesPlayed > 0 ? Math.round(matchesPlayed) : '-'}</div>
              <div class="metricLabel">Trận đã đấu</div>
              ${sparkSvg('#a78bfa')}
            </div>
            <div class="card">
              <div class="metricIcon blue">🏆</div>
              <div class="metricNum blue">${totalGoals}</div>
              <div class="metricLabel">Tổng bàn thắng</div>
              ${barsSvg('#3b82f6')}
            </div>
            <div class="card">
              <div class="metricIcon teal">⚽</div>
              <div class="metricNum teal">${avgGoals}</div>
              <div class="metricLabel">Bàn / trận</div>
              ${sparkSvg('#14b8a6')}
            </div>
            ${leader ? `
              <div class="teamCard red">
                <div class="teamLogoFrame">${leader.logo ? `<img src="${escapeHtml(leader.logo)}" alt="${escapeHtml(leader.name)}" loading="lazy">` : ''}</div>
                <div class="teamName">${escapeHtml(leader.name)}</div>
                <div class="teamLabel">Dẫn đầu BXH</div>
                <a href="/doi-bong/${escapeHtml(leader.slug)}" class="teamCta red">Xem CLB →</a>
              </div>
            ` : ''}
            ${mostGoals ? `
              <div class="teamCard blue">
                <div class="teamLogoFrame">${mostGoals.logo ? `<img src="${escapeHtml(mostGoals.logo)}" alt="${escapeHtml(mostGoals.name)}" loading="lazy">` : ''}</div>
                <div class="teamName">${escapeHtml(mostGoals.name)}</div>
                <div class="teamLabel">Ghi nhiều nhất (${mostGoals.standings?.goalsFor ?? 0})</div>
                <a href="/doi-bong/${escapeHtml(mostGoals.slug)}" class="teamCta blue">Xem CLB →</a>
              </div>
            ` : ''}
            ${bestDiff ? `
              <div class="teamCard green">
                <div class="teamLogoFrame">${bestDiff.logo ? `<img src="${escapeHtml(bestDiff.logo)}" alt="${escapeHtml(bestDiff.name)}" loading="lazy">` : ''}</div>
                <div class="teamName">${escapeHtml(bestDiff.name)}</div>
                <div class="teamLabel">Hiệu số tốt nhất (${typeof bestDiff.standings?.goalsDiff === 'number'
                  ? (bestDiff.standings.goalsDiff > 0 ? `+${bestDiff.standings.goalsDiff}` : bestDiff.standings.goalsDiff)
                  : 0})</div>
                <a href="/doi-bong/${escapeHtml(bestDiff.slug)}" class="teamCta green">Xem CLB →</a>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');

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
      <div class="heroBg"></div>
      <div class="heroBall" aria-hidden="true">⚽</div>
      <div class="heroContent">
        <span class="heroIcon">📊</span>
        <h1 class="heroH1">Thống Kê Bóng Đá</h1>
        <p class="heroSub">Số liệu mùa giải hiện tại tại các giải đấu hàng đầu — cập nhật theo dữ liệu <strong>BXH</strong>.</p>
      </div>
    </div>

    ${sectionsHtml}

    <div class="features">
      <div class="feat"><div class="featIcon amber">⚡</div><div><div class="featTitle">Cập nhật liên tục</div><div class="featDesc">Dữ liệu theo thời gian thực</div></div></div>
      <div class="feat"><div class="featIcon green">🛡️</div><div><div class="featTitle">Chính xác</div><div class="featDesc">Nguồn dữ liệu uy tín</div></div></div>
      <div class="feat"><div class="featIcon blue">📊</div><div><div class="featTitle">Toàn diện</div><div class="featDesc">Thống kê chi tiết</div></div></div>
      <div class="feat"><div class="featIcon purple">📈</div><div><div class="featTitle">Dễ theo dõi</div><div class="featDesc">Trực quan, dễ hiểu</div></div></div>
    </div>

    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '📊' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

module.exports = router;
