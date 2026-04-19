/**
 * SEO Pages - Server-side rendered HTML for search engine crawlers
 *
 * Serves full HTML pages with content for:
 * - /soi-keo/:slug → Match analysis article
 * - /tran-dau/:id  → Match detail page
 *
 * Google gets complete HTML with content, meta tags, structured data.
 * Regular users get the SPA (handled by Nginx try_files).
 */

const express = require('express');
const router = express.Router();
const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');
let thumbnailGenerator;
try { thumbnailGenerator = require('../services/thumbnail-generator'); } catch (e) { /* canvas not installed */ }

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

function generateFaqSchema(matchInfo, content, oddsData) {
  const home = matchInfo?.homeTeam?.name || '';
  const away = matchInfo?.awayTeam?.name || '';
  const league = matchInfo?.league?.name || '';
  const date = matchInfo?.matchDate ? new Date(matchInfo.matchDate).toLocaleDateString('vi-VN') : '';

  const faqs = [
    {
      question: `${home} vs ${away} đá khi nào?`,
      answer: `Trận ${home} vs ${away} thuộc ${league} diễn ra vào ngày ${date}.`,
    },
    {
      question: `Phân tích phong độ ${home} vs ${away}?`,
      answer: content?.formAnalysis ? content.formAnalysis.substring(0, 300) + '...' : `Xem phân tích chi tiết phong độ ${home} vs ${away} trong bài viết.`,
    },
    {
      question: `Dự đoán kết quả ${home} vs ${away}?`,
      answer: content?.prediction ? content.prediction.substring(0, 300) + '...' : `Xem dự đoán chi tiết trận ${home} vs ${away} trong bài viết.`,
    },
  ];

  if (oddsData?.homeWin) {
    faqs.push({
      question: `Tỷ lệ odds ${home} vs ${away}?`,
      answer: `Tỷ lệ 1X2: ${home} (${oddsData.homeWin}) - Hòa (${oddsData.draw || '-'}) - ${away} (${oddsData.awayWin || '-'}).${oddsData.overUnder?.line ? ` Tài/Xỉu: ${oddsData.overUnder.line} bàn.` : ''}`,
    });
  }

  if (content?.h2hHistory) {
    faqs.push({
      question: `Lịch sử đối đầu ${home} vs ${away}?`,
      answer: content.h2hHistory.substring(0, 300) + '...',
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
      },
    })),
  };
}

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

const siteHeader = require('../utils/siteHeader');

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

