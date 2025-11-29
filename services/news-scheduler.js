const cron = require('node-cron');
const { runAutoNewsGeneration } = require('./auto-news-generator');
const connectDB = require('../config/database');
const Article = require('../models/Article');

// Cron schedule patterns:
// */30 * * * * - Every 30 minutes
// 0 */2 * * * - Every 2 hours
// 0 */6 * * * - Every 6 hours
// 0 0 * * * - Every day at midnight
// 0 3 * * * - Every day at 3AM
// 0 8,14,20 * * * - At 8AM, 2PM, and 8PM every day

const SCHEDULE_PATTERN = '0 */6 * * *'; // Every 6 hours
const CLEANUP_PATTERN = '0 3 * * *'; // Every day at 3AM
const MAX_ARTICLES_PER_RUN = 5; // Generate 5 articles per run
const ARTICLE_RETENTION_DAYS = 10; // Keep articles for 10 days

let schedulerRunning = false;
let lastRunTime = null;
let lastRunResult = null;
let lastCleanupTime = null;
let lastCleanupResult = null;

/**
 * Clean up old articles (older than ARTICLE_RETENTION_DAYS)
 */
async function cleanupOldArticles() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARTICLE_RETENTION_DAYS);

    console.log(`\n🧹 Starting cleanup: Deleting articles older than ${ARTICLE_RETENTION_DAYS} days (before ${cutoffDate.toISOString()})`);

    const result = await Article.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    const deletedCount = result.deletedCount;
    console.log(`✅ Cleanup completed: Deleted ${deletedCount} old articles`);

    return {
      success: true,
      deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    };
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0,
    };
  }
}

/**
 * Start the news scheduler
 */
function startNewsScheduler() {
  if (schedulerRunning) {
    console.log('⚠️  News scheduler is already running');
    return;
  }

  console.log('\n🤖 ========== NEWS SCHEDULER STARTING ==========');
  console.log(`📅 News Generation: ${SCHEDULE_PATTERN} (Every 6 hours)`);
  console.log(`🧹 Cleanup Schedule: ${CLEANUP_PATTERN} (Every day at 3AM)`);
  console.log(`🎯 Articles per run: ${MAX_ARTICLES_PER_RUN}`);
  console.log(`📦 Retention: ${ARTICLE_RETENTION_DAYS} days`);
  console.log('==============================================\n');

  // Schedule news generation (every 2 hours)
  cron.schedule(SCHEDULE_PATTERN, async () => {
    console.log('\n⏰ Scheduled news generation triggered!');

    try {
      // Ensure DB is connected
      await connectDB();

      // Run auto-generation
      const result = await runAutoNewsGeneration(MAX_ARTICLES_PER_RUN);

      lastRunTime = new Date();
      lastRunResult = result;

      if (result.success) {
        console.log(`✅ Scheduled generation completed successfully`);
      } else {
        console.log(`❌ Scheduled generation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error);
      lastRunResult = {
        success: false,
        error: error.message,
      };
    }
  });

  // Schedule cleanup (every day at 3AM)
  cron.schedule(CLEANUP_PATTERN, async () => {
    console.log('\n⏰ Scheduled cleanup triggered!');

    try {
      await connectDB();
      const result = await cleanupOldArticles();

      lastCleanupTime = new Date();
      lastCleanupResult = result;

      if (result.success) {
        console.log(`✅ Cleanup completed: ${result.deletedCount} articles deleted`);
      } else {
        console.log(`❌ Cleanup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Cleanup scheduler error:', error);
      lastCleanupResult = {
        success: false,
        error: error.message,
        deletedCount: 0,
      };
    }
  });

  schedulerRunning = true;
  console.log('✅ News scheduler started successfully!\n');
}

/**
 * Stop the scheduler
 */
function stopNewsScheduler() {
  if (!schedulerRunning) {
    console.log('⚠️  News scheduler is not running');
    return;
  }

  schedulerRunning = false;
  console.log('🛑 News scheduler stopped\n');
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: schedulerRunning,
    schedule: SCHEDULE_PATTERN,
    cleanupSchedule: CLEANUP_PATTERN,
    maxArticlesPerRun: MAX_ARTICLES_PER_RUN,
    retentionDays: ARTICLE_RETENTION_DAYS,
    lastRunTime,
    lastRunResult,
    lastCleanupTime,
    lastCleanupResult,
  };
}

/**
 * Manual trigger (for testing)
 */
async function triggerManualRun(maxArticles = MAX_ARTICLES_PER_RUN) {
  console.log('\n🚀 Manual news generation triggered!');

  try {
    await connectDB();
    const result = await runAutoNewsGeneration(maxArticles);

    lastRunTime = new Date();
    lastRunResult = result;

    return result;
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Manual cleanup trigger (for testing)
 */
async function triggerManualCleanup() {
  console.log('\n🧹 Manual cleanup triggered!');

  try {
    await connectDB();
    const result = await cleanupOldArticles();

    lastCleanupTime = new Date();
    lastCleanupResult = result;

    return result;
  } catch (error) {
    console.error('❌ Manual cleanup error:', error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0,
    };
  }
}

module.exports = {
  startNewsScheduler,
  stopNewsScheduler,
  getSchedulerStatus,
  triggerManualRun,
  triggerManualCleanup,
};
