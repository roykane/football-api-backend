const cron = require('node-cron');
const axios = require('axios');
const Team = require('../models/Team');

const API_KEY = process.env.API_FOOTBALL_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Top leagues to sync
const TARGET_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England', slug: 'premier-league' },
  { id: 140, name: 'La Liga', country: 'Spain', slug: 'la-liga' },
  { id: 135, name: 'Serie A', country: 'Italy', slug: 'serie-a' },
  { id: 78, name: 'Bundesliga', country: 'Germany', slug: 'bundesliga' },
  { id: 61, name: 'Ligue 1', country: 'France', slug: 'ligue-1' },
];

const footballApi = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: { 'x-apisports-key': API_KEY },
  timeout: 15000,
});

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getCurrentSeason() {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

let isRunning = false;
let lastSyncTime = null;
let lastSyncResult = null;

/**
 * Sync all teams for target leagues
 */
async function syncTeams() {
  if (isRunning) {
    console.log('⚠️  Team sync already running');
    return;
  }

  isRunning = true;
  const season = getCurrentSeason();
  let totalSynced = 0;
  let totalErrors = 0;

  console.log(`\n🔄 Starting team sync for season ${season}...`);

  try {
    for (const league of TARGET_LEAGUES) {
      console.log(`\n📋 Syncing ${league.name}...`);

      try {
        // 1. Fetch teams for this league (1 API call)
        const teamsRes = await footballApi.get('/teams', {
          params: { league: league.id, season },
        });
        const teamsData = teamsRes.data?.response || [];

        // 2. Fetch standings (1 API call)
        const standingsRes = await footballApi.get('/standings', {
          params: { league: league.id, season },
        });
        const standingsData = standingsRes.data?.response?.[0]?.league?.standings?.[0] || [];

        // Build standings map by team ID
        const standingsMap = {};
        standingsData.forEach(s => {
          standingsMap[s.team.id] = {
            rank: s.rank,
            points: s.points,
            played: s.all.played,
            win: s.all.win,
            draw: s.all.draw,
            lose: s.all.lose,
            goalsFor: s.all.goals.for,
            goalsAgainst: s.all.goals.against,
            goalsDiff: s.goalsDiff,
            form: s.form,
          };
        });

        // 3. Fetch recent finished matches for this league (1 API call)
        const recentRes = await footballApi.get('/fixtures', {
          params: { league: league.id, season, last: 50, status: 'FT' },
        });
        const recentMatches = recentRes.data?.response || [];

        // 4. Fetch upcoming matches (1 API call)
        const upcomingRes = await footballApi.get('/fixtures', {
          params: { league: league.id, season, next: 30 },
        });
        const upcomingMatches = upcomingRes.data?.response || [];

        // Build per-team match arrays
        const teamRecentMap = {};
        const teamUpcomingMap = {};

        recentMatches.forEach(m => {
          const match = {
            fixtureId: m.fixture.id,
            date: m.fixture.date,
            home: { name: m.teams.home.name, logo: m.teams.home.logo, goals: m.goals.home },
            away: { name: m.teams.away.name, logo: m.teams.away.logo, goals: m.goals.away },
            league: league.name,
            status: 'FT',
          };
          [m.teams.home.id, m.teams.away.id].forEach(tid => {
            if (!teamRecentMap[tid]) teamRecentMap[tid] = [];
            teamRecentMap[tid].push(match);
          });
        });

        upcomingMatches.forEach(m => {
          const match = {
            fixtureId: m.fixture.id,
            date: m.fixture.date,
            home: { name: m.teams.home.name, logo: m.teams.home.logo },
            away: { name: m.teams.away.name, logo: m.teams.away.logo },
            league: league.name,
          };
          [m.teams.home.id, m.teams.away.id].forEach(tid => {
            if (!teamUpcomingMap[tid]) teamUpcomingMap[tid] = [];
            teamUpcomingMap[tid].push(match);
          });
        });

        // 5. Upsert each team
        for (const teamData of teamsData) {
          const { team, venue } = teamData;
          const slug = slugify(team.name);
          const standings = standingsMap[team.id] || {};
          const recent = (teamRecentMap[team.id] || []).slice(0, 10);
          const upcoming = (teamUpcomingMap[team.id] || []).slice(0, 5);

          await Team.findOneAndUpdate(
            { teamId: team.id },
            {
              teamId: team.id,
              slug,
              name: team.name,
              logo: team.logo,
              country: team.country || league.country,
              founded: team.founded,
              national: team.national,
              venue: venue ? {
                name: venue.name,
                city: venue.city,
                capacity: venue.capacity,
                image: venue.image,
              } : undefined,
              league: {
                id: league.id,
                name: league.name,
                slug: league.slug,
                country: league.country,
                logo: standingsRes.data?.response?.[0]?.league?.logo || '',
              },
              seasonYear: season,
              standings,
              recentMatches: recent,
              upcomingMatches: upcoming,
              lastSyncedAt: new Date(),
            },
            { upsert: true, new: true }
          );

          totalSynced++;
        }

        console.log(`  ✅ ${teamsData.length} teams synced for ${league.name}`);

        // Delay between leagues to be nice to API
        await new Promise(r => setTimeout(r, 1000));

      } catch (err) {
        console.error(`  ❌ Error syncing ${league.name}:`, err.message);
        totalErrors++;
      }
    }

    // Generate AI content for teams that don't have it
    await generateMissingContent();

    lastSyncTime = new Date();
    lastSyncResult = { success: true, totalSynced, totalErrors };
    console.log(`\n✅ Team sync completed: ${totalSynced} teams, ${totalErrors} errors`);

  } catch (error) {
    console.error('❌ Team sync failed:', error.message);
    lastSyncResult = { success: false, error: error.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Generate AI content for teams missing aiContent
 */
async function generateMissingContent() {
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️  ANTHROPIC_API_KEY not set, skipping AI content generation');
    return;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const teamsNeedContent = await Team.find({
    $or: [
      { aiContent: { $exists: false } },
      { aiContent: null },
      { aiContent: '' },
      { aiContentGeneratedAt: { $lt: sevenDaysAgo } },
    ],
  }).sort({ 'standings.rank': 1 }).limit(10).lean();

  if (teamsNeedContent.length === 0) {
    console.log('  ℹ️  All teams have fresh AI content');
    return;
  }

  console.log(`\n🤖 Generating AI content for ${teamsNeedContent.length} teams...`);

  const styles = [
    'Viết như phóng viên thể thao — kể chuyện, đan xen giai thoại, bối cảnh lịch sử.',
    'Viết như nhà phân tích — tập trung số liệu, xu hướng, so sánh định lượng.',
    'Viết như HLV đang đánh giá đối thủ — chiến thuật, sơ đồ, điểm mạnh yếu.',
    'Viết như BLV trước trận — sôi nổi, hào hứng, highlight những điểm đáng chú ý.',
    'Viết dạng "5 điều cần biết" — ngắn gọn, chia thành bullet points rõ ràng.',
    'Viết dạng profile magazine — giới thiệu toàn diện, từ lịch sử đến hiện tại.',
  ];

  for (const team of teamsNeedContent) {
    try {
      const style = styles[Math.floor(Math.random() * styles.length)];
      const formText = team.standings?.form || 'N/A';
      const recentText = (team.recentMatches || []).slice(0, 5).map(m =>
        `${m.home.name} ${m.home.goals}-${m.away.goals} ${m.away.name}`
      ).join(', ') || 'N/A';

      const prompt = `Viết bài phân tích đội bóng ${team.name} bằng tiếng Việt CÓ DẤU, 400-600 từ.

**PHONG CÁCH:** ${style}

**THÔNG TIN:**
- Đội: ${team.name} (${team.country})
- Giải: ${team.league?.name || 'N/A'}
- Sân: ${team.venue?.name || 'N/A'} (${team.venue?.capacity || 'N/A'} chỗ)
- Thành lập: ${team.founded || 'N/A'}
- Vị trí BXH: ${team.standings?.rank || 'N/A'} (${team.standings?.points || 0} điểm)
- Thành tích: ${team.standings?.win || 0}W ${team.standings?.draw || 0}D ${team.standings?.lose || 0}L
- Bàn thắng/thua: ${team.standings?.goalsFor || 0}/${team.standings?.goalsAgainst || 0}
- Phong độ: ${formText}
- 5 trận gần nhất: ${recentText}

**YÊU CẦU:**
- KHÔNG viết theo template — mỗi bài phải unique
- Bao gồm: lịch sử CLB ngắn, phong độ hiện tại, điểm mạnh/yếu, triển vọng mùa giải
- Dùng markdown: ## heading, **bold**, bullet points
- KHÔNG bịa thông tin cầu thủ chấn thương

Trả về JSON:
{
  "content": "[400-600 từ markdown]"
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data?.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\n/g, '\\n'));
        if (parsed.content) {
          const cleanedContent = parsed.content.replace(/\\n/g, '\n');
          // Same runtime gate as the article generators — banned phrases +
          // minimum word count. Team copy targets 400-600 từ; reject if
          // Haiku under-delivers below 250 to keep the index thin-content-free.
          const { validate } = require('./contentValidator');
          const issues = validate({
            title: team.name,
            content: cleanedContent,
          }, { minTotalWords: 250 });
          if (issues.length) {
            console.warn(`  ⚠️  AI rejected for ${team.name}: ${issues.join('; ')}`);
          } else {
            await Team.updateOne(
              { teamId: team.teamId },
              { aiContent: cleanedContent, aiContentGeneratedAt: new Date() }
            );
            console.log(`  ✅ AI content generated for ${team.name}`);
          }
        }
      }

      // Delay between AI calls
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.error(`  ❌ AI content error for ${team.name}:`, err.message);
    }
  }
}

// Scheduler
let cronJob = null;

function start() {
  // Sync at 4:00 AM daily
  cronJob = cron.schedule('0 4 * * *', () => {
    console.log('\n⏰ Scheduled team sync triggered');
    syncTeams();
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  console.log('✅ Team sync scheduler started (daily at 4:00 AM)');

  // Run initial sync after 10 seconds
  setTimeout(() => syncTeams(), 10000);
}

function stop() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 Team sync scheduler stopped');
  }
}

function status() {
  return {
    isRunning,
    lastSyncTime,
    lastSyncResult,
    nextRun: '04:00 AM daily',
  };
}

module.exports = { start, stop, status, syncTeams };
