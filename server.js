// server.js - Main Football API Backend
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const matchesRouter = require('./routes/matches');
const competitionsRouter = require('./routes/competitions');
const bookmakersRouter = require('./routes/bookmakers');
const standingsRouter = require('./routes/standings');
const countriesRouter = require('./routes/countries');
const postsRouter = require('./routes/posts');
const categoriesRouter = require('./routes/categories');
const aiRouter = require('./routes/ai');
const articlesRouter = require('./routes/articles');
const schedulerRouter = require('./routes/scheduler');
const soiKeoRouter = require('./routes/soiKeo');
const oddsSyncJob = require('./services/oddsSyncJob');
const logger = require('./utils/logger');
const log = logger.child('server');
const { startSoiKeoScheduler } = require('./services/soi-keo-scheduler');
const { startContentScheduler } = require('./services/content-scheduler');
// ✅ RE-ENABLED: $29 Ultra plan = 75,000 calls/day, worker uses ~3,000-5,000
const matchCacheWorker = require('./workers/matchCacheWorker');
const connectArticlesDB = require('./config/database');
const { startNewsScheduler } = require('./services/news-scheduler');
const { startMatchReportScheduler } = require('./services/match-report-scheduler');
const { startTransferNewsScheduler } = require('./services/transfer-news-scheduler');
const teamSync = require('./services/team-sync');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Nginx reverse proxy (needed for rate limiting to get real client IP)
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
const allowedOrigins = [
  'https://martech.sbs',
  'https://www.martech.sbs',
  'https://martech.bet',
  'https://www.martech.bet',
  'https://scoreline.io',
  'https://www.scoreline.io',
  'http://localhost:3000',     // Local development
  'http://localhost:5173'      // Vite dev server
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// JSON body — bumped to 8mb so the admin image upload endpoint can accept
// base64-encoded PNG/WebP/JPG heroes (decoded max ~5MB, base64 adds ~33%).
app.use(express.json({ limit: '8mb' }));

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 min per IP (enough for normal browsing)
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const trustedIPs = ['127.0.0.1', '::1'];
    return trustedIPs.includes(req.ip);
  }
});

// Stricter rate limit for admin/sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Only 20 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests to this endpoint, please try again later.'
  }
});

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Apply strict limiting to admin/sensitive endpoints
app.use('/api/scheduler/trigger', strictLimiter);
app.use('/api/ai/', strictLimiter);

// Clean query parameters middleware
app.use((req, res, next) => {
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      if (
        value === '' || 
        value === null || 
        value === undefined || 
        value === 'undefined' || 
        value === 'null'
      ) {
        delete req.query[key];
      }
      if (typeof value === 'string' && value.length > 0) {
        try {
          req.query[key] = decodeURIComponent(value);
        } catch (e) {
          // Keep original if decode fails
        }
      }
    });
  }
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (Object.keys(req.query).length > 0) {
    console.log('  Params:', JSON.stringify(req.query));
  }
  next();
});

// Cache-Control middleware for GET /api/* — reduces repeat backend load
// and improves Core Web Vitals (faster repeated requests from same client).
app.use('/api/', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const url = req.originalUrl;
  // Live/real-time endpoints — never cache in browser
  if (/\/live|\/hot-live|\/odds\/live|\/scheduler\//.test(url)) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return next();
  }
  // Fixture/match data — short cache (30s browser, 60s CDN)
  if (/\/matches|\/fixtures|\/standings|\/events/.test(url)) {
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=30');
    return next();
  }
  // Articles/content — medium cache (5 min browser, 10 min CDN)
  if (/\/articles|\/news|\/nhan-dinh|\/soi-keo|\/tin-bong-da/.test(url)) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=300');
    return next();
  }
  // Reference data (leagues, teams, countries) — longer cache (10 min / 30 min)
  if (/\/leagues|\/competitions|\/teams|\/countries|\/coaches|\/players/.test(url)) {
    res.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=600');
    return next();
  }
  // Default — 1 min browser, 5 min CDN
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  next();
});

// ============================================
// API FOOTBALL CONFIG
// ============================================

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;

if (!API_KEY || API_KEY === 'your_api_key_here') {
  console.warn('⚠️  WARNING: API_FOOTBALL_KEY not configured!');
}

const footballApi = axios.create({
  baseURL: API_FOOTBALL_URL,
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  }
});

// Export for use in routes
app.locals.footballApi = footballApi;

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Serve static thumbnails
app.use('/thumbnails', express.static(path.join(__dirname, 'public', 'thumbnails'), {
  maxAge: '7d',
  immutable: true,
}));

// Composed article header images (1200x630) — generated per article.
app.use('/article-images', express.static(path.join(__dirname, 'public', 'article-images'), {
  maxAge: '30d',
  immutable: true,
}));

