/**
 * Markdown → HTML for SSR content. Matches frontend simple-markdown.tsx output.
 */

function renderInline(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const out = [];
  let paraBuf = [];
  let listBuf = [];
  let listTag = null;

  const flushPara = () => {
    if (paraBuf.length) {
      out.push('<p>' + renderInline(paraBuf.join(' ').trim()) + '</p>');
      paraBuf = [];
    }
  };
  const flushList = () => {
    if (listBuf.length && listTag) {
      const lis = listBuf.map(it => '<li>' + renderInline(it) + '</li>').join('');
      out.push('<' + listTag + '>' + lis + '</' + listTag + '>');
      listBuf = [];
      listTag = null;
    }
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) { flushAll(); continue; }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h1 = trimmed.match(/^#\s+(.+)$/);
    const ul = trimmed.match(/^-\s+(.+)$/);
    const ol = trimmed.match(/^\d+\.\s+(.+)$/);

    if (h3) { flushAll(); out.push('<h3>' + renderInline(h3[1]) + '</h3>'); continue; }
    if (h2) { flushAll(); out.push('<h2>' + renderInline(h2[1]) + '</h2>'); continue; }
    if (h1) { flushAll(); out.push('<h2>' + renderInline(h1[1]) + '</h2>'); continue; }

    if (ul) {
      flushPara();
      if (listTag && listTag !== 'ul') flushList();
      listTag = 'ul'; listBuf.push(ul[1]); continue;
    }
    if (ol) {
      flushPara();
      if (listTag && listTag !== 'ol') flushList();
      listTag = 'ol'; listBuf.push(ol[1]); continue;
    }

    flushList();
    paraBuf.push(trimmed);
  }
  flushAll();
  return out.join('\n');
}

/**
 * Split markdown by ## headings. Returns [{title, body}] like frontend splitBySections.
 */
function splitBySections(text) {
  const lines = String(text || '').split('\n');
  const sections = [];
  let current = { title: '', body: '' };
  for (const raw of lines) {
    const m = raw.trim().match(/^##\s+(.+)$/);
    if (m) {
      if (current.title || current.body.trim()) sections.push(current);
      current = { title: m[1], body: '' };
    } else {
      current.body += raw + '\n';
    }
  }
  if (current.title || current.body.trim()) sections.push(current);
  return sections;
}

module.exports = { markdownToHtml, splitBySections, renderInline };
