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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #1a1a2e; background: #f1f5f9; }
    .container { max-width: 1280px; margin: 0 auto; padding: 16px; }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
    .main { min-width: 0; }
    .sidebar { display: flex; flex-direction: column; gap: 12px; }
    .sidebar-card { background: white; border-radius: 6px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .sidebar-title { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .sidebar-link { display: block; padding: 6px 0; font-size: 13px; color: #334155; text-decoration: none; border-bottom: 1px solid #f1f5f9; }
    .sidebar-link:last-child { border-bottom: none; }
    .sidebar-link:hover { color: #2563eb; }
    .banner img { width: 100%; height: auto; display: block; border-radius: 6px; }
    .header { text-align: center; padding: 28px 20px; background: linear-gradient(135deg, #0a1628, #1a2744); color: white; border-radius: 6px; margin-bottom: 16px; }
    .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; line-height: 1.3; }
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
    .content { background: white; border-radius: 6px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .content h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 3px solid #2563eb; }
    .content h2:first-child { margin-top: 0; }
    .content p { margin-bottom: 12px; color: #334155; font-size: 15px; }
    .content ul { margin: 12px 0; padding-left: 20px; }
    .content li { margin-bottom: 6px; color: #334155; font-size: 15px; }
    .content strong { color: #0f172a; }
    .tags { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 13px; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #94a3b8; font-size: 14px; }
    .footer a { color: #00D4FF; text-decoration: none; }
    .breadcrumb { margin-bottom: 20px; font-size: 14px; color: #64748b; }
    .breadcrumb a { color: #3b82f6; text-decoration: none; }
    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { order: 2; }
      .container { padding: 10px; }
      .header { padding: 20px 15px; }
      .header h1 { font-size: 20px; }
      .content { padding: 16px 12px; }
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

    ${thumbnailUrl ? `<div class="banner"><img src="${escapeHtml(thumbnailUrl)}" alt="${title}" loading="eager"></div>` : ''}

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

    <div class="layout">
      <div class="main">
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

        <div style="margin-top:12px;padding:16px;background:white;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;">Xem thêm</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            RELATED_LINKS_PLACEHOLDER
          </div>
        </div>
      </div>

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

    // Build sidebar content
    let sidebarSoiKeo = '';
    let sidebarH2H = '';
    try {
      const [recentSK, recentH2H] = await Promise.all([
        SoiKeoArticle.find({ status: 'published', slug: { $ne: slug } })
          .sort({ createdAt: -1 }).limit(5).select('slug title').lean(),
        AutoArticle.find({ type: 'h2h-analysis', status: 'published' })
          .sort({ createdAt: -1 }).limit(5).select('slug title').lean(),
      ]);
      sidebarSoiKeo = recentSK.map(a => `<a href="/soi-keo/${a.slug}" class="sidebar-link">${escapeHtml(a.title?.substring(0, 45))}...</a>`).join('');
      sidebarH2H = recentH2H.map(a => `<a href="/doi-dau/${a.slug}" class="sidebar-link">${escapeHtml(a.title?.substring(0, 45))}...</a>`).join('');
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
