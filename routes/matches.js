// ========================================
// OPTIMIZED SOLUTION - No Duplicates
// routes/matches.js
// ========================================

const express = require('express');
const router = express.Router();
const { transformToMatchFormat, transformOdds } = require('../utils/transformers');
const { POPULAR_LEAGUES, getFlagCode } = require('../data/leagues');
const oddsCache = require('../services/oddsCache'); // MongoDB cache service
const matchCache = require('../services/matchCache'); // MongoDB match cache service
const Odds = require('../models/Odds'); // MongoDB Odds model for direct queries

// Default fallback image for broken logos
const DEFAULT_FALLBACK_IMAGE = 'https://media.api-sports.io/football/teams/5297.png';

// ⚠️ Old in-memory cache (now replaced by MongoDB cache)
// const oddsCache = new Map();
// const ODDS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

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
    includeOdds = 'false', // Default: DON'T fetch odds (too slow for bulk requests!)
    bookmakers = '8,18,1' // Bet365, 188Bet, SBO
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
 * Fetch odds for a fixture from API-Sports
 * Note: Caching is handled at a higher level by MongoDB oddsCache service
 */
async function fetchOddsForFixture(footballApi, fixtureId, bookmakerIds = [8, 18, 9]) {
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
 * Fetch and transform fixtures
 */
async function fetchFixtures(footballApi, params, includeOdds = false, bookmakerIds = [8, 18, 9], maxLimit = 200) {
  try {
    console.log('🔍 Calling API-Sports /fixtures with params:', JSON.stringify(params, null, 2));

    const response = await footballApi.get('/fixtures', { params });
    let fixtures = response.data.response || [];

    console.log(`📥 Fetched ${fixtures.length} fixtures from API-Sports`);

    // ⚠️ Limit fixtures to prevent "Invalid string length" error
    if (fixtures.length > maxLimit) {
      console.log(`   ⚠️  Fixtures count (${fixtures.length}) exceeds limit (${maxLimit}), slicing to ${maxLimit} fixtures`);
      fixtures = fixtures.slice(0, maxLimit);
    }

    if (fixtures.length === 0) {
      console.log('⚠️  No fixtures returned from API-Sports. This could mean:');
      console.log('   - No matches scheduled for this date/status combination');
      console.log('   - API-Sports rate limit reached');
      console.log('   - Invalid date format or status');
    }

    // Group by league (preserve order from API-Sports)
    const groupedByLeague = {};
    const leagueOrder = []; // Track insertion order

    // First pass: Group fixtures WITHOUT fetching odds (fast)
    for (const fixture of fixtures) {
      const leagueId = fixture.league?.id;
      if (!leagueId) continue;

      // Create league group if not exists
      if (!groupedByLeague[leagueId]) {
        const leagueData = POPULAR_LEAGUES.find(l => l.id === leagueId) || {};
        groupedByLeague[leagueId] = buildCompetitionObject(fixture, leagueData);
        leagueOrder.push(leagueId); // Track order
      }

      // Transform and add match WITHOUT odds (fast)
      const match = transformToMatchFormat(fixture, [], [], false);
      match.bookmakers = []; // Will be populated later if needed
      groupedByLeague[leagueId].matches.push(match);
    }

    // ✅ Filter matches: If competition has LIVE matches, only show LIVE
    // Priority: Show only LIVE when available, otherwise show all
    const competitions = leagueOrder.map(id => {
      const comp = groupedByLeague[id];
      const hasLive = comp.matches?.some(m => m.status === 'in_play');

      if (hasLive) {
        // Only keep LIVE matches when there are LIVE matches
        comp.matches = comp.matches.filter(m => m.status === 'in_play');
      }

      return comp;
    });

    // ✅ Sort competitions by match status priority
    // Priority: LIVE > SCHEDULED > FINISHED
    competitions.sort((a, b) => {
      // 1. Sort by match status priority
      const getStatusPriority = (comp) => {
        const hasLive = comp.matches?.some(m => m.status === 'in_play');
        const hasScheduled = comp.matches?.some(m => m.status === 'scheduled');
        const hasFinished = comp.matches?.some(m => m.status === 'finished');

        if (hasLive) return 0; // Highest priority - LIVE matches
        if (hasScheduled) return 1; // Second priority - Upcoming matches
        if (hasFinished) return 2; // Lower priority - Finished matches
        return 3; // Lowest priority (postponed, cancelled, etc)
      };

      const aPriority = getStatusPriority(a);
      const bPriority = getStatusPriority(b);

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // 2. Same status: sort by earliest match time
      const aTime = a.matches?.[0]?.dateTime || '';
      const bTime = b.matches?.[0]?.dateTime || '';
      return aTime.localeCompare(bTime);
    });

    // ✅ NEW: Fetch events and statistics for LIVE matches + MatchCache for FINISHED matches
    console.log(`📊 Checking for LIVE/FINISHED matches needing events/statistics...`);

    // Map to store original fixture data by ID for re-transformation
    const fixtureMap = new Map();
    for (const fixture of fixtures) {
      fixtureMap.set(fixture.fixture.id, fixture);
    }

    // Separate LIVE and FINISHED matches
    const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
    const liveMatches = [];
    const finishedMatches = [];

    for (const comp of competitions) {
      for (const match of comp.matches) {
        if (match.statusCode) {
          if (FINISHED_STATUSES.includes(match.statusCode)) {
            finishedMatches.push({ id: match.id, name: match.name, statusCode: match.statusCode });
          } else if (needsEventsData(match.statusCode)) {
            liveMatches.push({ id: match.id, name: match.name, statusCode: match.statusCode });
          }
        }
      }
    }

    // ========================================
    // PATH A: FINISHED MATCHES - Use MatchCache
    // ========================================
    if (finishedMatches.length > 0) {
      console.log(`   💾 Found ${finishedMatches.length} FINISHED matches - checking MatchCache...`);

      // Bulk check cache
      const finishedIds = finishedMatches.map(m => m.id);
      const cacheMap = await matchCache.getBulkCachedMatches(finishedIds);

      let cacheHits = 0;
      let cacheMisses = 0;

      // Process cache hits - replace with cached data
      for (const comp of competitions) {
        for (let i = 0; i < comp.matches.length; i++) {
          const match = comp.matches[i];
          const cachedData = cacheMap.get(match.id);

          if (cachedData) {
            // Cache hit - use cached match data
            comp.matches[i] = cachedData;
            cacheHits++;
          } else if (FINISHED_STATUSES.includes(match.statusCode)) {
            // Cache miss - need to fetch and cache
            cacheMisses++;
          }
        }
      }

      console.log(`   📊 MatchCache results: ${cacheHits} hits, ${cacheMisses} misses`);

      // Fetch and cache the misses
      if (cacheMisses > 0) {
        console.log(`   ⚡ Fetching ${cacheMisses} uncached finished matches from API...`);

        const BATCH_SIZE = 5;
        let cached = 0;

        for (let i = 0; i < finishedMatches.length; i += BATCH_SIZE) {
          const batch = finishedMatches.slice(i, i + BATCH_SIZE);

          await Promise.all(batch.map(async (matchInfo) => {
            try {
              // Skip if already in cache
              if (cacheMap.has(matchInfo.id)) return;

              // Fetch events and statistics
              const [eventsData, statisticsData] = await Promise.all([
                getEventsForFixture(footballApi, matchInfo.id),
                getStatisticsForFixture(footballApi, matchInfo.id)
              ]);

              // Get original fixture data
              const originalFixture = fixtureMap.get(matchInfo.id);
              if (!originalFixture) return;

              // Cache the finished match
              await matchCache.cacheFinishedMatch(originalFixture, eventsData, statisticsData, []);

              // Attach events and statistics to fixture
              originalFixture.events = eventsData;
              originalFixture.statistics = statisticsData;

              // Re-transform match with events/statistics
              const updatedMatch = transformToMatchFormat(originalFixture, [], statisticsData, false);

              // Find and update the match in competitions
              for (const comp of competitions) {
                const matchIndex = comp.matches.findIndex(m => m.id === matchInfo.id);
                if (matchIndex !== -1) {
                  comp.matches[matchIndex] = updatedMatch;
                  cached++;
                  break;
                }
              }
            } catch (error) {
              console.error(`   ❌ Failed to fetch/cache finished match ${matchInfo.id}:`, error.message);
            }
          }));
        }

        console.log(`   ✅ Cached ${cached} new finished matches`);
      }
    }

    // ========================================
    // PATH B: LIVE MATCHES - Real-time fetch (no cache)
    // ========================================
    if (liveMatches.length > 0) {
      console.log(`   🔴 Found ${liveMatches.length} LIVE matches - fetching real-time data...`);

      const BATCH_SIZE = 5;
      let eventsCount = 0;
      let statsCount = 0;

      for (let i = 0; i < liveMatches.length; i += BATCH_SIZE) {
        const batch = liveMatches.slice(i, i + BATCH_SIZE);

        // Fetch events and statistics in parallel for this batch
        await Promise.all(batch.map(async (matchInfo) => {
          try {
            // Fetch events and statistics in parallel
            const [eventsData, statisticsData] = await Promise.all([
              getEventsForFixture(footballApi, matchInfo.id),
              getStatisticsForFixture(footballApi, matchInfo.id)
            ]);

            // Get original fixture data
            const originalFixture = fixtureMap.get(matchInfo.id);
            if (!originalFixture) return;

            // Attach events and statistics to fixture
            originalFixture.events = eventsData;
            originalFixture.statistics = statisticsData;

            // Re-transform match with events/statistics
            const updatedMatch = transformToMatchFormat(originalFixture, [], statisticsData, false);

            // Find and update the match in competitions
            for (const comp of competitions) {
              const matchIndex = comp.matches.findIndex(m => m.id === matchInfo.id);
              if (matchIndex !== -1) {
                comp.matches[matchIndex] = {
                  ...comp.matches[matchIndex],
                  events: updatedMatch.events,
                  detail: {
                    ...comp.matches[matchIndex].detail,
                    home: {
                      ...comp.matches[matchIndex].detail.home,
                      yellowCards: updatedMatch.detail.home.yellowCards,
                      redCards: updatedMatch.detail.home.redCards,
                      corners: updatedMatch.detail.home.corners
                    },
                    away: {
                      ...comp.matches[matchIndex].detail.away,
                      yellowCards: updatedMatch.detail.away.yellowCards,
                      redCards: updatedMatch.detail.away.redCards,
                      corners: updatedMatch.detail.away.corners
                    }
                  }
                };

                if (eventsData && eventsData.length > 0) eventsCount++;
                if (statisticsData && statisticsData.length > 0) statsCount++;
                break;
              }
            }
          } catch (error) {
            console.error(`   ❌ Failed to fetch events/stats for match ${matchInfo.id}:`, error.message);
          }
        }));

        console.log(`   📊 Progress: ${Math.min(i + BATCH_SIZE, liveMatches.length)}/${liveMatches.length} LIVE matches processed`);
      }

      console.log(`   ✅ LIVE events/statistics fetch complete: ${eventsCount} with events, ${statsCount} with statistics`);
    }

    if (liveMatches.length === 0 && finishedMatches.length === 0) {
      console.log(`   ℹ️  No LIVE/FINISHED matches found (only SCHEDULED)`);
    }

    // ✅ ALWAYS fetch real-time odds from API (NO CACHE)
    if (includeOdds) {
      console.log(`🎰 Loading odds (includeOdds=true) - REAL-TIME ONLY (no cache)...`);

      // Collect all fixture IDs from all competitions
      const fixtureIds = [];
      for (const comp of competitions) {
        for (const match of comp.matches) {
          if (match.id) {
            fixtureIds.push(match.id);
          }
        }
      }

      console.log(`   Found ${fixtureIds.length} fixtures to load odds for`);
      console.log(`   ⚡ Fetching ALL from API (parallel batches of 5)...`);

      // Fetch ALL odds from API in parallel batches
      const BATCH_SIZE = 5;
      let fetched = 0;
      let failed = 0;

      for (let i = 0; i < fixtureIds.length; i += BATCH_SIZE) {
        const batch = fixtureIds.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (fixtureId) => {
          try {
            const odds = await oddsCache.getOrFetchOdds(fixtureId, footballApi);
            if (odds && odds.length > 0) {
              // Find and populate the match
              for (const comp of competitions) {
                const match = comp.matches.find(m => m.id === fixtureId);
                if (match) {
                  match.bookmakers = odds;
                  fetched++;
                  break;
                }
              }
            }
          } catch (error) {
            console.error(`   [Realtime] Failed to fetch odds for ${fixtureId}:`, error.message);
            failed++;
          }
        }));

        console.log(`   📊 Progress: ${fetched}/${fixtureIds.length} fetched, ${failed} failed`);
      }

      console.log(`   ✅ Real-time fetch complete: ${fetched}/${fixtureIds.length} successful`);
    }

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
    let { dateTime, status, offset = 0, limit = 30, league, competitionId, teamId, teamKeyword, seasonYear, groupByRound, sortByRound } = req.query;
    const { shouldIncludeOdds, bookmakerIds } = parseQueryParams(req.query);

    // ⚠️ Limit validation to prevent "Invalid string length" error
    const MAX_LIMIT = 200;
    limit = Math.min(parseInt(limit) || 30, MAX_LIMIT);
    if (parseInt(req.query.limit) > MAX_LIMIT) {
      console.log(`   ⚠️  Limit ${req.query.limit} exceeds max ${MAX_LIMIT}, capping to ${MAX_LIMIT}`);
    }

    console.log('\n⚽ GET /api/matches/all');
    console.log(`   Params: date=${dateTime}, status=${status}, competitionId=${competitionId}, seasonYear=${seasonYear}, groupByRound=${groupByRound}, sortByRound=${sortByRound}, teamId=${teamId}, teamKeyword=${teamKeyword}, includeOdds=${shouldIncludeOdds}, limit=${limit}`);

    const params = { timezone: 'Asia/Bangkok' };

    // ✅ NEW: Season-based fetching (for competition schedules)
    if (seasonYear && competitionId) {
      const leagueId = parseInt(competitionId.replace('league-', ''));
      params.league = leagueId;
      params.season = seasonYear;
      console.log(`   📅 Fetching by SEASON: league=${leagueId}, season=${seasonYear}`);
    } else if (dateTime) {
      params.date = new Date(dateTime).toISOString().split('T')[0];
    }

    const statusMap = {
      'scheduled': 'NS',
      'in_play': 'LIVE',
      'finished': 'FT',
      'postponed': 'PST',
      'cancelled': 'CANC',
      'abandoned': 'ABD',
      'not_played': 'AWA'
    };

    // ✅ Match production: When no status, fetch ALL matches for the date
    if (status && statusMap[status]) {
      params.status = statusMap[status];
      console.log(`   📌 Status filter: ${status} → ${statusMap[status]}`);
    } else if (!status && !dateTime && !seasonYear) {
      // No status AND no date = default to LIVE matches only
      params.live = 'all';
      console.log('   ⚡ No status/date/season → defaulting to LIVE matches');
    }
    // When dateTime is provided but no status = fetch ALL matches for that date
    // When seasonYear is provided = fetch ALL matches for that season
    // This matches production behavior

    // Add team filter to API-Sports params if provided
    let teamIdToFilter = null;
    let teamKeywordToFilter = null;

    // Team keyword search (by name) - will use post-fetch filtering
    if (teamKeyword) {
      teamKeywordToFilter = teamKeyword.trim().toLowerCase();
      console.log(`   🔍 Team keyword filter (post-fetch): "${teamKeyword}"`);
    }
    // Team ID search - can use API-Sports direct filter
    else if (teamId) {
      // Support both formats: "team-123" or "123" or MongoDB ObjectID
      if (teamId.startsWith('team-')) {
        teamIdToFilter = parseInt(teamId.replace('team-', ''));
        params.team = teamIdToFilter;
        console.log(`   👥 Team filter (API-Sports): ${teamId} → team ${teamIdToFilter}`);
      } else if (/^[0-9a-fA-F]{24}$/.test(teamId)) {
        // MongoDB ObjectID format - we'll filter post-fetch by team name/slug
        console.log(`   👥 Team filter (MongoDB ID): ${teamId} - will use post-fetch filtering`);
        teamIdToFilter = teamId;
      } else {
        // Assume it's a plain integer team ID
        teamIdToFilter = parseInt(teamId);
        params.team = teamIdToFilter;
        console.log(`   👥 Team filter (API-Sports): team ${teamIdToFilter}`);
      }
    }

    // Note: Don't filter by league in API-Sports params
    // API-Sports doesn't support combining date + status + league filters well
    // We'll filter after fetching all matches
    let leagueIdToFilter = null;
    if (competitionId) {
      // Extract league ID from competitionId format "league-39" -> 39
      leagueIdToFilter = parseInt(competitionId.replace('league-', ''));
      console.log(`   🏆 Competition filter (post-fetch): ${competitionId} → league ${leagueIdToFilter}`);
    } else if (league) {
      leagueIdToFilter = parseInt(league);
      console.log(`   🏆 League filter (post-fetch): ${leagueIdToFilter}`);
    }

    console.log('   🔍 API-Sports params:', JSON.stringify(params, null, 2));

    // ✅ OPTIMIZATION: Fetch fixtures WITHOUT odds first (fast)
    // We'll fetch odds ONLY for paginated results in the second pass
    let competitions = await fetchFixtures(footballApi, params, false, bookmakerIds, limit);

    // Filter by league after fetching (if requested)
    if (leagueIdToFilter) {
      competitions = competitions.filter(comp => {
        // Extract league ID from competition._id (format: "league-{id}")
        const compLeagueId = parseInt(comp._id.replace('league-', ''));
        return compLeagueId === leagueIdToFilter;
      });
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for league ${leagueIdToFilter}`);
    }

    // Filter by team after fetching (for MongoDB ObjectID teamId)
    if (teamIdToFilter && typeof teamIdToFilter === 'string' && /^[0-9a-fA-F]{24}$/.test(teamIdToFilter)) {
      // For MongoDB ObjectID, filter competitions to only show matches with this team
      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match =>
          match.homeTeam?._id === teamIdToFilter || match.awayTeam?._id === teamIdToFilter
        );
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for team ${teamIdToFilter}`);
    }

    // Filter by team keyword (search by team name)
    if (teamKeywordToFilter) {
      competitions = competitions.map(comp => {
        const filteredMatches = comp.matches.filter(match => {
          // Use detail.home.name and detail.away.name to match production API structure
          const homeTeamName = match.detail?.home?.name?.toLowerCase() || '';
          const awayTeamName = match.detail?.away?.name?.toLowerCase() || '';
          return homeTeamName.includes(teamKeywordToFilter) || awayTeamName.includes(teamKeywordToFilter);
        });
        return { ...comp, matches: filteredMatches };
      }).filter(comp => comp.matches.length > 0);
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for team keyword "${teamKeywordToFilter}"`);
    }

    const { items, pagination } = paginateResults(competitions, offset, limit);

    // ✅ OPTIMIZED: Fetch odds ONLY for paginated results (fast!)
    if (shouldIncludeOdds && items.length > 0) {
      const totalMatches = items.reduce((sum, comp) => sum + comp.matches.length, 0);
      console.log(`\n🎲 Fetching odds for ${totalMatches} PAGINATED matches (cache-first with API fallback)...`);

      // Collect all matches first
      const allMatches = [];
      for (const competition of items) {
        for (const match of competition.matches) {
          allMatches.push({ match, competition });
        }
      }

      // Process in parallel batches of 10 (increased from 5 for faster processing)
      const BATCH_SIZE = 10;
      let processed = 0;
      let cacheHits = 0;
      let apiCalls = 0;
      let errors = 0;

      for (let i = 0; i < allMatches.length; i += BATCH_SIZE) {
        const batch = allMatches.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ({ match, competition }) => {
          const fixtureId = match.id;

          try {
            // Try cache first
            const cachedBookmakers = await oddsCache.getOdds(fixtureId);

            if (cachedBookmakers && cachedBookmakers.length > 0) {
              match.bookmakers = cachedBookmakers;
              cacheHits++;
            } else {
              // Cache miss - fetch from API with fixture data (saves 1 API call per fixture)
              const fixtureData = {
                fixture: { id: fixtureId, date: match.dateTime, status: { short: match.status === 'in_play' ? 'LIVE' : 'NS' } },
                teams: {
                  home: { id: match.homeTeam?.id, name: match.detail?.home?.name || '', logo: match.homeTeam?.image || '' },
                  away: { id: match.awayTeam?.id, name: match.detail?.away?.name || '', logo: match.awayTeam?.image || '' }
                },
                league: {
                  id: parseInt(competition._id.replace('league-', '')),
                  name: competition.name,
                  season: new Date(match.dateTime).getFullYear()
                }
              };

              const odds = await oddsCache.getOrFetchOdds(fixtureId, footballApi, fixtureData);
              match.bookmakers = odds || [];
              apiCalls++;
            }
            processed++;
          } catch (error) {
            console.error(`   ❌ Error fetching odds for fixture ${fixtureId}:`, error.message);
            match.bookmakers = [];
            errors++;
          }
        }));

        // Log progress after each batch
        console.log(`   📊 Progress: ${processed}/${totalMatches} matches (Cache: ${cacheHits}, API: ${apiCalls}, Errors: ${errors})`);
      }

      console.log(`   ✅ Odds fetching complete - ${cacheHits} from cache, ${apiCalls} from API, ${errors} errors`);
    }

    // ✅ NEW: Group by rounds if requested
    if (groupByRound === 'true' && items.length > 0) {
      console.log(`\n📋 Grouping matches by rounds...`);

      // Combine all matches from all competitions
      const allMatches = [];
      for (const competition of items) {
        for (const match of competition.matches || []) {
          allMatches.push({ ...match, competition });
        }
      }

      // Group matches by round
      const roundsMap = new Map();
      for (const match of allMatches) {
        const roundName = match.round || 'Unknown';
        if (!roundsMap.has(roundName)) {
          roundsMap.set(roundName, []);
        }
        roundsMap.get(roundName).push(match);
      }

      // Extract round number from "Regular Season - X"
      const extractRoundLevel = (roundName) => {
        const match = roundName.match(/(\d+)/);
        return match ? parseInt(match[1]) : 999;
      };

      // Convert to array format with roundLevel
      let roundMatches = Array.from(roundsMap.entries()).map(([round, matches]) => ({
        roundLevel: extractRoundLevel(round),
        round: round.replace(' - ', ' '), // "Regular Season - 1" -> "Regular Season 1"
        matches
      }));

      // Sort by round if requested
      if (sortByRound === 'asc') {
        roundMatches.sort((a, b) => a.roundLevel - b.roundLevel);
        console.log(`   ⬆️  Sorted by round (ascending)`);
      } else if (sortByRound === 'desc') {
        roundMatches.sort((a, b) => b.roundLevel - a.roundLevel);
        console.log(`   ⬇️  Sorted by round (descending)`);
      }

      console.log(`   ✅ Grouped into ${roundMatches.length} rounds with ${allMatches.length} total matches`);

      // Return in grouped format (single competition with roundMatches)
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

    // ✅ Standard API response format (matches production)
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
 * GET /api/matches/live
 */
router.get('/live', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    let { offset = 0, limit = 30, competitionId, teamKeyword } = req.query;
    const { shouldIncludeOdds, bookmakerIds } = parseQueryParams(req.query);

    // Parse limit to number
    limit = parseInt(limit) || 30;

    console.log('\n🔴 GET /api/matches/live');
    console.log(`   Params: competitionId=${competitionId}, teamKeyword=${teamKeyword}, includeOdds=${shouldIncludeOdds}, limit=${limit}`);

    const params = {
      timezone: 'Asia/Bangkok',
      live: 'all'
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

    // ✅ OPTIMIZATION: Fetch fixtures WITHOUT odds first (fast)
    let competitions = await fetchFixtures(footballApi, params, false, bookmakerIds, limit);

    // Filter by league after fetching (if requested)
    if (leagueIdToFilter) {
      competitions = competitions.filter(comp => {
        const compLeagueId = parseInt(comp._id.replace('league-', ''));
        return compLeagueId === leagueIdToFilter;
      });
      console.log(`   ✂️  Filtered to ${competitions.length} competitions for league ${leagueIdToFilter}`);
    }

    // Filter by team keyword (search by team name)
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

    const { items, pagination } = paginateResults(competitions, offset, limit);

    // ✅ OPTIMIZED: Fetch odds ONLY for paginated results (fast!)
    if (shouldIncludeOdds && items.length > 0) {
      const totalMatches = items.reduce((sum, comp) => sum + comp.matches.length, 0);
      console.log(`\n🎲 Fetching odds for ${totalMatches} LIVE PAGINATED matches (cache-first with API fallback)...`);

      const allMatches = [];
      for (const competition of items) {
        for (const match of competition.matches) {
          allMatches.push({ match, competition });
        }
      }

      const BATCH_SIZE = 10;
      let processed = 0;
      let cacheHits = 0;
      let apiCalls = 0;
      let errors = 0;

      for (let i = 0; i < allMatches.length; i += BATCH_SIZE) {
        const batch = allMatches.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ({ match, competition }) => {
          const fixtureId = match.id;

          try {
            const cachedBookmakers = await oddsCache.getOdds(fixtureId);

            if (cachedBookmakers && cachedBookmakers.length > 0) {
              match.bookmakers = cachedBookmakers;
              cacheHits++;
            } else {
              const fixtureData = {
                fixture: { id: fixtureId, date: match.dateTime, status: { short: 'LIVE' } },
                teams: {
                  home: { id: match.homeTeam?.id, name: match.detail?.home?.name || '', logo: match.homeTeam?.image || '' },
                  away: { id: match.awayTeam?.id, name: match.detail?.away?.name || '', logo: match.awayTeam?.image || '' }
                },
                league: {
                  id: parseInt(competition._id.replace('league-', '')),
                  name: competition.name,
                  season: new Date(match.dateTime).getFullYear()
                }
              };

              const odds = await oddsCache.getOrFetchOdds(fixtureId, footballApi, fixtureData);
              match.bookmakers = odds || [];
              apiCalls++;
            }
            processed++;
          } catch (error) {
            console.error(`   ❌ Error fetching odds for fixture ${fixtureId}:`, error.message);
            match.bookmakers = [];
            errors++;
          }
        }));

        console.log(`   📊 Progress: ${processed}/${totalMatches} matches (Cache: ${cacheHits}, API: ${apiCalls}, Errors: ${errors})`);
      }

      console.log(`   ✅ Odds fetching complete - ${cacheHits} from cache, ${apiCalls} from API, ${errors} errors`);
    }

    console.log(`✅ Returning ${items.length} live competitions\n`);

    // ✅ Simplified response format (direct data payload)
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
 * GET /api/matches/hot
 * Get hot/featured matches from top 5 leagues (filter from today's matches)
 */
router.get('/hot', async (req, res) => {
  try {
    const { offset = 0, limit = 10 } = req.query;

    console.log('\n🔥 GET /api/matches/hot (MongoDB optimized)');
    const startTime = Date.now();

    // Top 5 leagues only
    const TOP_5_LEAGUES = [
      39,  // Premier League
      140, // La Liga
      135, // Serie A
      78,  // Bundesliga
      61   // Ligue 1
    ];

    // Get today's date range (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`   📊 Querying MongoDB for Top 5 leagues on ${today.toISOString().split('T')[0]}...`);

    // ✅ Query MongoDB directly using compound index { leagueId: 1, matchDate: 1 }
    const cachedMatches = await Odds.find({
      leagueId: { $in: TOP_5_LEAGUES },
      matchDate: { $gte: today, $lt: tomorrow },
      expiresAt: { $gt: new Date() }  // Only valid cache
    })
    .sort({ priority: -1, matchDate: 1 })
    .lean();  // Return plain JavaScript objects for better performance

    console.log(`   ✅ Found ${cachedMatches.length} cached matches from MongoDB`);

    if (cachedMatches.length === 0) {
      console.log(`   ⚠️  No cached matches found for Top 5 leagues today`);
      return res.json({
        items: [],
        hasMore: false
      });
    }

    // Group matches by league
    const groupedByLeague = {};
    const leagueOrder = [];

    for (const oddsDoc of cachedMatches) {
      const leagueId = oddsDoc.leagueId;

      if (!groupedByLeague[leagueId]) {
        // Get league data from POPULAR_LEAGUES
        const leagueData = POPULAR_LEAGUES.find(l => l.id === leagueId) || {};

        // Create competition object
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

      // Transform Odds document to match format
      const statusMap = {
        'live': 'in_play',
        'scheduled': 'scheduled',
        'finished': 'finished',
        'postponed': 'postponed',
        'cancelled': 'cancelled'
      };

      const match = {
        id: oddsDoc.fixtureId,
        name: `${oddsDoc.homeTeam?.name || 'Home'} vs ${oddsDoc.awayTeam?.name || 'Away'}`,
        slug: `${oddsDoc.homeTeam?.name || 'home'}-vs-${oddsDoc.awayTeam?.name || 'away'}`.toLowerCase().replace(/\s+/g, '-'),
        dateTime: oddsDoc.matchDate?.toISOString() || new Date().toISOString(),
        status: statusMap[oddsDoc.matchStatus] || oddsDoc.matchStatus,
        detail: {
          home: {
            id: oddsDoc.homeTeam?.id || 0,
            name: oddsDoc.homeTeam?.name || 'Home Team',
            logo: oddsDoc.homeTeam?.logo || DEFAULT_FALLBACK_IMAGE,
            goal: null,
            halftime: null,
            fulltime: null,
            yellowCards: 0,
            redCards: 0,
            winner: null
          },
          away: {
            id: oddsDoc.awayTeam?.id || 0,
            name: oddsDoc.awayTeam?.name || 'Away Team',
            logo: oddsDoc.awayTeam?.logo || DEFAULT_FALLBACK_IMAGE,
            goal: null,
            halftime: null,
            fulltime: null,
            yellowCards: 0,
            redCards: 0,
            winner: null
          }
        },
        bookmakers: oddsDoc.bookmakers || []
      };

      groupedByLeague[leagueId].matches.push(match);
    }

    // ✅ Apply MatchCache for FINISHED matches to get events/statistics
    console.log(`📊 Checking MatchCache for FINISHED matches...`);

    // Collect all FINISHED match IDs
    const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
    const finishedMatchIds = [];

    for (const leagueId of leagueOrder) {
      const comp = groupedByLeague[leagueId];
      for (const match of comp.matches) {
        // Check if finished using the transformed match data
        const isFinished = match.status === 'finished' ||
                          (match.statusCode && FINISHED_STATUSES.includes(match.statusCode));
        if (isFinished) {
          finishedMatchIds.push(match.id);
        }
      }
    }

    console.log(`   💾 Found ${finishedMatchIds.length} FINISHED matches - checking MatchCache...`);

    // Bulk check MatchCache for finished matches
    let cacheHits = 0;
    if (finishedMatchIds.length > 0) {
      const cacheMap = await matchCache.getBulkCachedMatches(finishedMatchIds);

      // Replace finished matches with cached data (includes events/statistics)
      for (const leagueId of leagueOrder) {
        const comp = groupedByLeague[leagueId];
        for (let i = 0; i < comp.matches.length; i++) {
          const match = comp.matches[i];
          const cachedData = cacheMap.get(match.id);

          if (cachedData) {
            // Preserve bookmakers from Odds collection and merge with cached match data
            comp.matches[i] = {
              ...cachedData,
              bookmakers: match.bookmakers || cachedData.bookmakers || []
            };
            cacheHits++;
          }
        }
      }

      console.log(`   ✅ MatchCache: ${cacheHits}/${finishedMatchIds.length} hits`);
    }

    // Convert to array and filter: show only LIVE matches if any exist
    const competitions = leagueOrder.map(id => {
      const comp = groupedByLeague[id];
      const hasLive = comp.matches?.some(m => m.status === 'in_play');

      if (hasLive) {
        // Only keep LIVE matches when there are LIVE matches
        comp.matches = comp.matches.filter(m => m.status === 'in_play');
      }

      return comp;
    });

    // Sort competitions by priority: LIVE > SCHEDULED > FINISHED
    competitions.sort((a, b) => {
      const getPriority = (comp) => {
        const hasLive = comp.matches?.some(m => m.status === 'in_play');
        const hasScheduled = comp.matches?.some(m => m.status === 'scheduled');
        const hasFinished = comp.matches?.some(m => m.status === 'finished');

        if (hasLive) return 0;
        if (hasScheduled) return 1;
        if (hasFinished) return 2;
        return 3;
      };

      const aPriority = getPriority(a);
      const bPriority = getPriority(b);

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Same priority: sort by earliest match time
      const aTime = a.matches?.[0]?.dateTime || '';
      const bTime = b.matches?.[0]?.dateTime || '';
      return aTime.localeCompare(bTime);
    });

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

/**
 * GET /api/matches/:id/detail
 * Get detailed match information (same as /:id but with different response structure)
 */
router.get('/:id/detail', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;

    console.log(`\n📊 GET /api/matches/${id}/detail`);

    let fixtureId = id;
    let queryParams = {};

    // Check if id is numeric (fixture ID) or a slug
    if (!/^\d+$/.test(id)) {
      // It's a slug, extract timestamp
      console.log(`   🔍 Slug detected, parsing: ${id}`);

      // Extract timestamp from slug (last 13 digits)
      const timestampMatch = id.match(/(\d{13})$/);
      if (!timestampMatch) {
        return res.status(400).json({
          success: false,
          error: 'Invalid slug format - no timestamp found'
        });
      }

      const timestamp = parseInt(timestampMatch[1]);
      const date = new Date(timestamp);

      // Format date as YYYY-MM-DD for API-Sports
      const dateStr = date.toISOString().split('T')[0];
      console.log(`   📅 Extracted date: ${dateStr} from timestamp: ${timestamp}`);

      // Query by date instead of ID
      queryParams = { date: dateStr };

      // We'll need to find the matching fixture from the response
      const fixturesResponse = await footballApi.get('/fixtures', { params: queryParams });
      const fixtures = fixturesResponse.data.response || [];

      console.log(`   🔎 Found ${fixtures.length} fixtures on ${dateStr}`);

      // Extract team names from slug to match the correct fixture
      // Slug format: {country}-{league}-{season}-{homeTeam}-{awayTeam}-{timestamp}
      const slugWithoutTimestamp = id.replace(`-${timestamp}`, '');

      // Function to normalize team names for comparison
      const normalizeTeamName = (name) => {
        return name.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      };

      // Find team names by comparing with fixtures
      let matchedFixture = null;
      let bestMatch = null;
      let bestMatchScore = 0;

      for (const fixture of fixtures) {
        const fixtureTimestamp = new Date(fixture.fixture.date).getTime();
        const timeDiff = Math.abs(fixtureTimestamp - timestamp);

        // Check timestamp (within 5 minutes)
        if (timeDiff < 300000) {
          const homeTeam = normalizeTeamName(fixture.teams.home.name);
          const awayTeam = normalizeTeamName(fixture.teams.away.name);

          // Check if slug contains both team names
          const slugLower = slugWithoutTimestamp.toLowerCase();
          const hasHome = slugLower.includes(homeTeam) || homeTeam.includes(slugLower.split('-').slice(-2, -1)[0]);
          const hasAway = slugLower.includes(awayTeam) || awayTeam.includes(slugLower.split('-').slice(-1)[0]);

          // Score based on timestamp proximity and team name matches
          let score = 0;
          if (timeDiff < 60000) score += 100; // Within 1 minute
          else if (timeDiff < 180000) score += 50; // Within 3 minutes
          else score += 10; // Within 5 minutes

          if (hasHome && hasAway) score += 50;
          else if (hasHome || hasAway) score += 20;

          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatch = fixture;
          }

          // Perfect match: within 1 minute and both teams match
          if (timeDiff < 60000 && hasHome && hasAway) {
            matchedFixture = fixture;
            console.log(`   ✅ Perfect match: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
            break;
          }
        }
      }

      // Use best match if no perfect match found
      if (!matchedFixture && bestMatch) {
        matchedFixture = bestMatch;
        console.log(`   ✅ Best match (score ${bestMatchScore}): ${bestMatch.teams.home.name} vs ${bestMatch.teams.away.name}`);
      }

      if (!matchedFixture) {
        return res.status(404).json({
          success: false,
          error: 'Match not found for the given slug',
          debug: { timestamp, dateStr, fixturesCount: fixtures.length }
        });
      }

      // Use the matched fixture ID
      fixtureId = matchedFixture.fixture.id;
      console.log(`   🎯 Resolved to fixture ID: ${fixtureId}`);
    }

    // Fetch fixture data and events in parallel (now using resolved fixtureId)
    const [fixtureResponse, eventsResponse] = await Promise.all([
      footballApi.get('/fixtures', { params: { id: fixtureId } }),
      footballApi.get('/fixtures/events', { params: { fixture: fixtureId } })
    ]);

    const fixture = fixtureResponse.data.response[0];
    if (!fixture) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    console.log(`   ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);

    // Merge events into fixture object
    // API-Sports /fixtures/events returns array of events directly
    const events = eventsResponse.data.response || [];
    fixture.events = events;
    console.log(`   📝 Found ${fixture.events.length} events`);

    // Use mock odds for fast testing
    const match = transformToMatchFormat(fixture, [], [], true);

    res.json({
      success: true,
      data: match
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match detail',
      message: error.message
    });
  }
});

/**
 * GET /api/matches/:id/odds
 * Get only odds data for a specific match
 */
router.get('/:id/odds', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;
    const { bookmakerIds } = parseQueryParams(req.query);

    console.log(`\n🎰 GET /api/matches/${id}/odds`);

    const oddsData = await fetchOddsForFixture(footballApi, id, bookmakerIds);

    const bookmakers = oddsData[0]?.bookmakers || [];

    res.json({
      success: true,
      data: {
        fixtureId: id,
        bookmakers: bookmakers
      },
      meta: {
        bookmakerCount: bookmakers.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch odds',
      message: error.message
    });
  }
});

/**
 * GET /api/matches/:id/forms
 * Get team form data for a specific match
 */
router.get('/:id/forms', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;

    console.log(`\n📈 GET /api/matches/${id}/forms`);

    // Get match details first
    const fixtureResponse = await footballApi.get('/fixtures', {
      params: { id }
    });

    const fixture = fixtureResponse.data.response[0];
    if (!fixture) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    const homeTeamId = fixture.teams.home.id;
    const awayTeamId = fixture.teams.away.id;
    const leagueId = fixture.league.id;
    const season = fixture.league.season;

    console.log(`   ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);

    // Fetch last 5 matches for each team
    const [homeMatches, awayMatches] = await Promise.all([
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

    const transformForm = (matches, teamId) => {
      return matches.map(match => ({
        id: match.fixture.id,
        date: match.fixture.date,
        opponent: match.teams.home.id === teamId
          ? { name: match.teams.away.name, logo: match.teams.away.logo }
          : { name: match.teams.home.name, logo: match.teams.home.logo },
        isHome: match.teams.home.id === teamId,
        score: `${match.goals.home}-${match.goals.away}`,
        result: match.teams.home.id === teamId
          ? (match.teams.home.winner ? 'W' : match.teams.away.winner ? 'L' : 'D')
          : (match.teams.away.winner ? 'W' : match.teams.home.winner ? 'L' : 'D')
      }));
    };

    res.json({
      success: true,
      data: {
        home: {
          team: {
            id: homeTeamId,
            name: fixture.teams.home.name,
            logo: fixture.teams.home.logo
          },
          form: transformForm(homeMatches.data.response, homeTeamId)
        },
        away: {
          team: {
            id: awayTeamId,
            name: fixture.teams.away.name,
            logo: fixture.teams.away.logo
          },
          form: transformForm(awayMatches.data.response, awayTeamId)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team forms',
      message: error.message
    });
  }
});

/**
 * GET /api/matches/h2h
 * Get head-to-head matches and recent matches for both teams
 */
router.get('/h2h', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    // Support both homeTeamId/awayTeamId (frontend) and homeTeam/awayTeam (legacy)
    const { homeTeamId, awayTeamId, homeTeam, awayTeam, limit = 10 } = req.query;

    const home = homeTeamId || homeTeam;
    const away = awayTeamId || awayTeam;

    if (!home || !away) {
      return res.status(400).json({
        success: false,
        error: 'Both homeTeamId and awayTeamId parameters are required'
      });
    }

    // Extract numeric IDs from "team-XXXX" format if present
    const homeId = typeof home === 'string' && home.startsWith('team-')
      ? home.replace('team-', '')
      : home;
    const awayId = typeof away === 'string' && away.startsWith('team-')
      ? away.replace('team-', '')
      : away;

    console.log(`\n🥊 GET /api/matches/h2h`);
    console.log(`   Teams: ${home} vs ${away} (extracted IDs: ${homeId}, ${awayId})`);

    // Fetch H2H matches and recent matches for both teams in parallel
    const [h2hResponse, homeMatchesResponse, awayMatchesResponse] = await Promise.all([
      footballApi.get('/fixtures/headtohead', {
        params: {
          h2h: `${homeId}-${awayId}`,
          last: parseInt(limit)
        }
      }),
      footballApi.get('/fixtures', {
        params: {
          team: homeId,
          last: parseInt(limit)
        }
      }),
      footballApi.get('/fixtures', {
        params: {
          team: awayId,
          last: parseInt(limit)
        }
      })
    ]);

    const h2hMatches = h2hResponse.data.response || [];
    const lastHomeMatches = homeMatchesResponse.data.response || [];
    const lastAwayMatches = awayMatchesResponse.data.response || [];

    // Transform to match TH2HDetail format
    const transformH2HMatch = (fixture) => {
      const match = transformToMatchFormat(fixture, [], [], false);
      // Add form result for the match
      const homeWin = fixture.teams.home.winner === true;
      const awayWin = fixture.teams.away.winner === true;
      const draw = fixture.teams.home.winner === null && fixture.teams.away.winner === null;

      return {
        matchSlug: match.slug,
        dateTime: match.dateTime,
        competition: {
          code: match.competition?.code || '',
          name: match.competition?.name || ''
        },
        country: {
          image: match.competition?.country?.image || ''
        },
        home: {
          teamId: `team-${fixture.teams.home.id}`,
          name: fixture.teams.home.name,
          image: fixture.teams.home.logo,
          score: fixture.goals.home
        },
        away: {
          teamId: `team-${fixture.teams.away.id}`,
          name: fixture.teams.away.name,
          image: fixture.teams.away.logo,
          score: fixture.goals.away
        },
        form: homeWin ? 'W' : (awayWin ? 'L' : (draw ? 'D' : null))
      };
    };

    console.log(`✅ Found ${h2hMatches.length} H2H matches, ${lastHomeMatches.length} home matches, ${lastAwayMatches.length} away matches\n`);

    res.json({
      success: true,
      data: {
        h2hMatches: h2hMatches.map(transformH2HMatch),
        lastHomeMatches: lastHomeMatches.map(transformH2HMatch),
        lastAwayMatches: lastAwayMatches.map(transformH2HMatch)
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch H2H matches',
      message: error.message
    });
  }
});

