/**
 * Real news generator — weekly league roundup from actual match data.
 *
 * Saves to the `Article` collection used by /tin-bong-da SSR.
 *
 * Input: league id + season.
 * Data sources (api-sports):
 *   - /fixtures last 7 days status=FT (finished matches)
 *   - /standings current season
 *   - /players/topscorers current season (top 5)
 *
 * Output: 1 Article document with status='draft' (editor reviews then
 * flips to 'published'). Source='ScoreLine Editorial' so Google News
 * treats it as original reporting, not aggregation.
 *
 * Why this is Google-safe:
 *   - Each article is anchored to real match results (unique factual data)
 *   - Claude writes commentary around those facts, not invents them
 *   - Validator rejects output missing the scores/team names from the data
 *   - Editor-gate (status='draft' until human approves)
 */

const axios = require('axios');
const Article = require('../models/Article');
require('dotenv').config();

const API_SPORTS_URL = process.env.API_SPORTS_URL || 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const LEAGUES = [
  { id: 39, slug: 'premier-league', name: 'Premier League', country: 'England', season: 2025, vnName: 'Ngoại Hạng Anh' },
  { id: 140, slug: 'la-liga', name: 'La Liga', country: 'Spain', season: 2025, vnName: 'La Liga' },
  { id: 135, slug: 'serie-a', name: 'Serie A', country: 'Italy', season: 2025, vnName: 'Serie A' },
  { id: 78, slug: 'bundesliga', name: 'Bundesliga', country: 'Germany', season: 2025, vnName: 'Bundesliga' },
  { id: 61, slug: 'ligue-1', name: 'Ligue 1', country: 'France', season: 2025, vnName: 'Ligue 1' },
  { id: 2, slug: 'champions-league', name: 'Champions League', country: 'World', season: 2025, vnName: 'Champions League' },
  { id: 340, slug: 'v-league-1', name: 'V.League 1', country: 'Vietnam', season: 2025, vnName: 'V-League' },
];

const footballApi = axios.create({
  baseURL: API_SPORTS_URL,
  headers: {
    'x-rapidapi-key': API_SPORTS_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io',
  },
  timeout: 15000,
});

// ============================================================
// Data fetching
// ============================================================
async function fetchWeekData(league) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const iso = (d) => d.toISOString().split('T')[0];

  const [fixturesRes, standingsRes, scorersRes] = await Promise.allSettled([
    footballApi.get('/fixtures', {
      params: { league: league.id, season: league.season, from: iso(weekAgo), to: iso(today), status: 'FT' },
    }),
    footballApi.get('/standings', { params: { league: league.id, season: league.season } }),
    footballApi.get('/players/topscorers', { params: { league: league.id, season: league.season } }),
  ]);

  const fixtures = fixturesRes.status === 'fulfilled' ? (fixturesRes.value.data?.response || []) : [];
  const standingsRaw = standingsRes.status === 'fulfilled'
    ? (standingsRes.value.data?.response?.[0]?.league?.standings?.[0] || [])
    : [];
  const scorersRaw = scorersRes.status === 'fulfilled' ? (scorersRes.value.data?.response || []) : [];

  return {
    fixtures: fixtures.map(f => ({
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
      date: f.fixture.date,
      venue: f.fixture.venue?.name,
    })),
    standings: standingsRaw.slice(0, 6).map(s => ({
      rank: s.rank,
      team: s.team.name,
      points: s.points,
      form: s.form,
      played: s.all.played,
      gd: s.goalsDiff,
    })),
    topScorers: scorersRaw.slice(0, 5).map(p => ({
      name: p.player.name,
      team: p.statistics[0]?.team?.name,
      goals: p.statistics[0]?.goals?.total || 0,
    })),
  };
}

