const mongoose = require('mongoose');

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/football-odds';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to MongoDB');

  // Clear odds cache
  const result = await mongoose.connection.db.collection('odds').deleteMany({});
  console.log(`✓ Cleared ${result.deletedCount} cached odds entries`);

  await mongoose.connection.close();
  console.log('✓ Done');
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
