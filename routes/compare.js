/**
 * /api/compare — head-to-head and side-by-side data for two teams.
 *
 * GET /api/compare/teams?slugA=:slug&slugB=:slug
 * GET /api/compare/popular
 *
 * Thin HTTP layer over services/compareData. The service is shared with
 * routes/compareSsr.js so SSR HTML and React hydration see identical numbers.
 */

const express = require('express');
const router = express.Router();
const {
  getCompareTeamsData,
  getPopularComparisons,
  POPULAR_PAIRS,
} = require('../services/compareData');

router.get('/teams', async (req, res) => {
  try {
    const { slugA, slugB } = req.query;
    const result = await getCompareTeamsData({
      slugA, slugB,
      footballApi: req.app.locals.footballApi,
    });
    if (result.error === 'INVALID_SLUGS') {
      return res.status(400).json({ success: false, error: result.message });
    }
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: result.message });
    }
    if (result.error === 'UPSTREAM_UNAVAILABLE') {
      return res.status(503).json({ success: false, error: result.message });
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[compare/teams] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/popular', async (_req, res) => {
  try {
    const items = await getPopularComparisons();
    res.json({ success: true, items });
  } catch (err) {
    console.error('[compare/popular] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/popular-pairs', (_req, res) => {
  res.json({ success: true, pairs: POPULAR_PAIRS });
});

module.exports = router;
module.exports.POPULAR_PAIRS = POPULAR_PAIRS;
