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
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
    .pairCard{position:relative;background:#fff;border-radius:12px;padding:18px 14px 16px;text-decoration:none;color:#1e293b;border:1px solid #e2e8f0;overflow:hidden;display:block;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .pairCard:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(15,23,42,0.12);border-color:#fbbf24;text-decoration:none}
    .pairCard::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,#fbbf24,#f59e0b);transform:scaleX(0);transform-origin:left;transition:transform .25s ease}
    .pairCard:hover::before{transform:scaleX(1)}
    .pairBadge{display:inline-block;background:linear-gradient(90deg,#fef3c7,#fde68a);color:#92400e;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px}
    .pairVersus{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:12px}
    .pairSide{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
    .pairLogoFrame{width:64px;height:64px;border-radius:50%;background:#f8fafc;display:flex;align-items:center;justify-content:center;border:2px solid #fef3c7;flex-shrink:0}
    .pairLogo{width:48px;height:48px;object-fit:contain}
    .pairTeam{font-size:14px;font-weight:800;color:#0f172a;text-align:center;line-height:1.2;width:100%;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .pairVsBadge{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#0a1628,#1e293b);color:#fbbf24;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fbbf24;flex-shrink:0}
    .pairFooter{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-top:1px dashed #e2e8f0;padding-top:10px;margin-top:6px;font-weight:600}
    .sectionTitle{font-size:13px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:24px 0 10px;display:flex;align-items:center;gap:8px}
    .sectionTitle::before{content:"";width:24px;height:3px;background:linear-gradient(90deg,#fbbf24,transparent);border-radius:2px}
    /* Featured-pair hero banner (El Clasico-style, matches SPA) */
    .featHero{position:relative;background:radial-gradient(circle at 20% 30%,rgba(59,130,246,.18),transparent 60%),radial-gradient(circle at 80% 70%,rgba(251,191,36,.18),transparent 60%),linear-gradient(135deg,#0a1628 0%,#1a2744 100%);border-radius:14px;padding:28px 24px 22px;margin-bottom:14px;border:1px solid rgba(251,191,36,0.3);overflow:hidden}
    .featHeroTop{display:grid;grid-template-columns:120px 1fr 120px;gap:18px;align-items:center;margin-bottom:18px}
    .featHeroLogo{width:120px;height:120px;display:flex;align-items:center;justify-content:center}
    .featHeroLogo img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.4))}
    .featHeroCenter{text-align:center;color:#fff}
    .featHeroH1{font-size:30px;font-weight:900;color:#fbbf24;letter-spacing:1px;line-height:1.05;margin-bottom:8px;text-transform:uppercase}
    .featHeroSub{font-size:13px;color:#cbd5e1;line-height:1.6;max-width:540px;margin:0 auto}
    .featVsRow{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;background:rgba(15,23,42,0.55);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:12px 16px}
    .featPanel{display:flex;align-items:center;justify-content:center;color:#fbbf24;font-weight:900;font-size:22px;letter-spacing:1px;text-transform:uppercase;text-align:center;line-height:1.1;border-radius:6px;padding:10px}
    .featPanelL{background:linear-gradient(90deg,rgba(15,23,42,0.6),rgba(30,58,138,0.4))}
    .featPanelR{background:linear-gradient(90deg,rgba(220,38,38,0.4),rgba(15,23,42,0.6))}
    .featVsBadge{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0f172a;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;letter-spacing:1px;flex-shrink:0;border:3px solid #0f172a}
    @media(max-width:768px){
      .featHeroTop{grid-template-columns:60px 1fr 60px;gap:10px}
      .featHeroLogo{width:60px;height:60px}
      .featHeroH1{font-size:18px;letter-spacing:.5px}
      .featHeroSub{font-size:11px}
      .featPanel{font-size:14px;padding:8px}
      .featVsBadge{width:38px;height:38px;font-size:12px}
    }
    /* 3-info-card row */
    .featCardsRow{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
    .featCard{background:linear-gradient(180deg,#0f172a,#1e293b);color:#e2e8f0;border-radius:10px;padding:18px;border:1px solid rgba(251,191,36,0.25);min-height:280px}
    .featCardTitle{font-size:13px;font-weight:800;color:#fbbf24;text-align:center;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(251,191,36,0.25)}
    .featTwoCol{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .featTeamHead{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(251,191,36,0.2)}
    .featTeamHead img{width:28px;height:28px;object-fit:contain;flex-shrink:0}
    .featTeamHead .name{font-size:13px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase}
    .featFacts{display:flex;flex-direction:column;gap:8px;font-size:12px;list-style:none;padding:0;margin:0}
    .featFacts li{list-style:none}
    .featFactLabel{color:#94a3b8;font-size:11px;display:block;margin-bottom:2px}
    .featFactVal{color:#fff;font-weight:700;font-size:13px}
    .featH2H{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-bottom:14px}
    .featH2HNum{font-size:34px;font-weight:900;line-height:1}
    .featH2HNum.win{color:#3b82f6}.featH2HNum.draw{color:#fbbf24}.featH2HNum.loss{color:#ef4444}
    .featH2HLabel{font-size:11px;color:#cbd5e1;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;font-weight:700}
    .featH2HTotal{text-align:center;font-size:13px;color:#cbd5e1;margin:8px 0 16px}
    .featH2HTotal strong{color:#fff;font-size:16px;font-weight:900;margin-left:4px}
    .featLastLabel{font-size:11px;font-weight:800;color:#fbbf24;text-align:center;letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase}
    .featLastMeeting{display:grid;grid-template-columns:auto 1fr auto 1fr auto;gap:10px;align-items:center;background:rgba(15,23,42,0.5);border-radius:6px;padding:10px 8px;font-size:12px;color:#fff;line-height:1.25}
    .featLastMeeting img{width:22px;height:22px;object-fit:contain}
    .featLastMeeting .name{font-weight:700;word-break:break-word}
    .featLastMeeting .score{background:#fbbf24;color:#0f172a;padding:3px 8px;border-radius:4px;font-weight:800;font-family:monospace;font-size:13px}
    .featCta{display:block;text-align:center;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;padding:10px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:.5px;margin-top:14px;text-transform:uppercase;border:1px solid rgba(255,255,255,0.15)}
    .featCta:hover{filter:brightness(1.1)}
    .featFormCols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .featFormHead{display:flex;align-items:center;gap:8px;justify-content:center;text-align:center;font-size:12px;font-weight:800;color:#fbbf24;letter-spacing:.3px;margin-bottom:12px;text-transform:uppercase;line-height:1.2}
    .featFormHead img{width:24px;height:24px;object-fit:contain;flex-shrink:0}
    .featFormHead span{word-break:break-word}
    .featFormStrip{display:flex;gap:6px;justify-content:center;margin-bottom:14px;flex-wrap:wrap}
    .featFormBadge{width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.25)}
    .featFormBadge.W{background:#16a34a}.featFormBadge.L{background:#dc2626}.featFormBadge.D{background:#f59e0b}
    .featFormStats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center}
    .featFormStat{background:rgba(15,23,42,0.5);border-radius:6px;padding:8px 4px}
    .featFormStat .num{display:block;font-size:18px;font-weight:900;color:#fff;line-height:1}
    .featFormStat .lbl{display:block;font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;font-weight:700}
    @media(max-width:1024px){.featCardsRow{grid-template-columns:1fr}}
    /* Bottom pair selector */
    .selectorWrap{background:linear-gradient(180deg,#0f172a,#1e293b);border-radius:10px;padding:18px 16px;border:1px solid rgba(251,191,36,0.25);margin-bottom:14px}
    .selectorTitle{font-size:13px;font-weight:800;color:#fbbf24;text-align:center;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px}
    .selectorGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
    .pairChip{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;padding:12px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(251,191,36,0.2);border-radius:8px;text-decoration:none;color:#e2e8f0;transition:all .2s}
    .pairChip:hover{background:rgba(251,191,36,0.1);border-color:#fbbf24;color:#fff;text-decoration:none}
    .pairChip::after{content:"VS";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(251,191,36,0.95);color:#0f172a;font-size:9px;font-weight:900;padding:2px 5px;border-radius:3px;letter-spacing:.5px;line-height:1;pointer-events:none}
    .pairChip.active{background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.15));border-color:#fbbf24;color:#fff;box-shadow:0 0 0 2px rgba(251,191,36,0.3)}
    .chipSide{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0}
    .chipLogo{width:30px;height:30px;object-fit:contain;flex-shrink:0}
    .chipTeam{font-size:11px;font-weight:700;color:#e2e8f0;line-height:1.25;word-break:break-word;hyphens:auto}
    .heroEnh{position:relative;background:linear-gradient(135deg,#0a1628 0%,#1a2744 50%,#0f172a 100%);color:#fff;padding:32px 28px;border-radius:14px;margin-bottom:20px;overflow:hidden;border:1px solid rgba(251,191,36,0.35)}
    .heroEnh::before{content:"";position:absolute;top:-30%;right:-10%;width:280px;height:280px;background:radial-gradient(circle,rgba(251,191,36,0.18) 0%,transparent 70%);pointer-events:none}
    .heroEnh::after{content:"";position:absolute;bottom:-30%;left:-5%;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%);pointer-events:none}
    .heroInner{position:relative;z-index:1}
    .heroH1{font-size:32px;font-weight:900;color:#fbbf24;margin-bottom:8px;letter-spacing:-0.5px}
    .heroP{font-size:15px;color:#cbd5e1;line-height:1.7;margin-bottom:18px;max-width:700px}
    .heroStats{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#94a3b8}
    .heroStats div strong{color:#fbbf24;font-weight:800;font-size:18px;display:block;line-height:1}
    .heroStats div span{display:block;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;font-size:11px}
    @media(max-width:768px){.heroEnh{padding:22px 18px}.heroH1{font-size:24px}}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    @media(max-width:1024px){.layout{grid-template-columns:1fr}}
    @media(max-width:640px){
      .logoBig{width:56px;height:56px}.teamName{font-size:14px}.vsBig{font-size:22px}
      h1.heroH1{font-size:18px}
    }
  `;
}

router.get('/so-sanh', async (req, res) => {
  try {
    const items = await getPopularComparisons();

    // Pre-fetch the featured pair (El Clasico → fall back to first item).
    // Bots get a fully populated hero with hard data they can index;
    // browsers immediately see SSR markup + then hydrate React.
    const featured = items.find(p => p.slug === 'real-madrid-vs-barcelona') || items[0] || null;
    let featuredData = null;
    if (featured) {
      const r = await getCompareTeamsData({
        slugA: featured.slugA, slugB: featured.slugB,
        footballApi: req.app.locals.footballApi,
      });
      if (!r.error) featuredData = r.data;
    }

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

    const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('vi-VN') : '';

    // Featured-pair hero + 3 info cards (rendered if data resolved)
    const featuredHtml = (featured && featuredData) ? (() => {
      const A = featuredData.teamA;
      const B = featuredData.teamB;
      const h2h = featuredData.h2h;
      const form = featuredData.form;
      const last = h2h?.lastMeetings?.[0];

      const factsCol = (t) => `
        <div>
          <div class="featTeamHead">
            ${t.logo ? `<img src="${escapeHtml(proxyImg(t.logo, 56))}" alt="">` : ''}
            <div class="name">${escapeHtml(t.name)}</div>
          </div>
          <ul class="featFacts">
            ${t.founded ? `<li><span class="featFactLabel">📅 Năm thành lập</span><span class="featFactVal">${t.founded}</span></li>` : ''}
            ${t.venue?.name ? `<li><span class="featFactLabel">🏟️ Sân nhà</span><span class="featFactVal">${escapeHtml(t.venue.name)}</span></li>` : ''}
            ${t.venue?.capacity ? `<li><span class="featFactLabel">👥 Sức chứa</span><span class="featFactVal">${t.venue.capacity.toLocaleString('vi-VN')}</span></li>` : ''}
            ${t.country ? `<li><span class="featFactLabel">🌍 Quốc gia</span><span class="featFactVal">${escapeHtml(t.country)}</span></li>` : ''}
          </ul>
        </div>
      `;

      const formCol = (t, teamForm) => `
        <div>
          <div class="featFormHead">
            ${t.logo ? `<img src="${escapeHtml(proxyImg(t.logo, 56))}" alt="">` : ''}
            <span>${escapeHtml(t.name)}</span>
          </div>
          ${teamForm?.last5?.length ? `
            <div class="featFormStrip">
              ${teamForm.last5.slice(0, 5).map(r => `
                <div class="featFormBadge ${r}">${r === 'W' ? 'T' : r === 'L' ? 'B' : 'H'}</div>
              `).join('')}
            </div>
            <div class="featFormStats">
              <div class="featFormStat"><span class="num">${teamForm.points}</span><span class="lbl">Điểm</span></div>
              <div class="featFormStat"><span class="num">${teamForm.scored}</span><span class="lbl">Ghi bàn</span></div>
              <div class="featFormStat"><span class="num">${teamForm.conceded}</span><span class="lbl">Thủng lưới</span></div>
            </div>
          ` : '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px 0">Chưa có dữ liệu</div>'}
        </div>
      `;

      return `
        <div class="featHero">
          <div class="featHeroTop">
            <div class="featHeroLogo">${A.logo ? `<img src="${escapeHtml(proxyImg(A.logo, 240))}" alt="Logo ${escapeHtml(A.name)}">` : ''}</div>
            <div class="featHeroCenter">
              <h1 class="featHeroH1">⚔️ So Sánh CLB Bóng Đá</h1>
              <p class="featHeroSub">Đối đầu lịch sử, phong độ 5 trận gần nhất, thông tin CLB — chọn cặp dưới để xem chi tiết đầy đủ thống kê, lịch sử cuộc chiến và các lần gặp gần nhất.</p>
            </div>
            <div class="featHeroLogo">${B.logo ? `<img src="${escapeHtml(proxyImg(B.logo, 240))}" alt="Logo ${escapeHtml(B.name)}">` : ''}</div>
          </div>
          <div class="featVsRow">
            <div class="featPanel featPanelL">${escapeHtml(A.name)}</div>
            <div class="featVsBadge">VS</div>
            <div class="featPanel featPanelR">${escapeHtml(B.name)}</div>
          </div>
        </div>

        <div class="featCardsRow">
          <div class="featCard">
            <div class="featCardTitle">Thông tin CLB</div>
            <div class="featTwoCol">${factsCol(A)}${factsCol(B)}</div>
          </div>
          <div class="featCard">
            <div class="featCardTitle">Phong độ 5 trận gần nhất</div>
            <div class="featFormCols">
              ${formCol(A, form?.teamA)}
              ${formCol(B, form?.teamB)}
            </div>
          </div>
          <div class="featCard">
            <div class="featCardTitle">Thống kê đối đầu</div>
            ${h2h && h2h.total > 0 ? `
              <div class="featH2H">
                <div><div class="featH2HNum win">${h2h.teamAWins}</div><div class="featH2HLabel">Thắng</div></div>
                <div><div class="featH2HNum draw">${h2h.draws}</div><div class="featH2HLabel">Hòa</div></div>
                <div><div class="featH2HNum loss">${h2h.teamBWins}</div><div class="featH2HLabel">Thắng</div></div>
              </div>
              <div class="featH2HTotal">Tổng số trận:<strong>${h2h.total}</strong></div>
              ${last ? `
                <div class="featLastLabel">Trận gần nhất</div>
                <div class="featLastMeeting">
                  ${last.homeLogo ? `<img src="${escapeHtml(proxyImg(last.homeLogo, 48))}" alt="">` : ''}
                  <span class="name">${escapeHtml(last.homeName)}</span>
                  <span class="score">${last.homeScore} - ${last.awayScore}</span>
                  <span class="name" style="text-align:right">${escapeHtml(last.awayName)}</span>
                  ${last.awayLogo ? `<img src="${escapeHtml(proxyImg(last.awayLogo, 48))}" alt="">` : ''}
                </div>
                <div style="font-size:10px;color:#94a3b8;text-align:center;margin-top:6px">${formatDate(last.date)}${last.league ? ` · ${escapeHtml(last.league)}` : ''}</div>
              ` : ''}
            ` : '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:24px 0">Chưa có dữ liệu đối đầu</div>'}
            <a href="/so-sanh/${escapeHtml(featured.slug)}" class="featCta">Xem chi tiết lịch sử đối đầu →</a>
          </div>
        </div>
      `;
    })() : '';

    // Bottom pair selector (chips, link to detail page for bot crawlability)
    const selectorHtml = items.length > 0 ? `
      <div class="selectorWrap">
        <div class="selectorTitle">⚡ Chọn cặp để so sánh</div>
        <div class="selectorGrid">
          ${items.map(p => `
            <a href="/so-sanh/${escapeHtml(p.slug)}" class="pairChip${featured && p.slug === featured.slug ? ' active' : ''}">
              <div class="chipSide">
                ${p.teamA.logo ? `<img class="chipLogo" src="${escapeHtml(proxyImg(p.teamA.logo, 60))}" alt="" loading="lazy">` : ''}
                <span class="chipTeam">${escapeHtml(p.teamA.name)}</span>
              </div>
              <div class="chipSide">
                ${p.teamB.logo ? `<img class="chipLogo" src="${escapeHtml(proxyImg(p.teamB.logo, 60))}" alt="" loading="lazy">` : ''}
                <span class="chipTeam">${escapeHtml(p.teamB.name)}</span>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    ` : '';

    const teamsCount = new Set(items.flatMap(it => [it.teamA.slug, it.teamB.slug])).size;
    const countriesCount = new Set(items.flatMap(it => [it.teamA.country, it.teamB.country].filter(Boolean))).size;

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

    ${featuredHtml || `
      <div class="heroEnh">
        <div class="heroInner">
          <h1 class="heroH1">⚔️ So Sánh CLB Bóng Đá</h1>
          <p class="heroP">Đối đầu lịch sử, phong độ 5 trận gần nhất, thông tin CLB — chọn cặp dưới để xem chi tiết đầy đủ thống kê, lịch sử cuộc chiến và các lần gặp gần nhất.</p>
          ${items.length > 0 ? `
            <div class="heroStats">
              <div><strong>${items.length}</strong><span>Cặp đối đầu</span></div>
              <div><strong>${teamsCount}</strong><span>CLB</span></div>
              <div><strong>${countriesCount}</strong><span>Quốc gia</span></div>
              <div><strong>6h</strong><span>Tần suất cập nhật</span></div>
            </div>
          ` : ''}
        </div>
      </div>
    `}

    ${selectorHtml}

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
