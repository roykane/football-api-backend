// ========================================
// OPTIMIZED SOLUTION - Fixed Issues
// routes/matches.js
// ========================================

const express = require('express');
const router = express.Router();
const { transformToMatchFormat, transformOdds } = require('../utils/transformers');
const { POPULAR_LEAGUES, getFlagCode } = require('../data/leagues');
const { getAllowedLeagueIdsString, getAllowedLeagueIds, getHotLeagueIds, isLeagueExcluded, getExcludedLeagueIds } = require('../config/allowedCompetitions'); // OPTIMIZATION: League filtering
const oddsCache = require('../services/oddsCache'); // MongoDB cache service
const matchCache = require('../services/matchCache'); // MongoDB match cache service
const matchCacheService = require('../services/matchCacheService'); // MongoDB match cache service with cache-first strategy
const Odds = require('../models/Odds'); // MongoDB Odds model for direct queries

// Default fallback image for broken logos
const DEFAULT_FALLBACK_IMAGE = 'https://media.api-sports.io/football/teams/5297.png';

// ========================================
// HELPER FUNCTIONS - Reusable
// ========================================

/**
 * Get flag URL for a country with fallback support
 * Handle special cases like "World" and fallback to default image
 */
function getFlagUrlWithFallback(countryName, apiFlag) {
  // Priority 1: Use API-provided flag if available
  if (apiFlag) {
    return apiFlag;
  }

  // Priority 2: Use proper ISO country codes via getFlagCode
  const flagCode = getFlagCode(countryName);
  return `https://flagicons.lipis.dev/flags/4x3/${flagCode}.svg`;
}

/**
 * Build competition object from fixture
 */
function buildCompetitionObject(fixture, leagueData = {}) {
  const league = fixture.league;

  return {
    _id: `league-${league.id}`,
    code: league.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
    image: league.logo || DEFAULT_FALLBACK_IMAGE,
    name: league.name,
    seq: leagueData.seq || 1000,
    tier: leagueData.tier || 4,
    slug: league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    country: {
      _id: `country-${league.country}`,
      code: league.country === 'World' ? 'INT' : league.country.substring(0, 2).toUpperCase(),
      image: getFlagUrlWithFallback(league.country, league.flag),
      name: league.country,
      slug: league.country.toLowerCase().replace(/\s+/g, '-')
    },
    matches: []
  };
}

/**
 * Parse query parameters
 */
function parseQueryParams(query) {
  const {
    includeOdds = 'false', // ❌ DISABLED: Do not fetch odds by default (performance optimization)
    // Priority order: Bet365 (best coverage ~90%) → Pinnacle → SBO → 1xBet → 188Bet → others
    bookmakers = '8,9,1,11,18,6,16,29,7,13,31,10,5,3,28,12' // Prioritized by coverage & reliability
  } = query;

  return {
    shouldIncludeOdds: includeOdds === 'true',
    bookmakerIds: bookmakers.split(',').map(id => parseInt(id.trim()))
  };
}

/**
 * Paginate results
 */
function paginateResults(items, offset = 0, limit = 30) {
  const startIndex = parseInt(offset);
  const pageSize = parseInt(limit);
  const hasMore = (startIndex + pageSize) < items.length;
  
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    pagination: {
      total: items.length,
      offset: startIndex,
      limit: pageSize,
      hasMore
    }
  };
}

/**
 * Check if match status requires events/statistics data
 * Only LIVE matches need real-time events/statistics
 * FINISHED matches don't need updates (data is final)
 */
function needsEventsData(statusShort) {
  const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT', 'INT'];
  return LIVE_STATUSES.includes(statusShort);
}

/**
 * Fetch events for a fixture
 */
async function getEventsForFixture(footballApi, fixtureId) {
  try {
    const response = await footballApi.get('/fixtures/events', {
      params: { fixture: fixtureId }
    });
    return response.data.response || [];
  } catch (error) {
    console.error(`   ❌ Events fetch error for ${fixtureId}:`, error.message);
    return [];
  }
}

/**
 * Fetch statistics for a fixture
 */
async function getStatisticsForFixture(footballApi, fixtureId) {
  try {
    const response = await footballApi.get('/fixtures/statistics', {
      params: { fixture: fixtureId }
    });
    return response.data.response || [];
  } catch (error) {
    console.error(`   ❌ Statistics fetch error for ${fixtureId}:`, error.message);
    return [];
  }
}

/**
 * Extract cards data from statistics array
 * Returns { home: { yellowCards, redCards }, away: { yellowCards, redCards } }
 */
function extractCardsFromStatistics(statistics, homeTeamId, awayTeamId) {
  const defaultCards = { yellowCards: 0, redCards: 0 };

  if (!statistics || statistics.length === 0) {
    return { home: defaultCards, away: defaultCards };
  }

  const homeStats = statistics.find(s => s.team?.id === homeTeamId);
  const awayStats = statistics.find(s => s.team?.id === awayTeamId);

  const extractCards = (teamStats) => {
    if (!teamStats?.statistics) {
      return { yellowCards: 0, redCards: 0 };
    }

    const yellowStat = teamStats.statistics.find(st =>
      st.type?.toLowerCase()?.includes('yellow')
    );
    const redStat = teamStats.statistics.find(st =>
      st.type?.toLowerCase()?.includes('red')
    );

    return {
      yellowCards: parseInt(yellowStat?.value || 0),
      redCards: parseInt(redStat?.value || 0)
    };
  };

  return {
    home: extractCards(homeStats),
    away: extractCards(awayStats)
  };
}

/**
 * Fetch odds for a fixture from API-Sports
 * Note: Caching is handled at a higher level by MongoDB oddsCache service
 */
async function fetchOddsForFixture(footballApi, fixtureId, bookmakerIds = [8, 9, 1, 11, 18, 6, 16, 29, 7, 13, 31, 10, 5, 3, 28, 12]) {
  try {
    console.log(`🎰 Fetching odds for fixture ${fixtureId} from API...`);

    const oddsResponse = await footballApi.get('/odds', {
      params: { fixture: fixtureId }
    });

    let oddsData = oddsResponse.data?.response || [];

    if (oddsData.length === 0) {
      console.log(`   ⚠️  No odds available from API`);
      return [];
    }

    const allBookmakers = oddsData[0]?.bookmakers || [];
    console.log(`   📊 Found ${allBookmakers.length} bookmakers from API`);

    // Filter to requested bookmakers
    if (bookmakerIds && bookmakerIds.length > 0) {
      const filtered = allBookmakers.filter(b => bookmakerIds.includes(b.id));

      if (filtered.length > 0) {
        oddsData[0].bookmakers = filtered;
        console.log(`   ✅ Using ${filtered.length} requested bookmakers`);
      } else {
        console.log(`   ⚠️  Requested bookmakers not found, using all ${allBookmakers.length}`);
      }
    }

    return oddsData;

  } catch (error) {
    console.error(`❌ Odds fetch error for ${fixtureId}:`, error.message);
    if (error.response?.status === 403) {
      console.error('   403: Odds endpoint not available in your plan');
    }
    return [];
  }
}

/**
 * Fetch and transform fixtures - FIXED VERSION
 */
