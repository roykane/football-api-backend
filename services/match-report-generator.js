/**
 * Match Report Generator
 *
 * Generates post-match news articles from REAL API-Sports data.
 * - Zero hallucination: Claude is instructed to ONLY use prompt data, never invent
 * - Saves as status='draft' for manual review during trial period
 * - Dedup via fixtureId (Article model unique sparse index)
 * - Scope: finished (FT) matches from top leagues in last 2 hours
 */

const axios = require('axios');
const Article = require('../models/Article');
const { generateForArticle, generateVariantForArticle } = require('./article-image-generator');

/**
 * Inject two generated images into the article content body.
 * - Hero goes before paragraph 1
 * - Stats card is injected before ~2/3 through the article (before the stats
 *   paragraph if we can find it, else before the last paragraph)
 * Both are plain markdown so SimpleMarkdown renders them as figures.
 */
function injectImagesIntoContent(content, heroUrl, variantUrl, homeName, awayName) {
  if (!content) return content;
  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) return content;

  const heroAlt = `${homeName} vs ${awayName}`;
  const variantAlt = `Tỷ số & thống kê ${homeName} vs ${awayName}`;
  const heroBlock = heroUrl ? `![${heroAlt}](${heroUrl})` : null;
  const variantBlock = variantUrl ? `![${variantAlt}](${variantUrl})` : null;

  // Find a good insertion point for the variant image: before the paragraph
  // that talks about "Thống kê" / "Tỉ lệ" / stats numbers. Fallback: 2/3 through.
  let variantIdx = -1;
  for (let i = paragraphs.length - 1; i >= 1; i--) {
    if (/thống kê|possession|kiểm soát|số liệu/i.test(paragraphs[i])) {
      variantIdx = i;
      break;
    }
  }
  if (variantIdx < 0) variantIdx = Math.max(1, Math.floor(paragraphs.length * 2 / 3));

  const out = [];
  if (heroBlock) out.push(heroBlock);
  for (let i = 0; i < paragraphs.length; i++) {
    if (variantBlock && i === variantIdx) out.push(variantBlock);
    out.push(paragraphs[i]);
  }
  return out.join('\n\n');
}

const API_SPORTS_URL = 'https://v3.football.api-sports.io';

// League IDs for Vietnamese audience (API-Sports IDs)
// Keep small — only real-demand leagues to control cost + relevance.
const TARGET_LEAGUES = [
  39,  // Premier League
  140, // La Liga
  135, // Serie A
  78,  // Bundesliga
  61,  // Ligue 1
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  340, // V.League 1 (Vietnam)
  1,   // FIFA World Cup (qualifiers too)
];

// Only cover recent finished matches (avoid back-generating old matches).
const LOOKBACK_HOURS = 3;

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=1200&h=630&fit=crop',
];

