const AutoArticle = require('../models/AutoArticle');
const axios = require('axios');
require('dotenv').config();

const API_SPORTS_URL = process.env.API_SPORTS_URL || 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_FOOTBALL_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const TOP_LEAGUES = [
  { id: 39, slug: 'premier-league', name: 'Premier League', country: 'England', season: 2025 },
  { id: 140, slug: 'la-liga', name: 'La Liga', country: 'Spain', season: 2025 },
  { id: 135, slug: 'serie-a', name: 'Serie A', country: 'Italy', season: 2025 },
  { id: 78, slug: 'bundesliga', name: 'Bundesliga', country: 'Germany', season: 2025 },
  { id: 61, slug: 'ligue-1', name: 'Ligue 1', country: 'France', season: 2025 },
  { id: 2, slug: 'champions-league', name: 'Champions League', country: 'World', season: 2025 },
  { id: 340, slug: 'v-league-1', name: 'V.League 1', country: 'Vietnam', season: 2025 },
];

const footballApi = axios.create({
  baseURL: API_SPORTS_URL,
  headers: {
    'x-rapidapi-key': API_SPORTS_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io',
  },
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract round number/name from API-Sports round string
 * e.g. "Regular Season - 35" -> "35"
 */
function parseRound(roundStr) {
  if (!roundStr) return null;
  const match = roundStr.match(/(\d+)$/);
  return match ? match[1] : roundStr.replace('Regular Season - ', '').trim();
}

/**
 * Fetch upcoming fixtures for a league and group by round
 */
async function fetchUpcomingRounds(leagueId, season) {
  try {
    const response = await footballApi.get('/fixtures', {
      params: {
        league: leagueId,
        season: season,
        next: 10,
      },
    });

    const fixtures = response.data?.response || [];
    if (fixtures.length === 0) return [];

    // Group by round
    const roundMap = {};
    for (const fixture of fixtures) {
      const round = fixture.league?.round || 'Unknown';
      if (!roundMap[round]) {
        roundMap[round] = [];
      }
      roundMap[round].push(fixture);
    }

    // Convert to array sorted by earliest match date
    return Object.entries(roundMap)
      .map(([round, matches]) => ({
        round,
        roundNumber: parseRound(round),
        matches,
        earliestDate: new Date(Math.min(...matches.map(m => new Date(m.fixture.date)))),
      }))
      .sort((a, b) => a.earliestDate - b.earliestDate);
  } catch (error) {
    console.error(`[RoundPreview] Failed to fetch fixtures for league ${leagueId}:`, error.message);
    return [];
  }
}

/**
 * Build the match list summary for the prompt
 */
function buildMatchList(matches) {
  return matches.map(m => {
    const date = new Date(m.fixture.date);
    const timeStr = date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    return `- ${m.teams.home.name} vs ${m.teams.away.name} (${timeStr})`;
  }).join('\n');
}

/**
 * Generate round preview article using Claude AI
 */
async function generatePreviewContent(league, roundNumber, matches) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const matchList = buildMatchList(matches);
  const season = league.season;
  const seasonDisplay = `${season}/${season + 1}`;

  const prompt = `Ban la chuyen gia phan tich bong da hang dau Viet Nam. Viet bai preview vong dau SEO chat luong cao.

**THONG TIN VONG DAU:**
- Giai dau: ${league.name} (${league.country})
- Vong: ${roundNumber}
- Mua giai: ${seasonDisplay}
- So tran: ${matches.length}

**DANH SACH TRAN DAU:**
${matchList}

Viet bai preview DAI 1000-1500 tu, SEO-friendly, giong van chuyen gia, bao gom:

1. **Tong quan vong dau** (200-300 tu): Day la vong may, nhung gi dang bi dang xay ra trong mua giai, boi canh BXH hien tai (ai dang dan dau, ai dang cham, cuoc dua vo dich/xuong hang/cup chau Au)

2. **Cac tran dau dang xem** (400-600 tu): Chon 2-3 tran noi bat nhat, phan tich ngan gon:
   - Vi sao tran nay dang xem
   - Phong do 2 doi gan day (uoc luong hop ly)
   - Du doan ket qua

3. **Boi canh BXH & cuoc dua** (200-300 tu): Phan tich cuoc dua vo dich, top 4, xuong hang, nhung doi can diem

4. **Cau thu dang xem** (100-200 tu): 3-5 cau thu noi bat co the tao khac biet trong vong nay

5. **Du doan ket qua chinh** (100-150 tu): Du doan ngan gon cho 2-3 tran chinh

Format tra ve JSON:
{
  "title": "Preview ${league.name} Vong ${roundNumber} mua giai ${seasonDisplay} - Nhung tran dau dang xem",
  "excerpt": "[150-200 ky tu - mo ta ngan gon vong dau, dung 'nhan dinh', 'phan tich', 'du doan']",
  "content": "[Toan bo noi dung bai viet 1000-1500 tu, dung markdown format voi ## heading, **bold**, bullet points]",
  "metaTitle": "Preview ${league.name} Vong ${roundNumber} ${seasonDisplay} | Nhan dinh & Phan tich",
  "metaDescription": "[150-160 ky tu - SEO meta description]",
  "tags": ["${league.name}", "Vong ${roundNumber}", "preview", "nhan dinh", "phan tich bong da"]
}

LUU Y SEO QUAN TRONG:
- KHONG dung "soi keo", "keo nha cai", "ca cuoc", "cuoc" trong title/excerpt/metaTitle/metaDescription
- Dung "nhan dinh", "phan tich", "du doan", "odds", "ty le" thay the
- Trong body content co the dung tu nhien hon nhung van han che tu gambling
- Tra ve DUNG JSON format, content la mot string markdown duy nhat
- KHONG bia chieu thuong cau thu, chi dung kien thuc chung`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });

    const responseText = response.data?.content?.[0]?.text;
    if (!responseText) {
      throw new Error('Empty response from Claude API');
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format - no JSON found');
    }

    let jsonStr = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // More aggressive cleanup
      jsonStr = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/\\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ');
      return JSON.parse(jsonStr);
    }
  } catch (error) {
    console.error('[RoundPreview] Claude API error:', error.message);
    throw error;
  }
}

