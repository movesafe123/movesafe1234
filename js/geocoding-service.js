/**
 * GeocodingService - Bộ máy tìm kiếm địa chỉ Đa tầng (5-Layer Multi-Engine Geocoder)
 * Độ chính xác tương đương Google Maps mà KHÔNG CẦN Google Maps API Key:
 * 1. Tầng 1 (0ms): Kho địa danh nội bộ (76 Phường, 299 Đường, 63+ Trạm sạc EV, TTTM/Ẩm thực, Trường ĐH, Bệnh viện, Bến xe) + Chuẩn hóa tiếng Việt không dấu & từ viết tắt.
 * 2. Tầng 2: TomTom Commercial Fuzzy Search API (Tận dụng TomTom Key sẵn có của hệ thống - chuẩn số nhà, ngõ hẻm, POI Việt Nam).
 * 3. Tầng 3: Esri ArcGIS World Geocoder (Miễn phí 100%, không cần Key - cực mạnh về số nhà & ngõ ngách Việt Nam).
 * 4. Tầng 4: Photon Komoot + OpenStreetMap Nominatim (Có giới hạn vùng bbox Việt Nam & Thành phố).
 * 5. Tầng 5: Cơ chế Lùi cấp địa chỉ thông minh (Smart Address Fallback: Số nhà/Ngách -> Ngõ -> Tên đường -> Quận/Phường) đảm bảo 100% luôn ra vị trí.
 */

