/**
 * Deploy Pillar Article #1: xG (Expected Goals) guide
 * Run once to create editorial pillar content.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da';
const TITLE = 'xG (Expected Goals) là gì? Cách áp dụng vào phân tích bóng đá';
const DESCRIPTION = 'xG (Expected Goals) ước tính xác suất cú sút thành bàn dựa trên vị trí, góc sút, loại cơ hội. Hướng dẫn toàn diện cách áp dụng xG phân tích đội bóng, cầu thủ và dự đoán kết quả.';

const CONTENT = `**Tóm tắt nhanh**: xG (Expected Goals) là chỉ số thống kê ước tính xác suất một cú sút trở thành bàn thắng, dựa trên các yếu tố như vị trí sút, khoảng cách, góc sút, loại cơ hội và tình huống phòng ngự. Được phát triển bởi các chuyên gia phân tích dữ liệu bóng đá từ 2012, xG hiện là tiêu chuẩn vàng trong việc đánh giá chất lượng cơ hội, hiệu quả tấn công và phòng ngự của đội bóng/cầu thủ một cách khách quan, vượt xa thống kê bàn thắng đơn thuần.

## Tại sao bàn thắng không phải là chỉ số tốt nhất

Trong 100 năm lịch sử bóng đá hiện đại, chúng ta quen đánh giá một đội/cầu thủ qua số bàn thắng ghi được. Nhưng thống kê này có 3 vấn đề nghiêm trọng.

**Vấn đề 1 — Yếu tố may rủi quá lớn.** Một cú sút từ 35m trúng ngang xà rơi xuống vạch vôi cho bàn thắng, và một cú đá penalty sút ra ngoài — cùng tính 1 bàn thắng và 0 bàn. Thực tế, cú sút 35m thành bàn là một cơ hội xác suất khoảng 1-2%, còn penalty là khoảng 78%. Bàn thắng không phản ánh chất lượng cơ hội.

**Vấn đề 2 — Mẫu quá nhỏ.** Trung bình 1 trận bóng đá có 2.5-3 bàn thắng. Với mẫu nhỏ như vậy, kết quả dễ bị biến động do may mắn. Một đội có thể thua 0-1 trong khi thống trị trận đấu với 25 cú sút.

**Vấn đề 3 — Không dự đoán được tương lai.** Nếu chỉ nhìn bàn thắng, bạn không biết một đội đang chơi tốt hay chỉ gặp may. Manchester United mùa 2022-23 đầu mùa thắng 8/10 trận nhưng xG nói họ may mắn — và đúng vậy, nửa mùa sau họ lao dốc.

Cần một chỉ số bỏ qua kết quả thực tế và đo chất lượng hiệu suất. Đó là xG.

## xG là gì? Định nghĩa chính xác

**Expected Goals (xG)** là một chỉ số thống kê ước tính xác suất một cú sút trở thành bàn thắng, biểu diễn dưới dạng số thập phân từ 0 đến 1.

Xác suất các loại cú sút phổ biến:

- Cú sút penalty có xG khoảng 0.76 (76% xác suất thành bàn)
- Cú sút từ vạch 16m50 trung tâm có xG khoảng 0.25
- Cú sút từ 35m có xG khoảng 0.02-0.04
- Cú đánh đầu từ cột xa trong đường tạt có xG khoảng 0.08

Khi cộng dồn xG của tất cả cú sút trong trận, ta được xG tổng — số bàn thắng kỳ vọng đội đó nên ghi được dựa trên chất lượng cơ hội tạo ra.

### Ví dụ trực quan

Trận Arsenal vs Manchester United 15/01/2026 kết quả thật 3-1. Thống kê chi tiết:

- Arsenal: 18 cú sút, xG 2.78, ghi 3 bàn
- Manchester United: 9 cú sút, xG 0.87, ghi 1 bàn

Arsenal tạo cơ hội tốt hơn đáng kể với xG 2.78 so với 0.87. Arsenal ghi 3 bàn từ 2.78 xG nghĩa là over-performing nhẹ. Manchester United ghi 1 bàn từ 0.87 xG là gần đúng kỳ vọng. Tỷ số 3-1 phản ánh trung thực trận đấu.

## Cách tính xG và các biến đầu vào

Mô hình xG được xây dựng dựa trên machine learning từ database hàng trăm ngàn cú sút lịch sử (thường 500K-1M shots từ các giải đấu chính). Mô hình học xem cú sút với đặc điểm như thế nào có xác suất thành bàn bao nhiêu.

### Vị trí sút là yếu tố quan trọng nhất

Khoảng cách tới khung thành và góc sút chiếm khoảng 40% trọng số. Cú sút càng gần và càng chính diện thì xG càng cao.

- Penalty từ 11m: xG 0.76 cố định
- Trong khu 5m50: xG 0.30-0.45
- Trong vòng 16m50, trung tâm: xG 0.15-0.25
- Ngoài vòng 16m50, chính diện: xG 0.04-0.08
- Bên cánh, góc hẹp: xG 0.02-0.05
- Từ 30m trở lên: xG dưới 0.02

### Loại cú sút ảnh hưởng đáng kể

- Chân thuận cho xG cao hơn chân không thuận khoảng 20%
- Đánh đầu cho xG thấp hơn so với sút chân cùng vị trí khoảng 30-40%
- Volley phụ thuộc tình huống, thường tương tự đánh đầu

### Loại cơ hội (situation)

- Từ quả phạt trực tiếp: trung bình xG 0.05-0.08
- Open play từ đường chuyền ngang (key pass): xG cao hơn 30-50% so với solo
- Fast break hoặc counter: xG cao hơn do defender ít
- Từ phạt góc: xG thấp khoảng 0.03-0.06 trung bình

### Số lượng cầu thủ phòng ngự

Nếu có defender đứng chắn đường sút, xG giảm. Nếu 1-on-1 với thủ môn, xG tăng mạnh.

### Áp lực khi sút

Cú sút dưới áp lực pressing có xG giảm 15-30% so với sút thoải mái không áp lực.

### Kết hợp các yếu tố

Mô hình xG hiện đại của Opta, StatsBomb, Understat kết hợp 15-25 biến và cho ra một con số xác suất. Công thức là kết quả training machine learning, không viết được bằng 1 công thức đơn giản, nhưng nguyên lý trên là cốt lõi.

## xG Against (xGA) — đo chất lượng phòng ngự

**xGA** là tổng xG đối thủ tạo ra, tức là xG đội cho đối thủ. Chỉ số này đo chất lượng phòng ngự thực sự:

- xGA thấp có nghĩa đội hạn chế đối thủ tốt, không cho cơ hội rõ ràng
- xGA cao có nghĩa phòng ngự lỏng, để đối thủ có nhiều cơ hội tốt

Ví dụ thực tế: Đội A thua 0-1 với xGA chỉ 0.3 (chỉ cho đối thủ 1 cơ hội cực nhỏ rồi họ ghi bàn) là phòng ngự tốt nhưng xui. Đội B thua 0-1 với xGA 2.5 là phòng ngự tệ nhưng may.

## Cách đọc chỉ số xG — 4 tình huống quan trọng

### Over-performer (vượt xG)

Team ghi nhiều bàn hơn xG. Có 2 khả năng. Thứ nhất, có cầu thủ finisher xuất sắc như Haaland, Mbappe, Messi trong prime. Thứ hai, đang may mắn và sẽ regression về trung bình.

Cách phân biệt: nếu pattern kéo dài 2-3 mùa thì là finisher thật. Nếu chỉ 10-15 trận thì có thể may.

### Under-performer (thiếu xG)

Team ghi ít bàn hơn xG. Có thể do finishers kém (thiếu striker ngon) hoặc xui tạm thời và sẽ tốt lên.

Manchester United 2023-24 là case study điển hình: xG cao hơn bàn thắng nhiều tuần liên tiếp báo hiệu sắp bùng nổ, và họ bùng nổ thật ở nửa mùa sau.

### xG tương đương bàn thắng

Team performance khớp với chất lượng cơ hội tạo ra. Trạng thái đúng năng lực.

### xG Difference (xGD) — chỉ số tổng hợp

**xGD = xG trừ xGA**. Chỉ số này tổng hợp chất lượng đội bóng cả tấn công lẫn phòng ngự.

Top 5 Premier League 2024-25 theo xGD trung bình mỗi trận (FBref):

1. Liverpool: +1.24
2. Man City: +1.08
3. Arsenal: +0.97
4. Chelsea: +0.73
5. Nottingham Forest: +0.51

xGD trên 0.8 mỗi trận trong cả mùa là elite team. xGD âm nghĩa là đội đang struggling.

## 5 cách ứng dụng xG trong thực tế

### Đánh giá phong độ đội bóng

Thay vì nhìn thắng-hòa-thua, nhìn xGD tích lũy. Nếu một đội 6 trận liên tiếp có xGD trên +0.5 nhưng hòa hoặc thua liên tục, đội đó sắp bùng nổ.

### Scout cầu thủ

Cầu thủ ghi 15 bàn từ xG 10 đang may. Cầu thủ ghi 10 bàn từ xG 15 là finisher tiềm ẩn, đáng mua với giá rẻ.

Trong Football Manager và Fantasy Premier League, xG là công cụ scout chính để tìm differential hoặc sleeper picks.

### Dự đoán kết quả trận đấu

Tính trung bình xG và xGA của 2 đội trong 10 trận gần nhất để ước lượng tỷ số khả dĩ. Công thức đơn giản:

- Predicted Home Goals = (Home xG trung bình + Away xGA trung bình) / 2
- Predicted Away Goals = (Away xG trung bình + Home xGA trung bình) / 2

Ví dụ Liverpool với xG 2.1 mỗi trận gặp West Ham với xGA 1.7 mỗi trận: dự đoán Liverpool ghi khoảng 1.9 bàn, West Ham tính tương tự với chỉ số ngược lại.

### Đánh giá nhận định hot hay cool

Một cầu thủ ghi 4 bàn trong 3 trận có thực sự hot không? Check xG:

- xG 4.2 trong 3 trận nghĩa là đúng form, sẽ tiếp tục
- xG 1.1 trong 3 trận nghĩa là sắp nguội, regression sắp tới

### Quyết định chiến thuật

HLV phân tích xG by zone để biết đội mình tạo cơ hội ở đâu kém rồi điều chỉnh chiến thuật.

## Hạn chế của xG

xG mạnh nhưng không phải silver bullet. Các hạn chế quan trọng cần biết.

**Không tính bối cảnh tâm lý.** xG 1-1 ở phút 89 không khác gì xG 1-1 ở phút 5 theo công thức. Nhưng áp lực tâm lý khác hẳn.

**Bỏ qua chất lượng finisher cá nhân.** xG giả định cầu thủ trung bình thực hiện cú sút. Nếu Messi sút thì xG thực tế cao hơn do kỹ thuật cá nhân. xG 0.3 với Haaland sút khác xG 0.3 với hậu vệ trung bình sút.

**Không phản ánh buildup play.** Một đội tạo xG 1.5 từ 1 cú counter-attack dữ dội khác hẳn đội khác tạo xG 1.5 từ 10 cú sút rời rạc. Chất lượng tấn công có thể khác nhau dù xG bằng nhau.

**Set piece quirk.** xG thấp cho set piece (khoảng 0.05-0.08) nhưng một số đội chuyên gia set piece như Arsenal dưới Nicolas Jover ghi nhiều hơn xG gợi ý. Model chưa capture được chuyên môn của coach.

**Goalkeeper không được tính.** xG không có yếu tố thủ môn đối thủ giỏi hay không. Dù vậy, chỉ số xGOT (xG on target) hoặc PSxG (Post-Shot xG) bù được điểm này.

## Các biến thể của xG bạn nên biết

- **xG**: xác suất cơ hội thành bàn, dùng đánh giá cơ hội
- **xA (Expected Assists)**: xG của cú sút xuất phát từ đường chuyền của bạn, dùng đánh giá playmaker
- **xGOT**: chỉ tính cú sút trúng đích, dùng đánh giá finisher
- **PSxG (Post-Shot xG)**: tính sau khi sút thêm yếu tố quỹ đạo, dùng đánh giá thủ môn
- **npxG (Non-penalty xG)**: trừ penalty, dùng so sánh cầu thủ không bias
- **xGChain**: tổng xG của mọi possession cầu thủ tham gia, dùng đánh giá đóng góp rộng

## Xem xG của trận đấu, đội, cầu thủ ở đâu

### Miễn phí

- **[FBref.com](https://fbref.com)** — toàn diện nhất, miễn phí, dữ liệu từ StatsBomb
- **[Understat.com](https://understat.com)** — visualize xG theo shot map, miễn phí
- **[SofaScore](https://sofascore.com)** — xG live trong trận

### Trả phí

- **StatsBomb** — data source gốc, cho agencies hoặc clubs
- **Opta Stats** — competitor của StatsBomb

### Apps

- **FotMob** — xG hiển thị trong match stats, miễn phí
- **LiveScore** — xG basic

## Câu hỏi thường gặp về xG

### xG bao nhiêu là tốt

Với đội bóng, xG mỗi trận trên 1.8 là tấn công top-tier, dưới 1.0 là yếu. Với cầu thủ, xG mỗi trận trên 0.5 là striker top, trên 0.3 là striker ổn.

### Tại sao xG của Arsenal cao nhưng không vô địch

xG cao không đồng nghĩa vô địch. Vô địch cần thêm: finish đúng xG, không under-perform xGA, may mắn thời điểm, và sức mạnh squad. Arsenal 2022-23 xG rất cao nhưng Manchester City vẫn vô địch do finish tốt hơn ở giai đoạn quyết định.

### xG có dự đoán chính xác 100% không

Không. xG là probabilistic, không deterministic. Đội có xG cao hơn có xác suất thắng cao hơn, nhưng không phải luôn thắng. Trong dài hạn từ 20 trận trở lên, xG gần đúng với kết quả thực tế.

### Fantasy Premier League có dùng xG không

Có. Top FPL managers dùng xG để chọn differentials. Ví dụ cầu thủ có npxG trên 4 nhưng mới ghi 2 bàn là đang unlucky, có thể là captain pick tốt cho tuần tới.

### Xem xG live trong lúc đang đá ở đâu

FotMob và SofaScore cập nhật xG real-time sau mỗi cú sút. Trên ScoreLine.io, xG hiển thị trong từng match detail page.

## Kết luận

xG đã thay đổi cách thế giới bóng đá phân tích hiệu quả, từ chỉ nhìn bàn thắng sang nhìn chất lượng cơ hội. Là chỉ số không hoàn hảo nhưng vượt xa stats cũ trong việc dự đoán xu hướng, scout cầu thủ, và đánh giá đội bóng khách quan.

Lần sau xem trận đấu, đừng chỉ nhìn tỷ số. Check xG sau trận và bạn sẽ phát hiện nhiều trận có thể đã khác hẳn.

## Nguồn tham khảo

Bài viết tổng hợp dựa trên: [FBref xG methodology](https://fbref.com/en/expected-goals-model-explained/), [Understat documentation](https://understat.com), [StatsBomb research articles](https://statsbomb.com/articles), và dữ liệu Premier League 2024-25.`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');

  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    console.log('Already exists, updating content:', existing.slug);
    existing.title = TITLE;
    existing.description = DESCRIPTION;
    existing.content = CONTENT;
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
      image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=630&fit=crop',
      category: 'analysis',
      status: 'published',
      pubDate: new Date(),
      aiModel: 'editorial',
    });
    await article.save();
    console.log('Created:', article.slug);
  }

  // Invalidate sitemap cache
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
