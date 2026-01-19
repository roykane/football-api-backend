const mongoose = require('mongoose');

const SoiKeoArticleSchema = new mongoose.Schema({
  // Match Information
  fixtureId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  matchInfo: {
    homeTeam: {
      id: Number,
      name: String,
      logo: String,
    },
    awayTeam: {
      id: Number,
      name: String,
      logo: String,
    },
    league: {
      id: Number,
      name: String,
      logo: String,
      country: String,
    },
    matchDate: Date,
    venue: String,
  },

  // Odds Data (snapshot at generation time)
  oddsData: {
    homeWin: Number,
    draw: Number,
    awayWin: Number,
    handicap: {
      line: String,
      home: Number,
      away: Number,
    },
    overUnder: {
      line: Number,
      over: Number,
      under: Number,
    },
  },

  // AI-Generated Content
  title: {
    type: String,
    required: true,
    index: true,
  },
  slug: {
    type: String,
    unique: true,
    index: true,
  },
  excerpt: {
    type: String,
    maxLength: 500,
  },
  content: {
    introduction: String,
    teamAnalysis: String,
    h2hHistory: String,
    formAnalysis: String,
    oddsAnalysis: String,
    prediction: String,
    bettingTips: String,
  },

  // Metadata
  thumbnail: String,
  tags: [{
    type: String,
    index: true,
  }],
  category: {
    type: String,
    default: 'soi-keo',
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
    index: true,
  },
  views: {
    type: Number,
    default: 0,
  },

  // AI Generation Metadata
  aiModel: {
    type: String,
    default: 'claude-3-haiku-20240307',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },

  // SEO
  metaTitle: String,
  metaDescription: String,

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for query optimization
SoiKeoArticleSchema.index({ 'matchInfo.matchDate': 1 });
SoiKeoArticleSchema.index({ status: 1, createdAt: -1 });
SoiKeoArticleSchema.index({ 'matchInfo.league.id': 1 });
SoiKeoArticleSchema.index({ title: 'text', 'content.introduction': 'text' });

// Virtual for article ID as string
SoiKeoArticleSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Pre-save middleware to generate slug
SoiKeoArticleSchema.pre('save', function(next) {
  if (!this.slug && this.matchInfo) {
    this.slug = this.generateSlug();
  }
  next();
});

// Instance method: Generate slug from match info
// Format: soi-keo-[team1]-vs-[team2]-[HH]h[MM]-ngay-[DD]-[MM]-[YYYY]
SoiKeoArticleSchema.methods.generateSlug = function() {
  const { homeTeam, awayTeam, matchDate } = this.matchInfo;

  // Normalize team names (remove diacritics, special chars)
  const normalizeTeamName = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const homeName = normalizeTeamName(homeTeam.name);
  const awayName = normalizeTeamName(awayTeam.name);

  // Format date: HHhMM-ngay-DD-MM-YYYY
  const date = new Date(matchDate);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `soi-keo-${homeName}-vs-${awayName}-${hours}h${minutes}-ngay-${day}-${month}-${year}`;
};

// Static method: Get latest articles
SoiKeoArticleSchema.statics.getLatest = function(limit = 10) {
  return this.find({ status: 'published' })
    .sort({ 'matchInfo.matchDate': 1, createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method: Get upcoming match articles
SoiKeoArticleSchema.statics.getUpcoming = function(limit = 5) {
  const now = new Date();
  return this.find({
    status: 'published',
    'matchInfo.matchDate': { $gte: now }
  })
    .sort({ 'matchInfo.matchDate': 1 })
    .limit(limit)
    .lean();
};

// Static method: Get by slug
SoiKeoArticleSchema.statics.getBySlug = function(slug) {
  return this.findOne({ slug, status: 'published' }).lean();
};

// Static method: Get by fixture ID
SoiKeoArticleSchema.statics.getByFixtureId = function(fixtureId) {
  return this.findOne({ fixtureId }).lean();
};

// Static method: Check if article exists for fixture
SoiKeoArticleSchema.statics.existsByFixtureId = async function(fixtureId) {
  const count = await this.countDocuments({ fixtureId });
  return count > 0;
};

// Static method: Get hot articles (newest first, then by match date)
// Returns articles sorted by creation date (newest first)
SoiKeoArticleSchema.statics.getHot = function(limit = 10) {
  return this.find({ status: 'published' })
    .sort({ createdAt: -1, 'matchInfo.matchDate': 1 })
    .limit(limit)
    .lean();
};

// Static method: Get articles by league
SoiKeoArticleSchema.statics.getByLeague = function(leagueId, limit = 10) {
  return this.find({
    status: 'published',
    'matchInfo.league.id': leagueId
  })
    .sort({ 'matchInfo.matchDate': 1 })
    .limit(limit)
    .lean();
};

// Static method: Count articles generated today
SoiKeoArticleSchema.statics.countToday = async function() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return this.countDocuments({
    generatedAt: { $gte: startOfDay }
  });
};

// Instance method: Increment views
SoiKeoArticleSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

// Static method: Delete old articles (older than specified days)
// Only deletes articles where the match has already finished (matchDate < now)
SoiKeoArticleSchema.statics.cleanupOldArticles = async function(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // Only delete articles where:
  // 1. The article was created more than X days ago
  // 2. The match date has passed (match is finished)
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    'matchInfo.matchDate': { $lt: new Date() } // Match already finished
  });

  return {
    deleted: result.deletedCount,
    cutoffDate
  };
};

// Static method: Get old articles count (for preview before delete)
SoiKeoArticleSchema.statics.countOldArticles = async function(daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.countDocuments({
    createdAt: { $lt: cutoffDate },
    'matchInfo.matchDate': { $lt: new Date() }
  });
};

module.exports = mongoose.model('SoiKeoArticle', SoiKeoArticleSchema);
