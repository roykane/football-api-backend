// utils/transformers.js - Transform API data to match format

const { getMockBookmakers } = require('../data/mockOdds');

// ============================================
// CẤU HÌNH: Default fallback image cho logo lỗi
// ============================================
const DEFAULT_FALLBACK_IMAGE = 'https://media.api-sports.io/football/teams/5297.png';

// ============================================
// CẤU HÌNH: Các loại kèo cần lấy
// ============================================
const ALLOWED_BET_TYPES = [
  'Match Winner',                    // match_winner - Kèo 1X2
  'Asian Handicap',                  // asian_handicap - Kèo châu Á
  'Goals Over/Under',                // goals_over_under - Kèo tài xỉu
  'Exact Score',                     // exact_score - Tỷ số chính xác
  'First Half Winner',               // first_half_winner - Thắng hiệp 1
  'Asian Handicap First Half',       // asian_handicap_first_half - Kèo châu Á hiệp 1
  'Odd/Even',                        // odd_even - Chẵn/Lẻ
];

// Số lượng tối đa (không sử dụng nữa vì đã filter theo tên)
const MAX_BETS_PER_BOOKMAKER = 7;

/**
 * Map API status to frontend-friendly status
 */
function mapFixtureStatus(apiStatusShort) {
  if (['1H', '2H', 'ET', 'P', 'LIVE', 'HT', 'BT'].includes(apiStatusShort)) {
    return 'in_play';
  } else if (['FT', 'AET', 'PEN'].includes(apiStatusShort)) {
    return 'finished';
  } else if (apiStatusShort === 'PST') {
    return 'postponed';
  } else if (apiStatusShort === 'CANC') {
    return 'cancelled';
  } else if (apiStatusShort === 'ABD') {
    return 'abandoned';
  } else if (['AWA', 'WO'].includes(apiStatusShort)) {
    return 'not_played';
  }
  return 'scheduled';
}

/**
 * Map Football API bet names to frontend bet types
 */
