const mongoose = require('mongoose');

// Schema cho một bet value (ví dụ: handicap value, odd value)
const betValueSchema = new mongoose.Schema({
  value: { type: String, required: true }, // "0.5", "-1.5", "2.5"
  odd: { type: String, required: true },   // "1.85", "2.10"
  handicap: { type: String },              // Optional handicap value
  main: { type: Boolean },                 // Is this the main/opening line
  suspended: { type: Boolean, default: false }
}, { _id: false });

// Schema cho một loại bet (asian_handicap, goals_over_under, etc)
const betSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },  // "Asian Handicap", "Goals Over/Under"
  type: { type: String, required: true },  // "asian_handicap", "goals_over_under"
  values: [betValueSchema]
}, { _id: false });

// Schema cho một bookmaker
const bookmakerSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true }, // "Bet365", "1xBet"
  bets: [betSchema]
}, { _id: false });

// Main Odds schema
const oddsSchema = new mongoose.Schema({
  fixtureId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  
  leagueId: {
    type: Number,
    required: true,
    index: true
  },
  
  leagueName: String,
  
  seasonYear: Number,
  
  homeTeam: {
    id: Number,
    name: String,
    logo: String
  },
  
  awayTeam: {
    id: Number,
    name: String,
    logo: String
  },
  
  // Match date/time để biết trận nào sắp diễn ra
  matchDate: {
    type: Date,
    required: true,
    index: true
  },
  
  // Match status để priority update cho live matches
  matchStatus: {
    type: String,
    enum: ['scheduled', 'live', 'finished', 'postponed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  
  // Bookmakers data
  bookmakers: [bookmakerSchema],
  
  // Cache metadata
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // TTL (time to live) - khác nhau tùy match status
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // API call tracking
  apiCallCount: {
    type: Number,
    default: 0
  },
  
  lastApiCall: Date,
  
  // Priority level để schedule updates
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  }
  
}, {
  timestamps: true, // Tự động thêm createdAt và updatedAt
  collection: 'odds'
});

// Index compound cho queries phổ biến
oddsSchema.index({ leagueId: 1, matchDate: 1 });
oddsSchema.index({ matchStatus: 1, matchDate: 1 });
oddsSchema.index({ priority: 1, expiresAt: 1 });

// TTL index để tự động xóa expired documents
oddsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static methods
oddsSchema.statics = {
  
  // Tìm odds cho một fixture
  async findByFixtureId(fixtureId) {
    return this.findOne({ fixtureId });
  },
  
  // Tìm odds cho league và season
  async findByLeague(leagueId, seasonYear, limit = 100) {
    return this.find({ leagueId, seasonYear })
      .sort({ matchDate: 1 })
      .limit(limit);
  },
  
  // Tìm odds cần update (expired hoặc sắp expired)
  async findNeedingUpdate(minutesBeforeExpiry = 5) {
    const threshold = new Date(Date.now() + minutesBeforeExpiry * 60 * 1000);
    return this.find({
      expiresAt: { $lte: threshold }
    }).sort({ priority: -1, matchDate: 1 });
  },
  
  // Tìm live matches cần update gấp
  async findLiveMatches() {
    return this.find({
      matchStatus: 'live'
    }).sort({ lastUpdated: 1 });
  },
  
  // Tìm upcoming matches trong X giờ tới
  async findUpcomingMatches(hours = 24) {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return this.find({
      matchDate: { $gte: now, $lte: future },
      matchStatus: 'scheduled'
    }).sort({ matchDate: 1 });
  }
};

// Instance methods
oddsSchema.methods = {
  
  // Check if cache is still valid
  isValid() {
    return this.expiresAt > new Date();
  },
  
  // Check if cache is about to expire (trong 5 phút)
  isAboutToExpire(minutes = 5) {
    const threshold = new Date(Date.now() + minutes * 60 * 1000);
    return this.expiresAt <= threshold;
  },
  
  // Update odds data
  async updateOdds(bookmakers, matchStatus) {
    const now = new Date();
    
    this.bookmakers = bookmakers;
    this.matchStatus = matchStatus || this.matchStatus;
    this.lastUpdated = now;
    this.lastApiCall = now;
    this.apiCallCount += 1;
    
    // Set expiry time based on match status
    this.expiresAt = this.calculateExpiryTime(matchStatus);
    
    // Set priority based on match status and time
    this.priority = this.calculatePriority(matchStatus);
    
    return this.save();
  },
  
  // Calculate expiry time based on match status
  calculateExpiryTime(status) {
    const now = new Date();
    let expiryMinutes;
    
    switch(status) {
      case 'live':
        expiryMinutes = 2; // Update mỗi 2 phút cho live matches
        break;
      case 'scheduled':
        // Nếu trận đấu < 2 giờ nữa: 5 phút
        // Nếu trận đấu < 24 giờ nữa: 30 phút
        // Còn lại: 60 phút
        const hoursUntilMatch = (this.matchDate - now) / (1000 * 60 * 60);
        if (hoursUntilMatch < 2) {
          expiryMinutes = 5;
        } else if (hoursUntilMatch < 24) {
          expiryMinutes = 30;
        } else {
          expiryMinutes = 60;
        }
        break;
      case 'finished':
      case 'postponed':
      case 'cancelled':
        expiryMinutes = 24 * 60; // 1 ngày, có thể xóa luôn cũng được
        break;
      default:
        expiryMinutes = 30;
    }
    
    return new Date(now.getTime() + expiryMinutes * 60 * 1000);
  },
  
  // Calculate priority for update scheduling
  calculatePriority(status) {
    if (status === 'live') return 'critical';
    
    const now = new Date();
    const hoursUntilMatch = (this.matchDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilMatch < 0) return 'low'; // Đã qua rồi
    if (hoursUntilMatch < 2) return 'high';
    if (hoursUntilMatch < 24) return 'medium';
    return 'low';
  }
};

const Odds = mongoose.model('Odds', oddsSchema);

module.exports = Odds;