// Local coach photos — downloaded from Wikipedia by scripts/download-coach-images.js
// so we don't depend on a third-party CDN that hotlink-blocks intermittently.
app.use('/coach-images', express.static(path.join(__dirname, 'public', 'coach-images'), {
  maxAge: '30d',
  immutable: true,
}));

// Local player photos — same story as coach-images, populated by
// scripts/download-player-images.js.
app.use('/player-images', express.static(path.join(__dirname, 'public', 'player-images'), {
  maxAge: '30d',
  immutable: true,
}));

// World player photos (Messi, Ronaldo, Mbappé...) — populated by
// scripts/download-world-player-images.js. Same self-host policy.
app.use('/world-player-images', express.static(path.join(__dirname, 'public', 'world-player-images'), {
  maxAge: '30d',
  immutable: true,
}));

// National team flags — populated by scripts/download-team-flags.js.
app.use('/team-flags', express.static(path.join(__dirname, 'public', 'team-flags'), {
  maxAge: '30d',
  immutable: true,
}));

// Stadium photos — populated by scripts/download-stadium-images.js.
app.use('/stadium-images', express.static(path.join(__dirname, 'public', 'stadium-images'), {
  maxAge: '30d',
  immutable: true,
}));

// Trophy / award images — populated by scripts/download-trophy-images.js.
app.use('/trophy-images', express.static(path.join(__dirname, 'public', 'trophy-images'), {
  maxAge: '30d',
  immutable: true,
}));

// Public SEO endpoints (sitemap.xml, robots.txt) - no API key required
app.use('/', require('./routes/sitemap'));

// SEO: Server-rendered HTML pages for search engine crawlers.
//
// Order matters: data-layer SSR (standings, fixtures, top scorers) must
// register BEFORE seoContentPages — the latter has stale handlers for the
// same paths that hit API-Sports directly and 5xx when the upstream rate-
// limits. Express picks the first matching handler, so registering ours
// first means seoContentPages's stale versions never run.
// These two must register BEFORE the broader fixturesSsr / seoTransfersPages
// routers because Express matches in order:
//   - dailySchedSsr's /lich-thi-dau/ngay/:date would otherwise be eaten by
//     fixturesSsr's /lich-thi-dau/:slug treating "ngay" as a league slug.
//   - transferTeamSsr's /chuyen-nhuong/clb/:slug would otherwise be eaten
//     by seoTransfersPages's /chuyen-nhuong/:slug treating "clb" as an
//     article slug.
app.use('/', require('./routes/dailySchedSsr'));
app.use('/', require('./routes/transferTeamSsr'));

app.use('/', require('./routes/standingsSsr'));
app.use('/', require('./routes/fixturesSsr'));
app.use('/', require('./routes/topScorersSsr'));

app.use('/', require('./routes/seoPages'));
app.use('/', require('./routes/seoContentPages'));
app.use('/', require('./routes/vietnamesePlayers'));
app.use('/', require('./routes/worldCup2026Pages'));
app.use('/', require('./routes/footballKnowledge'));
app.use('/', require('./routes/coachesSsr'));
app.use('/', require('./routes/seoNewsPages'));
app.use('/', require('./routes/seoAnalysisPages'));
app.use('/', require('./routes/seoTransfersPages'));
app.use('/', require('./routes/seoHubPages'));
app.use('/', require('./routes/seoMatchPages'));
app.use('/', require('./routes/spaShell'));
app.use('/', require('./routes/matchOgImage'));

// Data-layer SSR — only the routers that don't conflict with
// seoContentPages live here; the conflicting trio (standingsSsr/fixturesSsr/
// topScorersSsr) is mounted earlier so it wins.
app.use('/', require('./routes/teamsSsr'));
app.use('/', require('./routes/leaguesSsr'));
app.use('/', require('./routes/statsSsr'));
app.use('/', require('./routes/staticPagesSsr'));
app.use('/', require('./routes/homeSsr'));

// Batch added 2026-04: top-assist leaderboards, historical winners,
// world players, national teams, stadiums and individual awards. Each
// lives in its own router so touching one doesn't risk the others.
// (dailySchedSsr + transferTeamSsr mounted earlier — see above.)
app.use('/', require('./routes/topAssistsSsr'));
app.use('/', require('./routes/winnersHistorySsr'));
app.use('/', require('./routes/worldPlayersSsr'));
app.use('/', require('./routes/nationalTeamsSsr'));
app.use('/', require('./routes/stadiumsSsr'));
app.use('/', require('./routes/awardsSsr'));

