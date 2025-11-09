const oddsCache = require('./oddsCache');
const FootballApi = require('../utils/footballApi');

// Read bookmaker IDs from environment variable - empty means fetch ALL bookmakers
const DEFAULT_BOOKMAKERS = process.env.DEFAULT_BOOKMAKERS || '';

class OddsSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      apiCallsSaved: 0
    };
  }

  /**
   * Main sync job - updates odds for fixtures that need it
   */
  async run() {
    if (this.isRunning) {
      console.log('[OddsSyncJob] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    console.log('\n=== Odds Sync Job Started ===');
    console.log(`Time: ${new Date().toISOString()}`);

    try {
      // 1. Update live matches first (highest priority)
      await this.updateLiveMatches();

      // 2. Update upcoming matches
      await this.updateUpcomingMatches();

      // 3. Update expired/expiring cache
      await this.updateExpiredCache();

      // 4. Clean up old finished matches
      await oddsCache.clearExpired();

      // 5. Print stats
      const duration = Date.now() - startTime;
      const stats = await oddsCache.getStats();

      console.log('\n=== Sync Job Completed ===');
      console.log(`Duration: ${duration}ms`);
      console.log(`Cache stats:`, stats);
      console.log(`Job stats:`, this.stats);
      console.log('===========================\n');

      this.lastRun = new Date();
      this.stats.totalRuns++;

    } catch (error) {
      console.error('[OddsSyncJob] Error during sync:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update odds for live matches (every 2-3 minutes)
   */
  async updateLiveMatches() {
    console.log('\n[1/4] Updating live matches...');

    try {
      const liveFixtures = await oddsCache.getLiveFixtures();

      if (liveFixtures.length === 0) {
        console.log('   No live matches to update');
        return;
      }

      console.log(`   Found ${liveFixtures.length} live matches`);

      const footballApi = new FootballApi();
      let updated = 0;

      // Update live matches one by one (high priority)
      for (const fixtureId of liveFixtures) {
        try {
          console.log(`   Updating live fixture ${fixtureId}...`);

          // Fetch latest odds from API
          const oddsData = await footballApi.getOdds({
            fixture: fixtureId,
            bookmaker: DEFAULT_BOOKMAKERS
          });

          if (oddsData && oddsData.length > 0) {
            // Fetch fixture details
            const fixtureData = await footballApi.getFixtures({ id: fixtureId });

            if (fixtureData && fixtureData.length > 0) {
              await oddsCache.saveOdds(fixtureData[0], oddsData);
              updated++;
              console.log(`   ✓ Updated live fixture ${fixtureId}`);
            }
          }

          // Rate limiting: wait 1 second between requests
          await this.sleep(1000);

        } catch (error) {
          console.error(`   ✗ Failed to update live fixture ${fixtureId}:`, error.message);
          this.stats.failedUpdates++;
        }
      }

      this.stats.successfulUpdates += updated;
      console.log(`   Updated ${updated}/${liveFixtures.length} live matches`);

    } catch (error) {
      console.error('   Error updating live matches:', error.message);
    }
  }

  /**
   * Update odds for upcoming matches (within 24 hours)
   */
  async updateUpcomingMatches() {
    console.log('\n[2/4] Updating upcoming matches...');

    try {
      const upcomingFixtures = await oddsCache.getUpcomingFixtures(24);

      if (upcomingFixtures.length === 0) {
        console.log('   No upcoming matches in cache');
        return;
      }

      console.log(`   Found ${upcomingFixtures.length} upcoming matches`);

      // Filter only matches starting in < 2 hours (need frequent updates)
      const now = new Date();
      const urgentFixtures = upcomingFixtures.filter(f => {
        const hoursUntil = (f.matchDate - now) / (1000 * 60 * 60);
        return hoursUntil < 2;
      });

      if (urgentFixtures.length === 0) {
        console.log('   No urgent upcoming matches (< 2 hours)');
        return;
      }

      console.log(`   ${urgentFixtures.length} matches starting soon (< 2 hours)`);

      const footballApi = new FootballApi();
      let updated = 0;

      for (const fixture of urgentFixtures) {
        try {
          console.log(`   Updating fixture ${fixture.fixtureId} (${fixture.homeTeam} vs ${fixture.awayTeam})...`);

          const oddsData = await footballApi.getOdds({
            fixture: fixture.fixtureId,
            bookmaker: DEFAULT_BOOKMAKERS
          });

          if (oddsData && oddsData.length > 0) {
            const fixtureData = await footballApi.getFixtures({ id: fixture.fixtureId });

            if (fixtureData && fixtureData.length > 0) {
              await oddsCache.saveOdds(fixtureData[0], oddsData);
              updated++;
              console.log(`   ✓ Updated fixture ${fixture.fixtureId}`);
            }
          }

          await this.sleep(1000);

        } catch (error) {
          console.error(`   ✗ Failed to update fixture ${fixture.fixtureId}:`, error.message);
          this.stats.failedUpdates++;
        }
      }

      this.stats.successfulUpdates += updated;
      console.log(`   Updated ${updated}/${urgentFixtures.length} upcoming matches`);

    } catch (error) {
      console.error('   Error updating upcoming matches:', error.message);
    }
  }

  /**
   * Update expired or about to expire cache entries
   */
  async updateExpiredCache() {
    console.log('\n[3/4] Updating expired/expiring cache...');

    try {
      const needingUpdate = await oddsCache.getFixturesNeedingUpdate(10); // 10 minutes before expiry

      if (needingUpdate.length === 0) {
        console.log('   No expired cache entries');
        return;
      }

      console.log(`   Found ${needingUpdate.length} fixtures needing update`);

      // Sort by priority
      const sorted = needingUpdate.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Limit to top 20 to avoid API quota issues
      const toUpdate = sorted.slice(0, 20);

      console.log(`   Updating top ${toUpdate.length} fixtures by priority`);

      const footballApi = new FootballApi();
      let updated = 0;

      for (const fixture of toUpdate) {
        try {
          const oddsData = await footballApi.getOdds({
            fixture: fixture.fixtureId,
            bookmaker: DEFAULT_BOOKMAKERS
          });

          if (oddsData && oddsData.length > 0) {
            const fixtureData = await footballApi.getFixtures({ id: fixture.fixtureId });

            if (fixtureData && fixtureData.length > 0) {
              await oddsCache.saveOdds(fixtureData[0], oddsData);
              updated++;
            }
          }

          await this.sleep(1000);

        } catch (error) {
          console.error(`   ✗ Failed to update fixture ${fixture.fixtureId}:`, error.message);
          this.stats.failedUpdates++;
        }
      }

      this.stats.successfulUpdates += updated;
      console.log(`   Updated ${updated}/${toUpdate.length} fixtures`);

    } catch (error) {
      console.error('   Error updating expired cache:', error.message);
    }
  }

  /**
   * Pre-populate cache with upcoming fixtures from specific leagues
   * Call this manually or on server start
   */
  async preCacheLeague(leagueId, seasonYear) {
    console.log(`\n=== Pre-caching league ${leagueId} season ${seasonYear} ===`);

    try {
      const footballApi = new FootballApi();

      // Get upcoming fixtures for this league
      const fixtures = await footballApi.getFixtures({
        league: leagueId,
        season: seasonYear,
        from: new Date().toISOString().split('T')[0], // Today
        to: this.getDateDaysAhead(7) // Next 7 days
      });

      console.log(`Found ${fixtures.length} upcoming fixtures`);

      let cached = 0;

      for (const fixture of fixtures) {
        try {
          // Check if already cached
          const existing = await oddsCache.getOdds(fixture.fixture.id);

          if (existing) {
            console.log(`   Fixture ${fixture.fixture.id} already cached`);
            this.stats.apiCallsSaved++;
            continue;
          }

          // Fetch odds
          console.log(`   Fetching odds for fixture ${fixture.fixture.id} with bookmakers: ${DEFAULT_BOOKMAKERS}`);
          const oddsData = await footballApi.getOdds({
            fixture: fixture.fixture.id,
            bookmaker: DEFAULT_BOOKMAKERS
          });

          // Debug: Log what we got back
          if (!oddsData) {
            console.log(`   ⚠️ Fixture ${fixture.fixture.id}: oddsData is null/undefined`);
          } else if (oddsData.length === 0) {
            console.log(`   ⚠️ Fixture ${fixture.fixture.id}: oddsData is empty array (no odds available for bookmakers ${DEFAULT_BOOKMAKERS})`);
          } else {
            console.log(`   ✓ Fixture ${fixture.fixture.id}: Found ${oddsData.length} bookmaker(s) with odds`);
          }

          if (oddsData && oddsData.length > 0) {
            await oddsCache.saveOdds(fixture, oddsData);
            cached++;
            console.log(`   ✓ Cached fixture ${fixture.fixture.id}`);
          }

          await this.sleep(1000);

        } catch (error) {
          console.error(`   ✗ Failed to cache fixture:`, error.message);
        }
      }

      console.log(`\nPre-cached ${cached}/${fixtures.length} fixtures`);
      console.log(`Saved ${this.stats.apiCallsSaved} API calls (already cached)`);

    } catch (error) {
      console.error('Error pre-caching league:', error.message);
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      uptime: process.uptime()
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      totalRuns: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      apiCallsSaved: 0
    };
  }

  // Helper methods

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDateDaysAhead(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
}

module.exports = new OddsSyncJob();
