// find-fixtures-with-odds.js
// Tìm fixtures có odds data để test
const axios = require('axios');

const API_KEY = process.env.FOOTBALL_API_KEY;

const footballApi = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-apisports-key': API_KEY
  },
  timeout: 15000
});

async function findFixturesWithOdds() {
  console.log('🔍 Finding fixtures with odds data...\n');

  try {
    // Test với top leagues (có odds nhiều hơn)
    const topLeagues = [
      { id: 39, name: 'Premier League' },
      { id: 140, name: 'La Liga' },
      { id: 135, name: 'Serie A' },
      { id: 78, name: 'Bundesliga' },
      { id: 61, name: 'Ligue 1' }
    ];

    for (const league of topLeagues) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Checking ${league.name}...`);
      console.log('='.repeat(60));

      // Get next 5 fixtures
      const fixturesRes = await footballApi.get('/fixtures', {
        params: {
          league: league.id,
          season: 2024,
          next: 5
        }
      });

      const fixtures = fixturesRes.data?.response || [];
      console.log(`Found ${fixtures.length} upcoming fixtures\n`);

      if (fixtures.length === 0) continue;

      // Test odds for first 3 fixtures
      for (let i = 0; i < Math.min(3, fixtures.length); i++) {
        const fixture = fixtures[i];
        console.log(`${i + 1}. ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
        console.log(`   ID: ${fixture.fixture.id}`);
        console.log(`   Date: ${new Date(fixture.fixture.date).toLocaleString()}`);
        console.log(`   Status: ${fixture.fixture.status.short}`);

        try {
          const oddsRes = await footballApi.get('/odds', {
            params: { fixture: fixture.fixture.id }
          });

          const oddsData = oddsRes.data?.response || [];
          const bookmakers = oddsData[0]?.bookmakers || [];

          if (bookmakers.length > 0) {
            console.log(`   ✅✅✅ HAS ODDS! ${bookmakers.length} bookmakers`);
            console.log(`   Bookmakers: ${bookmakers.map(b => b.name).slice(0, 5).join(', ')}`);
            
            // Check for Bet365
            const bet365 = bookmakers.find(b => b.id === 8);
            if (bet365) {
              console.log(`   🎯 Bet365 available with ${bet365.bets?.length || 0} bet types`);
              
              // Show sample odds
              const matchWinner = bet365.bets?.find(b => b.name === 'Match Winner');
              if (matchWinner) {
                console.log(`   Sample odds (Match Winner):`);
                matchWinner.values?.forEach(v => {
                  console.log(`      ${v.value}: ${v.odd}`);
                });
              }
            }

            console.log(`\n   🎉 USE THIS FIXTURE FOR TESTING!`);
            console.log(`   Test command: curl "http://localhost:3000/api/matches/${fixture.fixture.id}?includeOdds=true"\n`);
            
            return fixture; // Found one!
          } else {
            console.log(`   ⚠️  No odds yet`);
          }

        } catch (oddsErr) {
          console.log(`   ❌ Odds error: ${oddsErr.response?.status} - ${oddsErr.message}`);
        }
      }

      // Small delay between leagues
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('Check live matches for odds...');
    console.log('='.repeat(60));

    // Try live matches
    const liveRes = await footballApi.get('/fixtures', {
      params: { live: 'all' }
    });

    const liveFixtures = liveRes.data?.response || [];
    console.log(`\nFound ${liveFixtures.length} live matches\n`);

    for (let i = 0; i < Math.min(5, liveFixtures.length); i++) {
      const fixture = liveFixtures[i];
      console.log(`${i + 1}. ${fixture.teams.home.name} vs ${fixture.teams.away.name} (LIVE)`);
      console.log(`   ID: ${fixture.fixture.id}`);
      console.log(`   League: ${fixture.league.name}`);

      try {
        const oddsRes = await footballApi.get('/odds', {
          params: { fixture: fixture.fixture.id }
        });

        const oddsData = oddsRes.data?.response || [];
        const bookmakers = oddsData[0]?.bookmakers || [];

        if (bookmakers.length > 0) {
          console.log(`   ✅ HAS ODDS! ${bookmakers.length} bookmakers`);
          console.log(`   Test: curl "http://localhost:3000/api/matches/${fixture.fixture.id}?includeOdds=true"\n`);
          return fixture;
        } else {
          console.log(`   ⚠️  No odds\n`);
        }

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}\n`);
      }
    }

    console.log('\n❌ No fixtures with odds found in this check.');
    console.log('Possible reasons:');
    console.log('1. Odds are only available closer to match time (24-48 hours before)');
    console.log('2. Try again during popular match times (weekends)');
    console.log('3. Some leagues may not have odds data');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

findFixturesWithOdds();