/**
 * Compare SSR — bot-only HTML for /so-sanh and /so-sanh/<slugA>-vs-<slugB>.
 *
 * Numbers come from services/compareData (same source as /api/compare JSON
 * endpoint and the React SPA), so crawled HTML matches what users see.
 *
 * All logo images flow through /api/img proxy → self-hosted WebP cache,
 * no third-party CDN URLs leak into HTML (per project image policy).
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const {
  getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL,
} = require('../utils/seoCommon');
const {
  getCompareTeamsData,
  getPopularComparisons,
} = require('../services/compareData');

const PROXY_HOSTS = new Set([
  'media.api-sports.io',
  'media-1.api-sports.io',
  'media-2.api-sports.io',
  'media-3.api-sports.io',
  'media-4.api-sports.io',
  'flagicons.lipis.dev',
]);

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function proxyImg(url, width = 64) {
  if (!url) return '';
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url);
    if (PROXY_HOSTS.has(u.host)) {
      return `/api/img?url=${encodeURIComponent(url)}&w=${width}`;
    }
  } catch { /* malformed → return as-is */ }
  return url;
}

function absoluteImg(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path}`;
}

function formatDateVi(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return ''; }
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0066FF;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:1280px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .hero{background:linear-gradient(135deg,#0a1628,#1a2744);color:#fff;padding:20px;border-radius:8px;margin-bottom:16px;border:1px solid rgba(251,191,36,0.3)}
    .vsRow{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:10px}
    .side{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}
    .logoBig{width:80px;height:80px;object-fit:contain;margin-bottom:8px}
    .teamName{font-size:18px;font-weight:800;color:#fbbf24;line-height:1.2}
    .teamCountry{font-size:12px;color:#cbd5e1;margin-top:2px}
    .vsBig{font-size:32px;font-weight:900;color:#94a3b8}
    h1.heroH1{font-size:22px;font-weight:800;color:#fff;text-align:center;margin-top:6px}
    .freshness{font-size:12px;color:#94a3b8;text-align:center;margin-top:6px}
    .quickAnswer{background:#fffbeb;border-left:4px solid #fbbf24;border-radius:6px;padding:14px 16px;margin-bottom:16px;color:#1e293b;font-size:15px;line-height:1.7}
    .quickAnswer strong{color:#92400e}
    .card{background:#fff;border-radius:8px;padding:18px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #fef3c7}
    .statRow{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
    .statRow:last-child{border-bottom:none}
    .statA{text-align:right;font-weight:700;color:#0f172a;font-size:18px}
    .statB{text-align:left;font-weight:700;color:#0f172a;font-size:18px}
    .statLabel{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;text-align:center;padding:0 8px}
    .formStrip{display:flex;gap:6px;justify-content:center;margin:6px 0}
    .formBox{width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px}
    .formBox.W{background:#16a34a}.formBox.L{background:#dc2626}.formBox.D{background:#94a3b8}
    table.cmp{width:100%;border-collapse:collapse;font-size:13px}
    table.cmp th,table.cmp td{padding:8px;text-align:center;border-bottom:1px solid #f1f5f9}
    table.cmp th{background:#fef3c7;color:#92400e;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
    table.cmp td.left{text-align:left}
    .miniLogo{width:18px;height:18px;object-fit:contain;vertical-align:middle;margin:0 4px}
    .faqItem{margin-bottom:14px}
    .faqItem h3{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px}
    .faqItem p{color:#334155;font-size:14px;line-height:1.7;margin:0}
    .relatedGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
    .relatedCard{display:flex;align-items:center;gap:8px;padding:10px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:600;color:#1e293b}
    .relatedLogo{width:24px;height:24px;object-fit:contain;flex-shrink:0}
    .relatedVs{font-size:10px;color:#94a3b8;font-weight:700}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
    .pairCard{background:#fff;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.06);text-decoration:none;color:#1e293b;display:block}
    .pairCard:hover{text-decoration:none;background:#fffbeb}
    .pair{display:flex;align-items:center;gap:12px;margin-bottom:8px}
    .pairSide{display:flex;align-items:center;gap:6px;flex:1;min-width:0}
    .pairLogo{width:32px;height:32px;object-fit:contain;flex-shrink:0}
    .pairTeam{font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pairVs{font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px}
    .pairLabel{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}}
    @media(max-width:640px){
      .logoBig{width:56px;height:56px}.teamName{font-size:14px}.vsBig{font-size:22px}
      h1.heroH1{font-size:18px}
    }
  `;
}

