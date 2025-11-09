// Check MongoDB cache status
const mongoose = require('mongoose');
require('dotenv').config();

const Odds = require('./models/Odds');

async function checkCacheStatus() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football-odds';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get total cached fixtures
    const totalCached = await Odds.countDocuments();
    console.log(`📊 Total Cached Fixtures: ${totalCached}`);

    // Get valid (non-expired) cached fixtures
    const now = new Date();
    const validCached = await Odds.countDocuments({ expiresAt: { $gt: now } });
    console.log(`✅ Valid Cache: ${validCached}`);
    console.log(`❌ Expired Cache: ${totalCached - validCached}\n`);

    // Get cache by status
    const statusStats = await Odds.aggregate([
      { $match: { expiresAt: { $gt: now } } },
      { $group: { _id: '$matchStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('📈 Cache by Match Status:');
    statusStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} fixtures`);
    });

    // Get recent cache hits
    console.log('\n🕐 Most Recently Cached (Top 10):');
    const recentCache = await Odds.find({ expiresAt: { $gt: now } })
      .sort({ lastApiCall: -1 })
      .limit(10)
      .select('fixtureId homeTeam.name awayTeam.name matchStatus lastApiCall');

    recentCache.forEach(odds => {
      const timeAgo = Math.round((now - odds.lastApiCall) / 1000 / 60);
      console.log(`   ${odds.fixtureId}: ${odds.homeTeam.name} vs ${odds.awayTeam.name} (${odds.matchStatus}) - ${timeAgo}m ago`);
    });

    // Sample one fixture to show bookmakers
    const sampleOdds = await Odds.findOne({ expiresAt: { $gt: now } });
    if (sampleOdds) {
      console.log(`\n🎲 Sample Cached Odds (Fixture ${sampleOdds.fixtureId}):`);
      console.log(`   Bookmakers: ${sampleOdds.bookmakers.length}`);
      sampleOdds.bookmakers.forEach(bm => {
        console.log(`   - ${bm.name}: ${bm.bets.length} bet types`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCacheStatus();
