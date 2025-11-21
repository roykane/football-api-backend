const Odds = require('../models/Odds');
const { transformOdds } = require('../utils/transformers');

class OddsCacheService {
  
  /**
   * Get odds for a specific fixture from cache
   * @param {number} fixtureId - Fixture ID
   * @returns {Promise<Object|null>} - Cached odds or null if not found/expired
   */
  async getOdds(fixtureId) {
    try {
      const cached = await Odds.findByFixtureId(fixtureId);

      if (!cached) {
        console.log(`   [OddsCache] Miss for fixture ${fixtureId} - not in cache`);
        return null;
      }

      if (!cached.isValid()) {
        console.log(`   [OddsCache] Miss for fixture ${fixtureId} - expired`);
        // Xóa expired cache
        await cached.deleteOne();
        return null;
      }

      console.log(`   [OddsCache] Hit for fixture ${fixtureId}`);
      return cached.bookmakers;

    } catch (error) {
      console.error(`[OddsCache] Error getting odds for fixture ${fixtureId}:`, error.message);
      return null;
    }
  }

  /**
   * Get odds for a fixture - fetches from API if not in cache
   * @param {number} fixtureId - Fixture ID
   * @param {Object} footballApi - FootballApi instance
   * @param {Object} fixtureData - Optional fixture data (avoids extra API call)
   * @param {Array} bookmakerIds - Array of bookmaker IDs to fetch (default: [8,1,18,3])
   * @returns {Promise<Object|null>} - Odds data or null
   */
  async getOrFetchOdds(fixtureId, footballApi, fixtureData = null, bookmakerIds = [8, 9, 1, 11, 18, 6, 16, 29, 7, 13, 31, 10, 5, 3, 28, 12]) {
    try {
      // Try cache first
      const cachedOdds = await this.getOdds(fixtureId);
      if (cachedOdds) {
        console.log(`   [OddsCache] Hit for fixture ${fixtureId}`);
        // Filter cached odds to requested bookmakers
        if (bookmakerIds && bookmakerIds.length > 0) {
          const filtered = cachedOdds.filter(b => bookmakerIds.includes(b.id));
          console.log(`   [OddsCache] Filtered to ${filtered.length}/${cachedOdds.length} requested bookmakers`);
          return filtered.length > 0 ? filtered : cachedOdds;
        }
        return cachedOdds;
      }

      // Cache miss - fetch from API
      console.log(`   [OddsCache] Fetching ALL bookmakers from API for fixture ${fixtureId}... (will filter to [${bookmakerIds.join(',')}])`);

      const oddsParams = {
        fixture: fixtureId
        // NOTE: Temporarily fetch ALL bookmakers, then filter in code
        // API-Football format may not support multiple bookmaker IDs
      };

      // Use .get() method (footballApi is axios instance, not FootballApi class)
      const oddsResponse = await footballApi.get('/odds', { params: oddsParams });
      let oddsData = oddsResponse.data?.response || [];

      if (!oddsData || oddsData.length === 0) {
        console.log(`   [OddsCache] No odds available from API for fixture ${fixtureId}`);
        return null;
      }

      console.log(`   [OddsCache] ✓ Fetched odds from API`);

      // Filter bookmakers if needed
      if (oddsData.length > 0 && bookmakerIds && bookmakerIds.length > 0) {
        const allBookmakers = oddsData[0]?.bookmakers || [];
        const filteredBookmakers = allBookmakers.filter(b => bookmakerIds.includes(b.id));

        if (filteredBookmakers.length > 0) {
          oddsData[0].bookmakers = filteredBookmakers;
          console.log(`   [OddsCache] Filtered to ${filteredBookmakers.length}/${allBookmakers.length} requested bookmakers`);
        } else {
          console.log(`   [OddsCache] ⚠️ No requested bookmakers found, using all ${allBookmakers.length} bookmakers`);
        }
      }

      // Get fixture details - use provided data or fetch from API
      if (!fixtureData) {
        const fixtureResponse = await footballApi.get('/fixtures', { params: { id: fixtureId } });
        const fixtureDataArray = fixtureResponse.data?.response || [];

        if (!fixtureDataArray || fixtureDataArray.length === 0) {
          console.log(`   [OddsCache] Warning: Could not fetch fixture details for ${fixtureId}`);
          // Return raw odds data without caching
          const { transformOdds } = require('../utils/transformers');
          return transformOdds(oddsData);
        }

        fixtureData = fixtureDataArray[0];
      } else {
        console.log(`   [OddsCache] ✓ Using provided fixture data (saved 1 API call)`);
      }

      // Save to cache
      await this.saveOdds(fixtureData, oddsData);
      console.log(`   [OddsCache] ✓ Cached fixture ${fixtureId} with all bookmakers`);

      // Return transformed odds
      return transformOdds(oddsData);

    } catch (error) {
      console.error(`[OddsCache] Error in getOrFetchOdds for fixture ${fixtureId}:`, error.message);
      return null;
    }
  }
  
