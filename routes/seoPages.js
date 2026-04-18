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

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

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

function renderSoiKeoHtml(article) {
  const { matchInfo, content, oddsData } = article;
  const title = escapeHtml(article.metaTitle || article.title);
  const description = escapeHtml(article.metaDescription || article.excerpt);
  const url = `${SITE_URL}/soi-keo/${article.slug}`;
  const matchDate = formatDate(matchInfo?.matchDate);

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
    "image": article.thumbnail || `${SITE_URL}/og-image.jpg`,
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
  <meta property="og:image" content="${escapeHtml(article.thumbnail || SITE_URL + '/og-image.jpg')}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(article.thumbnail || SITE_URL + '/og-image.jpg')}">

  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  <script type="application/ld+json">${JSON.stringify(sportsEventData)}</script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #1a1a2e; background: #f8fafc; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #0a1628, #1a2744); color: white; border-radius: 16px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 15px; line-height: 1.3; }
    .match-info { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 20px 0; }
    .team { text-align: center; }
    .team img { width: 64px; height: 64px; object-fit: contain; }
    .team-name { font-size: 16px; font-weight: 700; margin-top: 8px; }
    .vs { font-size: 24px; font-weight: 900; color: #00D4FF; }
    .league-info { font-size: 14px; opacity: 0.8; margin-top: 10px; }
    .date-info { font-size: 14px; opacity: 0.7; margin-top: 5px; }
    .odds-bar { display: flex; gap: 15px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
    .odds-item { background: rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 8px; font-size: 13px; }
    .odds-value { font-weight: 700; color: #00D4FF; }
    .content { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .content h2 { font-size: 22px; font-weight: 800; color: #0a1628; margin: 30px 0 15px; padding-bottom: 10px; border-bottom: 3px solid #00D4FF; }
    .content h2:first-child { margin-top: 0; }
    .content p { margin-bottom: 15px; color: #334155; }
    .content ul { margin: 15px 0; padding-left: 20px; }
    .content li { margin-bottom: 8px; color: #334155; }
    .content strong { color: #0a1628; }
    .tags { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 13px; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #94a3b8; font-size: 14px; }
    .footer a { color: #00D4FF; text-decoration: none; }
    .breadcrumb { margin-bottom: 20px; font-size: 14px; color: #64748b; }
    .breadcrumb a { color: #3b82f6; text-decoration: none; }
    @media (max-width: 768px) {
      .container { padding: 10px; }
      .header { padding: 25px 15px; }
      .header h1 { font-size: 22px; }
      .content { padding: 20px 15px; }
      .team img { width: 48px; height: 48px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/soi-keo">Nhận định bóng đá</a> &rsaquo;
      <span>${escapeHtml(matchInfo?.homeTeam?.name)} vs ${escapeHtml(matchInfo?.awayTeam?.name)}</span>
    </nav>

    <div class="header">
      <h1>${title}</h1>
      <div class="match-info">
        <div class="team">
          ${matchInfo?.homeTeam?.logo ? `<img src="${escapeHtml(matchInfo.homeTeam.logo)}" alt="${escapeHtml(matchInfo.homeTeam.name)}" loading="lazy">` : ''}
          <div class="team-name">${escapeHtml(matchInfo?.homeTeam?.name)}</div>
        </div>
        <div class="vs">VS</div>
        <div class="team">
          ${matchInfo?.awayTeam?.logo ? `<img src="${escapeHtml(matchInfo.awayTeam.logo)}" alt="${escapeHtml(matchInfo.awayTeam.name)}" loading="lazy">` : ''}
          <div class="team-name">${escapeHtml(matchInfo?.awayTeam?.name)}</div>
        </div>
      </div>
      <div class="league-info">${escapeHtml(matchInfo?.league?.name)} ${matchInfo?.league?.country ? '- ' + escapeHtml(matchInfo.league.country) : ''}</div>
      <div class="date-info">${escapeHtml(matchDate)}</div>
      ${oddsData ? `
      <div class="odds-bar">
        ${oddsData.homeWin ? `<div class="odds-item">Chủ <span class="odds-value">${oddsData.homeWin}</span></div>` : ''}
        ${oddsData.draw ? `<div class="odds-item">Hòa <span class="odds-value">${oddsData.draw}</span></div>` : ''}
        ${oddsData.awayWin ? `<div class="odds-item">Khách <span class="odds-value">${oddsData.awayWin}</span></div>` : ''}
        ${oddsData.overUnder?.line ? `<div class="odds-item">T/X <span class="odds-value">${oddsData.overUnder.line}</span></div>` : ''}
      </div>` : ''}
    </div>

    <article class="content">
      ${content?.introduction ? `<h2>Giới thiệu</h2><p>${markdownToHtml(content.introduction)}</p>` : ''}
      ${content?.teamAnalysis ? `<h2>Phân tích đội hình</h2><p>${markdownToHtml(content.teamAnalysis)}</p>` : ''}
      ${content?.h2hHistory ? `<h2>Lịch sử đối đầu</h2><p>${markdownToHtml(content.h2hHistory)}</p>` : ''}
      ${content?.formAnalysis ? `<h2>Phong độ gần đây</h2><p>${markdownToHtml(content.formAnalysis)}</p>` : ''}
      ${content?.oddsAnalysis ? `<h2>Phân tích tỷ lệ</h2><p>${markdownToHtml(content.oddsAnalysis)}</p>` : ''}
      ${content?.prediction ? `<h2>Dự đoán kết quả</h2><p>${markdownToHtml(content.prediction)}</p>` : ''}
      ${content?.bettingTips ? `<h2>Gợi ý theo dõi</h2><p>${markdownToHtml(content.bettingTips)}</p>` : ''}

      ${article.tags?.length ? `
      <div class="tags">
        ${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>` : ''}
    </article>

    <div class="footer">
      <p>Bài viết được tạo bởi AI - <a href="${SITE_URL}">ScoreLine.io</a></p>
      <p>Cập nhật tỷ số trực tiếp, lịch thi đấu và phân tích bóng đá</p>
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

    const html = renderSoiKeoHtml(article);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);

  } catch (error) {
    console.error('[SEO Pages] Error rendering soi-keo:', error);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

module.exports = router;
