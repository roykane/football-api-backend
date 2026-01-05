// routes/competitions.js - Competitions Router
const express = require('express');
const router = express.Router();
const { POPULAR_LEAGUES, competitionsCache, isCompetitionsCacheValid, getFlagCode } = require('../data/leagues');
const { getWinner } = require('../data/winners');

/**
 * Get current round for a league dynamically
 * Returns the round number of the first upcoming or live match
 */
async function getCurrentRound(footballApi, leagueId, season) {
  try {
    // Try to get current round from API-Sports fixtures
    const fixturesResponse = await footballApi.get('/fixtures', {
      params: {
        league: leagueId,
        season: season,
        status: 'NS-LIVE-1H-HT-2H-ET-BT-P', // Not Started, Live, and in-progress statuses
        timezone: 'Asia/Bangkok'
      }
    });

    const fixtures = fixturesResponse.data.response || [];

    if (fixtures.length > 0) {
      // Extract round number from first fixture
      const roundString = fixtures[0].league?.round || '';
      const roundMatch = roundString.match(/(\d+)/);
      if (roundMatch) {
        const currentRound = parseInt(roundMatch[1]);
        console.log(`   ✅ Detected current round: ${currentRound} for league ${leagueId}`);
        return currentRound;
      }
    }

    // Fallback: try to get finished fixtures and return next round
    const finishedResponse = await footballApi.get('/fixtures', {
      params: {
        league: leagueId,
        season: season,
        status: 'FT', // Finished
        timezone: 'Asia/Bangkok',
        last: 10
      }
    });

    const finishedFixtures = finishedResponse.data.response || [];
    if (finishedFixtures.length > 0) {
      const lastRoundString = finishedFixtures[0].league?.round || '';
      const lastRoundMatch = lastRoundString.match(/(\d+)/);
      if (lastRoundMatch) {
        const nextRound = parseInt(lastRoundMatch[1]) + 1;
        console.log(`   ✅ Last finished round: ${lastRoundMatch[1]}, next round: ${nextRound} for league ${leagueId}`);
        return nextRound;
      }
    }

    console.log(`   ⚠️ Could not determine current round for league ${leagueId}, defaulting to 1`);
    return 1; // Default to round 1 if unable to determine

  } catch (error) {
    console.error(`   ❌ Error getting current round for league ${leagueId}:`, error.message);
    return 1; // Default to round 1 on error
  }
}

