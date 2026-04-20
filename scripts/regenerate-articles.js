/**
 * Re-generate old soi-keo articles with improved prompt
 *
 * Usage: node scripts/regenerate-articles.js [--limit=10] [--dry-run]
 *
 * This script:
 * 1. Finds published articles with old-style content (template patterns)
 * 2. Re-generates content using the updated prompt
 * 3. Updates the article in MongoDB
 *
 * It does NOT change: slug, matchInfo, oddsData, fixtureId, views, createdAt
 * It DOES change: title, excerpt, content.*, metaTitle, metaDescription, tags
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const soiKeoGenerator = require('../services/soi-keo-generator');

const DB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
const dryRun = args.includes('--dry-run');

async function findOldStyleArticles(limit) {
  // Find articles with template patterns
  return await SoiKeoArticle.find({
    status: 'published',
    $or: [
      // Old title pattern
      { title: /^Nhận định .+ vs .+ \d{2}:\d{2} ngày/ },
      // Old intro pattern
      { 'content.introduction': /^Trận đấu giữa/ },
      // Old prediction pattern
      { 'content.prediction': /^(\*\*)?Dự Đoán Tỷ Số Chi Tiết|^Dựa trên (toàn bộ )?phân tích/ },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function main() {
  console.log(`\n🔄 Re-generate old articles (limit: ${limit}, dry-run: ${dryRun})\n`);

  await mongoose.connect(DB_URI);
  console.log('✅ Connected to MongoDB\n');

  const articles = await findOldStyleArticles(limit);
  console.log(`Found ${articles.length} articles with old-style content\n`);

  if (articles.length === 0) {
    console.log('No articles need re-generation.');
    process.exit(0);
  }

  const generator = soiKeoGenerator;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`[${i + 1}/${articles.length}] ${article.title}`);

    if (dryRun) {
      console.log('  → Would re-generate (dry-run)\n');
      continue;
    }

    try {
      // Build match data structure that buildPrompt expects
      const matchData = {
        fixture: {
          id: article.fixtureId,
          date: article.matchInfo.matchDate,
          venue: { name: article.matchInfo.venue || null },
        },
        teams: {
          home: {
            id: article.matchInfo.homeTeam.id,
            name: article.matchInfo.homeTeam.name,
          },
          away: {
            id: article.matchInfo.awayTeam.id,
            name: article.matchInfo.awayTeam.name,
          },
        },
        league: {
          name: article.matchInfo.league.name,
          country: article.matchInfo.league.country,
        },
      };

      // Fetch fresh H2H and form data
      let h2hData = 'Không có dữ liệu H2H.';
      let homeForm = 'Không có dữ liệu.';
      let awayForm = 'Không có dữ liệu.';

      try {
        const h2h = await generator.getH2H(article.matchInfo.homeTeam.id, article.matchInfo.awayTeam.id);
        if (h2h) h2hData = h2h;
      } catch (e) { /* use default */ }

      try {
        homeForm = await generator.getTeamForm(article.matchInfo.homeTeam.id) || homeForm;
        awayForm = await generator.getTeamForm(article.matchInfo.awayTeam.id) || awayForm;
      } catch (e) { /* use default */ }

      const prompt = generator.buildPrompt(matchData, article.oddsData, h2hData, homeForm, awayForm);
      const aiContent = await generator.generateAIContent(prompt);

      if (!aiContent || !aiContent.introduction) {
        console.log('  ❌ AI returned invalid content\n');
        failed++;
        continue;
      }

      // Fix bettingTips if AI returned array instead of string
      if (Array.isArray(aiContent.bettingTips)) {
        aiContent.bettingTips = aiContent.bettingTips.join('\n');
      }

      // Update article — keep slug, matchInfo, oddsData, views, createdAt
      await SoiKeoArticle.updateOne(
        { _id: article._id },
        {
          $set: {
            title: aiContent.title || article.title,
            excerpt: aiContent.excerpt || article.excerpt,
            'content.introduction': aiContent.introduction,
            'content.teamAnalysis': aiContent.teamAnalysis,
            'content.h2hHistory': aiContent.h2hHistory,
            'content.formAnalysis': aiContent.formAnalysis,
            'content.oddsAnalysis': aiContent.oddsAnalysis,
            'content.prediction': aiContent.prediction,
            'content.bettingTips': aiContent.bettingTips,
            metaTitle: aiContent.title || article.metaTitle,
            metaDescription: aiContent.excerpt || article.metaDescription,
            tags: aiContent.tags || article.tags,
            updatedAt: new Date(),
          },
        }
      );

      console.log(`  ✅ Re-generated: "${aiContent.title?.substring(0, 60)}..."\n`);
      success++;

      // Delay 3s between API calls
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Done: ${success} success, ${failed} failed, ${articles.length} total`);
  console.log(`========================================\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
