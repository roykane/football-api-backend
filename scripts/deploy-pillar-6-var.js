/**
 * Deploy Pillar Article #6: VAR — giải thích + 10 tình huống kinh điển
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'var-la-gi-cach-hoat-dong-10-tinh-huong-kinh-dien-bong-da';
const TITLE = 'VAR Là Gì? Cách Hoạt Động + 10 Tình Huống Kinh Điển Trong Bóng Đá';
const DESCRIPTION = 'VAR (Video Assistant Referee) là hệ thống trọng tài video trong bóng đá. Giải thích cách hoạt động, 4 tình huống được áp dụng, 10 vụ VAR tranh cãi nhất lịch sử và xu hướng semi-automated 2024/25.';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=630&fit=crop';

const IMG_VAR_ROOM = 'https://images.unsplash.com/photo-1519669556878-63bdad8a1a49?w=1000&h=560&fit=crop';
const IMG_REFEREE = 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=1000&h=560&fit=crop';
const IMG_CONTROVERSY = 'https://images.unsplash.com/photo-1603775020644-eb8decd79994?w=1000&h=560&fit=crop';
const IMG_FUTURE = 'https://images.unsplash.com/photo-1543269664-76bc3997d9ea?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**VAR (Video Assistant Referee)** là hệ thống trọng tài video hỗ trợ trọng tài chính trong 4 tình huống: **bàn thắng**, **penalty**, **thẻ đỏ trực tiếp**, và **nhầm người**. Áp dụng chính thức World Cup 2018, Premier League từ 2019/20. Dù giảm sai sót, VAR vẫn gây tranh cãi vì quyết định subjective (handball, offside cm). Bài này giải thích cách VAR hoạt động, quy trình step-by-step, 10 vụ tranh cãi kinh điển, và xu hướng **semi-automated offside** 2024/25.
:::

## VAR là gì? Lịch sử ngắn gọn

**VAR** viết tắt của **Video Assistant Referee** — **Trợ lý trọng tài video**. Là hệ thống dùng camera replay và một team trọng tài phụ trong "VAR room" để **review các quyết định quan trọng** của trọng tài chính.

:::stats VAR timeline
- **2014-2016**: FIFA thử nghiệm VAR ở các giải thử
- **2018**: VAR chính thức dùng **FIFA World Cup 2018** (Nga)
- **2019/20**: **Premier League** áp dụng lần đầu
- **2020**: UEFA Champions League knockout chính thức dùng
- **2024/25**: Semi-automated offside rollout rộng rãi
- **2024**: Một số giải (Pháp Ligue 1) thử nghiệm **referee video reviews** (trọng tài chính xem màn hình)
:::

Trước VAR, mọi quyết định là final ngay tức thời. Một pha bàn thắng offside milimet cũng không xét lại. VAR giúp **giảm sai sót lớn**, nhưng cũng tạo ra **tranh cãi mới** (chờ lâu, check marginal).

![Trọng tài chính vẫn là người quyết định cuối cùng, VAR chỉ tư vấn](${IMG_REFEREE})

## 4 tình huống VAR được áp dụng

VAR **KHÔNG** check mọi quyết định. Chỉ **4 loại tình huống** cụ thể:

### 1. Bàn thắng (Goal/no-goal)

VAR check:
- Có **offside** trong build-up không (bất kỳ ai trong pha tấn công trước bàn)
- Có **handball** không (của người ghi hoặc trong build-up)
- Có **lỗi trước đó** không (phạm lỗi, ball out, v.v.)

Nếu có lỗi → **bàn không được công nhận**. Trọng tài chính thổi lại.

### 2. Penalty (pha phạt đền)

VAR check:
- Pha phạm lỗi có thật sự **trong vòng cấm** không
- Có **phạm lỗi** rõ ràng không (subjective nhưng VAR chỉ khuyên khi "clear and obvious")
- Có **simulation/dive** không

Nếu VAR thấy sai → trọng tài chính đi đến màn hình bên sân, xem lại, quyết định cuối.

### 3. Thẻ đỏ trực tiếp

VAR check các pha:
- Phạm lỗi nặng (**violent conduct**, **serious foul play**)
- Cản trở ngăn cơ hội ghi bàn (**DOGSO** — Denial of Obvious Goal-Scoring Opportunity)
- Phạm lỗi nguy hiểm với **stud/elbow**

VAR **không** check thẻ vàng.

### 4. Nhầm người (Mistaken identity)

- Trọng tài chính rút thẻ **nhầm cầu thủ** (đáng lý là #10 nhưng đưa thẻ cho #9)
- VAR giúp identify đúng

Rất hiếm (1-2 lần/mùa), nhưng rõ ràng.

![VAR room — nơi các trọng tài video xem hàng chục góc camera](${IMG_VAR_ROOM})

## Quy trình VAR hoạt động — bước step-by-step

:::example Quy trình VAR sau 1 tình huống nghi ngờ
1. **Trọng tài chính** đưa ra quyết định ngay trên sân (ví dụ: công nhận bàn)
2. **VAR team** (ở phòng video studio riêng) tự check 4 tình huống trong pha đó
3. Nếu VAR thấy có lỗi rõ → gọi trọng tài chính qua tai nghe
4. VAR nói: **"Check in progress"** hoặc **"We recommend you view this on the pitch-side monitor"**
5. **Trọng tài chính** chạy ra màn hình bên đường biên (RRA — Referee Review Area)
6. Xem replay slow-motion nhiều góc
7. **Trọng tài chính** đưa quyết định cuối cùng (có thể giữ nguyên hoặc đảo ngược)
8. Announce qua loa stadium: bàn thắng được công nhận / hủy / penalty thay đổi
:::

:::warning VAR KHÔNG tự động đảo ngược
VAR chỉ **khuyên**. Quyết định cuối **luôn luôn** là của trọng tài chính. Nếu trọng tài chính xem RRA và vẫn giữ quyết định ban đầu → VAR phải tôn trọng.

**Tiêu chuẩn can thiệp**: chỉ khi có **"clear and obvious error"** (sai rõ ràng và hiển nhiên). Subjective calls → VAR không can thiệp.
:::

## Semi-automated offside — bước tiến 2024/25

Trước đây, VAR vẽ line offside **thủ công** — mất 1-3 phút, nhiều khi sai do hand-drawn.

**Semi-automated offside (SAO)** dùng:
- **12 camera đặc biệt** gắn trên mái sân, track 29 điểm dữ liệu trên cơ thể cầu thủ
- **Cảm biến bóng** (chip trong Adidas Al Rihla ball từ World Cup 2022)
- AI tự động tính offside **chính xác đến centimet**
- Thời gian: **<30 giây** thay vì 1-3 phút

Áp dụng:
- **FIFA World Cup 2022**: lần đầu
- **Champions League**: từ 2022/23
- **Premier League**: thử nghiệm 2024/25
- **La Liga, Serie A**: áp dụng full 2024

→ **Offside gây tranh cãi ít hơn đáng kể**. Check nhanh hơn, chính xác hơn.

![Công nghệ AI + camera đa góc biến VAR nhanh và chính xác hơn](${IMG_FUTURE})

## 10 tình huống VAR kinh điển trong lịch sử

### 1. Tottenham vs Ajax (Champions League 2019 semi-final)

- **Bối cảnh**: Aggregate 2-2, Moura ghi bàn phút 96 đưa Spurs vào CK
- **VAR check**: potential offside — phân tích siêu kỹ
- **Kết quả**: **Bàn được công nhận**, Tottenham vào chung kết
- **Ý nghĩa**: Thời khắc cảm xúc nhất lịch sử VAR, chứng minh giá trị

### 2. Liverpool vs Aston Villa (EPL 2019) — Firmino offside bằng nách

- Firmino offside bằng **cánh tay** (part of body that can score)
- Bàn **bị hủy**
- Fan phẫn nộ vì VAR "quá đến milimet"
- Dẫn đến thay đổi luật 2021: chỉ tính phần body có thể ghi bàn

### 3. Manchester City vs Tottenham (UCL 2019 QF)

- Aguero ghi bàn phút 93 (tưởng vào CK)
- VAR check → Laporte handball trong build-up
- **Bàn hủy, Man City bị loại**
- Kỷ niệm đau nhất Pep Guardiola

### 4. Salah Penalty vs Brighton (EPL 2020)

- Salah bị phạm lỗi trong cấm địa, trọng tài không thổi
- VAR check → đúng là foul
- Trọng tài đổi ý → penalty → Liverpool thắng
- Positive VAR — đảo ngược sai sót rõ

### 5. Argentina vs Iran (World Cup 2018) — handball Iran

- Penalty cho Iran do Argentine player handball
- VAR check → tay không ở vị trí tự nhiên
- **Penalty hủy**, Argentina thắng 1-0
- Positive impact

### 6. France vs Croatia (World Cup 2018 Final)

- Mandžukić handball → VAR xác nhận → penalty France
- Griezmann ghi → France 2-1
- Dẫn đến France vô địch
- Controversial: VAR giúp France trong trận cuối

### 7. Harry Kane vs Manchester City (EPL 2020)

- Kane ghi bàn, VAR check offside
- Phân tích "armpit" của Kane
- Bàn hủy, fan Tottenham outraged

### 8. Ronaldo vs Barcelona (UCL, Juventus 2019)

- Ronaldo ghi bàn pha overhead
- VAR check: handball trong build-up
- Bàn hủy
- Juventus bị loại

### 9. Aubameyang vs Tottenham (FA Cup final 2020)

- Penalty tranh cãi → VAR xem lại → giữ quyết định
- Mike Dean controversial call
- Arsenal thắng nhưng fan Spurs bức xúc

### 10. Semi-automated offside débute — World Cup 2022

- Argentina vs Saudi Arabia: 3 bàn thắng Messi team liên tiếp bị hủy do offside milimet
- Nhưng SAO cho quyết định nhanh (30s thay 2 phút)
- Argentina thua 1-2, vẫn vô địch cup cuối cùng

![VAR gây ra nhiều khoảnh khắc cảm xúc đối lập: từ joy sang despair](${IMG_CONTROVERSY})

## Tranh cãi VAR: Tốt hay xấu cho bóng đá?

### Arguments PRO

- **Giảm sai sót nghiêm trọng**: pre-VAR ~15% trận có quyết định sai lớn, post-VAR chỉ ~3%
- **Công bằng hơn** trong penalty, offside
- **Cầu thủ không "get away" với fouls violent**
- **Consistent** hơn giữa các giải

### Arguments CONTRA

:::warning Nhược điểm VAR
- **Giết cảm xúc bàn thắng** — fan không dám ăn mừng vì sợ VAR hủy
- **Chờ lâu** 2-3 phút mỗi check (pre-SAO)
- **Marginal calls** vẫn subjective (handball đặc biệt)
- **Inconsistency** giữa trọng tài VAR (1 crew keo, 1 crew lỏng)
- **Stop game flow** — nhịp trận bị cắt vụn
- **Fan in-stadium mù mờ** — không biết tại sao trận dừng
:::

### Public sentiment

- **Fan EPL**: 60-65% ủng hộ VAR 2024 (tăng từ 40% 2019)
- **Fan La Liga**: 75%+ ủng hộ (SAO làm mọi thứ tốt hơn)
- **Fan Serie A**: 55% — nhiều tranh cãi handball
- **Cầu thủ**: phân cực — Haaland, Son tweet phàn nàn nhiều

## Tương lai của VAR

### Referee Review Area live streaming

Liverpool, Man City đang thử **broadcast VAR conversations** cho fan (trên app, TV)
→ Minh bạch, fan hiểu quyết định tốt hơn

### AI-powered fouls

- Mô hình ML predict handball/foul theo tay, hông
- Test ở Liga MX (Mexico) 2024
- Có thể EPL 2027-28

### Touch-line microphones

- Captain được nghe cuộc trao đổi VAR ↔ trọng tài
- Tăng minh bạch
- Đang thử Scottish Premiership

## Câu hỏi thường gặp

### VAR là gì viết tắt của?

**VAR** = **Video Assistant Referee** — Trợ lý trọng tài video. Là hệ thống trọng tài phụ trong phòng video, hỗ trợ trọng tài chính qua 4 tình huống: bàn thắng, penalty, thẻ đỏ trực tiếp, nhầm người.

### Premier League dùng VAR từ khi nào?

**Mùa 2019/20**. Trước đó, EPL là giải lớn cuối chưa áp dụng VAR (Bundesliga, Serie A, La Liga đã dùng từ 2017-18).

### VAR có thể đảo ngược quyết định của trọng tài chính không?

Không tự động. VAR chỉ **khuyên** trọng tài chính xem xét lại qua **pitch-side monitor (RRA)**. Quyết định cuối **luôn luôn** là của trọng tài chính. Chỉ can thiệp khi có **"clear and obvious error"**.

### Tại sao VAR bị ghét nhiều?

Vì:
- **Chờ lâu** (2-3 phút mỗi check pre-SAO)
- **Marginal calls** hủy bàn thắng đáng tiếc
- **Giết cảm xúc** — fan không dám ăn mừng
- **Fan trên sân** không biết chuyện gì

### Semi-automated offside là gì?

Hệ thống **AI + 12 camera + cảm biến bóng** tự động detect offside chính xác cm, chỉ trong **<30 giây**. Thay vì trọng tài VAR phải vẽ line thủ công. Áp dụng FIFA World Cup 2022 lần đầu, nay rộng rãi ở UCL, La Liga, EPL.

### VAR check thẻ vàng không?

**Không**. VAR chỉ can thiệp thẻ đỏ trực tiếp (bạo lực, DOGSO, phạm lỗi nghiêm trọng). Thẻ vàng đơn thuần vẫn là quyết định final của trọng tài chính.

### Quy trình VAR mất bao lâu?

- **Offside check (SAO)**: 15-30 giây
- **Penalty check**: 1-2 phút
- **Handball check**: 1-3 phút (subjective, mất nhiều thời gian)
- **Red card check**: 2-3 phút

Trung bình EPL 2023/24: ~4 phút delay/trận do VAR.

### Làm sao biết VAR đang check?

Trọng tài chính **đặt 2 ngón tay tạo hình chữ nhật** trong không khí (giống TV frame). Loa stadium thường announce **"Check VAR for [situation]"**. Màn hình lớn sân có text "Check VAR in progress".

## Bài viết liên quan trên ScoreLine

- [xG Expected Goals](/tin-bong-da/xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da) — data-driven phân tích bóng đá hiện đại
- [Premier League A-Z](/tin-bong-da/premier-league-cam-nang-a-z-cho-fan-bong-da-viet-nam) — VAR ở EPL từ 2019/20
- [Xem bóng đá trực tiếp VN](/tin-bong-da/xem-bong-da-truc-tiep-tai-viet-nam-10-phuong-an-hop-phap) — xem VAR moments live
- [Lịch thi đấu Premier League](/lich-thi-dau/premier-league) — theo dõi trận có VAR
- [Nhận định bóng đá](/nhan-dinh) — phân tích trước trận với context VAR rules

## Nguồn tham khảo

- [IFAB Laws of the Game — VAR Protocol](https://www.theifab.com)
- [Premier League VAR page](https://www.premierleague.com/VAR)
- [UEFA VAR rules](https://www.uefa.com/insideuefa/news/var)
- Dữ liệu EPL VAR decisions 2019-2025`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');
  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    Object.assign(existing, {
      title: TITLE, description: DESCRIPTION, content: CONTENT, image: HERO_IMAGE,
      tags: ['VAR', 'Video Assistant Referee', 'luật bóng đá', 'trọng tài', 'semi-automated offside', 'kiến thức bóng đá'],
      category: 'analysis', source: 'editorial', status: 'published',
    });
    await existing.save();
    console.log('Updated:', existing.slug);
  } else {
    await new Article({
      originalTitle: TITLE, originalLink: `https://scoreline.io/tin-bong-da/${SLUG}`,
      source: 'editorial', slug: SLUG, title: TITLE, description: DESCRIPTION, content: CONTENT,
      tags: ['VAR', 'Video Assistant Referee', 'luật bóng đá', 'trọng tài', 'semi-automated offside', 'kiến thức bóng đá'],
      image: HERO_IMAGE, category: 'analysis', status: 'published',
      pubDate: new Date(), aiModel: 'editorial',
    }).save();
    console.log('Created:', SLUG);
  }
  try { require('../routes/sitemap').invalidateSitemapCache(); console.log('Sitemap cache invalidated'); } catch(e) {}
  console.log(`URL: https://scoreline.io/tin-bong-da/${SLUG}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
