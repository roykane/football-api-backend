// routes/countries.js - Countries and Bookmakers Router
const express = require('express');
const router = express.Router();
const { POPULAR_LEAGUES, getFlagCode } = require('../data/leagues');
const { BOOKMAKERS_DATA } = require('../data/bookmakers');

// Countries cache
const countriesCache = {
  data: null,
  timestamp: null,
  TTL: 3600000 // 1 hour
};

function isCountriesCacheValid() {
  if (!countriesCache.data || !countriesCache.timestamp) return false;
  return (Date.now() - countriesCache.timestamp) < countriesCache.TTL;
}

/**
 * Get flag URL for a country
 * Uses proper ISO country codes mapping
 */
function getFlagUrl(countryName) {
  const flagCode = getFlagCode(countryName);
  return `https://flagicons.lipis.dev/flags/4x3/${flagCode}.svg`;
}

/**
 * GET /api/countries
 * Get all countries with their leagues
 */
router.get('/', async (req, res) => {
  try {
    console.log('🌍 GET /api/countries');

    let countries = [];

    if (isCountriesCacheValid()) {
      console.log('✅ Using cached countries');
      countries = countriesCache.data;
    } else {
      console.log('🔄 Building countries data...');

      // Group leagues by country
      const countryMap = new Map();

      POPULAR_LEAGUES.forEach(league => {
        if (!countryMap.has(league.country)) {
          countryMap.set(league.country, {
            _id: `country-${league.country.toLowerCase().replace(/\s+/g, '-')}`,
            name: league.country,
            code: league.country === 'World' ? 'INT' : league.country.substring(0, 2).toUpperCase(),
            slug: league.country.toLowerCase().replace(/\s+/g, '-'),
            flag: getFlagUrl(league.country),
            leagues: []
          });
        }

        countryMap.get(league.country).leagues.push({
          id: league.id,
          name: league.name,
          tier: league.tier,
          seq: league.seq,
          logo: `https://media.api-sports.io/football/leagues/${league.id}.png`
        });
      });

      countries = Array.from(countryMap.values());

      // Sort countries
      countries.sort((a, b) => {
        if (a.name === 'World') return -1;
        if (b.name === 'World') return 1;
        return a.name.localeCompare(b.name);
      });

      countriesCache.data = countries;
      countriesCache.timestamp = Date.now();

      console.log(`✅ Cached ${countries.length} countries`);
    }

    res.json({
      success: true,
      data: {
        items: countries,
        total: countries.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch countries',
      message: error.message
    });
  }
});

/**
 * GET /api/countries/national
 * Get international/national competitions
 */
router.get('/national', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    console.log('🏆 GET /api/countries/national');

    // Filter leagues from 'World' country
    const nationalLeagues = POPULAR_LEAGUES
      .filter(league => league.country === 'World')
      .map(league => ({
        _id: `league-${league.id}`,
        id: league.id,
        name: league.name,
        tier: league.tier,
        seq: league.seq,
        logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
        country: {
          name: 'World',
          code: 'INT',
          flag: 'https://flagicons.lipis.dev/flags/4x3/xx.svg'
        }
      }))
      .sort((a, b) => a.seq - b.seq);

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedLeagues = nationalLeagues.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        items: paginatedLeagues,
        total: nationalLeagues.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(nationalLeagues.length / limitNum)
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch national competitions',
      message: error.message
    });
  }
});

/**
 * GET /api/countries/other
 * Get other/smaller countries
 */
router.get('/other', async (req, res) => {
  try {
    console.log('🌎 GET /api/countries/other');

    // Filter tier 3 and 4 leagues
    const otherLeagues = POPULAR_LEAGUES
      .filter(league => league.tier >= 3)
      .map(league => ({
        _id: `league-${league.id}`,
        id: league.id,
        name: league.name,
        country: league.country,
        tier: league.tier,
        seq: league.seq,
        logo: `https://media.api-sports.io/football/leagues/${league.id}.png`
      }))
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.seq - b.seq;
      });

    res.json({
      success: true,
      data: {
        items: otherLeagues,
        total: otherLeagues.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch other countries',
      message: error.message
    });
  }
});

/**
 * GET /api/countries/:slug
 * Get leagues of a specific country
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    console.log(`🔍 GET /api/countries/${slug}`);

    // Find country by slug
    const countryName = slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const leagues = POPULAR_LEAGUES
      .filter(league =>
        league.country.toLowerCase().replace(/\s+/g, '-') === slug ||
        league.country.toLowerCase() === countryName.toLowerCase()
      )
      .map(league => ({
        _id: `league-${league.id}`,
        id: league.id,
        name: league.name,
        tier: league.tier,
        seq: league.seq,
        logo: `https://media.api-sports.io/football/leagues/${league.id}.png`
      }))
      .sort((a, b) => a.seq - b.seq);

    if (leagues.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Country not found'
      });
    }

    res.json({
      success: true,
      data: {
        country: {
          name: leagues[0].name,
          slug: slug
        },
        leagues: leagues,
        total: leagues.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch country leagues',
      message: error.message
    });
  }
});

/**
 * GET /api/bookmakers
 * Get all bookmakers
 */
router.get('/bookmakers', async (req, res) => {
  try {
    const { page = 1, limit = 20, tier } = req.query;

    console.log('📊 GET /api/bookmakers');

    let bookmakers = BOOKMAKERS_DATA.map(bookie => ({
      _id: `bookmaker-${bookie.id}`,
      id: bookie.id,
      name: bookie.name,
      tier: bookie.tier,
      seq: bookie.seq,
      country: bookie.country,
      logo: `https://media.api-sports.io/football/bookmakers/${bookie.id}.png`
    }));

    // Filter by tier if provided
    if (tier) {
      const tierValue = parseInt(tier);
      bookmakers = bookmakers.filter(b => b.tier === tierValue);
    }

    // Sort
    bookmakers.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.seq - b.seq;
    });

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedBookmakers = bookmakers.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        items: paginatedBookmakers,
        total: bookmakers.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(bookmakers.length / limitNum)
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmakers',
      message: error.message
    });
  }
});

module.exports = router;
