/**
 * Public JSON API for stadium seed data
 *   GET /api/stadiums          → list
 *   GET /api/stadiums/:slug    → detail
 */

const express = require('express');
const router = express.Router();
const { stadiums } = require('../data/stadiums');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    total: stadiums.length,
    stadiums: stadiums.map(s => ({
      slug: s.slug,
      name: s.name,
      city: s.city,
      country: s.country,
      homeTeam: s.homeTeam,
      capacity: s.capacity,
      opened: s.opened,
      image: s.image,
    })),
  });
});

router.get('/:slug', (req, res) => {
  const stadium = stadiums.find(s => s.slug === req.params.slug);
  if (!stadium) return res.status(404).json({ error: 'Stadium not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(stadium);
});

module.exports = router;
