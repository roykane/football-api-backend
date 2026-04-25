/**
 * Transfer News Generator
 *
 * Generates articles from REAL API-Sports /transfers data.
 * - Zero hallucination: player/teams/date/type come from API; Claude only rewrites.
 * - Dedup via originalLink = `transfer:${playerId}:${date}:${inId}:${outId}`.
 * - Scope: recent transfers (last N days) of target clubs.
 */

const axios = require('axios');
const crypto = require('crypto');
const Article = require('../models/Article');
const { generateForArticle } = require('./article-image-generator');

const API_SPORTS_URL = 'https://v3.football.api-sports.io';

// Team IDs (API-Sports) — big clubs from target leagues. Keep the list focused.
const TARGET_TEAMS = [
  // Premier League
  33,  // Man United
  40,  // Liverpool
  42,  // Arsenal
  47,  // Tottenham
  49,  // Chelsea
  50,  // Man City
  // La Liga
  529, // Barcelona
  530, // Atletico Madrid
  541, // Real Madrid
  // Serie A
  489, // AC Milan
  492, // Napoli
  496, // Juventus
  505, // Inter
  // Bundesliga
  157, // Bayern Munich
  165, // Dortmund
  // Ligue 1
  85,  // PSG
];

const LOOKBACK_DAYS = 30;
const FALLBACK_PLAYER_IMAGE = 'https://media.api-sports.io/football/players/0.png';

function buildTransferKey(playerId, date, inId, outId) {
  return `transfer:${playerId}:${date}:${inId || 0}:${outId || 0}`;
}

function hashKey(key) {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
}

