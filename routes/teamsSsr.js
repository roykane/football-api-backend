/**
 * Team SSR — bot-only HTML for /doi-bong/:slug
 *
 * Mirrors what /football-frontend/src/app/doi-bong/[slug]/page.tsx renders for
 * users, but built server-side from the Team document so Googlebot sees full
 * content (h1, standings, recent matches, ai content) without running JS.
 */

const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const siteHeader = require('../utils/siteHeader');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL, formatDateVi } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plainTextFromMd(md, maxLen = 600) {
  if (!md) return '';
  const text = String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= maxLen ? text : text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

function mdToHtml(md) {
  if (!md) return '';
  // Light markdown → HTML for SSR. Browsers get the React markdown component
  // when they hit the same route through the SPA.
  return String(md)
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^### /.test(block)) return `<h3>${escapeHtml(block.replace(/^### /, ''))}</h3>`;
      if (/^## /.test(block)) return `<h3>${escapeHtml(block.replace(/^## /, ''))}</h3>`;
      if (/^[-*] /m.test(block)) {
        const items = block.split(/\n/).map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
        return `<ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
      }
      return `<p>${escapeHtml(block).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('\n');
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0f172a;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .team-hero{background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);display:flex;gap:20px;align-items:center}
    .team-hero img{width:80px;height:80px;object-fit:contain;background:#f8fafc;border-radius:8px;padding:8px;flex-shrink:0}
    .team-hero h1{font-size:26px;font-weight:800;color:#0f172a;margin-bottom:4px}
    .team-hero .meta{font-size:13px;color:#64748b;display:flex;gap:12px;flex-wrap:wrap}
    .team-hero .badge{display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e3a8a;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-top:8px}
    .card{background:#fff;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #0f172a}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;display:flex;align-items:center;gap:8px}
    .card p{margin-bottom:10px;color:#334155;font-size:15px;line-height:1.7}
    .card strong{color:#0f172a}
    .card ul{padding-left:22px;margin:8px 0}.card li{margin-bottom:6px;color:#334155}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
    .stat-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center}
    .stat-num{font-size:22px;font-weight:800;color:#0066FF;display:block}
    .stat-label{font-size:11px;color:#64748b;text-transform:uppercase}
    .stat-num.win{color:#16a34a}.stat-num.draw{color:#f59e0b}.stat-num.lose{color:#ef4444}
    .form-row{display:flex;align-items:center;gap:4px;justify-content:center;margin-top:8px}
    .form-pip{width:22px;height:22px;line-height:22px;text-align:center;border-radius:4px;font-size:11px;font-weight:700;color:#fff}
    .form-W{background:#16a34a}.form-D{background:#f59e0b}.form-L{background:#ef4444}
    .match-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
    .match-row:last-child{border-bottom:none}
    .match-date{color:#94a3b8;min-width:48px;font-size:12px}
    .match-team{flex:1}.match-score{font-weight:800;color:#0f172a;min-width:46px;text-align:center}
    .match-time{font-weight:700;color:#0066FF;min-width:46px;text-align:center}
    .right{text-align:right}.bold{font-weight:700}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
    .sidebar-link:last-child{border-bottom:none}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}.sidebar{order:2}
      .team-hero{flex-direction:column;text-align:center;padding:16px}
      .team-hero h1{font-size:22px}
      .stat-grid{grid-template-columns:repeat(2,1fr)}
    }
  `;
}

function renderForm(form) {
  if (!form) return '';
  const pips = form.split('').slice(-5).map(f =>
    `<span class="form-pip form-${f}">${f === 'W' ? 'T' : f === 'D' ? 'H' : 'B'}</span>`
  ).join('');
  return `<div class="form-row"><span style="font-size:13px;color:#64748b;margin-right:6px">Phong độ:</span>${pips}</div>`;
}

function renderRecentMatches(team) {
  if (!team.recentMatches?.length) return '';
  const rows = team.recentMatches.slice(0, 8).map(m => `
    <div class="match-row">
      <span class="match-date">${m.date ? formatDateVi(m.date) : ''}</span>
      <span class="match-team ${m.home?.name === team.name ? 'bold' : ''}">${escapeHtml(m.home?.name || '')}</span>
      <span class="match-score">${m.home?.goals ?? '-'} - ${m.away?.goals ?? '-'}</span>
      <span class="match-team right ${m.away?.name === team.name ? 'bold' : ''}">${escapeHtml(m.away?.name || '')}</span>
    </div>`).join('');
  return `<div class="card"><h2>⚽ Kết quả gần đây</h2>${rows}</div>`;
}

function renderUpcoming(team) {
  if (!team.upcomingMatches?.length) return '';
  const rows = team.upcomingMatches.slice(0, 5).map(m => {
    const d = m.date ? new Date(m.date) : null;
    const time = d ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` : '';
    return `
    <div class="match-row">
      <span class="match-date">${d ? formatDateVi(d) : ''}</span>
      <span class="match-team">${escapeHtml(m.home?.name || '')}</span>
      <span class="match-time">${time}</span>
      <span class="match-team right">${escapeHtml(m.away?.name || '')}</span>
    </div>`;
  }).join('');
  return `<div class="card"><h2>📅 Lịch thi đấu sắp tới</h2>${rows}</div>`;
}

router.get('/doi-bong/:slug', async (req, res) => {
  const slug = req.params.slug;

  let team;
  try {
    team = await Team.findOne({ slug }).lean();
  } catch (err) { team = null; }

  if (!team) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy đội bóng | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p>Không tìm thấy đội bóng "${escapeHtml(slug)}".</p><p><a href="/bang-xep-hang">Xem các đội bóng</a></p></body></html>`);
  }

  const s = team.standings || {};
  const url = `${SITE_URL}/doi-bong/${team.slug}`;
  const leagueName = team.league?.name || '';
  const leagueSlug = team.league?.slug || '';
  const title = `${team.name} - Thông Tin, BXH & Phân Tích${leagueName ? ` | ${leagueName}` : ''}`;
  const description = `${team.name}: vị trí BXH ${s.rank ? `#${s.rank}` : '(đang cập nhật)'}, ${s.points || 0} điểm sau ${s.played || 0} trận. Kết quả gần đây, lịch thi đấu sắp tới và phân tích phong độ.`;

  const { datePublished, dateModified } = getEntityDates({
    publishedAt: team.createdAt,
    updatedAt: team.lastSyncedAt || team.updatedAt,
  });
  const og = pickOgImage({ image: team.logo }, { alt: `${team.name} - logo` });

  const teamSchema = {
    '@context': 'https://schema.org', '@type': 'SportsTeam',
    name: team.name, url, sport: 'Soccer', inLanguage: 'vi-VN',
    ...(team.logo && { logo: team.logo, image: team.logo }),
    ...(team.country && { location: { '@type': 'Place', name: team.country } }),
    ...(team.founded && { foundingDate: String(team.founded) }),
    ...(team.venue?.name && {
      homeLocation: {
        '@type': 'Place',
        name: team.venue.name,
        ...(team.venue.city && { address: { '@type': 'PostalAddress', addressLocality: team.venue.city } }),
      },
    }),
    ...(leagueName && { memberOf: { '@type': 'SportsOrganization', name: leagueName } }),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Bảng xếp hạng', item: `${SITE_URL}/bang-xep-hang` },
      ...(leagueSlug ? [{ '@type': 'ListItem', position: 3, name: leagueName, item: `${SITE_URL}/bang-xep-hang/${leagueSlug}` }] : []),
      { '@type': 'ListItem', position: leagueSlug ? 4 : 3, name: team.name, item: url },
    ],
  };
  const faqs = [
    {
      question: `${team.name} đang xếp thứ mấy${leagueName ? ` tại ${leagueName}` : ''}?`,
      answer: s.rank
        ? `${team.name} hiện xếp thứ ${s.rank}${leagueName ? ` tại ${leagueName}` : ''} với ${s.points || 0} điểm sau ${s.played || 0} trận (${s.win || 0} thắng, ${s.draw || 0} hòa, ${s.lose || 0} thua).`
        : `Vị trí của ${team.name} đang được cập nhật.`,
    },
    {
      question: `Sân nhà của ${team.name} ở đâu?`,
      answer: team.venue?.name
        ? `${team.name} thi đấu trên sân ${team.venue.name}${team.venue.city ? `, ${team.venue.city}` : ''}${team.venue.capacity ? `, sức chứa ${team.venue.capacity.toLocaleString('vi-VN')} khán giả` : ''}.`
        : `Thông tin sân nhà của ${team.name} đang được cập nhật.`,
    },
    ...(team.founded ? [{
      question: `${team.name} được thành lập năm nào?`,
      answer: `${team.name} được thành lập năm ${team.founded}${team.country ? `, có trụ sở tại ${team.country}` : ''}.`,
    }] : []),
  ];
  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(team.name)}, ${escapeHtml(team.name.toLowerCase())} bxh, ${escapeHtml(team.name.toLowerCase())} lịch thi đấu${leagueName ? `, ${escapeHtml(leagueName)}` : ''}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(teamSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/bang-xep-hang">Bảng xếp hạng</a> &rsaquo;
      ${leagueSlug ? `<a href="/bang-xep-hang/${leagueSlug}">${escapeHtml(leagueName)}</a> &rsaquo;` : ''}
      <span>${escapeHtml(team.name)}</span>
    </nav>

    <div class="team-hero">
      ${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="${escapeHtml(team.name)} logo">` : ''}
      <div>
        <h1>${escapeHtml(team.name)}</h1>
        <div class="meta">
          ${team.country ? `<span>${escapeHtml(team.country)}</span>` : ''}
          ${team.founded ? `<span>Thành lập ${team.founded}</span>` : ''}
          ${team.venue?.name ? `<span>🏟️ ${escapeHtml(team.venue.name)}</span>` : ''}
        </div>
        ${leagueName ? `<a class="badge" href="/bang-xep-hang/${leagueSlug}">🏆 ${escapeHtml(leagueName)}</a>` : ''}
      </div>
    </div>

    <div class="layout">
      <div class="main">
        ${s.rank ? `
        <div class="card">
          <h2>📊 Bảng xếp hạng mùa giải</h2>
          <div class="stat-grid">
            <div class="stat-box"><span class="stat-num">#${s.rank}</span><span class="stat-label">Vị trí</span></div>
            <div class="stat-box"><span class="stat-num">${s.points ?? '-'}</span><span class="stat-label">Điểm</span></div>
            <div class="stat-box"><span class="stat-num win">${s.win ?? '-'}</span><span class="stat-label">Thắng</span></div>
            <div class="stat-box"><span class="stat-num draw">${s.draw ?? '-'}</span><span class="stat-label">Hòa</span></div>
            <div class="stat-box"><span class="stat-num lose">${s.lose ?? '-'}</span><span class="stat-label">Thua</span></div>
            <div class="stat-box"><span class="stat-num">${s.goalsFor ?? '-'}</span><span class="stat-label">Bàn thắng</span></div>
            <div class="stat-box"><span class="stat-num">${s.goalsAgainst ?? '-'}</span><span class="stat-label">Bàn thua</span></div>
            <div class="stat-box"><span class="stat-num">${typeof s.goalsDiff === 'number' ? (s.goalsDiff > 0 ? `+${s.goalsDiff}` : s.goalsDiff) : '-'}</span><span class="stat-label">Hiệu số</span></div>
          </div>
          ${renderForm(s.form)}
        </div>` : ''}

        ${renderRecentMatches(team)}
        ${renderUpcoming(team)}

        ${team.aiContent ? `
        <div class="card">
          <h2>📝 Phân tích ${escapeHtml(team.name)}</h2>
          ${mdToHtml(team.aiContent)}
        </div>` : ''}

        ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '⚽' })}
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy cập nhanh</div>
          ${leagueSlug ? `
            <a class="sidebar-link" href="/bang-xep-hang/${leagueSlug}">BXH ${escapeHtml(leagueName)}</a>
            <a class="sidebar-link" href="/lich-thi-dau/${leagueSlug}">Lịch thi đấu ${escapeHtml(leagueName)}</a>
            <a class="sidebar-link" href="/ket-qua-bong-da/${leagueSlug}">Kết quả ${escapeHtml(leagueName)}</a>
            <a class="sidebar-link" href="/top-ghi-ban/${leagueSlug}">Top ghi bàn ${escapeHtml(leagueName)}</a>
          ` : ''}
          <a class="sidebar-link" href="/bang-xep-hang">Tất cả bảng xếp hạng</a>
          <a class="sidebar-link" href="/giai-dau">Tất cả giải đấu</a>
        </div>
      </aside>
    </div>

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600'); // 1h — team data syncs daily-ish
  res.send(html);
});

module.exports = router;
