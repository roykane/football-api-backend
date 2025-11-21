const axios = require('axios');
require('dotenv').config({ path: '/Users/zoro/Desktop/Football API/sourcebackendapifootball/.env' });

const API_KEY = process.env.API_FOOTBALL_KEY;

async function testAPIFootball() {
  const api = axios.create({
    baseURL: 'https://v3.football.api-sports.io',
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  });

  console.log('\n========================================');
  console.log('TESTING API-FOOTBALL ENDPOINTS');
  console.log('========================================\n');

  // Test 1: Predictions endpoint (có attacking/defensive potential, poisson)
  try {
    console.log('1. PREDICTIONS ENDPOINT (Liverpool vs Man United)');
    console.log('   URL: /predictions?fixture=215662');
    const predictions = await api.get('/predictions', {
      params: { fixture: 215662 } // Example fixture
    });
    console.log('   ✅ SUCCESS');
    console.log('   Response structure:');
    console.log(JSON.stringify(predictions.data.response[0], null, 2).substring(0, 2000));
    console.log('\n');
  } catch (error) {
    console.log('   ❌ ERROR:', error.response?.data?.message || error.message);
  }

  // Test 2: Team Statistics
  try {
    console.log('2. TEAM STATISTICS ENDPOINT (Liverpool in Premier League)');
    console.log('   URL: /teams/statistics?team=40&season=2024&league=39');
    const teamStats = await api.get('/teams/statistics', {
      params: {
        team: 40,    // Liverpool
        season: 2025,
        league: 39   // Premier League
      }
    });
    console.log('   ✅ SUCCESS');
    console.log('   Response structure:');
    console.log(JSON.stringify(teamStats.data.response, null, 2).substring(0, 2000));
    console.log('\n');
  } catch (error) {
    console.log('   ❌ ERROR:', error.response?.data?.message || error.message);
  }

  // Test 3: Fixture Statistics (match-specific)
  try {
    console.log('3. FIXTURE STATISTICS ENDPOINT');
    console.log('   URL: /fixtures/statistics?fixture=215662');
    const fixtureStats = await api.get('/fixtures/statistics', {
      params: { fixture: 215662 }
    });
    console.log('   ✅ SUCCESS');
    console.log('   Response structure:');
    console.log(JSON.stringify(fixtureStats.data.response, null, 2));
    console.log('\n');
  } catch (error) {
    console.log('   ❌ ERROR:', error.response?.data?.message || error.message);
  }

  // Test 4: H2H (Head to Head)
  try {
    console.log('4. HEAD TO HEAD ENDPOINT (Liverpool vs Man United)');
    console.log('   URL: /fixtures/headtohead?h2h=40-33');
    const h2h = await api.get('/fixtures/headtohead', {
      params: { 'h2h': '40-33' } // Liverpool vs Man United
    });
    console.log('   ✅ SUCCESS');
    console.log('   Found', h2h.data.response.length, 'matches');
    console.log('\n');
  } catch (error) {
    console.log('   ❌ ERROR:', error.response?.data?.message || error.message);
  }

  console.log('========================================');
  console.log('TEST COMPLETE');
  console.log('========================================\n');
}

testAPIFootball().catch(console.error);
