/**
 * Match Report Scheduler
 *
 * Runs every 15 minutes; generates news articles for recently-finished matches.
 * Designed to replace the old news-scheduler which generated from thin air.
 *
 * Articles are saved as status='draft' during trial period — flip to 'published'
 * after 2-3 days of quality review.
 */

const cron = require('node-cron');
const matchReportGenerator = require('./match-report-generator');
const { invalidateSitemapCache } = require('../routes/sitemap');

const MAX_PER_RUN = 5;
const SCHEDULE = '*/15 * * * *'; // Every 15 minutes

let isRunning = false;
let lastRun = null;
let stats = { totalRuns: 0, totalGenerated: 0, lastError: null };

async function runJob() {
  if (isRunning) {
    console.log('[MatchReportScheduler] Job already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const result = await matchReportGenerator.run(MAX_PER_RUN);
    stats.totalRuns++;
    stats.totalGenerated += result.generated || 0;
    stats.lastError = null;
    lastRun = new Date();

    // Only invalidate if new reports were created — though note: these are drafts
    // so don't appear in sitemap until status='published'. Still safe to call.
    if (result.generated > 0) {
      invalidateSitemapCache();
    }
  } catch (err) {
    console.error('[MatchReportScheduler] Job failed:', err.message);
    stats.lastError = err.message;
  } finally {
    isRunning = false;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MatchReportScheduler] Done in ${duration}s\n`);
  }
}

function startMatchReportScheduler() {
  console.log('\n📰 ========== MATCH REPORT SCHEDULER ==========');
  console.log(`📅 Schedule: every 15 minutes (${SCHEDULE})`);
  console.log(`📝 Max per run: ${MAX_PER_RUN} reports`);
  console.log(`🚦 Status: reports saved as DRAFT (trial period)`);
  console.log('===============================================\n');

  cron.schedule(SCHEDULE, () => {
    console.log(`\n⏰ [MatchReportScheduler] Triggered at ${new Date().toISOString()}`);
    runJob();
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // Initial run 3 minutes after start (after soi-keo initial at 2 min)
  setTimeout(() => {
    console.log('\n🚀 [MatchReportScheduler] Initial run');
    runJob();
  }, 3 * 60 * 1000);
}

function getSchedulerStatus() {
  return {
    isRunning,
    lastRun,
    stats: { ...stats },
    config: {
      schedule: SCHEDULE,
      maxPerRun: MAX_PER_RUN,
      defaultStatus: 'draft',
    },
  };
}

async function triggerManualRun(maxArticles = MAX_PER_RUN) {
  if (isRunning) return { success: false, message: 'Job already running' };
  try {
    const result = await matchReportGenerator.run(maxArticles);
    stats.totalRuns++;
    stats.totalGenerated += result.generated || 0;
    lastRun = new Date();
    if (result.generated > 0) invalidateSitemapCache();
    return { success: true, message: `Generated ${result.generated} drafts`, data: result };
  } catch (err) {
    stats.lastError = err.message;
    return { success: false, message: err.message };
  }
}

module.exports = {
  startMatchReportScheduler,
  getSchedulerStatus,
  triggerManualRun,
  runJob,
};
