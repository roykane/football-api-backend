const SoiKeoArticle = require('../models/SoiKeoArticle');
const oddsCache = require('./oddsCache');
const { generateForArticle, generateVariantForArticle } = require('./article-image-generator');
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
          last: 10
        }
      });

      const fixtures = response.data?.response || [];

      if (fixtures.length === 0) {
        return 'Không có dữ liệu đối đầu.';
      }

      let homeWins = 0, draws = 0, awayWins = 0;
      let totalGoals = 0, over25 = 0, bttsCount = 0;
      const results = [];
      const dateResults = [];

      for (const f of fixtures) {
        const homeGoals = f.goals.home || 0;
        const awayGoals = f.goals.away || 0;
        const isHomeTeamFirst = f.teams.home.id === homeTeamId;
        const year = new Date(f.fixture.date).getFullYear();

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

        totalGoals += homeGoals + awayGoals;
        if (homeGoals + awayGoals > 2.5) over25++;
        if (homeGoals > 0 && awayGoals > 0) bttsCount++;

        results.push(score);
        dateResults.push(`${year}: ${score}`);
      }

      const total = fixtures.length;
      const avgGoals = (totalGoals / total).toFixed(2);

      return `${total} lần đối đầu gần nhất: ${homeWins} thắng - ${draws} hòa - ${awayWins} thua | Trung bình ${avgGoals} bàn/trận | Tài 2.5: ${over25}/${total} | Cả 2 đội ghi bàn: ${bttsCount}/${total}\nChi tiết: ${dateResults.join(' | ')}`;

    } catch (error) {
      console.error(`   [H2H] Error:`, error.message);
      return 'Không có dữ liệu đối đầu.';
    }
  }

  /**
   * Get recent form for a team (last 10 matches with details)
   */
  async getTeamForm(teamId) {
    try {
      const response = await this.footballApi.get('/fixtures', {
        params: {
          team: teamId,
          last: 10,
          status: 'FT'
        }
      });

      const fixtures = response.data?.response || [];

      if (fixtures.length === 0) {
        return 'Không có dữ liệu.';
      }

      let wins = 0, draws = 0, losses = 0;
      let goalsFor = 0, goalsAgainst = 0;
      let cleanSheets = 0, over25 = 0;
      const matchDetails = [];
      const form = [];

      for (const f of fixtures) {
        const isHome = f.teams.home.id === teamId;
        const teamGoals = isHome ? f.goals.home : f.goals.away;
        const oppGoals = isHome ? f.goals.away : f.goals.home;
        const oppName = isHome ? f.teams.away.name : f.teams.home.name;

        goalsFor += teamGoals || 0;
        goalsAgainst += oppGoals || 0;
        if (oppGoals === 0) cleanSheets++;
        if ((teamGoals || 0) + (oppGoals || 0) > 2.5) over25++;

        let result;
        if (teamGoals > oppGoals) { result = 'W'; wins++; }
        else if (teamGoals < oppGoals) { result = 'L'; losses++; }
        else { result = 'D'; draws++; }

        form.push(result);
        matchDetails.push(`${isHome ? 'vs' : '@'} ${oppName}: ${teamGoals}-${oppGoals} (${result})`);
      }

      const total = fixtures.length;
      const avgFor = (goalsFor / total).toFixed(2);
      const avgAgainst = (goalsAgainst / total).toFixed(2);

      return `${form.join('')} (${wins}W ${draws}D ${losses}L) | Bàn thắng: ${goalsFor} (${avgFor}/trận) | Thủng lưới: ${goalsAgainst} (${avgAgainst}/trận) | Giữ sạch lưới: ${cleanSheets}/${total} | Tài 2.5: ${over25}/${total}\nChi tiết 10 trận: ${matchDetails.slice(0, 10).join(' | ')}`;

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
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh'
    });

    const matchDateStr = new Date(fixture.date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh'
    });

    let oddsInfo = 'Chưa có tỷ lệ kèo.';
    if (oddsData) {
      oddsInfo = `
- Kèo Châu Âu (1X2): Chủ ${oddsData.homeWin || '-'} | Hòa ${oddsData.draw || '-'} | Khách ${oddsData.awayWin || '-'}
- Kèo Châu Á: Chấp ${oddsData.handicap.line || '0'} (Chủ ${oddsData.handicap.home || '-'} / Khách ${oddsData.handicap.away || '-'})
- Tài/Xỉu: Mốc 2.5 - Tài ${oddsData.overUnder.over || '-'} | Xỉu ${oddsData.overUnder.under || '-'}`;
    }

    // Randomize writing style for each article to avoid template spam
    const writingStyles = [
      'Viết như BLV bóng đá đang tường thuật trước trận — sôi nổi, hào hứng, dùng nhiều câu ngắn và câu hỏi tu từ.',
      'Viết như nhà phân tích dữ liệu — lạnh lùng, khách quan, nặng số liệu, ít cảm xúc, nhiều so sánh định lượng.',
      'Viết như phóng viên thể thao kỳ cựu — kể chuyện, đan xen giai thoại, nhấn mạnh bối cảnh lịch sử và drama.',
      'Viết như HLV đang họp chiến thuật — tập trung vào sơ đồ, điểm yếu đối thủ, cách khai thác, giọng trầm tĩnh.',
      'Viết như fan cuồng nhiệt nhưng có kiến thức — đam mê, thiên vị nhẹ đội nhà, nhưng vẫn tôn trọng số liệu.',
      'Viết kiểu podcast bóng đá — giao tiếp trực tiếp với người đọc, thoải mái, xen lẫn humor nhẹ và nhận xét sắc bén.',
    ];

    const openingStyles = [
      'Mở bài bằng một câu hỏi kích thích tư duy về trận đấu.',
      'Mở bài bằng một thống kê bất ngờ hoặc kỷ lục thú vị liên quan.',
      'Mở bài bằng câu chuyện/bối cảnh tại sao trận đấu này quan trọng với mùa giải.',
      'Mở bài bằng so sánh phong độ gần đây — ai đang nóng, ai đang nguội.',
      'Mở bài bằng flashback trận đối đầu gần nhất và bài học rút ra.',
      'Mở bài thẳng vào vấn đề — dự đoán trước, rồi giải thích tại sao.',
    ];

    const structureVariants = [
      'Gộp phân tích 2 đội thành so sánh song song (không tách riêng từng đội). Đan xen H2H vào phân tích đội.',
      'Bắt đầu từ kèo ngược lên — phân tích odds trước, rồi giải thích bằng phong độ và H2H.',
      'Kể theo timeline — từ lịch sử đối đầu xa → gần → phong độ hiện tại → dự đoán.',
      'Chia theo chủ đề: tấn công, phòng ngự, bóng chết, yếu tố tâm lý — thay vì chia theo đội.',
      'Viết dạng Q&A — mỗi section trả lời một câu hỏi mà người đọc thắc mắc.',
      'Trình bày dạng "3 lý do chọn X" + "3 rủi ro cần cảnh giác" thay vì phân tích truyền thống.',
    ];

    const style = writingStyles[Math.floor(Math.random() * writingStyles.length)];
    const opening = openingStyles[Math.floor(Math.random() * openingStyles.length)];
    const structure = structureVariants[Math.floor(Math.random() * structureVariants.length)];

    // Title templates — random pick
    const titleTemplates = [
      `${teams.home.name} vs ${teams.away.name}: Ai sẽ thắng trận ${league.name} ${matchDateStr}?`,
      `Phân tích ${teams.home.name} đấu ${teams.away.name} — Dự đoán ${league.name}`,
      `${teams.home.name} gặp ${teams.away.name}: 3 điều cần biết trước giờ bóng lăn`,
      `Nhận định ${teams.home.name} vs ${teams.away.name} ${matchDateStr} | ${league.name}`,
      `${league.name}: ${teams.home.name} có đánh bại được ${teams.away.name}?`,
      `Trước trận ${teams.home.name} - ${teams.away.name}: Phân tích từ chuyên gia`,
      `Dự đoán ${teams.home.name} vs ${teams.away.name} — Tỷ số, kèo & phong độ`,
      `${teams.home.name} vs ${teams.away.name} ${matchTime} ngày ${matchDateStr}: Phân tích chi tiết`,
    ];
    const titleSuggestion = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];

    return `Bạn là chuyên gia phân tích bóng đá, viết bài nhận định bằng tiếng Việt cho website thể thao chuyên nghiệp.

**PHONG CÁCH VIẾT:**
${style}
${opening}
${structure}

**DỮ LIỆU TRẬN ĐẤU:**
- ${teams.home.name} vs ${teams.away.name}
- ${league.name} (${league.country}) — ${matchTime} ngày ${matchDateStr}
- Sân: ${fixture.venue?.name || 'Chưa xác định'}

**TỶ LỆ KÈO:**
${oddsInfo}

**H2H (10 trận):**
${h2hData}

**PHONG ĐỘ:**
- ${teams.home.name}: ${homeForm}
- ${teams.away.name}: ${awayForm}

**QUY TẮC VIẾT BÀI — BẮT BUỘC TUÂN THỦ:**

1. NGẮN GỌN & SÚC TÍCH — tổng bài 1500-2000 từ (KHÔNG phải 2500-3000). Mỗi câu phải có thông tin mới. Cắt bỏ mọi câu lặp lại ý.

2. KHÔNG LẶP DATA — nếu đã nói "Bayern thắng 9/10 trận" ở phần intro thì KHÔNG nhắc lại ở phần formAnalysis. Mỗi section phải có insight MỚI.

3. CÂU MỞ BÀI — TUYỆT ĐỐI KHÔNG bắt đầu bằng:
   × "Trận đấu giữa X và Y..."
   × "Cuộc chạm trán giữa..."
   × "Trận X vs Y diễn ra lúc..."
   Thay vào đó dùng kiểu mở bài đã chọn ở trên.

4. PREDICTION — KHÔNG bắt đầu bằng "Dựa trên phân tích..." hoặc "Dựa trên toàn bộ...". Đi thẳng vào dự đoán.

5. TỶ SỐ DỰ ĐOÁN — phải PHÙ HỢP với data. Nếu H2H trung bình 1.5 bàn → không dự đoán 3-2. Nếu cả 2 đội form tệ → có thể 0-0 hoặc 1-0.

6. KHÔNG DÙNG "soi kèo" — thay bằng "nhận định", "phân tích", "đánh giá". Tuyệt đối không dùng "cược", "nhà cái", "đặt cược" trong title/excerpt.

7. TRÁNH BOLD SPAM — chỉ bold tên đội lần đầu xuất hiện trong mỗi section. Không bold mỗi lần nhắc tên đội.

**7 PHẦN BẮT BUỘC (tự do đặt tên heading):**
1. introduction (150-200 từ)
2. teamAnalysis (400-500 từ) — so sánh 2 đội, KHÔNG tách riêng rồi nói giống nhau
3. h2hHistory (200-250 từ) — chỉ highlight insight quan trọng, không liệt kê từng trận
4. formAnalysis (200-300 từ) — tóm tắt xu hướng, không lặp lại số liệu đã nêu
5. oddsAnalysis (200-300 từ) — phân tích kèo ngắn gọn, có quan điểm rõ ràng
6. prediction (100-150 từ) — tỷ số + 2-3 câu lý do, KHÔNG viết dài dòng
7. bettingTips (100 từ) — bullet points ngắn

**TITLE GỢI Ý (chọn 1 hoặc tự sáng tạo):**
"${titleSuggestion}"

Format JSON:
{
  "title": "[KHÁC NHAU cho mỗi bài, xem gợi ý trên]",
  "excerpt": "[130-155 ký tự, chứa dự đoán tỷ số cụ thể]",
  "introduction": "[150-200 từ]",
  "teamAnalysis": "[400-500 từ]",
  "h2hHistory": "[200-250 từ]",
  "formAnalysis": "[200-300 từ]",
  "oddsAnalysis": "[200-300 từ]",
  "prediction": "[100-150 từ]",
  "bettingTips": "[bullet points ngắn]",
  "tags": ["${teams.home.name}", "${teams.away.name}", "${league.name}", "nhận định bóng đá", "phân tích trận đấu"]
}

KHÔNG bịa chấn thương cầu thủ. Trả về ĐÚNG JSON.`;
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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
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

      // Generate 2 inline images (hero + preview card) and embed them into
      // the article's introduction + formAnalysis sections as markdown, so
      // readers see two visuals interleaved with the analysis text.
      // Non-fatal: on failure we keep the random Unsplash thumbnail.
      try {
        const [heroUrl, variantUrl] = await Promise.all([
          generateForArticle(article).catch(() => null),
          generateVariantForArticle(article).catch(() => null),
        ]);
        const homeName = teams.home.name;
        const awayName = teams.away.name;

        if (heroUrl && article.content?.introduction) {
          const alt = `${homeName} vs ${awayName}`;
          article.content.introduction = `![${alt}](${heroUrl})\n\n${article.content.introduction}`;
          // Also replace the Unsplash-random thumbnail with our composed image
          // so the shared OG card matches the hero used inline.
          article.thumbnail = heroUrl;
          console.log(`   🎨 Hero: ${heroUrl}`);
        }
        if (variantUrl) {
          const alt = `Phân tích kèo ${homeName} vs ${awayName}`;
          // Prefer inserting before form analysis; fallback to odds analysis.
          const target = article.content?.formAnalysis ? 'formAnalysis'
            : article.content?.oddsAnalysis ? 'oddsAnalysis'
            : null;
          if (target && article.content[target]) {
            article.content[target] = `![${alt}](${variantUrl})\n\n${article.content[target]}`;
            console.log(`   🎨 Variant: ${variantUrl} (into ${target})`);
          }
        }
        if (heroUrl || variantUrl) {
          // Mongoose: mark the mixed/nested content path dirty before save
          article.markModified('content');
          await article.save();
        }
      } catch (imgErr) {
        console.warn(`   ⚠️  image gen skipped:`, imgErr.message);
      }

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
  async run(maxPerRun = 5, dailyLimit = 20) {
    console.log('\n🤖 ========== SOI KÈO GENERATION START ==========');
    console.log(`📅 Time: ${new Date().toLocaleString('vi-VN')}`);
    console.log(`🎯 Target: ${maxPerRun} articles this run (daily limit: ${dailyLimit})`);

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
      console.log(`📊 Articles generated today: ${todayCount}/${dailyLimit}`);

      if (todayCount >= dailyLimit) {
        console.log(`⏭️  Daily limit reached (${dailyLimit}), skipping generation`);
        return { success: true, generated: 0, message: 'Daily limit reached' };
      }

      const remainingSlots = Math.min(maxPerRun, dailyLimit - todayCount);
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
