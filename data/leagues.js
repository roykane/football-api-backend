// data/leagues.js - Popular leagues data and cache

// Popular leagues/competitions
const POPULAR_LEAGUES = [
    // Tier 1 - Top leagues
    { id: 39, name: 'Premier League', country: 'England', tier: 1, seq: 1 },
    { id: 140, name: 'La Liga', country: 'Spain', tier: 1, seq: 2 },
    { id: 135, name: 'Serie A', country: 'Italy', tier: 1, seq: 3 },
    { id: 78, name: 'Bundesliga', country: 'Germany', tier: 1, seq: 4 },
    { id: 61, name: 'Ligue 1', country: 'France', tier: 1, seq: 5 },
    { id: 2, name: 'UEFA Champions League', country: 'World', tier: 1, seq: 6 },
    { id: 1, name: 'World Cup', country: 'World', tier: 1, seq: 7 },
    
    // Tier 2
    { id: 3, name: 'UEFA Europa League', country: 'World', tier: 2, seq: 1 },
    { id: 848, name: 'Europa Conference League', country: 'World', tier: 2, seq: 2 },
    { id: 94, name: 'Primeira Liga', country: 'Portugal', tier: 2, seq: 3 },
    { id: 88, name: 'Eredivisie', country: 'Netherlands', tier: 2, seq: 4 },
    { id: 71, name: 'Serie A', country: 'Brazil', tier: 2, seq: 5 },
    { id: 128, name: 'Liga Profesional', country: 'Argentina', tier: 2, seq: 6 },
    
    // Tier 3
    { id: 144, name: 'Jupiler Pro League', country: 'Belgium', tier: 3, seq: 1 },
    { id: 203, name: 'Süper Lig', country: 'Turkey', tier: 3, seq: 2 },
    { id: 253, name: 'Major League Soccer', country: 'USA', tier: 3, seq: 3 },
    { id: 119, name: 'Superliga', country: 'Denmark', tier: 3, seq: 4 },
    { id: 40, name: 'Championship', country: 'England', tier: 3, seq: 5 },
    { id: 141, name: 'LaLiga 2', country: 'Spain', tier: 3, seq: 6 },
    
    // Tier 4 - Additional leagues
    { id: 113, name: 'Allsvenskan', country: 'Sweden', tier: 4, seq: 1 },
    { id: 103, name: 'Eliteserien', country: 'Norway', tier: 4, seq: 2 },
    { id: 179, name: 'Premiership', country: 'Scotland', tier: 4, seq: 3 },
    { id: 235, name: 'Premier League', country: 'Russia', tier: 4, seq: 4 },
    { id: 262, name: 'Liga MX', country: 'Mexico', tier: 4, seq: 5 },
  ];
  
  // Competitions cache
  const competitionsCache = {
    data: null,
    timestamp: null,
    TTL: 3600000 // 1 hour
  };
  
  function isCompetitionsCacheValid() {
    if (!competitionsCache.data || !competitionsCache.timestamp) return false;
    return (Date.now() - competitionsCache.timestamp) < competitionsCache.TTL;
  }

  /**
   * Get flag icon code for a country
   * Maps country names to valid flag icon codes (ISO 3166-1 alpha-2 or subdivisions)
   */
  function getFlagCode(countryName) {
    // Map country names to ISO 3166-1 alpha-2 codes or subdivision codes
    const flagCodeMap = {
      // UK Countries (subdivision codes)
      'England': 'gb-eng',
      'Scotland': 'gb-sct',
      'Wales': 'gb-wls',
      'Northern Ireland': 'gb-nir',

      // International
      'World': 'un',

      // European Countries (ISO 3166-1 alpha-2)
      'Spain': 'es',
      'Italy': 'it',
      'Germany': 'de',
      'France': 'fr',
      'Portugal': 'pt',
      'Netherlands': 'nl',
      'Belgium': 'be',
      'Turkey': 'tr',
      'Denmark': 'dk',
      'Sweden': 'se',
      'Norway': 'no',
      'Russia': 'ru',

      // American Countries
      'Brazil': 'br',
      'Argentina': 'ar',
      'USA': 'us',
      'Mexico': 'mx',
    };

    // Return mapped code or fallback to lowercase
    return flagCodeMap[countryName] || countryName.toLowerCase().replace(/\s+/g, '-');
  }

  module.exports = {
    POPULAR_LEAGUES,
    competitionsCache,
    isCompetitionsCacheValid,
    getFlagCode
  };