router.get('/so-sanh', async (_req, res) => {
  try {
    const items = await getPopularComparisons();
    const url = `${SITE_URL}/so-sanh`;
    const title = 'So Sánh CLB Bóng Đá - Đối Đầu, Phong Độ, Lịch Sử';
    const description = `So sánh trực tiếp ${items.length} cặp đối thủ kinh điển: thống kê đối đầu lịch sử, phong độ 5 trận gần nhất, lịch sử CLB. Tổng hợp từ dữ liệu API-Sports.`;

    const { datePublished, dateModified } = getEntityDates({});
    const og = pickOgImage({}, { alt: title, knownDimensions: true });

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'So sánh CLB', item: url },
      ],
    };

    const itemListSchema = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Cặp so sánh CLB bóng đá phổ biến',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: `${SITE_URL}/so-sanh/${it.slug}`,
        name: `${it.teamA.name} vs ${it.teamB.name}`,
      })),
    };

    const hubFaqs = [
      {
        question: 'So sánh CLB là gì và dùng để làm gì?',
        answer: 'Trang so sánh tổng hợp đối đầu lịch sử (số trận thắng/hòa, bàn thắng), phong độ 5 trận gần nhất và thông tin CLB của 2 đội bóng. Dữ liệu cập nhật từ API-Sports, hữu ích cho fan và người làm nhận định trận đấu.',
      },
      {
        question: 'Cặp so sánh nào phổ biến nhất?',
        answer: 'El Clasico (Real Madrid vs Barcelona), Derby Manchester (Man Utd vs Man City), Der Klassiker (Bayern vs Dortmund), Derby Bắc London (Arsenal vs Tottenham), và Derby della Madonnina (Inter vs Milan) là 5 cặp được tìm kiếm nhiều nhất.',
      },
      {
        question: 'Dữ liệu đối đầu lấy từ đâu?',
        answer: 'Tất cả số liệu lấy từ API-Sports — nguồn dữ liệu chính thức cho hơn 1000 giải đấu trên thế giới. Lịch sử đối đầu bao gồm các trận chính thức ở giải VĐQG, cúp quốc gia, và đấu trường châu lục.',
      },
      {
        question: 'Trang so sánh có cập nhật phong độ trực tiếp không?',
        answer: 'Phong độ 5 trận gần nhất được cập nhật mỗi 6 giờ. Lịch sử đối đầu cập nhật ngay sau khi mỗi trận giữa 2 đội kết thúc.',
      },
    ];

    const faqSchema = {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: hubFaqs.map(f => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    };

    const cardsHtml = items.map(it => `
      <a class="pairCard" href="/so-sanh/${escapeHtml(it.slug)}">
        <div class="pair">
          <div class="pairSide">
            ${it.teamA.logo ? `<img class="pairLogo" src="${escapeHtml(proxyImg(it.teamA.logo, 64))}" alt="Logo ${escapeHtml(it.teamA.name)}" loading="lazy" width="32" height="32">` : ''}
            <span class="pairTeam">${escapeHtml(it.teamA.name)}</span>
          </div>
          <span class="pairVs">VS</span>
          <div class="pairSide" style="justify-content:flex-end">
            <span class="pairTeam">${escapeHtml(it.teamB.name)}</span>
            ${it.teamB.logo ? `<img class="pairLogo" src="${escapeHtml(proxyImg(it.teamB.logo, 64))}" alt="Logo ${escapeHtml(it.teamB.name)}" loading="lazy" width="32" height="32">` : ''}
          </div>
        </div>
        <div class="pairLabel">${escapeHtml(it.label)}</div>
      </a>
    `).join('');

    const faqHtml = hubFaqs.map(f => `
      <div class="faqItem">
        <h3>${escapeHtml(f.question)}</h3>
        <p>${escapeHtml(f.answer)}</p>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="so sánh CLB, đối đầu, head to head, h2h, derby, el clasico, derby manchester, der klassiker">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="vi" href="${url}">
  <link rel="alternate" hreflang="x-default" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>So sánh CLB</span></nav>

    <div class="card">
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:6px">⚔️ So Sánh CLB Bóng Đá</h1>
      <p style="color:#475569">Thống kê đối đầu lịch sử, phong độ hiện tại, lịch sử thành tích — ${items.length} cặp đối thủ kinh điển. Dữ liệu cập nhật từ API-Sports.</p>
    </div>

    <div class="grid">${cardsHtml}</div>

    <div class="card">
      <h2>❓ Câu hỏi thường gặp về so sánh CLB</h2>
      ${faqHtml}
    </div>

    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '⚔️', bio: 'Trang so sánh tổng hợp dữ liệu đối đầu, phong độ và thông tin CLB từ API-Sports — đối chiếu với nguồn chính thức của các liên đoàn.' })}
    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=21600'); // 6h matches data cache
    res.send(html);
  } catch (err) {
    console.error('[compareSsr/hub] error:', err.message);
    res.status(500).set('Content-Type', 'text/html; charset=utf-8')
      .send('<!DOCTYPE html><html><body><h1>500</h1></body></html>');
  }
});

router.get('/so-sanh/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const idx = slug.indexOf('-vs-');
    if (idx <= 0 || idx + 4 >= slug.length) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy cặp so sánh | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/so-sanh">Tất cả cặp so sánh</a></p></body></html>`);
    }
    const slugA = slug.slice(0, idx);
    const slugB = slug.slice(idx + 4);

    const result = await getCompareTeamsData({
      slugA, slugB,
      footballApi: req.app.locals.footballApi,
    });
    if (result.error) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Không tìm thấy cặp so sánh | ScoreLine</title><meta name="robots" content="noindex"></head><body><h1>404</h1><p><a href="/so-sanh">Tất cả cặp so sánh</a></p></body></html>`);
    }

    const { teamA, teamB, h2h, form, generatedAt } = result.data;
    const url = `${SITE_URL}/so-sanh/${teamA.slug}-vs-${teamB.slug}`;
    const updatedDateVi = formatDateVi(generatedAt);
    const teamALogoProxied = teamA.logo ? proxyImg(teamA.logo, 240) : '';
    const teamBLogoProxied = teamB.logo ? proxyImg(teamB.logo, 240) : '';
    const totalGoals = h2h.goalsFor.teamA + h2h.goalsFor.teamB;

    const winLabel = h2h.teamAWins > h2h.teamBWins
      ? `${teamA.name} dẫn ${h2h.teamAWins}-${h2h.teamBWins}`
      : h2h.teamBWins > h2h.teamAWins
        ? `${teamB.name} dẫn ${h2h.teamBWins}-${h2h.teamAWins}`
        : `Hai đội cân bằng ${h2h.teamAWins}-${h2h.teamBWins}`;

    const quickAnswer = h2h.total > 0
      ? `${teamA.name} và ${teamB.name} đã đối đầu ${h2h.total} lần — ${winLabel}, hòa ${h2h.draws}. Tổng số bàn thắng: ${totalGoals} (${teamA.name}: ${h2h.goalsFor.teamA}, ${teamB.name}: ${h2h.goalsFor.teamB}). Phong độ 5 trận gần nhất: ${teamA.name} ${form.teamA.points} điểm, ${teamB.name} ${form.teamB.points} điểm.`
      : `${teamA.name} và ${teamB.name} chưa có dữ liệu đối đầu công khai. Phong độ 5 trận gần nhất: ${teamA.name} ${form.teamA.points} điểm, ${teamB.name} ${form.teamB.points} điểm.`;

    const title = `${teamA.name} vs ${teamB.name} - Đối Đầu, Phong Độ, So Sánh`;
    const description = h2h.total > 0
      ? `${teamA.name} vs ${teamB.name}: ${winLabel} sau ${h2h.total} trận đối đầu. Phong độ, lịch sử và thống kê chi tiết.`
      : `So sánh ${teamA.name} và ${teamB.name}: phong độ 5 trận gần nhất, lịch sử thành tích, thông tin CLB.`;

    const og = pickOgImage(
      { image: teamALogoProxied ? absoluteImg(teamALogoProxied) : teamA.logo },
      { alt: `${teamA.name} vs ${teamB.name}` }
    );

    const { datePublished, dateModified } = getEntityDates({
      publishedAt: '2026-04-28T00:00:00Z',
      updatedAt: generatedAt,
    });

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'So sánh CLB', item: `${SITE_URL}/so-sanh` },
        { '@type': 'ListItem', position: 3, name: `${teamA.name} vs ${teamB.name}`, item: url },
      ],
    };

    const teamASchema = {
      '@context': 'https://schema.org', '@type': 'SportsTeam',
      name: teamA.name,
      url: `${SITE_URL}/doi-bong/${teamA.slug}`,
      ...(teamALogoProxied && { logo: absoluteImg(teamALogoProxied) }),
      ...(teamA.country && { location: { '@type': 'Country', name: teamA.country } }),
      ...(teamA.founded && { foundingDate: String(teamA.founded) }),
    };
    const teamBSchema = {
      '@context': 'https://schema.org', '@type': 'SportsTeam',
      name: teamB.name,
      url: `${SITE_URL}/doi-bong/${teamB.slug}`,
      ...(teamBLogoProxied && { logo: absoluteImg(teamBLogoProxied) }),
      ...(teamB.country && { location: { '@type': 'Country', name: teamB.country } }),
      ...(teamB.founded && { foundingDate: String(teamB.founded) }),
    };

    const faqs = [
      {
        question: `${teamA.name} vs ${teamB.name}: tổng cộng đã đối đầu bao nhiêu lần?`,
        answer: h2h.total > 0
          ? `${teamA.name} và ${teamB.name} đã gặp nhau ${h2h.total} lần. ${teamA.name} thắng ${h2h.teamAWins}, ${teamB.name} thắng ${h2h.teamBWins}, hòa ${h2h.draws}.`
          : `Chưa có dữ liệu đối đầu công khai giữa ${teamA.name} và ${teamB.name}.`,
      },
      {
        question: `Ai thắng nhiều hơn giữa ${teamA.name} và ${teamB.name}?`,
        answer: h2h.total > 0
          ? `${winLabel} sau ${h2h.total} trận. ${teamA.name} ghi ${h2h.goalsFor.teamA} bàn, ${teamB.name} ghi ${h2h.goalsFor.teamB} bàn.`
          : `Hiện chưa có thống kê đối đầu giữa ${teamA.name} và ${teamB.name}.`,
      },
      {
        question: `Phong độ ${teamA.name} 5 trận gần nhất thế nào?`,
        answer: `${teamA.name} có ${form.teamA.points} điểm sau 5 trận (chuỗi ${form.teamA.last5.join('-') || 'chưa có dữ liệu'}), ghi ${form.teamA.scored} bàn và thủng lưới ${form.teamA.conceded} bàn.`,
      },
      {
        question: `Phong độ ${teamB.name} 5 trận gần nhất thế nào?`,
        answer: `${teamB.name} có ${form.teamB.points} điểm sau 5 trận (chuỗi ${form.teamB.last5.join('-') || 'chưa có dữ liệu'}), ghi ${form.teamB.scored} bàn và thủng lưới ${form.teamB.conceded} bàn.`,
      },
      ...(h2h.lastMeetings[0] ? [{
        question: `Trận gần nhất giữa ${teamA.name} và ${teamB.name} có kết quả thế nào?`,
        answer: `Lần gặp gần nhất (${formatDateVi(h2h.lastMeetings[0].date)}): ${h2h.lastMeetings[0].homeName} ${h2h.lastMeetings[0].homeScore}-${h2h.lastMeetings[0].awayScore} ${h2h.lastMeetings[0].awayName}${h2h.lastMeetings[0].league ? ` tại ${h2h.lastMeetings[0].league}` : ''}.`,
      }] : []),
    ];

    const faqSchema = {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    };

    const h2hCardHtml = h2h.total > 0 ? `
      <div class="card">
        <h2>📊 Đối đầu lịch sử</h2>
        <div class="statRow">
          <div class="statA">${h2h.teamAWins}</div>
          <div class="statLabel">Thắng</div>
          <div class="statB">${h2h.teamBWins}</div>
        </div>
        <div class="statRow">
          <div class="statA">${h2h.draws}</div>
          <div class="statLabel">Hòa</div>
          <div class="statB">${h2h.draws}</div>
        </div>
        <div class="statRow">
          <div class="statA">${h2h.goalsFor.teamA}</div>
          <div class="statLabel">Bàn thắng</div>
          <div class="statB">${h2h.goalsFor.teamB}</div>
        </div>
        <div class="statRow">
          <div class="statA">${h2h.total}</div>
          <div class="statLabel">Tổng trận</div>
          <div class="statB">${h2h.total}</div>
        </div>
      </div>
    ` : '';

    const formStrip = (last5) => last5.length > 0
      ? `<div class="formStrip">${last5.map(r => `<div class="formBox ${r}">${r}</div>`).join('')}</div>`
      : `<span style="color:#94a3b8;font-size:13px">Chưa có dữ liệu</span>`;

    const formCardHtml = `
      <div class="card">
        <h2>📈 Phong độ 5 trận gần nhất</h2>
        <div class="statRow">
          <div>${formStrip(form.teamA.last5)}</div>
          <div class="statLabel">Chuỗi 5 trận</div>
          <div>${formStrip(form.teamB.last5)}</div>
        </div>
        <div class="statRow">
          <div class="statA">${form.teamA.points}</div>
          <div class="statLabel">Điểm</div>
          <div class="statB">${form.teamB.points}</div>
        </div>
        <div class="statRow">
          <div class="statA">${form.teamA.scored}</div>
          <div class="statLabel">Ghi bàn</div>
          <div class="statB">${form.teamB.scored}</div>
        </div>
        <div class="statRow">
          <div class="statA">${form.teamA.conceded}</div>
          <div class="statLabel">Thủng lưới</div>
          <div class="statB">${form.teamB.conceded}</div>
        </div>
      </div>
    `;

    const meetingsCardHtml = h2h.lastMeetings.length > 0 ? `
      <div class="card">
        <h2>🕐 10 lần gặp gần nhất</h2>
        <table class="cmp">
          <thead>
            <tr><th>Ngày</th><th>Đội nhà</th><th>Tỷ số</th><th>Đội khách</th><th>Giải</th></tr>
          </thead>
          <tbody>
            ${h2h.lastMeetings.map(m => `
              <tr>
                <td>${formatDateVi(m.date)}</td>
                <td class="left">${m.homeLogo ? `<img class="miniLogo" src="${escapeHtml(proxyImg(m.homeLogo, 32))}" alt="" loading="lazy" width="18" height="18">` : ''}${escapeHtml(m.homeName)}</td>
                <td><strong>${m.homeScore} - ${m.awayScore}</strong></td>
                <td class="left">${m.awayLogo ? `<img class="miniLogo" src="${escapeHtml(proxyImg(m.awayLogo, 32))}" alt="" loading="lazy" width="18" height="18">` : ''}${escapeHtml(m.awayName)}</td>
                <td style="font-size:11px;color:#64748b">${escapeHtml(m.league || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const infoCardHtml = `
      <div class="card">
        <h2>ℹ️ Thông tin CLB</h2>
        <table class="cmp">
          <thead><tr><th>${escapeHtml(teamA.name)}</th><th>Mục</th><th>${escapeHtml(teamB.name)}</th></tr></thead>
          <tbody>
            <tr><td>${escapeHtml(teamA.country || '-')}</td><td>Quốc gia</td><td>${escapeHtml(teamB.country || '-')}</td></tr>
            <tr><td>${teamA.founded || '-'}</td><td>Năm thành lập</td><td>${teamB.founded || '-'}</td></tr>
            <tr><td>${escapeHtml(teamA.venue?.name || '-')}${teamA.venue?.city ? ` (${escapeHtml(teamA.venue.city)})` : ''}</td><td>SVĐ nhà</td><td>${escapeHtml(teamB.venue?.name || '-')}${teamB.venue?.city ? ` (${escapeHtml(teamB.venue.city)})` : ''}</td></tr>
            <tr><td>${teamA.venue?.capacity?.toLocaleString('vi-VN') || '-'}</td><td>Sức chứa</td><td>${teamB.venue?.capacity?.toLocaleString('vi-VN') || '-'}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    const faqCardHtml = `
      <div class="card">
        <h2>❓ Câu hỏi thường gặp</h2>
        ${faqs.map(f => `<div class="faqItem"><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`).join('')}
      </div>
    `;

    const popular = await getPopularComparisons().catch(() => []);
    const related = popular.filter(p => p.slug !== `${teamA.slug}-vs-${teamB.slug}`).slice(0, 6);
    const relatedHtml = related.length > 0 ? `
      <div class="card">
        <h2>⚔️ Các cặp so sánh khác</h2>
        <div class="relatedGrid">
          ${related.map(r => `
            <a class="relatedCard" href="/so-sanh/${escapeHtml(r.slug)}">
              ${r.teamA.logo ? `<img class="relatedLogo" src="${escapeHtml(proxyImg(r.teamA.logo, 48))}" alt="" loading="lazy" width="24" height="24">` : ''}
              <span>${escapeHtml(r.teamA.name)}</span>
              <span class="relatedVs">VS</span>
              <span>${escapeHtml(r.teamB.name)}</span>
              ${r.teamB.logo ? `<img class="relatedLogo" src="${escapeHtml(proxyImg(r.teamB.logo, 48))}" alt="" loading="lazy" width="24" height="24">` : ''}
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    const teamLinksHtml = `
      <div class="card">
        <h2>🔗 Xem chi tiết từng đội</h2>
        <p style="margin-bottom:8px"><a href="/doi-bong/${escapeHtml(teamA.slug)}">Trang ${escapeHtml(teamA.name)} →</a></p>
        <p><a href="/doi-bong/${escapeHtml(teamB.slug)}">Trang ${escapeHtml(teamB.name)} →</a></p>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(teamA.name)} vs ${escapeHtml(teamB.name)}, ${escapeHtml(teamA.name)}, ${escapeHtml(teamB.name)}, h2h, đối đầu, so sánh">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="vi" href="${url}">
  <link rel="alternate" hreflang="x-default" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(teamASchema)}</script>
  <script type="application/ld+json">${JSON.stringify(teamBSchema)}</script>
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <a href="/so-sanh">So sánh CLB</a> &rsaquo; <span>${escapeHtml(teamA.name)} vs ${escapeHtml(teamB.name)}</span></nav>

    <div class="hero">
      <div class="vsRow">
        <div class="side">
          ${teamALogoProxied ? `<img class="logoBig" src="${escapeHtml(teamALogoProxied)}" alt="Logo ${escapeHtml(teamA.name)}" width="80" height="80">` : ''}
          <div class="teamName">${escapeHtml(teamA.name)}</div>
          ${teamA.country ? `<div class="teamCountry">${escapeHtml(teamA.country)}</div>` : ''}
        </div>
        <div class="vsBig">VS</div>
        <div class="side">
          ${teamBLogoProxied ? `<img class="logoBig" src="${escapeHtml(teamBLogoProxied)}" alt="Logo ${escapeHtml(teamB.name)}" width="80" height="80">` : ''}
          <div class="teamName">${escapeHtml(teamB.name)}</div>
          ${teamB.country ? `<div class="teamCountry">${escapeHtml(teamB.country)}</div>` : ''}
        </div>
      </div>
      <h1 class="heroH1">So sánh ${escapeHtml(teamA.name)} vs ${escapeHtml(teamB.name)}</h1>
      ${updatedDateVi ? `<div class="freshness">🕒 Cập nhật ${updatedDateVi}</div>` : ''}
    </div>

    <div class="quickAnswer">${escapeHtml(quickAnswer)}</div>

    ${h2hCardHtml}
    ${formCardHtml}
    ${meetingsCardHtml}
    ${infoCardHtml}
    ${faqCardHtml}
    ${teamLinksHtml}
    ${relatedHtml}

    ${authorByline({ publishedIso: datePublished, modifiedIso: dateModified, icon: '⚔️', bio: `So sánh dữ liệu đối đầu, phong độ và lịch sử ${escapeHtml(teamA.name)} với ${escapeHtml(teamB.name)} — tổng hợp từ API-Sports, đối chiếu với hồ sơ chính thức của các giải đấu.` })}

    <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a></div>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=21600');
    res.send(html);
  } catch (err) {
    console.error('[compareSsr/detail] error:', err.message);
    res.status(500).set('Content-Type', 'text/html; charset=utf-8')
      .send('<!DOCTYPE html><html><body><h1>500</h1></body></html>');
  }
});

module.exports = router;
