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
  // ALL CONTENT GENERATION DISABLED (apr-2026 freeze pass).
  // Strategy shift: stop fresh-article churn, focus on long-form evergreen
  // pages (/doi-bong, /cau-thu, /huan-luyen-vien, /kien-thuc-bong-da, etc.)
  // that don't need daily updates. Existing articles remain accessible;
  // no new ones generated until the freeze is lifted.
  //
  // Round previews — DISABLED. Re-enable by uncommenting.
  // cron.schedule('15 12 * * *', async () => {
  //   const result = await roundPreviewGenerator.run(3);
  //   if (result.generated > 0) invalidateSitemapCache();
  // });
  //
  // H2H analysis — DISABLED (consolidated under /nhan-dinh earlier).
  // cron.schedule('35 */4 * * *', async () => {
  //   const result = await h2hGenerator.run(4);
  //   if (result.generated > 0) invalidateSitemapCache();
  // });
  //
  // Cleanup — DISABLED so the existing archive doesn't drain while
  // generation is paused. Re-enable together with the generator crons.
  // cron.schedule('0 3 * * *', async () => {
  //   const result = await AutoArticle.cleanupOldArticles(7);
  //   if (result.deleted > 0) invalidateSitemapCache();
  // });

  console.log('[ContentScheduler] FROZEN — round-preview / h2h / cleanup all disabled');
}

module.exports = { startContentScheduler };
