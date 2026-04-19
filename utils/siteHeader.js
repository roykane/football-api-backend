const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';

function siteHeader() {
  return `
  <header style="background:linear-gradient(135deg,#0a1628,#1a2744);padding:0;margin-bottom:16px;position:sticky;top:0;z-index:100;">
    <div style="max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 16px;">
      <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;padding:12px 0;">
        <img src="/favicon.svg" alt="ScoreLine" width="28" height="28" style="border-radius:6px;">
        <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Score<span style="color:#00D4FF;">Line</span></span>
      </a>
      <nav style="display:flex;gap:4px;flex-wrap:wrap;">
        <a href="/live" style="color:#e2e8f0;font-size:13px;font-weight:600;padding:8px 10px;border-radius:4px;text-decoration:none;">Live</a>
        <a href="/lich-thi-dau" style="color:#e2e8f0;font-size:13px;font-weight:600;padding:8px 10px;border-radius:4px;text-decoration:none;">Lịch đấu</a>
        <a href="/ket-qua-bong-da" style="color:#e2e8f0;font-size:13px;font-weight:600;padding:8px 10px;border-radius:4px;text-decoration:none;">Kết quả</a>
        <a href="/bang-xep-hang" style="color:#e2e8f0;font-size:13px;font-weight:600;padding:8px 10px;border-radius:4px;text-decoration:none;">BXH</a>
        <a href="/nhan-dinh" style="color:#00D4FF;font-size:13px;font-weight:600;padding:8px 10px;border-radius:4px;text-decoration:none;">Nhận Định</a>
        <a href="/world-cup-2026" style="color:#fbbf24;font-size:13px;font-weight:600;padding:8px 10px;border-radius:4px;text-decoration:none;">WC 2026</a>
      </nav>
    </div>
  </header>`;
}

module.exports = siteHeader;
