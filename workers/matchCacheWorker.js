const axios = require('axios');
const CachedMatch = require('../models/CachedMatch');
const { getAllowedLeagueIdsString, getHotLeagueIds } = require('../config/allowedCompetitions');
const oddsCache = require('../services/oddsCache');

/**
 * Background worker to fetch and cache match data
 * Reduces API load by pre-fetching and caching frequently accessed data
 *
 * OPTIMIZED: Only fetches matches from competitions defined in allowedCompetitions config
 * This reduces API calls and storage significantly
 */

class MatchCacheWorker {
  constructor() {
    this.footballApi = null;
    this.intervals = {
      live: null,              // 30s for live matches
      hot: null,               // 1 minute for hot matches
      hotScheduledOdds: null,  // 10 minutes for hot scheduled matches with odds
      liveScheduled: null      // 5 minutes for live+scheduled matches
    };
    this.isRunning = false;
  }

  /**
   * Initialize the worker with API credentials
   */
  init(apiKey, apiHost) {
    this.footballApi = axios.create({
      baseURL: 'https://v3.football.api-sports.io',
      headers: {
        'x-apisports-key': apiKey,
        'x-apisports-host': apiHost || 'v3.football.api-sports.io'
      },
      timeout: 30000
    });

    console.log('✅ MatchCacheWorker initialized');
  }

  /**
   * Start the background worker
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  MatchCacheWorker is already running');
      return;
    }

    if (!this.footballApi) {
      throw new Error('Worker not initialized. Call init() first.');
    }

    this.isRunning = true;
    console.log('🚀 Starting MatchCacheWorker...');

    // Initial fetch for all cache types
    await this.refreshLiveMatches();
    await this.refreshHotMatches();
    await this.refreshHotScheduledOdds();  // NEW: Fetch scheduled matches from top 5 leagues
    await this.refreshLiveScheduledMatches();

    // Schedule periodic refreshes
    // LIVE matches: Every 30 seconds (most dynamic)
    this.intervals.live = setInterval(async () => {
      await this.refreshLiveMatches();
    }, 30000);

    // HOT matches: Every 1 minute
    this.intervals.hot = setInterval(async () => {
      await this.refreshHotMatches();
    }, 60000);

    // HOT Scheduled Odds: Every 10 minutes (fetches from API-Sports with odds)
    this.intervals.hotScheduledOdds = setInterval(async () => {
      await this.refreshHotScheduledOdds();
    }, 600000);

    // LIVE + SCHEDULED matches: Every 5 minutes
    this.intervals.liveScheduled = setInterval(async () => {
      await this.refreshLiveScheduledMatches();
    }, 300000);

    console.log('✅ MatchCacheWorker started successfully');
    console.log('   🔴 LIVE matches: refreshing every 30s');
    console.log('   🔥 HOT matches: refreshing every 1min');
    console.log('   🔥📅 HOT Scheduled Odds: refreshing every 10min');
    console.log('   📅 LIVE+SCHEDULED: refreshing every 5min');
  }

  /**
   * Stop the background worker
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  MatchCacheWorker is not running');
      return;
    }

    console.log('🛑 Stopping MatchCacheWorker...');

    // Clear all intervals
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });

    this.isRunning = false;
    console.log('✅ MatchCacheWorker stopped');
  }

  /**
   * Fetch and cache LIVE matches
   * OPTIMIZED: Only fetches matches from allowed competitions
   */
  async refreshLiveMatches() {
    const startTime = Date.now();
    const cacheKey = 'live_all';

    try {
      const allowedLeagues = getAllowedLeagueIdsString();
      console.log(`🔴 Fetching LIVE matches from ${allowedLeagues.split(',').length} allowed leagues...`);

      const response = await this.footballApi.get('/fixtures', {
        params: {
          live: 'all',
          league: allowedLeagues  // FILTER: Only fetch from allowed leagues
        }
      });

      const fixtures = response.data.response || [];
      console.log(`   📥 Fetched ${fixtures.length} live fixtures`);

      if (fixtures.length > 0) {
        // Group by league
        const competitions = this.groupFixturesByLeague(fixtures);

        // Cache the result
        await CachedMatch.setCache('live', cacheKey, {
          items: competitions,
          hasMore: false,
          fetchedAt: new Date().toISOString(),
          count: competitions.length
        });

        const duration = Date.now() - startTime;
        console.log(`   ✅ Cached ${competitions.length} live competitions (${duration}ms)`);
      } else {
        console.log('   ⚠️  No live matches found');
      }

    } catch (error) {
      console.error(`   ❌ Failed to refresh live matches:`, error.message);
    }
  }

