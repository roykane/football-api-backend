// routes/standings.js - Standings/Rankings API
const express = require('express');
const router = express.Router();
const {
  MAJOR_LEAGUES,
  isLeagueAllowed,
  getLeagueData,
  getTop5Leagues,
  getAllowedLeagueIds
} = require('../data/majorLeagues');

// Standings cache
const standingsCache = new Map();
const STANDINGS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Form data cache
const formDataCache = new Map();
const FORM_DATA_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch last 5 matches for a team and transform to TFormDetail format
 */
async function fetchTeamFormDetails(footballApi, teamId, leagueId, seasonYear) {
  try {
    const cacheKey = `form-${teamId}-${leagueId}-${seasonYear}`;
    const cached = formDataCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < FORM_DATA_CACHE_DURATION)) {
      return cached.data;
    }

    const response = await footballApi.get('/fixtures', {
      params: {
        team: teamId,
        league: leagueId,
        season: seasonYear,
        last: 5
      }
    });

    const matches = response.data.response || [];

    const formDetails = matches.map(match => {
      const isHome = match.teams.home.id === teamId;
      const opponent = isHome ? match.teams.away : match.teams.home;

      // Determine form status (lowercase to match frontend enum)
      let formStatus;
      if (match.teams.home.winner === null && match.teams.away.winner === null) {
        formStatus = 'draw'; // Draw
      } else if (isHome) {
        formStatus = match.teams.home.winner ? 'win' : 'lose';
      } else {
        formStatus = match.teams.away.winner ? 'win' : 'lose';
      }

      // Generate match slug in format: home-vs-away
      const homeSlug = match.teams.home.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const awaySlug = match.teams.away.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const matchSlugStr = `${homeSlug}-vs-${awaySlug}`;

      return {
        dateTime: match.fixture.date,
        form: formStatus,
        name: opponent.name,
        score: `${match.goals.home}-${match.goals.away}`,
        matchId: match.fixture.id.toString(),
        matchSlug: {
          en: matchSlugStr,
          vi: matchSlugStr
        },
        awayTeamId: match.teams.away.id.toString(),
        homeTeamId: match.teams.home.id.toString()
      };
    });

    // Cache result
    formDataCache.set(cacheKey, {
      data: formDetails,
      timestamp: Date.now()
    });

    return formDetails;
  } catch (error) {
    console.error(`   ⚠️  Failed to fetch form details for team ${teamId}:`, error.message);
    return [];
  }
}

/**
 * GET /api/standings/overall
 * Get overall standings (alias for main standings endpoint)
 */
router.get('/overall', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const {
      competitionId,
      seasonYear = new Date().getFullYear(),
      type = 'all' // all, home, away
    } = req.query;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'competitionId is required'
      });
    }

    const leagueId = competitionId.replace('league-', '');

    if (!isLeagueAllowed(parseInt(leagueId))) {
      return res.status(403).json({
        success: false,
        error: 'League not supported',
        allowedLeagues: getAllowedLeagueIds()
      });
    }

    console.log(`\n📊 GET /api/standings/overall`);
    console.log(`   Competition: ${competitionId}, Season: ${seasonYear}, Type: ${type}`);

    // Check cache
    const cacheKey = `standings-${leagueId}-${seasonYear}-${type}`;
    const cached = standingsCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < STANDINGS_CACHE_DURATION)) {
      console.log(`   ✅ Cache hit`);
      return res.json({
        success: true,
        data: cached.data
      });
    }

    // Fetch from API
    const response = await footballApi.get('/standings', {
      params: {
        league: leagueId,
        season: seasonYear
      }
    });

    const apiData = response.data?.response || [];

    if (apiData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No standings found'
      });
    }

    const standings = apiData[0]?.league?.standings[0] || [];

    // Transform standings data (no need to fetch form details separately)
    const transformedData = standings.map((team) => {
      return {
        _id: `standing-${team.team.id}`,
        rank: team.rank,
        team: {
          _id: `team-${team.team.id}`,
          id: team.team.id,
          name: team.team.name,
          image: team.team.logo
        },
        // ✅ Always return all 3 stat objects for frontend compatibility
        all: {
          played: team.all.played,
          win: team.all.win,
          draw: team.all.draw,
          lose: team.all.lose,
          goalsFor: team.all.goals.for,
          goalsAgainst: team.all.goals.against,
          goalsDiff: team.all.goals.for - team.all.goals.against,
          points: team.points
        },
        home: {
          played: team.home.played,
          win: team.home.win,
          draw: team.home.draw,
          lose: team.home.lose,
          goalsFor: team.home.goals.for,
          goalsAgainst: team.home.goals.against,
          goalsDiff: team.home.goals.for - team.home.goals.against,
          points: team.points
        },
        away: {
          played: team.away.played,
          win: team.away.win,
          draw: team.away.draw,
          lose: team.away.lose,
          goalsFor: team.away.goals.for,
          goalsAgainst: team.away.goals.against,
          goalsDiff: team.away.goals.for - team.away.goals.against,
          points: team.points
        },
        form: team.form || '',
        forms: [], // Empty array - form details removed to avoid rate limiting
        description: team.description || ''
      };
    });

    console.log(`   ✅ Transformed ${transformedData.length} teams`);

    // Cache it
    standingsCache.set(cacheKey, {
      data: transformedData,
      timestamp: Date.now()
    });

    console.log(`   ✅ Returning ${transformedData.length} teams\n`);

    res.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standings',
      message: error.message
    });
  }
});

