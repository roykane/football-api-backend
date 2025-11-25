const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  // Original data from RSS
  originalTitle: {
    type: String,
    required: true,
  },
  originalDescription: {
    type: String,
  },
  originalLink: {
    type: String,
  },
  source: {
    type: String,
    required: true,
    index: true,
  },

  // AI-generated content
  title: {
    type: String,
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  tags: [{
    type: String,
    index: true,
  }],

  // Media
  image: {
    type: String,
  },

  // Metadata
  category: {
    type: String,
    default: 'general',
    enum: ['general', 'analysis', 'transfer', 'interview'],
    index: true,
  },
  status: {
    type: String,
    default: 'published',
    enum: ['draft', 'published', 'archived'],
    index: true,
  },
  pubDate: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // AI generation metadata
  aiModel: {
    type: String,
    default: 'claude-3-5-sonnet-20241022',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },

  // Statistics
  views: {
    type: Number,
    default: 0,
  },

}, {
  timestamps: true, // Auto add createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for query optimization
ArticleSchema.index({ pubDate: -1, status: 1 });
ArticleSchema.index({ source: 1, pubDate: -1 });
ArticleSchema.index({ tags: 1, status: 1 });
ArticleSchema.index({ title: 'text', content: 'text' }); // Full-text search

// Virtual for article ID as string
ArticleSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Static method: Get latest articles
ArticleSchema.statics.getLatest = function(limit = 20, category = null) {
  const query = { status: 'published' };
  if (category && category !== 'all') {
    query.category = category;
  }

  return this.find(query)
    .sort({ pubDate: -1 })
    .limit(limit)
    .lean();
};

// Static method: Get by ID
ArticleSchema.statics.getById = function(id) {
  return this.findById(id).lean();
};

// Static method: Check if article exists (by original title)
ArticleSchema.statics.existsByOriginalTitle = async function(originalTitle) {
  const count = await this.countDocuments({ originalTitle });
  return count > 0;
};

// Static method: Search articles
ArticleSchema.statics.search = function(keyword, limit = 20) {
  return this.find(
    {
      $text: { $search: keyword },
      status: 'published'
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
};

// Instance method: Increment views
ArticleSchema.methods.incrementViews = async function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Article', ArticleSchema);
