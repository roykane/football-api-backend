const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  teamId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  shortName: String,
  logo: String,
  country: String,
  founded: Number,
  national: {
    type: Boolean,
    default: false,
  },
  venue: {
    name: String,
    city: String,
    capacity: Number,
    image: String,
  },
  league: {
    id: Number,
    name: String,
    slug: String,
    country: String,
    logo: String,
  },
  seasonYear: Number,
  standings: {
    rank: Number,
    points: Number,
    played: Number,
    win: Number,
    draw: Number,
    lose: Number,
    goalsFor: Number,
    goalsAgainst: Number,
    goalsDiff: Number,
    form: String,
  },
  recentMatches: [{
    fixtureId: Number,
    date: Date,
    home: { name: String, logo: String, goals: Number },
    away: { name: String, logo: String, goals: Number },
    league: String,
    status: String,
  }],
  upcomingMatches: [{
    fixtureId: Number,
    date: Date,
    home: { name: String, logo: String },
    away: { name: String, logo: String },
    league: String,
  }],
  aiContent: String,
  aiContentGeneratedAt: Date,
  lastSyncedAt: Date,
}, {
  timestamps: true,
});

// Text index for search
TeamSchema.index({ name: 'text', country: 'text' });
TeamSchema.index({ 'league.id': 1 });

module.exports = mongoose.model('Team', TeamSchema);
