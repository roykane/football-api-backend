const axios = require('axios');
const apiKey = process.env.APISPORTS_KEY || '97fe07c23b0ae2aba6ab3a3da88cb2ef';

console.log('Testing API-Sports /fixtures endpoint for events...\n');

axios.get('https://v3.football.api-sports.io/fixtures', {
  params: { id: 1451074 },
  headers: { 'x-apisports-key': apiKey }
}).then(res => {
  console.log('Response status:', res.status);
  console.log('Response count:', res.data.response?.length);

  if (!res.data.response || res.data.response.length === 0) {
    console.log('No fixtures in response');
    console.log('Full response:', JSON.stringify(res.data, null, 2));
    return;
  }

  const fixture = res.data.response[0];
  console.log('Has events:', !!fixture.events);
  console.log('Events count:', fixture.events ? fixture.events.length : 0);
  if (fixture.events && fixture.events.length > 0) {
    console.log('First event:', JSON.stringify(fixture.events[0], null, 2));
  } else {
    console.log('No events in /fixtures response');
  }
}).catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Status:', err.response.status);
    console.error('Data:', JSON.stringify(err.response.data, null, 2));
  }
});
