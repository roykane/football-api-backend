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
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f1f5f9;min-height:100vh}
    a{color:#0f172a;text-decoration:none}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}

    /* Banner hero — pre-baked image */
    .heroBanner{width:100%;border-radius:14px;overflow:hidden;margin-bottom:20px;background:#0a1628;line-height:0}
    .heroBanner img{display:block;width:100%;height:auto}

    /* LEAGUE SECTION (light) */
    .leagueSection{background:#fff;border-radius:12px;padding:20px;margin-bottom:18px;box-shadow:0 1px 3px rgba(15,23,42,0.06);border:1px solid #e2e8f0}
    .leagueHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #fef3c7}
    .leagueTitle{display:flex;align-items:center;gap:12px}
    .leagueIcon{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;font-size:15px;color:#fff;flex-shrink:0;font-weight:900}
    .leagueName{font-size:18px;font-weight:900;color:#0f172a;letter-spacing:.8px;text-transform:uppercase}
    .seasonTag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#64748b;background:#fef3c7;padding:6px 12px;border-radius:6px;letter-spacing:.4px;border:1px solid #fde68a}
    @media(max-width:768px){.leagueSection{padding:14px}}
    @media(max-width:480px){.leagueHeader{flex-direction:column;align-items:flex-start}.leagueName{font-size:15px}}

    /* 6-card row */
    .cardsGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
    @media(max-width:1280px){.cardsGrid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:640px){.cardsGrid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:380px){.cardsGrid{grid-template-columns:1fr}}

    /* Metric card (light tinted background) */
    .metricCard{border:1px solid #e2e8f0;border-radius:10px;padding:14px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:180px}
    .metricCard.purple{background:#faf5ff}
    .metricCard.blue{background:#eff6ff}
    .metricCard.teal{background:#f0fdfa}
    .metricIcon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;margin-bottom:12px}
    .metricIcon.purple{background:linear-gradient(135deg,#a78bfacc,#a78bfa);box-shadow:0 4px 10px rgba(167,139,250,0.2)}
    .metricIcon.blue{background:linear-gradient(135deg,#3b82f6cc,#3b82f6);box-shadow:0 4px 10px rgba(59,130,246,0.2)}
    .metricIcon.teal{background:linear-gradient(135deg,#14b8a6cc,#14b8a6);box-shadow:0 4px 10px rgba(20,184,166,0.2)}
    .metricNum{font-size:32px;font-weight:900;line-height:1;letter-spacing:-.5px;margin-bottom:6px}
    .metricNum.purple{color:#a78bfa}.metricNum.blue{color:#3b82f6}.metricNum.teal{color:#14b8a6}
    .metricLabel{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:auto}
    .spark{width:100%;height:32px;margin-top:10px}

    /* Team highlight cards (filled gradient) */
    .teamCard{border-radius:10px;padding:14px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:180px;position:relative;overflow:hidden}
    .teamCard.red{background:linear-gradient(135deg,#dc2626 0%,#7f1d1d 70%)}
    .teamCard.blue{background:linear-gradient(135deg,#2563eb 0%,#1e3a8a 70%)}
    .teamCard.green{background:linear-gradient(135deg,#16a34a 0%,#14532d 70%)}
    .teamCard::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,transparent,transparent 8px,rgba(255,255,255,0.05) 8px,rgba(255,255,255,0.05) 9px);pointer-events:none}
    .teamLogoFrame{width:56px;height:56px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35));position:relative;z-index:1}
    .teamLogoFrame img{width:100%;height:100%;object-fit:contain}
    .teamName{font-size:13px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.4px;line-height:1.2;margin-bottom:4px;position:relative;z-index:1;word-break:break-word}
    .teamLabel{font-size:10px;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:.4px;line-height:1.3;margin-bottom:auto;position:relative;z-index:1}
    .teamCta{margin-top:10px;display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.12);color:#fff;border-radius:5px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;text-decoration:none;position:relative;z-index:1}
    .teamCta.red{border:1px solid #fca5a5}.teamCta.red:hover{background:#fca5a5;color:#0f172a}
    .teamCta.blue{border:1px solid #93c5fd}.teamCta.blue:hover{background:#93c5fd;color:#0f172a}
    .teamCta.green{border:1px solid #86efac}.teamCta.green:hover{background:#86efac;color:#0f172a}

    /* Feature strip (light) */
    .features{background:#fff;border-radius:12px;padding:18px 22px;margin-top:18px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.04);display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    @media(max-width:768px){.features{grid-template-columns:repeat(2,1fr);padding:16px}}
    @media(max-width:380px){.features{grid-template-columns:1fr}}
    .feat{display:flex;align-items:flex-start;gap:10px}
    .featIcon{width:34px;height:34px;border-radius:8px;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .featIcon.amber{background:rgba(251,191,36,0.13);border:1px solid rgba(251,191,36,0.4);color:#d97706}
    .featIcon.green{background:rgba(34,197,94,0.13);border:1px solid rgba(34,197,94,0.4);color:#16a34a}
    .featIcon.blue{background:rgba(59,130,246,0.13);border:1px solid rgba(59,130,246,0.4);color:#3b82f6}
    .featIcon.purple{background:rgba(167,139,250,0.13);border:1px solid rgba(167,139,250,0.4);color:#a78bfa}
    .featTitle{font-size:11px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;line-height:1;margin-bottom:4px}
    .featDesc{font-size:11px;color:#64748b;line-height:1.4}

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
            <div class="metricCard purple">
              <div class="metricIcon purple">🥅</div>
              <div class="metricNum purple">${matchesPlayed > 0 ? Math.round(matchesPlayed) : '-'}</div>
              <div class="metricLabel">Trận đã đấu</div>
              ${sparkSvg('#a78bfa')}
            </div>
            <div class="metricCard blue">
              <div class="metricIcon blue">🏆</div>
              <div class="metricNum blue">${totalGoals}</div>
              <div class="metricLabel">Tổng bàn thắng</div>
              ${barsSvg('#3b82f6')}
            </div>
            <div class="metricCard teal">
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

    <div class="heroBanner">
      <img src="/images/thong-ke.webp" alt="Thống Kê Bóng Đá" width="1200" height="300">
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
