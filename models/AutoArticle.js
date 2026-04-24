const mongoose = require('mongoose');

const AutoArticleSchema = new mongoose.Schema({
  // Article type
  type: {
    type: String,
    enum: ['round-preview', 'h2h-analysis'],
    required: true,
    index: true,
  },

  // Common fields
  slug: {
    type: String,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  excerpt: {
    type: String,
    maxLength: 500,
  },
  content: {
    type: String, // Full HTML or markdown content, single string
    required: true,
  },
  metaTitle: String,
  metaDescription: String,
  tags: [{
    type: String,
    index: true,
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
    index: true,
  },

  // Admin review flags — see Article.js for semantics.
  contentReviewed: { type: Boolean, default: false, index: true },
  imageReviewed:   { type: Boolean, default: false, index: true },
  reviewedAt:      { type: Date,    default: null },

  views: {
    type: Number,
    default: 0,
  },
  aiModel: {
    type: String,
    default: 'claude-haiku-4-5-20251001',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },

  // For round-preview
  leagueInfo: {
    id: Number,
    name: String,
    slug: String,
    country: String,
    logo: String,
  },
  round: String,
  seasonYear: Number,

  // For h2h-analysis
  fixtureId: {
    type: Number,
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
  },
  h2hStats: {
    totalMatches: Number,
    homeWins: Number,
    awayWins: Number,
    draws: Number,
    avgGoals: Number,
  },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound indexes
AutoArticleSchema.index({ type: 1, slug: 1 });
AutoArticleSchema.index({ type: 1, 'leagueInfo.id': 1 });
AutoArticleSchema.index({ type: 1, fixtureId: 1 });
AutoArticleSchema.index({ status: 1, createdAt: -1 });

// Virtual for id
AutoArticleSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Helper: normalize string for slug
function normalizeForSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Pre-save: auto-generate slug based on type
AutoArticleSchema.pre('save', function (next) {
  if (!this.slug) {
    if (this.type === 'round-preview' && this.leagueInfo && this.round) {
      // preview-{league-slug}-vong-{round}-{season}
      const leagueSlug = this.leagueInfo.slug || normalizeForSlug(this.leagueInfo.name || 'unknown');
      const roundSlug = normalizeForSlug(this.round);
      this.slug = `preview-${leagueSlug}-vong-${roundSlug}-${this.seasonYear || 2025}`;
    } else if (this.type === 'h2h-analysis' && this.matchInfo) {
      // doi-dau-{home}-vs-{away}-{dd-mm-yyyy}
      const homeName = normalizeForSlug(this.matchInfo.homeTeam?.name || 'home');
      const awayName = normalizeForSlug(this.matchInfo.awayTeam?.name || 'away');
      const date = this.matchInfo.matchDate ? new Date(this.matchInfo.matchDate) : new Date();
      const dd = date.getDate().toString().padStart(2, '0');
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = date.getFullYear();
      this.slug = `doi-dau-${homeName}-vs-${awayName}-${dd}-${mm}-${yyyy}`;
    }
  }
  next();
});

// Static: get by slug
AutoArticleSchema.statics.getBySlug = function (slug) {
  return this.findOne({ slug, status: 'published' }).lean();
};

// Static: get by type with pagination
AutoArticleSchema.statics.getByType = function (type, { limit = 10, skip = 0, status = 'published' } = {}) {
  const query = { type };
  if (status) query.status = status;
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static: check if round-preview exists for league+round+season
AutoArticleSchema.statics.existsRoundPreview = async function (leagueId, round, seasonYear) {
  const count = await this.countDocuments({
    type: 'round-preview',
    'leagueInfo.id': leagueId,
    round: round,
    seasonYear: seasonYear,
  });
  return count > 0;
};

// Static: check if h2h-analysis exists for fixtureId
AutoArticleSchema.statics.existsH2H = async function (fixtureId) {
  const count = await this.countDocuments({
    type: 'h2h-analysis',
    fixtureId: fixtureId,
  });
  return count > 0;
};

// Static: get latest articles across types
AutoArticleSchema.statics.getLatest = function (limit = 10) {
  return this.find({ status: 'published' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static: cleanup old articles (7 days for finished matches)
AutoArticleSchema.statics.cleanupOldArticles = async function (daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // For h2h-analysis: delete if match date has passed and article is old
  const h2hResult = await this.deleteMany({
    type: 'h2h-analysis',
    createdAt: { $lt: cutoffDate },
    'matchInfo.matchDate': { $lt: new Date() },
  });

  // For round-preview: delete if article is old (round is likely over)
  const previewResult = await this.deleteMany({
    type: 'round-preview',
    createdAt: { $lt: cutoffDate },
  });

  const totalDeleted = h2hResult.deletedCount + previewResult.deletedCount;
  return {
    deleted: totalDeleted,
    h2hDeleted: h2hResult.deletedCount,
    previewDeleted: previewResult.deletedCount,
    cutoffDate,
  };
};

// Instance: increment views
AutoArticleSchema.methods.incrementViews = async function () {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('AutoArticle', AutoArticleSchema);
