const axios = require('axios');
const botService = require('./bot-service');
const HANOI_WARDS_DATA = require('../js/hanoi-wards-streets');
const FOOD_ENTERTAINMENT_DATA = require('../js/food-entertainment-data');
const webEventService = require('./web-event-service');

function normalizeVi(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcDistM(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 999999;
  }
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

class AIAssistantService {

  async askGemini(query, context = {}, history = []) {
    let city = 'hanoi';
    if (context.city) {
      city = context.city;
    } else if (context.userCity) {
      const c = context.userCity.toLowerCase();
      if (c.includes('hồ chí minh') || c.includes('hcm') || c.includes('sài gòn')) city = 'hcm';
      else if (c.includes('đà nẵng') || c.includes('da nang')) city = 'danang';
    }
    return await this.processQuery({
      query,
      city,
      context
    });
  }

  constructor() {
    this._modelCooldowns = new Map();
  }

  stripEmojis(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^ +/gm, '')
      .trim();
  }

  /**
   * Phân tích câu hỏi tìm đường tự nhiên tiếng Việt (hỗ trợ cả hội thoại đa lượt - Multi-turn)
   * Xử lý:
   * 1. Lộ trình xuôi: "từ an trai ra bến xe mỹ đình trong 2h tới có bị tắc đường không"
   * 2. Lộ trình ngược (Điểm đến trước, điểm đi sau): "muốn nghe nhạc tại cafe cộng đối diện svđ mỹ đình đi từ an trai ra đường nào đỡ tắc"
   * 3. Tình huống giả định né / cấm đường: "giả sử đường trịnh văn bô cấm đường tôi đi từ kđt vân canh ra bến xe mỹ đình"
   * 4. Câu hỏi nối tiếp (Multi-turn): "thế còn chiều ngược lại?", "nếu đi ô tô thì sao?", "giả sử đường xuân thủy bị tắc thì đi lối nào?"
   */
  parseRouteQuery(query, sessionMemory = {}) {
    if (!query) return null;
    const lower = query.toLowerCase().trim();

    // 0. Nhận diện câu hỏi nối tiếp dựa trên trí nhớ hội thoại (Multi-turn Route Continuity)
    const lastOrig = sessionMemory?.lastOrigin || null;
    const lastDest = sessionMemory?.lastDestination || null;

    // 1. Trích xuất điều kiện giả định cấm đường / né đường (Hypothetical Road Closure / Avoidance)
    let avoidRoad = null;
    const avoidPatterns = [
      /giả\s+sử(?:\s+như)?\s+(?:đường\s+|tuyến\s+|phố\s+|cầu\s+|nút\s+giao\s+)?(.+?)\s+(?:bị\s+)?(?:cấm\s+đường|cấm|đóng\s+đường|ngập\s+sâu|ngập|tắc\s+cứng|kẹt\s+xe|tắc|không\s+đi\s+được)/i,
      /nếu(?:\s+như)?\s+(?:đường\s+|tuyến\s+|phố\s+|cầu\s+)?(.+?)\s+(?:bị\s+)?(?:cấm\s+đường|cấm|đóng\s+đường|ngập\s+sâu|ngập|tắc)/i,
      /(?:tránh|né|không\s+đi\s+qua|không\s+muốn\s+đi\s+qua|bỏ\s+qua)\s+(?:đường\s+|tuyến\s+|phố\s+)?(.+?)(?:\s+(?:thì|tôi|mình|đi|bạn|nhé)|[,.?]|$)/i
    ];

    for (const pat of avoidPatterns) {
      const m = query.match(pat);
      if (m && m[1]) {
        const candidate = m[1].replace(/^(?:đường|phố|tuyến)\s+/i, '').trim();
        if (candidate.length >= 2 && !candidate.match(/^(?:tôi|mình|bạn|gì|nào|ngập|tắc)$/i)) {
          avoidRoad = candidate;
          break;
        }
      }
    }

    // 2. Trích xuất mốc thời gian dự báo nếu có (VD: "trong 2h tới", "sau 1 giờ nữa", "3 tiếng tới")
    let timeOffsetHours = 0;
    const timeMatch = query.match(/(?:trong|sau|khoảng)?\s*(\d+)\s*(?:h|giờ|tiếng)\s*(?:tới|nữa|sau)?/i);
    if (timeMatch && timeMatch[1]) {
      timeOffsetHours = Math.min(3, Math.max(0, parseInt(timeMatch[1], 10)));
    }

    // 2b. Trích xuất phương tiện nếu người dùng yêu cầu đổi phương tiện
    let requestedVehicle = null;
    if (/(?:ô\s*tô\s*điện|xe\s*hơi\s*điện|ecar)/i.test(lower)) requestedVehicle = 'ecar';
    else if (/(?:xe\s*máy\s*điện|xe\s*đạp\s*điện|ebike)/i.test(lower)) requestedVehicle = 'ebike';
    else if (/(?:đi\s+ô\s*tô|bằng\s+ô\s*tô|xe\s+ô\s*tô|xe\s+hơi|4\s+bánh)/i.test(lower)) requestedVehicle = 'car';
    else if (/(?:đi\s+xe\s*máy|bằng\s+xe\s*máy|2\s+bánh|xe\s+gắn\s+máy)/i.test(lower)) requestedVehicle = 'motorbike';

    // 2c. Kiểm tra câu hỏi đảo chiều lộ trình ("chiều ngược lại", "đi ngược lại", "quay về")
    if (lastOrig && lastDest && /(?:chiều\s+ngược\s+lại|hướng\s+ngược\s+lại|đi\s+ngược\s+lại|lượt\s+về|chiều\s+về|quay\s+lại\s+từ\s+đó)/i.test(lower)) {
      return {
        origin: lastDest,
        destination: lastOrig,
        timeOffsetHours,
        avoidRoad,
        requestedVehicle,
        isFollowUpRoute: true
      };
    }

    // 3. Tách câu hỏi làm sạch để tìm điểm đi / điểm đến
    let cleanQuery = query;
    for (const pat of avoidPatterns) {
      cleanQuery = cleanQuery.replace(pat, ' ');
    }

    let cleaned = cleanQuery
      .replace(/(?:trong|sau|khoảng)\s*\d+\s*(?:h|giờ|tiếng|phút|p)\s*(?:tới|nữa|sau)?.*$/i, '')
      .replace(/\s+\d+\s*(?:h|giờ|tiếng)\s*(?:tới|nữa).*$/i, '')
      .replace(/\s+(?:đi\s+đường\s+nào|đường\s+nào\s+đư\s+tác|đường\s+nào\s+đỡ\s+tắc|đường\s+nào\s+đỡ\s+ngập|đường\s+nào\s+thông\s+thoáng|đường\s+nào\s+nhanh\s+nhất|đường\s+nào|đi\s+lối\s+nào|như\s+thế\s+nào|thế\s+nào|ra\s+sao|hết\s+bao\s+lâu|mất\s+bao\s+lâu).*$/i, '')
      .replace(/\s+(?:hiện tại|bây giờ|lúc này|hôm nay|chiều nay|tối nay|sáng nay|cuối tuần này|thứ \d+ này)?\s*(?:có bị|có đang|có|bị|đang)?\s*(?:tắc đường|kẹt xe|ùn tắc|tắc|kẹt|ngập nước|ngập úng|ngập|mưa|thông thoáng|đi được).*$/i, '')
      .replace(/\s+(?:không|chưa|nhỉ|vậy|ạ|nhé|\?|\.|!)+$/i, '')
      .trim();

    // Pattern A: Điểm đến trước, điểm đi sau
    const destFirstRegex = /(?:tôi\s+|mình\s+)?(?:muốn|cần|định|thích)?\s*(?:nghe\s+nhạc|uống\s+cafe|cafe|ăn\s+uống|xem\s+phim|đi\s+chơi|đến|tới|ghé|về|ở|đi)?\s*(?:tại|ở|đến|tới)\s+(.+?)\s+(?:đi\s+)?từ\s+(.+?)(?:\s+(?:ra|vào|đến|theo|qua)\s+.*|\s*$)/i;
    const matchA = cleaned.match(destFirstRegex);
    if (matchA && matchA[1] && matchA[2]) {
      const rawDest = matchA[1].replace(/^(?:tôi|mình|bạn)\s+/i, '').trim();
      let rawOrig = matchA[2]
        .replace(/\s+(?:ra|vào|đến|theo|qua)\s+.*$/i, '')
        .replace(/\s+(?:đường\s+nào.*|đường\s+.*|thế\s+nào.*|ra\s+sao.*)$/i, '')
        .replace(/\s+(?:ra|vào|đến|theo|qua)$/i, '')
        .trim();

      if (rawDest.length >= 2 && rawOrig.length >= 2 && !rawDest.match(/^(?:đường|đường nào)$/i)) {
        return {
          origin: rawOrig,
          destination: rawDest,
          timeOffsetHours,
          avoidRoad,
          requestedVehicle
        };
      }
    }

    // Pattern B: Điểm đi trước, điểm đến sau thông thường ("từ A đến/ra/về/lên/xuống/sang B")
    const routeRegex = /(?:tìm đường\s+|chỉ đường\s+|lộ trình\s+|đi\s+|di chuyển\s+)?từ\s+(.+?)\s+(?:đến|về|sang|qua|tới|ra|vào|lên|xuống)\s+(.+)$/i;
    const matchB = cleaned.match(routeRegex);
    if (matchB && matchB[1] && matchB[2]) {
      const orig = matchB[1]
        .replace(/^(?:tôi|mình|bạn|hãy|giúp|muốn|cần|đi|đang\s+ở)\s+/i, '')
        .replace(/\s+(?:muốn|cần|định|để)\s*$/i, '')
        .replace(/[,.?!]+$/g, '')
        .trim();

      let dest = matchB[2]
        .replace(/\s+(?:uống\s+cafe|ăn\s+gì|ăn\s+uống|xem\s+phim|đi\s+chơi|mua\s+sắm|né\s+ngập|tránh\s+tắc|không\s+ngập|an\s+toàn|nhanh\s+nhất|thì|được|có|đi|giúp|với|ạ|nhé|nào).*$/i, '')
        .replace(/\s+(?:đường\s+nào\s+.*|đường\s+nào)$/i, '')
        .replace(/[,.?!]+$/g, '')
        .trim();

      if (dest.toLowerCase() === 'đường' || dest.toLowerCase() === 'đường nào' || dest.length < 2) {
        const priorDestMatch = query.match(/(?:tại|đến|tới|ở)\s+([^,]+?)\s+(?:đi\s+)?từ/i);
        if (priorDestMatch && priorDestMatch[1]) {
          dest = priorDestMatch[1].trim();
        } else {
          return null;
        }
      }

      if (orig.length >= 2 && dest.length >= 2) {
        return {
          origin: orig,
          destination: dest,
          timeOffsetHours,
          avoidRoad,
          requestedVehicle
        };
      }
    }

    // Pattern C: "Đang ở A muốn đi/đến/ra/về B"
    const patternC = /(?:đang\s+ở|ở\s+tại|xuất\s+phát\s+từ)\s+(.+?)\s+(?:muốn|cần|định)?\s*(?:đi|đến|tới|ra|về|sang|lên|xuống)\s+(.+)$/i;
    const matchC = cleaned.match(patternC);
    if (matchC && matchC[1] && matchC[2]) {
      const orig = matchC[1].trim();
      const dest = matchC[2].replace(/\s+(?:thì|đi|đường\s+nào).*$/i, '').trim();
      if (orig.length >= 2 && dest.length >= 2) {
        return {
          origin: orig,
          destination: dest,
          timeOffsetHours,
          avoidRoad,
          requestedVehicle
        };
      }
    }

    // Pattern D: Câu hỏi nối tiếp có giả định cấm đường hoặc đổi phương tiện/thời gian trên lộ trình vừa hỏi
    if (lastOrig && lastDest && (avoidRoad || requestedVehicle || (timeOffsetHours > 0 && /(?:lộ trình|đường đó|tuyến đó|đi tiếp|thì sao)/i.test(lower)))) {
      return {
        origin: lastOrig,
        destination: lastDest,
        timeOffsetHours,
        avoidRoad,
        requestedVehicle,
        isFollowUpRoute: true
      };
    }

    return null;
  }

  /**
   * Hợp nhất dữ liệu từ Backend Bot + Trạng thái thực trên Màn hình Web của người dùng (Live Web State Sync)
   */
  mergeLiveAndWebData(city, context = {}) {
    const serverData = botService.getData() || {};
    const webState = context.webState || context || {};

    // 1. Điểm ngập: Ưu tiên danh sách đang hiển thị trên màn hình Web (bao gồm cả Giả lập mưa bão, Dự báo +1..3h, Báo cáo cộng đồng)
    const serverFloods = (serverData.floodPoints || []).filter(f => f.city === city);
    const allFloods = (Array.isArray(webState.visibleFloods) && webState.visibleFloods.length > 0)
      ? webState.visibleFloods.map(f => ({
          name: f.name || f.location || 'Điểm ngập',
          depth_cm: f.depth_cm !== undefined ? f.depth_cm : (f.depth || 0),
          danger_level: f.danger_level || (f.depth > 30 ? 'hazard' : 'caution'),
          lat: f.lat,
          lng: f.lng,
          advice: f.advice || f.status || 'Chú ý ngập nước'
        }))
      : serverFloods;
    const activeFloods = allFloods.filter(f => (f.depth_cm || 0) > 0 && f.danger_level !== 'safe');

    // 2. Điểm kẹt xe / Sự cố TomTom
    const serverTraffics = (serverData.trafficIncidents || []).filter(t => t.city === city);
    const allTraffics = (Array.isArray(webState.visibleTraffics) && webState.visibleTraffics.length > 0)
      ? webState.visibleTraffics
      : serverTraffics;

    // 3. Bản tin VOV Giao thông
    const vovNews = (Array.isArray(webState.vovNews) && webState.vovNews.length > 0)
      ? webState.vovNews
      : (serverData.vovTrafficNews || []);

    // 4. Trạm thời tiết 87 Phường/Xã
    const serverStations = (serverData.weatherStations || {})[city] || [];
    const cityStations = (Array.isArray(webState.weatherStations) && webState.weatherStations.length > 0)
      ? webState.weatherStations
      : serverStations;

    // 5. Cảnh báo KTTV
    const weatherAlerts = serverData.weatherAlerts || [];

    return {
      allFloods,
      activeFloods,
      allTraffics,
      vovNews,
      cityStations,
      weatherAlerts,
      isSimulationMode: Boolean(webState.isSimulationMode),
      predictionOffsetHours: Number(webState.predictionOffsetHours) || 0,
      currentVehicle: webState.currentVehicle || 'motorbike',
      currentAvoidLevel: webState.currentAvoidLevel !== undefined ? webState.currentAvoidLevel : 1,
      activeRoute: webState.activeRoute || null
    };
  }

  /**
   * Giải mã tọa độ Điểm neo Không gian (Spatial Anchor) từ câu hỏi & lịch sử hội thoại
   */
  resolveSpatialAnchorForRAG(query, city, mergedData, context = {}) {
    const qNorm = normalizeVi(query);
    const lower = query.toLowerCase();

    // 1. Nếu có customAnchor đã được Geocode trực tiếp từ Client
    if (context.customAnchor && Number.isFinite(context.customAnchor.lat) && Number.isFinite(context.customAnchor.lng)) {
      return {
        name: context.customAnchor.title || 'Điểm truy vấn',
        lat: context.customAnchor.lat,
        lng: context.customAnchor.lng,
        ward: null
      };
    }

    // 2. Kiểm tra trong 126 Phường/Xã & Đường lớn Hà Nội (HANOI_WARDS_DATA)
    if (city === 'hanoi' && Array.isArray(HANOI_WARDS_DATA)) {
      let bestWard = null;
      let bestLen = 0;
      for (const w of HANOI_WARDS_DATA) {
        const cleanW = normalizeVi((w.ward || w.name || '').replace(/^(?:phuong|xa|thi tran|p|x)\s+/i, ''));
        if (cleanW.length >= 4 && qNorm.includes(cleanW) && cleanW.length > bestLen) {
          bestWard = w;
          bestLen = cleanW.length;
        }
        for (const st of (w.mainStreets || [])) {
          const cleanSt = normalizeVi(st.replace(/^(?:duong|pho|quoc lo|dai lo)\s+/i, ''));
          if (cleanSt.length >= 4 && qNorm.includes(cleanSt) && cleanSt.length > bestLen) {
            bestWard = w;
            bestLen = cleanSt.length;
          }
        }
      }
      if (bestWard) {
        return {
          name: `${bestWard.name} (${bestWard.district})`,
          lat: bestWard.lat,
          lng: bestWard.lng,
          ward: bestWard
        };
      }
    }

    // 3. Kiểm tra trong Landmark & Areas của FOOD_ENTERTAINMENT_DATA
    if (FOOD_ENTERTAINMENT_DATA && typeof FOOD_ENTERTAINMENT_DATA.resolveSpatialAnchor === 'function') {
      const resolved = FOOD_ENTERTAINMENT_DATA.resolveSpatialAnchor(lower, city, context);
      if (resolved && resolved.isMatchedExplicitly && resolved.area) {
        return {
          name: resolved.area.title,
          lat: resolved.area.lat,
          lng: resolved.area.lng,
          ward: null
        };
      }
    }

    // 4. Kiểm tra trùng tên với các trạm đo ngập
    for (const f of mergedData.allFloods) {
      const fNorm = normalizeVi(f.name);
      const parts = fNorm.split(/\s+/).filter(w => w.length >= 4);
      if (parts.length >= 2 && qNorm.includes(parts.slice(0, 2).join(' '))) {
        return { name: f.name, lat: f.lat, lng: f.lng, ward: null };
      }
    }

    // 5. Nếu câu hỏi dùng đại từ chỉ định ("ở đó", "chỗ đó", "gần đích", "quanh đây") -> lấy từ activeRoute hoặc mapCenter
    if (mergedData.activeRoute && mergedData.activeRoute.destLat && mergedData.activeRoute.destLng) {
      if (/(?:ở đó|chỗ đó|quanh đó|gần đó|đích đến|điểm đến|nơi đến)/i.test(lower)) {
        return {
          name: mergedData.activeRoute.destinationName || 'Điểm đến lộ trình',
          lat: mergedData.activeRoute.destLat,
          lng: mergedData.activeRoute.destLng,
          ward: null
        };
      }
    }

    if (context.mapCenter && Number.isFinite(context.mapCenter.lat) && Number.isFinite(context.mapCenter.lng)) {
      return {
        name: 'Tâm bản đồ đang xem',
        lat: context.mapCenter.lat,
        lng: context.mapCenter.lng,
        ward: null
      };
    }

    return null;
  }

  /**
   * Bộ lọc RAG Không gian & Từ khóa Đa tầng (Thay thế hoàn toàn .slice(0, 5) mù quáng)
   * Đảm bảo AI đọc được 100% điểm ngập, điểm tắc, thời tiết phường, bản tin VOV và lộ trình thực tế trên Web!
   */
  buildComprehensiveSpatialContext(queryOrData, city, mergedData, context = {}, liveEvents = null) {
    if (typeof queryOrData === 'object' && queryOrData !== null && !city) {
      const data = queryOrData;
      const c = (data.userCity && (data.userCity.toLowerCase().includes('hồ chí minh') || data.userCity.toLowerCase().includes('hcm'))) ? 'hcm' : 'hanoi';
      const mData = this.mergeLiveAndWebData(c, data);
      return this.buildComprehensiveSpatialContext(
        data.query || 'Tình hình giao thông ngập lụt hiện tại',
        c,
        mData,
        data,
        null
      ).text;
    }
    const query = typeof queryOrData === 'string' ? queryOrData : 'Tình hình giao thông ngập lụt';
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const qNorm = normalizeVi(query);
    const qTokens = qNorm.split(/\s+/).filter(t => t.length >= 3 && !['duong', 'pho', 'quan', 'phuong', 'hien', 'tai', 'nhu', 'the', 'nao', 'khong', 'dang', 'bao', 'nhieu'].includes(t));

    const anchor = this.resolveSpatialAnchorForRAG(query, city, mergedData, context);
    const lines = [];

    // 1. Trạng thái chế độ bản đồ trên giao diện Web của người dùng
    const modeDesc = mergedData.isSimulationMode
      ? 'CHẾ ĐỘ GIẢ LẬP MƯA BÃO LỊCH SỬ (Đang kích hoạt mô phỏng ngập lụt diện rộng trên bản đồ Web)'
      : 'CHẾ ĐỘ DỮ LIỆU QUAN TRẮC THỰC TẾ 24/7';
    const timeDesc = mergedData.predictionOffsetHours > 0
      ? `DỰ BÁO TƯƠNG LAI +${mergedData.predictionOffsetHours} GIỜ TỚI`
      : 'Thời gian thực hiện tại (+0h)';
    const vehicleMap = { motorbike: 'Xe máy', car: 'Ô tô', ebike: 'Xe máy điện', ecar: 'Ô tô điện' };

    lines.push(`=== 1. TRẠNG THÁI BẢN ĐỒ WEB HIỆN TẠI (${cityName.toUpperCase()}) ===`);
    lines.push(`- Chế độ hiển thị trên Web: ${modeDesc} | Mốc thời gian: ${timeDesc}`);
    lines.push(`- Phương tiện người dùng đang chọn: ${vehicleMap[mergedData.currentVehicle] || 'Xe máy'}`);

    const memoryContext = context.webState?.memoryContext || context.memoryContext || {};
    if (memoryContext.homePlace || memoryContext.workPlace) {
      lines.push(`- Địa điểm người dùng đã lưu: Nhà: "${memoryContext.homePlace || 'Chưa cài đặt'}" | Chỗ làm/Trường: "${memoryContext.workPlace || 'Chưa cài đặt'}"`);
    }
    if (memoryContext.lastInspectedPlace) {
      lines.push(`- Địa điểm người dùng vừa click xem trên bản đồ: "${memoryContext.lastInspectedPlace.name}" (${memoryContext.lastInspectedPlace.address || ''})`);
    }

    // 2. Dữ liệu Ngập úng (Đọc 100% các điểm đang ngập >0cm + các trạm khớp từ khóa hoặc gần điểm hỏi)
    const { allFloods, activeFloods } = mergedData;
    const matchedDryFloods = allFloods.filter(f => {
      if ((f.depth_cm || 0) > 0 && f.danger_level !== 'safe') return false;
      const fNorm = normalizeVi(`${f.name} ${f.description || ''}`);
      const keywordHit = qTokens.some(tk => fNorm.includes(tk));
      const nearAnchor = anchor ? calcDistM(anchor.lat, anchor.lng, f.lat, f.lng) <= 2500 : false;
      return keywordHit || nearAnchor;
    });

    lines.push(`\n=== 2. DỮ LIỆU TRẠM ĐO NGẬP ÚNG TRÊN BẢN ĐỒ (Tổng điểm đang ngập >0cm: ${activeFloods.length}/${allFloods.length} trạm) ===`);
    if (activeFloods.length > 0) {
      activeFloods.forEach((f, idx) => {
        const distInfo = anchor ? ` [Cách ${anchor.name} ~${calcDistM(anchor.lat, anchor.lng, f.lat, f.lng)}m]` : '';
        const vehiclePass = f.passable_motorbike ? 'Xe máy đi chậm được' : (f.passable_car ? 'Cấm xe máy, ô tô gầm cao qua được' : 'Cấm mọi phương tiện (nguy cơ thủy kích)');
        lines.push(`  ${idx + 1}. [ĐANG NGẬP ${f.depth_cm}cm] ${f.name}${distInfo} - Mức độ: ${f.danger_level} - ${vehiclePass}. Khuyến cáo: ${f.advice || ''}`);
      });
    } else {
      lines.push(`  - Toàn bộ ${allFloods.length} trạm đo tại ${cityName} hiện đang KHÔ RÁO (0cm ngập).`);
    }

    if (matchedDryFloods.length > 0) {
      lines.push(`  - Trạm đo tại khu vực liên quan câu hỏi (Hiện đang khô ráo 0cm): ` +
        matchedDryFloods.slice(0, 6).map(f => `${f.name} (0cm - ${f.advice || 'Lưu thông bình thường'})`).join(' | '));
    }

    // 3. Dữ liệu Giao thông TomTom & Sự cố (Ưu tiên 100% điểm khớp câu hỏi + bán kính 2.5km + Top điểm ùn tắc nặng nhất)
    const { allTraffics, vovNews } = mergedData;
    const activeJams = allTraffics.filter(t => t.isJam);
    const roadworks = allTraffics.filter(t => !t.isJam);

    const matchedTraffics = allTraffics.filter(t => {
      const tNorm = normalizeVi(`${t.description || ''} ${t.from || ''} ${t.to || ''} ${t.roadNumbers || ''}`);
      const keywordHit = qTokens.some(tk => tNorm.includes(tk));
      const nearAnchor = anchor ? calcDistM(anchor.lat, anchor.lng, t.lat, t.lng) <= 2500 : false;
      return keywordHit || nearAnchor;
    });

    // Kiểm tra vùng sạch (Verified Clear Zone)
    if (anchor && activeFloods.length > 0) {
      const floodIn1500m = activeFloods.filter(f => calcDistM(anchor.lat, anchor.lng, f.lat, f.lng) <= 1500);
      const jamIn1500m = activeJams.filter(t => calcDistM(anchor.lat, anchor.lng, t.lat, t.lng) <= 1500);
      if (floodIn1500m.length === 0 && jamIn1500m.length === 0) {
        lines.push(`  [VERIFIED_CLEAR_ZONE: Bán kính 1.5km quanh "${anchor.name}" hoàn toàn KHÔ RÁO và THÔNG THOÁNG (0 điểm ngập, 0 điểm ùn tắc)]`);
      }
    }

    lines.push(`\n=== 3. DỮ LIỆU GIAO THÔNG TOMTOM & VOV THỰC TẾ (Tổng sự cố: ${allTraffics.length}, gồm ${activeJams.length} điểm ùn tắc & ${roadworks.length} rào chắn/công trường) ===`);
    if (matchedTraffics.length > 0) {
      lines.push(`  * Sự cố/Mật độ giao thông khớp trực tiếp với khu vực câu hỏi (${matchedTraffics.length} điểm):`);
      matchedTraffics.slice(0, 12).forEach(t => {
        const delayMin = Math.max(1, Math.round((t.delaySeconds || 120) / 60));
        const distStr = anchor ? ` (~${calcDistM(anchor.lat, anchor.lng, t.lat, t.lng)}m)` : '';
        lines.push(`    - [${t.isJam ? `ÙN TẮC trễ ~${delayMin} phút` : 'RÀO CHẮN/THI CÔNG'}] ${this.stripEmojis(t.description)}${distStr}`);
      });
    }

    const topCityJams = activeJams
      .filter(t => !matchedTraffics.includes(t))
      .sort((a, b) => (b.delaySeconds || 0) - (a.delaySeconds || 0))
      .slice(0, 12);

    if (topCityJams.length > 0) {
      lines.push(`  * Các điểm ùn tắc đáng chú ý khác trên toàn đô thị ${cityName}:`);
      topCityJams.forEach(t => {
        const delayMin = Math.max(1, Math.round((t.delaySeconds || 120) / 60));
        lines.push(`    - [Trễ ~${delayMin}p] ${this.stripEmojis(t.description)}`);
      });
    }

    if (vovNews && vovNews.length > 0) {
      const matchedVov = vovNews.filter(n => qTokens.some(tk => normalizeVi(n.title || n.content || '').includes(tk)));
      const displayVov = matchedVov.length > 0 ? matchedVov.slice(0, 5) : vovNews.slice(0, 4);
      lines.push(`  * Bản tin VOV Giao Thông mới nhất:`);
      displayVov.forEach(n => {
        lines.push(`    - "${this.stripEmojis(n.title || n.content || '')}" (${n.time || 'Mới cập nhật'})`);
      });
    }

    // 4. Dữ liệu Thời tiết 87 Phường/Xã & Hồ sơ Phường Hà Nội
    const { cityStations, weatherAlerts } = mergedData;
    if (cityStations.length > 0) {
      const temps = cityStations.map(s => s.temp || 26);
      const minT = Math.min(...temps);
      const maxT = Math.max(...temps);
      const maxRain = cityStations.reduce((m, s) => Math.max(m, s.rain1h || 0), 0);
      const rainingWards = cityStations.filter(s => (s.rain1h || 0) > 0);

      lines.push(`\n=== 4. DỮ LIỆU THỜI TIẾT ${cityStations.length} TRẠM PHƯỜNG/QUẬN TRÊN BẢN ĐỒ ===`);
      lines.push(`  - Tổng quan ${cityName}: Nhiệt độ ${minT}°C - ${maxT}°C | Lượng mưa cao nhất 1h qua: ${maxRain} mm/h (${rainingWards.length} trạm có mưa).`);

      if (anchor) {
        const nearestStation = [...cityStations].sort((a, b) =>
          calcDistM(anchor.lat, anchor.lng, a.lat, a.lng) - calcDistM(anchor.lat, anchor.lng, b.lat, b.lng)
        )[0];
        if (nearestStation) {
          lines.push(`  - Trạm thời tiết sát khu vực đang hỏi (${nearestStation.name}): ${nearestStation.temp}°C, ${nearestStation.description || 'Khô ráo'}, lượng mưa 1h: ${nearestStation.rain1h || 0}mm, độ ẩm: ${nearestStation.humidity || 70}%.`);
        }
      }
    }
    if (weatherAlerts.length > 0) {
      lines.push(`  - Cảnh báo KTTV: ${weatherAlerts.slice(0, 2).map(a => a.content || a.title).join(' | ')}`);
    }

    // 5. Hồ sơ Địa phương Phường/Xã Hà Nội (nếu khớp)
    if (anchor && anchor.ward) {
      const w = anchor.ward;
      lines.push(`\n=== 5. HỒ SƠ ĐỊA PHƯƠNG HÀ NỘI: ${w.name.toUpperCase()} (QUẬN ${w.district.toUpperCase()}) ===`);
      lines.push(`  - Trục đường chính: ${(w.mainStreets || []).join(', ')}`);
      lines.push(`  - Nút giao trọng điểm: ${(w.trafficHotspots || []).join(' • ')}`);
      lines.push(`  - Đặc điểm thoát nước & ngập úng: ${w.floodVulnerability || 'Bình thường'}`);
      lines.push(`  - Ghi chú lưu thông: ${w.description || ''}`);
    }

    // 6. Thông số Lộ trình Thực tế vừa tính toán trên Bản đồ (Route-Aware Data & Trip Economics)
    if (mergedData.activeRoute) {
      const ar = mergedData.activeRoute;
      const rec = ar.recommended || ar;
      lines.push(`\n=== 6. THÔNG SỐ LỘ TRÌNH THỰC TẾ ĐANG VẼ TRÊN BẢN ĐỒ WEB (ROUTE-AWARE DATA) ===`);
      lines.push(`  - Điểm xuất phát: ${ar.originName || ar.origin || 'Điểm A'} -> Điểm đến: ${ar.destinationName || ar.destination || 'Điểm B'}`);
      lines.push(`  - Phương tiện tính toán: ${vehicleMap[ar.vehicle] || ar.vehicle || 'Xe máy'}${ar.timeOffsetHours > 0 ? ` | Dự báo +${ar.timeOffsetHours}h tới` : ''}`);
      if (ar.avoidRoads && ar.avoidRoads.length > 0) {
        lines.push(`  - Tuyến đường giả định cấm/né theo yêu cầu: ${ar.avoidRoads.join(', ')}`);
      }
      if (ar.noPassableRoute) {
        lines.push(`  - CẢNH BÁO ĐẶC BIỆT: Không có lộ trình an toàn cho phương tiện này do ngập sâu vây kín các hướng tiếp cận!`);
      } else if (rec) {
        lines.push(`  - Tuyến khuyến nghị tốt nhất (${rec.label || rec.name || 'Tuyến An toàn'}): Dài ${rec.distanceKm} km | Thời gian dự kiến: ${rec.durationMin || rec.estimatedMinutes} phút | Chỉ số an toàn: ${rec.safetyScore || 95}/100.`);
        if (rec.fuelCostVnd) {
          lines.push(`  - Chi phí nhiên liệu ước tính: ~${rec.fuelCostVnd.toLocaleString('vi-VN')}đ`);
        }
        if (rec.riskSavedText) {
          lines.push(`  - Tiền tự bảo vệ ví tránh rủi ro thủy kích: ${rec.riskSavedText}`);
        }
        if (rec.mainStreets && rec.mainStreets.length > 0) {
          lines.push(`  - Các trục đường chính đi qua: ${rec.mainStreets.join(' -> ')}`);
        } else if (rec.streetNames && rec.streetNames.length > 0) {
          lines.push(`  - Các trục đường chính đi qua: ${rec.streetNames.join(' -> ')}`);
        }
        if (rec.avoidedFloods && rec.avoidedFloods.length > 0) {
          lines.push(`  - Đã tự động vòng tránh thành công các điểm ngập: ${rec.avoidedFloods.join(', ')}`);
        }
        if (rec.matchedFloods && rec.matchedFloods.length > 0) {
          lines.push(`  - Lưu ý điểm ngập nhẹ trên đường: ${rec.matchedFloods.map(f => `${f.name} (${f.depth_cm}cm)`).join(', ')}`);
        }
        if (rec.matchedTraffics && rec.matchedTraffics.length > 0) {
          lines.push(`  - Mật độ giao thông trên tuyến: Có ${rec.matchedTraffics.length} điểm đông xe (${rec.matchedTraffics.slice(0, 3).map(t => this.stripEmojis(t.description)).join('; ')})`);
        }
        if (ar.alternatives && ar.alternatives.length > 0) {
          lines.push(`  - Phương án lộ trình thay thế: ${ar.alternatives.map(a => `${a.label || a.name}: ${a.distanceKm}km (~${a.durationMin || a.estimatedMinutes} phút)`).join(' | ')}`);
        }
        if (ar.pitStops) {
          const ps = ar.pitStops;
          if (ps.closestEV) lines.push(`  - Trạm sạc EV sát tuyến nhất: ${ps.closestEV.name} (cách lộ trình ~${ps.closestEV.distM}m)`);
          if (ps.closestShelter) lines.push(`  - Điểm gửi xe trú mưa cao ráo sát tuyến: ${ps.closestShelter.name} (${ps.closestShelter.elevation || '+10m'}, cách ~${ps.closestShelter.distM}m)`);
          if (ps.closestFood) lines.push(`  - Điểm dừng ẩm thực sát tuyến: ${ps.closestFood.name} (cách ~${ps.closestFood.distM}m)`);
        }
        if (ar.timeShiftComparison) {
          const ts = ar.timeShiftComparison;
          lines.push(`  - So sánh thời điểm khởi hành: Hiện tại: ~${ts.now.durationMin}p | Sau +1h: ~${ts.plus1h.durationMin}p (giảm ${ts.now.durationMin - ts.plus1h.durationMin}p) | Sau +2h: ~${ts.plus2h.durationMin}p`);
        }
      }
    }

    // 7. Kết quả Thực thi Công cụ Trực tiếp trên Web (Executed Tool Results)
    const execResults = context.webState?.executedResults || {};
    if (execResults.propertyEval) {
      const pe = execResults.propertyEval;
      lines.push(`\n=== 7. KẾT QUẢ KHẢO SÁT AN CƯ & BẤT ĐỘNG SẢN VỪA TÍNH TRÊN WEB ===`);
      lines.push(`- Địa điểm khảo sát: ${pe.targetName}`);
      lines.push(`- Tổng điểm An cư: ${pe.totalScore}/100 (Hạng ${pe.grade} - ${pe.verdict})`);
      lines.push(`- Cốt nền địa hình vệ tinh: +${pe.elevationM}m so với mực nước biển`);
      lines.push(`- Khoảng cách tới rốn ngập lịch sử gần nhất: ${pe.minDistM}m (${pe.nearestFloodName || 'Không có'})`);
      lines.push(`- Bán kính 1.5km: ${pe.evNearCount} trạm sạc EV, ${pe.sheltersNearCount} bãi trú mưa cao ráo, ${pe.foodNearCount} tiện ích ẩm thực/TTTM`);
      if (execResults.comparedPropertyEval) {
        const cpe = execResults.comparedPropertyEval;
        lines.push(`- Địa điểm đối chiếu so sánh: ${cpe.targetName}`);
        lines.push(`  Tổng điểm: ${cpe.totalScore}/100 (Hạng ${cpe.grade}), cốt nền: +${cpe.elevationM}m, cách rốn ngập: ${cpe.minDistM}m`);
      }
    }

    if (execResults.comfortData) {
      const cd = execResults.comfortData;
      lines.push(`\n=== 8. CHỈ SỐ THOẢI MÁI DI CHUYỂN & DỰ BÁO 15P TẠI VỊ TRÍ ===`);
      lines.push(`- Điểm thoải mái: ${cd.comfortScore}/100 (${cd.verdict || ''})`);
      lines.push(`- Cảm nhận nhiệt mặt đường (Road RealFeel): ${cd.roadRealFeel}°C (Nhiệt kế: ${cd.temp}°C, Tia UV: ${cd.uvIndex})`);
      lines.push(`- Lời khuyên trang bị: ${(cd.gearList || []).filter(g => g.needed).map(g => g.name).join(', ') || 'Không cần trang bị đặc biệt'}`);
    }

    if (execResults.sosShelters && execResults.sosShelters.length > 0) {
      lines.push(`\n=== 9. BÃI ĐỖ XE TRÊN CAO & CỨU HỘ SOS GẦN NHẤT ===`);
      execResults.sosShelters.slice(0, 3).forEach((s, idx) => {
        lines.push(`  ${idx + 1}. ${s.name} - Cốt nền: ${s.elevation || '+10m'} - Cách: ~${(s.distKm || 0.5).toFixed(1)}km - Đ/c: ${s.address}`);
      });
      lines.push(`- Hotline cứu hộ giao thông 116 sở tại: 0909116116 | Tổng đài cứu nạn PCCC: 114`);
    }

    // 10. Tri thức sự kiện đô thị & Báo chí thời gian thực
    lines.push(`\n=== 10. BỐI CẢNH SỰ KIỆN ĐÔ THỊ & BÁO CHÍ ===`);
    lines.push(`- SVĐ Quốc gia Mỹ Đình: Thường tổ chức đại nhạc hội/concert (30.000-40.000 khán giả) hoặc bóng đá ĐTQG. Giờ cao điểm 18h-23h gây đông đúc tại Lê Đức Thọ, Lê Quang Đạo, Mễ Trì, Châu Văn Liêm.`);
    lines.push(`- Phố đi bộ Hồ Gươm: Cấm xe cơ giới từ tối Thứ 6 đến hết Chủ Nhật hàng tuần.`);
    if (liveEvents && liveEvents.summaryText) {
      lines.push(liveEvents.summaryText);
    }

    return {
      text: lines.join('\n'),
      anchor
    };
  }

  extractSpatialCitations(reply, mergedData, anchor) {
    const citations = [];
    const seen = new Set();
    const activeFloods = mergedData?.activeFloods || (mergedData?.visibleFloods?.map(f => ({
      name: f.location || f.name,
      depth_cm: f.depth || f.depth_cm || 20,
      lat: f.lat || 10.79,
      lng: f.lng || 106.71
    }))) || [];
    const allTraffics = mergedData?.allTraffics || (mergedData?.visibleTraffics?.map(t => ({
      description: t.street || t.description,
      isJam: true,
      lat: t.lat || 10.78,
      lng: t.lng || 106.70
    }))) || [];

    if (mergedData?.weatherStations) {
      for (const w of mergedData.weatherStations) {
        if (reply.toLowerCase().includes((w.name || '').toLowerCase())) {
          citations.push({
            label: `Thời tiết: ${w.name} (${w.rain}mm)`,
            type: 'weather'
          });
          break;
        }
      }
    }

    for (const f of activeFloods) {
      if (citations.length >= 4) break;
      const shortName = (f.name || '').split(/[(),-]/)[0].trim();
      if (!shortName) continue;
      const dist = anchor ? calcDistM(anchor.lat, anchor.lng, f.lat, f.lng) : null;
      if (reply.toLowerCase().includes(shortName.toLowerCase()) || (dist !== null && dist <= 1800)) {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          citations.push({
            label: `Điểm ngập: ${shortName} (${f.depth_cm}cm)`,
            lat: f.lat,
            lng: f.lng,
            type: 'flood',
            depth_cm: f.depth_cm,
            distM: dist
          });
        }
      }
    }

    for (const t of allTraffics) {
      if (citations.length >= 4) break;
      if (t.isJam && t.description) {
        const shortDesc = t.description.slice(0, 32);
        const dist = anchor ? calcDistM(anchor.lat, anchor.lng, t.lat, t.lng) : null;
        if (reply.toLowerCase().includes(shortDesc.toLowerCase()) || (dist !== null && dist <= 1500)) {
          if (!seen.has(shortDesc)) {
            seen.add(shortDesc);
            citations.push({
              label: `Ùn tắc: ${shortDesc}`,
              lat: t.lat,
              lng: t.lng,
              type: 'jam',
              distM: dist
            });
          }
        }
      }
    }

    return citations;
  }

  /**
   * Tự động tạo danh sách Gợi ý câu hỏi tiếp theo (Smart Follow-up Chips) sát ngữ cảnh vừa trả lời
   */
  buildSmartFollowUps(query, city, parsedRoute, isFoodQuery, isEVQuery, mergedData, anchor) {
    const chips = [];
    if (parsedRoute) {
      chips.push(`Chiều ngược lại từ ${parsedRoute.destination} về ${parsedRoute.origin}`);
      chips.push(`Quán ăn & cafe ngon gần ${parsedRoute.destination}`);
      if (mergedData.currentVehicle === 'motorbike') {
        chips.push(`Nếu đi ô tô từ ${parsedRoute.origin} đến ${parsedRoute.destination} thì mất bao lâu?`);
      } else {
        chips.push(`Dự báo lộ trình này trong 2 giờ tới có tắc không?`);
      }
      return chips.slice(0, 3);
    }

    if (isFoodQuery) {
      const locName = anchor ? anchor.name.replace(/^Khu Vực\s+/i, '').split('(')[0].trim() : (city === 'hanoi' ? 'Cầu Giấy' : 'Trung tâm');
      chips.push(`Quán cà phê view đẹp yên tĩnh gần ${locName}`);
      chips.push(`Rạp chiếu phim & chỗ đi chơi gần ${locName}`);
      chips.push(`Tình hình giao thông quanh ${locName} lúc này`);
      return chips.slice(0, 3);
    }

    if (isEVQuery) {
      chips.push(`Trạm sạc nhanh DC công suất lớn gần đây`);
      chips.push(`Đường đi tới trạm sạc có bị ngập hay tắc không?`);
      chips.push(`Quán cafe ngồi chờ sạc xe gần trạm`);
      return chips.slice(0, 3);
    }

    if (mergedData.activeFloods.length > 0) {
      const worstFlood = mergedData.activeFloods[0];
      chips.push(`Đường nào đang ngập sâu nhất lúc này?`);
      chips.push(`Dự báo sau 2 giờ nữa nước rút chưa?`);
      chips.push(`Tìm lộ trình né điểm ngập ${worstFlood.name.split('(')[0].trim()}`);
      return chips.slice(0, 3);
    }

    if (anchor && anchor.ward) {
      chips.push(`Quán ăn ngon đặc sản tại ${anchor.ward.name}`);
      chips.push(`Từ ${anchor.ward.name} lên Hồ Gươm đi đường nào thoáng?`);
      chips.push(`Trạm sạc xe điện gần ${anchor.ward.name}`);
      return chips.slice(0, 3);
    }

    chips.push(`Các điểm đang ùn tắc nặng nhất lúc này?`);
    chips.push(`Hiện tại trên bản đồ có điểm nào bị ngập không?`);
    chips.push(`Gợi ý quán ăn ngon và cafe đẹp gần đây`);
    return chips.slice(0, 3);
  }

  async processQuery({ query, city = 'hanoi', userApiKey = '', context = {} }) {
    const mergedData = this.mergeLiveAndWebData(city, context);

    // Tra cứu sự kiện báo chí thời gian thực (chỉ chạy khi câu hỏi có tín hiệu sự kiện/đông người)
    let liveEvents = null;
    try {
      liveEvents = await webEventService.searchLiveEvents(query, city);
    } catch (e) {
      console.warn('[AI] Tra cứu sự kiện trực tiếp bỏ qua:', e.message);
    }

    const systemGeminiKey = require('./config').API_KEYS.GEMINI || '';
    const activeKey = (userApiKey && userApiKey.trim().length > 10) ? userApiKey.trim() : systemGeminiKey;

    if (activeKey && activeKey.length > 10) {
      try {
        return await this.callGeminiAPI(query, mergedData, city, activeKey, context, liveEvents);
      } catch (err) {
        console.warn('[AI] Gọi Gemini API thất bại, chuyển sang Bộ não AI cục bộ giàu dữ liệu:', err.message);
      }
    }

    return await this.generateSmartLocalResponse(query, city, mergedData, context, liveEvents);
  }

  /**
   * Gọi một Model Gemini cụ thể với cấu hình tối ưu tốc độ + trí tuệ (thinkingBudget: 0)
   */
  async _invokeSingleGeminiModel(model, apiKey, contents, enableSearchGrounding = false, timeoutMs = 6500) {
    const cooldownUntil = this._modelCooldowns.get(model) || 0;
    if (Date.now() < cooldownUntil) {
      throw new Error(`Model ${model} is in temporary cooldown`);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents,
      generationConfig: {
        temperature: 0.35,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    if (enableSearchGrounding) {
      payload.tools = [{ googleSearch: {} }];
    }

    let response;
    try {
      response = await axios.post(url, payload, { timeout: timeoutMs });
    } catch (apiErr) {
      const status = apiErr.response?.status;
      // Nếu model không hỗ trợ thinkingConfig hoặc googleSearch -> thử lại payload tiêu chuẩn ngay lập tức
      if (status === 400) {
        delete payload.tools;
        delete payload.generationConfig.thinkingConfig;
        response = await axios.post(url, payload, { timeout: timeoutMs });
      } else {
        if (status === 429 || status === 503 || status === 404) {
          this._modelCooldowns.set(model, Date.now() + 25000);
        }
        throw apiErr;
      }
    }

    const parts = response.data?.candidates?.[0]?.content?.parts || [];
    const reply = parts
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('\n')
      .trim();

    if (!reply) {
      throw new Error(`Empty response from ${model}`);
    }
    return { reply, model };
  }

  /**
   * Bộ điều phối Gemini Thế hệ mới (Staggered Hedge Race):
   * Cân bằng hoàn hảo giữa Trí tuệ (Gemini 3 / 3.6 Flash) và Tốc độ phản hồi (~1.8s - 2.5s)
   */
  async callGeminiAPI(query, mergedData, city, apiKey, context = {}, liveEvents = null) {
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const sessionMemory = context.sessionMemory || {};
    const parsedRoute = this.parseRouteQuery(query, sessionMemory);
    const lower = query.toLowerCase();

    // Chốt chặn an toàn: Từ chối vi phạm luật giao thông
    if (/(?:né\s*chốt|tránh\s*chốt|né\s*csgt|tránh\s*công\s*an|đi\s*ngược\s*chiều|vượt\s*đèn\s*đỏ|thổi\s*nồng\s*độ\s*cồn)/i.test(lower)) {
      return {
        text: 'MoveSafe VN là nền tảng giao thông an toàn và tuân thủ pháp luật. Tôi không cung cấp hướng dẫn né chốt kiểm tra hoặc vi phạm luật giao thông. Bạn hãy luôn chấp hành hiệu lệnh và đi đúng luật để bảo vệ an toàn cho bản thân và cộng đồng.',
        action: null,
        followUps: ['Xem bản đồ điểm ngập hiện tại', 'Chỉ đường an toàn hợp pháp', 'Dự báo thời tiết 15P']
      };
    }

    const isAskingEV = /(?:trạm sạc|sạc xe|sạc pin|sạc điện|xe điện|đổi pin|open charge|vinfast)/i.test(lower);
    const isAskingFoodOrEntertainment = FOOD_ENTERTAINMENT_DATA.isFoodOrFun(query);
    const isAskingTrafficOnly = /(?:tắc|kẹt|ùn|đông thế|đông vậy|sao đông|tại sao đông)/i.test(lower) && !lower.includes('ngập');

    // Xây dựng Hồ sơ Không gian Thực 100% (Spatial RAG Context)
    const rag = this.buildComprehensiveSpatialContext(query, city, mergedData, context, liveEvents);
    let extraDomainContext = '';
    let cachedFoodRec = null;

    if (isAskingEV) {
      const evService = require('./ev-service');
      const stations = evService.getStations(city, false);
      const nearestEV = rag.anchor
        ? [...stations].map(s => ({ ...s, distM: calcDistM(rag.anchor.lat, rag.anchor.lng, s.lat, s.lng) })).sort((a, b) => a.distM - b.distM).slice(0, 6)
        : stations.slice(0, 6);
      extraDomainContext += `\n=== DỮ LIỆU TRẠM SẠC XE ĐIỆN GẦN NHẤT (${stations.length} trạm toàn thành phố) ===\n` +
        nearestEV.map((s, i) => `  ${i + 1}. ${s.name} (${s.operator}) - Công suất: ${s.maxPowerKw}kW (${s.isFastCharge ? 'Sạc nhanh DC' : 'Sạc AC'}) - Đ/c: ${s.address}${s.distM && s.distM < 50000 ? ` [Cách ~${s.distM}m]` : ''}`).join('\n');
    }

    if (isAskingFoodOrEntertainment) {
      const rec = typeof FOOD_ENTERTAINMENT_DATA.getRecommendationAsync === 'function'
        ? await FOOD_ENTERTAINMENT_DATA.getRecommendationAsync(query, city, context)
        : FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city, context);
      cachedFoodRec = rec;
      extraDomainContext += `\n=== DỮ LIỆU ĐỊA ĐIỂM ẨM THỰC / CAFE / RẠP PHIM / GIẢI TRÍ ĐÃ ĐỊNH VỊ TRÊN BẢN ĐỒ (${rec.title}) ===\n${rec.text}`;
    }

    const systemInstructionText = `Bạn là Trợ lý AI Giao Thông & Bản Đồ Thông Minh MoveSafe VN (Agentic Spatial Copilot) tại ${cityName}.
Dưới đây là DỮ LIỆU THỰC TẾ 100% ĐANG HIỂN THỊ TRÊN MÀN HÌNH BẢN ĐỒ WEB CỦA NGƯỜI DÙNG:

${rag.text}
${extraDomainContext}

NGUYÊN TẮC TRẢ LỜI BẮT BUỘC:
1. ĐỌC KỸ VÀ TRẢ LỜI DỰA TRÊN 100% SỐ LIỆU THỰC TẾ Ở TRÊN:
   - Nếu đang bật "CHẾ ĐỘ GIẢ LẬP MƯA BÃO" hoặc có điểm ngập >0cm trong mục (2), hãy nêu chính xác tên điểm ngập, độ sâu (cm) và khuyến cáo phương tiện. Nếu số điểm ngập >0cm là 0, khẳng định hiện tại mặt đường khô ráo (0cm ngập).
   - Nếu mục (6) có "THÔNG SỐ LỘ TRÌNH THỰC TẾ ĐANG VẼ TRÊN BẢN ĐỒ WEB", BẮT BUỘC trích dẫn chính xác số km, số phút dự kiến, chỉ số an toàn (/100), các trục đường đi qua và các điểm ngập/kẹt xe đã vòng tránh.
   - Nếu người dùng hỏi câu nối tiếp (ví dụ: "chiều ngược lại", "nếu đi ô tô", "quanh chỗ đó có quán gì"), hãy liên kết mạch lạc với lịch sử hội thoại.
2. Nếu người dùng hỏi lộ trình từ A đến B (hoặc đảo chiều lộ trình):
   - Ở dòng cuối cùng của câu trả lời, ghi đúng cú pháp lệnh điều khiển bản đồ:
     [ACTION_ROUTE: Điểm Xuất Phát -> Điểm Đến | AVOID: Tên đường cần tránh nếu có]
   - CHÚ Ý: Nếu người dùng KHÔNG hỏi tìm đường/lộ trình từ A đến B (ví dụ: chỉ hỏi tìm quán ăn, cafe, rạp phim, trạm sạc, xem thời tiết, kiểm tra điểm ngập), TUYỆT ĐỐI KHÔNG xuất cú pháp [ACTION_ROUTE:...].
3. Nếu người dùng hỏi về ăn uống, cafe, rạp phim, vui chơi giải trí:
   - Tư vấn chi tiết các địa điểm theo đúng danh sách đã định vị ở trên (tên quán, địa chỉ, khoảng cách ~m, đặc sản, giá tham khảo và mẹo gửi xe/di chuyển).
   - KHÔNG xuất [ACTION_ROUTE] vì hệ thống đã tự động ghim vị trí các quán lên bản đồ.
4. Phong cách: Thông minh, súc tích, cấu trúc gạch đầu dòng rõ ràng, giàu thông tin thực địa. TUYỆT ĐỐI KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;

    // Xây dựng mảng contents đa lượt (Multi-turn Conversation History)
    const contents = [];
    const rawHistory = Array.isArray(context.history) ? context.history.slice(-6) : [];
    for (const msg of rawHistory) {
      if (!msg || !msg.text) continue;
      const role = msg.role === 'model' || msg.sender === 'bot' ? 'model' : 'user';
      // Đảm bảo luân phiên user / model hợp lệ
      if (contents.length === 0 && role === 'model') continue;
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n${msg.text}`;
      } else {
        contents.push({
          role,
          parts: [{ text: String(msg.text).slice(0, 1200) }]
        });
      }
    }

    const finalUserPrompt = `${systemInstructionText}\n\nCÂU HỎI HIỆN TẠI CỦA NGƯỜI DÙNG: "${query}"`;
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text = finalUserPrompt;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: finalUserPrompt }]
      });
    }

    const enableSearch = (isAskingTrafficOnly || lower.includes('sự kiện') || lower.includes('hôm qua') || lower.includes('concert')) && (!liveEvents || liveEvents.articlesCount === 0);

    // CHIẾN LƯỢC HEDGED PARALLEL MODEL ROUTING:
    // Ưu tiên nhóm Cân bằng Thông minh & Phản hồi nhanh: gemini-3-flash-preview (~2s) & gemini-3.6-flash (~3.5s)
    let result = null;
    try {
      result = await new Promise((resolve, reject) => {
        let settled = false;
        let errors = 0;
        const primaryPair = ['gemini-2.5-flash', 'gemini-3-flash-preview'];

        const handleSuccess = (res) => {
          if (!settled) {
            settled = true;
            resolve(res);
          }
        };
        const handleError = (err) => {
          errors++;
          if (errors >= primaryPair.length && !settled) {
            reject(err);
          }
        };

        // Kích hoạt ngay model tốc độ cao thông minh số 1
        this._invokeSingleGeminiModel(primaryPair[0], apiKey, contents, enableSearch, 6000)
          .then(handleSuccess)
          .catch(handleError);

        // Sau 900ms nếu model 1 chưa xong, kích hoạt song song model cân bằng số 2 (Hedged Request) để đảm bảo phản hồi nhanh
        const hedgeTimer = setTimeout(() => {
          if (!settled) {
            this._invokeSingleGeminiModel(primaryPair[1], apiKey, contents, false, 6500)
              .then(handleSuccess)
              .catch(handleError);
          }
        }, 900);
        if (hedgeTimer.unref) hedgeTimer.unref();
      });
    } catch (_primaryErr) {
      // Dự phòng sang tầng 2 nếu cả 2 model chính đều bận
      const backupModels = ['gemini-2.5-flash-lite', 'gemini-flash-latest'];
      for (const bModel of backupModels) {
        try {
          result = await this._invokeSingleGeminiModel(bModel, apiKey, contents, false, 6000);
          if (result) break;
        } catch (_e) {}
      }
    }

    if (!result || !result.reply) {
      throw new Error('All Gemini models unavailable');
    }

    let reply = result.reply;
    const modelUsed = result.model;

    // Bóc tách Lệnh điều khiển bản đồ (Multi-Intent Action Directives)
    let action = null;
    const secondaryActions = [];

    if (isAskingFoodOrEntertainment && cachedFoodRec?.action) {
      action = cachedFoodRec.action;
    } else if (isAskingEV) {
      action = { type: 'SHOW_EV_LAYER' };
    } else if (isAskingTrafficOnly) {
      action = { type: 'SHOW_TRAFFIC_LAYER' };
    } else if (lower.includes('thời tiết') || lower.includes('mưa')) {
      action = { type: 'SHOW_WEATHER_LAYER' };
    } else if (lower.includes('ngập')) {
      action = { type: 'SHOW_FLOOD_LAYER' };
    } else if (rag.anchor && rag.anchor.ward) {
      action = {
        type: 'FOCUS_POINT',
        lat: rag.anchor.lat,
        lng: rag.anchor.lng,
        name: rag.anchor.name
      };
    }

    const routeMatch = reply.match(/\[ACTION_ROUTE:\s*(.*?)\s*->\s*(.*?)(?:\s*\|\s*AVOID:\s*(.*?))?\]/i);
    let autoOrigin = null;
    let autoDest = null;
    let autoAvoid = null;

    if (routeMatch) {
      autoOrigin = routeMatch[1].trim();
      autoDest = routeMatch[2].trim();
      if (routeMatch[3] && !routeMatch[3].match(/^(?:không|none|null)$/i)) {
        autoAvoid = routeMatch[3].trim();
      }
    } else if (parsedRoute) {
      autoOrigin = parsedRoute.origin;
      autoDest = parsedRoute.destination;
      autoAvoid = parsedRoute.avoidRoad;
    }

    if (autoOrigin && autoDest) {
      const routeAction = {
        type: 'AUTO_ROUTE',
        origin: autoOrigin,
        destination: autoDest,
        avoidLevel: mergedData.currentAvoidLevel,
        timeOffsetHours: parsedRoute ? parsedRoute.timeOffsetHours : mergedData.predictionOffsetHours,
        avoidRoads: autoAvoid ? [autoAvoid] : (parsedRoute?.avoidRoad ? [parsedRoute.avoidRoad] : []),
        requestedVehicle: parsedRoute?.requestedVehicle || null
      };

      // Nếu câu hỏi thuần tuý về ẩm thực/vui chơi/trạm sạc (không có parsedRoute A -> B)
      // thì ưu tiên action chuyên biệt (SHOW_FOOD_PLACES, SHOW_EV_LAYER), routeAction chỉ là secondary.
      if (action && (action.type === 'SHOW_FOOD_PLACES' || action.type === 'SHOW_EV_LAYER')) {
        if (parsedRoute) {
          secondaryActions.push(action);
          action = routeAction;
        } else {
          secondaryActions.push(routeAction);
        }
      } else {
        action = routeAction;
      }
    }

    const followUpMatch = reply.match(/\[FOLLOW_UPS:\s*(.*?)\]/i);
    let extractedFollowUps = null;
    if (followUpMatch && followUpMatch[1]) {
      extractedFollowUps = followUpMatch[1].split('|').map(s => s.trim()).filter(Boolean);
      reply = reply.replace(/\[FOLLOW_UPS:\s*.*?\]/gi, '').trim();
    }

    reply = reply
      .replace(/\[ACTION_ROUTE:\s*.*?\s*\]/gi, '')
      .replace(/\[ACTION_FOCUS:\s*.*?\s*\]/gi, '')
      .replace(/\[ACTION_LAYER:\s*.*?\s*\]/gi, '')
      .trim();

    const followUps = (extractedFollowUps && extractedFollowUps.length >= 2)
      ? extractedFollowUps.slice(0, 3)
      : this.buildSmartFollowUps(query, city, parsedRoute || (autoOrigin && autoDest ? { origin: autoOrigin, destination: autoDest } : null), isAskingFoodOrEntertainment, isAskingEV, mergedData, rag.anchor);

    const cleanReply = this.stripEmojis(reply);
    const spatialCitations = this.extractSpatialCitations(cleanReply, mergedData, rag.anchor);

    return {
      text: cleanReply,
      reply: cleanReply,
      action,
      secondaryActions,
      followUps,
      spatialCitations,
      routeSummary: mergedData.activeRoute || null,
      modelUsed,
      source: modelUsed
    };
  }

  /**
   * Bộ não AI cục bộ giàu dữ liệu thực tế (khi chạy Offline hoặc hết hạn mức API)
   * Đọc trực tiếp 100% từ mergedData (gồm cả Giả lập mưa bão, Dự báo +1..3h, Lộ trình thực tế, Thời tiết 87 phường, VOV)
   */
  async generateSmartLocalResponse(query, city, mergedData, context = {}, liveEvents = null) {
    const lower = query.toLowerCase();
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const sessionMemory = context.sessionMemory || {};
    const parsedRoute = this.parseRouteQuery(query, sessionMemory);
    const { allFloods, activeFloods, allTraffics, vovNews, cityStations, weatherAlerts, activeRoute, isSimulationMode, predictionOffsetHours } = mergedData;
    const rag = this.buildComprehensiveSpatialContext(query, city, mergedData, context, liveEvents);
    const isFoodQ = FOOD_ENTERTAINMENT_DATA.isFoodOrFun(query);
    const isEVQ = /(?:trạm sạc|sạc xe|sạc pin|sạc điện|xe điện|đổi pin|open charge)/i.test(lower);
    const followUps = this.buildSmartFollowUps(query, city, parsedRoute, isFoodQ, isEVQ, mergedData, rag.anchor);

    const formatLocalResult = (res) => {
      const clean = this.stripEmojis(res.text || res.reply || '');
      return {
        ...res,
        text: clean,
        reply: clean,
        secondaryActions: res.secondaryActions || [],
        spatialCitations: this.extractSpatialCitations(clean, mergedData, rag.anchor),
        modelUsed: 'MoveSafe Local AI Engine',
        source: 'MoveSafe Local AI Engine'
      };
    };

    // 0a. Nếu hỏi lộ trình từ A đến B (tích hợp thông số thật từ activeRoute nếu Client đã tính toán)
    if (parsedRoute) {
      const { origin, destination, timeOffsetHours, avoidRoad, requestedVehicle } = parsedRoute;
      const activeJams = allTraffics.filter(t => t.isJam);

      let routeDetailsText = '';
      if (activeRoute && activeRoute.recommended) {
        const rec = activeRoute.recommended;
        const streetsLine = (rec.streetNames && rec.streetNames.length > 0)
          ? `\n• **Trục đường di chuyển chính**: ${rec.streetNames.join(' -> ')}`
          : '';
        const avoidedLine = (rec.avoidedFloods && rec.avoidedFloods.length > 0)
          ? `\n• **Điểm ngập đã vòng tránh**: ${rec.avoidedFloods.join(', ')}`
          : '';
        routeDetailsText =
          `• **Tuyến tối ưu (${rec.name || 'Lộ trình An toàn'})**: Dài **${rec.distanceKm} km** — Thời gian dự kiến **${rec.estimatedMinutes} phút** (Chỉ số an toàn: **${rec.safetyScore}/100**)` +
          streetsLine + avoidedLine + '\n';
      }

      const timeNote = (timeOffsetHours || predictionOffsetHours) > 0
        ? `\n• **Dự báo trong +${timeOffsetHours || predictionOffsetHours} giờ tới**: Hệ thống đã áp dụng mô hình dự báo lưu lượng và độ rút nước +${timeOffsetHours || predictionOffsetHours}h trên lộ trình.`
        : '';
      const simNote = isSimulationMode
        ? `\n• **Chế độ Giả lập Mưa Bão**: Hệ thống đang tính toán đường vòng tránh **${activeFloods.length} rốn ngập mô phỏng** trên bản đồ.`
        : '';
      const trafficNote = activeJams.length > 0
        ? `Hiện ghi nhận **${activeJams.length} điểm ùn ứ** và **${activeFloods.length} điểm ngập**, hệ thống đã tự động chọn lộ trình vòng thông thoáng.`
        : `Các trục đường chính hiện tại lưu thông ổn định (${activeFloods.length} điểm ngập).`;

      const avoidHypothesisNote = avoidRoad
        ? `\n• **Tình huống giả định**: Tuyến đường **${avoidRoad}** giả định bị cấm/tắc. MoveSafe đã loại bỏ hoàn toàn các nhánh qua **${avoidRoad}** và chuyển sang hành lang thay thế.`
        : '';

      const secondaryActions = [];
      let extraFoodNote = '';
      if (isFoodQ) {
        const rec = typeof FOOD_ENTERTAINMENT_DATA.getRecommendationAsync === 'function'
          ? await FOOD_ENTERTAINMENT_DATA.getRecommendationAsync(query, city, context)
          : FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city, context);
        if (rec && rec.action) {
          secondaryActions.push(rec.action);
          extraFoodNote = `\n\n**Gợi ý địa điểm tại khu vực đến (${rec.title})**:\n` +
            (rec.action.spots || []).slice(0, 3).map((s, idx) => `${idx + 1}. **${s.name}** (${s.address}) - ${s.price}`).join('\n');
        }
      }

      return formatLocalResult({
        text: `**Phân tích lộ trình di chuyển thông minh từ dữ liệu bản đồ thực tế**\n\n` +
              `• **Hành trình**: ${origin} -> ${destination}\n` +
              routeDetailsText +
              `• **Tình trạng mạng lưới**: ${trafficNote}${simNote}${timeNote}${avoidHypothesisNote}\n` +
              `• **Chế độ điều phối**: Ưu tiên lộ trình an toàn, né các rốn ngập sâu, nút giao ùn tắc và tuyến đường cấm giả định.` +
              extraFoodNote,
        action: {
          type: 'AUTO_ROUTE',
          origin,
          destination,
          avoidLevel: mergedData.currentAvoidLevel,
          timeOffsetHours: timeOffsetHours || predictionOffsetHours,
          avoidRoads: avoidRoad ? [avoidRoad] : [],
          requestedVehicle: requestedVehicle || null
        },
        secondaryActions,
        followUps,
        routeSummary: activeRoute || null
      });
    }

    // 0b. Nếu người dùng hỏi về ăn uống, quán ngon, rạp chiếu phim, cafe hoặc điểm vui chơi giải trí
    if (isFoodQ) {
      const rec = typeof FOOD_ENTERTAINMENT_DATA.getRecommendationAsync === 'function'
        ? await FOOD_ENTERTAINMENT_DATA.getRecommendationAsync(query, city, context)
        : FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city, context);
      return formatLocalResult({
        text: rec.text,
        action: rec.action,
        followUps
      });
    }

    // 0c. Nhận diện các câu hỏi về sự kiện, đông người, kẹt xe diện rộng
    const isEventOrCrowdQuery = (
      lower.includes('đông thế') || lower.includes('đông vậy') || lower.includes('sao đông') ||
      lower.includes('tại sao đông') || lower.includes('đông đúc') || lower.includes('có sự kiện gì') ||
      lower.includes('hôm qua') || lower.includes('tối qua') || lower.includes('vừa qua') || lower.includes('concert') ||
      lower.includes('nhạc hội') || lower.includes('đại nhạc hội') || (lower.includes('sân vận động') && (lower.includes('đông') || lower.includes('tắc'))) ||
      (liveEvents && liveEvents.articlesCount > 0)
    );

    if (isEventOrCrowdQuery && (lower.includes('mỹ đình') || lower.includes('sân vận động') || lower.includes('svđ'))) {
      let newsBullet = '';
      if (liveEvents && liveEvents.articlesCount > 0) {
        newsBullet = `• **Sự kiện ghi nhận thực tế từ báo chí chính thống**:\n` +
          liveEvents.articles.map(a => `  - *${a.source}*: "${a.title}"`).join('\n') + `\n\n`;
      }
      return formatLocalResult({
        text: `**Hiện tượng đông đúc & sự kiện tại khu vực Sân vận động Quốc gia Mỹ Đình**:\n\n` +
              (newsBullet || '') +
              `• **Bối cảnh & Quy mô**: Sân vận động Mỹ Đình thường tổ chức các đại nhạc hội, liveshow âm nhạc quy mô lớn (30.000 - 40.000 khán giả) hoặc các trận thi đấu bóng đá ĐTQG Việt Nam.\n` +
              `• **Khung giờ cao điểm**: Khoảng 18h00 - 22h30 là thời điểm lượng khán giả và xe cộ dồn về cùng lúc, làm quá tải các trục tiếp cận: **Lê Đức Thọ, Lê Quang Đạo, Châu Văn Liêm, Nguyễn Hoàng, Mễ Trì và Hồ Tùng Mậu**.\n` +
              `• **Khuyến nghị di chuyển thông minh**: Nên đi sớm trước 2 tiếng, ưu tiên sử dụng **Metro Tuyến 3 (Ga Lê Đức Thọ / Ga Cầu Giấy)** hoặc gửi xe tại các bãi ngoài bán kính 1km (Cung Điền kinh, The Garden) rồi đi bộ vào sân.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' },
        followUps
      });
    }

    // 1. Hỏi về thông tin Phường hoặc Tuyến đường tại Hà Nội (kết hợp trực tiếp điểm ngập + điểm tắc + thời tiết quanh phường đó)
    if (rag.anchor && rag.anchor.ward && (lower.includes('phường') || lower.includes('quận') || lower.includes('thoát nước') || lower.startsWith('thông tin') || lower.startsWith('thời tiết') || lower.includes('tình hình'))) {
      const matchedWard = rag.anchor.ward;
      const streetsList = (matchedWard.mainStreets || []).join(', ');
      const hotspotsList = (matchedWard.trafficHotspots || []).join('; ');
      const liveStation = cityStations.find(s => s.id === matchedWard.id || s.name === matchedWard.name);
      const weatherLine = liveStation
        ? `• **Thời tiết thực tế tại phường**: **${liveStation.temp}°C**, ${liveStation.description} (Lượng mưa 1h: **${liveStation.rain1h || 0}mm**).`
        : `• **Thời tiết thực tế tại phường**: Tạnh ráo, tầm nhìn tốt.`;

      const nearbyFloods = activeFloods.filter(f => calcDistM(matchedWard.lat, matchedWard.lng, f.lat, f.lng) <= 2500);
      const floodLine = nearbyFloods.length > 0
        ? `• **Cảnh báo ngập lân cận**: Ghi nhận ${nearbyFloods.map(f => `**${f.name}** (ngập ${f.depth_cm}cm)`).join(', ')}.`
        : `• **Tình trạng mặt đường**: Hiện khô ráo (0 điểm ngập trong bán kính 2.5km).`;

      return formatLocalResult({
        text: `**Hồ sơ Giao thông, Thời tiết & Thoát nước: ${matchedWard.name} (Quận ${matchedWard.district})**\n\n` +
              `• **Các trục đường chính**: ${streetsList}.\n` +
              `• **Điểm giao cắt trọng điểm**: ${hotspotsList}.\n` +
              `• **Đặc điểm thoát nước**: ${matchedWard.floodVulnerability}.\n` +
              `${floodLine}\n` +
              `${weatherLine}\n` +
              `• **Đánh giá lưu thông**: ${matchedWard.description}`,
        action: {
          type: 'FOCUS_POINT',
          lat: matchedWard.lat,
          lng: matchedWard.lng,
          name: matchedWard.name
        },
        followUps
      });
    }

    // 2. Hỏi về thời tiết, mưa, bão, ngập úng (Đọc chuẩn 100% cả khi bật Chế độ Giả lập Mưa Bão hoặc Dự báo +1..3h)
    if (lower.includes('mưa') || lower.includes('thời tiết') || lower.includes('nhiệt độ') || lower.includes('ngập') || lower.includes('bão') || lower.includes('thủy kích') || lower.includes('nước')) {
      const qNorm = normalizeVi(query);
      const matchedFlood = allFloods.find(f => {
        const words = normalizeVi(f.name).split(/\s+/).filter(w => w.length >= 4);
        return words.length >= 2 && qNorm.includes(words.slice(0, 2).join(' '));
      });

      if (matchedFlood) {
        const isFlooded = (matchedFlood.depth_cm || 0) > 0 && matchedFlood.danger_level !== 'safe';
        return formatLocalResult({
          text: isFlooded
            ? `**Cảnh báo ngập tại ${matchedFlood.name}**${isSimulationMode ? ' *(Chế độ Giả lập Mưa Bão)*' : ''}:\n\n` +
              `• **Mực nước đo được**: Ngập sâu **${matchedFlood.depth_cm}cm** (Mức độ: ${matchedFlood.danger_level === 'critical' ? 'Nghiêm trọng' : 'Cảnh báo'}).\n` +
              `• **Khả năng lưu thông**: ${matchedFlood.passable_motorbike ? 'Xe máy đi chậm sát tim đường' : 'Xe máy KHÔNG nên đi qua, nguy cơ chết máy cao'}.\n` +
              `• **Khuyến nghị**: ${matchedFlood.advice || 'Chủ động chọn lộ trình vòng tránh.'}`
            : `**Thông tin trạm đo ${matchedFlood.name}**: Hiện mặt đường **khô ráo (0cm ngập)**. ${matchedFlood.advice || 'Các phương tiện lưu thông bình thường.'}`,
          action: {
            type: 'FOCUS_POINT',
            lat: matchedFlood.lat,
            lng: matchedFlood.lng,
            name: matchedFlood.name
          },
          followUps
        });
      }

      if (activeFloods.length > 0) {
        const sortedFloods = [...activeFloods].sort((a, b) => (b.depth_cm || 0) - (a.depth_cm || 0));
        const modeBadge = isSimulationMode ? ' *(Đang bật Chế độ Giả lập Mưa Bão)*' : (predictionOffsetHours > 0 ? ` *(Dự báo +${predictionOffsetHours}h tới)*` : '');
        const floodListText = sortedFloods.slice(0, 8).map((f, i) =>
          `${i + 1}. **${f.name}**: Ngập **${f.depth_cm}cm** — ${f.passable_motorbike ? 'Xe máy đi chậm' : 'Khuyến cáo xe máy không đi qua'}`
        ).join('\n');

        return formatLocalResult({
          text: `**Báo cáo Ngập úng & Thời tiết trên bản đồ ${cityName}**${modeBadge}:\n\n` +
                `Hiện tại hệ thống ghi nhận **${activeFloods.length} điểm ngập** trên bản đồ (Điểm ngập sâu nhất: **${sortedFloods[0].name}** - **${sortedFloods[0].depth_cm}cm**):\n\n` +
                `${floodListText}\n\n` +
                `**Khuyến nghị**: Khi tìm đường trong khung chat hoặc thanh tìm kiếm, hệ thống sẽ tự động vạch lộ trình vòng tránh toàn bộ ${activeFloods.length} điểm ngập này.`,
          action: { type: 'SHOW_FLOOD_LAYER' },
          followUps
        });
      }

      const maxRain = cityStations.reduce((max, s) => Math.max(max, s.rain1h || 0), 0);
      const avgTemp = cityStations.length > 0
        ? Math.round(cityStations.reduce((sum, s) => sum + (s.temp || 26), 0) / cityStations.length)
        : 26;

      return formatLocalResult({
        text: `**Trạng thái Thời tiết & Ngập úng thực tế (${cityName})**:\n\n` +
              `• **Tình trạng ngập**: Toàn bộ **${allFloods.length}/${allFloods.length} trạm đo** trên bản đồ hiện đang **khô ráo (0cm ngập)**.\n` +
              `• **Thời tiết các quận/phường**: Nhiệt độ trung bình **${avgTemp}°C**, lượng mưa cao nhất **${maxRain} mm/h**.\n` +
              `• **Đánh giá**: Điều kiện mặt đường khô ráo, an toàn tuyệt đối cho cả xe máy và ô tô. *(Bạn có thể bật nút "Giả lập Mưa Bão" trên thanh công cụ nếu muốn kiểm thử kịch bản ngập diện rộng).*`,
        action: { type: 'SHOW_FLOOD_LAYER' },
        followUps
      });
    }

    // 3. Hỏi về tình trạng tắc đường, kẹt xe, giao thông (Tìm chính xác theo tên đường trong toàn bộ 45+ sự cố + VOV)
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('giao thông') || lower.includes('đường')) {
      const qNorm = normalizeVi(query);
      const qTokens = qNorm.split(/\s+/).filter(t => t.length >= 3 && !['tac', 'ket', 'duong', 'pho', 'giao', 'thong', 'hien', 'tai', 'khong', 'nhu', 'the', 'nao'].includes(t));

      const matchedIncidents = allTraffics.filter(t => {
        const tNorm = normalizeVi(`${t.description || ''} ${t.from || ''} ${t.to || ''}`);
        return qTokens.length > 0 && qTokens.some(tk => tNorm.includes(tk));
      });

      const activeJams = allTraffics.filter(t => t.isJam);
      const topJams = [...activeJams].sort((a, b) => (b.delaySeconds || 0) - (a.delaySeconds || 0));

      let specificSection = '';
      if (matchedIncidents.length > 0) {
        specificSection = `**Ghi nhận trực tiếp tại khu vực bạn hỏi (${matchedIncidents.length} điểm)**:\n` +
          matchedIncidents.slice(0, 5).map(t => `• **[${t.isJam ? `Ùn tắc trễ ~${Math.round((t.delaySeconds || 120) / 60)} phút` : 'Rào chắn / Thi công'}]** ${this.stripEmojis(t.description)}`).join('\n') + `\n\n`;
      }

      const vovSection = (vovNews && vovNews.length > 0)
        ? `\n\n**Bản tin VOV Giao Thông mới nhất**:\n` + vovNews.slice(0, 2).map(n => `• *"${this.stripEmojis(n.title || n.content)}"*`).join('\n')
        : '';

      return formatLocalResult({
        text: `**Toàn cảnh Giao thông Thời gian thực từ TomTom & VOV (${cityName})**:\n\n` +
              `Hệ thống đang theo dõi **${allTraffics.length} sự cố giao thông** (gồm **${activeJams.length} điểm ùn tắc** và **${allTraffics.length - activeJams.length} điểm rào chắn/thi công**).\n\n` +
              specificSection +
              `**Các điểm ùn tắc có độ trễ cao nhất hiện tại**:\n` +
              (topJams.length > 0
                ? topJams.slice(0, 5).map(t => `• **${this.stripEmojis(t.description)}** (Trễ ~${Math.round((t.delaySeconds || 120) / 60)} phút)`).join('\n')
                : `• Các trục chính hiện lưu thông ổn định, không có điểm ùn tắc nghiêm trọng.`) +
              vovSection,
        action: { type: 'SHOW_TRAFFIC_LAYER' },
        followUps
      });
    }

    // 4. Hỏi về trạm sạc xe điện
    if (isEVQ) {
      const evService = require('./ev-service');
      const stations = evService.getStations(city, false);
      const fastCount = stations.filter(s => s.isFastCharge).length;
      const sortedStations = rag.anchor
        ? [...stations].map(s => ({ ...s, distM: calcDistM(rag.anchor.lat, rag.anchor.lng, s.lat, s.lng) })).sort((a, b) => a.distM - b.distM)
        : stations;

      const sampleList = sortedStations.slice(0, 4).map(s =>
        `• **${s.name}** (${s.operator}) - **${s.maxPowerKw}kW** - ${s.address}${s.distM && s.distM < 30000 ? ` *(Cách ~${s.distM}m)*` : ''}`
      ).join('\n');

      return formatLocalResult({
        text: `**Mạng lưới Trạm sạc Xe điện (${cityName}) - Open Charge Map & Đối tác**:\n\n` +
              `Hiện có **${stations.length} trạm sạc khả dụng** trên bản đồ (gồm **${fastCount} trạm sạc nhanh DC** 60kW - 250kW và trạm đổi pin Selex).\n\n` +
              `**Các trạm sạc phù hợp & gần khu vực của bạn nhất**:\n` +
              sampleList +
              `\n\n*Lớp bản đồ trạm sạc đã được bật. Bạn có thể bấm trực tiếp vào từng trạm trên bản đồ để xem cổng sạc hoặc bấm Chỉ đường né ngập.*`,
        action: { type: 'SHOW_EV_LAYER' },
        followUps
      });
    }

    // 5. Tổng quan thông minh toàn thành phố
    const activeJams = allTraffics.filter(t => t.isJam);
    return formatLocalResult({
      text: `**Tổng quan Trạng thái Đô thị Thời gian thực (${cityName})**:\n\n` +
            `• **Tình trạng ngập úng**: Đang có **${activeFloods.length}/${allFloods.length} điểm ngập** trên bản đồ${isSimulationMode ? ' *(Chế độ Giả lập Mưa Bão)*' : ''}.\n` +
            `• **Tình trạng giao thông**: Ghi nhận **${activeJams.length} điểm ùn tắc** và **${allTraffics.length - activeJams.length} điểm rào chắn/thi công** từ TomTom & VOV.\n` +
            `• **Thời tiết**: Đang đồng bộ trực tiếp **${cityStations.length} trạm đo phường/quận**.\n\n` +
            `Bạn có thể hỏi bất kỳ lộ trình, con phố, điểm ngập hay quán ăn nào (Ví dụ: *"Từ Cầu Giấy ra Bến xe Mỹ Đình đi đường nào?"* hoặc *"Quán ăn ngon gần Chùa Láng"*).`,
      action: null,
      followUps
    });
  }
}

module.exports = new AIAssistantService();
