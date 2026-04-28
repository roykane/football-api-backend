/**
 * Lineup Leak News
 *
 * Runs every ~30 min. Looks for upcoming top-league fixtures kicking off in
 * the next 0-90 minutes. If /fixtures/lineups already returns data (lineup
 * announced), generate a short news brief naming the starting XI / formation
 * for each team.
 *
 *   dedupKey = `lineup-{fixtureId}`
 */

const Article = require('../../models/Article');
const { writeArticle } = require('./llm-writer');
const { TARGET_LEAGUES, pickFallbackImage } = require('./constants');

async function getUpcomingTargetFixtures(footballApi) {
  const today = new Date().toISOString().split('T')[0];
  const res = await footballApi.get('/fixtures', {
    params: { date: today },
  });
  const fixtures = res.data?.response || [];
  const now = Date.now();
  const out = [];
  for (const f of fixtures) {
    if (!TARGET_LEAGUES.includes(f.league?.id)) continue;
    const ko = new Date(f.fixture?.date || 0).getTime();
    const minsToKO = (ko - now) / 60000;
    if (minsToKO < -10 || minsToKO > 90) continue;
    if (f.fixture?.status?.short !== 'NS' && f.fixture?.status?.short !== 'TBD') continue;
    out.push(f);
  }
  return out;
}

function formatLineup(lineup) {
  const formation = lineup.formation || '?';
  const coach = lineup.coach?.name || 'không rõ';
  const starters = (lineup.startXI || [])
    .map(p => p.player?.name)
    .filter(Boolean)
    .join(', ');
  return { formation, coach, starters };
}

function buildFacts(fixture, homeLU, awayLU) {
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  const matchDate = new Date(fixture.fixture.date).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return [
    `Trận đấu: ${home?.name} vs ${away?.name}`,
    `Giải đấu: ${fixture.league?.name}`,
    `Thời gian: ${matchDate}`,
    `Sân: ${fixture.fixture?.venue?.name || 'không rõ'}`,
    '',
    `**${home?.name}** — sơ đồ ${homeLU.formation}, HLV ${homeLU.coach}`,
    `Đội hình xuất phát: ${homeLU.starters}`,
    '',
    `**${away?.name}** — sơ đồ ${awayLU.formation}, HLV ${awayLU.coach}`,
    `Đội hình xuất phát: ${awayLU.starters}`,
  ].join('\n');
}

async function generateForFixture(fixture, homeLU, awayLU) {
  const home = fixture.teams?.home?.name || '';
  const away = fixture.teams?.away?.name || '';
  const ai = await writeArticle({
    systemContext: 'Bạn là phóng viên thể thao chuyên nghiệp viết tin đội hình ra sân bằng tiếng Việt.',
    factsBlock: buildFacts(fixture, homeLU, awayLU),
    titleHint: { subject: `${home} vs ${away}` },
    minWords: 280,
    structureBlock: [
      '   ## Đội hình ra sân',
      `   (100-140 từ) Tổng quan sơ đồ ${homeLU.formation} của ${home} và ${awayLU.formation} của ${away}, ai là HLV.`,
      '',
      '   ## Điểm nhấn',
      '   (120-180 từ) Nêu 2-3 cầu thủ đáng chú ý trong startXI của mỗi đội (chỉ dùng tên có trong data). KHÔNG bịa thêm cầu thủ.',
      '',
      '   ## Bối cảnh',
      `   (80-120 từ) Trận diễn ra ở giải nào, tại sân nào, vai trò của trận trong vòng đấu — chỉ dùng data.`,
    ].join('\n'),
  });
  return ai;
}

async function run(footballApi, slotsAvailable = 3) {
  if (slotsAvailable <= 0) return 0;
  console.log(`📰 [lineup] slots=${slotsAvailable}`);

  let fixtures;
  try {
    fixtures = await getUpcomingTargetFixtures(footballApi);
  } catch (err) {
    console.error('[lineup] fetch fixtures failed:', err.message);
    return 0;
  }
  if (!fixtures.length) {
    console.log('[lineup] no upcoming target fixtures');
    return 0;
  }

  let created = 0;
  for (const f of fixtures) {
    if (created >= slotsAvailable) break;
    const fid = f.fixture?.id;
    const dedupKey = `lineup-${fid}`;
    if (await Article.existsByDedupKey(dedupKey)) continue;

    let lineupResp;
    try {
      const r = await footballApi.get('/fixtures/lineups', { params: { fixture: fid } });
      lineupResp = r.data?.response || [];
    } catch (err) {
      console.warn(`[lineup] fetch ${fid} failed:`, err.message);
      continue;
    }
    if (lineupResp.length < 2) continue;

    const homeLU = formatLineup(lineupResp[0]);
    const awayLU = formatLineup(lineupResp[1]);
    if (!homeLU.starters || !awayLU.starters) continue;

    let ai;
    try {
      ai = await generateForFixture(f, homeLU, awayLU);
    } catch (err) {
      console.warn(`[lineup] LLM fail ${fid}:`, err.message);
      continue;
    }

    const image = f.teams?.home?.logo || pickFallbackImage();
    const article = new Article({
      originalTitle: ai.title,
      source: 'data-derived/lineup',
      title: ai.title,
      description: ai.description,
      content: ai.content,
      tags: ai.tags.length ? ai.tags : [f.teams?.home?.name, f.teams?.away?.name, f.league?.name].filter(Boolean),
      image,
      category: 'general',
      status: 'draft',
      pubDate: new Date(),
      aiModel: 'claude-haiku-4-5-20251001',
      metadata: { dedupKey, type: 'lineup' },
      matchInfo: {
        homeTeam: { id: f.teams?.home?.id, name: f.teams?.home?.name, logo: f.teams?.home?.logo },
        awayTeam: { id: f.teams?.away?.id, name: f.teams?.away?.name, logo: f.teams?.away?.logo },
        league: { id: f.league?.id, name: f.league?.name, logo: f.league?.logo, country: f.league?.country },
        matchDate: new Date(f.fixture?.date),
        venue: f.fixture?.venue?.name || null,
        status: 'NS',
      },
    });

    try {
      await article.save();
      console.log(`   ✅ [lineup] ${article.title}`);
      created++;
    } catch (err) {
      console.warn(`   ❌ save failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  return created;
}

module.exports = { run };
