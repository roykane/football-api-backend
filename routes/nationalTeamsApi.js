/**
 * Public JSON API for national-team seed data
 *   GET /api/national-teams          → list grouped + flat
 *   GET /api/national-teams/:slug    → detail
 */

const express = require('express');
const router = express.Router();
const { teams } = require('../data/nationalTeams');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    total: teams.length,
    teams: teams.map(t => ({
      slug: t.slug,
      name: t.name,
      nameEn: t.nameEn,
      confederation: t.confederation,
      nickname: t.nickname,
      coach: t.coach,
      flag: t.flag,
      bestFinish: t.bestFinish,
    })),
  });
});

router.get('/:slug', (req, res) => {
  const team = teams.find(t => t.slug === req.params.slug);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(team);
});

module.exports = router;