  /**
   * Get odds for multiple fixtures
   * @param {number[]} fixtureIds - Array of fixture IDs
   * @returns {Promise<Map>} - Map of fixtureId -> bookmakers
   */
  async getBulkOdds(fixtureIds) {
    try {
      const results = await Odds.find({
        fixtureId: { $in: fixtureIds }
      });
      
      const oddsMap = new Map();
      const now = new Date();
      
      for (const odds of results) {
        if (odds.expiresAt > now) {
          oddsMap.set(odds.fixtureId, odds.bookmakers);
        }
      }
      
      console.log(`   [OddsCache] Bulk fetch: ${oddsMap.size}/${fixtureIds.length} fixtures found in cache`);
      return oddsMap;
      
    } catch (error) {
      console.error('[OddsCache] Error in bulk fetch:', error.message);
      return new Map();
    }
  }
  
  /**
   * Save or update odds in cache
   * @param {Object} fixtureData - Fixture data from API
   * @param {Array} oddsData - Odds data from API-Sports
   * @returns {Promise<Object>} - Saved odds document
   */
  async saveOdds(fixtureData, oddsData) {
    try {
      const { fixture, teams, league } = fixtureData;
      
      // Transform odds data to our format
      const bookmakers = transformOdds(oddsData);
      
      // Determine match status
      const matchStatus = this.getMatchStatus(fixture.status.short);
      
      // Check if already exists
      let oddsDoc = await Odds.findByFixtureId(fixture.id);
      
      if (oddsDoc) {
        // Update existing
        await oddsDoc.updateOdds(bookmakers, matchStatus);
        console.log(`   [OddsCache] Updated fixture ${fixture.id}`);
      } else {
        // Create new
        oddsDoc = new Odds({
          fixtureId: fixture.id,
          leagueId: league.id,
          leagueName: league.name,
          seasonYear: league.season,
          homeTeam: {
            id: teams.home.id,
            name: teams.home.name,
            logo: teams.home.logo
          },
          awayTeam: {
            id: teams.away.id,
            name: teams.away.name,
            logo: teams.away.logo
          },
          matchDate: new Date(fixture.date),
          matchStatus: matchStatus,
          bookmakers: bookmakers,
          expiresAt: this.calculateExpiryTime(matchStatus, new Date(fixture.date)),
          priority: this.calculatePriority(matchStatus, new Date(fixture.date)),
          lastApiCall: new Date()
        });
        
        await oddsDoc.save();
        console.log(`   [OddsCache] Created fixture ${fixture.id}`);
      }
      
      return oddsDoc;
      
    } catch (error) {
      console.error('[OddsCache] Error saving odds:', error.message);
      throw error;
    }
  }
  
  /**
   * Bulk save multiple fixtures odds
   * @param {Array} fixturesWithOdds - Array of {fixture, odds} objects
   * @returns {Promise<number>} - Number of successful saves
   */
  async bulkSaveOdds(fixturesWithOdds) {
    let saved = 0;
    
    for (const item of fixturesWithOdds) {
      try {
        await this.saveOdds(item.fixture, item.odds);
        saved++;
      } catch (error) {
        console.error(`[OddsCache] Failed to save fixture ${item.fixture.fixture.id}:`, error.message);
      }
    }
    
    console.log(`   [OddsCache] Bulk save: ${saved}/${fixturesWithOdds.length} successful`);
    return saved;
  }
  
  /**
   * Get fixtures that need odds update
   * @param {number} minutesBeforeExpiry - Minutes before expiry to consider
   * @returns {Promise<Array>} - Array of fixture IDs that need update
   */
  async getFixturesNeedingUpdate(minutesBeforeExpiry = 5) {
    try {
      const fixtures = await Odds.findNeedingUpdate(minutesBeforeExpiry);
      return fixtures.map(f => ({
        fixtureId: f.fixtureId,
        priority: f.priority,
        matchStatus: f.matchStatus,
        matchDate: f.matchDate
      }));
    } catch (error) {
      console.error('[OddsCache] Error finding fixtures needing update:', error.message);
      return [];
    }
  }
  
