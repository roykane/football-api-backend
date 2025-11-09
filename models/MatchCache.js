const mongoose = require('mongoose');

/**
 * MatchCache Model - Cache full match data for finished matches
 * Giảm API calls bằng cách lưu data của finished matches vào MongoDB
 */

const matchCacheSchema = new mongoose.Schema({
  // Match ID từ API-Sports
  fixtureId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  // League info
  leagueId: {
    type: Number,
    required: true,
    index: true
  },

  leagueName: String,
  seasonYear: Number,

  // Match date
  matchDate: {
    type: Date,
    required: true,
    index: true
  },

  // Match status
  matchStatus: {
    type: String,
    enum: ['scheduled', 'live', 'finished', 'postponed', 'cancelled'],
    default: 'finished',
    index: true
  },

  statusCode: String, // FT, AET, PEN, etc.

  // Full transformed match data
  matchData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },

  // TTL - Finished matches cache for 30 days
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },

  // Source of data
  source: {
    type: String,
    enum: ['api', 'manual'],
    default: 'api'
  }

}, {
  timestamps: true,
  collection: 'match_cache'
});

// Index compound
matchCacheSchema.index({ leagueId: 1, matchDate: 1 });
matchCacheSchema.index({ matchStatus: 1, matchDate: 1 });

// TTL index - Auto delete after 30 days
matchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static methods
matchCacheSchema.statics = {

  /**
   * Find cached match by fixture ID
   */
  async findByFixtureId(fixtureId) {
    return this.findOne({ fixtureId });
  },

  /**
   * Find multiple cached matches
   */
  async findByFixtureIds(fixtureIds) {
    const results = await this.find({
      fixtureId: { $in: fixtureIds }
    });

    const cacheMap = new Map();
    for (const cached of results) {
      if (cached.isValid()) {
        cacheMap.set(cached.fixtureId, cached.matchData);
      }
    }

    return cacheMap;
  },

  /**
   * Find cached matches by league and date range
   */
  async findByLeagueAndDate(leagueId, startDate, endDate) {
    return this.find({
      leagueId,
      matchDate: { $gte: startDate, $lte: endDate }
    }).sort({ matchDate: 1 });
  },

  /**
   * Find all finished matches that need caching
   */
  async findFinishedMatchesNeedingCache(limit = 100) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.find({
      matchStatus: 'finished',
      lastUpdated: { $lt: oneDayAgo }
    })
    .sort({ matchDate: -1 })
    .limit(limit);
  }
};

// Instance methods
matchCacheSchema.methods = {

  /**
   * Check if cache is still valid
   */
  isValid() {
    return this.expiresAt > new Date();
  },

  /**
   * Update cached match data
   */
  async updateMatchData(matchData) {
    this.matchData = matchData;
    this.lastUpdated = new Date();
    return this.save();
  }
};

const MatchCache = mongoose.model('MatchCache', matchCacheSchema);

module.exports = MatchCache;