/**
 * GET /api/standings/form
 * Get standings sorted by recent form
 */
router.get('/form', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const {
      competitionId,
      seasonYear = new Date().getFullYear()
    } = req.query;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'competitionId is required'
      });
    }

    const leagueId = competitionId.replace('league-', '');

    if (!isLeagueAllowed(parseInt(leagueId))) {
      return res.status(403).json({
        success: false,
        error: 'League not supported'
      });
    }

    console.log(`\n📈 GET /api/standings/form`);
    console.log(`   Competition: ${competitionId}, Season: ${seasonYear}`);

    // Get standings data (same as overall)
    const response = await footballApi.get('/standings', {
      params: {
        league: leagueId,
        season: seasonYear
      }
    });

    const standings = response.data?.response[0]?.league?.standings[0] || [];

    console.log(`📊 Fetched ${standings.length} teams from API-Sports`);

    if (standings.length > 0) {
      console.log(`   Sample form data: ${standings[0].team.name} - Form: "${standings[0].form}"`);
    }

    // Calculate form points (last 5 matches)
    const calculateFormPoints = (formString) => {
      if (!formString) return 0;
      return formString.split('').reduce((points, result) => {
        if (result === 'W') return points + 3;
        if (result === 'D') return points + 1;
        return points;
      }, 0);
    };

    // Transform standings data and sort by form points
    const transformedData = standings.map((team) => {
      return {
        _id: `standing-${team.team.id}`,
        rank: team.rank,
        team: {
          _id: `team-${team.team.id}`,
          id: team.team.id,
          name: team.team.name,
          image: team.team.logo
        },
        // ✅ Add full statistics objects for frontend compatibility
        all: {
          played: team.all.played,
          win: team.all.win,
          draw: team.all.draw,
          lose: team.all.lose,
          goalsFor: team.all.goals.for,
          goalsAgainst: team.all.goals.against,
          goalsDiff: team.all.goals.for - team.all.goals.against,
          goalsText: `${team.all.goals.for}:${team.all.goals.against}`,
          points: team.points
        },
        home: {
          played: team.home.played,
          win: team.home.win,
          draw: team.home.draw,
          lose: team.home.lose,
          goalsFor: team.home.goals.for,
          goalsAgainst: team.home.goals.against,
          goalsDiff: team.home.goals.for - team.home.goals.against,
          goalsText: `${team.home.goals.for}:${team.home.goals.against}`,
          points: team.points
        },
        away: {
          played: team.away.played,
          win: team.away.win,
          draw: team.away.draw,
          lose: team.away.lose,
          goalsFor: team.away.goals.for,
          goalsAgainst: team.away.goals.against,
          goalsDiff: team.away.goals.for - team.away.goals.against,
          goalsText: `${team.away.goals.for}:${team.away.goals.against}`,
          points: team.points
        },
        form: team.form || '',
        forms: [], // Empty array - form details removed to avoid rate limiting
        formPoints: calculateFormPoints(team.form),
        last5: {
          played: Math.min(5, team.all.played),
          win: (team.form?.match(/W/g) || []).length,
          draw: (team.form?.match(/D/g) || []).length,
          lose: (team.form?.match(/L/g) || []).length
        },
        points: team.points
      };
    }).sort((a, b) => b.formPoints - a.formPoints); // Sort by form points

    console.log(`   ✅ Transformed ${transformedData.length} teams`);

    console.log(`✅ Returning ${transformedData.length} teams sorted by form`);
    console.log(`   Top 3 by form:`, transformedData.slice(0, 3).map(t => `${t.team.name}: ${t.form} (${t.formPoints}pts)`));

    res.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch form standings',
      message: error.message
    });
  }
});