  /**
   * Get live matches that need urgent update
   * @returns {Promise<Array>} - Array of live fixture IDs
   */
  async getLiveFixtures() {
    try {
      const fixtures = await Odds.findLiveMatches();
      return fixtures.map(f => f.fixtureId);
    } catch (error) {
      console.error('[OddsCache] Error finding live fixtures:', error.message);
      return [];
    }
  }
  
  /**
   * Get upcoming matches in next X hours
   * @param {number} hours - Hours ahead
   * @returns {Promise<Array>} - Array of fixture data
   */
  async getUpcomingFixtures(hours = 24) {
    try {
      const fixtures = await Odds.findUpcomingMatches(hours);
      return fixtures.map(f => ({
        fixtureId: f.fixtureId,
        matchDate: f.matchDate,
        homeTeam: f.homeTeam.name,
        awayTeam: f.awayTeam.name,
        leagueName: f.leagueName
      }));
    } catch (error) {
      console.error('[OddsCache] Error finding upcoming fixtures:', error.message);
      return [];
    }
  }
  
  /**
   * Delete odds for a specific fixture
   * @param {number} fixtureId - Fixture ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteOdds(fixtureId) {
    try {
      await Odds.deleteOne({ fixtureId });
      console.log(`   [OddsCache] Deleted fixture ${fixtureId}`);
      return true;
    } catch (error) {
      console.error(`[OddsCache] Error deleting fixture ${fixtureId}:`, error.message);
      return false;
    }
  }
  
  /**
   * Clear all expired odds from cache
   * @returns {Promise<number>} - Number of deleted documents
   */
  async clearExpired() {
    try {
      const result = await Odds.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      
      console.log(`   [OddsCache] Cleared ${result.deletedCount} expired odds`);
      return result.deletedCount;
    } catch (error) {
      console.error('[OddsCache] Error clearing expired odds:', error.message);
      return 0;
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Promise<Object>} - Cache stats
   */
  async getStats() {
    try {
      const total = await Odds.countDocuments();
      const live = await Odds.countDocuments({ matchStatus: 'live' });
      const scheduled = await Odds.countDocuments({ matchStatus: 'scheduled' });
      const finished = await Odds.countDocuments({ matchStatus: 'finished' });
      
      const oldestUpdate = await Odds.findOne().sort({ lastUpdated: 1 });
      const newestUpdate = await Odds.findOne().sort({ lastUpdated: -1 });
      
      return {
        total,
        byStatus: { live, scheduled, finished },
        oldestUpdate: oldestUpdate?.lastUpdated,
        newestUpdate: newestUpdate?.lastUpdated
      };
    } catch (error) {
      console.error('[OddsCache] Error getting stats:', error.message);
      return null;
    }
  }
  
  // Helper methods
  
  getMatchStatus(apiStatus) {
    const statusMap = {
      'TBD': 'scheduled',
      'NS': 'scheduled',
      'LIVE': 'live',
      '1H': 'live',
      'HT': 'live',
      '2H': 'live',
      'ET': 'live',
      'P': 'live',
      'FT': 'finished',
      'AET': 'finished',
      'PEN': 'finished',
      'PST': 'postponed',
      'CANC': 'cancelled',
      'ABD': 'cancelled',
      'AWD': 'finished',
      'WO': 'finished'
    };
    
    return statusMap[apiStatus] || 'scheduled';
  }
  
  calculateExpiryTime(status, matchDate) {
    const now = new Date();
    let expiryMinutes;
    
    switch(status) {
      case 'live':
        expiryMinutes = 2;
        break;
      case 'scheduled':
        const hoursUntilMatch = (matchDate - now) / (1000 * 60 * 60);
        if (hoursUntilMatch < 2) {
          expiryMinutes = 5;
        } else if (hoursUntilMatch < 24) {
          expiryMinutes = 30;
        } else {
          expiryMinutes = 60;
        }
        break;
      case 'finished':
      case 'postponed':
      case 'cancelled':
        expiryMinutes = 24 * 60;
        break;
      default:
        expiryMinutes = 30;
    }
    
    return new Date(now.getTime() + expiryMinutes * 60 * 1000);
  }
  
  calculatePriority(status, matchDate) {
    if (status === 'live') return 'critical';
    
    const now = new Date();
    const hoursUntilMatch = (matchDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilMatch < 0) return 'low';
    if (hoursUntilMatch < 2) return 'high';
    if (hoursUntilMatch < 24) return 'medium';
    return 'low';
  }
}

module.exports = new OddsCacheService();