// Mount routers - ✅ Thứ tự quan trọng!
app.use('/api/competitions', competitionsRouter);
app.use('/api/countries', countriesRouter);
app.use('/api/bookmakers', bookmakersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api', aiRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/soi-keo', soiKeoRouter);
app.use('/api/content', require('./routes/contentApi'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/players', require('./routes/playersApi'));
app.use('/api/football-knowledge', require('./routes/knowledgeApi'));
app.use('/api/world-cup-2026', require('./routes/worldCupApi'));
app.use('/api/coaches', require('./routes/coachesApi'));
app.use('/api/world-players', require('./routes/worldPlayersApi'));
app.use('/api/national-teams', require('./routes/nationalTeamsApi'));
app.use('/api/stadiums', require('./routes/stadiumsApi'));
app.use('/api/awards', require('./routes/awardsApi'));
app.use('/api/winners', require('./routes/winnersApi'));
app.use('/api/img', require('./routes/imageProxy'));

// Admin (single-user, cookie session) — keep mounted LAST so any more
// permissive public routes above take priority on identical prefixes.
const { router: adminAuthRouter } = require('./routes/adminAuth');
app.use('/api/admin', adminAuthRouter);
app.use('/api/admin/articles', require('./routes/adminArticles'));

// Legacy endpoints (chỉ giữ lại leagues và fixtures)
app.get('/api/leagues', async (req, res) => {
  try {
    const { country, season } = req.query;
    const response = await footballApi.get('/leagues', {
      params: { country, season }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fixtures', async (req, res) => {
  try {
    const response = await footballApi.get('/fixtures', {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ❌ ĐÃ XÓA legacy /api/standings endpoint
// Giờ sử dụng standingsRouter với giới hạn giải đấu lớn

// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.url}`,
    availableEndpoints: [
      'GET /health',
      'GET /api/competitions',
      'GET /api/competitions/:countrySlug/:leagueSlug',
      'GET /api/competitions/:id',
      'GET /api/competitions/:id/archives',
      'GET /api/countries',
      'GET /api/countries/national',
      'GET /api/countries/other',
      'GET /api/countries/:slug',
      'GET /api/bookmakers',
      'GET /api/bookmakers/:id',
      'GET /api/matches/all',
      'GET /api/matches/live',
      'GET /api/matches/hot',
      'GET /api/matches/:id',
      'GET /api/matches/:id/detail',
      'GET /api/matches/:id/odds',
      'GET /api/matches/:id/forms',
      'GET /api/matches/h2h',
      'GET /api/standings',
      'GET /api/standings/overall',
      'GET /api/standings/form',
      'GET /api/standings/top-score',
      'GET /api/standings/htft',
      'GET /api/standings/competitions',
      'GET /api/standings/top-leagues',
      'GET /api/standings/allowed-leagues',
      'DELETE /api/standings/cache',
      'DELETE /api/matches/cache/odds',
      'POST /api/ai-predict',
      'GET /api/articles',
      'GET /api/articles/search',
      'GET /api/articles/:id',
      'GET /api/scheduler/status',
      'POST /api/scheduler/trigger',
      'GET /api/soi-keo',
      'GET /api/soi-keo/upcoming',
      'GET /api/soi-keo/hot',
      'GET /api/soi-keo/fixture/:fixtureId',
      'GET /api/soi-keo/:slug',
      'POST /api/soi-keo/generate',
      'GET /api/soi-keo/stats/overview'
    ]
  });
});

app.use((error, req, res, next) => {
  log.error('Unhandled error', { method: req.method, url: req.url, err: error });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// ============================================
// MONGODB CONNECTION
// ============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football-odds';

async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
    console.log(`   Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.warn('⚠️  Odds caching will not work without MongoDB!');
    console.warn('   To enable odds caching:');
    console.warn('   1. Install MongoDB: brew install mongodb-community (Mac) or apt install mongodb (Linux)');
    console.warn('   2. Start MongoDB: brew services start mongodb-community or systemctl start mongodb');
    console.warn('   3. Or set MONGODB_URI in .env to point to your MongoDB instance');
  }
}

// ============================================
// ODDS SYNC CRON JOB
// ============================================

function setupOddsSyncJob() {
  if (!process.env.MONGODB_URI && !mongoose.connection.readyState) {
    console.log('⏭️  Skipping odds sync job (MongoDB not connected)');
    return;
  }

  // Run every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    console.log('\n⏰ Running scheduled odds sync job...');
    oddsSyncJob.run().catch(err => {
      console.error('❌ Odds sync job failed:', err.message);
    });
  });

  console.log('✅ Odds sync cron job scheduled (every 10 minutes)');

  // Auto-populate cache on startup (smart: only if cache is empty)
  setTimeout(async () => {
    console.log('\n🚀 Running initial odds sync job...');

    try {
      // Check cache stats first
      const oddsCache = require('./services/oddsCache');
      const stats = await oddsCache.getStats();

      console.log(`📊 Current cache stats:`, stats);

      // If cache is empty, pre-populate with top leagues
      if (stats.total === 0) {
        console.log('\n💾 Cache is empty! Pre-populating with top leagues...');

        const topLeagues = [
          { id: 39, name: 'Premier League' },
          { id: 140, name: 'La Liga' },
          { id: 135, name: 'Serie A' },
          { id: 78, name: 'Bundesliga' },
          { id: 61, name: 'Ligue 1' }
        ];

        // Auto-detect season year: football seasons start in August
        // If current month < August (1-7), use previous year, otherwise use current year
        const now = new Date();
        const currentYear = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear();

        for (const league of topLeagues) {
          console.log(`\n📊 Pre-caching ${league.name} (${league.id})...`);
          try {
            await oddsSyncJob.preCacheLeague(league.id, currentYear);
          } catch (error) {
            console.error(`   ❌ Failed to cache ${league.name}:`, error.message);
          }
        }

        console.log('\n✅ Initial cache population complete');
      } else {
        console.log(`✅ Cache already has ${stats.total} entries, skipping pre-population`);
      }

      // Run normal sync job
      await oddsSyncJob.run();

    } catch (err) {
      console.error('❌ Initial odds sync failed:', err.message);
    }
  }, 30000);
}

// ============================================
// START SERVER
// ============================================

// Connect to MongoDB first, then start server
connectMongoDB().then(async () => {
  // Setup cron job after MongoDB connects
  setupOddsSyncJob();

  // Initialize match cache worker
  if (mongoose.connection.readyState === 1) {
    console.log('\n🚀 Starting Match Cache Worker...');
    matchCacheWorker.init(API_KEY, 'v3.football.api-sports.io');
    matchCacheWorker.start();
  }

  // Connect to Articles database and start schedulers
  try {
    await connectArticlesDB();
    // DISABLED: News scheduler - AI fabricates content (hallucination). Replaced by match-report-scheduler.
    // startNewsScheduler();
    // Start Soi Keo scheduler (20 articles/day)
    startSoiKeoScheduler();
    startContentScheduler();
    // Match report scheduler — generates drafts from real API-Sports match events every 15 min.
    startMatchReportScheduler();
    // Transfer news scheduler — generates articles from real /transfers data twice daily.
    startTransferNewsScheduler();
    teamSync.start();
  } catch (err) {
    console.error('Failed to setup Articles DB and scheduler:', err);
  }
}).catch(err => {
  console.error('Failed to setup MongoDB:', err);
});

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log('  ⚽ Football API Backend');
  console.log('═══════════════════════════════════════');
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════');
  console.log('\n📋 Available API Groups:');
  console.log('\n  🏆 Competitions:');
  console.log('    GET  /api/competitions');
  console.log('    GET  /api/competitions/:countrySlug/:leagueSlug');
  console.log('    GET  /api/competitions/:id');
  console.log('    GET  /api/competitions/:id/archives');
  console.log('\n  🌍 Countries:');
  console.log('    GET  /api/countries');
  console.log('    GET  /api/countries/national');
  console.log('    GET  /api/countries/other');
  console.log('    GET  /api/countries/:slug');
  console.log('\n  📊 Bookmakers:');
  console.log('    GET  /api/bookmakers');
  console.log('    GET  /api/bookmakers/:id');
  console.log('\n  ⚽ Matches:');
  console.log('    GET  /api/matches/all');
  console.log('    GET  /api/matches/live');
  console.log('    GET  /api/matches/hot');
  console.log('    GET  /api/matches/h2h');
  console.log('    GET  /api/matches/:id');
  console.log('    GET  /api/matches/:id/detail');
  console.log('    GET  /api/matches/:id/odds');
  console.log('    GET  /api/matches/:id/forms');
  console.log('\n  📈 Standings:');
  console.log('    GET  /api/standings (requires competitionId)');
  console.log('    GET  /api/standings/overall');
  console.log('    GET  /api/standings/form');
  console.log('    GET  /api/standings/top-score');
  console.log('    GET  /api/standings/htft');
  console.log('    GET  /api/standings/competitions');
  console.log('    GET  /api/standings/top-leagues');
  console.log('    GET  /api/standings/allowed-leagues');
  console.log('\n🧪 Quick Tests:');
  console.log(`  curl "http://localhost:${PORT}/api/matches/all?limit=5"`);
  console.log(`  curl "http://localhost:${PORT}/api/competitions?limit=10"`);
  console.log(`  curl "http://localhost:${PORT}/api/standings/overall?competitionId=league-39"\n`);
});