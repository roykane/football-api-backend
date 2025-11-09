const mongoose = require('mongoose');

async function clearCache() {
  try {
    await mongoose.connect('mongodb://localhost:27017/football-odds');
    console.log('✅ MongoDB connected');

    const result = await mongoose.connection.db.collection('odds').deleteMany({});
    console.log(`🗑️  Cleared ${result.deletedCount} cached odds entries`);

    await mongoose.connection.close();
    console.log('✅ Done! MongoDB cache cleared.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearCache();
