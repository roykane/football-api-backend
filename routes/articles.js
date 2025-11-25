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
        .sort({ pubDate: -1 })
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
    const keyword = req.query.q;
    const limit = parseInt(req.query.limit) || 20;

    console.log(`[Articles API] Search: "${keyword}"`);

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Missing search keyword'
      });
    }

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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[Articles API] GET article: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid article ID'
      });
    }

    const article = await Article.getById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Increment views
    await Article.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('[Articles API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
