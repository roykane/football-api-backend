/**
 * Dynamic Sitemap Generator
 * Auto-generates sitemap.xml from database (soi-keo articles + static pages)
 *
 * Cached for 1 hour to reduce DB load.
 */

const express = require('express');
const router = express.Router();
const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

let cachedXml = null;
let cachedAt = 0;

// Static pages with their config
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'hourly' },
  { path: '/live', priority: '0.9', changefreq: 'always' },
  { path: '/lich-thi-dau', priority: '0.9', changefreq: 'daily' },
  { path: '/ket-qua-bong-da', priority: '0.9', changefreq: 'hourly' },
  { path: '/bang-xep-hang', priority: '0.8', changefreq: 'daily' },
  { path: '/ty-le-keo', priority: '0.8', changefreq: 'hourly' },
  { path: '/soi-keo', priority: '0.9', changefreq: 'daily' },
  { path: '/giai-dau', priority: '0.7', changefreq: 'weekly' },
  { path: '/top-ghi-ban', priority: '0.7', changefreq: 'daily' },
  { path: '/nhan-dinh', priority: '0.8', changefreq: 'daily' },
  { path: '/world-cup-2026', priority: '0.9', changefreq: 'daily' },
  { path: '/world-cup-2026/lich-thi-dau', priority: '0.9', changefreq: 'daily' },
  { path: '/world-cup-2026/bang-dau', priority: '0.8', changefreq: 'weekly' },
  { path: '/world-cup-2026/bang-xep-hang', priority: '0.8', changefreq: 'daily' },
  { path: '/world-cup-2026/ket-qua', priority: '0.8', changefreq: 'daily' },
  { path: '/world-cup-2026/top-ghi-ban', priority: '0.8', changefreq: 'daily' },
  { path: '/world-cup-2026/doi-tuyen-viet-nam', priority: '0.9', changefreq: 'daily' },
];

const LEAGUES = [
  { slug: 'premier-league', priority: '0.9' },
  { slug: 'la-liga', priority: '0.9' },
  { slug: 'serie-a', priority: '0.8' },
  { slug: 'bundesliga', priority: '0.8' },
  { slug: 'ligue-1', priority: '0.8' },
  { slug: 'champions-league', priority: '0.9' },
  { slug: 'europa-league', priority: '0.7' },
  { slug: 'v-league-1', priority: '0.9' },
  { slug: 'world-cup', priority: '0.7' },
];

// Date slugs for results pages
const RESULT_DATES = ['hom-nay', 'hom-qua'];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const urls = [];

  // 1. Static pages
  for (const page of STATIC_PAGES) {
    urls.push(urlEntry(`${SITE_URL}${page.path}`, today, page.changefreq, page.priority));
  }

  // 2. League hub pages
  for (const league of LEAGUES) {
    urls.push(urlEntry(`${SITE_URL}/giai-dau/${league.slug}`, today, 'daily', league.priority));
    urls.push(urlEntry(`${SITE_URL}/top-ghi-ban/${league.slug}`, today, 'daily', '0.7'));
  }

  // 3. Soi-keo articles from DB (latest 500 published)
  try {
    const articles = await SoiKeoArticle.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(500)
      .select('slug createdAt updatedAt matchInfo.matchDate')
      .lean();

    for (const article of articles) {
      if (!article.slug) continue;
      const lastmod = (article.updatedAt || article.createdAt || new Date()).toISOString().split('T')[0];
      const matchDate = article.matchInfo?.matchDate ? new Date(article.matchInfo.matchDate) : null;
      const isUpcoming = matchDate && matchDate > new Date();
      // Upcoming matches change more frequently (odds update); finished are static
      const changefreq = isUpcoming ? 'hourly' : 'monthly';
      const priority = isUpcoming ? '0.8' : '0.5';
      urls.push(urlEntry(`${SITE_URL}/soi-keo/${article.slug}`, lastmod, changefreq, priority));
    }

    console.log(`[Sitemap] ${articles.length} soi-keo articles added`);
  } catch (err) {
    console.error('[Sitemap] Failed to load soi-keo articles:', err.message);
  }

  // 4. Auto articles (round previews, h2h)
  try {
    const autoArticles = await AutoArticle.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(300)
      .select('type slug createdAt updatedAt matchInfo.matchDate leagueInfo.slug')
      .lean();

    for (const article of autoArticles) {
      if (!article.slug) continue;
      const lastmod = (article.updatedAt || article.createdAt || new Date()).toISOString().split('T')[0];
      const prefix = article.type === 'round-preview' ? 'preview' : 'doi-dau';
      const isUpcoming = article.matchInfo?.matchDate && new Date(article.matchInfo.matchDate) > new Date();
      urls.push(urlEntry(`${SITE_URL}/${prefix}/${article.slug}`, lastmod, isUpcoming ? 'daily' : 'monthly', isUpcoming ? '0.7' : '0.4'));
    }
    console.log(`[Sitemap] ${autoArticles.length} auto articles added`);
  } catch (err) {
    console.error('[Sitemap] Failed to load auto articles:', err.message);
  }

  // 5. Data-driven pages (schedule, standings, top scorers per league)
  for (const league of LEAGUES) {
    urls.push(urlEntry(`${SITE_URL}/lich-thi-dau/${league.slug}`, today, 'daily', '0.7'));
    urls.push(urlEntry(`${SITE_URL}/bang-xep-hang/${league.slug}`, today, 'daily', '0.7'));
    urls.push(urlEntry(`${SITE_URL}/top-ghi-ban/${league.slug}`, today, 'daily', '0.6'));
  }

  // 6. Results pages
  for (const dateSlug of RESULT_DATES) {
    urls.push(urlEntry(`${SITE_URL}/ket-qua/${dateSlug}`, today, 'daily', '0.7'));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

// GET /sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    const now = Date.now();

    if (cachedXml && now - cachedAt < CACHE_TTL) {
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(cachedXml);
    }

    cachedXml = await generateSitemap();
    cachedAt = now;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(cachedXml);
  } catch (err) {
    console.error('[Sitemap] Generation error:', err);
    res.status(500).send('<?xml version="1.0"?><error>Failed to generate sitemap</error>');
  }
});

// GET /robots.txt - reference the sitemap
router.get('/robots.txt', (req, res) => {
  const txt = `User-agent: *
Allow: /

# Sitemap auto-generated from database
Sitemap: ${SITE_URL}/sitemap.xml

# Disallow API endpoints
Disallow: /api/
`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(txt);
});

module.exports = router;