async function fetchFixtures(footballApi, params, includeOdds = false, bookmakerIds = [8, 9, 1, 11, 18, 6, 16, 29, 7, 13, 31, 10, 5, 3, 28, 12], maxLimit = 500) {
  try {
    let fixtures = [];

    // ✅ FIX: Smart date-based fetching
    if (params.date && !params.status && !params.live) {
      const queryDate = new Date(params.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      queryDate.setHours(0, 0, 0, 0);

      const isPastDate = queryDate < today;
      const isToday = queryDate.getTime() === today.getTime();
      const isFutureDate = queryDate > today;

      if (isPastDate) {
        // PAST DATE: Fetch FINISHED matches only
        console.log('📅 Past date query - fetching FINISHED matches only');
        const finishedResponse = await footballApi.get('/fixtures', {
          params: { ...params, status: 'FT' }
        });
        fixtures = finishedResponse.data.response || [];
        console.log(`   📥 Fetched ${fixtures.length} FINISHED matches`);

        // ❌ DISABLED: Do not fetch statistics (performance optimization)

      } else if (isToday) {
        // TODAY: Fetch LIVE + SCHEDULED + FINISHED matches
        console.log('📅 Today query - fetching LIVE + SCHEDULED + FINISHED matches');

        // Remove 'date' param for LIVE query to avoid conflict with live='all'
        const { date, ...paramsWithoutDate } = params;

        const [liveResponse, scheduledResponse, finishedResponse] = await Promise.all([
          footballApi.get('/fixtures', { params: { ...paramsWithoutDate, live: 'all' } }),
          footballApi.get('/fixtures', { params: { ...params, status: 'NS' } }),
          footballApi.get('/fixtures', { params: { ...params, status: 'FT' } })
        ]);

        const liveMatches = liveResponse.data.response || [];
        const scheduledMatches = scheduledResponse.data.response || [];
        const finishedMatches = finishedResponse.data.response || [];

        console.log(`   📥 Fetched ${liveMatches.length} LIVE + ${scheduledMatches.length} SCHEDULED + ${finishedMatches.length} FINISHED matches`);

        // ❌ DISABLED: Do not fetch statistics (performance optimization)

        // Combine and deduplicate
        const fixtureMap = new Map();
        [...liveMatches, ...scheduledMatches, ...finishedMatches].forEach(f => {
          fixtureMap.set(f.fixture.id, f);
        });
        fixtures = Array.from(fixtureMap.values());

      } else {
        // FUTURE DATE: Fetch SCHEDULED matches only
        console.log('📅 Future date query - fetching SCHEDULED matches only');
        const scheduledResponse = await footballApi.get('/fixtures', {
          params: { ...params, status: 'NS' }
        });
        fixtures = scheduledResponse.data.response || [];
        console.log(`   📥 Fetched ${fixtures.length} SCHEDULED matches`);
      }

    } else {
      // Query bình thường
      console.log('🔍 Calling API-Sports /fixtures with params:', JSON.stringify(params, null, 2));
      const response = await footballApi.get('/fixtures', { params });
      fixtures = response.data.response || [];
      console.log(`📥 Fetched ${fixtures.length} fixtures from API-Sports`);

      // ❌ DISABLED: Statistics fetching to save API quota
      // Statistics are not fetched to minimize API calls and avoid quota exhaustion
      // Corners and other statistics will return 0 for all matches
      console.log(`   ⚠️  Statistics fetching DISABLED to save API quota. Corners will be 0.`);

      /*
      // ✅ Fetch statistics for ALL finished matches (only if includeStatistics flag is enabled)
      if (includeStatistics) {
        const finishedFixtures = fixtures.filter(f => {
          const status = f.fixture?.status?.short;
          return ['FT', 'AET', 'PEN'].includes(status);
        });

        if (finishedFixtures.length > 0) {
          console.log(`   📊 Fetching statistics for ${finishedFixtures.length} finished matches...`);
          const BATCH_SIZE = 10;

          for (let i = 0; i < finishedFixtures.length; i += BATCH_SIZE) {
            const batch = finishedFixtures.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (fixture) => {
              try {
                const stats = await getStatisticsForFixture(footballApi, fixture.fixture.id);
                if (stats && stats.length > 0) {
                  fixture.statistics = stats;
                }
              } catch (error) {
                console.error(`   Failed to fetch statistics for ${fixture.fixture.id}:`, error.message);
              }
            }));

            const processed = Math.min(i + BATCH_SIZE, finishedFixtures.length);
            console.log(`   📊 Statistics progress: ${processed}/${finishedFixtures.length}`);
          }
        }
      } else {
        console.log(`   ⚠️  Statistics fetching disabled (includeStatistics=false). Corners will be 0.`);
      }
      */
    }

    // Limit fixtures to prevent "Invalid string length" error
    if (fixtures.length > maxLimit) {
      console.log(`   ⚠️  Fixtures count (${fixtures.length}) exceeds limit (${maxLimit}), slicing to ${maxLimit} fixtures`);
      fixtures = fixtures.slice(0, maxLimit);
    }

    if (fixtures.length === 0) {
      console.log('⚠️  No fixtures returned from API-Sports');
      return [];
    }

    // Group by league (preserve order from API-Sports)
    const groupedByLeague = {};
    const leagueOrder = [];
    
    // ✅ FIX: Store odds temporarily in fixtures before grouping
    const fixtureOddsMap = new Map();

    // First pass: Group fixtures (statistics will be fetched on-demand)
    console.log(`📊 Processing ${fixtures.length} fixtures...`);

    for (const fixture of fixtures) {
      const leagueId = fixture.league?.id;
      if (!leagueId) continue;

      // ✅ Skip excluded leagues (e.g., Friendlies)
      if (isLeagueExcluded(leagueId)) continue;

      // Create league group if not exists
      if (!groupedByLeague[leagueId]) {
        const leagueData = POPULAR_LEAGUES.find(l => l.id === leagueId) || {};
        groupedByLeague[leagueId] = buildCompetitionObject(fixture, leagueData);
        leagueOrder.push(leagueId);
      }

      // Transform match with statistics if available (finished matches have statistics)
      // For matches without statistics, they can be fetched on-demand via /api/matches/:id/statistics
      const match = transformToMatchFormat(fixture, [], fixture.statistics || [], false);
      match.bookmakers = []; // Will be populated later if needed
      groupedByLeague[leagueId].matches.push(match);
    }

    // ✅ FIX: Fetch odds BEFORE filtering
    if (includeOdds && fixtures.length > 0) {
      console.log(`🎰 Pre-fetching odds for ${fixtures.length} fixtures BEFORE filtering...`);
      
      const BATCH_SIZE = 10;
      let oddsProcessed = 0;
      
      for (let i = 0; i < fixtures.length; i += BATCH_SIZE) {
        const batch = fixtures.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (fixture) => {
          const fixtureId = fixture.fixture.id;
          try {
            // Fetch only requested bookmakers (faster!)
            const odds = await oddsCache.getOrFetchOdds(fixtureId, footballApi, fixture, bookmakerIds);
            if (odds && odds.length > 0) {
              fixtureOddsMap.set(fixtureId, odds);
            }
          } catch (error) {
            console.error(`   Failed to fetch odds for ${fixtureId}:`, error.message);
          }
        }));
        
        oddsProcessed = Math.min(i + BATCH_SIZE, fixtures.length);
        console.log(`   📊 Odds progress: ${oddsProcessed}/${fixtures.length}`);
      }
    }

    // Apply filters based on query type
    const isLiveOnlyQuery = params.live === 'all';
    const isDateQuery = params.date && !params.status && !params.live;
    const isSeasonQuery = params.season && params.league;

    const competitions = leagueOrder.map(id => {
      const comp = groupedByLeague[id];
      
      // ✅ Attach odds BEFORE filtering
      comp.matches.forEach(match => {
        const odds = fixtureOddsMap.get(match.id);
        if (odds) {
          match.bookmakers = odds;
        }
      });
      
      // Apply filters AFTER odds are attached
      const hasLive = comp.matches?.some(m => m.status === 'in_play');

      if (isLiveOnlyQuery && hasLive) {
        comp.matches = comp.matches.filter(m => m.status === 'in_play');
      }
      // Date queries: Keep ALL fetched matches (smart-fetching already handles the right status)
      // Season queries: Keep ALL matches (live, scheduled, finished)

      return comp;
    }).filter(comp => comp.matches.length > 0); // Remove empty competitions

    // Sort competitions by match status priority
    competitions.sort((a, b) => {
      const getStatusPriority = (comp) => {
        const hasLive = comp.matches?.some(m => m.status === 'in_play');
        const hasScheduled = comp.matches?.some(m => m.status === 'scheduled');
        const hasFinished = comp.matches?.some(m => m.status === 'finished');

        if (hasLive) return 0;
        if (hasScheduled) return 1;
        if (hasFinished) return 2;
        return 3;
      };

      const aPriority = getStatusPriority(a);
      const bPriority = getStatusPriority(b);

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aTime = a.matches?.[0]?.dateTime || '';
      const bTime = b.matches?.[0]?.dateTime || '';
      return aTime.localeCompare(bTime);
    });

    // ❌ DISABLED: Do not fetch events/statistics from MatchCache or real-time (performance optimization)
    console.log(`   ❌ Events/statistics fetch DISABLED (not fetching from cache or API)`);

    // Skip all MatchCache and events fetching
    // This includes:
    // - MatchCache lookups for FINISHED matches
    // - Real-time events/statistics for LIVE matches
    // All matches will only have basic fixture data without detailed events

    return competitions;
  } catch (error) {
    console.error('❌ Error fetching fixtures:', error.message);
    throw error;
  }
}

// ========================================
// ROUTES
// ========================================

/**
 * GET /api/matches/all
 */
