function siteHeader() {
  return `
  <header style="background:linear-gradient(135deg,#0a1628,#1a2744);padding:0;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
    <div style="max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 16px;">
      <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;padding:12px 0;flex-shrink:0;">
        <img src="/favicon.svg" alt="ScoreLine" width="32" height="32" style="border-radius:8px;">
        <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Score<span style="color:#00D4FF;">Line</span></span>
      </a>
      <nav style="display:flex;align-items:center;gap:2px;overflow-x:auto;">
        <a href="/world-cup-2026" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">🌍 World Cup 2026</a>
        <a href="/live" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">📺 Live</a>
        <a href="/lich-thi-dau" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">📅 Lịch thi đấu</a>
        <a href="/ket-qua-bong-da" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">✅ KQBĐ</a>
        <a href="/bang-xep-hang" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">📊 Xếp hạng</a>
        <a href="/ty-le-keo" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">📈 Tỷ lệ</a>
        <a href="/nhan-dinh" style="color:#fff;font-size:13px;font-weight:600;padding:10px 12px;text-decoration:none;display:flex;align-items:center;gap:5px;white-space:nowrap;">⚙️ Nhận Định</a>
      </nav>
    </div>
  </header>`;
}

module.exports = siteHeader;
