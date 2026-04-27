/**
 * Public JSON API for the world-players seed data
 *   GET /api/world-players          → list
 *   GET /api/world-players/:slug    → detail
 *
 * Mirrors playersApi.js shape so the FE service file can be a near-copy
 * of player.service.ts.
 */

const express = require('express');
const router = express.Router();
const { players } = require('../data/worldPlayers');

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
