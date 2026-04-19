const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// GET /api/teams - List all teams
router.get('/', async (req, res) => {
  try {
    const { league, limit = 50, page = 1 } = req.query;
    const query = {};
    if (league) query['league.slug'] = league;

    const [teams, total] = await Promise.all([
      Team.find(query)
        .sort({ 'standings.rank': 1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select('-aiContent -recentMatches -upcomingMatches')
        .lean(),
      Team.countDocuments(query),
    ]);

    res.json({ success: true, data: { items: teams, total } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/teams/league/:leagueSlug - Teams by league
router.get('/league/:leagueSlug', async (req, res) => {
  try {
    const teams = await Team.find({ 'league.slug': req.params.leagueSlug })
      .sort({ 'standings.rank': 1 })
      .select('-aiContent')
      .lean();

    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/teams/:slug - Team detail
router.get('/:slug', async (req, res) => {
  try {
    const team = await Team.findOne({ slug: req.params.slug }).lean();

    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