/**
 * Generate preview article for a specific league
 */
async function generateForLeague(leagueId, leagueSlug, leagueName) {
  const league = TOP_LEAGUES.find(l => l.id === leagueId);
  if (!league) {
    // Build a league object from params
    const leagueObj = { id: leagueId, slug: leagueSlug, name: leagueName, country: 'Unknown', season: 2025 };
    return generateForLeagueObj(leagueObj);
  }
  return generateForLeagueObj(league);
}

async function generateForLeagueObj(league) {
  console.log(`[RoundPreview] Processing ${league.name}...`);

  try {
    const rounds = await fetchUpcomingRounds(league.id, league.season);
    if (rounds.length === 0) {
      console.log(`[RoundPreview] No upcoming rounds for ${league.name}`);
      return null;
    }

    // Take the first upcoming round that doesn't have an article yet
    for (const roundData of rounds) {
      const roundNumber = roundData.roundNumber;
      const exists = await AutoArticle.existsRoundPreview(league.id, `Vong ${roundNumber}`, league.season);

      if (exists) {
        console.log(`[RoundPreview] Article already exists for ${league.name} Vong ${roundNumber}`);
        continue;
      }

      console.log(`[RoundPreview] Generating preview for ${league.name} Vong ${roundNumber} (${roundData.matches.length} matches)`);

      const aiContent = await generatePreviewContent(league, roundNumber, roundData.matches);

      const article = new AutoArticle({
        type: 'round-preview',
        title: aiContent.title,
        excerpt: aiContent.excerpt,
        content: aiContent.content,
        metaTitle: aiContent.metaTitle,
        metaDescription: aiContent.metaDescription,
        tags: aiContent.tags || [league.name, `Vong ${roundNumber}`, 'preview'],
        leagueInfo: {
          id: league.id,
          name: league.name,
          slug: league.slug,
          country: league.country,
          logo: roundData.matches[0]?.league?.logo || '',
        },
        round: `Vong ${roundNumber}`,
        seasonYear: league.season,
        status: 'published',
        aiModel: 'claude-haiku-4-5-20251001',
      });

      await article.save();
      console.log(`[RoundPreview] Article saved: "${article.title}" (slug: ${article.slug})`);
      return article;
    }

    console.log(`[RoundPreview] All upcoming rounds for ${league.name} already have articles`);
    return null;
  } catch (error) {
    console.error(`[RoundPreview] Error processing ${league.name}:`, error.message);
    return null;
  }
}

/**
 * Main run function - generates round preview articles for all top leagues
 * @param {number} maxArticles - Maximum articles to generate per run
 */
async function run(maxArticles = 3) {
  console.log('\n[RoundPreview] ========== ROUND PREVIEW GENERATION START ==========');
  console.log(`[RoundPreview] Time: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`[RoundPreview] Target: max ${maxArticles} articles`);

  const startTime = Date.now();
  let generated = 0;

  try {
    // Cleanup old preview articles
    const cleanupResult = await AutoArticle.cleanupOldArticles(7);
    if (cleanupResult.previewDeleted > 0) {
      console.log(`[RoundPreview] Cleanup: Deleted ${cleanupResult.previewDeleted} old preview articles`);
    }

    for (const league of TOP_LEAGUES) {
      if (generated >= maxArticles) break;

      const article = await generateForLeagueObj(league);
      if (article) {
        generated++;
      }

      // Rate limiting between leagues
      await sleep(2000);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[RoundPreview] ========== COMPLETE: ${generated} articles in ${duration}s ==========\n`);

    return { success: true, generated, duration };
  } catch (error) {
    console.error('[RoundPreview] ========== GENERATION FAILED ==========');
    console.error('[RoundPreview] Error:', error.message);
    return { success: false, generated, error: error.message };
  }
}

module.exports = {
  run,
  generateForLeague,
  TOP_LEAGUES,
};
