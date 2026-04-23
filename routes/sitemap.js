/**
 * Dynamic Sitemap Generator
 * Auto-generates sitemap.xml from database (nhan-dinh articles + static pages)
 *
 * Cached for 15 minutes to balance DB load and crawl freshness for new articles.
 */

const express = require('express');
const router = express.Router();
const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');
const { players: VN_PLAYERS } = require('../data/vietnamesePlayers');
const { sections: WC_SECTIONS } = require('../data/worldCup2026');
const { articles: KNOWLEDGE_ARTICLES } = require('../data/footballKnowledge');
const { coaches: COACHES } = require('../data/coaches');

const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

let cachedXml = null;
let cachedAt = 0;
let cachedNewsXml = null;
let cachedNewsAt = 0;
let cachedImagesXml = null;
let cachedImagesAt = 0;
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 min — news sitemap needs fresh updates
const IMAGES_CACHE_TTL = 30 * 60 * 1000; // 30 min

function invalidateSitemapCache() {
  cachedXml = null;
  cachedAt = 0;
  cachedNewsXml = null;
  cachedNewsAt = 0;
  cachedImagesXml = null;
  cachedImagesAt = 0;
}

// Static pages with their config
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'hourly' },
  { path: '/live', priority: '0.9', changefreq: 'always' },
  { path: '/lich-thi-dau', priority: '0.9', changefreq: 'daily' },
  { path: '/ket-qua-bong-da', priority: '0.9', changefreq: 'hourly' },
  { path: '/bang-xep-hang', priority: '0.8', changefreq: 'daily' },
  // Removed /ty-le-keo from sitemap — noindex for AdSense compliance
  { path: '/nhan-dinh', priority: '0.9', changefreq: 'daily' },
  { path: '/giai-dau', priority: '0.7', changefreq: 'weekly' },
  { path: '/top-ghi-ban', priority: '0.7', changefreq: 'daily' },
  { path: '/world-cup-2026', priority: '0.9', changefreq: 'daily' },
  { path: '/lich-thi-dau/world-cup', priority: '0.9', changefreq: 'daily' },
  { path: '/giai-dau/world-cup', priority: '0.8', changefreq: 'weekly' },
  { path: '/bang-xep-hang/world-cup', priority: '0.8', changefreq: 'daily' },
  { path: '/ket-qua/world-cup', priority: '0.8', changefreq: 'daily' },
  { path: '/top-ghi-ban/world-cup', priority: '0.8', changefreq: 'daily' },
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
  const seen = new Set();
  const addUrl = (loc, lastmod, changefreq, priority) => {
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push(urlEntry(loc, lastmod, changefreq, priority));
  };

  // 1. Static pages
  for (const page of STATIC_PAGES) {
    addUrl(`${SITE_URL}${page.path}`, today, page.changefreq, page.priority);
  }

  // 1b. New SEO content hubs
  addUrl(`${SITE_URL}/cau-thu`, today, 'weekly', '0.8');
  addUrl(`${SITE_URL}/kien-thuc-bong-da`, today, 'weekly', '0.8');
  addUrl(`${SITE_URL}/huan-luyen-vien`, today, 'weekly', '0.8');
  for (const player of VN_PLAYERS) {
    addUrl(`${SITE_URL}/cau-thu/${player.slug}`, today, 'weekly', '0.7');
  }
  for (const coach of COACHES) {
    addUrl(`${SITE_URL}/huan-luyen-vien/${coach.slug}`, today, 'weekly', '0.7');
  }
  for (const slug of Object.keys(WC_SECTIONS)) {
    addUrl(`${SITE_URL}/world-cup-2026/${slug}`, today, 'weekly', '0.8');
  }
  for (const article of KNOWLEDGE_ARTICLES) {
    addUrl(`${SITE_URL}/kien-thuc-bong-da/${article.slug}`, today, 'monthly', '0.7');
  }

  // 2. League hub pages
  for (const league of LEAGUES) {
    addUrl(`${SITE_URL}/giai-dau/${league.slug}`, today, 'daily', league.priority);
    addUrl(`${SITE_URL}/top-ghi-ban/${league.slug}`, today, 'daily', '0.7');
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
      addUrl(`${SITE_URL}/nhan-dinh/${article.slug}`, lastmod, changefreq, priority);
    }

    console.log(`[Sitemap] ${articles.length} nhan-dinh articles added`);
  } catch (err) {
    console.error('[Sitemap] Failed to load nhan-dinh articles:', err.message);
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
      addUrl(`${SITE_URL}/${prefix}/${article.slug}`, lastmod, isUpcoming ? 'daily' : 'monthly', isUpcoming ? '0.7' : '0.4');
    }
    console.log(`[Sitemap] ${autoArticles.length} auto articles added`);
  } catch (err) {
    console.error('[Sitemap] Failed to load auto articles:', err.message);
  }

  // 5. Data-driven pages (schedule, standings, top scorers per league)
  for (const league of LEAGUES) {
    addUrl(`${SITE_URL}/lich-thi-dau/${league.slug}`, today, 'daily', '0.7');
    addUrl(`${SITE_URL}/bang-xep-hang/${league.slug}`, today, 'daily', '0.7');
    addUrl(`${SITE_URL}/top-ghi-ban/${league.slug}`, today, 'daily', '0.6');
  }

  // 6. Results pages
  for (const dateSlug of RESULT_DATES) {
    addUrl(`${SITE_URL}/ket-qua/${dateSlug}`, today, 'daily', '0.7');
  }

  // 7. Team pages
  try {
    const Team = require('../models/Team');
    const teams = await Team.find({})
      .select('slug updatedAt')
      .lean();
    for (const team of teams) {
      const lastmod = (team.updatedAt || new Date()).toISOString().split('T')[0];
      addUrl(`${SITE_URL}/doi-bong/${team.slug}`, lastmod, 'weekly', '0.7');
    }
    console.log(`[Sitemap] ${teams.length} team pages added`);
  } catch (err) {
    console.error('[Sitemap] Failed to load teams:', err.message);
  }

  // 8. News hub + articles (/tin-bong-da) — match reports from real API-Sports data
  try {
    const Article = require('../models/Article');
    addUrl(`${SITE_URL}/tin-bong-da`, today, 'hourly', '0.8');
    for (const cat of ['general', 'analysis', 'transfer', 'interview']) {
      addUrl(`${SITE_URL}/tin-bong-da?cat=${cat}`, today, 'daily', '0.6');
    }
    const news = await Article.find({ status: 'published' })
      .sort({ pubDate: -1 })
      .limit(500)
      .select('slug title pubDate updatedAt _id')
      .lean();
    let newsAdded = 0;
    for (const a of news) {
      const slug = a.slug || Article.slugifyFromTitle(a.title);
      if (!slug) continue;
      const lastmod = (a.updatedAt || a.pubDate || new Date()).toISOString().split('T')[0];
      const ageHours = (Date.now() - new Date(a.pubDate).getTime()) / 3_600_000;
      const changefreq = ageHours < 24 ? 'hourly' : ageHours < 168 ? 'daily' : 'weekly';
      const priority = ageHours < 24 ? '0.8' : ageHours < 168 ? '0.6' : '0.4';
      addUrl(`${SITE_URL}/tin-bong-da/${slug}`, lastmod, changefreq, priority);
      newsAdded++;
    }
    console.log(`[Sitemap] ${newsAdded} news articles added`);
  } catch (err) {
    console.error('[Sitemap] Failed to load news:', err.message);
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
      res.set('Cache-Control', 'public, max-age=900');
      return res.send(cachedXml);
    }

    cachedXml = await generateSitemap();
    cachedAt = now;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.send(cachedXml);
  } catch (err) {
    console.error('[Sitemap] Generation error:', err);
    res.status(500).send('<?xml version="1.0"?><error>Failed to generate sitemap</error>');
  }
});

