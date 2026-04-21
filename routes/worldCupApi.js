/**
 * Public API for World Cup 2026 sections
 *   GET /api/world-cup-2026              → list sections
 *   GET /api/world-cup-2026/:slug        → section detail
 */

const express = require('express');
const router = express.Router();
const { sections } = require('../data/worldCup2026');

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  const list = Object.values(sections).map(s => ({
    slug: s.slug,
    title: s.title,
    h1: s.h1,
    metaDesc: s.metaDesc,
    intro: s.intro,
  }));
  res.json({ total: list.length, sections: list });
});

router.get('/:slug', (req, res) => {
  const section = sections[req.params.slug];
  if (!section) return res.status(404).json({ error: 'Section not found' });
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(section);
});

module.exports = router;
