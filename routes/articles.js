const express = require('express');
const mongoose = require('mongoose');
const Article = require('../models/Article');
const router = express.Router();

/**
 * GET /api/articles - Get all articles
 */
router.get('/', async (req, res) => {
  try {
    console.log('[Articles API] GET /api/articles');

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const category = req.query.category || 'all';
    const skip = (page - 1) * limit;

    const query = { status: 'published' };
    if (category && category !== 'all') {
      query.category = category;
    }

    const [articles, total] = await Promise.all([
      Article.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Article.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: articles,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[Articles API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/articles/search?q=keyword
 */
router.get('/search', async (req, res) => {
  try {
    const rawKeyword = req.query.q;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    if (typeof rawKeyword !== 'string' || !rawKeyword.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing search keyword'
      });
    }
    // Strip control chars + Mongo operator-like characters; cap length.
    const keyword = rawKeyword
      .replace(/[\u0000-\u001F\u007F$]/g, ' ')
      .trim()
      .slice(0, 100);

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search keyword'
      });
    }

    console.log(`[Articles API] Search: "${keyword}"`);

    const articles = await Article.search(keyword, limit);

    res.json({
      success: true,
      data: articles,
      count: articles.length
    });
  } catch (error) {
    console.error('[Articles API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/articles/:id - Get article by ID
 */
router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    console.log(`[Articles API] GET article: ${idOrSlug}`);

    // Support both ObjectId (legacy) and slug (preferred)
    let article;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      article = await Article.findById(idOrSlug).lean();
    }
    if (!article) {
      article = await Article.findOne({ slug: idOrSlug, status: 'published' }).lean();
    }

    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    // Admins edit content/images live — don't let browsers serve a stale
    // article after an admin update. Force a conditional revalidation on
    // every request so edits are visible on the next refresh without the
    // reader needing a hard reload.
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.json({ success: true, data: article });
  } catch (error) {
    console.error('[Articles API] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

module.exports = router;
