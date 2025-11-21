const axios = require('axios');
require('dotenv').config({ path: '/Users/zoro/Desktop/Football API/sourcebackendapifootball/.env' });

const API_KEY = process.env.API_FOOTBALL_KEY;

async function testVenueRefereeData() {
  const api = axios.create({
    baseURL: 'https://v3.football.api-sports.io',
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  });

  console.log('\n========================================');
  console.log('TESTING VENUE, REFEREE, WEATHER DATA');
  console.log('========================================\n');

  // Test: Get a recent finished match from Premier League
  try {
    console.log('Fetching recent Premier League matches...\n');
    const fixtures = await api.get('/fixtures', {
      params: {
        league: 39,      // Premier League
        season: 2025,
        last: 5          // Get last 5 matches
      }
    });

    if (fixtures.data.response && fixtures.data.response.length > 0) {
      const fixture = fixtures.data.response[0];

      console.log('Match:', fixture.teams.home.name, 'vs', fixture.teams.away.name);
      console.log('Date:', fixture.fixture.date);
      console.log('Status:', fixture.fixture.status.short);
      console.log('\n--- VENUE DATA ---');
      console.log(JSON.stringify(fixture.fixture.venue, null, 2));

      console.log('\n--- REFEREE DATA (fixture.fixture.referee) ---');
      console.log('Referee:', fixture.fixture.referee);

      console.log('\n--- FULL FIXTURE OBJECT (checking for weather/injuries) ---');
      // Check if weather field exists
      if (fixture.weather) {
        console.log('Weather data found:', JSON.stringify(fixture.weather, null, 2));
      } else {
        console.log('❌ No weather field in fixture object');
      }

      // Check if injuries field exists
      if (fixture.injuries) {
        console.log('Injuries data found:', JSON.stringify(fixture.injuries, null, 2));
      } else {
        console.log('❌ No injuries field in fixture object');
      }

      console.log('\n--- ALL TOP-LEVEL FIXTURE KEYS ---');
      console.log('Available keys:', Object.keys(fixture).join(', '));

      console.log('\n--- FIXTURE.FIXTURE KEYS ---');
      console.log('Available keys:', Object.keys(fixture.fixture).join(', '));

    } else {
      console.log('❌ No fixtures found');
    }

    // Test injuries endpoint separately
    console.log('\n\n========================================');
    console.log('TESTING INJURIES ENDPOINT');
    console.log('========================================\n');

    try {
      const injuries = await api.get('/injuries', {
        params: {
          league: 39,    // Premier League
          season: 2025
        }
      });

      if (injuries.data.response && injuries.data.response.length > 0) {
        console.log('✅ Injuries endpoint works!');
        console.log('Sample injury data:');
        console.log(JSON.stringify(injuries.data.response[0], null, 2));
      } else {
        console.log('⚠️  No injuries data available');
      }
    } catch (error) {
      console.log('❌ Injuries endpoint error:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.log('❌ ERROR:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('Response data:', error.response.data);
    }
  }

  console.log('\n========================================\n');
}

testVenueRefereeData().catch(console.error);
