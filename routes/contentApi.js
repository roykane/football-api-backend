const express = require('express');
const router = express.Router();
const roundPreviewGenerator = require('../services/round-preview-generator');
const h2hGenerator = require('../services/h2h-generator');
const AutoArticle = require('../models/AutoArticle');

// POST /api/content/generate-preview - Trigger round preview generation
router.post('/generate-preview', async (req, res) => {
  try {
    const { maxArticles = 3 } = req.body;
    console.log(`[ContentAPI] Manual round preview generation: max ${maxArticles}`);
    const result = await roundPreviewGenerator.run(parseInt(maxArticles));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ContentAPI] Preview generation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/content/generate-h2h - Trigger H2H generation
router.post('/generate-h2h', async (req, res) => {
  try {
    const { maxArticles = 5 } = req.body;
    console.log(`[ContentAPI] Manual H2H generation: max ${maxArticles}`);
    const result = await h2hGenerator.run(parseInt(maxArticles));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ContentAPI] H2H generation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/content/stats - Get auto article stats
router.get('/stats', async (req, res) => {
  try {
    const [previewCount, h2hCount, total] = await Promise.all([
      AutoArticle.countDocuments({ type: 'round-preview', status: 'published' }),
      AutoArticle.countDocuments({ type: 'h2h-analysis', status: 'published' }),
      AutoArticle.countDocuments({ status: 'published' }),
    ]);
    res.json({
      success: true,
      data: { total, previews: previewCount, h2h: h2hCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/content/articles - List auto articles
router.get('/articles', async (req, res) => {
  try {
    const { type, limit = 10, page = 1 } = req.query;
    const query = { status: 'published' };
    if (type) query.type = type;

    const [articles, total] = await Promise.all([
      AutoArticle.find(query)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean(),
      AutoArticle.countDocuments(query),
    ]);

    res.json({ success: true, data: { items: articles, total } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/content/articles/:slug - Get single article by slug
router.get('/articles/:slug', async (req, res) => {
  try {
    const article = await AutoArticle.findOne({
      slug: req.params.slug,
      status: 'published',
    }).lean();

    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Increment views
    AutoArticle.updateOne({ _id: article._id }, { $inc: { views: 1 } }).catch(() => {});

    // See routes/articles.js — force revalidation so admin edits are visible
    // on the next refresh.
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.json({ success: true, data: article });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
