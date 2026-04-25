/**
 * Runtime validator for AI-generated content.
 *
 * The prompts already tell Claude to avoid certain phrases and hit a word
 * count, but Haiku occasionally drifts — and we don't want a drifted batch
 * to silently flow through to the index. This module is the safety net.
 *
 * Usage:
 *   const issues = validate({ title, content, sections, minWords });
 *   if (issues.length) { reject(`AI output rejected: ${issues.join('; ')}`); }
 */

// Banned phrases (case-insensitive). Word-boundary matching where it makes
// sense; "AI" needs strict word boundaries because "Saigon" / "saigòn" /
// "đại" all contain "ai" as a substring.
const BANNED_PHRASES = [
  // Gambling-keyword cleanup (per scoreline.io editorial policy).
  { re: /soi[\s\-]?k[èeê]o/i, label: 'soi kèo' },
  { re: /\bcá[\s]?cược\b/i, label: 'cá cược' },
  { re: /\bnhà[\s]?cái\b/i, label: 'nhà cái' },
  { re: /\bđặt[\s]?cược\b/i, label: 'đặt cược' },
  // AI / robot wording — we publish under "Ban Biên Tập ScoreLine".
  { re: /\b(AI|A\.I\.)\b/, label: 'AI' },
  { re: /trí tuệ nhân tạo/i, label: 'trí tuệ nhân tạo' },
  { re: /(tự động hóa|robot) (viết|tạo|sinh)/i, label: 'robot/tự động hóa viết' },
];

// Banned-phrase exceptions — names of competitions / clubs / people that
// legitimately contain a banned token. Only matches as a whole pattern.
const BANNED_EXCEPTIONS = [
  /Serie A\b/,
  /Sài Gòn/i,
  /\bGia\s+Lai\b/i, // Hoàng Anh Gia Lai
];

function stripExceptions(text) {
  let out = text;
  for (const ex of BANNED_EXCEPTIONS) {
    out = out.replace(ex, ' ');
  }
  return out;
}

function findBannedPhrases(text) {
  if (!text) return [];
  const cleaned = stripExceptions(String(text));
  const hits = [];
  for (const { re, label } of BANNED_PHRASES) {
    if (re.test(cleaned)) hits.push(label);
  }
  return hits;
}

function countWords(text) {
  if (!text) return 0;
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate an AI-generated article payload.
 *
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} [payload.description] - excerpt / meta description
 * @param {string|Object} payload.content - either a single string body or an
 *   object whose values are concatenated (e.g. { introduction, teamAnalysis, … })
 * @param {Object} [opts]
 * @param {number} [opts.minTotalWords] - reject if total word count is lower
 * @param {Object} [opts.minSectionWords] - per-section minimums; only checked
 *   when content is an object: { introduction: 100, prediction: 150, … }
 * @param {boolean} [opts.allowMissingTitle=false]
 * @returns {string[]} issue list — empty array means OK
 */
function validate(payload, opts = {}) {
  const issues = [];
  const { minTotalWords, minSectionWords, allowMissingTitle } = opts;

  if (!allowMissingTitle && (!payload?.title || typeof payload.title !== 'string')) {
    issues.push('missing title');
  }

  // Banned phrases — title, description, full body.
  const titleHits = findBannedPhrases(payload?.title);
  if (titleHits.length) issues.push(`title contains banned: ${titleHits.join(', ')}`);
  const descHits = findBannedPhrases(payload?.description);
  if (descHits.length) issues.push(`description contains banned: ${descHits.join(', ')}`);

  let body = '';
  if (typeof payload?.content === 'string') {
    body = payload.content;
  } else if (payload?.content && typeof payload.content === 'object') {
    body = Object.values(payload.content).filter(v => typeof v === 'string').join('\n\n');
    // Per-section minimums.
    if (minSectionWords) {
      for (const [field, min] of Object.entries(minSectionWords)) {
        const w = countWords(payload.content[field]);
        if (w < min) issues.push(`${field}: ${w} words (min ${min})`);
      }
    }
  }
  const bodyHits = findBannedPhrases(body);
  if (bodyHits.length) issues.push(`body contains banned: ${bodyHits.join(', ')}`);

  // Total word count.
  if (typeof minTotalWords === 'number' && minTotalWords > 0) {
    const total = countWords(body);
    if (total < minTotalWords) issues.push(`body too short: ${total} words (min ${minTotalWords})`);
  }

  return issues;
}

module.exports = { validate, findBannedPhrases, countWords };