/**
 * GET /api/matches/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const footballApi = req.app.locals.footballApi;
    const { id } = req.params;
    const { shouldIncludeOdds, bookmakerIds } = parseQueryParams(req.query);

    console.log(`\n📊 GET /api/matches/${id}`);
    console.log(`   includeOdds: ${shouldIncludeOdds}`);

    const fixtureResponse = await footballApi.get('/fixtures', {
      params: { id }
    });

    const fixture = fixtureResponse.data.response[0];
    if (!fixture) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    console.log(`   ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);

    // Fetch odds
    let oddsData = [];
    if (shouldIncludeOdds) {
      oddsData = await fetchOddsForFixture(footballApi, id, bookmakerIds);
    }

    // Use mock odds for fast testing (Option 1)
    const match = transformToMatchFormat(fixture, oddsData, [], true);
    const leagueData = POPULAR_LEAGUES.find(l => l.id === fixture.league.id) || {};
    const competition = buildCompetitionObject(fixture, leagueData);
    competition.matches = [match];

    const oddsCount = oddsData[0]?.bookmakers?.length || 0;
    console.log(`✅ Response ready (${oddsCount} bookmakers)\n`);

    res.json({
      success: true,
      data: competition,
      meta: {
        includeOdds: shouldIncludeOdds,
        bookmakers: shouldIncludeOdds ? bookmakerIds : [],
        oddsAvailable: oddsCount > 0
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match details',
      message: error.message
    });
  }
});

/**
 * DELETE /api/matches/cache/odds
 */
