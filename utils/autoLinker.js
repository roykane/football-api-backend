/**
 * Server-side auto-linker for HTML strings.
 *
 * Two helpers:
 *   - autoLinkPlayers(html, players) — links Vietnamese player names to /cau-thu/<slug>.
 *   - autoLinkKnowledge(html, terms) — links football-knowledge keywords to /kien-thuc-bong-da/<slug>.
 *
 * Both apply a single link per term per page (first match wins) so we don't
 * over-link the same anchor 12 times — Google flags that as keyword stuffing.
 */

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function alreadyLinked(html, offset) {
  // Scan back ~250 chars and check whether the most recent <a tag has been
  // closed with </a>. If not, we're inside an existing link — skip.
  const window = html.substring(Math.max(0, offset - 250), offset);
  const lastOpen = window.lastIndexOf('<a');
  const lastClose = window.lastIndexOf('</a>');
  return lastOpen > lastClose;
}

function linkOnce(html, name, href, style) {
  if (!html || !name) return html;
  const re = new RegExp(`\\b(${escapeRegex(name)})\\b`, 'i');
  const m = re.exec(html);
  if (!m) return html;
  if (alreadyLinked(html, m.index)) return html;
  const before = html.slice(0, m.index);
  const after = html.slice(m.index + m[0].length);
  return `${before}<a href="${href}" style="${style}">${m[0]}</a>${after}`;
}

/**
 * Add links for Vietnamese players found in the article body.
 * @param {string} html - Rendered article HTML.
 * @param {Array<{name:string, slug:string, tags?:string[]}>} players
 */
function autoLinkPlayers(html, players) {
  if (!html || !Array.isArray(players) || !players.length) return html;
  let out = html;
  // Sort longest-first so "Nguyễn Quang Hải" wins over "Quang Hải".
  const candidates = [];
  for (const p of players) {
    if (p.name) candidates.push({ name: p.name, slug: p.slug });
    if (Array.isArray(p.tags)) {
      for (const t of p.tags) {
        if (typeof t === 'string' && t.length >= 4 && /[a-zA-ZÀ-ỹ]/.test(t)) {
          candidates.push({ name: t, slug: p.slug });
        }
      }
    }
  }
  candidates.sort((a, b) => b.name.length - a.name.length);
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c.slug)) continue;
    const before = out;
    out = linkOnce(out, c.name, `/cau-thu/${c.slug}`, 'color:#2563eb;text-decoration:none;border-bottom:1px dashed #93c5fd;');
    if (out !== before) seen.add(c.slug);
  }
  return out;
}

/**
 * Add links for football-knowledge keywords (offside, VAR, 4-3-3, …).
 * @param {string} html
 * @param {Array<{slug:string, terms:string[]}>} entries
 */
function autoLinkKnowledge(html, entries) {
  if (!html || !Array.isArray(entries) || !entries.length) return html;
  let out = html;
  const flat = [];
  for (const e of entries) {
    for (const t of e.terms || []) {
      flat.push({ name: t, slug: e.slug });
    }
  }
  flat.sort((a, b) => b.name.length - a.name.length);
  const seen = new Set();
  for (const c of flat) {
    if (seen.has(c.slug)) continue;
    const before = out;
    out = linkOnce(out, c.name, `/kien-thuc-bong-da/${c.slug}`, 'color:#2563eb;text-decoration:none;border-bottom:1px dashed #93c5fd;');
    if (out !== before) seen.add(c.slug);
  }
  return out;
}

// Default knowledge term map — matches slugs in data/footballKnowledge.js.
const DEFAULT_KNOWLEDGE_TERMS = [
  { slug: 'luat-bong-da-co-ban', terms: ['luật bóng đá', 'việt vị', 'phạt đền', 'thẻ vàng', 'thẻ đỏ'] },
  { slug: 'so-do-chien-thuat-pho-bien', terms: ['sơ đồ 4-3-3', 'sơ đồ 4-4-2', 'sơ đồ 3-5-2', 'chiến thuật'] },
  { slug: 'var-cong-nghe-bong-da', terms: ['VAR', 'goal-line technology', 'công nghệ bóng đá'] },
  { slug: 'lich-su-world-cup-cac-ky', terms: ['lịch sử World Cup', 'các kỳ World Cup'] },
  { slug: 'giai-dau-bong-da-lon-nhat-the-gioi', terms: ['giải đấu lớn', 'Champions League', 'Euro'] },
];

module.exports = { autoLinkPlayers, autoLinkKnowledge, DEFAULT_KNOWLEDGE_TERMS };
