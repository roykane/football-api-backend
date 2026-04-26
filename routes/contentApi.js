const express = require('express');
const router = express.Router();
const roundPreviewGenerator = require('../services/round-preview-generator');
const h2hGenerator = require('../services/h2h-generator');
const AutoArticle = require('../models/AutoArticle');
const { requireAdmin } = require('./adminAuth');

// POST /api/content/generate-preview - Trigger round preview generation
router.post('/generate-preview', requireAdmin, async (req, res) => {
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
router.post('/generate-h2h', requireAdmin, async (req, res) => {
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
//
// Query params:
//   type            'h2h-analysis' | 'round-preview' | (omitted = all)
//   limit, page     pagination (default 10, page 1)
//   sort            'match-date' to surface upcoming matches first (mirrors
//                   /api/soi-keo/hot semantics so /doi-dau and /preview hubs
//                   read like /nhan-dinh: today's matches at top, then
//                   tomorrow, then forward; recently-played matches in a
//                   second tier; older past dropped). Default falls back to
//                   chronological newest-created-first for backward compat.
//   pastWindowDays  how far back to surface played matches when
//                   sort=match-date (default 7 — H2H analysis stays
//                   relevant longer than a 90-min preview).
router.get('/articles', async (req, res) => {
  try {
    const { type, sort } = req.query;
    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const query = { status: 'published' };
    if (type) query.type = type;

    if (sort === 'match-date') {
      // Same two-bucket strategy as /api/soi-keo/hot. The "now" cutoff is
      // pulled back 1h so a kickoff that just started still counts as
      // upcoming (users following the match in real time still see it).
      const pastWindowDays = Math.min(
        Math.max(parseInt(req.query.pastWindowDays, 10) || 7, 1),
        30,
      );
      const now = new Date();
      const liveCutoff = new Date(now.getTime() - 60 * 60 * 1000);
      const pastCutoff = new Date(now.getTime() - pastWindowDays * 24 * 60 * 60 * 1000);

      const [upcoming, pastRecent] = await Promise.all([
        AutoArticle.find({
          ...query,
          'matchInfo.matchDate': { $gte: liveCutoff },
        })
          .sort({ 'matchInfo.matchDate': 1 })
          .lean(),
        AutoArticle.find({
          ...query,
          'matchInfo.matchDate': { $gte: pastCutoff, $lt: liveCutoff },
        })
          .sort({ 'matchInfo.matchDate': -1 })
          .lean(),
      ]);

      const combined = [...upcoming, ...pastRecent];
      const total = combined.length;
      const items = combined.slice(skip, skip + limitNum);
      // Tell the client which articles came from the "past recent" bucket so
      // it can render them under a separate "Đã diễn ra" section without
      // having to re-derive the cutoff from matchDate.
      const liveCutoffMs = liveCutoff.getTime();
      const itemsTagged = items.map((a) => ({
        ...a,
        _isPast: a.matchInfo?.matchDate
          ? new Date(a.matchInfo.matchDate).getTime() < liveCutoffMs
          : false,
      }));

      return res.json({
        success: true,
        data: {
          items: itemsTagged,
          total,
          upcomingCount: upcoming.length,
          pastCount: pastRecent.length,
        },
      });
    }

    const [articles, total] = await Promise.all([
      AutoArticle.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
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
