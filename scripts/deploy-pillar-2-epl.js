/**
 * Deploy Pillar Article #2: Premier League A-Z
 * Evergreen overview of the league — history, format, top clubs, stars, FAQ.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'premier-league-cam-nang-a-z-cho-fan-bong-da-viet-nam';
const TITLE = 'Premier League: Cẩm nang A đến Z cho fan bóng đá Việt Nam';
const DESCRIPTION = 'Premier League là giải bóng đá hấp dẫn nhất thế giới với 20 đội thi đấu 38 vòng. Hướng dẫn toàn diện về lịch sử, format, Big 6, cầu thủ huyền thoại và cách xem EPL tại Việt Nam.';
// Unique image set for pillar #2 — zero overlap with pillars #1 or #3.
const HERO_IMAGE = 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1200&h=630&fit=crop';

const IMG_STADIUM = 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=1000&h=560&fit=crop';
const IMG_ACTION = 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=1000&h=560&fit=crop';
const IMG_FANS = 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=1000&h=560&fit=crop';
const IMG_TROPHY = 'https://images.unsplash.com/photo-1526307616774-60d0098f7642?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**Premier League** (Ngoại Hạng Anh) là giải bóng đá cấp cao nhất của Anh, thành lập 1992, có **20 đội** thi đấu **38 vòng** mỗi mùa (tháng 8 đến tháng 5). Đây là giải được **xem nhiều nhất thế giới** với 4.7 tỷ lượt xem/mùa ở hơn 200 quốc gia. Fan Việt Nam theo dõi qua FPT Play, K+, HTV Sports và các ứng dụng stream. Đọc bài này để hiểu cách Premier League hoạt động từ đầu đến cuối.
:::

## Premier League là gì?

**Premier League** là giải bóng đá cấp cao nhất trong hệ thống bóng đá Anh. Tên gọi tiếng Việt phổ biến: **Ngoại Hạng Anh (NHA)**, **Premiership** (cách gọi cũ).

:::stats Premier League by numbers
- **Thành lập**: 20/02/1992 (tách khỏi Football League cũ)
- **Số đội**: 20 đội
- **Số trận/mùa**: 380 (20 đội × 38 vòng)
- **Audience toàn cầu**: 4.7 tỷ lượt xem/mùa
- **Số quốc gia phát sóng**: 212
- **Đội đầu tiên vô địch**: Manchester United (1992-93)
- **Đội vô địch nhiều nhất**: Manchester United (13 lần)
:::

Trước 1992, giải đấu cao nhất của Anh là **Football League First Division**. 22 đội hàng đầu tách ra thành lập Premier League để có quyền đàm phán hợp đồng truyền hình riêng, mở ra kỷ nguyên thương mại hóa.

![Sân bóng Anh — nơi diễn ra hàng trăm trận EPL mỗi mùa](${IMG_STADIUM})

## Format mùa giải EPL

### Thể thức thi đấu

- **20 đội** thi đấu **vòng tròn 2 lượt** (home-away)
- Mỗi đội đá **38 trận** (19 sân nhà + 19 sân khách)
- **Mùa giải**: từ khoảng **20/08** đến **28/05** năm sau
- **Nghỉ Giáng sinh**: từ khoảng 20-28/12 (khoảng cách ngắn, thường chỉ 2-3 ngày, không như các giải Châu Âu khác)

### Hệ thống tính điểm

:::info Cách tính điểm 3-1-0
- **Thắng**: 3 điểm
- **Hòa**: 1 điểm
- **Thua**: 0 điểm
- **Vô địch**: đội có nhiều điểm nhất sau 38 vòng
:::

### Tiebreaker khi bằng điểm

Nếu nhiều đội cùng điểm, xếp hạng theo thứ tự:

1. **Hiệu số bàn thắng bại** (goal difference)
2. **Số bàn thắng ghi được**
3. **Kết quả đối đầu trực tiếp** (head-to-head)
4. **Play-off** (cực hiếm, dùng cho title/xuống hạng)

Ví dụ Man City và Liverpool từng cùng 98 điểm mùa 2018-19, Man City vô địch nhờ hiệu số bàn thắng tốt hơn.

## Quyền lợi top đội + xuống hạng

### Suất dự cúp châu Âu

![EPL quyết định cả danh hiệu CLB và suất dự Champions League](${IMG_TROPHY})

:::stats Mùa 2025/26 — quyền lợi top EPL
- **Top 1-5** → Champions League vòng bảng (5 suất do UEFA reform)
- **Top 6** → Europa League vòng bảng
- **Top 7** → Conference League vòng play-off
- **Vô địch FA Cup** → Europa League (nếu chưa qualified qua ranking)
- **Vô địch EFL Cup / Carabao Cup** → Conference League
:::

Lưu ý: **Top 5** từ mùa 2024/25 (trước chỉ top 4) nhờ UEFA tăng suất EPL do club performance xuất sắc ở Champions League.

### Xuống hạng (Relegation)

:::warning Relegation — giấc mơ vỡ của nhiều CLB
- **3 đội cuối bảng** (hạng 18, 19, 20) xuống **Championship** (hạng nhì)
- Xuống hạng = mất **£150-200 triệu** doanh thu TV và sponsor
- **Parachute payment** hỗ trợ 3 năm sau xuống hạng (£40-50M/năm) để đỡ sụp
- Không phải cứ xuống là lên lại được — Nottingham Forest mất 23 năm để trở lại (2022), Sheffield Wednesday vẫn ở dưới từ 2000
:::

### Promotion lên EPL

3 đội thăng hạng hàng năm:

- **Top 2 Championship** → thăng hạng thẳng
- **Hạng 3-6 Championship** → playoff, đội thắng thăng hạng (1 suất)

Playoff final ở Wembley được gọi là **"trận đấu đắt giá nhất thế giới"** vì thắng = +£200M doanh thu mùa sau.

## Big 6 — 6 CLB thống trị EPL

6 CLB được coi là **"Big 6"** thống trị top bảng xếp hạng 20 năm qua:

### 1. Manchester United

- **Thành lập**: 1878
- **Sân nhà**: Old Trafford (74,310 chỗ)
- **Vô địch EPL**: 13 lần (1992-93, 93-94, 95-96, 96-97, 98-99, 99-00, 00-01, 02-03, 06-07, 07-08, 08-09, 10-11, 12-13)
- **HLV huyền thoại**: Sir Alex Ferguson (1986-2013, 13 cúp EPL)

### 2. Liverpool

- **Thành lập**: 1892
- **Sân nhà**: Anfield (54,074 chỗ)
- **Vô địch EPL**: 2 lần (2019-20, 2024-25) + 18 First Division trước 1992
- **Biểu tượng**: "You'll Never Walk Alone" anthem + Shankly, Dalglish, Klopp

### 3. Arsenal

- **Thành lập**: 1886
- **Sân nhà**: Emirates Stadium (60,704 chỗ)
- **Vô địch EPL**: 3 lần (97-98, 01-02, 03-04 — "Invincibles" bất bại cả mùa)
- **Huyền thoại**: Arsène Wenger, Thierry Henry, Dennis Bergkamp

### 4. Chelsea

- **Thành lập**: 1905
- **Sân nhà**: Stamford Bridge (41,837 chỗ)
- **Vô địch EPL**: 5 lần (04-05, 05-06, 09-10, 14-15, 16-17)
- **Thay đổi**: Roman Abramovich mua 2003 → kỷ nguyên thành công

### 5. Manchester City

- **Thành lập**: 1880
- **Sân nhà**: Etihad Stadium (53,400 chỗ)
- **Vô địch EPL**: 8 lần (11-12, 13-14, 17-18, 18-19, 20-21, 21-22, 22-23, 23-24 — 4 liên tiếp)
- **HLV đương thời**: Pep Guardiola (từ 2016)

### 6. Tottenham Hotspur

- **Thành lập**: 1882
- **Sân nhà**: Tottenham Hotspur Stadium (62,850 chỗ)
- **Vô địch EPL**: 0 lần (best: á quân 2016-17)
- **Nổi tiếng**: "Lads, it's Tottenham" — có lẽ là CLB "nearly men" nổi tiếng nhất

:::tip Vì sao gọi Big 6?
Từ 2005-2020, 95% top 4 EPL là 1 trong 6 CLB này. Tuy nhiên, gần đây Newcastle (Saudi ownership), Aston Villa, Brighton đã break vào top 4 — **thời Big 6 monopoly đang kết thúc**.
:::

## Cầu thủ ghi bàn huyền thoại

![Những cú sút tạo nên lịch sử — Premier League 30+ năm](${IMG_ACTION})

### Top 10 all-time EPL scorers

:::stats Top ghi bàn Premier League mọi thời đại
1. **Alan Shearer** (Blackburn, Newcastle) — 260 bàn
2. **Harry Kane** (Tottenham) — 213 bàn
3. **Wayne Rooney** (Man Utd, Everton) — 208 bàn
4. **Andy Cole** (Arsenal, Newcastle, Man Utd) — 187 bàn
5. **Sergio Agüero** (Man City) — 184 bàn
6. **Mohamed Salah** (Liverpool) — 180+ bàn (đang thi đấu)
7. **Frank Lampard** (West Ham, Chelsea) — 177 bàn
8. **Thierry Henry** (Arsenal) — 175 bàn
9. **Robbie Fowler** (Liverpool) — 163 bàn
10. **Jermain Defoe** — 162 bàn
:::

### Kỷ lục đáng nhớ

- **Alan Shearer** giữ kỷ lục 260 bàn trong 14 mùa — khó ai phá
- **Erling Haaland** (Man City, 2022/23): 36 bàn/38 trận — kỷ lục single-season
- **Mohamed Salah** (Liverpool, 2017/18): 32 bàn trong mùa giải 38-match (current format)
- **Harry Kane** (Tottenham, 2017/18): 39 bàn mọi cúp — kỷ lục Premier League era

## VAR và luật thi đấu hiện đại

### VAR — Video Assistant Referee

- **Áp dụng EPL từ**: 2019/20
- **Áp dụng cho 4 tình huống**: bàn thắng, penalty, thẻ đỏ trực tiếp, nhầm người
- **Không áp dụng cho**: lỗi nhỏ, tranh cãi có tình huống phạm lỗi
- **Tranh cãi**: khiến trận đấu chậm lại 2-3 phút/lần check

:::warning VAR gây chia rẽ fan EPL
- Fan vé ngồi sân không biết tại sao trận đấu dừng
- Quyết định subjective (handball, offside) vẫn gây tranh cãi
- 2023/24: trung bình **4.2 phút delay mỗi trận** do VAR
- 2024/25: EPL áp dụng **semi-automated offside** để nhanh hơn
:::

### Thay đổi luật gần đây

Luật mới trong 2-3 mùa gần đây:

- **Thêm phút bù** (mùa 2022/23) — trung bình 5-8 phút thay vì 2-3 phút trước
- **Handball rule** thay đổi nhiều lần — thủ môn/hậu vệ đang confused
- **Offside semi-automated** — mùa 2024/25
- **Concussion substitution** — cho thêm 1 thay người nếu chấn thương đầu

## Tại sao Premier League hấp dẫn nhất thế giới?

Có 5 yếu tố khiến EPL vượt trội so với La Liga, Serie A, Bundesliga:

### 1. Tốc độ trận đấu

- **Box-to-box intensity** — pressing liên tục 90 phút
- Ít chờ giữa cầu thủ set play
- Fast transitions → nhiều cơ hội

### 2. Cạnh tranh sâu rộng

- **Bất kỳ đội nào có thể đánh bại bất kỳ đội nào** (giantkilling rất phổ biến)
- Top-to-bottom gap nhỏ hơn La Liga/Bundesliga
- Fulham 2-0 Man City, Brentford 2-1 Arsenal — chuyện thường

### 3. Sân vận động + fan culture

- Cheering liên tục 90 phút (không như La Liga im lặng)
- Chanting truyền thống (YNWA, Glory Glory Man United)
- Near-capacity attendance mọi trận (90-95% fill rate)

### 4. Sức mạnh tài chính

- **Revenue £6.5 tỷ/mùa** (gấp 2x La Liga)
- TV rights $15+ tỷ/3 năm
- Mỗi club kiếm £100-200M/mùa từ merit payment
- Thu hút được star cầu thủ + HLV top

### 5. Global branding

- 212 quốc gia phát sóng
- Commentary tiếng Anh thuận lợi audience quốc tế
- Merchandise reach toàn cầu

## Xem EPL tại Việt Nam

![Fan Việt theo dõi EPL qua nhiều kênh khác nhau](${IMG_FANS})

### Kênh chính thức

:::info Các kênh có bản quyền EPL tại VN
- **[K+](https://www.kplus.vn)** — bản quyền full mùa 2025/26, phát tất cả 380 trận/mùa
- **FPT Play** — một số trận big matches, thông qua gói đặc biệt
- **VTVcab ON** — highlights, một số trận chọn lọc
- **HTVC** — truyền hình cáp địa phương với một số trận
:::

### App streaming

- **K+ App** (iOS/Android) — live + replay
- **FPT Play** app — một số trận
- **Vie Channel** — fan app với highlights

### Chi phí

- **K+ subscription**: ~200-350K VND/tháng tùy gói
- **FPT Play Premium**: ~140K/tháng cho gói thể thao
- Không có gói EPL rẻ hơn tại VN — bản quyền đắt

### Timing trận đấu

EPL diễn ra giờ VN thường là:
- **Thứ 7**: 18:30 – 01:30 (ngày sau)
- **Chủ nhật**: 20:00 – 02:00 (ngày sau)
- **Thứ 2-5** (midweek): 02:00 – 04:00 sáng

## Mùa giải EPL hiện tại

:::tip Theo dõi EPL trên ScoreLine
Để cập nhật **lịch thi đấu, tỷ số trực tiếp, bảng xếp hạng** và **nhận định trận đấu** EPL, truy cập:

- [Lịch thi đấu Premier League](/lich-thi-dau/premier-league) — 7 ngày tới
- [Bảng xếp hạng EPL](/bang-xep-hang/premier-league) — cập nhật sau mỗi trận
- [Kết quả bóng đá hôm nay](/ket-qua-bong-da) — tất cả giải bao gồm EPL
- [Nhận định bóng đá](/nhan-dinh) — phân tích từng trận EPL trước giờ bóng lăn
- [Top ghi bàn EPL](/top-ghi-ban/premier-league) — vua phá lưới mùa giải
:::

## Câu hỏi thường gặp

### Premier League là giải gì?

Premier League là **giải bóng đá cấp cao nhất của nước Anh**, thành lập năm 1992, có 20 đội thi đấu 38 vòng mỗi mùa. Đây là giải được xem nhiều nhất thế giới.

### Premier League có bao nhiêu đội?

**20 đội** — không thay đổi từ 1995 đến nay. Mỗi đội thi đấu **38 trận** một mùa (home-away với 19 đội khác).

### Premier League bắt đầu khi nào trong năm?

Mùa giải EPL thường bắt đầu **giữa tháng 8** và kết thúc **cuối tháng 5** năm sau. Khoảng 9 tháng thi đấu với nghỉ ngắn Giáng sinh.

### Ai vô địch EPL nhiều nhất?

**Manchester United** với **13 danh hiệu EPL** (từ 1992). Manchester City gần đây bám sát với 8 cúp từ 2012.

### Làm sao xem Premier League tại Việt Nam hợp pháp?

Đăng ký **K+** (bản quyền chính thức) hoặc **FPT Play** (một số trận). Phí từ 140-350K VND/tháng. Không nên xem qua các stream lậu vì chất lượng kém và rủi ro bảo mật.

### Big 6 Premier League là gì?

**Big 6** là 6 CLB lớn thường xuyên top đầu EPL: **Manchester United, Liverpool, Arsenal, Chelsea, Manchester City, Tottenham Hotspur**. Tuy nhiên gần đây Newcastle, Aston Villa đã break vào top 4 nên "Big 6" không còn absolute.

### Top 4 Premier League được gì?

**Top 4 EPL** (và gần đây top 5) qualify **UEFA Champions League** mùa sau — giải đấu danh giá nhất châu Âu. Đây là mục tiêu chính của mọi CLB ngoài vô địch.

### Xuống hạng EPL nghĩa là gì?

**3 đội cuối bảng** (vị trí 18, 19, 20) cuối mùa xuống **Championship** (hạng 2). Xuống hạng mất £150-200M doanh thu TV và thường dẫn tới mass exodus cầu thủ.

## Bài viết liên quan trên ScoreLine

- [Lịch thi đấu Premier League tuần này](/lich-thi-dau/premier-league) — fixture difficulty + kickoff time
- [Bảng xếp hạng Premier League](/bang-xep-hang/premier-league) — cập nhật real-time
- [Top ghi bàn Premier League 2025/26](/top-ghi-ban/premier-league)
- [Kết quả bóng đá hôm qua](/ket-qua/hom-qua) — tất cả trận EPL đã kết thúc
- [xG Expected Goals guide](/tin-bong-da/xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da) — áp dụng data EPL vào phân tích
- [Nhận định EPL các trận hôm nay](/nhan-dinh) — analysis chuyên sâu

## Nguồn tham khảo

- [Premier League official](https://www.premierleague.com)
- [Premier League Handbook 2025/26](https://www.premierleague.com/publications)
- [BBC Sport EPL](https://www.bbc.com/sport/football/premier-league)
- [FBref Premier League stats](https://fbref.com/en/comps/9/Premier-League-Stats)`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');

  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    existing.title = TITLE;
    existing.description = DESCRIPTION;
    existing.content = CONTENT;
    existing.image = HERO_IMAGE;
    existing.tags = ['Premier League', 'Ngoại hạng Anh', 'EPL', 'Big 6', 'bóng đá Anh', 'kiến thức bóng đá'];
    existing.category = 'analysis';
    existing.source = 'editorial';
    existing.status = 'published';
    await existing.save();
    console.log('Updated:', existing.slug);
  } else {
    const article = new Article({
      originalTitle: TITLE,
      originalLink: `https://scoreline.io/tin-bong-da/${SLUG}`,
      source: 'editorial',
      slug: SLUG,
      title: TITLE,
      description: DESCRIPTION,
      content: CONTENT,
      tags: ['Premier League', 'Ngoại hạng Anh', 'EPL', 'Big 6', 'bóng đá Anh', 'kiến thức bóng đá'],
      image: HERO_IMAGE,
      category: 'analysis',
      status: 'published',
      pubDate: new Date(),
      aiModel: 'editorial',
    });
    await article.save();
    console.log('Created:', article.slug);
  }

  try {
    const { invalidateSitemapCache } = require('../routes/sitemap');
    invalidateSitemapCache();
    console.log('Sitemap cache invalidated');
  } catch (e) {
    console.warn('Could not invalidate sitemap:', e.message);
  }

  console.log(`\nURL: https://scoreline.io/tin-bong-da/${SLUG}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
