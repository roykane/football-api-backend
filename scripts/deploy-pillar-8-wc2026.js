/**
 * Deploy Pillar #8: World Cup 2026 toàn tập — USA/Canada/Mexico
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'world-cup-2026-toan-tap-usa-canada-mexico-48-doi';
const TITLE = 'World Cup 2026 Toàn Tập: USA, Canada, Mexico — 48 Đội, 104 Trận';
const DESCRIPTION = 'World Cup 2026 diễn ra tại USA, Canada, Mexico từ 11/6 đến 19/7/2026. Format mới 48 đội, 104 trận, 16 thành phố chủ nhà. Tất cả thông tin chi tiết: lịch, bảng, đội dự, VN cơ hội và cách xem.';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1200&h=630&fit=crop';

const IMG_HOSTS = 'https://images.unsplash.com/photo-1540379708242-14a809bef941?w=1000&h=560&fit=crop';
const IMG_TEAMS = 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=1000&h=560&fit=crop';
const IMG_SCHEDULE = 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?w=1000&h=560&fit=crop';
const IMG_TROPHY = 'https://images.unsplash.com/photo-1565992441121-4367c2967103?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**World Cup 2026** là VCK FIFA World Cup lần thứ 23, diễn ra từ **11/6 – 19/7/2026** tại **3 quốc gia chủ nhà: USA, Canada, Mexico** — lần đầu tiên có 3 chủ nhà. **48 đội** tham dự (tăng từ 32), chơi **104 trận** (tăng từ 64) tại **16 thành phố**. Format mới: 12 bảng 4 đội, top 2 + 8 đội hạng 3 tốt nhất vào vòng knockout. VN không qualify. Tại VN, VTV sẽ phát sóng miễn phí.
:::

## World Cup 2026 — những con số lịch sử

:::stats WC 2026 by numbers
- **Thời gian**: 11/6 – 19/7/2026 (39 ngày)
- **Chủ nhà**: USA (11 sân), Canada (2 sân), Mexico (3 sân) — 16 sân tổng
- **Số đội**: 48 (tăng từ 32) — lần đầu format 48 đội
- **Tổng trận**: 104 (tăng từ 64) — record
- **Kỳ WC lần thứ**: 23
- **Chu kỳ**: kỷ niệm 100 năm WC đầu tiên (1930)
- **Ngân sách chi phí**: ~$11 tỷ USD
- **FIFA revenue dự kiến**: $11 tỷ (tăng 70% so với Qatar 2022)
- **Khán giả dự kiến**: 5.5 triệu người xem trực tiếp (record)
:::

![WC 2026 có 16 sân cỡ siêu lớn trải dài 3 quốc gia Bắc Mỹ](${IMG_HOSTS})

## 16 thành phố chủ nhà + 16 sân vận động

### USA (11 cities)

1. **Atlanta** — Mercedes-Benz Stadium (71,000 chỗ) — 8 trận
2. **Boston** — Gillette Stadium (65,878)
3. **Dallas** — AT&T Stadium (80,000) — 9 trận
4. **Houston** — NRG Stadium (72,220)
5. **Kansas City** — Arrowhead Stadium (76,416)
6. **Los Angeles** — SoFi Stadium (70,240) — 8 trận bao gồm knockout
7. **Miami** — Hard Rock Stadium (65,326)
8. **New York/New Jersey** — MetLife Stadium (82,500) — **trận chung kết 19/7/2026**
9. **Philadelphia** — Lincoln Financial Field (69,596)
10. **San Francisco Bay Area** — Levi's Stadium (68,500)
11. **Seattle** — Lumen Field (68,740)

### Canada (2 cities)

12. **Toronto** — BMO Field (mở rộng thành 45,000)
13. **Vancouver** — BC Place (54,500)

### Mexico (3 cities)

14. **Guadalajara** — Estadio Akron (49,850)
15. **Mexico City** — Estadio Azteca (87,000) — **trận khai mạc 11/6/2026**
16. **Monterrey** — Estadio BBVA (53,500)

:::tip Estadio Azteca lịch sử
**Estadio Azteca (Mexico City)** là sân duy nhất đã tổ chức **3 kỳ World Cup** (1970, 1986, 2026). Đây cũng là nơi diễn ra pha "Bàn tay của Chúa" của Maradona năm 1986.
:::

## Format 48 đội — hệ thống mới

:::info Cách thức 48 đội thi đấu
- **Vòng bảng**: 12 bảng, mỗi bảng 4 đội, thi đấu vòng tròn (3 trận/đội)
- **Top 2 mỗi bảng** → thẳng vào **round of 32**
- **8 đội hạng 3 tốt nhất** → qualify thêm → **round of 32** đủ 32 đội
- **Knockout**: R32 → R16 → QF → SF → Final
- **Mỗi đội đá tối thiểu 3 trận**, tối đa 8 trận (nếu vô địch)
:::

### So sánh format 32 đội vs 48 đội

**WC 2022 (32 đội)**:
- 8 bảng × 4 đội
- Top 2 qualify → R16 thẳng
- Mỗi đội đá 3-7 trận
- Tổng 64 trận

**WC 2026 (48 đội)**:
- 12 bảng × 4 đội
- Top 2 + 8 đội hạng 3 tốt nhất → R32
- Mỗi đội đá 3-8 trận
- Tổng **104 trận** (+40 trận, +62.5%)

**Critics**: Format mới bị phê phán:
- **"Dead rubbers"**: trận bảng cuối khi 2 đội đã đủ điểm, không có incentive
- **Kéo dài**: 39 ngày thay vì 28 ngày (Qatar)
- **Chi phí đội**: phí tham gia tăng, logistics phức tạp

**Pros**:
- Nhiều đội châu Á, Phi, CONCACAF có cơ hội
- Fan nhiều quốc gia hơn được ăn mừng
- Revenue tăng cho FIFA

## Teams đã qualify (tính đến tháng 4/2026)

Các đội đã chắc chắn có mặt:

### Chủ nhà (3 automatic)

- **USA** (top seed, chủ nhà chính)
- **Canada**
- **Mexico**

### Qualified đã confirmed (ví dụ — số slot từng châu)

:::stats Suất theo confederation
- **UEFA (châu Âu)**: 16 suất
- **CAF (châu Phi)**: 9 suất (tăng từ 5)
- **AFC (châu Á)**: 8 suất (tăng từ 4.5) + 1 suất play-off
- **CONMEBOL (Nam Mỹ)**: 6 suất + 1 play-off
- **CONCACAF (Bắc-Trung Mỹ)**: 3 chủ nhà tự động + 3 thêm + 2 play-off
- **OFC (châu Đại Dương)**: 1 suất + 1 play-off
- **Inter-confederation playoff**: 2 suất cuối cùng (6 đội tham gia)
:::

### Các đội lớn đã qualify

**Châu Âu (UEFA)**:
- Pháp (đương kim á quân)
- Anh
- Đức
- Tây Ban Nha (đương kim EURO 2024)
- Bồ Đào Nha (Ronaldo kỳ vọng cuối cùng)
- Hà Lan, Bỉ, Italy, Croatia

**Nam Mỹ (CONMEBOL)**:
- Argentina (đương kim vô địch WC 2022, 3 cúp liên tiếp: WC + Copa 2x)
- Brazil
- Uruguay
- Colombia (á quân Copa 2024)
- Ecuador

**Châu Á (AFC)**:
- Nhật Bản (luôn qualify)
- Hàn Quốc
- Australia
- Saudi Arabia
- Iran
- **Uzbekistan** — lần đầu qualify WC nam
- **Jordan** — lần đầu
- **Iraq** + 1 suất play-off

**Châu Phi (CAF)**:
- Morocco (kỳ tích hạng 4 WC 2022)
- Senegal
- Ai Cập (Salah)
- Algeria
- Ghana

![48 đội từ 6 confederations — WC 2026 diverse nhất lịch sử](${IMG_TEAMS})

## Việt Nam tham dự WC 2026?

**Không.**

ĐTQG Việt Nam bị loại ở vòng loại AFC thứ 2 (tháng 11/2024). Được điểm 3/6 trận đầu, sau đó không thể thắng trận nào và bị loại sớm.

### AFC qualification VN

- **Vòng loại 1 (2023)**: VN pass
- **Vòng loại 2 (2024)**: VN ở bảng F với Iraq, Philippines, Indonesia → VN về thứ 3, bị loại
- **Vòng loại 3 (2025)**: VN không có mặt

### Cơ hội cho các kỳ WC sau

- **WC 2030**: AFC dự kiến lên 8.5 suất (có thể 9). VN cần cải thiện chiến thuật + đầu tư đào tạo trẻ.
- **Thế hệ vàng 2018-2022** (Quang Hải, Công Phượng, Văn Hậu) đã bước vào decline.
- **Thế hệ mới**: HLV và VFF cần nuôi cầu thủ trẻ U23 hiện tại.

:::warning Realistic check
VN chưa đủ trình độ qualify WC trong ngắn hạn. Kỳ vọng gần nhất là **WC 2034** (Saudi Arabia host, AFC có thể 10 suất). Cần 8-10 năm xây dựng nền móng.
:::

## Dự đoán favorites + outsiders

![Top ứng cử viên vô địch WC 2026](${IMG_TROPHY})

### Top 5 favorites

**1. Argentina** (đương kim vô địch)
- Messi vẫn có thể: 39 tuổi, nhưng chỉ đóng vai phụ
- Lionel Scaloni làm HLV tiếp (4 cúp liên tiếp)
- Young core: Alvarez, Mac Allister, Enzo Fernandez, Garnacho
- Lứa tuổi ổn

**2. France**
- Mbappé 27 tuổi, peak — sau WC 2026 sẽ làm cúp thứ 3 liên tiếp
- Squad rotation tốt nhất: Dembélé, Camavinga, Tchouaméni
- Deschamps vẫn HLV, kinh nghiệm

**3. Brazil**
- HLV mới: sau thảm bại Copa 2024, Brazil thay HLV
- Vinícius, Rodrygo, Endrick forming next generation
- Luôn là candidate nhưng chưa vô địch từ 2002

**4. Spain**
- Đương kim vô địch EURO 2024
- Yamal (18 tuổi), Pedri, Gavi — thế hệ vàng trẻ
- De la Fuente giữ formula win

**5. England**
- Final EURO 2024 thua Spain
- Bellingham, Saka, Foden, Kane — lứa tuổi peak
- HLV Tuchel (thay Southgate) mang style mới

### Dark horses

- **Morocco** (hạng 4 WC 2022, có thể lặp lại)
- **Portugal** (Ronaldo cuối cùng, motivation cực lớn)
- **Netherlands** (Koeman, strong squad)
- **Germany** (đang rebuild)
- **USA** (chủ nhà, home advantage, fan đông)

## Khi nào + xem WC 2026 ở VN?

### Schedule quan trọng

- **Khai mạc**: 11/6/2026, Mexico vs ? tại Estadio Azteca
- **Group stage**: 12/6 – 27/6
- **Round of 32**: 28/6 – 3/7
- **Round of 16**: 4/7 – 7/7
- **Quarter-finals**: 9/7 – 11/7
- **Semi-finals**: 14/7 – 15/7
- **Third-place**: 18/7
- **Final**: **19/7/2026**, MetLife Stadium NJ

![Lịch WC 2026 kéo dài 39 ngày — fest bóng đá lớn nhất lịch sử](${IMG_SCHEDULE})

### Giờ xem tại VN

- **Khai mạc 11/6**: ~7:00 sáng 12/6 giờ VN (kickoff 20:00 local Mexico City = UTC-5)
- **Knockout giờ đêm VN**: đa số 4:00-8:00 sáng (prime time US)
- **Final 19/7**: dự đoán 3:00-4:00 sáng 20/7 giờ VN

### Kênh phát sóng VN

:::info WC 2026 phát sóng tại VN
- **VTV** (VTV5, VTV6, VTV3) — MIỄN PHÍ qua antenna + VTVgo app
- Truyền thống VTV mua bản quyền toàn bộ WC cho VN miễn phí
- **VTVcab, SCTV** — cable TV phát lại
- **VTV Go app** — live streaming miễn phí
:::

Không cần đăng ký gói premium nào để xem WC 2026 tại VN.

## Giá trị marketing + kinh tế WC 2026

### Revenue projection

- **FIFA revenue**: $11 tỷ USD (tăng 70% từ Qatar)
- **TV rights global**: $5 tỷ
- **Sponsorships**: $2 tỷ
- **Ticket sales**: $1.2 tỷ (5.5M vé × ~$220 trung bình)
- **Merchandising**: $800 triệu

### Economic impact 3 host nations

- **USA**: GDP boost ~$3 tỷ, 50,000 jobs tạm thời
- **Canada**: 20,000 jobs, $750 triệu boost
- **Mexico**: 30,000 jobs, $1 tỷ boost

### Vé + giá

- **Vé rẻ nhất (đội không seed)**: $60 USD
- **Vé group stage chung**: $200-500
- **Vé knockout**: $500-2,000
- **Vé Final**: $1,500-10,000 (hotspot)

## Câu hỏi thường gặp

### World Cup 2026 diễn ra khi nào?

**11/6/2026 đến 19/7/2026** (39 ngày). Khai mạc tại Estadio Azteca (Mexico City), chung kết tại MetLife Stadium (New Jersey, USA).

### Có bao nhiêu đội tham dự WC 2026?

**48 đội** — lần đầu format 48 teams (tăng từ 32 của các kỳ trước). Tổng 104 trận.

### Chủ nhà WC 2026 là quốc gia nào?

**3 quốc gia: USA, Canada, Mexico** — lần đầu tiên có 3 chủ nhà trong lịch sử World Cup. Mỹ tổ chức 78 trận (bao gồm final), Canada 13, Mexico 13.

### Việt Nam có qualify WC 2026 không?

**Không.** Việt Nam bị loại ở vòng loại AFC thứ 2 (tháng 11/2024) trong bảng với Iraq, Philippines, Indonesia.

### Xem WC 2026 miễn phí ở VN ở đâu?

**VTV** (VTV5, VTV6, VTV3) phát sóng miễn phí toàn bộ qua TV antenna + **VTVgo app**. Không cần trả tiền subscription nào.

### WC 2026 có công nghệ gì mới?

- **Semi-automated offside** (đã dùng từ 2022)
- **VAR enhanced**: thêm angle camera
- **Smart ball** (chip trong bóng tracking vị trí chính xác cm)
- **AI-based fixtures**: lần đầu AI tính optimal schedule

### Argentina có defend được không?

**Khả năng 30-40%**. Messi 39 tuổi chỉ là phụ, nhưng young core (Alvarez, Mac Allister, Enzo, Garnacho) rất mạnh. Lionel Scaloni — HLV win 4 cúp liên tiếp — giữ chỗ.

### Việt Nam có cơ hội WC nào gần nhất?

Thực tế: **WC 2034** (Saudi Arabia host). AFC có thể lên 10 suất. VN cần xây thế hệ mới từ U23 hiện tại.

### Final WC 2026 khi nào?

**Chủ nhật, 19/7/2026**, MetLife Stadium New Jersey USA. Giờ VN dự kiến ~3:00-4:00 sáng thứ 2 20/7/2026.

## Bài viết liên quan trên ScoreLine

- [Lịch thi đấu bóng đá](/lich-thi-dau) — check matches daily
- [Kết quả WC qualifying hôm qua](/ket-qua/hom-qua) — theo dõi vòng loại
- [Premier League A-Z](/tin-bong-da/premier-league-cam-nang-a-z-cho-fan-bong-da-viet-nam) — cầu thủ WC chơi ở đâu
- [V-League 1 cẩm nang](/tin-bong-da/v-league-1-cam-nang-toan-tap-cho-fan-bong-da-viet-nam) — tương lai VN bóng đá
- [Xem bóng đá trực tiếp VN](/tin-bong-da/xem-bong-da-truc-tiep-tai-viet-nam-10-phuong-an-hop-phap) — detail VTVgo xem WC
- [VAR hoạt động thế nào](/tin-bong-da/var-la-gi-cach-hoat-dong-10-tinh-huong-kinh-dien-bong-da) — công nghệ ở WC 2026

## Nguồn tham khảo

- [FIFA World Cup 2026 official](https://www.fifa.com/worldcup/2026)
- [FIFA draw + qualified teams](https://www.fifa.com)
- [ESPN WC 2026 coverage](https://www.espn.com/soccer/fifa-world-cup)
- Dữ liệu CONMEBOL, AFC, UEFA qualifiers 2024-2026`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');
  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    Object.assign(existing, {
      title: TITLE, description: DESCRIPTION, content: CONTENT, image: HERO_IMAGE,
      tags: ['World Cup 2026', 'FIFA', 'USA Canada Mexico', 'World Cup 48 đội', 'bóng đá thế giới', 'kiến thức bóng đá'],
      category: 'analysis', source: 'editorial', status: 'published',
    });
    await existing.save();
    console.log('Updated:', existing.slug);
  } else {
    await new Article({
      originalTitle: TITLE, originalLink: `https://scoreline.io/tin-bong-da/${SLUG}`,
      source: 'editorial', slug: SLUG, title: TITLE, description: DESCRIPTION, content: CONTENT,
      tags: ['World Cup 2026', 'FIFA', 'USA Canada Mexico', 'World Cup 48 đội', 'bóng đá thế giới', 'kiến thức bóng đá'],
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
