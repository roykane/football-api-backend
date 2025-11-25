const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football_news';

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log('✅ MongoDB: Using existing connection');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: 'football_news',
    });

    isConnected = true;
    console.log('✅ MongoDB: Connected successfully');
    console.log(`📦 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB: Disconnected');
  isConnected = false;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  isConnected = false;
});

module.exports = connectDB;
