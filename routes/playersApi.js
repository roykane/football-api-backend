/**
 * Public API for Vietnamese players
 *   GET /api/players         → list
 *   GET /api/players/:slug   → detail
 */

const express = require('express');
const router = express.Router();
const { players } = require('../data/vietnamesePlayers');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    total: players.length,
    players: players.map(p => ({
      slug: p.slug,
      name: p.name,
      position: p.position,
      shirtNumber: p.shirtNumber,
      currentClub: p.currentClub,
      currentClubSlug: p.currentClubSlug,
      nationalTeam: p.nationalTeam,
      image: p.image,
      caps: p.caps,
      goals: p.goals,
    })),
  });
});

router.get('/:slug', (req, res) => {
  const player = players.find(p => p.slug === req.params.slug);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(player);
});

module.exports = router;
