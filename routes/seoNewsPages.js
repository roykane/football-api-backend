/**
 * News aggregator SSR — Google News-compliant
 * Routes:
 *   GET /tin-bong-da            — news hub / list (paginated)
 *   GET /tin-bong-da/:slug      — news article detail
 *
 * Bots get full SSR HTML with NewsArticle + BreadcrumbList schema.
 * Users get the SPA (nginx try_files). Category filter via ?cat=<general|analysis|transfer|interview>.
 */

const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const siteHeader = require('../utils/siteHeader');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const PAGE_SIZE = 20;
const CATEGORIES = {
  general: 'Tin tức chung',
  analysis: 'Phân tích',
  transfer: 'Chuyển nhượng',
  interview: 'Phỏng vấn',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateShort(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatRelative(date) {
  if (!date) return '';
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDateShort(date);
}

// Very light markdown → HTML for news content (paragraphs + lists + bold + links).
const BOX_META = {
  info:    { emoji: 'ℹ️', label: 'Thông tin' },
  tip:     { emoji: '💡', label: 'Mẹo' },
  warning: { emoji: '⚠️', label: 'Lưu ý' },
  example: { emoji: '🔍', label: 'Ví dụ' },
  stats:   { emoji: '📊', label: 'Thống kê' },
  quote:   { emoji: '❝',  label: '' },
};

function toHtml(text) {
  if (!text) return '';
  const lines = String(text).split('\n');
  return renderLines(lines, 0, lines.length).html;
}

function renderLines(lines, start, end) {
  const out = [];
  let paraBuf = [];
  let listBuf = [];
  let listKind = null;

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${inlineFmt(paraBuf.join(' ').trim())}</p>`);
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length && listKind) {
      const tag = listKind;
      out.push(`<${tag}>${listBuf.map(i => `<li>${inlineFmt(i)}</li>`).join('')}</${tag}>`);
      listBuf = [];
      listKind = null;
    }
  };
  const flushAll = () => { flushPara(); flushList(); };

  let i = start;
  while (i < end) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) { flushAll(); i++; continue; }

    // Directive box start
    const boxStart = trimmed.match(/^:::\s*(\w+)\s*(.*)$/);
    if (boxStart && BOX_META[boxStart[1]]) {
      flushAll();
      const variant = boxStart[1];
      const customTitle = boxStart[2].trim();
      const meta = BOX_META[variant];
      const title = customTitle || meta.label;
      // Find matching :::
      let j = i + 1;
      while (j < end && lines[j].trim() !== ':::') j++;
      const innerHtml = renderLines(lines, i + 1, j).html;
      const header = title
        ? `<div class="sm-box-header"><span class="sm-box-emoji">${meta.emoji}</span><span class="sm-box-title">${escapeHtml(title)}</span></div>`
        : '';
      out.push(`<aside class="sm-box sm-box-${variant}">${header}<div class="sm-box-body">${innerHtml}</div></aside>`);
      i = j + 1;
      continue;
    }

    // Image on own line
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushAll();
      const alt = escapeHtml(imgMatch[1] || '');
      const src = escapeHtml(imgMatch[2]);
      const caption = alt ? `<figcaption>${alt}</figcaption>` : '';
      out.push(`<figure class="sm-figure"><img src="${src}" alt="${alt}" loading="lazy" decoding="async">${caption}</figure>`);
      i++;
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h1 = trimmed.match(/^#\s+(.+)$/);
    const ul = trimmed.match(/^-\s+(.+)$/);
    const ol = trimmed.match(/^\d+\.\s+(.+)$/);

    if (h3) { flushAll(); out.push(`<h3>${inlineFmt(h3[1])}</h3>`); i++; continue; }
    if (h2) { flushAll(); out.push(`<h2>${inlineFmt(h2[1])}</h2>`); i++; continue; }
    if (h1) { flushAll(); out.push(`<h1>${inlineFmt(h1[1])}</h1>`); i++; continue; }

    if (ul) {
      flushPara();
      if (listKind && listKind !== 'ul') flushList();
      listKind = 'ul'; listBuf.push(ul[1]); i++; continue;
    }
    if (ol) {
      flushPara();
      if (listKind && listKind !== 'ol') flushList();
      listKind = 'ol'; listBuf.push(ol[1]); i++; continue;
    }

    flushList();
    paraBuf.push(trimmed);
    i++;
  }
  flushAll();
  return { html: out.join('\n') };
}

function inlineFmt(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="sm-inline-img" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/**
 * Extract FAQ Q&A from markdown — used for FAQPage schema injection in SSR.
 */
function extractFAQ(content) {
  if (!content) return [];
  const faqLabelRegex = /(câu hỏi thường gặp|faq|câu hỏi phổ biến|hỏi đáp)/i;
  const lines = String(content).split('\n');
  let inFAQ = false;
  let currentQ = null;
  const currentABuf = [];
  const out = [];

  const clean = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const flushCurrent = () => {
    if (currentQ) {
      const answer = clean(currentABuf.join(' '));
      if (answer) out.push({ question: currentQ, answer });
      currentQ = null;
      currentABuf.length = 0;
    }
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);
    const h1 = trimmed.match(/^#\s+(.+)$/);

    if (h1 || (h2 && !faqLabelRegex.test(h2[1]))) {
      flushCurrent();
      inFAQ = h2 ? faqLabelRegex.test(h2[1]) : false;
      continue;
    }
    if (h2 && faqLabelRegex.test(h2[1])) {
      flushCurrent();
      inFAQ = true;
      continue;
    }
    if (!inFAQ) continue;

    if (h3) {
      flushCurrent();
      currentQ = clean(h3[1]);
      continue;
    }
    if (currentQ && trimmed) {
      if (trimmed.startsWith(':::')) continue;
      currentABuf.push(trimmed);
    }
  }
  flushCurrent();
  return out;
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
    img{max-width:100%;height:auto}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#2563eb}
    .layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}.main{min-width:0}
    .hub-hero{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:28px 24px;border-radius:8px;margin-bottom:16px}
    .hub-hero h1{font-size:26px;font-weight:800;margin-bottom:6px}
    .hub-hero .sub{font-size:14px;color:#bfdbfe}
    .cat-filter{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .cat-chip{display:inline-block;padding:6px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;font-size:13px;color:#475569;font-weight:600}
    .cat-chip.active{background:#2563eb;border-color:#2563eb;color:#fff}
    .news-card{display:flex;gap:14px;background:#fff;border-radius:8px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(15,23,42,0.04);border:1px solid #e2e8f0;transition:border-color .15s}
    .news-card:hover{border-color:#cbd5e1;text-decoration:none}
    .news-card .thumb{width:140px;height:90px;flex-shrink:0;overflow:hidden;border-radius:6px;background:#f1f5f9}
    .news-card .thumb img{width:100%;height:100%;object-fit:cover}
    .news-card .body{flex:1;min-width:0}
    .news-card .cat{display:inline-block;font-size:11px;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:3px;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
    .news-card h2{color:#0f172a;font-size:16px;line-height:1.4;margin-bottom:6px;font-weight:700}
    .news-card p{color:#64748b;font-size:13px;line-height:1.5;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .news-card .meta{font-size:12px;color:#94a3b8}
    .news-card .meta .source{color:#475569;font-weight:600}
    .pagination{display:flex;justify-content:center;gap:8px;margin:24px 0}
    .pagination a,.pagination span{padding:8px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;font-size:14px;color:#475569;font-weight:600}
    .pagination a:hover{background:#eff6ff;border-color:#bfdbfe;color:#2563eb;text-decoration:none}
    .pagination .current{background:#2563eb;border-color:#2563eb;color:#fff}
    .pagination .disabled{opacity:.4;pointer-events:none}
    .article-header{background:#fff;border-radius:8px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border-left:4px solid #2563eb}
    .article-header h1{font-size:26px;font-weight:800;color:#0f172a;margin-bottom:10px;line-height:1.3}
    .article-header .meta{font-size:13px;color:#64748b;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
    .article-header .cat{display:inline-block;font-size:11px;color:#2563eb;background:#eff6ff;padding:3px 10px;border-radius:3px;font-weight:700;text-transform:uppercase}
    .hero-img{width:100%;max-height:420px;object-fit:cover;border-radius:8px;margin-bottom:16px;display:block}
    .article-body{background:#fff;border-radius:8px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .article-body p{margin-bottom:14px;color:#334155;font-size:16px;line-height:1.8}
    .article-body h2,.article-body h3{color:#0f172a;font-weight:800;margin:22px 0 10px}
    .article-body h2{font-size:20px}.article-body h3{font-size:17px}
    .article-body ul,.article-body ol{margin:12px 0;padding-left:24px}
    .article-body li{margin-bottom:6px;color:#334155;font-size:15.5px}
    .article-body strong{color:#0f172a}
    .article-body a{color:#2563eb}
    .source-note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin-top:16px;font-size:13px;color:#64748b}
    .source-note a{color:#2563eb;font-weight:600}
    .sidebar{display:flex;flex-direction:column;gap:12px}
    .sidebar-card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .sidebar-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px}
    .sidebar-link{display:block;padding:8px 0;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;line-height:1.4}
    .sidebar-link:last-child{border-bottom:none}
    .sidebar-link:hover{color:#2563eb;text-decoration:none}
    .tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
    .tag{background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:3px;font-size:12px}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    /* Markdown figures + directive boxes */
    .sm-figure{margin:24px 0;text-align:center}
    .sm-figure img{width:100%;max-width:720px;height:auto;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.1);display:block;margin:0 auto}
    .sm-figure figcaption{margin-top:8px;font-size:13px;color:#64748b;font-style:italic}
    .sm-inline-img{max-width:100%;height:auto;border-radius:4px;vertical-align:middle}
    .sm-box{margin:22px 0;padding:16px 20px;border-radius:10px;border-left:4px solid}
    .sm-box-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:800;font-size:13.5px;text-transform:uppercase;letter-spacing:0.4px}
    .sm-box-emoji{font-size:18px}
    .sm-box-body p{margin:0 0 8px;font-size:15px;line-height:1.65}
    .sm-box-body p:last-child{margin:0}
    .sm-box-body ul,.sm-box-body ol{margin:6px 0 0;padding-left:20px}
    .sm-box-body li{margin-bottom:4px}
    .sm-box-info{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-left-color:#2563eb;color:#1e3a8a}
    .sm-box-tip{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-left-color:#16a34a;color:#14532d}
    .sm-box-warning{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-left-color:#d97706;color:#78350f}
    .sm-box-example{background:linear-gradient(135deg,#faf5ff,#f3e8ff);border-left-color:#9333ea;color:#581c87}
    .sm-box-stats{background:linear-gradient(135deg,#0f172a,#1e3a8a);border-left-color:#60a5fa;color:#dbeafe}
    .sm-box-stats .sm-box-header{color:#fff}
    .sm-box-stats .sm-box-body p,.sm-box-stats .sm-box-body li{color:#e2e8f0}
    .sm-box-stats .sm-box-body strong{color:#fbbf24}
    .sm-box-stats .sm-box-body a{color:#93c5fd}
    .sm-box-quote{background:#f8fafc;border-left-color:#64748b;font-style:italic;color:#475569}
    @media(max-width:768px){
      .layout{grid-template-columns:1fr}
      .sidebar{order:2}
      .article-body,.article-header{padding:18px 16px}
      .article-header h1{font-size:22px}
      .news-card .thumb{width:100px;height:75px}
    }
  `;
}

function render404(msg = 'Bài viết không tồn tại.') {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>404 | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p>${escapeHtml(msg)}</p><p><a href="/tin-bong-da">Về trang tin bóng đá</a></p></body></html>`;
}

// ===== /tin-bong-da — hub/list =====
router.get('/tin-bong-da', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const cat = CATEGORIES[req.query.cat] ? req.query.cat : null;
    const query = { status: 'published' };
    if (cat) query.category = cat;

    const [items, total] = await Promise.all([
      Article.find(query).sort({ pubDate: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        .select('slug title description image pubDate category source').lean(),
      Article.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Backfill slug if any article was saved before the pre-save hook existed
    for (const a of items) {
      if (!a.slug) {
        a.slug = Article.slugifyFromTitle(a.title);
      }
    }

    const canonicalPath = cat ? `/tin-bong-da?cat=${cat}` : '/tin-bong-da';
    const canonicalUrl = `${SITE_URL}${canonicalPath}${page > 1 ? (cat ? '&' : '?') + 'page=' + page : ''}`;
    const title = cat
      ? `${CATEGORIES[cat]} — Tin Bóng Đá Mới Nhất | ScoreLine`
      : 'Tin Bóng Đá Hôm Nay — Tổng Hợp Tin Tức, Chuyển Nhượng, Phân Tích | ScoreLine';
    const description = cat
      ? `Cập nhật ${CATEGORIES[cat].toLowerCase()} bóng đá mới nhất. ScoreLine tổng hợp tin từ nhiều nguồn trong và ngoài nước.`
      : 'Tin bóng đá hôm nay: chuyển nhượng, phân tích, phỏng vấn, tin Ngoại Hạng Anh, La Liga, Champions League, V-League. Cập nhật liên tục 24/7.';

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Tin bóng đá', item: `${SITE_URL}/tin-bong-da` },
        ...(cat ? [{ '@type': 'ListItem', position: 3, name: CATEGORIES[cat], item: `${SITE_URL}/tin-bong-da?cat=${cat}` }] : []),
      ],
    };

    const itemListSchema = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: items.map((a, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE_URL}/tin-bong-da/${a.slug}`,
        name: a.title,
      })),
    };

    const catChips = Object.entries(CATEGORIES).map(([key, name]) => {
      const isActive = cat === key;
      return `<a href="/tin-bong-da?cat=${key}" class="cat-chip${isActive ? ' active' : ''}">${escapeHtml(name)}</a>`;
    }).join('');
    const allChip = `<a href="/tin-bong-da" class="cat-chip${!cat ? ' active' : ''}">Tất cả</a>`;

    const cardsHtml = items.length ? items.map(a => `
      <a href="/tin-bong-da/${a.slug}" class="news-card">
        <div class="thumb">${a.image ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" width="140" height="90" loading="lazy" decoding="async">` : ''}</div>
        <div class="body">
          <span class="cat">${escapeHtml(CATEGORIES[a.category] || 'Tin tức')}</span>
          <h2>${escapeHtml(a.title)}</h2>
          <p>${escapeHtml(a.description || '')}</p>
          <div class="meta">
            <span class="source">${escapeHtml(a.source || 'ScoreLine')}</span> · <time datetime="${new Date(a.pubDate).toISOString()}">${formatRelative(a.pubDate)}</time>
          </div>
        </div>
      </a>
    `).join('') : `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:40px 28px;text-align:center">
        <div style="font-size:42px;margin-bottom:12px">📝</div>
        <h2 style="color:#0f172a;font-size:20px;margin-bottom:8px">Chuyên mục tin bóng đá đang được làm mới</h2>
        <p style="color:#64748b;font-size:14px;max-width:480px;margin:0 auto 16px">
          ScoreLine đang xây dựng lại hệ thống tin tức với nội dung chất lượng cao hơn. Trong lúc chờ, mời bạn xem các chuyên mục khác:
        </p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <a href="/nhan-dinh" style="padding:8px 16px;background:#2563eb;color:#fff;border-radius:6px;font-weight:600;font-size:14px">📊 Nhận định trận đấu</a>
          <a href="/lich-thi-dau" style="padding:8px 16px;background:#fff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-weight:600;font-size:14px">📅 Lịch thi đấu</a>
          <a href="/ket-qua-bong-da" style="padding:8px 16px;background:#fff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-weight:600;font-size:14px">🏁 Kết quả</a>
          <a href="/kien-thuc-bong-da" style="padding:8px 16px;background:#fff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-weight:600;font-size:14px">📚 Kiến thức bóng đá</a>
        </div>
      </div>
    `;

    const paginationHtml = (() => {
      if (totalPages <= 1) return '';
      const qs = (p) => {
        const parts = [];
        if (cat) parts.push(`cat=${cat}`);
        if (p > 1) parts.push(`page=${p}`);
        return parts.length ? '?' + parts.join('&') : '';
      };
      const prev = page > 1
        ? `<a href="/tin-bong-da${qs(page - 1)}" rel="prev">← Trước</a>`
        : `<span class="disabled">← Trước</span>`;
      const next = page < totalPages
        ? `<a href="/tin-bong-da${qs(page + 1)}" rel="next">Sau →</a>`
        : `<span class="disabled">Sau →</span>`;
      return `<div class="pagination">${prev}<span class="current">Trang ${page}/${totalPages}</span>${next}</div>`;
    })();

    const sidebarHtml = `
      <div class="sidebar-card">
        <div class="sidebar-title">🔗 Truy cập nhanh</div>
        <a href="/" class="sidebar-link">⚽ Trang chủ — Tỷ số trực tiếp</a>
        <a href="/lich-thi-dau" class="sidebar-link">📅 Lịch thi đấu</a>
        <a href="/ket-qua-bong-da" class="sidebar-link">🏁 Kết quả</a>
        <a href="/nhan-dinh" class="sidebar-link">📊 Nhận định</a>
        <a href="/kien-thuc-bong-da" class="sidebar-link">📚 Kiến thức bóng đá</a>
      </div>
    `;

    const prevLink = page > 1 ? `<link rel="prev" href="${SITE_URL}/tin-bong-da${page - 1 > 1 ? '?page=' + (page - 1) : ''}">` : '';
    const nextLink = page < totalPages ? `<link rel="next" href="${SITE_URL}/tin-bong-da?page=${page + 1}">` : '';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}">
  ${prevLink}
  ${nextLink}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${SITE_URL}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      ${cat ? `<a href="/tin-bong-da">Tin bóng đá</a> &rsaquo; <span>${escapeHtml(CATEGORIES[cat])}</span>` : `<span>Tin bóng đá</span>`}
    </nav>
    <div class="hub-hero">
      <h1>${cat ? escapeHtml(CATEGORIES[cat]) : 'Tin Bóng Đá Hôm Nay'}</h1>
      <div class="sub">${escapeHtml(description)}</div>
    </div>
    <div class="cat-filter">
      ${allChip}
      ${catChips}
    </div>
    <div class="layout">
      <main class="main">
        ${cardsHtml}
        ${paginationHtml}
      </main>
      <aside class="sidebar">${sidebarHtml}</aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Tỷ số trực tiếp & tin bóng đá</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[SEO News] /tin-bong-da list error:', err);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

// ===== /tin-bong-da/:slug — detail =====
router.get('/tin-bong-da/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug, status: 'published' }).lean();
    if (!article) {
      // 410 Gone tells Google the URL is permanently removed (faster de-index
      // than 404). Safe here because we control the slug namespace — if a slug
      // doesn't resolve, it's a stale/deleted article, not a typo.
      res.set('X-Robots-Tag', 'noindex');
      return res.status(410).send(render404('Bài viết đã được gỡ hoặc không còn tồn tại.'));
    }

    // Increment views (fire-and-forget)
    Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    const url = `${SITE_URL}/tin-bong-da/${article.slug}`;
    const title = article.title;
    const description = (article.description || '').slice(0, 180);
    const image = article.image || `${SITE_URL}/og-image.jpg`;
    const category = CATEGORIES[article.category] || 'Tin tức';
    const publishedIso = new Date(article.pubDate || article.createdAt || Date.now()).toISOString();
    const modifiedIso = new Date(article.updatedAt || article.pubDate || article.createdAt || Date.now()).toISOString();

    // Related articles: same category, latest
    const related = await Article.find({
      status: 'published',
      _id: { $ne: article._id },
      category: article.category,
    }).sort({ pubDate: -1 }).limit(5).select('slug title pubDate').lean();
    for (const r of related) if (!r.slug) r.slug = Article.slugifyFromTitle(r.title, String(r._id));

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Tin bóng đá', item: `${SITE_URL}/tin-bong-da` },
        { '@type': 'ListItem', position: 3, name: category, item: `${SITE_URL}/tin-bong-da?cat=${article.category}` },
        { '@type': 'ListItem', position: 4, name: article.title, item: url },
      ],
    };

    // Use NewsArticle schema (Google News compliant) instead of plain Article.
    const newsSchema = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description,
      url,
      datePublished: publishedIso,
      dateModified: modifiedIso,
      author: { '@type': 'Organization', name: 'Ban Biên Tập ScoreLine', url: `${SITE_URL}/about` },
      publisher: {
        '@type': 'Organization', name: 'ScoreLine', url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 },
      },
      image: article.image
        ? { '@type': 'ImageObject', url: article.image, width: 1200, height: 630 }
        : { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630 },
      mainEntityOfPage: url,
      articleSection: category,
      keywords: (article.tags || []).join(', '),
      inLanguage: 'vi-VN',
    };

    const tagsHtml = (article.tags || []).length
      ? `<div class="tag-list">${article.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    const sourceNote = article.originalLink && article.source
      ? `<div class="source-note">Nguồn tham khảo: <a href="${escapeHtml(article.originalLink)}" rel="nofollow noopener" target="_blank">${escapeHtml(article.source)}</a> · Biên tập bởi Ban Biên Tập ScoreLine.</div>`
      : '';

    const relatedHtml = related.length ? `
      <div class="sidebar-card">
        <div class="sidebar-title">📰 Tin liên quan</div>
        ${related.map(r => `<a href="/tin-bong-da/${r.slug}" class="sidebar-link">${escapeHtml(r.title)}</a>`).join('')}
      </div>
    ` : '';

    const sidebarHtml = `
      ${relatedHtml}
      <div class="sidebar-card">
        <div class="sidebar-title">🔗 Truy cập nhanh</div>
        <a href="/tin-bong-da" class="sidebar-link">📰 Tất cả tin bóng đá</a>
        <a href="/lich-thi-dau" class="sidebar-link">📅 Lịch thi đấu</a>
        <a href="/ket-qua-bong-da" class="sidebar-link">🏁 Kết quả</a>
        <a href="/nhan-dinh" class="sidebar-link">📊 Nhận định</a>
      </div>
    `;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="vi" href="${escapeHtml(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="${escapeHtml(title)}">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta property="article:published_time" content="${publishedIso}">
  <meta property="article:modified_time" content="${modifiedIso}">
  <meta property="article:section" content="${escapeHtml(category)}">
  ${(article.tags || []).map(t => `<meta property="article:tag" content="${escapeHtml(t)}">`).join('\n  ')}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(newsSchema)}</script>
  ${(() => {
    const faq = extractFAQ(article.content);
    if (!faq.length) return '';
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    };
    return `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`;
  })()}
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Trang chủ</a> &rsaquo;
      <a href="/tin-bong-da">Tin bóng đá</a> &rsaquo;
      <a href="/tin-bong-da?cat=${article.category}">${escapeHtml(category)}</a> &rsaquo;
      <span>${escapeHtml(article.title)}</span>
    </nav>
    <div class="article-header">
      <span class="cat">${escapeHtml(category)}</span>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span>📅 Đăng: <time datetime="${publishedIso}">${formatDateShort(article.pubDate)}</time></span>
        <span>🕒 Cập nhật: <time datetime="${modifiedIso}">${formatDateShort(article.updatedAt || article.pubDate)}</time></span>
        <span>👁 ${(article.views || 0).toLocaleString()} lượt xem</span>
      </div>
    </div>
    ${article.image ? `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(title)}" width="1200" height="630" class="hero-img" style="aspect-ratio:1200/630" loading="eager" decoding="async" fetchpriority="high">` : ''}
    <div class="layout">
      <main class="main">
        <article class="article-body">
          ${toHtml(article.content || article.description || '')}
          ${tagsHtml}
          ${sourceNote}
        </article>
      </main>
      <aside class="sidebar">${sidebarHtml}</aside>
    </div>
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> — Cập nhật tin bóng đá 24/7</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[SEO News] /tin-bong-da/:slug error:', err);
    res.status(500).send('<html><body><h1>Server Error</h1></body></html>');
  }
});

module.exports = router;
