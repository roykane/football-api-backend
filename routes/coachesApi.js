/**
 * Public API for coaches
 *   GET /api/coaches         → list
 *   GET /api/coaches/:slug   → detail
 */

const express = require('express');
const router = express.Router();
const { coaches } = require('../data/coaches');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    total: coaches.length,
    coaches: coaches.map(c => ({
      slug: c.slug,
      name: c.name,
      nationality: c.nationality,
      tenure: c.tenure,
      role: c.role,
      status: c.status,
      image: c.image,
    })),
  });
});

router.get('/:slug', (req, res) => {
  const coach = coaches.find(c => c.slug === req.params.slug);
  if (!coach) return res.status(404).json({ error: 'Coach not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(coach);
});

module.exports = router;
