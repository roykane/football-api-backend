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
    image: '/vn-player-images/nguyen-quang-hai.jpg',
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
    image: '/vn-player-images/nguyen-cong-phuong.jpg',
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
    image: '/vn-player-images/dang-van-lam.jpg',
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
    image: '/vn-player-images/nguyen-tien-linh.png',
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
    image: '/vn-player-images/do-duy-manh.jpg',
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
    image: '/vn-player-images/nguyen-hoang-duc.png',
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
  },
  {
    slug: 'nguyen-xuan-son',
    name: 'Nguyễn Xuân Son',
    position: 'Tiền đạo',
    shirtNumber: 12,
    dob: '1997-09-01',
    birthplace: 'Manaus, Brazil',
    height: 185,
    weight: 81,
    currentClub: 'Nam Định',
    currentClubSlug: 'nam-dinh',
    nationalTeam: 'Việt Nam',
    caps: 9,
    goals: 7,
    foot: 'Phải',
    image: '/vn-player-images/nguyen-xuan-son.png',
    tags: ['xuân son', 'nguyễn xuân son', 'rafaelson', 'tiền đạo nhập tịch'],
    bio: 'Nguyễn Xuân Son (tên khai sinh Rafaelson Bezerra Fernandes) sinh ngày 1/9/1997 tại Manaus, Brazil. Là cầu thủ nhập tịch đầu tiên khoác áo ĐTQG Việt Nam và lập tức tỏa sáng rực rỡ tại AFF Cup 2024.',
    highlights: [
      'Vua phá lưới AFF Cup 2024 (7 bàn/7 trận)',
      'Cầu thủ xuất sắc nhất AFF Cup 2024',
      'Bàn thắng quyết định trong trận chung kết với Thái Lan',
      'Vô địch AFF Cup 2024 cùng ĐT Việt Nam',
      'Vô địch V.League 2023/24 cùng Nam Định'
    ],
    careerSummary: `Xuân Son là cầu thủ người Brazil từng khoác áo nhiều CLB nhỏ ở Bồ Đào Nha, Đan Mạch trước khi sang Việt Nam năm 2020. Thi đấu cho Nam Định, anh nhanh chóng trở thành chân sút số 1 V.League với 31 bàn mùa 2023/24 — kỷ lục giải đấu.

Sau 5 năm sinh sống tại Việt Nam, anh nhận quốc tịch cuối 2024 và được HLV Kim Sang-sik triệu tập ngay cho AFF Cup 2024. Màn ra mắt lịch sử: 7 bàn sau 7 trận, đoạt Vua phá lưới và Cầu thủ xuất sắc nhất giải. Chấn thương nặng trong trận chung kết với Thái Lan (gãy chân) là nỗi đáng tiếc, nhưng không ngăn được Việt Nam đăng quang và Xuân Son trở thành biểu tượng mới.`,
    keyStats: {
      'AFF Cup 2024': { matches: 7, goals: 7, assists: 2 },
      'V.League 2023/24': { matches: 25, goals: 31, assists: 6 }
    }
  },
  {
    slug: 'nguyen-filip',
    name: 'Nguyễn Filip',
    position: 'Thủ môn',
    shirtNumber: 23,
    dob: '1992-11-14',
    birthplace: 'Cộng hòa Séc',
    height: 193,
    weight: 85,
    currentClub: 'Công An Hà Nội',
    currentClubSlug: 'cong-an-ha-noi',
    nationalTeam: 'Việt Nam',
    caps: 13,
    goals: 0,
    foot: 'Phải',
    image: '/vn-player-images/nguyen-filip.png',
    tags: ['filip', 'nguyễn filip', 'thủ môn', 'công an hà nội'],
    bio: 'Nguyễn Filip (Filip Nguyễn) sinh ngày 14/11/1992 tại Séc, có cha là người Việt Nam. Cao 1m93, anh là thủ môn có thể hình lý tưởng và được đào tạo ở các học viện Séc chuyên nghiệp.',
    highlights: [
      'Thủ môn số 2 ĐT Cộng hòa Séc trước khi nhập tịch Việt Nam (2024)',
      'Vô địch AFF Cup 2024 cùng Việt Nam',
      'Vô địch V.League 2023/24 cùng Công An Hà Nội',
      'Từng khoác áo Slavia Prague, Sparta Prague, Slovan Liberec',
      'Cạnh tranh ngôi số 1 với Đặng Văn Lâm'
    ],
    careerSummary: `Filip là sản phẩm của hệ thống đào tạo thủ môn danh tiếng Séc. Anh từng là thủ môn số 2 tại Slavia Prague — đội bóng top đầu Czech League, và được triệu tập vào ĐT Cộng hòa Séc ở các cấp độ trẻ và Á dự bị ĐTQG.

Với dòng máu Việt từ cha, Filip chọn về Việt Nam năm 2023, gia nhập CLB Công An Hà Nội và trở thành thủ môn chủ lực ngay lập tức — đóng góp lớn vào chức vô địch V.League 2023/24. Sau khi hoàn tất quốc tịch đầu 2024, Filip được HLV Kim Sang-sik trao cơ hội và nhanh chóng khẳng định vị thế ở ĐTQG, san sẻ vai trò với Đặng Văn Lâm.`,
    keyStats: {
      'V.League 2024/25': { matches: 18, cleanSheets: 9 },
      'AFF Cup 2024': { matches: 6, cleanSheets: 3 }
    }
  },
  {
    slug: 'que-ngoc-hai',
    name: 'Quế Ngọc Hải',
    position: 'Trung vệ',
    shirtNumber: 3,
    dob: '1993-05-15',
    birthplace: 'Nghệ An',
    height: 180,
    weight: 74,
    currentClub: 'Bình Dương',
    currentClubSlug: 'binh-duong',
    nationalTeam: 'Việt Nam',
    caps: 91,
    goals: 6,
    foot: 'Phải',
    image: '/vn-player-images/que-ngoc-hai.jpg',
    tags: ['quế ngọc hải', 'ngọc hải', 'đội trưởng', 'trung vệ'],
    bio: 'Quế Ngọc Hải sinh ngày 15/5/1993 tại Nghệ An, là đội trưởng lâu năm của ĐT Việt Nam. Với tính cách mạnh mẽ, khả năng không chiến tốt và kinh nghiệm dày dặn, anh là trung vệ hàng đầu bóng đá Việt Nam thập kỷ qua.',
    highlights: [
      'Đội trưởng ĐT Việt Nam nhiều năm liên tiếp',
      '91 lần khoác áo ĐTQG — top 5 cầu thủ giàu caps nhất lịch sử',
      'Vô địch AFF Cup 2018, 2024',
      'Á quân U23 châu Á 2018 (Thường Châu)',
      'Tứ kết Asian Cup 2019'
    ],
    careerSummary: `Ngọc Hải trưởng thành từ học viện SLNA, ra mắt V.League năm 2012 và sớm khẳng định vị trí. Anh chuyển sang Viettel năm 2018, góp công vô địch V.League 2020 trước khi về Bình Dương năm 2024.

Ở ĐTQG, Ngọc Hải là trung vệ quan trọng nhất dưới thời Park Hang-seo và các HLV sau này. Tính cách quyết liệt, khả năng lãnh đạo và tinh thần "không bao giờ bỏ cuộc" giúp anh được chọn làm đội trưởng trong hầu hết các giải lớn. Với 91 trận ĐTQG và 6 bàn thắng (nhiều trận decisive từ phạt đền), Ngọc Hải là biểu tượng của thế hệ vàng bóng đá Việt Nam.`,
    keyStats: {
      'V.League 2024/25': { matches: 23, goals: 2, cleanSheets: 10 },
      'AFF Cup 2024': { matches: 7, goals: 0, cleanSheets: 4 }
    }
  },
  {
    slug: 'doan-van-hau',
    name: 'Đoàn Văn Hậu',
    position: 'Hậu vệ trái',
    shirtNumber: 15,
    dob: '1999-04-19',
    birthplace: 'Thái Bình',
    height: 184,
    weight: 76,
    currentClub: 'Công An Hà Nội',
    currentClubSlug: 'cong-an-ha-noi',
    nationalTeam: 'Việt Nam',
    caps: 36,
    goals: 4,
    foot: 'Trái',
    image: '/vn-player-images/doan-van-hau.jpg',
    tags: ['văn hậu', 'đoàn văn hậu', 'hậu vệ trái', 'thường châu'],
    bio: 'Đoàn Văn Hậu sinh ngày 19/4/1999 tại Thái Bình, là hậu vệ cánh trái thể hình lý tưởng (1m84) và được đánh giá là một trong những tài năng trẻ xuất sắc nhất thế hệ Thường Châu 2018.',
    highlights: [
      'Cầu thủ trẻ của năm châu Á 2018 (AFC)',
      'Xuất ngoại Hà Lan khoác áo Heerenveen (Eredivisie 2019-2020)',
      'Á quân U23 châu Á 2018 — thế hệ Thường Châu',
      'Vô địch AFF Cup 2018, 2024',
      'Trụ cột hàng thủ ĐTQG nhiều năm'
    ],
    careerSummary: `Văn Hậu trưởng thành từ lò đào tạo Hà Nội FC, ra mắt V.League năm 2016 khi mới 17 tuổi — trở thành cầu thủ ra mắt V.League trẻ nhất lịch sử. Năm 2019, anh sang Hà Lan khoác áo SC Heerenveen (Eredivisie) theo dạng cho mượn, trở thành cầu thủ Việt Nam hiếm hoi thi đấu ở Eredivisie.

Sau hơn một năm ở Hà Lan với ít cơ hội thi đấu, Văn Hậu trở về Hà Nội FC rồi chuyển sang CLB Công An Hà Nội. Chấn thương dai dẳng khiến anh bỏ lỡ nhiều trận đấu quan trọng của ĐTQG, nhưng khi có phong độ, Văn Hậu vẫn là hậu vệ cánh trái hàng đầu với khả năng tấn công + không chiến vượt trội.`,
    keyStats: {
      'V.League 2024/25': { matches: 15, goals: 1, assists: 3 },
      'AFF Cup 2024': { matches: 5, goals: 0, assists: 2 }
    }
  },
  {
    slug: 'pham-tuan-hai',
    name: 'Phạm Tuấn Hải',
    position: 'Tiền đạo',
    shirtNumber: 11,
    dob: '1998-05-16',
    birthplace: 'Hà Nam',
    height: 182,
    weight: 78,
    currentClub: 'Hà Nội FC',
    currentClubSlug: 'ha-noi',
    nationalTeam: 'Việt Nam',
    caps: 32,
    goals: 7,
    foot: 'Phải',
    image: '/vn-player-images/pham-tuan-hai.jpg',
    tags: ['tuấn hải', 'phạm tuấn hải', 'tiền đạo', 'hà nội fc'],
    bio: 'Phạm Tuấn Hải sinh ngày 16/5/1998 tại Hà Nam. Tiền đạo đa năng, có thể đá trung phong hoặc tiền đạo cánh, Tuấn Hải nổi lên từ Vòng loại World Cup 2022 với những pha xử lý đỉnh cao.',
    highlights: [
      'Vô địch AFF Cup 2024 cùng Việt Nam',
      'Bàn thắng đáng nhớ vào lưới Trung Quốc tại vòng loại WC 2022',
      'Vô địch V.League cùng Hà Nội FC',
      'Xuất thân từ CLB Hồng Lĩnh Hà Tĩnh, trưởng thành tại Hà Nội FC',
      'Được xem là hậu duệ của thế hệ vàng AFF Cup'
    ],
    careerSummary: `Tuấn Hải xuất thân từ CLB Hồng Lĩnh Hà Tĩnh trước khi gia nhập Hà Nội FC năm 2021. Ra mắt ĐTQG cùng năm, anh gây ấn tượng mạnh bằng phong cách chơi bóng hiện đại — kỹ thuật tốt, tốc độ và khả năng dứt điểm bằng cả hai chân.

Phong độ của Tuấn Hải đặc biệt ổn định ở các giải khu vực, góp mặt trong 3 kỳ AFF Cup liên tiếp (2020, 2022, 2024). Đặc biệt tại AFF Cup 2024, anh là mắt xích quan trọng trong hàng công cùng Tiến Linh và Xuân Son, giúp Việt Nam đăng quang.`,
    keyStats: {
      'V.League 2024/25': { matches: 22, goals: 8, assists: 5 },
      'AFF Cup 2024': { matches: 7, goals: 2, assists: 3 }
    }
  },
  {
    slug: 'nguyen-van-toan',
    name: 'Nguyễn Văn Toàn',
    position: 'Tiền đạo cánh',
    shirtNumber: 9,
    dob: '1996-04-12',
    birthplace: 'Hải Dương',
    height: 168,
    weight: 65,
    currentClub: 'Nam Định',
    currentClubSlug: 'nam-dinh',
    nationalTeam: 'Việt Nam',
    caps: 54,
    goals: 4,
    foot: 'Phải',
    image: '/vn-player-images/nguyen-van-toan.jpg',
    tags: ['văn toàn', 'nguyễn văn toàn', 'hagl', 'tiền đạo cánh'],
    bio: 'Nguyễn Văn Toàn sinh ngày 12/4/1996, là sản phẩm của học viện HAGL Arsenal JMG cùng thế hệ Công Phượng, Xuân Trường, Tuấn Anh. Nhanh nhẹn, khéo léo và chăm chỉ, Văn Toàn là tiền đạo cánh đáng tin cậy của ĐTQG suốt một thập kỷ.',
    highlights: [
      'Thế hệ vàng HAGL Arsenal JMG',
      'Xuất ngoại Hàn Quốc khoác áo Seoul E-Land (2022-2023)',
      'Vô địch AFF Cup 2018 cùng Việt Nam',
      'Bàn thắng vàng vs Syria ở ASIAD 2018 — đưa Việt Nam vào bán kết',
      'Chuyển sang Nam Định năm 2024'
    ],
    careerSummary: `Văn Toàn là một trong những sản phẩm xuất sắc nhất của học viện HAGL Arsenal JMG — thế hệ đã thay đổi bộ mặt bóng đá Việt Nam. Ra mắt V.League năm 2015, anh nhanh chóng trở thành tiền đạo cánh quan trọng nhờ tốc độ, khả năng đi bóng và tinh thần chiến đấu không mệt mỏi.

Pha đi bóng và ghi bàn vàng vào lưới Syria ở ASIAD 2018 (U23 Việt Nam) là khoảnh khắc để đời, đưa Việt Nam vào bán kết kỳ Á vận hội lịch sử. Sau gần một thập kỷ cống hiến cho HAGL, anh sang Hàn Quốc khoác áo Seoul E-Land năm 2022 — trở thành một trong những cầu thủ Việt Nam hiếm hoi thi đấu ở K League 2. Trở về Việt Nam năm 2024, anh gia nhập Nam Định cùng Xuân Son.`,
    keyStats: {
      'V.League 2024/25': { matches: 18, goals: 5, assists: 6 },
      'AFF Cup 2024': { matches: 5, goals: 1, assists: 2 }
    }
  },
  {
    slug: 'nguyen-tuan-anh',
    name: 'Nguyễn Tuấn Anh',
    position: 'Tiền vệ trung tâm',
    shirtNumber: 8,
    dob: '1995-05-16',
    birthplace: 'Thái Bình',
    height: 176,
    weight: 65,
    currentClub: 'Nam Định',
    currentClubSlug: 'nam-dinh',
    nationalTeam: 'Việt Nam',
    caps: 24,
    goals: 1,
    foot: 'Phải',
    image: '/vn-player-images/nguyen-tuan-anh.jpg',
    tags: ['tuấn anh', 'nguyễn tuấn anh', 'hagl', 'nhạc trưởng'],
    bio: 'Nguyễn Tuấn Anh sinh ngày 16/5/1995 tại Thái Bình, là tiền vệ kiến thiết tài hoa nhất lứa HAGL Arsenal JMG. Kỹ thuật điêu luyện, tầm nhìn tốt nhưng sự nghiệp bị cản trở bởi nhiều chấn thương nặng.',
    highlights: [
      'Tiền vệ tài hoa nhất HAGL Arsenal JMG',
      'Vô địch V.League 2023/24 cùng Nam Định',
      'Thi đấu 1 trận cho Yokohama FC (J1 2016) — hiếm hoi',
      'Trụ cột tuyến giữa U23 Việt Nam vào Thường Châu 2018',
      'Trở lại ấn tượng sau nhiều lần chấn thương'
    ],
    careerSummary: `Tuấn Anh được xem là cầu thủ "tài hoa bạc mệnh" của bóng đá Việt Nam. Trưởng thành từ HAGL Arsenal JMG với kỹ thuật và nhãn quan được ví như Pirlo Việt Nam, anh từng thi đấu 1 trận cho Yokohama FC ở J1 (2016) — trải nghiệm hiếm hoi.

Tuy nhiên, các chấn thương dây chằng nặng liên tục khiến sự nghiệp Tuấn Anh bị gián đoạn nhiều lần. Mặc dù vậy, khi có phong độ, anh vẫn là một trong những tiền vệ kiến thiết xuất sắc nhất V.League. Năm 2023, Tuấn Anh chuyển sang Nam Định và góp công lớn vào chức vô địch V.League 2023/24 — chứng tỏ đẳng cấp vẫn còn nguyên.`,
    keyStats: {
      'V.League 2024/25': { matches: 19, goals: 2, assists: 7 },
      'AFF Cup 2024': { matches: 4, goals: 0, assists: 1 }
    }
  },
  {
    slug: 'luong-xuan-truong',
    name: 'Lương Xuân Trường',
    position: 'Tiền vệ trung tâm',
    shirtNumber: 6,
    dob: '1995-04-28',
    birthplace: 'Tuyên Quang',
    height: 178,
    weight: 68,
    currentClub: 'Hải Phòng',
    currentClubSlug: 'hai-phong',
    nationalTeam: 'Việt Nam',
    caps: 41,
    goals: 0,
    foot: 'Phải',
    image: '/vn-player-images/luong-xuan-truong.jpg',
    tags: ['xuân trường', 'lương xuân trường', 'hagl', 'nhạc trưởng'],
    bio: 'Lương Xuân Trường sinh ngày 28/4/1995 tại Tuyên Quang. Cùng Tuấn Anh, Công Phượng, anh là trụ cột của thế hệ HAGL Arsenal JMG — đội bóng đã thay đổi bóng đá Việt Nam.',
    highlights: [
      'Cầu thủ Việt Nam đầu tiên xuất ngoại Hàn Quốc (Incheon United 2016)',
      'Tiếp tục khoác áo Gangwon FC (K League 1 2017)',
      'Á quân U23 châu Á 2018 — thế hệ Thường Châu',
      'Đội trưởng U23 Việt Nam nhiều năm',
      'Từng khoác áo Buriram United (Thai League 2019)'
    ],
    careerSummary: `Xuân Trường là cầu thủ Việt Nam đầu tiên thi đấu chuyên nghiệp ở Hàn Quốc khi gia nhập Incheon United năm 2016 và sau đó là Gangwon FC năm 2017 — cả hai đều ở K League 1. Anh cũng từng khoác áo Buriram United (Thai League 1) năm 2019.

Ở ĐTQG và U23, Xuân Trường thường đảm nhiệm vai trò thủ lĩnh tuyến giữa với khả năng cầm nhịp, phân phối bóng và đặc biệt là những quả phạt trực tiếp đẳng cấp. Năm 2024, anh chuyển sang CLB Hải Phòng sau một thời gian ở HAGL, tiếp tục đóng góp cho bóng đá nội địa.`,
    keyStats: {
      'V.League 2024/25': { matches: 17, goals: 1, assists: 4 }
    }
  },
  {
    slug: 'bui-tien-dung-cb',
    name: 'Bùi Tiến Dũng',
    position: 'Trung vệ',
    shirtNumber: 4,
    dob: '1995-10-02',
    birthplace: 'Hà Tĩnh',
    height: 181,
    weight: 74,
    currentClub: 'Viettel',
    currentClubSlug: 'viettel',
    nationalTeam: 'Việt Nam',
    caps: 56,
    goals: 2,
    foot: 'Phải',
    image: '/vn-player-images/bui-tien-dung-cb.png',
    tags: ['bùi tiến dũng', 'trung vệ', 'viettel', 'thường châu'],
    bio: 'Bùi Tiến Dũng (trung vệ, sinh 1995) — khác với thủ môn Bùi Tiến Dũng (sinh 1997) — là trung vệ trụ cột của Viettel và ĐT Việt Nam nhiều năm. Sinh tại Hà Tĩnh, anh là trung vệ mạnh mẽ, thiên về thể lực.',
    highlights: [
      'Trụ cột hàng thủ Thường Châu 2018',
      'Vô địch V.League 2020 cùng Viettel',
      'Vô địch AFF Cup 2018, 2024',
      'Trung vệ kỳ cựu 56 trận ĐTQG',
      'Partner với Quế Ngọc Hải ở trung tâm hàng thủ'
    ],
    careerSummary: `Tiến Dũng (sinh 1995) xuất thân từ CLB Hồng Lĩnh Hà Tĩnh trước khi chuyển sang Viettel năm 2019. Tại đây, anh nhanh chóng trở thành trụ cột và góp công lớn vào chức vô địch V.League 2020 — chức vô địch đầu tiên của Viettel thời hiện đại.

Ở ĐTQG, Dũng thường kết hợp với Quế Ngọc Hải thành cặp trung vệ kỳ cựu đầy kinh nghiệm. Điểm mạnh của anh là sức mạnh thể hình, khả năng không chiến và tinh thần chiến đấu. Dũng là một trong những trụ cột hàng thủ đưa Việt Nam vào tứ kết Asian Cup 2019 — thành tích lịch sử.`,
    keyStats: {
      'V.League 2024/25': { matches: 20, goals: 1, cleanSheets: 9 },
      'AFF Cup 2024': { matches: 6, goals: 0, cleanSheets: 3 }
    }
  },
  {
    slug: 'nguyen-van-quyet',
    name: 'Nguyễn Văn Quyết',
    position: 'Tiền vệ tấn công',
    shirtNumber: 10,
    dob: '1991-07-07',
    birthplace: 'Hà Nội',
    height: 172,
    weight: 67,
    currentClub: 'Hà Nội FC',
    currentClubSlug: 'ha-noi',
    nationalTeam: 'Việt Nam',
    caps: 49,
    goals: 10,
    foot: 'Phải',
    image: '/vn-player-images/nguyen-van-quyet.jpg',
    tags: ['văn quyết', 'nguyễn văn quyết', 'đội trưởng hà nội', 'huyền thoại'],
    bio: 'Nguyễn Văn Quyết sinh ngày 7/7/1991 tại Hà Nội, là huyền thoại sống của CLB Hà Nội FC và bóng đá Việt Nam. Gắn bó với CLB thủ đô từ năm 2010, anh là đội trưởng và là nhạc trưởng của đội bóng 4 lần vô địch V.League.',
    highlights: [
      'Đội trưởng huyền thoại của Hà Nội FC',
      'Quả Bóng Vàng Việt Nam 2020, 2022',
      '5 lần vô địch V.League cùng Hà Nội FC',
      'Cầu thủ V.League ghi nhiều bàn nhất lịch sử (150+ bàn)',
      'Từng là đội trưởng ĐT Việt Nam'
    ],
    careerSummary: `Văn Quyết là biểu tượng của lòng trung thành và sự chuyên nghiệp trong bóng đá Việt Nam. Gắn bó với Hà Nội FC từ năm 2010 đến nay (hơn 15 năm), anh đã vô địch V.League 5 lần, trở thành một trong những cầu thủ thành công nhất lịch sử giải đấu.

Với kỹ thuật điêu luyện, khả năng chuyền bóng và ghi bàn cả bằng chân lẫn không chiến, Văn Quyết là mẫu "số 10" cổ điển. Ở ĐTQG, anh từng là đội trưởng và đạt 49 trận/10 bàn. Dù đã bước qua tuổi 33, anh vẫn duy trì phong độ ấn tượng và 2 lần đoạt Quả Bóng Vàng Việt Nam (2020, 2022) sau độ tuổi 29 — minh chứng cho sự ổn định hiếm có.`,
    keyStats: {
      'V.League 2024/25': { matches: 22, goals: 6, assists: 9 }
    }
  },
  {
    slug: 'le-cong-vinh',
    name: 'Lê Công Vinh',
    position: 'Tiền đạo (đã giải nghệ)',
    shirtNumber: 9,
    dob: '1985-12-10',
    birthplace: 'Nghệ An',
    height: 173,
    weight: 72,
    currentClub: 'Đã giải nghệ (2016)',
    currentClubSlug: 'sla-nghe-an',
    nationalTeam: 'Việt Nam',
    caps: 83,
    goals: 51,
    foot: 'Phải',
    image: '/vn-player-images/le-cong-vinh.png',
    tags: ['công vinh', 'lê công vinh', 'huyền thoại', 'vua phá lưới đtvn'],
    bio: 'Lê Công Vinh sinh ngày 10/12/1985 tại Nghệ An, là huyền thoại vĩ đại nhất bóng đá Việt Nam hiện đại. Anh giữ kỷ lục ghi bàn cho ĐTQG với 51 bàn sau 83 trận — vẫn chưa ai phá được.',
    highlights: [
      'Vua phá lưới mọi thời đại ĐT Việt Nam (51 bàn)',
      'Quả Bóng Vàng Việt Nam 2004, 2006, 2007 (3 lần)',
      'Vô địch AFF Cup 2008 — bàn thắng vàng vào lưới Thái Lan',
      'Từng khoác áo Leixões (Bồ Đào Nha 2009) và Sapporo (J2 2013)',
      'Giải nghệ năm 2016, hiện làm bình luận viên và kinh doanh'
    ],
    careerSummary: `Lê Công Vinh là tiền đạo xuất sắc nhất lịch sử bóng đá Việt Nam. Trưởng thành từ lò Sông Lam Nghệ An, anh sớm khẳng định mình với Quả Bóng Vàng đầu tiên năm 2004 khi mới 19 tuổi — tiền đạo trẻ nhất đoạt danh hiệu này.

Khoảnh khắc để đời của Công Vinh là pha đánh đầu quyết định vào lưới Thái Lan ở phút 90+4 trận chung kết lượt về AFF Cup 2008 — đưa Việt Nam vô địch Đông Nam Á lần đầu tiên trong lịch sử. Anh cũng là cầu thủ Việt Nam đầu tiên thi đấu ở châu Âu (Leixões, Bồ Đào Nha 2009) và J League (Sapporo, J2 2013).

Giải nghệ năm 2016 ở tuổi 31, Công Vinh chuyển sang làm bình luận viên, diễn giả, chủ sở hữu thương hiệu và kinh doanh. Anh để lại kỷ lục 51 bàn ĐTQG mà chưa cầu thủ nào phá được.`,
    keyStats: {
      'ĐT Việt Nam (sự nghiệp)': { matches: 83, goals: 51 },
      'AFF Cup 2008 (vô địch)': { matches: 8, goals: 2 }
    }
  },
  {
    slug: 'khuat-van-khang',
    name: 'Khuất Văn Khang',
    position: 'Tiền vệ cánh',
    shirtNumber: 27,
    dob: '2003-04-06',
    birthplace: 'Hà Nội',
    height: 175,
    weight: 68,
    currentClub: 'Viettel',
    currentClubSlug: 'viettel',
    nationalTeam: 'Việt Nam',
    caps: 18,
    goals: 2,
    foot: 'Trái',
    image: '/vn-player-images/khuat-van-khang.png',
    tags: ['văn khang', 'khuất văn khang', 'trẻ triển vọng', 'viettel'],
    bio: 'Khuất Văn Khang sinh ngày 6/4/2003 tại Hà Nội, là một trong những tài năng trẻ triển vọng nhất bóng đá Việt Nam hiện tại. Trưởng thành từ lò Viettel, anh nhanh chóng được tin dùng ở ĐTQG.',
    highlights: [
      'Cầu thủ trẻ xuất sắc nhất Việt Nam 2023',
      'Vô địch AFF Cup 2024 — khoảnh khắc ngôi sao trẻ',
      'HCB U23 Đông Nam Á 2023',
      'Được kỳ vọng là "Quang Hải tiếp theo"',
      'Trụ cột U23 Việt Nam thế hệ mới'
    ],
    careerSummary: `Văn Khang là sản phẩm của lò đào tạo trẻ Viettel — nơi từng sinh ra Hoàng Đức. Ra mắt V.League năm 2021 khi mới 18 tuổi, anh nhanh chóng gây ấn tượng mạnh với kỹ thuật cá nhân, khả năng đi bóng hai chân và nhãn quan chiến thuật.

Ở ĐTQG, Văn Khang được HLV Park Hang-seo và sau này là Kim Sang-sik tin dùng như một lựa chọn đa năng — có thể đá tiền vệ cánh trái, tiền vệ công hoặc tiền vệ trung tâm. Tại AFF Cup 2024, Văn Khang góp công không nhỏ vào chức vô địch và được nhiều chuyên gia đánh giá là "Quang Hải tiếp theo" của thế hệ kế cận.`,
    keyStats: {
      'V.League 2024/25': { matches: 20, goals: 3, assists: 5 },
      'AFF Cup 2024': { matches: 6, goals: 1, assists: 2 }
    }
  },
  {
    slug: 'nguyen-van-toan-gk',
    name: 'Nguyễn Văn Toản',
    position: 'Thủ môn',
    shirtNumber: 16,
    dob: '1999-04-25',
    birthplace: 'Hải Phòng',
    height: 183,
    weight: 78,
    currentClub: 'Nam Định',
    currentClubSlug: 'nam-dinh',
    nationalTeam: 'Việt Nam',
    caps: 8,
    goals: 0,
    foot: 'Phải',
    image: '/vn-player-images/nguyen-van-toan-gk.png',
    tags: ['văn toản', 'nguyễn văn toản', 'thủ môn trẻ', 'hải phòng'],
    bio: 'Nguyễn Văn Toản sinh ngày 25/4/1999 tại Hải Phòng, là thủ môn trẻ triển vọng của bóng đá Việt Nam. Cao 1m83 với phản xạ tốt, anh là lựa chọn dự bị quan trọng cho Văn Lâm và Filip.',
    highlights: [
      'Vô địch V.League 2023/24 cùng Nam Định',
      'Từng là thủ môn số 1 CLB Hải Phòng',
      'U23 Việt Nam dự VCK U23 châu Á 2020',
      'Thủ môn chính ĐT U22 Việt Nam',
      'Chuyển từ Hải Phòng sang Nam Định năm 2023'
    ],
    careerSummary: `Văn Toản là sản phẩm của lò Hải Phòng, ra mắt V.League năm 2018 ở tuổi 19 và nhanh chóng trở thành thủ môn số 1 của đội bóng đất cảng. Năm 2023, anh chuyển sang Nam Định và góp phần quan trọng vào chức vô địch V.League 2023/24 — chức vô địch lịch sử sau nhiều thập kỷ của thành Nam.

Ở ĐTQG, Văn Toản là thủ môn số 3 sau Văn Lâm và Filip, nhưng được đánh giá là tương lai của vị trí khung gỗ Việt Nam. Phản xạ nhanh, kỹ năng bắt bóng bổng tốt và tư duy trận đấu chín chắn là những điểm mạnh giúp anh sớm cạnh tranh vị trí số 1.`,
    keyStats: {
      'V.League 2024/25': { matches: 12, cleanSheets: 6 },
      'AFF Cup 2024': { matches: 1, cleanSheets: 1 }
    }
  },
  {
    slug: 'phan-tuan-tai',
    name: 'Phan Tuấn Tài',
    position: 'Hậu vệ trái',
    shirtNumber: 5,
    dob: '2001-10-22',
    birthplace: 'Đắk Lắk',
    height: 174,
    weight: 68,
    currentClub: 'Viettel',
    currentClubSlug: 'viettel',
    nationalTeam: 'Việt Nam',
    caps: 15,
    goals: 1,
    foot: 'Trái',
    image: '/vn-player-images/phan-tuan-tai.jpg',
    tags: ['tuấn tài', 'phan tuấn tài', 'hậu vệ trái trẻ', 'viettel'],
    bio: 'Phan Tuấn Tài sinh ngày 22/10/2001 tại Đắk Lắk, là hậu vệ cánh trái trẻ triển vọng của bóng đá Việt Nam. Trưởng thành từ lò Viettel, anh được kỳ vọng là người kế thừa vị trí của Đoàn Văn Hậu.',
    highlights: [
      'Vô địch AFF Cup 2024 cùng Việt Nam',
      'HCV SEA Games 31 cùng U23 Việt Nam',
      'Cầu thủ trẻ được kỳ vọng kế thừa Văn Hậu',
      'Hậu vệ cánh nhanh nhẹn và lên công về thủ tốt',
      'Trụ cột U23 Việt Nam nhiều năm'
    ],
    careerSummary: `Tuấn Tài trưởng thành từ lò trẻ Viettel, ra mắt V.League năm 2021 và sớm khẳng định mình với lối chơi tốc độ, thể lực dồi dào và khả năng tấn công biên tốt. Anh cùng Khuất Văn Khang tạo thành cặp đôi trẻ đáng chú ý của Viettel và U23 Việt Nam.

Ở SEA Games 31 (2022), Tuấn Tài đóng góp quan trọng vào chiếc HCV lịch sử của U23 Việt Nam. Được HLV Kim Sang-sik triệu tập cho AFF Cup 2024, anh tiếp tục khẳng định vai trò hậu vệ trái dự bị đắc lực cho Đoàn Văn Hậu và được kỳ vọng sẽ chiếm suất chính thức trong vài năm tới.`,
    keyStats: {
      'V.League 2024/25': { matches: 18, goals: 1, assists: 3 },
      'AFF Cup 2024': { matches: 4, goals: 0, assists: 1 }
    }
  }
];

module.exports = { players };
