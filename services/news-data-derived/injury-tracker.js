/**
 * Injury Tracker
 *
 * Polls /injuries for target leagues every few hours, generates a brief
 * for each NEW injury detected (since last poll). Dedup key includes the
 * fixture-affected date so a single chronic injury doesn't spam articles.
 *
 *   dedupKey = `injury-{playerId}-{fixtureId|date}-{reason}`
 *
 * Source: API-Sports /injuries returns per-fixture injury rows. We scope
 * to upcoming fixtures (next 14 days) per league so we surface what
 * matters: who will be missing for the next match.
 */

const Article = require('../../models/Article');
const { writeArticle } = require('./llm-writer');
const { TARGET_LEAGUES, pickFallbackImage, currentSeason } = require('./constants');

async function getInjuriesForLeague(footballApi, leagueId, season) {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    dates.push(d.toISOString().split('T')[0]);
  }

  const all = [];
  for (const date of dates) {
    try {
      const res = await footballApi.get('/injuries', {
        params: { league: leagueId, season, date },
      });
      const rows = res.data?.response || [];
      for (const r of rows) all.push({ ...r, _date: date });
    } catch (err) {
      console.warn(`[injury] ${leagueId}/${date} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return all;
}

function buildFacts(row) {
  const player = row.player || {};
  const team = row.team || {};
  const fixture = row.fixture || {};
  const league = row.league || {};
  const matchDate = fixture.date
    ? new Date(fixture.date).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : 'chưa xác định';
  return [
    `Cầu thủ: ${player.name || 'không rõ'}`,
    `CLB: ${team.name || 'không rõ'}`,
    `Giải đấu: ${league.name || 'không rõ'}`,
    `Lý do vắng mặt: ${player.reason || player.type || 'chấn thương'}`,
    `Loại: ${player.type || 'không rõ'}`,
    `Trận sắp tới: ${matchDate}`,
  ].join('\n');
}

async function generateForRow(row) {
  const player = row.player || {};
  const team = row.team || {};
  const ai = await writeArticle({
    systemContext: 'Bạn là phóng viên thể thao chuyên nghiệp viết tin chấn thương ngắn bằng tiếng Việt.',
    factsBlock: buildFacts(row),
    titleHint: { subject: player.name },
    minWords: 250,
    structureBlock: [
      '   ## Tình trạng',
      `   (80-120 từ) ${player.name || 'Cầu thủ'} của ${team.name || 'CLB'} sẽ vắng mặt vì lý do gì, dựa nguyên văn data.`,
      '',
      '   ## Ảnh hưởng',
      `   (100-150 từ) Việc vắng mặt ảnh hưởng thế nào tới đội hình ${team.name || 'đội bóng'} ở trận sắp tới — chỉ nêu sự kiện khách quan.`,
      '',
      '   ## Kết luận',
      '   (60-100 từ) Tóm tắt và lưu ý cập nhật mới nhất.',
    ].join('\n'),
  });
  return ai;
}

async function run(footballApi, slotsAvailable = 3) {
  if (slotsAvailable <= 0) return 0;
  const season = currentSeason();
  const hour = new Date().getHours();
  const leagueIdx = Math.floor(hour / 6) % TARGET_LEAGUES.length;
  const leagueId = TARGET_LEAGUES[leagueIdx];

  console.log(`📰 [injury] league=${leagueId} season=${season} slots=${slotsAvailable}`);

  let rows;
  try {
    rows = await getInjuriesForLeague(footballApi, leagueId, season);
  } catch (err) {
    console.error('[injury] fetch failed:', err.message);
    return 0;
  }
  if (!rows.length) {
    console.log('[injury] no injuries returned');
    return 0;
  }

  let created = 0;
  for (const row of rows) {
    if (created >= slotsAvailable) break;
    const playerId = row.player?.id;
    const fixtureId = row.fixture?.id;
    const reason = (row.player?.reason || row.player?.type || 'na').replace(/\s+/g, '-').toLowerCase();
    if (!playerId) continue;
    const dedupKey = `injury-${playerId}-${fixtureId || row._date}-${reason}`.slice(0, 200);
    if (await Article.existsByDedupKey(dedupKey)) continue;

    let ai;
    try {
      ai = await generateForRow(row);
    } catch (err) {
      console.warn(`[injury] LLM fail ${row.player?.name}:`, err.message);
      continue;
    }

    const image = row.player?.photo || row.team?.logo || pickFallbackImage();
    const article = new Article({
      originalTitle: ai.title,
      source: 'data-derived/injury',
      title: ai.title,
      description: ai.description,
      content: ai.content,
      tags: ai.tags.length ? ai.tags : [row.player?.name, row.team?.name, row.league?.name].filter(Boolean),
      image,
      category: 'general',
      status: 'draft',
      pubDate: new Date(),
      aiModel: 'claude-haiku-4-5-20251001',
      metadata: { dedupKey, type: 'injury' },
    });

    try {
      await article.save();
      console.log(`   ✅ [injury] ${row.player?.name} — ${article.title}`);
      created++;
    } catch (err) {
      console.warn(`   ❌ save failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  return created;
}

module.exports = { run };