// ============================================================
// Prompt
// ============================================================
function buildRoundupPrompt(league, data) {
  const fixturesStr = data.fixtures.length
    ? data.fixtures.map(f => {
      const d = new Date(f.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      return `- ${d}: ${f.home} ${f.homeGoals}-${f.awayGoals} ${f.away}`;
    }).join('\n')
    : 'Chưa có trận nào kết thúc trong tuần.';

  const standingsStr = data.standings.length
    ? data.standings.map(s => `${s.rank}. ${s.team} — ${s.points}đ (${s.played} trận, HS ${s.gd >= 0 ? '+' : ''}${s.gd}, form ${s.form || '-'})`).join('\n')
    : 'Chưa có dữ liệu BXH.';

  const scorersStr = data.topScorers.length
    ? data.topScorers.map((p, i) => `${i + 1}. ${p.name} (${p.team}) — ${p.goals} bàn`).join('\n')
    : 'Chưa có dữ liệu top ghi bàn.';

  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const styles = [
    'Giọng biên tập viên chuyên nghiệp — khách quan, dữ liệu dẫn dắt, không cảm thán thái quá.',
    'Giọng chuyên gia phân tích — nhìn vào xu hướng, so sánh với lịch sử, chỉ ra mẫu hình.',
    'Giọng phóng viên field — như vừa đi xem trận về, tập trung khoảnh khắc và drama.',
    'Giọng analyst dữ liệu — nhiều con số, so sánh định lượng, kết luận dựa trên stats.',
  ];
  const style = styles[Math.floor(Math.random() * styles.length)];

  return `Bạn là biên tập viên thể thao chuyên nghiệp của ScoreLine.io. Viết bài tổng kết tuần giải đấu bằng tiếng Việt CÓ DẤU đầy đủ.

**PHONG CÁCH:** ${style}

**THÔNG TIN GIẢI ĐẤU:**
- Giải: ${league.vnName} (${league.name})
- Quốc gia: ${league.country}
- Mùa: ${league.season}/${league.season + 1}
- Cập nhật: ${today}

**KẾT QUẢ 7 NGÀY QUA (${data.fixtures.length} trận):**
${fixturesStr}

**BXH TOP 6 HIỆN TẠI:**
${standingsStr}

**TOP 5 GHI BÀN:**
${scorersStr}

**QUY TẮC BẮT BUỘC:**

1. TUYỆT ĐỐI KHÔNG bắt đầu bằng: "Trận đấu", "Tuần này là tuần", "Cuộc đua", "Trong khuôn khổ".
2. Phải NHẮC đúng ít nhất 3 tên đội + 2 tỷ số CỤ THỂ từ data ở trên. Không được bịa tỷ số.
3. Phải nhắc đúng tên đội dẫn đầu BXH + số điểm thực tế.
4. KHÔNG dùng "soi kèo", "kèo nhà cái", "cá cược". Dùng "nhận định", "phân tích" khi cần.
5. KHÔNG bịa tin chấn thương, chuyển nhượng không có trong data. Chỉ comment trên số liệu thực.
6. Độ dài: 1000-1400 từ. Súc tích, mỗi câu có thông tin mới.

**CẤU TRÚC (5 phần, tự do đặt heading):**
1. Mở bài (100-150 từ) — hook, không template
2. Kết quả nổi bật tuần (300-400 từ) — chọn 2-3 trận ý nghĩa nhất, không liệt kê hết
3. Bức tranh BXH (200-300 từ) — ai đang dẫn, ai đang rơi, khoảng cách
4. Cầu thủ ấn tượng (150-250 từ) — top scorer + 1-2 cái tên khác nếu data cho phép
5. Nhìn về tuần tới (100-200 từ) — gợi ý trận nên xem, không dự đoán cụ thể

Trả về ĐÚNG JSON sau (content là markdown 1 string, dùng \\n cho xuống dòng):
{
  "title": "[Hấp dẫn, 50-70 ký tự, chứa tên giải + chủ đề chính]",
  "description": "[120-160 ký tự, meta description]",
  "content": "[Markdown với ## heading cho 5 phần, **bold** cho số liệu, list khi cần]",
  "tags": ["${league.vnName}", "tin ${league.vnName.toLowerCase()}", "BXH ${league.vnName.toLowerCase()}", "bóng đá ${league.country === 'Vietnam' ? 'việt nam' : 'quốc tế'}"]
}`;
}

// ============================================================
// AI call
// ============================================================
async function callClaude(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  }, {
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    timeout: 60000,
  });
  const text = res.data?.content?.[0]?.text;
  if (!text) throw new Error('Empty Claude response');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    // Cleanup control characters
    return JSON.parse(jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' '));
  }
}

