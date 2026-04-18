/**
 * SEO Content Pages - Server-side rendered HTML for search engine crawlers
 *
 * Serves full HTML pages with content for:
 * - /preview/:slug         → Round preview article (from MongoDB)
 * - /doi-dau/:slug         → H2H analysis article (from MongoDB)
 * - /lich-thi-dau/:slug    → League schedule (from API-Sports)
 * - /bang-xep-hang/:slug   → League standings (from API-Sports)
 * - /top-ghi-ban/:slug     → Top scorers (from API-Sports)
 * - /ket-qua/:dateSlug     → Match results by date (from API-Sports)
 *
 * Google gets complete HTML with content, meta tags, structured data.
 * Regular users get the SPA (handled by Nginx try_files).
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const AutoArticle = require('../models/AutoArticle');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const API_SPORTS_URL = process.env.API_SPORTS_URL || 'https://v3.football.api-sports.io';

// ============================================================
// LEAGUES constant
// ============================================================
const LEAGUES = {
  'premier-league': { id: 39, name: 'Premier League', country: 'England', season: 2025 },
  'la-liga': { id: 140, name: 'La Liga', country: 'Spain', season: 2025 },
  'serie-a': { id: 135, name: 'Serie A', country: 'Italy', season: 2025 },
  'bundesliga': { id: 78, name: 'Bundesliga', country: 'Germany', season: 2025 },
  'ligue-1': { id: 61, name: 'Ligue 1', country: 'France', season: 2025 },
  'champions-league': { id: 2, name: 'Champions League', country: 'World', season: 2025 },
  'europa-league': { id: 3, name: 'Europa League', country: 'World', season: 2025 },
  'v-league-1': { id: 340, name: 'V.League 1', country: 'Vietnam', season: 2025 },
  'world-cup': { id: 1, name: 'World Cup', country: 'World', season: 2025 },
};

// ============================================================
// In-memory cache
// ============================================================
const cache = new Map();

function getCached(key, ttlMs) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < ttlMs) return item.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

// ============================================================
// Helpers
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function markdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

/**
 * Resolve a dateSlug to a yyyy-mm-dd string and a display label.
 */
function resolveDateSlug(dateSlug) {
  const now = new Date();
  if (dateSlug === 'hom-nay') {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return { apiDate: `${yyyy}-${mm}-${dd}`, label: `Hôm Nay (${dd}/${mm}/${yyyy})` };
  }
  if (dateSlug === 'hom-qua') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    return { apiDate: `${yyyy}-${mm}-${dd}`, label: `Hôm Qua (${dd}/${mm}/${yyyy})` };
  }
  // Expect dd-mm-yyyy
  const parts = dateSlug.split('-');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return { apiDate: `${yyyy}-${mm}-${dd}`, label: `${dd}/${mm}/${yyyy}` };
  }
  return null;
}

/**
 * Make an API-Sports request.
 */
async function apiSportsGet(endpoint, params) {
  const res = await axios.get(`${API_SPORTS_URL}${endpoint}`, {
    headers: { 'x-apisports-key': API_SPORTS_KEY },
    params,
    timeout: 10000,
  });
  return res.data;
}

