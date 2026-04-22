const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Articles DB connector.
 *
 * Historically this forced a separate `football_news` DB, which caused
 * confusion: nhan-dinh (SoiKeoArticle), teams, etc. lived in the main
 * `football-odds` DB while news (Article) lived in a sibling DB. Scripts
 * and the runtime would read/write different DBs and diverge silently.
 *
 * Simplified: reuse the main mongoose connection. Everything lives in
 * the DB pointed to by MONGODB_URI, same as SoiKeoArticle.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    // Main connection is already up (via server.js connectMongoDB).
    return;
  }
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football-odds';
  await mongoose.connect(MONGODB_URI);
  console.log(`✅ MongoDB (articles): connected to ${mongoose.connection.name}`);
}

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

module.exports = connectDB;
