/**
 * Clear HOT matches cache from MongoDB
 * Run this after changing the hot matches time window
 */

const mongoose = require('mongoose');
require('dotenv').config();

const cachedMatchSchema = new mongoose.Schema({
  type: String,
  key: String,
  data: Object,
  expiresAt: Date
}, { collection: 'cached_matches' });

const CachedMatch = mongoose.model('CachedMatch', cachedMatchSchema);

async function clearHotCache() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football');
    console.log('✅ Connected to MongoDB\n');

    // Delete all HOT cache entries
    const result = await CachedMatch.deleteMany({
      $or: [
        { type: 'hot' },
        { key: { $regex: /^hot/ } }
      ]
    });

    console.log(`🗑️  Deleted ${result.deletedCount} HOT cache entries`);

    // Check remaining cache
    const remaining = await CachedMatch.countDocuments();
    console.log(`📊 Remaining cache entries: ${remaining}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

clearHotCache();