// Google News sitemap — articles published in last 48h
async function generateNewsSitemap() {
  const Article = require('../models/Article');
  const SoiKeoArticle = require('../models/SoiKeoArticle');
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
  const urls = [];

  const pushNewsEntry = (loc, pubDate, title) => {
    urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>ScoreLine</news:name>
        <news:language>vi</news:language>
      </news:publication>
      <news:publication_date>${new Date(pubDate).toISOString()}</news:publication_date>
      <news:title>${escapeXml(title)}</news:title>
    </news:news>
  </url>`);
  };

  try {
    const news = await Article.find({ status: 'published', pubDate: { $gte: cutoff } })
      .sort({ pubDate: -1 })
      .limit(1000)
      .select('slug title pubDate')
      .lean();
    for (const a of news) {
      const slug = a.slug || Article.slugifyFromTitle(a.title);
      if (!slug) continue;
      pushNewsEntry(`${SITE_URL}/tin-bong-da/${slug}`, a.pubDate, a.title);
    }
  } catch (err) {
    console.error('[SitemapNews] Article load failed:', err.message);
  }

  try {
    const soiKeo = await SoiKeoArticle.find({ status: 'published', createdAt: { $gte: cutoff } })
      .sort({ createdAt: -1 })
      .limit(500)
      .select('slug title createdAt')
      .lean();
    for (const a of soiKeo) {
      if (!a.slug) continue;
      pushNewsEntry(`${SITE_URL}/nhan-dinh/${a.slug}`, a.createdAt, a.title);
    }
  } catch (err) {
    console.error('[SitemapNews] SoiKeo load failed:', err.message);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join('\n')}
</urlset>`;
}

router.get('/sitemap-news.xml', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedNewsXml && now - cachedNewsAt < NEWS_CACHE_TTL) {
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=300');
      return res.send(cachedNewsXml);
    }
    cachedNewsXml = await generateNewsSitemap();
    cachedNewsAt = now;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(cachedNewsXml);
  } catch (err) {
    console.error('[SitemapNews] Error:', err);
    res.status(500).send('<?xml version="1.0"?><error>Failed</error>');
  }
});