  /**
   * Fetch and cache HOT matches
   * OPTIMIZED: Uses top-tier leagues from config
   * LIMITED: Only fetches matches within 4 days from today
   */
  async refreshHotMatches() {
    const startTime = Date.now();
    const cacheKey = 'hot_all';

    try {
      const hotLeagueIds = getHotLeagueIds();
      console.log(`🔥 Fetching HOT matches from top ${hotLeagueIds.length} leagues (4 days window)...`);

      // Calculate current season dynamically
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentSeason = today.getMonth() >= 7 ? currentYear : currentYear - 1;

      // ✅ Calculate 4-day window
      const fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date();
      toDate.setDate(toDate.getDate() + 4);
      toDate.setHours(23, 59, 59, 999);

      const fromStr = fromDate.toISOString().split('T')[0];
      const toStr = toDate.toISOString().split('T')[0];

      console.log(`   📅 Date range: ${fromStr} to ${toStr}`);

      // Fetch matches for each league separately within 4-day window
      const allFixtures = [];

      for (const leagueId of hotLeagueIds) {
        try {
          // ✅ Fetch matches in 4-day window using from/to parameters
          const response = await this.footballApi.get('/fixtures', {
            params: {
              league: leagueId,
              season: currentSeason,
              from: fromStr,
              to: toStr,
              timezone: 'UTC'
            }
          });

          const fixtures = response.data.response || [];
          allFixtures.push(...fixtures);
        } catch (leagueError) {
          console.error(`   ❌ Failed to fetch league ${leagueId}:`, leagueError.message);
        }
      }

      console.log(`   📥 Fetched ${allFixtures.length} hot fixtures within 4-day window`);

      if (allFixtures.length > 0) {
        // Deduplicate by fixture ID
        const fixtureMap = new Map();
        allFixtures.forEach(f => {
          fixtureMap.set(f.fixture.id, f);
        });

        const uniqueFixtures = Array.from(fixtureMap.values());
        const competitions = this.groupFixturesByLeague(uniqueFixtures);

        await CachedMatch.setCache('hot', cacheKey, {
          items: competitions,
          hasMore: false,
          fetchedAt: new Date().toISOString(),
          count: competitions.length
        });

        const duration = Date.now() - startTime;
        console.log(`   ✅ Cached ${competitions.length} hot competitions with ${uniqueFixtures.length} matches (${duration}ms)`);
      } else {
        console.log('   ⚠️  No hot matches found');
      }

    } catch (error) {
      console.error(`   ❌ Failed to refresh hot matches:`, error.message);
    }
  }

