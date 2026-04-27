/**
 * Static-content SSR — full HTML for evergreen pages that previously
 * served only an empty SPA shell to crawlers.
 *
 * Covers:
 *   GET /privacy   — privacy policy (E-E-A-T trust signal)
 *   GET /terms     — terms of service
 *   GET /help      — help / FAQ
 *   GET /ty-le-keo — odds page hub (no longer in robots disallow list,
 *                    needs real content body to rank)
 *
 * Browsers fall through to the SPA via nginx; bots get this HTML.
 */

const express = require('express');
const router = express.Router();
const siteHeader = require('../utils/siteHeader');
const MatchCache = require('../models/MatchCache');
const { LEAGUES } = require('../utils/leagueSlugs');
const { buildMatchSlug } = require('../utils/matchSlug');
const { getEntityDates, pickOgImage, ogImageMeta, authorByline, SITE_URL } = require('../utils/seoCommon');

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseStyles() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;color:#1e293b;background:#f1f5f9}
    a{color:#0066FF;text-decoration:none}a:hover{text-decoration:underline}
    .container{max-width:960px;margin:0 auto;padding:16px}
    .breadcrumb{font-size:13px;color:#64748b;margin-bottom:12px}.breadcrumb a{color:#0f172a}
    .hero{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:24px 20px;border-radius:8px;margin-bottom:16px}
    .hero h1{font-size:26px;font-weight:800;margin-bottom:6px}
    .hero .meta{font-size:14px;color:#cbd5e1}
    .card{background:#fff;border-radius:8px;padding:28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
    .card h2{font-size:20px;font-weight:800;color:#0f172a;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid #eff6ff}
    .card h2:first-child{margin-top:0}
    .card h3{font-size:16px;font-weight:700;color:#0f172a;margin:18px 0 8px}
    .card p{margin-bottom:12px;color:#334155;font-size:15px;line-height:1.75}
    .card strong{color:#0f172a}
    .card ul{margin:8px 0 14px;padding-left:24px}.card li{margin-bottom:8px;color:#334155;font-size:15px;line-height:1.7}
    .card ol{margin:8px 0 14px;padding-left:24px}.card ol li{margin-bottom:8px;color:#334155;font-size:15px;line-height:1.7}
    .toc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:16px}
    .toc-title{font-size:14px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
    .toc a{display:block;padding:4px 0;font-size:14px}
    .footer{text-align:center;margin-top:24px;padding:16px;color:#94a3b8;font-size:13px}
    .faq-item{padding:14px 0;border-bottom:1px solid #f1f5f9}
    .faq-item:last-child{border-bottom:none}
    .faq-q{font-weight:700;color:#0f172a;font-size:16px;margin-bottom:6px}
    .faq-a{color:#475569;font-size:15px;line-height:1.7}
    @media(max-width:768px){.card{padding:18px}}
  `;
}

function shellHtml({ title, description, canonical, jsonLd, body, contentDates }) {
  const og = pickOgImage({}, { alt: title });
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ScoreLine</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  ${jsonLd.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n  ')}
  <style>${baseStyles()}</style>
</head>
<body>
  ${siteHeader()}
  ${body}
  <div class="container">${authorByline({ publishedIso: contentDates.datePublished, modifiedIso: contentDates.dateModified, icon: '📝' })}</div>
  <div class="footer"><a href="${SITE_URL}">ScoreLine.io</a> - Tỷ số trực tiếp, nhận định và thông tin bóng đá</div>
</body>
</html>`;
}

function breadcrumbSchema(crumbs) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name, item: c.url,
    })),
  };
}

// ===== /privacy =====
router.get('/privacy', (req, res) => {
  const url = `${SITE_URL}/privacy`;
  const dates = getEntityDates({ publishedAt: '2025-01-15T00:00:00Z' });

  const body = `
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Chính sách bảo mật</span></nav>
    <div class="hero">
      <h1>🛡️ Chính Sách Bảo Mật</h1>
      <div class="meta">Cam kết của ScoreLine về cách thu thập, sử dụng và bảo vệ thông tin người dùng.</div>
    </div>
    <div class="card">
      <p>ScoreLine.io tôn trọng quyền riêng tư của bạn. Tài liệu này mô tả cách chúng tôi xử lý dữ liệu khi bạn truy cập website, bao gồm thông tin được thu thập, mục đích sử dụng, đối tác chia sẻ, và quyền của bạn theo luật bảo vệ dữ liệu cá nhân Việt Nam (Nghị định 13/2023/NĐ-CP) và GDPR.</p>

      <div class="toc">
        <div class="toc-title">📋 Nội dung chính</div>
        <a href="#thu-thap">1. Thông tin chúng tôi thu thập</a>
        <a href="#muc-dich">2. Mục đích sử dụng dữ liệu</a>
        <a href="#cookie">3. Cookie và công nghệ tracking</a>
        <a href="#chia-se">4. Chia sẻ với bên thứ ba</a>
        <a href="#bao-mat">5. Biện pháp bảo mật</a>
        <a href="#quyen">6. Quyền của người dùng</a>
        <a href="#gdpr">7. Tuân thủ GDPR</a>
        <a href="#tre-em">8. Quyền riêng tư của trẻ em</a>
        <a href="#thay-doi">9. Thay đổi chính sách</a>
        <a href="#lien-he">10. Liên hệ</a>
      </div>

      <h2 id="thu-thap">1. Thông tin chúng tôi thu thập</h2>
      <p>ScoreLine thu thập tối thiểu thông tin cần thiết để vận hành dịch vụ:</p>
      <ul>
        <li><strong>Dữ liệu kỹ thuật tự động:</strong> địa chỉ IP, loại trình duyệt, hệ điều hành, độ phân giải màn hình, ngôn ngữ. Dữ liệu này được sử dụng để phân tích lưu lượng và phát hiện hành vi bất thường.</li>
        <li><strong>Lịch sử truy cập:</strong> các trang bạn xem, thời gian ở lại, đường dẫn referrer. Mục đích: cải thiện cấu trúc website.</li>
        <li><strong>Thông tin chia sẻ tự nguyện:</strong> nếu bạn liên hệ qua email, chúng tôi chỉ lưu địa chỉ email và nội dung tin nhắn để phản hồi.</li>
        <li><strong>Thiết bị:</strong> User Agent string, model điện thoại (nếu có) — phục vụ tối ưu hiển thị responsive.</li>
      </ul>
      <p><strong>ScoreLine không yêu cầu đăng ký tài khoản, không thu thập tên thật, số điện thoại, ngày sinh, địa chỉ nhà hoặc thông tin tài chính.</strong></p>

      <h2 id="muc-dich">2. Mục đích sử dụng dữ liệu</h2>
      <ul>
        <li>Vận hành website: hiển thị nội dung phù hợp với ngôn ngữ và vùng địa lý.</li>
        <li>Phân tích thống kê: hiểu trang nào được xem nhiều để đầu tư nội dung tốt hơn.</li>
        <li>Bảo mật: phát hiện và ngăn chặn tấn công DDoS, spam, scraping bất hợp pháp.</li>
        <li>Tuân thủ pháp luật: phối hợp với cơ quan chức năng khi có yêu cầu hợp lệ.</li>
      </ul>

      <h2 id="cookie">3. Cookie và công nghệ tracking</h2>
      <p>Website sử dụng cookie để lưu tùy chọn ngôn ngữ và phiên đăng nhập admin (nếu áp dụng). ScoreLine <strong>không sử dụng cookie quảng cáo từ bên thứ ba</strong> (đã gỡ Google AdSense và các mạng quảng cáo cá nhân hóa). Bạn có thể tắt cookie trong cài đặt trình duyệt mà không ảnh hưởng đến phần lớn tính năng đọc nội dung.</p>

      <h2 id="chia-se">4. Chia sẻ với bên thứ ba</h2>
      <p>ScoreLine <strong>không bán, không cho thuê, không trao đổi</strong> dữ liệu người dùng. Chúng tôi chỉ chia sẻ trong các trường hợp giới hạn:</p>
      <ul>
        <li><strong>Nhà cung cấp hạ tầng:</strong> Cloudflare (CDN, DNS, DDoS protection), VPS hosting tại Việt Nam — họ chỉ tiếp xúc với dữ liệu kỹ thuật tự động (IP, request log).</li>
        <li><strong>API dữ liệu bóng đá:</strong> API-Sports cung cấp tỷ số, lineup, lịch trận. Chúng tôi không gửi dữ liệu người dùng cho họ.</li>
        <li><strong>Yêu cầu pháp lý:</strong> nếu cơ quan có thẩm quyền yêu cầu hợp lệ bằng văn bản.</li>
      </ul>

      <h2 id="bao-mat">5. Biện pháp bảo mật</h2>
      <ul>
        <li>Toàn bộ traffic được mã hóa TLS 1.3 (HTTPS).</li>
        <li>Hệ thống admin sử dụng xác thực JWT + rate limit + IP allowlist.</li>
        <li>Database backup tự động hàng ngày, lưu offline 30 ngày.</li>
        <li>Không lưu mật khẩu dạng plain text — sử dụng bcrypt hash.</li>
        <li>Phát hiện scraping bằng rate limiter ở tầng nginx và Express.</li>
      </ul>

      <h2 id="quyen">6. Quyền của người dùng</h2>
      <p>Theo Nghị định 13/2023/NĐ-CP và GDPR, bạn có các quyền:</p>
      <ul>
        <li><strong>Quyền truy cập:</strong> yêu cầu biết dữ liệu nào của bạn đang được lưu.</li>
        <li><strong>Quyền chỉnh sửa:</strong> yêu cầu sửa dữ liệu sai lệch.</li>
        <li><strong>Quyền xóa:</strong> yêu cầu xóa dữ liệu cá nhân (right to be forgotten).</li>
        <li><strong>Quyền phản đối:</strong> dừng việc xử lý dữ liệu cho mục đích cụ thể.</li>
        <li><strong>Quyền khiếu nại:</strong> nộp khiếu nại lên cơ quan bảo vệ dữ liệu nếu cho rằng quyền của bạn bị xâm phạm.</li>
      </ul>
      <p>Để thực hiện các quyền trên, gửi email tới <a href="mailto:scoreline24h@gmail.com">scoreline24h@gmail.com</a> với tiêu đề "[GDPR] Yêu cầu quyền dữ liệu". Chúng tôi phản hồi trong 30 ngày.</p>

      <h2 id="gdpr">7. Tuân thủ GDPR (cho người dùng EU)</h2>
      <p>Người dùng truy cập từ EU được áp dụng đầy đủ Quy định Bảo vệ Dữ liệu Chung của Liên minh Châu Âu (GDPR). ScoreLine xử lý dữ liệu theo nguyên tắc tối thiểu, có cơ sở pháp lý rõ ràng (lợi ích chính đáng — vận hành dịch vụ thông tin công cộng), và tôn trọng đầy đủ các quyền liệt kê ở mục 6.</p>

      <h2 id="tre-em">8. Quyền riêng tư của trẻ em</h2>
      <p>ScoreLine không hướng dịch vụ đến trẻ em dưới 13 tuổi. Chúng tôi không cố ý thu thập dữ liệu của trẻ em. Nếu phụ huynh phát hiện con em mình đã cung cấp thông tin, vui lòng liên hệ để chúng tôi xóa dữ liệu đó.</p>

      <h2 id="thay-doi">9. Thay đổi chính sách</h2>
      <p>ScoreLine có thể cập nhật chính sách này khi có thay đổi về luật pháp hoặc cách thức vận hành. Phiên bản mới luôn được công bố tại trang này, kèm ngày cập nhật. Khi có thay đổi quan trọng, chúng tôi thông báo trên trang chủ tối thiểu 7 ngày trước khi áp dụng.</p>

      <h2 id="lien-he">10. Liên hệ</h2>
      <p>Mọi câu hỏi về quyền riêng tư xin gửi đến:</p>
      <ul>
        <li>Email: <a href="mailto:scoreline24h@gmail.com">scoreline24h@gmail.com</a></li>
        <li>Trang giới thiệu: <a href="/about">/about</a></li>
        <li>Điều khoản sử dụng: <a href="/terms">/terms</a></li>
      </ul>
    </div>
  </div>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(shellHtml({
    title: 'Chính Sách Bảo Mật',
    description: 'Chính sách bảo mật ScoreLine.io: cam kết minh bạch về thu thập, sử dụng dữ liệu, cookie, GDPR và quyền của người dùng theo luật Việt Nam.',
    canonical: url,
    jsonLd: [breadcrumbSchema([
      { name: 'Trang chủ', url: SITE_URL },
      { name: 'Chính sách bảo mật', url },
    ])],
    body, contentDates: dates,
  }));
});

// ===== /terms =====
router.get('/terms', (req, res) => {
  const url = `${SITE_URL}/terms`;
  const dates = getEntityDates({ publishedAt: '2025-01-15T00:00:00Z' });

  const body = `
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Điều khoản sử dụng</span></nav>
    <div class="hero">
      <h1>📜 Điều Khoản Sử Dụng</h1>
      <div class="meta">Quy tắc sử dụng dịch vụ ScoreLine.io. Bằng việc truy cập website, bạn đồng ý với các điều khoản dưới đây.</div>
    </div>
    <div class="card">
      <h2>1. Phạm vi áp dụng</h2>
      <p>Tài liệu này áp dụng cho mọi người truy cập <strong>scoreline.io</strong> và các tên miền phụ. Bằng việc tiếp tục sử dụng website, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ các điều khoản này.</p>

      <h2>2. Mục đích cung cấp dịch vụ</h2>
      <p>ScoreLine cung cấp <strong>thông tin tham khảo</strong> về bóng đá: tỷ số trực tiếp, lịch thi đấu, kết quả, bảng xếp hạng, tiểu sử cầu thủ, huấn luyện viên, phân tích trận đấu. Mọi nội dung trên website mang tính chất <strong>tổng hợp và phân tích thông tin công khai</strong>, không phải lời khuyên đầu tư hay cá cược.</p>

      <h2>3. Tính chính xác của dữ liệu</h2>
      <p>Chúng tôi nỗ lực tối đa để cung cấp thông tin chính xác từ các nguồn uy tín (FIFA, AFC, VFF, các Liên đoàn quốc gia, API-Sports). Tuy nhiên, ScoreLine <strong>không bảo đảm 100% tính chính xác hoặc cập nhật real-time</strong> trong mọi tình huống. Người dùng cần đối chiếu với nguồn chính thức trước khi sử dụng cho mục đích quan trọng.</p>

      <h2>4. Quyền sở hữu trí tuệ</h2>
      <ul>
        <li>Toàn bộ nội dung do ScoreLine biên tập (bài phân tích, infographic, mô tả) thuộc bản quyền ScoreLine.</li>
        <li>Logo CLB, ảnh cầu thủ thuộc về chủ sở hữu hợp pháp tương ứng — ScoreLine sử dụng theo nguyên tắc fair use cho mục đích thông tin báo chí.</li>
        <li>Số liệu thống kê công khai (tỷ số, BXH) không thuộc bản quyền độc quyền.</li>
        <li>Bạn có thể trích dẫn nội dung ScoreLine với điều kiện ghi nguồn rõ ràng và link về bài viết gốc.</li>
      </ul>

      <h2>5. Hành vi bị cấm</h2>
      <p>Khi sử dụng website, bạn cam kết KHÔNG:</p>
      <ul>
        <li>Sao chép toàn bộ nội dung để xuất bản trên website khác mà không xin phép.</li>
        <li>Tự động hóa scraping với tần suất cao gây ảnh hưởng vận hành.</li>
        <li>Cố tình tấn công bảo mật (SQL injection, XSS, brute force…).</li>
        <li>Đăng tải, lan truyền nội dung vi phạm pháp luật Việt Nam thông qua các kênh liên lạc với chúng tôi.</li>
        <li>Sử dụng thông tin trên website để tiếp tay cho các hoạt động cá cược trái phép.</li>
      </ul>

      <h2>6. Liên kết ngoài</h2>
      <p>ScoreLine có thể chứa liên kết đến website bên thứ ba (Wikipedia, trang web Liên đoàn bóng đá, nguồn tin tức). Chúng tôi <strong>không chịu trách nhiệm</strong> về nội dung, chính sách bảo mật, hoặc tính chính xác của các website đó. Bạn truy cập với rủi ro tự chịu.</p>

      <h2>7. Giới hạn trách nhiệm</h2>
      <p>Trong phạm vi cho phép của luật pháp, ScoreLine không chịu trách nhiệm về:</p>
      <ul>
        <li>Quyết định cá cược, đầu tư hoặc tài chính của bạn dựa trên thông tin từ website.</li>
        <li>Thiệt hại gián tiếp do tỷ số, lịch thi đấu hiển thị sai sót.</li>
        <li>Sự cố ngừng hoạt động tạm thời của website do bảo trì hoặc sự cố hạ tầng.</li>
      </ul>

      <h2>8. Thay đổi điều khoản</h2>
      <p>ScoreLine có quyền cập nhật điều khoản bất kỳ lúc nào. Phiên bản mới có hiệu lực ngay khi đăng tải. Người dùng nên kiểm tra trang này định kỳ. Việc tiếp tục sử dụng website sau khi điều khoản thay đổi đồng nghĩa với việc bạn chấp nhận điều khoản mới.</p>

      <h2>9. Luật áp dụng</h2>
      <p>Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh chấp phát sinh sẽ được giải quyết tại tòa án có thẩm quyền tại Hà Nội, trừ khi luật nơi cư trú của người dùng yêu cầu khác.</p>

      <h2>10. Liên hệ</h2>
      <p>Câu hỏi về điều khoản: <a href="mailto:scoreline24h@gmail.com">scoreline24h@gmail.com</a> · <a href="/about">Giới thiệu</a> · <a href="/privacy">Chính sách bảo mật</a></p>
    </div>
  </div>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(shellHtml({
    title: 'Điều Khoản Sử Dụng',
    description: 'Điều khoản sử dụng ScoreLine.io: phạm vi dịch vụ, quyền sở hữu trí tuệ, hành vi bị cấm, giới hạn trách nhiệm và quy định pháp lý.',
    canonical: url,
    jsonLd: [breadcrumbSchema([
      { name: 'Trang chủ', url: SITE_URL },
      { name: 'Điều khoản sử dụng', url },
    ])],
    body, contentDates: dates,
  }));
});

// ===== /help =====
router.get('/help', (req, res) => {
  const url = `${SITE_URL}/help`;
  const dates = getEntityDates({ publishedAt: '2025-01-15T00:00:00Z' });

  const faqs = [
    { q: 'ScoreLine có miễn phí không?',
      a: 'Có. Toàn bộ nội dung trên ScoreLine.io miễn phí, không yêu cầu đăng ký, không có gói trả phí.' },
    { q: 'Tỷ số trực tiếp có chính xác không?',
      a: 'ScoreLine đồng bộ dữ liệu từ API-Sports — nguồn được sử dụng bởi nhiều ứng dụng thể thao chính thống. Độ trễ thông thường dưới 30 giây so với thực tế. Tuy nhiên, để tra cứu kết quả chính thức, vui lòng đối chiếu với trang web Liên đoàn bóng đá tổ chức.' },
    { q: 'Tại sao trận đấu của tôi không hiện trong lịch thi đấu?',
      a: 'Chúng tôi cập nhật lịch các giải đấu lớn (Top 5 châu Âu, Champions League, World Cup, V.League). Các giải hạng dưới hoặc giải khu vực có thể chưa được phủ.' },
    { q: 'Bài nhận định trên ScoreLine có chính xác không?',
      a: 'Bài nhận định là phân tích dựa trên thống kê phong độ, đối đầu lịch sử, lineup dự kiến. Đây không phải lời khuyên cá cược. Mọi quyết định cá cược thuộc trách nhiệm của bạn.' },
    { q: 'Tôi có thể trích dẫn bài viết của ScoreLine không?',
      a: 'Có, miễn là bạn ghi nguồn rõ ràng và link về bài viết gốc. Cấm sao chép toàn bộ nội dung mà không xin phép.' },
    { q: 'Làm sao báo lỗi sai về tỷ số / thông tin?',
      a: 'Gửi email tới scoreline24h@gmail.com kèm URL trang lỗi và mô tả ngắn gọn. Chúng tôi xử lý trong 24-48h.' },
    { q: 'Tôi muốn gỡ ảnh / thông tin cá nhân của tôi khỏi website?',
      a: 'Gửi email tới scoreline24h@gmail.com với chứng minh nhân thân. Chúng tôi xử lý theo quy định của Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.' },
    { q: 'ScoreLine có ứng dụng di động không?',
      a: 'Hiện tại chỉ có phiên bản web. Website đã được tối ưu mobile responsive, hoạt động mượt trên trình duyệt điện thoại.' },
    { q: 'Website không tải được, tôi cần làm gì?',
      a: 'Thử (1) xóa cache trình duyệt, (2) tắt VPN/proxy, (3) chuyển sang DNS Cloudflare 1.1.1.1. Nếu vẫn lỗi, gửi screenshot tới scoreline24h@gmail.com.' },
    { q: 'Tôi thấy có quảng cáo, ScoreLine có chạy AdSense không?',
      a: 'Không. ScoreLine đã gỡ toàn bộ quảng cáo Google AdSense và các mạng quảng cáo cá nhân hóa từ cuối 2025. Nếu bạn thấy quảng cáo, có thể do extension trình duyệt hoặc proxy đang chèn — vui lòng kiểm tra.' },
  ];

  const faqHtml = faqs.map(f => `<div class="faq-item"><div class="faq-q">${escapeHtml(f.q)}</div><div class="faq-a">${escapeHtml(f.a)}</div></div>`).join('');

  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const body = `
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Trợ giúp</span></nav>
    <div class="hero">
      <h1>❓ Trợ Giúp & Câu Hỏi Thường Gặp</h1>
      <div class="meta">Giải đáp các thắc mắc phổ biến khi sử dụng ScoreLine.io.</div>
    </div>
    <div class="card">
      <h2>Câu hỏi thường gặp</h2>
      ${faqHtml}
    </div>
    <div class="card">
      <h2>Liên hệ trực tiếp</h2>
      <p>Nếu câu hỏi của bạn không nằm trong danh sách trên:</p>
      <ul>
        <li>Email: <a href="mailto:scoreline24h@gmail.com">scoreline24h@gmail.com</a> — phản hồi trong 24-48h ngày làm việc</li>
        <li>Báo lỗi nội dung: cùng email trên với tiêu đề "[BUG] + URL trang"</li>
        <li>Yêu cầu gỡ thông tin cá nhân: tiêu đề "[GDPR] + Tên + URL"</li>
      </ul>
    </div>
    <div class="card">
      <h2>Liên kết hữu ích</h2>
      <ul>
        <li><a href="/about">Giới thiệu ScoreLine</a> — quy trình biên tập, đội ngũ và sứ mệnh</li>
        <li><a href="/privacy">Chính sách bảo mật</a> — cách chúng tôi xử lý dữ liệu</li>
        <li><a href="/terms">Điều khoản sử dụng</a> — quy tắc khi dùng website</li>
        <li><a href="/lich-thi-dau">Lịch thi đấu</a></li>
        <li><a href="/bang-xep-hang">Bảng xếp hạng</a></li>
        <li><a href="/nhan-dinh">Nhận định bóng đá</a></li>
      </ul>
    </div>
  </div>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(shellHtml({
    title: 'Trợ Giúp & Câu Hỏi Thường Gặp',
    description: 'Câu hỏi thường gặp về ScoreLine.io: tỷ số, lịch thi đấu, nhận định, báo lỗi, quyền riêng tư và liên hệ hỗ trợ.',
    canonical: url,
    jsonLd: [
      breadcrumbSchema([
        { name: 'Trang chủ', url: SITE_URL },
        { name: 'Trợ giúp', url },
      ]),
      faqSchema,
    ],
    body, contentDates: dates,
  }));
});

// ===== /ty-le-keo =====
// Note: this is a content overview page, NOT a betting/gambling page —
// the user explicitly removed AdSense and gambling-related content. Title
// and content stick to "tỷ lệ" (rates/odds as data points) and never
// promote betting.
router.get('/ty-le-keo', (req, res) => {
  const url = `${SITE_URL}/ty-le-keo`;
  const dates = getEntityDates({});

  const body = `
  <div class="container">
    <nav class="breadcrumb"><a href="/">Trang chủ</a> &rsaquo; <span>Tỷ lệ bóng đá</span></nav>
    <div class="hero">
      <h1>📈 Tỷ Lệ Bóng Đá</h1>
      <div class="meta">Bảng so sánh tỷ lệ các trận đấu sắp diễn ra — dữ liệu tham khảo, không phải lời khuyên cá cược.</div>
    </div>
    <div class="card">
      <h2>Tỷ lệ là gì và đọc thế nào?</h2>
      <p>Tỷ lệ (odds) là con số phản ánh xác suất một kết quả xảy ra theo đánh giá của thị trường. Trên ScoreLine, chúng tôi hiển thị 3 dạng tỷ lệ phổ biến:</p>
      <ul>
        <li><strong>Tỷ lệ 1X2:</strong> ba cột tương ứng đội nhà thắng (1), hòa (X), đội khách thắng (2). Số càng nhỏ → khả năng xảy ra càng cao theo đánh giá thị trường.</li>
        <li><strong>Tài/Xỉu (Over/Under):</strong> dự đoán tổng số bàn thắng cả trận sẽ trên hay dưới một mức nhất định (thường 2.5 bàn).</li>
        <li><strong>Châu Á (Asian Handicap):</strong> đội mạnh hơn được "chấp" bàn thắng để cân bằng — đây là dạng tỷ lệ phổ biến nhất tại châu Á.</li>
      </ul>

      <h2>Tỷ lệ trên ScoreLine có ý nghĩa gì?</h2>
      <p>Tỷ lệ chúng tôi hiển thị là <strong>dữ liệu tham khảo</strong> được tổng hợp từ thị trường công khai. Mục đích duy nhất là:</p>
      <ul>
        <li>So sánh giữa các trận trong cùng một vòng đấu.</li>
        <li>Theo dõi sự thay đổi tỷ lệ trước giờ bóng lăn (vốn phản ánh nhận định mới về phong độ, lineup).</li>
        <li>Hỗ trợ đọc bài nhận định: tỷ lệ + dữ liệu phong độ giúp bạn đánh giá độ tin cậy của dự đoán.</li>
      </ul>

      <h2>Cách phân tích tỷ lệ kèm phong độ</h2>
      <p>Một tỷ lệ chỉ thực sự có giá trị khi đặt vào ngữ cảnh:</p>
      <ol>
        <li><strong>So sánh phong độ:</strong> đội tỷ lệ thấp (được đánh giá cao) có đang thực sự chạy tốt 5 trận gần nhất? Xem mục Phong Độ trên trang BXH.</li>
        <li><strong>Lịch sử đối đầu (H2H):</strong> hai đội đối đầu nhau ra sao trong 5 lần gặp gần nhất? Có yếu tố sân nhà/sân khách rõ rệt không?</li>
        <li><strong>Lineup:</strong> ngôi sao chấn thương / treo giò có thể đảo ngược nhận định ban đầu của thị trường.</li>
        <li><strong>Bối cảnh trận đấu:</strong> trận hệ trọng (chung kết, derby) khác hẳn trận thủ tục cuối mùa.</li>
      </ol>

      <h2>Lưu ý quan trọng</h2>
      <p>ScoreLine cung cấp dữ liệu tỷ lệ với mục đích <strong>thông tin báo chí và tham khảo</strong>. Chúng tôi:</p>
      <ul>
        <li>Không cung cấp dịch vụ cá cược, không kết nối tới nhà cái, không nhận tiền từ bất kỳ tổ chức cá cược nào.</li>
        <li>Không đảm bảo độ chính xác tuyệt đối của tỷ lệ — chúng có thể thay đổi liên tục theo thị trường.</li>
        <li>Khuyên người dùng dưới 18 tuổi không tham gia bất kỳ hoạt động cá cược nào.</li>
        <li>Khuyến nghị mọi người dùng đặt giới hạn nghiêm cho bản thân và tìm hỗ trợ khi cần (xem phần "Cờ bạc có trách nhiệm" tại các tổ chức y tế công cộng).</li>
      </ul>

      <h2>Truy cập nhanh</h2>
      <ul>
        <li><a href="/lich-thi-dau">Lịch thi đấu — xem các trận sắp diễn ra</a></li>
        <li><a href="/bang-xep-hang">Bảng xếp hạng — phân tích phong độ đội bóng</a></li>
        <li><a href="/nhan-dinh">Nhận định bóng đá — phân tích chuyên sâu từng trận</a></li>
        <li><a href="/kien-thuc-bong-da">Kiến thức bóng đá — học cách đọc thống kê và chiến thuật</a></li>
      </ul>
    </div>
  </div>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=14400'); // 4h
  res.send(shellHtml({
    title: 'Tỷ Lệ Bóng Đá - Hướng Dẫn Đọc Tỷ Lệ Và Phân Tích Phong Độ',
    description: 'Hướng dẫn đọc tỷ lệ 1X2, tài xỉu, châu Á và cách kết hợp với phong độ, lineup, lịch sử đối đầu để đánh giá trận đấu.',
    canonical: url,
    jsonLd: [breadcrumbSchema([
      { name: 'Trang chủ', url: SITE_URL },
      { name: 'Tỷ lệ bóng đá', url },
    ])],
    body, contentDates: dates,
  }));
});

// ===== /404 =====
// Reachable two ways:
//   1. Direct: /404 from FE NotFoundPage (which sets status via its own
//      route logic on the SPA side).
//   2. Indirect: nginx @ssr_404 proxies failed bot SSR requests here.
// Returns 404 status + sports-themed full HTML (siteHeader, soccer-ball
// scoreboard, suggested actions, today's matches if any).
router.get('/404', async (req, res) => {
  let todayMatches = [];
  try {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    todayMatches = await MatchCache.find({
      matchDate: { $gte: now, $lte: dayEnd },
    }).sort({ matchDate: 1 }).limit(5).lean();
  } catch { /* stay graceful */ }

  const url = `${SITE_URL}/404`;
  const dates = getEntityDates({});
  const og = pickOgImage({}, { alt: 'Trang không tồn tại - ScoreLine' });

  const matchesHtml = todayMatches.map(match => {
    const m = match.matchData || {};
    const home = m.homeTeam || m.teams?.home || {};
    const away = m.awayTeam || m.teams?.away || {};
    const homeName = home.name || '';
    const awayName = away.name || '';
    const dt = new Date(match.matchDate);
    const time = `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
    const slug = buildMatchSlug(homeName, awayName, match.matchDate);
    const matchUrl = slug ? `/tran-dau/${slug}` : `/tran-dau/${match.fixtureId}`;
    return `<a href="${matchUrl}" class="suggested-match">
      <span class="suggested-time">${time}</span>
      <span class="suggested-teams">${escapeHtml(homeName)} <em>vs</em> ${escapeHtml(awayName)}</span>
    </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Trang Không Tồn Tại | ScoreLine</title>
  <meta name="description" content="Trang bạn tìm không có trên ScoreLine. Quay về trang chủ để xem tỷ số trực tiếp, lịch thi đấu và bảng xếp hạng bóng đá.">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="404 - Trang Không Tồn Tại | ScoreLine">
  <meta property="og:description" content="Trang bạn tìm đã việt vị! Quay về sân chính để xem tỷ số trực tiếp.">
  ${ogImageMeta(og)}
  <meta property="og:locale" content="vi_VN">
  <meta property="og:site_name" content="ScoreLine">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#0a1628;min-height:100vh;display:flex;flex-direction:column}
    a{color:#0066FF;text-decoration:none}a:hover{text-decoration:underline}
    .pitch-bg{flex:1;position:relative;overflow:hidden;background:#0a1628;
      background-image:
        radial-gradient(ellipse at center,rgba(0,212,255,0.08) 0%,transparent 60%),
        repeating-linear-gradient(0deg,transparent 0,transparent 80px,rgba(255,255,255,0.04) 80px,rgba(255,255,255,0.04) 81px),
        repeating-linear-gradient(90deg,transparent 0,transparent 80px,rgba(255,255,255,0.04) 80px,rgba(255,255,255,0.04) 81px);
    }
    .pitch-bg::before{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:480px;height:480px;border:2px solid rgba(255,255,255,0.06);border-radius:50%;pointer-events:none}
    .pitch-bg::after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,0.08);pointer-events:none}
    .container{max-width:980px;margin:0 auto;padding:48px 20px;position:relative;z-index:2}
    .scoreboard{background:linear-gradient(180deg,#1a2744,#0a1628);border:2px solid rgba(0,212,255,0.3);border-radius:20px;padding:36px 28px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06);margin-bottom:32px}
    .scoreboard-label{display:inline-block;background:rgba(255,68,68,0.18);color:#ff6b6b;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:18px;border:1px solid rgba(255,107,107,0.3)}
    .digits{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:18px;flex-wrap:wrap}
    .digit{font-family:'Courier New',monospace;font-size:120px;font-weight:900;color:#00D4FF;text-shadow:0 0 20px rgba(0,212,255,0.5),0 0 40px rgba(0,212,255,0.25);background:linear-gradient(180deg,#001428,#000a16);border:2px solid #1a2744;border-radius:10px;padding:6px 22px;line-height:1;min-width:104px}
    .digit-ball{font-size:120px;line-height:1;display:inline-flex;align-items:center;justify-content:center;width:104px;height:140px;animation:spin 8s linear infinite}
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    .title{color:#fff;font-size:36px;font-weight:900;letter-spacing:1px;margin-bottom:10px;text-shadow:0 2px 12px rgba(0,212,255,0.3)}
    .title em{color:#FFCC00;font-style:normal}
    .subtitle{color:#cbd5e1;font-size:16px;line-height:1.7;max-width:520px;margin:0 auto 22px}
    .actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:760px;margin:0 auto}
    .actions a{background:rgba(255,255,255,0.08);color:#fff;padding:14px 10px;border-radius:10px;font-weight:700;font-size:14px;border:1px solid rgba(255,255,255,0.12);transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none}
    .actions a:hover{background:rgba(0,212,255,0.18);border-color:rgba(0,212,255,0.5);transform:translateY(-2px);text-decoration:none}
    .actions a .icon{font-size:24px}
    .actions a .label{font-size:13px}
    .panel{background:#fff;border-radius:14px;padding:22px;margin-bottom:16px;box-shadow:0 4px 24px rgba(0,0,0,0.2)}
    .panel h2{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #eff6ff;display:flex;align-items:center;gap:8px}
    .suggested-match{display:flex;gap:14px;padding:12px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:8px;color:#0f172a;align-items:center;transition:all .15s}
    .suggested-match:last-child{margin-bottom:0}
    .suggested-match:hover{border-color:#0066FF;background:#eff6ff;text-decoration:none}
    .suggested-time{background:#0a1628;color:#00D4FF;padding:6px 12px;border-radius:6px;font-weight:800;font-size:13px;font-family:'Courier New',monospace;flex-shrink:0}
    .suggested-teams{flex:1;font-weight:700;font-size:15px;color:#0f172a}
    .suggested-teams em{color:#94a3b8;font-style:normal;font-weight:400;margin:0 6px}
    .links-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
    .links-grid a{display:block;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;color:#0f172a;font-weight:600;font-size:14px}
    .links-grid a:hover{background:#eff6ff;border-color:#1e3a8a;text-decoration:none}
    .footer{text-align:center;padding:18px 16px;color:#64748b;font-size:13px;background:#0a1628}
    .footer a{color:#cbd5e1}
    @media(max-width:768px){
      .container{padding:24px 14px}
      .scoreboard{padding:24px 16px}
      .digit{font-size:72px;padding:4px 14px;min-width:64px}
      .digit-ball{font-size:64px;width:64px;height:84px}
      .title{font-size:24px}
      .subtitle{font-size:14px}
      .actions{grid-template-columns:repeat(2,1fr)}
      .actions a{padding:12px 8px}
      .actions a .icon{font-size:20px}
      .actions a .label{font-size:12px}
    }
  </style>
</head>
<body>
  ${siteHeader()}
  <div class="pitch-bg">
    <div class="container">
      <div class="scoreboard">
        <span class="scoreboard-label">⚠ Trận đấu bị huỷ</span>
        <div class="digits" aria-label="404">
          <span class="digit">4</span>
          <span class="digit-ball" aria-hidden="true">⚽</span>
          <span class="digit">4</span>
        </div>
        <h1 class="title">VIỆT VỊ! Trang đã <em>bay khỏi sân</em></h1>
        <p class="subtitle">Trang bạn tìm có thể đã bị xoá, đổi tên, hoặc đường dẫn bị gõ sai. Đừng lo — quay về sân chính ngay bên dưới.</p>
        <div class="actions">
          <a href="/"><span class="icon">🏟️</span><span class="label">Trang chủ</span></a>
          <a href="/live"><span class="icon">📺</span><span class="label">Tỷ số trực tiếp</span></a>
          <a href="/lich-thi-dau"><span class="icon">📅</span><span class="label">Lịch thi đấu</span></a>
          <a href="/bang-xep-hang"><span class="icon">📊</span><span class="label">Bảng xếp hạng</span></a>
        </div>
      </div>

      ${todayMatches.length ? `<div class="panel">
        <h2>⚽ Có thể bạn quan tâm — trận đấu hôm nay</h2>
        ${matchesHtml}
      </div>` : ''}

      <div class="panel">
        <h2>🔗 Truy cập nhanh</h2>
        <div class="links-grid">
          <a href="/nhan-dinh">🎯 Nhận định bóng đá</a>
          <a href="/ket-qua-bong-da">✅ Kết quả mới nhất</a>
          <a href="/top-ghi-ban">👟 Top ghi bàn</a>
          <a href="/giai-dau">🏆 Tất cả giải đấu</a>
          <a href="/cau-thu">⚽ Cầu thủ Việt Nam</a>
          <a href="/huan-luyen-vien">👔 Huấn luyện viên</a>
          <a href="/world-cup-2026">🌍 World Cup 2026</a>
          <a href="/tin-bong-da">📰 Tin tức</a>
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    <a href="${SITE_URL}">ScoreLine.io</a> — Tỷ số trực tiếp, nhận định và thông tin bóng đá ·
    <a href="/help">Trợ giúp</a> · <a href="/about">Giới thiệu</a>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(404).send(html);
});

module.exports = router;