class MatchReportGenerator {
  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.footballApi = axios.create({
      baseURL: API_SPORTS_URL,
      headers: {
        'x-apisports-key': this.apiKey,
      },
      timeout: 15000,
    });
  }

  /**
   * Find recently-finished matches from target leagues that don't have reports yet.
   * Returns fixtures sorted by most-recent-first, capped at `limit`.
   */
  async findCandidateFixtures(limit = 10, daysBack = 0) {
    const now = new Date();
    // daysBack=0 → today+yesterday (normal live behavior)
    // daysBack=N → today + N days back (for back-populate)
    const totalDays = Math.max(1, daysBack + 1);
    const dates = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      dates.push(d.toISOString().split('T')[0]);
    }

    const collected = [];
    const seen = new Set();

    for (const date of dates) {
      try {
        const res = await this.footballApi.get('/fixtures', {
          params: { date, status: 'FT-AET-PEN' },
        });
        const fixtures = res.data?.response || [];
        for (const f of fixtures) {
          const leagueId = f.league?.id;
          if (!TARGET_LEAGUES.includes(leagueId)) continue;
          const finishedAt = new Date(f.fixture?.date || f.fixture?.timestamp * 1000);
          const ageHours = (now - finishedAt) / 3_600_000;
          if (ageHours < 0) continue; // skip future matches
          if (daysBack === 0 && ageHours > LOOKBACK_HOURS + 3) continue; // live mode: fresh only
          const fid = f.fixture?.id;
          if (!fid || seen.has(fid)) continue;
          seen.add(fid);
          collected.push(f);
        }
      } catch (err) {
        console.error(`[MatchReport] Fetch fixtures for ${date} failed:`, err.message);
      }
    }

    // Most recent first
    collected.sort((a, b) => (b.fixture?.timestamp || 0) - (a.fixture?.timestamp || 0));

    // Filter out those already have report
    const filtered = [];
    for (const f of collected) {
      const exists = await Article.existsByFixtureId(f.fixture.id);
      if (!exists) filtered.push(f);
      if (filtered.length >= limit) break;
    }
    return filtered;
  }

  /**
   * Fetch detailed match data: events, lineups, statistics.
   * Returns null if essential data missing.
   */
  async fetchMatchDetail(fixtureId) {
    try {
      const [eventsRes, statsRes, lineupsRes] = await Promise.all([
        this.footballApi.get('/fixtures/events', { params: { fixture: fixtureId } }).catch(() => null),
        this.footballApi.get('/fixtures/statistics', { params: { fixture: fixtureId } }).catch(() => null),
        this.footballApi.get('/fixtures/lineups', { params: { fixture: fixtureId } }).catch(() => null),
      ]);

      return {
        events: eventsRes?.data?.response || [],
        statistics: statsRes?.data?.response || [],
        lineups: lineupsRes?.data?.response || [],
      };
    } catch (err) {
      console.error(`[MatchReport] Fetch detail for ${fixtureId} failed:`, err.message);
      return null;
    }
  }

  /**
   * Build a strict, fact-only prompt. Claude is instructed to refuse to invent.
   */
  buildPrompt(fixture, detail) {
    const { fixture: fx, teams, league, goals, score } = fixture;
    const { events, statistics, lineups } = detail;

    const matchDate = new Date(fx.date).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    // Events formatted as timeline
    const goalEvents = events.filter(e => e.type === 'Goal');
    const cardEvents = events.filter(e => e.type === 'Card');
    const subEvents = events.filter(e => e.type === 'subst');

    const formatEvent = (e) => {
      const minute = e.time?.elapsed ?? '?';
      const extra = e.time?.extra ? `+${e.time.extra}` : '';
      const player = e.player?.name || '(không rõ)';
      const team = e.team?.name || '';
      const detail = e.detail ? ` (${e.detail})` : '';
      const assist = e.assist?.name ? ` kiến tạo: ${e.assist.name}` : '';
      return `  - Phút ${minute}${extra}' — ${team}: ${player}${detail}${assist}`;
    };

    const goalsText = goalEvents.length > 0
      ? goalEvents.map(formatEvent).join('\n')
      : '  - (Không có bàn thắng)';

    const cardsText = cardEvents.length > 0
      ? cardEvents.map(formatEvent).join('\n')
      : '  - (Không có thẻ phạt)';

    const subsText = subEvents.length > 0
      ? subEvents.slice(0, 8).map(formatEvent).join('\n')
      : '  - (Không có thay người đáng chú ý)';

    // Stats
    let statsText = '(Không có thống kê)';
    if (statistics.length === 2) {
      const homeStats = statistics[0]?.statistics || [];
      const awayStats = statistics[1]?.statistics || [];
      const statMap = {};
      homeStats.forEach(s => { statMap[s.type] = { home: s.value, away: null }; });
      awayStats.forEach(s => {
        if (statMap[s.type]) statMap[s.type].away = s.value;
        else statMap[s.type] = { home: null, away: s.value };
      });
      const relevantKeys = ['Ball Possession', 'Total Shots', 'Shots on Goal', 'Corner Kicks', 'Fouls', 'Yellow Cards', 'Red Cards', 'Passes %', 'expected_goals'];
      const lines = [];
      for (const key of relevantKeys) {
        if (statMap[key]) {
          lines.push(`  - ${key}: ${teams.home.name} ${statMap[key].home ?? '-'} | ${teams.away.name} ${statMap[key].away ?? '-'}`);
        }
      }
      if (lines.length > 0) statsText = lines.join('\n');
    }

    // Lineups — just formations, not full names (keep prompt size down)
    let formationsText = '(Không có sơ đồ)';
    if (lineups.length === 2) {
      formationsText = `  - ${teams.home.name}: ${lineups[0]?.formation || '?'} (HLV: ${lineups[0]?.coach?.name || '?'})\n  - ${teams.away.name}: ${lineups[1]?.formation || '?'} (HLV: ${lineups[1]?.coach?.name || '?'})`;
    }

    const homeScore = goals?.home ?? 0;
    const awayScore = goals?.away ?? 0;
    const resultDesc = homeScore > awayScore ? `${teams.home.name} thắng` : awayScore > homeScore ? `${teams.away.name} thắng` : 'Hòa';

    return `Bạn là phóng viên thể thao chuyên nghiệp, viết bài tường thuật trận đấu BẰNG TIẾNG VIỆT cho website bóng đá.

**DỮ LIỆU TRẬN ĐẤU (duy nhất nguồn sự kiện — KHÔNG được suy diễn ngoài đây):**

Trận đấu: ${teams.home.name} ${homeScore} - ${awayScore} ${teams.away.name}
Kết quả: ${resultDesc}
Giải đấu: ${league.name} (${league.country})
Thời gian: ${matchDate}
Sân: ${fx.venue?.name || 'Không xác định'}${fx.venue?.city ? `, ${fx.venue.city}` : ''}
Trọng tài: ${fx.referee || 'Không xác định'}

**BÀN THẮNG:**
${goalsText}

**THẺ PHẠT:**
${cardsText}

**THAY NGƯỜI (tối đa 8):**
${subsText}

**THỐNG KÊ:**
${statsText}

**SƠ ĐỒ & HLV:**
${formationsText}

---

**QUY TẮC BẮT BUỘC (CỰC KỲ QUAN TRỌNG):**

1. **CHỈ DÙNG DỮ LIỆU Ở TRÊN.** Không được thêm tên cầu thủ, thông tin bên ngoài, bình luận về quá khứ đội bóng, thống kê không có trong prompt. Nếu data thiếu cho 1 section → viết ngắn gọn "trận đấu chưa có thống kê chi tiết công bố" thay vì bịa.

2. **KHÔNG BỊA TÊN CẦU THỦ** không xuất hiện trong danh sách bàn thắng/thẻ/thay người ở trên.

3. **KHÔNG ĐOÁN** về phong độ trước trận, lịch sử đối đầu, cảm xúc HLV, phát biểu sau trận — những điều không có trong data.

4. **KHÔNG DÙNG** các từ: "soi kèo", "cược", "nhà cái", "đặt cược", "AI", "trí tuệ nhân tạo".

5. **LENGTH**: bài 800-1200 từ tổng (không tính FAQ).

6. **DÙNG MARKDOWN ĐỂ CHIA BỐ CỤC** — rất quan trọng cho SEO và dễ đọc:
   - Heading cấp 2 (##) cho mỗi section chính.
   - Có thể dùng ### cho sub-topic trong một section.
   - **Bold** tên cầu thủ/đội lần đầu xuất hiện trong mỗi section (không bold mỗi lần nhắc).
   - Có thể dùng bullet list (-) khi liệt kê thẻ phạt, thay người, thống kê.

7. **STRUCTURE BẮT BUỘC** — phải có đủ 5 section sau, đúng thứ tự, mỗi section bắt đầu bằng "## ":

   ## Tổng quan trận đấu
   (120-180 từ) Kết quả cuối cùng, bối cảnh giải đấu, sân, thời gian, nêu điểm đáng chú ý nhất sẽ nói kỹ ở dưới. Câu đầu tiên phải chứa tỷ số + tên 2 đội + giải đấu.

   ## Diễn biến chi tiết
   (250-350 từ) Kể lại trận đấu theo thứ tự phút: bàn thắng từng phút, ai ghi, ai kiến tạo, tình huống dẫn đến bàn. Nếu trận 0-0 thì mô tả các cơ hội, sức ép của 2 đội dựa trên stats. Dùng ### cho "Hiệp 1" và "Hiệp 2" nếu hợp lý.

   ## Bàn thắng & khoảnh khắc đáng chú ý
   (150-200 từ) Highlight bàn thắng đẹp, thẻ đỏ/thẻ vàng quan trọng, thay người chiến thuật. Nếu không có bàn thì tập trung vào thẻ phạt, thay người. Dùng bullet list khi liệt kê ≥3 sự kiện cùng loại.

   ## Thống kê trận đấu
   (120-180 từ) Phân tích 3-4 chỉ số có thật trong data (possession, shots, shots on goal, corners, xG). So sánh giữa 2 đội và nêu ý nghĩa. Nếu không có stats thì viết "Trận đấu chưa có thống kê chi tiết công bố" — KHÔNG bịa số.

   ## Ý nghĩa kết quả
   (120-180 từ) Kết quả này nghĩa là gì trong bối cảnh vòng đấu/giải đấu — chỉ nêu sự kiện khách quan (đội A giữ được điểm ở sân nhà, đội B tiếp tục bất bại, v.v.). KHÔNG dự đoán tương lai, KHÔNG bình luận về tinh thần cầu thủ.

   ## Câu hỏi thường gặp
   (3 câu hỏi, mỗi câu trả lời 2-3 câu / ~30-60 từ). Dùng ### cho mỗi câu hỏi. Ví dụ:
   ### Ai ghi bàn trong trận ${teams.home.name} vs ${teams.away.name}?
   (trả lời ngắn gọn bằng câu văn)
   ### Tỷ số cuối cùng là bao nhiêu?
   (trả lời)
   ### Trận đấu diễn ra khi nào và ở đâu?
   (trả lời)

---

**TRẢ VỀ JSON THUẦN (không backticks ngoài JSON):**
{
  "title": "(55-70 ký tự, format: '${teams.home.name} ${homeScore}-${awayScore} ${teams.away.name}: <highlight ngắn>')",
  "description": "(140-160 ký tự, tóm tắt kết quả + điểm đáng chú ý)",
  "content": "(800-1200 từ, MARKDOWN có ## headings và **bold**, sections xuống dòng bằng \\n\\n)",
  "tags": ["${teams.home.name}", "${teams.away.name}", "${league.name}"]
}`;
  }

  async generateContent(prompt) {
    if (!this.anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        // Content grew to 800-1200 words + 3 FAQ Q&As → raise ceiling so
        // long articles aren't truncated mid-section (was 3000).
        max_tokens: 4500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const cleaned = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    try {
      return JSON.parse(cleaned);
    } catch {
      const aggressive = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');
      return JSON.parse(aggressive);
    }
  }

  /**
   * Determine category based on match context.
   */
  categorize(fixture) {
    const leagueName = (fixture.league?.name || '').toLowerCase();
    if (leagueName.includes('champions') || leagueName.includes('europa')) return 'analysis';
    if (leagueName.includes('world cup') || leagueName.includes('world-cup')) return 'analysis';
    return 'general';
  }

  /**
   * Generate 1 report for a given fixture.
   * Returns Article document or null on failure.
   */
  async generateForFixture(fixture) {
    const fid = fixture.fixture?.id;
    const { teams } = fixture;
    const matchLabel = `${teams.home.name} vs ${teams.away.name}`;

    console.log(`\n[MatchReport] Generating for #${fid}: ${matchLabel}`);

    // Dedup check again (race-safe)
    if (await Article.existsByFixtureId(fid)) {
      console.log(`   ⏭️  Already exists, skipping`);
      return null;
    }

    // Fetch real detail
    const detail = await this.fetchMatchDetail(fid);
    if (!detail) {
      console.log(`   ❌ No detail available`);
      return null;
    }

    // Build strict prompt + generate
    const prompt = this.buildPrompt(fixture, detail);
    let aiContent;
    try {
      aiContent = await this.generateContent(prompt);
    } catch (err) {
      console.error(`   ❌ AI error:`, err.message);
      return null;
    }

    if (!aiContent?.title || !aiContent?.content) {
      console.error(`   ❌ Incomplete AI response`);
      return null;
    }

    const homeLogo = fixture.teams?.home?.logo || null;
    const awayLogo = fixture.teams?.away?.logo || null;
    const leagueLogo = fixture.league?.logo || null;

    // Use home team logo as article image — reliable API-Sports CDN, no Unsplash referer issues.
    // If missing (very rare), fallback to random Unsplash.
    const image = homeLogo || FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];

    const article = new Article({
      originalTitle: aiContent.title,
      originalLink: `https://www.api-sports.io/fixtures/${fid}`,
      source: 'match-report',
      fixtureId: fid,
      title: aiContent.title,
      description: aiContent.description || aiContent.title,
      content: aiContent.content,
      tags: Array.isArray(aiContent.tags) ? aiContent.tags : [teams.home.name, teams.away.name],
      image,
      category: this.categorize(fixture),
      // Generated articles wait for admin review before going public.
      // /admin flips this to 'published' once both review checkboxes are set.
      status: 'draft',
      pubDate: new Date(fixture.fixture?.date || Date.now()),
      aiModel: 'claude-haiku-4-5-20251001',
      matchInfo: {
        homeTeam: {
          id: fixture.teams?.home?.id,
          name: fixture.teams?.home?.name,
          logo: homeLogo,
          score: fixture.goals?.home ?? null,
        },
        awayTeam: {
          id: fixture.teams?.away?.id,
          name: fixture.teams?.away?.name,
          logo: awayLogo,
          score: fixture.goals?.away ?? null,
        },
        league: {
          id: fixture.league?.id,
          name: fixture.league?.name,
          logo: leagueLogo,
          country: fixture.league?.country,
        },
        matchDate: new Date(fixture.fixture?.date || Date.now()),
        venue: fixture.fixture?.venue?.name || null,
        status: fixture.fixture?.status?.short || 'FT',
      },
    });

    try {
      await article.save();
      console.log(`   ✅ Saved: "${article.title}"`);

      // Generate 2 composed images (hero + stats card) and embed both
      // into the article body as markdown so readers see them inline.
      // Non-fatal: if image gen fails, keep the fallback URL already set.
      try {
        const [heroUrl, variantUrl] = await Promise.all([
          generateForArticle(article).catch(() => null),
          generateVariantForArticle(article).catch(() => null),
        ]);
        if (heroUrl) {
          article.image = heroUrl;
          console.log(`   🎨 Hero image: ${heroUrl}`);
        }
        if (variantUrl) {
          console.log(`   🎨 Stats image: ${variantUrl}`);
        }
        if (heroUrl || variantUrl) {
          article.content = injectImagesIntoContent(
            article.content,
            heroUrl,
            variantUrl,
            teams.home.name,
            teams.away.name,
          );
          await article.save();
        }
      } catch (imgErr) {
        console.warn(`   ⚠️  image gen skipped:`, imgErr.message);
      }

      return article;
    } catch (err) {
      // Likely duplicate fixtureId (race) or validation — log and skip.
      console.error(`   ❌ Save failed:`, err.message);
      return null;
    }
  }

  /**
   * Main entry. Processes up to maxPerRun finished matches.
   * daysBack=0 (default) = live mode: today+yesterday, fresh only
   * daysBack=N = back-populate mode: look N days into past
   */
  async run(maxPerRun = 5, daysBack = 0) {
    const startTime = Date.now();
    const mode = daysBack > 0 ? `BACK-POPULATE ${daysBack}d` : 'LIVE';
    console.log('\n📰 ========== MATCH REPORT GENERATION ==========');
    console.log(`🕐 ${new Date().toLocaleString('vi-VN')} — mode: ${mode}, target ${maxPerRun} reports`);

    if (!this.apiKey || !this.anthropicKey) {
      console.error('[MatchReport] Missing API keys, skipping run');
      return { generated: 0, duration: 0 };
    }

    const candidates = await this.findCandidateFixtures(maxPerRun, daysBack);
    console.log(`[MatchReport] Found ${candidates.length} candidate fixtures`);

    if (candidates.length === 0) {
      return { generated: 0, duration: 0 };
    }

    let generated = 0;
    for (const fixture of candidates) {
      const article = await this.generateForFixture(fixture);
      if (article) generated++;
      // Spacing between Claude calls to be gentle on rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ [MatchReport] ${generated}/${candidates.length} reports generated in ${duration}s`);
    return { generated, duration: parseFloat(duration) };
  }
}

module.exports = new MatchReportGenerator();
