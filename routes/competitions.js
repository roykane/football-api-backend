// routes/competitions.js - Competitions Router
const express = require('express');
const router = express.Router();
const { POPULAR_LEAGUES, competitionsCache, isCompetitionsCacheValid, getFlagCode } = require('../data/leagues');
const { getWinner } = require('../data/winners');

/**
 * GET /api/competitions
 * Get all competitions with filters
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Parse condition[tier][$lte]
    let maxTier = null;
    if (req.query['condition[tier][$lte]']) {
      maxTier = parseInt(req.query['condition[tier][$lte]']);
    }

    console.log('🏆 Fetching competitions:', { page, limit, maxTier, search });

    let competitions = [];

    // Check cache
    if (isCompetitionsCacheValid()) {
      console.log('✅ Using cached competitions');
      competitions = competitionsCache.data;
    } else {
      console.log('🔄 Loading competitions data...');

      competitions = POPULAR_LEAGUES.map(league => {
        const currentYear = new Date().getFullYear();
        const slug = league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const countrySlug = league.country.toLowerCase().replace(/\s+/g, '-');

        // Generate rounds based on competition type
        const isLeague = league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie');
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

        return {
          _id: `league-${league.id}`,
          categoryId: null,
          code: league.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
          countryId: league.country === 'World' ? 'country-world' : `country-${league.country}`,
          createdAt: new Date().toISOString(),
          createdBy: null,
          description: null,
          image: `https://media.api-sports.io/football/leagues/${league.id}.png`,
          name: league.name,
          seasons: [{
            year: currentYear,
            start: `${currentYear}-08-01T00:00:00.000Z`,
            end: `${currentYear + 1}-05-31T23:59:59.999Z`,
            current: true,
            rounds: rounds,
            coverage: {
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
            currentRound: 10,
            isCurrent: true,
            isFinished: false,
            yearText: `${currentYear}/${currentYear + 1}`,
            standingLimitAll: [5, 10, 15, 20, 25],
            standingLimitHomeAway: [5, 10, 15]
          }],
          seq: league.seq,
          sportId: "football",
          status: "activated",
          tier: league.tier,
          type: league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie') ? 'league' : 'cup',
          updatedAt: new Date().toISOString(),
          updatedBy: null,
          slug: slug,
          seo: {
            description: `Follow ${league.name} standings, results, and fixtures`,
            image: `https://media.api-sports.io/football/leagues/${league.id}.png`,
            imageAlt: `${league.name} logo`,
            og: {
              title: league.name,
              description: `Follow ${league.name} standings, results, and fixtures`,
              image: `https://media.api-sports.io/football/leagues/${league.id}.png`
            },
            slug: slug,
            title: league.name
          },
          subhead: league.country,
          coefficient: 0,
          rating: league.tier === 1 ? 90.0 : league.tier === 2 ? 75.0 : league.tier === 3 ? 60.0 : 50.0,
          class: league.tier,
          rank: league.seq,
          country: {
            _id: league.country === 'World' ? 'country-world' : `country-${league.country}`,
            code: league.country === 'World' ? 'INT' : league.country.substring(0, 2).toUpperCase(),
            createdAt: new Date().toISOString(),
            createdBy: null,
            currency: null,
            image: `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(league.country)}.svg`,
            name: league.country,
            parentIds: [],
            phoneCode: null,
            seq: 1,
            sportIds: ["football"],
            status: "activated",
            type: "country",
            updatedAt: new Date().toISOString(),
            updatedBy: null,
            seo: {
              description: `${league.country} football competitions`,
              image: `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(league.country)}.svg`,
              imageAlt: `${league.country} flag`,
              slug: countrySlug,
              title: league.country
            },
            slug: countrySlug,
            baseName: league.country,
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
    const league = POPULAR_LEAGUES.find(l => l.id === leagueId);

    if (!league) {
      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 404,
        message: 'Competition not found',
        data: null
      });
    }

    // Generate slug
    const slug = league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Generate league code (first 3-4 letters of league name + country code)
    const countryCode = league.country.substring(0, 3).toUpperCase();
    const leagueCode = league.name.substring(0, 4).toUpperCase().replace(/\s/g, '');
    const code = `${countryCode}${league.tier}`;

    // Generate past seasons (last 15 years to match production)
    const currentYear = new Date().getFullYear();
    const seasons = [];

    for (let year = currentYear; year >= currentYear - 15; year--) {
      // Get winner for finished seasons
      const winner = year < currentYear ? getWinner(leagueId, year) : null;

      seasons.push({
        year: year,
        yearText: `${year}/${year + 1}`,
        current: year === currentYear,
        finished: year < currentYear,
        winner: winner
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: 'Success',
      data: {
        _id: `league-${leagueId}`,
        code: code,
        name: league.name,
        slug: slug,
        image: `https://media.api-sports.io/football/leagues/${leagueId}.png`,
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
 * Get competition detail by country slug and league slug
 */
