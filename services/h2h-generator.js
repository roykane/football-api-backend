const AutoArticle = require('../models/AutoArticle');
const axios = require('axios');
require('dotenv').config();

const LOCAL_API_URL = process.env.LOCAL_API_URL || 'http://localhost:5000';
const API_SPORTS_URL = process.env.API_SPORTS_URL || 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_FOOTBALL_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
 * Fetch hot/upcoming matches from internal API
 */
async function fetchHotMatches(limit = 20) {
  try {
    const response = await axios.get(`${LOCAL_API_URL}/api/matches/hot`, {
      params: {
        limit: limit,
        offset: 0,
        includeOdds: false,
        'sortBy[]': ['topTier', 'oddFirst', 'latest'],
      },
    });

    const items = response.data?.items || [];
    const allMatches = [];

    for (const league of items) {
      if (league.matches && Array.isArray(league.matches)) {
        for (const match of league.matches) {
          allMatches.push({
            ...match,
            leagueInfo: {
              id: league._id,
              name: league.name,
              logo: league.image,
              country: league.country?.name || 'Unknown',
            },
          });
        }
      }
    }

    // Filter only upcoming (scheduled)
    const upcoming = allMatches.filter(m => m.status === 'scheduled');
    console.log(`[H2H] Fetched ${upcoming.length} upcoming hot matches`);
    return upcoming;
  } catch (error) {
    console.error('[H2H] Failed to fetch hot matches:', error.message);
    return [];
  }
}

/**
 * Fetch H2H data from API-Sports
 */
async function fetchH2HData(homeTeamId, awayTeamId) {
  try {
    const response = await footballApi.get('/fixtures/headtohead', {
      params: {
        h2h: `${homeTeamId}-${awayTeamId}`,
        last: 10,
      },
    });

    const fixtures = response.data?.response || [];
    if (fixtures.length === 0) return null;

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let totalGoals = 0;
    let bttsCount = 0;
    let over25 = 0;
    const matchDetails = [];

    for (const f of fixtures) {
      const homeGoals = f.goals.home || 0;
      const awayGoals = f.goals.away || 0;
      const isHomeTeamFirst = f.teams.home.id === homeTeamId;
      const date = new Date(f.fixture.date);
      const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const score = `${homeGoals}-${awayGoals}`;
      const venue = isHomeTeamFirst ? 'San nha' : 'San khach';

      if (homeGoals === awayGoals) {
        draws++;
      } else if ((isHomeTeamFirst && homeGoals > awayGoals) || (!isHomeTeamFirst && awayGoals > homeGoals)) {
        homeWins++;
      } else {
        awayWins++;
      }

      totalGoals += homeGoals + awayGoals;
      if (homeGoals + awayGoals > 2.5) over25++;
      if (homeGoals > 0 && awayGoals > 0) bttsCount++;

      matchDetails.push({
        date: dateStr,
        home: f.teams.home.name,
        away: f.teams.away.name,
        score,
        venue,
        league: f.league?.name || 'Unknown',
      });
    }

    const total = fixtures.length;
    const avgGoals = total > 0 ? (totalGoals / total).toFixed(2) : 0;
    const bttsPercent = total > 0 ? ((bttsCount / total) * 100).toFixed(0) : 0;
    const over25Percent = total > 0 ? ((over25 / total) * 100).toFixed(0) : 0;

    return {
      stats: {
        totalMatches: total,
        homeWins,
        awayWins,
        draws,
        avgGoals: parseFloat(avgGoals),
      },
      details: matchDetails,
      summary: {
        bttsCount,
        bttsPercent: parseFloat(bttsPercent),
        over25Count: over25,
        over25Percent: parseFloat(over25Percent),
        totalGoals,
      },
    };
  } catch (error) {
    console.error(`[H2H] Failed to fetch H2H for ${homeTeamId}-${awayTeamId}:`, error.message);
    return null;
  }
}

/**
 * Fetch recent form for a team
 */
async function fetchTeamForm(teamId) {
  try {
    const response = await footballApi.get('/fixtures', {
      params: {
        team: teamId,
        last: 5,
        status: 'FT',
      },
    });

    const fixtures = response.data?.response || [];
    if (fixtures.length === 0) return 'Khong co du lieu phong do.';

    const results = [];
    for (const f of fixtures) {
      const isHome = f.teams.home.id === teamId;
      const teamGoals = isHome ? f.goals.home : f.goals.away;
      const oppGoals = isHome ? f.goals.away : f.goals.home;
      const oppName = isHome ? f.teams.away.name : f.teams.home.name;
      let result;
      if (teamGoals > oppGoals) result = 'W';
      else if (teamGoals < oppGoals) result = 'L';
      else result = 'D';
      results.push(`${result} vs ${oppName} (${teamGoals}-${oppGoals})`);
    }

    return results.join(' | ');
  } catch (error) {
    console.error(`[H2H] Failed to fetch form for team ${teamId}:`, error.message);
    return 'Khong co du lieu phong do.';
  }
}

/**
 * Generate H2H analysis content using Claude AI
 */