/**
 * GET /api/competitions
 * Get all competitions with filters - NO LIMITS
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Parse condition[tier][$lte]
    let maxTier = null;
    if (req.query['condition[tier][$lte]']) {
      maxTier = parseInt(req.query['condition[tier][$lte]']);
    }

    // Parse condition[slug] for filtering by slug
    let slugFilter = null;
    if (req.query['condition[slug]']) {
      slugFilter = req.query['condition[slug]'];
    }
    // Also try nested object format if query parser is set to 'extended'
    if (!slugFilter && req.query.condition && req.query.condition.slug) {
      slugFilter = req.query.condition.slug;
    }

    console.log('🏆 Fetching ALL competitions (no limits):', { page, limit, maxTier, search, slugFilter });

    let competitions = [];

    // Check cache
    if (isCompetitionsCacheValid()) {
      console.log('✅ Using cached competitions');
      competitions = competitionsCache.data;
    } else {
      console.log('🔄 Loading ALL competitions from API-Sports...');

      const footballApi = req.app.locals.footballApi;
      const currentYear = new Date().getFullYear();
      // ✅ Lấy cả season hiện tại và năm trước để có đủ các giải châu Âu
      // European leagues 2025-2026 season = 2025, not 2026
      const seasons = [currentYear, currentYear - 1];

      // Fetch leagues for both seasons
      const allLeagues = [];
      for (const season of seasons) {
        console.log(`   Fetching leagues for season ${season}...`);
        const response = await footballApi.get('/leagues', {
          params: { season }
        });
        const leagues = response.data.response || [];
        console.log(`   Found ${leagues.length} leagues for season ${season}`);
        allLeagues.push(...leagues);
      }

      // Deduplicate by league id (keep the one with current=true or latest)
      const leagueMap = new Map();
      allLeagues.forEach(item => {
        const existingItem = leagueMap.get(item.league.id);
        const hasCurrent = item.seasons?.some(s => s.current);
        const existingHasCurrent = existingItem?.seasons?.some(s => s.current);

        // Keep if: no existing, or this one has current season, or existing doesn't have current
        if (!existingItem || (hasCurrent && !existingHasCurrent)) {
          leagueMap.set(item.league.id, item);
        }
      });

      const response = { data: { response: Array.from(leagueMap.values()) } };

      const apiLeagues = response.data.response || [];
      console.log(`   Found ${apiLeagues.length} leagues from API-Sports`);

      // Transform API response to match our format
      competitions = apiLeagues.map((item, index) => {
        const league = item.league; // API-Sports structure: { league: {...}, country: {...}, seasons: [...] }
        const country = item.country;
        const seasons = item.seasons || [];

        const slug = league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const countrySlug = country.name.toLowerCase().replace(/\s+/g, '-');

        // Determine tier based on league ID (popular leagues get better tier)
        const popularLeague = POPULAR_LEAGUES.find(pl => pl.id === league.id);
        const tier = popularLeague ? popularLeague.tier : 5; // Default tier 5 for unlisted leagues
        const seq = popularLeague ? popularLeague.seq : index + 1000; // High seq for unlisted

        // Generate rounds based on competition type
        const isLeague = league.type === 'League' || league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie');
        const totalRounds = isLeague ? 38 : 13; // 38 for leagues, 13 for cups
        const rounds = [];

        for (let i = 1; i <= totalRounds; i++) {
          rounds.push({
            rawRound: `Regular Season - ${i}`,
            round: `Regular Season ${i}`,
            dates: [],
            level: i
          });
        }

        // Get current season or use current year
        const currentSeason = seasons.find(s => s.current) || { year: currentYear };
        const seasonYear = currentSeason.year || currentYear;

        return {
          _id: `league-${league.id}`,
          categoryId: null,
          code: league.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
          countryId: country.name === 'World' ? 'country-world' : `country-${country.name}`,
          createdAt: new Date().toISOString(),
          createdBy: null,
          description: null,
          image: league.logo || `https://media.api-sports.io/football/leagues/${league.id}.png`,
          name: league.name,
          seasons: [{
            year: seasonYear,
            start: currentSeason.start || `${seasonYear}-08-01T00:00:00.000Z`,
            end: currentSeason.end || `${seasonYear + 1}-05-31T23:59:59.999Z`,
            current: true,
            rounds: rounds,
            coverage: currentSeason.coverage || {
              events: true,
              lineups: true,
              statisticsFixtures: true,
              statisticsPlayers: true,
              standings: true,
              players: true,
              topScorers: true,
              topAssists: true,
              topCards: true,
              injuries: false,
              predictions: true,
              odds: true
            },
            currentRound: 1, // Default for list view, detail endpoints will have accurate currentRound
            isCurrent: true,
            isFinished: false,
            yearText: `${seasonYear}/${seasonYear + 1}`,
            standingLimitAll: [5, 10, 15, 20, 25],
            standingLimitHomeAway: [5, 10, 15]
          }],
          seq: seq,
          sportId: "football",
          status: "activated",
          tier: tier,
          type: league.type ? league.type.toLowerCase() : (isLeague ? 'league' : 'cup'),
          updatedAt: new Date().toISOString(),
          updatedBy: null,
          slug: slug,
          seo: {
            description: `Follow ${league.name} standings, results, and fixtures`,
            image: league.logo || `https://media.api-sports.io/football/leagues/${league.id}.png`,
            imageAlt: `${league.name} logo`,
            og: {
              title: league.name,
              description: `Follow ${league.name} standings, results, and fixtures`,
              image: league.logo || `https://media.api-sports.io/football/leagues/${league.id}.png`
            },
            slug: slug,
            title: league.name
          },
          subhead: country.name,
          coefficient: 0,
          rating: tier === 1 ? 90.0 : tier === 2 ? 75.0 : tier === 3 ? 60.0 : tier === 4 ? 50.0 : 40.0,
          class: tier,
          rank: seq,
          country: {
            _id: country.name === 'World' ? 'country-world' : `country-${country.name}`,
            code: country.code || (country.name === 'World' ? 'INT' : country.name.substring(0, 2).toUpperCase()),
            createdAt: new Date().toISOString(),
            createdBy: null,
            currency: null,
            image: country.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(country.name)}.svg`,
            name: country.name,
            parentIds: [],
            phoneCode: null,
            seq: 1,
            sportIds: ["football"],
            status: "activated",
            type: "country",
            updatedAt: new Date().toISOString(),
            updatedBy: null,
            seo: {
              description: `${country.name} football competitions`,
              image: country.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(country.name)}.svg`,
              imageAlt: `${country.name} flag`,
              slug: countrySlug,
              title: country.name
            },
            slug: countrySlug,
            baseName: country.name,
            tags: [],
            iso3: null,
            codeIso3: null
          }
        };
      });

      competitionsCache.data = competitions;
      competitionsCache.timestamp = Date.now();

      console.log(`✅ Cached ${competitions.length} competitions`);
    }

    // Apply filters
    let filtered = [...competitions];

    if (maxTier !== null && !isNaN(maxTier)) {
      filtered = filtered.filter(comp => comp.tier <= maxTier);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(comp =>
        comp.name.toLowerCase().includes(searchLower) ||
        comp.country.name.toLowerCase().includes(searchLower)
      );
    }

    // Filter by slug (exact match)
    if (slugFilter) {
      filtered = filtered.filter(comp => comp.slug === slugFilter);
      console.log(`🔍 Filtering by slug: ${slugFilter}, found ${filtered.length} matches`);
    }

    // Sort
    filtered.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.seq !== b.seq) return a.seq - b.seq;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const totalPages = Math.ceil(filtered.length / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedCompetitions = filtered.slice(startIndex, endIndex);

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: "Success",
      data: {
        items: paginatedCompetitions,
        total: filtered.length,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
        currPage: pageNum,
        nextPage: pageNum < totalPages ? pageNum + 1 : null,
        lastPage: totalPages
      }
    });

  } catch (error) {
    console.error('❌ Error fetching competitions:', error.message);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      errorCode: 500,
      message: error.message,
      data: null
    });
  }
});

/**
 * GET /api/competitions/:id/archives
 * Get past seasons/archives for a competition
 * Matches format: https://api.1gom.kim/competitions/{id}/archives
 */