router.delete('/cache/odds', (req, res) => {
  const size = oddsCache.size;
  oddsCache.clear();
  console.log(`🗑️  Cleared ${size} odds cache entries`);
  res.json({
    success: true,
    message: `Cleared ${size} odds cache entries`
  });
});

/**
 * POST /api/matches/cache/populate
 * Manually populate MongoDB cache with odds for specific leagues
 *
 * Request body:
 * {
 *   "leagueIds": [39, 140, 135],  // Array of league IDs
 *   "seasonYear": 2024,            // Optional, defaults to current year
 *   "force": false                 // Optional, force re-cache even if exists
 * }
 */
router.post('/cache/populate', async (req, res) => {
  try {
    const oddsSyncJob = require('../services/oddsSyncJob');
    const { leagueIds, seasonYear, force = false } = req.body;

    if (!leagueIds || !Array.isArray(leagueIds) || leagueIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'leagueIds array is required and must not be empty'
      });
    }

    const year = seasonYear || 2024; // Use 2024 for 2024-2025 season
    const results = [];

    console.log(`\n📊 Manual cache population requested for ${leagueIds.length} leagues`);
    console.log(`   Season: ${year}, Force: ${force}`);

    for (const leagueId of leagueIds) {
      console.log(`\n💾 Processing league ${leagueId}...`);

      try {
        // Check if league already has cached data (unless force=true)
        if (!force) {
          const stats = await oddsCache.getStats();
          console.log(`   Current cache has ${stats.total} total entries`);
        }

        await oddsSyncJob.preCacheLeague(leagueId, year);

        results.push({
          leagueId,
          status: 'success',
          message: 'Cache populated successfully'
        });

      } catch (error) {
        console.error(`   ❌ Failed to cache league ${leagueId}:`, error.message);
        results.push({
          leagueId,
          status: 'error',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'error').length;

    console.log(`\n✅ Cache population complete: ${successCount} success, ${failCount} failed`);

    res.json({
      success: true,
      message: `Cache population complete: ${successCount}/${leagueIds.length} leagues cached`,
      results,
      summary: {
        total: leagueIds.length,
        success: successCount,
        failed: failCount
      }
    });

  } catch (error) {
    console.error('❌ Error in cache population:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to populate cache',
      message: error.message
    });
  }
});

/**
 * GET /api/matches/cache/stats
 * Get current cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = await oddsCache.getStats();
    const oddsSyncJob = require('../services/oddsSyncJob');
    const jobStats = oddsSyncJob.getStats();

    res.json({
      success: true,
      data: {
        cache: stats,
        syncJob: jobStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;