async function generateH2HContent(homeTeam, awayTeam, league, matchDate, h2hData, homeForm, awayForm) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const dateStr = new Date(matchDate).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const h2hSummary = h2hData
    ? `${h2hData.stats.totalMatches} tran: ${h2hData.stats.homeWins} thang - ${h2hData.stats.draws} hoa - ${h2hData.stats.awayWins} thua (goc ${homeTeam.name})
TB ban/tran: ${h2hData.stats.avgGoals} | Ca 2 ghi ban: ${h2hData.summary.bttsPercent}% | Tai 2.5: ${h2hData.summary.over25Percent}%
Chi tiet: ${h2hData.details.map(d => `${d.date}: ${d.home} ${d.score} ${d.away} (${d.league})`).join(' | ')}`
    : 'Khong co du lieu doi dau.';

  // Randomize approach for each H2H article
  const approaches = [
    'Viết dạng kể chuyện — bắt đầu từ trận đối đầu drama nhất, rồi mở rộng ra xu hướng chung.',
    'Viết dạng phân tích dữ liệu — tập trung vào con số, tỷ lệ, xu hướng thống kê.',
    'Viết dạng so sánh — liên tục đặt 2 đội cạnh nhau, đối chiếu từng khía cạnh.',
    'Viết dạng timeline — đi từ trận xa nhất đến gần nhất, cho thấy sự thay đổi cán cân.',
    'Viết dạng "điều bạn chưa biết" — tìm những insight bất ngờ từ dữ liệu H2H.',
    'Viết dạng preview — đặt H2H trong bối cảnh trận sắp tới, ai có lợi thế hơn.',
  ];

  const approach = approaches[Math.floor(Math.random() * approaches.length)];

  const prompt = `Bạn là chuyên gia phân tích bóng đá. Viết bài phân tích đối đầu bằng tiếng Việt CÓ DẤU đầy đủ.

**PHONG CÁCH:**
${approach}
KHÔNG viết theo template — mỗi bài phải có cách tiếp cận riêng, câu mở khác nhau. Viết như con người, không như AI.

**THÔNG TIN TRẬN ĐẤU:**
- Trận: ${homeTeam.name} vs ${awayTeam.name}
- Giải đấu: ${league.name} (${league.country})
- Ngày: ${dateStr}

**LỊCH SỬ ĐỐI ĐẦU (10 trận gần nhất):**
${h2hSummary}

**PHONG ĐỘ GẦN ĐÂY:**
- ${homeTeam.name}: ${homeForm}
- ${awayTeam.name}: ${awayForm}

Viết bài 800-1200 từ. Bao gồm các nội dung (tự do sắp xếp, gộp, đặt tên heading khác):
- Lịch sử đối đầu tổng quan
- Xu hướng gần đây
- Thống kê bàn thắng (TB/trận, BTTS, Tài/Xỉu)
- So sánh phong độ hiện tại
- Điều thú vị hoặc insight bất ngờ

**ĐA DẠNG HÓA:**
- KHÔNG mở bài bằng "Cặp đối đầu giữa X và Y là..." — quá template
- Thay đổi heading, cách dẫn dắt giữa các đoạn
- Xen kẽ câu dài ngắn, dùng ví von khi phù hợp

Format JSON:
{
  "title": "[ĐA DẠNG - không chỉ 'X vs Y - Lịch sử đối đầu...' — thử 'Khi X gặp Y: ...', 'X đấu Y - Ai thống trị?', v.v.]",
  "excerpt": "[150-200 ký tự, ĐA DẠNG]",
  "content": "[800-1200 từ, markdown: ## heading, **bold**, bullet points]",
  "metaTitle": "[ĐA DẠNG format]",
  "metaDescription": "[150-160 ký tự]",
  "tags": ["${homeTeam.name}", "${awayTeam.name}", "${league.name}", "đối đầu", "phân tích", "thống kê"]
}

LƯU Ý:
- Tiếng Việt CÓ DẤU đầy đủ
- KHÔNG dùng "soi kèo", "cá cược" trong title/meta
- Trả về ĐÚNG JSON, content là markdown string duy nhất`;

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
    console.error('[H2H] Claude API error:', error.message);
    throw error;
  }
}

/**
 * Generate H2H article for a specific fixture ID
 */
async function generateForFixture(fixtureId) {
  console.log(`[H2H] Generating article for fixture ${fixtureId}...`);

  try {
    // Check if already exists
    const exists = await AutoArticle.existsH2H(fixtureId);
    if (exists) {
      console.log(`[H2H] Article already exists for fixture ${fixtureId}`);
      return null;
    }

    // Fetch fixture data
    const fixtureResponse = await footballApi.get('/fixtures', {
      params: { id: fixtureId },
    });

    const fixtures = fixtureResponse.data?.response || [];
    if (fixtures.length === 0) {
      throw new Error(`Fixture ${fixtureId} not found`);
    }

    const fixture = fixtures[0];
    const homeTeam = fixture.teams.home;
    const awayTeam = fixture.teams.away;
    const league = fixture.league;
    const matchDate = fixture.fixture.date;

    return await generateArticleFromData(fixtureId, homeTeam, awayTeam, league, matchDate);
  } catch (error) {
    console.error(`[H2H] Failed to generate for fixture ${fixtureId}:`, error.message);
    return null;
  }
}

