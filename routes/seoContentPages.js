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
let thumbnailGenerator;
try { thumbnailGenerator = require('../services/thumbnail-generator'); } catch (e) { /* canvas not installed */ }

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

function formatDateShort(date) {
  if (!date) return '';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} | ${hh}:${min}`;
}

function generateMatchBanner({ homeName, homeLogo, awayName, awayLogo, leagueName, leagueLogo, matchDate }) {
  const dateStr = formatDateShort(matchDate);
  return `
  <div class="match-card">
    <div class="match-card-bg"></div>
    <div class="match-card-content">
      <div class="mc-team mc-home">
        <div class="mc-logo-wrap home-accent">
          ${homeLogo ? `<img src="${escapeHtml(homeLogo)}" alt="${escapeHtml(homeName)}">` : '<div class="mc-logo-placeholder">⚽</div>'}
        </div>
        <div class="mc-name">${escapeHtml(homeName)}</div>
      </div>
      <div class="mc-center">
        <div class="mc-vs">VS</div>
        <div class="mc-date">${escapeHtml(dateStr)}</div>
        ${leagueName ? `<div class="mc-league">${leagueLogo ? `<img src="${escapeHtml(leagueLogo)}" alt="">` : ''}${escapeHtml(leagueName)}</div>` : ''}
      </div>
      <div class="mc-team mc-away">
        <div class="mc-logo-wrap away-accent">
          ${awayLogo ? `<img src="${escapeHtml(awayLogo)}" alt="${escapeHtml(awayName)}">` : '<div class="mc-logo-placeholder">⚽</div>'}
        </div>
        <div class="mc-name">${escapeHtml(awayName)}</div>
      </div>
    </div>
  </div>`;
}

function markdownToHtml(text) {
  if (!text) return '';

  // Split by double newlines into blocks
  const blocks = text.split(/\n\n+/);
  const htmlBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // Headings
    if (/^#{4,6}\s+/.test(trimmed)) return trimmed.replace(/^#{4,6}\s+(.+)$/gm, '<h4>$1</h4>');
    if (/^###\s+/.test(trimmed)) return trimmed.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    if (/^##\s+/.test(trimmed)) return trimmed.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    if (/^#\s+/.test(trimmed)) return trimmed.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');

    // List block
    if (/^- /.test(trimmed)) {
      const items = trimmed.replace(/^- (.+)$/gm, '<li>$1</li>');
      return '<ul>' + items + '</ul>';
    }

    // Regular paragraph
    let html = trimmed
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  });

  // Apply inline formatting to headings and lists too
  return htmlBlocks.join('\n')
    .replace(/<(h[234]|li)>(.*?)<\/\1>/g, (match, tag, content) => {
      const formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      return `<${tag}>${formatted}</${tag}>`;
    });
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
// Helper: Build sidebar with related articles
// ============================================================
async function buildSidebar(currentSlug, currentType) {
  let previewArticles = [];
  let h2hArticles = [];
  let soiKeoArticles = [];

  try {
    const SoiKeoArticle = require('../models/SoiKeoArticle');
    [previewArticles, h2hArticles, soiKeoArticles] = await Promise.all([
      AutoArticle.find({ type: 'round-preview', status: 'published', slug: { $ne: currentSlug } })
        .sort({ createdAt: -1 }).limit(5).select('slug title leagueInfo.name createdAt').lean(),
      AutoArticle.find({ type: 'h2h-analysis', status: 'published', slug: { $ne: currentSlug } })
        .sort({ createdAt: -1 }).limit(5).select('slug title matchInfo.homeTeam matchInfo.awayTeam createdAt').lean(),
      SoiKeoArticle.find({ status: 'published' })
        .sort({ createdAt: -1 }).limit(5).select('slug title matchInfo.homeTeam matchInfo.awayTeam').lean(),
    ]);
  } catch (e) { /* ignore */ }

  const renderList = (items, type) => items.map(a => {
    const href = type === 'preview' ? `/preview/${a.slug}` : type === 'h2h' ? `/doi-dau/${a.slug}` : `/soi-keo/${a.slug}`;
    const subtitle = type === 'preview' ? (a.leagueInfo?.name || '') :
      `${a.matchInfo?.homeTeam?.name || ''} vs ${a.matchInfo?.awayTeam?.name || ''}`;
    return `<a href="${href}" class="sidebar-article">
      <span class="sidebar-article-title">${escapeHtml(a.title?.substring(0, 60) || '')}</span>
      <span class="sidebar-article-sub">${escapeHtml(subtitle)}</span>
    </a>`;
  }).join('');

  return `
    <div class="sidebar-card">
      <div class="sidebar-title">📋 Preview Vòng Đấu</div>
      ${previewArticles.length ? renderList(previewArticles, 'preview') : '<span class="sidebar-empty">Chưa có bài</span>'}
    </div>
    <div class="sidebar-card">
      <div class="sidebar-title">⚔️ Đối Đầu</div>
      ${h2hArticles.length ? renderList(h2hArticles, 'h2h') : '<span class="sidebar-empty">Chưa có bài</span>'}
    </div>
    <div class="sidebar-card">
      <div class="sidebar-title">📊 Nhận Định Mới Nhất</div>
      ${soiKeoArticles.length ? renderList(soiKeoArticles, 'soikeo') : '<span class="sidebar-empty">Chưa có bài</span>'}
    </div>
    <div class="sidebar-card">
      <div class="sidebar-title">🔗 Truy Cập Nhanh</div>
      <a href="/lich-thi-dau" class="quick-link">📅 Lịch thi đấu</a>
      <a href="/bang-xep-hang" class="quick-link">🏆 Bảng xếp hạng</a>
      <a href="/ket-qua-bong-da" class="quick-link">⚽ Kết quả</a>
      <a href="/top-ghi-ban" class="quick-link">🥇 Top ghi bàn</a>
    </div>`;
}

// ============================================================
// Shared dark layout for article pages (preview + h2h)
// ============================================================
function renderArticlePage({ title, description, url, breadcrumbItems, bannerHtml, headerHtml, bodyHtml, sidebarHtml, structuredData }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const ldScripts = (Array.isArray(structuredData) ? structuredData : [structuredData])
    .filter(Boolean).map(sd => `<script type="application/ld+json">${JSON.stringify(sd)}</script>`).join('\n  ');

  const breadcrumb = breadcrumbItems.map((b, i) =>
    i < breadcrumbItems.length - 1
      ? `<a href="${b.url}">${escapeHtml(b.name)}</a>`
      : `<span>${escapeHtml(b.name)}</span>`
  ).join(' &rsaquo; ');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${safeTitle} | ScoreLine</title>
  <meta name="description" content="${safeDesc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  ${ldScripts}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; min-height: 100vh; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .page-wrapper { max-width: 1280px; margin: 0 auto; padding: 16px; }
    .breadcrumb { font-size: 13px; color: #64748b; margin-bottom: 12px; }
    .breadcrumb a { color: #2563eb; }
    .page-header { background: linear-gradient(135deg, #1e3a5f, #0f2744); padding: 24px 32px; border-radius: 6px; margin-bottom: 16px; text-align: center; color: #fff; }
    .page-header h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; line-height: 1.3; }
    .match-card { position: relative; margin: 16px 0; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, #0b3d91 0%, #1565c0 40%, #0d47a1 100%); }
    .match-card-bg { position: absolute; inset: 0; opacity: 0.08; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='28' stroke='white' stroke-width='1' fill='none'/%3E%3Cline x1='30' y1='2' x2='30' y2='58' stroke='white' stroke-width='0.5'/%3E%3Cline x1='2' y1='30' x2='58' y2='30' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E") repeat; }
    .match-card-content { position: relative; display: flex; align-items: center; justify-content: center; padding: 28px 20px; gap: 16px; }
    .mc-team { flex: 1; text-align: center; max-width: 220px; }
    .mc-logo-wrap { width: 90px; height: 90px; margin: 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; }
    .mc-logo-wrap.home-accent { background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); }
    .mc-logo-wrap.home-accent::before { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(236,72,153,0.4); }
    .mc-logo-wrap.away-accent { background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); }
    .mc-logo-wrap.away-accent::before { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(251,191,36,0.4); }
    .mc-logo-wrap img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); }
    .mc-logo-placeholder { font-size: 40px; }
    .mc-name { font-size: 16px; font-weight: 800; color: #fff; margin-top: 10px; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    .mc-center { text-align: center; min-width: 160px; }
    .mc-vs { font-size: 36px; font-weight: 900; color: #fbbf24; text-shadow: 0 2px 10px rgba(251,191,36,0.4); letter-spacing: 4px; }
    .mc-date { background: rgba(0,0,0,0.3); padding: 6px 16px; border-radius: 4px; font-size: 13px; color: #e2e8f0; margin-top: 8px; display: inline-block; font-weight: 600; }
    .mc-league { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; font-size: 13px; color: #94a3b8; }
    .mc-league img { width: 18px; height: 18px; object-fit: contain; }
    .league-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.12); padding: 6px 14px; border-radius: 4px; font-size: 14px; margin-top: 10px; color: #e2e8f0; }
    .league-badge img { width: 20px; height: 20px; object-fit: contain; }
    .subtitle { font-size: 14px; color: #94a3b8; margin-top: 8px; }
    .h2h-stats { display: flex; gap: 10px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
    .h2h-stat { background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 4px; font-size: 13px; color: #e2e8f0; text-align: center; }
    .h2h-stat strong { color: #fbbf24; font-size: 20px; display: block; }
    .h2h-stat small { color: #94a3b8; }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
    .main { min-width: 0; }
    .article-body { background: #fff; border-radius: 6px; padding: 32px; line-height: 1.8; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .article-body h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 28px 0 14px; padding-bottom: 8px; border-bottom: 3px solid #2563eb; }
    .article-body h2:first-child { margin-top: 0; }
    .article-body h3 { font-size: 17px; font-weight: 700; color: #1e293b; margin: 20px 0 10px; }
    .article-body p { margin-bottom: 14px; color: #334155; font-size: 15px; }
    .article-body ul, .article-body ol { margin: 12px 0; padding-left: 24px; }
    .article-body li { margin-bottom: 6px; color: #334155; font-size: 15px; }
    .article-body strong { color: #0f172a; }
    .article-body em { color: #2563eb; font-style: normal; }
    .tags { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 3px; font-size: 12px; }
    .sidebar { display: flex; flex-direction: column; gap: 12px; }
    .sidebar-card { background: #fff; border-radius: 6px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .sidebar-title { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .sidebar-article { display: block; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .sidebar-article:last-child { border-bottom: none; }
    .sidebar-article:hover { text-decoration: none; }
    .sidebar-article-title { display: block; font-size: 13px; color: #1e293b; line-height: 1.4; }
    .sidebar-article:hover .sidebar-article-title { color: #2563eb; }
    .sidebar-article-sub { display: block; font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .sidebar-empty { font-size: 13px; color: #94a3b8; }
    .quick-link { display: block; padding: 7px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9; }
    .quick-link:last-child { border-bottom: none; }
    .quick-link:hover { color: #2563eb; text-decoration: none; }
    .footer { text-align: center; margin-top: 24px; padding: 16px; color: #94a3b8; font-size: 13px; }
    .footer a { color: #2563eb; }
    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { order: 2; }
      .page-header { padding: 20px 16px; }
      .page-header h1 { font-size: 20px; }
      .article-body { padding: 20px 16px; }
      .mc-logo-wrap { width: 70px; height: 70px; }
      .mc-logo-wrap img { width: 48px; height: 48px; }
      .mc-name { font-size: 14px; }
      .mc-vs { font-size: 28px; }
      .mc-center { min-width: 120px; }
      .mc-date { font-size: 11px; padding: 4px 10px; }
      .match-card-content { padding: 20px 12px; gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <nav class="breadcrumb">${breadcrumb}</nav>
    ${bannerHtml || ''}
    <div class="page-header">${headerHtml}</div>
    <div class="layout">
      <main class="main">
        <article class="article-body">${bodyHtml}</article>
      </main>
      <aside class="sidebar">${sidebarHtml}</aside>
    </div>
    <div class="footer">
      <a href="${SITE_URL}">ScoreLine.io</a> - Cập nhật tỷ số trực tiếp, lịch thi đấu và phân tích bóng đá
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

    AutoArticle.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    // Generate thumbnail
    let thumbUrl = `${SITE_URL}/og-image.jpg`;
    if (thumbnailGenerator) {
      try {
        const tp = await thumbnailGenerator.generateForPreview(article);
        if (tp) thumbUrl = `${SITE_URL}${tp}`;
      } catch (e) { /* ignore */ }
    }

    const url = `${SITE_URL}/preview/${article.slug}`;
    const title = article.metaTitle || article.title;
    const description = article.metaDescription || article.excerpt || '';
    const leagueName = article.leagueInfo?.name || '';
    const leagueLogo = article.leagueInfo?.logo || '';
    const round = article.round || '';

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      url,
      datePublished: article.createdAt,
      dateModified: article.updatedAt || article.createdAt,
      author: { '@type': 'Organization', name: 'ScoreLine', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'ScoreLine', logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg` } },
      image: thumbUrl,
      mainEntityOfPage: url,
    };

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      <div class="match-banner">
        ${leagueLogo ? `<img src="${escapeHtml(leagueLogo)}" alt="${escapeHtml(leagueName)}" style="width:64px;height:64px;object-fit:contain;">` : ''}
        <div>
          <div style="font-size:20px;font-weight:800;color:#fff;">${escapeHtml(leagueName)}</div>
          <div style="font-size:14px;color:#00D4FF;margin-top:4px;">${escapeHtml(round)} &bull; Mùa giải ${article.seasonYear || 2025}/${(article.seasonYear || 2025) + 1}</div>
        </div>
      </div>`;

    const bodyHtml = `
      ${article.content ? markdownToHtml(article.content) : ''}
      ${article.tags?.length ? `<div class="tags">${article.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}`;

    const sidebarHtml = await buildSidebar(article.slug, 'round-preview');

    const bannerImgHtml = thumbUrl !== `${SITE_URL}/og-image.jpg`
      ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(title)}" style="width:100%;height:auto;display:block;border-radius:6px;margin-bottom:16px;" loading="eager">`
      : '';

    const html = renderArticlePage({
      title, description, url,
      breadcrumbItems: [
        { name: 'Trang chủ', url: '/' },
        { name: 'Preview', url: '/soi-keo' },
        { name: `${leagueName} ${round}`, url },
      ],
      bannerHtml: bannerImgHtml,
      headerHtml, bodyHtml, sidebarHtml, structuredData,
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

    // Generate thumbnail
    let thumbUrl = `${SITE_URL}/og-image.jpg`;
    if (thumbnailGenerator) {
      try {
        const tp = await thumbnailGenerator.generateForH2H(article);
        if (tp) thumbUrl = `${SITE_URL}${tp}`;
      } catch (e) { /* ignore */ }
    }

    const { matchInfo, h2hStats } = article;
    const homeName = matchInfo?.homeTeam?.name || '';
    const awayName = matchInfo?.awayTeam?.name || '';
    const homeLogo = matchInfo?.homeTeam?.logo || '';
    const awayLogo = matchInfo?.awayTeam?.logo || '';
    const url = `${SITE_URL}/doi-dau/${article.slug}`;
    const title = article.metaTitle || article.title;
    const description = article.metaDescription || article.excerpt || '';

    const articleSchema = {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: article.title, description, url,
      datePublished: article.createdAt, dateModified: article.updatedAt || article.createdAt,
      author: { '@type': 'Organization', name: 'ScoreLine', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'ScoreLine', logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg` } },
      image: thumbUrl, mainEntityOfPage: url,
    };

    const sportsEventSchema = {
      '@context': 'https://schema.org', '@type': 'SportsEvent',
      name: `${homeName} vs ${awayName}`, sport: 'Soccer',
      startDate: matchInfo?.matchDate,
      homeTeam: { '@type': 'SportsTeam', name: homeName, image: homeLogo },
      awayTeam: { '@type': 'SportsTeam', name: awayName, image: awayLogo },
    };

    const total = h2hStats?.totalMatches || 0;
    const homeW = h2hStats?.homeWins || 0;
    const draws = h2hStats?.draws || 0;
    const awayW = h2hStats?.awayWins || 0;
    const homePct = total ? Math.round((homeW / total) * 100) : 0;
    const drawPct = total ? Math.round((draws / total) * 100) : 0;
    const awayPct = total ? Math.round((awayW / total) * 100) : 0;

    const bannerHtml = generateMatchBanner({
      homeName, homeLogo, awayName, awayLogo,
      leagueName: matchInfo?.league?.name || '',
      leagueLogo: matchInfo?.league?.logo || '',
      matchDate: matchInfo?.matchDate,
    });

    const headerHtml = `
      <h1>${escapeHtml(title)}</h1>
      ${total > 0 ? `
      <div class="h2h-stats">
        <div class="h2h-stat"><strong>${total}</strong>Tổng trận</div>
        <div class="h2h-stat"><strong>${homeW}</strong>${escapeHtml(homeName)}<br><small>${homePct}%</small></div>
        <div class="h2h-stat"><strong>${draws}</strong>Hòa<br><small>${drawPct}%</small></div>
        <div class="h2h-stat"><strong>${awayW}</strong>${escapeHtml(awayName)}<br><small>${awayPct}%</small></div>
        ${h2hStats?.avgGoals ? `<div class="h2h-stat"><strong>${h2hStats.avgGoals.toFixed(1)}</strong>TB bàn/trận</div>` : ''}
      </div>
      <div style="margin-top:12px;height:6px;display:flex;border-radius:3px;overflow:hidden;">
        <div style="width:${homePct}%;background:#3b82f6;"></div>
        <div style="width:${drawPct}%;background:#94a3b8;"></div>
        <div style="width:${awayPct}%;background:#ef4444;"></div>
      </div>` : ''}`;

    const bodyHtml = `
      ${article.content ? markdownToHtml(article.content) : ''}
      ${article.tags?.length ? `<div class="tags">${article.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}`;

    const sidebarHtml = await buildSidebar(article.slug, 'h2h-analysis');

    const h2hBannerHtml = thumbUrl !== `${SITE_URL}/og-image.jpg`
      ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(title)}" style="width:100%;height:auto;display:block;border-radius:6px;margin-bottom:16px;" loading="eager">`
      : (bannerHtml || '');

    const html = renderArticlePage({
      title, description, url,
      breadcrumbItems: [
        { name: 'Trang chủ', url: '/' },
        { name: 'Đối đầu', url: '/soi-keo' },
        { name: `${homeName} vs ${awayName}`, url },
      ],
      bannerHtml: h2hBannerHtml, headerHtml, bodyHtml, sidebarHtml,
      structuredData: [articleSchema, sportsEventSchema, {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": `${homeName} vs ${awayName} - Lịch sử đối đầu?`,
            "acceptedAnswer": { "@type": "Answer", "text": `Trong ${total} trận gần nhất: ${homeName} thắng ${homeW}, hòa ${draws}, ${awayName} thắng ${awayW}.${h2hStats?.avgGoals ? ` Trung bình ${h2hStats.avgGoals.toFixed(1)} bàn/trận.` : ''}` } },
          { "@type": "Question", "name": `${homeName} vs ${awayName} đá khi nào?`,
            "acceptedAnswer": { "@type": "Answer", "text": `Trận ${homeName} vs ${awayName} thuộc ${matchInfo?.league?.name || ''} diễn ra vào ${formatDate(matchInfo?.matchDate)}.` } },
          { "@type": "Question", "name": `Ai có lợi thế trong ${homeName} vs ${awayName}?`,
            "acceptedAnswer": { "@type": "Answer", "text": homeW > awayW ? `${homeName} có lợi thế với ${homeW} chiến thắng trong ${total} trận gần nhất (${homePct}%).` : awayW > homeW ? `${awayName} có lợi thế với ${awayW} chiến thắng trong ${total} trận gần nhất (${awayPct}%).` : `Hai đội khá cân bằng với ${homeW} thắng mỗi bên trong ${total} trận gần nhất.` } },
        ],
      }],
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
