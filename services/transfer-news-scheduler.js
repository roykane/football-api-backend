/**
 * Transfer News Scheduler
 *
 * Runs twice daily; fetches recent transfers for target clubs and generates
 * short rewrites. Adds fresh articles to the `transfer` category.
 */

const cron = require('node-cron');
const transferNewsGenerator = require('./transfer-news-generator');
const { invalidateSitemapCache } = require('../routes/sitemap');

const MAX_PER_RUN = 8;
const SCHEDULE = '30 */12 * * *'; // 00:30 and 12:30 daily

let isRunning = false;
let lastRun = null;
let stats = { totalRuns: 0, totalGenerated: 0, lastError: null };

async function runJob() {
  if (isRunning) {
    console.log('[TransferScheduler] Job already running, skipping');
    return;
  }
  isRunning = true;
  const startTime = Date.now();
  try {
    const result = await transferNewsGenerator.run(MAX_PER_RUN);
    stats.totalRuns++;
    stats.totalGenerated += result.generated || 0;
    stats.lastError = null;
    lastRun = new Date();
    if (result.generated > 0) invalidateSitemapCache();
  } catch (err) {
    console.error('[TransferScheduler] Job failed:', err.message);
    stats.lastError = err.message;
  } finally {
    isRunning = false;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[TransferScheduler] Done in ${duration}s\n`);
  }
}

function startTransferNewsScheduler() {
  console.log('\n🔁 ========== TRANSFER NEWS SCHEDULER ==========');
  console.log(`📅 Schedule: ${SCHEDULE} (twice daily)`);
  console.log(`📝 Max per run: ${MAX_PER_RUN} transfers`);
  console.log('=================================================\n');

  cron.schedule(SCHEDULE, () => {
    console.log(`\n⏰ [TransferScheduler] Triggered at ${new Date().toISOString()}`);
    runJob();
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // Initial run 5 minutes after boot (after match-report at 3 min)
  setTimeout(() => {
    console.log('\n🚀 [TransferScheduler] Initial run');
    runJob();
  }, 5 * 60 * 1000);
}

async function triggerManualRun(maxArticles = MAX_PER_RUN, daysBack = 30) {
  if (isRunning) return { success: false, message: 'Job already running' };
  try {
    const result = await transferNewsGenerator.run(maxArticles, daysBack);
    stats.totalRuns++;
    stats.totalGenerated += result.generated || 0;
    lastRun = new Date();
    if (result.generated > 0) invalidateSitemapCache();
    return { success: true, data: result };
  } catch (err) {
    stats.lastError = err.message;
    return { success: false, message: err.message };
  }
}

function getSchedulerStatus() {
  return { isRunning, lastRun, stats: { ...stats }, config: { schedule: SCHEDULE, maxPerRun: MAX_PER_RUN } };
}

module.exports = { startTransferNewsScheduler, triggerManualRun, getSchedulerStatus, runJob };