/**
 * GET /api/standings/top-score
 * Get top scorers for a league
 */
router.get('/top-score', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const {
      competitionId,
      seasonYear = new Date().getFullYear()
    } = req.query;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'competitionId is required'
      });
    }

    const leagueId = competitionId.replace('league-', '');

    if (!isLeagueAllowed(parseInt(leagueId))) {
      return res.status(403).json({
        success: false,
        error: 'League not supported'
      });
    }

    console.log(`\n⚽ GET /api/standings/top-score`);
    console.log(`   Competition: ${competitionId}, Season: ${seasonYear}`);

    // Check cache
    const cacheKey = `top-scorers-${leagueId}-${seasonYear}`;
    const cached = standingsCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < STANDINGS_CACHE_DURATION)) {
      console.log(`   ✅ Cache hit`);
      return res.json({
        success: true,
        data: cached.data
      });
    }

    // Fetch top scorers from API
    const response = await footballApi.get('/players/topscorers', {
      params: {
        league: leagueId,
        season: seasonYear
      }
    });

    const players = response.data?.response || [];

    // Helper to create slug from name
    const createSlug = (name) => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    // Helper to get country flag code
    const getCountryFlagCode = (countryName) => {
      const countryMap = {
        'France': 'fr',
        'Poland': 'pl',
        'Croatia': 'hr',
        'Norway': 'no',
        'Spain': 'es',
        'Brazil': 'br',
        'Argentina': 'ar',
        'Belgium': 'be',
        'Uruguay': 'uy',
        'Portugal': 'pt',
        'England': 'gb-eng',
        'Germany': 'de',
        'Italy': 'it',
        'Netherlands': 'nl',
        'Morocco': 'ma',
        'Senegal': 'sn',
        'Colombia': 'co',
        'Ecuador': 'ec',
        'Nigeria': 'ng',
        'Ghana': 'gh',
        'Egypt': 'eg',
        'Algeria': 'dz',
        'Cameroon': 'cm',
        'Ivory-Coast': 'ci',
        'Mali': 'ml',
        'Guinea': 'gn',
        'Burkina-Faso': 'bf',
        'Gabon': 'ga',
      };
      return countryMap[countryName] || countryName?.toLowerCase().replace(/\s+/g, '-') || 'un';
    };

    const transformedData = players.map((item, index) => {
      const stats = item.statistics[0] || {};
      const playerSlug = createSlug(item.player.name);
      const countryCode = getCountryFlagCode(item.player.nationality);
      const teamSlug = createSlug(stats.team?.name || 'unknown');

      return {
        _id: `player-${item.player.id}`,
        rank: index + 1,

        // Player info matching TPlayer type
        player: {
          _id: `player-${item.player.id}`,
          name: item.player.name,
          slug: playerSlug,
          image: item.player.photo,
          thumbnail: item.player.photo,
          position: stats.games?.position || 'Attacker', // Map to EPosition
          country: {
            _id: `country-${countryCode}`,
            name: item.player.nationality,
            code: countryCode,
            image: `https://flagicons.lipis.dev/flags/4x3/${countryCode}.svg`,
            thumbnail: `https://flagicons.lipis.dev/flags/4x3/${countryCode}.svg`,
            flag: `https://flagicons.lipis.dev/flags/4x3/${countryCode}.svg`,
            slug: countryCode,
            status: 'active',
            type: 'national',
            createdAt: new Date().toISOString()
          }
        },

        // Team info matching TTeam type
        team: {
          _id: `team-${stats.team?.id}`,
          name: stats.team?.name,
          code: teamSlug,
          logo: stats.team?.logo,
          image: stats.team?.logo,
          teamId: `${stats.team?.id}`
        },

        // Statistics - use flat structure as expected by frontend
        sumGoals: stats.goals?.total || 0,
        sumAssists: stats.goals?.assists || 0,
        avgRating: parseFloat(stats.games?.rating || '0')
      };
    });

    // Build filters
    const countryFilter = [];
    const teamFilter = [];
    const positionFilter = [];
    const countrySet = new Set();
    const teamSet = new Set();
    const positionSet = new Set();

    transformedData.forEach(item => {
      // Country filter
      if (item.player.country && !countrySet.has(item.player.country.code)) {
        countrySet.add(item.player.country.code);
        countryFilter.push(item.player.country);
      }

      // Team filter
      if (item.team && !teamSet.has(item.team._id)) {
        teamSet.add(item.team._id);
        teamFilter.push(item.team);
      }

      // Position filter
      if (item.player.position && !positionSet.has(item.player.position)) {
        positionSet.add(item.player.position);
        positionFilter.push(item.player.position);
      }
    });

    const responseData = {
      items: transformedData,
      countryFilter: countryFilter.sort((a, b) => a.name.localeCompare(b.name)),
      teamFilter: teamFilter.sort((a, b) => a.name.localeCompare(b.name)),
      positionFilter: positionFilter.sort()
    };

    // Cache it
    standingsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    console.log(`   ✅ Returning ${transformedData.length} top scorers\n`);

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top scorers',
      message: error.message
    });
  }
});

