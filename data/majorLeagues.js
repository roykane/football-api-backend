// data/majorLeagues.js - Major leagues configuration

/**
 * Danh sách các giải đấu lớn được hỗ trợ
 * Chỉ những giải này mới có thể query standings
 */
const MAJOR_LEAGUES = [
    // ============================================
    // TOP 5 LEAGUES - TIER 1
    // ============================================
    {
      id: 39,
      code: 'ENG1',
      name: 'Premier League',
      country: 'England',
      countryCode: 'GB',
      tier: 1,
      seq: 1,
      displayName: 'Anh'
    },
    {
      id: 140,
      code: 'SPA1',
      name: 'La Liga',
      country: 'Spain',
      countryCode: 'ES',
      tier: 1,
      seq: 2,
      displayName: 'TBN'
    },
    {
      id: 135,
      code: 'ITA1',
      name: 'Serie A',
      country: 'Italy',
      countryCode: 'IT',
      tier: 1,
      seq: 3,
      displayName: 'Ý'
    },
    {
      id: 78,
      code: 'GER1',
      name: 'Bundesliga',
      country: 'Germany',
      countryCode: 'DE',
      tier: 1,
      seq: 4,
      displayName: 'Đức'
    },
    {
      id: 61,
      code: 'FRA1',
      name: 'Ligue 1',
      country: 'France',
      countryCode: 'FR',
      tier: 1,
      seq: 5,
      displayName: 'Pháp'
    },
  
    // ============================================
    // EUROPEAN TIER 2 - TOP LEAGUES
    // ============================================
    {
      id: 94,
      code: 'POR1',
      name: 'Primeira Liga',
      country: 'Portugal',
      countryCode: 'PT',
      tier: 2,
      seq: 1,
      displayName: 'Bồ Đào Nha'
    },
    {
      id: 88,
      code: 'NED1',
      name: 'Eredivisie',
      country: 'Netherlands',
      countryCode: 'NL',
      tier: 2,
      seq: 2,
      displayName: 'Hà Lan'
    },
    {
      id: 144,
      code: 'BEL1',
      name: 'Jupiler Pro League',
      country: 'Belgium',
      countryCode: 'BE',
      tier: 2,
      seq: 3,
      displayName: 'Bỉ'
    },
    {
      id: 203,
      code: 'TUR1',
      name: 'Super Lig',
      country: 'Turkey',
      countryCode: 'TR',
      tier: 2,
      seq: 4,
      displayName: 'Thổ Nhĩ Kỳ'
    },
  
    // ============================================
    // SOUTH AMERICA - TOP LEAGUES
    // ============================================
    {
      id: 71,
      code: 'BRA1',
      name: 'Serie A',
      country: 'Brazil',
      countryCode: 'BR',
      tier: 2,
      seq: 5,
      displayName: 'Brazil'
    },
    {
      id: 128,
      code: 'ARG1',
      name: 'Primera Division',
      country: 'Argentina',
      countryCode: 'AR',
      tier: 2,
      seq: 6,
      displayName: 'Argentina'
    },
  
    // ============================================
    // INTERNATIONAL COMPETITIONS
    // ============================================
    {
      id: 2,
      code: 'UCL',
      name: 'UEFA Champions League',
      country: 'World',
      countryCode: 'EU',
      tier: 0,
      seq: 1,
      displayName: 'Champions League'
    },
    {
      id: 3,
      code: 'UEL',
      name: 'UEFA Europa League',
      country: 'World',
      countryCode: 'EU',
      tier: 0,
      seq: 2,
      displayName: 'Europa League'
    },
    {
      id: 848,
      code: 'UECL',
      name: 'UEFA Europa Conference League',
      country: 'World',
      countryCode: 'EU',
      tier: 0,
      seq: 3,
      displayName: 'Conference League'
    },
    {
      id: 1,
      code: 'WC',
      name: 'World Cup',
      country: 'World',
      countryCode: 'INT',
      tier: 0,
      seq: 4,
      displayName: 'World Cup'
    },
    {
      id: 4,
      code: 'EURO',
      name: 'Euro Championship',
      country: 'World',
      countryCode: 'EU',
      tier: 0,
      seq: 5,
      displayName: 'EURO'
    }
  ];
  
  /**
   * Map league ID to league data
   */
  const MAJOR_LEAGUES_MAP = new Map(
    MAJOR_LEAGUES.map(league => [league.id, league])
  );
  
  /**
   * Get allowed league IDs
   */
  function getAllowedLeagueIds() {
    return MAJOR_LEAGUES.map(league => league.id);
  }
  
  /**
   * Check if league is allowed
   */
  function isLeagueAllowed(leagueId) {
    const id = typeof leagueId === 'string' 
      ? parseInt(leagueId.replace('league-', ''))
      : leagueId;
    
    return MAJOR_LEAGUES_MAP.has(id);
  }
  
  /**
   * Get league data by ID
   */
  function getLeagueData(leagueId) {
    const id = typeof leagueId === 'string' 
      ? parseInt(leagueId.replace('league-', ''))
      : leagueId;
    
    return MAJOR_LEAGUES_MAP.get(id) || null;
  }
  
  /**
   * Get top 5 leagues only
   */
  function getTop5Leagues() {
    return MAJOR_LEAGUES.filter(league => league.tier === 1);
  }
  
  /**
   * Get leagues by tier
   */
  function getLeaguesByTier(tier) {
    return MAJOR_LEAGUES.filter(league => league.tier === tier);
  }
  
  module.exports = {
    MAJOR_LEAGUES,
    MAJOR_LEAGUES_MAP,
    getAllowedLeagueIds,
    isLeagueAllowed,
    getLeagueData,
    getTop5Leagues,
    getLeaguesByTier
  };