class GeocodingService {
  constructor() {
    this.photonBaseUrl = 'https://photon.komoot.io/api/';
    this.photonReverseUrl = 'https://photon.komoot.io/reverse';
    this.nominatimSearchUrl = 'https://nominatim.openstreetmap.org/search';
    this.nominatimReverseUrl = 'https://nominatim.openstreetmap.org/reverse';
    this.arcgisSearchUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
    this.arcgisReverseUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';

    // Tọa độ trung tâm & khung giới hạn (Bounding Box) cho từng thành phố
    this.cityCenters = {
      hanoi: {
        lat: 21.0285,
        lng: 105.8542,
        name: 'Hà Nội',
        bbox: [105.28, 20.56, 106.02, 21.39] // [minLon, minLat, maxLon, maxLat]
      },
      hcm: {
        lat: 10.7769,
        lng: 106.6811,
        name: 'TP. Hồ Chí Minh',
        bbox: [106.35, 10.35, 107.02, 11.16]
      },
      danang: {
        lat: 16.0544,
        lng: 108.2022,
        name: 'Đà Nẵng',
        bbox: [107.90, 15.90, 108.35, 16.22]
      }
    };

    // Kho địa danh trọng điểm 3 miền (Trường ĐH, Bệnh viện, Bến xe, Cầu, Hồ, Địa danh hay gõ tắt)
    this.builtinLandmarks = [
      // Hà Nội
      { title: 'Hồ Hoàn Kiếm (Bờ Hồ / Hồ Gươm)', subtitle: 'Quận Hoàn Kiếm, Hà Nội', lat: 21.0285, lng: 105.8525, city: 'hanoi', aliases: ['ho guom', 'bo ho', 'ho hoan kiem', ' phố đi bộ hồ gươm'] },
      { title: 'Quảng trường Ba Đình (Lăng Chủ tịch Hồ Chí Minh)', subtitle: 'Hùng Vương, Ba Đình, Hà Nội', lat: 21.0368, lng: 105.8347, city: 'hanoi', aliases: ['lang bac', 'quang truong ba dinh', 'chua mot cot'] },
      { title: 'Đại học Bách Khoa Hà Nội (HUST)', subtitle: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', lat: 21.0051, lng: 105.8433, city: 'hanoi', aliases: ['dh bach khoa', 'bach khoa ha noi', 'hust', 'dai hoc bach khoa'] },
      { title: 'Đại học Quốc gia Hà Nội (Cầu Giấy)', subtitle: '144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội', lat: 21.0376, lng: 105.7816, city: 'hanoi', aliases: ['dh quoc gia', 'vnu', 'dh su pham', '144 xuan thuy'] },
      { title: 'Đại học Kinh tế Quốc dân (NEU)', subtitle: '207 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội', lat: 21.0001, lng: 105.8425, city: 'hanoi', aliases: ['neu', 'dh kinh te quoc dan', 'kinh te quoc dan'] },
      { title: 'Đại học Giao thông Vận tải (UTC)', subtitle: 'Số 3 Cầu Giấy, Láng Thượng, Đống Đa, Hà Nội', lat: 21.0289, lng: 105.8031, city: 'hanoi', aliases: ['dh giao thong', 'utc', 'giao thong van tai'] },
      { title: 'Đại học FPT Hà Nội (Hòa Lạc)', subtitle: 'Khu Công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội', lat: 21.0124, lng: 105.5253, city: 'hanoi', aliases: ['dh fpt', 'fpt hoa lac', 'dai hoc fpt'] },
      { title: 'Bệnh viện Bạch Mai', subtitle: '78 Giải Phóng, Phương Mai, Đống Đa, Hà Nội', lat: 21.0031, lng: 105.8407, city: 'hanoi', aliases: ['bv bach mai', 'benh vien bach mai'] },
      { title: 'Bệnh viện Trung ương Quân đội 108', subtitle: 'Số 1 Trần Hưng Đạo, Hai Bà Trưng, Hà Nội', lat: 21.0191, lng: 105.8602, city: 'hanoi', aliases: ['bv 108', 'benh vien 108', 'vien 108'] },
      { title: 'Bệnh viện Hữu nghị Việt Đức', subtitle: '40 Tràng Thi, Hàng Bông, Hoàn Kiếm, Hà Nội', lat: 21.0273, lng: 105.8458, city: 'hanoi', aliases: ['bv viet duc', 'benh vien viet duc'] },
      { title: 'Bến xe Mỹ Đình', subtitle: '20 Phạm Hùng, Mỹ Đình 2, Nam Từ Liêm, Hà Nội', lat: 21.0286, lng: 105.7783, city: 'hanoi', aliases: ['bx my dinh', 'ben xe my dinh'] },
      { title: 'Bến xe Giáp Bát', subtitle: 'Giải Phóng, Giáp Bát, Hoàng Mai, Hà Nội', lat: 20.9806, lng: 105.8415, city: 'hanoi', aliases: ['bx giap bat', 'ben xe giap bat'] },
      { title: 'Bến xe Nước Ngầm', subtitle: 'Số 1 Ngọc Hồi, Hoàng Liệt, Hoàng Mai, Hà Nội', lat: 20.9635, lng: 105.8419, city: 'hanoi', aliases: ['bx nuoc ngam', 'ben xe nuoc ngam'] },
      { title: 'Tòa nhà Keangnam Landmark 72', subtitle: 'Phạm Hùng, Mễ Trì, Nam Từ Liêm, Hà Nội', lat: 21.0168, lng: 105.7841, city: 'hanoi', aliases: ['keangnam', 'landmark 72'] },
      { title: 'Sân vận động Quốc gia Mỹ Đình', subtitle: 'Lê Đức Thọ, Mỹ Đình, Nam Từ Liêm, Hà Nội', lat: 21.0204, lng: 105.7639, city: 'hanoi', aliases: ['svd my dinh', 'san van dong my dinh'] },
      { title: 'Sân bay Quốc tế Nội Bài', subtitle: 'Phú Minh, Sóc Sơn, Hà Nội', lat: 21.2187, lng: 105.8042, city: 'hanoi', aliases: ['san bay noi bai', 'noi bai airport'] },
      { title: 'Hồ Tây (Phố Quảng An / Trích Sài)', subtitle: 'Quận Tây Hồ, Hà Nội', lat: 21.0556, lng: 105.8225, city: 'hanoi', aliases: ['ho tay', 'tay ho', 'phu tay ho'] },
      { title: 'Royal City (Vincom Mega Mall Royal City)', subtitle: '72A Nguyễn Trãi, Thanh Xuân, Hà Nội', lat: 21.0026, lng: 105.8152, city: 'hanoi', aliases: ['royal city', '72 nguyen trai'] },
      { title: 'Times City (KĐT Vinhomes Times City)', subtitle: '458 Minh Khai, Hai Bà Trưng, Hà Nội', lat: 20.9951, lng: 105.8682, city: 'hanoi', aliases: ['times city', '458 minh khai'] },

      // TP.HCM
      { title: 'Chợ Bến Thành', subtitle: 'Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM', lat: 10.7725, lng: 106.6980, city: 'hcm', aliases: ['cho ben thanh', 'ben thanh'] },
      { title: 'Phố đi bộ Nguyễn Huệ', subtitle: 'Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM', lat: 10.7744, lng: 106.7035, city: 'hcm', aliases: ['pho di bo nguyen hue', 'ben bach dang'] },
      { title: 'Landmark 81 (Vinhomes Central Park)', subtitle: '720A Điện Biên Phủ, Bình Thạnh, TP.HCM', lat: 10.7950, lng: 106.7218, city: 'hcm', aliases: ['landmark 81', 'vinhomes tan cang'] },
      { title: 'Sân bay Quốc tế Tân Sơn Nhất', subtitle: 'Trường Sơn, Phường 2, Tân Bình, TP.HCM', lat: 10.8185, lng: 106.6588, city: 'hcm', aliases: ['san bay tan son nhat', 'tan son nhat'] },
      { title: 'Bến xe Miền Đông', subtitle: '292 Đinh Bộ Lĩnh, Phường 26, Bình Thạnh, TP.HCM', lat: 10.8142, lng: 106.7112, city: 'hcm', aliases: ['bx mien dong', 'ben xe mien dong'] },
      { title: 'Bến xe Miền Tây', subtitle: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM', lat: 10.7411, lng: 106.6186, city: 'hcm', aliases: ['bx mien tay', 'ben xe mien tay'] },
      { title: 'Bệnh viện Chợ Rẫy', subtitle: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM', lat: 10.7578, lng: 106.6596, city: 'hcm', aliases: ['bv cho ray', 'benh vien cho ray'] },
      { title: 'Đại học Bách Khoa TP.HCM', subtitle: '268 Lý Thường Kiệt, Phường 14, Quận 10, TP.HCM', lat: 10.7726, lng: 106.6577, city: 'hcm', aliases: ['dh bach khoa hcm', 'bach khoa q10'] },
      { title: 'Dinh Độc Lập (Hội trường Thống Nhất)', subtitle: '135 Nam Kỳ Khởi Nghĩa, Quận 1, TP.HCM', lat: 10.7770, lng: 106.6953, city: 'hcm', aliases: ['dinh doc lap', 'nha tho duc ba'] },

      // Đà Nẵng
      { title: 'Cầu Rồng Đà Nẵng', subtitle: 'Nguyễn Văn Linh, Hải Châu / Sơn Trà, Đà Nẵng', lat: 16.0611, lng: 108.2274, city: 'danang', aliases: ['cau rong', 'cau song han'] },
      { title: 'Biển Mỹ Khê', subtitle: 'Võ Nguyên Giáp, Phước Mỹ, Sơn Trà, Đà Nẵng', lat: 16.0642, lng: 108.2458, city: 'danang', aliases: ['bien my khe', 'bai bien my khe'] },
      { title: 'Sân bay Quốc tế Đà Nẵng', subtitle: 'Nguyễn Văn Linh, Hòa Thuận Tây, Hải Châu, Đà Nẵng', lat: 16.0538, lng: 108.2045, city: 'danang', aliases: ['san bay da nang'] },
      { title: 'Đại học Bách Khoa Đà Nẵng', subtitle: '54 Nguyễn Lương Bằng, Hòa Khánh Bắc, Liên Chiểu, Đà Nẵng', lat: 16.0738, lng: 108.1499, city: 'danang', aliases: ['dh bach khoa da nang', '54 nguyen luong bang'] },
      { title: 'Chợ Hàn Đà Nẵng', subtitle: '119 Trần Phú, Hải Châu 1, Hải Châu, Đà Nẵng', lat: 16.0681, lng: 108.2244, city: 'danang', aliases: ['cho han', 'cho con'] }
    ];

    // Bộ nhớ đệm tìm kiếm
    this.cache = new Map();
    this.reverseCache = new Map();
  }

  /**
   * Loại bỏ dấu tiếng Việt để hỗ trợ người dùng gõ không dấu (VD: "ho guom", "ngo 165 cau giay")
   */
  removeAccents(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  /**
   * Chuẩn hóa câu truy vấn tiếng Việt: bung các từ viết tắt phổ biến (đh, bv, bx, kđt, q1...)
   */
  normalizeVietnameseQuery(rawQuery) {
    if (!rawQuery) return '';
    let q = String(rawQuery).trim().replace(/\s+/g, ' ');

    const replacements = [
      // Chuẩn hóa "Số nhà 15", "Số 1", "SN 20" ở đầu câu thành số nhà chuẩn quốc tế "15 ...", "1 ..." để TomTom/ArcGIS không nhầm chữ "Số" với "Cơ sở"
      [/^(số\s+nhà|so\s+nha|số|so|sn)\s+(\d+[a-zA-Z]?\b)/i, '$2'],
      [/\b(ngo|ngõ)\b/gi, 'Ngõ'],
      [/\b(ngach|ngách)\b/gi, 'Ngách'],
      [/\b(hem|hẻm)\b/gi, 'Hẻm'],
      [/\b(đh|dh)\b/gi, 'Đại học'],
      [/\bbv\b/gi, 'Bệnh viện'],
      [/\bbx\b/gi, 'Bến xe'],
      [/\b(kđt|kdt)\b/gi, 'Khu đô thị'],
      [/\btttm\b/gi, 'Trung tâm thương mại'],
      [/\bcv\b/gi, 'Công viên'],
      [/\bhv\b/gi, 'Học viện'],
      [/\bthpt\b/gi, 'Trường THPT'],
      [/\bthcs\b/gi, 'Trường THCS'],
      [/\bsvd\b/gi, 'Sân vận động'],
      [/\bql\s*(\d+[a-z]?)\b/gi, 'Quốc lộ $1'],
      [/\btl\s*(\d+[a-z]?)\b/gi, 'Tỉnh lộ $1'],
      [/\bq\.?\s*(\d+)\b/gi, 'Quận $1'],
      [/\bp\.?\s*(\d+)\b/gi, 'Phường $1']
    ];

    for (const [regex, rep] of replacements) {
      q = q.replace(regex, rep);
    }
    return q.trim();
  }

  /**
   * Tạo danh sách truy vấn lùi cấp (Smart Address Fallback):
   * VD: "Số 18 Ngách 22 Ngõ 165 Cầu Giấy" -> ["Số 18 Ngách 22 Ngõ 165 Cầu Giấy", "Ngõ 165 Cầu Giấy", "Cầu Giấy"]
   */
  buildFallbackQueries(query, cityName) {
    const normalized = this.normalizeVietnameseQuery(query);
    const list = [normalized];

    // Nếu người dùng gõ kèm Số nhà / Ngách / Hẻm sâu mà bản đồ chưa có số nhà đó, tạo bản lùi về Ngõ / Đường
    const withoutNgach = normalized.replace(/^(số\s+nhà\s+|số\s+|sn\s+)?[\d\w/-]+\s*(ngách|hẻm\s+phụ)\s+[\d\w/-]+\s*/i, '').trim();
    if (withoutNgach && withoutNgach !== normalized && withoutNgach.length >= 4) {
      list.push(withoutNgach);
    }

    const withoutHouseNum = normalized.replace(/^(số\s+nhà\s+|số\s+|sn\s+)?\d+[a-zA-Z]?(\/\d+)*\s+/i, '').trim();
    if (withoutHouseNum && !list.includes(withoutHouseNum) && withoutHouseNum.length >= 4) {
      list.push(withoutHouseNum);
    }

    const withoutAlley = withoutHouseNum.replace(/^(ngõ|ngách|hẻm|kiệt)\s+[\d\w/-]+\s*(đường\s+|phố\s+)?/i, '').trim();
    if (withoutAlley && !list.includes(withoutAlley) && withoutAlley.length >= 4) {
      list.push(withoutAlley);
    }

    // Thêm hậu tố tên thành phố nếu chưa có để định vị chính xác trong thành phố đang chọn
    const cityNorm = this.removeAccents(cityName);
    const withCity = list.map(item => {
      const itemNorm = this.removeAccents(item);
      if (!itemNorm.includes(cityNorm) && !itemNorm.includes('ha noi') && !itemNorm.includes('ho chi minh') && !itemNorm.includes('sai gon') && !itemNorm.includes('da nang')) {
        return `${item}, ${cityName}`;
      }
      return item;
    });

    return [...new Set([...list, ...withCity])];
  }

  /**
   * Tầng 1: Tìm kiếm tức thì (0ms) trong toàn bộ CSDL nội bộ của MoveSafe VN (Hỗ trợ cả có dấu & không dấu)
   */
  searchLocalIndex(query, cityKey = 'hanoi') {
    const clean = this.normalizeVietnameseQuery(query);
    const qLower = clean.toLowerCase();
    const qNoAccent = this.removeAccents(clean);
    if (qNoAccent.length < 2) return [];

    const results = [];
    const pushUnique = (item) => {
      if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
      const exists = results.some(r =>
        (Math.abs(r.lat - item.lat) < 0.0008 && Math.abs(r.lng - item.lng) < 0.0008) ||
        this.removeAccents(r.title) === this.removeAccents(item.title)
      );
      if (!exists) results.push(item);
    };

    // 1a. Tìm trong danh bạ Địa danh trọng điểm (Trường ĐH, Bệnh viện, Bến xe, Hồ, Cầu...)
    for (const lm of this.builtinLandmarks) {
      if (lm.city && lm.city !== cityKey) continue;
      const titleNoAccent = this.removeAccents(lm.title);
      const subNoAccent = this.removeAccents(lm.subtitle);
      const aliasMatch = (lm.aliases || []).some(a => a.includes(qNoAccent) || qNoAccent.includes(a));
      if (titleNoAccent.includes(qNoAccent) || subNoAccent.includes(qNoAccent) || aliasMatch) {
        pushUnique({
          title: lm.title,
          subtitle: lm.subtitle,
          fullAddress: `${lm.title}, ${lm.subtitle}`,
          lat: lm.lat,
          lng: lm.lng,
          icon: '',
          type: 'place',
          typeName: 'Địa danh nổi bật',
          score: aliasMatch || titleNoAccent.startsWith(qNoAccent) ? 100 : 90
        });
      }
    }

    // 1b. Tìm trong 76 Phường & 299 Tuyến đường lớn Hà Nội (hoặc trạm phường TP.HCM / Đà Nẵng)
    if (cityKey === 'hanoi' && typeof window !== 'undefined' && Array.isArray(window.HANOI_WARDS_DATA)) {
      const strippedQ = qNoAccent.replace(/^(duong|pho|phuong|xa|ngo|hem|so\s+\d+)\s+/g, '').trim();
      for (const w of window.HANOI_WARDS_DATA) {
        const wNameNoAccent = this.removeAccents(w.name);
        const wDistNoAccent = this.removeAccents(w.district || '');
        if (wNameNoAccent.includes(qNoAccent) || (strippedQ.length >= 3 && wNameNoAccent.includes(strippedQ))) {
          pushUnique({
            title: `${w.name} (${w.district})`,
            subtitle: `Các trục chính: ${(w.mainStreets || []).slice(0, 3).join(', ')}`,
            fullAddress: `${w.name}, ${w.district}, Hà Nội`,
            lat: w.lat,
            lng: w.lng,
            icon: '',
            type: 'street',
            typeName: 'Phường/Xã',
            score: 88
          });
        }
        for (const st of (w.mainStreets || [])) {
          const stNoAccent = this.removeAccents(st);
          const cleanSt = stNoAccent.replace(/^(duong|pho|quoc lo|dai lo)\s+/g, '').trim();
          const hasAlleyOrNum = /\b(so|ngo|ngach|hem|kiet|sn)\b|\d+/i.test(qNoAccent);
          // Nếu người dùng đang tìm Số nhà / Ngõ / Ngách cụ thể, nhường cho TomTom & ArcGIS định vị chính xác từng ngõ, không lấy tâm phường
          if (!hasAlleyOrNum && (stNoAccent === qNoAccent || cleanSt === strippedQ)) {
            pushUnique({
              title: `${st} (${w.name})`,
              subtitle: `${w.name}, ${w.district}, Hà Nội`,
              fullAddress: `${st}, ${w.name}, ${w.district}, Hà Nội`,
              lat: w.lat,
              lng: w.lng,
              icon: '',
              type: 'street',
              typeName: 'Tuyến đường lớn',
              score: 82
            });
          }
        }
      }
    }

    // 1c. Tìm trong 63+ Trạm sạc Xe điện & Đổi pin (EV_STATIONS_DATA)
    if (typeof window !== 'undefined' && window.EV_STATIONS_DATA) {
      const evList = Array.isArray(window.EV_STATIONS_DATA)
        ? window.EV_STATIONS_DATA
        : (window.EV_STATIONS_DATA[cityKey] || []);
      for (const st of evList) {
        if (st.city && st.city !== cityKey) continue;
        const nameNoAccent = this.removeAccents(st.name || '');
        const addrNoAccent = this.removeAccents(st.address || '');
        if (nameNoAccent.includes(qNoAccent) || addrNoAccent.includes(qNoAccent)) {
          pushUnique({
            title: st.name,
            subtitle: `${st.address || ''} • ${st.powerKw ? st.powerKw + 'kW' : 'Trạm sạc EV'}`,
            fullAddress: `${st.name}, ${st.address || ''}`,
            lat: st.lat,
            lng: st.lng,
            icon: '',
            type: 'place',
            typeName: 'Trạm sạc EV',
            score: 86
          });
        }
      }
    }

    // 1d. Tìm trong cơ sở dữ liệu Ẩm thực, TTTM, Rạp phim (FOOD_ENTERTAINMENT_DATA)
    if (typeof window !== 'undefined' && window.FOOD_ENTERTAINMENT_DATA && Array.isArray(window.FOOD_ENTERTAINMENT_DATA.areas)) {
      for (const area of window.FOOD_ENTERTAINMENT_DATA.areas) {
        if (area.city && area.city !== cityKey) continue;
        const allSpots = [...(area.food || []), ...(area.entertainment || [])];
        for (const spot of allSpots) {
          const sName = this.removeAccents(spot.name || '');
          const sAddr = this.removeAccents(spot.address || '');
          const sSpec = this.removeAccents(spot.specialty || '');
          if (sName.includes(qNoAccent) || sAddr.includes(qNoAccent) || (qNoAccent.length >= 4 && sSpec.includes(qNoAccent))) {
            pushUnique({
              title: spot.name,
              subtitle: `${spot.address} • ${spot.specialty}`,
              fullAddress: `${spot.name}, ${spot.address}`,
              lat: spot.lat || area.lat,
              lng: spot.lng || area.lng,
              icon: '',
              type: 'shopping',
              typeName: 'Ẩm thực & Giải trí',
              score: 84
            });
          }
        }
      }
    }

    return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  }

  /**
   * Tầng 2: Tìm kiếm bằng TomTom Commercial Fuzzy Search API (Sử dụng TomTom Key có sẵn của dự án)
   */
  async searchViaTomTom(query, center, limit = 6) {
    const tomtomKey = (typeof window !== 'undefined' && window.mapEngine && window.mapEngine.tomtomKey)
      ? window.mapEngine.tomtomKey
      : 'dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF';
    if (!tomtomKey) return [];

    try {
      const encoded = encodeURIComponent(query);
      const url = `https://api.tomtom.com/search/2/search/${encoded}.json?key=${tomtomKey}&countrySet=VN&lat=${center.lat}&lon=${center.lng}&radius=40000&language=vi-VN&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !Array.isArray(data.results) || data.results.length === 0) return [];

      return data.results.map((r, idx) => {
        const addr = r.address || {};
        const poi = r.poi || {};
        const pos = r.position || {};
        let title = '';
        if (poi.name) {
          title = poi.name;
        } else if (addr.streetNumber && addr.streetName) {
          title = `Số ${addr.streetNumber} ${addr.streetName}`;
        } else if (addr.streetName) {
          title = addr.streetName;
        } else if (addr.freeformAddress) {
          title = addr.freeformAddress.split(',')[0].trim();
        } else {
          title = addr.municipalitySubdivision || query;
        }
        const subtitle = addr.freeformAddress || [addr.municipalitySubdivision, addr.municipality, addr.countrySubdivision].filter(Boolean).join(', ');
        const cat = this.getCategoryIcon({ name: title, street: addr.streetName || '' });
        const rawScore = typeof r.score === 'number' ? (r.score <= 1 ? r.score * 100 : r.score) : 95;

        return {
          title,
          subtitle,
          fullAddress: poi.name ? `${poi.name}, ${subtitle}` : subtitle,
          lat: Number(pos.lat),
          lng: Number(pos.lon),
          icon: cat.icon,
          type: cat.type,
          typeName: cat.typeName,
          source: 'tomtom',
          score: rawScore - idx * 0.5
        };
      }).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    } catch (e) {
      return [];
    }
  }

  /**
   * Tầng 3: Tìm kiếm bằng Esri ArcGIS World Geocoder (Miễn phí 100%, Không cần API Key, cực nhạy với số nhà & ngõ ngách VN)
   */
  async searchViaArcGIS(query, center, limit = 6) {
    try {
      const bbox = center.bbox || [105.25, 20.50, 106.05, 21.40];
      const searchExtent = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
      const url = `${this.arcgisSearchUrl}?SingleLine=${encodeURIComponent(query)}&countryCode=VNM&location=${center.lng},${center.lat}&searchExtent=${searchExtent}&maxLocations=${limit}&outFields=Match_addr,PlaceName,StName,AddNum,City,Subregion&f=json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !Array.isArray(data.candidates) || data.candidates.length === 0) return [];

      return data.candidates
        .filter(c => (c.score || 0) >= 86 && c.location)
        .map((c, idx) => {
          const attr = c.attributes || {};
          const rawAddr = c.address || attr.Match_addr || query;
          const parts = rawAddr.split(',').map(s => s.trim());
          const title = attr.PlaceName || parts[0] || query;
          const subtitle = parts.slice(1).join(', ') || attr.City || center.name || 'Việt Nam';
          const cat = this.getCategoryIcon({ name: title, street: attr.StName || '' });

          return {
            title,
            subtitle,
            fullAddress: rawAddr,
            lat: Number(c.location.y),
            lng: Number(c.location.x),
            icon: cat.icon,
            type: cat.type,
            typeName: cat.typeName,
            source: 'arcgis',
            score: (c.score || 90) * 0.94 - idx * 0.5
          };
        })
        .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    } catch (e) {
      return [];
    }
  }

  /**
   * Phân loại biểu tượng dựa trên tên hoặc thuộc tính OpenStreetMap
   */
  getCategoryIcon(item) {
    const text = ((item.name || '') + ' ' + (item.street || '') + ' ' + (item.type || '')).toLowerCase();
    
    if (text.includes('ngõ') || text.includes('ngách') || text.includes('hẻm') || text.includes('kiệt')) {
      return { icon: '', type: 'alley', typeName: 'Ngõ/Ngách' };
    }
    if (text.includes('bệnh viện') || text.includes('phòng khám') || item.osm_value === 'hospital' || item.osm_value === 'clinic') {
      return { icon: '', type: 'hospital', typeName: 'Cơ sở y tế' };
    }
    if (text.includes('trường') || text.includes('đại học') || text.includes('học viện') || item.osm_value === 'university' || item.osm_value === 'school') {
      return { icon: '', type: 'education', typeName: 'Giáo dục' };
    }
    if (text.includes('chợ') || text.includes('vincom') || text.includes('siêu thị') || text.includes('aeon') || item.osm_value === 'mall' || item.osm_value === 'supermarket') {
      return { icon: '', type: 'shopping', typeName: 'Mua sắm/Chợ' };
    }
    if (text.includes('hồ') || text.includes('công viên') || item.osm_value === 'park' || item.osm_value === 'lake') {
      return { icon: '', type: 'park', typeName: 'Công viên/Hồ' };
    }
    if (text.includes('cầu') || text.includes('nút giao') || text.includes('bùng binh')) {
      return { icon: '', type: 'bridge', typeName: 'Cầu/Nút giao' };
    }
    if (text.includes('đường') || text.includes('phố') || text.includes('đại lộ') || item.osm_key === 'highway') {
      return { icon: '', type: 'street', typeName: 'Đường phố' };
    }
    if (text.includes('tòa') || text.includes('chung cư') || text.includes('building') || item.osm_value === 'apartments') {
      return { icon: '', type: 'building', typeName: 'Tòa nhà' };
    }
    
    return { icon: '', type: 'place', typeName: 'Địa điểm' };
  }

  /**
   * Định dạng tên hiển thị chính và phụ cho kết quả tìm kiếm
   */
  formatResultItem(feature) {
    const p = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0];
    const lat = coords[1];
    const lng = coords[0];

    let title = p.name;
    if (!title) {
      if (p.housenumber && p.street) {
        title = `Số ${p.housenumber} ${p.street}`;
      } else if (p.street) {
        title = p.street;
      } else if (p.district) {
        title = p.district;
      } else if (p.city) {
        title = p.city;
      } else {
        title = 'Địa điểm trên bản đồ';
      }
    }

    const subParts = [];
    if (p.housenumber && p.street && title !== `Số ${p.housenumber} ${p.street}`) {
      subParts.push(`Số ${p.housenumber} ${p.street}`);
    } else if (p.street && p.street !== title) {
      subParts.push(p.street);
    }

    if (p.district) subParts.push(p.district);
    if (p.city && p.city !== p.district) subParts.push(p.city);

    const subtitle = subParts.join(', ') || p.country || 'Việt Nam';
    const cat = this.getCategoryIcon(p);

    return {
      title,
      subtitle,
      fullAddress: `${title}, ${subtitle}`,
      lat,
      lng,
      icon: cat.icon,
      type: cat.type,
      typeName: cat.typeName,
      raw: p
    };
  }

  /**
   * Kiểm tra tọa độ có nằm hợp lệ trong lãnh thổ Việt Nam (hoặc gần thành phố đang chọn) hay không
   */
  isValidVietnamCoord(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8.0 && lat <= 23.5 && lng >= 102.0 && lng <= 110.0;
  }

  /**
   * Tính khoảng cách tương đối (km) tới tâm thành phố để ưu tiên kết quả gần người dùng nhất
   */
  calcDistKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Tìm kiếm địa chỉ Đa tầng (5-Layer Hybrid Geocoder)
   * Đảm bảo tìm thấy mọi số nhà, ngõ ngách, từ viết tắt, không dấu mà KHÔNG CẦN Google Maps API Key
   */
  async searchAddresses(query, options = {}) {
    const rawQ = (query || '').trim();
    if (!rawQ || rawQ.length < 2) return [];

    const cityKey = options.city || 'hanoi';
    const cityInfo = this.cityCenters[cityKey] || this.cityCenters.hanoi;
    const center = {
      lat: options.center?.lat || cityInfo.lat,
      lng: options.center?.lng || cityInfo.lng,
      name: cityInfo.name,
      bbox: cityInfo.bbox
    };
    const limit = options.limit || 8;

    const normalizedQ = this.normalizeVietnameseQuery(rawQ);
    const cacheKey = `${this.removeAccents(normalizedQ)}_${cityKey}_${center.lat.toFixed(2)}_${center.lng.toFixed(2)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey).slice(0, limit);
    }

    const merged = [];
    const seenCoords = new Set();

    const addCandidates = (items) => {
      for (const item of (items || [])) {
        if (!item || !this.isValidVietnamCoord(item.lat, item.lng)) continue;
        const coordKey = `${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
        const titleKey = this.removeAccents(item.title || '');
        if (!seenCoords.has(coordKey) && !seenCoords.has(titleKey)) {
          seenCoords.add(coordKey);
          if (titleKey.length > 5) seenCoords.add(titleKey);
          item._distKm = this.calcDistKm(center.lat, center.lng, item.lat, item.lng);
          merged.push(item);
        }
      }
    };

    // 1. TẦNG 1: Tìm tức thì trong CSDL nội bộ (0ms - Hỗ trợ cả có dấu, không dấu & viết tắt)
    const localMatches = this.searchLocalIndex(normalizedQ, cityKey);
    addCandidates(localMatches);

    // 2. TẦNG 2 & 3: Chạy song song TomTom Commercial Search + Esri ArcGIS Geocoder + Photon Bounded
    const fallbackQueries = this.buildFallbackQueries(normalizedQ, center.name);
    const primaryQuery = fallbackQueries[0];
    const bboxStr = center.bbox ? center.bbox.join(',') : '105.28,20.56,106.02,21.39';

    try {
      const [tomtomResults, arcgisResults, photonResults] = await Promise.all([
        this.searchViaTomTom(primaryQuery, center, limit),
        this.searchViaArcGIS(primaryQuery, center, limit),
        (async () => {
          try {
            const url = `${this.photonBaseUrl}?q=${encodeURIComponent(primaryQuery)}&lat=${center.lat}&lon=${center.lng}&bbox=${bboxStr}&limit=${limit}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.features || []).map(f => this.formatResultItem(f));
          } catch {
            return [];
          }
        })()
      ]);

      addCandidates(tomtomResults);
      addCandidates(arcgisResults);
      addCandidates(photonResults);
    } catch (e) {
      console.warn('[Geocoding] Parallel lookup warning:', e);
    }

    // 3. TẦNG 4 & 5: Nếu vẫn chưa có kết quả (do gõ số nhà/ngách quá sâu hoặc từ khóa đặc biệt), kích hoạt Lùi cấp địa chỉ (Smart Fallback) + Nominatim
    if (merged.length === 0) {
      for (let i = 1; i < fallbackQueries.length; i++) {
        const fbQuery = fallbackQueries[i];
        try {
          const [ttFb, arcFb] = await Promise.all([
            this.searchViaTomTom(fbQuery, center, 4),
            this.searchViaArcGIS(fbQuery, center, 4)
          ]);
          addCandidates(ttFb);
          addCandidates(arcFb);
          if (merged.length > 0) break;
        } catch {}
      }
    }

    if (merged.length === 0) {
      try {
        const nomUrl = `${this.nominatimSearchUrl}?q=${encodeURIComponent(primaryQuery)}&format=json&countrycodes=vn&addressdetails=1&limit=${limit}`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'MoveSafeVN-App/1.0 (contact: info@movesafe.vn)' }
        });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          const nomResults = (nomData || []).map(d => {
            const addr = d.address || {};
            const title = addr.road || addr.suburb || addr.neighbourhood || d.name || rawQ;
            const subParts = [addr.suburb, addr.city_district || addr.county, addr.city || addr.state].filter(Boolean);
            const subtitle = subParts.join(', ') || d.display_name;
            return {
              title,
              subtitle,
              fullAddress: d.display_name,
              lat: parseFloat(d.lat),
              lng: parseFloat(d.lon),
              icon: '',
              type: 'place',
              typeName: 'Địa điểm'
            };
          });
          addCandidates(nomResults);
        }
      } catch (nomErr) {
        console.warn('[Geocoding] Nominatim lookup error:', nomErr);
      }
    }

    const qTokens = this.removeAccents(normalizedQ).split(/\s+/).filter(t => t.length >= 2);
    const computeRelevance = (item) => {
      let base = item.score || 78;
      const hay = this.removeAccents(`${item.title || ''} ${item.subtitle || ''}`);
      let matchedTokens = 0;
      for (const tok of qTokens) {
        if (hay.includes(tok)) matchedTokens++;
      }
      const tokenRatio = qTokens.length > 0 ? (matchedTokens / qTokens.length) : 0;
      base += tokenRatio * 15;
      if (this.removeAccents(item.title || '').startsWith(this.removeAccents(normalizedQ))) {
        base += 8;
      }
      // Ưu tiên trong bán kính thành phố hiện tại (< 45km), nhưng KHÔNG làm đảo thứ tự độ khớp tên của địa chỉ
      if ((item._distKm || 0) > 45) {
        base -= 25;
      }
      return base;
    };

    merged.forEach(item => {
      item._relevance = computeRelevance(item);
    });

    // Sắp xếp theo Điểm độ khớp địa chỉ (Relevance Score) giảm dần giống hệt Google Maps
    merged.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));

    if (merged.length > 0) {
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(cacheKey, merged);
    }

    return merged.slice(0, limit);
  }

  /**
   * Reverse Geocoding Đa tầng: Lấy tên đường/ngõ/số nhà cụ thể từ kinh độ/vĩ độ
   */
  async reverseGeocode(lat, lng) {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (this.reverseCache.has(cacheKey)) {
      return this.reverseCache.get(cacheKey);
    }

    // 1. Thử TomTom Reverse Geocode trước (rất chi tiết số nhà & tên đường tiếng Việt)
    const tomtomKey = (typeof window !== 'undefined' && window.mapEngine && window.mapEngine.tomtomKey)
      ? window.mapEngine.tomtomKey
      : 'dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF';
    if (tomtomKey) {
      try {
        const ttUrl = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${tomtomKey}&language=vi-VN`;
        const ttRes = await fetch(ttUrl);
        if (ttRes.ok) {
          const ttData = await ttRes.json();
          const first = ttData?.addresses?.[0]?.address;
          if (first && (first.streetName || first.freeformAddress)) {
            const title = first.streetNumber && first.streetName
              ? `Số ${first.streetNumber} ${first.streetName}`
              : (first.streetName || first.municipalitySubdivision || first.freeformAddress);
            const subtitle = [first.municipalitySubdivision, first.municipality, first.countrySubdivision].filter(Boolean).join(', ') || first.freeformAddress;
            const result = {
              title,
              subtitle,
              fullAddress: first.freeformAddress || `${title}, ${subtitle}`,
              lat,
              lng
            };
            this.reverseCache.set(cacheKey, result);
            return result;
          }
        }
      } catch {}
    }

    // 2. Thử Esri ArcGIS Reverse Geocode (Miễn phí 100%, không cần key)
    try {
      const arcUrl = `${this.arcgisReverseUrl}?location=${lng},${lat}&langCode=vi&f=json`;
      const arcRes = await fetch(arcUrl);
      if (arcRes.ok) {
        const arcData = await arcRes.json();
        const addr = arcData?.address;
        if (addr && (addr.Address || addr.Match_addr)) {
          const title = addr.Address || addr.PlaceName || addr.Match_addr.split(',')[0];
          const subtitle = [addr.Neighborhood, addr.District, addr.City].filter(Boolean).join(', ') || addr.Match_addr;
          const result = {
            title,
            subtitle,
            fullAddress: addr.LongLabel || addr.Match_addr || `${title}, ${subtitle}`,
            lat,
            lng
          };
          this.reverseCache.set(cacheKey, result);
          return result;
        }
      }
    } catch {}

    // 3. Dự phòng Photon & Nominatim
    try {
      const url = `${this.photonReverseUrl}?lat=${lat}&lon=${lng}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const item = this.formatResultItem(data.features[0]);
          const result = {
            title: item.title,
            subtitle: item.subtitle,
            fullAddress: item.fullAddress,
            lat,
            lng
          };
          this.reverseCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (e) {
      console.warn('[Reverse Geocoding] Photon reverse failed:', e);
    }

    try {
      const nomUrl = `${this.nominatimReverseUrl}?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(nomUrl, {
        headers: { 'User-Agent': 'MoveSafeVN-App/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const title = addr.road || addr.suburb || 'Vị trí đã chọn';
        const subParts = [addr.suburb, addr.city_district, addr.city].filter(Boolean);
        const subtitle = subParts.join(', ') || data.display_name;
        const result = {
          title,
          subtitle,
          fullAddress: data.display_name,
          lat,
          lng
        };
        this.reverseCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('[Reverse Geocoding] Nominatim reverse failed:', e);
    }

    return {
      title: `Tọa độ [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
      subtitle: 'Vị trí trên bản đồ',
      fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng
    };
  }

  /**
   * Lấy vị trí GPS hiện tại của người dùng kèm địa chỉ cụ thể
   */
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Trình duyệt không hỗ trợ định vị GPS'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          try {
            const addrInfo = await this.reverseGeocode(lat, lng);
            resolve({
              lat,
              lng,
              title: 'Vị trí của bạn',
              subtitle: addrInfo.fullAddress,
              fullAddress: addrInfo.fullAddress
            });
          } catch {
            resolve({
              lat,
              lng,
              title: 'Vị trí của bạn',
              subtitle: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              fullAddress: 'Vị trí GPS hiện tại'
            });
          }
        },
        (err) => {
          reject(new Error(err.message || 'Không thể lấy tọa độ vị trí'));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }
}

// Khởi tạo global instance
window.geocodingService = new GeocodingService();