/**
 * Calculate HT/FT statistics for a team
 */
async function calculateHTFTStats(footballApi, teamId, leagueId, seasonYear) {
  try {
    const cacheKey = `htft-${teamId}-${leagueId}-${seasonYear}`;
    const cached = formDataCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < FORM_DATA_CACHE_DURATION)) {
      return cached.data;
    }

    // Fetch all finished matches for the team in this season
    const response = await footballApi.get('/fixtures', {
      params: {
        team: teamId,
        league: leagueId,
        season: seasonYear,
        status: 'FT' // Only finished matches
      }
    });

    const matches = response.data.response || [];

    // Initialize counters
    const htftStats = {
      winWin: 0,
      winDraw: 0,
      winLose: 0,
      drawWin: 0,
      drawDraw: 0,
      drawLose: 0,
      loseWin: 0,
      loseDraw: 0,
      loseLose: 0,
      played: 0
    };

    matches.forEach(match => {
      const isHome = match.teams.home.id === teamId;
      const htScore = match.score?.halftime;
      const ftScore = match.score?.fulltime;

      if (!htScore || !ftScore) return;

      htftStats.played++;

      // Determine HT result
      let htResult;
      if (isHome) {
        if (htScore.home > htScore.away) htResult = 'win';
        else if (htScore.home < htScore.away) htResult = 'lose';
        else htResult = 'draw';
      } else {
        if (htScore.away > htScore.home) htResult = 'win';
        else if (htScore.away < htScore.home) htResult = 'lose';
        else htResult = 'draw';
      }

      // Determine FT result
      let ftResult;
      if (isHome) {
        if (ftScore.home > ftScore.away) ftResult = 'win';
        else if (ftScore.home < ftScore.away) ftResult = 'lose';
        else ftResult = 'draw';
      } else {
        if (ftScore.away > ftScore.home) ftResult = 'win';
        else if (ftScore.away < ftScore.home) ftResult = 'lose';
        else ftResult = 'draw';
      }

      // Increment appropriate counter
      const key = `${htResult}${ftResult.charAt(0).toUpperCase() + ftResult.slice(1)}`;
      if (htftStats[key] !== undefined) {
        htftStats[key]++;
      }
    });

    // Cache result
    formDataCache.set(cacheKey, {
      data: htftStats,
      timestamp: Date.now()
    });

    return htftStats;
  } catch (error) {
    console.error(`   ⚠️  Failed to calculate HT/FT stats for team ${teamId}:`, error.message);
    return {
      winWin: 0, winDraw: 0, winLose: 0,
      drawWin: 0, drawDraw: 0, drawLose: 0,
      loseWin: 0, loseDraw: 0, loseLose: 0,
      played: 0
    };
  }
}

