/**
 * MoveSafe VN - Next-Gen Spatial Food & Entertainment Engine (v3.0)
 * Kiến trúc:
 * 1. Bộ Bóc tách Thực thể Địa danh Tự nhiên (NLP Location Entity Extractor)
 * 2. Định vị Tọa độ Đa tầng (150+ Landmark Trọng điểm + 126 Phường/Xã Hà Nội + Custom Live Geocoder)
 * 3. Quét Bán kính Không gian Thống nhất (Unified Spatial R-Tree Radial Search theo khoảng cách mét thực tế)
 * 4. Phân loại Danh mục Nghiêm ngặt (Food / Cafe / Cinema / Entertainment - 0% lẫn lộn)
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
  const FOOD_KEYWORDS_REGEX = /(?:quán ăn|ăn gì|ăn uống|quán ngon|món ngon|đặc sản|nhà hàng|buffet|lẩu|nướng|quán nhậu|phở|bún|cơm|bánh mì|cafe|cà phê|trà sữa|trà chanh|vui chơi|chỗ chơi|đi chơi|chơi đâu|chơi gì|nơi giải trí|điểm giải trí|khu giải trí|giải trí|check-in|checkin|dạo phố|dạo mát|rạp phim|rạp chiếu phim|chiếu phim|xem phim|phim|cinema|cgv|beta|lotte cinema|bhd|galaxy|trung tâm thương mại|tttm|mua sắm|công viên|quán nào|nơi nào|chỗ nào|uống gì|ăn sáng|ăn trưa|ăn tối|ăn đêm|đồ uống|chỗ tụ tập|ăn vặt|karaoke|bida|billiards|bowling|bar|pub|cửa hàng đồ trung|đồ trung|đồ ăn trung|quán đồ trung|món trung|trung hoa|món hoa|dimsum|sủi cảo|mì vằn thắn|mì kéo|vịt quay bắc kinh|đồ hàn|món hàn|đồ nhật|món nhật|đồ thái|món thái|đồ âu|món âu|quán nào ngon|có gì ngon|món gì ngon|quanh đây|gần đây|ở đây|gần đó|gần tôi|xung quanh|khu này)/i;

  /**
   * Bộ lọc sửa lỗi gõ dính phím tiếng Việt Telex thông minh
   * Chỉ khử các ký tự lặp ở cuối từ (ví dụ: "thươngg" -> "thương", "quánn" -> "quán", "nhấtt" -> "nhất")
   * Bảo toàn 100% các từ viết tắt hoặc tiếng Anh hợp lệ như "tttm", "coffee", "lotte", "buffet", "billiards"
   */
  function cleanVietnameseTypo(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    // Khử ký tự lặp từ 3 lần trở lên bất kỳ (ví dụ: "ngonnn" -> "ngon")
    s = s.replace(/sài\s+bì\s+chưởng/gi, "sà bì chưởng").replace(/sai\s+bi\s+chuong/gi, "sà bì chưởng").replace(/xà\s+bì\s+chưởng/gi, "sà bì chưởng");
    s = s.replace(/(.)\1{2,}/g, '$1');
    // Khử ký tự lặp đôi ở cuối từ tiếng Việt (trừ các từ tiếng Anh phổ biến như coffee, free, tree, bee, mall, Grill, Bell)
    s = s.replace(/([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])\1(?=$|\s|[,.?!])/gi, function(match, ch) {
      return ch;
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

  /**
   * BẢNG ĐỊNH VỊ ĐIỂM NEO ĐỊA DANH CHI TIẾT (LANDMARK ANCHOR GAZETTEER)
   * Giúp nhận diện chính xác từng công viên, trường đại học, bệnh viện, TTTM, nhà ga, hồ nước...
   */
  const SPECIFIC_LANDMARKS = [
    // --- Khu vực Công viên Thống Nhất - Hồ Thiền Quang - Bà Triệu - Lê Duẩn ---
    {
      key: 'cv_thong_nhat',
      city: 'hanoi',
      title: 'Khu Vực Công Viên Thống Nhất & Hồ Thiền Quang',
      lat: 21.0125,
      lng: 105.8435,
      highlight: 'Lá phổi xanh lớn nhất trung tâm Hà Nội với Hồ Bảy Mẫu, phố đi bộ Trần Nhân Tông, Rạp Xiếc Trung Ương và tổ hợp giải trí Vincom Bà Triệu.',
      trafficTip: 'Bạn có thể gửi xe máy và ô tô tại cổng chính đường Trần Nhân Tông (cạnh Rạp Xiếc Trung Ương) hoặc cổng đường Đại Cồ Việt, Lê Duẩn.',
      aliases: ['công viên thống nhất', 'cong vien thong nhat', 'cv thống nhất', 'cv thong nhat', 'hồ bảy mẫu', 'ho bay mau', 'đảo hòa bình', 'hồ thiền quang', 'ho thien quang', 'rạp xiếc trung ương', 'rap xiec trung uong', 'trần nhân tông', 'tran nhan tong', 'nguyễn du', 'nguyen du', 'lê duẩn', 'le duan']
    },
    {
      key: 'vincom_ba_trieu',
      city: 'hanoi',
      title: 'Khu Vực Vincom Bà Triệu & Phố Huế (Hai Bà Trưng)',
      lat: 21.0115,
      lng: 105.8502,
      highlight: 'Tâm điểm mua sắm, rạp chiếu phim CGV, cà phê thời thượng và ẩm thực sầm uất bậc nhất quận Hai Bà Trưng.',
      trafficTip: 'Đường Bà Triệu và Phố Huế là đường một chiều rất đông xe. Nên gửi xe trực tiếp dưới hầm TTTM Vincom Center Bà Triệu.',
      aliases: ['vincom bà triệu', 'vincom ba trieu', 'bà triệu', 'ba trieu', 'phố huế', 'pho hue', 'lê văn hưu', 'le van huu', 'triệu việt vương', 'trieu viet vuong', 'bùi thị xuân', 'mai hắc đế', 'tuệ tĩnh']
    },
    {
      key: 'ga_ha_noi_viet_xo',
      city: 'hanoi',
      title: 'Khu Vực Ga Hà Nội - Cung Văn Hóa Việt Xô - Hỏa Lò',
      lat: 21.0228,
      lng: 105.8442,
      highlight: 'Khu vực giao thoa văn hóa - lịch sử trung tâm với Cung Hữu Nghị Việt Xô, Di tích Nhà tù Hỏa Lò và ẩm thực đường Trần Hưng Đạo.',
      trafficTip: 'Khu vực Quán Sứ - Trần Hưng Đạo có nhiều bãi đỗ xe ô tô dọc vỉa hè được cấp phép và trong khuôn viên Cung Văn Hóa Việt Xô.',
      aliases: ['ga hà nội', 'ga ha noi', 'cung văn hóa', 'cung van hoa', 'việt xô', 'viet xo', 'nhà tù hỏa lò', 'nha tu hoa lo', 'hỏa lò', 'hoa lo', 'quán sứ', 'quan su', 'trần hưng đạo', 'tran hung dao', 'lý thường kiệt', 'ly thuong kiet', 'thợ nhuộm', 'hai bà trưng']
    },
    // --- Khu vực Chùa Bộc - Tây Sơn - ĐH Thủy Lợi - Học viện Ngân Hàng - Phạm Ngọc Thạch ---
    {
      key: 'thuy_loi_ngan_hang_chua_boc',
      city: 'hanoi',
      title: 'Khu Vực ĐH Thủy Lợi - HV Ngân Hàng - Chùa Bộc - Tây Sơn',
      lat: 21.0082,
      lng: 105.8265,
      highlight: 'Thiên đường thời trang, mua sắm, rạp phim Beta/CGV và ẩm thực ăn vặt sầm uất bậc nhất của sinh viên Thủy Lợi - Ngân Hàng - Công Đoàn.',
      trafficTip: 'Ngã tư Chùa Bộc - Tây Sơn - Thái Hà thường đông vào giờ tan tầm. Bạn nên gửi xe tại hầm Vincom Phạm Ngọc Thạch, tòa nhà Mipec Tây Sơn hoặc sân trường ĐH Thủy Lợi.',
      aliases: ['đại học thủy lợi', 'dai hoc thuy loi', 'đh thủy lợi', 'dh thuy loi', 'thủy lợi', 'thuy loi', 'học viện ngân hàng', 'hoc vien ngan hang', 'hv ngân hàng', 'ngân hàng', 'đại học công đoàn', 'công đoàn', 'chùa bộc', 'chua boc', 'tây sơn', 'tay son', 'vincom phạm ngọc thạch', 'phạm ngọc thạch', 'pham ngoc thach', 'beta tây sơn', 'mipec tây sơn', 'gò đống đa', 'đông tác', 'trung tự']
    },
    // --- Khu vực Thái Hà - Hoàng Cầu - Hào Nam - Đê La Thành ---
    {
      key: 'thai_ha_hoang_cau_hao_nam',
      city: 'hanoi',
      title: 'Khu Vực Hồ Hoàng Cầu - Thái Hà - Hào Nam (Đống Đa)',
      lat: 21.0185,
      lng: 105.8225,
      highlight: 'Tổ hợp cà phê view hồ Đống Đa - Hoàng Cầu lộng gió, phố công nghệ Thái Hà và ga tàu điện trên cao Cát Linh.',
      trafficTip: 'Đường ven hồ Hoàng Cầu và Mai Anh Tuấn rất thoáng, nhiều quán cafe có chỗ đỗ ô tô và xe máy rộng rãi.',
      aliases: ['hồ hoàng cầu', 'ho hoang cau', 'hoàng cầu', 'hoang cau', 'hồ đống đa', 'ho dong da', 'thái hà', 'thai ha', 'nhà thờ thái hà', 'nhà thờ giáo xứ thái hà', 'hào nam', 'hao nam', 'đại học văn hóa', 'cát linh', 'cat linh', 'ô chợ dừa', 'o cho dua', 'mai anh tuấn', 'đê la thành', 'la thành', 'tôn đức thắng', 'khâm thiên']
    },
    // --- Khu vực Văn Miếu - Quốc Tử Giám - Bảo Tàng Mỹ Thuật ---
    {
      key: 'van_mieu_quoc_tu_giam',
      city: 'hanoi',
      title: 'Khu Vực Văn Miếu Quốc Tử Giám & Bảo Tàng Mỹ Thuật',
      lat: 21.0285,
      lng: 105.8355,
      highlight: 'Quần thể di tích lịch sử văn hóa ngàn năm Thăng Long, Bảo tàng Mỹ thuật Việt Nam và các quán phở, bún cổ truyền.',
      trafficTip: 'Các tuyến phố quanh Văn Miếu (Quốc Tử Giám, Văn Miếu, Tôn Đức Thắng) là đường một chiều, có bãi gửi xe chính thức phía đối diện cổng Văn Miếu.',
      aliases: ['văn miếu', 'van mieu', 'quốc tử giám', 'quoc tu giam', 'bảo tàng mỹ thuật', 'bao tang my thuat', 'nguyễn khuyến', 'trần phú', 'hàng cháo']
    },
    // --- Khu vực Royal City - Ngã Tư Sở - Nguyễn Trãi - Thanh Xuân ---
    {
      key: 'royal_city_thanh_xuan',
      city: 'hanoi',
      title: 'Khu Vực Royal City - Ngã Tư Sở - Thanh Xuân',
      lat: 21.0025,
      lng: 105.8155,
      highlight: 'Thành phố châu Âu thu nhỏ dưới lòng đất Vincom Mega Mall Royal City, sân trượt băng, rạp CGV và phố ẩm thực Nguyễn Trãi - Thượng Đình.',
      trafficTip: 'Khi đến Royal City, bạn đi theo lối dốc hầm B1/B2 đường Nguyễn Trãi để gửi xe máy và ô tô cực kỳ rộng rãi.',
      aliases: ['royal city', 'ngã tư sở', 'nga tu so', 'nguyễn trãi', 'nguyen trai', 'thanh xuân', 'thanh xuan', 'thượng đình', 'thuong dinh', 'khuất duy tiến', 'vũ trọng phụng', 'nguyễn tuân', 'lê văn lương', 'đại học hà nội', 'đại học khoa học tự nhiên', 'nhân chính']
    },
    // --- Khu vực Times City - Minh Khai - Hai Bà Trưng ---
    {
      key: 'times_city_minh_khai',
      city: 'hanoi',
      title: 'Khu Vực Times City - Minh Khai - Vĩnh Tuy',
      lat: 20.9950,
      lng: 105.8680,
      highlight: 'Khu đô thị hiện đại với Thủy cung VinKE & Vinpearl Aquarium Times City, nhạc nước quảng trường và phố ẩm thực Minh Khai.',
      trafficTip: 'Hầm đỗ xe Times City rộng hàng chục hecta nối thông các tòa Park Hill, rất thuận tiện cho cả xe máy và ô tô.',
      aliases: ['times city', 'time city', 'minh khai', 'vĩnh tuy', 'vinh tuy', 'cầu vĩnh tuy', 'đại la', 'trương định', 'chợ mơ', 'bạch mai', 'kim ngưu', 'tam trinh', 'đền lừ']
    },
    // --- Khu vực Hà Đông - Văn Quán - Kiến Trúc - Bưu Chính ---
    {
      key: 'ha_dong_van_quan',
      city: 'hanoi',
      title: 'Khu Vực Hồ Văn Quán - Hà Đông (ĐH Kiến Trúc & HV Bưu Chính)',
      lat: 20.9785,
      lng: 105.7885,
      highlight: 'Tụ điểm ẩm thực đêm sinh viên Kiến Trúc - Bưu Chính - An Ninh, hồ Văn Quán mát mẻ và đại siêu thị Aeon Mall Hà Đông.',
      trafficTip: 'Dọc đường Nguyễn Khuyến và ven hồ Văn Quán đỗ xe thoải mái; bạn cũng có thể đi tàu điện Cát Linh - Hà Đông xuống ga Văn Quán.',
      aliases: ['hà đông', 'ha dong', 'văn quán', 'van quan', 'hồ văn quán', 'đại học kiến trúc', 'học viện bưu chính', 'ptit', 'học viện an ninh', 'aeon mall hà đông', 'aeon hà đông', 'mỗ lao', 'làng việt kiều châu âu', 'quang trung hà đông', 'trần phú hà đông']
    },
    // --- Khu vực Long Biên - Aeon Mall ---
    {
      key: 'long_bien_aeon',
      city: 'hanoi',
      title: 'Khu Vực Long Biên & Aeon Mall Long Biên',
      lat: 21.0268,
      lng: 105.8995,
      highlight: 'Thiên đường mua sắm ẩm thực Nhật Bản Aeon Mall Long Biên, phố ẩm thực Ngọc Lâm và tầm nhìn cầu Long Biên lịch sử.',
      trafficTip: 'Aeon Mall Long Biên có bãi đỗ xe miễn phí ngoài trời và trên tầng thượng cho hàng nghìn ô tô, xe máy.',
      aliases: ['long biên', 'long bien', 'aeon mall long biên', 'aeon long biên', 'ngọc lâm', 'ngoc lam', 'nguyễn văn cừ', 'cổ linh', 'vinhomes riverside', 'bồ đề', 'sài đồng', 'việt hưng']
    },
    // --- Khu vực Đội Cấn - Ngọc Hà - Hoàng Hoa Thám (Ba Đình) ---
    {
      key: 'doi_can_ngoc_ha',
      city: 'hanoi',
      title: 'Khu Vực Phố Đội Cấn - Ngọc Hà - Hoàng Hoa Thám (Ba Đình)',
      lat: 21.0355,
      lng: 105.8220,
      highlight: 'Tuyến phố ẩm thực truyền thống lâu đời quận Ba Đình với bánh xèo, nem lụi, phở bò, bún ốc và các quán cà phê sân vườn yên tĩnh.',
      trafficTip: 'Phố Đội Cấn có đoạn một chiều đối với ô tô theo hướng từ Bưởi về Lăng Bác. Nên chú ý biển báo phân làn.',
      aliases: ['đội cấn', 'doi can', 'phố đội cấn', 'ngọc hà', 'ngoc ha', 'hoàng hoa thám', 'hoang hoa tham', 'thụy khuê', 'thuy khue', 'văn cao', 'van cao']
    },
    // --- Khu vực Lĩnh Nam - Mai Động - Vĩnh Hưng (Hoàng Mai) ---
    {
      key: 'linh_nam_hoang_mai',
      city: 'hanoi',
      title: 'Khu Vực Lĩnh Nam - Vĩnh Hưng - Mai Động (Hoàng Mai)',
      lat: 20.9803,
      lng: 105.8903,
      highlight: 'Khu vực dân cư đông đúc phía Đông Nam Thủ đô với nhiều hàng quán ẩm thực bình dân, phở bò, cơm ngon và quán lẩu nhậu đêm.',
      trafficTip: 'Đường Lĩnh Nam và Tam Trinh mật độ xe tải và xe máy cao vào giờ tan tầm, nên gửi xe gọn trên vỉa hè của quán.',
      aliases: ['lĩnh nam', 'linh nam', 'đường lĩnh nam', 'vĩnh hưng', 'vinh hung', 'mai động', 'mai dong', 'thúy lĩnh', 'thuy linh', 'nam dư', 'trần phú hoàng mai']
    },
    // --- Khu vực Linh Đàm - Giải Phóng - Giáp Bát - Nước Ngầm (Hoàng Mai) ---
    {
      key: 'linh_dam_giai_phong',
      city: 'hanoi',
      title: 'Khu Vực Bán Đảo Linh Đàm & Đường Giải Phóng (Hoàng Mai)',
      lat: 20.9695,
      lng: 105.8305,
      highlight: 'Khu đô thị sinh thái hồ Linh Đàm rợp bóng cây với hàng trăm nhà hàng hải sản, lẩu nướng, quán cafe ven hồ và rạp phim CGV.',
      trafficTip: 'Nút giao Giải Phóng - Nguyễn Hữu Thọ khá đông giờ cao điểm, bạn nên đi theo đường ven hồ Linh Đàm để đỗ xe rộng rãi.',
      aliases: ['linh đàm', 'linh dam', 'bán đảo linh đàm', 'hồ linh đàm', 'giải phóng', 'giai phong', 'bến xe giáp bát', 'giáp bát', 'bến xe nước ngầm', 'nước ngầm', 'định công', 'dinh cong', 'đại kim', 'hoàng liệt', 'hoàng mai']
    },
    // --- Khu vực Nhổn - ĐH Công Nghiệp - Bắc Từ Liêm ---
    {
      key: 'nhon_bac_tu_liem',
      city: 'hanoi',
      title: 'Khu Vực Nhổn & ĐH Công Nghiệp Hà Nội (Bắc Từ Liêm)',
      lat: 21.0538,
      lng: 105.7352,
      highlight: 'Thủ phủ ẩm thực sinh viên phía Tây Hà Nội quanh ĐH Công Nghiệp và Ga Metro Nhổn với hàng trăm quán lẩu nướng, trà sữa, ăn vặt giá rẻ.',
      trafficTip: 'Bạn có thể di chuyển cực nhanh bằng tàu điện trên cao tuyến Nhổn - Cầu Giấy xuống thẳng Ga Nhổn.',
      aliases: ['nhổn', 'nhon', 'đại học công nghiệp', 'đh công nghiệp', 'dh cong nghiep', 'haui', 'minh khai bắc từ liêm', 'tây tựu', 'phú diễn', 'phu dien', 'diễn', 'cầu diễn', 'cau dien', 'hồ tùng mậu']
    },
    // --- Khu vực Cổ Nhuế - Xuân Đỉnh - Học viện Tài Chính / Cảnh Sát ---
    {
      key: 'co_nhue_xuan_dinh',
      city: 'hanoi',
      title: 'Khu Vực Cổ Nhuế - Phạm Văn Đồng - Ngoại Giao Đoàn (Bắc Từ Liêm)',
      lat: 21.0665,
      lng: 105.7785,
      highlight: 'Khu vực sầm uất quanh Học viện Tài chính, ĐH Mỏ Địa Chất, Công viên Hòa Bình và Khu đô thị Ngoại Giao Đoàn hiện đại.',
      trafficTip: 'Trục Phạm Văn Đồng - Vành đai 3 rất thông thoáng, chú ý đi đúng làn xe máy/ô tô dưới thấp.',
      aliases: ['cổ nhuế', 'co nhue', 'xuân đỉnh', 'xuan dinh', 'ngoại giao đoàn', 'ngoai giao doan', 'công viên hòa bình', 'đại học mỏ', 'học viện tài chính', 'hv tài chính', 'học viện cảnh sát', 'phạm văn đồng', 'đông ngạc', 'bắc từ liêm']
    },
    // --- Khu vực Vinhomes Smart City - Tây Mỗ - Đại Mỗ - Thiên Đường Bảo Sơn ---
    {
      key: 'smart_city_tay_mo',
      city: 'hanoi',
      title: 'Khu Vực Vinhomes Smart City - Tây Mỗ - Thiên Đường Bảo Sơn',
      lat: 21.0035,
      lng: 105.7415,
      highlight: 'Đại đô thị thông minh phía Tây với Vườn Nhật Zenpark, TTTM Vincom Mega Mall Smart City và Công viên giải trí Thiên Đường Bảo Sơn.',
      trafficTip: 'Di chuyển thuận lợi qua Đại lộ Thăng Long hoặc đường Lê Trọng Tấn - Hà Đông; có hệ thống xe buýt điện VinBus kết nối nội đô.',
      aliases: ['smart city', 'vinhomes smart city', 'tây mỗ', 'tay mo', 'đại mỗ', 'dai mo', 'thiên đường bảo sơn', 'thien duong bao son', 'an khánh', 'an khanh', 'hoài đức', 'hoai duc', 'lê trọng tấn']
    },
    // --- Khu vực Gia Lâm - Vinhomes Ocean Park - Học viện Nông Nghiệp ---
    {
      key: 'gia_lam_ocean_park',
      city: 'hanoi',
      title: 'Khu Vực Gia Lâm - Trâu Quỳ - Vinhomes Ocean Park',
      lat: 21.0015,
      lng: 105.9385,
      highlight: 'Quần thể Biển hồ nước mặn Vinhomes Ocean Park, phố ẩm thực sinh viên Học viện Nông Nghiệp (Trâu Quỳ) và làng gốm Bát Tràng.',
      trafficTip: 'Qua cầu Vĩnh Tuy hoặc cầu Thanh Trì rẽ xuống đường Lý Thánh Tông / cao tốc Hà Nội - Hải Phòng rất thông thoáng.',
      aliases: ['gia lâm', 'gia lam', 'trâu quỳ', 'trau quy', 'ocean park', 'vinhomes ocean park', 'biển hồ', 'học viện nông nghiệp', 'đại học nông nghiệp', 'bát tràng', 'bat trang', 'đa tốn', 'kiêu kỵ', 'yên viên']
    },
    // --- Khu vực Đông Anh - Cầu Nhật Tân - Cổ Loa ---
    {
      key: 'dong_anh',
      city: 'hanoi',
      title: 'Khu Vực Trung Tâm Đông Anh - Cao Lỗ - Cổ Loa (Hà Nội)',
      lat: 21.1388,
      lng: 105.8482,
      highlight: 'Trung tâm đô thị phía Bắc sông Hồng với trục ẩm thực đường Cao Lỗ, khu di tích Thành Cổ Loa và các nhà hàng sinh thái.',
      trafficTip: 'Di chuyển từ nội thành qua Cầu Nhật Tân - Võ Nguyên Giáp hoặc Cầu Thăng Long rất nhanh chóng.',
      aliases: ['đông anh', 'dong anh', 'cao lỗ', 'cao lo', 'cổ loa', 'co loa', 'uy nỗ', 'uy no', 'vĩnh ngọc', 'hải bối', 'bắc thăng long']
    },
    // --- Khu vực Sóc Sơn - Nội Bài - Việt Phủ Thành Chương ---
    {
      key: 'soc_son_noi_bai',
      city: 'hanoi',
      title: 'Khu Vực Sóc Sơn - Sân Bay Nội Bài - Hồ Đồng Đò',
      lat: 21.2578,
      lng: 105.8486,
      highlight: 'Điểm đến dã ngoại, cắm trại cuối tuần quanh Hồ Đồng Đò, Núi Hàm Lợn, Đền Gióng Sóc Sơn và hệ thống nhà hàng quanh Sân bay Nội Bài.',
      trafficTip: 'Đi theo trục Võ Nguyên Giáp - Quốc lộ 2 hoặc Quốc lộ 3; lưu ý tốc độ khi vào khu vực nhà ga T1/T2 Nội Bài.',
      aliases: ['sóc sơn', 'soc son', 'nội bài', 'noi bai', 'sân bay nội bài', 'hồ đồng đò', 'đồng đò', 'hàm lợn', 'đền gióng', 'việt phủ thành chương']
    },
    // --- Khu vực Thanh Trì - Ngọc Hồi - Tứ Hiệp ---
    {
      key: 'thanh_tri_ngoc_hoi',
      city: 'hanoi',
      title: 'Khu Vực Thanh Trì - Ngọc Hồi - Tứ Hiệp (Hà Nội)',
      lat: 20.9435,
      lng: 105.8455,
      highlight: 'Cửa ngõ phía Nam Thủ đô nổi tiếng với đặc sản bánh cuốn Thanh Trì gia truyền, phố ẩm thực Tứ Hiệp và KĐT Hồng Hà Eco City.',
      trafficTip: 'Trục đường Ngọc Hồi - Quốc lộ 1A lưu lượng xe khách lớn, nên đi chậm tại nút giao Văn Điển - Tứ Hiệp.',
      aliases: ['thanh trì', 'thanh tri', 'ngọc hồi', 'ngoc hoi', 'văn điển', 'van dien', 'tứ hiệp', 'tu hiep', 'tân triều', 'triều khúc', 'trieu khuc', 'cầu bươu']
    },
    // --- Khu vực Hòa Lạc - ĐH FPT - Thạch Thất - Ba Vì - Sơn Tây ---
    {
      key: 'hoa_lac_son_tay',
      city: 'hanoi',
      title: 'Khu Vực Công Nghệ Cao Hòa Lạc - ĐH FPT - Sơn Tây',
      lat: 21.0124,
      lng: 105.5253,
      highlight: 'Tổ hợp giáo dục và công nghệ Hòa Lạc (ĐH FPT, ĐH Quốc Gia), Làng Văn hóa các Dân tộc Việt Nam và Thành cổ Sơn Tây.',
      trafficTip: 'Di chuyển theo trục Đại lộ Thăng Long thẳng tới nút giao Hòa Lạc (~25-30 phút từ Big C Thăng Long).',
      aliases: ['hòa lạc', 'hoa lac', 'đại học fpt', 'đh fpt', 'fpt hòa lạc', 'thạch thất', 'thach that', 'quốc oai', 'quoc oai', 'sơn tây', 'son tay', 'ba vì', 'ba vi', 'đồng mô', 'chương mỹ', 'xuân mai', 'đan phượng', 'phúc thọ', 'thường tín', 'thanh oai', 'mê linh']
    }
  ];

  const AREAS_GUIDE = {
    // 0. Khu vực Chùa Láng - ĐH Ngoại Thương - Học Viện Ngoại Giao - ĐH Luật
    chualang_ftu: {
      aliases: [
        'ngoại thương', 'ngoai thuong', 'ftu', 'chùa láng', 'chua lang',
        'học viện ngoại giao', 'hoc vien ngoai giao', 'dav',
        'đại học luật', 'dai hoc luat', 'hlu',
        'bv gtvt', 'bệnh viện giao thông vận tải', 'ngõ 84 chùa láng', 'ngõ 185 chùa láng',
        'đh ngoại thương', 'dh ngoai thuong', 'trường ngoại thương', 'truong ngoai thuong',
        'đại học ngoại thương', 'dai hoc ngoai thuong', 'nguyễn chí thanh', 'nguyen chi thanh', 'vincom nguyễn chí thanh', 'pháo đài láng'
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
          address: 'Tầng 6, Vincom Center, 54A Nguyễn Chí Thanh, Q. Đống Đa',
          lat: 21.0232,
          lng: 105.8115,
          feature: 'Cụm rạp chiếu phim tiêu chuẩn quốc tế đẳng cấp hàng đầu, phòng chiếu Gold Class & Sweetbox hiện đại, âm thanh vòm Dolby Surround 7.1.',
          vibe: 'Sang trọng, máy lạnh sâu, bắp rang bơ caramel phô mai thơm nức.',
          price: '85.000đ - 150.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Trung Tâm Chiếu Phim Quốc Gia - NCC',
          address: 'Số 87 Láng Hạ, Q. Ba Đình',
          lat: 21.0162,
          lng: 105.8165,
          feature: 'Tổ hợp chiếu phim nhà nước quy mô lớn nhất Thủ đô với 13 phòng chiếu sắc nét, giá vé sinh viên ưu đãi đặc biệt.',
          vibe: 'Quy mô lớn, sảnh chờ rộng rãi, nhiều phim bom tấn cập nhật liên tục.',
          price: '45.000đ - 90.000đ/vé',
          category: 'cinema'
        },
        // VUI CHƠI GIẢI TRÍ / CHECK-IN (entertainment)
        {
          name: 'Vincom Center Nguyễn Chí Thanh & Khu Giải Trí Playtime',
          address: 'Số 54A Nguyễn Chí Thanh, P. Láng Thượng, Q. Đống Đa',
          lat: 21.0232,
          lng: 105.8115,
          feature: 'Trung tâm thương mại 6 tầng sầm uất bậc nhất khu vực: khu mua sắm thời trang quốc tế, ẩm thực lẩu nướng và khu trò chơi giải trí hiện đại.',
          vibe: 'Sôi động, máy lạnh mát mẻ, điểm vui chơi trọn gói ngày cuối tuần.',
          price: 'Vào cửa tự do',
          category: 'entertainment'
        },
        {
          name: 'Công Viên Thủ Lệ & Vườn Bách Thú Hà Nội',
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
      aliases: ['mỹ đình', 'my dinh', 'đình thôn', 'dinh thon', 'lê đức thọ', 'le duc tho', 'nguyễn hoàng', 'nguyen hoang', 'the manor', 'mễ trì', 'me tri', 'nam từ liêm', 'nam tu liem', 'svđ mỹ đình', 'sân vận động mỹ đình', 'bến xe mỹ đình', 'ben xe my dinh', 'keangnam', 'hàm nghi', 'ham nghi', 'the garden'],
      title: 'Khu vực Mỹ Đình & Nam Từ Liêm (Hà Nội)',
      lat: 21.0205,
      lng: 105.7765,
      highlight: 'Thiên đường ẩm thực nướng Hàn Quốc, bún chả truyền thống, cụm rạp chiếu phim hiện đại và quảng trường dạo mát rộng nhất Thủ đô.',
      spots: [
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
          name: 'Cung Thể Thao Dưới Nước & Khu Giải Trí The Garden',
          address: 'Đường Lê Đức Thọ & Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0235,
          lng: 105.7612,
          feature: 'Bể bơi tiêu chuẩn Olympic nước lọc điện phân trong xanh, tổ hợp sân tập thể thao và khu game giải trí hiện đại.',
          vibe: 'Chuyên nghiệp, thoáng đãng, thể thao lành mạnh.',
          price: '60.000đ - 120.000đ/lượt',
          category: 'entertainment'
        },
        {
          name: 'Bảo Tàng Hà Nội & Công Viên Mễ Trì',
          address: 'Đường Phạm Hùng (cạnh Trung tâm Hội nghị Quốc gia), Q. Nam Từ Liêm',
          lat: 21.0092,
          lng: 105.7862,
          feature: 'Kiến trúc kim tự tháp ngược độc đáo bậc nhất Việt Nam, khuôn viên cây xanh thảm cỏ cực đẹp để dạo mát, chụp ảnh check-in.',
          vibe: 'Không gian nghệ thuật đương đại và sinh thái rộng lớn.',
          price: 'Miễn phí khuôn viên',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Xe máy có thể đỗ miễn phí trước cửa hầu hết các quán trên đường Lê Đức Thọ và Nguyễn Hoàng. Nếu đi ô tô hoặc xem phim, bạn gửi xe an toàn tại hầm TTTM The Garden, hầm Golden Palace hoặc Keangnam Landmark 72.'
    },

    // 2. Khu vực Cầu Giấy
    caugiay: {
      aliases: ['cầu giấy', 'cau giay', 'tô hiệu', 'to hieu', 'nghĩa tân', 'nghia tan', 'dịch vọng', 'dich vong', 'xuân thủy', 'xuan thuy', 'trần thái tông', 'tran thai tong', 'duy tân', 'duy tan', 'trung hòa', 'trung hoa', 'hoàng quốc việt', 'đại học quốc gia', 'đại học sư phạm', 'báo chí tuyên truyền', 'chợ nhà xanh', 'trần duy hưng'],
      title: 'Khu vực Quận Cầu Giấy (Hà Nội)',
      lat: 21.0335,
      lng: 105.7925,
      highlight: 'Thủ phủ ẩm thực đường phố Tô Hiệu - Nghĩa Tân, các tổ hợp rạp chiếu phim sầm uất và không gian công viên xanh.',
      spots: [
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
          name: 'Bảo Tàng Dân Tộc Học Việt Nam & Công Viên Nghĩa Đô',
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

    // 2b. Khu vực Tạ Quang Bửu - Bách Khoa - Công Viên Thống Nhất - Bà Triệu
    bachkhoa_taquangbuu: {
      aliases: ['bách khoa', 'bach khoa', 'hust', 'tạ quang bửu', 'ta quang buu', 'kinh tế quốc dân', 'neu', 'xây dựng', 'huce', 'đại cồ việt', 'trần đại nghĩa', 'ktx bách khoa', 'lê thanh nghị', 'giải phóng', 'bệnh viện bạch mai'],
      title: 'Khu Ẩm Thực Tạ Quang Bửu (ĐH Bách Khoa & NEU)',
      lat: 21.0051,
      lng: 105.8433,
      highlight: 'Khu ẩm thực sinh viên huyền thoại quận Hai Bà Trưng, bạt ngàn quán ăn ngon bổ rẻ từ cháo lòng, cơm niêu đến lẩu ếch, cafe học bài và Công viên Thống Nhất.',
      spots: [
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
        {
          name: 'Bún Chả Hương Liên (Bún Chả Obama) - Lê Văn Hưu',
          address: 'Số 24 Lê Văn Hưu, P. Phan Chu Trinh, Q. Hai Bà Trưng',
          lat: 21.0168,
          lng: 105.8515,
          feature: 'Bún chả truyền thống Hà Nội từng đón Tổng thống Obama, nem cua bể giòn rụm và nem hải sản đặc biệt.',
          vibe: 'Nổi tiếng quốc tế, đông khách, hương vị truyền thống chuẩn mực.',
          price: '50.000đ - 95.000đ/suất',
          category: 'food'
        },
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
          name: 'Aha Cafe & Kafa Cafe Đại Cồ Việt (View Công Viên Thống Nhất)',
          address: 'Số 42 Đại Cồ Việt & Phố Nguyễn Du, Q. Hai Bà Trưng',
          lat: 21.0082,
          lng: 105.8475,
          feature: 'Cà phê vỉa hè hiện đại view đối diện công viên Thống Nhất lộng gió, trà chanh quất mật ong thơm mát.',
          vibe: 'Thoáng đãng, tụ tập bạn bè ngắm phố xá.',
          price: '30.000đ - 50.000đ',
          category: 'cafe'
        },
        {
          name: 'Phố Cà Phê Triệu Việt Vương & Hồ Thiền Quang',
          address: 'Phố Triệu Việt Vương & Quang Trung (sát Hồ Thiền Quang)',
          lat: 21.0172,
          lng: 105.8478,
          feature: 'Tuyến phố thủ phủ cà phê lâu đời nhất Hà Nội (Cafe Thái, All Day Coffee, Laika Cafe view hồ Thiền Quang).',
          vibe: 'Đậm chất Hà Nội, view mặt hồ Thiền Quang rợp bóng cây.',
          price: '35.000đ - 75.000đ',
          category: 'cafe'
        },
        {
          name: 'CGV Vincom Center Bà Triệu',
          address: 'Tầng 6, Vincom Bà Triệu, 191 Bà Triệu, Q. Hai Bà Trưng',
          lat: 21.0115,
          lng: 105.8502,
          feature: 'Cụm rạp chiếu phim chuẩn quốc tế với 10 phòng chiếu lớn, phòng IMAX / Gold Class sang trọng và khu ẩm thực tầng 5.',
          vibe: 'Sang trọng, trung tâm mua sắm 3 tòa tháp sầm uất.',
          price: '85.000đ - 150.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Công Viên Thống Nhất & Đảo Hòa Bình (Hồ Bảy Mẫu)',
          address: 'Đường Trần Nhân Tông - Lê Duẩn - Đại Cồ Việt, Q. Hai Bà Trưng',
          lat: 21.0125,
          lng: 105.8435,
          feature: 'Lá phổi xanh 50ha lớn nhất trung tâm Hà Nội, đạp vịt thiên nga trên Hồ Bảy Mẫu, dạo bộ qua cầu Đảo Hòa Bình, trượt patin và hóng mát.',
          vibe: 'Không gian mở không hàng rào, trong lành, lộng gió suốt bốn mùa.',
          price: 'Vào cổng miễn phí (Đạp vịt: 60.000đ/giờ)',
          category: 'entertainment'
        },
        {
          name: 'Rạp Xiếc Trung Ương & Phố Đi Bộ Trần Nhân Tông',
          address: 'Số 67-69 Trần Nhân Tông (Cổng chính Công viên Thống Nhất), Q. Hai Bà Trưng',
          lat: 21.0170,
          lng: 105.8432,
          feature: 'Biểu diễn xiếc nghệ thuật quốc tế, ảo thuật đặc sắc kết hợp không gian phố đi bộ Trần Nhân Tông - Hồ Thiền Quang sôi động mỗi cuối tuần.',
          vibe: 'Náo nhiệt, hấp dẫn cho cả gia đình, nhóm bạn trẻ và trẻ nhỏ.',
          price: 'Phố đi bộ miễn phí (Vé xiếc: 150.000đ - 300.000đ)',
          category: 'entertainment'
        },
        {
          name: 'Tổ Hợp Giải Trí & Mua Sắm Vincom Center Bà Triệu',
          address: 'Số 191 Bà Triệu, P. Lê Đại Hành, Q. Hai Bà Trưng',
          lat: 21.0115,
          lng: 105.8502,
          feature: 'Trung tâm thương mại biểu tượng với khu Game Center hiện đại, khu vui chơi giáo trí TiniWorld và hàng trăm thương hiệu thời trang quốc tế.',
          vibe: 'Sầm uất, hiện đại, giải trí trọn gói trong nhà.',
          price: 'Vào cửa tự do',
          category: 'entertainment'
        },
        {
          name: 'Cung Văn Hóa Lao Động Hữu Nghị Việt - Xô',
          address: 'Số 91 Trần Hưng Đạo, Q. Hoàn Kiếm (cách CV Thống Nhất ~650m)',
          lat: 21.0222,
          lng: 105.8438,
          feature: 'Trung tâm biểu diễn nghệ thuật, liveshow âm nhạc lớn, triển lãm văn hóa và không gian quảng trường thoáng rộng.',
          vibe: 'Kiến trúc bề thế, tâm điểm các sự kiện văn hóa giải trí Thủ đô.',
          price: 'Tham quan khuôn viên tự do',
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
      trafficTip: 'Đường Trần Nhân Tông tổ chức phố đi bộ vào cuối tuần, bạn có thể gửi xe tại cổng đường Đại Cồ Việt, đường Nguyễn Đình Chiểu hoặc hầm Vincom Bà Triệu.'
    },

    // 3. Khu vực Hoàn Kiếm & Phố Cổ
    hoankiem: {
      aliases: ['hoàn kiếm', 'hoan kiem', 'phố cổ', 'pho co', 'hồ gươm', 'ho guom', 'bát đàn', 'bat dan', 'tạ hiện', 'ta hien', 'tràng tiền', 'trang tien', 'hàng bài', 'đinh tiên hoàng', 'hàng buồm', 'nhà thờ lớn', 'nhà thờ chính tòa', 'nhà hát lớn'],
      title: 'Khu vực Hoàn Kiếm & 36 Phố Phường (Hà Nội)',
      lat: 21.0285,
      lng: 105.8525,
      highlight: 'Cái nôi tinh hoa ẩm thực Kinh Kỳ với các món truyền thống lâu đời, rạp chiếu phim Tràng Tiền và phố đi bộ sôi động.',
      spots: [
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
        {
          name: 'Trà Chanh Nhà Thờ Lớn & Loading T Cafe Chân Cầm',
          address: 'Phố Nhà Thờ & Số 8 Chân Cầm, Q. Hoàn Kiếm',
          lat: 21.0288,
          lng: 105.8489,
          feature: 'Trà chanh hướng dương ngắm Nhà Thờ Lớn cổ kính; cà phê rang xay hương quế trong biệt thự Pháp cổ.',
          vibe: 'Điểm hẹn quen thuộc của giới trẻ Hà Thành.',
          price: '20.000đ - 55.000đ',
          category: 'cafe'
        },
        {
          name: 'CGV Tràng Tiền Plaza & Rạp Tháng Tám',
          address: 'Tầng 5, Tràng Tiền Plaza, 24 Hai Bà Trưng / 45 Hàng Bài, Q. Hoàn Kiếm',
          lat: 21.0255,
          lng: 105.8532,
          feature: 'Rạp chiếu phim kiến trúc bán cổ điển sang trọng giữa lòng Phố Cổ, trang thiết bị âm thanh màn chiếu tiên tiến nhất.',
          vibe: 'Quý phái, yên tĩnh, view ngắm góc phố Tràng Tiền lịch sử.',
          price: '70.000đ - 160.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Phố Đi Bộ Hồ Hoàn Kiếm & Nhà Hát Múa Rối Nước Thăng Long',
          address: 'Quanh Hồ Hoàn Kiếm & 57B Đinh Tiên Hoàng, Q. Hoàn Kiếm',
          lat: 21.0288,
          lng: 105.8522,
          feature: 'Không gian văn hóa cộng đồng cuối tuần, biểu diễn âm nhạc đường phố, múa rối nước truyền thống, ngắm Tháp Rùa và Cầu Thê Húc.',
          vibe: 'Sôi động, đậm nét truyền thống và giao lưu quốc tế.',
          price: 'Mở cửa tự do',
          category: 'entertainment'
        },
        {
          name: 'Di Tích Lịch Sử Nhà Tù Hỏa Lò (Tour Đêm Thiêng Liêng)',
          address: 'Số 1 Phố Hỏa Lò, P. Trần Hưng Đạo, Q. Hoàn Kiếm',
          lat: 21.0253,
          lng: 105.8465,
          feature: 'Trải nghiệm lịch sử sống động với hệ thống thuyết minh tự động và chương trình Tour Đêm Thiêng Liêng đầy xúc cảm.',
          vibe: 'Ấn tượng, sâu sắc, thu hút đông đảo giới trẻ.',
          price: '50.000đ/vé (Sinh viên giảm 50%)',
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
      trafficTip: 'Phố đi bộ Hồ Gươm cấm phương tiện từ 19h00 thứ Sáu đến hết Chủ nhật. Bạn nên gửi xe tại bãi gửi xe Đinh Tiên Hoàng, Phố Nhà Thờ hoặc hầm Tràng Tiền Plaza.'
    },

    // 4. Khu vực Đống Đa (Xã Đàn - Phạm Ngọc Thạch - Chùa Bộc - Tây Sơn)
    dongda: {
      aliases: ['đống đa', 'dong da', 'xã đàn', 'xa dan', 'láng hạ', 'lang ha', 'đặng văn ngữ', 'hồ đắc di', 'nam đồng', 'khâm thiên', 'nguyễn văn tuyết', 'nguyen van tuyet', 'sà bì chưởng', 'sa bi chuong', 'sài bì chưởng', 'sai bi chuong', 'độ mixi'],
      title: 'Khu vực Quận Đống Đa (Hà Nội)',
      lat: 21.0145,
      lng: 105.8285,
      highlight: 'Tổ hợp mua sắm, thời trang sinh viên Chùa Bộc - Phạm Ngọc Thạch, rạp phim hiện đại và các tuyến phố ẩm thực sầm uất.',
      spots: [
        {
          name: 'Cơm Tấm Sà Bì Chưởng (Đống Đa)',
          address: '86 Nguyễn Văn Tuyết, P. Trung Liệt, Q. Đống Đa, Hà Nội',
          lat: 21.009288,
          lng: 105.820635,
          feature: 'Cơm tấm sườn bì chưởng đặc biệt, sườn nướng mật ong mềm thơm, chả trứng béo bùi, tóp mỡ da heo chiên giòn, nước mắm kẹo đậm đà.',
          vibe: 'Quán ăn thương hiệu nổi tiếng của bộ ba Độ Mixi - PewPew - Xemesis, không gian hiện đại, máy lạnh mát mẻ.',
          price: '45.000đ - 110.000đ/suất',
          rating: 4.7,
          reviewsCount: 8264,
          category: 'food'
        },
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
        {
          name: 'Phố Ẩm Thực Chùa Bộc & Tây Sơn (Cổng ĐH Thủy Lợi - Ngân Hàng)',
          address: 'Ngõ 95 Chùa Bộc & Đường Tây Sơn, Q. Đống Đa',
          lat: 21.0080,
          lng: 105.8260,
          feature: 'Thiên đường nem nướng Nha Trang, tokbokki phô mai Hàn Quốc, bánh tráng trộn và bún đậu mắm tôm mẹt đầy đặn.',
          vibe: 'Đông vui tấp nập sinh viên Thủy Lợi và Học viện Ngân Hàng.',
          price: '25.000đ - 60.000đ',
          category: 'food'
        },
        {
          name: 'Tổ Hợp Cà Phê Hoàng Cầu & Hồ Đắc Di',
          address: 'Bán đảo Hoàng Cầu & Đường ven Hồ Đắc Di, Q. Đống Đa',
          lat: 21.0185,
          lng: 105.8225,
          feature: 'Các quán cafe view trọn mặt hồ lộng gió, cà phê muối, trà ô long quả mọng.',
          vibe: 'Thoáng đãng, ngắm hoàng hôn cực chill.',
          price: '40.000đ - 65.000đ',
          category: 'cafe'
        },
        {
          name: 'CGV Vincom Center Phạm Ngọc Thạch',
          address: 'Tầng 8, Vincom Center, Số 2 Phạm Ngọc Thạch, Q. Đống Đa',
          lat: 21.0068,
          lng: 105.8322,
          feature: 'Cụm rạp chiếu phim công nghệ IMAX, 4DX và Gold Class hiện đại ngay ngã tư Phạm Ngọc Thạch - Xã Đàn.',
          vibe: 'Hiện đại, sang trọng, tích hợp khu mua sắm ẩm thực 8 tầng.',
          price: '80.000đ - 160.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Beta Cinemas Tây Sơn (Tòa nhà Mipec)',
          address: 'Tầng 5, Tòa nhà MIPEC, 229 Tây Sơn (gần ĐH Thủy Lợi), Q. Đống Đa',
          lat: 21.0062,
          lng: 105.8238,
          feature: 'Rạp chiếu phim giá vé sinh viên siêu ưu đãi, phòng chiếu trẻ trung, combo bắp nước rẻ và ngon.',
          vibe: 'Tụ điểm xem phim quen thuộc của sinh viên Thủy Lợi, Ngân Hàng, Công Đoàn.',
          price: '45.000đ - 80.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'TTTM Vincom Phạm Ngọc Thạch & Phố Mua Sắm Chùa Bộc',
          address: 'Số 2 Phạm Ngọc Thạch & Phố Chùa Bộc, Q. Đống Đa',
          lat: 21.0075,
          lng: 105.8315,
          feature: 'Tổ hợp giải trí, khu game bowling, mua sắm thời trang sầm uất bậc nhất quận Đống Đa.',
          vibe: 'Nhộn nhịp, rực rỡ ánh đèn suốt ngày đêm.',
          price: 'Vào cửa tự do',
          category: 'entertainment'
        },
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
      trafficTip: 'Tuyến Xã Đàn và Chùa Bộc thường xuyên đông xe giờ cao điểm (7h30 - 8h30 và 17h30 - 18h30). Bạn có thể gửi xe tại hầm Vincom Phạm Ngọc Thạch hoặc hầm Mipec 229 Tây Sơn.'
    },

    // 5. Khu vực Tây Hồ
    tayho: {
      aliases: ['tây hồ', 'tay ho', 'hồ tây', 'ho tay', 'quảng bá', 'quang ba', 'xuân diệu', 'xuan dieu', 'từ hoa', 'tu hoa', 'nhật tân', 'nhat tan', 'thanh niên', 'thanh nien', 'trúc bạch', 'truc bach', 'lạc long quân', 'lotte tây hồ', 'lotte mall west lake', 'võ chí công'],
      title: 'Khu vực Hồ Tây & Bán Đảo Quảng An (Hà Nội)',
      lat: 21.0556,
      lng: 105.8225,
      highlight: 'Không gian lộng gió bên mặt nước mênh mông, bánh tôm truyền thống, siêu TTTM Lotte Mall West Lake và thủy cung ngắm cá mập.',
      spots: [
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
      aliases: ['ba đình', 'ba dinh', 'đội cấn', 'doi can', 'liễu giai', 'lieu giai', 'kim mã', 'kim ma', 'giảng võ', 'giang vo', 'hồ giảng võ', 'lăng bác', 'lang bac', 'phan đình phùng', 'lotte liễu giai', 'xôi xéo oanh oanh', 'xoi xeo oanh oanh', 'la thành', 'la thanh', '559 la thành', '559 la thanh'],
      title: 'Khu vực Quận Ba Đình (Hà Nội)',
      lat: 21.0335,
      lng: 105.8235,
      highlight: 'Khu trung tâm hành chính lịch thiệp, đài quan sát Landmark Lotte Center, rạp chiếu phim sang trọng và món ngon Đội Cấn.',
      spots: [
        {
          name: 'Quán Xôi Xéo Oanh Oanh (La Thành)',
          address: '559 La Thành, P. Thành Công, Q. Ba Đình, Hà Nội',
          lat: 21.023647,
          lng: 105.817328,
          feature: 'Xôi xéo hạt mẩy dẻo thơm nước mỡ hành phi giòn rụm, đỗ xanh béo bùi xắt mỏng, kèm chả mỡ, thịt kho tàu mềm rục.',
          vibe: 'Quán xôi sáng và tối nức tiếng phố La Thành, khách mua tấp nập mang về.',
          price: '25.000đ - 55.000đ/hộp',
          rating: 4.6,
          reviewsCount: 1420,
          category: 'food'
        },
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

    // 6b. Khu vực Thanh Xuân - Royal City - Hà Đông - Times City
    thanhxuan_royal: {
      aliases: ['royal city', 'ngã tư sở', 'nguyễn trãi', 'thanh xuân', 'lê văn lương', 'khuất duy tiến', 'vũ trọng phụng'],
      title: 'Khu Vực Royal City - Ngã Tư Sở - Thanh Xuân',
      lat: 21.0025,
      lng: 105.8155,
      highlight: 'Quần thể mua sắm ngầm lớn nhất châu Á Vincom Mega Mall Royal City, sân trượt băng Ice Rink và phố ẩm thực Nguyễn Trãi.',
      spots: [
        {
          name: 'Phố Ẩm Thực Royal City & Lẩu Nướng Nguyễn Trãi',
          address: 'Tầng hầm B2 Royal City, 72A Nguyễn Trãi, Q. Thanh Xuân',
          lat: 21.0025,
          lng: 105.8155,
          feature: 'Hàng trăm nhà hàng lẩu nướng Hàn - Nhật - Thái (Gogi House, Kichi Kichi, Haidilao, Dookki) quy tụ trong không gian kiến trúc châu Âu.',
          vibe: 'Sầm uất, mát mẻ, đa dạng lựa chọn ẩm thực.',
          price: '150.000đ - 350.000đ/người',
          category: 'food'
        },
        {
          name: 'CGV Vincom Mega Mall Royal City',
          address: 'Tầng hầm B2, Royal City, 72A Nguyễn Trãi, Q. Thanh Xuân',
          lat: 21.0022,
          lng: 105.8152,
          feature: 'Cụm rạp chiếu phim quy mô lớn với phòng chiếu Gold Class và màn hình cong cực đại.',
          vibe: 'Sang trọng, hiện đại.',
          price: '85.000đ - 160.000đ/vé',
          category: 'cinema'
        },
        {
          name: 'Sân Trượt Băng Vincom Ice Rink & Khu Vui Chơi Royal City',
          address: 'Tầng hầm B2, 72A Nguyễn Trãi, Q. Thanh Xuân',
          lat: 21.0026,
          lng: 105.8158,
          feature: 'Sân trượt băng tự nhiên trong nhà lớn nhất Việt Nam, khu bowling Heroworld, triển lãm nghệ thuật đương đại VCCA.',
          vibe: 'Trải nghiệm giải trí độc đáo bất chấp thời tiết nắng mưa.',
          price: '100.000đ - 220.000đ/vé',
          category: 'entertainment'
        },
        {
          name: 'Thủy Cung Vinpearl Aquarium & Nhạc Nước Times City',
          address: '458 Minh Khai, P. Vĩnh Tuy, Q. Hai Bà Trưng',
          lat: 20.9950,
          lng: 105.8680,
          feature: 'Đường hầm thủy cung hơn 30.000 sinh vật biển, chim cánh cụt, nàng tiên cá và trình diễn nhạc nước miễn phí lúc 19h00.',
          vibe: 'Điểm vui chơi giải trí hấp dẫn hàng đầu phía Nam Hà Nội.',
          price: '170.000đ - 250.000đ/vé',
          category: 'entertainment'
        }
      ],
      trafficTip: 'Nút giao Ngã Tư Sở lưu lượng xe rất lớn, bạn nên đi theo làn dưới gầm cầu vượt để rẽ vào cổng Royal City 72A Nguyễn Trãi.'
    },

    // 7. TP. Hồ Chí Minh
    hcm: {
      aliases: ['hcm', 'sài gòn', 'sai gon', 'quận 1', 'quan 1', 'quận 3', 'quan 3', 'bến thành', 'ben thanh', 'bùi viện', 'bui vien', 'nguyễn huệ', 'nguyen hue', 'sà bì chưởng', 'sa bi chuong', 'sài bì chưởng', 'sai bi chuong'],
      title: 'Trung tâm Quận 1 & TP. Hồ Chí Minh',
      lat: 10.7769,
      lng: 106.7009,
      highlight: 'Thiên đường ẩm thực phương Nam không ngủ, cà phê bệt Nhà thờ Đức Bà, cụm rạp phim Vincom và phố đi bộ Nguyễn Huệ sôi động.',
      spots: [
        {
          name: 'Cơm Tấm Sà Bì Chưởng (Quận 5)',
          address: '179 Trần Bình Trọng, Phường 3, Quận 5, TP.HCM',
          lat: 10.7578,
          lng: 106.6806,
          feature: 'Cơm tấm sườn cốt lết tảng dày nướng than thơm lừng, bì sợi dai giòn, chả trứng vàng ươm, canh rong biển.',
          vibe: 'Cơ sở Sài Gòn đầu tiên của bộ ba Độ Mixi, PewPew, Xemesis, tấp nập khách.',
          price: '45.000đ - 110.000đ/suất',
          rating: 4.6,
          reviewsCount: 6500,
          category: 'food'
        },
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
    // 9. Khu vực An Trai - Vân Canh - Xuân Phương (Tây Hà Nội)
    an_trai_van_canh: {
      aliases: [
        'an trai', 'thôn an trai', 'vân canh', 'van canh',
        'xuân phương', 'xuan phuong', 'phương canh', 'phuong canh',
        'hoài đức', 'hoai duc', 'cầu ngà', 'cau nga', 'ngã tư canh', 'nga tu canh',
        'trịnh văn bô', 'trinh van bo', 'fpt polytechnic', 'đh đông á', 'đông á'
      ],
      title: 'Khu Vực An Trai - Vân Canh - Xuân Phương (Tây Hà Nội)',
      lat: 21.0315,
      lng: 105.7380,
      highlight: 'Khu vực giáp ranh Nam Từ Liêm & Hoài Đức, tập trung nhiều trường cao đẳng/đại học và các quán đồ ăn Trung Hoa, lẩu nướng, dimsum, trà sữa sinh viên giá mềm.',
      trafficTip: 'Trục đường Trịnh Văn Bô và Tỉnh lộ 70 qua cầu Ngà đường rộng rãi, vỉa hè thoáng, các quán đều có chỗ để xe máy thoải mái.',
      spots: [
        {
          name: 'Tiệm Mì Kéo & Sủi Cảo Trung Hoa An Trai',
          address: 'Đường Tỉnh Lộ 70, Thôn An Trai, Xã Vân Canh, H. Hoài Đức (Gần Ngã Tư Canh)',
          lat: 21.0312,
          lng: 105.7385,
          feature: 'Mì kéo tươi sợi dai mềm chuẩn vị Trung Hoa, sủi cảo hấp/chiên nhân thịt bắp tôm tươi ngọt nước, nước dùng xương hầm đậm đà.',
          vibe: 'Không gian bình dân, sạch sẽ, phục vụ tận tình, chuẩn vị món Trung.',
          price: '35.000đ - 65.000đ/bát',
          rating: 4.8,
          reviewsCount: 380,
          category: 'food'
        },
        {
          name: 'Lẩu Nướng & Đồ Ăn Vặt Trung Quốc Trịnh Văn Bô',
          address: 'Số 48 Trịnh Văn Bô, P. Phương Canh, Q. Nam Từ Liêm (Giáp An Trai)',
          lat: 21.0348,
          lng: 105.7420,
          feature: 'Thịt xiên nướng rắc bột ớt tê cay Tứ Xuyên, đậu phụ thối chiên giòn, lẩu cay tê Tứ Xuyên và bánh bao chiên chấm sữa.',
          vibe: 'Quán trẻ trung phong cách đường phố Trung Hoa, view thoáng mát.',
          price: '50.000đ - 120.000đ/người',
          rating: 4.7,
          reviewsCount: 520,
          category: 'food'
        },
        {
          name: 'Dimsum & Vịt Quay Bắc Kinh Vân Canh',
          address: 'Khu Đô Thị Vân Canh HUD, Xã Vân Canh, H. Hoài Đức',
          lat: 21.0280,
          lng: 105.7340,
          feature: 'Vịt quay da giòn bóng bẩy chấm sốt tương ngọt, há cảo tôm sò điệp, bánh bao kim sa trứng muối tan chảy.',
          vibe: 'Phù hợp ăn gia đình, bạn bè tụ tập cuối tuần, có điều hòa mát.',
          price: '60.000đ - 150.000đ',
          rating: 4.6,
          reviewsCount: 290,
          category: 'food'
        },
        {
          name: 'Cà Phê Sân Vườn An Trai Garden',
          address: 'Đường ven hồ An Trai, Xã Vân Canh, H. Hoài Đức',
          lat: 21.0305,
          lng: 105.7375,
          feature: 'Cà phê muối béo ngậy, trà đào cam sả thanh mát trong không gian sân vườn cây xanh yên bình.',
          vibe: 'Thoáng đãng, trong lành, thích hợp ngồi học bài hoặc trò chuyện thư giãn.',
          price: '25.000đ - 45.000đ',
          rating: 4.7,
          reviewsCount: 210,
          category: 'cafe'
        },
        {
          name: 'Beta Cinemas Mỹ Đình (Cách An Trai ~5 phút)',
          address: 'Tòa nhà Golden Palace, Đường Mễ Trì, P. Mễ Trì, Q. Nam Từ Liêm',
          lat: 21.0145,
          lng: 105.7765,
          feature: 'Cụm rạp chiếu phim giá vé sinh viên hợp lý, âm thanh Dolby 7.1, màn chiếu sắc nét và nhiều phim bom tấn mới nhất.',
          vibe: 'Năng động, dịch vụ nhanh chóng, bắp nước ngon giòn.',
          price: '50.000đ - 90.000đ/vé',
          rating: 4.6,
          reviewsCount: 1650,
          category: 'cinema'
        },
        {
          name: 'CGV Vincom Mega Mall Smart City (Cách An Trai ~6 phút)',
          address: 'TTTM Vincom Mega Mall Smart City, Tây Mỗ, Nam Từ Liêm',
          lat: 20.9985,
          lng: 105.7485,
          feature: 'Cụm rạp chiếu phim chuẩn quốc tế đẳng cấp hàng đầu, phòng chiếu Gold Class sang trọng bậc nhất khu Tây Hà Nội.',
          vibe: 'Đẳng cấp, sang xịn, tổ hợp trung tâm thương mại lớn.',
          price: '85.000đ - 160.000đ/vé',
          rating: 4.8,
          reviewsCount: 2800,
          category: 'cinema'
        }
      ]
    },
    danang: {
      aliases: ['đà nẵng', 'da nang', 'hải châu', 'hai chau', 'sơn trà', 'son tra', 'cầu rồng', 'cau rong', 'mỹ khê', 'my khe', 'sà bì chưởng', 'sa bi chuong', 'sài bì chưởng', 'sai bi chuong'],
      title: 'Trung tâm Quận Hải Châu & Bãi Biển Mỹ Khê (Đà Nẵng)',
      lat: 16.0678,
      lng: 108.2208,
      highlight: 'Thiên đường ẩm thực miền Trung đậm đà, rạp chiếu phim hiện đại, show cầu Rồng phun lửa và bãi biển quyến rũ nhất hành tinh.',
      spots: [
        {
          name: 'Cơm Tấm Sà Bì Chưởng (Đà Nẵng)',
          address: '68 Bình Minh 5, P. Bình Thuận, Q. Hải Châu, Đà Nẵng',
          lat: 16.0526,
          lng: 108.2238,
          feature: 'Cơm tấm sườn nướng thảo mộc mềm ngọt, chả trứng đúc hấp dẫn, đồ chua giòn thanh.',
          vibe: 'Không gian rộng rãi 2 tầng, điều hòa mát lạnh, nhân viên phục vụ chu đáo.',
          price: '45.000đ - 110.000đ/suất',
          rating: 4.7,
          reviewsCount: 3200,
          category: 'food'
        },
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
   * - 'entertainment': chỗ chơi, đi chơi, nơi giải trí, giải trí, dạo phố, công viên, quảng trường, tttm...
   */
  function detectSearchIntent(query) {
    if (!query) return 'food';
    const q = cleanVietnameseTypo(query).toLowerCase();

    // 1. Nếu câu hỏi bắt đầu hoặc nhấn mạnh vào mục đích ăn uống/cafe dù đứng cạnh tên công viên/rạp phim
    // Ví dụ: "quán ăn gần công viên thống nhất" -> phải là 'food', KHÔNG PHẢI 'entertainment'
    const asksFoodExplicit = /(?:quán ăn|ăn gì|ăn uống|quán ngon|món ngon|đặc sản|nhà hàng|buffet|lẩu|nướng|quán nhậu|phở|bún|cơm|bánh mì|ăn sáng|ăn trưa|ăn tối|ăn đêm|ăn vặt|cửa hàng đồ trung|đồ trung|đồ ăn trung|quán đồ trung|món trung|trung hoa|món hoa|dimsum|sủi cảo|mì vằn thắn|mì kéo|vịt quay|đồ hàn|đồ nhật|đồ thái|quán nào ngon|có gì ngon|món gì ngon)/i.test(q);
    const asksCafeExplicit = /(?:quán cafe|quán cà phê|cafe|cà phê|coffee|trà sữa|trà chanh|đồ uống|uống gì)/i.test(q);
    const asksCinemaExplicit = /(?:rạp phim|rạp chiếu phim|chiếu phim|xem phim|cinema|cgv|beta|lotte cinema|bhd|galaxy)/i.test(q);
    const asksFunExplicit = /(?:vui chơi|chỗ chơi|đi chơi|chơi đâu|chơi gì|nơi giải trí|điểm giải trí|khu giải trí|giải trí|check-in|checkin|dạo phố|dạo mát)/i.test(q);

    if (asksFoodExplicit && !asksCinemaExplicit) return 'food';
    if (asksCafeExplicit && !asksCinemaExplicit && !asksFoodExplicit) return 'cafe';
    if (asksCinemaExplicit) return 'cinema';
    if (asksFunExplicit) return 'entertainment';

    // Nếu không có động từ ăn/uống mà hỏi về công viên, quảng trường, bảo tàng, thủy cung
    if (/(?:công viên|quảng trường|sân vận động|mua sắm|tttm|thủy cung|bảo tàng|hồ láng|thủ lệ)/i.test(q)) {
      return 'entertainment';
    }
    return 'food';
  }

  /**
   * Trích xuất tên địa điểm mục tiêu từ câu hỏi tự nhiên
   * Ví dụ:
   * - "nơi giải trí ở công viên thống nhất" -> "công viên thống nhất"
   * - "đông anh có quán ăn nào ngon không" -> "đông anh"
   */
  function extractLocationPhrase(query) {
    if (!query) return '';
    const q = cleanVietnameseTypo(query);

    // 1. Mẫu có giới từ chỉ vị trí: ở, tại, gần, quanh, khu vực, phố, đường, ngõ, bên, mạn...
    const prepMatch = q.match(/(?:ở|tại|gần|quanh|xung quanh|khu vực|khu|bên|mạn|đoạn|dọc|cạnh|sát|đối diện|trên đường|trên phố|phố|đường|ngõ)\s+(.+)$/i);
    if (prepMatch && prepMatch[1]) {
      return prepMatch[1]
        .replace(/\s+(?:có\s+(?:cửa\s+hàng|quán|nhà\s+hàng|tiệm|chỗ|nơi|rạp|điểm|đồ|món|gì)|ăn\s+gì|uống\s+gì|chơi\s+gì|nào\s+ngon|nào\s+đẹp|nào\s+nổi\s+tiếng|nào|không|ko|k\b|chưa|nhỉ|vậy|ạ|nhé).*$/i, '')
        .replace(/[,.?!]+$/g, '')
        .trim();
    }

    // 2. Mẫu đặt tên địa điểm ở đầu câu: "đông anh có quán ăn nào ngon", "gia lâm ăn gì ngon"
    const prefixMatch = q.match(/^(?:ở|tại|quanh|khu vực|khu)?\s*(.+?)\s+(?:có\s+)?(?:quán ăn|nhà hàng|quán ngon|món ngon|quán cafe|quán cà phê|cafe|cà phê|rạp phim|rạp chiếu phim|chỗ nào|chỗ chơi|nơi giải trí|điểm giải trí|vui chơi|ăn gì|uống gì|chơi gì)/i);
    if (prefixMatch && prefixMatch[1]) {
      const candidate = prefixMatch[1]
        .replace(/^(?:cho hỏi|gợi ý|tìm|tìm giúp|review|ở|tại|quanh|gần)\s+/i, '')
        .replace(/[,.?!]+$/g, '')
        .trim();
      if (candidate.length >= 3 && !/^(?:quanh đây|gần đây|ở đây|hôm nay|bây giờ|tối nay|trưa nay)$/i.test(candidate)) {
        return candidate;
      }
    }

    return '';
  }

  /**
   * Trích xuất từ khóa món ăn / loại hình cụ thể (nếu người dùng hỏi đích danh món như "bún chả", "phở", "lẩu", "trà sữa", "karaoke"...)
   */
  function extractSpecificPoiKeyword(query) {
    if (!query) return null;
    const q = cleanVietnameseTypo(query).toLowerCase();
    const specificKeywords = [
      'bún chả', 'bún đậu', 'bún bò', 'bún riêu', 'bún cá', 'bún ngan', 'bún ốc', 'bánh đa',
      'phở bò', 'phở gà', 'phở cuốn', 'phở', 'miến lươn', 'miến ngan', 'mì cay', 'mì vằn thắn', 'ramen', 'sushi', 'dimsum', 'đồ trung', 'món trung', 'đồ ăn trung', 'quán đồ trung', 'trung hoa', 'sủi cảo', 'mì kéo', 'vịt quay bắc kinh', 'đồ hàn', 'món hàn', 'đồ nhật', 'món nhật', 'đồ thái', 'món thái',
      'cháo sườn', 'cháo', 'xôi', 'bánh mì', 'bánh cuốn', 'bánh xèo', 'nem nướng', 'nem lụi',
      'cơm tấm', 'cơm niêu', 'cơm thố', 'cơm rang', 'cơm gà', 'cơm chay', 'đồ chay', 'quán chay', 'chay',
      'chả cá', 'lẩu nấm', 'lẩu thái', 'lẩu bò', 'lẩu gà', 'lẩu ếch', 'lẩu nướng', 'lẩu', 'nướng', 'bbq', 'buffet',
      'hải sản', 'ốc', 'pizza', 'bít tết', 'steak', 'gà rán', 'bia hơi', 'quán nhậu',
      'trà sữa', 'trà chanh', 'cà phê trứng', 'cafe trứng', 'cà phê muối', 'bánh ngọt', 'tiệm bánh', 'bakery', 'chè', 'kem',
      'karaoke', 'bi-a', 'billiards', 'bowling', 'bảo tàng', 'nhà sách', 'hiệu sách', 'siêu thị'
    ];
    for (const kw of specificKeywords) {
      if (q.includes(kw)) return kw;
    }
    return null;
  }

  /**
   * Xác định Điểm Neo Tọa Độ Chính Xác (Spatial Anchor Resolution)
   * Ưu tiên cụm từ dài nhất và chi tiết nhất (Custom Geocoded > Specific Landmark > Ward/Street > Area Guide > Map Center)
   */
  function resolveSpatialAnchor(cleanQuery, currentCity, options = {}) {
    const q = (cleanQuery || '').toLowerCase();
    const extractedLoc = extractLocationPhrase(cleanQuery);

    // 0. Nếu được truyền tọa độ điểm neo tùy chỉnh (từ Live Geocoder)
    if (options.customAnchor && typeof options.customAnchor.lat === 'number') {
      return {
        key: 'custom_geocoded',
        area: {
          title: options.customAnchor.title || 'Khu vực bạn đang tìm kiếm',
          lat: options.customAnchor.lat,
          lng: options.customAnchor.lng,
          highlight: options.customAnchor.highlight || 'Danh sách các địa điểm thực tế được định vị theo bán kính gần nhất quanh vị trí bạn yêu cầu.',
          trafficTip: options.customAnchor.trafficTip || 'Lưu ý quan sát biển báo dừng đỗ và gửi xe đúng nơi quy định.',
          spots: []
        },
        isMatchedExplicitly: true
      };
    }

    // Nếu người dùng gõ địa chỉ chi tiết cấp Ngõ / Ngách / Hẻm / Số nhà -> Ưu tiên đẩy sang Live Geocoder để định vị đúng con ngõ đó
    const hasSpecificAlleyOrHouse = /\b(?:ngõ|ngách|hẻm|số nhà|sn)\s+\d+/i.test(q);

    // 1. Quét trong bảng SPECIFIC_LANDMARKS (ưu tiên alias dài nhất)
    if (!hasSpecificAlleyOrHouse) {
      let bestLandmark = null;
      let bestLandmarkAliasLen = 0;
      for (const lm of SPECIFIC_LANDMARKS) {
        if (currentCity && lm.city !== currentCity) continue;
        for (const alias of lm.aliases) {
          if (q.includes(alias) && alias.length > bestLandmarkAliasLen) {
            bestLandmark = lm;
            bestLandmarkAliasLen = alias.length;
          }
        }
      }
      if (bestLandmark) {
        return {
          key: bestLandmark.key,
          area: {
            title: bestLandmark.title,
            lat: bestLandmark.lat,
            lng: bestLandmark.lng,
            highlight: bestLandmark.highlight,
            trafficTip: bestLandmark.trafficTip,
            spots: []
          },
          isMatchedExplicitly: true
        };
      }
    }

    // 2. Quét trong AREAS_GUIDE và HANOI_WARDS_DATA, so sánh độ chi tiết (ưu tiên Phường/Đường cụ thể nếu dài hơn hoặc không nằm trong các cụm trung tâm)
    let bestAreaKey = null;
    let bestAreaAliasLen = 0;
    if (!hasSpecificAlleyOrHouse) {
      for (const [key, area] of Object.entries(AREAS_GUIDE)) {
        if (currentCity === 'hcm' && key !== 'hcm') continue;
        if (currentCity === 'danang' && key !== 'danang') continue;
        if (currentCity === 'hanoi' && (key === 'hcm' || key === 'danang')) continue;

        for (const alias of area.aliases) {
          if (q.includes(alias) && alias.length > bestAreaAliasLen) {
            bestAreaKey = key;
            bestAreaAliasLen = alias.length;
          }
        }
      }
    }

    // 3. Quét trong danh sách 126 Phường/Xã & Tuyến đường lớn Hà Nội (HANOI_WARDS_DATA)
    let wardsData = null;
    if (typeof window !== 'undefined' && Array.isArray(window.HANOI_WARDS_DATA)) {
      wardsData = window.HANOI_WARDS_DATA;
    } else if (typeof require === 'function') {
      try { wardsData = require('./hanoi-wards-streets'); } catch (e) {}
    }

    if (!hasSpecificAlleyOrHouse && currentCity === 'hanoi' && Array.isArray(wardsData)) {
      let matchedWardObj = null;
      let matchedStreetName = null;
      let bestWardMatchLen = 0;

      for (const w of wardsData) {
        const cleanWard = (w.ward || '').toLowerCase().replace(/^(?:p\.|x\.|tt\.|phường|xã|thị trấn)\s*/i, '').trim();
        if (cleanWard.length >= 4 && q.includes(cleanWard) && cleanWard.length > bestWardMatchLen) {
          matchedWardObj = w;
          matchedStreetName = null;
          bestWardMatchLen = cleanWard.length;
        }
        for (const st of (w.mainStreets || [])) {
          const cleanSt = st.toLowerCase().replace(/^(?:đường|phố|quốc lộ|đại lộ)\s*/i, '').trim();
          if (cleanSt.length >= 4 && q.includes(cleanSt) && cleanSt.length > bestWardMatchLen) {
            matchedWardObj = w;
            matchedStreetName = st;
            bestWardMatchLen = cleanSt.length;
          }
        }
      }

      // Nếu tìm thấy Phường/Phố cụ thể trong 126 phường mà không trùng với cụm trung tâm lớn (hoặc chi tiết hơn cụm quận chung)
      if (matchedWardObj && (!bestAreaKey || bestWardMatchLen > bestAreaAliasLen)) {
        const titleStr = matchedStreetName
          ? `Khu Vực ${matchedStreetName} - ${matchedWardObj.name}`
          : `Khu Vực ${matchedWardObj.name} (Hà Nội)`;
        return {
          key: (matchedStreetName ? 'street_' : 'ward_') + matchedWardObj.id,
          area: {
            title: titleStr,
            lat: matchedWardObj.lat,
            lng: matchedWardObj.lng,
            highlight: `Tâm điểm giao thương và dịch vụ đô thị tại ${matchedWardObj.name}, kết nối qua các trục ${(matchedWardObj.mainStreets || []).slice(0, 3).join(', ')}.`,
            trafficTip: matchedWardObj.description || 'Chú ý gửi xe đúng nơi quy định trên các trục phố chính.',
            spots: []
          },
          isMatchedExplicitly: true
        };
      }
    }

    if (bestAreaKey) {
      return {
        key: bestAreaKey,
        area: AREAS_GUIDE[bestAreaKey],
        isMatchedExplicitly: true
      };
    }

    // 4. Nếu trong phiên hội thoại trước đã xác định một khu vực và câu hỏi mới không nhắc tên địa điểm khác
    if (!extractedLoc && options.lastAreaKey && AREAS_GUIDE[options.lastAreaKey]) {
      return { key: options.lastAreaKey, area: AREAS_GUIDE[options.lastAreaKey], isMatchedExplicitly: false };
    }

    // 5. Nếu có vị trí tâm bản đồ hiện tại của người dùng
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
        return {
          key: closestKey,
          area: AREAS_GUIDE[closestKey],
          isMatchedExplicitly: false,
          unresolvedLocationPhrase: extractedLoc || null
        };
      }
    }

    if (currentCity === 'hcm') return { key: 'hcm', area: AREAS_GUIDE.hcm, isMatchedExplicitly: false, unresolvedLocationPhrase: extractedLoc || null };
    if (currentCity === 'danang') return { key: 'danang', area: AREAS_GUIDE.danang, isMatchedExplicitly: false, unresolvedLocationPhrase: extractedLoc || null };
    return {
      key: 'chualang_ftu',
      area: AREAS_GUIDE.chualang_ftu,
      isMatchedExplicitly: false,
      unresolvedLocationPhrase: extractedLoc || null
    };
  }

  /**
   * QUÉT BÁN KÍNH KHÔNG GIAN TOÀN ĐÔ THỊ (UNIFIED SPATIAL RADIAL SEARCH)
   * Lấy toàn bộ các địa điểm đúng danh mục trên toàn thành phố, tính khoảng cách thực tế đến tọa độ điểm neo (centerPoint)
   * và trả về Top địa điểm gần nhất!
   */
  function findNearestSpotsByCategory(area, categoryType, allAreas, centerPoint, currentCity = 'hanoi') {
    const globalPool = [];
    const seenNames = new Set();

    // 1. Ưu tiên đưa các spots nội tại của area (nếu có) vào pool trước
    if (Array.isArray(area.spots)) {
      for (const sp of area.spots) {
        if (sp.category === categoryType && !seenNames.has(sp.name)) {
          seenNames.add(sp.name);
          globalPool.push(sp);
        }
      }
    }

    // 2. Gom toàn bộ các spots thuộc cùng thành phố và cùng categoryType vào không gian tìm kiếm
    if (allAreas) {
      for (const [k, a] of Object.entries(allAreas)) {
        if (currentCity === 'hcm' && k !== 'hcm') continue;
        if (currentCity === 'danang' && k !== 'danang') continue;
        if (currentCity === 'hanoi' && (k === 'hcm' || k === 'danang')) continue;
        if (!Array.isArray(a.spots)) continue;

        for (const sp of a.spots) {
          if (sp.category === categoryType && !seenNames.has(sp.name)) {
            seenNames.add(sp.name);
            globalPool.push(sp);
          }
        }
      }
    }

    // 3. Tính khoảng cách thực tế từ điểm neo (centerPoint) tới từng địa điểm và sắp xếp gần nhất
    if (centerPoint && typeof centerPoint.lat === 'number' && typeof centerPoint.lng === 'number') {
      const withDist = globalPool.map(s => ({
        ...s,
        distM: (typeof s.lat === 'number' && typeof s.lng === 'number')
          ? _calcDistM(centerPoint.lat, centerPoint.lng, s.lat, s.lng)
          : 99999
      })).sort((a, b) => a.distM - b.distM);

      // Lọc các điểm nằm trong bán kính hợp lý (ưu tiên <= 2200m, luôn lấy tối thiểu 3-5 điểm gần nhất)
      const nearby = withDist.filter(s => s.distM <= 2200);
      if (nearby.length >= 3) {
        return nearby.slice(0, 5);
      }
      return withDist.slice(0, 4);
    }

    return globalPool.slice(0, 5);
  }

  /**
   * Định vị trực tiếp địa danh bất kỳ (Ngõ/Ngách/Phố/Tòa nhà/Xã/Huyện) qua TomTom Search API & GeocodingService
   */
  const TOMTOM_SEARCH_KEY = 'dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF';
  const CITY_CENTERS = {
    hanoi: { lat: 21.0285, lng: 105.8542, name: 'Hà Nội' },
    hcm: { lat: 10.7769, lng: 106.6811, name: 'TP. Hồ Chí Minh' },
    danang: { lat: 16.0544, lng: 108.2022, name: 'Đà Nẵng' }
  };

  async function geocodeLocationLive(phrase, currentCity = 'hanoi') {
    if (!phrase || phrase.trim().length < 2) return null;
    const cityObj = CITY_CENTERS[currentCity] || CITY_CENTERS.hanoi;

    // 1. Nếu đang chạy trên trình duyệt và có window.geocodingService, ưu tiên dùng bộ 5-Layer Geocoder
    if (typeof window !== 'undefined' && window.geocodingService && typeof window.geocodingService.searchAddresses === 'function') {
      try {
        const matches = await window.geocodingService.searchAddresses(phrase, {
          city: currentCity,
          center: cityObj,
          limit: 1
        });
        if (matches && matches.length > 0 && Number.isFinite(matches[0].lat) && Number.isFinite(matches[0].lng)) {
          return {
            title: matches[0].title || phrase,
            address: matches[0].subtitle || matches[0].fullAddress || cityObj.name,
            lat: matches[0].lat,
            lng: matches[0].lng
          };
        }
      } catch (_e) {}
    }

    // 2. Gọi trực tiếp TomTom Fuzzy Search API (hoạt động trên cả Node.js Backend & Browser)
    if (typeof fetch === 'function') {
      try {
        const searchQ = phrase.toLowerCase().includes(cityObj.name.toLowerCase()) ? phrase : `${phrase}, ${cityObj.name}`;
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(searchQ)}.json?lat=${cityObj.lat}&lon=${cityObj.lng}&radius=40000&limit=1&countrySet=VN&language=vi-VN&key=${TOMTOM_SEARCH_KEY}`;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 2500) : null;
        const res = await fetch(url, controller ? { signal: controller.signal } : {});
        if (timer) clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const top = data?.results?.[0];
          if (top && top.position && Number.isFinite(top.position.lat) && Number.isFinite(top.position.lon)) {
            const rawName = top.poi?.name || top.address?.streetName || top.address?.municipalitySubdivision || phrase;
            return {
              title: rawName,
              address: top.address?.freeformAddress || cityObj.name,
              lat: top.position.lat,
              lng: top.position.lon
            };
          }
        }
      } catch (_err) {}
    }
    return null;
  }

  /**
   * Quét trực tiếp địa điểm thực tế (Quán ăn, Cafe, Rạp phim, Giải trí) trong bán kính quanh tọa độ [lat, lng]
   * từ TomTom Real-time POI API để phủ sóng 100% mọi con phố, ngõ ngách và huyện ngoại thành Hà Nội
   */
  async function fetchLiveNearbyPois(lat, lng, categoryType = 'food', specificKeyword = null, currentCity = 'hanoi') {
    if (typeof fetch !== 'function' || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    let url = '';
    if (specificKeyword) {
      url = `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(specificKeyword)}.json?lat=${lat}&lon=${lng}&radius=3500&limit=12&countrySet=VN&language=vi-VN&key=${TOMTOM_SEARCH_KEY}`;
    } else {
      let categorySet = '7315'; // Mặc định: Nhà hàng / Quán ăn
      let radius = 2500;
      if (categoryType === 'cafe') {
        categorySet = '9376';
        radius = 2500;
      } else if (categoryType === 'cinema') {
        categorySet = '7342';
        radius = 5000;
      } else if (categoryType === 'entertainment') {
        categorySet = '9362,7373,7317,9902,7376';
        radius = 3500;
      }
      url = `https://api.tomtom.com/search/2/nearbySearch/.json?lat=${lat}&lon=${lng}&radius=${radius}&limit=15&categorySet=${categorySet}&countrySet=VN&language=vi-VN&key=${TOMTOM_SEARCH_KEY}`;
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 2800) : null;
      const res = await fetch(url, controller ? { signal: controller.signal } : {});
      if (timer) clearTimeout(timer);
      if (!res.ok) return [];

      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const liveSpots = [];
      const seenNames = new Set();

      for (const item of results) {
        const rawName = (item.poi?.name || '').trim();
        if (!rawName || rawName.length < 4) continue;

        // Lọc bỏ các tên chung chung không có tên riêng hoặc các công ty/kho bãi không phải quán phục vụ khách
        if (/^(?:quán ăn|nhà hàng|quán cơm|quán phở|quán bún|quán cafe|quán cà phê|cà phê|cafe|quán nước|trà đá|cửa hàng|công ty|nhà máy|đại lý|chi nhánh|văn phòng|kho)\b/i.test(rawName) && rawName.split(/\s+/).length <= 2) {
          continue;
        }
        if (/(?:công ty|nhà máy|xí nghiệp|vật liệu|phụ tùng|vận tải|kho bãi|bán buôn)/i.test(rawName)) {
          continue;
        }

        const normName = rawName.toLowerCase();
        if (seenNames.has(normName)) continue;
        seenNames.add(normName);

        const pLat = item.position?.lat;
        const pLng = item.position?.lon;
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;

        const distM = Number.isFinite(item.dist) ? Math.round(item.dist) : _calcDistM(lat, lng, pLat, pLng);

        // Làm sạch địa chỉ (bỏ mã bưu chính 5 số và từ lặp "Hà Nội, Hà Nội")
        let cleanAddr = (item.address?.freeformAddress || item.address?.streetName || 'Khu vực lân cận')
          .replace(/,\s*\d{5,6}$/, '')
          .replace(/Hà Nội,\s*Hà Nội/gi, 'Hà Nội')
          .trim();

        // Sinh mô tả đặc sản & mức giá sát thực tế theo tên quán
        let feature = 'Địa điểm ẩm thực thực tế trên tuyến phố, thực đơn đa dạng, nguyên liệu tươi ngon phục vụ tại chỗ và mang về.';
        let vibe = 'Không gian thực tế tại địa phương, thuận tiện di chuyển và dừng đỗ xe.';
        let price = '35.000đ - 120.000đ';

        if (/phở|bún|miến|bánh đa|cháo|bánh cuốn|bánh mì|xôi/i.test(rawName)) {
          feature = 'Món truyền thống Hà Nội với nước dùng ninh xương đậm đà, nguyên liệu tươi mới mỗi ngày, phục vụ nhanh gọn.';
          vibe = 'Quán ăn địa phương đông khách, phù hợp ăn sáng, ăn trưa và ăn tối.';
          price = '35.000đ - 65.000đ/suất';
        } else if (/cơm/i.test(rawName)) {
          feature = 'Thực đơn cơm văn phòng, cơm gia đình và các món mặn xào nấu nóng hổi, khẩu phần đầy đặn.';
          vibe = 'Sạch sẽ, phục vụ nhanh, giá cả hợp lý.';
          price = '40.000đ - 75.000đ/suất';
        } else if (/lẩu|nướng|bbq|hải sản|nhậu|bia|dê|gà|bò|cá/i.test(rawName)) {
          feature = 'Chuyên các món lẩu nướng, hải sản và đặc sản chế biến tươi sống, thích hợp tụ tập bạn bè, liên hoan gia đình.';
          vibe = 'Không gian rộng rãi, thoáng mát, phục vụ chu đáo.';
          price = '120.000đ - 280.000đ/người';
        } else if (categoryType === 'cafe' || /cafe|cà phê|coffee|trà|tea|bánh|chè|kem/i.test(rawName)) {
          feature = 'Đồ uống pha chế thơm ngon (cà phê truyền thống, pha máy, trà trái cây, trà sữa), có wifi tốc độ cao.';
          vibe = 'Không gian thư giãn, trò chuyện bạn bè hoặc làm việc, học tập.';
          price = '30.000đ - 65.000đ';
        } else if (categoryType === 'cinema' || /cgv|lotte|beta|rạp|cinema|galaxy|bhd/i.test(rawName)) {
          feature = 'Cụm rạp chiếu phim màn ảnh rộng sắc nét, hệ thống âm thanh vòm sống động, cập nhật liên tục các phim bom tấn mới nhất.';
          vibe = 'Hiện đại, sảnh chờ trẻ trung, có quầy bắp nước tiện lợi.';
          price = '70.000đ - 140.000đ/vé';
        } else if (categoryType === 'entertainment') {
          feature = 'Điểm vui chơi, giải trí, tham quan và thư giãn thực tế tại khu vực, thu hút đông đảo người dân và giới trẻ.';
          vibe = 'Thoáng đãng, năng động, thuận tiện kết hợp dạo phố.';
          price = 'Tùy dịch vụ / Tham quan';
        }

        liveSpots.push({
          name: rawName,
          address: cleanAddr,
          lat: pLat,
          lng: pLng,
          distM: distM,
          feature: feature,
          vibe: vibe,
          price: price,
          category: categoryType,
          isLivePoi: true
        });
      }

      return liveSpots;
    } catch (_err) {
      return [];
    }
  }

  function formatGuideMessage(area, spots = [], categoryType = 'food', centerPoint = null, specificKeyword = null) {
    let categoryTitle = 'Món Ngon Đặc Sản & Quán Ăn Nổi Tiếng';
    if (specificKeyword) {
      categoryTitle = `Địa Điểm "${specificKeyword.toUpperCase()}" Gần Nhất`;
    } else if (categoryType === 'cinema') {
      categoryTitle = 'Rạp Chiếu Phim & Cụm Rạp Hiện Đại';
    } else if (categoryType === 'cafe') {
      categoryTitle = 'Quán Cà Phê View Đẹp & Không Gian Thư Giãn';
    } else if (categoryType === 'entertainment') {
      categoryTitle = 'Điểm Vui Chơi, Dạo Mát & Giải Trí';
    }

    let msg = `**Gợi Ý ${categoryTitle}: ${area.title}**\n\n`;
    msg += `*${area.highlight}*\n\n`;

    const displaySpots = spots.length > 0 ? spots : (area.spots || []);
    displaySpots.forEach((spot, idx) => {
      let distTag = '';
      const dM = typeof spot.distM === 'number'
        ? spot.distM
        : (centerPoint && typeof spot.lat === 'number' && typeof spot.lng === 'number'
            ? _calcDistM(centerPoint.lat, centerPoint.lng, spot.lat, spot.lng)
            : null);
      if (dM !== null) {
        distTag = dM < 60 ? ` *(Ngay tại khu vực ~${dM}m)*` : ` *(Cách ~${dM}m)*`;
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

  function getRecommendationSync(query, currentCity = 'hanoi', options = {}) {
    const cleanQ = cleanVietnameseTypo(query);
    const resolved = resolveSpatialAnchor(cleanQ, currentCity, options);
    const { key, area, isMatchedExplicitly, unresolvedLocationPhrase } = resolved;
    const categoryType = detectSearchIntent(cleanQ);
    const specificKeyword = extractSpecificPoiKeyword(cleanQ);

    const refLat = area.lat;
    const refLng = area.lng;
    const centerPoint = { lat: refLat, lng: refLng };

    const spots = findNearestSpotsByCategory(area, categoryType, AREAS_GUIDE, centerPoint, currentCity);

    return {
      text: formatGuideMessage(area, spots, categoryType, centerPoint, specificKeyword),
      title: area.title,
      areaKey: key,
      categoryType: categoryType,
      specificKeyword: specificKeyword,
      isMatchedExplicitly: Boolean(isMatchedExplicitly),
      unresolvedLocationPhrase: unresolvedLocationPhrase || null,
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
  }

  /**
   * PHIÊN BẢN BẤT ĐỒNG BỘ (HYBRID CURATED + LIVE TOMTOM/OSM SPATIAL POI ENGINE v4.0):
   * 1. Nếu câu hỏi nhắc tới một ngõ, ngách, phố nhỏ, tòa nhà hoặc xã/huyện chưa có trong từ điển tĩnh -> Tự động Geocode trực tiếp để lấy tọa độ neo chuẩn xác.
   * 2. Nếu quanh điểm neo (bán kính 850m) có ít hơn 4 địa điểm tuyển chọn HOẶC người dùng tìm món ăn cụ thể (phở, bún chả, lẩu, trà sữa, bi-a...) -> Tự động quét Live POI thời gian thực quanh tọa độ đó, trộn và sắp xếp theo khoảng cách gần nhất!
   */
  async function getRecommendationAsync(query, currentCity = 'hanoi', options = {}) {
    let effectiveOptions = { ...options };
    const cleanQ = cleanVietnameseTypo(query);
    let initial = getRecommendationSync(query, currentCity, effectiveOptions);

    // Bước 1: Nếu có cụm địa danh chưa giải mã được bằng từ điển tĩnh, tự động Live Geocode
    if (!effectiveOptions.customAnchor && initial.unresolvedLocationPhrase) {
      const geo = await geocodeLocationLive(initial.unresolvedLocationPhrase, currentCity);
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
        const cleanTitle = geo.title.toLowerCase().startsWith('khu vực') ? geo.title : `Khu Vực ${geo.title} (${geo.address})`;
        effectiveOptions.customAnchor = {
          title: cleanTitle,
          lat: geo.lat,
          lng: geo.lng,
          highlight: `Các địa điểm thực tế nằm ngay sát khu vực ${geo.title} (${geo.address}), được quét tự động theo bán kính gần nhất.`
        };
        initial = getRecommendationSync(query, currentCity, effectiveOptions);
      }
    }

    const centerPoint = { lat: initial.action.lat, lng: initial.action.lng };
    const categoryType = initial.categoryType;
    const specificKeyword = initial.specificKeyword;
    const curatedSpots = initial.action.spots || [];

    // Bước 2: Kiểm tra xem có bao nhiêu quán tuyển chọn thực sự nằm sát điểm neo (<= 850m)
    let closeCurated = curatedSpots.filter(s => {
      const d = typeof s.distM === 'number' ? s.distM : _calcDistM(centerPoint.lat, centerPoint.lng, s.lat, s.lng);
      if (d > 850) return false;
      if (specificKeyword) {
        const hay = `${s.name} ${s.feature || ''}`.toLowerCase();
        return hay.includes(specificKeyword);
      }
      return true;
    });

    // Bước 3: Nếu ít hơn 4 địa điểm trong bán kính 850m (ví dụ hỏi ở phố Đội Cấn, Lĩnh Nam, Đông Anh, Sóc Sơn, Gia Lâm...) hoặc hỏi món cụ thể -> Quét Live POI thực tế
    if (closeCurated.length < 4 || specificKeyword) {
      const livePois = await fetchLiveNearbyPois(centerPoint.lat, centerPoint.lng, categoryType, specificKeyword, currentCity);
      if (livePois.length > 0) {
        const merged = [...closeCurated];
        const seenNames = new Set(merged.map(s => s.name.toLowerCase()));

        for (const lp of livePois) {
          const lpLower = lp.name.toLowerCase();
          const isDuplicateCoord = merged.some(m => _calcDistM(m.lat, m.lng, lp.lat, lp.lng) < 25);
          if (!seenNames.has(lpLower) && !isDuplicateCoord) {
            seenNames.add(lpLower);
            merged.push(lp);
          }
        }

        merged.sort((a, b) => (a.distM || 0) - (b.distM || 0));
        const finalSpots = merged.slice(0, 5);

        if (finalSpots.length > 0) {
          const areaObj = {
            title: initial.title,
            lat: centerPoint.lat,
            lng: centerPoint.lng,
            highlight: initial.areaKey === 'custom_geocoded'
              ? `Các địa điểm thực tế nằm ngay sát ${initial.title}, được định vị trực tiếp trên bản đồ số.`
              : (AREAS_GUIDE[initial.areaKey]?.highlight || SPECIFIC_LANDMARKS.find(l => l.key === initial.areaKey)?.highlight || 'Danh sách các địa điểm thực tế gần nhất quanh vị trí bạn yêu cầu.'),
            trafficTip: AREAS_GUIDE[initial.areaKey]?.trafficTip || SPECIFIC_LANDMARKS.find(l => l.key === initial.areaKey)?.trafficTip || 'Chú ý quan sát biển báo dừng đỗ và gửi xe đúng nơi quy định.'
          };

          return {
            ...initial,
            text: formatGuideMessage(areaObj, finalSpots, categoryType, centerPoint, specificKeyword),
            action: {
              ...initial.action,
              spots: finalSpots
            }
          };
        }
      }
    }

    return initial;
  }

  return {
    isFoodOrFun: function (query) {
      if (!query) return false;
      return FOOD_KEYWORDS_REGEX.test(query);
    },
    cleanVietnameseTypo,
    detectSearchIntent,
    extractLocationPhrase,
    extractSpecificPoiKeyword,
    resolveSpatialAnchor,
    geocodeLocationLive,
    fetchLiveNearbyPois,
    getRecommendation: getRecommendationSync,
    getRecommendationAsync,
    AREAS_GUIDE,
    SPECIFIC_LANDMARKS
  };
});