// Image sitemap — article thumbnails for Google Images
async function generateImagesSitemap() {
  const Article = require('../models/Article');
  const SoiKeoArticle = require('../models/SoiKeoArticle');
  const urls = [];

  const pushImageEntry = (loc, imageUrl, caption) => {
    urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:caption>${escapeXml(caption)}</image:caption>
    </image:image>
  </url>`);
  };

  try {
    const news = await Article.find({ status: 'published', image: { $exists: true, $ne: '' } })
      .sort({ pubDate: -1 })
      .limit(500)
      .select('slug title image')
      .lean();
    for (const a of news) {
      const slug = a.slug || Article.slugifyFromTitle(a.title);
      if (!slug || !a.image) continue;
      pushImageEntry(`${SITE_URL}/tin-bong-da/${slug}`, a.image, a.title);
    }
  } catch (err) {
    console.error('[SitemapImages] Article load failed:', err.message);
  }

  try {
    const soiKeo = await SoiKeoArticle.find({ status: 'published', thumbnail: { $exists: true, $ne: '' } })
      .sort({ createdAt: -1 })
      .limit(500)
      .select('slug title thumbnail')
      .lean();
    for (const a of soiKeo) {
      if (!a.slug || !a.thumbnail) continue;
      const imageUrl = a.thumbnail.startsWith('http') ? a.thumbnail : `${SITE_URL}${a.thumbnail}`;
      pushImageEntry(`${SITE_URL}/nhan-dinh/${a.slug}`, imageUrl, a.title);
    }
  } catch (err) {
    console.error('[SitemapImages] SoiKeo load failed:', err.message);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;
}

router.get('/sitemap-images.xml', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedImagesXml && now - cachedImagesAt < IMAGES_CACHE_TTL) {
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=1800');
      return res.send(cachedImagesXml);
    }
    cachedImagesXml = await generateImagesSitemap();
    cachedImagesAt = now;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(cachedImagesXml);
  } catch (err) {
    console.error('[SitemapImages] Error:', err);
    res.status(500).send('<?xml version="1.0"?><error>Failed</error>');
  }
});

// Sitemap index — lists all sub-sitemaps
router.get('/sitemap-index.xml', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-news.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-images.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// GET /robots.txt - reference the sitemap
router.get('/robots.txt', (req, res) => {
  const txt = `User-agent: *
Allow: /

# Sitemaps (index + specialized)
Sitemap: ${SITE_URL}/sitemap-index.xml
Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-news.xml
Sitemap: ${SITE_URL}/sitemap-images.xml

# Disallow API endpoints
Disallow: /api/
`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(txt);
});

module.exports = router;
module.exports.invalidateSitemapCache = invalidateSitemapCache;