/**
 * GET /api/standings/htft
 * Get half-time/full-time statistics
 */
router.get('/htft', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const {
      competitionId,
      seasonYear = new Date().getFullYear()
    } = req.query;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'competitionId is required'
      });
    }

    const leagueId = competitionId.replace('league-', '');

    if (!isLeagueAllowed(parseInt(leagueId))) {
      return res.status(403).json({
        success: false,
        error: 'League not supported'
      });
    }

    console.log(`\n⏱️ GET /api/standings/htft`);
    console.log(`   Competition: ${competitionId}, Season: ${seasonYear}`);

    // Check cache
    const cacheKey = `htft-standings-${leagueId}-${seasonYear}`;
    const cached = standingsCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < STANDINGS_CACHE_DURATION)) {
      console.log(`   ✅ Cache hit`);
      return res.json({
        success: true,
        data: cached.data
      });
    }

    // Get standings data
    const response = await footballApi.get('/standings', {
      params: {
        league: leagueId,
        season: seasonYear
      }
    });

    const standings = response.data?.response[0]?.league?.standings[0] || [];

    console.log(`   🔄 Calculating HT/FT stats for ${standings.length} teams...`);

    // Calculate HT/FT stats for all teams in parallel
    const transformedData = await Promise.all(standings.map(async (team) => {
      const htftStats = await calculateHTFTStats(
        footballApi,
        team.team.id,
        leagueId,
        seasonYear
      );

      return {
        _id: `standing-${team.team.id}`,
        rank: team.rank,
        team: {
          _id: `team-${team.team.id}`,
          id: team.team.id,
          name: team.team.name,
          image: team.team.logo
        },
        teamId: `team-${team.team.id}`,
        played: htftStats.played,
        points: team.points,
        qualification: team.description || null,
        // HT/FT Statistics
        winWin: htftStats.winWin,
        winDraw: htftStats.winDraw,
        winLose: htftStats.winLose,
        drawWin: htftStats.drawWin,
        drawDraw: htftStats.drawDraw,
        drawLose: htftStats.drawLose,
        loseWin: htftStats.loseWin,
        loseDraw: htftStats.loseDraw,
        loseLose: htftStats.loseLose,
        // Keep original stats for compatibility
        overall: {
          played: team.all.played,
          points: team.points
        },
        home: {
          played: team.home.played,
          win: team.home.win,
          draw: team.home.draw,
          lose: team.home.lose,
          goalsFor: team.home.goals.for,
          goalsAgainst: team.home.goals.against
        },
        away: {
          played: team.away.played,
          win: team.away.win,
          draw: team.away.draw,
          lose: team.away.lose,
          goalsFor: team.away.goals.for,
          goalsAgainst: team.away.goals.against
        }
      };
    }));

    console.log(`   ✅ HT/FT stats calculated for all teams`);

    // Cache result
    standingsCache.set(cacheKey, {
      data: transformedData,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HT/FT standings',
      message: error.message
    });
  }
});

/**
 * GET /api/standings
 * Get standings for a specific league and season
 * Query params:
 *   - competitionId: League ID (required)
 *   - seasonYear: Season year (default: current year)
 *   - type: 'all' | 'home' | 'away' (default: 'all')
 */
