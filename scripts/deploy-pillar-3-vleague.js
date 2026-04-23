/**
 * Deploy Pillar Article #3: V-League 1 — Cẩm nang cho fan bóng đá Việt Nam
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'v-league-1-cam-nang-toan-tap-cho-fan-bong-da-viet-nam';
const TITLE = 'V-League 1: Cẩm nang toàn tập cho fan bóng đá Việt Nam';
const DESCRIPTION = 'V-League 1 là giải bóng đá cao nhất Việt Nam với 14 đội thi đấu 26 vòng. Hướng dẫn toàn diện về lịch sử, format, CLB nổi bật, ngôi sao và cách theo dõi V-League.';
// Unique image set for pillar #3 — zero overlap with pillars #1 or #2.
const HERO_IMAGE = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=630&fit=crop';

const IMG_STADIUM = 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=1000&h=560&fit=crop';
const IMG_MATCH = 'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=1000&h=560&fit=crop';
const IMG_PLAYER = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=1000&h=560&fit=crop';
const IMG_TROPHY = 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**V-League 1** là giải bóng đá chuyên nghiệp cao nhất Việt Nam, thành lập 1980 (chuyên nghiệp hóa 2000). Có **14 đội** thi đấu **26 vòng** mỗi mùa. Nhà vô địch được suất **AFC Champions League 2**, 2 đội cuối xuống **V-League 2**. Các CLB lịch sử gồm Hà Nội FC, Hoàng Anh Gia Lai, Công An Nhân Dân, Viettel, Thể Công, Nam Định. Giải là bệ phóng cho nhiều cầu thủ Đội tuyển Việt Nam như Quang Hải, Công Phượng, Hùng Dũng.
:::

## V-League 1 là gì?

**V-League 1** (chính thức: **Night Wolf V.League 1**, tên nhà tài trợ) là **giải bóng đá chuyên nghiệp cấp cao nhất Việt Nam**, do Công ty Cổ phần Bóng đá Chuyên nghiệp Việt Nam (VPF) tổ chức.

:::stats V-League by numbers
- **Tên gọi cũ**: Giải bóng đá vô địch quốc gia (1980-1999), V-League (từ 2000)
- **Thành lập**: 1980 (thời bao cấp)
- **Chuyên nghiệp hóa**: 2000
- **Số đội hiện tại**: 14 đội (từ mùa 2023/24)
- **Số trận/mùa**: 182 (14 đội × 26 vòng)
- **Đội vô địch nhiều nhất**: Hà Nội FC (6 lần từ 2010, gồm cả tên cũ T&T Hà Nội)
- **Lịch thi đấu**: từ tháng 8 đến tháng 6 năm sau (dạng châu Âu từ 2023)
:::

Trước 2023, V-League theo calendar năm (tháng 3 đến tháng 10). Từ 2023/24, LĐBĐVN (VFF) chuyển sang **calendar châu Âu** (8-6) để đồng bộ với AFC và Thai League.

![Sân vận động VN — nơi diễn ra cuồng nhiệt V-League](${IMG_STADIUM})

## Format mùa giải V-League 1

### Thể thức thi đấu

- **14 đội** thi đấu **vòng tròn 2 lượt** (home-away)
- Mỗi đội đá **26 trận** (13 sân nhà + 13 sân khách)
- Một số mùa có **vòng super** (top 6 sau vòng thường) nhưng hiện đã bỏ

### Hệ thống tính điểm

:::info Điểm V-League (giống quốc tế)
- **Thắng**: 3 điểm
- **Hòa**: 1 điểm
- **Thua**: 0 điểm
- **Vô địch**: đội nhiều điểm nhất sau 26 vòng
:::

![V-League mang đến không khí cuồng nhiệt trên sân trong cả mùa](${IMG_MATCH})

### Tiebreaker

Khi đồng điểm, xếp hạng theo:

1. **Điểm đối đầu trực tiếp**
2. **Hiệu số đối đầu trực tiếp**
3. **Hiệu số toàn mùa**
4. **Số bàn thắng toàn mùa**
5. **Bốc thăm** (cực hiếm)

Lưu ý V-League ưu tiên **head-to-head trước goal difference** — khác EPL (EPL ưu tiên goal difference trước). Điều này có thể quyết định chức vô địch trong mùa căng thẳng.

## Quyền lợi + xuống hạng

### Suất dự cúp châu lục

:::stats Quyền lợi top V-League 1 theo AFC
- **Vô địch V-League** → vòng play-off **AFC Champions League Elite**
- **Á quân V-League** → vòng bảng **AFC Champions League 2**
- **Vô địch Cúp Quốc Gia** → vòng bảng **AFC Champions League 2**
- **Hạng 3 V-League** → có thể có suất **AFC Challenge League** (tùy ranking VN)
:::

Hiện tại (2024-26) VN có:
- **1 suất** AFC Champions League Elite (qua play-off)
- **2 suất** AFC Champions League 2 (á quân VLeague + CLB vô địch Cúp QG)
- **1 suất** AFC Challenge League

### Xuống hạng (Relegation)

- **2 đội cuối bảng** (vị trí 13, 14) xuống **V-League 2** mùa sau
- **2 đội đầu V-League 2** thăng hạng lên V-League 1
- Không có playoff giữa V-League 1 #12 và V-League 2 #3

## Các CLB huyền thoại V-League

![CLB V-League — bệ phóng cho cầu thủ lên tuyển](${IMG_TROPHY})

### 1. Hà Nội FC (T&T Hà Nội cũ)

- **Thành lập**: 2006
- **Sân nhà**: Sân Hàng Đẫy (22,500 chỗ)
- **Vô địch V-League**: 6 lần (2010, 2013, 2016, 2018, 2019, 2022)
- **Ngôi sao**: Nguyễn Quang Hải (2015-2022), Nguyễn Công Phượng (thời gian ngắn), Trần Minh Vương

### 2. Hoàng Anh Gia Lai (HAGL)

- **Thành lập**: 2001
- **Sân nhà**: Sân Pleiku (12,000 chỗ)
- **Vô địch V-League**: 2 lần (2003, 2004)
- **Biệt danh**: "Đội của Bầu Đức" (Chủ tịch Đoàn Nguyên Đức)
- **Nổi bật**: Học viện bóng đá HAGL Arsenal JMG — sản sinh Công Phượng, Tuấn Anh, Xuân Trường, Văn Toàn

### 3. Viettel FC (Thể Công cũ)

- **Thành lập**: 1954 (Thể Công), refounded 2009 (Viettel)
- **Sân nhà**: Sân Hàng Đẫy (chung với Hà Nội FC)
- **Vô địch V-League**: 1 lần (2020)
- **Đặc điểm**: tài trợ bởi Tập đoàn Viettel, học viện bài bản

### 4. Nam Định FC

- **Thành lập**: 1965
- **Sân nhà**: Sân Thiên Trường (30,000 chỗ — sức chứa lớn nhất VN)
- **Vô địch V-League**: 2 lần (1984-85 First Division cũ, 2023/24)
- **Fan culture mạnh nhất**: Hội CĐV Nam Định nổi tiếng nhiệt huyết

### 5. Công An Hà Nội

- **Thành lập**: 1956 (các tên gọi khác nhau, re-established 2014)
- **Sân nhà**: Sân Hàng Đẫy
- **Vô địch V-League**: 1 lần (2023)
- **Đặc điểm**: CLB của Bộ Công An, đầu tư mạnh từ 2022

### 6. Thành Phố Hồ Chí Minh FC

- **Thành lập**: 1975 (trước là Cảng Sài Gòn)
- **Sân nhà**: Sân Thống Nhất (25,000 chỗ)
- **Vô địch V-League**: 0 (á quân 2019, 2020)
- **Cầu thủ nổi bật**: Công Phượng (2020-21)

## Cầu thủ huyền thoại + đương đại

### Huyền thoại xưa

- **Lê Huỳnh Đức** — "Vua phá lưới", HLV hiện tại Đà Nẵng
- **Lê Công Vinh** — kỷ lục 51 bàn ĐTQG, retired 2016
- **Nguyễn Hồng Sơn** — midfielder huyền thoại 1990s-2000s
- **Nguyễn Minh Phương** — đội trưởng AFF Cup 2008 (vô địch đầu tiên)

### Thế hệ vàng 2018-2024 (AFF Cup + Asian Cup)

![Cầu thủ VN ở V-League — bệ phóng lên tuyển](${IMG_PLAYER})

- **Nguyễn Quang Hải** — Pau FC (France), biểu tượng thế hệ
- **Nguyễn Công Phượng** — HAGL alumni, HLV bóng đá trẻ
- **Đỗ Hùng Dũng** — midfielder Hà Nội, ĐT captain
- **Nguyễn Tiến Linh** — striker Bình Dương, top scorer ĐT
- **Nguyễn Hoàng Đức** — midfielder Viettel, technical best VN
- **Bùi Tiến Dũng** — thủ môn huyền thoại U23 Thường Châu 2018
- **Đoàn Văn Hậu** — hậu vệ trái chất lượng châu lục
- **Phạm Tuấn Hải** — striker Hà Nội, form hot 2023-24

:::tip Đặc điểm cầu thủ V-League
Nhiều cầu thủ V-League có thể thi đấu cho ĐTVN khi đủ điều kiện. V-League là **sân chơi quan trọng nhất** cho HLV tuyển xem phong độ cầu thủ tiềm năng. Xem nhận định và phong độ cầu thủ VN tại [mục Cầu thủ](/cau-thu).
:::

## Xem V-League 1 tại Việt Nam

### Kênh chính thức

:::info Các kênh phát sóng V-League 2025/26
- **FPT Play** — bản quyền chính thức tất cả trận V-League 1
- **HTV Sports** (HTV9 HD) — một số trận chọn lọc
- **VTV5, VTV6** — các trận quan trọng (đặc biệt derby)
- **SCTV Sports** — cable TV
:::

### App streaming

- **FPT Play app** (iOS/Android) — live + replay full
- **VTVgo** — phát lại các trận VTV đã chiếu
- **Vie Channel** — highlight + tin tức

### Chi phí

- **FPT Play V-League pack**: ~50-100K VND/tháng (rẻ nhất so với các giải quốc tế)
- Truyền hình cáp thông thường đã có kênh thể thao phát V-League

### Vé xem trực tiếp

- **Vé thường**: 50-100K VND (đa số sân)
- **Vé VIP / khán đài chính**: 200-500K VND
- **Vé derby** (Hà Nội vs HAGL, V-League playoff): tăng gấp 2-3x

## Mùa giải V-League đáng chú ý

### 2023/24 — Nam Định vô địch bất ngờ

Nam Định vô địch V-League lần đầu sau **39 năm** (từ 1985), thay thế HAGL và Hà Nội dominance. Đám đông Thiên Trường sau trận final biến thành festival fan.

### 2022 — Hà Nội FC trở lại đỉnh cao

Vô địch lần thứ 6 sau 3 mùa không ngai. Xuất hiện Quang Hải, Văn Hậu — team back to back top.

### 2020 — Viettel vô địch, Covid gián đoạn

Viettel vô địch mùa đầu về V-League 1 (re-promoted 2019). Covid làm mùa giải phân chia thành nhiều giai đoạn với phòng chống dịch khắt khe.

### 2003-04 — HAGL kỷ nguyên bầu Đức

Đầu tư của Đoàn Nguyên Đức biến HAGL thành "CLB bóng đá VN đầu tiên chuyên nghiệp hóa thực thụ". Hai chức vô địch liên tiếp, đưa bóng đá Pleiku vào bản đồ.

## So sánh V-League với các giải SEA

:::stats V-League trong bối cảnh Đông Nam Á
- **Thai League 1** (Thai-League) — xếp hạng AFC cao nhất ĐNÁ, kỹ thuật tốt
- **V-League 1** — xếp hạng thứ 2-3 ĐNÁ (ngang Malaysia, Indonesia tùy năm)
- **Liga 1 Indonesia** — số lượng CĐV đông nhất (bản quyền TV giá 5-6x V-League)
- **Malaysia Super League** — ngang V-League, đầu tư lớn
- **Singapore Premier League** — số đội ít (9), kỹ thuật cao nhưng scale nhỏ
- **Filipino PFL** — mới nổi, ít cạnh tranh
:::

Ranking AFC theo CLB coefficient 2024: Thai League #1, V-League #2-3 (lên xuống theo năm AFC CL performance của CLB VN).

## Câu hỏi thường gặp

### V-League 1 là gì?

V-League 1 là **giải bóng đá chuyên nghiệp cấp cao nhất Việt Nam**, do VPF tổ chức, có 14 đội thi đấu 26 vòng mỗi mùa.

### V-League có bao nhiêu đội?

**14 đội** từ mùa 2023/24 (trước đó 13-14 đội thay đổi qua các mùa). Mỗi đội thi đấu **26 trận** (home-away với 13 đội khác).

### V-League diễn ra khi nào?

Từ mùa 2023/24, V-League theo calendar châu Âu: **tháng 8 đến tháng 6** năm sau. Trước đó, V-League theo calendar năm (tháng 3 đến tháng 10).

### Ai vô địch V-League nhiều nhất?

**Hà Nội FC** (bao gồm cả tên cũ T&T Hà Nội) với **6 danh hiệu**: 2010, 2013, 2016, 2018, 2019, 2022.

### V-League có bao nhiêu ngoại binh mỗi đội?

Hiện tại mỗi CLB V-League 1 được đăng ký tối đa **3 ngoại binh thi đấu/trận** (không gốc VN). Quy định thay đổi theo mùa, xem thông báo chính thức VPF.

### Đội nào có sân lớn nhất V-League?

**Sân Thiên Trường (Nam Định)** với **30,000 chỗ** là sân vận động có sức chứa lớn nhất đang sử dụng tại V-League 1.

### Cách xem V-League 1 tại Việt Nam?

Đăng ký **FPT Play** (~50-100K VND/tháng) để xem tất cả trận. HTV Sports, VTV5 phát một số trận chọn lọc miễn phí (cho các trận quan trọng như derby hoặc chung kết).

### Vô địch V-League được quyền gì?

Đội vô địch V-League 1 được **suất play-off AFC Champions League Elite** — giải câu lạc bộ danh giá nhất châu Á. Á quân và vô địch Cúp Quốc Gia được suất **AFC Champions League 2**.

## Bài viết liên quan trên ScoreLine

- [Lịch thi đấu V-League 1](/lich-thi-dau/v-league-1) — fixtures tuần tới
- [Bảng xếp hạng V-League](/bang-xep-hang/v-league-1) — cập nhật mỗi trận
- [Kết quả bóng đá VN hôm qua](/ket-qua/hom-qua) — tất cả trận V-League
- [Cầu thủ Việt Nam](/cau-thu) — profile các ngôi sao V-League và ĐTVN
- [Nhận định các trận V-League](/nhan-dinh) — phân tích trước giờ bóng lăn
- [Premier League A-Z](/tin-bong-da/premier-league-cam-nang-a-z-cho-fan-bong-da-viet-nam) — đọc thêm về giải Anh
- [xG Expected Goals](/tin-bong-da/xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da) — áp dụng thống kê vào V-League

## Nguồn tham khảo

- [VPF — Công ty Cổ phần Bóng đá Chuyên nghiệp Việt Nam](https://vpf.vn)
- [VFF — Liên đoàn Bóng đá Việt Nam](https://vff.org.vn)
- [Transfermarkt V-League profile](https://www.transfermarkt.com/v-league-1/startseite/wettbewerb/VIE)
- Dữ liệu lịch sử các mùa V-League`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');

  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    existing.title = TITLE;
    existing.description = DESCRIPTION;
    existing.content = CONTENT;
    existing.image = HERO_IMAGE;
    existing.tags = ['V-League', 'V-League 1', 'bóng đá Việt Nam', 'Hà Nội FC', 'HAGL', 'kiến thức bóng đá'];
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
      tags: ['V-League', 'V-League 1', 'bóng đá Việt Nam', 'Hà Nội FC', 'HAGL', 'kiến thức bóng đá'],
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
