/**
 * Clear Odds collection from MongoDB
 * Run this after changing the time window
 */

const mongoose = require('mongoose');
require('dotenv').config();

const oddsSchema = new mongoose.Schema({
  fixtureId: Number,
  leagueId: Number,
  bookmakers: Array,
  matchDate: Date,
  expiresAt: Date
}, { collection: 'odds' });

const Odds = mongoose.model('Odds', oddsSchema);

async function clearOddsCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football');
    console.log('✅ Connected to MongoDB\n');

    // Get stats before deletion
    const total = await Odds.countDocuments();
    console.log(`📊 Total odds entries: ${total}`);

    // Show date range
    const oldest = await Odds.findOne().sort({ matchDate: 1 });
    const newest = await Odds.findOne().sort({ matchDate: -1 });

    if (oldest && newest) {
      console.log(`📅 Date range: ${oldest.matchDate?.toISOString().split('T')[0]} to ${newest.matchDate?.toISOString().split('T')[0]}`);
    }

    // Delete ALL odds
    console.log('\n🗑️  Deleting ALL odds entries...');
    const result = await Odds.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} odds entries`);

    console.log('\n💡 Worker will re-fetch odds for next 4 days on next refresh cycle');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

clearOddsCollection();
