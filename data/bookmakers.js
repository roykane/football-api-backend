// data/bookmakers.js - Bookmakers data and cache

// Bookmakers data - matches production API
const BOOKMAKERS_DATA = [
    // Tier 1 - Major bookmakers (sorted by seq)
    { id: 8, code: 'BET365', name: 'Bet365', tier: 1, seq: 1, country: 'UK', slug: 'bet365' },
    { id: 11, code: '1XBET', name: '1xBet', tier: 1, seq: 2, country: 'Russia', slug: '1xbet' },
    { id: 29, code: 'BETANO', name: 'Betano', tier: 1, seq: 3, country: 'Portugal', slug: 'betano' },
    { id: 16, code: 'MARATHONBET', name: 'Marathonbet', tier: 1, seq: 4, country: 'Russia', slug: 'marathonbet' },
    { id: 7, code: 'WILLIAM_HILL', name: 'William Hill', tier: 1, seq: 5, country: 'UK', slug: 'william-hill' },
    { id: 13, code: '10BET', name: '10Bet', tier: 1, seq: 6, country: 'UK', slug: '10bet' },
    { id: 9, code: 'PINNACLE', name: 'Pinnacle', tier: 1, seq: 7, country: 'Curacao', slug: 'pinnacle' },
    { id: 6, code: 'UNIBET', name: 'Unibet', tier: 1, seq: 8, country: 'Malta', slug: 'unibet' },
    { id: 31, code: 'SUPERBET', name: 'Superbet', tier: 1, seq: 9, country: 'Romania', slug: 'superbet' },
    { id: 10, code: 'BETFAIR', name: 'Betfair', tier: 1, seq: 10, country: 'UK', slug: 'betfair' },
    { id: 5, code: '888_SPORT', name: '888Sport', tier: 1, seq: 11, country: 'Gibraltar', slug: '888sport' },
    { id: 1, code: 'SBO', name: 'SBO', tier: 1, seq: 12, country: 'Philippines', slug: 'sbo' },
    { id: 18, code: '188BET', name: '188Bet', tier: 1, seq: 13, country: 'UK', slug: '188bet' },
    { id: 3, code: 'BETWAY', name: 'Betway', tier: 1, seq: 14, country: 'Malta', slug: 'betway' },
    { id: 28, code: 'FONBET', name: 'Fonbet', tier: 1, seq: 15, country: 'Russia', slug: 'fonbet' },

    // Tier 2 - Additional bookmakers
    { id: 12, code: 'BWIN', name: 'Bwin', tier: 2, seq: 16, country: 'Austria', slug: 'bwin' },
  ];
  
  // Bookmakers cache
  const bookmakersCache = {
    data: null,
    timestamp: null,
    TTL: 3600000 // 1 hour
  };
  
  function isBookmakersCacheValid() {
    if (!bookmakersCache.data || !bookmakersCache.timestamp) return false;
    return (Date.now() - bookmakersCache.timestamp) < bookmakersCache.TTL;
  }
  
  module.exports = {
    BOOKMAKERS_DATA,
    bookmakersCache,
    isBookmakersCacheValid
  };