router.get('/', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const {
      competitionId,
      seasonYear = new Date().getFullYear(),
      type = 'all'
    } = req.query;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        error: 'competitionId is required'
      });
    }

    // Extract league ID from competitionId (format: "league-39")
    const leagueId = competitionId.replace('league-', '');

    // ============================================
    // 🔒 KIỂM TRA GIẢI ĐẤU CÓ ĐƯỢC PHÉP KHÔNG
    // ============================================
    if (!isLeagueAllowed(parseInt(leagueId))) {
      return res.status(403).json({
        success: false,
        error: 'League not supported',
        message: `League ID ${leagueId} is not in the list of major leagues`,
        allowedLeagues: getAllowedLeagueIds()
      });
    }

    console.log(`\n📊 GET /api/standings`);
    console.log(`   Competition: ${competitionId}, Season: ${seasonYear}, Type: ${type}`);

    // Check cache
    const cacheKey = `standings-${leagueId}-${seasonYear}-${type}`;
    const cached = standingsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < STANDINGS_CACHE_DURATION)) {
      console.log(`   ✅ Cache hit`);
      return res.json({
        success: true,
        data: cached.data,
        meta: {
          cached: true,
          timestamp: cached.timestamp,
          league: getLeagueData(parseInt(leagueId))
        }
      });
    }

    // Fetch from API
    console.log(`   🔄 Fetching from API...`);
    const response = await footballApi.get('/standings', {
      params: {
        league: leagueId,
        season: seasonYear
      }
    });

    const apiData = response.data?.response || [];
    
    if (apiData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No standings found'
      });
    }

    // Transform data
    const leagueData = apiData[0]?.league || {};
    const standings = leagueData.standings || [];

    // Filter by type (all/home/away)
    let filteredStandings = standings[0] || [];

    // Transform standings data
    const transformedData = filteredStandings.map((team, index) => {
      const stats = type === 'home'
        ? team.home
        : type === 'away'
          ? team.away
          : team.all;

      return {
        _id: `standing-${team.team.id}`,
        rank: team.rank,
        team: {
          _id: `team-${team.team.id}`,
          id: team.team.id,
          name: team.team.name,
          image: team.team.logo,
          slug: team.team.name.toLowerCase().replace(/\s+/g, '-')
        },
        all: {
          played: stats.played,
          win: stats.win,
          draw: stats.draw,
          lose: stats.lose,
          goalsFor: stats.goals.for,
          goalsAgainst: stats.goals.against,
          goalsDiff: stats.goals.for - stats.goals.against,
          points: team.points
        },
        home: {
          played: team.home.played,
          win: team.home.win,
          draw: team.home.draw,
          lose: team.home.lose,
          goalsFor: team.home.goals.for,
          goalsAgainst: team.home.goals.against,
          goalsDiff: team.home.goals.for - team.home.goals.against
        },
        away: {
          played: team.away.played,
          win: team.away.win,
          draw: team.away.draw,
          lose: team.away.lose,
          goalsFor: team.away.goals.for,
          goalsAgainst: team.away.goals.against,
          goalsDiff: team.away.goals.for - team.away.goals.against
        },
        form: team.form || '',
        forms: [], // Empty array - form details removed to avoid rate limiting
        status: team.status || '',
        description: team.description || '',
        qualification: determineQualification(team.description, index)
      };
    });

    console.log(`   ✅ Transformed ${transformedData.length} teams`);

    // Cache result
    standingsCache.set(cacheKey, {
      data: transformedData,
      timestamp: Date.now()
    });

    console.log(`   ✅ Returning ${transformedData.length} teams\n`);

    res.json({
      success: true,
      data: transformedData,
      meta: {
        league: {
          id: leagueData.id,
          name: leagueData.name,
          country: leagueData.country,
          logo: leagueData.logo,
          flag: leagueData.flag,
          season: leagueData.season,
          ...getLeagueData(parseInt(leagueId))
        },
        cached: false,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching standings:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standings',
      message: error.message
    });
  }
});

/**
 * GET /api/standings/competitions
 * Get standings for multiple competitions at once
 * Query params:
 *   - ids: Comma-separated competition IDs
 *   - seasonYear: Season year (default: current year)
 */
