const cron = require('node-cron');
const soiKeoGenerator = require('./soi-keo-generator');

const MAX_ARTICLES_PER_DAY = 20;
const MAX_ARTICLES_PER_RUN = 5;

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
  console.log('📋 Schedule:');
  console.log('   - 06:00 AM: Morning generation');
  console.log('   - 12:00 PM: Midday generation');
  console.log('   - 06:00 PM: Evening generation');
  console.log('   - 10:00 PM: Night generation');
  console.log(`   - Daily limit: ${MAX_ARTICLES_PER_DAY} articles`);
  console.log('==========================================\n');

  // Morning job: 6:00 AM
  cron.schedule('0 6 * * *', () => {
    console.log('\n🌅 [SoiKeoScheduler] Morning job triggered');
    runGenerationJob();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  // Midday job: 12:00 PM
  cron.schedule('0 12 * * *', () => {
    console.log('\n☀️ [SoiKeoScheduler] Midday job triggered');
    runGenerationJob();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  // Evening job: 6:00 PM
  cron.schedule('0 18 * * *', () => {
    console.log('\n🌆 [SoiKeoScheduler] Evening job triggered');
    runGenerationJob();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  // Night job: 10:00 PM
  cron.schedule('0 22 * * *', () => {
    console.log('\n🌙 [SoiKeoScheduler] Night job triggered');
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
      schedules: ['06:00 AM', '12:00 PM', '06:00 PM', '10:00 PM'],
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