function renderSoiKeoHtml(article, thumbnailUrl) {
  const { matchInfo, content, oddsData } = article;
  const title = escapeHtml(article.metaTitle || article.title);
  const description = escapeHtml(article.metaDescription || article.excerpt);
  const url = `${SITE_URL}/soi-keo/${article.slug}`;
  const matchDate = formatDate(matchInfo?.matchDate);
  const homeName = escapeHtml(matchInfo?.homeTeam?.name || '');
  const awayName = escapeHtml(matchInfo?.awayTeam?.name || '');
  const homeLogo = matchInfo?.homeTeam?.logo ? escapeHtml(matchInfo.homeTeam.logo) : '';
  const awayLogo = matchInfo?.awayTeam?.logo ? escapeHtml(matchInfo.awayTeam.logo) : '';
  const leagueName = escapeHtml(matchInfo?.league?.name || '');
  const leagueLogo = matchInfo?.league?.logo ? escapeHtml(matchInfo.league.logo) : '';

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.excerpt,
    "url": url,
    "datePublished": article.createdAt,
    "dateModified": article.updatedAt || article.createdAt,
    "author": {
      "@type": "Organization",
      "name": "ScoreLine",
      "url": SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": "ScoreLine",
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/og-image.jpg`
      }
    },
    "image": thumbnailUrl || article.thumbnail || `${SITE_URL}/og-image.jpg`,
    "mainEntityOfPage": url
  };

  const sportsEventData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${matchInfo?.homeTeam?.name} vs ${matchInfo?.awayTeam?.name}`,
    "sport": "Soccer",
    "startDate": matchInfo?.matchDate,
    "homeTeam": {
      "@type": "SportsTeam",
      "name": matchInfo?.homeTeam?.name,
      "image": matchInfo?.homeTeam?.logo
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": matchInfo?.awayTeam?.name,
      "image": matchInfo?.awayTeam?.logo
    },
    "location": {
      "@type": "Place",
      "name": matchInfo?.venue || matchInfo?.league?.name
    }
  };

  // Build odds HTML
  let oddsHtml = '';
  if (oddsData) {
    const oddsGroups = [];
    if (oddsData.homeWin) {
      oddsGroups.push(`
        <div class="odds-group">
          <div class="odds-group-label">1X2</div>
          <div class="odds-chips">
            <span class="odds-chip"><em>1</em>${oddsData.homeWin}</span>
            <span class="odds-chip"><em>X</em>${oddsData.draw || '-'}</span>
            <span class="odds-chip"><em>2</em>${oddsData.awayWin || '-'}</span>
          </div>
        </div>`);
    }
    if (oddsData.handicap?.line) {
      oddsGroups.push(`
        <div class="odds-group">
          <div class="odds-group-label">Chấp ${oddsData.handicap.line}</div>
          <div class="odds-chips">
            <span class="odds-chip"><em>Chủ</em>${oddsData.handicap.home?.toFixed(2) || '-'}</span>
            <span class="odds-chip"><em>Khách</em>${oddsData.handicap.away?.toFixed(2) || '-'}</span>
          </div>
        </div>`);
    }
    if (oddsData.overUnder?.line) {
      oddsGroups.push(`
        <div class="odds-group">
          <div class="odds-group-label">T/X ${oddsData.overUnder.line}</div>
          <div class="odds-chips">
            <span class="odds-chip odds-over"><em>Tài</em>${oddsData.overUnder.over?.toFixed(2) || '-'}</span>
            <span class="odds-chip odds-under"><em>Xỉu</em>${oddsData.overUnder.under?.toFixed(2) || '-'}</span>
          </div>
        </div>`);
    }
    if (oddsGroups.length) {
      oddsHtml = `<div class="odds-panel">${oddsGroups.join('')}</div>`;
    }
  }

  // Build content sections
  const sections = [];
  if (content?.introduction || content?.teamAnalysis) {
    sections.push(`
      <div class="section-card">
        <h2><span class="section-icon">⚽</span> Phong độ và lực lượng ${homeName} vs ${awayName}</h2>
        ${content?.introduction ? markdownToHtml(content.introduction) : ''}
        ${content?.teamAnalysis ? `<div class="section-divider"></div>${markdownToHtml(content.teamAnalysis)}` : ''}
      </div>`);
  }
  if (content?.h2hHistory) {
    sections.push(`
      <div class="section-card">
        <h2><span class="section-icon">🏆</span> Lịch sử đối đầu ${homeName} vs ${awayName}</h2>
        ${markdownToHtml(content.h2hHistory)}
      </div>`);
  }
  if (content?.formAnalysis) {
    sections.push(`
      <div class="section-card">
        <h2><span class="section-icon">📈</span> Phong độ gần đây</h2>
        ${markdownToHtml(content.formAnalysis)}
      </div>`);
  }
  if (content?.oddsAnalysis) {
    sections.push(`
      <div class="section-card">
        <h2><span class="section-icon">💹</span> Nhận định kèo ${homeName} vs ${awayName}</h2>
        ${markdownToHtml(content.oddsAnalysis)}
      </div>`);
  }
  if (content?.prediction) {
    sections.push(`
      <div class="section-card prediction-card">
        <h2><span class="section-icon">🎯</span> Dự đoán kết quả</h2>
        ${markdownToHtml(content.prediction)}
      </div>`);
  }
  if (content?.bettingTips) {
    sections.push(`
      <div class="section-card tips-card">
        <h2><span class="section-icon">🔥</span> Kèo khuyên chọn</h2>
        ${markdownToHtml(content.bettingTips)}
      </div>`);
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${title} | ScoreLine</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${escapeHtml(thumbnailUrl || SITE_URL + '/og-image.jpg')}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(thumbnailUrl || SITE_URL + '/og-image.jpg')}">

  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  <script type="application/ld+json">${JSON.stringify(sportsEventData)}</script>
  <script type="application/ld+json">${JSON.stringify(generateFaqSchema(matchInfo, content, oddsData))}</script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #1e293b; background: #f1f5f9; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container { max-width: 1280px; margin: 0 auto; padding: 16px; }
    .breadcrumb { font-size: 13px; color: #64748b; margin-bottom: 12px; }
    .breadcrumb a { color: #2563eb; }

    /* League Bar */
    .league-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .league-bar img { width: 24px; height: 24px; object-fit: contain; }
    .league-bar span { font-size: 13px; font-weight: 600; color: #64748b; }

    /* Match Card - Light Theme */
    .match-card { background: #fff; border-radius: 12px; padding: 24px 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; text-align: center; }
    .match-teams { display: flex; align-items: center; justify-content: center; gap: 16px; }
    .match-team { flex: 1; max-width: 180px; text-align: center; }
    .match-team img { width: 64px; height: 64px; object-fit: contain; }
    .team-name { font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 8px; }
    .match-vs { text-align: center; min-width: 80px; }
    .match-time { font-size: 28px; font-weight: 800; color: #0066FF; letter-spacing: 1px; }
    .match-date { font-size: 12px; color: #94a3b8; margin-top: 4px; }

    /* Article Header */
    .article-header { margin-bottom: 16px; }
    .article-header h1 { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.4; margin-bottom: 8px; }
    .article-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #94a3b8; flex-wrap: wrap; }

    /* Excerpt */
    .excerpt { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
    .excerpt p { font-size: 14px; color: #475569; margin: 0; line-height: 1.7; }

    /* Odds Panel - Light */
    .odds-panel { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 12px; }
    .odds-group { text-align: center; }
    .odds-group-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .odds-chips { display: flex; gap: 4px; }
    .odds-chip { display: flex; align-items: center; gap: 4px; background: #fff; padding: 5px 10px; border-radius: 6px; font-size: 13px; font-weight: 700; color: #0066FF; border: 1px solid #e2e8f0; }
    .odds-chip em { font-style: normal; font-size: 10px; color: #94a3b8; font-weight: 600; }
    .odds-over { border-color: #bbf7d0; color: #16a34a; background: #f0fdf4; }
    .odds-under { border-color: #fecaca; color: #dc2626; background: #fef2f2; }

    /* Layout */
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
    .main { min-width: 0; }

    /* Section Cards */
    .section-card { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 16px; border-left: 4px solid #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .section-card h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 14px; padding: 0; border-bottom: none; display: flex; align-items: center; gap: 8px; }
    .section-card h3 { font-size: 17px; font-weight: 700; color: #1e293b; margin: 18px 0 8px; }
    .section-card p { margin-bottom: 12px; color: #334155; font-size: 15px; }
    .section-card ul { margin: 12px 0; padding-left: 24px; }
    .section-card li { margin-bottom: 6px; color: #334155; font-size: 15px; }
    .section-card strong { color: #0f172a; }
    .section-card em { color: #2563eb; font-style: normal; }
    .section-icon { font-size: 20px; flex-shrink: 0; }
    .section-divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
    .prediction-card { border-left-color: #16a34a; background: linear-gradient(135deg, #f0fdf4, #fff); }
    .tips-card { border-left-color: #f59e0b; background: linear-gradient(135deg, #fffbeb, #fff); }

    /* Related Links */
    .related-box { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .related-box h3 { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
    .related-links { display: flex; flex-wrap: wrap; gap: 6px; }
    .related-links a { display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 13px; text-decoration: none; }

    /* Tags */
    .tags { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 3px; font-size: 12px; }

    /* Sidebar */
    .sidebar { display: flex; flex-direction: column; gap: 12px; }
    .sidebar-card { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .sidebar-title { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .sidebar-article { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-decoration: none; }
    .sidebar-article:last-child { border-bottom: none; }
    .sidebar-article:hover { text-decoration: none; }
    .sidebar-thumb { width: 60px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0; background: #f1f5f9; }
    .sidebar-logos { width: 60px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 2px; background: #f1f5f9; border-radius: 4px; padding: 4px; }
    .sidebar-logos img { width: 18px; height: 18px; object-fit: contain; }
    .sidebar-info { flex: 1; min-width: 0; }
    .sidebar-article-title { display: block; font-size: 13px; color: #1e293b; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .sidebar-article:hover .sidebar-article-title { color: #2563eb; }
    .sidebar-article-sub { display: block; font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .sidebar-link { display: block; padding: 7px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9; text-decoration: none; }
    .sidebar-link:last-child { border-bottom: none; }
    .sidebar-link:hover { color: #2563eb; text-decoration: none; }

    /* Author */
    .author-box { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; gap: 12px; align-items: center; }
    .author-avatar { width: 48px; height: 48px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
    .author-name { font-size: 14px; font-weight: 700; color: #0f172a; }
    .author-bio { font-size: 13px; color: #64748b; margin-top: 2px; }

    /* Footer */
    .footer { text-align: center; margin-top: 24px; padding: 16px; color: #94a3b8; font-size: 13px; }
    .footer a { color: #2563eb; }

    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { order: 2; }
      .container { padding: 10px; }
      .match-card { padding: 16px 12px; }
      .match-team img { width: 48px; height: 48px; }
      .team-name { font-size: 13px; }
      .match-time { font-size: 22px; }
      .match-vs { min-width: 60px; }
      .article-header h1 { font-size: 19px; }
      .section-card { padding: 16px 14px; }
      .section-card h2 { font-size: 18px; }
      .odds-panel { gap: 6px; }
      .odds-chip { padding: 4px 8px; font-size: 12px; }
    }
  </style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/soi-keo">Nhận định bóng đá</a> &rsaquo;
      <span>${homeName} vs ${awayName}</span>
    </nav>

    <!-- Article Header -->
    <div class="article-header">
      <h1>${title}</h1>
      <div class="article-meta">
        <span>📅 ${escapeHtml(matchDate)}</span>
        <span>👁 ${article.views?.toLocaleString() || 0} lượt xem</span>
      </div>
    </div>

    ${thumbnailUrl ? `<div style="margin-bottom:16px;"><img src="${escapeHtml(thumbnailUrl)}" alt="${title}" style="width:100%;height:auto;display:block;border-radius:8px;" loading="eager"></div>` : ''}

    <!-- Excerpt -->
    ${article.excerpt ? `<div class="excerpt"><p>${escapeHtml(article.excerpt)}</p></div>` : ''}

    <div class="layout">
      <main class="main">
        ${sections.join('\n')}

        ${article.tags?.length ? `
        <div class="section-card" style="border-left-color:#94a3b8;">
          <div class="tags">
            ${article.tags.map(tag => `<a href="/soi-keo?tag=${encodeURIComponent(tag)}" class="tag">${escapeHtml(tag)}</a>`).join('')}
          </div>
        </div>` : ''}

        <div class="related-box">
          <h3>Xem thêm</h3>
          <div class="related-links">
            RELATED_LINKS_PLACEHOLDER
          </div>
        </div>

        <div class="author-box">
          <div class="author-avatar">🤖</div>
          <div>
            <div class="author-name"><a href="/about">Scoreline AI</a></div>
            <div class="author-bio">Hệ thống AI phân tích 500+ trận đấu mỗi tuần, kết hợp dữ liệu phong độ và lịch sử đối đầu.</div>
          </div>
        </div>
      </main>

      <aside class="sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">📊 Nhận Định Mới</div>
          SIDEBAR_SOIKEO_PLACEHOLDER
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">⚔️ Đối Đầu</div>
          SIDEBAR_H2H_PLACEHOLDER
        </div>
        <div class="sidebar-card">
          <div class="sidebar-title">🔗 Truy Cập Nhanh</div>
          <a href="/nhan-dinh" class="sidebar-link">Nhận Định Bóng Đá</a>
          <a href="/lich-thi-dau" class="sidebar-link">Lịch Thi Đấu</a>
          <a href="/bang-xep-hang" class="sidebar-link">Bảng Xếp Hạng</a>
          <a href="/ket-qua-bong-da" class="sidebar-link">Kết Quả</a>
          <a href="/top-ghi-ban" class="sidebar-link">Top Ghi Bàn</a>
          <a href="/world-cup-2026" class="sidebar-link">🏆 World Cup 2026</a>
        </div>
      </aside>
    </div>

    <div class="footer">
      <p><a href="${SITE_URL}">ScoreLine.io</a> - Cập nhật tỷ số trực tiếp, lịch thi đấu và phân tích bóng đá</p>
    </div>
  </div>
</body>
</html>`;
}

// ========================================
// GET /soi-keo/:slug - Serve full HTML page
// ========================================
router.get('/soi-keo/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await SoiKeoArticle.findOne({
      slug,
      status: 'published'
    }).lean();

    if (!article) {
      return res.status(404).send(`<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Không tìm thấy bài viết | ScoreLine</title>
<meta name="robots" content="noindex"></head>
<body><h1>Bài viết không tồn tại</h1><p><a href="/soi-keo">Xem tất cả nhận định bóng đá</a></p></body>
</html>`);
    }

    // Increment views
    await SoiKeoArticle.updateOne({ slug }, { $inc: { views: 1 } });

    // Generate thumbnail if canvas available
    let thumbnailUrl = article.thumbnail || `${SITE_URL}/og-image.jpg`;
    if (thumbnailGenerator) {
      try {
        const thumbPath = await thumbnailGenerator.generateForSoiKeo(article);
        if (thumbPath) thumbnailUrl = `${SITE_URL}${thumbPath}`;
      } catch (e) { /* ignore */ }
    }

    // Find related articles for internal linking
    let relatedLinks = '';
    try {
      const [h2hArticle, recentSoiKeo, recentPreview] = await Promise.all([
        AutoArticle.findOne({
          type: 'h2h-analysis',
          'matchInfo.homeTeam.name': article.matchInfo?.homeTeam?.name,
          'matchInfo.awayTeam.name': article.matchInfo?.awayTeam?.name,
          status: 'published',
        }).select('slug title').lean(),
        SoiKeoArticle.find({ status: 'published', slug: { $ne: slug } })
          .sort({ createdAt: -1 }).limit(3).select('slug title').lean(),
        AutoArticle.find({ type: 'round-preview', status: 'published' })
          .sort({ createdAt: -1 }).limit(2).select('slug title').lean(),
      ]);

      const links = [];
      if (h2hArticle) {
        links.push(`<a href="/doi-dau/${h2hArticle.slug}" style="display:inline-block;padding:6px 12px;background:#eff6ff;color:#2563eb;border-radius:4px;font-size:13px;text-decoration:none;">⚔️ ${escapeHtml(h2hArticle.title)}</a>`);
      }
      recentSoiKeo.forEach(a => {
        links.push(`<a href="/soi-keo/${a.slug}" style="display:inline-block;padding:6px 12px;background:#f0fdf4;color:#16a34a;border-radius:4px;font-size:13px;text-decoration:none;">📊 ${escapeHtml(a.title?.substring(0, 50))}...</a>`);
      });
      recentPreview.forEach(a => {
        links.push(`<a href="/preview/${a.slug}" style="display:inline-block;padding:6px 12px;background:#fef3c7;color:#d97706;border-radius:4px;font-size:13px;text-decoration:none;">🏆 ${escapeHtml(a.title?.substring(0, 50))}...</a>`);
      });
      links.push(`<a href="/nhan-dinh" style="display:inline-block;padding:6px 12px;background:#f1f5f9;color:#475569;border-radius:4px;font-size:13px;text-decoration:none;">→ Xem tất cả nhận định</a>`);
      relatedLinks = links.join('\n        ');
    } catch (e) { /* ignore */ }

    // Build sidebar content with thumbnails
    let sidebarSoiKeo = '';
    let sidebarH2H = '';
    try {
      const [recentSK, recentH2H] = await Promise.all([
        SoiKeoArticle.find({ status: 'published', slug: { $ne: slug } })
          .sort({ createdAt: -1 }).limit(5).select('slug title thumbnail matchInfo.homeTeam.logo matchInfo.awayTeam.logo').lean(),
        AutoArticle.find({ type: 'h2h-analysis', status: 'published' })
          .sort({ createdAt: -1 }).limit(5).select('slug title matchInfo.homeTeam.logo matchInfo.awayTeam.logo').lean(),
      ]);
      sidebarSoiKeo = recentSK.map(a => {
        const thumbHtml = a.thumbnail
          ? `<img src="${escapeHtml(a.thumbnail)}" alt="" class="sidebar-thumb" loading="lazy">`
          : (a.matchInfo?.homeTeam?.logo && a.matchInfo?.awayTeam?.logo)
            ? `<div class="sidebar-logos"><img src="${escapeHtml(a.matchInfo.homeTeam.logo)}" alt="" loading="lazy"><span style="color:#94a3b8;font-size:10px;">vs</span><img src="${escapeHtml(a.matchInfo.awayTeam.logo)}" alt="" loading="lazy"></div>`
            : '';
        return `<a href="/soi-keo/${a.slug}" class="sidebar-article">${thumbHtml}<div class="sidebar-info"><span class="sidebar-article-title">${escapeHtml(a.title?.substring(0, 60) || '')}</span></div></a>`;
      }).join('');
      sidebarH2H = recentH2H.map(a => {
        const thumbHtml = (a.matchInfo?.homeTeam?.logo && a.matchInfo?.awayTeam?.logo)
          ? `<div class="sidebar-logos"><img src="${escapeHtml(a.matchInfo.homeTeam.logo)}" alt="" loading="lazy"><span style="color:#94a3b8;font-size:10px;">vs</span><img src="${escapeHtml(a.matchInfo.awayTeam.logo)}" alt="" loading="lazy"></div>`
          : '';
        return `<a href="/doi-dau/${a.slug}" class="sidebar-article">${thumbHtml}<div class="sidebar-info"><span class="sidebar-article-title">${escapeHtml(a.title?.substring(0, 60) || '')}</span></div></a>`;
      }).join('');
    } catch (e) { /* ignore */ }

    let html = renderSoiKeoHtml(article, thumbnailUrl);
    html = html.replace('RELATED_LINKS_PLACEHOLDER', relatedLinks);
    html = html.replace('SIDEBAR_SOIKEO_PLACEHOLDER', sidebarSoiKeo || '<span style="font-size:13px;color:#94a3b8;">Chưa có bài</span>');
    html = html.replace('SIDEBAR_H2H_PLACEHOLDER', sidebarH2H || '<span style="font-size:13px;color:#94a3b8;">Chưa có bài</span>');

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);

  } catch (error) {
    console.error('[SEO Pages] Error rendering soi-keo:', error);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

module.exports = router;