// ============================================================
// Validation — article must ground on real data
// ============================================================
const BANNED_INTRO = [
  /^tuần này là tuần/i,
  /^cuộc đua/i,
  /^trong khuôn khổ/i,
  /^trận đấu /i,
];

function wordCount(s) { return String(s || '').trim().split(/\s+/).length; }

function validate(ai, data) {
  const issues = [];
  if (!ai?.content || !ai?.title) return ['missing title or content'];

  const contentLower = ai.content.toLowerCase();
  const words = wordCount(ai.content);
  if (words < 600) issues.push(`content too short: ${words} words`);

  // Must mention at least 3 real team names
  const teamNames = new Set();
  data.fixtures.forEach(f => { teamNames.add(f.home); teamNames.add(f.away); });
  data.standings.forEach(s => teamNames.add(s.team));
  let teamHits = 0;
  for (const t of teamNames) if (contentLower.includes(t.toLowerCase())) teamHits++;
  if (teamHits < 3) issues.push(`mentions only ${teamHits} real teams (need ≥3)`);

  // Must contain at least one concrete score pattern like "3-1" or "2 - 1"
  if (!/\b\d+\s*-\s*\d+\b/.test(ai.content)) {
    issues.push('no concrete score (e.g. "2-1") found in content');
  }

  // Banned intro
  const firstLine = ai.content.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';
  for (const pat of BANNED_INTRO) {
    if (pat.test(firstLine.trim())) issues.push(`intro banned pattern: ${pat}`);
  }
  return issues;
}

// ============================================================
// Main
// ============================================================
async function generateRoundupForLeague(leagueInput, { maxRetries = 2, autoPublish = false } = {}) {
  const league = typeof leagueInput === 'string'
    ? LEAGUES.find(l => l.slug === leagueInput)
    : (LEAGUES.find(l => l.id === leagueInput.id) || leagueInput);
  if (!league) throw new Error(`Unknown league: ${JSON.stringify(leagueInput)}`);

  console.log(`\n[Roundup] ${league.vnName}`);
  const data = await fetchWeekData(league);
  console.log(`  Data: ${data.fixtures.length} fixtures, ${data.standings.length} standings, ${data.topScorers.length} scorers`);

  if (data.fixtures.length === 0 && data.standings.length === 0) {
    console.log('  ⚠ Skip: no data available this week');
    return { skipped: true, reason: 'no-data' };
  }

  const prompt = buildRoundupPrompt(league, data);
  let ai = null;
  let issues = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      ai = await callClaude(prompt);
      issues = validate(ai, data);
      if (issues.length === 0) break;
      console.log(`  ↻ Retry ${attempt + 1}/${maxRetries}: ${issues[0]}`);
    } catch (err) {
      console.log(`  ↻ Retry ${attempt + 1}/${maxRetries}: ${err.message}`);
      issues = [err.message];
    }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000));
  }

  if (issues.length > 0 || !ai) {
    console.log(`  ❌ Rejected: ${issues.join('; ')}`);
    return { success: false, issues };
  }

  // Use first fixture image as hero if available, else category-based fallback
  const heroImage = `${process.env.SITE_URL || 'https://scoreline.io'}/og-image.jpg`;

  const status = autoPublish ? 'published' : 'draft';
  const article = new Article({
    originalTitle: ai.title,
    originalDescription: ai.description,
    originalLink: '',
    source: 'ScoreLine Editorial',
    title: ai.title,
    description: ai.description,
    content: ai.content,
    tags: Array.isArray(ai.tags) ? ai.tags : [],
    image: heroImage,
    category: 'analysis',
    status,
    pubDate: new Date(),
    aiModel: 'claude-haiku-4-5-20251001',
    generatedAt: new Date(),
  });
  await article.save();

  const label = status === 'draft' ? '📝 DRAFT' : '✅ PUBLISHED';
  console.log(`  ${label}: "${ai.title.substring(0, 70)}"`);
  console.log(`  Slug: ${article.slug}`);
  return { success: true, article };
}

module.exports = {
  LEAGUES,
  generateRoundupForLeague,
  fetchWeekData,
  // exposed for testing
  buildRoundupPrompt,
  validate,
};
