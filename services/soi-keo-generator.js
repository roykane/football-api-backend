const SoiKeoArticle = require('../models/SoiKeoArticle');
const oddsCache = require('./oddsCache');
const axios = require('axios');
require('dotenv').config();

// Local API URL for hot matches
const LOCAL_API_URL = process.env.LOCAL_API_URL || 'http://localhost:5000';

// Football images for thumbnails
const FOOTBALL_IMAGES = [
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
  'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=800',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800',
  'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=800',
  'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800',
];

class SoiKeoGenerator {
  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.footballApi = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: {
        'x-rapidapi-key': this.apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    });
  }

  /**
   * Get upcoming hot matches from local API (same as shown on frontend)
   * @param {number} limit - Max matches to fetch
   * @returns {Promise<Array>} - Array of fixtures (transformed to API-Sports format)
   */
  async getHotMatches(limit = 10) {
    console.log('\n[SoiKeo] Fetching hot matches from local API...');

    try {
      // Call local hot matches API - only get upcoming matches (status=scheduled)
      const response = await axios.get(`${LOCAL_API_URL}/api/matches/hot`, {
        params: {
          limit: limit * 2, // Fetch extra in case some already have articles
          offset: 0,
          includeOdds: false,
          'sortBy[]': ['topTier', 'oddFirst', 'latest']
        }
      });

      // API response has items[] with leagues, each league has matches[]
      const items = response.data?.items || [];

      // Flatten all matches from all leagues
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
                country: league.country?.name || 'Unknown'
              }
            });
          }
        }
      }

      console.log(`   ✓ Found ${allMatches.length} hot matches from local API`);

      // Filter only upcoming matches (scheduled status)
      const upcomingMatches = allMatches.filter(m => m.status === 'scheduled');
      console.log(`   ✓ ${upcomingMatches.length} upcoming matches (scheduled)`);

      // Transform to API-Sports format for compatibility
      const fixtures = upcomingMatches.map(match => {
        // Extract league ID from _id format "league-135"
        const leagueIdStr = match.leagueInfo?.id || match.competition?._id || '';
        const leagueId = parseInt(leagueIdStr.replace('league-', '')) || 0;

        return {
          fixture: {
            id: match.id || match.fixtureId,
            date: match.dateTime,
            venue: {
              name: match.venue || null
            }
          },
          teams: {
            home: {
              id: match.detail?.home?.id || 0,
              name: match.detail?.home?.name || 'Unknown',
              logo: match.detail?.home?.logo || ''
            },
            away: {
              id: match.detail?.away?.id || 0,
              name: match.detail?.away?.name || 'Unknown',
              logo: match.detail?.away?.logo || ''
            }
          },
          league: {
            id: leagueId,
            name: match.leagueInfo?.name || match.competition?.name || 'Unknown',
            logo: match.leagueInfo?.logo || match.competition?.logo || '',
            country: match.leagueInfo?.country || 'Unknown'
          }
        };
      });

      console.log(`[SoiKeo] Total hot matches prepared: ${fixtures.length}`);
      return fixtures.slice(0, limit);

    } catch (error) {
      console.error(`[SoiKeo] ✗ Failed to fetch from local API:`, error.message);

      // Fallback: try direct API-Sports call for top leagues
      console.log('[SoiKeo] Falling back to API-Sports...');
      return this.getHotMatchesFallback(limit);
    }
  }

  /**
   * Fallback: Get hot matches directly from API-Sports (if local API fails)
   */
  async getHotMatchesFallback(limit = 10) {
    const HOT_LEAGUES = [
      { id: 39, name: 'Premier League' },
      { id: 140, name: 'La Liga' },
      { id: 135, name: 'Serie A' },
      { id: 78, name: 'Bundesliga' },
      { id: 61, name: 'Ligue 1' },
      { id: 2, name: 'Champions League' },
    ];

    const allFixtures = [];
    const now = new Date();
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const fromDate = now.toISOString().split('T')[0];
    const toDate = next48h.toISOString().split('T')[0];
    const seasonYear = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear();

    for (const league of HOT_LEAGUES) {
      try {
        const response = await this.footballApi.get('/fixtures', {
          params: {
            league: league.id,
            season: seasonYear,
            from: fromDate,
            to: toDate,
            status: 'NS'
          }
        });

        const fixtures = response.data?.response || [];
        allFixtures.push(...fixtures);
        await this.sleep(500);

      } catch (error) {
        console.error(`   ✗ Failed to fetch ${league.name}:`, error.message);
      }
    }

    allFixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    return allFixtures.slice(0, limit);
  }

  /**
   * Get odds for a fixture (from cache or API)
   * @param {number} fixtureId - Fixture ID
   * @param {Object} fixtureData - Optional fixture data
   * @returns {Promise<Object|null>} - Odds data
   */
  async getOddsForFixture(fixtureId, fixtureData = null) {
    try {
      // Try cache first
      const cachedOdds = await oddsCache.getOdds(fixtureId);
      if (cachedOdds && cachedOdds.length > 0) {
        console.log(`   [Odds] Cache hit for fixture ${fixtureId}`);
        return this.extractOddsValues(cachedOdds);
      }

      // Fetch from API using oddsCache service
      console.log(`   [Odds] Fetching from API for fixture ${fixtureId}...`);
      const oddsData = await oddsCache.getOrFetchOdds(fixtureId, this.footballApi, fixtureData);

      if (oddsData && oddsData.length > 0) {
        return this.extractOddsValues(oddsData);
      }

      return null;
    } catch (error) {
      console.error(`   [Odds] Error getting odds for ${fixtureId}:`, error.message);
      return null;
    }
  }

  /**
   * Extract key odds values from bookmaker data
   */
  extractOddsValues(bookmakers) {
    if (!bookmakers || bookmakers.length === 0) return null;

    const bookmaker = bookmakers[0]; // Use first bookmaker (usually Bet365)
    const bets = bookmaker.bets || [];

    const matchWinner = bets.find(b => b.name === 'Match Winner');
    const asianHandicap = bets.find(b => b.name === 'Asian Handicap');
    const overUnder = bets.find(b => b.name === 'Goals Over/Under');

    const result = {
      homeWin: null,
      draw: null,
      awayWin: null,
      handicap: { line: null, home: null, away: null },
      overUnder: { line: null, over: null, under: null }
    };

    // Match Winner (1X2)
    if (matchWinner?.values) {
      const home = matchWinner.values.find(v => v.value === 'Home');
      const draw = matchWinner.values.find(v => v.value === 'Draw');
      const away = matchWinner.values.find(v => v.value === 'Away');

      result.homeWin = home?.odd ? parseFloat(home.odd) : null;
      result.draw = draw?.odd ? parseFloat(draw.odd) : null;
      result.awayWin = away?.odd ? parseFloat(away.odd) : null;
    }

    // Asian Handicap
    if (asianHandicap?.values && asianHandicap.values.length >= 2) {
      const homeHcp = asianHandicap.values.find(v => v.value?.includes('Home'));
      const awayHcp = asianHandicap.values.find(v => v.value?.includes('Away'));

      if (homeHcp) {
        // Extract line from value like "Home -0.5"
        const match = homeHcp.value.match(/([+-]?\d+\.?\d*)/);
        result.handicap.line = match ? match[1] : '0';
        result.handicap.home = parseFloat(homeHcp.odd);
      }
      if (awayHcp) {
        result.handicap.away = parseFloat(awayHcp.odd);
      }
    }

    // Over/Under
    if (overUnder?.values) {
      const over25 = overUnder.values.find(v => v.value === 'Over 2.5');
      const under25 = overUnder.values.find(v => v.value === 'Under 2.5');

      if (over25) {
        result.overUnder.line = 2.5;
        result.overUnder.over = parseFloat(over25.odd);
      }
      if (under25) {
        result.overUnder.under = parseFloat(under25.odd);
      }
    }

    return result;
  }

  /**
   * Get H2H data for two teams
   * @param {number} homeTeamId - Home team ID
   * @param {number} awayTeamId - Away team ID
   * @returns {Promise<string>} - H2H summary
   */
  async getH2H(homeTeamId, awayTeamId) {
    try {
      const response = await this.footballApi.get('/fixtures/headtohead', {
        params: {
          h2h: `${homeTeamId}-${awayTeamId}`,
          last: 5
        }
      });

      const fixtures = response.data?.response || [];

      if (fixtures.length === 0) {
        return 'Không có dữ liệu đối đầu.';
      }

      let homeWins = 0;
      let draws = 0;
      let awayWins = 0;
      const results = [];

      for (const f of fixtures) {
        const homeGoals = f.goals.home;
        const awayGoals = f.goals.away;
        const isHomeTeamFirst = f.teams.home.id === homeTeamId;

        const score = isHomeTeamFirst
          ? `${homeGoals}-${awayGoals}`
          : `${awayGoals}-${homeGoals}`;

        if (homeGoals === awayGoals) {
          draws++;
        } else if ((isHomeTeamFirst && homeGoals > awayGoals) ||
                   (!isHomeTeamFirst && awayGoals > homeGoals)) {
          homeWins++;
        } else {
          awayWins++;
        }

        results.push(score);
      }

      return `5 trận gần nhất: ${homeWins} thắng - ${draws} hòa - ${awayWins} thua. Các tỷ số: ${results.join(', ')}`;

    } catch (error) {
      console.error(`   [H2H] Error:`, error.message);
      return 'Không có dữ liệu đối đầu.';
    }
  }

  /**
   * Get recent form for a team
   * @param {number} teamId - Team ID
   * @returns {Promise<string>} - Form summary (W/D/L)
   */
  async getTeamForm(teamId) {
    try {
      const response = await this.footballApi.get('/fixtures', {
        params: {
          team: teamId,
          last: 5,
          status: 'FT'
        }
      });

      const fixtures = response.data?.response || [];

      if (fixtures.length === 0) {
        return 'Không có dữ liệu.';
      }

      const form = fixtures.map(f => {
        const isHome = f.teams.home.id === teamId;
        const teamGoals = isHome ? f.goals.home : f.goals.away;
        const oppGoals = isHome ? f.goals.away : f.goals.home;

        if (teamGoals > oppGoals) return 'W';
        if (teamGoals < oppGoals) return 'L';
        return 'D';
      });

      const wins = form.filter(f => f === 'W').length;
      const draws = form.filter(f => f === 'D').length;
      const losses = form.filter(f => f === 'L').length;

      return `${form.join('')} (${wins}W ${draws}D ${losses}L)`;

    } catch (error) {
      console.error(`   [Form] Error:`, error.message);
      return 'Không có dữ liệu.';
    }
  }

  /**
   * Build AI prompt for article generation (style: giovang.org)
   */
  buildPrompt(matchData, oddsData, h2hData, homeForm, awayForm) {
    const { fixture, teams, league } = matchData;

    const matchTime = new Date(fixture.date).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const matchDateStr = new Date(fixture.date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    let oddsInfo = 'Chưa có tỷ lệ kèo.';
    if (oddsData) {
      oddsInfo = `
- Kèo Châu Âu (1X2): Chủ ${oddsData.homeWin || '-'} | Hòa ${oddsData.draw || '-'} | Khách ${oddsData.awayWin || '-'}
- Kèo Châu Á: Chấp ${oddsData.handicap.line || '0'} (Chủ ${oddsData.handicap.home || '-'} / Khách ${oddsData.handicap.away || '-'})
- Tài/Xỉu: Mốc 2.5 - Tài ${oddsData.overUnder.over || '-'} | Xỉu ${oddsData.overUnder.under || '-'}`;
    }

    return `Bạn là chuyên gia phân tích bóng đá chuyên nghiệp tại Việt Nam, viết bài soi kèo theo phong cách trang giovang.org.

**THÔNG TIN TRẬN ĐẤU:**
- Trận: ${teams.home.name} vs ${teams.away.name}
- Giải đấu: ${league.name} (${league.country})
- Thời gian: ${matchTime} ngày ${matchDateStr}
- Sân: ${fixture.venue?.name || 'Chưa xác định'}

**TỶ LỆ KÈO HIỆN TẠI:**
${oddsInfo}

**LỊCH SỬ ĐỐI ĐẦU (H2H):**
${h2hData}

**PHONG ĐỘ 5 TRẬN GẦN NHẤT:**
- ${teams.home.name}: ${homeForm}
- ${teams.away.name}: ${awayForm}

Viết bài soi kèo CHUYÊN SÂU theo cấu trúc sau (tiếng Việt, giọng văn chuyên nghiệp như nhà phân tích):

1. **introduction**: Giới thiệu trận đấu, vòng đấu, tầm quan trọng, bối cảnh hai đội (3-4 câu chi tiết)

2. **teamAnalysis**: Phân tích CHI TIẾT từng đội:
   - Đội nhà: Vị trí BXH hiện tại, điểm số, phong độ sân nhà, điểm mạnh/yếu, cầu thủ quan trọng
   - Đội khách: Vị trí BXH, thành tích sân khách, phong độ gần đây, điểm mạnh/yếu
   (Mỗi đội 4-5 câu, dùng **bold** cho tên đội)

3. **h2hHistory**: Phân tích lịch sử đối đầu: số trận thắng/hòa/thua, xu hướng ghi bàn, kết quả gần nhất (3-4 câu)

4. **formAnalysis**: Đánh giá phong độ: chuỗi trận gần đây, khả năng ghi bàn, thủng lưới, xu hướng Tài/Xỉu (3-4 câu)

5. **oddsAnalysis**: Phân tích TỶ LỆ KÈO chi tiết:
   - Nhận định Kèo Châu Á (handicap): đội nào được chấp, có hợp lý không
   - Nhận định Kèo Châu Âu (1X2): đội nào được đánh giá cao hơn
   - Nhận định Tài/Xỉu: mốc 2.5 có hợp lý không, xu hướng bàn thắng
   (5-6 câu chi tiết)

6. **prediction**: Dự đoán kết quả:
   - Tỷ số dự đoán cụ thể DỰA TRÊN phân tích ở trên (có thể là 1-0, 2-0, 1-1, 0-0, 2-2, 3-1, 0-1, 1-2, v.v. - KHÔNG luôn chọn 2-1)
   - Tỷ số phải PHÙ HỢP với dự đoán Tài/Xỉu (nếu chọn Xỉu thì không nên dự đoán nhiều bàn)
   - Lý do ngắn gọn cho dự đoán dựa trên phong độ, H2H, tỷ lệ kèo
   (2-3 câu)

7. **bettingTips**: Lời khuyên cược RÕ RÀNG (dạng bullet points):
   - Kèo Châu Á: [lựa chọn cụ thể]
   - Kèo 1X2: [lựa chọn cụ thể]
   - Tài/Xỉu: [Tài hoặc Xỉu + mốc]
   - Tỷ số dự đoán: [tỷ số phù hợp với phân tích, KHÔNG mặc định 2-1]

Format JSON trả về:
{
  "title": "Soi kèo ${teams.home.name} vs ${teams.away.name} ${matchTime} ngày ${matchDateStr}",
  "excerpt": "[Mô tả hấp dẫn 2 câu về trận đấu và dự đoán chính]",
  "introduction": "[nội dung]",
  "teamAnalysis": "[nội dung với **bold** cho tên đội]",
  "h2hHistory": "[nội dung]",
  "formAnalysis": "[nội dung]",
  "oddsAnalysis": "[nội dung chi tiết về từng loại kèo]",
  "prediction": "[nội dung với tỷ số cụ thể]",
  "bettingTips": "- Kèo Châu Á: [tip]\\n- Kèo 1X2: [tip]\\n- Tài/Xỉu: [tip]\\n- Tỷ số: [X-X]",
  "tags": ["${teams.home.name}", "${teams.away.name}", "${league.name}", "soi kèo", "nhận định", "tỷ lệ kèo"]
}

LƯU Ý QUAN TRỌNG:
- Viết tiếng Việt chuẩn, văn phong chuyên nghiệp như chuyên gia
- KHÔNG bịa đặt thông tin chấn thương cầu thủ
- Dựa vào tỷ lệ kèo thực tế để phân tích
- Betting tips phải CỤ THỂ, RÕ RÀNG (không mơ hồ)
- Mỗi phần phải ĐỦ DÀI và CHI TIẾT
- TỶ SỐ DỰ ĐOÁN phải ĐA DẠNG dựa trên phân tích - KHÔNG lặp lại 2-1 cho mọi trận
- Nếu phong độ hai đội tương đương → cân nhắc hòa (1-1, 0-0, 2-2)
- Nếu đội nhà mạnh hơn nhiều → 2-0, 3-0, 3-1
- Nếu đội khách mạnh hơn → 0-1, 1-2, 0-2
- Trả về ĐÚNG format JSON, không có ký tự đặc biệt`;
  }

  /**
   * Generate AI content using Claude API
   */
  async generateAIContent(prompt) {
    if (!this.anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate content');
      }

      const data = await response.json();
      const responseText = data.content[0].text;

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format - no JSON found');
      }

      // Clean JSON string - remove control characters
      let jsonStr = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, ' ')  // Remove control characters
        .replace(/\n/g, '\\n')              // Escape newlines properly
        .replace(/\r/g, '\\r')              // Escape carriage returns
        .replace(/\t/g, '\\t');             // Escape tabs

      // Try to parse, if fails try a more aggressive cleanup
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        // More aggressive cleanup - extract fields manually if needed
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
      console.error('[AI] Generation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate article for a single fixture
   * @param {Object} fixtureData - Fixture data from API
   * @returns {Promise<Object|null>} - Created article or null
   */
  async generateArticleForFixture(fixtureData) {
    const { fixture, teams, league } = fixtureData;

    console.log(`\n[SoiKeo] Generating article for: ${teams.home.name} vs ${teams.away.name}`);

    try {
      // Check if article already exists
      const exists = await SoiKeoArticle.existsByFixtureId(fixture.id);
      if (exists) {
        console.log(`   ⏭️  Article already exists for fixture ${fixture.id}`);
        return null;
      }

      // Get data in parallel where possible
      console.log(`   Fetching data...`);

      const [oddsData, h2hData, homeForm, awayForm] = await Promise.all([
        this.getOddsForFixture(fixture.id, fixtureData),
        this.getH2H(teams.home.id, teams.away.id),
        this.getTeamForm(teams.home.id),
        this.getTeamForm(teams.away.id)
      ]);

      console.log(`   ✓ Data fetched`);

      // Build prompt and generate content
      console.log(`   Generating AI content...`);
      const prompt = this.buildPrompt(fixtureData, oddsData, h2hData, homeForm, awayForm);
      const aiContent = await this.generateAIContent(prompt);
      console.log(`   ✓ AI content generated`);

      // Ensure bettingTips is a string (AI sometimes returns an array)
      let bettingTips = aiContent.bettingTips;
      if (Array.isArray(bettingTips)) {
        bettingTips = bettingTips.join('\n');
      }

      // Create article
      const article = new SoiKeoArticle({
        fixtureId: fixture.id,
        matchInfo: {
          homeTeam: {
            id: teams.home.id,
            name: teams.home.name,
            logo: teams.home.logo,
          },
          awayTeam: {
            id: teams.away.id,
            name: teams.away.name,
            logo: teams.away.logo,
          },
          league: {
            id: league.id,
            name: league.name,
            logo: league.logo,
            country: league.country,
          },
          matchDate: new Date(fixture.date),
          venue: fixture.venue?.name || null,
        },
        oddsData: oddsData || {},
        title: aiContent.title,
        excerpt: aiContent.excerpt,
        content: {
          introduction: aiContent.introduction,
          teamAnalysis: aiContent.teamAnalysis,
          h2hHistory: aiContent.h2hHistory,
          formAnalysis: aiContent.formAnalysis,
          oddsAnalysis: aiContent.oddsAnalysis,
          prediction: aiContent.prediction,
          bettingTips: bettingTips,
        },
        thumbnail: FOOTBALL_IMAGES[Math.floor(Math.random() * FOOTBALL_IMAGES.length)],
        tags: aiContent.tags || [teams.home.name, teams.away.name, league.name],
        status: 'published',
        metaTitle: aiContent.title,
        metaDescription: aiContent.excerpt,
      });

      await article.save();
      console.log(`   ✅ Article saved: "${article.title}"`);

      return article;

    } catch (error) {
      console.error(`   ❌ Failed to generate article:`, error.message);
      return null;
    }
  }

  /**
   * Main generation process - generates up to maxArticles per run
   * @param {number} maxArticles - Maximum articles to generate (default: 5)
   */
  async run(maxArticles = 5) {
    console.log('\n🤖 ========== SOI KÈO GENERATION START ==========');
    console.log(`📅 Time: ${new Date().toLocaleString('vi-VN')}`);
    console.log(`🎯 Target: ${maxArticles} articles`);

    const startTime = Date.now();
    let generated = 0;

    try {
      // Auto-cleanup: Delete articles older than 7 days
      const cleanupResult = await SoiKeoArticle.cleanupOldArticles(7);
      if (cleanupResult.deleted > 0) {
        console.log(`🧹 Auto-cleanup: Deleted ${cleanupResult.deleted} articles older than 7 days`);
      }

      // Check how many articles generated today
      const todayCount = await SoiKeoArticle.countToday();
      console.log(`📊 Articles generated today: ${todayCount}`);

      if (todayCount >= maxArticles) {
        console.log(`⏭️  Daily limit reached (${maxArticles}), skipping generation`);
        return { success: true, generated: 0, message: 'Daily limit reached' };
      }

      const remainingSlots = maxArticles - todayCount;
      console.log(`🎯 Remaining slots for today: ${remainingSlots}`);

      // Get hot matches
      const hotMatches = await this.getHotMatches(remainingSlots * 2); // Fetch extra in case some fail

      if (hotMatches.length === 0) {
        console.log('⚠️  No hot matches found');
        return { success: true, generated: 0, message: 'No matches found' };
      }

      // Generate articles
      for (const match of hotMatches) {
        if (generated >= remainingSlots) break;

        const article = await this.generateArticleForFixture(match);

        if (article) {
          generated++;
        }

        // Rate limiting between articles
        if (generated < remainingSlots) {
          await this.sleep(3000);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n✅ ========== SOI KÈO GENERATION COMPLETE ==========');
      console.log(`📊 Articles Generated: ${generated}/${remainingSlots}`);
      console.log(`⏱️  Duration: ${duration}s`);

      return { success: true, generated, duration };

    } catch (error) {
      console.error('\n❌ ========== SOI KÈO GENERATION FAILED ==========');
      console.error('Error:', error.message);
      return { success: false, generated, error: error.message };
    }
  }

  /**
   * Generate article for a specific fixture ID
   * @param {number} fixtureId - Fixture ID to generate article for
   */
  async generateForFixture(fixtureId) {
    console.log(`\n[SoiKeo] Manual generation for fixture ${fixtureId}...`);

    try {
      // Fetch fixture data
      const response = await this.footballApi.get('/fixtures', {
        params: { id: fixtureId }
      });

      const fixtures = response.data?.response || [];

      if (fixtures.length === 0) {
        throw new Error(`Fixture ${fixtureId} not found`);
      }

      return await this.generateArticleForFixture(fixtures[0]);

    } catch (error) {
      console.error(`[SoiKeo] Manual generation failed:`, error.message);
      throw error;
    }
  }

  // Helper
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SoiKeoGenerator();
