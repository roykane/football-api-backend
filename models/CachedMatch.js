const mongoose = require('mongoose');

/**
 * Schema for caching match data from API-Sports
 * This reduces API calls by storing frequently accessed data
 */
const cachedMatchSchema = new mongoose.Schema({
  // Cache type identifier
  cacheType: {
    type: String,
    required: true,
    enum: ['live-scheduled', 'live', 'hot'],
    index: true
  },

  // Cache key for querying (includes filters like date, competition, etc.)
  cacheKey: {
    type: String,
    required: true,
    index: true
  },

  // Cached data (the actual response from API-Sports)
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 600 // Auto-delete after 10 minutes (TTL index)
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Track number of hits for analytics
  hits: {
    type: Number,
    default: 0
  },

  // Last time this cache was accessed
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'cached_matches'
});

// Compound index for efficient querying
cachedMatchSchema.index({ cacheType: 1, cacheKey: 1 }, { unique: true });

// Static method to get or create cache
cachedMatchSchema.statics.getCache = async function(cacheType, cacheKey) {
  const cache = await this.findOne({ cacheType, cacheKey });

  if (cache) {
    // Update hits and lastAccessedAt
    cache.hits += 1;
    cache.lastAccessedAt = new Date();
    await cache.save();

    console.log(`✅ Cache HIT: ${cacheType}/${cacheKey} (hits: ${cache.hits})`);
    return cache.data;
  }

  console.log(`❌ Cache MISS: ${cacheType}/${cacheKey}`);
  return null;
};

// Static method to set cache
cachedMatchSchema.statics.setCache = async function(cacheType, cacheKey, data) {
  try {
    await this.findOneAndUpdate(
      { cacheType, cacheKey },
      {
        data,
        updatedAt: new Date(),
        lastAccessedAt: new Date()
      },
      {
        upsert: true,
        new: true
      }
    );

    console.log(`💾 Cache SET: ${cacheType}/${cacheKey}`);
    return true;
  } catch (error) {
    console.error(`❌ Cache SET failed: ${cacheType}/${cacheKey}`, error.message);
    return false;
  }
};

// Static method to clear cache by type
cachedMatchSchema.statics.clearCacheByType = async function(cacheType) {
  const result = await this.deleteMany({ cacheType });
  console.log(`🗑️ Cleared ${result.deletedCount} cache entries for type: ${cacheType}`);
  return result.deletedCount;
};

// Static method to get cache stats
cachedMatchSchema.statics.getCacheStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$cacheType',
        count: { $sum: 1 },
        totalHits: { $sum: '$hits' },
        avgHits: { $avg: '$hits' }
      }
    }
  ]);

  return stats;
};

const CachedMatch = mongoose.model('CachedMatch', cachedMatchSchema);

module.exports = CachedMatch;
