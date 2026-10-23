/**
 * MoveSafe VN - Cơ sở dữ liệu ẩm thực, ăn uống & điểm vui chơi giải trí đô thị
 * Hỗ trợ Trợ lý AI MoveSafe đề xuất địa điểm thực tế, chuẩn vị, chất lượng cao
 * Chuẩn UMD: Hoạt động đồng bộ trên cả Trình duyệt (Client) và Node.js (Server)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FOOD_ENTERTAINMENT_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const FOOD_KEYWORDS_REGEX = /(?:quán ăn|ăn gì|ăn uống|quán ngon|món ngon|đặc sản|nhà hàng|buffet|lẩu|nướng|quán nhậu|phở|bún|cơm|bánh mì|cafe|cà phê|trà sữa|vui chơi|chỗ chơi|đi chơi|chơi đâu|giải trí|check-in|checkin|dạo phố|rạp phim|trung tâm thương mại|hồ|công viên|quán nào|nơi nào|chỗ nào|uống gì|ăn sáng|ăn trưa|ăn tối|đồ uống|chỗ tụ tập)/i;

  const AREAS_GUIDE = {
    // 1. Khu vực Mỹ Đình & Nam Từ Liêm
    mydinh: {
      aliases: ['mỹ đình', 'my dinh', 'đình thôn', 'dinh thon', 'lê đức thọ', 'le duc tho', 'nguyễn hoàng', 'nguyen hoang', 'the manor', 'mễ trì', 'me tri', 'nam từ liêm', 'nam tu liem', 'svđ mỹ đình', 'bến xe mỹ đình', 'ben xe my dinh'],
      title: 'Khu vực Mỹ Đình & Nam Từ Liêm (Hà Nội)',
      highlight: 'Thiên đường ẩm thực nướng Hàn Quốc, món ngon truyền thống và không gian dạo mát rộng nhất Thủ đô.',
      spots: [
        {
          name: 'Phố Ẩm Thực Hàn Quốc K-Town (Đình Thôn - The Manor)',
          address: 'Đường Đình Thôn & Khu The Manor Mễ Trì',
          feature: 'Thịt bò nướng tảng tươi ngon, canh kim chi, gà rán sốt cay chuẩn vị Seoul (Meat Plus No.1 BBQ, Baek Jeong, K-Pub).',
          vibe: 'Không gian sang trọng, chuẩn phong cách Hàn Quốc.',
          price: '200.000đ - 450.000đ/người'
        },
        {
          name: 'Bún Chả Sinh Từ Mỹ Đình',
          address: 'Đường Nguyễn Hoàng (cạnh ngã ba Lê Đức Thọ)',
          feature: 'Chả miếng nướng than hoa thơm lừng, chả băm mềm ngọt béo bùi, nước chấm đậm đà ăn kèm nem hải sản giòn rụm.',
          vibe: 'Không gian sạch sẽ, máy lạnh mát rượi, phục vụ nhanh.',
          price: '50.000đ - 75.000đ/suất'
        },
        {
          name: 'Nhà Hàng Hải Sản Biển Đông & Lẩu Cua Đồng',
          address: 'Khu đô thị The Manor & Đường Đỗ Đức Dục',
          feature: 'Hải sản tươi sống bắt tại bể (tôm hùm, cua Cà Mau, cá song) và lẩu riêu cua bắp bò thanh mát.',
          vibe: 'Không gian rộng rãi, có phòng VIP tiếp khách hoặc tụ họp gia đình.',
          price: '250.000đ - 500.000đ/người'
        },
        {
          name: 'Quảng Trường Sân Vận Động Quốc Gia Mỹ Đình',
          address: 'Đường Lê Đức Thọ, P. Mỹ Đình 1',
          feature: 'Không gian gió mát lộng buổi chiều tối, thả diều, trượt patin, thưởng thức trà chanh giã tay, xúc xích nướng đá ven đường.',
          vibe: 'Cực kỳ thoáng đãng, điểm tụ tập hóng mát số 1 khu Tây Hà Nội.',
          price: '15.000đ - 40.000đ'
        },
        {
          name: 'TTTM The Garden Shopping Center & Rạp Phim CGV',
          address: 'Khu đô thị The Manor Mễ Trì',
          feature: 'Tổ hợp mua sắm, ẩm thực quốc tế tầng hầm B1, cụm rạp chiếu phim CGV cao cấp và cà phê ngoài trời ngắm kiến trúc Paris thu nhỏ.',
          vibe: 'Hiện đại, mát mẻ, tiện lợi giải trí trọn gói cả ngày.',
          price: 'Vé phim ~100.000đ, ăn uống tự chọn'
        }
      ],
      trafficTip: 'Xe máy có thể đỗ miễn phí trước cửa hầu hết các quán trên đường Lê Đức Thọ và Nguyễn Hoàng. Nếu đi ô tô, bạn nên gửi xe an toàn tại hầm TTTM The Garden hoặc bãi đỗ xe cạnh Cung Điền kinh Mỹ Đình để tránh bị phạt.'
    },

    // 2. Khu vực Cầu Giấy
    caugiay: {
      aliases: ['cầu giấy', 'cau giay', 'tô hiệu', 'to hieu', 'nghĩa tân', 'nghia tan', 'chùa láng', 'chua lang', 'dịch vọng', 'dich vong', 'xuân thủy', 'xuan thuy', 'trần thái tông', 'tran thai tong', 'duy tân', 'duy tan'],
      title: 'Khu vực Quận Cầu Giấy (Hà Nội)',
      highlight: 'Thủ phủ ẩm thực đường phố, phố ăn vặt Tô Hiệu - Nghĩa Tân và các tổ hợp cà phê trẻ trung.',
      spots: [
        {
          name: 'Phố Ẩm Thực Tô Hiệu & Chợ Nghĩa Tân',
          address: 'Khu tập thể Nghĩa Tân & Phố Tô Hiệu',
          feature: 'Bánh mì chảo Cột Điện Quán, Bún chả Tô Hiệu, Tào phớ caramen Nghĩa Tân, Chè bưởi thơm nức tiếng sinh viên.',
          vibe: 'Nhộn nhịp, bình dân, hương vị đậm đà khó quên.',
          price: '20.000đ - 55.000đ'
        },
        {
          name: 'Bò Tơ Quán Mộc',
          address: 'Đường Nguyễn Thị Định & Đường Trần Thái Tông',
          feature: 'Bò tơ cuốn bánh tráng rau rừng, bò cháy tỏi, lẩu riêu cua bắp bò tơ ngọt lịm.',
          vibe: 'Không gian phong cách phố cổ Hà Nội thập niên 80, ấm cúng.',
          price: '180.000đ - 280.000đ/người'
        },
        {
          name: 'All Day Coffee & Trà Chiều',
          address: 'Đường Trần Thái Tông & Phố Dịch Vọng Hậu',
          feature: 'Cà phê rang mộc thơm lừng, trà trái cây nhiệt đới, bánh croissant trứng muối nóng giòn.',
          vibe: 'Không gian sang trọng, góc check-in sống ảo phong cách châu Âu.',
          price: '55.000đ - 85.000đ'
        },
        {
          name: 'Công Viên Cầu Giấy',
          address: 'Đường Thành Thái, P. Dịch Vọng',
          feature: 'Đồi cỏ nhân tạo rộng lớn cho trẻ em chạy nhảy, hồ nước điều hòa thoáng mát, đường dạo bộ xanh mướt.',
          vibe: 'Thiên nhiên trong lành, thư giãn tuyệt vời sau giờ làm việc.',
          price: 'Vào cổng miễn phí'
        }
      ],
      trafficTip: 'Phố Tô Hiệu và Chùa Láng mật độ xe máy rất đông vào khung giờ 11h30 - 13h00 và 18h00 - 19h30. Nếu đi ô tô, nên chọn các quán có bảo vệ dắt xe hoặc gửi ở bãi đỗ Công viên Cầu Giấy.'
    },

    // 3. Khu vực Hoàn Kiếm & Phố Cổ
    hoankiem: {
      aliases: ['hoàn kiếm', 'hoan kiem', 'phố cổ', 'pho co', 'hồ gươm', 'ho guom', 'bát đàn', 'bat dan', 'tạ hiện', 'ta hien', 'tràng tiền', 'trang tien', 'hàng bài', 'đinh tiên hoàng', 'hàng buồm'],
      title: 'Khu vực Hoàn Kiếm & 36 Phố Phường (Hà Nội)',
      highlight: 'Cái nôi tinh hoa ẩm thực Kinh Kỳ với các món truyền thống lâu đời và phố đi bộ sôi động.',
      spots: [
        {
          name: 'Phở Gia Truyền Bát Đàn & Phở Thìn Bờ Hồ',
          address: '49 Bát Đàn / 61 Đinh Tiên Hoàng',
          feature: 'Nước dùng ninh xương bò trong veo ngọt thanh, thịt bò tái lăn mềm thơm, quẩy giòn tan.',
          vibe: 'Mộc mạc, đậm chất Hà Nội xưa, luôn tấp nập khách sành ăn.',
          price: '55.000đ - 80.000đ/bát'
        },
        {
          name: 'Bún Chả Hàng Quạt & Bún Đậu Ngõ Tràng Tiền',
          address: 'Ngõ 74 Hàng Quạt / Ngõ Tràng Tiền',
          feature: 'Chả quạt nướng cháy xém cạnh đượm mùi khói than hoa, nem cua bể giòn rụm.',
          vibe: 'Ẩm thực ngõ nhỏ phố nhỏ đặc trưng Hà Nội.',
          price: '40.000đ - 65.000đ'
        },
        {
          name: 'Cafe Giảng Trứng & Kem Tràng Tiền',
          address: '39 Nguyễn Hữu Huân / 35 Tràng Tiền',
          feature: 'Cà phê trứng béo ngậy thơm lừng bí truyền từ năm 1946; kem cốm, kem ốc quế Tràng Tiền.',
          vibe: 'Biểu tượng văn hóa ẩm thực Thủ đô.',
          price: '15.000đ - 45.000đ'
        },
        {
          name: 'Không Gian Đi Bộ Hồ Hoàn Kiếm & Phố Bia Tạ Hiện',
          address: 'Xung quanh Hồ Gươm & Ngã tư Tạ Hiện - Lương Ngọc Quyến',
          feature: 'Biểu diễn nghệ thuật đường phố, nhạc acoustic, ngắm Tháp Rùa lung linh và giao lưu bạn bè quốc tế.',
          vibe: 'Sôi động, nhộn nhịp, rực rỡ sắc màu về đêm.',
          price: 'Tự do tham quan'
        }
      ],
      trafficTip: 'Từ 19h00 thứ Sáu đến hết Chủ nhật, toàn bộ tuyến đường quanh Hồ Gươm chuyển thành Phố đi bộ. Xe máy nên gửi tại các điểm trông giữ phố Hai Bà Trưng, Hàng Bài; ô tô gửi ở tầng hầm Tràng Tiền Plaza hoặc Cung Thiếu nhi.'
    },

    // 4. Khu vực Tây Hồ
    tayho: {
      aliases: ['tây hồ', 'tay ho', 'hồ tây', 'ho tay', 'quảng bá', 'quang ba', 'xuân diệu', 'xuan dieu', 'từ hoa', 'tu hoa', 'nhật tân', 'nhat tan', 'thanh niên', 'thanh nien', 'trúc bạch', 'truc bach'],
      title: 'Khu vực Hồ Tây & Tây Hồ (Hà Nội)',
      highlight: 'Không gian lộng gió, ẩm thực ven hồ lãng mạn và các quán cafe ngắm hoàng hôn đẹp nhất Việt Nam.',
      spots: [
        {
          name: 'Bánh Tôm Hồ Tây & Ốc Nóng Quảng Bá',
          address: 'Đường Thanh Niên & Phố Quảng Bá',
          feature: 'Bánh tôm chiên giòn rụm với tôm tươi búng tanh tách, ốc luộc mắm gừng sả ớt cay nồng.',
          vibe: 'View ngắm sóng nước Hồ Tây mênh mông, đón gió mát trong lành.',
          price: '50.000đ - 120.000đ'
        },
        {
          name: 'Chuỗi Cafe Ngắm Hoàng Hôn Phố Từ Hoa & Quảng Khánh',
          address: 'Đường Từ Hoa, Vệ Hồ, Quảng Khánh',
          feature: 'Santorino Coffee, Chốn Riêng Coffee, cà phê view thẳng mặt hồ đón ánh hoàng hôn đỏ rực tuyệt mỹ.',
          vibe: 'Lãng mạn, yên tĩnh, cực kỳ thích hợp hẹn hò hoặc thư giãn cuối tuần.',
          price: '45.000đ - 80.000đ'
        },
        {
          name: 'Thung Lũng Hoa Hồ Tây & Công Viên Nước Hồ Tây',
          address: 'Ngõ 612 Lạc Long Quân, P. Nhật Tân',
          feature: 'Vườn hoa bốn mùa khoe sắc, công viên trượt nước sảng khoái và dịch vụ cắm trại glamping bên hồ.',
          vibe: 'Rực rỡ sắc màu, góc chụp ảnh kỷ niệm tuyệt đẹp.',
          price: '80.000đ - 150.000đ/vé'
        }
      ],
      trafficTip: 'Đường ven hồ Từ Hoa và Quảng Khánh khá hẹp, nên ưu tiên di chuyển bằng xe máy. Nếu đi ô tô, bạn nên gửi xe tại bãi xe ngã ba Xuân Diệu - Đặng Thai Mai rồi tản bộ dạo hồ.'
    },

    // 5. Khu vực Ba Đình
    badinh: {
      aliases: ['ba đình', 'ba dinh', 'ngũ xã', 'ngu xa', 'đội cấn', 'doi can', 'liễu giai', 'lieu giai', 'kim mã', 'kim ma', 'giảng võ', 'giang vo', 'lăng bác', 'lang bac'],
      title: 'Khu vực Quận Ba Đình (Hà Nội)',
      highlight: 'Phố ẩm thực phở cuốn Ngũ Xã ven hồ Trúc Bạch và các di tích lịch sử trung tâm.',
      spots: [
        {
          name: 'Phở Cuốn Hương Mai & Hưng Bền Ngũ Xã',
          address: 'Phố Ngũ Xã (bán đảo Trúc Bạch)',
          feature: 'Phở cuốn thịt bò tươi ngọt kèm rau thơm mộc mạc, phở chiên phồng xào bò giòn béo, chả ngan nướng.',
          vibe: 'Khu ẩm thực đêm ven hồ Trúc Bạch nhộn nhịp, thoáng đãng.',
          price: '65.000đ - 120.000đ/đĩa'
        },
        {
          name: 'Nem Lụi Bánh Xèo Phố Đội Cấn & Bún Ốc Cô Huệ',
          address: 'Đường Đội Cấn & Phố Đặng Dung',
          feature: 'Bánh xèo giòn rụm vàng ươm cuốn nem lụi nướng chấm nước lèo béo thơm, bún ốc nguội giấm bỗng gia truyền.',
          vibe: 'Quán ăn bình dân, hương vị đậm đà lâu năm.',
          price: '35.000đ - 70.000đ'
        },
        {
          name: 'Lotte Observation Deck (Đài Quan Sát Tầng 65)',
          address: '54 Liễu Giai, P. Cống Vị',
          feature: 'Ngắm toàn cảnh Hà Nội từ độ cao gần 300m qua sàn kính trong suốt Skywalk, thưởng thức cà phê ngắm hoàng hôn.',
          vibe: 'Đẳng cấp quốc tế, sang trọng, tầm nhìn ngoạn mục.',
          price: '180.000đ - 230.000đ'
        }
      ],
      trafficTip: 'Khu Ngũ Xã có nhiều ngõ nhỏ, ô tô nên gửi ở bãi đỗ xe đường Trấn Vũ ven hồ Trúc Bạch để tản bộ vào ăn uống thoải mái.'
    },

    // 6. Khu vực Hà Đông & Thanh Xuân
    hadong: {
      aliases: ['hà đông', 'ha dong', 'thanh xuân', 'thanh xuan', 'aeon hà đông', 'văn quán', 'van quan', 'nguyễn trãi', 'nguyen trai', 'quang trung'],
      title: 'Khu vực Hà Đông & Thanh Xuân (Hà Nội)',
      highlight: 'Đại siêu thị Aeon Mall giải trí khổng lồ, hồ Văn Quán lộng gió và làng nghề truyền thống.',
      spots: [
        {
          name: 'Đại Siêu Thị & TTTM Aeon Mall Hà Đông',
          address: 'Khu dân cư Hoàng Văn Thụ, P. Dương Nội',
          feature: 'Hàng trăm thương hiệu ẩm thực Á - Âu, sushi tươi ngon giá mềm, cụm rạp chiếu phim CGV hiện đại và sân bowling.',
          vibe: 'Máy lạnh mát rượi, diện tích mua sắm khổng lồ, bãi đỗ xe thênh thang.',
          price: 'Miễn phí gửi xe, ăn uống tự chọn'
        },
        {
          name: 'Cà Phê & Ẩm Thực Ven Hồ Văn Quán',
          address: 'Khu đô thị Văn Quán, Q. Hà Đông',
          feature: 'Lẩu nướng ngắm hồ, chuỗi cà phê Highlands, The Coffee House và các quán acoustic lãng mạn ven mặt nước.',
          vibe: 'Gió hồ mát rượi, cây xanh rợp bóng, không khí trong lành.',
          price: '35.000đ - 180.000đ'
        },
        {
          name: 'Làng Lụa Vạn Phúc Truyền Thống',
          address: 'Phố Lụa, P. Vạn Phúc, Q. Hà Đông',
          feature: 'Con đường ô dù rực rỡ sắc màu, tham quan quy trình dệt lụa tơ tằm cổ truyền và thưởng thức bánh cuốn nóng Vạn Phúc.',
          vibe: 'Đậm nét văn hóa truyền thống, nhiều góc chụp ảnh đẹp.',
          price: 'Tham quan tự do'
        }
      ],
      trafficTip: 'Trục đường Nguyễn Trãi - Trần Phú lưu lượng đông đúc giờ cao điểm sáng và chiều. Bạn có thể lựa chọn trải nghiệm tàu điện trên cao Tuyến Cát Linh - Hà Đông vừa nhanh vừa ngắm phố từ trên cao.'
    },

    // 7. TP. Hồ Chí Minh
    hcm: {
      aliases: ['hcm', 'sài gòn', 'sai gon', 'quận 1', 'quan 1', 'quận 3', 'quan 3', 'thủ đức', 'thu duc', 'bình thạnh', 'binh thanh', 'chợ bến thành', 'nguyễn huệ'],
      title: 'TP. Hồ Chí Minh (Sài Gòn)',
      highlight: 'Thủ phủ ẩm thực phương Nam rực rỡ, năng động với các món ngon huyền thoại.',
      spots: [
        {
          name: 'Cơm Tấm Ba Ghiền & Bánh Mì Huỳnh Hoa',
          address: '84 Đặng Văn Ngữ, Phú Nhuận / 26 Lê Thị Riêng, Q.1',
          feature: 'Sườn nướng tảng to che kín đĩa cơm tấm bùi béo; ổ bánh mì pate chả lụa đầy ắp nhân trứ danh Sài thành.',
          vibe: 'Đặc sản ẩm thực đường phố nổi tiếng quốc tế.',
          price: '65.000đ - 110.000đ'
        },
        {
          name: 'Phố Đi Bộ Nguyễn Huệ & Cà Phê Chung Cư 42 Nguyễn Huệ',
          address: 'Đường Nguyễn Huệ, Bến Nghé, Quận 1',
          feature: 'Trải nghiệm cà phê boutique độc đáo trong chung cư cổ, dạo bộ ngắm đài phun nước và Nhà hát Thành phố.',
          vibe: 'Trung tâm phồn hoa, nhộn nhịp bậc nhất Sài Gòn về đêm.',
          price: '40.000đ - 90.000đ'
        },
        {
          name: 'Tòa Tháp Landmark 81 & Công Viên Bờ Sông Vinhomes',
          address: '720A Điện Biên Phủ, P.22, Bình Thạnh',
          feature: 'Đài quan sát SkyView cao nhất Đông Nam Á, công viên ven sông Sài Gòn rợp bóng cây xanh và đài phun nước nghệ thuật.',
          vibe: 'Sang trọng, hiện đại, không gian mở ven sông cực thoáng mát.',
          price: 'Vé lên đài ~300.000đ, công viên tự do'
        }
      ],
      trafficTip: 'Các nút giao trung tâm Quận 1 thường đông đúc vào khung giờ 17h30 - 19h00. Nếu đi ô tô, nên gửi tại hầm Vincom Center Đồng Khởi hoặc hầm Bitexco.'
    },

    // 8. Thành phố Đà Nẵng
    danang: {
      aliases: ['đà nẵng', 'da nang', 'hải châu', 'hai chau', 'sơn trà', 'son tra', 'mỹ khê', 'my khe', 'cầu rồng', 'cau rong', 'bán đảo sơn trà'],
      title: 'Thành phố Đà Nẵng',
      highlight: 'Thành phố đáng sống với hải sản tươi ngon, bãi biển quyến rũ và những cây cầu huyền thoại.',
      spots: [
        {
          name: 'Mì Quảng Bà Mua & Bánh Tráng Cuốn Thịt Heo Quán Trần',
          address: '19 Trần Bình Trọng / 04 Lê Duẩn, Q. Hải Châu',
          feature: 'Mì Quảng tôm thịt đậm vị miền Trung ăn kèm bánh tráng mè nướng; thịt heo hai đầu da cuốn mắm nêm thơm nức.',
          vibe: 'Món ăn biểu tượng ẩm thực xứ Quảng.',
          price: '45.000đ - 90.000đ'
        },
        {
          name: 'Hải Sản Năm Đảnh & Quán Bé Mặn',
          address: 'K27/K54 Trần Quang Khải / Lô 11 Võ Nguyên Giáp',
          feature: 'Tôm hùm, ghẹ hấp, sò điệp nướng mỡ hành, ốc hương sốt trứng muối tươi rói vừa cập bến.',
          vibe: 'Tươi ngon, nhộn nhịp, giá cả niêm yết rõ ràng.',
          price: '150.000đ - 300.000đ/người'
        },
        {
          name: 'Cầu Rồng Phun Lửa & Cầu Tình Yêu Bến Du Thuyền',
          address: 'Đường Trần Hưng Đạo, P. An Hải Trung, Q. Sơn Trà',
          feature: 'Màn trình diễn Cầu Rồng phun lửa và phun nước độc đáo lúc 21h00 thứ Bảy và Chủ nhật; dạo phố ngắm sông Hàn lộng gió.',
          vibe: 'Tuyệt đẹp về đêm, nhiều góc chụp ảnh lãng mạn.',
          price: 'Xem miễn phí'
        }
      ],
      trafficTip: 'Cầu Rồng cấm phương tiện qua lại trong khoảng thời gian 20h45 - 21h30 vào tối cuối tuần khi phun lửa. Bạn nên đến sớm từ 20h30 gửi xe ven đường Trần Hưng Đạo để chọn góc ngắm đẹp.'
    }
  };

  function findAreaGuide(query, currentCity = 'hanoi') {
    const q = (query || '').toLowerCase().trim();

    // Duyệt qua các khu vực
    for (const [key, area] of Object.entries(AREAS_GUIDE)) {
      if (area.aliases.some(alias => q.includes(alias))) {
        return area;
      }
    }

    // Nếu không khớp từ khóa cụ thể nhưng đang ở thành phố cụ thể
    if (currentCity === 'hcm') return AREAS_GUIDE.hcm;
    if (currentCity === 'danang') return AREAS_GUIDE.danang;
    
    // Mặc định trả về gợi ý ẩm thực nổi tiếng Hà Nội
    return AREAS_GUIDE.caugiay;
  }

  function formatGuideMessage(area) {
    let msg = `**Gợi Ý Địa Điểm Ăn Uống & Vui Chơi Nổi Tiếng: ${area.title}**\n\n`;
    msg += `*${area.highlight}*\n\n`;

    area.spots.forEach((spot, idx) => {
      msg += `**${idx + 1}. ${spot.name}**\n`;
      msg += `• **Địa chỉ**: ${spot.address}\n`;
      msg += `• **Đặc sản / Nổi bật**: ${spot.feature}\n`;
      msg += `• **Không gian & Giá**: ${spot.vibe} (${spot.price})\n\n`;
    });

    if (area.trafficTip) {
      msg += `**Mẹo giao thông & đỗ xe thực tế**:\n${area.trafficTip}\n\n`;
    }
    msg += `*Bạn có thể bấm nút **Chỉ đường** trên thanh tìm kiếm để MoveSafe tự động dẫn đường an toàn và né các đoạn ùn tắc đến địa điểm này!*`;

    return msg;
  }

  return {
    isFoodOrFun: function (query) {
      if (!query) return false;
      return FOOD_KEYWORDS_REGEX.test(query);
    },
    getRecommendation: function (query, currentCity = 'hanoi') {
      const area = findAreaGuide(query, currentCity);
      return {
        text: formatGuideMessage(area),
        title: area.title,
        action: null
      };
    },
    AREAS_GUIDE
  };
});