router.get('/competitions', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const {
      ids,
      seasonYear = new Date().getFullYear()
    } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'ids parameter is required (comma-separated)'
      });
    }

    console.log(`\n📊 GET /api/standings/competitions`);
    console.log(`   IDs: ${ids}, Season: ${seasonYear}`);

    const competitionIds = ids.split(',').map(id => id.trim());
    
    // ============================================
    // 🔒 LỌC CHỈ CÁC GIẢI ĐẤU ĐƯỢC PHÉP
    // ============================================
    const allowedIds = competitionIds.filter(competitionId => {
      const leagueId = parseInt(competitionId.replace('league-', ''));
      return isLeagueAllowed(leagueId);
    });

    if (allowedIds.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No allowed leagues in request',
        message: 'None of the requested leagues are supported',
        requestedIds: competitionIds,
        allowedLeagueIds: getAllowedLeagueIds().map(id => `league-${id}`)
      });
    }

    if (allowedIds.length < competitionIds.length) {
      console.log(`   ⚠️  Filtered out ${competitionIds.length - allowedIds.length} unsupported leagues`);
    }
    
    // Fetch standings for all allowed competitions in parallel
    const results = await Promise.allSettled(
      allowedIds.map(async (competitionId) => {
        const leagueId = competitionId.replace('league-', '');
        const cacheKey = `standings-${leagueId}-${seasonYear}-all`;
        
        // Check cache first
        const cached = standingsCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < STANDINGS_CACHE_DURATION)) {
          return {
            competitionId,
            data: cached.data,
            cached: true,
            leagueInfo: getLeagueData(parseInt(leagueId))
          };
        }

        // Fetch from API
        const response = await footballApi.get('/standings', {
          params: {
            league: leagueId,
            season: seasonYear
          }
        });

        const apiData = response.data?.response || [];
        if (apiData.length === 0) {
          return {
            competitionId,
            data: [],
            error: 'No data found',
            leagueInfo: getLeagueData(parseInt(leagueId))
          };
        }

        const standings = apiData[0]?.league?.standings[0] || [];
        
        const transformedData = standings.map((team, index) => ({
          _id: `standing-${team.team.id}`,
          rank: team.rank,
          team: {
            _id: `team-${team.team.id}`,
            id: team.team.id,
            name: team.team.name,
            image: team.team.logo
          },
          all: {
            played: team.all.played,
            win: team.all.win,
            draw: team.all.draw,
            lose: team.all.lose,
            goalsFor: team.all.goals.for,
            goalsAgainst: team.all.goals.against,
            goalsDiff: team.all.goals.for - team.all.goals.against,
            points: team.points
          },
          form: team.form || '',
          description: team.description || '',
          qualification: determineQualification(team.description, index)
        }));

        // Cache it
        standingsCache.set(cacheKey, {
          data: transformedData,
          timestamp: Date.now()
        });

        return {
          competitionId,
          data: transformedData,
          cached: false,
          leagueInfo: getLeagueData(parseInt(leagueId))
        };
      })
    );

    // Process results
    const standings = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          competitionId: allowedIds[index],
          data: [],
          error: result.reason?.message || 'Failed to fetch',
          leagueInfo: getLeagueData(parseInt(allowedIds[index].replace('league-', '')))
        };
      }
    });

    console.log(`   ✅ Returning ${standings.length} competitions\n`);

    res.json({
      success: true,
      data: standings,
      meta: {
        total: standings.length,
        requested: competitionIds.length,
        filtered: competitionIds.length - allowedIds.length,
        seasonYear
      }
    });

  } catch (error) {
    console.error('❌ Error fetching multiple standings:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standings',
      message: error.message
    });
  }
});

/**
 * GET /api/standings/top-leagues
 * Get standings for top 5 leagues (EPL, LaLiga, Serie A, Bundesliga, Ligue 1)
 */
