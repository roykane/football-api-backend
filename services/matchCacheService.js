const CachedMatch = require('../models/CachedMatch');

/**
 * Service to help endpoints use MongoDB cache
 * Provides a simple interface for cache-first data fetching
 */
class MatchCacheService {
  /**
   * Get data from cache or fallback to API fetch function
   * @param {string} cacheType - Type of cache ('live', 'hot', 'live-scheduled')
   * @param {string} cacheKey - Unique key for this cache entry
   * @param {Function} fetchFn - Async function to fetch data if cache misses
   * @param {number} maxAge - Max age in milliseconds before cache is considered stale
   * @returns {Promise<{data: any, fromCache: boolean}>}
   */
  async getOrFetch(cacheType, cacheKey, fetchFn, maxAge = 60000) {
    try {
      // Try to get from cache first
      const cached = await CachedMatch.getCache(cacheType, cacheKey);

      if (cached) {
        // Check if cache is still fresh
        const cacheAge = Date.now() - new Date(cached.fetchedAt).getTime();

        if (cacheAge < maxAge) {
          console.log(`✅ Using cached data (age: ${Math.round(cacheAge / 1000)}s)`);
          return {
            data: cached,
            fromCache: true
          };
        } else {
          console.log(`⚠️  Cache stale (age: ${Math.round(cacheAge / 1000)}s), fetching fresh data...`);
        }
      }

      // Cache miss or stale - fetch from API
      console.log('📡 Fetching fresh data from API...');
      const freshData = await fetchFn();

      // Cache the fresh data
      await CachedMatch.setCache(cacheType, cacheKey, {
        ...freshData,
        fetchedAt: new Date().toISOString()
      });

      return {
        data: freshData,
        fromCache: false
      };

    } catch (error) {
      console.error(`❌ Cache error: ${error.message}`);

      // On error, try to return any cached data, even if stale
      const anyCached = await CachedMatch.getCache(cacheType, cacheKey);
      if (anyCached) {
        console.log('⚠️  Using stale cache due to error');
        return {
          data: anyCached,
          fromCache: true,
          stale: true
        };
      }

      // No cache available, must fetch
      console.log('📡 No cache available, fetching from API...');
      const freshData = await fetchFn();

      return {
        data: freshData,
        fromCache: false
      };
    }
  }

  /**
   * Get live+scheduled matches with cache-first strategy
   */
  async getLiveScheduled(params, fetchFn) {
    const { dateTime } = params;
    const today = dateTime ? dateTime.split('T')[0] : new Date().toISOString().split('T')[0];
    const cacheKey = `live-scheduled_${today}`;

    return this.getOrFetch(
      'live-scheduled',
      cacheKey,
      fetchFn,
      300000 // 5 minutes
    );
  }

  /**
   * Get live matches with cache-first strategy
   */
  async getLive(params, fetchFn) {
    const cacheKey = 'live_all';

    return this.getOrFetch(
      'live',
      cacheKey,
      fetchFn,
      30000 // 30 seconds
    );
  }

  /**
   * Get hot matches with cache-first strategy
   */
  async getHot(params, fetchFn) {
    const cacheKey = 'hot_all';

    return this.getOrFetch(
      'hot',
      cacheKey,
      fetchFn,
      60000 // 1 minute
    );
  }

  /**
   * Clear cache for a specific type
   */
  async clearCache(cacheType) {
    return await CachedMatch.clearCacheByType(cacheType);
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return await CachedMatch.getCacheStats();
  }
}

module.exports = new MatchCacheService();
