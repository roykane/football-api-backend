const cron = require('node-cron');
const roundPreviewGenerator = require('./round-preview-generator');
const h2hGenerator = require('./h2h-generator');
const AutoArticle = require('../models/AutoArticle');
const { invalidateSitemapCache } = require('../routes/sitemap');

// Start the unified content scheduler for auto-generating articles
// Schedule:
// - Round previews: Every 6 hours, max 3 per run
// - H2H analysis: Every 4 hours, max 8 per run
// - Cleanup old articles: Daily at 3am
function startContentScheduler() {
  // Round previews - 4 times/day (every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    console.log('[ContentScheduler] Running round preview generation...');
    try {
      const result = await roundPreviewGenerator.run(3);
      if (result.generated > 0) invalidateSitemapCache();
      console.log(`[ContentScheduler] Round previews done: ${result.generated} generated (${result.duration || 0}s)`);
    } catch (error) {
      console.error('[ContentScheduler] Round preview generation failed:', error.message);
    }
  });

  // H2H analysis - 6 times/day (every 4 hours)
  cron.schedule('0 */4 * * *', async () => {
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

  console.log('[ContentScheduler] Started - Round previews (6h), H2H (4h), Cleanup (3am)');
}

module.exports = { startContentScheduler };
