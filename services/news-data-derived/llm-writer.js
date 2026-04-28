/**
 * Shared Claude HTTP wrapper for data-derived news generators.
 *
 * Returns parsed JSON from Claude's response. Generators pass a strict
 * fact-only prompt + expected JSON schema; this module handles transport,
 * JSON extraction, and basic validation.
 */

const MODEL = 'claude-haiku-4-5-20251001';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

const BANNED_PHRASES = [
  /soi k[èe]o/i,
  /đặt c[ưu][ơo]?c/i,
  /nh[àa] c[áa]i/i,
  /\bAI\b/,
  /tr[íi] tu[ệe] nh[âa]n t[ạa]o/i,
];

async function callClaude({ prompt, maxTokens = 2500 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const usage = data.usage || {};
  const cost = ((usage.input_tokens || 0) * 1 + (usage.output_tokens || 0) * 5) / 1_000_000;

  return { text, usage, cost };
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in AI response');
  const cleaned = m[0]
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(m[0].replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' '));
  }
}

function checkBannedPhrases({ title, description, content }) {
  const blob = `${title || ''}\n${description || ''}\n${content || ''}`;
  for (const re of BANNED_PHRASES) {
    if (re.test(blob)) return re.source;
  }
  return null;
}

/**
 * Generate an article from a strict fact-only prompt.
 * Caller defines the prompt body — this function adds the JSON schema
 * trailer and validates banned phrases + minimum content length.
 *
 * @param {object} args
 * @param {string} args.systemContext  — short context line ("Phóng viên thể thao...")
 * @param {string} args.factsBlock     — raw data the model is allowed to use
 * @param {string} args.structureBlock — required article structure (sections + word counts)
 * @param {object} args.titleHint      — { tone, subject } to nudge title shape
 * @param {number} [args.minWords=350] — content reject threshold
 * @returns {Promise<{title,description,content,tags,cost}>}
 */
async function writeArticle({ systemContext, factsBlock, structureBlock, titleHint = {}, minWords = 350 }) {
  const prompt = [
    systemContext || 'Bạn là phóng viên thể thao chuyên nghiệp, viết bài tiếng Việt cho website bóng đá.',
    '',
    '**DỮ LIỆU SỰ KIỆN (DUY NHẤT NGUỒN — KHÔNG được suy diễn ngoài đây):**',
    factsBlock,
    '',
    '---',
    '',
    '**QUY TẮC BẮT BUỘC:**',
    '',
    '1. CHỈ DÙNG dữ liệu ở trên. KHÔNG bịa số liệu, tên cầu thủ, lịch sử đối đầu, phát biểu HLV ngoài data.',
    '2. KHÔNG dùng các từ: "soi kèo", "cược", "nhà cái", "đặt cược", "AI", "trí tuệ nhân tạo".',
    '3. Markdown: dùng `## ` cho heading section, `**bold**` cho tên cầu thủ/đội lần đầu xuất hiện trong section.',
    '4. Văn phong khách quan, tránh cảm xúc thái quá.',
    '',
    '**CẤU TRÚC BẮT BUỘC:**',
    structureBlock,
    '',
    '---',
    '',
    '**TRẢ VỀ JSON THUẦN (không backticks ngoài JSON):**',
    '{',
    `  "title": "(55-70 ký tự${titleHint.subject ? `, có nhắc đến ${titleHint.subject}` : ''})",`,
    '  "description": "(140-160 ký tự, tóm tắt sự kiện)",',
    '  "content": "(markdown có ## headings và **bold**, sections ngăn bằng \\\\n\\\\n)",',
    '  "tags": ["tag1","tag2","tag3"]',
    '}',
  ].join('\n');

  const { text, usage, cost } = await callClaude({ prompt, maxTokens: 3000 });
  const json = extractJson(text);

  if (!json.title || !json.content) throw new Error('Incomplete AI response');

  const banned = checkBannedPhrases(json);
  if (banned) throw new Error(`Banned phrase: ${banned}`);

  const wordCount = String(json.content).split(/\s+/).filter(Boolean).length;
  if (wordCount < minWords) throw new Error(`Too short: ${wordCount} < ${minWords}`);

  return {
    title: json.title,
    description: json.description || json.title,
    content: json.content,
    tags: Array.isArray(json.tags) ? json.tags : [],
    cost,
    usage,
  };
}

module.exports = { writeArticle, MODEL };