router.get('/all', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    let { dateTime, status, offset = 0, limit = 30, league, competitionId, teamId, teamKeyword, seasonYear, groupByRound, sortByRound, hideFinished = 'false', round, roundRange, sortBy } = req.query;
    const { shouldIncludeOdds, bookmakerIds } = parseQueryParams(req.query);

    // Parse sortBy array (e.g., sortBy[]=topTier&sortBy[]=oddFirst&sortBy[]=latest)
    const sortByArray = Array.isArray(sortBy) ? sortBy : (sortBy ? [sortBy] : []);

    console.log(`   🎰 Odds config: shouldIncludeOdds=${shouldIncludeOdds}, bookmakerIds=[${bookmakerIds.join(',')}]`);

    const MAX_LIMIT = 200;
    limit = Math.min(parseInt(limit) || 30, MAX_LIMIT);
    const shouldHideFinished = hideFinished !== 'false'; // true by default, false only if explicitly set to 'false'

    // Parse round parameter
    let roundsToInclude = null;

    // Option 1: Single round (e.g., round=10)
    if (round) {
      const roundNum = parseInt(round);
      if (!isNaN(roundNum)) {
        roundsToInclude = [roundNum];
        console.log(`   🎯 Round filter: ${roundNum}`);
      }
    }
    // Option 2: Round range (e.g., roundRange=10-15)
    else if (roundRange) {
      const [start, end] = roundRange.split('-').map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        roundsToInclude = [];
        for (let i = start; i <= end; i++) {
          roundsToInclude.push(i);
        }
        console.log(`   🎯 Round range filter: ${start}-${end} → rounds [${roundsToInclude.join(', ')}]`);
      }
    }

    console.log('\n⚽ GET /api/matches/all');
    console.log(`   Params: date=${dateTime}, status=${status}, competitionId=${competitionId}, seasonYear=${seasonYear}, includeOdds=${shouldIncludeOdds}, hideFinished=${shouldHideFinished}, round=${round}, roundRange=${roundRange}, limit=${limit}`);

    const params = { timezone: 'Asia/Bangkok' };

    // Season-based fetching (for competition schedules)
    if (seasonYear && competitionId) {
      const leagueId = parseInt(competitionId.replace('league-', ''));
      params.league = leagueId;
      params.season = seasonYear;

      // ✅ STRATEGY: Always fetch ALL rounds, filter backend-side if needed
      if (roundsToInclude && roundsToInclude.length > 0) {
        console.log(`   📅 Fetching ALL rounds for season: league=${leagueId}, season=${seasonYear} (will filter to rounds ${roundsToInclude.join(', ')} later)`);
      } else {
        console.log(`   📅 Fetching ALL rounds for season: league=${leagueId}, season=${seasonYear}`);
      }
    } else if (dateTime) {
      params.date = new Date(dateTime).toISOString().split('T')[0];
    }

    // ✅ OPTIMIZATION: Apply league filtering to prevent showing uncached matches
    // Filter to allowed leagues to match what's cached by background workers

    const statusMap = {
      'scheduled': 'NS',
      'in_play': 'LIVE',
      'finished': 'FT',
      'postponed': 'PST',
      'cancelled': 'CANC',
      'abandoned': 'ABD',
      'not_played': 'AWA'
    };

    if (status && statusMap[status]) {
      params.status = statusMap[status];
      console.log(`   📌 Status filter: ${status} → ${statusMap[status]}`);
    } else if (!status && !dateTime && !seasonYear) {
      params.live = 'all';
      console.log('   ⚡ No status/date/season → defaulting to LIVE matches');
    }

    // Team filters
    let teamIdToFilter = null;
    let teamKeywordToFilter = null;

    if (teamKeyword) {
      teamKeywordToFilter = teamKeyword.trim().toLowerCase();
      console.log(`   🔍 Team keyword filter (post-fetch): "${teamKeyword}"`);
    } else if (teamId) {
      if (teamId.startsWith('team-')) {
        teamIdToFilter = parseInt(teamId.replace('team-', ''));
        params.team = teamIdToFilter;
        console.log(`   👥 Team filter (API-Sports): ${teamId} → team ${teamIdToFilter}`);
      } else if (/^[0-9a-fA-F]{24}$/.test(teamId)) {
        console.log(`   👥 Team filter (MongoDB ID): ${teamId} - will use post-fetch filtering`);
        teamIdToFilter = teamId;
      } else {
        teamIdToFilter = parseInt(teamId);
        params.team = teamIdToFilter;
        console.log(`   👥 Team filter (API-Sports): team ${teamIdToFilter}`);
      }
    }

    let leagueIdToFilter = null;
    if (competitionId) {
      leagueIdToFilter = parseInt(competitionId.replace('league-', ''));
      console.log(`   🏆 Competition filter (post-fetch): ${competitionId} → league ${leagueIdToFilter}`);
    } else if (league) {
      leagueIdToFilter = parseInt(league);
      console.log(`   🏆 League filter (post-fetch): ${leagueIdToFilter}`);
    }

    console.log('   🔍 API-Sports params:', JSON.stringify(params, null, 2));

    // Fetch all fixtures (will be filtered by round later if needed)
    let competitions;

    try {
      competitions = await fetchFixtures(footballApi, params, shouldIncludeOdds, bookmakerIds, 500);
    } catch (fetchError) {
      console.error('❌ Error fetching fixtures from API-Sports:', fetchError.message);

      // Return empty result instead of 500 error
      return res.json({
        timestamp: new Date().toISOString(),
        success: true,
        errorCode: 0,
        message: 'No matches found',
        data: {
          items: [],
          hasMore: false
        }
      });
    }

    // ❌ REMOVED LEAGUE FILTERING - Show ALL leagues
    // Previously filtered to only allowedLeagueIds, now showing all competitions
    console.log(`   ✅ Showing ALL leagues: ${competitions.length} competitions (no filter)`);

    // ✅ Filter out excluded competitions (e.g., Friendlies)
    const excludedLeagueIds = getExcludedLeagueIds();
    if (excludedLeagueIds.length > 0) {
      const beforeCount = competitions.length;
      competitions = competitions.filter(comp => {
        const compLeagueId = parseInt(comp._id.replace('league-', ''));
        return !isLeagueExcluded(compLeagueId);
      });
      const hiddenCount = beforeCount - competitions.length;
      if (hiddenCount > 0) {
        console.log(`   ✂️  Excluded ${hiddenCount} friendlies/exhibition competitions, ${competitions.length} remaining`);
      }
    }

    // Apply filters
    if (leagueIdToFilter) {
      competitions = competitions.filter(comp => {
        const compLeagueId = parseInt(comp._id.replace('league-', ''));
        return compLeagueId === leagueIdToFilter;
      });
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for league ${leagueIdToFilter}`);
    }

    if (teamIdToFilter && typeof teamIdToFilter === 'string' && /^[0-9a-fA-F]{24}$/.test(teamIdToFilter)) {
      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match =>
          match.homeTeam?._id === teamIdToFilter || match.awayTeam?._id === teamIdToFilter
        );
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for team ${teamIdToFilter}`);
    }

    if (teamKeywordToFilter) {
      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          const homeTeamName = match.detail?.home?.name?.toLowerCase() || '';
          const awayTeamName = match.detail?.away?.name?.toLowerCase() || '';
          return homeTeamName.includes(teamKeywordToFilter) || awayTeamName.includes(teamKeywordToFilter);
        });
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for team keyword "${teamKeywordToFilter}"`);
    }

    // ✅ Hide finished matches if requested
    if (shouldHideFinished) {
      // API returns normalized status values: 'in_play', 'scheduled', 'finished', 'postponed', 'cancelled', 'abandoned'
      const finishedStatuses = ['finished', 'postponed', 'cancelled', 'abandoned', 'suspended', 'interrupted'];

      let totalMatchesBefore = 0;
      let totalMatchesAfter = 0;

      competitions.forEach(comp => {
        totalMatchesBefore += comp.matches.length;
      });

      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          const matchStatus = match.status?.toLowerCase() || '';
          const isFinished = finishedStatuses.includes(matchStatus);
          return !isFinished;
        });
        totalMatchesAfter += filteredMatches.length;
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);

      console.log(`   ✂️  Hidden finished matches: ${totalMatchesBefore - totalMatchesAfter} matches hidden, ${competitions.length} competitions remaining`);
    }

    // ✅ Filter matches without odds (to avoid empty bookmakers in UI)
    if (shouldIncludeOdds) {
      let totalMatchesBefore = 0;
      let totalMatchesAfter = 0;

      competitions.forEach(comp => {
        totalMatchesBefore += comp.matches.length;
      });

      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          // Keep matches that have at least 1 bookmaker with odds
          return match.bookmakers && match.bookmakers.length > 0;
        });
        totalMatchesAfter += filteredMatches.length;
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);

      const hiddenCount = totalMatchesBefore - totalMatchesAfter;
      if (hiddenCount > 0) {
        console.log(`   ✂️  Hidden ${hiddenCount} matches without odds, ${competitions.length} competitions remaining`);
      }
    }

    // ✅ Filter by specific rounds if requested
    if (roundsToInclude && roundsToInclude.length > 0) {
      console.log(`   🎯 Backend filtering matches to rounds: ${roundsToInclude.join(', ')}`);

      let totalMatchesBefore = 0;
      let totalMatchesAfter = 0;

      competitions.forEach(comp => {
        totalMatchesBefore += comp.matches.length;
      });

      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          // Extract round number from round name (e.g., "Regular Season - 11" -> 11)
          const roundName = match.round || '';
          const roundMatch = roundName.match(/(\d+)/);
          if (roundMatch) {
            const roundNum = parseInt(roundMatch[1]);
            return roundsToInclude.includes(roundNum);
          }
          return false;
        });
        totalMatchesAfter += filteredMatches.length;
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);

      console.log(`   ✂️  Filtered to rounds ${roundsToInclude.join(', ')}: ${totalMatchesAfter} matches (from ${totalMatchesBefore}), ${competitions.length} competitions remaining`);
    }

    // ✅ SORTING: Apply sortBy parameter
    // sortBy options: topTier (giải lớn), oddFirst (có kèo), latest (mới nhất)
    if (sortByArray.length > 0) {
      console.log(`   🔀 Sorting by: ${sortByArray.join(' → ')}`);

      competitions.sort((a, b) => {
        for (const sortKey of sortByArray) {
          let comparison = 0;

          switch (sortKey) {
            case 'topTier':
              // Tier thấp hơn = giải lớn hơn (tier 1 > tier 2 > tier 3...)
              const tierA = a.tier || 999;
              const tierB = b.tier || 999;
              comparison = tierA - tierB;
              break;

            case 'oddFirst':
              // Đếm số trận có odds trong mỗi competition
              const oddsCountA = a.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
              const oddsCountB = b.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
              // Có nhiều odds hơn lên trước
              comparison = oddsCountB - oddsCountA;
              break;

            case 'latest':
              // Lấy thời gian trận sớm nhất trong competition
              const getEarliestTime = (comp) => {
                if (!comp.matches || comp.matches.length === 0) return Infinity;
                const times = comp.matches.map(m => new Date(m.startTime || m.date || 0).getTime());
                return Math.min(...times);
              };
              const timeA = getEarliestTime(a);
              const timeB = getEarliestTime(b);
              comparison = timeA - timeB; // Sớm hơn lên trước
              break;
          }

          if (comparison !== 0) return comparison;
        }
        return 0;
      });

      console.log(`   ✅ Sorted ${competitions.length} competitions`);
    }

    const { items, pagination } = paginateResults(competitions, offset, limit);

    // Group by rounds if requested
    if (groupByRound === 'true' && items.length > 0) {
      console.log(`\n📋 Grouping matches by rounds...`);

      const allMatches = [];
      for (const competition of items) {
        for (const match of competition.matches || []) {
          allMatches.push({ ...match, competition });
        }
      }

      const roundsMap = new Map();
      for (const match of allMatches) {
        const roundName = match.round || 'Unknown';
        if (!roundsMap.has(roundName)) {
          roundsMap.set(roundName, []);
        }
        roundsMap.get(roundName).push(match);
      }

      const extractRoundLevel = (roundName) => {
        const match = roundName.match(/(\d+)/);
        return match ? parseInt(match[1]) : 999;
      };

      let roundMatches = Array.from(roundsMap.entries()).map(([round, matches]) => ({
        roundLevel: extractRoundLevel(round),
        round: round.replace(' - ', ' '),
        matches
      }));

      // ✅ No need to filter rounds here - already filtered before grouping (line 821-847)

      if (sortByRound === 'asc') {
        roundMatches.sort((a, b) => a.roundLevel - b.roundLevel);
        console.log(`   ⬆️  Sorted by round (ascending)`);
      } else if (sortByRound === 'desc') {
        roundMatches.sort((a, b) => b.roundLevel - a.roundLevel);
        console.log(`   ⬇️  Sorted by round (descending)`);
      }

      console.log(`   ✅ Grouped into ${roundMatches.length} rounds with ${allMatches.length} total matches`);

      const groupedResponse = [{
        ...items[0],
        roundMatches
      }];

      return res.json({
        timestamp: new Date().toISOString(),
        success: true,
        errorCode: 0,
        message: 'Success',
        data: {
          items: groupedResponse,
          hasMore: false
        }
      });
    }

    console.log(`✅ Returning ${items.length} competitions\n`);

    res.json({
      timestamp: new Date().toISOString(),
      success: true,
      errorCode: 0,
      message: 'Success',
      data: {
        items,
        hasMore: pagination.hasMore
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch matches',
      message: error.message 
    });
  }
});

/**
 * GET /api/matches/live (MongoDB cached)
 */
router.get('/live', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const startTime = Date.now();
    let { offset = 0, limit = 30, competitionId, teamKeyword, sortBy } = req.query;
    const { shouldIncludeOdds, bookmakerIds } = parseQueryParams(req.query);

    // Parse sortBy array
    const sortByArray = Array.isArray(sortBy) ? sortBy : (sortBy ? [sortBy] : []);
    limit = parseInt(limit) || 30;

    console.log('\n🔴 GET /api/matches/live (MongoDB cached)');
    console.log(`   Params: competitionId=${competitionId}, teamKeyword=${teamKeyword}, includeOdds=${shouldIncludeOdds}, sortBy=${sortByArray.join('→')}, limit=${limit}`);

    // Define the fetch function that will be called on cache miss
    const fetchFn = async () => {
      const params = {
        timezone: 'Asia/Bangkok',
        live: 'all'
        // NOTE: No league filter on cache miss - let users see all live matches
        // Worker pre-caches allowed leagues, but endpoint allows flexibility
      };

      let leagueIdToFilter = null;
      if (competitionId) {
        leagueIdToFilter = parseInt(competitionId.replace('league-', ''));
        console.log(`   🏆 Competition filter (post-fetch): ${competitionId} → league ${leagueIdToFilter}`);
      }

      let teamKeywordToFilter = null;
      if (teamKeyword) {
        teamKeywordToFilter = teamKeyword.trim().toLowerCase();
        console.log(`   🔍 Team keyword filter (post-fetch): "${teamKeyword}"`);
      }

      let competitions = await fetchFixtures(footballApi, params, shouldIncludeOdds, bookmakerIds, 500);

      // ❌ REMOVED LEAGUE FILTERING - Show ALL leagues
      // Previously filtered to only allowedLeagueIds, now showing all competitions
      console.log(`   ✅ Showing ALL leagues: ${competitions.length} competitions (no filter)`);

      // ✅ Filter out excluded competitions (e.g., Friendlies)
      const excludedIds = getExcludedLeagueIds();
      if (excludedIds.length > 0) {
        const beforeCount = competitions.length;
        competitions = competitions.filter(comp => {
          const compLeagueId = parseInt(comp._id.replace('league-', ''));
          return !isLeagueExcluded(compLeagueId);
        });
        const hiddenCount = beforeCount - competitions.length;
        if (hiddenCount > 0) {
          console.log(`   ✂️  Excluded ${hiddenCount} friendlies/exhibition competitions, ${competitions.length} remaining`);
        }
      }

      if (leagueIdToFilter) {
        competitions = competitions.filter(comp => {
          const compLeagueId = parseInt(comp._id.replace('league-', ''));
          return compLeagueId === leagueIdToFilter;
        });
        console.log(`   ✂️  Filtered to ${competitions.length} competitions for league ${leagueIdToFilter}`);
      }

      if (teamKeywordToFilter) {
        competitions = competitions.map(comp => {
          const filteredMatches = comp.matches.filter(match => {
            const homeTeamName = match.detail?.home?.name?.toLowerCase() || '';
            const awayTeamName = match.detail?.away?.name?.toLowerCase() || '';
            return homeTeamName.includes(teamKeywordToFilter) || awayTeamName.includes(teamKeywordToFilter);
          });
          return { ...comp, matches: filteredMatches };
        }).filter(comp => comp.matches.length > 0);
        console.log(`   ✂️  Filtered to ${competitions.length} competitions for team keyword "${teamKeywordToFilter}"`);
      }

      return {
        items: competitions,
        hasMore: false
      };
    };

    // Use cache-first strategy
    const result = await matchCacheService.getLive({}, fetchFn);
    const cachedData = result.data;

    // Apply filters to cached data if provided
    let competitions = cachedData.items || [];

    // ✅ Filter out excluded competitions (e.g., Friendlies) from cached data
    competitions = competitions.filter(comp => {
      const compLeagueId = parseInt(comp._id.replace('league-', ''));
      return !isLeagueExcluded(compLeagueId);
    });

    if (competitionId) {
      const leagueIdToFilter = parseInt(competitionId.replace('league-', ''));
      competitions = competitions.filter(comp => {
        const compLeagueId = parseInt(comp._id.replace('league-', ''));
        return compLeagueId === leagueIdToFilter;
      });
    }

    if (teamKeyword) {
      const teamKeywordToFilter = teamKeyword.trim().toLowerCase();
      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          const homeTeamName = match.detail?.home?.name?.toLowerCase() || '';
          const awayTeamName = match.detail?.away?.name?.toLowerCase() || '';
          return homeTeamName.includes(teamKeywordToFilter) || awayTeamName.includes(teamKeywordToFilter);
        });
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);
    }

    // ✅ SORTING: Apply sortBy parameter for live matches
    if (sortByArray.length > 0) {
      console.log(`   🔀 Sorting live by: ${sortByArray.join(' → ')}`);
      competitions.sort((a, b) => {
        for (const sortKey of sortByArray) {
          let comparison = 0;
          switch (sortKey) {
            case 'topTier':
              comparison = (a.tier || 999) - (b.tier || 999);
              break;
            case 'oddFirst':
              const oddsCountA = a.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
              const oddsCountB = b.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
              comparison = oddsCountB - oddsCountA;
              break;
            case 'latest':
              const getEarliestTime = (comp) => {
                if (!comp.matches || comp.matches.length === 0) return Infinity;
                const times = comp.matches.map(m => new Date(m.startTime || m.date || 0).getTime());
                return Math.min(...times);
              };
              comparison = getEarliestTime(a) - getEarliestTime(b);
              break;
          }
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    }

    // Apply pagination
    const { items, pagination } = paginateResults(competitions, offset, limit);

    const duration = Date.now() - startTime;
    const cacheStatus = result.fromCache ? '💾 CACHE' : '📡 API';
    console.log(`✅ ${cacheStatus} Returning ${items.length} live competitions (${duration}ms)\n`);

    res.json({
      items,
      hasMore: pagination.hasMore
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live matches',
      message: error.message
    });
  }
});

/**
 * GET /api/matches/hot - FIXED VERSION
 * Get hot/featured matches from top 5 leagues (filter from today's matches)
 */
router.get('/hot', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { offset = 0, limit = 10, hideWithoutOdds = 'false', sortBy } = req.query;
    const { shouldIncludeOdds, bookmakerIds } = parseQueryParams(req.query);
    const shouldHideWithoutOdds = hideWithoutOdds === 'true';

    // Parse sortBy array
    const sortByArray = Array.isArray(sortBy) ? sortBy : (sortBy ? [sortBy] : []);

    console.log('\n🔥 GET /api/matches/hot (MongoDB optimized)');
    console.log(`   🎰 Odds config: shouldIncludeOdds=${shouldIncludeOdds}, hideWithoutOdds=${shouldHideWithoutOdds}, sortBy=${sortByArray.join('→')}, bookmakerIds=[${bookmakerIds.join(',')}]`);
    const startTime = Date.now();

    // OPTIMIZATION: Get TOP leagues (major European + international competitions)
    const topLeagues = [
      39,  // Premier League
      140, // La Liga
      135, // Serie A
      78,  // Bundesliga
      61,  // Ligue 1
      2,   // UEFA Champions League
      3,   // UEFA Europa League
      94,  // Primeira Liga (Portugal)
      88,  // Eredivisie (Netherlands)
      262, // Liga MX (Mexico)
    ];
    const hotLeagueIds = topLeagues;

    const now = new Date();
    const MIN_COMPETITIONS = 5; // Cố gắng có ít nhất 5 giải đấu
    const MAX_DAYS_AHEAD = 4; // ✅ OPTIMIZED: Tìm trong 4 ngày (matching worker)

    console.log(`   🎯 OPTIMIZATION: Querying MongoDB for ${hotLeagueIds.length} hot leagues...`);

    let allMatches = [];
    let daysChecked = 0;

    // Lặp qua từng ngày để tìm đủ 3 giải đấu
    while (daysChecked <= MAX_DAYS_AHEAD) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + daysChecked);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      console.log(`   📅 Checking day ${daysChecked}: ${startDate.toISOString().split('T')[0]}`);

      // Query matches cho ngày này
      const dayMatches = await Odds.find({
        leagueId: { $in: hotLeagueIds },
        matchDate: { $gte: startDate, $lt: endDate },
        matchStatus: { $in: ['live', 'scheduled'] },
        expiresAt: { $gt: new Date() }
      })
      .sort({
        matchStatus: -1, // live first
        matchDate: 1
      })
      .lean();

      console.log(`      Found ${dayMatches.length} matches`);
      allMatches = [...allMatches, ...dayMatches];

      // Group để đếm số giải đấu
      const uniqueLeagues = new Set(allMatches.map(m => m.leagueId));
      console.log(`      Total competitions so far: ${uniqueLeagues.size}`);

      // Nếu đã có đủ 3 giải đấu, dừng lại
      if (uniqueLeagues.size >= MIN_COMPETITIONS) {
        console.log(`   ✅ Found enough competitions (${uniqueLeagues.size} >= ${MIN_COMPETITIONS})`);
        break;
      }

      daysChecked++;
    }

    console.log(`   ✅ Total: ${allMatches.length} matches from ${new Set(allMatches.map(m => m.leagueId)).size} competitions`);

    // ✅ FALLBACK: If cache is empty, fetch from API-Sports real-time
    if (allMatches.length === 0) {
      console.log(`   ⚠️  No matches found in cache, falling back to API-Sports real-time...`);

      try {
        const footballApi = req.app.locals.footballApi;
        const today = new Date();
        const currentYear = today.getFullYear();

        // ✅ Determine current season (if month >= August, use current year, else previous year)
        const currentSeason = today.getMonth() >= 7 ? currentYear : currentYear - 1;

        // ✅ OPTIMIZED: Calculate 4-day window
        const fromDate = new Date();
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + MAX_DAYS_AHEAD);
        toDate.setHours(23, 59, 59, 999);

        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr = toDate.toISOString().split('T')[0];

        // Fetch upcoming matches from each league within 4-day window
        console.log(`   🌐 Fetching real-time matches for ${hotLeagueIds.length} leagues from API-Sports (${fromStr} to ${toStr})...`);

        const leaguePromises = hotLeagueIds.map(leagueId =>
          footballApi.get('/fixtures', {
            params: {
              league: leagueId,
              season: currentSeason,
              from: fromStr, // ✅ OPTIMIZED: Use date range instead of 'next'
              to: toStr,     // ✅ OPTIMIZED: Limit to 4 days
              timezone: 'UTC'
            }
          }).then(response => ({
            leagueId,
            season: currentSeason,
            fixtures: response.data.response || []
          })).catch(err => {
            console.error(`   ❌ Failed to fetch league ${leagueId} (season ${currentSeason}):`, err.message);
            return { leagueId, season: currentSeason, fixtures: [] };
          })
        )

        const leagueResults = await Promise.all(leaguePromises);

        // Flatten all fixtures and filter for live/scheduled only
        const realTimeFixtures = leagueResults.flatMap(result =>
          result.fixtures.filter(fixture => {
            const status = fixture.fixture?.status?.short || '';
            // Only include live and scheduled matches (exclude finished)
            return ['NS', 'LIVE', '1H', '2H', 'HT', 'ET', 'P', 'SUSP', 'INT', 'TBD'].includes(status);
          })
        );

        console.log(`   ✅ Found ${realTimeFixtures.length} real-time matches from API-Sports`);

        if (realTimeFixtures.length === 0) {
          console.log(`   ⚠️  No live/scheduled matches found from API-Sports either`);
          return res.json({
            items: [],
            hasMore: false
          });
        }

        // Group by league
        const groupedByLeague = {};
        const leagueOrder = [];

        // Fetch statistics for live/finished matches to get cards data
        const liveFixtureIds = realTimeFixtures
          .filter(f => {
            const status = f.fixture?.status?.short || '';
            return ['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'FT', 'AET', 'PEN'].includes(status);
          })
          .map(f => f.fixture?.id)
          .filter(Boolean);

        console.log(`   📊 Fetching statistics for ${liveFixtureIds.length} live/finished matches...`);

        // Fetch statistics in parallel (limited batch to avoid overwhelming API)
        const statisticsMap = new Map();
        if (liveFixtureIds.length > 0) {
          const statsBatches = [];
          for (let i = 0; i < Math.min(liveFixtureIds.length, 10); i++) {
            statsBatches.push(
              getStatisticsForFixture(footballApi, liveFixtureIds[i])
                .then(stats => ({ fixtureId: liveFixtureIds[i], stats }))
            );
          }
          const statsResults = await Promise.all(statsBatches);
          statsResults.forEach(({ fixtureId, stats }) => {
            if (stats && stats.length > 0) {
              statisticsMap.set(fixtureId, stats);
            }
          });
          console.log(`   ✅ Fetched statistics for ${statisticsMap.size}/${liveFixtureIds.length} matches`);
        }

        // ✅ Fetch odds if requested
        const fixtureOddsMap = new Map();
        if (shouldIncludeOdds && realTimeFixtures.length > 0) {
          console.log(`   🎰 Fetching odds for ${realTimeFixtures.length} fixtures...`);

          const BATCH_SIZE = 10;
          for (let i = 0; i < realTimeFixtures.length; i += BATCH_SIZE) {
            const batch = realTimeFixtures.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (fixture) => {
              const fixtureId = fixture.fixture.id;
              try {
                const odds = await oddsCache.getOrFetchOdds(fixtureId, footballApi, fixture, bookmakerIds);
                if (odds && odds.length > 0) {
                  fixtureOddsMap.set(fixtureId, odds);
                }
              } catch (error) {
                console.error(`   Failed to fetch odds for ${fixtureId}:`, error.message);
              }
            }));

            const processed = Math.min(i + BATCH_SIZE, realTimeFixtures.length);
            console.log(`   📊 Odds progress: ${processed}/${realTimeFixtures.length}`);
          }

          console.log(`   ✅ Fetched odds for ${fixtureOddsMap.size}/${realTimeFixtures.length} fixtures`);
        }

        for (const fixture of realTimeFixtures) {
          const leagueId = fixture.league?.id;
          if (!leagueId) continue;

          // ✅ Skip excluded leagues (e.g., Friendlies)
          if (isLeagueExcluded(leagueId)) continue;

          if (!groupedByLeague[leagueId]) {
            const leagueData = POPULAR_LEAGUES.find(l => l.id === leagueId) || {};
            groupedByLeague[leagueId] = buildCompetitionObject(fixture, leagueData);
            leagueOrder.push(leagueId);
          }

          // Map API status to normalized status
          const statusShort = fixture.fixture?.status?.short || 'NS';
          const statusMap = {
            'NS': 'scheduled',
            'TBD': 'scheduled',
            '1H': 'in_play',
            'HT': 'in_play',
            '2H': 'in_play',
            'ET': 'in_play',
            'P': 'in_play',
            'LIVE': 'in_play',
            'SUSP': 'in_play',
            'INT': 'in_play'
          };

          // Extract cards from statistics if available
          const fixtureStats = statisticsMap.get(fixture.fixture?.id);
          const cards = fixtureStats
            ? extractCardsFromStatistics(fixtureStats, fixture.teams?.home?.id, fixture.teams?.away?.id)
            : { home: { yellowCards: 0, redCards: 0 }, away: { yellowCards: 0, redCards: 0 } };

          // Generate slug with timestamp
          const timestamp = fixture.fixture?.timestamp * 1000;
          const slugBase = `${fixture.teams?.home?.name || 'home'}-vs-${fixture.teams?.away?.name || 'away'}`.toLowerCase().replace(/\s+/g, '-');
          const slugWithTimestamp = `${slugBase}-${timestamp}`;

          const match = {
            id: fixture.fixture?.id,
            fixtureId: fixture.fixture?.id, // ✅ Add fixtureId for detail endpoint
            name: `${fixture.teams?.home?.name || 'Home'} vs ${fixture.teams?.away?.name || 'Away'}`,
            slug: slugWithTimestamp, // ✅ Use slug with timestamp
            dateTime: new Date(timestamp).toISOString(),
            status: statusMap[statusShort] || 'scheduled',
            statusCode: statusShort,
            competition: {
              _id: `league-${leagueId}`,
              name: fixture.league?.name || 'Competition',
              logo: fixture.league?.logo || DEFAULT_FALLBACK_IMAGE
            },
            detail: {
              home: {
                id: fixture.teams?.home?.id || 0,
                name: fixture.teams?.home?.name || 'Home Team',
                logo: fixture.teams?.home?.logo || DEFAULT_FALLBACK_IMAGE,
                goal: fixture.goals?.home,
                halftime: fixture.score?.halftime?.home,
                fulltime: fixture.score?.fulltime?.home,
                yellowCards: cards.home.yellowCards,
                redCards: cards.home.redCards,
                winner: fixture.teams?.home?.winner
              },
              away: {
                id: fixture.teams?.away?.id || 0,
                name: fixture.teams?.away?.name || 'Away Team',
                logo: fixture.teams?.away?.logo || DEFAULT_FALLBACK_IMAGE,
                goal: fixture.goals?.away,
                halftime: fixture.score?.halftime?.away,
                fulltime: fixture.score?.fulltime?.away,
                yellowCards: cards.away.yellowCards,
                redCards: cards.away.redCards,
                winner: fixture.teams?.away?.winner
              }
            },
            events: [],
            bookmakers: fixtureOddsMap.get(fixture.fixture?.id) || []
          };

          groupedByLeague[leagueId].matches.push(match);
        }

        // Convert to array
        let competitions = leagueOrder.map(id => {
          const comp = groupedByLeague[id];

          // Sort matches: LIVE first, then SCHEDULED
          if (comp.matches) {
            comp.matches.sort((a, b) => {
              const statusPriority = { 'in_play': 0, 'scheduled': 1 };
              const aPriority = statusPriority[a.status] ?? 2;
              const bPriority = statusPriority[b.status] ?? 2;

              if (aPriority !== bPriority) return aPriority - bPriority;

              return (a.dateTime || '').localeCompare(b.dateTime || '');
            });
          }

          return comp;
        });

        // Sort competitions by priority: LIVE > SCHEDULED
        competitions.sort((a, b) => {
          const getPriority = (comp) => {
            const hasLive = comp.matches?.some(m => m.status === 'in_play');
            const hasScheduled = comp.matches?.some(m => m.status === 'scheduled');

            if (hasLive) return 0;
            if (hasScheduled) return 1;
            return 2;
          };

          const aPriority = getPriority(a);
          const bPriority = getPriority(b);

          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }

          const aTime = a.matches?.[0]?.dateTime || '';
          const bTime = b.matches?.[0]?.dateTime || '';
          return aTime.localeCompare(bTime);
        });

        // ✅ Filter matches without odds (OPTIONAL - only if hideWithoutOdds=true)
        if (shouldIncludeOdds && shouldHideWithoutOdds) {
          let totalMatchesBefore = 0;
          let totalMatchesAfter = 0;

          competitions.forEach(comp => {
            totalMatchesBefore += comp.matches.length;
          });

          competitions = competitions.map(comp => {
            const filteredMatches = comp.matches.filter(match => {
              return match.bookmakers && match.bookmakers.length > 0;
            });
            totalMatchesAfter += filteredMatches.length;
            return { ...comp, matches: filteredMatches };
          }).filter(comp => comp.matches.length > 0);

          const hiddenCount = totalMatchesBefore - totalMatchesAfter;
          if (hiddenCount > 0) {
            console.log(`   ✂️  Hidden ${hiddenCount} matches without odds (fallback path)`);
          } else {
            console.log(`   ✅ All ${totalMatchesAfter} matches have odds`);
          }
        }

        // ✅ SORTING for fallback case
        if (sortByArray.length > 0) {
          console.log(`   🔀 Sorting hot (fallback) by: ${sortByArray.join(' → ')}`);
          competitions.sort((a, b) => {
            for (const sortKey of sortByArray) {
              let comparison = 0;
              switch (sortKey) {
                case 'topTier':
                  comparison = (a.tier || 999) - (b.tier || 999);
                  break;
                case 'oddFirst':
                  const oddsCountA = a.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
                  const oddsCountB = b.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
                  comparison = oddsCountB - oddsCountA;
                  break;
                case 'latest':
                  const getEarliestTime = (comp) => {
                    if (!comp.matches || comp.matches.length === 0) return Infinity;
                    const times = comp.matches.map(m => new Date(m.startTime || m.date || 0).getTime());
                    return Math.min(...times);
                  };
                  comparison = getEarliestTime(a) - getEarliestTime(b);
                  break;
              }
              if (comparison !== 0) return comparison;
            }
            return 0;
          });
        }

        const { items, pagination } = paginateResults(competitions, offset, limit);

        const duration = Date.now() - startTime;
        console.log(`✅ Returning ${items.length} hot competitions (${duration}ms from API-Sports real-time)\n`);

        return res.json({
          items,
          hasMore: pagination.hasMore
        });

      } catch (fallbackError) {
        console.error('❌ Fallback error:', fallbackError.message);
        return res.json({
          items: [],
          hasMore: false
        });
      }
    }

    const cachedMatches = allMatches;

    // Fetch statistics for live/finished matches to get cards data
    const liveFixtureIds = cachedMatches
      .filter(doc => doc.matchStatus === 'live' || doc.matchStatus === 'finished')
      .map(doc => doc.fixtureId)
      .filter(Boolean);

    console.log(`   📊 Fetching statistics for ${liveFixtureIds.length} live/finished matches from cache...`);

    // Fetch statistics in parallel (limited batch to avoid overwhelming API)
    const statisticsMap = new Map();
    if (liveFixtureIds.length > 0) {
      const footballApi = req.app.locals.footballApi;
      const statsBatches = [];
      for (let i = 0; i < Math.min(liveFixtureIds.length, 10); i++) {
        statsBatches.push(
          getStatisticsForFixture(footballApi, liveFixtureIds[i])
            .then(stats => ({ fixtureId: liveFixtureIds[i], stats }))
        );
      }
      const statsResults = await Promise.all(statsBatches);
      statsResults.forEach(({ fixtureId, stats }) => {
        if (stats && stats.length > 0) {
          statisticsMap.set(fixtureId, stats);
        }
      });
      console.log(`   ✅ Fetched statistics for ${statisticsMap.size}/${liveFixtureIds.length} cached matches`);
    }

    // Group matches by league
    const groupedByLeague = {};
    const leagueOrder = [];

    for (const oddsDoc of cachedMatches) {
      const leagueId = oddsDoc.leagueId;

      // ✅ Skip excluded leagues (e.g., Friendlies)
      if (isLeagueExcluded(leagueId)) continue;

      if (!groupedByLeague[leagueId]) {
        const leagueData = POPULAR_LEAGUES.find(l => l.id === leagueId) || {};

        groupedByLeague[leagueId] = {
          _id: `league-${leagueId}`,
          code: (oddsDoc.leagueName || '').substring(0, 7).toUpperCase().replace(/\s/g, ''),
          image: leagueData.logo || DEFAULT_FALLBACK_IMAGE,
          name: oddsDoc.leagueName || `League ${leagueId}`,
          seq: leagueData.seq || 1000,
          tier: leagueData.tier || 4,
          slug: (oddsDoc.leagueName || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          country: {
            _id: `country-${leagueData.country || 'Unknown'}`,
            code: leagueData.country === 'World' ? 'INT' : (leagueData.country || 'XX').substring(0, 2).toUpperCase(),
            image: leagueData.flag || DEFAULT_FALLBACK_IMAGE,
            name: leagueData.country || 'Unknown',
            slug: (leagueData.country || 'unknown').toLowerCase().replace(/\s+/g, '-')
          },
          matches: []
        };
        leagueOrder.push(leagueId);
      }

      const statusMap = {
        'live': 'in_play',
        'scheduled': 'scheduled',
        'finished': 'finished',
        'postponed': 'postponed',
        'cancelled': 'cancelled'
      };

      // Extract cards from statistics if available
      const fixtureStats = statisticsMap.get(oddsDoc.fixtureId);
      const cards = fixtureStats
        ? extractCardsFromStatistics(fixtureStats, oddsDoc.homeTeam?.id, oddsDoc.awayTeam?.id)
        : { home: { yellowCards: 0, redCards: 0 }, away: { yellowCards: 0, redCards: 0 } };

      const leagueData = POPULAR_LEAGUES.find(l => l.id === leagueId) || {};

      const match = {
        id: oddsDoc.fixtureId,
        name: `${oddsDoc.homeTeam?.name || 'Home'} vs ${oddsDoc.awayTeam?.name || 'Away'}`,
        slug: `${oddsDoc.homeTeam?.name || 'home'}-vs-${oddsDoc.awayTeam?.name || 'away'}`.toLowerCase().replace(/\s+/g, '-'),
        dateTime: oddsDoc.matchDate?.toISOString() || new Date().toISOString(),
        status: statusMap[oddsDoc.matchStatus] || oddsDoc.matchStatus,
        statusCode: oddsDoc.matchStatus === 'live' ? 'LIVE' : 'NS',
        competition: {
          _id: `league-${leagueId}`,
          name: oddsDoc.leagueName || `League ${leagueId}`,
          logo: leagueData.logo || DEFAULT_FALLBACK_IMAGE
        },
        detail: {
          home: {
            id: oddsDoc.homeTeam?.id || 0,
            name: oddsDoc.homeTeam?.name || 'Home Team',
            logo: oddsDoc.homeTeam?.logo || DEFAULT_FALLBACK_IMAGE,
            goal: null,
            halftime: null,
            fulltime: null,
            yellowCards: cards.home.yellowCards,
            redCards: cards.home.redCards,
            winner: null
          },
          away: {
            id: oddsDoc.awayTeam?.id || 0,
            name: oddsDoc.awayTeam?.name || 'Away Team',
            logo: oddsDoc.awayTeam?.logo || DEFAULT_FALLBACK_IMAGE,
            goal: null,
            halftime: null,
            fulltime: null,
            yellowCards: cards.away.yellowCards,
            redCards: cards.away.redCards,
            winner: null
          }
        },
        events: [],
        // Transform bookmakers to ensure 'type' field exists for frontend compatibility
        bookmakers: oddsDoc.bookmakers && oddsDoc.bookmakers.length > 0
          ? transformOdds([{ bookmakers: oddsDoc.bookmakers }])
          : []
      };

      groupedByLeague[leagueId].matches.push(match);
    }

    // Convert to array
    let competitions = leagueOrder.map(id => {
      const comp = groupedByLeague[id];

      // Sort matches: LIVE first, then SCHEDULED
      if (comp.matches) {
        comp.matches.sort((a, b) => {
          const statusPriority = { 'in_play': 0, 'scheduled': 1 };
          const aPriority = statusPriority[a.status] ?? 2;
          const bPriority = statusPriority[b.status] ?? 2;

          if (aPriority !== bPriority) return aPriority - bPriority;

          return (a.dateTime || '').localeCompare(b.dateTime || '');
        });
      }

      return comp;
    });

    // Sort competitions by priority: LIVE > SCHEDULED
    competitions.sort((a, b) => {
      const getPriority = (comp) => {
        const hasLive = comp.matches?.some(m => m.status === 'in_play');
        const hasScheduled = comp.matches?.some(m => m.status === 'scheduled');

        if (hasLive) return 0;
        if (hasScheduled) return 1;
        return 2;
      };

      const aPriority = getPriority(a);
      const bPriority = getPriority(b);

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aTime = a.matches?.[0]?.dateTime || '';
      const bTime = b.matches?.[0]?.dateTime || '';
      return aTime.localeCompare(bTime);
    });

    // ✅ Filter matches without odds (OPTIONAL - only if hideWithoutOdds=true)
    if (shouldIncludeOdds && shouldHideWithoutOdds) {
      let totalMatchesBefore = 0;
      let totalMatchesAfter = 0;

      competitions.forEach(comp => {
        totalMatchesBefore += comp.matches.length;
      });

      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          return match.bookmakers && match.bookmakers.length > 0;
        });
        totalMatchesAfter += filteredMatches.length;
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);

      const hiddenCount = totalMatchesBefore - totalMatchesAfter;
      if (hiddenCount > 0) {
        console.log(`   ✂️  Hidden ${hiddenCount} matches without odds (cache path)`);
      } else {
        console.log(`   ✅ All ${totalMatchesAfter} matches have odds from cache`);
      }
    }

    // ✅ SORTING for cached case
    if (sortByArray.length > 0) {
      console.log(`   🔀 Sorting hot (cache) by: ${sortByArray.join(' → ')}`);
      competitions.sort((a, b) => {
        for (const sortKey of sortByArray) {
          let comparison = 0;
          switch (sortKey) {
            case 'topTier':
              comparison = (a.tier || 999) - (b.tier || 999);
              break;
            case 'oddFirst':
              const oddsCountA = a.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
              const oddsCountB = b.matches.filter(m => m.bookmakers && m.bookmakers.length > 0).length;
              comparison = oddsCountB - oddsCountA;
              break;
            case 'latest':
              const getEarliestTime = (comp) => {
                if (!comp.matches || comp.matches.length === 0) return Infinity;
                const times = comp.matches.map(m => new Date(m.startTime || m.date || 0).getTime());
                return Math.min(...times);
              };
              comparison = getEarliestTime(a) - getEarliestTime(b);
              break;
          }
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    }

    const { items, pagination } = paginateResults(competitions, offset, limit);

    const duration = Date.now() - startTime;
    console.log(`✅ Returning ${items.length} hot competitions (${duration}ms from MongoDB cache)\n`);

    res.json({
      items,
      hasMore: pagination.hasMore
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hot matches',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/:id/detail
// Get match detail by slug or numeric ID
// ========================================
router.get('/:id/detail', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;

    console.log(`\n🔍 GET /api/matches/:id/detail`);
    console.log(`   Requested ID/Slug: ${id}`);

    let fixtureId = null;
    let matchDate = null;

    // Try to parse as numeric ID first
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      console.log(`   📊 Using numeric fixture ID: ${numericId}`);
      fixtureId = numericId;
    } else {
      // Try to extract timestamp from slug
      console.log(`   📊 Parsing slug to extract timestamp`);

      // Slug format: {competition}-{team1}-{team2}-{timestamp}
      // Example: indonesia-liga-2-2025-persiku-kudus-psis-semarang-1762849800000
      const parts = id.split('-');
      const lastPart = parts[parts.length - 1];
      const timestamp = parseInt(lastPart);

      if (!isNaN(timestamp) && timestamp > 1000000000000) {
        const date = new Date(timestamp);
        matchDate = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        console.log(`   📅 Extracted date: ${matchDate} from timestamp ${timestamp}`);
      } else {
        console.log(`   ❌ Invalid slug format`);
        return res.status(400).json({
          success: false,
          error: 'Invalid slug format',
          message: `Slug must end with a valid timestamp`
        });
      }
    }

    // Fetch from API-Sports
    if (fixtureId) {
      // Fetch by fixture ID
      console.log(`   📥 Fetching fixture ${fixtureId} from API-Sports...`);
      const response = await footballApi.get('/fixtures', {
        params: {
          id: fixtureId,
          timezone: 'Asia/Bangkok'
        }
      });

      if (!response.data?.response || response.data.response.length === 0) {
        console.log(`   ❌ Fixture not found`);
        return res.status(404).json({
          success: false,
          error: 'Match not found',
          message: `No match found with ID: ${fixtureId}`
        });
      }

      const fixture = response.data.response[0];

      // Fetch statistics if match is finished or in play
      let statistics = [];
      let events = [];
      let prediction = null;
      const matchStatus = fixture.fixture?.status?.short;

      if (matchStatus === 'FT' || matchStatus === '1H' || matchStatus === '2H' || matchStatus === 'HT') {
        console.log(`   📊 Fetching statistics and events for finished/live match...`);
        try {
          const [statsResponse, eventsResponse] = await Promise.all([
            footballApi.get('/fixtures/statistics', {
              params: { fixture: fixtureId }
            }),
            footballApi.get('/fixtures/events', {
              params: { fixture: fixtureId }
            })
          ]);

          statistics = statsResponse.data?.response || [];
          events = eventsResponse.data?.response || [];
          console.log(`   ✅ Found ${statistics.length} team statistics and ${events.length} events`);
        } catch (err) {
          console.log(`   ⚠️  Failed to fetch statistics/events: ${err.message}`);
        }
      } else if (matchStatus === 'NS' || matchStatus === 'TBD') {
        // Fetch prediction for scheduled matches
        console.log(`   🔮 Fetching prediction for scheduled match...`);
        try {
          const predictionResponse = await footballApi.get('/predictions', {
            params: { fixture: fixtureId }
          });

          if (predictionResponse.data?.response && predictionResponse.data.response.length > 0) {
            const rawPrediction = predictionResponse.data.response[0];

            // Transform prediction to match component's expected structure
            prediction = {
              homeStat: rawPrediction.teams?.home || {},
              awayStat: rawPrediction.teams?.away || {},
              homePercent: rawPrediction.predictions?.percent?.home || '0',
              awayPercent: rawPrediction.predictions?.percent?.away || '0',
              drawPercent: rawPrediction.predictions?.percent?.draw || '0',
              advice: rawPrediction.predictions?.advice || '',
              winnerName: rawPrediction.predictions?.winner?.name || ''
            };

            console.log(`   ✅ Found prediction data (Home: ${prediction.homePercent}%, Away: ${prediction.awayPercent}%)`);
          }
        } catch (err) {
          console.log(`   ⚠️  Failed to fetch prediction: ${err.message}`);
        }
      }

      // Transform using the existing transformer with statistics
      // transformToMatchFormat(fixture, oddsData, statsData, useMockOdds)
      const match = transformToMatchFormat(fixture, [], statistics, false);

      // Add prediction to match if available
      if (prediction) {
        match.prediction = prediction;
      }

      console.log(`   ✅ Found match: ${fixture.teams?.home?.name} vs ${fixture.teams?.away?.name}`);

      return res.json({
        success: true,
        data: match
      });

    } else if (matchDate) {
      // Fetch by date and search for matching timestamp
      console.log(`   📥 Fetching fixtures for ${matchDate} from API-Sports...`);
      const response = await footballApi.get('/fixtures', {
        params: {
          date: matchDate,
          timezone: 'Asia/Bangkok'
        }
      });

      if (!response.data?.response || response.data.response.length === 0) {
        console.log(`   ❌ No fixtures found for this date`);
        return res.status(404).json({
          success: false,
          error: 'Match not found',
          message: `No matches found on ${matchDate}`
        });
      }

      // Find the fixture matching the timestamp
      const parts = id.split('-');
      const timestamp = parseInt(parts[parts.length - 1]);

      let fixture = response.data.response.find(f => {
        const fixtureTimestamp = new Date(f.fixture.date).getTime();
        return fixtureTimestamp === timestamp;
      });

      // Fallback: Search by team names if timestamp doesn't match
      if (!fixture) {
        console.log(`   ⚠️  No exact timestamp match, trying team name search...`);

        // Extract team names from slug (before the timestamp)
        const slugWithoutTimestamp = parts.slice(0, -1).join('-');

        // Search for matches with similar team names
        fixture = response.data.response.find(f => {
          const homeSlug = (f.teams?.home?.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const awaySlug = (f.teams?.away?.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

          // Check if slug contains both team names
          return slugWithoutTimestamp.includes(homeSlug) && slugWithoutTimestamp.includes(awaySlug);
        });
      }

      if (!fixture) {
        console.log(`   ❌ No fixture found matching timestamp ${timestamp} or team names`);
        return res.status(404).json({
          success: false,
          error: 'Match not found',
          message: `No match found with slug: ${id}. This match may not be available in API-Sports.`
        });
      }

      const foundFixtureId = fixture.fixture.id;

      // Fetch statistics if match is finished or in play
      let statistics = [];
      let events = [];
      let prediction = null;
      const matchStatus = fixture.fixture?.status?.short;

      if (matchStatus === 'FT' || matchStatus === '1H' || matchStatus === '2H' || matchStatus === 'HT') {
        console.log(`   📊 Fetching statistics and events for finished/live match...`);
        try {
          const [statsResponse, eventsResponse] = await Promise.all([
            footballApi.get('/fixtures/statistics', {
              params: { fixture: foundFixtureId }
            }),
            footballApi.get('/fixtures/events', {
              params: { fixture: foundFixtureId }
            })
          ]);

          statistics = statsResponse.data?.response || [];
          events = eventsResponse.data?.response || [];
          console.log(`   ✅ Found ${statistics.length} team statistics and ${events.length} events`);
        } catch (err) {
          console.log(`   ⚠️  Failed to fetch statistics/events: ${err.message}`);
        }
      } else if (matchStatus === 'NS' || matchStatus === 'TBD') {
        // Fetch prediction for scheduled matches
        console.log(`   🔮 Fetching prediction for scheduled match...`);
        try {
          const predictionResponse = await footballApi.get('/predictions', {
            params: { fixture: foundFixtureId }
          });

          if (predictionResponse.data?.response && predictionResponse.data.response.length > 0) {
            const rawPrediction = predictionResponse.data.response[0];

            // Transform prediction to match component's expected structure
            prediction = {
              homeStat: rawPrediction.teams?.home || {},
              awayStat: rawPrediction.teams?.away || {},
              homePercent: rawPrediction.predictions?.percent?.home || '0',
              awayPercent: rawPrediction.predictions?.percent?.away || '0',
              drawPercent: rawPrediction.predictions?.percent?.draw || '0',
              advice: rawPrediction.predictions?.advice || '',
              winnerName: rawPrediction.predictions?.winner?.name || ''
            };

            console.log(`   ✅ Found prediction data (Home: ${prediction.homePercent}%, Away: ${prediction.awayPercent}%)`);
          }
        } catch (err) {
          console.log(`   ⚠️  Failed to fetch prediction: ${err.message}`);
        }
      }

      // Transform using the existing transformer with statistics
      // transformToMatchFormat(fixture, oddsData, statsData, useMockOdds)
      const match = transformToMatchFormat(fixture, [], statistics, false);

      // Add prediction to match if available
      if (prediction) {
        match.prediction = prediction;
      }

      console.log(`   ✅ Found match: ${fixture.teams?.home?.name} vs ${fixture.teams?.away?.name}`);

      return res.json({
        success: true,
        data: match
      });
    }

  } catch (error) {
    console.error('❌ Error fetching match detail:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match detail',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/:id/odds
// Get betting odds for a match by slug or numeric ID
// ========================================
router.get('/:id/odds', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const Odds = require('../models/Odds');
    const { id } = req.params;

    console.log(`\n🎰 GET /api/matches/:id/odds`);
    console.log(`   Requested ID/Slug: ${id}`);

    let fixtureId = null;
    let matchDate = null;

    // Try to parse as numeric ID first
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      console.log(`   📊 Using numeric fixture ID: ${numericId}`);
      fixtureId = numericId;
    } else {
      // Try to extract timestamp from slug
      console.log(`   📊 Parsing slug to extract timestamp`);
      const parts = id.split('-');
      const lastPart = parts[parts.length - 1];
      const timestamp = parseInt(lastPart);

      if (!isNaN(timestamp) && timestamp > 1000000000000) {
        const date = new Date(timestamp);
        matchDate = date.toISOString().split('T')[0];
        console.log(`   📅 Extracted date: ${matchDate} from timestamp ${timestamp}`);

        // Need to fetch fixtures to get the fixture ID
        console.log(`   📥 Fetching fixtures for ${matchDate} to find fixture ID...`);
        const fixturesResponse = await footballApi.get('/fixtures', {
          params: {
            date: matchDate,
            timezone: 'Asia/Bangkok'
          }
        });

        if (fixturesResponse.data?.response && fixturesResponse.data.response.length > 0) {
          const fixture = fixturesResponse.data.response.find(f => {
            const fixtureTimestamp = new Date(f.fixture.date).getTime();
            return fixtureTimestamp === timestamp;
          });

          if (fixture) {
            fixtureId = fixture.fixture.id;
            console.log(`   ✅ Found fixture ID: ${fixtureId}`);
          }
        }
      }
    }

    if (!fixtureId) {
      console.log(`   ❌ Could not determine fixture ID`);
      return res.status(400).json({
        success: false,
        error: 'Invalid match identifier',
        message: `Could not extract fixture ID from: ${id}`
      });
    }

    // Try to get from MongoDB cache first
    console.log(`   🔍 Checking MongoDB cache for fixture ${fixtureId}...`);
    const cachedOdds = await Odds.findOne({ fixtureId });

    if (cachedOdds && cachedOdds.bookmakers && cachedOdds.bookmakers.length > 0) {
      console.log(`   ✅ Found ${cachedOdds.bookmakers.length} bookmakers in MongoDB cache`);
      // Transform cached data to add 'type' field for frontend compatibility
      const transformedBookmakers = transformOdds([{ bookmakers: cachedOdds.bookmakers }]);
      return res.json({
        success: true,
        source: 'cache',
        data: {
          fixtureId,
          bookmakers: transformedBookmakers,
          updatedAt: cachedOdds.updatedAt
        }
      });
    }

    // Fetch from API-Sports - get ALL bookmakers
    console.log(`   📥 Fetching odds from API-Sports (all bookmakers)...`);
    const oddsResponse = await footballApi.get('/odds', {
      params: {
        fixture: fixtureId
        // No bookmaker filter - get all bookmakers
      }
    });

    if (!oddsResponse.data?.response || oddsResponse.data.response.length === 0) {
      console.log(`   ⚠️  No odds available for this fixture`);
      return res.json({
        success: true,
        data: {
          fixtureId,
          bookmakers: [],
          message: 'No odds available'
        }
      });
    }

    const oddsData = oddsResponse.data.response[0];
    const allBookmakers = oddsData.bookmakers || [];

    console.log(`   ✅ Found ${allBookmakers.length} bookmaker(s) from API-Sports`);

    // Transform odds data to add 'type' field for frontend compatibility
    const transformedBookmakers = transformOdds([{ bookmakers: allBookmakers }]);
    console.log(`   🔄 Transformed ${transformedBookmakers.length} bookmakers with type field`);

    // Save/Update cache with raw bookmakers (transform on read for consistency)
    try {
      if (cachedOdds) {
        await Odds.findOneAndUpdate(
          { fixtureId },
          {
            bookmakers: allBookmakers,
            updatedAt: new Date()
          }
        );
        console.log(`   💾 Updated MongoDB cache with ${allBookmakers.length} bookmakers`);
      } else {
        // Create new cache entry
        await Odds.create({
          fixtureId,
          bookmakers: allBookmakers,
          matchStatus: 'scheduled',
          updatedAt: new Date()
        });
        console.log(`   💾 Created new cache entry for fixture ${fixtureId}`);
      }
    } catch (cacheError) {
      console.error(`   ⚠️  Failed to cache odds:`, cacheError.message);
    }

    res.json({
      success: true,
      source: 'api',
      data: {
        fixtureId,
        bookmakers: transformedBookmakers,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch odds',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/:id/forms
// Get team forms (recent matches) for a match
// ========================================
router.get('/:id/forms', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;

    console.log(`\n📊 GET /api/matches/:id/forms`);
    console.log(`   Requested ID/Slug: ${id}`);

    let fixtureId = null;

    // Try to parse as numeric ID first
    const numericId = parseInt(id);
    if (!isNaN(numericId)) {
      console.log(`   📊 Using numeric fixture ID: ${numericId}`);
      fixtureId = numericId;
    } else {
      // Try to extract timestamp from slug
      console.log(`   📊 Parsing slug to extract timestamp`);
      const parts = id.split('-');
      const lastPart = parts[parts.length - 1];
      const timestamp = parseInt(lastPart);

      if (!isNaN(timestamp) && timestamp > 1000000000000) {
        const date = new Date(timestamp);
        const matchDate = date.toISOString().split('T')[0];
        console.log(`   📅 Extracted date: ${matchDate} from timestamp ${timestamp}`);

        // Need to fetch fixtures to get the fixture ID
        console.log(`   📥 Fetching fixtures for ${matchDate} to find fixture ID...`);
        const fixturesResponse = await footballApi.get('/fixtures', {
          params: {
            date: matchDate,
            timezone: 'Asia/Bangkok'
          }
        });

        if (fixturesResponse.data?.response && fixturesResponse.data.response.length > 0) {
          const fixture = fixturesResponse.data.response.find(f => {
            const fixtureTimestamp = new Date(f.fixture.date).getTime();
            return fixtureTimestamp === timestamp;
          });

          if (fixture) {
            fixtureId = fixture.fixture.id;
            console.log(`   ✅ Found fixture ID: ${fixtureId}`);
          }
        }
      }
    }

    if (!fixtureId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid match identifier',
        message: `Could not extract fixture ID from: ${id}`
      });
    }

    // Get fixture details first to get team IDs
    console.log(`   📥 Fetching fixture details for ${fixtureId}...`);
    const fixtureResponse = await footballApi.get('/fixtures', {
      params: { id: fixtureId }
    });

    if (!fixtureResponse.data?.response || fixtureResponse.data.response.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Fixture not found',
        message: `No fixture found with ID: ${fixtureId}`
      });
    }

    const fixture = fixtureResponse.data.response[0];
    const homeTeamId = fixture.teams?.home?.id;
    const awayTeamId = fixture.teams?.away?.id;
    const leagueId = fixture.league?.id;
    const season = fixture.league?.season;

    if (!homeTeamId || !awayTeamId || !leagueId || !season) {
      return res.status(400).json({
        success: false,
        error: 'Missing team or league data',
        message: 'Could not extract team IDs or league info from fixture'
      });
    }

    console.log(`   📥 Fetching forms for home team ${homeTeamId} and away team ${awayTeamId}...`);

    // Fetch last 5 matches for each team
    const [homeFormResponse, awayFormResponse] = await Promise.all([
      footballApi.get('/fixtures', {
        params: {
          team: homeTeamId,
          league: leagueId,
          season: season,
          last: 5
        }
      }),
      footballApi.get('/fixtures', {
        params: {
          team: awayTeamId,
          league: leagueId,
          season: season,
          last: 5
        }
      })
    ]);

    const homeFixtures = homeFormResponse.data?.response || [];
    const awayFixtures = awayFormResponse.data?.response || [];

    console.log(`   ✅ Found ${homeFixtures.length} home form matches, ${awayFixtures.length} away form matches`);

    // Transform fixtures to form format expected by frontend
    const transformFixtureToForm = (fixture, teamId) => {
      const isHome = fixture.teams.home.id === teamId;
      const opponent = isHome ? fixture.teams.away : fixture.teams.home;
      const team = isHome ? fixture.teams.home : fixture.teams.away;

      // Determine form status
      let formStatus = 'unknown';
      if (fixture.fixture.status.short === 'FT') {
        if (team.winner === null) {
          formStatus = 'draw';
        } else if (team.winner === true) {
          formStatus = 'win';
        } else {
          formStatus = 'lose';
        }
      }

      // Build match slug
      const homeSlug = fixture.teams.home.name.toLowerCase().replace(/\s+/g, '-');
      const awaySlug = fixture.teams.away.name.toLowerCase().replace(/\s+/g, '-');
      const timestamp = new Date(fixture.fixture.date).getTime();
      const matchSlug = {
        en: `${homeSlug}-vs-${awaySlug}-${timestamp}`,
        vi: `${homeSlug}-vs-${awaySlug}-${timestamp}`
      };

      return {
        dateTime: fixture.fixture.date,
        form: formStatus,
        name: opponent.name,
        score: `${fixture.goals.home}-${fixture.goals.away}`,
        matchId: fixture.fixture.id.toString(),
        matchSlug: matchSlug,
        awayTeamId: fixture.teams.away.id.toString(),
        homeTeamId: fixture.teams.home.id.toString()
      };
    };

    const homeForm = homeFixtures.map(fixture => transformFixtureToForm(fixture, homeTeamId));
    const awayForm = awayFixtures.map(fixture => transformFixtureToForm(fixture, awayTeamId));

    res.json({
      success: true,
      data: {
        home: homeForm,
        away: awayForm
      }
    });

  } catch (error) {
    console.error('❌ Error fetching forms:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch forms',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/:id/events
// Get match events (goals, cards, substitutions, etc.)
// ========================================
router.get('/:id/events', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;

    console.log(`\n⚽ GET /api/matches/${id}/events`);

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing match ID'
      });
    }

    // Extract numeric ID from slug format
    const extractMatchId = (matchId) => {
      if (typeof matchId === 'string' && matchId.includes('-')) {
        const parts = matchId.split('-');
        return parts[parts.length - 1];
      }
      return matchId;
    };

    const numericMatchId = extractMatchId(id);
    console.log(`   Match ID: ${numericMatchId}`);

    // Fetch events from API-Football
    const eventsResponse = await footballApi.get('/fixtures/events', {
      params: { fixture: numericMatchId }
    });

    const events = eventsResponse.data?.response || [];
    console.log(`   ✅ Found ${events.length} events`);

    // Transform and sort events by time
    const transformedEvents = events.map(event => ({
      time: {
        elapsed: event.time.elapsed,
        extra: event.time.extra || null
      },
      team: {
        id: event.team.id,
        name: event.team.name,
        logo: event.team.logo
      },
      player: {
        id: event.player.id,
        name: event.player.name
      },
      assist: event.assist ? {
        id: event.assist.id,
        name: event.assist.name
      } : null,
      type: event.type, // Goal, Card, subst, Var
      detail: event.detail, // Normal Goal, Yellow Card, Substitution 1, etc.
      comments: event.comments || null
    })).sort((a, b) => {
      // Sort by elapsed time, then by extra time
      if (a.time.elapsed !== b.time.elapsed) {
        return a.time.elapsed - b.time.elapsed;
      }
      return (a.time.extra || 0) - (b.time.extra || 0);
    });

    res.json({
      success: true,
      data: transformedEvents
    });

  } catch (error) {
    console.error('❌ Error fetching match events:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match events',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/:id/lineups
// Get match lineups (starting XI and substitutes)
// ========================================
router.get('/:id/lineups', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;

    console.log(`\n👥 GET /api/matches/${id}/lineups`);

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing match ID'
      });
    }

    // Extract numeric ID from slug format
    const extractMatchId = (matchId) => {
      if (typeof matchId === 'string' && matchId.includes('-')) {
        const parts = matchId.split('-');
        return parts[parts.length - 1];
      }
      return matchId;
    };

    const numericMatchId = extractMatchId(id);
    console.log(`   Match ID: ${numericMatchId}`);

    // Fetch both lineups and player statistics in parallel
    const [lineupsResponse, playersResponse] = await Promise.all([
      footballApi.get('/fixtures/lineups', {
        params: { fixture: numericMatchId }
      }),
      footballApi.get('/fixtures/players', {
        params: { fixture: numericMatchId }
      })
    ]);

    const lineups = lineupsResponse.data?.response || [];
    const playersStats = playersResponse.data?.response || [];

    console.log(`   ✅ Found ${lineups.length} team lineups`);
    console.log(`   ✅ Found ${playersStats.length} team player stats`);

    if (lineups.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Lineups not available yet'
      });
    }

    // Create a map of player ratings for quick lookup
    const playerRatingsMap = new Map();
    playersStats.forEach(teamStats => {
      teamStats.players?.forEach(playerStat => {
        const playerId = playerStat.player?.id;
        const rating = playerStat.statistics?.[0]?.games?.rating;
        if (playerId && rating) {
          playerRatingsMap.set(playerId.toString(), parseFloat(rating));
        }
      });
    });

    // Transform lineups data to match frontend structure
    const transformedLineups = lineups.map((teamLineup, index) => {
      const transformPlayer = (playerData) => {
        const playerId = playerData.player?.id;
        // Use API-Sports player photo URL pattern
        // Falls back to default icon if player ID not available
        const playerPhoto = playerId
          ? `https://media.api-sports.io/football/players/${playerId}.png`
          : '/assets/icons/icon-player-form.svg';

        // Get player rating from the map
        const rating = playerRatingsMap.get(playerId?.toString());

        return {
          _id: playerId?.toString() || '',
          number: playerData.player?.number?.toString() || '',
          position: playerData.player?.pos || 'M',
          grid: playerData.player?.grid || '2:2',
          rating: rating || null,
          player: {
            _id: playerId?.toString() || '',
            name: playerData.player?.name || 'Unknown',
            image: playerPhoto,
            slug: playerData.player?.name?.toLowerCase().replace(/\s+/g, '-') || '',
            thumbnail: playerPhoto,
            country: {
              _id: '',
              name: '',
              code: '',
              image: '',
              thumbnail: '',
              slug: ''
            },
            position: playerData.player?.pos || 'M'
          }
        };
      };

      return {
        _id: `${teamLineup.team?.id}-${numericMatchId}`,
        teamId: teamLineup.team?.id?.toString() || '',
        isHomeTeam: index === 0,
        formation: teamLineup.formation || '4-4-2',
        strategy: teamLineup.formation || '4-4-2',
        team: {
          _id: teamLineup.team?.id?.toString() || '',
          name: teamLineup.team?.name || '',
        },
        attributes: {
          color: teamLineup.team?.colors || {
            player: { primary: 'ffffff', number: '000000', border: 'ffffff' },
            goalkeeper: { primary: 'ffff00', number: '000000', border: 'ffff00' }
          }
        },
        starting: (teamLineup.startXI || []).map(transformPlayer),
        substitutes: (teamLineup.substitutes || []).map(transformPlayer),
        coach: {
          _id: teamLineup.coach?.id?.toString() || '',
          name: teamLineup.coach?.name || '',
          code: '',
          image: teamLineup.coach?.photo || '',
          slug: teamLineup.coach?.name?.toLowerCase().replace(/\s+/g, '-') || '',
          thumbnail: teamLineup.coach?.photo || '',
          country: {
            _id: '',
            name: '',
            code: '',
            image: '',
            thumbnail: '',
            slug: ''
          }
        },
        injuries: []
      };
    });

    res.json({
      success: true,
      data: transformedLineups
    });

  } catch (error) {
    console.error('❌ Error fetching lineups:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lineups',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/h2h
// Get head-to-head matches between two teams
// ========================================
router.get('/h2h', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { homeTeamId, awayTeamId } = req.query;

    console.log(`\n⚔️ GET /api/matches/h2h`);
    console.log(`   Home Team ID: ${homeTeamId}`);
    console.log(`   Away Team ID: ${awayTeamId}`);

    if (!homeTeamId || !awayTeamId) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'Both homeTeamId and awayTeamId are required'
      });
    }

    // Extract numeric IDs from "team-{id}" format
    const extractTeamId = (teamId) => {
      if (typeof teamId === 'string' && teamId.startsWith('team-')) {
        return parseInt(teamId.replace('team-', ''));
      }
      return parseInt(teamId);
    };

    const homeId = extractTeamId(homeTeamId);
    const awayId = extractTeamId(awayTeamId);

    if (isNaN(homeId) || isNaN(awayId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid team IDs',
        message: `Could not parse team IDs: ${homeTeamId}, ${awayTeamId}`
      });
    }

    console.log(`   📥 Fetching H2H for teams ${homeId} vs ${awayId}...`);

    // Fetch H2H data from API-Football
    const h2hResponse = await footballApi.get('/fixtures/headtohead', {
      params: {
        h2h: `${homeId}-${awayId}`,
        last: 10 // Get last 10 H2H matches
      }
    });

    const h2hMatches = h2hResponse.data?.response || [];

    console.log(`   ✅ Found ${h2hMatches.length} H2H matches`);

    // Fetch last matches for each team
    const [homeLastResponse, awayLastResponse] = await Promise.all([
      footballApi.get('/fixtures', {
        params: {
          team: homeId,
          last: 5
        }
      }),
      footballApi.get('/fixtures', {
        params: {
          team: awayId,
          last: 5
        }
      })
    ]);

    const lastHomeMatches = homeLastResponse.data?.response || [];
    const lastAwayMatches = awayLastResponse.data?.response || [];

    console.log(`   ✅ Found ${lastHomeMatches.length} home team matches, ${lastAwayMatches.length} away team matches`);

    // Transform fixture data to match frontend TH2HDetail format
    const transformFixture = (fixture, targetTeamId = null) => {
      const fixtureId = fixture.fixture?.id;
      const homeTeamId = fixture.teams?.home?.id;
      const awayTeamId = fixture.teams?.away?.id;

      // Generate match slug (similar to how it's done in other endpoints)
      const leagueName = (fixture.league?.name || 'match')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const homeTeamName = (fixture.teams?.home?.name || 'home')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const awayTeamName = (fixture.teams?.away?.name || 'away')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const timestamp = new Date(fixture.fixture?.date).getTime();
      const matchSlug = `${leagueName}-${homeTeamName}-${awayTeamName}-${timestamp}`;

      // Calculate form (W/D/L) if targetTeamId is provided
      let form = null;
      if (targetTeamId && fixture.goals?.home !== null && fixture.goals?.away !== null) {
        const homeGoals = fixture.goals.home;
        const awayGoals = fixture.goals.away;

        if (homeGoals > awayGoals) {
          // Home team won
          form = homeTeamId === targetTeamId ? 'win' : 'lose';
        } else if (awayGoals > homeGoals) {
          // Away team won
          form = awayTeamId === targetTeamId ? 'win' : 'lose';
        } else {
          // Draw
          form = 'draw';
        }
      }

      return {
        matchId: fixtureId?.toString(),
        matchSlug: matchSlug,
        dateTime: fixture.fixture?.date,
        country: {
          image: fixture.league?.flag || fixture.league?.logo,
          name: fixture.league?.country
        },
        competition: {
          code: fixture.league?.name,
          name: fixture.league?.name
        },
        league: {
          name: fixture.league?.name,
          id: fixture.league?.id
        },
        home: {
          teamId: `team-${homeTeamId}`,
          name: fixture.teams?.home?.name,
          image: fixture.teams?.home?.logo,
          score: fixture.goals?.home ?? 0
        },
        away: {
          teamId: `team-${awayTeamId}`,
          name: fixture.teams?.away?.name,
          image: fixture.teams?.away?.logo,
          score: fixture.goals?.away ?? 0
        },
        form: form
      };
    };

    // Transform all fixtures
    const transformedH2H = h2hMatches.map(fixture => transformFixture(fixture));
    const transformedHomeMatches = lastHomeMatches.map(fixture => transformFixture(fixture, homeId));
    const transformedAwayMatches = lastAwayMatches.map(fixture => transformFixture(fixture, awayId));

    res.json({
      success: true,
      data: {
        h2hMatches: transformedH2H,
        lastHomeMatches: transformedHomeMatches,
        lastAwayMatches: transformedAwayMatches
      }
    });

  } catch (error) {
    console.error('❌ Error fetching H2H:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch H2H',
      message: error.message
    });
  }
});

