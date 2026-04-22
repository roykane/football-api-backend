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

  // SEO-friendly URL slug (e.g. "liverpool-thang-3-0-nguoc-dong-vs-arsenal-abc123")
  slug: {
    type: String,
    unique: true,
    sparse: true,
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

// Clean-slug from title: remove diacritics, non-alnum, collapse hyphens, cap 100 chars.
// No random tail — collision handling happens in the pre-save hook below.
function slugifyFromTitle(title) {
  return String(title || 'tin-bong-da')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
    .replace(/-$/, '');
}

ArticleSchema.statics.slugifyFromTitle = slugifyFromTitle;

// Auto-generate slug on save if missing. Three-tier collision handling:
//   1. Clean slug from title  (vd: "ngoai-hang-anh-tuan-11-...")
//   2. +YYYY-MM-DD on collision
//   3. +YYYY-MM-DD-xxxx (random 4-char) if still colliding — extremely rare
ArticleSchema.pre('save', async function(next) {
  try {
    if (this.slug) return next();
    const base = slugifyFromTitle(this.title);
    const Model = this.constructor;

    // Tier 1: clean slug
    if (!(await Model.exists({ slug: base }))) {
      this.slug = base;
      return next();
    }

    // Tier 2: clean + date
    const d = new Date(this.pubDate || Date.now());
    const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const withDate = `${base}-${datePart}`;
    if (!(await Model.exists({ slug: withDate }))) {
      this.slug = withDate;
      return next();
    }

    // Tier 3: clean + date + random (last resort)
    this.slug = `${withDate}-${Math.random().toString(36).slice(2, 6)}`;
    next();
  } catch (err) {
    next(err);
  }
});

// Static method: Get by slug
ArticleSchema.statics.getBySlug = function(slug) {
  return this.findOne({ slug, status: 'published' }).lean();
};

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