router.get('/top-leagues', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { seasonYear = new Date().getFullYear() } = req.query;

    console.log(`\n🏆 GET /api/standings/top-leagues`);

    // Get top 5 leagues
    const topLeagues = getTop5Leagues();
    const leagueIds = topLeagues.map(league => `league-${league.id}`);

    console.log(`   Fetching top ${leagueIds.length} leagues:`, 
      topLeagues.map(l => l.displayName).join(', '));

    // Fetch all in parallel
    const results = await Promise.allSettled(
      leagueIds.map(async (competitionId) => {
        const leagueId = competitionId.replace('league-', '');
        const cacheKey = `standings-${leagueId}-${seasonYear}-all`;
        
        // Check cache
        const cached = standingsCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < STANDINGS_CACHE_DURATION)) {
          return {
            competitionId,
            data: cached.data,
            cached: true,
            leagueInfo: getLeagueData(parseInt(leagueId))
          };
        }

        // Fetch from API
        const response = await footballApi.get('/standings', {
          params: {
            league: leagueId,
            season: seasonYear
          }
        });

        const apiData = response.data?.response || [];
        if (apiData.length === 0) {
          return {
            competitionId,
            data: [],
            error: 'No data found',
            leagueInfo: getLeagueData(parseInt(leagueId))
          };
        }

        const standings = apiData[0]?.league?.standings[0] || [];
        
        const transformedData = standings.map((team, index) => ({
          _id: `standing-${team.team.id}`,
          rank: team.rank,
          team: {
            _id: `team-${team.team.id}`,
            id: team.team.id,
            name: team.team.name,
            image: team.team.logo
          },
          all: {
            played: team.all.played,
            win: team.all.win,
            draw: team.all.draw,
            lose: team.all.lose,
            goalsFor: team.all.goals.for,
            goalsAgainst: team.all.goals.against,
            goalsDiff: team.all.goals.for - team.all.goals.against,
            points: team.points
          },
          form: team.form || '',
          description: team.description || '',
          qualification: determineQualification(team.description, index)
        }));

        // Cache it
        standingsCache.set(cacheKey, {
          data: transformedData,
          timestamp: Date.now()
        });

        return {
          competitionId,
          data: transformedData,
          cached: false,
          leagueInfo: getLeagueData(parseInt(leagueId))
        };
      })
    );

    // Process results
    const standings = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          competitionId: leagueIds[index],
          data: [],
          error: result.reason?.message || 'Failed to fetch',
          leagueInfo: topLeagues[index]
        };
      }
    });

    console.log(`   ✅ Returning ${standings.length} top leagues\n`);

    res.json({
      success: true,
      data: standings,
      meta: {
        total: standings.length,
        seasonYear,
        leagues: topLeagues
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top leagues standings',
      message: error.message
    });
  }
});

/**
 * GET /api/standings/allowed-leagues
 * Get list of all allowed major leagues
 */
router.get('/allowed-leagues', (req, res) => {
  try {
    console.log('\n📋 GET /api/standings/allowed-leagues');

    const leagues = MAJOR_LEAGUES.map(league => ({
      id: league.id,
      competitionId: `league-${league.id}`,
      code: league.code,
      name: league.name,
      displayName: league.displayName,
      country: league.country,
      countryCode: league.countryCode,
      tier: league.tier,
      seq: league.seq
    }));

    // Group by tier
    const groupedByTier = {
      international: leagues.filter(l => l.tier === 0),
      tier1: leagues.filter(l => l.tier === 1),
      tier2: leagues.filter(l => l.tier === 2)
    };

    console.log(`   ✅ Returning ${leagues.length} allowed leagues\n`);

    res.json({
      success: true,
      data: {
        all: leagues,
        grouped: groupedByTier,
        total: leagues.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch allowed leagues',
      message: error.message
    });
  }
});

/**
 * DELETE /api/standings/cache
 * Clear standings cache
 */
router.delete('/cache', (req, res) => {
  const standingsSize = standingsCache.size;
  const formSize = formDataCache.size;

  standingsCache.clear();
  formDataCache.clear();

  console.log(`🗑️  Cleared ${standingsSize} standings + ${formSize} form cache entries`);

  res.json({
    success: true,
    message: `Cleared ${standingsSize} standings cache entries and ${formSize} form cache entries`
  });
});

/**
 * Helper: Determine qualification type from description
 */
function determineQualification(description, rank) {
  if (!description) return null;

  const desc = description.toLowerCase();
  
  if (desc.includes('champions league')) {
    return 'UEFA Champions League';
  } else if (desc.includes('europa league')) {
    return 'UEFA Europa League';
  } else if (desc.includes('conference league')) {
    return 'UEFA Conference League';
  } else if (desc.includes('relegation')) {
    return 'Relegation';
  } else if (desc.includes('promotion')) {
    return 'Promotion';
  }
  
  return null;
}

module.exports = router;