router.get('/:id/archives', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📁 GET /api/competitions/${id}/archives`);

    // Extract league ID from "league-39" format
    const leagueId = parseInt(id.replace('league-', ''));

    const footballApi = req.app.locals.footballApi;

    // Fetch league info from API-Sports
    const leagueResponse = await footballApi.get('/leagues', {
      params: {
        id: leagueId
      }
    });

    const apiData = leagueResponse.data.response;
    if (!apiData || apiData.length === 0) {
      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 404,
        message: 'Competition not found',
        data: null
      });
    }

    const leagueInfo = apiData[0].league;
    const countryInfo = apiData[0].country;
    const apiSeasons = apiData[0].seasons || [];

    // Generate slug
    const slug = leagueInfo.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if in popular leagues for tier
    const popularLeague = POPULAR_LEAGUES.find(l => l.id === leagueId);
    const tier = popularLeague ? popularLeague.tier : 5;

    // Generate league code
    const countryCode = countryInfo.name.substring(0, 3).toUpperCase();
    const code = `${countryCode}${tier}`;

    // Generate past seasons based on API data or default to last 15 years
    const currentYear = new Date().getFullYear();
    const seasons = [];

    if (apiSeasons.length > 0) {
      // Use API seasons
      apiSeasons.forEach(season => {
        const winner = !season.current && season.year < currentYear ? getWinner(leagueId, season.year) : null;
        seasons.push({
          year: season.year,
          yearText: `${season.year}/${season.year + 1}`,
          current: season.current,
          finished: !season.current,
          winner: winner
        });
      });
    } else {
      // Fallback: generate last 15 years
      for (let year = currentYear; year >= currentYear - 15; year--) {
        const winner = year < currentYear ? getWinner(leagueId, year) : null;
        seasons.push({
          year: year,
          yearText: `${year}/${year + 1}`,
          current: year === currentYear,
          finished: year < currentYear,
          winner: winner
        });
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: 'Success',
      data: {
        _id: `league-${leagueId}`,
        code: code,
        name: leagueInfo.name,
        slug: slug,
        image: leagueInfo.logo || `https://media.api-sports.io/football/leagues/${leagueId}.png`,
        seasons: seasons
      }
    });

  } catch (error) {
    console.error('Error fetching archives:', error.message);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      errorCode: 500,
      message: 'Failed to fetch archives',
      data: null
    });
  }
});

/**
 * GET /api/competitions/:countrySlug/:leagueSlug
 * Get competition detail by country slug and league slug - NO LIMITS
 */
