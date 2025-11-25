// server.js - Main Football API Backend
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');
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
const oddsSyncJob = require('./services/oddsSyncJob');
const matchCacheWorker = require('./workers/matchCacheWorker');
const connectArticlesDB = require('./config/database');
const { startNewsScheduler } = require('./services/news-scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://yourdomain.com',  // Thay bằng domain WordPress của bạn
        'https://www.yourdomain.com',
        'http://localhost:3000'     // Cho local development
      ]
    : '*', // Allow all in development
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

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
      'POST /api/scheduler/trigger'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
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

  // Connect to Articles database and start news scheduler
  try {
    await connectArticlesDB();
    startNewsScheduler();
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