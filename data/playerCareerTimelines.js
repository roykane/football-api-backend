/**
 * Career timelines for the Vietnamese player profiles.
 *
 * Kept in a sidecar file so the main player records stay readable. The
 * SSR route (vietnamesePlayers.js) merges by slug — players without an
 * entry here just don't get a timeline section, no error.
 *
 * Schema per entry:
 *   { period: 'YYYY-YYYY' | 'YYYY-now', club, league, role?, note? }
 *
 * `period` is rendered verbatim, so use 'now' / 'hiện tại' for ongoing.
 * Honors that aren't tied to a club go in `note` (e.g. cup wins, ind awards).
 */

const timelines = {
  'nguyen-quang-hai': [
    { period: '2010-2014', club: 'CLB Hà Nội (đào tạo trẻ)', league: 'V-League Youth', role: 'Đào tạo trẻ' },
    { period: '2015-2022', club: 'Hà Nội FC', league: 'V-League', role: 'Tiền vệ tấn công',
      note: '4 lần vô địch V-League · Quả Bóng Vàng VN 2018' },
    { period: '2022-2023', club: 'Pau FC', league: 'Ligue 2 (Pháp)', role: 'Tiền vệ tấn công',
      note: 'Cầu thủ VN đầu tiên thi đấu thường xuyên ở Ligue 2' },
    { period: '2023-hiện tại', club: 'Công An Hà Nội', league: 'V-League', role: 'Tiền vệ tấn công',
      note: 'Vô địch V-League ngay mùa đầu tiên' },
  ],
  'nguyen-cong-phuong': [
    { period: '2007-2014', club: 'HAGL Arsenal JMG (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2015-2015', club: 'Hoàng Anh Gia Lai', league: 'V-League', role: 'Tiền đạo' },
    { period: '2016-2016', club: 'Mito HollyHock', league: 'J2 (Nhật Bản)', role: 'Tiền đạo (cho mượn)' },
    { period: '2017-2018', club: 'Hoàng Anh Gia Lai', league: 'V-League', role: 'Tiền đạo' },
    { period: '2019-2019', club: 'Incheon United', league: 'K League 1 (Hàn Quốc)', role: 'Tiền đạo (cho mượn)' },
    { period: '2019-2019', club: 'Sint-Truidense', league: 'Jupiler Pro League (Bỉ)', role: 'Tiền đạo (cho mượn)' },
    { period: '2020-2022', club: 'Hoàng Anh Gia Lai', league: 'V-League', role: 'Tiền đạo' },
    { period: '2023-2023', club: 'Yokohama FC', league: 'J2 (Nhật Bản)', role: 'Tiền đạo' },
    { period: '2024-hiện tại', club: 'Bình Phước', league: 'V-League', role: 'Tiền đạo' },
  ],
  'dang-van-lam': [
    { period: '2008-2014', club: 'Dynamo Moscow / FC Khimki (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2015-2015', club: 'Hoàng Anh Gia Lai', league: 'V-League', role: 'Thủ môn' },
    { period: '2016-2018', club: 'Hải Phòng', league: 'V-League', role: 'Thủ môn' },
    { period: '2019-2020', club: 'Muangthong United', league: 'Thai League 1', role: 'Thủ môn',
      note: 'Thủ môn VN đầu tiên thi đấu thường xuyên tại Thai League' },
    { period: '2021-2022', club: 'Cerezo Osaka', league: 'J1 (Nhật Bản)', role: 'Thủ môn dự bị' },
    { period: '2022-2023', club: 'Bình Định', league: 'V-League', role: 'Thủ môn' },
    { period: '2024-hiện tại', club: 'Ninh Bình', league: 'V-League', role: 'Thủ môn' },
  ],
  'nguyen-tien-linh': [
    { period: '2010-2016', club: 'Bình Dương (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2017-hiện tại', club: 'Becamex Bình Dương', league: 'V-League', role: 'Tiền đạo',
      note: 'Trung thành duy nhất với 1 CLB trong sự nghiệp · Vô địch AFF Cup 2024' },
  ],
  'do-duy-manh': [
    { period: '2010-2014', club: 'Hà Nội FC (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2015-hiện tại', club: 'Hà Nội FC', league: 'V-League', role: 'Trung vệ',
      note: 'Đội trưởng · 4+ chức vô địch V-League · 64 trận ĐTQG' },
  ],
  'nguyen-hoang-duc': [
    { period: '2014-2018', club: 'Viettel (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2019-2024', club: 'Viettel', league: 'V-League', role: 'Tiền vệ trung tâm',
      note: 'Quả Bóng Vàng VN 2021 và 2023' },
    { period: '2024-hiện tại', club: 'Ninh Bình', league: 'V-League', role: 'Tiền vệ trung tâm',
      note: 'Quả Bóng Vàng VN 2024 · Phí chuyển nhượng kỷ lục cầu thủ nội' },
  ],
  'nguyen-xuan-son': [
    { period: '2015-2019', club: 'CLB Brazil & Bồ Đào Nha (Sông Lam Nghệ Andorinha…)', league: '—', role: 'Tiền đạo' },
    { period: '2020-hiện tại', club: 'Nam Định', league: 'V-League', role: 'Tiền đạo',
      note: 'Vua phá lưới V-League 2023/24 (31 bàn) · Vô địch V-League 2023/24' },
    { period: '2024-hiện tại', club: 'ĐT Việt Nam', league: 'AFF Cup', role: 'Tiền đạo (nhập tịch)',
      note: 'Vua phá lưới AFF Cup 2024 (7 bàn) · Cầu thủ xuất sắc nhất giải' },
  ],
  'nguyen-filip': [
    { period: '2010-2018', club: 'Slavia Prague', league: 'Czech First League', role: 'Thủ môn dự bị' },
    { period: '2019-2020', club: 'Slovan Liberec', league: 'Czech First League', role: 'Thủ môn' },
    { period: '2020-2023', club: 'Sparta Prague', league: 'Czech First League', role: 'Thủ môn' },
    { period: '2023-hiện tại', club: 'Công An Hà Nội', league: 'V-League', role: 'Thủ môn',
      note: 'Vô địch V-League 2023/24 · Vô địch AFF Cup 2024 (sau khi nhập tịch)' },
  ],
  'que-ngoc-hai': [
    { period: '2008-2011', club: 'Sông Lam Nghệ An (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2012-2017', club: 'Sông Lam Nghệ An', league: 'V-League', role: 'Trung vệ' },
    { period: '2018-2023', club: 'Viettel', league: 'V-League', role: 'Trung vệ',
      note: 'Vô địch V-League 2020' },
    { period: '2024-hiện tại', club: 'Becamex Bình Dương', league: 'V-League', role: 'Trung vệ',
      note: 'Đội trưởng ĐTQG · 91 trận khoác áo ĐT Việt Nam' },
  ],
  'doan-van-hau': [
    { period: '2010-2015', club: 'Hà Nội FC (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2016-2019', club: 'Hà Nội FC', league: 'V-League', role: 'Hậu vệ trái',
      note: 'Cầu thủ ra mắt V-League trẻ nhất lịch sử (17 tuổi)' },
    { period: '2019-2020', club: 'SC Heerenveen', league: 'Eredivisie (Hà Lan)', role: 'Hậu vệ trái (cho mượn)' },
    { period: '2020-2023', club: 'Hà Nội FC', league: 'V-League', role: 'Hậu vệ trái' },
    { period: '2023-hiện tại', club: 'Công An Hà Nội', league: 'V-League', role: 'Hậu vệ trái',
      note: 'Vô địch AFF Cup 2018 và 2024' },
  ],
  'pham-tuan-hai': [
    { period: '2014-2018', club: 'Hồng Lĩnh Hà Tĩnh / Hà Nam (đào tạo trẻ)', league: '—', role: 'Đào tạo trẻ' },
    { period: '2019-2021', club: 'Hồng Lĩnh Hà Tĩnh', league: 'V-League', role: 'Tiền đạo' },
    { period: '2021-hiện tại', club: 'Hà Nội FC', league: 'V-League', role: 'Tiền đạo',
      note: 'Trụ cột tấn công ĐTQG sau khi Văn Toàn rời khỏi đội tuyển' },
  ],
};

module.exports = { timelines };