router.get('/:countrySlug/:leagueSlug', async (req, res) => {
  try {
    const { countrySlug, leagueSlug } = req.params;

    console.log(`🔍 GET /api/competitions/${countrySlug}/${leagueSlug}`);

    const footballApi = req.app.locals.footballApi;
    const currentYear = new Date().getFullYear();

    let competitions = [];

    // Check cache first
    if (isCompetitionsCacheValid()) {
      console.log('✅ Using cached competitions for slug search');
      competitions = competitionsCache.data;
    } else {
      console.log('🔄 Loading competitions from API-Sports for slug search...');

      // Fetch all leagues from API-Sports
      const response = await footballApi.get('/leagues', {
        params: {
          season: currentYear
        }
      });

      const apiLeagues = response.data.response || [];

      // Quick transform to searchable format
      competitions = apiLeagues.map(item => ({
        _id: `league-${item.league.id}`,
        id: item.league.id,
        name: item.league.name,
        slug: item.league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        country: {
          name: item.country.name,
          slug: item.country.name.toLowerCase().replace(/\s+/g, '-'),
          flag: item.country.flag
        },
        logo: item.league.logo,
        type: item.league.type,
        seasons: item.seasons
      }));
    }

    // Find league by slug
    const competition = competitions.find(c =>
      c.slug === leagueSlug && c.country.slug === countrySlug
    );

    if (!competition) {
      console.log(`❌ No league found for: ${countrySlug}/${leagueSlug}`);

      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 404,
        message: 'Competition not found',
        data: null
      });
    }

    // ✅ FIX: Ensure competition.id exists (fallback to extract from _id)
    if (!competition.id && competition._id) {
      competition.id = parseInt(competition._id.replace('league-', ''));
    }

    console.log(`✅ Found match: ${competition.name} (${competition.country.name})`);

    // Determine tier
    const popularLeague = POPULAR_LEAGUES.find(pl => pl.id === competition.id);
    const tier = popularLeague ? popularLeague.tier : 5;
    const seq = popularLeague ? popularLeague.seq : 999;

    // Generate rounds based on competition type
    const isLeague = competition.type === 'League' || competition.name.includes('League') || competition.name.includes('Liga') || competition.name.includes('Serie');
    const totalRounds = isLeague ? 38 : 13;
    const rounds = [];

    for (let i = 1; i <= totalRounds; i++) {
      rounds.push({
        rawRound: `Regular Season - ${i}`,
        round: `Regular Season ${i}`,
        dates: [],
        level: i
      });
    }

    // Get current season info
    const currentSeason = competition.seasons?.find(s => s.current) || { year: currentYear };
    const seasonYear = currentSeason.year || currentYear;

    // Get current round dynamically
    const currentRound = await getCurrentRound(footballApi, competition.id, seasonYear);

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: "Success",
      data: {
        _id: competition._id,
        categoryId: null,
        code: competition.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
        countryId: competition.country.name === 'World' ? 'country-world' : `country-${competition.country.name}`,
        createdAt: new Date().toISOString(),
        createdBy: null,
        description: null,
        image: competition.logo || `https://media.api-sports.io/football/leagues/${competition.id}.png`,
        name: competition.name,
        seasons: [{
          year: seasonYear,
          start: currentSeason.start || `${seasonYear}-08-01T00:00:00.000Z`,
          end: currentSeason.end || `${seasonYear + 1}-05-31T23:59:59.999Z`,
          current: true,
          rounds: rounds,
          coverage: currentSeason.coverage || {
            events: true,
            lineups: true,
            statisticsFixtures: true,
            statisticsPlayers: true,
            standings: true,
            players: true,
            topScorers: true,
            topAssists: true,
            topCards: true,
            injuries: false,
            predictions: true,
            odds: true
          },
          currentRound: currentRound,
          isCurrent: true,
          isFinished: false,
          yearText: `${seasonYear}/${seasonYear + 1}`,
          standingLimitAll: [5, 10, 15, 20, 25],
          standingLimitHomeAway: [5, 10, 15]
        }],
        seq: seq,
        sportId: "football",
        status: "activated",
        tier: tier,
        type: competition.type ? competition.type.toLowerCase() : (isLeague ? 'league' : 'cup'),
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        slug: competition.slug,
        seo: {
          description: `Follow ${competition.name} standings, results, and fixtures`,
          image: competition.logo || `https://media.api-sports.io/football/leagues/${competition.id}.png`,
          imageAlt: `${competition.name} logo`,
          og: {
            title: competition.name,
            description: `Follow ${competition.name} standings, results, and fixtures`,
            image: competition.logo || `https://media.api-sports.io/football/leagues/${competition.id}.png`
          },
          slug: competition.slug,
          title: competition.name
        },
        subhead: competition.country.name,
        coefficient: 0,
        rating: tier === 1 ? 90.0 : tier === 2 ? 75.0 : tier === 3 ? 60.0 : tier === 4 ? 50.0 : 40.0,
        class: tier,
        rank: seq,
        country: {
          _id: competition.country.name === 'World' ? 'country-world' : `country-${competition.country.name}`,
          code: competition.country.name === 'World' ? 'INT' : competition.country.name.substring(0, 2).toUpperCase(),
          createdAt: new Date().toISOString(),
          createdBy: null,
          currency: null,
          image: competition.country.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(competition.country.name)}.svg`,
          name: competition.country.name,
          parentIds: [],
          phoneCode: null,
          seq: 1,
          sportIds: ["football"],
          status: "activated",
          type: "country",
          updatedAt: new Date().toISOString(),
          updatedBy: null,
          seo: {
            description: `${competition.country.name} football competitions`,
            image: competition.country.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(competition.country.name)}.svg`,
            imageAlt: `${competition.country.name} flag`,
            slug: competition.country.slug,
            title: competition.country.name
          },
          slug: competition.country.slug,
          baseName: competition.country.name,
          tags: [],
          iso3: null,
          codeIso3: null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching competition:', error.message);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      errorCode: 500,
      message: error.message,
      data: null
    });
  }
});