/**
 * Generate article from match data (shared logic)
 */
async function generateArticleFromData(fixtureId, homeTeam, awayTeam, league, matchDate) {
  // Check if already exists
  const exists = await AutoArticle.existsH2H(fixtureId);
  if (exists) {
    console.log(`[H2H] Article already exists for fixture ${fixtureId}`);
    return null;
  }

  console.log(`[H2H] Generating: ${homeTeam.name} vs ${awayTeam.name}`);

  // Fetch data in parallel
  const [h2hData, homeForm, awayForm] = await Promise.all([
    fetchH2HData(homeTeam.id, awayTeam.id),
    fetchTeamForm(homeTeam.id),
    fetchTeamForm(awayTeam.id),
  ]);

  if (!h2hData) {
    console.log(`[H2H] No H2H data available for ${homeTeam.name} vs ${awayTeam.name}, skipping`);
    return null;
  }

  // Generate AI content
  const aiContent = await generateH2HContent(homeTeam, awayTeam, league, matchDate, h2hData, homeForm, awayForm);

  const leagueIdStr = typeof league.id === 'string' ? league.id : String(league.id);
  const leagueId = parseInt(leagueIdStr.replace('league-', '')) || 0;

  const article = new AutoArticle({
    type: 'h2h-analysis',
    title: aiContent.title,
    excerpt: aiContent.excerpt,
    content: aiContent.content,
    metaTitle: aiContent.metaTitle,
    metaDescription: aiContent.metaDescription,
    tags: aiContent.tags || [homeTeam.name, awayTeam.name, league.name],
    fixtureId: fixtureId,
    matchInfo: {
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        logo: homeTeam.logo || '',
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        logo: awayTeam.logo || '',
      },
      league: {
        id: leagueId,
        name: league.name,
        logo: league.logo || '',
        country: league.country || 'Unknown',
      },
      matchDate: new Date(matchDate),
    },
    h2hStats: h2hData.stats,
    // Hold for admin review — /admin auto-publishes on full sign-off.
    status: 'draft',
    aiModel: 'claude-haiku-4-5-20251001',
  });

  await article.save();
  console.log(`[H2H] Article saved: "${article.title}" (slug: ${article.slug})`);
  return article;
}

/**
 * Main run function - generates H2H articles for hot/upcoming matches
 * @param {number} maxArticles - Maximum articles to generate per run
 */
async function run(maxArticles = 10) {
  console.log('\n[H2H] ========== H2H ANALYSIS GENERATION START ==========');
  console.log(`[H2H] Time: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`[H2H] Target: max ${maxArticles} articles`);

  const startTime = Date.now();
  let generated = 0;

  try {
    const hotMatches = await fetchHotMatches(maxArticles * 3);

    if (hotMatches.length === 0) {
      console.log('[H2H] No hot matches found');
      return { success: true, generated: 0, message: 'No matches found' };
    }

    for (const match of hotMatches) {
      if (generated >= maxArticles) break;

      try {
        const fixtureId = match.id || match.fixtureId;
        if (!fixtureId) {
          console.log('[H2H] Skipping match with no fixtureId');
          continue;
        }

        // Extract team/league info from local API format
        const homeTeam = {
          id: match.detail?.home?.id || 0,
          name: match.detail?.home?.name || 'Unknown',
          logo: match.detail?.home?.logo || '',
        };
        const awayTeam = {
          id: match.detail?.away?.id || 0,
          name: match.detail?.away?.name || 'Unknown',
          logo: match.detail?.away?.logo || '',
        };

        if (!homeTeam.id || !awayTeam.id) {
          console.log(`[H2H] Skipping match - missing team IDs`);
          continue;
        }

        const leagueIdStr = match.leagueInfo?.id || '';
        const leagueId = parseInt(String(leagueIdStr).replace('league-', '')) || 0;

        const league = {
          id: leagueId,
          name: match.leagueInfo?.name || 'Unknown',
          logo: match.leagueInfo?.logo || '',
          country: match.leagueInfo?.country || 'Unknown',
        };
        const matchDate = match.dateTime || new Date();

        const article = await generateArticleFromData(fixtureId, homeTeam, awayTeam, league, matchDate);
        if (article) {
          generated++;
        }

        // Rate limiting
        await sleep(3000);
      } catch (error) {
        console.error(`[H2H] Error processing match:`, error.message);
        continue;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[H2H] ========== COMPLETE: ${generated} articles in ${duration}s ==========\n`);

    return { success: true, generated, duration };
  } catch (error) {
    console.error('[H2H] ========== GENERATION FAILED ==========');
    console.error('[H2H] Error:', error.message);
    return { success: false, generated, error: error.message };
  }
}

module.exports = {
  run,
  generateForFixture,
};
