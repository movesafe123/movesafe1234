/**
 * MoveSafe VN - Cơ sở dữ liệu ẩm thực, ăn uống & điểm vui chơi giải trí đô thị
 * Hỗ trợ Trợ lý AI MoveSafe đề xuất địa điểm thực tế, chuẩn vị, chất lượng cao kèm tọa độ ghim bản đồ
 * Chuẩn UMD: Hoạt động đồng bộ trên cả Trình duyệt (Client) và Node.js (Server)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FOOD_ENTERTAINMENT_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const FOOD_KEYWORDS_REGEX = /(?:quán ăn|ăn gì|ăn uống|quán ngon|món ngon|đặc sản|nhà hàng|buffet|lẩu|nướng|quán nhậu|phở|bún|cơm|bánh mì|cafe|cà phê|trà sữa|trà chanh|vui chơi|chỗ chơi|đi chơi|chơi đâu|giải trí|check-in|checkin|dạo phố|rạp phim|rạp chiếu phim|chiếu phim|xem phim|phim|cinema|cgv|beta|lotte cinema|bhd|galaxy|trung tâm thương mại|tttm|mua sắm|công viên|quán nào|nơi nào|chỗ nào|uống gì|ăn sáng|ăn trưa|ăn tối|đồ uống|chỗ tụ tập|ăn vặt|karaoke|bida|billiards|bowling|bar|pub|quanh đây|gần đây|ở đây|gần đó|gần tôi|xung quanh|khu này)/i;

  const AREAS_GUIDE = {
    // 1. Khu vực Mỹ Đình & Nam Từ Liêm
    mydinh: {
      aliases: ['mỹ đình', 'my dinh', 'đình thôn', 'dinh thon', 'lê đức thọ', 'le duc tho', 'nguyễn hoàng', 'nguyen hoang', 'the manor', 'mễ trì', 'me tri', 'nam từ liêm', 'nam tu liem', 'svđ mỹ đình', 'bến xe mỹ đình', 'ben xe my dinh', 'keangnam', 'hàm nghi', 'ham nghi'],
      title: 'Khu vực Mỹ Đình & Nam Từ Liêm (Hà Nội)',
      lat: 21.0205,
      lng: 105.7765,
      highlight: 'Thiên đường ẩm thực nướng Hàn Quốc, cụm rạp chiếu phim hiện đại và quảng trường dạo mát rộng nhất Thủ đô.',
      spots: [
        {
          name: 'TTTM The Garden Shopping Center & Rạp Phim CGV',
          address: 'Khu đô thị The Manor, đường Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0141,
          lng: 105.7764,
          feature: 'Cụm rạp chiếu phim CGV cao cấp âm thanh vòm sống động, tổ hợp mua sắm, ẩm thực quốc tế tầng hầm B1 và cafe kiến trúc Paris.',
          vibe: 'Hiện đại, mát mẻ, xem phim và giải trí trọn gói cả ngày.',
          price: 'Vé phim ~100.000đ - 140.000đ'
        },
        {
          name: 'Beta Cinemas Mỹ Đình (Golden Palace Mễ Trì)',
          address: 'Tầng hầm B1, Tòa Golden Palace, đường Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0152,
          lng: 105.7770,
          feature: 'Cụm rạp chiếu phim chuẩn Hollywood giá vé cực tốt, màn chiếu rộng sắc nét, bắp rang bơ phô mai caramel giòn thơm.',
          vibe: 'Trẻ trung, năng động, quầy chờ check-in đẹp mắt.',
          price: '50.000đ - 90.000đ/vé'
        },
        {
          name: 'Lotte Cinema Keangnam Landmark 72',
          address: 'Tầng 5, Keangnam Landmark 72, đường Phạm Hùng, Q. Nam Từ Liêm',
          lat: 21.0175,
          lng: 105.7838,
          feature: 'Rạp chiếu phim màn hình lớn, ghế đệm da êm ái ngả lưng thoải mái, không gian yên tĩnh và bãi đỗ xe ô tô cực rộng.',
          vibe: 'Sang trọng, thư giãn, có phòng chiếu cao cấp.',
          price: '85.000đ - 160.000đ/vé'
        },
        {
          name: 'Phố Ẩm Thực Hàn Quốc K-Town (Đình Thôn - The Manor)',
          address: 'Đường Đình Thôn & Khu The Manor Mễ Trì',
          lat: 21.0145,
          lng: 105.7782,
          feature: 'Thịt bò nướng tảng tươi ngon, canh kim chi, gà rán sốt cay chuẩn vị Seoul (Meat Plus No.1 BBQ, Baek Jeong, K-Pub).',
          vibe: 'Không gian sang trọng, chuẩn phong cách Hàn Quốc.',
          price: '200.000đ - 450.000đ/người'
        },
        {
          name: 'Bún Chả Sinh Từ Mỹ Đình',
          address: 'Đường Nguyễn Hoàng (cạnh ngã ba Lê Đức Thọ)',
          lat: 21.0308,
          lng: 105.7735,
          feature: 'Chả miếng nướng than hoa thơm lừng, chả băm mềm ngọt béo bùi, nước chấm đậm đà ăn kèm nem hải sản giòn rụm.',
          vibe: 'Không gian sạch sẽ, máy lạnh mát rượi, phục vụ nhanh.',
          price: '50.000đ - 75.000đ/suất'
        },
        {
          name: 'Quảng Trường Sân Vận Động Quốc Gia Mỹ Đình',
          address: 'Đường Lê Đức Thọ, P. Mỹ Đình 1',
          lat: 21.0204,
          lng: 105.7639,
          feature: 'Không gian gió mát lộng buổi chiều tối, thả diều, trượt patin, thưởng thức trà chanh giã tay, xúc xích nướng đá ven đường.',
          vibe: 'Cực kỳ thoáng đãng, điểm tụ tập hóng mát số 1 khu Tây Hà Nội.',
          price: '15.000đ - 40.000đ'
        }
      ],
      trafficTip: 'Xe máy có thể đỗ miễn phí trước cửa hầu hết các quán trên đường Lê Đức Thọ và Nguyễn Hoàng. Nếu đi ô tô hoặc xem phim, bạn gửi xe an toàn tại hầm TTTM The Garden, hầm Golden Palace hoặc Keangnam Landmark 72.'
    },

    // 2. Khu vực Cầu Giấy
    caugiay: {
      aliases: ['cầu giấy', 'cau giay', 'tô hiệu', 'to hieu', 'nghĩa tân', 'nghia tan', 'chùa láng', 'chua lang', 'dịch vọng', 'dich vong', 'xuân thủy', 'xuan thuy', 'trần thái tông', 'tran thai tong', 'duy tân', 'duy tan', 'trung hòa', 'trung hoa', 'hoàng quốc việt'],
      title: 'Khu vực Quận Cầu Giấy (Hà Nội)',
      lat: 21.0335,
      lng: 105.7925,
      highlight: 'Thủ phủ ẩm thực đường phố, phố ăn vặt Tô Hiệu - Nghĩa Tân và các tổ hợp cà phê trẻ trung.',
      spots: [
        {
          name: 'Phố Ẩm Thực Tô Hiệu & Chợ Nghĩa Tân',
          address: 'Khu tập thể Nghĩa Tân & Phố Tô Hiệu',
          lat: 21.0432,
          lng: 105.7928,
          feature: 'Bánh mì chảo Cột Điện Quán, Bún chả Tô Hiệu, Tào phớ caramen Nghĩa Tân, Chè bưởi thơm nức tiếng sinh viên.',
          vibe: 'Nhộn nhịp, bình dân, hương vị đậm đà khó quên.',
          price: '20.000đ - 55.000đ'
        },
        {
          name: 'Bò Tơ Quán Mộc',
          address: 'Đường Nguyễn Thị Định & Đường Trần Thái Tông',
          lat: 21.0108,
          lng: 105.8035,
          feature: 'Bò tơ cuốn bánh tráng rau rừng, bò cháy tỏi, lẩu riêu cua bắp bò tơ ngọt lịm.',
          vibe: 'Không gian phong cách phố cổ Hà Nội thập niên 80, ấm cúng.',
          price: '180.000đ - 280.000đ/người'
        },
        {
          name: 'All Day Coffee & Trà Chiều',
          address: 'Đường Trần Thái Tông & Phố Dịch Vọng Hậu',
          lat: 21.0322,
          lng: 105.7885,
          feature: 'Cà phê rang mộc thơm lừng, trà trái cây nhiệt đới, bánh croissant trứng muối nóng giòn.',
          vibe: 'Không gian sang trọng, góc check-in sống ảo phong cách châu Âu.',
          price: '55.000đ - 85.000đ'
        },
        {
          name: 'Công Viên Cầu Giấy',
          address: 'Đường Thành Thái, P. Dịch Vọng',
          lat: 21.0282,
          lng: 105.7912,
          feature: 'Đồi cỏ nhân tạo rộng lớn cho trẻ em chạy nhảy, hồ nước điều hòa thoáng mát, đường dạo bộ xanh mướt.',
          vibe: 'Thiên nhiên trong lành, thư giãn tuyệt vời sau giờ làm việc.',
          price: 'Vào cổng miễn phí'
        }
      ],
      trafficTip: 'Phố Tô Hiệu và Chùa Láng mật độ xe máy rất đông vào khung giờ 11h30 - 13h00 và 18h00 - 19h30. Nếu đi ô tô, nên chọn các quán có bảo vệ dắt xe hoặc gửi ở bãi đỗ Công viên Cầu Giấy.'
    },

    // 3. Khu vực Hoàn Kiếm & Phố Cổ
    hoankiem: {
      aliases: ['hoàn kiếm', 'hoan kiem', 'phố cổ', 'pho co', 'hồ gươm', 'ho guom', 'bát đàn', 'bat dan', 'tạ hiện', 'ta hien', 'tràng tiền', 'trang tien', 'hàng bài', 'đinh tiên hoàng', 'hàng buồm', 'nhà thờ lớn'],
      title: 'Khu vực Hoàn Kiếm & 36 Phố Phường (Hà Nội)',
      lat: 21.0285,
      lng: 105.8525,
      highlight: 'Cái nôi tinh hoa ẩm thực Kinh Kỳ với các món truyền thống lâu đời và phố đi bộ sôi động.',
      spots: [
        {
          name: 'Phở Gia Truyền Bát Đàn & Phở Thìn Bờ Hồ',
          address: '49 Bát Đàn / 61 Đinh Tiên Hoàng',
          lat: 21.0332,
          lng: 105.8462,
          feature: 'Nước dùng ninh xương bò trong veo ngọt thanh, thịt bò tái lăn mềm thơm, quẩy giòn tan.',
          vibe: 'Mộc mạc, đậm chất Hà Nội xưa, luôn tấp nập khách sành ăn.',
          price: '55.000đ - 80.000đ/bát'
        },
        {
          name: 'Bún Chả Hàng Quạt & Bún Đậu Ngõ Tràng Tiền',
          address: 'Ngõ 74 Hàng Quạt / Ngõ Tràng Tiền',
          lat: 21.0315,
          lng: 105.8492,
          feature: 'Chả quạt nướng cháy xém cạnh đượm mùi khói than hoa, nem cua bể giòn rụm.',
          vibe: 'Ẩm thực ngõ nhỏ phố nhỏ đặc trưng Hà Nội.',
          price: '40.000đ - 65.000đ'
        },
        {
          name: 'Cafe Giảng Trứng & Kem Tràng Tiền',
          address: '39 Nguyễn Hữu Huân / 35 Tràng Tiền',
          lat: 21.0338,
          lng: 105.8548,
          feature: 'Cà phê trứng béo ngậy thơm lừng bí truyền từ năm 1946; kem cốm, kem ốc quế Tràng Tiền.',
          vibe: 'Biểu tượng văn hóa ẩm thực Thủ đô.',
          price: '15.000đ - 45.000đ'
        },
        {
          name: 'Không Gian Đi Bộ Hồ Hoàn Kiếm & Phố Bia Tạ Hiện',
          address: 'Xung quanh Hồ Gươm & Ngã tư Tạ Hiện - Lương Ngọc Quyến',
          lat: 21.0348,
          lng: 105.8521,
          feature: 'Biểu diễn nghệ thuật đường phố, nhạc acoustic, ngắm Tháp Rùa lung linh và giao lưu bạn bè quốc tế.',
          vibe: 'Sôi động, nhộn nhịp, rực rỡ sắc màu về đêm.',
          price: 'Tự do tham quan'
        }
      ],
      trafficTip: 'Từ 19h00 thứ Sáu đến hết Chủ nhật, toàn bộ tuyến đường quanh Hồ Gươm chuyển thành Phố đi bộ. Xe máy nên gửi tại các điểm trông giữ phố Hai Bà Trưng, Hàng Bài; ô tô gửi ở tầng hầm Tràng Tiền Plaza hoặc Cung Thiếu nhi.'
    },

    // 4. Khu vực Đống Đa
    dongda: {
      aliases: ['đống đa', 'dong da', 'thái hà', 'thai ha', 'chùa bộc', 'chua boc', 'xã đàn', 'xa dan', 'phạm ngọc thạch', 'pham ngoc thach', 'hoàng cầu', 'hoang cau', 'láng hạ', 'lang ha', 'tôn đức thắng', 'văn miếu', 'van mieu'],
      title: 'Khu vực Quận Đống Đa (Hà Nội)',
      lat: 21.0135,
      lng: 105.8265,
      highlight: 'Thiên đường ăn vặt Chùa Bộc - Phạm Ngọc Thạch, lẩu nướng Xã Đàn và cà phê ven hồ Hoàng Cầu.',
      spots: [
        {
          name: 'Tổ Hợp Ăn Vặt Khu Tập Thể Trung Tự & Phạm Ngọc Thạch',
          address: 'Ngõ 46B Phạm Ngọc Thạch, Q. Đống Đa',
          lat: 21.0088,
          lng: 105.8332,
          feature: 'Chân gà sả ớt, ốc luộc lá chanh, nem chua rán, tào phớ thạch găng và chè sầu riêng nổi tiếng.',
          vibe: 'Sầm uất, trẻ trung, giá cả cực kỳ hợp túi tiền học sinh sinh viên.',
          price: '25.000đ - 60.000đ'
        },
        {
          name: 'Phố Lẩu Nướng Xã Đàn & Hầm De Paris',
          address: 'Đường Xã Đàn & Ô Chợ Dừa',
          lat: 21.0142,
          lng: 105.8315,
          feature: 'Lẩu bò nhúng dấm, buffet nướng lẩu Hàn - Nhật, sườn nướng tảng sốt BBQ đậm đà.',
          vibe: 'Mặt phố lớn sôi động, không gian rộng rãi hợp liên hoan nhóm.',
          price: '160.000đ - 300.000đ/người'
        },
        {
          name: 'Hồ Hoàng Cầu & Chuỗi Cafe Ngắm Tàu Điện Trên Cao',
          address: 'Đường Mai Anh Tuấn - Ven Hồ Hoàng Cầu',
          lat: 21.0182,
          lng: 105.8215,
          feature: 'Thưởng thức cà phê bên mặt hồ mát rượi, ngắm đoàn tàu Cát Linh - Hà Đông lướt qua rặng cây xanh.',
          vibe: 'View độc đáo, thoáng đãng, cực đẹp vào buổi chiều hoàng hôn.',
          price: '40.000đ - 70.000đ'
        },
        {
          name: 'Văn Miếu - Quốc Tử Giám (Tour Đêm Tinh Hoa Đạo Học)',
          address: '58 Quốc Tử Giám, Q. Đống Đa',
          lat: 21.0276,
          lng: 105.8355,
          feature: 'Trải nghiệm trình chiếu 3D Mapping lung linh về đêm tại trường đại học đầu tiên của Việt Nam.',
          vibe: 'Cổ kính, trang nghiêm và giàu giá trị văn hóa lịch sử.',
          price: '70.000đ - 190.000đ'
        }
      ],
      trafficTip: 'Ngã tư Thái Hà - Chùa Bộc và Ô Chợ Dừa lưu lượng rất đông giờ tan tầm. Nếu đi ô tô, bạn có thể gửi xe tại bãi đỗ Hồ Hoàng Cầu hoặc hầm Vincom Phạm Ngọc Thạch.'
    },

    // 5. Khu vực Tây Hồ
    tayho: {
      aliases: ['tây hồ', 'tay ho', 'hồ tây', 'ho tay', 'quảng bá', 'quang ba', 'xuân diệu', 'xuan dieu', 'từ hoa', 'tu hoa', 'nhật tân', 'nhat tan', 'thanh niên', 'thanh nien', 'trúc bạch', 'truc bach', 'lạc long quân'],
      title: 'Khu vực Hồ Tây & Tây Hồ (Hà Nội)',
      lat: 21.0585,
      lng: 105.8235,
      highlight: 'Không gian lộng gió, ẩm thực ven hồ lãng mạn và các quán cafe ngắm hoàng hôn đẹp nhất Việt Nam.',
      spots: [
        {
          name: 'Bánh Tôm Hồ Tây & Ốc Nóng Quảng Bá',
          address: 'Đường Thanh Niên & Phố Quảng Bá',
          lat: 21.0482,
          lng: 105.8365,
          feature: 'Bánh tôm chiên giòn rụm với tôm tươi búng tanh tách, ốc luộc mắm gừng sả ớt cay nồng.',
          vibe: 'View ngắm sóng nước Hồ Tây mênh mông, đón gió mát trong lành.',
          price: '50.000đ - 120.000đ'
        },
        {
          name: 'Chuỗi Cafe Ngắm Hoàng Hôn Phố Từ Hoa & Quảng Khánh',
          address: 'Đường Từ Hoa, Vệ Hồ, Quảng Khánh',
          lat: 21.0598,
          lng: 105.8285,
          feature: 'Santorino Coffee, Chốn Riêng Coffee, cà phê view thẳng mặt hồ đón ánh hoàng hôn đỏ rực tuyệt mỹ.',
          vibe: 'Lãng mạn, yên tĩnh, cực kỳ thích hợp hẹn hò hoặc thư giãn cuối tuần.',
          price: '45.000đ - 80.000đ'
        },
        {
          name: 'Thung Lũng Hoa Hồ Tây & Công Viên Nước Hồ Tây',
          address: 'Ngõ 612 Lạc Long Quân, P. Nhật Tân',
          lat: 21.0745,
          lng: 105.8172,
          feature: 'Vườn hoa bốn mùa khoe sắc, công viên trượt nước sảng khoái và dịch vụ cắm trại glamping bên hồ.',
          vibe: 'Rực rỡ sắc màu, góc chụp ảnh kỷ niệm tuyệt đẹp.',
          price: '80.000đ - 150.000đ/vé'
        }
      ],
      trafficTip: 'Đường ven hồ Từ Hoa và Quảng Khánh khá hẹp, nên ưu tiên di chuyển bằng xe máy. Nếu đi ô tô, bạn nên gửi xe tại bãi xe ngã ba Xuân Diệu - Đặng Thai Mai rồi tản bộ dạo hồ.'
    },

    // 6. Khu vực Ba Đình
    badinh: {
      aliases: ['ba đình', 'ba dinh', 'ngũ xã', 'ngu xa', 'đội cấn', 'doi can', 'liễu giai', 'lieu giai', 'kim mã', 'kim ma', 'giảng võ', 'giang vo', 'lăng bác', 'lang bac', 'phan đình phùng'],
      title: 'Khu vực Quận Ba Đình (Hà Nội)',
      lat: 21.0342,
      lng: 105.8262,
      highlight: 'Phố ẩm thực phở cuốn Ngũ Xã ven hồ Trúc Bạch và các di tích lịch sử trung tâm.',
      spots: [
        {
          name: 'Phở Cuốn Hương Mai & Hưng Bền Ngũ Xã',
          address: 'Phố Ngũ Xã (bán đảo Trúc Bạch)',
          lat: 21.0458,
          lng: 105.8405,
          feature: 'Phở cuốn thịt bò tươi ngọt kèm rau thơm mộc mạc, phở chiên phồng xào bò giòn béo, chả ngan nướng.',
          vibe: 'Khu ẩm thực đêm ven hồ Trúc Bạch nhộn nhịp, thoáng đãng.',
          price: '65.000đ - 120.000đ/đĩa'
        },
        {
          name: 'Nem Lụi Bánh Xèo Phố Đội Cấn & Bún Ốc Cô Huệ',
          address: 'Đường Đội Cấn & Phố Đặng Dung',
          lat: 21.0355,
          lng: 105.8235,
          feature: 'Bánh xèo giòn rụm vàng ươm cuốn nem lụi nướng chấm nước lèo béo thơm, bún ốc nguội giấm bỗng gia truyền.',
          vibe: 'Quán ăn bình dân, hương vị đậm đà lâu năm.',
          price: '35.000đ - 70.000đ'
        },
        {
          name: 'Lotte Observation Deck (Đài Quan Sát Tầng 65)',
          address: '54 Liễu Giai, P. Cống Vị',
          lat: 21.0321,
          lng: 105.8126,
          feature: 'Ngắm toàn cảnh Hà Nội từ độ cao gần 300m qua sàn kính trong suốt Skywalk, thưởng thức cà phê ngắm hoàng hôn.',
          vibe: 'Đẳng cấp quốc tế, sang trọng, tầm nhìn ngoạn mục.',
          price: '180.000đ - 230.000đ'
        }
      ],
      trafficTip: 'Khu Ngũ Xã có nhiều ngõ nhỏ, ô tô nên gửi ở bãi đỗ xe đường Trấn Vũ ven hồ Trúc Bạch để tản bộ vào ăn uống thoải mái.'
    },

    // 7. Khu vực Hai Bà Trưng
    haibatrung: {
      aliases: ['hai bà trưng', 'hai ba trung', 'bà triệu', 'ba trieu', 'bách khoa', 'bach khoa', 'tạ quang bửu', 'ta quang buu', 'times city', 'minh khai', 'bùi thị xuân', 'đại cồ việt'],
      title: 'Khu vực Quận Hai Bà Trưng (Hà Nội)',
      lat: 21.0065,
      lng: 105.8515,
      highlight: 'Thiên đường ẩm thực Bách - Kinh - Xây, Vincom Bà Triệu và đại đô thị Times City.',
      spots: [
        {
          name: 'Khu Ẩm Thực Sinh Viên Bách Khoa (Tạ Quang Bửu - Ngõ Tự Do)',
          address: 'Phố Tạ Quang Bửu & Lê Thanh Nghị',
          lat: 21.0028,
          lng: 105.8465,
          feature: 'Bánh đa trộn, cháo sườn sụn, chè khúc bạch, lẩu nướng chảo gang thơm nức mũi với giá siêu hạt dẻ.',
          vibe: 'Đông vui, nhộn nhịp, chuẩn thiên đường ăn vặt.',
          price: '20.000đ - 55.000đ'
        },
        {
          name: 'Vincom Center Bà Triệu & Phố Ẩm Thực Bùi Thị Xuân',
          address: '191 Bà Triệu, Q. Hai Bà Trưng',
          lat: 21.0115,
          lng: 105.8495,
          feature: 'Tổ hợp rạp phim CGV, nhà hàng Pizza 4P’s, Haidilao Hotpot, cùng hàng loạt quán bún ngan, miến lươn phố Bùi Thị Xuân.',
          vibe: 'Trung tâm sầm uất, hiện đại, kết hợp ăn uống và xem phim.',
          price: '60.000đ - 350.000đ'
        },
        {
          name: 'Thủy Cung Vinpearl Aquarium & Nhạc Nước Times City',
          address: '458 Minh Khai, Q. Hai Bà Trưng',
          lat: 20.9952,
          lng: 105.8675,
          feature: 'Đường hầm thủy cung dưới lòng đất với hơn 30.000 sinh vật biển và quảng trường nhạc nước lung linh.',
          vibe: 'Điểm vui chơi cuối tuần tuyệt vời cho gia đình và các cặp đôi.',
          price: 'Vé thủy cung 170.000đ - 250.000đ'
        }
      ],
      trafficTip: 'Đoạn Minh Khai có cầu vượt trên cao Vành Đai 2 rất thông thoáng cho ô tô, nhưng dưới gầm cầu giờ cao điểm khá đông xe máy. Có hầm gửi xe khổng lồ tại Times City và Vincom Bà Triệu.'
    },

    // 8. Khu vực Hà Đông & Thanh Xuân
    hadong: {
      aliases: ['hà đông', 'ha dong', 'thanh xuân', 'thanh xuan', 'aeon hà đông', 'văn quán', 'van quan', 'nguyễn trãi', 'nguyen trai', 'quang trung', 'royal city', 'thượng đình'],
      title: 'Khu vực Hà Đông & Thanh Xuân (Hà Nội)',
      lat: 20.9785,
      lng: 105.7865,
      highlight: 'Đại siêu thị Aeon Mall giải trí khổng lồ, Royal City, hồ Văn Quán lộng gió và làng nghề truyền thống.',
      spots: [
        {
          name: 'Đại Siêu Thị & TTTM Aeon Mall Hà Đông',
          address: 'Khu dân cư Hoàng Văn Thụ, P. Dương Nội',
          lat: 20.9896,
          lng: 105.7515,
          feature: 'Hàng trăm thương hiệu ẩm thực Á - Âu, sushi tươi ngon giá mềm, cụm rạp chiếu phim CGV hiện đại và sân bowling.',
          vibe: 'Máy lạnh mát rượi, diện tích mua sắm khổng lồ, bãi đỗ xe thênh thang.',
          price: 'Miễn phí gửi xe, ăn uống tự chọn'
        },
        {
          name: 'Cà Phê & Ẩm Thực Ven Hồ Văn Quán',
          address: 'Khu đô thị Văn Quán, Q. Hà Đông',
          lat: 20.9765,
          lng: 105.7892,
          feature: 'Lẩu nướng ngắm hồ, chuỗi cà phê Highlands, The Coffee House và các quán acoustic lãng mạn ven mặt nước.',
          vibe: 'Gió hồ mát rượi, cây xanh rợp bóng, không khí trong lành.',
          price: '35.000đ - 180.000đ'
        },
        {
          name: 'Làng Lụa Vạn Phúc Truyền Thống',
          address: 'Phố Lụa, P. Vạn Phúc, Q. Hà Đông',
          lat: 20.9805,
          lng: 105.7725,
          feature: 'Con đường ô dù rực rỡ sắc màu, tham quan quy trình dệt lụa tơ tằm cổ truyền và thưởng thức bánh cuốn nóng Vạn Phúc.',
          vibe: 'Đậm nét văn hóa truyền thống, nhiều góc chụp ảnh đẹp.',
          price: 'Tham quan tự do'
        }
      ],
      trafficTip: 'Trục đường Nguyễn Trãi - Trần Phú lưu lượng đông đúc giờ cao điểm sáng và chiều. Bạn có thể lựa chọn trải nghiệm tàu điện trên cao Tuyến Cát Linh - Hà Đông vừa nhanh vừa ngắm phố từ trên cao.'
    },

    // 9. Khu vực Bắc Từ Liêm
    bactuliem: {
      aliases: ['bắc từ liêm', 'bac tu liem', 'nhổn', 'nhon', 'cổ nhuế', 'co nhue', 'phú diễn', 'phu dien', 'phạm văn đồng', 'pham van dong', 'xuân đỉnh', 'xuan dinh', 'tây tựu', 'tay tuu', 'thành phố giao lưu'],
      title: 'Khu vực Quận Bắc Từ Liêm (Hà Nội)',
      lat: 21.0535,
      lng: 105.7745,
      highlight: 'Hồ điều hòa Thành phố Giao Lưu mát rượi, phố ẩm thực sinh viên Cổ Nhuế - Nhổn và Công viên Hòa Bình.',
      spots: [
        {
          name: 'Tổ Hợp Ẩm Thực & Cafe Hồ Thành Phố Giao Lưu',
          address: '232 Phạm Văn Đồng, P. Cổ Nhuế 1',
          lat: 21.0492,
          lng: 105.7812,
          feature: 'Nhà hàng hải sản, lẩu nấm, chuỗi cà phê ven hồ rộng hơn 15ha và siêu thị MM Mega Market Thăng Long.',
          vibe: 'Không gian sinh thái rộng mở, bãi đỗ ô tô cực kỳ thoải mái.',
          price: '40.000đ - 250.000đ'
        },
        {
          name: 'Phố Ẩm Thực Sinh Viên Chợ Nhổn & Cổ Nhuế',
          address: 'Đường Cầu Diễn (Ga Metro Nhổn) & Phố Trần Cung',
          lat: 21.0528,
          lng: 105.7385,
          feature: 'Nướng ngói, lẩu ếch măng cay, bún đậu mắm tôm, bánh tráng nướng và trà chanh chém gió.',
          vibe: 'Nhộn nhịp, trẻ trung, giá bình dân.',
          price: '30.000đ - 120.000đ'
        },
        {
          name: 'Công Viên Hòa Bình',
          address: 'Đường Phạm Văn Đồng, P. Xuân Đỉnh',
          lat: 21.0645,
          lng: 105.7868,
          feature: 'Biểu tượng chim Hạc hướng thiên, quảng trường rộng mênh mông, rừng cây xanh mát cho gia đình dã ngoại cuối tuần.',
          vibe: 'Yên bình, thoáng đãng, không khí trong lành.',
          price: 'Miễn phí vé vào cổng'
        }
      ],
      trafficTip: 'Đường Phạm Văn Đồng có 12 làn xe rất rộng rãi. Nếu đi từ Nhổn vào nội thành, bạn có thể gửi xe tại Ga Metro Nhổn và đi tàu điện trên cao tuyến Nhổn - Cầu Giấy chỉ mất 12 phút.'
    },

    // 10. Khu vực Long Biên & Gia Lâm
    longbien: {
      aliases: ['long biên', 'long bien', 'gia lâm', 'gia lam', 'aeon long biên', 'ngọc lâm', 'ngoc lam', 'nguyễn văn cừ', 'nguyen van cu', 'ocean park', 'cổ linh'],
      title: 'Khu vực Long Biên & Gia Lâm (Hà Nội)',
      lat: 21.0365,
      lng: 105.8825,
      highlight: 'Phố ẩm thực Ngọc Lâm trứ danh, TTTM Aeon Mall Long Biên và khu cắm trại ven sông Hồng.',
      spots: [
        {
          name: 'Phố Ẩm Thực Ngọc Lâm & Nguyễn Văn Cừ',
          address: 'Phố Ngọc Lâm, Q. Long Biên',
          lat: 21.0442,
          lng: 105.8725,
          feature: 'Nem nướng Nha Trang, bún chả que tre, bánh cuốn gia truyền, ốc cay và chè bơ sầu riêng.',
          vibe: 'Con phố ẩm thực sầm uất bậc nhất phía Đông cầu Chương Dương.',
          price: '30.000đ - 85.000đ'
        },
        {
          name: 'TTTM Aeon Mall Long Biên',
          address: '27 đường Cổ Linh, P. Long Biên',
          lat: 21.0268,
          lng: 105.8992,
          feature: 'Làng ẩm thực Nhật Bản, khu trò chơi Dream Games, rạp phim CGV IMAX và khu mua sắm sầm uất.',
          vibe: 'Rộng lớn, tiện nghi, thích hợp đi chơi cả ngày.',
          price: 'Miễn phí gửi xe, ăn uống tự chọn'
        },
        {
          name: 'Khu Cắm Trại Glamping Chân Cầu Vĩnh Tuy (Bãi Đá Sông Hồng)',
          address: 'Bãi bồi ven sông Hồng, P. Long Biên',
          lat: 21.0155,
          lng: 105.8845,
          feature: 'Tiệc nướng BBQ ngoài trời, lều trại phong cách du mục, bắn cung và ngắm hoàng hôn buông xuống cầu Vĩnh Tuy.',
          vibe: 'Thiên nhiên hoang sơ, gió sông mát rượi.',
          price: '100.000đ - 300.000đ/người'
        }
      ],
      trafficTip: 'Cầu Chương Dương thường đông vào giờ cao điểm; bạn nên ưu tiên di chuyển qua Cầu Vĩnh Tuy (đã mở rộng giai đoạn 2 rất thông thoáng) hoặc Cầu Đông Trù.'
    },

    // 11. Khu vực Hoàng Mai
    hoangmai: {
      aliases: ['hoàng mai', 'hoang mai', 'linh đàm', 'linh dam', 'giải phóng', 'giai phong', 'định công', 'dinh cong', 'yên sở', 'yen so', 'trương định', 'kim đồng'],
      title: 'Khu vực Quận Hoàng Mai (Hà Nội)',
      lat: 20.9715,
      lng: 105.8385,
      highlight: 'Bán đảo Linh Đàm rợp bóng cây, Công viên Yên Sở xanh mát lớn nhất Hà Nội và phố ẩm thực Kim Đồng.',
      spots: [
        {
          name: 'Công Viên Yên Sở (Lá Phổi Xanh Phía Nam)',
          address: 'Nút giao Pháp Vân - Vành Đai 3, Q. Hoàng Mai',
          lat: 20.9635,
          lng: 105.8542,
          feature: 'Thảm cỏ xanh mướt trải dài quanh hồ lớn, thuê bếp nướng BBQ dã ngoại, đạp xe đôi và chèo thuyền.',
          vibe: 'Điểm cắm trại picnic ngoài trời số 1 tại Hà Nội.',
          price: 'Miễn phí vé vào cổng'
        },
        {
          name: 'Tổ Hợp Ẩm Thực & Cafe Bán Đảo Linh Đàm',
          address: 'Đường Nguyễn Duy Trinh - Bán đảo Linh Đàm',
          lat: 20.9665,
          lng: 105.8295,
          feature: 'Lẩu cá lăng sông Đà, gà nướng lu, bia hơi Hà Nội và các quán cà phê sân vườn ven hồ Linh Đàm.',
          vibe: 'Mát mẻ, nhiều cây cổ thụ, gió hồ dễ chịu.',
          price: '40.000đ - 200.000đ'
        },
        {
          name: 'Phố Ẩm Thực Kim Đồng & Giải Phóng',
          address: 'Phố Kim Đồng (gần Bến xe Giáp Bát)',
          lat: 20.9835,
          lng: 105.8445,
          feature: 'Nhà hàng hải sản, lẩu dê khô, bò tơ nướng tảng và các quán dimsum Trung Hoa.',
          vibe: 'Mặt đường rộng rãi, vỉa hè lớn đỗ xe thuận tiện.',
          price: '120.000đ - 280.000đ/người'
        }
      ],
      trafficTip: 'Nút giao Giải Phóng - Kim Đồng đang thi công hầm chui nên có rào chắn một phần lòng đường. Bạn nên đi theo trục Nguyễn Hữu Thọ hoặc đường ven hồ Linh Đàm để thông thoáng hơn.'
    },

    // 12. TP. Hồ Chí Minh
    hcm: {
      aliases: ['hcm', 'sài gòn', 'sai gon', 'quận 1', 'quan 1', 'quận 3', 'quan 3', 'thủ đức', 'thu duc', 'bình thạnh', 'binh thanh', 'chợ bến thành', 'nguyễn huệ', 'thảo điền', 'quận 7'],
      title: 'TP. Hồ Chí Minh (Sài Gòn)',
      lat: 10.7769,
      lng: 106.7008,
      highlight: 'Thủ phủ ẩm thực phương Nam rực rỡ, năng động với các món ngon huyền thoại.',
      spots: [
        {
          name: 'Cơm Tấm Ba Ghiền & Bánh Mì Huỳnh Hoa',
          address: '84 Đặng Văn Ngữ, Phú Nhuận / 26 Lê Thị Riêng, Q.1',
          lat: 10.7712,
          lng: 106.6915,
          feature: 'Sườn nướng tảng to che kín đĩa cơm tấm bùi béo; ổ bánh mì pate chả lụa đầy ắp nhân trứ danh Sài thành.',
          vibe: 'Đặc sản ẩm thực đường phố nổi tiếng quốc tế.',
          price: '65.000đ - 110.000đ'
        },
        {
          name: 'Phố Đi Bộ Nguyễn Huệ & Cà Phê Chung Cư 42 Nguyễn Huệ',
          address: 'Đường Nguyễn Huệ, Bến Nghé, Quận 1',
          lat: 10.7745,
          lng: 106.7035,
          feature: 'Trải nghiệm cà phê boutique độc đáo trong chung cư cổ, dạo bộ ngắm đài phun nước và Nhà hát Thành phố.',
          vibe: 'Trung tâm phồn hoa, nhộn nhịp bậc nhất Sài Gòn về đêm.',
          price: '40.000đ - 90.000đ'
        },
        {
          name: 'Tòa Tháp Landmark 81 & Công Viên Bờ Sông Vinhomes',
          address: '720A Điện Biên Phủ, P.22, Bình Thạnh',
          lat: 10.7952,
          lng: 106.7218,
          feature: 'Đài quan sát SkyView cao nhất Đông Nam Á, công viên ven sông Sài Gòn rợp bóng cây xanh và đài phun nước nghệ thuật.',
          vibe: 'Sang trọng, hiện đại, không gian mở ven sông cực thoáng mát.',
          price: 'Vé lên đài ~300.000đ, công viên tự do'
        }
      ],
      trafficTip: 'Các nút giao trung tâm Quận 1 thường đông đúc vào khung giờ 17h30 - 19h00. Nếu đi ô tô, nên gửi tại hầm Vincom Center Đồng Khởi hoặc hầm Bitexco.'
    },

    // 13. Thành phố Đà Nẵng
    danang: {
      aliases: ['đà nẵng', 'da nang', 'hải châu', 'hai chau', 'sơn trà', 'son tra', 'mỹ khê', 'my khe', 'cầu rồng', 'cau rong', 'bán đảo sơn trà', 'ngũ hành sơn'],
      title: 'Thành phố Đà Nẵng',
      lat: 16.0612,
      lng: 108.2275,
      highlight: 'Thành phố đáng sống với hải sản tươi ngon, bãi biển quyến rũ và những cây cầu huyền thoại.',
      spots: [
        {
          name: 'Mì Quảng Bà Mua & Bánh Tráng Cuốn Thịt Heo Quán Trần',
          address: '19 Trần Bình Trọng / 04 Lê Duẩn, Q. Hải Châu',
          lat: 16.0685,
          lng: 108.2195,
          feature: 'Mì Quảng tôm thịt đậm vị miền Trung ăn kèm bánh tráng mè nướng; thịt heo hai đầu da cuốn mắm nêm thơm nức.',
          vibe: 'Món ăn biểu tượng ẩm thực xứ Quảng.',
          price: '45.000đ - 90.000đ'
        },
        {
          name: 'Hải Sản Năm Đảnh & Quán Bé Mặn',
          address: 'K27/K54 Trần Quang Khải / Lô 11 Võ Nguyên Giáp',
          lat: 16.0715,
          lng: 108.2465,
          feature: 'Tôm hùm, ghẹ hấp, sò điệp nướng mỡ hành, ốc hương sốt trứng muối tươi rói vừa cập bến.',
          vibe: 'Tươi ngon, nhộn nhịp, giá cả niêm yết rõ ràng.',
          price: '150.000đ - 300.000đ/người'
        },
        {
          name: 'Cầu Rồng Phun Lửa & Cầu Tình Yêu Bến Du Thuyền',
          address: 'Đường Trần Hưng Đạo, P. An Hải Trung, Q. Sơn Trà',
          lat: 16.0611,
          lng: 108.2295,
          feature: 'Màn trình diễn Cầu Rồng phun lửa và phun nước độc đáo lúc 21h00 thứ Bảy và Chủ nhật; dạo phố ngắm sông Hàn lộng gió.',
          vibe: 'Tuyệt đẹp về đêm, nhiều góc chụp ảnh lãng mạn.',
          price: 'Xem miễn phí'
        }
      ],
      trafficTip: 'Cầu Rồng cấm phương tiện qua lại trong khoảng thời gian 20h45 - 21h30 vào tối cuối tuần khi phun lửa. Bạn nên đến sớm từ 20h30 gửi xe ven đường Trần Hưng Đạo để chọn góc ngắm đẹp.'
    }
  };

  function findAreaGuide(query, currentCity = 'hanoi', options = {}) {
    const q = (query || '').toLowerCase().trim();

    // 1. Khớp theo tên khu vực/quận huyện được nhắc cụ thể trong câu hỏi
    for (const [key, area] of Object.entries(AREAS_GUIDE)) {
      if (area.aliases.some(alias => q.includes(alias))) {
        return { key, area };
      }
    }

    // 2. Nếu người dùng hỏi "quanh đây", "gần đây", "ở đây" và có ngữ cảnh khu vực trước đó
    const isNearbyQuery = /(?:quanh đây|gần đây|ở đây|gần đó|gần tôi|xung quanh|khu này|tại đây)/i.test(q);
    if (options.lastAreaKey && AREAS_GUIDE[options.lastAreaKey] && (isNearbyQuery || !options.mapCenter)) {
      return { key: options.lastAreaKey, area: AREAS_GUIDE[options.lastAreaKey] };
    }

    // 3. Nếu có vị trí tâm bản đồ hiện tại của người dùng, tìm khu vực gần nhất
    if (options.mapCenter && typeof options.mapCenter.lat === 'number') {
      let closestKey = null;
      let minDistance = Infinity;
      for (const [key, area] of Object.entries(AREAS_GUIDE)) {
        if (currentCity === 'hcm' && key !== 'hcm') continue;
        if (currentCity === 'danang' && key !== 'danang') continue;
        if (currentCity === 'hanoi' && (key === 'hcm' || key === 'danang')) continue;

        const dLat = area.lat - options.mapCenter.lat;
        const dLng = area.lng - options.mapCenter.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDistance) {
          minDistance = dist;
          closestKey = key;
        }
      }
      if (closestKey && AREAS_GUIDE[closestKey]) {
        return { key: closestKey, area: AREAS_GUIDE[closestKey] };
      }
    }

    if (currentCity === 'hcm') return { key: 'hcm', area: AREAS_GUIDE.hcm };
    if (currentCity === 'danang') return { key: 'danang', area: AREAS_GUIDE.danang };
    return { key: 'mydinh', area: AREAS_GUIDE.mydinh };
  }

  function formatGuideMessage(area, spots = [], categoryType = 'all') {
    let categoryTitle = 'Địa Điểm Ăn Uống & Vui Chơi Nổi Tiếng';
    if (categoryType === 'cinema') categoryTitle = 'Rạp Chiếu Phim & Giải Trí Hiện Đại';
    else if (categoryType === 'cafe') categoryTitle = 'Quán Cà Phê View Đẹp & Không Gian Thư Giãn';
    else if (categoryType === 'food') categoryTitle = 'Món Ngon Đặc Sản & Quán Ăn Nổi Tiếng';

    let msg = `**Gợi Ý ${categoryTitle}: ${area.title}**\n\n`;
    msg += `*${area.highlight}*\n\n`;

    const displaySpots = spots.length > 0 ? spots : area.spots;
    displaySpots.forEach((spot, idx) => {
      msg += `**${idx + 1}. ${spot.name}**\n`;
      msg += `• **Địa chỉ**: ${spot.address}\n`;
      msg += `• **Đặc sản / Nổi bật**: ${spot.feature}\n`;
      msg += `• **Không gian & Giá**: ${spot.vibe} (${spot.price})\n\n`;
    });

    if (area.trafficTip) {
      msg += `**Mẹo giao thông & đỗ xe thực tế**:\n${area.trafficTip}\n\n`;
    }
    msg += `*Hệ thống đã tự động ghim các địa điểm này lên bản đồ. Bạn có thể bấm trực tiếp vào ghim hoặc nút **Chỉ đường** bên dưới để di chuyển an toàn!*`;

    return msg;
  }

  return {
    isFoodOrFun: function (query) {
      if (!query) return false;
      return FOOD_KEYWORDS_REGEX.test(query);
    },
    getRecommendation: function (query, currentCity = 'hanoi', options = {}) {
      const { key, area } = findAreaGuide(query, currentCity, options);
      const q = (query || '').toLowerCase();

      const isCinema = /(?:rạp|chiếu phim|xem phim|cinema|cgv|beta|lotte|bhd|galaxy|phim)/i.test(q);
      const isCafe = /(?:cafe|cà phê|coffee|trà sữa|trà chanh)/i.test(q) && !isCinema;
      const isFood = /(?:ăn gì|quán ăn|quán ngon|món ngon|lẩu|nướng|nhà hàng|bún|phở|cơm|bánh mì|ăn sáng|ăn trưa|ăn tối)/i.test(q) && !isCinema && !isCafe;

      let spots = [...area.spots];
      let categoryType = 'all';

      if (isCinema) {
        categoryType = 'cinema';
        const cinemaSpots = spots.filter(s => /(?:rạp|phim|cinema|cgv|beta|lotte|bhd|galaxy|the manor|keangnam|garden)/i.test(s.name + ' ' + s.feature));
        if (cinemaSpots.length > 0) spots = cinemaSpots;
      } else if (isCafe) {
        categoryType = 'cafe';
        const cafeSpots = spots.filter(s => /(?:cafe|cà phê|trà|coffee)/i.test(s.name + ' ' + s.feature));
        if (cafeSpots.length > 0) spots = cafeSpots;
      } else if (isFood) {
        categoryType = 'food';
        const foodSpots = spots.filter(s => !/(?:rạp phim|rạp chiếu phim|cinema)/i.test(s.name));
        if (foodSpots.length > 0) spots = foodSpots;
      }

      return {
        text: formatGuideMessage(area, spots, categoryType),
        title: area.title,
        areaKey: key,
        action: {
          type: 'SHOW_FOOD_PLACES',
          areaKey: key,
          lat: area.lat,
          lng: area.lng,
          title: area.title,
          spots: spots
        }
      };
    },
    AREAS_GUIDE
  };
});
