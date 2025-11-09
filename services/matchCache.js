const MatchCache = require('../models/MatchCache');
const { transformToMatchFormat } = require('../utils/transformers');

class MatchCacheService {

  /**
   * Get cached match data
   * @param {number} fixtureId - Fixture ID
   * @returns {Promise<Object|null>} - Cached match data or null
   */
  async getCachedMatch(fixtureId) {
    try {
      const cached = await MatchCache.findByFixtureId(fixtureId);

      if (!cached) {
        console.log(`   [MatchCache] Miss for fixture ${fixtureId} - not in cache`);
        return null;
      }

      if (!cached.isValid()) {
        console.log(`   [MatchCache] Miss for fixture ${fixtureId} - expired`);
        await cached.deleteOne();
        return null;
      }

      console.log(`   [MatchCache] ✓ Hit for fixture ${fixtureId}`);
      return cached.matchData;

    } catch (error) {
      console.error(`[MatchCache] Error getting cache for fixture ${fixtureId}:`, error.message);
      return null;
    }
  }

  /**
   * Get multiple cached matches
   * @param {number[]} fixtureIds - Array of fixture IDs
   * @returns {Promise<Map>} - Map of fixtureId -> matchData
   */
  async getBulkCachedMatches(fixtureIds) {
    try {
      const cacheMap = await MatchCache.findByFixtureIds(fixtureIds);
      console.log(`   [MatchCache] Bulk fetch: ${cacheMap.size}/${fixtureIds.length} fixtures found in cache`);
      return cacheMap;
    } catch (error) {
      console.error('[MatchCache] Error in bulk fetch:', error.message);
      return new Map();
    }
  }

  /**
   * Cache a finished match
   * @param {Object} fixtureData - Raw fixture data from API-Sports
   * @param {Array} eventsData - Events data
   * @param {Array} statisticsData - Statistics data
   * @param {Array} oddsData - Odds data (optional)
   * @returns {Promise<Object>} - Saved cache document
   */
  async cacheFinishedMatch(fixtureData, eventsData = [], statisticsData = [], oddsData = []) {
    try {
      const { fixture, teams, league } = fixtureData;

      // Check if match is actually finished
      const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
      if (!FINISHED_STATUSES.includes(fixture.status?.short)) {
        console.log(`   [MatchCache] Skipping cache - match ${fixture.id} not finished (${fixture.status?.short})`);
        return null;
      }

      // Transform match data with events/statistics
      const fullFixture = {
        ...fixtureData,
        events: eventsData,
        statistics: statisticsData
      };

      const matchData = transformToMatchFormat(fullFixture, oddsData, statisticsData);

      // Check if already cached
      let cachedMatch = await MatchCache.findByFixtureId(fixture.id);

      if (cachedMatch) {
        // Update existing cache
        await cachedMatch.updateMatchData(matchData);
        console.log(`   [MatchCache] ✓ Updated cache for finished match ${fixture.id}`);
      } else {
        // Create new cache
        cachedMatch = new MatchCache({
          fixtureId: fixture.id,
          leagueId: league.id,
          leagueName: league.name,
          seasonYear: league.season,
          matchDate: new Date(fixture.date),
          matchStatus: 'finished',
          statusCode: fixture.status?.short,
          matchData: matchData,
          expiresAt: this.calculateExpiryTime(),
          source: 'api'
        });

        await cachedMatch.save();
        console.log(`   [MatchCache] ✓ Cached finished match ${fixture.id}`);
      }

      return cachedMatch;

    } catch (error) {
      console.error('[MatchCache] Error caching match:', error.message);
      throw error;
    }
  }

  /**
   * Bulk cache multiple finished matches
   * @param {Array} matchesData - Array of {fixtureData, eventsData, statisticsData, oddsData}
   * @returns {Promise<number>} - Number of successfully cached matches
   */
  async bulkCacheFinishedMatches(matchesData) {
    let cached = 0;

    for (const data of matchesData) {
      try {
        await this.cacheFinishedMatch(
          data.fixtureData,
          data.eventsData,
          data.statisticsData,
          data.oddsData
        );
        cached++;
      } catch (error) {
        console.error(`[MatchCache] Failed to cache fixture ${data.fixtureData.fixture.id}:`, error.message);
      }
    }

    console.log(`   [MatchCache] Bulk cache: ${cached}/${matchesData.length} successful`);
    return cached;
  }

  /**
   * Get or fetch finished match
   * @param {number} fixtureId - Fixture ID
   * @param {Object} footballApi - FootballApi instance
   * @returns {Promise<Object|null>} - Match data
   */
  async getOrFetchFinishedMatch(fixtureId, footballApi) {
    try {
      // Try cache first
      const cachedMatch = await this.getCachedMatch(fixtureId);
      if (cachedMatch) {
        return cachedMatch;
      }

      // Cache miss - fetch from API
      console.log(`   [MatchCache] Fetching finished match ${fixtureId} from API...`);

      // Fetch fixture details
      const fixtureResponse = await footballApi.get('/fixtures', { params: { id: fixtureId } });
      const fixtureData = fixtureResponse.data?.response?.[0];

      if (!fixtureData) {
        console.log(`   [MatchCache] Fixture ${fixtureId} not found in API`);
        return null;
      }

      // Check if finished
      const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
      if (!FINISHED_STATUSES.includes(fixtureData.fixture.status?.short)) {
        console.log(`   [MatchCache] Fixture ${fixtureId} not finished yet`);
        return null;
      }

      // Fetch events and statistics
      const [eventsResponse, statisticsResponse] = await Promise.all([
        footballApi.get('/fixtures/events', { params: { fixture: fixtureId } }),
        footballApi.get('/fixtures/statistics', { params: { fixture: fixtureId } })
      ]);

      const eventsData = eventsResponse.data?.response || [];
      const statisticsData = statisticsResponse.data?.response || [];

      // Cache it
      await this.cacheFinishedMatch(fixtureData, eventsData, statisticsData);

      // Transform and return
      const fullFixture = {
        ...fixtureData,
        events: eventsData,
        statistics: statisticsData
      };

      return transformToMatchFormat(fullFixture, [], statisticsData);

    } catch (error) {
      console.error(`[MatchCache] Error in getOrFetchFinishedMatch for ${fixtureId}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate expiry time for cached matches (30 days)
   */
  calculateExpiryTime() {
    const now = new Date();
    const expiryDays = 30;
    return new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Clear expired cache entries
   * @returns {Promise<number>} - Number of deleted entries
   */
  async clearExpired() {
    try {
      const result = await MatchCache.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      console.log(`   [MatchCache] Cleared ${result.deletedCount} expired entries`);
      return result.deletedCount;
    } catch (error) {
      console.error('[MatchCache] Error clearing expired cache:', error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} - Cache stats
   */
  async getStats() {
    try {
      const total = await MatchCache.countDocuments();
      const finished = await MatchCache.countDocuments({ matchStatus: 'finished' });

      const oldestCache = await MatchCache.findOne().sort({ matchDate: 1 });
      const newestCache = await MatchCache.findOne().sort({ matchDate: -1 });

      return {
        total,
        finished,
        oldestMatchDate: oldestCache?.matchDate,
        newestMatchDate: newestCache?.matchDate
      };
    } catch (error) {
      console.error('[MatchCache] Error getting stats:', error.message);
      return null;
    }
  }
}

module.exports = new MatchCacheService();
