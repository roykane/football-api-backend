/**
 * Script to inspect MongoDB Odds cache
 * Checks how many bookmakers are stored per fixture
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Define Odds schema (matching your model)
const oddsSchema = new mongoose.Schema({
  fixtureId: Number,
  bookmakers: Array,
  updatedAt: Date,
  createdAt: Date
});

const Odds = mongoose.model('Odds', oddsSchema, 'odds');

async function inspectOddsCache() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football');
    console.log('✅ Connected to MongoDB\n');

    // Get total count
    const totalCount = await Odds.countDocuments();
    console.log(`📊 Total cached fixtures: ${totalCount}\n`);

    // Sample 10 recent odds entries
    const sampleOdds = await Odds.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    console.log('📋 Sample of recent odds cache entries:\n');

    sampleOdds.forEach((odd, index) => {
      const bookmakerCount = odd.bookmakers ? odd.bookmakers.length : 0;
      const bookmakerIds = odd.bookmakers ? odd.bookmakers.map(b => `${b.id}:${b.name}`).join(', ') : 'none';

      console.log(`${index + 1}. Fixture ID: ${odd.fixtureId}`);
      console.log(`   Bookmakers count: ${bookmakerCount}`);
      console.log(`   Bookmaker IDs: ${bookmakerIds}`);
      console.log(`   Updated: ${odd.updatedAt}`);
      console.log('');
    });

    // Statistics
    const stats = await Odds.aggregate([
      {
        $project: {
          fixtureId: 1,
          bookmakerCount: { $size: { $ifNull: ['$bookmakers', []] } }
        }
      },
      {
        $group: {
          _id: null,
          avgBookmakers: { $avg: '$bookmakerCount' },
          maxBookmakers: { $max: '$bookmakerCount' },
          minBookmakers: { $min: '$bookmakerCount' }
        }
      }
    ]);

    if (stats.length > 0) {
      console.log('📈 Statistics:');
      console.log(`   Average bookmakers per fixture: ${stats[0].avgBookmakers.toFixed(2)}`);
      console.log(`   Max bookmakers in a fixture: ${stats[0].maxBookmakers}`);
      console.log(`   Min bookmakers in a fixture: ${stats[0].minBookmakers}`);
    }

    // Find fixtures with more than 1 bookmaker
    const multiBookmakerFixtures = await Odds.find({
      $expr: { $gt: [{ $size: { $ifNull: ['$bookmakers', []] } }, 1] }
    }).countDocuments();

    console.log(`\n⚠️  Fixtures with multiple bookmakers: ${multiBookmakerFixtures} (${((multiBookmakerFixtures/totalCount)*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

inspectOddsCache();
