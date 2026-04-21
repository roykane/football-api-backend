/**
 * Public API for football knowledge articles
 *   GET /api/football-knowledge         → list
 *   GET /api/football-knowledge/:slug   → detail
 */

const express = require('express');
const router = express.Router();
const { articles } = require('../data/footballKnowledge');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    total: articles.length,
    articles: articles.map(a => ({
      slug: a.slug,
      title: a.title,
      metaDesc: a.metaDesc,
      category: a.category,
      icon: a.icon,
    })),
  });
});

router.get('/:slug', (req, res) => {
  const article = articles.find(a => a.slug === req.params.slug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(article);
});

module.exports = router;
