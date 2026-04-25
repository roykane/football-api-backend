const cron = require('node-cron');
const soiKeoGenerator = require('./soi-keo-generator');
const { invalidateSitemapCache } = require('../routes/sitemap');

const MAX_ARTICLES_PER_DAY = 50;
const MAX_ARTICLES_PER_RUN = 12;

/**
 * Soi Kèo Article Generation Scheduler
 *
 * Schedule:
 * - 6:00 AM: Generate articles for today's matches
 * - 6:00 PM: Generate articles for tomorrow's matches (if slots available)
 *
 * Daily limit: 5 articles
 */

let isRunning = false;
let lastRun = null;
let stats = {
  totalRuns: 0,
  totalGenerated: 0,
  lastError: null
};

/**
 * Run the generation job
 */
async function runGenerationJob() {
  if (isRunning) {
    console.log('[SoiKeoScheduler] Job already running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  console.log('\n⏰ [SoiKeoScheduler] Starting scheduled generation...');
  console.log(`📅 Time: ${new Date().toLocaleString('vi-VN')}`);

  try {
    const result = await soiKeoGenerator.run(MAX_ARTICLES_PER_RUN, MAX_ARTICLES_PER_DAY);

    stats.totalRuns++;
    stats.totalGenerated += result.generated || 0;
    stats.lastError = null;
    lastRun = new Date();

    if (result.generated > 0) {
      invalidateSitemapCache();
      console.log('[SoiKeoScheduler] Sitemap cache invalidated');
    }

    console.log(`✅ [SoiKeoScheduler] Job completed: ${result.generated} articles generated`);

  } catch (error) {
    console.error('❌ [SoiKeoScheduler] Job failed:', error.message);
    stats.lastError = error.message;
  } finally {
    isRunning = false;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  [SoiKeoScheduler] Duration: ${duration}s\n`);
  }
}

/**
 * Start the scheduler
 */
function startSoiKeoScheduler() {
  console.log('\n🗓️  ========== SOI KÈO SCHEDULER ==========');
  console.log('📋 Schedule: 6 runs/day at xx:05 (every 4h, offset +5min)');
  console.log(`   - Daily limit: ${MAX_ARTICLES_PER_DAY} articles`);
  console.log(`   - Per run: ${MAX_ARTICLES_PER_RUN} articles`);
  console.log('==========================================\n');

  // 5 minutes past every 4 hours: 0:05, 4:05, 8:05, 12:05, 16:05, 20:05.
  // Offset off the xx:00 boundary so this doesn't fire alongside h2h
  // (xx:35) or any other top-of-hour cron — keeps Claude's parallel
  // request count from spiking.
  cron.schedule('5 */4 * * *', () => {
    const now = new Date();
    console.log(`\n⏰ [SoiKeoScheduler] Job triggered at ${now.toLocaleTimeString('vi-VN')}`);
    runGenerationJob();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log('✅ Soi Kèo scheduler started');

  // Run initial generation 2 minutes after server start
  setTimeout(() => {
    console.log('\n🚀 [SoiKeoScheduler] Running initial generation...');
    runGenerationJob();
  }, 120000);
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    isRunning,
    lastRun,
    stats: { ...stats },
    config: {
      maxArticlesPerDay: MAX_ARTICLES_PER_DAY,
      schedules: ['Every 4 hours: 00, 04, 08, 12, 16, 20'],
      timezone: 'Asia/Ho_Chi_Minh'
    }
  };
}

/**
 * Manual trigger (for API endpoint)
 */
async function triggerManualRun(maxArticles = MAX_ARTICLES_PER_RUN) {
  if (isRunning) {
    return { success: false, message: 'Job already running' };
  }

  console.log('\n🔧 [SoiKeoScheduler] Manual trigger...');

  try {
    const result = await soiKeoGenerator.run(maxArticles, MAX_ARTICLES_PER_DAY);
    stats.totalRuns++;
    stats.totalGenerated += result.generated || 0;
    lastRun = new Date();

    if (result.generated > 0) invalidateSitemapCache();

    return {
      success: true,
      message: `Generated ${result.generated} articles`,
      data: result
    };

  } catch (error) {
    stats.lastError = error.message;
    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  startSoiKeoScheduler,
  getSchedulerStatus,
  triggerManualRun,
  runGenerationJob
};