router.get('/:countrySlug/:leagueSlug', async (req, res) => {
  try {
    const { countrySlug, leagueSlug } = req.params;

    console.log(`🔍 GET /api/competitions/${countrySlug}/${leagueSlug}`);

    // Find league by slug
    const league = POPULAR_LEAGUES.find(l => {
      const slug = l.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const country = l.country.toLowerCase().replace(/\s+/g, '-');

      const match = slug === leagueSlug && country === countrySlug;

      if (match) {
        console.log(`✅ Found match: ${l.name} (${l.country})`);
      }

      return match;
    });

    if (!league) {
      console.log(`❌ No league found for: ${countrySlug}/${leagueSlug}`);
      console.log(`   Available leagues:`, POPULAR_LEAGUES.map(l => {
        const slug = l.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const country = l.country.toLowerCase().replace(/\s+/g, '-');
        return `${country}/${slug}`;
      }).join(', '));

      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 404,
        message: 'Competition not found',
        data: null
      });
    }

    const currentYear = new Date().getFullYear();
    const slug = league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const countrySlugGenerated = league.country.toLowerCase().replace(/\s+/g, '-');

    // Generate rounds based on competition type
    const isLeague = league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie');
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

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: "Success",
      data: {
        _id: `league-${league.id}`,
        categoryId: null,
        code: league.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
        countryId: league.country === 'World' ? 'country-world' : `country-${league.country}`,
        createdAt: new Date().toISOString(),
        createdBy: null,
        description: null,
        image: `https://media.api-sports.io/football/leagues/${league.id}.png`,
        name: league.name,
        seasons: [{
          year: currentYear,
          start: `${currentYear}-08-01T00:00:00.000Z`,
          end: `${currentYear + 1}-05-31T23:59:59.999Z`,
          current: true,
          rounds: rounds,
          coverage: {
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
          currentRound: 10,
          isCurrent: true,
          isFinished: false,
          yearText: `${currentYear}/${currentYear + 1}`,
          standingLimitAll: [5, 10, 15, 20, 25],
          standingLimitHomeAway: [5, 10, 15]
        }],
        seq: league.seq,
        sportId: "football",
        status: "activated",
        tier: league.tier,
        type: league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie') ? 'league' : 'cup',
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        slug: slug,
        seo: {
          description: `Follow ${league.name} standings, results, and fixtures`,
          image: `https://media.api-sports.io/football/leagues/${league.id}.png`,
          imageAlt: `${league.name} logo`,
          og: {
            title: league.name,
            description: `Follow ${league.name} standings, results, and fixtures`,
            image: `https://media.api-sports.io/football/leagues/${league.id}.png`
          },
          slug: slug,
          title: league.name
        },
        subhead: league.country,
        coefficient: 0,
        rating: league.tier === 1 ? 90.0 : league.tier === 2 ? 75.0 : league.tier === 3 ? 60.0 : 50.0,
        class: league.tier,
        rank: league.seq,
        country: {
          _id: league.country === 'World' ? 'country-world' : `country-${league.country}`,
          code: league.country === 'World' ? 'INT' : league.country.substring(0, 2).toUpperCase(),
          createdAt: new Date().toISOString(),
          createdBy: null,
          currency: null,
          image: `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(league.country)}.svg`,
          name: league.country,
          parentIds: [],
          phoneCode: null,
          seq: 1,
          sportIds: ["football"],
          status: "activated",
          type: "country",
          updatedAt: new Date().toISOString(),
          updatedBy: null,
          seo: {
            description: `${league.country} football competitions`,
            image: `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(league.country)}.svg`,
            imageAlt: `${league.country} flag`,
            slug: countrySlugGenerated,
            title: league.country
          },
          slug: countrySlugGenerated,
          baseName: league.country,
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
 * Get single competition by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const league = POPULAR_LEAGUES.find(l => l.id === parseInt(id));

    if (!league) {
      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        errorCode: 404,
        message: 'Competition not found',
        data: null
      });
    }

    const currentYear = new Date().getFullYear();
    const slug = league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const countrySlug = league.country.toLowerCase().replace(/\s+/g, '-');

    // Generate rounds based on competition type
    const isLeague = league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie');
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

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: "Success",
      data: {
        _id: `league-${league.id}`,
        categoryId: null,
        code: league.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
        countryId: league.country === 'World' ? 'country-world' : `country-${league.country}`,
        createdAt: new Date().toISOString(),
        createdBy: null,
        description: null,
        image: `https://media.api-sports.io/football/leagues/${league.id}.png`,
        name: league.name,
        seasons: [{
          year: currentYear,
          start: `${currentYear}-08-01T00:00:00.000Z`,
          end: `${currentYear + 1}-05-31T23:59:59.999Z`,
          current: true,
          rounds: rounds,
          coverage: {
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
          currentRound: 10,
          isCurrent: true,
          isFinished: false,
          yearText: `${currentYear}/${currentYear + 1}`,
          standingLimitAll: [5, 10, 15, 20, 25],
          standingLimitHomeAway: [5, 10, 15]
        }],
        seq: league.seq,
        sportId: "football",
        status: "activated",
        tier: league.tier,
        type: league.name.includes('League') || league.name.includes('Liga') || league.name.includes('Serie') ? 'league' : 'cup',
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        slug: slug,
        seo: {
          description: `Follow ${league.name} standings, results, and fixtures`,
          image: `https://media.api-sports.io/football/leagues/${league.id}.png`,
          imageAlt: `${league.name} logo`,
          og: {
            title: league.name,
            description: `Follow ${league.name} standings, results, and fixtures`,
            image: `https://media.api-sports.io/football/leagues/${league.id}.png`
          },
          slug: slug,
          title: league.name
        },
        subhead: league.country,
        coefficient: 0,
        rating: league.tier === 1 ? 90.0 : league.tier === 2 ? 75.0 : league.tier === 3 ? 60.0 : 50.0,
        class: league.tier,
        rank: league.seq,
        country: {
          _id: league.country === 'World' ? 'country-world' : `country-${league.country}`,
          code: league.country === 'World' ? 'INT' : league.country.substring(0, 2).toUpperCase(),
          createdAt: new Date().toISOString(),
          createdBy: null,
          currency: null,
          image: `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(league.country)}.svg`,
          name: league.country,
          parentIds: [],
          phoneCode: null,
          seq: 1,
          sportIds: ["football"],
          status: "activated",
          type: "country",
          updatedAt: new Date().toISOString(),
          updatedBy: null,
          seo: {
            description: `${league.country} football competitions`,
            image: `https://flagicons.lipis.dev/flags/4x3/${getFlagCode(league.country)}.svg`,
            imageAlt: `${league.country} flag`,
            slug: countrySlug,
            title: league.country
          },
          slug: countrySlug,
          baseName: league.country,
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