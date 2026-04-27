/**
 * Public JSON API for individual-award seed data
 *   GET /api/awards          → list
 *   GET /api/awards/:slug    → detail
 */

const express = require('express');
const router = express.Router();
const { awards } = require('../data/awards');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    total: awards.length,
    awards: awards.map(a => ({
      slug: a.slug,
      name: a.name,
      nameEn: a.nameEn,
      organizer: a.organizer,
      foundedYear: a.foundedYear,
      image: a.image,
      latestWinner: a.recentWinners?.[0] || null,
    })),
  });
});

router.get('/:slug', (req, res) => {
  const award = awards.find(a => a.slug === req.params.slug);
  if (!award) return res.status(404).json({ error: 'Award not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(award);
});

module.exports = router;