function mapBetType(betName) {
  const mapping = {
    'Match Winner': 'match_winner',
    'Asian Handicap': 'asian_handicap',
    'Goals Over/Under': 'goals_over_under',
    'Goals Over/Under First Half': 'goals_over_under_first_half',
    'Both Teams Score': 'both_teams_score',
    'First Half Winner': 'first_half_winner',
    'Asian Handicap First Half': 'asian_handicap_first_half',
    'Odd/Even': 'odd_even',
    'Exact Score': 'exact_score',
    'Home/Away': 'home_away'
  };
  
  return mapping[betName] || betName.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Transform API fixture data to match format
 * @param {Object} fixture - Fixture data from API-Football
 * @param {Array} oddsData - Odds data (empty if not fetched)
 * @param {Array} statsData - Statistics data
 * @param {Boolean} useMockOdds - Use mock odds instead of real data (for testing)
 */
function transformToMatchFormat(fixture, oddsData = [], statsData = [], useMockOdds = false) {
  const homeTeam = fixture.teams?.home || {};
  const awayTeam = fixture.teams?.away || {};
  const score = fixture.score || {};
  const goals = fixture.goals || {};
  
  // Transform match object
  const match = {
    _id: `match-${fixture.fixture.id}`,
    id: fixture.fixture.id,
    attendance: fixture.fixture.venue?.attendance || null,
    dateTime: fixture.fixture.date,
    elapsed: fixture.fixture.status?.elapsed || null,
    events: transformEvents(fixture.events, homeTeam.id, awayTeam.id),
    extra: fixture.fixture.status?.extra || null,
    name: `${homeTeam.name} - ${awayTeam.name}`,
    periods: {
      first: score.halftime?.home !== null ? score.halftime : null,
      second: score.fulltime?.home !== null ? score.fulltime : null
    },
    round: fixture.league?.round || '',
    roundLevel: extractRoundLevel(fixture.league?.round),
    score: goals.home !== null && goals.away !== null 
      ? `${goals.home}-${goals.away}` 
      : null,
    seasonYear: fixture.league?.season || new Date().getFullYear(),
    seo: {
      description: `${fixture.league?.country}: ${fixture.league?.name} (${fixture.league?.season}) - ${fixture.league?.round}`,
      imageAlt: `${homeTeam.name} - ${awayTeam.name}`,
      slug: generateSlug(fixture),
      title: `${homeTeam.name} - ${awayTeam.name}`
    },
    slug: generateSlug(fixture),
    status: mapFixtureStatus(fixture.fixture.status?.short),
    statusCode: fixture.fixture.status?.short || 'NS',
    subhead: `${fixture.league?.country}: ${fixture.league?.name} (${fixture.league?.season}) - ${fixture.league?.round}`,
    teamIds: [
      `team-${homeTeam.id}`,
      `team-${awayTeam.id}`
    ],
    teams: {
      home: {
        teamId: `team-${homeTeam.id}`,
        name: homeTeam.name,
        logo: homeTeam.logo || DEFAULT_FALLBACK_IMAGE,
        goal: goals.home,
        halftime: score.halftime?.home ?? null,
        fulltime: score.fulltime?.home ?? null,
        extratime: score.extratime?.home ?? null,
        penalty: score.penalty?.home ?? null,
        winner: homeTeam.winner ?? null,
        form: getTeamForm(fixture.teams?.home),
        yellowCards: fixture.statistics?.find(s => s.team.id === homeTeam.id)?.statistics?.find(st => st.type === 'Yellow Cards')?.value || 0,
        redCards: fixture.statistics?.find(s => s.team.id === homeTeam.id)?.statistics?.find(st => st.type === 'Red Cards')?.value || 0,
        corners: fixture.statistics?.find(s => s.team.id === homeTeam.id)?.statistics?.find(st => st.type === 'Corner Kicks')?.value || 0
      },
      away: {
        teamId: `team-${awayTeam.id}`,
        name: awayTeam.name,
        logo: awayTeam.logo || DEFAULT_FALLBACK_IMAGE,
        goal: goals.away,
        halftime: score.halftime?.away ?? null,
        fulltime: score.fulltime?.away ?? null,
        extratime: score.extratime?.away ?? null,
        penalty: score.penalty?.away ?? null,
        winner: awayTeam.winner ?? null,
        form: getTeamForm(fixture.teams?.away),
        yellowCards: fixture.statistics?.find(s => s.team.id === awayTeam.id)?.statistics?.find(st => st.type === 'Yellow Cards')?.value || 0,
        redCards: fixture.statistics?.find(s => s.team.id === awayTeam.id)?.statistics?.find(st => st.type === 'Red Cards')?.value || 0,
        corners: fixture.statistics?.find(s => s.team.id === awayTeam.id)?.statistics?.find(st => st.type === 'Corner Kicks')?.value || 0
      }
    },
    competition: {
      _id: `league-${fixture.league?.id}`,
      id: fixture.league?.id,
      name: fixture.league?.name || '',
      logo: fixture.league?.logo || DEFAULT_FALLBACK_IMAGE,
      country: fixture.league?.country || '',
      flag: fixture.league?.flag || null,
      season: fixture.league?.season || new Date().getFullYear(),
      round: fixture.league?.round || ''
    },
    detail: {
      home: {
        teamId: `team-${homeTeam.id}`,
        name: homeTeam.name,
        logo: homeTeam.logo || DEFAULT_FALLBACK_IMAGE,
        goal: goals.home,
        halftime: score.halftime?.home ?? null,
        fulltime: score.fulltime?.home ?? null,
        extratime: score.extratime?.home ?? null,
        penalty: score.penalty?.home ?? null,
        winner: homeTeam.winner ?? null,
        form: getTeamForm(fixture.teams?.home),
        yellowCards: countCards(fixture.events, homeTeam.id, 'yellow'),
        redCards: countCards(fixture.events, homeTeam.id, 'red'),
        corners: fixture.statistics?.find(s => s.team.id === homeTeam.id)?.statistics?.find(st => st.type === 'Corner Kicks')?.value || 0
      },
      away: {
        teamId: `team-${awayTeam.id}`,
        name: awayTeam.name,
        logo: awayTeam.logo || DEFAULT_FALLBACK_IMAGE,
        goal: goals.away,
        halftime: score.halftime?.away ?? null,
        fulltime: score.fulltime?.away ?? null,
        extratime: score.extratime?.away ?? null,
        penalty: score.penalty?.away ?? null,
        winner: awayTeam.winner ?? null,
        form: getTeamForm(fixture.teams?.away),
        yellowCards: countCards(fixture.events, awayTeam.id, 'yellow'),
        redCards: countCards(fixture.events, awayTeam.id, 'red'),
        corners: fixture.statistics?.find(s => s.team.id === awayTeam.id)?.statistics?.find(st => st.type === 'Corner Kicks')?.value || 0
      }
    }
  };

  // Add bookmakers/odds if available
  if (useMockOdds) {
    match.bookmakers = getMockBookmakers(); // Use mock data for fast testing
  } else if (oddsData && oddsData.length > 0) {
    match.bookmakers = transformOdds(oddsData); // Use real API data
  } else {
    match.bookmakers = []; // No odds available
  }

  // Add statistics if available
  if (statsData && statsData.length > 0) {
    match.stats = transformStats(statsData);
  } else {
    match.stats = [];
  }

  return match;
}

/**
 * Extract round level from round string
 */
function extractRoundLevel(round) {
  if (!round) return 1;
  
  const match = round.match(/\d+/);
  return match ? parseInt(match[0]) : 1;
}

/**
 * Generate SEO-friendly slug
 */
function generateSlug(fixture) {
  const homeTeam = fixture.teams?.home?.name || '';
  const awayTeam = fixture.teams?.away?.name || '';
  const league = fixture.league?.name || '';
  const season = fixture.league?.season || '';
  const timestamp = new Date(fixture.fixture.date).getTime();
  
  const slug = `${fixture.league?.country}-${league}-${season}-${homeTeam}-${awayTeam}-${timestamp}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  return slug;
}

/**
 * Get team form
 */
function getTeamForm(team) {
  if (team?.form) {
    return team.form;
  }
  return 'unknown';
}

/**
 * Count yellow/red cards for a team
 */
function countCards(events, teamId, cardType) {
  if (!events || !Array.isArray(events)) return 0;

  return events.filter(event => {
    const isCorrectTeam = event.team?.id === teamId;
    const isCard = event.type === 'Card';
    const isCorrectCardType = cardType === 'yellow'
      ? event.detail === 'Yellow Card'
      : event.detail === 'Red Card';

    return isCorrectTeam && isCard && isCorrectCardType;
  }).length;
}

/**
 * Transform API-Sports events to frontend format
 * Maps time.elapsed to half and team.id to isHomeTeam
 */
function transformEvents(events, homeTeamId, awayTeamId) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return [];
  }

  return events.map(event => {
    // Determine which half based on elapsed time
    let half = 'first';
    const elapsed = event.time?.elapsed || 0;

    if (elapsed > 120) {
      half = 'penalty';
    } else if (elapsed > 90) {
      half = 'extra';
    } else if (elapsed > 45) {
      half = 'second';
    }

    // Determine if home team
    const isHomeTeam = event.team?.id === homeTeamId;

    // Map API-Sports event type to frontend type
    let frontendType = 'unknown';
    if (event.type === 'Goal') {
      if (event.detail === 'Normal Goal') {
        frontendType = 'goal';
      } else if (event.detail === 'Own Goal') {
        frontendType = 'own_goal';
      } else if (event.detail === 'Penalty') {
        frontendType = 'penalty';
      } else if (event.detail === 'Missed Penalty') {
        frontendType = 'missed_penalty';
      }
    } else if (event.type === 'Card') {
      if (event.detail === 'Yellow Card') {
        frontendType = 'yellow_card';
      } else if (event.detail === 'Red Card') {
        frontendType = 'red_card';
      } else if (event.detail === 'Yellow - Red Card') {
        frontendType = 'yellow_red_card';
      }
    } else if (event.type === 'subst') {
      frontendType = 'substitution';
    } else if (event.type === 'Var') {
      if (event.detail?.includes('Goal')) {
        frontendType = 'var_goal_cancelled';
      } else if (event.detail?.includes('Penalty')) {
        frontendType = 'var_penalty_confirmed';
      }
    }

    return {
      // Keep original API-Sports properties
      time: event.time,
      team: event.team,
      player: event.player,
      assist: event.assist,
      comments: event.comments,
      // Frontend-specific properties
      half,
      isHomeTeam,
      type: frontendType,
      timeMinute: elapsed,
      timeExtra: event.time?.extra || 0,
      details: {
        type: event.detail,
        score: null // Will be calculated dynamically in CustomHalf
      },
      playerNameAlt: event.player?.name || '',
      assistNameAlt: event.assist?.name || '',
      reason: event.comments || null,
      penaltyTurn: null // Used for penalty shootouts
    };
  });
}

/**
 * Transform odds data to frontend format
 * 🎯 GIỚI HẠN LOẠI KÈO TẠI ĐÂY
 */
function transformOdds(oddsData) {
  if (!oddsData || !Array.isArray(oddsData) || oddsData.length === 0) {
    return [];
  }

  const fixtureOdds = oddsData[0];
  if (!fixtureOdds || !fixtureOdds.bookmakers) {
    return [];
  }

  return fixtureOdds.bookmakers.map(bookmaker => {
    if (!bookmaker || !bookmaker.bets) return null;

    // ============================================
    // CÁCH 1: Lọc theo tên loại kèo cho phép
    // ============================================
    let filteredBets = bookmaker.bets.filter(bet => 
      ALLOWED_BET_TYPES.includes(bet.name)
    );

    // ============================================
    // CÁCH 2: Giới hạn số lượng kèo (uncomment để dùng)
    // ============================================
    // filteredBets = bookmaker.bets.slice(0, MAX_BETS_PER_BOOKMAKER);

    // ============================================
    // CÁCH 3: Kết hợp cả 2 (filter + limit)
    // ============================================
    // filteredBets = bookmaker.bets
    //   .filter(bet => ALLOWED_BET_TYPES.includes(bet.name))
    //   .slice(0, MAX_BETS_PER_BOOKMAKER);

    // Transform bets
    const bets = filteredBets.map(bet => {
      const values = (bet.values || []).map(v => ({
        value: v.value,
        odd: v.odd
      }));

      const opening = [...values];

      return {
        id: bet.id,                        // ✅ Include bet ID from API
        name: bet.name,                    // ✅ Include bet name from API
        type: mapBetType(bet.name),
        values: values,
        opening: opening
      };
    });

    // ============================================
    // Chỉ trả về bookmaker nếu có ít nhất 1 kèo
    // ============================================
    if (bets.length === 0) return null;

    return {
      id: bookmaker.id,                    // ✅ Include bookmaker ID from API
      name: bookmaker.name,
      bets: bets
    };
  }).filter(Boolean); // Loại bỏ bookmaker không có kèo
}

/**
 * Transform statistics data
 */
function transformStats(statsData) {
  if (!statsData || !Array.isArray(statsData) || statsData.length === 0) {
    return [];
  }

  const homeStats = statsData[0]?.statistics || [];
  const awayStats = statsData[1]?.statistics || [];

  return homeStats.map((stat, index) => ({
    type: stat.type.toLowerCase().replace(/\s+/g, '_'),
    home: stat.value,
    away: awayStats[index]?.value || null
  }));
}

module.exports = {
  transformToMatchFormat,
  mapFixtureStatus,
  transformOdds,
  transformStats,
  transformEvents,
  // Export để có thể config từ bên ngoài
  ALLOWED_BET_TYPES,
  MAX_BETS_PER_BOOKMAKER
};