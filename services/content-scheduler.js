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
// Schedule:
// - Round previews: 06:15 + 18:15 (twice daily; rounds rarely change so 4x
//   was wasteful — most runs hit existsRoundPreview)
// - H2H analysis: 35 minutes past every 4 hours, max 8 per run
// - Cleanup old articles: Daily at 3am
function startContentScheduler() {
  // Round previews — 2x/day (06:15 morning, 18:15 evening). A new round only
  // appears once a week per league, so the previous "every 6 hours" was
  // 90% no-op runs that still hit Claude with sanity checks.
  cron.schedule('15 6,18 * * *', async () => {
    console.log('[ContentScheduler] Running round preview generation...');
    try {
      const result = await roundPreviewGenerator.run(3);
      if (result.generated > 0) invalidateSitemapCache();
      console.log(`[ContentScheduler] Round previews done: ${result.generated} generated (${result.duration || 0}s)`);
    } catch (error) {
      console.error('[ContentScheduler] Round preview generation failed:', error.message);
    }
  });

  // H2H analysis - 6 times/day, 35 minutes past every 4 hours.
  cron.schedule('35 */4 * * *', async () => {
    console.log('[ContentScheduler] Running H2H analysis generation...');
    try {
      const result = await h2hGenerator.run(8);
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

  console.log('[ContentScheduler] Started - Round previews (06:15, 18:15), H2H (every 4h at xx:35), Cleanup (3am)');
}

module.exports = { startContentScheduler };
