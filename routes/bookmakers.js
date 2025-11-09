// routes/bookmakers.js - Bookmakers Router
const express = require('express');
const router = express.Router();
const { BOOKMAKERS_DATA, bookmakersCache, isBookmakersCacheValid } = require('../data/bookmakers');

/**
 * GET /api/bookmakers
 * Get all bookmakers with filters
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, tier, search, condition } = req.query;

    // Handle both direct tier param and condition[tier] param
    let tierFilter = tier;
    if (condition && condition.tier) {
      tierFilter = condition.tier;
    }

    console.log('📊 Fetching bookmakers:', { page, limit, tier: tierFilter, search, rawQuery: req.query });

    let bookmakers = [];

    if (isBookmakersCacheValid()) {
      console.log('✅ Using cached bookmakers');
      bookmakers = bookmakersCache.data;
    } else {
      console.log('🔄 Loading bookmakers data...');

      bookmakers = BOOKMAKERS_DATA.map(bookie => ({
        _id: `bookmaker-${bookie.id}`,
        id: bookie.id,
        code: bookie.code,
        name: bookie.name,
        slug: bookie.slug,
        tier: bookie.tier,
        seq: bookie.seq,
        country: bookie.country,
        logo: `https://media.api-sports.io/football/bookmakers/${bookie.id}.png`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      bookmakersCache.data = bookmakers;
      bookmakersCache.timestamp = Date.now();

      console.log(`✅ Cached ${bookmakers.length} bookmakers`);
    }

    // Apply filters
    let filtered = [...bookmakers];

    // Filter to only show the 4 main bookmakers we support
    const ALLOWED_BOOKMAKER_IDS = [8, 18, 1, 11]; // Bet365, 188Bet, SBO, 1xBet
    filtered = filtered.filter(bookie => ALLOWED_BOOKMAKER_IDS.includes(bookie.id));
    console.log(`✅ Filtered to ${ALLOWED_BOOKMAKER_IDS.length} allowed bookmakers: ${filtered.length} found`);

    if (tierFilter) {
      const tierValue = parseInt(tierFilter);
      filtered = filtered.filter(bookie => bookie.tier === tierValue);
      console.log(`✅ Filtered to tier ${tierValue}: ${filtered.length} bookmakers`);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(bookie =>
        bookie.name.toLowerCase().includes(searchLower) ||
        bookie.country.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.seq - b.seq;
    });
    
    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedBookmakers = filtered.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        items: paginatedBookmakers,
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filtered.length / limitNum)
      },
      meta: {
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limitNum),
          hasNextPage: endIndex < filtered.length,
          hasPrevPage: pageNum > 1
        },
        filters: {
          tier: tier ? parseInt(tier) : null,
          search: search || null
        },
        cache: {
          cached: isBookmakersCacheValid(),
          timestamp: bookmakersCache.timestamp
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching bookmakers:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch bookmakers',
      message: error.message 
    });
  }
});

/**
 * GET /api/bookmakers/:id
 * Get single bookmaker by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bookmaker = BOOKMAKERS_DATA.find(b => b.id === parseInt(id));
    
    if (!bookmaker) {
      return res.status(404).json({
        success: false,
        error: 'Bookmaker not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        _id: `bookmaker-${bookmaker.id}`,
        id: bookmaker.id,
        code: bookmaker.code,
        name: bookmaker.name,
        slug: bookmaker.slug,
        tier: bookmaker.tier,
        seq: bookmaker.seq,
        country: bookmaker.country,
        logo: `https://media.api-sports.io/football/bookmakers/${bookmaker.id}.png`
      }
    });
    
  } catch (error) {
    console.error('Error fetching bookmaker:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookmaker',
      message: error.message
    });
  }
});

module.exports = router;