class TransferNewsGenerator {
  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.footballApi = axios.create({
      baseURL: API_SPORTS_URL,
      headers: { 'x-apisports-key': this.apiKey },
      timeout: 20000,
    });
  }

  /**
   * Fetch recent transfers for all target teams, dedupe, return sorted by date DESC.
   */
  async findCandidateTransfers(limit = 20, daysBack = LOOKBACK_DAYS) {
    const cutoff = new Date(Date.now() - daysBack * 24 * 3600 * 1000);
    const seen = new Map();

    for (const teamId of TARGET_TEAMS) {
      try {
        const res = await this.footballApi.get('/transfers', { params: { team: teamId } });
        const players = res.data?.response || [];
        for (const p of players) {
          const pid = p.player?.id;
          const pname = p.player?.name;
          if (!pid || !pname) continue;
          for (const t of (p.transfers || [])) {
            if (!t.date) continue;
            const date = new Date(t.date);
            if (isNaN(date.getTime())) continue; // skip unparseable dates
            if (date < cutoff) continue;
            if (date > new Date()) continue; // skip future dates
            const inId = t.teams?.in?.id;
            const outId = t.teams?.out?.id;
            if (!inId || !outId) continue;
            const key = buildTransferKey(pid, t.date, inId, outId);
            if (seen.has(key)) continue;
            seen.set(key, {
              key,
              player: { id: pid, name: pname },
              date: t.date,
              type: t.type || 'Transfer',
              teamIn: { id: inId, name: t.teams.in?.name, logo: t.teams.in?.logo },
              teamOut: { id: outId, name: t.teams.out?.name, logo: t.teams.out?.logo },
            });
          }
        }
      } catch (err) {
        console.error(`[Transfer] Fetch team ${teamId} failed:`, err.message);
      }
      // Rate-limit: small pause between team calls
      await new Promise(r => setTimeout(r, 150));
    }

    const all = Array.from(seen.values());
    all.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter out already-generated
    const out = [];
    for (const t of all) {
      const exists = await Article.findOne({ originalLink: t.key }).select('_id').lean();
      if (!exists) out.push(t);
      if (out.length >= limit) break;
    }
    return out;
  }

  /**
   * Fetch player photo (optional, best-effort).
   */
  async fetchPlayerPhoto(playerId, season = new Date().getFullYear()) {
    try {
      const res = await this.footballApi.get('/players', {
        params: { id: playerId, season },
        timeout: 10000,
      });
      return res.data?.response?.[0]?.player?.photo || null;
    } catch {
      return null;
    }
  }

  buildPrompt(t) {
    const dateStr = new Date(t.date).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // Normalize transfer type to Vietnamese label
    const typeRaw = String(t.type || '').toLowerCase();
    let typeLabel = 'Chuyển nhượng';
    if (typeRaw.includes('loan')) typeLabel = 'Cho mượn';
    else if (typeRaw.includes('free')) typeLabel = 'Miễn phí';
    else if (typeRaw.includes('return')) typeLabel = 'Trở về sau mượn';
    else if (t.type && t.type !== '-' && t.type !== 'Transfer') typeLabel = t.type;

    return `Bạn là phóng viên chuyển nhượng bóng đá, viết bài tin BẰNG TIẾNG VIỆT.

**DỮ LIỆU CHUYỂN NHƯỢNG (nguồn sự kiện duy nhất):**

- Cầu thủ: ${t.player.name}
- Ngày chuyển nhượng: ${dateStr}
- Hình thức: ${typeLabel}${t.type && t.type !== typeLabel && t.type !== '-' ? ` (API: ${t.type})` : ''}
- Từ CLB: ${t.teamOut.name}
- Đến CLB: ${t.teamIn.name}

---

**QUY TẮC BẮT BUỘC:**

1. CHỈ DÙNG DỮ LIỆU TRÊN. Không bịa phí chuyển nhượng, thời hạn hợp đồng, phát biểu, lương, hay chi tiết không có trong prompt.

2. KHÔNG BỊA TÊN cầu thủ/HLV khác, không nhắc thành tích lịch sử cụ thể không có trong data.

3. KHÔNG DÙNG các từ: "soi kèo", "cược", "nhà cái", "AI", "trí tuệ nhân tạo".

4. LENGTH: bài 200-350 từ. Súc tích, không lan man. Mỗi câu có thông tin mới.

5. STRUCTURE:
   - Intro (50-80 từ): công bố vụ chuyển nhượng với đầy đủ yếu tố (ai, đi đâu, loại hình, khi nào)
   - Chi tiết (80-150 từ): nêu hình thức chuyển nhượng có nghĩa gì (cho mượn → thử việc, miễn phí → hết hợp đồng, v.v.), dựa HOÀN TOÀN vào loại hình ở prompt
   - Tác động ngắn (50-100 từ): ý nghĩa với 2 CLB ở mức chung (KHÔNG bịa phát biểu HLV/fan)

6. KHÔNG DÙNG MARKDOWN (không ###, không **bold**). Chỉ text thuần với xuống dòng đúp giữa đoạn.

---

**TRẢ VỀ JSON THUẦN (không markdown, không backticks):**
{
  "title": "(55-70 ký tự, format: 'Player sang Club: Loại hình' hoặc tương tự)",
  "description": "(140-160 ký tự, tóm tắt vụ chuyển nhượng + CTA 'Chi tiết vụ chuyển nhượng')",
  "content": "(200-350 từ, xuống dòng bằng \\n\\n giữa đoạn)",
  "tags": ["${t.player.name}", "${t.teamIn.name}", "${t.teamOut.name}", "Chuyển nhượng"]
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
        max_tokens: 2000,
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

  async generateForTransfer(t) {
    const label = `${t.player.name} · ${t.teamOut.name} → ${t.teamIn.name}`;
    console.log(`\n[Transfer] ${label}`);

    // Race-safe dedupe
    const exists = await Article.findOne({ originalLink: t.key }).select('_id').lean();
    if (exists) {
      console.log(`   ⏭️  Already exists`);
      return null;
    }

    const prompt = this.buildPrompt(t);
    let ai;
    try {
      ai = await this.generateContent(prompt);
    } catch (err) {
      console.error(`   ❌ AI error:`, err.message);
      return null;
    }
    if (!ai?.title || !ai?.content) {
      console.error(`   ❌ Incomplete AI`);
      return null;
    }

    // Runtime validator — transfer copy is short (200-350w) so we use a
    // smaller floor than match-report/h2h.
    const { validate: validateContent } = require('./contentValidator');
    const validationIssues = validateContent({
      title: ai.title,
      description: ai.description,
      content: ai.content,
    }, { minTotalWords: 150 });
    if (validationIssues.length) {
      console.warn(`   ⚠️  AI rejected: ${validationIssues.join('; ')}`);
      return null;
    }

    // Try to fetch player photo; fall back to incoming team logo.
    const playerPhoto = await this.fetchPlayerPhoto(t.player.id);
    const image = playerPhoto || t.teamIn.logo || FALLBACK_PLAYER_IMAGE;

    const article = new Article({
      originalTitle: ai.title,
      originalLink: t.key, // unique key for dedup
      source: 'transfer-news',
      title: ai.title,
      description: ai.description || ai.title,
      content: ai.content,
      tags: Array.isArray(ai.tags) ? ai.tags : [t.player.name, t.teamIn.name, t.teamOut.name],
      image,
      category: 'transfer',
      // Editor gate — same as match-report/h2h/round-preview/soi-keo. Even
      // though transfer facts come straight from API-Sports, going through
      // the review queue keeps the publishing pipeline uniform and gives a
      // chance to spike sloppy AI rewrites before they hit the index.
      status: 'draft',
      pubDate: new Date(t.date),
      aiModel: 'claude-haiku-4-5-20251001',
      // Reuse matchInfo.league/homeTeam/awayTeam slots loosely: store teamIn + teamOut.
      matchInfo: {
        homeTeam: { id: t.teamOut.id, name: t.teamOut.name, logo: t.teamOut.logo },
        awayTeam: { id: t.teamIn.id, name: t.teamIn.name, logo: t.teamIn.logo },
        league: undefined,
        matchDate: new Date(t.date),
        venue: null,
        status: 'TRANSFER',
      },
    });

    try {
      await article.save();
      console.log(`   ✅ Saved: "${article.title}"`);

      // Generate composed header image (transfer variant: teamOut → teamIn).
      try {
        const imgUrl = await generateForArticle(article);
        if (imgUrl) {
          article.image = imgUrl;
          await article.save();
          console.log(`   🎨 Image: ${imgUrl}`);
        }
      } catch (imgErr) {
        console.warn(`   ⚠️  image gen skipped:`, imgErr.message);
      }

      return article;
    } catch (err) {
      console.error(`   ❌ Save failed:`, err.message);
      return null;
    }
  }

  async run(maxPerRun = 10, daysBack = LOOKBACK_DAYS) {
    const startTime = Date.now();
    console.log('\n🔁 ========== TRANSFER NEWS GENERATION ==========');
    console.log(`🕐 ${new Date().toLocaleString('vi-VN')} — target ${maxPerRun} (lookback ${daysBack}d)`);

    if (!this.apiKey || !this.anthropicKey) {
      console.error('[Transfer] Missing API keys, skipping');
      return { generated: 0, duration: 0 };
    }

    const candidates = await this.findCandidateTransfers(maxPerRun, daysBack);
    console.log(`[Transfer] Found ${candidates.length} candidate transfers`);
    if (candidates.length === 0) return { generated: 0, duration: 0 };

    let generated = 0;
    for (const t of candidates) {
      const article = await this.generateForTransfer(t);
      if (article) generated++;
      await new Promise(r => setTimeout(r, 2000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ [Transfer] ${generated}/${candidates.length} generated in ${duration}s`);
    return { generated, duration: parseFloat(duration) };
  }
}

module.exports = new TransferNewsGenerator();
module.exports.hashKey = hashKey;
