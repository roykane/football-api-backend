/**
 * Deploy Pillar Article #5: Fantasy Premier League A-Z for Vietnamese
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SLUG = 'fantasy-premier-league-fpl-huong-dan-a-z-cho-nguoi-viet';
const TITLE = 'Fantasy Premier League (FPL): Hướng dẫn A-Z cho Người Việt 2025/26';
const DESCRIPTION = 'FPL là game quản lý đội bóng ảo Premier League với 12 triệu người chơi toàn cầu. Cẩm nang chi tiết cách đăng ký, chọn đội, strategy captain, sử dụng chips, mini-league cho người Việt mới bắt đầu.';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&h=630&fit=crop';

const IMG_SQUAD = 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=1000&h=560&fit=crop';
const IMG_CAPTAIN = 'https://images.unsplash.com/photo-1524824267900-2fa9cbf7a506?w=1000&h=560&fit=crop';
const IMG_STRATEGY = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1000&h=560&fit=crop';
const IMG_LEAGUE = 'https://images.unsplash.com/photo-1522204523234-8729aa6e3d5f?w=1000&h=560&fit=crop';

const CONTENT = `:::info Tóm tắt nhanh
**Fantasy Premier League (FPL)** là game quản lý đội bóng ảo Premier League chính thức của EPL, **miễn phí** với **12 triệu người chơi** toàn cầu 2024/25. Bạn có **ngân sách 100 triệu (£100M ảo)** để build squad 15 cầu thủ từ 20 CLB EPL, ghi điểm dựa trên performance thực của họ ở trận thật. Có **captain strategy, transfers mỗi gameweek, và 5 chips** để dùng. Bài này hướng dẫn toàn diện cho người Việt, từ đăng ký đến tối ưu điểm số.
:::

## Fantasy Premier League là gì?

**FPL** (Fantasy Premier League) là game **miễn phí chính thức** của Premier League, ra mắt từ **2002**. Người chơi:

- Dùng **ngân sách £100M** để mua **15 cầu thủ** EPL
- Mỗi **gameweek** (vòng đấu), set lineup 11 người + 4 dự bị
- Cầu thủ được điểm dựa trên **performance trận thật** (bàn, assist, clean sheet, etc.)
- Trong cả mùa, tích lũy điểm — ai cao nhất top global là "FPL champion"

:::stats FPL by numbers 2024/25
- **Players toàn cầu**: 12 triệu (record mới)
- **Top country**: UK, Nauy, India, Iceland, VN (ước ~500K-1M)
- **Average score/GW**: 50-65 điểm
- **Winner 2023/24**: 2,700+ điểm (38 GW)
- **Free để chơi**: Yes, không mua lock
- **Prize pool**: Goody bag EPL + trip London (top 1)
:::

![FPL — chọn squad tối ưu trong 100M budget](${IMG_SQUAD})

## Cách đăng ký FPL

### Bước 1: Tạo account

1. Truy cập [fantasy.premierleague.com](https://fantasy.premierleague.com)
2. Click **"Register"** → nhập email + mật khẩu
3. Chọn tên đội ảo (vd: "Viet Hai Phong", "Hanoi Reds")
4. Chọn favorite team EPL (chỉ để stats, không ảnh hưởng điểm)

### Bước 2: Build squad 100M

:::info Luật squad FPL
- **Total 15 players** trong **100M budget**
- **2 goalkeepers** (1 starting + 1 bench)
- **5 defenders**
- **5 midfielders**
- **3 forwards**
- **Tối đa 3 cầu thủ từ 1 CLB** (tránh overload 1 team)
:::

### Bước 3: Set lineup 11 players

Từ 15-man squad, chọn 11 starting (điểm nhân đủ) + 4 bench (chỉ được điểm nếu starting bị injury/no-show).

**Formation tùy bạn** miễn:
- Có ít nhất **3 defenders** on pitch
- Có ít nhất **2 midfielders**
- Có ít nhất **1 forward**

Formation phổ biến: 3-4-3, 3-5-2, 4-4-2, 4-3-3.

## Point Scoring System

Cầu thủ được điểm dựa trên performance trận EPL thực:

:::stats FPL điểm cho cầu thủ mỗi trận
- **60+ phút thi đấu** → +2 điểm
- **<60 phút nhưng ra sân** → +1 điểm
- **Bàn thắng của forward** → +4 điểm
- **Bàn thắng của midfielder** → +5 điểm
- **Bàn thắng của defender/goalkeeper** → +6 điểm
- **Assist** → +3 điểm
- **Clean sheet (GK/defender) — 60+ min** → +4 điểm
- **Clean sheet (midfielder) — 60+ min** → +1 điểm
- **3 saves (GK)** → +1 điểm
- **Penalty save** → +5 điểm
- **Thẻ vàng** → −1 điểm
- **Thẻ đỏ** → −3 điểm
- **Penalty miss** → −2 điểm
- **Own goal** → −2 điểm
- **Bonus points (top 3 performer)** → +1, +2, +3
:::

### Tính tổng điểm mỗi gameweek

Điểm GW = Tổng điểm 11 starters × multiplier (captain 2x, vice-captain auto thay nếu captain không chơi)

Ví dụ: Salah (captain) ghi 2 bàn + assist = 10 điểm base + 3 bonus = 13 × 2 = **26 điểm** đơn chiếc.

## Captain Strategy — quan trọng nhất

![Captain pick — quyết định lớn nhất mỗi gameweek](${IMG_CAPTAIN})

**Captain nhân đôi điểm**. Chọn captain đúng = chiến thắng FPL.

### Captain Picker Heuristic

:::tip Cách chọn captain mỗi GW
1. **Form gần đây** — cầu thủ ghi 4 bàn trong 3 trận gần nhất = hot
2. **Fixture difficulty** — gặp đội yếu hay mạnh tuần đó
3. **Home/Away** — sân nhà thường ghi nhiều hơn
4. **Expected goals (xG)** — xem thêm [guide xG](/tin-bong-da/xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da)
5. **Minutes played last 3 GWs** — cầu thủ có bị rotation không
6. **Historical performance vs this opponent** — Kane luôn ghi bàn vào Arsenal là ví dụ
:::

### Captain template vs differential

- **Template captain** (80%+ owners chọn): Haaland, Salah, Son — ít rủi ro, không vượt
- **Differential captain** (<10% owners): captain pick khác biệt — rủi ro cao, upside cao
- **Chiến lược**: Captain template trừ khi tuần đó template có fixture khó

### Vice-captain

Chọn vice captain tốt (chơi chắc) — nếu captain bị injury hoặc không ra sân, vice sẽ lên thay tự động.

## Transfers — chuyển nhượng ảo

Mỗi gameweek:

- **1 Free Transfer** (FT) — chuyển 1 cầu thủ miễn phí
- **Transfer thứ 2 trở lên** → **−4 điểm** mỗi transfer
- **FT tích lũy** tối đa 5 (không dùng thì roll sang GW sau)

### Khi nào chấp nhận mất 4 điểm

:::warning Hits (−4) chỉ worth khi
- Cầu thủ injury dài hạn → không chơi nhiều GW → cần bán gấp
- Cầu thủ đã bán squad/thay đổi role → không thể ghi điểm
- Spot đổi captain tuần tới (hit để có Haaland captain = worth 6-10 điểm)
- Price rise wildcard lead — cứu giá cầu thủ sắp lên giá
:::

**Tránh**: hit −4 vì "cảm giác" — nên tính xem cầu thủ mới + transfer điểm bù được 4 điểm không.

## 5 Chips FPL — dùng đúng lúc

Mỗi mùa FPL được 5 chips đặc biệt:

:::example 5 Chips and when to use
1. **Wildcard** (2 lần/mùa): đổi toàn squad miễn phí — dùng GW 8-12 (sau khi thấy clear leader) và GW 20-25 (sau fixture rotation)
2. **Free Hit** (1 lần): dùng tạm 1 GW (sau GW quay lại squad cũ) — dùng vào blank GWs (nhiều đội không đá do FA Cup)
3. **Triple Captain** (1 lần): captain điểm x3 thay vì x2 — dùng khi Haaland/Salah gặp đội yếu sân nhà trong double gameweek
4. **Bench Boost** (1 lần): 4 dự bị cũng được điểm — dùng khi cả squad có fixture tốt
5. **Assistant Manager** (new 2024/25): gợi ý captain tự động từ AI — dùng khi bạn vắng mặt
:::

![Transfer strategy — chọn đúng thời điểm mua-bán quyết định mùa giải](${IMG_STRATEGY})

## Differentials vs Template

**Template team** = squad với đa số cầu thủ được 50%+ người chơi chọn.

**Differential** = cầu thủ ít người chọn (<10% ownership) nhưng có potential breakout.

:::tip Cách tìm differential
- xG cao nhưng chưa ghi bàn (underperforming → sắp regression)
- Cầu thủ mới sign → adjust period ended, sẵn sàng bùng nổ
- Fixture mềm 3-4 GW tới
- Undervalued (giá thấp) do form xấu ngắn hạn
:::

**Tỷ lệ template/differential**:
- **Newbie**: 90% template, 10% differential (safe)
- **Intermediate**: 75/25 (balanced)
- **Pro**: 60/40 (aggressive — cần win mini-league)

## Mini-league với bạn bè + công ty

![Mini-league FPL — cách chơi vui với bạn bè/đồng nghiệp](${IMG_LEAGUE})

FPL **không chỉ chơi cá nhân** — cạnh tranh với mini-league bạn bè là phần vui nhất:

### Tạo league

1. Vào **Leagues** → **Create and Join** → **Create**
2. Nhập tên league (vd: "Công ty ABC FPL 2025/26")
3. Chọn:
   - **Classic League** (tổng điểm cả mùa)
   - **Head-to-Head League** (1v1 mỗi GW)
4. Share **invite code** cho bạn bè

### Chiến lược rank-climbing

- **Đầu mùa (GW 1-10)**: chơi an toàn, theo template
- **Giữa mùa (GW 11-25)**: analyze xem người đứng đầu chọn gì → counter với differential
- **Cuối mùa (GW 30-38)**: all-in, dùng chips còn lại, take hits nếu cần vượt

### Phần thưởng

FPL chính thức có **trip London + goody bag** cho top global. Nhưng mini-league với bạn bè thường **tự tổ chức phần thưởng**:
- Bao ăn/nhậu
- Tiền thắng-thua nhỏ (100-500K)
- Ownership bragging rights cho cả năm

## Common mistakes của người mới

:::warning Top 10 lỗi FPL newbie
1. **Not playing captain** — quên set captain = mất điểm lớn
2. **Chasing last week** — mua cầu thủ vừa ghi 3 bàn → regression, lose value
3. **Too many hits** (−4) — mỗi hit trừ 4 điểm, phải bù được mới worth
4. **Ignoring fixtures** — không check 5 GW tới
5. **Template captain mỗi tuần** — không rủi ro nhưng không thắng mini-league
6. **Bỏ qua bench** — bench toàn 4.0 hậu vệ không chơi = 0 Bench Boost value
7. **Triple Captain vào tuần fixture khó** — lãng phí chip
8. **Dùng Wildcard vội** — nên chờ có lý do rõ ràng
9. **Không check team news trước deadline** — cầu thủ injury vẫn giữ trong starter = 0 điểm
10. **Bỏ lỡ price rises** — cầu thủ lên giá giúp squad value tăng, có thể mua được players đắt hơn
:::

## Công cụ hỗ trợ FPL

### Top sources (English)

- **[Fantasy Football Scout](https://www.fantasyfootballscout.co.uk)** — top analysts, paywall £79/năm
- **[FPL Hints](https://www.fplhints.com)** — free, predictions + player stats
- **[LiveFPL](https://www.livefpl.net)** — track điểm live trong trận
- **[r/FantasyPL](https://www.reddit.com/r/FantasyPL)** — community thảo luận 24/7
- **FPL Harry** (YouTube) — tactical analysis hàng tuần

### Tools VN (khan hiếm)

- Chưa có community VN tầm cỡ lớn cho FPL
- Mini-league VN cross-border với UK/SE Asia players thường rank cao
- Scoreline đang plan build FPL Captain Picker tool riêng cho fan VN

:::tip Vietnamese FPL community
Follow Facebook groups **"Fantasy Premier League Vietnam"** và **"FPL Vietnam"** để thảo luận captain pick hàng tuần, share template team, và so sánh rank.
:::

## Câu hỏi thường gặp

### FPL có miễn phí không?

**Có, hoàn toàn miễn phí**. FPL là sản phẩm chính thức của Premier League, ai cũng có thể đăng ký tại fantasy.premierleague.com. Không có gói premium, không có loot box.

### Chơi FPL cần kiến thức bóng đá sâu không?

**Không nhất thiết**. Người mới chỉ cần biết 5-6 ngôi sao EPL (Salah, Haaland, Son, Saka, etc.) và follow form hàng tuần. Kiến thức sẽ tích lũy dần sau vài tuần chơi.

### Deadline FPL mỗi GW khi nào?

**Trước kick-off trận đầu tiên của gameweek** (thường thứ 6 lúc 18:30 GMT = **1:30 sáng thứ 7 giờ VN**). Sau deadline không thay đổi được lineup.

### FPL có cheat được không?

Không có "cheat" legit. Nhưng có thể tối ưu:
- Dùng công cụ như Fantasy Football Scout
- Đọc Twitter feeds của top managers
- Check r/FantasyPL trước deadline
- Dùng chip đúng timing

### FPL và Sorare khác gì?

**FPL** là game miễn phí, dùng cầu thủ ảo. **Sorare** là NFT-based fantasy sports, mua card thật, có thể mua-bán (Web3). FPL phù hợp VN vì không cần crypto.

### Tôi có thể reset team không?

**Trước khi GW1 bắt đầu**: reset miễn phí bao nhiêu lần tùy ý.

**Sau GW1**: chỉ chỉnh qua transfer (1 free/GW + hits −4). Không thể reset full. Nhưng có thể dùng **Wildcard** (1 lần trong nửa đầu mùa, 1 lần trong nửa sau) để đổi full squad.

### Điểm trung bình FPL top 10K là bao nhiêu?

- **Top 10K sau cả mùa (38 GW)**: ~2,350-2,450 điểm
- **Top 100K**: ~2,200-2,300
- **Top 1M**: ~2,000-2,100
- **Average player**: ~1,800-1,900

### Làm sao đạt top 1%?

Đạt top 120K (top 1% của 12M players) cần kết hợp:
- **Captain đúng 80%+ GWs** (không bao giờ captain sai)
- **Dùng chips đúng timing** (không waste)
- **Spot differentials** trước khi họ bùng nổ
- **Manage bench** tốt (players actually starting)
- **Follow team news** sát deadline mỗi tuần

Kinh nghiệm 2-3 mùa mới ổn định.

## Bài viết liên quan trên ScoreLine

- [xG Expected Goals guide](/tin-bong-da/xg-expected-goals-la-gi-cach-ap-dung-phan-tich-bong-da) — công cụ scout FPL quan trọng nhất
- [Premier League A-Z](/tin-bong-da/premier-league-cam-nang-a-z-cho-fan-bong-da-viet-nam) — hiểu giải trước khi chơi fantasy
- [Lịch thi đấu Premier League](/lich-thi-dau/premier-league) — plan captain theo fixture
- [Bảng xếp hạng Premier League](/bang-xep-hang/premier-league) — form team hiện tại
- [Top ghi bàn EPL](/top-ghi-ban/premier-league) — captain candidates
- [Nhận định bóng đá](/nhan-dinh) — analysis trận cho captain decisions

## Nguồn tham khảo

- [Fantasy Premier League official](https://fantasy.premierleague.com)
- [Fantasy Football Scout](https://www.fantasyfootballscout.co.uk)
- [r/FantasyPL subreddit](https://www.reddit.com/r/FantasyPL)
- [FPL Hints](https://www.fplhints.com)
- [LiveFPL tracker](https://www.livefpl.net)`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Article = require('../models/Article');
  const existing = await Article.findOne({ slug: SLUG });
  if (existing) {
    Object.assign(existing, {
      title: TITLE, description: DESCRIPTION, content: CONTENT, image: HERO_IMAGE,
      tags: ['Fantasy Premier League', 'FPL', 'EPL fantasy', 'captain strategy', 'FPL tips', 'fantasy football'],
      category: 'analysis', source: 'editorial', status: 'published',
    });
    await existing.save();
    console.log('Updated:', existing.slug);
  } else {
    await new Article({
      originalTitle: TITLE, originalLink: `https://scoreline.io/tin-bong-da/${SLUG}`,
      source: 'editorial', slug: SLUG, title: TITLE, description: DESCRIPTION, content: CONTENT,
      tags: ['Fantasy Premier League', 'FPL', 'EPL fantasy', 'captain strategy', 'FPL tips', 'fantasy football'],
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