  /**
   * Fetch and cache SCHEDULED matches from TOP 5 leagues for the /hot endpoint
   * This populates the Odds collection with upcoming matches from biggest leagues
   * OPTIMIZED: Only fetches Premier League, La Liga, Serie A, Bundesliga, Ligue 1
   * LIMITED: Only fetches matches within 4 days from today
   */
  async refreshHotScheduledOdds() {
    const startTime = Date.now();

    try {
      // TOP 5 biggest leagues (excluding UEFA competitions)
      const top5Leagues = [
        39,  // Premier League
        140, // La Liga
        135, // Serie A
        78,  // Bundesliga
        61,  // Ligue 1
      ];

      console.log(`🔥📅 Fetching SCHEDULED matches from TOP 5 leagues for next 4 days...`);

      // ✅ Calculate date range: today to 4 days ahead (matching refreshHotMatches)
      const today = new Date();
      const fourDaysAhead = new Date(today);
      fourDaysAhead.setDate(today.getDate() + 4);

      const dateFrom = today.toISOString().split('T')[0];
      const dateTo = fourDaysAhead.toISOString().split('T')[0];

      let totalFixturesFetched = 0;
      let totalFixturesSaved = 0;

      // Fetch matches for each league separately to avoid API limits
      for (const leagueId of top5Leagues) {
        try {
          console.log(`   📥 Fetching league ${leagueId}...`);

          const response = await this.footballApi.get('/fixtures', {
            params: {
              league: leagueId,
              from: dateFrom,
              to: dateTo,
              status: 'NS',  // Not Started (scheduled matches only)
              timezone: 'Asia/Bangkok'
            }
          });

          const fixtures = response.data.response || [];
          console.log(`      ✓ Found ${fixtures.length} scheduled matches for league ${leagueId}`);
          totalFixturesFetched += fixtures.length;

          // Fetch odds for each fixture and save to Odds collection
          for (const fixture of fixtures) {
            try {
              // Fetch odds for this fixture
              const oddsResponse = await this.footballApi.get('/odds', {
                params: { fixture: fixture.fixture.id }
              });

              const oddsData = oddsResponse.data?.response || [];

              if (oddsData && oddsData.length > 0) {
                // Save to Odds collection using oddsCache service
                await oddsCache.saveOdds(fixture, oddsData);
                totalFixturesSaved++;
              } else {
                console.log(`      ⚠️  No odds available for fixture ${fixture.fixture.id}`);
              }

              // Small delay to avoid rate limiting (100ms between calls)
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (fixtureError) {
              console.error(`      ❌ Failed to fetch/save odds for fixture ${fixture.fixture.id}:`, fixtureError.message);
            }
          }

        } catch (leagueError) {
          console.error(`   ❌ Failed to fetch league ${leagueId}:`, leagueError.message);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`   ✅ HOT Scheduled Odds: Fetched ${totalFixturesFetched} fixtures, saved ${totalFixturesSaved} to Odds collection (${Math.round(duration / 1000)}s)`);

    } catch (error) {
      console.error(`   ❌ Failed to refresh hot scheduled odds:`, error.message);
    }
  }

  /**
   * Fetch and cache LIVE + SCHEDULED matches for today
   * OPTIMIZED: Only fetches matches from allowed competitions
   */
  async refreshLiveScheduledMatches() {
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `live-scheduled_${today}`;

    try {
      const allowedLeagues = getAllowedLeagueIdsString();
      console.log(`📅 Fetching LIVE + SCHEDULED matches from ${allowedLeagues.split(',').length} allowed leagues...`);

      // Fetch LIVE matches (filtered by allowed leagues)
      const liveResponse = await this.footballApi.get('/fixtures', {
        params: {
          live: 'all',
          timezone: 'Asia/Bangkok',  // Use consistent timezone with main endpoint
          league: allowedLeagues  // FILTER: Only allowed leagues
        }
      });

      // Fetch SCHEDULED matches for today (filtered by allowed leagues)
      const scheduledResponse = await this.footballApi.get('/fixtures', {
        params: {
          date: today,
          status: 'NS', // Not Started
          timezone: 'Asia/Bangkok',  // Use consistent timezone with main endpoint
          league: allowedLeagues  // FILTER: Only allowed leagues
        }
      });

      const liveFixtures = liveResponse.data.response || [];
      const scheduledFixtures = scheduledResponse.data.response || [];

      console.log(`   📥 Fetched ${liveFixtures.length} LIVE + ${scheduledFixtures.length} SCHEDULED fixtures`);

      // Combine and deduplicate
      const fixtureMap = new Map();
      [...liveFixtures, ...scheduledFixtures].forEach(f => {
        fixtureMap.set(f.fixture.id, f);
      });

      const allFixtures = Array.from(fixtureMap.values());
      const competitions = this.groupFixturesByLeague(allFixtures);

      await CachedMatch.setCache('live-scheduled', cacheKey, {
        items: competitions,
        hasMore: false,
        fetchedAt: new Date().toISOString(),
        count: competitions.length
      });

      const duration = Date.now() - startTime;
      console.log(`   ✅ Cached ${competitions.length} live+scheduled competitions (${duration}ms)`);

    } catch (error) {
      console.error(`   ❌ Failed to refresh live+scheduled matches:`, error.message);
    }
  }

  /**
   * Group fixtures by league (simplified version)
   */
  groupFixturesByLeague(fixtures) {
    const grouped = {};
    const DEFAULT_FALLBACK_IMAGE = 'https://media.api-sports.io/football/teams/5297.png';

    fixtures.forEach(fixture => {
      const leagueId = fixture.league?.id;
      if (!leagueId) return;

      if (!grouped[leagueId]) {
        grouped[leagueId] = {
          _id: `league-${leagueId}`,
          code: fixture.league.name.substring(0, 7).toUpperCase().replace(/\s/g, ''),
          image: fixture.league.logo || DEFAULT_FALLBACK_IMAGE,
          logo: fixture.league.logo || DEFAULT_FALLBACK_IMAGE,
          name: fixture.league.name,
          seq: 1000,
          tier: 4,
          slug: fixture.league.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          country: {
            _id: `country-${fixture.league.country}`,
            code: fixture.league.country === 'World' ? 'INT' : fixture.league.country.substring(0, 2).toUpperCase(),
            image: fixture.league.flag || `https://flagicons.lipis.dev/flags/4x3/${fixture.league.country.toLowerCase().substring(0, 2)}.svg`,
            name: fixture.league.country,
            slug: fixture.league.country.toLowerCase().replace(/\s+/g, '-')
          },
          matches: []
        };
      }

      // Generate slug with timestamp
      const timestamp = fixture.fixture?.timestamp * 1000;
      const slugBase = `${fixture.teams?.home?.name || 'home'}-vs-${fixture.teams?.away?.name || 'away'}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const slugWithTimestamp = `${slugBase}-${timestamp}`;

      // Match data structure matching routes/matches.js format
      const match = {
        _id: `match-${fixture.fixture.id}`,
        id: fixture.fixture.id,
        fixtureId: fixture.fixture.id,
        name: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
        slug: slugWithTimestamp,
        dateTime: new Date(timestamp).toISOString(),
        status: this.mapStatus(fixture.fixture.status.short),
        statusCode: fixture.fixture.status.short,
        score: `${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`,
        elapsed: fixture.fixture.status.elapsed?.toString() || '',
        extra: '',
        competition: {
          _id: `league-${leagueId}`,
          name: fixture.league.name,
          logo: fixture.league.logo || DEFAULT_FALLBACK_IMAGE
        },
        detail: {
          home: {
            id: fixture.teams.home.id,
            teamId: fixture.teams.home.id.toString(),
            name: fixture.teams.home.name,
            logo: fixture.teams.home.logo || DEFAULT_FALLBACK_IMAGE,
            goal: fixture.goals.home,
            halftime: fixture.score.halftime?.home,
            fulltime: fixture.goals.home,
            yellowCards: 0,
            redCards: 0,
            winner: fixture.teams.home.winner
          },
          away: {
            id: fixture.teams.away.id,
            teamId: fixture.teams.away.id.toString(),
            name: fixture.teams.away.name,
            logo: fixture.teams.away.logo || DEFAULT_FALLBACK_IMAGE,
            goal: fixture.goals.away,
            halftime: fixture.score.halftime?.away,
            fulltime: fixture.goals.away,
            yellowCards: 0,
            redCards: 0,
            winner: fixture.teams.away.winner
          }
        },
        events: [],
        bookmakers: []
      };

      grouped[leagueId].matches.push(match);
    });

    return Object.values(grouped);
  }

  /**
   * Map API-Football status codes to internal status
   */
  mapStatus(statusShort) {
    const statusMap = {
      'TBD': 'scheduled', 'NS': 'scheduled', 'CANC': 'cancelled', 'PST': 'postponed',
      '1H': 'in_play', 'HT': 'in_play', '2H': 'in_play', 'ET': 'in_play',
      'BT': 'in_play', 'P': 'in_play', 'SUSP': 'in_play', 'INT': 'in_play',
      'LIVE': 'in_play', 'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
      'ABD': 'abandoned', 'AWD': 'awarded', 'WO': 'walkover'
    };
    return statusMap[statusShort] || 'scheduled';
  }

  /**
   * Get worker statistics
   */
  async getStats() {
    return await CachedMatch.getCacheStats();
  }

  /**
   * Clear all cache
   */
  async clearCache() {
    const types = ['live', 'hot', 'live-scheduled'];
    let totalCleared = 0;

    for (const type of types) {
      const count = await CachedMatch.clearCacheByType(type);
      totalCleared += count;
    }

    console.log(`🗑️  Cleared ${totalCleared} total cache entries`);
    return totalCleared;
  }
}

// Export singleton instance
const matchCacheWorker = new MatchCacheWorker();

module.exports = matchCacheWorker;
