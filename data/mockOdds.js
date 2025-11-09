// data/mockOdds.js - Mock odds data for testing frontend

/**
 * Generate mock odds for different bet types
 * This simulates real odds data structure that frontend expects
 */

function generateMockOdds(bookmakerName) {
  // Different odds ranges for variety
  const getRandomOdd = (min, max) => {
    return (Math.random() * (max - min) + min).toFixed(2);
  };

  const getRandomHandicap = () => {
    const handicaps = ['-1.5', '-1.0', '-0.75', '-0.5', '-0.25', '0', '+0.25', '+0.5', '+0.75', '+1.0', '+1.5'];
    return handicaps[Math.floor(Math.random() * handicaps.length)];
  };

  const getRandomGoalLine = () => {
    const lines = ['1.5', '2.0', '2.25', '2.5', '2.75', '3.0', '3.25', '3.5'];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  // Helper to create bet with both values and opening
  const createBet = (type, oddsArray) => {
    // Deep copy to ensure opening and values have same values
    const valueCopy = oddsArray.map(item => ({...item}));
    return {
      type: type,
      values: valueCopy, // Current odds
      opening: valueCopy // Opening odds (same as current for mock)
    };
  };

  return {
    name: bookmakerName,
    bets: [
      // Asian Handicap
      createBet('asian_handicap', [
        { value: getRandomHandicap(), odd: getRandomOdd(1.75, 2.10) },
        { value: getRandomHandicap(), odd: getRandomOdd(1.75, 2.10) }
      ]),
      // Goals Over/Under
      createBet('goals_over_under', [
        { value: getRandomGoalLine(), odd: getRandomOdd(1.80, 2.05) },
        { value: getRandomGoalLine(), odd: getRandomOdd(1.80, 2.05) }
      ]),
      // Match Winner (1X2)
      createBet('match_winner', [
        { value: 'Home', odd: getRandomOdd(1.80, 3.50) },
        { value: 'Draw', odd: getRandomOdd(3.00, 3.80) },
        { value: 'Away', odd: getRandomOdd(1.80, 4.50) }
      ]),
      // First Half Winner
      createBet('first_half_winner', [
        { value: 'Home', odd: getRandomOdd(2.20, 3.80) },
        { value: 'Draw', odd: getRandomOdd(1.90, 2.30) },
        { value: 'Away', odd: getRandomOdd(2.50, 5.00) }
      ]),
      // Both Teams Score
      createBet('both_teams_score', [
        { value: 'Yes', odd: getRandomOdd(1.65, 2.10) },
        { value: 'No', odd: getRandomOdd(1.65, 2.10) }
      ]),
      // Odd/Even
      createBet('odd_even', [
        { value: 'Odd', odd: getRandomOdd(1.85, 2.05) },
        { value: 'Even', odd: getRandomOdd(1.85, 2.05) }
      ]),
      // Exact Score (simplified - just a few popular scores)
      createBet('exact_score', [
        { value: '1-0', odd: getRandomOdd(6.50, 8.50) },
        { value: '2-0', odd: getRandomOdd(7.00, 9.50) },
        { value: '2-1', odd: getRandomOdd(7.50, 10.00) },
        { value: '1-1', odd: getRandomOdd(5.50, 7.50) },
        { value: '0-0', odd: getRandomOdd(8.00, 11.00) },
        { value: '0-1', odd: getRandomOdd(8.00, 12.00) },
        { value: '0-2', odd: getRandomOdd(10.00, 15.00) },
        { value: '1-2', odd: getRandomOdd(9.00, 13.00) },
        { value: '3-0', odd: getRandomOdd(10.00, 14.00) },
        { value: '3-1', odd: getRandomOdd(11.00, 15.00) },
        { value: '0-3', odd: getRandomOdd(15.00, 20.00) },
        { value: '1-3', odd: getRandomOdd(14.00, 18.00) },
        { value: '2-2', odd: getRandomOdd(9.00, 12.00) },
        { value: '3-2', odd: getRandomOdd(13.00, 17.00) },
        { value: '2-3', odd: getRandomOdd(14.00, 19.00) },
        { value: '3-3', odd: getRandomOdd(18.00, 25.00) },
        { value: '4-0', odd: getRandomOdd(15.00, 22.00) },
        { value: '0-4', odd: getRandomOdd(20.00, 30.00) },
        { value: '4-1', odd: getRandomOdd(17.00, 24.00) },
        { value: '1-4', odd: getRandomOdd(22.00, 32.00) },
        { value: '4-2', odd: getRandomOdd(20.00, 28.00) },
        { value: '2-4', odd: getRandomOdd(24.00, 35.00) },
        { value: '3-4', odd: getRandomOdd(28.00, 40.00) },
        { value: '4-3', odd: getRandomOdd(26.00, 38.00) },
        { value: '4-4', odd: getRandomOdd(35.00, 50.00) }
      ]),
      // Exact Score First Half
      createBet('exact_score_first_half', [
        { value: '1-0', odd: getRandomOdd(5.00, 7.00) },
        { value: '2-0', odd: getRandomOdd(8.00, 12.00) },
        { value: '2-1', odd: getRandomOdd(12.00, 18.00) },
        { value: '1-1', odd: getRandomOdd(6.00, 9.00) },
        { value: '0-0', odd: getRandomOdd(3.50, 5.50) },
        { value: '0-1', odd: getRandomOdd(6.00, 9.00) },
        { value: '0-2', odd: getRandomOdd(10.00, 16.00) },
        { value: '1-2', odd: getRandomOdd(14.00, 22.00) },
        { value: '3-0', odd: getRandomOdd(15.00, 25.00) },
        { value: '0-3', odd: getRandomOdd(20.00, 35.00) },
        { value: '2-2', odd: getRandomOdd(18.00, 28.00) }
      ]),
      // Corners Over/Under
      createBet('corners_over_under', [
        { value: 'Over 9.5', odd: getRandomOdd(1.80, 2.10) },
        { value: 'Under 9.5', odd: getRandomOdd(1.80, 2.10) }
      ]),
      // Corners Over/Under First Half
      createBet('corners_over_under_first_half', [
        { value: 'Over 4.5', odd: getRandomOdd(1.85, 2.15) },
        { value: 'Under 4.5', odd: getRandomOdd(1.85, 2.15) }
      ]),
      // Asian Handicap First Half
      createBet('asian_handicap_first_half', [
        { value: getRandomHandicap(), odd: getRandomOdd(1.80, 2.15) },
        { value: getRandomHandicap(), odd: getRandomOdd(1.80, 2.15) }
      ]),
      // Goals Over/Under First Half
      createBet('goals_over_under_first_half', [
        { value: 'Over ' + getRandomGoalLine(), odd: getRandomOdd(1.85, 2.10) },
        { value: 'Under ' + getRandomGoalLine(), odd: getRandomOdd(1.85, 2.10) }
      ])
    ]
  };
}

/**
 * Get mock odds for all major bookmakers
 */
function getMockBookmakers() {
  const bookmakers = [
    'Bet365',
    '1xBet',
    '188Bet',
    'Pinnacle',
    'SBO',
    'Betway'
  ];

  return bookmakers.map(name => generateMockOdds(name));
}

/**
 * Add mock odds to a match object
 */
function addMockOddsToMatch(match) {
  if (!match) return match;

  // Add mock bookmakers data
  match.bookmakers = getMockBookmakers();

  return match;
}

/**
 * Add mock odds to multiple matches
 */
function addMockOddsToMatches(matches) {
  if (!Array.isArray(matches)) return matches;

  return matches.map(match => addMockOddsToMatch(match));
}

module.exports = {
  generateMockOdds,
  getMockBookmakers,
  addMockOddsToMatch,
  addMockOddsToMatches
};