// ============================================================
// Shared base styles
// ============================================================
function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #1a1a2e; background: #f8fafc; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #0a1628, #1a2744); color: white; border-radius: 16px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 10px; line-height: 1.3; }
    .header .subtitle { font-size: 15px; opacity: 0.8; margin-top: 8px; }
    .content { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .content h2 { font-size: 22px; font-weight: 800; color: #0a1628; margin: 30px 0 15px; padding-bottom: 10px; border-bottom: 3px solid #00D4FF; }
    .content h2:first-child { margin-top: 0; }
    .content p { margin-bottom: 15px; color: #334155; }
    .content ul { margin: 15px 0; padding-left: 20px; }
    .content li { margin-bottom: 8px; color: #334155; }
    .content strong { color: #0a1628; }
    .breadcrumb { margin-bottom: 20px; font-size: 14px; color: #64748b; }
    .breadcrumb a { color: #3b82f6; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .tags { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 13px; }
    .match-info { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 20px 0; }
    .team { text-align: center; }
    .team img { width: 64px; height: 64px; object-fit: contain; }
    .team-name { font-size: 16px; font-weight: 700; margin-top: 8px; }
    .vs { font-size: 24px; font-weight: 900; color: #00D4FF; }
    .league-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 8px; font-size: 14px; margin-top: 10px; }
    .league-badge img { width: 20px; height: 20px; object-fit: contain; }
    .stat-bar { display: flex; gap: 15px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
    .stat-item { background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 8px; font-size: 13px; }
    .stat-value { font-weight: 700; color: #00D4FF; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    thead { background: #0a1628; color: white; }
    thead th { padding: 12px 10px; font-size: 13px; font-weight: 600; text-align: left; white-space: nowrap; }
    tbody tr { border-bottom: 1px solid #e2e8f0; transition: background 0.15s; }
    tbody tr:hover { background: #f8fafc; }
    tbody td { padding: 10px; font-size: 14px; vertical-align: middle; }
    tbody td img { width: 24px; height: 24px; object-fit: contain; vertical-align: middle; margin-right: 6px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .highlight-row { background: #f0fdf4; }
    .relegation-row { background: #fef2f2; }
    .score { font-weight: 800; color: #0a1628; font-size: 16px; }
    .league-group-header { background: #1a2744; color: white; padding: 10px 15px; border-radius: 8px 8px 0 0; margin-top: 25px; font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }
    .league-group-header img { width: 22px; height: 22px; object-fit: contain; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #94a3b8; font-size: 14px; }
    .footer a { color: #00D4FF; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    @media (max-width: 768px) {
      .container { padding: 10px; }
      .header { padding: 25px 15px; }
      .header h1 { font-size: 22px; }
      .content { padding: 20px 15px; }
      .team img { width: 48px; height: 48px; }
      table { font-size: 13px; }
      thead th, tbody td { padding: 8px 6px; }
      .hide-mobile { display: none; }
    }
  `;
}

// ============================================================
// Shared HTML wrappers
// ============================================================
function renderPage({ title, description, url, robots, breadcrumbHtml, headerHtml, bodyHtml, structuredData, ogType, ogImage }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeUrl = escapeHtml(url);
  const image = ogImage || `${SITE_URL}/og-image.jpg`;
  const robotsMeta = robots || 'index, follow';

  const ldScripts = (Array.isArray(structuredData) ? structuredData : [structuredData])
    .filter(Boolean)
    .map(sd => `<script type="application/ld+json">${JSON.stringify(sd)}</script>`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${safeTitle} | ScoreLine</title>
  <meta name="description" content="${safeDesc}">
  <meta name="robots" content="${robotsMeta}">
  <link rel="canonical" href="${safeUrl}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:type" content="${ogType || 'website'}">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  ${ldScripts}

  <style>${baseStyles()}</style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">${breadcrumbHtml}</nav>
    <div class="header">${headerHtml}</div>
    <article class="content">${bodyHtml}</article>
    <div class="footer">
      <p><a href="${SITE_URL}">ScoreLine.io</a> - Cập nhật tỷ số trực tiếp, lịch thi đấu và phân tích bóng đá</p>
    </div>
  </div>
</body>
</html>`;
}

function render404(message) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Không tìm thấy | ScoreLine</title>
  <meta name="robots" content="noindex">
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>404 - Không tìm thấy</h1></div>
    <div class="content" style="text-align:center;">
      <p>${escapeHtml(message || 'Trang bạn tìm không tồn tại.')}</p>
      <p><a href="/" style="color:#3b82f6;">Quay về trang chủ</a></p>
    </div>
  </div>
</body>
</html>`;
}

function render500() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lỗi hệ thống | ScoreLine</title>
  <meta name="robots" content="noindex">
  <style>${baseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>500 - Lỗi hệ thống</h1></div>
    <div class="content" style="text-align:center;">
      <p>Đã xảy ra lỗi. Vui lòng thử lại sau.</p>
      <p><a href="/" style="color:#3b82f6;">Quay về trang chủ</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// 1. GET /preview/:slug - Round Preview (MongoDB)
// ============================================================
router.get('/preview/:slug', async (req, res) => {
  try {
    const article = await AutoArticle.findOne({
      type: 'round-preview',
      slug: req.params.slug,
      status: 'published',
    }).lean();

    if (!article) {
      return res.status(404).send(render404('Bài preview không tồn tại.'));
    }

    // Increment views
    AutoArticle.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    const url = `${SITE_URL}/preview/${article.slug}`;
    const title = article.metaTitle || article.title;
    const description = article.metaDescription || article.excerpt || '';
    const leagueName = article.leagueInfo?.name || '';
    const round = article.round || '';

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: description,
      url: url,
      datePublished: article.createdAt,
      dateModified: article.updatedAt || article.createdAt,
      author: { '@type': 'Organization', name: 'ScoreLine', url: SITE_URL },
      publisher: {
        '@type': 'Organization',
        name: 'ScoreLine',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg` },
      },
      image: `${SITE_URL}/og-image.jpg`,
      mainEntityOfPage: url,
    };

    const breadcrumbHtml = `
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/preview">Nhận định</a> &rsaquo;
      <span>Preview ${escapeHtml(leagueName)} ${escapeHtml(round)}</span>`;

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      ${article.leagueInfo?.logo ? `<div class="league-badge"><img src="${escapeHtml(article.leagueInfo.logo)}" alt="${escapeHtml(leagueName)}" loading="lazy"><span>${escapeHtml(leagueName)}</span></div>` : ''}
      <div class="subtitle">${escapeHtml(round)} &bull; Mùa giải ${article.seasonYear || 2025}</div>`;

    const bodyHtml = `
      ${article.content ? markdownToHtml(article.content) : ''}
      ${article.tags?.length ? `<div class="tags">${article.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}`;

    const html = renderPage({
      title,
      description,
      url,
      ogType: 'article',
      breadcrumbHtml,
      headerHtml,
      bodyHtml,
      structuredData,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (error) {
    console.error('[SEO Content] Error rendering preview:', error);
    res.status(500).send(render500());
  }
});

// ============================================================
// 2. GET /doi-dau/:slug - H2H Analysis (MongoDB)
// ============================================================
router.get('/doi-dau/:slug', async (req, res) => {
  try {
    const article = await AutoArticle.findOne({
      type: 'h2h-analysis',
      slug: req.params.slug,
      status: 'published',
    }).lean();

    if (!article) {
      return res.status(404).send(render404('Bài phân tích đối đầu không tồn tại.'));
    }

    AutoArticle.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    const { matchInfo, h2hStats } = article;
    const homeName = matchInfo?.homeTeam?.name || '';
    const awayName = matchInfo?.awayTeam?.name || '';
    const url = `${SITE_URL}/doi-dau/${article.slug}`;
    const title = article.metaTitle || article.title;
    const description = article.metaDescription || article.excerpt || '';

    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: description,
      url: url,
      datePublished: article.createdAt,
      dateModified: article.updatedAt || article.createdAt,
      author: { '@type': 'Organization', name: 'ScoreLine', url: SITE_URL },
      publisher: {
        '@type': 'Organization',
        name: 'ScoreLine',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg` },
      },
      image: `${SITE_URL}/og-image.jpg`,
      mainEntityOfPage: url,
    };

    const sportsEventSchema = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${homeName} vs ${awayName}`,
      sport: 'Soccer',
      startDate: matchInfo?.matchDate,
      homeTeam: {
        '@type': 'SportsTeam',
        name: homeName,
        image: matchInfo?.homeTeam?.logo,
      },
      awayTeam: {
        '@type': 'SportsTeam',
        name: awayName,
        image: matchInfo?.awayTeam?.logo,
      },
      location: {
        '@type': 'Place',
        name: matchInfo?.league?.name || 'TBD',
      },
    };

    const breadcrumbHtml = `
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/doi-dau">Đối đầu</a> &rsaquo;
      <span>${escapeHtml(homeName)} vs ${escapeHtml(awayName)}</span>`;

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      <div class="match-info">
        <div class="team">
          ${matchInfo?.homeTeam?.logo ? `<img src="${escapeHtml(matchInfo.homeTeam.logo)}" alt="${escapeHtml(homeName)}" loading="lazy">` : ''}
          <div class="team-name">${escapeHtml(homeName)}</div>
        </div>
        <div class="vs">VS</div>
        <div class="team">
          ${matchInfo?.awayTeam?.logo ? `<img src="${escapeHtml(matchInfo.awayTeam.logo)}" alt="${escapeHtml(awayName)}" loading="lazy">` : ''}
          <div class="team-name">${escapeHtml(awayName)}</div>
        </div>
      </div>
      ${matchInfo?.league ? `<div class="league-badge">${matchInfo.league.logo ? `<img src="${escapeHtml(matchInfo.league.logo)}" alt="${escapeHtml(matchInfo.league.name)}" loading="lazy">` : ''}<span>${escapeHtml(matchInfo.league.name)}${matchInfo.league.country ? ' - ' + escapeHtml(matchInfo.league.country) : ''}</span></div>` : ''}
      ${matchInfo?.matchDate ? `<div class="subtitle">${escapeHtml(formatDate(matchInfo.matchDate))}</div>` : ''}
      ${h2hStats ? `
      <div class="stat-bar">
        <div class="stat-item">Tổng trận: <span class="stat-value">${h2hStats.totalMatches || 0}</span></div>
        <div class="stat-item">${escapeHtml(homeName)} thắng: <span class="stat-value">${h2hStats.homeWins || 0}</span></div>
        <div class="stat-item">Hòa: <span class="stat-value">${h2hStats.draws || 0}</span></div>
        <div class="stat-item">${escapeHtml(awayName)} thắng: <span class="stat-value">${h2hStats.awayWins || 0}</span></div>
      </div>` : ''}`;

    const bodyHtml = `
      ${article.content ? markdownToHtml(article.content) : ''}
      ${article.tags?.length ? `<div class="tags">${article.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}`;

    const html = renderPage({
      title,
      description,
      url,
      ogType: 'article',
      breadcrumbHtml,
      headerHtml,
      bodyHtml,
      structuredData: [articleSchema, sportsEventSchema],
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (error) {
    console.error('[SEO Content] Error rendering doi-dau:', error);
    res.status(500).send(render500());
  }
});

// ============================================================
// 3. GET /lich-thi-dau/:leagueSlug - Schedule (API-Sports)
// ============================================================
router.get('/lich-thi-dau/:leagueSlug', async (req, res) => {
  try {
    const league = LEAGUES[req.params.leagueSlug];
    if (!league) {
      return res.status(404).send(render404('Giải đấu không được hỗ trợ.'));
    }

    const cacheKey = `schedule:${req.params.leagueSlug}`;
    let fixtures = getCached(cacheKey, 60 * 60 * 1000); // 1 hour

    if (!fixtures) {
      const data = await apiSportsGet('/fixtures', {
        league: league.id,
        season: league.season,
        next: 15,
      });
      fixtures = data.response || [];
      setCache(cacheKey, fixtures);
    }

    const url = `${SITE_URL}/lich-thi-dau/${req.params.leagueSlug}`;
    const title = `Lịch Thi Đấu ${league.name} 2025/2026 - Cập Nhật Mới Nhất`;
    const description = `Xem lịch thi đấu ${league.name} mùa giải 2025/2026. Cập nhật thời gian, đội hình và thông tin trận đấu mới nhất.`;

    const sportsEvents = fixtures.map(f => ({
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${f.teams?.home?.name || ''} vs ${f.teams?.away?.name || ''}`,
      sport: 'Soccer',
      startDate: f.fixture?.date,
      homeTeam: { '@type': 'SportsTeam', name: f.teams?.home?.name, image: f.teams?.home?.logo },
      awayTeam: { '@type': 'SportsTeam', name: f.teams?.away?.name, image: f.teams?.away?.logo },
      location: { '@type': 'Place', name: f.fixture?.venue?.name || league.name },
    }));

    const breadcrumbHtml = `
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/lich-thi-dau">Lịch thi đấu</a> &rsaquo;
      <span>${escapeHtml(league.name)}</span>`;

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(league.country)} &bull; Mùa giải 2025/2026</div>`;

    let tableRows = '';
    if (fixtures.length === 0) {
      tableRows = '<tr><td colspan="4" class="text-center">Chưa có lịch thi đấu.</td></tr>';
    } else {
      tableRows = fixtures.map(f => {
        const home = f.teams?.home;
        const away = f.teams?.away;
        const date = f.fixture?.date;
        return `<tr>
          <td>${escapeHtml(formatShortDate(date))}</td>
          <td>${escapeHtml(formatTime(date))}</td>
          <td class="text-right">${home?.logo ? `<img src="${escapeHtml(home.logo)}" alt="" loading="lazy">` : ''}${escapeHtml(home?.name || '')}</td>
          <td class="text-center font-bold">vs</td>
          <td>${away?.logo ? `<img src="${escapeHtml(away.logo)}" alt="" loading="lazy">` : ''}${escapeHtml(away?.name || '')}</td>
        </tr>`;
      }).join('');
    }

    const bodyHtml = `
      <h2>Lịch thi đấu sắp tới</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Giờ</th>
              <th class="text-right">Đội nhà</th>
              <th class="text-center"></th>
              <th>Đội khách</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    const html = renderPage({
      title,
      description,
      url,
      breadcrumbHtml,
      headerHtml,
      bodyHtml,
      structuredData: sportsEvents.slice(0, 10), // Limit to 10 structured events
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (error) {
    console.error('[SEO Content] Error rendering lich-thi-dau:', error);
    res.status(500).send(render500());
  }
});

// ============================================================
// 4. GET /bang-xep-hang/:leagueSlug - Standings (API-Sports)
// ============================================================
router.get('/bang-xep-hang/:leagueSlug', async (req, res) => {
  try {
    const league = LEAGUES[req.params.leagueSlug];
    if (!league) {
      return res.status(404).send(render404('Giải đấu không được hỗ trợ.'));
    }

    const cacheKey = `standings:${req.params.leagueSlug}`;
    let standings = getCached(cacheKey, 60 * 60 * 1000);

    if (!standings) {
      const data = await apiSportsGet('/standings', {
        league: league.id,
        season: league.season,
      });
      // standings data is nested: response[0].league.standings (array of groups, each group is array of teams)
      standings = data.response?.[0]?.league?.standings || [];
      setCache(cacheKey, standings);
    }

    const url = `${SITE_URL}/bang-xep-hang/${req.params.leagueSlug}`;
    const title = `Bảng Xếp Hạng ${league.name} 2025/2026 - BXH Mới Nhất`;
    const description = `Bảng xếp hạng ${league.name} mùa giải 2025/2026. Cập nhật điểm số, thắng thua, hiệu số bàn thắng mới nhất.`;

    const tableSchema = {
      '@context': 'https://schema.org',
      '@type': 'Table',
      about: `Bảng xếp hạng ${league.name} 2025/2026`,
    };

    const breadcrumbHtml = `
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/bang-xep-hang">Bảng xếp hạng</a> &rsaquo;
      <span>${escapeHtml(league.name)}</span>`;

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(league.country)} &bull; Mùa giải 2025/2026</div>`;

    let tablesHtml = '';
    // standings may be an array of groups (for Champions League group stage etc.)
    const groups = standings.length > 0 && Array.isArray(standings[0]) ? standings : [standings];

    groups.forEach((group, gi) => {
      if (groups.length > 1) {
        const groupName = group[0]?.group || `Bảng ${gi + 1}`;
        tablesHtml += `<h2>${escapeHtml(groupName)}</h2>`;
      } else {
        tablesHtml += `<h2>Bảng xếp hạng</h2>`;
      }

      tablesHtml += `<div style="overflow-x:auto;"><table>
        <thead>
          <tr>
            <th>#</th>
            <th>Đội</th>
            <th class="text-center">Trận</th>
            <th class="text-center">T</th>
            <th class="text-center">H</th>
            <th class="text-center">B</th>
            <th class="text-center hide-mobile">BT</th>
            <th class="text-center hide-mobile">BB</th>
            <th class="text-center hide-mobile">HS</th>
            <th class="text-center font-bold">Đ</th>
          </tr>
        </thead>
        <tbody>`;

      if (!group || group.length === 0) {
        tablesHtml += '<tr><td colspan="10" class="text-center">Chưa có dữ liệu.</td></tr>';
      } else {
        group.forEach(team => {
          const s = team.all || {};
          const gd = (s.goals?.for || 0) - (s.goals?.against || 0);
          const gdStr = gd > 0 ? `+${gd}` : String(gd);
          const rowClass = team.rank <= 4 ? 'highlight-row' : (team.description && team.description.toLowerCase().includes('relegation') ? 'relegation-row' : '');

          tablesHtml += `<tr class="${rowClass}">
            <td class="text-center font-bold">${team.rank || ''}</td>
            <td>${team.team?.logo ? `<img src="${escapeHtml(team.team.logo)}" alt="" loading="lazy">` : ''}${escapeHtml(team.team?.name || '')}</td>
            <td class="text-center">${s.played ?? ''}</td>
            <td class="text-center">${s.win ?? ''}</td>
            <td class="text-center">${s.draw ?? ''}</td>
            <td class="text-center">${s.lose ?? ''}</td>
            <td class="text-center hide-mobile">${s.goals?.for ?? ''}</td>
            <td class="text-center hide-mobile">${s.goals?.against ?? ''}</td>
            <td class="text-center hide-mobile">${gdStr}</td>
            <td class="text-center font-bold">${team.points ?? ''}</td>
          </tr>`;
        });
      }

      tablesHtml += '</tbody></table></div>';
    });

    const html = renderPage({
      title,
      description,
      url,
      breadcrumbHtml,
      headerHtml,
      bodyHtml: tablesHtml,
      structuredData: tableSchema,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (error) {
    console.error('[SEO Content] Error rendering bang-xep-hang:', error);
    res.status(500).send(render500());
  }
});

// ============================================================
// 5. GET /top-ghi-ban/:leagueSlug - Top Scorers (API-Sports)
// ============================================================
router.get('/top-ghi-ban/:leagueSlug', async (req, res) => {
  try {
    const league = LEAGUES[req.params.leagueSlug];
    if (!league) {
      return res.status(404).send(render404('Giải đấu không được hỗ trợ.'));
    }

    const cacheKey = `topscorers:${req.params.leagueSlug}`;
    let players = getCached(cacheKey, 60 * 60 * 1000);

    if (!players) {
      const data = await apiSportsGet('/players/topscorers', {
        league: league.id,
        season: league.season,
      });
      players = (data.response || []).slice(0, 20);
      setCache(cacheKey, players);
    }

    const url = `${SITE_URL}/top-ghi-ban/${req.params.leagueSlug}`;
    const title = `Top Ghi Bàn ${league.name} 2025/2026 - Vua Phá Lưới`;
    const description = `Danh sách vua phá lưới ${league.name} mùa giải 2025/2026. Xem top cầu thủ ghi bàn nhiều nhất, kiến tạo và số trận.`;

    const breadcrumbHtml = `
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/top-ghi-ban">Top ghi bàn</a> &rsaquo;
      <span>${escapeHtml(league.name)}</span>`;

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(league.country)} &bull; Mùa giải 2025/2026</div>`;

    let tableRows = '';
    if (players.length === 0) {
      tableRows = '<tr><td colspan="6" class="text-center">Chưa có dữ liệu.</td></tr>';
    } else {
      tableRows = players.map((entry, idx) => {
        const player = entry.player || {};
        const stats = entry.statistics?.[0] || {};
        const goals = stats.goals?.total || 0;
        const assists = stats.goals?.assists || 0;
        const appearances = stats.games?.appearences || 0;
        const teamName = stats.team?.name || '';
        const teamLogo = stats.team?.logo || '';
        const playerPhoto = player.photo || '';

        return `<tr>
          <td class="text-center font-bold">${idx + 1}</td>
          <td>${playerPhoto ? `<img src="${escapeHtml(playerPhoto)}" alt="" loading="lazy" style="border-radius:50%;">` : ''}${escapeHtml(player.name || '')}</td>
          <td>${teamLogo ? `<img src="${escapeHtml(teamLogo)}" alt="" loading="lazy">` : ''}${escapeHtml(teamName)}</td>
          <td class="text-center font-bold">${goals}</td>
          <td class="text-center">${assists}</td>
          <td class="text-center">${appearances}</td>
        </tr>`;
      }).join('');
    }

    const bodyHtml = `
      <h2>Danh sách vua phá lưới</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Cầu thủ</th>
              <th>Đội</th>
              <th class="text-center">Bàn thắng</th>
              <th class="text-center">Kiến tạo</th>
              <th class="text-center">Số trận</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    const html = renderPage({
      title,
      description,
      url,
      breadcrumbHtml,
      headerHtml,
      bodyHtml,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Table',
        about: `Top ghi bàn ${league.name} 2025/2026`,
      },
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (error) {
    console.error('[SEO Content] Error rendering top-ghi-ban:', error);
    res.status(500).send(render500());
  }
});

// ============================================================
// 6. GET /ket-qua/:dateSlug - Results by Date (API-Sports)
// ============================================================
router.get('/ket-qua/:dateSlug', async (req, res) => {
  try {
    const resolved = resolveDateSlug(req.params.dateSlug);
    if (!resolved) {
      return res.status(404).send(render404('Định dạng ngày không hợp lệ. Sử dụng hom-nay, hom-qua hoặc dd-mm-yyyy.'));
    }

    const { apiDate, label } = resolved;
    const cacheKey = `results:${apiDate}`;
    let fixtures = getCached(cacheKey, 30 * 60 * 1000); // 30 minutes

    if (!fixtures) {
      try {
        const data = await apiSportsGet('/fixtures', {
          date: apiDate,
          status: 'FT',
        });
        fixtures = data.response || [];
        setCache(cacheKey, fixtures);
      } catch (apiErr) {
        console.error('[SEO Content] API-Sports error for results:', apiErr.message);
        fixtures = [];
      }
    }

    const url = `${SITE_URL}/ket-qua/${req.params.dateSlug}`;
    const title = `Kết Quả Bóng Đá ${label} - Tỷ Số Đầy Đủ`;
    const description = `Kết quả bóng đá ngày ${label}. Xem tỷ số đầy đủ tất cả các trận đấu, cập nhật nhanh nhất.`;

    // Group fixtures by league
    const leagueGroups = {};
    fixtures.forEach(f => {
      const leagueId = f.league?.id || 0;
      if (!leagueGroups[leagueId]) {
        leagueGroups[leagueId] = {
          name: f.league?.name || 'Khác',
          country: f.league?.country || '',
          logo: f.league?.logo || '',
          matches: [],
        };
      }
      leagueGroups[leagueId].matches.push(f);
    });

    const leagueCount = Object.keys(leagueGroups).length;
    const matchCount = fixtures.length;

    // Build match results HTML
    let matchesHtml = '';
    if (fixtures.length === 0) {
      matchesHtml = '<div class="empty-state"><div class="empty-icon">⚽</div><p>Chưa có kết quả cho ngày này.</p><p class="empty-sub">Kết quả sẽ được cập nhật sau khi các trận đấu kết thúc.</p></div>';
    } else {
      Object.values(leagueGroups).forEach(group => {
        matchesHtml += `<div class="league-section">
          <div class="league-header">
            ${group.logo ? `<img src="${escapeHtml(group.logo)}" alt="" loading="lazy">` : ''}
            <span class="league-name">${escapeHtml(group.name)}</span>
            ${group.country ? `<span class="league-country">${escapeHtml(group.country)}</span>` : ''}
            <span class="match-count">${group.matches.length} trận</span>
          </div>`;

        group.matches.forEach(f => {
          const home = f.teams?.home;
          const away = f.teams?.away;
          const homeGoals = f.goals?.home ?? '-';
          const awayGoals = f.goals?.away ?? '-';
          const homeWin = home?.winner ? ' winner' : '';
          const awayWin = away?.winner ? ' winner' : '';
          const isDraw = !home?.winner && !away?.winner;

          matchesHtml += `
            <div class="match-row">
              <div class="match-team home${homeWin}">
                <span class="team-name">${escapeHtml(home?.name || '')}</span>
                ${home?.logo ? `<img src="${escapeHtml(home.logo)}" alt="" loading="lazy">` : ''}
              </div>
              <div class="match-score${isDraw ? ' draw' : ''}">
                <span class="goal">${homeGoals}</span>
                <span class="sep">-</span>
                <span class="goal">${awayGoals}</span>
              </div>
              <div class="match-team away${awayWin}">
                ${away?.logo ? `<img src="${escapeHtml(away.logo)}" alt="" loading="lazy">` : ''}
                <span class="team-name">${escapeHtml(away?.name || '')}</span>
              </div>
            </div>`;
        });

        matchesHtml += '</div>';
      });
    }

    // Build sidebar
    const dateNav = [];
    const today = new Date();
    for (let i = -3; i <= 1; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const slug = i === 0 ? 'hom-nay' : i === -1 ? 'hom-qua' : `${dd}-${mm}-${yyyy}`;
      const dayLabel = i === 0 ? 'Hôm nay' : i === -1 ? 'Hôm qua' : i === 1 ? 'Ngày mai' : `${dd}/${mm}`;
      const isActive = req.params.dateSlug === slug || (req.params.dateSlug === 'hom-nay' && i === 0) || (req.params.dateSlug === 'hom-qua' && i === -1);
      dateNav.push(`<a href="/ket-qua/${slug}" class="date-link${isActive ? ' active' : ''}">${dayLabel}</a>`);
    }

    const topLeagues = [
      { name: 'Premier League', slug: 'premier-league' },
      { name: 'La Liga', slug: 'la-liga' },
      { name: 'Serie A', slug: 'serie-a' },
      { name: 'Bundesliga', slug: 'bundesliga' },
      { name: 'Ligue 1', slug: 'ligue-1' },
      { name: 'Champions League', slug: 'champions-league' },
      { name: 'V.League 1', slug: 'v-league-1' },
    ];

    const sidebarHtml = `
      <div class="sidebar-card">
        <div class="sidebar-title">Chọn ngày</div>
        <div class="date-nav">${dateNav.join('')}</div>
      </div>
      <div class="sidebar-card">
        <div class="sidebar-title">Thống kê</div>
        <div class="stat-row"><span>Tổng trận</span><strong>${matchCount}</strong></div>
        <div class="stat-row"><span>Giải đấu</span><strong>${leagueCount}</strong></div>
      </div>
      <div class="sidebar-card">
        <div class="sidebar-title">Giải đấu hàng đầu</div>
        ${topLeagues.map(l => `<a href="/bang-xep-hang/${l.slug}" class="league-link">${l.name}</a>`).join('')}
      </div>
      <div class="sidebar-card">
        <div class="sidebar-title">Truy cập nhanh</div>
        <a href="/lich-thi-dau" class="quick-link">📅 Lịch thi đấu</a>
        <a href="/bang-xep-hang" class="quick-link">🏆 Bảng xếp hạng</a>
        <a href="/soi-keo" class="quick-link">📊 Nhận định</a>
        <a href="/top-ghi-ban" class="quick-link">⚽ Top ghi bàn</a>
      </div>`;

    const sportsEvents = fixtures.slice(0, 10).map(f => ({
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${f.teams?.home?.name || ''} vs ${f.teams?.away?.name || ''}`,
      sport: 'Soccer',
      startDate: f.fixture?.date,
      homeTeam: { '@type': 'SportsTeam', name: f.teams?.home?.name },
      awayTeam: { '@type': 'SportsTeam', name: f.teams?.away?.name },
    }));

    const ldScripts = sportsEvents.map(sd => `<script type="application/ld+json">${JSON.stringify(sd)}</script>`).join('\n  ');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  ${ldScripts}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1923; color: #e2e8f0; min-height: 100vh; }
    a { color: #00D4FF; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .page-wrapper { max-width: 1280px; margin: 0 auto; padding: 16px; }
    .breadcrumb { font-size: 13px; color: #64748b; margin-bottom: 16px; }
    .breadcrumb a { color: #94a3b8; }
    .page-header { background: linear-gradient(135deg, #1a2744, #0d1f3c); padding: 28px 32px; border-radius: 6px; margin-bottom: 16px; }
    .page-header h1 { font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 6px; }
    .page-header .sub { font-size: 14px; color: #94a3b8; }
    .page-header .stats { display: flex; gap: 20px; margin-top: 12px; }
    .page-header .stats span { font-size: 13px; color: #64748b; }
    .page-header .stats strong { color: #00D4FF; }
    .layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; align-items: start; }
    .main { min-width: 0; }
    .sidebar { display: flex; flex-direction: column; gap: 12px; }
    .sidebar-card { background: #1a2744; border-radius: 6px; padding: 16px; }
    .sidebar-title { font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .date-nav { display: flex; flex-wrap: wrap; gap: 6px; }
    .date-link { display: inline-block; padding: 6px 12px; background: #0f1923; border-radius: 4px; font-size: 13px; color: #94a3b8; transition: all 0.15s; }
    .date-link:hover { background: #00D4FF22; color: #00D4FF; text-decoration: none; }
    .date-link.active { background: #00D4FF; color: #0f1923; font-weight: 700; }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ffffff0a; font-size: 14px; color: #94a3b8; }
    .stat-row:last-child { border-bottom: none; }
    .league-link { display: block; padding: 7px 0; font-size: 14px; color: #cbd5e1; border-bottom: 1px solid #ffffff08; }
    .league-link:last-child { border-bottom: none; }
    .league-link:hover { color: #00D4FF; text-decoration: none; }
    .quick-link { display: block; padding: 7px 0; font-size: 14px; color: #cbd5e1; }
    .quick-link:hover { color: #00D4FF; text-decoration: none; }
    .league-section { background: #1a2744; border-radius: 4px; margin-bottom: 12px; overflow: hidden; }
    .league-header { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #0d1f3c; font-weight: 700; font-size: 14px; color: #e2e8f0; }
    .league-header img { width: 20px; height: 20px; object-fit: contain; }
    .league-name { flex: 1; }
    .league-country { font-size: 12px; color: #64748b; font-weight: 400; }
    .match-count { font-size: 12px; color: #64748b; font-weight: 400; }
    .match-row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 10px 16px; border-bottom: 1px solid #ffffff08; transition: background 0.15s; }
    .match-row:last-child { border-bottom: none; }
    .match-row:hover { background: #ffffff06; }
    .match-team { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #cbd5e1; }
    .match-team.home { justify-content: flex-end; text-align: right; }
    .match-team.away { justify-content: flex-start; }
    .match-team.winner { color: #fff; font-weight: 700; }
    .match-team img { width: 22px; height: 22px; object-fit: contain; flex-shrink: 0; }
    .match-score { display: flex; align-items: center; gap: 6px; padding: 4px 14px; min-width: 70px; justify-content: center; }
    .match-score .goal { font-size: 18px; font-weight: 800; color: #fff; min-width: 20px; text-align: center; }
    .match-score .sep { color: #64748b; font-size: 14px; }
    .match-score.draw .goal { color: #94a3b8; }
    .empty-state { text-align: center; padding: 60px 20px; background: #1a2744; border-radius: 4px; }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .empty-state p { color: #94a3b8; font-size: 16px; }
    .empty-sub { font-size: 13px; color: #64748b; margin-top: 8px; }
    .footer { text-align: center; margin-top: 24px; padding: 16px; color: #475569; font-size: 13px; }
    .seo-content { background: #1a2744; border-radius: 4px; padding: 24px; margin-top: 16px; }
    .seo-content h2 { font-size: 18px; font-weight: 700; color: #e2e8f0; margin-bottom: 12px; }
    .seo-content p { font-size: 14px; color: #94a3b8; line-height: 1.7; margin-bottom: 10px; }
    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { order: -1; }
      .page-header { padding: 20px 16px; }
      .page-header h1 { font-size: 20px; }
      .match-team .team-name { font-size: 13px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .match-score .goal { font-size: 16px; }
      .match-score { padding: 4px 8px; min-width: 60px; }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/ket-qua-bong-da">Kết quả</a> &rsaquo;
      <span>${escapeHtml(label)}</span>
    </nav>

    <div class="page-header">
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">Cập nhật tỷ số đầy đủ tất cả các trận đấu</div>
      <div class="stats">
        <span><strong>${matchCount}</strong> trận đấu</span>
        <span><strong>${leagueCount}</strong> giải đấu</span>
      </div>
    </div>

    <div class="layout">
      <div class="main">
        ${matchesHtml}
        <div class="seo-content">
          <h2>Kết quả bóng đá ${escapeHtml(label)}</h2>
          <p>Cập nhật kết quả bóng đá ${escapeHtml(label)} với tỷ số đầy đủ từ tất cả các giải đấu lớn: Ngoại Hạng Anh, La Liga, Serie A, Bundesliga, Champions League, V-League và nhiều giải đấu khác.</p>
          <p>ScoreLine cung cấp tỷ số trực tuyến nhanh nhất, thống kê chi tiết từng trận đấu, hỗ trợ người hâm mộ bóng đá theo dõi kết quả mọi lúc mọi nơi.</p>
        </div>
      </div>
      <aside class="sidebar">
        ${sidebarHtml}
      </aside>
    </div>

    <div class="footer">
      <a href="${SITE_URL}">ScoreLine.io</a> - Cập nhật tỷ số trực tiếp, lịch thi đấu và phân tích bóng đá
    </div>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(html);
  } catch (error) {
    console.error('[SEO Content] Error rendering ket-qua:', error);
    res.status(500).send(render500());
  }
});

module.exports = router;
