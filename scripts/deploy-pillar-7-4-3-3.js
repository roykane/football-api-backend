/**
 * Deploy Pillar Article #7: Sơ đồ 4-3-3 hiện đại — tactical guide
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'so-do-4-3-3-hien-dai-tu-pep-guardiola-den-arteta';
const TITLE = 'Sơ Đồ 4-3-3 Hiện Đại: Từ Pep Guardiola Đến Arteta';
const DESCRIPTION = 'Sơ đồ 4-3-3 là formation phổ biến nhất bóng đá hiện đại. Giải thích cấu trúc, vai trò từng vị trí, lịch sử từ Cruyff đến Guardiola, Klopp, Arteta. Kèm điểm mạnh yếu và khi nào dùng 4-3-3.';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&h=630&fit=crop';

const IMG_FORMATION = 'https://images.unsplash.com/photo-1598346762291-aee88549193f?w=1000&h=560&fit=crop';
const IMG_PLAYERS = 'https://images.unsplash.com/photo-1598136490941-30d885318abd?w=1000&h=560&fit=crop';
const IMG_COACHING = 'https://images.unsplash.com/photo-1542766788-a2f588f447ee?w=1000&h=560&fit=crop';
const IMG_MODERN = 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**Sơ đồ 4-3-3** là formation với **4 hậu vệ + 3 tiền vệ + 3 tiền đạo**, được khai sinh bởi Rinus Michels (Ajax 1970s) và làm nổi tiếng bởi **Johan Cruyff** ở Barcelona. Hiện là formation phổ biến nhất top châu Âu, được **Pep Guardiola** (Man City), **Jürgen Klopp** (Liverpool), **Mikel Arteta** (Arsenal), **Luis Enrique** (PSG) dùng với biến thể riêng. Ưu điểm: kiểm soát trung tuyến + width tấn công. Nhược điểm: đòi hỏi fullback có thể lực cực cao và midfielder đa năng.
:::

## 4-3-3 là gì? Cấu trúc cơ bản

**4-3-3** là sơ đồ với:

- **4 hậu vệ**: 2 trung vệ (CB) + 2 hậu vệ cánh (LB, RB)
- **3 tiền vệ**: 1 defensive midfielder (DM/CM) + 2 central midfielder (CM) — **hoặc** triangle ngược
- **3 tiền đạo**: 2 winger (LW, RW) + 1 striker (ST/9)

:::stats 4-3-3 by position numbers
- **Hậu vệ**: 4 (GK + 2 CB + 2 FB)
- **Tiền vệ**: 3 (thường 1 DM holding + 2 tấn công)
- **Tiền đạo**: 3 (2 winger bám biên + 1 striker trung)
- **Tổng**: 11 (10 field + 1 GK)
- **Phổ biến**: ~35-40% trận top 5 leagues châu Âu dùng 4-3-3 2024/25
- **Giải nổi tiếng dùng 4-3-3**: Premier League, La Liga, Serie A, Champions League
:::

### 4-3-3 vs 4-3-3 — có 2 kiểu

Triangle tiền vệ khác nhau:

**Kiểu 1 (triangle ngược / 1 DM)**:
- 1 DM + 2 CM tấn công phía trên
- Ví dụ: Man City (Rodri làm DM, De Bruyne + Silva làm CM box-to-box)
- Rigid hơn, structured
- Needs 1 DM xuất sắc

**Kiểu 2 (triangle xuôi / 2 DM)**:
- 2 DM ngang hàng + 1 CM tấn công phía trước (số 10)
- Ví dụ: một số biến thể của Tuchel, Ancelotti
- Cân bằng phòng ngự hơn
- Số 10 cần creative

![4-3-3 là formation linh hoạt, thích ứng nhiều style chơi](${IMG_FORMATION})

## Vai trò từng vị trí trong 4-3-3

### Goalkeeper (GK)

Trong 4-3-3 hiện đại, GK là **sweeper-keeper** — chơi cao, phát động tấn công bằng chân.

- **Ví dụ tốt**: Alisson (Liverpool), Ederson (Man City), Neuer (Bayern)
- **Key skill**: passing range, decision making khi ra ngoài cấm địa

### 2 Centre-backs (CB)

- **Ball-playing CB** — chuyền dài, break lines, không chỉ phá banh
- **Tốc độ + thể chất** — cover khi fullback bombing forward
- **Ví dụ**: Van Dijk (Liverpool), Rúben Dias (Man City), Saliba (Arsenal)

### 2 Fullbacks (LB/RB)

Vai trò **khó nhất và thể lực nhất** trong 4-3-3:

- **Attack**: overlap/underlap, cross
- **Defense**: cover winger đối thủ
- **Thể chất**: chạy 11-13km/trận (nhiều nhất team)
- **Ví dụ đỉnh**: Alexander-Arnold (Liverpool, inverted FB), Cancelo (ex-City), Hakimi (PSG)

### Defensive Midfielder (DM / #6)

Trụ cột của 4-3-3 — không có DM tốt = formation sụp:

- **Vị trí "số 6"** — ngay trước hàng thủ
- **Tackle, interception, cover**
- **Phát động**: receive từ CB, distribute ra wings và CMs
- **Ví dụ**: Rodri (Man City), Casemiro (ex-Real), Busquets (ex-Barca)

### 2 Central Midfielders (CM)

- **Box-to-box**: attack support + defend support
- **Passing**: kết nối DM ↔ forwards
- **Arrival vào cấm địa**: ghi bàn từ cú volley/tap-in
- **Ví dụ**: De Bruyne (Man City), Bellingham (Real Madrid), Ødegaard (Arsenal)

### 2 Wingers (LW/RW)

Trong 4-3-3 hiện đại, **winger là vua**:

- **Inverted wingers**: LW chân phải, RW chân trái → cut vô trong sút
- **Dribble**: 1-on-1 với fullback đối thủ
- **Pressing**: đầu tiên chặn CB đối thủ
- **Ví dụ**: Salah (Liverpool), Saka (Arsenal), Mbappe (Real Madrid)

### Striker (ST / #9)

- **Target man** hoặc **false 9**
- **Finish chances** được tạo bởi wingers/CMs
- **Link-up**: hold-up play để winger/CM lên
- **Ví dụ**: Haaland (Man City), Kane (Bayern), Vinícius (Real, hybrid LW/ST)

## Lịch sử 4-3-3 — từ Cruyff đến Guardiola

### Total Football — 1970s Ajax/Netherlands

**Rinus Michels** + **Johan Cruyff** tạo ra **Total Football** ở Ajax và Hà Lan:
- Mọi cầu thủ có thể chơi mọi vị trí
- 4-3-3 linh hoạt, rotation liên tục
- Pressing cao (6-yard box attacker chase CB)
- **Thắng**: Ajax 3 Champions Cup liên tiếp (1971-73)

Sau đó Cruyff làm HLV Barcelona 1988-96, áp dụng 4-3-3 Dutch style → **Dream Team**.

### Pep Guardiola — refinement Barcelona 2008-12

![Pep Guardiola tinh chỉnh 4-3-3 thành triết lý tiki-taka](${IMG_COACHING})

Pep kế thừa Cruyff ở Barca:
- **Tiki-taka**: ngắn, nhanh, giữ bóng 70%+
- **Possession = defense** (đối thủ không có bóng = không ghi bàn)
- **False 9** (Messi 2009-2012): striker lùi về tạo overload midfield
- **Full-back chơi cao**: Dani Alves trở thành winger phải second
- **Thắng**: La Liga 3/4 mùa, UCL 2009, 2011 — thế hệ vàng

### Klopp's Liverpool 2016-2024 — gegenpress 4-3-3

**Jürgen Klopp** adapt 4-3-3 với style khác:
- **Heavy metal football** — intensity cao, pressing aggressive
- **Counter-pressing** ngay sau mất bóng (6 giây rule)
- **Fullback tấn công cao** (TAA + Robertson tạo ra 30+ assists/năm combined)
- **Front 3 pressing** trực tiếp CB đối thủ
- **Thắng**: UCL 2019, EPL 2020 (mùa bất bại 29-38), Carabao Cup 2024

### Guardiola's Manchester City 2016-2024 — evolution

![Man City của Pep — 4-3-3 nghệ thuật của control](${IMG_MODERN})

Pep ở City refining 4-3-3 thêm nữa:
- **Inverted fullback**: Cancelo/Walker vào giữa sân, tạo thế 3-2 build-up
- **Haaland #9**: target man high-line, khai thác space behind
- **Rodri** = hub (DM giỏi nhất thế giới, Ballon d'Or 2024)
- **Thắng**: 6 EPL (2018, 19, 21, 22, 23, 24), treble 2023, 4-peat 2021-24

### Arteta's Arsenal 2020-present

- Học trò của Pep → bring Pep philosophy about Arsenal
- **Rice as DM** (£105M signing 2023) — platform cho 4-3-3
- **Saka + Martinelli** inverted wingers
- **Ødegaard** creative #8
- **Thắng (mùa 2024/25)**: gần vô địch, á quân, pha đẹp nhất EPL

### Luis Enrique's PSG / Spain 2024-25

- Former Barca player và HLV
- Dùng 4-3-3 với **Mbappé đã qua**, hiện dùng **Dembélé + Kvaratskhelia** wingers
- Thắng UCL 2024/25 với PSG

## Điểm mạnh của 4-3-3

:::tip Vì sao 4-3-3 dominate bóng đá hiện đại
- **Numerical superiority in midfield** — 3 vs 2 hoặc 3 vs 3 (tùy đối thủ)
- **Width từ 2 wingers** — pitch wide, tạo space cho CM tiến lên
- **Pressing triangle** — 3 forward + 3 midfielder = 6 pressers
- **Flexibility**: có thể shape thành 4-2-3-1 (attack) hoặc 4-5-1 (defense)
- **Fullback freedom**: với DM cover, FB có thể tấn công cao an toàn
:::

## Điểm yếu / khi nào KHÔNG dùng 4-3-3

:::warning Nhược điểm 4-3-3
- **Cần DM đỉnh cao** — không có Rodri, Busquets, Rice → dễ bị counter
- **Fullback chạy kiệt sức** — 90 phút bombing forward khó cầm cự cả mùa
- **Bị exposed ở 2 half-space** (khu giữa CB và FB) nếu đội không compact
- **Cần 2 winger cực giỏi** — rất đắt (Salah, Saka, Vinicius transfers £80M+)
- **Không phù hợp với đội thể chất kém**
:::

### Khi nào nên dùng 4-3-3

- Đội có **DM xuất sắc** (Rodri tier)
- Đội có **wingers chất lượng cao**
- Muốn **dominate possession** (65%+)
- Đội **thể chất cao**
- **Home advantage** — dễ tấn công sân nhà

### Khi nào KHÔNG nên dùng

- Đội dưới (underdog) → **5-3-2** hoặc **4-5-1 low block** an toàn hơn
- Đội **missing DM chính** → rủi ro cao
- Gặp đối thủ press cao mạnh → **3-5-2** dễ build-up hơn

## So sánh 4-3-3 với các sơ đồ khác

### 4-3-3 vs 4-2-3-1

- **4-3-3**: 1 DM + 2 box-to-box CM
- **4-2-3-1**: 2 DM + 1 số 10 + 3 tấn công (LW, RW, ST)
- **4-2-3-1** stable hơn defense, **4-3-3** dynamic hơn midfield
- **Dùng 4-2-3-1**: Arsenal thời Wenger, Tuchel Chelsea

### 4-3-3 vs 3-5-2

- **4-3-3**: 4 hậu vệ ngang, 2 winger
- **3-5-2**: 3 CB + 2 wingback (tấn công cao)
- **3-5-2** tốt hơn khi không có winger giỏi
- **Dùng 3-5-2**: Inter của Conte 2020-21 (Serie A vô địch), Italy EURO 2020

### 4-3-3 vs 4-4-2

- **4-4-2**: classic English, 4 midfielder ngang
- **4-3-3** linh hoạt + control midfield hơn
- **4-4-2** đơn giản nhưng dễ bị out-numbered giữa sân
- **Dùng 4-4-2**: Atletico Madrid của Simeone (flat 4-4-2 defensive block)

![Mỗi sơ đồ có tác dụng riêng — HLV giỏi biết chọn đúng theo đối thủ](${IMG_PLAYERS})

## Xu hướng 4-3-3 tương lai

### Inverted fullback (Pep pioneer)

- FB di chuyển vào **giữa sân khi build-up** tạo **3-2-5 shape**
- Ví dụ: Zinchenko (Arsenal), Cancelo (Man City)
- Đang phổ biến ở top 5 leagues

### Hybrid CM (Bellingham role)

- **Jude Bellingham** (Real Madrid) chơi như CM + số 10 + false 9
- Role hybrid, khó marking
- Sẽ định hình CM future

### Target man #9 trở lại

- Sau era false 9 (Messi), striker truyền thống comeback
- **Haaland**, **Osimhen**, **Isak** = modern target men
- 4-3-3 mới có 1 striker "truyền thống" + 2 inverted wingers

## Câu hỏi thường gặp

### 4-3-3 là gì?

Là sơ đồ bóng đá với **4 hậu vệ + 3 tiền vệ + 3 tiền đạo**. Cấu trúc: 2 CB, 2 FB, 1 DM + 2 CM (hoặc 2 DM + 1 số 10), 2 winger + 1 striker. Phổ biến nhất bóng đá hiện đại với 35-40% trận top 5 leagues.

### Đội nào dùng 4-3-3 nhiều nhất?

**Manchester City** (Pep Guardiola), **Liverpool** (Klopp tới 2024, Slot tiếp), **Arsenal** (Arteta), **Barcelona** (Xavi, Flick), **Bayern Munich**, **Real Madrid** (có lúc), **PSG** (Luis Enrique).

### Ai tạo ra sơ đồ 4-3-3?

Sơ đồ 4-3-3 hiện đại được thiết kế bởi **Rinus Michels** (HLV Ajax và Hà Lan 1970s), cùng **Johan Cruyff** (cầu thủ → HLV) phát triển tiếp. Total Football Hà Lan là nền tảng.

### Tại sao 4-3-3 cần DM giỏi?

DM (#6) là **trụ cột** — đứng ngay trước hàng thủ, cover khi 2 fullback lên cao, distribute bóng. Không có DM tốt, toàn bộ formation sụp. Rodri (Man City) được xem là DM hay nhất thế giới hiện tại.

### Sự khác biệt giữa 4-3-3 và 4-2-3-1?

**4-3-3**: 1 DM + 2 box-to-box CM + 3 forwards (2 winger + 1 striker)
**4-2-3-1**: 2 DM + 1 số 10 + 3 forwards

4-3-3 linh hoạt hơn nhưng đòi hỏi DM đỉnh. 4-2-3-1 balance defense tốt hơn.

### Winger trong 4-3-3 chơi như thế nào?

Hiện đại = **inverted wingers** (LW chân phải, RW chân trái) cut vô trong sút hoặc chuyền. Thỉnh thoảng overlap với fullback. Pressing đầu tiên lên CB đối thủ khi đối thủ possession.

### 4-3-3 có tốt cho đội bóng trẻ không?

Phụ thuộc **kỹ thuật và thể chất**. 4-3-3 cần fullback thể lực, DM kỹ thuật, wingers nhanh. Đội trẻ thiếu experience thường an toàn hơn với **4-4-2 flat** hoặc **4-1-4-1** trước khi tiến lên 4-3-3.

### 3-4-3 khác 4-3-3 thế nào?

- **3-4-3**: 3 CB + 2 wingback cao + 4 midfielder + 3 forward (wide attackers)
- **4-3-3**: 4 hậu vệ + 3 tiền vệ + 3 forward

3-4-3 dùng wingback đẩy cao hơn, thích hợp khi đối thủ 4-3-3. Conte làm 3-4-3 nổi tiếng với Chelsea 2016-17.

## Bài viết liên quan trên ScoreLine

- [xG Expected Goals](/tin-bong-da/xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da) — đo hiệu quả 4-3-3 qua data
- [Premier League A-Z](/tin-bong-da/premier-league-cam-nang-a-z-cho-fan-bong-da-viet-nam) — giải có nhiều đội dùng 4-3-3
- [VAR guide](/tin-bong-da/var-la-gi-cach-hoat-dong-10-tinh-huong-kinh-dien-bong-da) — ảnh hưởng VAR đến 4-3-3 pressing
- [Lịch thi đấu Premier League](/lich-thi-dau/premier-league) — xem 4-3-3 live
- [Bảng xếp hạng Premier League](/bang-xep-hang/premier-league) — đội 4-3-3 nào đang top
- [Nhận định bóng đá](/nhan-dinh) — tactical analysis mỗi trận

## Nguồn tham khảo

- Jonathan Wilson — "Inverting the Pyramid: A History of Football Tactics"
- [Coaches' Voice — tactical breakdowns](https://www.coachesvoice.com)
- [Total Football Analysis](https://totalfootballanalysis.com)
- [The Athletic tactical pieces](https://theathletic.com/tag/tactics)`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');
  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    Object.assign(existing, {
      title: TITLE, description: DESCRIPTION, content: CONTENT, image: HERO_IMAGE,
      tags: ['4-3-3', 'sơ đồ bóng đá', 'tactical', 'Pep Guardiola', 'formation', 'kiến thức bóng đá'],
      category: 'analysis', source: 'editorial', status: 'published',
    });
    await existing.save();
    console.log('Updated:', existing.slug);
  } else {
    await new Article({
      originalTitle: TITLE, originalLink: `https://scoreline.io/tin-bong-da/${SLUG}`,
      source: 'editorial', slug: SLUG, title: TITLE, description: DESCRIPTION, content: CONTENT,
      tags: ['4-3-3', 'sơ đồ bóng đá', 'tactical', 'Pep Guardiola', 'formation', 'kiến thức bóng đá'],
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
