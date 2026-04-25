/**
 * Re-generate old soi-keo articles with improved prompt
 *
 * Usage:
 *   node scripts/regenerate-articles.js --count                   # just count pending
 *   node scripts/regenerate-articles.js --limit=10 --dry-run
 *   node scripts/regenerate-articles.js --limit=10                # regenerate → draft (default)
 *   node scripts/regenerate-articles.js --limit=10 --auto-publish # skip editor gate (dev only)
 *
 * Flow:
 * 1. Find published articles matching old-style template patterns
 * 2. Re-generate content with updated prompt
 * 3. Validate output against banned-phrase list; retry up to 2x if violated
 * 4. Save as status='draft' by default → forces editor to review before going live
 *
 * It does NOT change: slug, matchInfo, oddsData, fixtureId, views, createdAt
 * It DOES change: title, excerpt, content.*, metaTitle, metaDescription, tags, status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const soiKeoGenerator = require('../services/soi-keo-generator');

const DB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
const dryRun = args.includes('--dry-run');
const countOnly = args.includes('--count');
const autoPublish = args.includes('--auto-publish');
const MAX_RETRIES = 2;

// Banned phrase patterns — AI output that matches these is template-heavy junk.
// If any match → retry generation. Claude often slips these back in despite the prompt.
const BANNED_INTRO = [
  /^trận đấu giữa /i,
  /^cuộc chạm trán giữa/i,
  /^trận .+ vs .+ diễn ra lúc/i,
  /^trong khuôn khổ/i,
];
const BANNED_PREDICTION = [
  /^dựa trên (toàn bộ )?phân tích/i,
  /^dự đoán tỷ số chi tiết/i,
  /^\*\*dự đoán/i,
];
// Bumped prediction floor 60 → 150 — 60 words is one sentence, which Google
// reads as thin content. Forces AI to substantiate each call with reasoning.
const MIN_WORDS = { introduction: 100, teamAnalysis: 300, prediction: 150 };

function countWords(str) {
  if (!str) return 0;
  return String(str).trim().split(/\s+/).length;
}

function validateContent(aiContent) {
  const issues = [];
  if (!aiContent?.introduction) return ['missing introduction'];

  for (const pat of BANNED_INTRO) {
    if (pat.test(aiContent.introduction.trim())) {
      issues.push(`intro matches banned pattern: ${pat}`);
    }
  }
  for (const pat of BANNED_PREDICTION) {
    if (aiContent.prediction && pat.test(aiContent.prediction.trim())) {
      issues.push(`prediction matches banned pattern: ${pat}`);
    }
  }
  for (const [field, min] of Object.entries(MIN_WORDS)) {
    const w = countWords(aiContent[field]);
    if (w < min) issues.push(`${field} too short: ${w} words (min ${min})`);
  }
  return issues;
}

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
  console.log(`\n🔄 Re-generate old articles (limit: ${limit}, dry-run: ${dryRun}, count-only: ${countOnly})\n`);

  await mongoose.connect(DB_URI);
  console.log('✅ Connected to MongoDB\n');

  if (countOnly) {
    const totalOld = await SoiKeoArticle.countDocuments({
      status: 'published',
      $or: [
        { title: /^Nhận định .+ vs .+ \d{2}:\d{2} ngày/ },
        { 'content.introduction': /^Trận đấu giữa/ },
        { 'content.prediction': /^(\*\*)?Dự Đoán Tỷ Số Chi Tiết|^Dựa trên (toàn bộ )?phân tích/ },
      ],
    });
    const totalPublished = await SoiKeoArticle.countDocuments({ status: 'published' });
    const totalDraft = await SoiKeoArticle.countDocuments({ status: 'draft' });
    console.log(`Total published:           ${totalPublished}`);
    console.log(`Total draft (editor TODO): ${totalDraft}`);
    console.log(`Old-style still published: ${totalOld}`);
    console.log(`Already refreshed:         ${totalPublished - totalOld}`);
    process.exit(0);
  }

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

      // Generate with retry loop if validator fails
      let aiContent = null;
      let validationIssues = [];
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        aiContent = await generator.generateAIContent(prompt);
        if (!aiContent || !aiContent.introduction) {
          validationIssues = ['AI returned invalid/empty content'];
          if (attempt < MAX_RETRIES) {
            console.log(`  ↻ Retry ${attempt + 1}/${MAX_RETRIES}: empty content`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          break;
        }
        validationIssues = validateContent(aiContent);
        if (validationIssues.length === 0) break;
        if (attempt < MAX_RETRIES) {
          console.log(`  ↻ Retry ${attempt + 1}/${MAX_RETRIES}: ${validationIssues[0]}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!aiContent || validationIssues.length > 0) {
        console.log(`  ❌ Rejected after ${MAX_RETRIES + 1} attempts: ${validationIssues.join('; ')}\n`);
        failed++;
        continue;
      }

      // Fix bettingTips if AI returned array instead of string
      if (Array.isArray(aiContent.bettingTips)) {
        aiContent.bettingTips = aiContent.bettingTips.join('\n');
      }

      // Editor-pass gate: default to 'draft' so a human must approve before go-live.
      // Pass --auto-publish to skip (dev/test only).
      const newStatus = autoPublish ? 'published' : 'draft';

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
            status: newStatus,
            updatedAt: new Date(),
          },
        }
      );

      const statusLabel = newStatus === 'draft' ? '📝 DRAFT (needs editor)' : '✅ PUBLISHED';
      console.log(`  ${statusLabel}: "${aiContent.title?.substring(0, 60)}..."\n`);
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
  if (!autoPublish && success > 0) {
    console.log(`\n⚠️  ${success} bài đang ở status='draft'. Editor cần:`);
    console.log(`    1. Vào admin/Mongo xem bài, chỉnh 1-2 câu thêm quan điểm riêng`);
    console.log(`    2. Set status='published' để go-live`);
  }
  console.log(`========================================\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