/**
 * GET /api/competitions/get-in-day
 * Get all competitions that have matches on a specific date
 */
router.get('/get-in-day', async (req, res) => {
  try {
    const { dateTime } = req.query;

    if (!dateTime) {
      return res.status(400).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 400,
        message: 'dateTime parameter is required',
        data: null
      });
    }

    console.log(`📅 GET /api/competitions/get-in-day?dateTime=${dateTime}`);

    const footballApi = req.app.locals.footballApi;

    // Fetch fixtures for the specific date
    const response = await footballApi.get('/fixtures', {
      params: {
        date: dateTime,
        timezone: 'Asia/Bangkok'
      }
    });

    const fixtures = response.data.response || [];
    console.log(`   Found ${fixtures.length} fixtures for ${dateTime}`);

    // Group fixtures by league
    const leagueMap = new Map();

    fixtures.forEach(fixture => {
      const leagueId = fixture.league?.id;
      if (!leagueId) return;

      if (!leagueMap.has(leagueId)) {
        const countryName = fixture.league.country || 'Unknown';
        const countrySlug = countryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        leagueMap.set(leagueId, {
          _id: `league-${leagueId}`,
          id: leagueId,
          name: fixture.league.name,
          slug: fixture.league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          country: {
            _id: `country-${countryName}`,
            name: countryName,
            slug: countrySlug,
            image: fixture.league.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(countryName)}.svg`
          },
          logo: fixture.league.logo,
          flag: fixture.league.flag,
          season: fixture.league.season,
          round: fixture.league.round,
          matchCount: 0
        });
      }

      const league = leagueMap.get(leagueId);
      league.matchCount++;
    });

    // Convert map to array and sort by match count
    const competitions = Array.from(leagueMap.values())
      .sort((a, b) => b.matchCount - a.matchCount);

    console.log(`   Grouped into ${competitions.length} competitions`);

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: "Success",
      data: competitions
    });

  } catch (error) {
    console.error('❌ Error fetching competitions in day:', error.message);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      errorCode: 500,
      message: error.message,
      data: null
    });
  }
});

/**
 * GET /api/competitions/:id
 * Get single competition by ID - NO LIMITS
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = parseInt(id);

    const footballApi = req.app.locals.footballApi;
    const currentYear = new Date().getFullYear();

    // Fetch league info from API-Sports
    const leagueResponse = await footballApi.get('/leagues', {
      params: {
        id: leagueId,
        season: currentYear
      }
    });

    const apiData = leagueResponse.data.response;
    if (!apiData || apiData.length === 0) {
      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 404,
        message: 'Competition not found',
        data: null
      });
    }

    const leagueInfo = apiData[0].league;
    const countryInfo = apiData[0].country;
    const apiSeasons = apiData[0].seasons || [];

    const slug = leagueInfo.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const countrySlug = countryInfo.name.toLowerCase().replace(/\s+/g, '-');

    // Determine tier
    const popularLeague = POPULAR_LEAGUES.find(pl => pl.id === leagueId);
    const tier = popularLeague ? popularLeague.tier : 5;
    const seq = popularLeague ? popularLeague.seq : 999;

    // Generate rounds based on competition type
    const isLeague = leagueInfo.type === 'League' || leagueInfo.name.includes('League') || leagueInfo.name.includes('Liga') || leagueInfo.name.includes('Serie');
    const totalRounds = isLeague ? 38 : 13;
    const rounds = [];

    for (let i = 1; i <= totalRounds; i++) {
      rounds.push({
        rawRound: `Regular Season - ${i}`,
        round: `Regular Season ${i}`,
        dates: [],
        level: i
      });
    }

    // Get current season info
    const currentSeason = apiSeasons.find(s => s.current) || { year: currentYear };
    const seasonYear = currentSeason.year || currentYear;

    // Get current round dynamically
    const currentRound = await getCurrentRound(footballApi, leagueId, seasonYear);

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: "Success",
      data: {
        _id: `league-${leagueId}`,
        categoryId: null,
        code: leagueInfo.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
        countryId: countryInfo.name === 'World' ? 'country-world' : `country-${countryInfo.name}`,
        createdAt: new Date().toISOString(),
        createdBy: null,
        description: null,
        image: leagueInfo.logo || `https://media.api-sports.io/football/leagues/${leagueId}.png`,
        name: leagueInfo.name,
        seasons: [{
          year: seasonYear,
          start: currentSeason.start || `${seasonYear}-08-01T00:00:00.000Z`,
          end: currentSeason.end || `${seasonYear + 1}-05-31T23:59:59.999Z`,
          current: true,
          rounds: rounds,
          coverage: currentSeason.coverage || {
            events: true,
            lineups: true,
            statisticsFixtures: true,
            statisticsPlayers: true,
            standings: true,
            players: true,
            topScorers: true,
            topAssists: true,
            topCards: true,
            injuries: false,
            predictions: true,
            odds: true
          },
          currentRound: currentRound,
          isCurrent: true,
          isFinished: false,
          yearText: `${seasonYear}/${seasonYear + 1}`,
          standingLimitAll: [5, 10, 15, 20, 25],
          standingLimitHomeAway: [5, 10, 15]
        }],
        seq: seq,
        sportId: "football",
        status: "activated",
        tier: tier,
        type: leagueInfo.type ? leagueInfo.type.toLowerCase() : (isLeague ? 'league' : 'cup'),
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        slug: slug,
        seo: {
          description: `Follow ${leagueInfo.name} standings, results, and fixtures`,
          image: leagueInfo.logo || `https://media.api-sports.io/football/leagues/${leagueId}.png`,
          imageAlt: `${leagueInfo.name} logo`,
          og: {
            title: leagueInfo.name,
            description: `Follow ${leagueInfo.name} standings, results, and fixtures`,
            image: leagueInfo.logo || `https://media.api-sports.io/football/leagues/${leagueId}.png`
          },
          slug: slug,
          title: leagueInfo.name
        },
        subhead: countryInfo.name,
        coefficient: 0,
        rating: tier === 1 ? 90.0 : tier === 2 ? 75.0 : tier === 3 ? 60.0 : tier === 4 ? 50.0 : 40.0,
        class: tier,
        rank: seq,
        country: {
          _id: countryInfo.name === 'World' ? 'country-world' : `country-${countryInfo.name}`,
          code: countryInfo.code || (countryInfo.name === 'World' ? 'INT' : countryInfo.name.substring(0, 2).toUpperCase()),
          createdAt: new Date().toISOString(),
          createdBy: null,
          currency: null,
          image: countryInfo.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(countryInfo.name)}.svg`,
          name: countryInfo.name,
          parentIds: [],
          phoneCode: null,
          seq: 1,
          sportIds: ["football"],
          status: "activated",
          type: "country",
          updatedAt: new Date().toISOString(),
          updatedBy: null,
          seo: {
            description: `${countryInfo.name} football competitions`,
            image: countryInfo.flag || `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(countryInfo.name)}.svg`,
            imageAlt: `${countryInfo.name} flag`,
            slug: countrySlug,
            title: countryInfo.name
          },
          slug: countrySlug,
          baseName: countryInfo.name,
          tags: [],
          iso3: null,
          codeIso3: null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching competition:', error.message);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      errorCode: 500,
      message: error.message,
      data: null
    });
  }
});

module.exports = router;