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

  const prompt = `Bạn là chuyên gia phân tích bóng đá hàng đầu Việt Nam. Viết bài preview vòng đấu SEO chất lượng cao bằng tiếng Việt CÓ DẤU đầy đủ.

**THÔNG TIN VÒNG ĐẤU:**
- Giải đấu: ${league.name} (${league.country})
- Vòng: ${roundNumber}
- Mùa giải: ${seasonDisplay}
- Số trận: ${matches.length}

**DANH SÁCH TRẬN ĐẤU:**
${matchList}

Viết bài preview DÀI 1000-1500 từ, SEO-friendly, giọng văn chuyên gia, bao gồm:

1. **Tổng quan vòng đấu** (200-300 từ): Đây là vòng mấy, những gì đang xảy ra trong mùa giải, bối cảnh BXH hiện tại (ai đang dẫn đầu, ai đang chậm, cuộc đua vô địch/xuống hạng/cúp châu Âu)

2. **Các trận đấu đáng xem** (400-600 từ): Chọn 2-3 trận nổi bật nhất, phân tích ngắn gọn:
   - Vì sao trận này đáng xem
   - Phong độ 2 đội gần đây (ước lượng hợp lý)
   - Dự đoán kết quả

3. **Bối cảnh BXH & cuộc đua** (200-300 từ): Phân tích cuộc đua vô địch, top 4, xuống hạng, những đội cần điểm

4. **Cầu thủ đáng xem** (100-200 từ): 3-5 cầu thủ nổi bật có thể tạo khác biệt trong vòng này

5. **Dự đoán kết quả chính** (100-150 từ): Dự đoán ngắn gọn cho 2-3 trận chính

Format trả về JSON:
{
  "title": "Preview ${league.name} Vòng ${roundNumber} mùa giải ${seasonDisplay} - Những trận đấu đáng xem",
  "excerpt": "[150-200 ký tự - mô tả ngắn gọn vòng đấu, dùng 'nhận định', 'phân tích', 'dự đoán']",
  "content": "[Toàn bộ nội dung bài viết 1000-1500 từ, dùng markdown format với ## heading, **bold**, bullet points]",
  "metaTitle": "Preview ${league.name} Vòng ${roundNumber} ${seasonDisplay} | Nhận định & Phân tích",
  "metaDescription": "[150-160 ký tự - SEO meta description]",
  "tags": ["${league.name}", "Vòng ${roundNumber}", "preview", "nhận định", "phân tích bóng đá"]
}

LƯU Ý QUAN TRỌNG:
- PHẢI viết tiếng Việt CÓ DẤU đầy đủ (ví dụ: "phân tích", KHÔNG viết "phan tich")
- KHÔNG dùng "soi kèo", "kèo nhà cái", "cá cược" trong title/excerpt/meta
- Dùng "nhận định", "phân tích", "dự đoán" thay thế
- Trả về ĐÚNG JSON format, content là một string markdown duy nhất
- KHÔNG bịa chấn thương cầu thủ, chỉ dùng kiến thức chung`;

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

      // Runtime validator — drop AI batches with banned phrases or weak length.
      const { validate: validateContent } = require('./contentValidator');
      const validationIssues = validateContent({
        title: aiContent.title,
        description: aiContent.excerpt,
        content: aiContent.content,
      }, { minTotalWords: 800 });
      if (validationIssues.length) {
        console.warn(`[RoundPreview] AI rejected: ${validationIssues.join('; ')}`);
        continue;
      }

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
        // Hold for admin review — /admin auto-publishes on full sign-off.
        status: 'draft',
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
