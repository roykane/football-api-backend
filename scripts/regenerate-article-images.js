/**
 * One-shot: regenerate composed images for every published article that has
 * matchInfo populated (match-report + transfer-news). Run on the server after
 * deploying the image generator.
 *
 * Usage:
 *   node scripts/regenerate-article-images.js            # dry-run (count only)
 *   node scripts/regenerate-article-images.js --execute  # write images + update DB
 *   node scripts/regenerate-article-images.js --execute --source=match-report
 *   node scripts/regenerate-article-images.js --execute --limit=10
 */

require('dotenv').config();
const connectDB = require('../config/database');
const Article = require('../models/Article');
const { generateForArticle } = require('../services/article-image-generator');

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const sourceArg = args.find(a => a.startsWith('--source='));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const source = sourceArg ? sourceArg.split('=')[1] : null;
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

  await connectDB();
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}${source ? ` · source=${source}` : ''}${limit ? ` · limit=${limit}` : ''}\n`);

  const query = {
    status: 'published',
    'matchInfo.homeTeam.name': { $exists: true },
  };
  if (source) query.source = source;

  let q = Article.find(query).sort({ createdAt: -1 });
  if (limit > 0) q = q.limit(limit);

  const articles = await q.lean();
  console.log(`Candidates: ${articles.length}\n`);

  if (!execute) {
    articles.slice(0, 5).forEach((a, i) => {
      console.log(`  ${i + 1}. [${a.source}] ${a.title}`);
      console.log(`     home: ${a.matchInfo?.homeTeam?.name} | away: ${a.matchInfo?.awayTeam?.name}`);
    });
    console.log(`\nDry-run. Pass --execute to regenerate images.`);
    process.exit(0);
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    process.stdout.write(`[${i + 1}/${articles.length}] ${a.title?.substring(0, 60)}... `);
    try {
      // Pass a hydrated doc (lean returns plain obj — generator only needs _id + title + matchInfo).
      const url = await generateForArticle(a);
      if (url) {
        await Article.updateOne({ _id: a._id }, { $set: { image: url } });
        console.log(`✅ ${url}`);
        ok++;
      } else {
        console.log(`⊘ skipped`);
        skipped++;
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ OK=${ok}  ⊘ SKIP=${skipped}  ❌ FAIL=${failed}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
