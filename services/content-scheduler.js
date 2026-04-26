const cron = require('node-cron');
const roundPreviewGenerator = require('./round-preview-generator');
const h2hGenerator = require('./h2h-generator');
const AutoArticle = require('../models/AutoArticle');
const { invalidateSitemapCache } = require('../routes/sitemap');

// Start the unified content scheduler for auto-generating articles.
// Crons are intentionally staggered off the xx:00 boundary so the soi-keo
// scheduler (xx:05 every 4h) and this h2h job (xx:35 every 4h) don't fire
// 20+ Claude calls at the same instant.
//
// Schedule (halved apr-2026 cost-cut pass — Anthropic spend dominant):
// - Round previews: 12:15 (once daily; rounds change weekly so 1x is enough)
// - H2H analysis: 35 minutes past every 4 hours, max 4 per run
// - Cleanup old articles: Daily at 3am
function startContentScheduler() {
  // Round previews — 1x/day at 12:15. Down from 2x because rounds only
  // change once a week per league; previous 06:15 + 18:15 was already
  // mostly no-op, so trimming to a single noon run halves spend with no
  // material loss in coverage.
  cron.schedule('15 12 * * *', async () => {
    console.log('[ContentScheduler] Running round preview generation...');
    try {
      const result = await roundPreviewGenerator.run(3);
      if (result.generated > 0) invalidateSitemapCache();
      console.log(`[ContentScheduler] Round previews done: ${result.generated} generated (${result.duration || 0}s)`);
    } catch (error) {
      console.error('[ContentScheduler] Round preview generation failed:', error.message);
    }
  });

  // H2H analysis - 6 times/day, 35 minutes past every 4 hours, max 4 per run.
  cron.schedule('35 */4 * * *', async () => {
    console.log('[ContentScheduler] Running H2H analysis generation...');
    try {
      const result = await h2hGenerator.run(4);
      if (result.generated > 0) invalidateSitemapCache();
      console.log(`[ContentScheduler] H2H analysis done: ${result.generated} generated (${result.duration || 0}s)`);
    } catch (error) {
      console.error('[ContentScheduler] H2H analysis generation failed:', error.message);
    }
  });

  // Cleanup old articles - daily at 3am
  cron.schedule('0 3 * * *', async () => {
    console.log('[ContentScheduler] Running article cleanup...');
    try {
      const result = await AutoArticle.cleanupOldArticles(7);
      if (result.deleted > 0) invalidateSitemapCache();
      console.log(`[ContentScheduler] Cleanup done: ${result.deleted} deleted (h2h: ${result.h2hDeleted}, previews: ${result.previewDeleted})`);
    } catch (error) {
      console.error('[ContentScheduler] Cleanup failed:', error.message);
    }
  });

  console.log('[ContentScheduler] Started - Round previews (12:15), H2H (every 4h at xx:35, max 4/run), Cleanup (3am)');
}

module.exports = { startContentScheduler };
