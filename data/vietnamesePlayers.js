/**
 * Top Vietnamese Players — SEO seed data
 * Target keywords: "công phượng", "quang hải", "văn lâm", "đặng văn lâm", etc.
 */

const players = [
  {
    slug: 'nguyen-quang-hai',
    name: 'Nguyễn Quang Hải',
    position: 'Tiền vệ tấn công',
    shirtNumber: 19,
    dob: '1997-04-12',
    birthplace: 'Đông Anh, Hà Nội',
    height: 168,
    weight: 63,
    currentClub: 'Công An Hà Nội',
    currentClubSlug: 'cong-an-ha-noi',
    nationalTeam: 'Việt Nam',
    caps: 59,
    goals: 13,
    foot: 'Phải',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Nguy%E1%BB%85n_Quang_H%E1%BA%A3i.jpg/330px-Nguy%E1%BB%85n_Quang_H%E1%BA%A3i.jpg',
    tags: ['quang hải', 'nguyễn quang hải', 'tiền vệ', 'cầu thủ việt nam'],
    bio: 'Nguyễn Quang Hải là một trong những cầu thủ xuất sắc nhất lịch sử bóng đá Việt Nam. Sinh ngày 12/4/1997 tại Đông Anh, Hà Nội, Hải bắt đầu sự nghiệp chuyên nghiệp tại Hà Nội FC từ năm 2015.',
    highlights: [
      'Siêu phẩm "cầu vồng trong tuyết" giúp U23 Việt Nam vào chung kết U23 châu Á 2018 tại Thường Châu',
      'Quả Bóng Vàng Việt Nam 2018',
      'Cầu thủ xuất sắc nhất Đông Nam Á (AFF Cup 2018)',
      '2 năm khoác áo Pau FC (Ligue 2, Pháp, 2022-2023)',
      'Chuyển về Công An Hà Nội năm 2023, vô địch V.League mùa đầu tiên'
    ],
    careerSummary: `Quang Hải khởi nghiệp tại CLB Hà Nội năm 2015 sau khi trưởng thành từ lò đào tạo trẻ của đội bóng thủ đô. Với kỹ thuật cá nhân điêu luyện, nhãn quan chiến thuật và khả năng sút phạt thượng thừa, anh nhanh chóng trở thành biểu tượng của bóng đá Việt Nam. Giải đấu U23 châu Á 2018 tại Thường Châu là cột mốc đưa tên tuổi Quang Hải vươn tầm châu lục với siêu phẩm "cầu vồng trong tuyết" vào lưới Uzbekistan ở trận chung kết.

Năm 2022, Quang Hải gia nhập Pau FC của Pháp, trở thành một trong những cầu thủ Việt Nam đầu tiên thi đấu ở Ligue 2. Sau 2 năm xuất ngoại, anh trở về nước năm 2023 và ký hợp đồng với Công An Hà Nội, giúp đội bóng giành chức vô địch V.League ngay mùa đầu tiên. Ở đội tuyển quốc gia, Quang Hải đã ghi 13 bàn sau 59 trận và là trụ cột trong chiến dịch vòng loại World Cup 2026.`,
    keyStats: {
      'V.League 2023/24': { matches: 22, goals: 5, assists: 8 },
      'AFF Cup 2024': { matches: 7, goals: 3, assists: 4 },
      'Vòng loại WC 2026': { matches: 6, goals: 1, assists: 2 }
    }
  },
  {
    slug: 'nguyen-cong-phuong',
    name: 'Nguyễn Công Phượng',
    position: 'Tiền đạo',
    shirtNumber: 10,
    dob: '1995-01-21',
    birthplace: 'Đô Lương, Nghệ An',
    height: 168,
    weight: 65,
    currentClub: 'Bình Phước',
    currentClubSlug: 'binh-phuoc',
    nationalTeam: 'Việt Nam',
    caps: 55,
    goals: 11,
    foot: 'Phải',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Nguy%E1%BB%85n_C%C3%B4ng_Ph%C6%B0%E1%BB%A3ng_20191201_%28cropped%29.jpg/330px-Nguy%E1%BB%85n_C%C3%B4ng_Ph%C6%B0%E1%BB%A3ng_20191201_%28cropped%29.jpg',
    tags: ['công phượng', 'nguyễn công phượng', 'tiền đạo', 'hagl'],
    bio: 'Nguyễn Công Phượng sinh ngày 21/1/1995 tại Đô Lương, Nghệ An. Trưởng thành từ học viện HAGL Arsenal JMG, Công Phượng là một trong những tiền đạo kỹ thuật nhất bóng đá Việt Nam hiện đại.',
    highlights: [
      'Thế hệ vàng HAGL Arsenal JMG cùng Xuân Trường, Tuấn Anh, Văn Toàn',
      'Xuất ngoại Nhật Bản (Mito Hollyhock 2016, Incheon United 2019, Yokohama FC 2023)',
      'Chuyển sang Bỉ khoác áo Sint-Truidense 2019',
      'Ghi bàn đầu tiên cho ĐT Việt Nam năm 17 tuổi',
      'Trở về V.League với Bình Phước năm 2024'
    ],
    careerSummary: `Công Phượng bước ra ánh sáng từ học viện HAGL Arsenal JMG cùng lứa Xuân Trường, Tuấn Anh, Văn Toàn. Ra mắt V.League năm 2015, anh nhanh chóng trở thành biểu tượng của bóng đá Việt Nam với lối chơi kỹ thuật, đột biến và khả năng rê dắt hiếm có.

Công Phượng là cầu thủ Việt Nam hiếm hoi từng thi đấu ở 4 quốc gia khác nhau: Việt Nam, Nhật Bản, Bỉ và Hàn Quốc. Các chuyến xuất ngoại Mito Hollyhock (J2 2016), Incheon United (K League 1 2019), Sint-Truidense (Bỉ 2019) và Yokohama FC (J2 2023) để lại nhiều bài học quý giá. Năm 2024, anh trở về V.League khoác áo CLB Bình Phước, tiếp tục đóng góp cho bóng đá quê nhà ở tuổi 29.`,
    keyStats: {
      'V.League 2024/25': { matches: 18, goals: 7, assists: 3 },
      'AFF Cup 2024': { matches: 6, goals: 2, assists: 2 }
    }
  },
  {
    slug: 'dang-van-lam',
    name: 'Đặng Văn Lâm',
    position: 'Thủ môn',
    shirtNumber: 1,
    dob: '1993-08-13',
    birthplace: 'Saint Petersburg, Nga',
    height: 188,
    weight: 80,
    currentClub: 'Ninh Bình',
    currentClubSlug: 'ninh-binh',
    nationalTeam: 'Việt Nam',
    caps: 37,
    goals: 0,
    foot: 'Phải',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/%C4%90%E1%BA%B7ng_V%C4%83n_L%C3%A2m_20191201_%28cropped%29.jpg/330px-%C4%90%E1%BA%B7ng_V%C4%83n_L%C3%A2m_20191201_%28cropped%29.jpg',
    tags: ['văn lâm', 'đặng văn lâm', 'thủ môn', 'lavkaman'],
    bio: 'Đặng Văn Lâm (Lev Shonin) sinh ngày 13/8/1993 tại Saint Petersburg, Nga. Với chiều cao 1m88 và phản xạ điển hình kiểu Đông Âu, Văn Lâm là thủ môn số 1 của đội tuyển Việt Nam trong nhiều năm qua.',
    highlights: [
      'Thủ môn đầu tiên của Việt Nam thi đấu tại Thai League (Muangthong United 2019-2021)',
      'Chuyển sang Cerezo Osaka (J1 League, Nhật Bản) năm 2021',
      'Vô địch AFF Cup 2018 cùng ĐT Việt Nam',
      'Ghi dấu ấn lớn tại vòng 1/8 Asian Cup 2019',
      'Trở về V.League năm 2023, hiện khoác áo Ninh Bình'
    ],
    careerSummary: `Đặng Văn Lâm là sự kết hợp đặc biệt giữa dòng máu Việt Nam và nền bóng đá Nga. Sinh ra tại Saint Petersburg, Văn Lâm được đào tạo tại lò Dynamo Moscow và FC Khimki trước khi trở về Việt Nam năm 2015 khoác áo Hoàng Anh Gia Lai, rồi Hải Phòng.

Anh trở thành thủ môn Việt Nam đầu tiên thi đấu chuyên nghiệp ở Thai League khi gia nhập Muangthong United năm 2019, và sau đó là Cerezo Osaka (Nhật Bản) năm 2021. Dấu ấn lớn nhất của Văn Lâm là trận tứ kết Asian Cup 2019 gặp Nhật Bản, khi màn trình diễn xuất sắc của anh khiến đối thủ chỉ thắng được 1-0. Hiện tại, Văn Lâm khoác áo CLB Ninh Bình và vẫn là lựa chọn số 1 cho khung gỗ ĐTQG.`,
    keyStats: {
      'V.League 2024/25': { matches: 15, cleanSheets: 7 },
      'AFF Cup 2024': { matches: 7, cleanSheets: 4 },
      'Vòng loại WC 2026': { matches: 6, cleanSheets: 2 }
    }
  },
  {
    slug: 'nguyen-tien-linh',
    name: 'Nguyễn Tiến Linh',
    position: 'Tiền đạo',
    shirtNumber: 22,
    dob: '1997-10-20',
    birthplace: 'Bình Dương',
    height: 177,
    weight: 74,
    currentClub: 'Becamex Bình Dương',
    currentClubSlug: 'binh-duong',
    nationalTeam: 'Việt Nam',
    caps: 49,
    goals: 23,
    foot: 'Phải',
    image: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Nguyen_Tien_Linh_2024_2.png',
    tags: ['tiến linh', 'nguyễn tiến linh', 'tiền đạo', 'bình dương'],
    bio: 'Nguyễn Tiến Linh sinh ngày 20/10/1997 tại Bình Dương, là chân sút chủ lực của đội tuyển Việt Nam từ sau khi Anh Đức giải nghệ. Với lối chơi mạnh mẽ và khả năng không chiến tốt, Tiến Linh là tiền đạo đáng tin cậy nhất hiện nay.',
    highlights: [
      'Vua phá lưới ĐT Việt Nam sau Lê Công Vinh (23 bàn sau 49 trận)',
      'Ghi bàn quan trọng giúp ĐT Việt Nam vào vòng loại cuối World Cup 2022',
      'Trung thành với CLB Bình Dương từ 2017 đến nay',
      'Top ghi bàn AFF Cup 2022',
      'Vô địch AFF Cup 2024'
    ],
    careerSummary: `Tiến Linh là sản phẩm của lò đào tạo trẻ Bình Dương, ra mắt V.League năm 2017 và nhanh chóng khẳng định vị trí. Khác với nhiều đồng đội, Tiến Linh chọn gắn bó trọn vẹn với đội bóng quê nhà, từ chối nhiều lời mời ra nước ngoài để tập trung phát triển sự nghiệp trong nước.

Ở đội tuyển Việt Nam, Tiến Linh hiện là chân sút hiệu quả nhất với 23 bàn sau 49 trận, chỉ đứng sau huyền thoại Lê Công Vinh trong lịch sử. Anh ghi bàn ở các giải đấu lớn như AFF Cup 2018, 2022, 2024 và vòng loại World Cup 2022. Phong cách thi đấu mạnh mẽ, chiếm lĩnh không gian và khả năng dứt điểm bằng cả hai chân khiến Tiến Linh là "số 9" điển hình của bóng đá hiện đại.`,
    keyStats: {
      'V.League 2024/25': { matches: 20, goals: 11, assists: 3 },
      'AFF Cup 2024': { matches: 7, goals: 4, assists: 1 }
    }
  },
  {
    slug: 'do-duy-manh',
    name: 'Đỗ Duy Mạnh',
    position: 'Trung vệ',
    shirtNumber: 4,
    dob: '1996-09-29',
    birthplace: 'Đông Anh, Hà Nội',
    height: 180,
    weight: 73,
    currentClub: 'Hà Nội FC',
    currentClubSlug: 'ha-noi',
    nationalTeam: 'Việt Nam',
    caps: 64,
    goals: 2,
    foot: 'Phải',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/%C4%90%E1%BB%97_Duy_M%E1%BA%A1nh_20191201_%28cropped%29.jpg/330px-%C4%90%E1%BB%97_Duy_M%E1%BA%A1nh_20191201_%28cropped%29.jpg',
    tags: ['duy mạnh', 'đỗ duy mạnh', 'trung vệ', 'hà nội fc'],
    bio: 'Đỗ Duy Mạnh là trung vệ thép của đội tuyển Việt Nam, sinh ngày 29/9/1996 tại Đông Anh, Hà Nội. Cùng với Quế Ngọc Hải, Duy Mạnh tạo thành cặp trung vệ ổn định nhất bóng đá Việt Nam một thập kỷ qua.',
    highlights: [
      'Đội trưởng Hà Nội FC',
      'Trụ cột trong chiến dịch U23 Thường Châu 2018',
      '64 trận cho ĐTQG — top 10 cầu thủ VN khoác áo ĐT nhiều nhất',
      'Vô địch V.League nhiều lần cùng Hà Nội FC',
      'Ký hợp đồng dài hạn với Hà Nội FC đến 2027'
    ],
    careerSummary: `Duy Mạnh trưởng thành từ lò đào tạo Hà Nội FC, là một trong những trung vệ kỹ thuật hiếm có của bóng đá Việt Nam. Anh ra mắt V.League năm 2014 và kể từ đó chưa từng rời CLB thủ đô, trở thành biểu tượng lòng trung thành hiếm có trong bóng đá Việt Nam hiện đại.

Ở ĐTQG, Duy Mạnh là trụ cột không thể thay thế dưới thời HLV Park Hang-seo và Philippe Troussier. Với 64 trận khoác áo đội tuyển, anh là một trong những cầu thủ giàu kinh nghiệm nhất. Khả năng đọc trận, không chiến và chuyền dài chuẩn xác giúp Duy Mạnh trở thành trung vệ toàn diện, phù hợp với cả lối chơi phòng ngự phản công và kiểm soát bóng.`,
    keyStats: {
      'V.League 2024/25': { matches: 24, goals: 1, cleanSheets: 11 },
      'AFF Cup 2024': { matches: 7, goals: 0, cleanSheets: 4 }
    }
  },
  {
    slug: 'nguyen-hoang-duc',
    name: 'Nguyễn Hoàng Đức',
    position: 'Tiền vệ trung tâm',
    shirtNumber: 14,
    dob: '1998-01-11',
    birthplace: 'Hải Dương',
    height: 184,
    weight: 75,
    currentClub: 'Ninh Bình',
    currentClubSlug: 'ninh-binh',
    nationalTeam: 'Việt Nam',
    caps: 41,
    goals: 4,
    foot: 'Phải',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Nguyen_Hoang_Duc_in_2025.png/330px-Nguyen_Hoang_Duc_in_2025.png',
    tags: ['hoàng đức', 'nguyễn hoàng đức', 'tiền vệ', 'viettel'],
    bio: 'Nguyễn Hoàng Đức sinh ngày 11/1/1998 tại Hải Dương, là tiền vệ kiến thiết hiện đại nhất bóng đá Việt Nam. Với chiều cao 1m84 và kỹ thuật điêu luyện, Hoàng Đức là "nhạc trưởng" không thể thay thế của tuyến giữa ĐTQG.',
    highlights: [
      'Quả Bóng Vàng Việt Nam 2021, 2023, 2024',
      '3 lần đoạt Quả Bóng Vàng — kỷ lục của cầu thủ trẻ',
      'Trụ cột tại U23 Việt Nam (HCB U23 châu Á 2018, HCV SEA Games 2019, 2021)',
      'Chuyển từ Viettel sang Ninh Bình năm 2024 với mức giá kỷ lục',
      'Được nhiều CLB nước ngoài quan tâm'
    ],
    careerSummary: `Hoàng Đức là tài năng sáng giá nhất thế hệ 9X đời cuối của bóng đá Việt Nam. Sau khi trưởng thành từ Viettel — kế thừa di sản Thể Công, anh nhanh chóng trở thành tiền vệ công ổn định nhất V.League với nhãn quan chiến thuật, kỹ thuật đi bóng và khả năng chuyền dài thượng thừa.

3 lần liên tiếp đoạt Quả Bóng Vàng Việt Nam (2021, 2023, 2024) là minh chứng cho sự ổn định hiếm có. Năm 2024, Hoàng Đức tạo ra cú sốc khi chuyển sang CLB Ninh Bình — đội bóng mới nổi của V.League — với mức phí chuyển nhượng kỷ lục cho cầu thủ nội. Nhiều CLB Đông Nam Á và Nhật Bản cũng đã tiếp cận, và giới chuyên môn tin anh sẽ sớm xuất ngoại để phát huy tối đa tiềm năng.`,
    keyStats: {
      'V.League 2024/25': { matches: 21, goals: 3, assists: 9 },
      'AFF Cup 2024': { matches: 7, goals: 1, assists: 3 }
    }
  }
];

module.exports = { players };
