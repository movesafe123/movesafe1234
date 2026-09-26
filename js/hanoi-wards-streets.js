/**
 * MoveSafe VN - Cơ sở dữ liệu toàn diện về các Phường và Tuyến đường lớn tại Hà Nội
 * Hỗ trợ tra cứu thời tiết, rủi ro ngập lụt & phân tích giao thông đa điểm
 * Chuẩn UMD (Universal Module Definition): chạy mượt trên cả Client (Trình duyệt) và Server (Node.js)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HANOI_WARDS_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    // ==========================================
    // 1. QUẬN BẮC TỪ LIÊM (13 Phường)
    // ==========================================
    {
      id: 'hn-btl-pd',
      ward: 'P. Phú Diễn',
      name: 'Phường Phú Diễn (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0500,
      lng: 105.7620,
      isHub: true,
      mainStreets: [
        'Đường Cầu Diễn (QL32)',
        'Đường Phú Diễn',
        'Đường Hoàng Công Chất',
        'Đường Đức Diễn',
        'Đường K2',
        'Phố Ga Phú Diễn'
      ],
      trafficHotspots: ['Nút giao Ga Phú Diễn - QL32', 'Cầu Diễn hướng vào trung tâm', 'Đường sắt giao cắt Phú Diễn'],
      floodVulnerability: 'Vùng trũng cục bộ ven ngõ Hoàng Công Chất & đoạn giao sông Nhuệ khi mưa lớn',
      description: 'Cửa ngõ Tây Bắc thủ đô, tập trung Ga Phú Diễn, ĐH Tài nguyên & Môi trường, trục QL32 huyết mạch.'
    },
    {
      id: 'hn-btl-phd',
      ward: 'P. Phúc Diễn',
      name: 'Phường Phúc Diễn (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0545,
      lng: 105.7530,
      isHub: true,
      mainStreets: [
        'Đường Cầu Diễn (QL32)',
        'Đường Phúc Diễn',
        'Đường Văn Tiến Dũng',
        'Đường Đức Diễn',
        'Đường Kiều Mai'
      ],
      trafficHotspots: ['Ngã tư Cầu Diễn - Văn Tiến Dũng', 'Khu vực UBND Quận Bắc Từ Liêm'],
      floodVulnerability: 'Trục Văn Tiến Dũng và QL32 thoát nước tốt, một số ngõ ven sông Nhuệ ngập nhẹ',
      description: 'Trung tâm hành chính Quận Bắc Từ Liêm, trục Văn Tiến Dũng 8 làn xe kết nối sang Tây Tựu.'
    },
    {
      id: 'hn-btl-tt',
      ward: 'P. Tây Tựu',
      name: 'Phường Tây Tựu (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0620,
      lng: 105.7280,
      isHub: true,
      mainStreets: [
        'Đường Tây Tựu (ĐT70A)',
        'Đường Trung Tựu',
        'Đường Yên Nội',
        'Đường Thượng Cát',
        'Đường Đỗ Nhuận kéo dài'
      ],
      trafficHotspots: ['Ngã ba ĐT70A giao QL32 (Cổng trường ĐH Công nghiệp)', 'Nút giao ngã 4 Tây Tựu'],
      floodVulnerability: 'Vùng bãi hoa bằng phẳng, ngập trũng cục bộ tại một số đồng trũng khi mưa xối xả',
      description: 'Làng hoa truyền thống Tây Tựu, trục ĐT70A nối Nhổn với Đan Phượng và Cầu Thăng Long.'
    },
    {
      id: 'hn-btl-mk',
      ward: 'P. Minh Khai',
      name: 'Phường Minh Khai (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0585,
      lng: 105.7390,
      isHub: true,
      mainStreets: [
        'Đường Cầu Diễn (QL32)',
        'Phố Nhổn',
        'Đường Văn Tiến Dũng',
        'Đường Ngọa Long',
        'Đường Nguyên Xá'
      ],
      trafficHotspots: ['Nút giao Ngã tư Nhổn', 'Ga Metro Nhổn - Cổng Trường ĐH Công Nghiệp Hà Nội', 'Cầu Ngà'],
      floodVulnerability: 'Khu vực cổng ĐH Công Nghiệp & đường gom ga Nhổn trũng nước khi mưa trên 30mm',
      description: 'Đầu mối giao thông phía Tây, ga đầu tuyến Đường sắt đô thị Nhổn - Ga Hà Nội, ĐH Công nghiệp Hà Nội.'
    },
    {
      id: 'hn-btl-cn1',
      ward: 'P. Cổ Nhuế 1',
      name: 'Phường Cổ Nhuế 1 (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0520,
      lng: 105.7820,
      isHub: true,
      mainStreets: [
        'Đường Phạm Văn Đồng (Vành Đai 3)',
        'Đường Cổ Nhuế',
        'Đường Trần Cung',
        'Đường Hoàng Quốc Việt kéo dài',
        'Đường Phan Bá Vành'
      ],
      trafficHotspots: ['Nút giao ngã tư Cổ Nhuế - Phạm Văn Đồng', 'Đường Trần Cung đoạn gần Bệnh viện E'],
      floodVulnerability: 'Đường Trần Cung và ngõ 145 Cổ Nhuế trũng thấp, thoát nước chậm',
      description: 'Nằm trên trục Vành Đai 3 trên cao, kết nối Cầu Giấy và Bắc Từ Liêm, giáp Học viện Cảnh sát & Bệnh viện E.'
    },
    {
      id: 'hn-btl-cn2',
      ward: 'P. Cổ Nhuế 2',
      name: 'Phường Cổ Nhuế 2 (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0720,
      lng: 105.7720,
      isHub: true,
      mainStreets: [
        'Đường Cổ Nhuế',
        'Đường Tăng Thiết Giáp',
        'Đường Đức Thắng',
        'Phố Viên',
        'Đường KĐT Resco'
      ],
      trafficHotspots: ['Đường Tăng Thiết Giáp giờ cao điểm', 'Nút vào KĐT Resco Cổ Nhuế'],
      floodVulnerability: 'Rốn ngập Resco Cổ Nhuế (HSDC-05) khi mưa dông lớn nước dồn từ Phạm Văn Đồng vào',
      description: 'Tập trung Học viện Cảnh sát nhân dân, Học viện Tài chính, ĐH Mỏ - Địa chất và KĐT Resco.'
    },
    {
      id: 'hn-btl-xd',
      ward: 'P. Xuân Đỉnh',
      name: 'Phường Xuân Đỉnh (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0665,
      lng: 105.7920,
      isHub: true,
      mainStreets: [
        'Đường Phạm Văn Đồng',
        'Đường Xuân Đỉnh',
        'Đường Nguyễn Hoàng Tôn',
        'Đường Đỗ Nhuận',
        'Công viên Hòa Bình'
      ],
      trafficHotspots: ['Cửa ngõ Bến xe Nam Thăng Long', 'Nút giao Xuân Đỉnh - Phạm Văn Đồng'],
      floodVulnerability: 'Đường Xuân Đỉnh đoạn chợ trũng ngập nhẹ, trục Phạm Văn Đồng thông thoáng',
      description: 'Khu vực Công viên Hòa Bình, siêu thị Mega Market Thăng Long, cửa ngõ ra Cầu Thăng Long.'
    },
    {
      id: 'hn-btl-xt',
      ward: 'P. Xuân Tảo',
      name: 'Phường Xuân Tảo (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0635,
      lng: 105.8010,
      isHub: false,
      mainStreets: [
        'Đường Nguyễn Văn Huyên kéo dài',
        'Đường Ngoại Giao Đoàn',
        'Đường Xuân Tảo',
        'Đường Đỗ Nhuận'
      ],
      trafficHotspots: ['Nút giao Nguyễn Văn Huyên - Xuân Tảo'],
      floodVulnerability: 'Hệ thống hạ tầng thoát nước hiện đại bậc nhất, hiếm khi ngập úng',
      description: 'Đại đô thị Ngoại Giao Đoàn và Starlake Tây Hồ Tây, trục kết nối Cầu Giấy ra Võ Chí Công.'
    },
    {
      id: 'hn-btl-dn',
      ward: 'P. Đông Ngạc',
      name: 'Phường Đông Ngạc (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0850,
      lng: 105.7800,
      isHub: false,
      mainStreets: [
        'Đường An Dương Vương',
        'Đường Kẻ Vẽ',
        'Đường Tân Xuân',
        'Đường Đông Ngạc',
        'Đường dẫn Cầu Thăng Long'
      ],
      trafficHotspots: ['Lối lên xuống Cầu Thăng Long', 'Nút giao Tân Xuân - An Dương Vương'],
      floodVulnerability: 'Đoạn chân dốc cầu Thăng Long ven sông Hồng ngập cục bộ khi triều cường hoặc mưa to',
      description: 'Làng cổ Đông Ngạc, trục kết nối đê Sông Hồng và chân cầu Thăng Long.'
    },
    {
      id: 'hn-btl-dt',
      ward: 'P. Đức Thắng',
      name: 'Phường Đức Thắng (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0770,
      lng: 105.7760,
      isHub: false,
      mainStreets: [
        'Đường Lê Văn Hiến',
        'Phố Viên',
        'Đường Đức Thắng',
        'Đường Kẻ Vẽ'
      ],
      trafficHotspots: ['Khu vực cổng Học viện Tài chính & ĐH Mỏ Địa chất'],
      floodVulnerability: 'Đường nội bộ trũng nhẹ quanh các hồ chứa',
      description: 'Làng đại học Đức Thắng, tập trung sinh viên Học viện Tài chính và ĐH Mỏ Địa chất.'
    },
    {
      id: 'hn-btl-tp',
      ward: 'P. Thụy Phương',
      name: 'Phường Thụy Phương (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0950,
      lng: 105.7650,
      isHub: false,
      mainStreets: [
        'Đường Thụy Phương',
        'Đường Hoàng Xá',
        'Đường Tân Phong'
      ],
      trafficHotspots: ['Đường đê Thụy Phương giao Hoàng Xá'],
      floodVulnerability: 'Khu vực ven sông Hồng, thoát nước tự nhiên tốt',
      description: 'Phía Bắc quận Bắc Từ Liêm, không gian sinh thái ven đê Sông Hồng.'
    },
    {
      id: 'hn-btl-lm',
      ward: 'P. Liên Mạc',
      name: 'Phường Liên Mạc (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0980,
      lng: 105.7480,
      isHub: false,
      mainStreets: [
        'Đường Liên Mạc',
        'Đường Yên Nội kéo dài',
        'Đường Cụm cảng Liên Mạc'
      ],
      trafficHotspots: ['Khu vực cống chèm Liên Mạc', 'Đường xe tải cảng Liên Mạc'],
      floodVulnerability: 'Cống Liên Mạc điều tiết nước sông Nhuệ ra sông Hồng',
      description: 'Khu vực cảng sông Liên Mạc và cống tiêu thoát nước quan trọng của toàn thành phố.'
    },
    {
      id: 'hn-btl-tc',
      ward: 'P. Thượng Cát',
      name: 'Phường Thượng Cát (Bắc Từ Liêm)',
      district: 'Bắc Từ Liêm',
      lat: 21.0960,
      lng: 105.7250,
      isHub: false,
      mainStreets: [
        'Đường Thượng Cát',
        'Đường Châu Đài',
        'Đường Kỳ Vũ'
      ],
      trafficHotspots: ['Khu vực bến đò Thượng Cát'],
      floodVulnerability: 'Vùng bãi bồi sông Hồng, an toàn mùa kiệt',
      description: 'Ranh giới phía Tây Bắc giáp huyện Đan Phượng, quy hoạch Cầu Thượng Cát Vành Đai 3.5.'
    },

    // ==========================================
    // 2. QUẬN NAM TỪ LIÊM (10 Phường)
    // ==========================================
    {
      id: 'hn-ntl-cd',
      ward: 'P. Cầu Diễn',
      name: 'Phường Cầu Diễn (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0410,
      lng: 105.7650,
      isHub: true,
      mainStreets: [
        'Đường Cầu Diễn',
        'Đường Hồ Tùng Mậu',
        'Đường Nguyễn Đổng Chi',
        'Đường Nguyễn Văn Giáp',
        'Đường Hàm Nghi',
        'Đường Lê Đức Thọ'
      ],
      trafficHotspots: ['Nút giao Cầu Diễn - Hồ Tùng Mậu', 'Ngã tư Hàm Nghi - Nguyễn Cơ Thạch', 'Đoạn Metro Cầu Diễn'],
      floodVulnerability: 'Đoạn chân Cầu Diễn và ngõ Nguyễn Đổng Chi ngập 15-20cm khi mưa rất to',
      description: 'Trung tâm kinh tế sầm uất phía Tây, trục nối thẳng Cầu Giấy ra Hoài Đức, KĐT Mỹ Đình 1.'
    },
    {
      id: 'hn-ntl-xp',
      ward: 'P. Xuân Phương',
      name: 'Phường Xuân Phương (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0335,
      lng: 105.7480,
      isHub: true,
      mainStreets: [
        'Đường Xuân Phương (ĐT70)',
        'Đường Trịnh Văn Bô',
        'Đường Thị Cấm',
        'Đường Hòe Thị',
        'Đường Phương Canh'
      ],
      trafficHotspots: ['Cầu vượt đường sắt Xuân Phương', 'Nút giao Trịnh Văn Bô - ĐT70', 'Đoạn chợ Hòe Thị'],
      floodVulnerability: 'Vùng trũng dọc đường 70 cũ đoạn qua cầu đường sắt ngập khi mưa to',
      description: 'Trục Trịnh Văn Bô 8 làn xe hiện đại nối Mỹ Đình, điểm giao cắt mật độ cao giữa ĐT70 và đường sắt.'
    },
    {
      id: 'hn-ntl-pc',
      ward: 'P. Phương Canh',
      name: 'Phường Phương Canh (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0390,
      lng: 105.7380,
      isHub: true,
      mainStreets: [
        'Đường Trịnh Văn Bô',
        'Đường Phương Canh',
        'Đường Tu Hoàng',
        'Phố Nhổn',
        'Cụm CN Vừa & Nhỏ Từ Liêm'
      ],
      trafficHotspots: ['Ngã tư Nhổn - Trịnh Văn Bô', 'Đường vào KĐT Hateco Apollo & Foresa'],
      floodVulnerability: 'Khu vực cụm công nghiệp thoát nước ổn định, ngõ Tu Hoàng trũng nhẹ',
      description: 'Tập trung CĐ FPT Polytechnic, cụm công nghiệp vừa và nhỏ Từ Liêm, KĐT Hateco Apollo.'
    },
    {
      id: 'hn-ntl-md1',
      ward: 'P. Mỹ Đình 1',
      name: 'Phường Mỹ Đình 1 (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0180,
      lng: 105.7750,
      isHub: true,
      mainStreets: [
        'Đường Phạm Hùng (Vành Đai 3)',
        'Đường Mễ Trì',
        'Đường Đình Thôn',
        'Phố Đỗ Đình Thiện',
        'Đường Vũ Quỳnh'
      ],
      trafficHotspots: ['Nút giao Phạm Hùng - Mễ Trì', 'Khu vực trước Keangnam Landmark 72', 'Phố Đình Thôn'],
      floodVulnerability: 'Ngã tư Keangnam - Mễ Trì từng là rốn ngập, nay đã cải tạo cống ngầm',
      description: 'Trung tâm tài chính mới với Tòa nhà Keangnam 72 tầng, The Manor, cộng đồng cư dân quốc tế.'
    },
    {
      id: 'hn-ntl-md2',
      ward: 'P. Mỹ Đình 2',
      name: 'Phường Mỹ Đình 2 (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0290,
      lng: 105.7720,
      isHub: true,
      mainStreets: [
        'Đường Lê Đức Thọ',
        'Đường Nguyễn Hoàng',
        'Đường Mỹ Đình',
        'Đường Trần Bình',
        'Phố Lưu Hữu Phước'
      ],
      trafficHotspots: ['Cổng Bến xe Mỹ Đình (Phạm Hùng - Nguyễn Hoàng)', 'Ngã tư Lê Đức Thọ - Nguyễn Hoàng'],
      floodVulnerability: 'Đường Trần Bình ngập cục bộ 20-30cm khi mưa rào mùa hè',
      description: 'Đầu mối Bến xe Mỹ Đình, Quảng trường Sân vận động Mỹ Đình, mật độ xe khách liên tỉnh đông đúc.'
    },
    {
      id: 'hn-ntl-mt',
      ward: 'P. Mễ Trì',
      name: 'Phường Mễ Trì (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0120,
      lng: 105.7830,
      isHub: true,
      mainStreets: [
        'Đại lộ Thăng Long',
        'Đường Phạm Hùng',
        'Đường Mễ Trì',
        'Đường Đỗ Đức Dục',
        'Đường Lương Thế Vinh'
      ],
      trafficHotspots: ['Nút giao BigC - Đại lộ Thăng Long - Phạm Hùng', 'Khách sạn JW Marriott'],
      floodVulnerability: 'Đoạn hầm chui số 3 Đại lộ Thăng Long ngập sâu khi mưa bão',
      description: 'Trung tâm Hội nghị Quốc gia, khách sạn JW Marriott, KĐT Mễ Trì Hạ, làng cốm Mễ Trì.'
    },
    {
      id: 'hn-ntl-pd',
      ward: 'P. Phú Đô',
      name: 'Phường Phú Đô (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0125,
      lng: 105.7680,
      isHub: false,
      mainStreets: [
        'Đường Lê Quang Đạo',
        'Đại lộ Thăng Long',
        'Đường Châu Văn Liêm',
        'Phố Sa Đôi'
      ],
      trafficHotspots: ['Bùng binh Lê Quang Đạo - Châu Văn Liêm', 'Cổng Cung thể thao dưới nước'],
      floodVulnerability: 'Khu dân cư Phú Đô vùng trong trũng nước',
      description: 'Tập trung Đường đua F1, Cung Hữu Nghị Việt Trung, làng bún Phú Đô, trục Lê Quang Đạo kéo dài ra Hà Đông.'
    },
    {
      id: 'hn-ntl-tm',
      ward: 'P. Tây Mỗ',
      name: 'Phường Tây Mỗ (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 21.0020,
      lng: 105.7450,
      isHub: true,
      mainStreets: [
        'Đường Tây Mỗ (ĐT70)',
        'Đại lộ Thăng Long',
        'Đường Cầu Cốc',
        'Trục chính Vinhomes Smart City'
      ],
      trafficHotspots: ['Nút giao ĐT70 với Đại lộ Thăng Long', 'Cầu Cốc - Smart City'],
      floodVulnerability: 'Cầu vượt ĐT70 giao cắt trũng nước khi mưa kéo dài',
      description: 'Đại đô thị Vinhomes Smart City quy mô 280ha, trục ĐT70 kết nối Nam Từ Liêm và Hoài Đức.'
    },
    {
      id: 'hn-ntl-dm',
      ward: 'P. Đại Mỗ',
      name: 'Phường Đại Mỗ (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 20.9890,
      lng: 105.7530,
      isHub: false,
      mainStreets: [
        'Đường Đại Mỗ (ĐT70)',
        'Đường Sa Đôi',
        'Đường Quang Tiến',
        'Đường Hữu Hưng',
        'Đường Vạn Phúc kéo dài'
      ],
      trafficHotspots: ['Cầu Đôi Đại Mỗ', 'Ngã tư Vạn Phúc - ĐT70'],
      floodVulnerability: 'Ven sông Nhuệ ngập trũng khi lũ sông dâng cao kết hợp mưa lớn',
      description: 'Nút giao thông quan trọng kết nối Nam Từ Liêm sang Hà Đông (Vạn Phúc).'
    },
    {
      id: 'hn-ntl-tv',
      ward: 'P. Trung Văn',
      name: 'Phường Trung Văn (Nam Từ Liêm)',
      district: 'Nam Từ Liêm',
      lat: 20.9960,
      lng: 105.7870,
      isHub: true,
      mainStreets: [
        'Đường Tố Hữu (Lê Văn Lương kéo dài)',
        'Đường Trung Văn',
        'Đường Lương Thế Vinh',
        'Đường Phùng Khoang'
      ],
      trafficHotspots: ['Ngã tư Tố Hữu - Lương Thế Vinh', 'Ngã tư Tố Hữu - Trung Văn', 'Tuyến BRT Tố Hữu'],
      floodVulnerability: 'Đoạn Tố Hữu trũng ngập cục bộ 20cm mép đường',
      description: 'Trục xuyên tâm Tố Hữu đông đúc với tuyến buýt nhanh BRT, kết nối thẳng về Cầu Giấy & Thanh Xuân.'
    },

    // ==========================================
    // 3. QUẬN CẦU GIẤY (8 Phường)
    // ==========================================
    {
      id: 'hn-cg-dvh',
      ward: 'P. Dịch Vọng Hậu',
      name: 'Phường Dịch Vọng Hậu (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0330,
      lng: 105.7870,
      isHub: true,
      mainStreets: [
        'Đường Xuân Thủy',
        'Đường Cầu Giấy',
        'Đường Duy Tân',
        'Đường Trần Thái Tông',
        'Đường Tôn Thất Thuyết',
        'Đường Phạm Hùng'
      ],
      trafficHotspots: ['Ngã tư Xuân Thủy - Trần Thái Tông', 'Phố công nghệ thông tin Duy Tân giờ tan tầm'],
      floodVulnerability: 'Đường Trần Thái Tông và Duy Tân thoát nước tốt sau khi thông cống Mễ Trì',
      description: 'Thung lũng Silicon Hà Nội (phố IT Duy Tân), ĐH Quốc gia Hà Nội, ĐH Sư phạm Hà Nội, Metro Nhổn - Cầu Giấy.'
    },
    {
      id: 'hn-cg-md',
      ward: 'P. Mai Dịch',
      name: 'Phường Mai Dịch (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0395,
      lng: 105.7790,
      isHub: true,
      mainStreets: [
        'Đường Hồ Tùng Mậu',
        'Đường Phạm Văn Đồng',
        'Đường Doãn Kế Thiện',
        'Đường Trần Vỹ',
        'Đường Lê Đức Thọ'
      ],
      trafficHotspots: ['Nút giao Cầu vượt Mai Dịch (Vành đai 3 - QL32)', 'Cổng ĐH Thương Mại'],
      floodVulnerability: 'Phố Doãn Kế Thiện và ngõ Trần Vỹ ngập nhẹ 15-20cm cục bộ',
      description: 'Đầu mối giao thông trọng yếu nút giao Mai Dịch, ĐH Thương Mại, ĐH Sân khấu Điện ảnh.'
    },
    {
      id: 'hn-cg-dv',
      ward: 'P. Dịch Vọng',
      name: 'Phường Dịch Vọng (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0310,
      lng: 105.7960,
      isHub: false,
      mainStreets: [
        'Đường Cầu Giấy',
        'Đường Trần Đăng Ninh',
        'Đường Khúc Thừa Dụ',
        'Đường Thành Thái',
        'Công viên Cầu Giấy'
      ],
      trafficHotspots: ['Đường Cầu Giấy đoạn Khúc Thừa Dụ', 'Khu vực Công viên Cầu Giấy'],
      floodVulnerability: 'Khu đô thị mới Dịch Vọng cao ráo, ít ngập',
      description: 'Khu đô thị Dịch Vọng hiện đại, Công viên Cầu Giấy, trục thương mại Cầu Giấy sầm uất.'
    },
    {
      id: 'hn-cg-nt',
      ward: 'P. Nghĩa Tân',
      name: 'Phường Nghĩa Tân (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0440,
      lng: 105.7920,
      isHub: true,
      mainStreets: [
        'Đường Hoàng Quốc Việt',
        'Đường Nghĩa Tân',
        'Đường Tô Hiệu',
        'Đường Trần Tử Bình',
        'Đường Nguyễn Phong Sắc'
      ],
      trafficHotspots: ['Ngã tư Hoàng Quốc Việt - Nguyễn Phong Sắc', 'Phố ẩm thực Tô Hiệu'],
      floodVulnerability: 'Chợ Nghĩa Tân và ngõ Trần Tử Bình thoát nước chậm khi mưa dồn dập',
      description: 'Trục Hoàng Quốc Việt 6 làn xe, phố ẩm thực Tô Hiệu nức tiếng, Học viện Báo chí & Tuyên truyền.'
    },
    {
      id: 'hn-cg-nd',
      ward: 'P. Nghĩa Đô',
      name: 'Phường Nghĩa Đô (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0490,
      lng: 105.8010,
      isHub: false,
      mainStreets: [
        'Đường Lạc Long Quân',
        'Đường Hoàng Quốc Việt',
        'Phố Phùng Chí Kiên',
        'Đường Nguyễn Văn Huyên'
      ],
      trafficHotspots: ['Ngã tư Hoàng Quốc Việt - Nguyễn Văn Huyên', 'Dốc Bưởi - Lạc Long Quân'],
      floodVulnerability: 'Phố Phùng Chí Kiên có đoạn dốc trũng nước cục bộ',
      description: 'Cửa ngõ tiếp giáp Tây Hồ, bảo tàng Dân tộc học Việt Nam, trục Nguyễn Văn Huyên kéo dài.'
    },
    {
      id: 'hn-cg-qh',
      ward: 'P. Quan Hoa',
      name: 'Phường Quan Hoa (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0370,
      lng: 105.8050,
      isHub: false,
      mainStreets: [
        'Đường Cầu Giấy',
        'Đường Quan Hoa',
        'Đường Nguyễn Khánh Toàn',
        'Đường Nguyễn Đình Hoàn',
        'Đường Dương Quảng Hàm'
      ],
      trafficHotspots: ['Cầu Cầu Giấy - Nút giao Vành đai 2', 'Đường ven sông Tô Lịch'],
      floodVulnerability: 'Đường Quan Hoa sát bờ kè sông Tô Lịch an toàn',
      description: 'Trục Cầu Giấy nối Ba Đình, dọc sông Tô Lịch với các cây cầu kết nối sang Đống Đa.'
    },
    {
      id: 'hn-cg-th',
      ward: 'P. Trung Hòa',
      name: 'Phường Trung Hòa (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0090,
      lng: 105.7980,
      isHub: true,
      mainStreets: [
        'Đường Trần Duy Hưng',
        'Đường Trung Kính',
        'Đường Hoàng Đạo Thúy',
        'Đường Vũ Phạm Hàm',
        'Đường Nguyễn Thị Định'
      ],
      trafficHotspots: ['Nút giao Cầu vượt Trần Duy Hưng - Nguyễn Chánh', 'Hầm chui Trung Hòa (Đại lộ Thăng Long)'],
      floodVulnerability: 'Đường Vũ Phạm Hàm ngập nhẹ 15-20cm tại các điểm trũng',
      description: 'KĐT kiểu mẫu Trung Hòa - Nhân Chính, trục huyết mạch Trần Duy Hưng nối trung tâm ra Đại lộ Thăng Long.'
    },
    {
      id: 'hn-cg-yh',
      ward: 'P. Yên Hòa',
      name: 'Phường Yên Hòa (Cầu Giấy)',
      district: 'Cầu Giấy',
      lat: 21.0200,
      lng: 105.7950,
      isHub: true,
      mainStreets: [
        'Đường Trung Kính',
        'Đường Yên Hòa',
        'Đường Dương Đình Nghệ',
        'Đường Hạ Yên Quyết',
        'Đường Mạc Thái Tổ',
        'Phố Hoa Bằng'
      ],
      trafficHotspots: ['Ngã tư Dương Đình Nghệ - Trung Kính', 'Đường Mạc Thái Tổ'],
      floodVulnerability: 'Rốn ngập phố Hoa Bằng (HSDC-06, ngập sâu 25-30cm xe máy khó đi)',
      description: 'Trụ sở Tổng cục Hải quan, Tòa án Cấp cao, rốn ngập kinh niên phố Hoa Bằng.'
    },

    // ==========================================
    // 4. QUẬN BA ĐÌNH (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-bd-qt',
      ward: 'P. Quán Thánh',
      name: 'Phường Quán Thánh (Ba Đình)',
      district: 'Ba Đình',
      lat: 21.0420,
      lng: 105.8410,
      isHub: true,
      mainStreets: [
        'Đường Quán Thánh',
        'Đường Phan Đình Phùng',
        'Đường Hùng Vương',
        'Phố Cửa Bắc',
        'Đường Nguyễn Tri Phương'
      ],
      trafficHotspots: ['Phố Phan Đình Phùng giờ cao điểm', 'Nút giao Cửa Bắc - Quán Thánh'],
      floodVulnerability: 'Hệ thống thoát nước tốt ra hồ Trúc Bạch, hiếm khi ngập',
      description: 'Khu trung tâm chính trị Ba Đình, rợp bóng cây sấu cổ thụ đường Phan Đình Phùng.'
    },
    {
      id: 'hn-bd-km',
      ward: 'P. Kim Mã',
      name: 'Phường Kim Mã (Ba Đình)',
      district: 'Ba Đình',
      lat: 21.0315,
      lng: 105.8240,
      isHub: true,
      mainStreets: [
        'Đường Kim Mã',
        'Đường Liễu Giai',
        'Đường Nguyễn Thái Học',
        'Đường Giang Văn Minh',
        'Phố Vạn Bảo'
      ],
      trafficHotspots: ['Nút giao Kim Mã - Liễu Giai', 'Đoạn ngầm Metro ga Kim Mã'],
      floodVulnerability: 'Đường Kim Mã cao ráo, dốc thoải',
      description: 'Trục Kim Mã ngoại giao đoàn, ga ngầm tuyến Metro số 3, khách sạn Daewoo.'
    },
    {
      id: 'hn-bd-gv',
      ward: 'P. Giảng Võ',
      name: 'Phường Giảng Võ (Ba Đình)',
      district: 'Ba Đình',
      lat: 21.0270,
      lng: 105.8220,
      isHub: true,
      mainStreets: [
        'Đường Giảng Võ',
        'Đường Kim Mã',
        'Phố Trần Huy Liệu',
        'Đường Nam Cao',
        'Phố Núi Trúc'
      ],
      trafficHotspots: ['Nút giao Giảng Võ - Cát Linh - Hào Nam', 'Tuyến BRT Giảng Võ'],
      floodVulnerability: 'Khu vực hồ Giảng Võ thoát nước ổn định',
      description: 'Khu triển lãm Giảng Võ cũ, hồ Giảng Võ, kết nối nhanh sang Đống Đa.'
    },
    {
      id: 'hn-bd-lg',
      ward: 'P. Liễu Giai',
      name: 'Phường Liễu Giai (Ba Đình)',
      district: 'Ba Đình',
      lat: 21.0360,
      lng: 105.8150,
      isHub: true,
      mainStreets: [
        'Đường Liễu Giai',
        'Đường Văn Cao',
        'Đường Đội Cấn',
        'Đường Đốc Ngữ',
        'Tòa nhà Lotte Center'
      ],
      trafficHotspots: ['Nút giao Liễu Giai - Đào Tấn (trước Lotte Center)', 'Ngã tư Liễu Giai - Đội Cấn'],
      floodVulnerability: 'Khu vực Lotte cao ráo, đường Đội Cấn trũng nhẹ',
      description: 'Tòa tháp Lotte Center 65 tầng, Đại sứ quán Nhật Bản, trục Văn Cao nối Hồ Tây.'
    },
    {
      id: 'hn-bd-nk',
      ward: 'P. Ngọc Khánh',
      name: 'Phường Ngọc Khánh (Ba Đình)',
      district: 'Ba Đình',
      lat: 21.0295,
      lng: 105.8140,
      isHub: false,
      mainStreets: [
        'Đường Nguyễn Chí Thanh',
        'Đường Kim Mã',
        'Đường Đào Tấn',
        'Phố Ngọc Khánh',
        'Đường La Thành'
      ],
      trafficHotspots: ['Cầu vượt Nguyễn Chí Thanh - Kim Mã', 'Đường Đê La Thành đoạn viện Nhi'],
      floodVulnerability: 'Phố Đào Tấn đoạn hồ Thủ Lệ an toàn, La Thành ùn tắc',
      description: 'Hồ Ngọc Khánh, Công viên Thủ Lệ, trục Nguyễn Chí Thanh rộng 6 làn xe.'
    },
    {
      id: 'hn-bd-tc',
      ward: 'P. Thành Công',
      name: 'Phường Thành Công (Ba Đình)',
      district: 'Ba Đình',
      lat: 21.0220,
      lng: 105.8170,
      isHub: false,
      mainStreets: [
        'Đường Láng Hạ',
        'Đường Thành Công',
        'Đường Huỳnh Thúc Kháng',
        'Đường Nguyên Hồng'
      ],
      trafficHotspots: ['Cầu vượt Láng Hạ - Huỳnh Thúc Kháng'],
      floodVulnerability: 'Hồ Thành Công điều tiết tốt',
      description: 'Hồ Thành Công, trục tài chính Láng Hạ tập trung nhiều ngân hàng.'
    },

    // ==========================================
    // 5. QUẬN HOÀN KIẾM (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-hk-tt',
      ward: 'P. Tràng Tiền',
      name: 'Phường Tràng Tiền (Hoàn Kiếm)',
      district: 'Hoàn Kiếm',
      lat: 21.0250,
      lng: 105.8560,
      isHub: true,
      mainStreets: [
        'Phố Tràng Tiền',
        'Phố Đinh Tiên Hoàng',
        'Phố Tràng Thi',
        'Phố Hàng Bài',
        'Phố Ngô Quyền',
        'Quảng trường Nhà Hát Lớn'
      ],
      trafficHotspots: ['Quảng trường Cách Mạng Tháng 8 (Nhà Hát Lớn)', 'Ngã tư Hàng Bài - Tràng Tiền'],
      floodVulnerability: 'Cao ráo, hệ thống thoát nước hồ Hoàn Kiếm ổn định',
      description: 'Trung tâm trái tim thủ đô, Tràng Tiền Plaza, Nhà Hát Lớn Hà Nội, Hồ Gươm.'
    },
    {
      id: 'hn-hk-ht',
      ward: 'P. Hàng Trống',
      name: 'Phường Hàng Trống (Hoàn Kiếm)',
      district: 'Hoàn Kiếm',
      lat: 21.0310,
      lng: 105.8500,
      isHub: true,
      mainStreets: [
        'Phố Hàng Trống',
        'Phố Lý Quốc Sư',
        'Phố Nhà Thờ',
        'Phố Lê Thái Tổ',
        'Phố Bảo Khánh'
      ],
      trafficHotspots: ['Khu vực Nhà Thờ Lớn', 'Phố đi bộ Hồ Gươm cuối tuần'],
      floodVulnerability: 'Không ngập',
      description: 'Khu vực Nhà Thờ Lớn Hà Nội, phố đi bộ ven hồ Gươm, du lịch quốc tế sôi động.'
    },
    {
      id: 'hn-hk-cn',
      ward: 'P. Cửa Nam',
      name: 'Phường Cửa Nam (Hoàn Kiếm)',
      district: 'Hoàn Kiếm',
      lat: 21.0260,
      lng: 105.8430,
      isHub: true,
      mainStreets: [
        'Phố Cửa Nam',
        'Phố Lê Duẩn',
        'Phố Hai Bà Trưng',
        'Phố Nguyễn Khuyến',
        'Phố Phan Bội Châu'
      ],
      trafficHotspots: ['Ngã năm Cửa Nam', 'Cửa Nam - Lê Duẩn - Ga Hà Nội'],
      floodVulnerability: 'Rốn ngập HSDC-01 Phố Nguyễn Khuyến (trước trường Lý Thường Kiệt ngập 35cm) & HSDC-02 Phan Bội Châu',
      description: 'Đầu mối Ga Hà Nội, ngã năm Cửa Nam, điểm trũng ngập sâu lịch sử mỗi khi mưa lớn.'
    },
    {
      id: 'hn-hk-dx',
      ward: 'P. Đồng Xuân',
      name: 'Phường Đồng Xuân (Hoàn Kiếm)',
      district: 'Hoàn Kiếm',
      lat: 21.0375,
      lng: 105.8500,
      isHub: false,
      mainStreets: [
        'Phố Đồng Xuân',
        'Phố Hàng Khoai',
        'Phố Hàng Đậu',
        'Phố Hàng Giấy',
        'Cầu Long Biên'
      ],
      trafficHotspots: ['Chợ Đồng Xuân', 'Ngã tư Hàng Đậu - Hàng Giấy'],
      floodVulnerability: 'Thoát nước ra cửa khẩu Tân Ấp sông Hồng',
      description: 'Chợ đầu mối Đồng Xuân lớn nhất miền Bắc, tháp nước Hàng Đậu, chân cầu Long Biên.'
    },

    // ==========================================
    // 6. QUẬN ĐỐNG ĐA (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-dd-ocd',
      ward: 'P. Ô Chợ Dừa',
      name: 'Phường Ô Chợ Dừa (Đống Đa)',
      district: 'Đống Đa',
      lat: 21.0190,
      lng: 105.8280,
      isHub: true,
      mainStreets: [
        'Đường Xã Đàn (Vành Đai 1)',
        'Đường Tôn Đức Thắng',
        'Đường Đê La Thành',
        'Phố Hoàng Cầu',
        'Đường Nguyễn Lương Bằng'
      ],
      trafficHotspots: ['Nút giao Ô Chợ Dừa (ngã 6)', 'Đường Đê La Thành đoạn Hoàng Cầu'],
      floodVulnerability: 'Hồ Hoàng Cầu điều hòa nước, hiếm khi ngập sâu',
      description: 'Nút giao ngã 6 Ô Chợ Dừa sầm uất, tuyến đường đắt nhất hành tinh Xã Đàn, hồ Đống Đa.'
    },
    {
      id: 'hn-dd-lh',
      ward: 'P. Láng Hạ',
      name: 'Phường Láng Hạ (Đống Đa)',
      district: 'Đống Đa',
      lat: 21.0150,
      lng: 105.8140,
      isHub: true,
      mainStreets: [
        'Đường Láng Hạ',
        'Đường Láng (Vành Đai 2)',
        'Đường Thái Hà',
        'Đường Huỳnh Thúc Kháng',
        'Đường Giảng Võ'
      ],
      trafficHotspots: ['Ngã tư Thái Hà - Láng Hạ', 'Cầu vượt Láng Hạ qua đường Láng'],
      floodVulnerability: 'Rốn ngập HSDC-04 Đường Thái Hà (trước rạp Chiếu phim Quốc Gia ngập 20cm)',
      description: 'Phố tài chính - công nghệ Thái Hà - Láng Hạ, rạp Chiếu phim Quốc Gia, trục Vành Đai 2 ven sông Tô Lịch.'
    },
    {
      id: 'hn-dd-nts',
      ward: 'P. Ngã Tư Sở',
      name: 'Phường Ngã Tư Sở (Đống Đa)',
      district: 'Đống Đa',
      lat: 21.0040,
      lng: 105.8190,
      isHub: true,
      mainStreets: [
        'Đường Nguyễn Trãi',
        'Đường Trường Chinh',
        'Đường Tây Sơn',
        'Đường Láng',
        'Cầu vượt Ngã Tư Sở'
      ],
      trafficHotspots: ['Nút giao Ngã Tư Sở (điểm ùn tắc số 1 thủ đô)', 'Lối lên xuống Vành đai 2 trên cao'],
      floodVulnerability: 'Thoát nước sông Tô Lịch tốt, chủ yếu là điểm nghẽn ùn tắc giao thông cực nặng',
      description: 'Nút giao thông phức tạp và đông đúc nhất Hà Nội, kết nối 4 trục lớn Nguyễn Trãi - Tây Sơn - Trường Chinh - Láng.'
    },
    {
      id: 'hn-dd-cl',
      ward: 'P. Cát Linh',
      name: 'Phường Cát Linh (Đống Đa)',
      district: 'Đống Đa',
      lat: 21.0290,
      lng: 105.8300,
      isHub: false,
      mainStreets: [
        'Đường Cát Linh',
        'Đường Giảng Võ',
        'Đường Hào Nam',
        'Phố Bích Câu',
        'Ga Metro Cát Linh'
      ],
      trafficHotspots: ['Ga đầu mối Metro Cát Linh - Hà Đông', 'Ngã tư Hào Nam - Cát Linh'],
      floodVulnerability: 'Cao ráo, thoát nước tốt',
      description: 'Ga đầu mối Metro Cát Linh, Sân vận động Hàng Đẫy lân cận, chùa Bích Câu.'
    },
    {
      id: 'hn-dd-kl',
      ward: 'P. Kim Liên',
      name: 'Phường Kim Liên (Đống Đa)',
      district: 'Đống Đa',
      lat: 21.0110,
      lng: 105.8360,
      isHub: false,
      mainStreets: [
        'Phố Đào Duy Anh',
        'Phố Phạm Ngọc Thạch',
        'Đường Phương Mai',
        'Đường Lương Định Của'
      ],
      trafficHotspots: ['Hầm chui Kim Liên (Đại Cồ Việt - Xã Đàn)', 'Ngã tư Phạm Ngọc Thạch - Chùa Bộc'],
      floodVulnerability: 'Hầm chui Kim Liên có hệ thống máy bơm tự động công suất lớn',
      description: 'Khu tập thể Kim Liên, hầm chui cơ giới đầu tiên của Hà Nội, phố thời trang Phạm Ngọc Thạch.'
    },

    // ==========================================
    // 7. QUẬN HAI BÀ TRƯNG (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-hbt-bm',
      ward: 'P. Bạch Mai',
      name: 'Phường Bạch Mai (Hai Bà Trưng)',
      district: 'Hai Bà Trưng',
      lat: 21.0020,
      lng: 105.8490,
      isHub: true,
      mainStreets: [
        'Phố Bạch Mai',
        'Phố Đại La (Vành Đai 2)',
        'Phố Lê Thanh Nghị',
        'Phố Hồng Mai'
      ],
      trafficHotspots: ['Ngã tư Bạch Mai - Đại La - Minh Khai (Chợ Mơ)', 'Cầu vượt Vành Đai 2 trên cao'],
      floodVulnerability: 'Sau khi mở rộng Vành Đai 2 ngầm hóa cống, thoát nước rất tốt',
      description: 'Trung tâm Hai Bà Trưng, Chợ Mơ, trục Đại La - Vành đai 2 trên cao nối sang Cầu Vĩnh Tuy.'
    },
    {
      id: 'hn-hbt-vt',
      ward: 'P. Vĩnh Tuy',
      name: 'Phường Vĩnh Tuy (Hai Bà Trưng)',
      district: 'Hai Bà Trưng',
      lat: 20.9980,
      lng: 105.8670,
      isHub: true,
      mainStreets: [
        'Đường Minh Khai (Vành Đai 2)',
        'Đường Vĩnh Tuy',
        'Đường Lạc Trung',
        'Đường Kim Ngưu',
        'Cầu Vĩnh Tuy'
      ],
      trafficHotspots: ['Chân Cầu Vĩnh Tuy giai đoạn 1 & 2', 'Lối vào KĐT Times City'],
      floodVulnerability: 'Phố Mạc Thị Bưởi và Lạc Trung ngập cục bộ 20cm',
      description: 'Đại đô thị Times City, chân Cầu Vĩnh Tuy kết nối Long Biên, trục đường Minh Khai 8 làn xe.'
    },
    {
      id: 'hn-hbt-bk',
      ward: 'P. Bách Khoa',
      name: 'Phường Bách Khoa (Hai Bà Trưng)',
      district: 'Hai Bà Trưng',
      lat: 21.0050,
      lng: 105.8450,
      isHub: false,
      mainStreets: [
        'Đường Đại Cồ Việt',
        'Phố Trần Đại Nghĩa',
        'Phố Tạ Quang Bửu',
        'Phố Lê Thanh Nghị'
      ],
      trafficHotspots: ['Cổng ĐH Bách Khoa trên đường Đại Cồ Việt', 'Phố Trần Đại Nghĩa'],
      floodVulnerability: 'Khu vực hồ Bách Khoa thoát nước ổn định',
      description: 'Cái nôi đào tạo kỹ thuật: ĐH Bách Khoa Hà Nội, ĐH Kinh tế Quốc dân, ĐH Xây dựng.'
    },

    // ==========================================
    // 8. QUẬN THANH XUÂN (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-tx-kd',
      ward: 'P. Khương Đình',
      name: 'Phường Khương Đình (Thanh Xuân)',
      district: 'Thanh Xuân',
      lat: 20.9930,
      lng: 105.8180,
      isHub: true,
      mainStreets: [
        'Đường Khương Đình',
        'Đường Vũ Tông Phan',
        'Đường Bùi Xương Trạch',
        'Đường Kim Giang'
      ],
      trafficHotspots: ['Đường Bùi Xương Trạch hẹp hay ùn ứ', 'Cầu Khương Đình'],
      floodVulnerability: 'Vũ Tông Phan ven sông Tô Lịch, Bùi Xương Trạch trũng nước khi mưa trên 40mm',
      description: 'Dọc tuyến sông Tô Lịch, cầu Khương Đình, kết nối Thanh Xuân và Hoàng Mai.'
    },
    {
      id: 'hn-tx-nc',
      ward: 'P. Nhân Chính',
      name: 'Phường Nhân Chính (Thanh Xuân)',
      district: 'Thanh Xuân',
      lat: 21.0060,
      lng: 105.8060,
      isHub: true,
      mainStreets: [
        'Đường Lê Văn Lương',
        'Đường Khuất Duy Tiến (Vành Đai 3)',
        'Đường Hoàng Đạo Thúy',
        'Đường Ngụy Như Kon Tum',
        'Đường Quan Nhân'
      ],
      trafficHotspots: ['Hầm chui Lê Văn Lương - Khuất Duy Tiến', 'Nút giao Hoàng Đạo Thúy - Lê Văn Lương'],
      floodVulnerability: 'Đường Quan Nhân trũng ngập nhẹ, Lê Văn Lương thông thoáng',
      description: 'Trung tâm tài chính - chung cư cao tầng Trung Hòa Nhân Chính, hầm chui Lê Văn Lương hiện đại.'
    },
    {
      id: 'hn-tx-txb',
      ward: 'P. Thanh Xuân Bắc',
      name: 'Phường Thanh Xuân Bắc (Thanh Xuân)',
      district: 'Thanh Xuân',
      lat: 20.9980,
      lng: 105.7960,
      isHub: true,
      mainStreets: [
        'Đường Khuất Duy Tiến',
        'Đường Nguyễn Trãi',
        'Phố Nguyễn Quý Đức',
        'Đường Lương Thế Vinh'
      ],
      trafficHotspots: ['Hầm chui ngã tư Khuất Duy Tiến - Nguyễn Trãi 3 tầng', 'Ga Metro Phùng Khoang'],
      floodVulnerability: 'Hầm chui Nguyễn Trãi trang bị trạm bơm tự động',
      description: 'Nút giao lập thể 3 tầng hiện đại bậc nhất Hà Nội (hầm chui - đường bằng - đường trên cao).'
    },
    {
      id: 'hn-tx-td',
      ward: 'P. Thượng Đình',
      name: 'Phường Thượng Đình (Thanh Xuân)',
      district: 'Thanh Xuân',
      lat: 21.0010,
      lng: 105.8140,
      isHub: false,
      mainStreets: [
        'Đường Nguyễn Trãi',
        'Đường Thượng Đình',
        'Đường Khương Đình',
        'KĐT Royal City'
      ],
      trafficHotspots: ['Cổng hầm KĐT Royal City trên trục Nguyễn Trãi', 'Ga Metro Thượng Đình'],
      floodVulnerability: 'Cao ráo, thoát nước tốt',
      description: 'Đại đô thị Vinhomes Royal City, Ga đường sắt trên cao Cát Linh - Hà Đông.'
    },

    // ==========================================
    // 9. QUẬN TÂY HỒ (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-th-buoi',
      ward: 'P. Bưởi',
      name: 'Phường Bưởi (Tây Hồ)',
      district: 'Tây Hồ',
      lat: 21.0480,
      lng: 105.8120,
      isHub: true,
      mainStreets: [
        'Đường Lạc Long Quân',
        'Đường Hoàng Hoa Thám',
        'Đường Thụy Khuê',
        'Đường Trích Sài',
        'Đường Võng Thị'
      ],
      trafficHotspots: ['Dốc Bưởi - Nút giao Vành đai 2', 'Đường ven hồ Trích Sài'],
      floodVulnerability: 'Đoạn ngõ Võng Thị trũng nước sát mép hồ',
      description: 'Cửa ngõ Tây Nam Hồ Tây, làng nghề giấy dó Bưởi, nút giao Cầu Giấy - Ba Đình - Tây Hồ.'
    },
    {
      id: 'hn-th-tk',
      ward: 'P. Thụy Khuê',
      name: 'Phường Thụy Khuê (Tây Hồ)',
      district: 'Tây Hồ',
      lat: 21.0450,
      lng: 105.8280,
      isHub: true,
      mainStreets: [
        'Đường Thụy Khuê',
        'Đường Hoàng Hoa Thám',
        'Đường Mai Xuân Thưởng',
        'Đường Thanh Niên',
        'Đường Nguyễn Đình Thi'
      ],
      trafficHotspots: ['Dốc La Pho - Tam Đa', 'Đường Thanh Niên (cổ ngư) giờ tan tầm'],
      floodVulnerability: 'Rốn ngập HSDC-03 Phố Thụy Khuê (Đoạn dốc La Pho ngập sâu 30cm dồn từ Hoàng Hoa Thám xuống)',
      description: 'Trục song song ven Hồ Tây, Trường THPT Chu Văn An danh tiếng, đền Quán Thánh.'
    },
    {
      id: 'hn-th-xl',
      ward: 'P. Xuân La',
      name: 'Phường Xuân La (Tây Hồ)',
      district: 'Tây Hồ',
      lat: 21.0590,
      lng: 105.8050,
      isHub: true,
      mainStreets: [
        'Đường Võ Chí Công (8 làn xe)',
        'Đường Xuân La',
        'Đường Lạc Long Quân',
        'Đường Nguyễn Hoàng Tôn'
      ],
      trafficHotspots: ['Nút giao Võ Chí Công - Xuân La', 'Bùng binh Cầu Nhật Tân'],
      floodVulnerability: 'Trục Võ Chí Công cao ráo, ngõ Xuân La trũng nhẹ',
      description: 'Đại lộ Võ Chí Công nối thẳng Sân bay Nội Bài, KĐT Tây Hồ Tây - Starlake.'
    },
    {
      id: 'hn-th-qa',
      ward: 'P. Quảng An',
      name: 'Phường Quảng An (Tây Hồ)',
      district: 'Tây Hồ',
      lat: 21.0620,
      lng: 105.8280,
      isHub: false,
      mainStreets: [
        'Đường Xuân Diệu',
        'Đường Đặng Thai Mai',
        'Đường Quảng An',
        'Phố Tây Hồ',
        'Phủ Tây Hồ'
      ],
      trafficHotspots: ['Đường vào Phủ Tây Hồ các ngày rằm, mùng một', 'Phố Tây Xuân Diệu'],
      floodVulnerability: 'Bán đảo cao ráo, view trọn Hồ Tây',
      description: 'Bán đảo Quảng An, trung tâm văn hóa ẩm thực và cộng đồng chuyên gia quốc tế lớn nhất thủ đô.'
    },
    {
      id: 'hn-th-nt',
      ward: 'P. Nhật Tân',
      name: 'Phường Nhật Tân (Tây Hồ)',
      district: 'Tây Hồ',
      lat: 21.0820,
      lng: 105.8200,
      isHub: false,
      mainStreets: [
        'Đường Âu Cơ',
        'Đường Lạc Long Quân',
        'Đường An Dương Vương',
        'Cầu Nhật Tân',
        'Công viên Nước Hồ Tây'
      ],
      trafficHotspots: ['Dốc Cầu Nhật Tân', 'Đường đê Âu Cơ đang mở rộng'],
      floodVulnerability: 'Làng đào Nhật Tân thoát nước tự nhiên ra sông Hồng',
      description: 'Vựa đào Nhật Tân, Cầu dây văng Nhật Tân biểu tượng hữu nghị, Công viên nước Hồ Tây.'
    },

    // ==========================================
    // 10. QUẬN HOÀNG MAI (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-hm-hl',
      ward: 'P. Hoàng Liệt',
      name: 'Phường Hoàng Liệt (Hoàng Mai)',
      district: 'Hoàng Mai',
      lat: 20.9650,
      lng: 105.8370,
      isHub: true,
      mainStreets: [
        'Đường Giải Phóng',
        'Đường Ngọc Hồi (QL1A)',
        'Đường Vành Đai 3 trên cao',
        'Đường Bán đảo Linh Đàm',
        'Đường Nguyễn Hữu Thọ'
      ],
      trafficHotspots: ['Nút giao Pháp Vân - Cầu Giẽ (cửa ngõ phía Nam)', 'Cầu Dậu - Linh Đàm', 'Bến xe Nước Ngầm'],
      floodVulnerability: 'Hồ Linh Đàm điều tiết chính, đường Nguyễn Hữu Thọ đoạn trũng ngập nhẹ khi mưa bão',
      description: 'Phường đông dân nhất thủ đô (>85.000 dân), Bến xe Nước Ngầm, cửa ngõ cao tốc Pháp Vân - Cầu Giẽ.'
    },
    {
      id: 'hn-hm-gb',
      ward: 'P. Giáp Bát',
      name: 'Phường Giáp Bát (Hoàng Mai)',
      district: 'Hoàng Mai',
      lat: 20.9850,
      lng: 105.8410,
      isHub: true,
      mainStreets: [
        'Đường Giải Phóng',
        'Phố Kim Đồng',
        'Đường Giáp Bát',
        'Đường Trương Định'
      ],
      trafficHotspots: ['Cổng Bến xe Giáp Bát', 'Ngã ba Giải Phóng - Kim Đồng (Đang thi công hầm chui Kim Đồng)'],
      floodVulnerability: 'Đoạn ngã ba Kim Đồng - Giải Phóng ngập 20cm khi mưa to dồn dập',
      description: 'Đầu mối giao thông Bến xe Giáp Bát, trục Giải Phóng huyết mạch phía Nam, hầm chui Kim Đồng.'
    },
    {
      id: 'hn-hm-dc',
      ward: 'P. Định Công',
      name: 'Phường Định Công (Hoàng Mai)',
      district: 'Hoàng Mai',
      lat: 20.9870,
      lng: 105.8300,
      isHub: false,
      mainStreets: [
        'Đường Định Công',
        'Đường Trần Điền',
        'Đường Lê Trọng Tấn',
        'Đường Trịnh Đình Cửu',
        'Cầu Định Công'
      ],
      trafficHotspots: ['Cầu Định Công qua sông Lừ', 'Đường Định Công hẹp'],
      floodVulnerability: 'Khu vực ven sông Lừ trũng nước khi mưa trên 35mm',
      description: 'KĐT Định Công, bệnh viện Bưu Điện, trục đường nối sang Thanh Xuân (Lê Trọng Tấn).'
    },
    {
      id: 'hn-hm-dk',
      ward: 'P. Đại Kim',
      name: 'Phường Đại Kim (Hoàng Mai)',
      district: 'Hoàng Mai',
      lat: 20.9780,
      lng: 105.8190,
      isHub: false,
      mainStreets: [
        'Đường Nguyễn Xiển (Vành Đai 3)',
        'Đường Kim Giang',
        'Đường Nghiêm Xuân Yêm',
        'KĐT Kim Văn Kim Lũ'
      ],
      trafficHotspots: ['Ngã tư Nguyễn Xiển - Nghiêm Xuân Yêm', 'Đoạn chung cư Kim Văn Kim Lũ'],
      floodVulnerability: 'Nguyễn Xiển ven đường gom trũng nước mép vỉa hè',
      description: 'Trục Vành Đai 3 dưới thấp, KĐT Đại Kim, KĐT Kim Văn Kim Lũ mật độ dân cư cao.'
    },

    // ==========================================
    // 11. QUẬN HÀ ĐÔNG (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-hd-ml',
      ward: 'P. Mộ Lao',
      name: 'Phường Mộ Lao (Hà Đông)',
      district: 'Hà Đông',
      lat: 20.9810,
      lng: 105.7850,
      isHub: true,
      mainStreets: [
        'Đường Trần Phú (QL6)',
        'Đường Nguyễn Văn Lộc',
        'Đường Tố Hữu',
        'KĐT Mỗ Lao',
        'Làng Việt Kiều Châu Âu'
      ],
      trafficHotspots: ['Ngã ba Trần Phú - Nguyễn Văn Lộc', 'Ga Metro Phùng Khoang & Văn Quán'],
      floodVulnerability: 'Trục Trần Phú cao ráo, một số ngõ ven sông Nhuệ ngập nhẹ',
      description: 'Cửa ngõ quận Hà Đông, phố ẩm thực Nguyễn Văn Lộc, Làng Việt Kiều Châu Âu, Metro Cát Linh - Hà Đông.'
    },
    {
      id: 'hn-hd-vq',
      ward: 'P. Văn Quán',
      name: 'Phường Văn Quán (Hà Đông)',
      district: 'Hà Đông',
      lat: 20.9780,
      lng: 105.7920,
      isHub: false,
      mainStreets: [
        'Đường Trần Phú (QL6)',
        'Đường 19/5',
        'Đường Chiến Thắng',
        'Đường Nguyễn Khuyến (Hà Đông)',
        'Hồ Văn Quán'
      ],
      trafficHotspots: ['Đường Chiến Thắng đoạn các trường đại học', 'Ngã tư Nguyễn Khuyến - Trần Phú'],
      floodVulnerability: 'Hồ Văn Quán điều hòa nước tốt, ngõ Chiến Thắng trũng nhẹ',
      description: 'KĐT Văn Quán đồng bộ xanh mát, Học viện An ninh nhân dân, Học viện Bưu chính Viễn thông.'
    },
    {
      id: 'hn-hd-vp',
      ward: 'P. Vạn Phúc',
      name: 'Phường Vạn Phúc (Hà Đông)',
      district: 'Hà Đông',
      lat: 20.9820,
      lng: 105.7750,
      isHub: true,
      mainStreets: [
        'Đường Vạn Phúc',
        'Đường Tố Hữu',
        'Phố Lụa Vạn Phúc',
        'Cầu Am',
        'Đường Ngô Quyền'
      ],
      trafficHotspots: ['Ngã tư Vạn Phúc - Tố Hữu', 'Cầu Am'],
      floodVulnerability: 'Ven sông Nhuệ đoạn cầu Am ngập khi mưa to kéo dài',
      description: 'Làng lụa cổ truyền Vạn Phúc nghìn năm tuổi, ngã tư giao lộ Tố Hữu nối liền Nam Từ Liêm.'
    },
    {
      id: 'hn-hd-qt',
      ward: 'P. Quang Trung',
      name: 'Phường Quang Trung (Hà Đông)',
      district: 'Hà Đông',
      lat: 20.9680,
      lng: 105.7720,
      isHub: false,
      mainStreets: [
        'Đường Quang Trung (QL6)',
        'Đường Lê Lợi',
        'Phố Tô Hiệu',
        'Bệnh viện Đa khoa Hà Đông'
      ],
      trafficHotspots: ['Cầu Trắng Hà Đông', 'Khu vực Chợ Hà Đông'],
      floodVulnerability: 'Thoát nước sông Đáy và sông Nhuệ',
      description: 'Trung tâm hành chính cũ thị xã Hà Đông, Cầu Trắng, chợ Hà Đông sầm uất.'
    },
    {
      id: 'hn-hd-dn',
      ward: 'P. Dương Nội',
      name: 'Phường Dương Nội (Hà Đông)',
      district: 'Hà Đông',
      lat: 20.9820,
      lng: 105.7420,
      isHub: true,
      mainStreets: [
        'Đường Tố Hữu',
        'Đường Lê Trọng Tấn (Hà Đông)',
        'KĐT Dương Nội Nam Cường',
        'TTTM Aeon Mall Hà Đông'
      ],
      trafficHotspots: ['Cổng TTTM Aeon Mall Hà Đông', 'Bùng binh Lê Trọng Tấn - Tố Hữu'],
      floodVulnerability: 'Hệ thống hồ Thiên Văn Học thoát nước tốt',
      description: 'Đại siêu thị Aeon Mall Hà Đông, Công viên Thiên Văn Học, KĐT Geleximco & Nam Cường.'
    },
    {
      id: 'hn-hd-yn',
      ward: 'P. Yên Nghĩa',
      name: 'Phường Yên Nghĩa (Hà Đông)',
      district: 'Hà Đông',
      lat: 20.9570,
      lng: 105.7480,
      isHub: false,
      mainStreets: [
        'Đường Quang Trung (QL6)',
        'Bến xe Yên Nghĩa',
        'Ga Metro Yên Nghĩa',
        'QL6 đi Xuân Mai'
      ],
      trafficHotspots: ['Cổng Bến xe Yên Nghĩa', 'Ga cuối tuyến Metro 2A Cát Linh - Hà Đông'],
      floodVulnerability: 'Ven đê sông Đáy an toàn',
      description: 'Đầu mối Bến xe Yên Nghĩa, ga cuối tuyến đường sắt đô thị Cát Linh - Hà Đông, cửa ngõ Tây Nam.'
    },

    // ==========================================
    // 12. QUẬN LONG BIÊN (Các Phường Trọng Điểm)
    // ==========================================
    {
      id: 'hn-lb-bd',
      ward: 'P. Bồ Đề',
      name: 'Phường Bồ Đề (Long Biên)',
      district: 'Long Biên',
      lat: 21.0380,
      lng: 105.8750,
      isHub: true,
      mainStreets: [
        'Đường Nguyễn Văn Cừ',
        'Đường Bồ Đề',
        'Phố Hồng Tiến',
        'Phố Lâm Du',
        'Cầu Chương Dương'
      ],
      trafficHotspots: ['Chân Cầu Chương Dương phía Long Biên', 'Nút giao Nguyễn Văn Cừ - Hồng Tiến'],
      floodVulnerability: 'Khu vực hồ Bồ Đề thoát nước ổn định',
      description: 'Đầu cầu Chương Dương, phố Hồng Tiến hiện đại rộng 40m nối cầu Trần Hưng Đạo tương lai.'
    },
    {
      id: 'hn-lb-nl',
      ward: 'P. Ngọc Lâm',
      name: 'Phường Ngọc Lâm (Long Biên)',
      district: 'Long Biên',
      lat: 21.0480,
      lng: 105.8720,
      isHub: true,
      mainStreets: [
        'Đường Ngọc Lâm',
        'Đường Nguyễn Văn Cừ',
        'Đường Ngô Gia Khảm',
        'Cầu Long Biên',
        'Bến xe Gia Lâm'
      ],
      trafficHotspots: ['Đầu Cầu Long Biên', 'Cổng Bến xe Gia Lâm'],
      floodVulnerability: 'Cao ráo sát đê sông Hồng',
      description: 'Khu phố ẩm thực Ngọc Lâm, chân Cầu Long Biên lịch sử, Bến xe khách Gia Lâm.'
    },
    {
      id: 'hn-lb-sd',
      ward: 'P. Sài Đồng',
      name: 'Phường Sài Đồng (Long Biên)',
      district: 'Long Biên',
      lat: 21.0320,
      lng: 105.9080,
      isHub: false,
      mainStreets: [
        'Đường Nguyễn Văn Linh (QL5)',
        'Phố Sài Đồng',
        'Đường Huỳnh Tấn Phát',
        'KĐT Sài Đồng'
      ],
      trafficHotspots: ['Ngã tư Nguyễn Văn Linh - Sài Đồng', 'Cầu chui QL5'],
      floodVulnerability: 'Thoát nước công nghiệp tốt',
      description: 'Khu công nghiệp Sài Đồng, trục QL5 huyết mạch kết nối Hải Phòng - Quảng Ninh.'
    },
    {
      id: 'hn-lb-vh',
      ward: 'P. Việt Hưng',
      name: 'Phường Việt Hưng (Long Biên)',
      district: 'Long Biên',
      lat: 21.0620,
      lng: 105.9030,
      isHub: false,
      mainStreets: [
        'Đường Ngô Gia Tự',
        'Đường Đoàn Khuê',
        'Đường Lưu Khánh Trung',
        'KĐT Vinhomes Riverside'
      ],
      trafficHotspots: ['Trục Ngô Gia Tự đi Cầu Đuống', 'Nút giao Đoàn Khuê'],
      floodVulnerability: 'Hệ thống kênh đào Vinhomes Riverside tiêu thoát nước cực tốt',
      description: 'Trung tâm hành chính quận Long Biên, KĐT sinh thái Vinhomes Riverside đẳng cấp.'
    },

    // ==========================================
    // 13. KHU VỰC VỆ TINH PHÍA TÂY (HOÀI ĐỨC) - Giáp ranh Nhổn / Lai Xá / Xuân Phương
    // ==========================================
    {
      id: 'hn-hd-kc',
      ward: 'Xã Kim Chung & Di Trạch',
      name: 'Xã Kim Chung & Di Trạch (Hoài Đức)',
      district: 'Hoài Đức',
      lat: 21.0620,
      lng: 105.7150,
      isHub: true,
      mainStreets: [
        'Quốc lộ 32',
        'Đường Lai Xá',
        'Đại lộ KĐT Hinode Royal Park',
        'Đường Vành Đai 3.5'
      ],
      trafficHotspots: ['Cổng chào Hoài Đức trên QL32', 'Nút giao Vành Đai 3.5 - QL32'],
      floodVulnerability: 'Khu vực Lai Xá giáp Nhổn trũng nước khi mưa dông lớn',
      description: 'Cửa ngõ tiếp giáp ga Metro Nhổn và ĐH Thành Đô, KĐT Hinode Royal Park, trục Vành Đai 3.5.'
    },
    {
      id: 'hn-hd-tt',
      ward: 'TT. Trạm Trôi',
      name: 'Thị trấn Trạm Trôi (Hoài Đức)',
      district: 'Hoài Đức',
      lat: 21.0710,
      lng: 105.7050,
      isHub: false,
      mainStreets: [
        'Quốc lộ 32',
        'Đường ĐT422',
        'Đường Vạn Xuân',
        'Đường KĐT Tân Tây Đô'
      ],
      trafficHotspots: ['Ngã tư Trạm Trôi - ĐT422', 'Cổng KĐT Tân Tây Đô'],
      floodVulnerability: 'Đoạn rẽ ĐT422 trũng nước cục bộ khi mưa lớn',
      description: 'Trung tâm hành chính huyện Hoài Đức, KĐT Tân Tây Đô sầm uất trên trục QL32.'
    },
    {
      id: 'hn-hd-vc',
      ward: 'Xã Vân Canh',
      name: 'Xã Vân Canh (Hoài Đức)',
      district: 'Hoài Đức',
      lat: 21.0250,
      lng: 105.7350,
      isHub: false,
      mainStreets: [
        'Đường ĐT70',
        'Đường nối Trịnh Văn Bô kéo dài',
        'KĐT Vườn Cam (Orange Garden)',
        'KĐT Đại học Vân Canh'
      ],
      trafficHotspots: ['Nút giao ĐT70 nối Trịnh Văn Bô', 'Đoạn ngã ba Vân Canh'],
      floodVulnerability: 'Ven sông Nhuệ và sông Đáy',
      description: 'Nối thẳng trục Trịnh Văn Bô (Xuân Phương) sang Vành Đai 3.5, tập trung KĐT Vườn Cam và KĐT Vân Canh.'
    },
    {
      id: 'hn-hd-ak',
      ward: 'Xã An Khánh',
      name: 'Xã An Khánh (Hoài Đức)',
      district: 'Hoài Đức',
      lat: 21.0020,
      lng: 105.7220,
      isHub: false,
      mainStreets: [
        'Đại lộ Thăng Long',
        'Đường Lê Trọng Tấn kéo dài',
        'KĐT Nam An Khánh',
        'KĐT Splendora Bắc An Khánh',
        'Công viên Thiên Đường Bảo Sơn'
      ],
      trafficHotspots: ['Cổng Công viên Thiên Đường Bảo Sơn', 'Hầm chui An Khánh trên Đại lộ Thăng Long'],
      floodVulnerability: 'Hầm chui dân sinh Đại lộ Thăng Long ngập sâu khi mưa to',
      description: 'Quần thể KĐT Nam An Khánh, Splendora, Công viên Thiên Đường Bảo Sơn, nút giao Vành Đai 3.5.'
    }
  ];
});
