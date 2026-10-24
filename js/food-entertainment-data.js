/**
 * MoveSafe VN - Food & Entertainment Proximity Engine
 * Dữ liệu ẩm thực, cà phê, rạp chiếu phim và điểm vui chơi giải trí thực tế tại Hà Nội, TP.HCM & Đà Nẵng
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FOOD_ENTERTAINMENT_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const FOOD_KEYWORDS_REGEX = /(?:quán ăn|ăn gì|ăn uống|quán ngon|món ngon|đặc sản|nhà hàng|buffet|lẩu|nướng|quán nhậu|phở|bún|cơm|bánh mì|cafe|cà phê|trà sữa|trà chanh|vui chơi|chỗ chơi|đi chơi|chơi đâu|giải trí|check-in|checkin|dạo phố|rạp phim|rạp chiếu phim|chiếu phim|xem phim|phim|cinema|cgv|beta|lotte cinema|bhd|galaxy|trung tâm thương mại|tttm|mua sắm|công viên|quán nào|nơi nào|chỗ nào|uống gì|ăn sáng|ăn trưa|ăn tối|đồ uống|chỗ tụ tập|ăn vặt|karaoke|bida|billiards|bowling|bar|pub|quanh đây|gần đây|ở đây|gần đó|gần tôi|xung quanh|khu này)/i;

  /**
   * Bộ lọc sửa lỗi gõ dính phím tiếng Việt Telex (ví dụ: "thươngg" -> "thương", "quánn" -> "quán")
   */
  function cleanVietnameseTypo(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    // Xử lý ký tự lặp liên tiếp do dính phím
    s = s.replace(/(.)\1+/g, function(match, char) {
      return char;
    });
    return s.trim();
  }

  function _calcDistM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  const AREAS_GUIDE = {
    // 0. Khu vực Chùa Láng - ĐH Ngoại Thương - Học Viện Ngoại Giao - ĐH Luật
    chualang_ftu: {
      aliases: [
        'ngoại thương', 'ngoai thuong', 'ftu', 'chùa láng', 'chua lang',
        'học viện ngoại giao', 'hoc vien ngoai giao', 'dav',
        'đại học luật', 'dai hoc luat', 'hlu',
        'bv gtvt', 'bệnh viện giao thông vận tải', 'ngõ 84 chùa láng', 'ngõ 185 chùa láng',
        'đh ngoại thương', 'dh ngoai thuong', 'trường ngoại thương', 'truong ngoai thuong',
        'đại học ngoại thương', 'dai hoc ngoai thuong', 'ngoại thươngg', 'chùa lángg'
      ],
      title: 'Khu Vực Chùa Láng (ĐH Ngoại Thương & HV Ngoại Giao)',
      lat: 21.0225,
      lng: 105.8055,
      highlight: 'Thiên đường ẩm thực sinh viên sôi động nhất Thủ đô, đầy đủ rạp chiếu phim hiện đại, quán cà phê làm việc và điểm check-in mua sắm.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Bunenu Minh Khai - Buffet Nem Nướng Nha Trang',
          address: 'Số 112 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0228,
          lng: 105.8048,
          feature: 'Buffet nem nướng Nha Trang cuốn bánh tráng rau sống, ram bắp giòn rụm, nước chấm thịt băm béo bùi chuẩn vị.',
          vibe: 'Quán sinh viên đông vui, điều hòa mát rượi, phục vụ nhanh.',
          price: '35.000đ - 65.000đ',
          category: 'food'
        },
        {
          name: 'Cơm Thố Anh Nguyễn - Chùa Láng',
          address: 'Số 95 Phố Chùa Láng (đối diện cổng ĐH Ngoại Thương)',
          lat: 21.0223,
          lng: 105.8051,
          feature: 'Cơm thố cháy giòn rụm sốt xá xíu, bò tiêu đen, gà nấm nóng hổi kèm canh rong biển thanh mát.',
          vibe: 'Hiện đại, sạch sẽ, suất ăn đầy đặn ấm bụng.',
          price: '40.000đ - 60.000đ',
          category: 'food'
        },
        {
          name: 'Phở Gà Phố Cổ Bảo Lộc',
          address: 'Số 72 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0218,
          lng: 105.8062,
          feature: 'Thịt gà ta da giòn thịt ngọt dai, nước dùng thanh trong thơm nức lá chanh, quẩy giòn tan.',
          vibe: 'Không gian sáng sủa, ăn sáng và ăn đêm cực tiện lợi.',
          price: '40.000đ - 55.000đ',
          category: 'food'
        },
        {
          name: 'Noren Ramen - Mì Nhật Bản Chùa Láng',
          address: 'Ngõ 84 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0235,
          lng: 105.8038,
          feature: 'Mì Tonkotsu Ramen nước hầm xương đậm đà, thịt chashu mềm tan, trứng lòng đào ngâm tương béo ngậy.',
          vibe: 'Không gian ấm cúng phong cách Tokyo, decor trẻ trung.',
          price: '65.000đ - 110.000đ',
          category: 'food'
        },
        {
          name: 'Bún Riêu Cua MaMa & Cháo Sườn Nghệ Nhân',
          address: 'Số 59 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0212,
          lng: 105.8068,
          feature: 'Bún riêu cua bắp bò tóp mỡ giòn, cháo sườn sụn sánh mịn rắc ruốc và quẩy nóng thơm phức.',
          vibe: 'Bình dân, thơm nức tiếng sinh viên Ngoại Thương và Ngoại Giao.',
          price: '30.000đ - 50.000đ',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'The Coffee House & Phê La Chùa Láng',
          address: 'Số 102 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0226,
          lng: 105.8045,
          feature: 'Trà ô long đặc sản, cà phê đá xay, không gian bàn dài có ổ cắm tiện học tập và làm việc nhóm.',
          vibe: 'Yên tĩnh, điều hòa mát, view ngắm phố Chùa Láng.',
          price: '45.000đ - 65.000đ',
          category: 'cafe'
        },
        {
          name: 'Calm Space Coffee & Co-working',
          address: 'Số 55 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0215,
          lng: 105.8060,
          feature: 'Trà hoa quả nhiệt đới thanh mát, cold brew hạt Arabica mộc, không gian học tập yên tĩnh, wifi tốc độ cao.',
          vibe: 'Phong cách tối giản, ghế đệm êm, chuyên cho sinh viên học bài và chạy deadline.',
          price: '35.000đ - 55.000đ',
          category: 'cafe'
        },
        {
          name: 'Kafuneko Cat Cafe - Cà Phê Mèo Chùa Láng',
          address: 'Số 33 Phố Chùa Láng, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0208,
          lng: 105.8075,
          feature: 'Đồ uống thơm ngon kèm không gian chơi đùa với hàng chục bé mèo cưng thân thiện, xả stress sau giờ học.',
          vibe: 'Dễ thương, ấm cúng, thư giãn cho các bạn trẻ yêu động vật.',
          price: '40.000đ - 60.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'CGV Vincom Center Nguyễn Chí Thanh',
          address: 'Tầng 6, Vincom Center, 54A Nguyễn Chí Thanh (cách Chùa Láng ~650m)',
          lat: 21.0232,
          lng: 105.8115,
          feature: 'Cụm rạp chiếu phim tiêu chuẩn quốc tế đẳng cấp hàng đầu, phòng chiếu Gold Class & Sweetbox hiện đại, âm thanh vòm Dolby Surround 7.1.',
          vibe: 'Sang trọng, máy lạnh sâu, bắp rang bơ caramel phô mai thơm nức.',
          price: '85.000đ - 150.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Trung Tâm Chiếu Phim Quốc Gia - NCC',
          address: 'Số 87 Láng Hạ, Q. Ba Đình (cách Chùa Láng ~1.5km)',
          lat: 21.0162,
          lng: 105.8165,
          feature: 'Tổ hợp chiếu phim nhà nước quy mô lớn nhất Thủ đô với 13 phòng chiếu sắc nét, giá vé sinh viên ưu đãi đặc biệt.',
          vibe: 'Quy mô lớn, sảnh chờ rộng rãi, nhiều phim bom tấn cập nhật liên tục.',
          price: '45.000đ - 90.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'BHD Star Cineplex Discovery Cầu Giấy',
          address: 'Tầng 8, TTTM Discovery Complex, 302 Cầu Giấy (cách Chùa Láng ~1.8km)',
          lat: 21.0345,
          lng: 105.7942,
          feature: 'Cụm rạp tiêu chuẩn First Class, màn hình cong siêu lớn, ghế tựa ngả cao cấp phục vụ đồ uống tại chỗ.',
          vibe: 'Hiện đại, trẻ trung, check-in sống ảo đẹp mắt.',
          price: '75.000đ - 140.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ / CHECK-IN (entertainment)
        {
          name: 'Vincom Center Nguyễn Chí Thanh & Playtime',
          address: 'Số 54A Nguyễn Chí Thanh, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0232,
          lng: 105.8115,
          feature: 'Trung tâm thương mại 6 tầng sầm uất bậc nhất khu vực: khu mua sắm thời trang quốc tế, ẩm thực lẩu nướng và khu trò chơi giải trí hiện đại.',
          vibe: 'Sôi động, máy lạnh mát mẻ, điểm vui chơi trọn gói ngày cuối tuần.',
          price: 'Vào cửa tự do',
          category: 'entertainment'
        },
        {
          name: 'Công Viên Thủ Lệ & Hồ Láng Thượng',
          address: 'Đường Bưởi & Cổng Nguyễn Văn Ngọc, P. Thủ Lệ, Q. Ba Đình',
          lat: 21.0305,
          lng: 105.8105,
          feature: 'Không gian cây xanh rợp bóng mát, vườn bách thú sinh thái đa dạng, hồ nước lớn thoáng đãng có trò chơi đạp vịt thiên nga.',
          vibe: 'Trong lành, thư giãn, hóng gió dạo bộ lý tưởng sau giờ học.',
          price: '20.000đ - 30.000đ/vé',
          category: 'entertainment'
        },
        {
          name: 'Phố Sinh Viên Chùa Láng & Chợ Thời Trang',
          address: 'Trục đường Chùa Láng (từ ngõ 84 đến ngõ 185 Chùa Láng)',
          lat: 21.0225,
          lng: 105.8055,
          feature: 'Tụ điểm mua sắm quần áo thời trang thiết kế, phụ kiện, mỹ phẩm sinh viên nhộn nhịp cùng hàng chục xe trà chanh giã tay vỉa hè.',
          vibe: 'Trẻ trung, náo nhiệt về chiều tối, đậm chất sinh viên Ngoại Thương và Ngoại Giao.',
          price: '15.000đ - 100.000đ',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Phố Chùa Láng mật độ xe máy rất đông vào giờ tan trường (11h30 - 13h00 và 17h30 - 19h00). Nên đi bộ hoặc gửi xe máy tại bãi xe trường Ngoại Thương / BV GTVT. Đi ô tô nên gửi bãi xe dịch vụ đầu phố Chùa Láng hoặc hầm Vincom Nguyễn Chí Thanh.'
    },

    // 1. Khu vực Mỹ Đình & Nam Từ Liêm
    mydinh: {
      aliases: ['mỹ đình', 'my dinh', 'đình thôn', 'dinh thon', 'lê đức thọ', 'le duc tho', 'nguyễn hoàng', 'nguyen hoang', 'the manor', 'mễ trì', 'me tri', 'nam từ liêm', 'nam tu liem', 'svđ mỹ đình', 'bến xe mỹ đình', 'ben xe my dinh', 'keangnam', 'hàm nghi', 'ham nghi'],
      title: 'Khu vực Mỹ Đình & Nam Từ Liêm (Hà Nội)',
      lat: 21.0205,
      lng: 105.7765,
      highlight: 'Thiên đường ẩm thực nướng Hàn Quốc, bún chả truyền thống, cụm rạp chiếu phim hiện đại và quảng trường dạo mát rộng nhất Thủ đô.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Phố Ẩm Thực Hàn Quốc K-Town (Đình Thôn - The Manor)',
          address: 'Đường Đình Thôn & Khu The Manor Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0145,
          lng: 105.7782,
          feature: 'Thịt bò nướng tảng tươi ngon, canh kim chi, gà rán sốt cay chuẩn vị Seoul (Meat Plus No.1 BBQ, Baek Jeong, K-Pub).',
          vibe: 'Không gian sang trọng, chuẩn phong cách Hàn Quốc.',
          price: '200.000đ - 450.000đ/người',
          category: 'food'
        },
        {
          name: 'Bún Chả Sinh Từ Mỹ Đình',
          address: 'Đường Nguyễn Hoàng (cạnh ngã ba Lê Đức Thọ), P. Mỹ Đình 2',
          lat: 21.0308,
          lng: 105.7735,
          feature: 'Chả miếng nướng than hoa thơm lừng, chả băm mềm ngọt béo bùi, nước chấm đậm đà ăn kèm nem hải sản giòn rụm.',
          vibe: 'Không gian sạch sẽ, máy lạnh mát rượi, phục vụ nhanh.',
          price: '50.000đ - 75.000đ/suất',
          category: 'food'
        },
        {
          name: 'Lẩu Nấm Gia Khánh - Mễ Trì & Vũ Quỳnh',
          address: 'Số 2 Vũ Quỳnh, Khu đô thị Mễ Trì Hạ, Q. Nam Từ Liêm',
          lat: 21.0168,
          lng: 105.7802,
          feature: 'Nước lẩu nấm thanh ngọt bổ dưỡng, thịt bò Úc mềm thơm, các loại nấm quý tươi giòn ăn kèm canh nấm khai vị.',
          vibe: 'Ấm cúng, lịch sự, thích hợp tụ họp gia đình và bạn bè.',
          price: '180.000đ - 300.000đ/người',
          category: 'food'
        },
        {
          name: 'Trâu Ngon Quán Mỹ Đình - Lê Đức Thọ',
          address: 'Đường Lê Đức Thọ (đối diện SVĐ Mỹ Đình), P. Mỹ Đình 1',
          lat: 21.0220,
          lng: 105.7680,
          feature: 'Thịt trâu tươi giật nhúng mẻ, trâu cháy tỏi, trâu xào lá lốt thơm lừng, thịt mềm không dai.',
          vibe: 'Không gian sân vườn rộng mênh mông, bãi đỗ ô tô thoải mái.',
          price: '160.000đ - 260.000đ/người',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'The Coffee House & Highlands The Garden',
          address: 'Tầng 1 TTTM The Garden, Đường Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0143,
          lng: 105.7766,
          feature: 'Cà phê phin sữa đá, trà sen vàng béo ngậy, bánh ngọt kiểu Pháp, không gian máy lạnh view quảng trường.',
          vibe: 'Thư giãn, làm việc và gặp gỡ đối tác.',
          price: '45.000đ - 75.000đ',
          category: 'cafe'
        },
        {
          name: 'Starbucks Coffee - The Manor Mễ Trì',
          address: 'Tòa nhà The Manor, Đường Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0138,
          lng: 105.7775,
          feature: 'Caramel Macchiato thơm nồng, Cold Foam Nitro Brew đậm vị, bánh nướng thơm lừng trong không gian kiến trúc Châu Âu.',
          vibe: 'Đẳng cấp, yên tĩnh, view nhìn ra phố Châu Âu The Manor.',
          price: '65.000đ - 110.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'TTTM The Garden Shopping Center & Rạp Phim CGV',
          address: 'Khu đô thị The Manor, đường Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0141,
          lng: 105.7764,
          feature: 'Cụm rạp chiếu phim CGV cao cấp âm thanh vòm sống động, tổ hợp mua sắm, ẩm thực quốc tế tầng hầm B1 và cafe kiến trúc Paris.',
          vibe: 'Hiện đại, mát mẻ, xem phim và giải trí trọn gói cả ngày.',
          price: 'Vé phim ~100.000đ - 140.000đ',
          category: 'cinema'
        },
        {
          name: 'Beta Cinemas Mỹ Đình (Golden Palace Mễ Trì)',
          address: 'Tầng hầm B1, Tòa Golden Palace, đường Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0152,
          lng: 105.7770,
          feature: 'Cụm rạp chiếu phim chuẩn Hollywood giá vé cực tốt, màn chiếu rộng sắc nét, bắp rang bơ phô mai caramel giòn thơm.',
          vibe: 'Trẻ trung, năng động, quầy chờ check-in đẹp mắt.',
          price: '50.000đ - 90.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Lotte Cinema Keangnam Landmark 72',
          address: 'Tầng 5, Keangnam Landmark 72, đường Phạm Hùng, Q. Nam Từ Liêm',
          lat: 21.0175,
          lng: 105.7838,
          feature: 'Rạp chiếu phim màn hình lớn, ghế đệm da êm ái ngả lưng thoải mái, không gian yên tĩnh và bãi đỗ xe ô tô cực rộng.',
          vibe: 'Sang trọng, thư giãn, có phòng chiếu cao cấp.',
          price: '85.000đ - 160.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'Quảng Trường Sân Vận Động Quốc Gia Mỹ Đình',
          address: 'Đường Lê Đức Thọ, P. Mỹ Đình 1, Q. Nam Từ Liêm',
          lat: 21.0204,
          lng: 105.7639,
          feature: 'Không gian gió mát lộng buổi chiều tối, thả diều, trượt patin, thưởng thức trà chanh giã tay, xúc xích nướng đá ven đường.',
          vibe: 'Cực kỳ thoáng đãng, điểm tụ tập hóng mát số 1 khu Tây Hà Nội.',
          price: '15.000đ - 40.000đ',
          category: 'entertainment'
        },
        {
          name: 'Cung Thể Thao Dưới Nước & Sân Tập Golf Mỹ Đình',
          address: 'Đường Lê Đức Thọ, P. Mỹ Đình 1, Q. Nam Từ Liêm',
          lat: 21.0235,
          lng: 105.7612,
          feature: 'Bể bơi tiêu chuẩn Olympic nước lọc điện phân trong xanh, tổ hợp sân tập thể thao rèn luyện sức khỏe.',
          vibe: 'Chuyên nghiệp, thoáng đãng, thể thao lành mạnh.',
          price: '60.000đ - 120.000đ/lượt',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Xe máy có thể đỗ miễn phí trước cửa hầu hết các quán trên đường Lê Đức Thọ và Nguyễn Hoàng. Nếu đi ô tô hoặc xem phim, bạn gửi xe an toàn tại hầm TTTM The Garden, hầm Golden Palace hoặc Keangnam Landmark 72.'
    },

    // 2. Khu vực Cầu Giấy
    caugiay: {
      aliases: ['cầu giấy', 'cau giay', 'tô hiệu', 'to hieu', 'nghĩa tân', 'nghia tan', 'dịch vọng', 'dich vong', 'xuân thủy', 'xuan thuy', 'trần thái tông', 'tran thai tong', 'duy tân', 'duy tan', 'trung hòa', 'trung hoa', 'hoàng quốc việt'],
      title: 'Khu vực Quận Cầu Giấy (Hà Nội)',
      lat: 21.0335,
      lng: 105.7925,
      highlight: 'Thủ phủ ẩm thực đường phố Tô Hiệu - Nghĩa Tân, các tổ hợp rạp chiếu phim sầm uất và không gian công viên xanh.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Phố Ẩm Thực Tô Hiệu & Chợ Nghĩa Tân',
          address: 'Khu tập thể Nghĩa Tân & Phố Tô Hiệu, Q. Cầu Giấy',
          lat: 21.0432,
          lng: 105.7928,
          feature: 'Bánh mì chảo Cột Điện Quán, Bún chả Tô Hiệu, Tào phớ caramen Nghĩa Tân, Chè bưởi thơm nức tiếng sinh viên.',
          vibe: 'Nhộn nhịp, bình dân, hương vị đậm đà khó quên.',
          price: '20.000đ - 55.000đ',
          category: 'food'
        },
        {
          name: 'Bò Tơ Quán Mộc - Trần Thái Tông',
          address: 'Đường Trần Thái Tông (ngã tư Dịch Vọng Hậu), Q. Cầu Giấy',
          lat: 21.0325,
          lng: 105.7890,
          feature: 'Bò tơ cuốn bánh tráng rau rừng, bò cháy tỏi, lẩu riêu cua bắp bò tơ ngọt lịm.',
          vibe: 'Không gian phong cách phố cổ Hà Nội thập niên 80, ấm cúng.',
          price: '180.000đ - 280.000đ/người',
          category: 'food'
        },
        {
          name: 'Bánh Mì Chảo Cột Điện Quán - Tô Hiệu',
          address: '104-105B C3 Khu Tập Thể Nghĩa Tân, Q. Cầu Giấy',
          lat: 21.0425,
          lng: 105.7932,
          feature: 'Pate rán béo ngậy, trứng ốp la lòng đào, xúc xích xông khói ngập trong nước sốt cà chua sánh đỏ chấm bánh mì giòn.',
          vibe: 'Gắn liền với bao thế hệ sinh viên, phục vụ nhanh chóng.',
          price: '35.000đ - 55.000đ/suất',
          category: 'food'
        },
        {
          name: 'Bún Chả Sinh Từ - Cầu Giấy',
          address: 'Số 48 Trần Thái Tông, P. Dịch Vọng Hậu, Q. Cầu Giấy',
          lat: 21.0315,
          lng: 105.7880,
          feature: 'Chả quạt than hoa đượm khói thơm nồng, nước mắm dưa góp chua ngọt thanh vị kèm bún rối tươi mới.',
          vibe: 'Không gian máy lạnh sạch bóng, chuyên nghiệp.',
          price: '50.000đ - 70.000đ/suất',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'All Day Coffee & Trà Chiều',
          address: 'Đường Trần Thái Tông & Phố Dịch Vọng Hậu, Q. Cầu Giấy',
          lat: 21.0322,
          lng: 105.7885,
          feature: 'Cà phê rang mộc thơm lừng, trà trái cây nhiệt đới, bánh croissant trứng muối nóng giòn.',
          vibe: 'Không gian sang trọng, góc check-in sống ảo phong cách châu Âu.',
          price: '55.000đ - 85.000đ',
          category: 'cafe'
        },
        {
          name: 'Cà Phê Cốt Dừa Cô Hạnh - Tô Hiệu',
          address: 'Số 112 Tô Hiệu, P. Nghĩa Tân, Q. Cầu Giấy',
          lat: 21.0420,
          lng: 105.7935,
          feature: 'Cà phê cốt dừa Hải Phòng béo ngậy sánh mịn, sinh tố dừa đậu xanh ngọt dịu.',
          vibe: 'Gần gũi, đông vui, chỗ ngồi vỉa hè thoáng mát ngắm phố.',
          price: '25.000đ - 45.000đ',
          category: 'cafe'
        },
        {
          name: 'Highlands Coffee - IPH Xuân Thủy',
          address: 'Tầng 1 Indochina Plaza, 241 Xuân Thủy, Q. Cầu Giấy',
          lat: 21.0360,
          lng: 105.7830,
          feature: 'Trà sen vàng, Freeze trà xanh thạch mát lạnh, phin sữa đá đậm đà.',
          vibe: 'Hiện đại, sảnh ngoài trời rộng, tiện đón đối tác.',
          price: '39.000đ - 65.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'BHD Star Cineplex Discovery Cầu Giấy',
          address: 'Tầng 8, TTTM Discovery Complex, 302 Cầu Giấy, Q. Cầu Giấy',
          lat: 21.0345,
          lng: 105.7942,
          feature: 'Cụm rạp First Class với công nghệ âm thanh vòm đỉnh cao, ghế đôi Sweetbox và phòng chiếu VIP sang trọng.',
          vibe: 'Hiện đại, kết hợp ngay ga tàu điện trên cao Nhổn - Ga Hà Nội.',
          price: '70.000đ - 140.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Lotte Cinema IPH Cầu Giấy',
          address: 'Tầng 4, TTTM Indochina Plaza (IPH), 241 Xuân Thủy, Q. Cầu Giấy',
          lat: 21.0362,
          lng: 105.7828,
          feature: 'Cụm rạp phim hiện đại của Hàn Quốc, màn hình sắc nét, combo bắp nước đa dạng hương vị phô mai & caramel.',
          vibe: 'Trẻ trung, ngay cạnh các trường đại học lớn (ĐHQG, Sư Phạm).',
          price: '65.000đ - 120.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'CGV Vincom Center D\'Capitale Trần Duy Hưng',
          address: 'Tầng 5 Vincom D\'Capitale, 119 Trần Duy Hưng, Q. Cầu Giấy',
          lat: 21.0078,
          lng: 105.7955,
          feature: 'Phòng chiếu phim Starium màn hình khổng lồ, dàn âm thanh Dolby Atmos tái hiện âm trường sống động từng chi tiết.',
          vibe: 'Thời thượng, trung tâm mua sắm giải trí nhộn nhịp.',
          price: '90.000đ - 160.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'Công Viên Cầu Giấy',
          address: 'Đường Thành Thái, P. Dịch Vọng, Q. Cầu Giấy',
          lat: 21.0282,
          lng: 105.7912,
          feature: 'Đồi cỏ nhân tạo rộng lớn cho trẻ em chạy nhảy, hồ nước điều hòa thoáng mát, đường dạo bộ xanh mướt.',
          vibe: 'Thiên nhiên trong lành, thư giãn tuyệt vời sau giờ làm việc.',
          price: 'Vào cổng miễn phí',
          category: 'entertainment'
        },
        {
          name: 'Bảo Tàng Dân Tộc Học Việt Nam',
          address: 'Đường Nguyễn Văn Huyên, P. Dịch Vọng, Q. Cầu Giấy',
          lat: 21.0402,
          lng: 105.7985,
          feature: 'Khu trưng bày văn hóa 54 dân tộc, quần thể kiến trúc nhà rông Tây Nguyên, nhà sàn gỗ, múa rối nước ngoài trời rợp bóng cây.',
          vibe: 'Không gian văn hóa đặc sắc, điểm check-in xanh mát bậc nhất.',
          price: '40.000đ/vé (Sinh viên: 15.000đ)',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Phố Tô Hiệu và Nghĩa Tân mật độ xe máy rất đông vào khung giờ 11h30 - 13h00 và 18h00 - 19h30. Nếu đi ô tô, nên chọn các quán có bảo vệ dắt xe hoặc gửi ở bãi đỗ Công viên Cầu Giấy hoặc hầm Discovery Complex 302 Cầu Giấy.'
    },

    // 2b. Khu vực Tạ Quang Bửu - Bách Khoa & NEU
    bachkhoa_taquangbuu: {
      aliases: ['bách khoa', 'bach khoa', 'hust', 'tạ quang bửu', 'ta quang buu', 'kinh tế quốc dân', 'neu', 'xây dựng', 'huce', 'đại cồ việt', 'trần đại nghĩa', 'ktx bách khoa'],
      title: 'Khu Ẩm Thực Tạ Quang Bửu (ĐH Bách Khoa & NEU)',
      lat: 21.0051,
      lng: 105.8433,
      highlight: 'Khu ẩm thực sinh viên huyền thoại quận Hai Bà Trưng, bạt ngàn quán ăn ngon bổ rẻ từ cháo lòng, cơm niêu đến lẩu ếch, cafe học bài và rạp phim lân cận.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Cháo Lòng & Lòng Chần Chợ Bách Khoa',
          address: 'Ngõ 18 Tạ Quang Bửu, P. Bách Khoa, Q. Hai Bà Trưng',
          lat: 21.0062,
          lng: 105.8445,
          feature: 'Cháo lòng sánh thơm gạo rang, dồi rán béo bùi, lòng non giòn sần sật chấm mắm tôm ớt cay nồng.',
          vibe: 'Mộc mạc, bình dân, đông nghẹt sinh viên Bách Khoa mỗi buổi sáng trưa.',
          price: '30.000đ - 50.000đ',
          category: 'food'
        },
        {
          name: 'Cơm Tấm & Cơm Niêu Sinh Viên Tạ Quang Bửu',
          address: 'Khu KTX Bách Khoa, Phố Tạ Quang Bửu, Q. Hai Bà Trưng',
          lat: 21.0048,
          lng: 105.8430,
          feature: 'Sườn nướng mật ong thơm lừng, chả trứng bùi ngậy, cơm cháy giòn rụm sốt xá xíu đậm đà.',
          vibe: 'Phục vụ nhanh gọn, suất cơm đầy đặn no căng bụng.',
          price: '35.000đ - 55.000đ',
          category: 'food'
        },
        {
          name: 'Lẩu Ếch Măng Cay Trần Đại Nghĩa',
          address: 'Đường Trần Đại Nghĩa (sát cổng Parabol Bách Khoa)',
          lat: 21.0035,
          lng: 105.8425,
          feature: 'Thịt ếch xào măng cay giòn sần sật, da ếch chiên vừng vàng ruộm, nước lẩu chua cay đậm đà.',
          vibe: 'Rộng rãi, thích hợp tụ tập liên hoan lớp hoặc nhóm bạn bè.',
          price: '120.000đ - 180.000đ/người',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'Trà Sữa & Cà Phê Học Bài Tạ Quang Bửu',
          address: 'Phố Tạ Quang Bửu & Trần Đại Nghĩa, Q. Hai Bà Trưng',
          lat: 21.0055,
          lng: 105.8440,
          feature: 'Trà sữa trân châu phô mai nướng, bạc xỉu kem trứng ngậy thơm, bàn học dài yên tĩnh có ổ cắm laptop.',
          vibe: 'Không gian học tập chuẩn dân công nghệ Bách Khoa.',
          price: '25.000đ - 45.000đ',
          category: 'cafe'
        },
        {
          name: 'Aha Cafe & Kafa Cafe Đại Cồ Việt',
          address: 'Số 42 Đại Cồ Việt, P. Lê Đại Hành, Q. Hai Bà Trưng',
          lat: 21.0082,
          lng: 105.8475,
          feature: 'Cà phê vỉa hè hiện đại view đối diện công viên Thống Nhất lộng gió, trà chanh quất mật ong thơm mát.',
          vibe: 'Thoáng đãng, tụ tập bạn bè ngắm phố xá.',
          price: '30.000đ - 50.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'CGV Vincom Center Bà Triệu',
          address: 'Tầng 6, Vincom Bà Triệu, 191 Bà Triệu, Q. Hai Bà Trưng (cách Bách Khoa ~1.5km)',
          lat: 21.0115,
          lng: 105.8502,
          feature: 'Cụm rạp chiếu phim chuẩn quốc tế với phòng chiếu lớn, âm thanh kỹ thuật số vòm sống động và quầy bar bắp nước hiện đại.',
          vibe: 'Sang trọng, trung tâm mua sắm 3 tòa tháp sầm uất.',
          price: '85.000đ - 150.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'Công Viên Thống Nhất & Hồ Bảy Mẫu',
          address: 'Đường Trần Nhân Tông & Đại Cồ Việt, Q. Hai Bà Trưng',
          lat: 21.0125,
          lng: 105.8435,
          feature: 'Lá phổi xanh lớn nhất trung tâm Hà Nội, đảo Hòa Bình lộng gió, chèo thuyền đạp vịt, đường chạy bộ rợp bóng cây.',
          vibe: 'Trong lành, thoáng đãng, mở cửa tự do 24/7.',
          price: 'Vào cổng miễn phí',
          category: 'entertainment'
        },
        {
          name: 'Sân Vận Động & Khu Liên Hợp Thể Thao Bách Khoa',
          address: 'Ngõ 40 Tạ Quang Bửu, P. Bách Khoa, Q. Hai Bà Trưng',
          lat: 21.0068,
          lng: 105.8415,
          feature: 'Sân bóng đá cỏ nhân tạo, bể bơi tiêu chuẩn, sân tennis và nhà thi đấu đa năng sôi động.',
          vibe: 'Nhiệt huyết thể thao thanh niên sinh viên.',
          price: '20.000đ - 60.000đ',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Đường Tạ Quang Bửu và Trần Đại Nghĩa có nhiều bãi gửi xe máy dọc hè KTX. Nếu đi ô tô, nên gửi tại bãi xe trong khuôn viên ĐH Bách Khoa cổng Trần Đại Nghĩa hoặc cổng Đại Cồ Việt.'
    },

    // 3. Khu vực Hoàn Kiếm & Phố Cổ
    hoankiem: {
      aliases: ['hoàn kiếm', 'hoan kiem', 'phố cổ', 'pho co', 'hồ gươm', 'ho guom', 'bát đàn', 'bat dan', 'tạ hiện', 'ta hien', 'tràng tiền', 'trang tien', 'hàng bài', 'đinh tiên hoàng', 'hàng buồm', 'nhà thờ lớn'],
      title: 'Khu vực Hoàn Kiếm & 36 Phố Phường (Hà Nội)',
      lat: 21.0285,
      lng: 105.8525,
      highlight: 'Cái nôi tinh hoa ẩm thực Kinh Kỳ với các món truyền thống lâu đời, rạp chiếu phim Tràng Tiền và phố đi bộ sôi động.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Phở Gia Truyền Bát Đàn & Phở Thìn Bờ Hồ',
          address: '49 Bát Đàn / 61 Đinh Tiên Hoàng, Q. Hoàn Kiếm',
          lat: 21.0332,
          lng: 105.8462,
          feature: 'Nước dùng ninh xương bò trong veo ngọt thanh, thịt bò tái lăn mềm thơm, quẩy giòn tan.',
          vibe: 'Mộc mạc, đậm chất Hà Nội xưa, luôn tấp nập khách sành ăn.',
          price: '55.000đ - 85.000đ',
          category: 'food'
        },
        {
          name: 'Bún Chả Hàng Quạt & Bún Thang Bà Đức',
          address: 'Ngõ 74 Hàng Quạt / 48 Cầu Gỗ, Q. Hoàn Kiếm',
          lat: 21.0328,
          lng: 105.8495,
          feature: 'Chả quạt than hoa đượm khói thơm nức ngõ nhỏ, bún thang thanh tao chuẩn vị ẩm thực Hà Thành.',
          vibe: 'Nét văn hóa ngõ phố đặc trưng, chuẩn vị truyền thống.',
          price: '40.000đ - 60.000đ',
          category: 'food'
        },
        {
          name: 'Nộm Bò Khô Long Vi Dung & Kem Tràng Tiền',
          address: '23 Hồ Hoàn Kiếm / 35 Tràng Tiền, Q. Hoàn Kiếm',
          lat: 21.0315,
          lng: 105.8530,
          feature: 'Nộm đu đủ bò khô cay ngọt giòn sần sật; que kem ốc quế cốm dừa truyền thống bên bờ hồ.',
          vibe: 'Trải nghiệm ẩm thực đường phố không thể bỏ qua khi dạo Bờ Hồ.',
          price: '15.000đ - 45.000đ',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'Cà Phê Giảng (Cà Phê Trứng) & Đinh Cafe',
          address: '39 Nguyễn Hữu Huân / 13 Đinh Tiên Hoàng, Q. Hoàn Kiếm',
          lat: 21.0339,
          lng: 105.8545,
          feature: 'Lớp kem trứng đánh bông mịn béo ngậy thơm nức hương cà phê robusta, ngắm hồ Gươm từ ban công cũ.',
          vibe: 'Hoài niệm, thơm nức, phong vị Hà Nội cổ xưa.',
          price: '35.000đ - 50.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'CGV Tràng Tiền Plaza',
          address: 'Tầng 5, Tràng Tiền Plaza, 24 Hai Bà Trưng, Q. Hoàn Kiếm',
          lat: 21.0255,
          lng: 105.8532,
          feature: 'Rạp chiếu phim kiến trúc bán cổ điển sang trọng giữa lòng Phố Cổ, trang thiết bị âm thanh màn chiếu tiên tiến nhất.',
          vibe: 'Quý phái, yên tĩnh, view ngắm góc phố Tràng Tiền lịch sử.',
          price: '90.000đ - 160.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'Phố Đi Bộ Hồ Hoàn Kiếm (Hồ Gươm)',
          address: 'Quanh Hồ Hoàn Kiếm (Đinh Tiên Hoàng - Lê Thái Tổ - Hàng Khay)',
          lat: 21.0288,
          lng: 105.8522,
          feature: 'Không gian văn hóa cộng đồng cuối tuần, biểu diễn âm nhạc đường phố, trò chơi dân gian, ngắm Tháp Rùa và Cầu Thê Húc.',
          vibe: 'Sôi động, đậm nét truyền thống và giao lưu quốc tế.',
          price: 'Mở cửa tự do cuối tuần',
          category: 'entertainment'
        },
        {
          name: 'Phố Bia & Ẩm Thực Đêm Tạ Hiện',
          address: 'Ngã tư Tạ Hiện - Lương Ngọc Quyến, Q. Hoàn Kiếm',
          lat: 21.0345,
          lng: 105.8518,
          feature: 'Bia hơi mát lạnh, chim cút nướng mật ong, nem chua rán, khoai tây chiên giòn.',
          vibe: 'Sôi động nhất về đêm, giao lưu bạn bè quốc tế.',
          price: '50.000đ - 150.000đ',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Phố đi bộ Hồ Gươm cấm phương tiện từ 19h00 thứ Sáu đến hết Chủ nhật. Bạn nên gửi xe tại bãi gửi xe Đinh Tiên Hoàng hoặc hầm Tràng Tiền Plaza.'
    },

    // 4. Khu vực Đống Đa
    dongda: {
      aliases: ['đống đa', 'dong da', 'thái hà', 'thai ha', 'chùa bộc', 'chua boc', 'xã đàn', 'xa dan', 'phạm ngọc thạch', 'pham ngoc thach', 'hoàng cầu', 'hoang cau', 'láng hạ', 'lang ha', 'tôn đức thắng', 'văn miếu', 'van mieu'],
      title: 'Khu vực Quận Đống Đa (Hà Nội)',
      lat: 21.0185,
      lng: 105.8285,
      highlight: 'Tổ hợp mua sắm, thời trang sinh viên cùng các cụm rạp chiếu phim quốc gia và hồ nước thoáng đãng.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Lẩu Ếch Măng Cay & Lẩu Riêu Cua Xã Đàn',
          address: 'Đường Xã Đàn & Đê La Thành, Q. Đống Đa',
          lat: 21.0152,
          lng: 105.8335,
          feature: 'Nồi lẩu riêu cua bắp bò tóp mỡ đầy ắp, ếch xào măng giòn cay đậm đà, nước dùng chua thanh.',
          vibe: 'Tấp nập, thơm lừng, điểm hẹn liên hoan buổi tối.',
          price: '150.000đ - 250.000đ/người',
          category: 'food'
        },
        {
          name: 'Ốc Bông Hậu & Quán Ăn Vặt Phạm Ngọc Thạch',
          address: 'Khu tập thể Trung Tự & Phố Phạm Ngọc Thạch, Q. Đống Đa',
          lat: 21.0095,
          lng: 105.8352,
          feature: 'Ốc hương sốt trứng muối béo ngậy chấm bánh mì, cút lộn xào me, nem chua rán giòn rụm.',
          vibe: 'Nhộn nhịp, thiên đường ăn vặt học sinh sinh viên.',
          price: '40.000đ - 90.000đ',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'Tổ Hợp Cà Phê Hoàng Cầu (View Hồ Đống Đa)',
          address: 'Bán đảo Hoàng Cầu, P. Ô Chợ Dừa, Q. Đống Đa',
          lat: 21.0185,
          lng: 105.8225,
          feature: 'Các quán cafe view trọn mặt hồ Hoàng Cầu lộng gió, cà phê muối, trà ô long quả mọng.',
          vibe: 'Thoáng đãng, ngắm hoàng hôn cực chill.',
          price: '40.000đ - 65.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'Trung Tâm Chiếu Phim Quốc Gia - 87 Láng Hạ',
          address: 'Số 87 Láng Hạ, P. Thành Công, Q. Ba Đình / Đống Đa',
          lat: 21.0162,
          lng: 105.8165,
          feature: 'Tổ hợp rạp chiếu phim lâu đời và hiện đại bậc nhất với 13 phòng chiếu, màn hình cực lớn và giá vé sinh viên rẻ nhất Thủ đô.',
          vibe: 'Sôi động, sảnh chờ rộng, đầy đủ tiện ích ăn uống.',
          price: '45.000đ - 90.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'Hồ Hoàng Cầu & Đảo Xanh Ô Chợ Dừa',
          address: 'Đường Hoàng Cầu & Mai Anh Tuấn, Q. Đống Đa',
          lat: 21.0190,
          lng: 105.8230,
          feature: 'Hồ nước điều hòa lớn giữa quận Đống Đa, đường dạo bộ ven hồ lộng gió, câu cá thư giãn và ngắm tàu điện Cát Linh - Hà Đông lướt qua.',
          vibe: 'Bình yên, thoáng mát giữa lòng phố thị.',
          price: 'Miễn phí',
          category: 'entertainment'
        },
        {
          name: 'Di Tích Quốc Gia Đặc Biệt Văn Miếu - Quốc Tử Giám',
          address: '58 Quốc Tử Giám, P. Văn Miếu, Q. Đống Đa',
          lat: 21.0285,
          lng: 105.8355,
          feature: 'Trường đại học đầu tiên của Việt Nam với Khuê Văn Các, 82 Bia Tiến sĩ, hồ Thiên Quang và tour đêm 3D Mapping ấn tượng.',
          vibe: 'Trang nghiêm, cổ kính, linh thiêng cầu may mắn học tập.',
          price: '30.000đ - 70.000đ/vé',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Tuyến Xã Đàn và Chùa Bộc thường xuyên đông xe giờ cao điểm (7h30 - 8h30 và 17h30 - 18h30). Hầu hết các quán đều có chỗ để xe máy trước cửa.'
    },

    // 5. Khu vực Tây Hồ
    tayho: {
      aliases: ['tây hồ', 'tay ho', 'hồ tây', 'ho tay', 'quảng bá', 'quang ba', 'xuân diệu', 'xuan dieu', 'từ hoa', 'tu hoa', 'nhật tân', 'nhat tan', 'thanh niên', 'thanh nien', 'trúc bạch', 'truc bach', 'lạc long quân'],
      title: 'Khu vực Hồ Tây & Bán Đảo Quảng An (Hà Nội)',
      lat: 21.0556,
      lng: 105.8225,
      highlight: 'Không gian lộng gió bên mặt nước mênh mông, bánh tôm truyền thống, siêu TTTM Lotte Mall West Lake và thủy cung ngắm cá mập.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Bánh Tôm & Bún Ốc Phủ Tây Hồ',
          address: 'Đường Quảng Khánh & Bán đảo Phủ Tây Hồ, P. Quảng An',
          lat: 21.0612,
          lng: 105.8315,
          feature: 'Bánh tôm vàng ươm giòn tan tôm ngọt lịm chấm mắm chua ngọt, bún ốc nóng hổi chua thanh.',
          vibe: 'Truyền thống, lộng gió hồ Tây.',
          price: '45.000đ - 70.000đ',
          category: 'food'
        },
        {
          name: 'Phở Cuốn Hương Mai & Chinh Thắng (Bán Đảo Ngũ Xã)',
          address: 'Phố Ngũ Xã, P. Trúc Bạch, Q. Ba Đình',
          lat: 21.0452,
          lng: 105.8395,
          feature: 'Phở cuốn thịt bò xào xà lách chấm mắm tỏi ớt, phở chiên phồng sốt bò rau cải giòn rụm.',
          vibe: 'Đặc sản nức tiếng ven hồ Trúc Bạch.',
          price: '60.000đ - 90.000đ',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'Chuỗi Cà Phê View Hoàng Hôn Hồ Tây (Từ Hoa - Quảng Bá)',
          address: 'Đường Từ Hoa & Phố Quảng Bá, Q. Tây Hồ',
          lat: 21.0585,
          lng: 105.8290,
          feature: 'Cà phê rang mộc thơm nồng, view trực diện hoàng hôn buông đỏ rực mặt hồ, góc check-in thơ mộng.',
          vibe: 'Lãng mạn, yên tĩnh, thư giãn tuyệt đối.',
          price: '50.000đ - 85.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'Lotte Cinema Lotte Mall West Lake Tây Hồ',
          address: 'Tầng 4, Lotte Mall West Lake, 272 Võ Chí Công, P. Phú Thượng, Q. Tây Hồ',
          lat: 21.0745,
          lng: 105.8115,
          feature: 'Cụm rạp 9 phòng chiếu hiện đại nhất miền Bắc với phòng chiếu cao cấp Charlotte giường nằm êm ái, âm thanh vòm Dolby Atmos.',
          vibe: 'Đẳng cấp 5 sao quốc tế, tổ hợp mua sắm thượng lưu.',
          price: '90.000đ - 220.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'TTTM Lotte Mall West Lake & Thủy Cung Lotte World',
          address: 'Số 272 Võ Chí Công, P. Phú Thượng, Q. Tây Hồ',
          lat: 21.0745,
          lng: 105.8115,
          feature: 'Đại thủy cung trong nhà lớn nhất Hà Nội với đường hầm kính đại dương ngắm cá đuối và cá mập, tổ hợp mua sắm 5 tầng lộng lẫy.',
          vibe: 'Check-in đẳng cấp, ngắm cảnh hồ Tây từ rooftop trên cao.',
          price: 'Vào TTTM miễn phí (Vé thủy cung ~190.000đ - 280.000đ)',
          category: 'entertainment'
        },
        {
          name: 'Thung Lũng Hoa Hồ Tây & Công Viên Nước Hồ Tây',
          address: 'Đường Nhật Chiêu & Lạc Long Quân, P. Nhật Tân, Q. Tây Hồ',
          lat: 21.0665,
          lng: 105.8175,
          feature: 'Vườn hoa bốn mùa khoe sắc rực rỡ bên hồ, cối xay gió, cầu gỗ ngắm hoàng hôn và công viên nước giải nhiệt mùa hè.',
          vibe: 'Tuyệt đẹp cho các buổi chụp ảnh ngoại cảnh và dã ngoại gia đình.',
          price: '50.000đ - 100.000đ/vé',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Đường ven hồ Tây hẹp nhưng rất thoáng đãng. Buổi chiều cuối tuần lượng người ngắm hoàng hôn đông, bạn nên đi xe máy để dễ dừng chân check-in.'
    },

    // 6. Khu vực Ba Đình
    badinh: {
      aliases: ['ba đình', 'ba dinh', 'đội cấn', 'doi can', 'liễu giai', 'lieu giai', 'kim mã', 'kim ma', 'giảng võ', 'giang vo', 'lăng bác', 'lang bac', 'phan đình phùng'],
      title: 'Khu vực Quận Ba Đình (Hà Nội)',
      lat: 21.0335,
      lng: 105.8235,
      highlight: 'Khu trung tâm hành chính lịch thiệp, đài quan sát Landmark Lotte Center, rạp chiếu phim sang trọng và món ngon Đội Cấn.',
      spots: [
        // QUÁN ĂN (food)
        {
          name: 'Bánh Xèo & Nem Lụi Đội Cấn',
          address: '166B Đội Cấn, P. Đội Cấn, Q. Ba Đình',
          lat: 21.0345,
          lng: 105.8248,
          feature: 'Bánh xèo vỏ giòn rụm nhân tôm thịt giá đỗ, nem lụi nướng than hoa thơm lừng cuộn bánh tráng chấm nước lèo bùi ngậy.',
          vibe: 'Nhộn nhịp, thơm nức mùi đồ nướng.',
          price: '30.000đ - 65.000đ',
          category: 'food'
        },
        {
          name: 'Lẩu Cá Kèo & Lẩu Thái Giảng Võ',
          address: 'Phố Trần Huy Liệu & Hồ Giảng Võ, Q. Ba Đình',
          lat: 21.0275,
          lng: 105.8195,
          feature: 'Cá kèo sống tươi rói lá giang chua cay giải nhiệt, lẩu Thái tomyum chua cay thơm ngậy nước dừa.',
          vibe: 'Mát mẻ ven hồ Giảng Võ, thích hợp liên hoan.',
          price: '160.000đ - 240.000đ/người',
          category: 'food'
        },
        // CÀ PHÊ (cafe)
        {
          name: 'Cà Phê Trầm Quán Thánh & All Day Liễu Giai',
          address: 'Phố Quán Thánh & Đường Liễu Giai, Q. Ba Đình',
          lat: 21.0385,
          lng: 105.8210,
          feature: 'Cà phê rang xay chuẩn vị, không gian thanh tịnh rợp bóng cây cổ thụ Phan Đình Phùng.',
          vibe: 'Lịch sự, yên tĩnh, thư thái.',
          price: '40.000đ - 70.000đ',
          category: 'cafe'
        },
        // RẠP CHIẾU PHIM (cinema)
        {
          name: 'Lotte Cinema Lotte Center Hà Nội',
          address: 'Tầng 3, Tòa nhà Lotte Center, 54 Liễu Giai, Q. Ba Đình',
          lat: 21.0325,
          lng: 105.8128,
          feature: 'Rạp chiếu phim tiêu chuẩn Hàn Quốc, phòng chiếu êm ái, bắp rang bơ phô mai tuyệt hảo và hầm đỗ xe hiện đại.',
          vibe: 'Sang trọng, tiện nghi, ngay cạnh đại sứ quán và khách sạn 5 sao.',
          price: '85.000đ - 150.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ (entertainment)
        {
          name: 'Đài Quan Sát Lotte Observation Deck Tầng 65',
          address: 'Tầng 65, Tòa nhà Lotte Center, 54 Liễu Giai, Q. Ba Đình',
          lat: 21.0325,
          lng: 105.8128,
          feature: 'Sàn kính Sky Walk nhô ra không trung ngắm trọn vẹn toàn cảnh Hà Nội từ độ cao gần 300 mét, chụp ảnh check-in ngoạn mục.',
          vibe: 'Độc đáo, cảm giác mạnh, lãng mạn ngắm hoàng hôn và thành phố lên đèn.',
          price: '150.000đ - 230.000đ/vé',
          category: 'entertainment'
        },
        {
          name: 'Quảng Trường Ba Đình & Lăng Chủ Tịch Hồ Chí Minh',
          address: 'Đường Hùng Vương, P. Điện Biên, Q. Ba Đình',
          lat: 21.0368,
          lng: 105.8345,
          feature: 'Quảng trường lịch sử rộng lớn, lễ thượng cờ (6h00) và hạ cờ (21h00) trang nghiêm, rợp bóng cây xanh bách thảo.',
          vibe: 'Trang trọng, bình yên, tự hào dân tộc.',
          price: 'Vào cổng tự do',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Khu vực Ba Đình có nhiều tuyến phố cấm đỗ ô tô và đường một chiều (như Đội Cấn, Kim Mã đoạn trên cao). Bạn nên gửi xe tại hầm Lotte Center Liễu Giai hoặc bãi đỗ xe Đền Quán Thánh.'
    },

    // 7. TP. Hồ Chí Minh
    hcm: {
      aliases: ['hcm', 'sài gòn', 'sai gon', 'quận 1', 'quan 1', 'quận 3', 'quan 3', 'bến thành', 'ben thanh', 'bùi viện', 'bui vien', 'nguyễn huệ', 'nguyen hue'],
      title: 'Trung tâm Quận 1 & TP. Hồ Chí Minh',
      lat: 10.7769,
      lng: 106.7009,
      highlight: 'Thiên đường ẩm thực phương Nam không ngủ, cà phê bệt Nhà thờ Đức Bà, cụm rạp phim Vincom và phố đi bộ Nguyễn Huệ sôi động.',
      spots: [
        {
          name: 'Cơm Tấm Ba Ghiền & Cơm Tấm Phúc Lộc Thọ',
          address: '84 Đặng Văn Ngữ, Q. Phú Nhuận / Chuỗi Q.1, TP.HCM',
          lat: 10.7925,
          lng: 106.6785,
          feature: 'Miếng sườn cốt lết nướng khổng lồ cháy xém thơm nức mũi, bì chả mềm ngậy, trứng ốp la lòng đào chảy chan mỡ hành tóp mỡ.',
          vibe: 'Hương vị Sài Gòn đặc trưng khó cưỡng.',
          price: '45.000đ - 95.000đ/đĩa',
          category: 'food'
        },
        {
          name: 'Hủ Tiếu Nam Vang Nhân Quán',
          address: '122 Nguyễn Trãi, P. Bến Thành, Quận 1',
          lat: 10.7688,
          lng: 106.6912,
          feature: 'Sợi hủ tiếu dai ngọt trộn sốt đậm đà, tôm sú tươi giòn, trứng cút, thịt băm và tô nước súp xương ngọt thanh.',
          vibe: 'Sạch sẽ, đông khách ngày đêm.',
          price: '65.000đ - 90.000đ',
          category: 'food'
        },
        {
          name: 'Cà Phê Bệt & Trà Dâu Đông Du (Nhà Thờ Đức Bà)',
          address: 'Công viên 30/4 & Đường Đông Du, Quận 1, TP.HCM',
          lat: 10.7798,
          lng: 106.6990,
          feature: 'Cà phê sữa đá đậm đà, trà dâu tây thanh mát, ngồi bệt trên thảm cỏ xanh rợp bóng mát ngắm bồ câu.',
          vibe: 'Nét văn hóa cà phê độc nhất vô nhị của giới trẻ Sài Gòn.',
          price: '20.000đ - 35.000đ',
          category: 'cafe'
        },
        {
          name: 'CGV Vincom Center Đồng Khởi',
          address: 'Tầng 3, Vincom Center, 72 Lê Thánh Tôn, Bến Nghé, Quận 1',
          lat: 10.7778,
          lng: 106.7020,
          feature: 'Cụm rạp chiếu phim hiện đại phòng chiếu IMAX Laser và Gold Class sang trọng giữa trung tâm Sài Gòn.',
          vibe: 'Sang trọng, đẳng cấp, mua sắm giải trí trọn gói.',
          price: '100.000đ - 220.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Phố Đi Bộ Nguyễn Huệ & Bến Bạch Đằng Waterbus',
          address: 'Đường Nguyễn Huệ & Công viên Bến Bạch Đằng, Quận 1',
          lat: 10.7735,
          lng: 106.7042,
          feature: 'Quảng trường đi bộ hiện đại ngắm sông Sài Gòn và tòa tháp Bitexco rực rỡ, trải nghiệm buýt đường sông Waterbus ngắm hoàng hôn.',
          vibe: 'Sôi động nhất Sài Gòn về đêm, check-in lung linh ánh đèn.',
          price: 'Miễn phí (Waterbus ~15.000đ/lượt)',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Khu vực Quận 1 thường xuyên cấm dừng đỗ ô tô trên các tuyến Lê Thánh Tôn, Pasteur. Bạn nên gửi xe tại hầm Vincom Đồng Khởi hoặc Diamond Plaza.'
    },

    // 8. Đà Nẵng
    danang: {
      aliases: ['đà nẵng', 'da nang', 'hải châu', 'hai chau', 'sơn trà', 'son tra', 'cầu rồng', 'cau rong', 'mỹ khê', 'my khe'],
      title: 'Trung tâm Quận Hải Châu & Bãi Biển Mỹ Khê (Đà Nẵng)',
      lat: 16.0678,
      lng: 108.2208,
      highlight: 'Thiên đường ẩm thực miền Trung đậm đà, rạp chiếu phim hiện đại, show cầu Rồng phun lửa và bãi biển quyến rũ nhất hành tinh.',
      spots: [
        {
          name: 'Bánh Tráng Cuốn Thịt Heo Đại Lộc',
          address: '97 Trưng Nữ Vương, Q. Hải Châu, TP. Đà Nẵng',
          lat: 16.0592,
          lng: 108.2185,
          feature: 'Thịt heo hai đầu da giòn ngọt mềm, cuốn bánh tráng Đại Lộc cùng rau rừng tươi non chấm mắm nêm đậm đà thơm cay xé lưỡi.',
          vibe: 'Chuẩn vị truyền thống xứ Quảng.',
          price: '60.000đ - 90.000đ/suất',
          category: 'food'
        },
        {
          name: 'Mì Quảng Bà Mua & Bún Chả Cá Hờn',
          address: '19 Trần Bình Trọng / 113/3 Nguyễn Chí Thanh, Q. Hải Châu',
          lat: 16.0645,
          lng: 108.2168,
          feature: 'Sợi mì gạo dai thơm, nước nhưn tôm thịt ếch sánh đậm rắc đậu phộng giòn tan kèm bánh tráng nướng.',
          vibe: 'Nổi tiếng khắp Đà thành, phục vụ chu đáo.',
          price: '35.000đ - 55.000đ',
          category: 'food'
        },
        {
          name: 'Cà Phê View Sông Hàn (Đường Bạch Đằng)',
          address: 'Đường Bạch Đằng & Như Nguyệt, Q. Hải Châu',
          lat: 16.0685,
          lng: 108.2245,
          feature: 'Cà phê muối béo ngậy, ngắm trọn vẹn Cầu Rồng và Cầu Quay Sông Hàn lung linh rực sáng về đêm.',
          vibe: 'Lộng gió sông Hàn, thoáng mát bậc nhất.',
          price: '35.000đ - 65.000đ',
          category: 'cafe'
        },
        {
          name: 'CGV Vincom Plaza Ngô Quyền Đà Nẵng',
          address: 'Tầng 4, Vincom Plaza, 910A Ngô Quyền, P. An Hải Bắc, Q. Sơn Trà',
          lat: 16.0725,
          lng: 108.2325,
          feature: 'Cụm rạp chiếu phim hiện đại màn hình cong lớn, âm thanh vòm sống động bên bờ Đông sông Hàn.',
          vibe: 'Trẻ trung, hiện đại, tích hợp sân trượt băng nghệ thuật.',
          price: '65.000đ - 120.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Cầu Rồng Phun Lửa & Bãi Biển Mỹ Khê',
          address: 'Đường Nguyễn Văn Linh & Đường Võ Nguyên Giáp, Đà Nẵng',
          lat: 16.0602,
          lng: 108.2235,
          feature: 'Cầu Rồng biểu tượng phun nước và lửa vào 21h00 thứ Bảy, Chủ nhật; dạo biển ngắm bình minh trên bãi cát trắng mịn.',
          vibe: 'Thành phố đáng sống nhất Việt Nam, trong lành và thân thiện.',
          price: 'Tham quan tự do',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Cầu Rồng cấm các phương tiện qua cầu trong khung giờ diễn ra màn phun lửa (20h45 - 21h30 tối thứ Bảy & Chủ nhật). Bạn nên đi sớm để có vị trí đẹp.'
    }
  };

  /**
   * Phân tích ý định tìm kiếm của người dùng:
   * - 'food': quán ăn, nhà hàng, ăn gì, món ngon, buffet, lẩu nướng, bún phở...
   * - 'cafe': cafe, cà phê, trà sữa, trà chanh, đồ uống...
   * - 'cinema': rạp phim, rạp chiếu phim, xem phim, cinema, cgv, beta, lotte...
   * - 'entertainment': chỗ chơi, đi chơi, giải trí, dạo phố, công viên, quảng trường, tttm...
   */
  function detectSearchIntent(query) {
    if (!query) return 'food';
    const q = cleanVietnameseTypo(query).toLowerCase();

    // Rạp chiếu phim có độ ưu tiên cao nhất nếu có từ khóa phim
    if (/(?:rạp|chiếu phim|xem phim|cinema|cgv|beta|lotte|bhd|galaxy|phim)/i.test(q)) {
      return 'cinema';
    }
    // Cà phê / Đồ uống
    if (/(?:cafe|cà phê|coffee|trà sữa|trà chanh|đồ uống|uống gì)/i.test(q)) {
      return 'cafe';
    }
    // Điểm vui chơi giải trí / Check-in / Công viên
    if (/(?:vui chơi|chỗ chơi|đi chơi|chơi đâu|giải trí|check-in|checkin|dạo phố|công viên|quảng trường|sân vận động|mua sắm|tttm|thủy cung|bảo tàng|hồ láng|thủ lệ)/i.test(q)) {
      return 'entertainment';
    }
    // Mặc định là tìm quán ăn
    return 'food';
  }

  /**
   * Xác định khu vực / điểm neo từ câu hỏi của người dùng
   */
  function findAreaGuide(cleanQuery, currentCity, options = {}) {
    const q = (cleanQuery || '').toLowerCase();

    // 1. Quét tìm kiếm điểm neo (Anchor Extraction)
    for (const [key, area] of Object.entries(AREAS_GUIDE)) {
      if (currentCity === 'hcm' && key !== 'hcm') continue;
      if (currentCity === 'danang' && key !== 'danang') continue;
      if (currentCity === 'hanoi' && (key === 'hcm' || key === 'danang')) continue;

      for (const alias of area.aliases) {
        if (q.includes(alias)) {
          return { key, area };
        }
      }
    }

    // 2. Nếu trong phiên hội thoại trước đã xác định một khu vực
    if (options.lastAreaKey && AREAS_GUIDE[options.lastAreaKey]) {
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

        const d = _calcDistM(options.mapCenter.lat, options.mapCenter.lng, area.lat, area.lng);
        if (d < minDistance) {
          minDistance = d;
          closestKey = key;
        }
      }
      if (closestKey && AREAS_GUIDE[closestKey]) {
        return { key: closestKey, area: AREAS_GUIDE[closestKey] };
      }
    }

    if (currentCity === 'hcm') return { key: 'hcm', area: AREAS_GUIDE.hcm };
    if (currentCity === 'danang') return { key: 'danang', area: AREAS_GUIDE.danang };
    return { key: 'chualang_ftu', area: AREAS_GUIDE.chualang_ftu };
  }

  /**
   * Bộ lọc phân loại nghiêm ngặt: Tuyệt đối không lẫn lộn rạp phim, cafe hay công viên vào danh sách quán ăn
   */
  function filterSpotsByCategory(spots, categoryType, allAreas, centerPoint) {
    let matched = [];
    if (categoryType === 'cinema') {
      matched = spots.filter(s => s.category === 'cinema');
    } else if (categoryType === 'cafe') {
      matched = spots.filter(s => s.category === 'cafe');
    } else if (categoryType === 'entertainment') {
      matched = spots.filter(s => s.category === 'entertainment');
    } else {
      // Mặc định là 'food' (Quán ăn / Nhà hàng): CHỈ LẤY category === 'food'
      matched = spots.filter(s => s.category === 'food');
      // Nếu khu vực chưa có đủ quán ăn thuần, cho phép bổ sung nhưng vẫn LOẠI BỎ 100% rạp phim, công viên, sân vận động
      if (matched.length === 0) {
        matched = spots.filter(s => s.category !== 'cinema' && s.category !== 'entertainment');
      }
    }

    // Nếu khu vực cụ thể chưa có đủ địa điểm thuộc loại hình này (ví dụ rạp phim),
    // tự động tìm các địa điểm thuộc loại hình này trên toàn bộ cơ sở dữ liệu và lấy điểm gần nhất!
    if (matched.length === 0 && centerPoint && allAreas) {
      const globalPool = [];
      for (const a of Object.values(allAreas)) {
        if (!a.spots) continue;
        for (const sp of a.spots) {
          if (categoryType === 'cinema' && sp.category === 'cinema') {
            globalPool.push(sp);
          } else if (categoryType === 'cafe' && sp.category === 'cafe') {
            globalPool.push(sp);
          } else if (categoryType === 'entertainment' && sp.category === 'entertainment') {
            globalPool.push(sp);
          } else if (categoryType === 'food' && sp.category === 'food') {
            globalPool.push(sp);
          }
        }
      }
      if (globalPool.length > 0) {
        // Loại bỏ trùng tên
        const uniqueMap = new Map();
        for (const p of globalPool) {
          if (!uniqueMap.has(p.name)) uniqueMap.set(p.name, p);
        }
        matched = Array.from(uniqueMap.values()).map(s => ({
          ...s,
          distM: _calcDistM(centerPoint.lat, centerPoint.lng, s.lat, s.lng)
        })).sort((a, b) => a.distM - b.distM).slice(0, 5);
      }
    }

    return matched.length > 0 ? matched : spots;
  }

  function formatGuideMessage(area, spots = [], categoryType = 'food', centerPoint = null) {
    let categoryTitle = 'Món Ngon Đặc Sản & Quán Ăn Nổi Tiếng';
    if (categoryType === 'cinema') categoryTitle = 'Rạp Chiếu Phim & Cụm Rạp Hiện Đại';
    else if (categoryType === 'cafe') categoryTitle = 'Quán Cà Phê View Đẹp & Không Gian Thư Giãn';
    else if (categoryType === 'entertainment') categoryTitle = 'Điểm Vui Chơi, Dạo Mát & Giải Trí';

    let msg = `**Gợi Ý ${categoryTitle}: ${area.title}**\n\n`;
    msg += `*${area.highlight}*\n\n`;

    const displaySpots = spots.length > 0 ? spots : area.spots;
    displaySpots.forEach((spot, idx) => {
      let distTag = '';
      if (centerPoint && typeof spot.lat === 'number' && typeof spot.lng === 'number') {
        const dM = _calcDistM(centerPoint.lat, centerPoint.lng, spot.lat, spot.lng);
        distTag = ` *(Cách ~${dM}m)*`;
      }
      msg += `**${idx + 1}. ${spot.name}**${distTag}\n`;
      msg += `• **Địa chỉ**: ${spot.address}\n`;
      msg += `• **Đặc sản / Nổi bật**: ${spot.feature}\n`;
      msg += `• **Không gian & Giá**: ${spot.vibe} (${spot.price})\n\n`;
    });

    if (area.trafficTip) {
      msg += `**Mẹo giao thông & đỗ xe thực tế**:\n${area.trafficTip}\n\n`;
    }
    msg += `*Hệ thống đã tự động ghim ${displaySpots.length} địa điểm này lên bản đồ. Bạn có thể bấm trực tiếp vào từng ghim để xem chi tiết hoặc bấm Chỉ đường.*\n`;

    return msg;
  }

  return {
    isFoodOrFun: function (query) {
      if (!query) return false;
      return FOOD_KEYWORDS_REGEX.test(query);
    },
    cleanVietnameseTypo,
    detectSearchIntent,
    getRecommendation: function (query, currentCity = 'hanoi', options = {}) {
      const cleanQ = cleanVietnameseTypo(query);
      const { key, area } = findAreaGuide(cleanQ, currentCity, options);
      const categoryType = detectSearchIntent(cleanQ);

      const refLat = area.lat;
      const refLng = area.lng;
      const centerPoint = { lat: refLat, lng: refLng };

      let spots = filterSpotsByCategory([...area.spots], categoryType, AREAS_GUIDE, centerPoint);

      // Tính khoảng cách thực tế và sắp xếp theo khoảng cách gần nhất
      if (typeof refLat === 'number' && typeof refLng === 'number') {
        spots = spots.map(s => {
          const distM = (typeof s.lat === 'number' && typeof s.lng === 'number')
            ? _calcDistM(refLat, refLng, s.lat, s.lng)
            : null;
          return { ...s, distM };
        }).sort((a, b) => (a.distM || 0) - (b.distM || 0));
      }

      return {
        text: formatGuideMessage(area, spots, categoryType, centerPoint),
        title: area.title,
        areaKey: key,
        categoryType: categoryType,
        action: {
          type: 'SHOW_FOOD_PLACES',
          areaKey: key,
          categoryType: categoryType,
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
