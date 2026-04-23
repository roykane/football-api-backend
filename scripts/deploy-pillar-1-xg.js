/**
 * Deploy Pillar Article #1: xG (Expected Goals) guide
 * v2: adds hero image, inline images, colored info/tip/warning/stats boxes,
 * and richer ul/li structure to avoid monotone long-form walls of text.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da';
const TITLE = 'xG (Expected Goals) là gì? Cách áp dụng vào phân tích bóng đá';
const DESCRIPTION = 'xG (Expected Goals) ước tính xác suất cú sút thành bàn dựa trên vị trí, góc sút, loại cơ hội. Hướng dẫn toàn diện cách áp dụng xG phân tích đội bóng, cầu thủ và dự đoán kết quả.';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200&h=630&fit=crop';

const IMG_PITCH = 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=1000&h=560&fit=crop';
const IMG_ACTION = 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1000&h=560&fit=crop';
const IMG_STATS = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000&h=560&fit=crop';
const IMG_CELEB = 'https://images.unsplash.com/photo-1610234834630-0dc866f64b42?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**xG (Expected Goals)** là chỉ số thống kê ước tính xác suất một cú sút trở thành bàn thắng, dựa trên các yếu tố như vị trí sút, góc sút, loại cơ hội và tình huống phòng ngự. Được phát triển từ 2012, xG hiện là tiêu chuẩn vàng trong bóng đá hiện đại để đánh giá chất lượng cơ hội, hiệu quả tấn công và phòng ngự — vượt xa thống kê bàn thắng đơn thuần.
:::

## Tại sao bàn thắng không phải là chỉ số tốt nhất

Trong 100 năm lịch sử bóng đá, chúng ta quen đánh giá một đội/cầu thủ qua **số bàn thắng**. Nhưng thống kê này có 3 vấn đề nghiêm trọng.

:::warning 3 vấn đề của việc chỉ nhìn bàn thắng
- **Yếu tố may rủi quá lớn** — cú sút 35m trúng xà rơi xuống thành bàn (xác suất 1-2%) vẫn tính là 1 bàn, y như penalty hỏng (xác suất 78% thành). Bàn thắng không phản ánh chất lượng cơ hội.
- **Mẫu quá nhỏ** — trung bình 2.5-3 bàn/trận. Biến động cao do may mắn. Một đội có thể thua 0-1 trong khi thống trị 25 cú sút.
- **Không dự đoán được tương lai** — chỉ nhìn bàn thắng, bạn không biết đội đang chơi tốt hay gặp may. Man United 2022-23 đầu mùa thắng 8/10 trận nhưng xG cảnh báo họ may mắn, và họ lao dốc nửa mùa sau.
:::

Cần một chỉ số **bỏ qua kết quả thực tế** và đo **chất lượng hiệu suất**. Đó chính là xG.

![Bóng đá hiện đại đánh giá qua dữ liệu, không chỉ tỷ số](${IMG_STATS})

## xG là gì? Định nghĩa chính xác

**Expected Goals (xG)** là chỉ số thống kê ước tính **xác suất cú sút trở thành bàn thắng**, biểu diễn dưới dạng số thập phân từ **0 đến 1**.

:::stats Xác suất các loại cú sút phổ biến
- **Cú penalty** → xG ≈ **0.76** (76% thành bàn)
- **Trong khu 5m50** → xG ≈ **0.30 – 0.45**
- **Vòng 16m50, trung tâm** → xG ≈ **0.15 – 0.25**
- **Ngoài 16m50, chính diện** → xG ≈ **0.04 – 0.08**
- **Đánh đầu cột xa đường tạt** → xG ≈ **0.08**
- **Sút từ 35m** → xG ≈ **0.02 – 0.04**
:::

Khi cộng dồn xG của tất cả cú sút trong trận, ta được **xG tổng** — số bàn thắng **kỳ vọng** đội đó nên ghi được dựa trên chất lượng cơ hội tạo ra.

:::example Ví dụ trực quan: Arsenal 3-1 Man United (15/01/2026)
- **Arsenal**: 18 cú sút — **xG 2.78** — ghi 3 bàn
- **Man United**: 9 cú sút — **xG 0.87** — ghi 1 bàn

Arsenal tạo cơ hội tốt hơn đáng kể (xG 2.78 vs 0.87). Ghi 3 bàn từ 2.78 xG = over-performing nhẹ. Man United ghi 1 bàn từ 0.87 xG = gần đúng kỳ vọng. Tỷ số 3-1 **phản ánh trung thực** trận đấu.
:::

## Cách tính xG — các biến đầu vào chính

![Mỗi vị trí sút trên sân có xác suất thành bàn khác nhau](${IMG_PITCH})

Mô hình xG được xây dựng dựa trên **machine learning** từ database hàng trăm ngàn cú sút lịch sử (500K-1M shots từ các giải đấu chính). Mô hình học xem cú sút với đặc điểm thế nào có xác suất thành bàn bao nhiêu.

### Vị trí sút — yếu tố quan trọng nhất (40% trọng số)

Khoảng cách tới khung thành và góc sút quyết định phần lớn xG:

- Càng gần → xG càng cao
- Càng chính diện → xG càng cao
- Góc sút hẹp (từ cánh) → xG thấp dù gần
- Cú sút từ hàng 5m50 chính diện = cơ hội vàng

### Loại cú sút

- **Chân thuận** → xG cao hơn chân không thuận khoảng **20%**
- **Đánh đầu** → xG thấp hơn sút chân cùng vị trí **30-40%**
- **Volley** → tùy tình huống, thường tương tự đánh đầu

### Tình huống tạo cơ hội (situation)

- **Penalty** → 0.76 cố định
- **Phạt trực tiếp** → trung bình 0.05-0.08
- **Từ key pass / đường chuyền ngang** → xG cao hơn 30-50% so với solo
- **Counter-attack** → xG cao hơn do defender ít
- **Từ phạt góc** → xG thấp (~0.03-0.06 trung bình)

### Yếu tố phòng thủ

- **Số defender chắn đường sút** → càng nhiều càng giảm xG
- **1-on-1 với thủ môn** → xG tăng mạnh
- **Áp lực pressing khi sút** → xG giảm 15-30% so với sút thoải mái

:::info Tổng kết cách tính
Mô hình xG hiện đại (Opta, StatsBomb, Understat) kết hợp **15-25 biến** và cho ra một con số xác suất. Công thức là kết quả training ML, không viết được bằng 1 công thức đơn giản, nhưng nguyên lý trên là **cốt lõi**.
:::

## xG Against (xGA) — chất lượng phòng ngự

**xGA** = tổng xG đối thủ tạo ra = xG đội **cho đối thủ**.

Chỉ số này đo **chất lượng phòng ngự thực sự**:

- **xGA thấp** → đội hạn chế đối thủ tốt, không cho cơ hội rõ ràng
- **xGA cao** → phòng ngự lỏng, để đối thủ có nhiều cơ hội tốt

:::example Phân biệt phòng ngự tốt vs may mắn
- **Đội A** thua 0-1 với **xGA 0.3** → phòng ngự **tốt** (chỉ cho đối thủ 1 cơ hội cực nhỏ rồi xui để vào lưới)
- **Đội B** thua 0-1 với **xGA 2.5** → phòng ngự **tệ** (cho đối thủ nhiều cơ hội tốt, may mắn chỉ thua 1)
:::

## 4 cách đọc chỉ số xG quan trọng

![Phân tích hiệu suất qua nhiều trận mới là đúng cách dùng xG](${IMG_ACTION})

### Over-performer (vượt xG)

Team ghi **nhiều bàn hơn xG**. Có 2 khả năng:

- **Finisher xuất sắc** (Haaland, Mbappe, Messi trong prime) — bền vững
- **Đang may mắn** — sẽ regression về trung bình

:::tip Cách phân biệt
- Pattern kéo dài **2-3 mùa** → finisher thật
- Chỉ **10-15 trận** → có thể may mắn, chờ regression
:::

### Under-performer (thiếu xG)

Team ghi **ít bàn hơn xG**. Có thể:

- **Finishers kém** (thiếu striker ngon)
- **Xui tạm thời** — sẽ tốt lên

Man United 2023-24 là case study điển hình: xG cao hơn bàn thắng nhiều tuần liên tiếp → báo hiệu sắp bùng nổ. Và họ bùng nổ thật ở nửa mùa sau.

### xG ≈ bàn thắng

Team performance **khớp** chất lượng cơ hội tạo ra. Trạng thái "đúng năng lực".

### xG Difference (xGD) — chỉ số tổng hợp

**xGD = xG – xGA**. Tổng hợp chất lượng đội bóng cả tấn công và phòng ngự.

:::stats Top 5 Premier League 2024/25 theo xGD/90
- **1. Liverpool**: +1.24
- **2. Man City**: +1.08
- **3. Arsenal**: +0.97
- **4. Chelsea**: +0.73
- **5. Nottingham Forest**: +0.51
:::

- xGD > 0.8/trận cả mùa → **elite team**
- xGD < 0 → đang **struggling**

## 5 cách ứng dụng xG trong thực tế

### 1. Đánh giá phong độ đội bóng

Thay vì nhìn thắng-hòa-thua, nhìn **xGD tích lũy**. Nếu một đội 6 trận liên tiếp xGD +0.5 nhưng hòa/thua liên tục → sắp bùng nổ.

### 2. Scout cầu thủ

- Cầu thủ ghi 15 bàn từ xG 10 → đang **may**, giá sẽ giảm
- Cầu thủ ghi 10 bàn từ xG 15 → **finisher tiềm ẩn**, mua giá rẻ, sẽ bùng nổ

:::tip Ứng dụng trong Fantasy Premier League
Top FPL managers dùng xG để chọn **differentials** — tìm cầu thủ underperforming xG để captain trước khi regression kéo giá lên.
:::

### 3. Dự đoán tỷ số trận đấu

Tính trung bình xG/xGA của 2 đội trong 10 trận gần nhất:

- **Home Goals dự đoán** = (Home xG + Away xGA) / 2
- **Away Goals dự đoán** = (Away xG + Home xGA) / 2

:::example Ví dụ dự đoán
Liverpool (xG/90 = 2.1) gặp West Ham (xGA/90 = 1.7):
- Liverpool dự đoán ghi ≈ (2.1 + 1.7) / 2 = **1.9 bàn**
- West Ham dự đoán ghi ≈ (West Ham xG + Liverpool xGA) / 2

Dùng thêm Poisson distribution sẽ ra probability thắng/hòa/thua chi tiết.
:::

### 4. Đánh giá nhận định "hot" hay "cool"

Một cầu thủ ghi 4 bàn trong 3 trận có "hot" thật?

- **xG 4.2 trong 3 trận** → đúng form, sẽ tiếp tục
- **xG 1.1 trong 3 trận** → sắp nguội, regression sắp tới

### 5. Quyết định chiến thuật

HLV phân tích **xG by zone** để biết đội mình tạo cơ hội ở đâu kém → điều chỉnh chiến thuật tương ứng.

## Hạn chế của xG — những thứ không đo được

![xG không đo được áp lực tâm lý của khoảnh khắc quyết định](${IMG_CELEB})

xG mạnh nhưng **không phải silver bullet**. Các hạn chế cần biết:

:::warning Những gì xG không capture được
- **Bối cảnh tâm lý** — xG 1-1 phút 89 không khác xG 1-1 phút 5, nhưng áp lực tâm lý khác hẳn
- **Chất lượng finisher cá nhân** — mô hình giả định "cầu thủ trung bình" sút. Messi sút ≠ hậu vệ sút cùng vị trí
- **Buildup play chất lượng** — 1 xG 1.5 từ counter dữ dội ≠ 1 xG 1.5 từ sút rời rạc
- **Set piece chuyên gia** — Arsenal dưới Nicolas Jover ghi nhiều hơn xG gợi ý cho phạt góc
- **Thủ môn đối thủ** — xG không tính yếu tố GK. Chỉ số **xGOT** và **PSxG** bù được
:::

## Các biến thể quan trọng của xG

- **xG** — xác suất cú sút thành bàn (core metric)
- **xA (Expected Assists)** — xG của cú sút xuất phát từ đường chuyền của bạn → đánh giá **playmaker**
- **xGOT** — chỉ tính cú sút trúng đích → đánh giá **finisher**
- **PSxG (Post-Shot xG)** — tính sau khi sút, thêm yếu tố quỹ đạo → đánh giá **thủ môn**
- **npxG (Non-penalty xG)** — trừ penalty → so sánh cầu thủ không bias
- **xGChain** — tổng xG mọi possession cầu thủ tham gia → đánh giá **đóng góp rộng**

## Xem xG ở đâu?

### Miễn phí

- **[FBref.com](https://fbref.com)** — toàn diện nhất, dữ liệu StatsBomb
- **[Understat.com](https://understat.com)** — visualize xG theo shot map
- **[SofaScore](https://sofascore.com)** — xG live trong trận

### Trả phí (cho analyst chuyên nghiệp)

- **StatsBomb** — data source gốc, phục vụ clubs và agencies
- **Opta Stats** — competitor của StatsBomb

### Apps

- **FotMob** — xG trong match stats (miễn phí)
- **LiveScore** — xG basic

:::tip Xem xG trên ScoreLine
Mỗi trang chi tiết trận đấu trên ScoreLine hiển thị **xG real-time** cùng các chỉ số thống kê khác. Truy cập qua menu **Lịch thi đấu** hoặc **Kết quả** và click vào trận bất kỳ.
:::

## Câu hỏi thường gặp

### xG bao nhiêu là tốt?

- **Đội bóng**: xG/90 > 1.8 là tấn công top-tier. < 1.0 là yếu.
- **Cầu thủ**: xG/90 > 0.5 là striker top. > 0.3 là striker ổn.

### Tại sao xG của Arsenal cao nhưng không vô địch?

xG cao **không đồng nghĩa** vô địch. Vô địch cần thêm:

- Finish đúng xG (không underperform)
- Không underperform xGA
- May mắn thời điểm
- Sức mạnh squad

Arsenal 2022-23 xG rất cao nhưng Man City vẫn vô địch do finish tốt hơn ở giai đoạn quyết định.

### xG có dự đoán chính xác 100% không?

Không. xG là **probabilistic**, không deterministic. Đội có xG cao hơn có **xác suất thắng cao hơn**, không phải luôn thắng. Trong dài hạn (20+ trận), xG gần đúng với kết quả thực tế.

### Fantasy Premier League có dùng xG không?

Có. Top FPL managers dùng xG để chọn **differentials**. Cầu thủ có npxG > 4 nhưng ghi 2 bàn = đang unlucky → captain pick tuần tới.

### Xem xG live trong lúc đá ở đâu?

**FotMob** và **SofaScore** cập nhật xG real-time sau mỗi cú sút. **ScoreLine.io** hiển thị xG trong từng match detail page.

## Kết luận

xG đã thay đổi cách bóng đá hiện đại phân tích hiệu quả — từ chỉ nhìn **bàn thắng** sang nhìn **chất lượng cơ hội**. Là chỉ số không hoàn hảo nhưng **vượt xa stats cũ** trong việc dự đoán xu hướng, scout cầu thủ, và đánh giá đội bóng khách quan.

:::tip Lời khuyên thực tế
Lần sau xem trận đấu, đừng chỉ nhìn tỷ số. Check xG sau trận — bạn sẽ phát hiện nhiều trận **có thể đã khác hẳn** nếu may mắn nghiêng về phía khác.
:::

## Nguồn tham khảo

- [FBref xG methodology](https://fbref.com/en/expected-goals-model-explained/)
- [Understat xG documentation](https://understat.com)
- [StatsBomb research articles](https://statsbomb.com/articles)
- Dữ liệu Premier League 2024-25`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');

  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    existing.title = TITLE;
    existing.description = DESCRIPTION;
    existing.content = CONTENT;
    existing.image = HERO_IMAGE;
    existing.tags = ['xG', 'Expected Goals', 'phân tích bóng đá', 'kiến thức bóng đá', 'thống kê'];
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
      tags: ['xG', 'Expected Goals', 'phân tích bóng đá', 'kiến thức bóng đá', 'thống kê'],
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
