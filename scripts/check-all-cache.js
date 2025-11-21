/**
 * Check ALL cache entries in MongoDB
 */

const mongoose = require('mongoose');
require('dotenv').config();

const cachedMatchSchema = new mongoose.Schema({
  type: String,
  key: String,
  data: Object,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'cached_matches' });

const CachedMatch = mongoose.model('CachedMatch', cachedMatchSchema);

async function checkAllCache() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football');
    console.log('✅ Connected to MongoDB\n');

    // Get all cache entries
    const allCache = await CachedMatch.find().lean();

    console.log(`📊 Total cache entries: ${allCache.length}\n`);

    if (allCache.length > 0) {
      console.log('📋 Cache entries:');
      allCache.forEach((cache, index) => {
        console.log(`\n${index + 1}. Type: ${cache.type}, Key: ${cache.key}`);
        console.log(`   Created: ${cache.createdAt}`);
        console.log(`   Expires: ${cache.expiresAt}`);

        // Check if it's hot cache with matches
        if (cache.data && cache.data.items) {
          const matchCount = cache.data.items.reduce((sum, league) => {
            return sum + (league.matches?.length || 0);
          }, 0);
          console.log(`   Matches: ${matchCount}`);

          // Show first match date
          if (cache.data.items[0]?.matches?.[0]) {
            console.log(`   First match: ${cache.data.items[0].matches[0].dateTime}`);
          }

          // Show last match date
          const lastLeague = cache.data.items[cache.data.items.length - 1];
          if (lastLeague?.matches?.length > 0) {
            const lastMatch = lastLeague.matches[lastLeague.matches.length - 1];
            console.log(`   Last match: ${lastMatch.dateTime}`);
          }
        }
      });
    }

    // Delete ALL cache
    console.log('\n🗑️  Deleting ALL cache...');
    const result = await CachedMatch.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} entries`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkAllCache();