// ========================================
// GET /api/matches/injuries
// Get injuries for a specific league/season
// ========================================
router.get('/injuries', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { competitionId, seasonYear, teamId } = req.query;

    console.log(`\n🏥 GET /api/matches/injuries`);
    console.log(`   Competition ID: ${competitionId}`);
    console.log(`   Season Year: ${seasonYear}`);
    console.log(`   Team ID: ${teamId}`);

    // Extract numeric IDs if needed
    const extractLeagueId = (id) => {
      if (!id) return null;
      if (typeof id === 'string' && id.startsWith('league-')) {
        return parseInt(id.replace('league-', ''));
      }
      return parseInt(id);
    };

    const extractTeamId = (id) => {
      if (!id) return null;
      if (typeof id === 'string' && id.startsWith('team-')) {
        return parseInt(id.replace('team-', ''));
      }
      return parseInt(id);
    };

    const params = {};

    // Add league parameter if provided
    if (competitionId) {
      const leagueId = extractLeagueId(competitionId);
      if (!isNaN(leagueId)) {
        params.league = leagueId;
      }
    }

    // Add season parameter if provided
    if (seasonYear) {
      params.season = parseInt(seasonYear);
    }

    // Add team parameter if provided
    if (teamId) {
      const teamNumericId = extractTeamId(teamId);
      if (!isNaN(teamNumericId)) {
        params.team = teamNumericId;
      }
    }

    // At least one parameter is required
    if (Object.keys(params).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'At least one of competitionId, seasonYear, or teamId is required'
      });
    }

    console.log(`   📥 Fetching injuries with params:`, params);

    // Fetch injuries from API-Football
    const injuriesResponse = await footballApi.get('/injuries', {
      params
    });

    const injuries = injuriesResponse.data.response || [];

    console.log(`   ✅ Found ${injuries.length} injuries`);

    res.json({
      success: true,
      data: injuries
    });

  } catch (error) {
    console.error('❌ Error fetching injuries:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch injuries',
      message: error.message
    });
  }
});

// Other routes remain the same...
// (Include all other routes from the original file)

module.exports = router;