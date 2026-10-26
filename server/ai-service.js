const axios = require('axios');
const botService = require('./bot-service');
const HANOI_WARDS_DATA = require('../js/hanoi-wards-streets');
const FOOD_ENTERTAINMENT_DATA = require('../js/food-entertainment-data');
const webEventService = require('./web-event-service');

class AIAssistantService {
  stripEmojis(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^ +/gm, '')
      .trim();
  }

  /**
   * Phân tích câu hỏi tìm đường tự nhiên tiếng Việt
   * Xử lý chính xác:
   * 1. Lộ trình xuôi: "từ an trai ra bến xe mỹ đình trong 2h tới có bị tắc đường không"
   * 2. Lộ trình ngược (Điểm đến trước, điểm đi sau): "cuối thứ 7 tuần này tôi muốn nghe nhạc tại cafe cộng đối diện sân vận động mỹ đình đi từ an TRAI RA đường nào đư tác"
   * 3. Tình huống giả định né / cấm đường: "giả sử đường trịnh văn bô cấm đường tôi đi từ khu đô thị vân canh ra bến xe mỹ đình đi đường nào"
   */
  parseRouteQuery(query) {
    if (!query) return null;

    // 1. Trích xuất điều kiện giả định cấm đường / né đường (Hypothetical Road Closure / Avoidance)
    let avoidRoad = null;
    const avoidPatterns = [
      /giả\s+sử(?:\s+như)?\s+(?:đường\s+|tuyến\s+)?(.+?)\s+(?:bị\s+)?(?:cấm\s+đường|cấm|đóng\s+đường|ngập\s+sâu|ngập|tắc\s+cứng|kẹt\s+xe|không\s+đi\s+được)/i,
      /nếu(?:\s+như)?\s+(?:đường\s+|tuyến\s+)?(.+?)\s+(?:bị\s+)?(?:cấm\s+đường|cấm|đóng\s+đường|ngập\s+sâu|ngập|tắc)/i,
      /(?:tránh|né|không\s+đi\s+qua|không\s+muốn\s+đi\s+qua)\s+(?:đường\s+|tuyến\s+)?(.+?)(?:\s+(?:thì|tôi|mình|đi|bạn|nhé)|[,.]|$)/i
    ];

    for (const pat of avoidPatterns) {
      const m = query.match(pat);
      if (m && m[1]) {
        const candidate = m[1].replace(/^(?:đường|phố|tuyến)\s+/i, '').trim();
        if (candidate.length >= 2 && !candidate.match(/^(?:tôi|mình|bạn|gì|nào)$/i)) {
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

    // 3. Tách câu hỏi làm sạch để tìm điểm đi / điểm đến
    let cleanQuery = query;
    for (const pat of avoidPatterns) {
      cleanQuery = cleanQuery.replace(pat, ' ');
    }

    // Xóa các câu hỏi phụ ở đuôi (ưu tiên xóa cụm dài trước cụm ngắn)
    let cleaned = cleanQuery
      .replace(/(?:trong|sau|khoảng)\s*\d+\s*(?:h|giờ|tiếng|phút|p)\s*(?:tới|nữa|sau)?.*$/i, '')
      .replace(/\s+\d+\s*(?:h|giờ|tiếng)\s*(?:tới|nữa).*$/i, '')
      .replace(/\s+(?:đi\s+đường\s+nào|đường\s+nào\s+đư\s+tác|đường\s+nào\s+đỡ\s+tắc|đường\s+nào\s+đỡ\s+ngập|đường\s+nào\s+thông\s+thoáng|đường\s+nào\s+nhanh\s+nhất|đường\s+nào|như\s+thế\s+nào|thế\s+nào|ra\s+sao|hết\s+bao\s+lâu).*$/i, '')
      .replace(/\s+(?:hiện tại|bây giờ|lúc này|hôm nay|chiều nay|tối nay|sáng nay|cuối tuần này|thứ \d+ này)?\s*(?:có bị|có đang|có|bị|đang)?\s*(?:tắc đường|kẹt xe|ùn tắc|tắc|kẹt|ngập nước|ngập úng|ngập|mưa|thông thoáng|đi được).*$/i, '')
      .replace(/\s+(?:không|chưa|nhỉ|vậy|ạ|nhé|\?|\.|!)+$/i, '')
      .trim();

    // Pattern A: Điểm đến trước, điểm đi sau
    // Ví dụ: "cuối thứ 7 tuần này tôi muốn nghe nhạc tại cafe cộng đối diện sân vận động mỹ đình đi từ an TRAI RA đường nào đư tác"
    // Ví dụ 2: "muốn đến viện 103 đi từ ngã tư sở đường nào đỡ ngập"
    const destFirstRegex = /(?:tôi\s+)?(?:muốn|cần|định|thích)?\s*(?:nghe\s+nhạc|uống\s+cafe|cafe|ăn\s+uống|xem\s+phim|đi\s+chơi|đến|tới|ghé|về|ở|đi)?\s*(?:tại|ở|đến|tới)\s+(.+?)\s+(?:đi\s+)?từ\s+(.+?)(?:\s+(?:ra|vào|đến|theo|qua)\s+.*|\s*$)/i;
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
          avoidRoad
        };
      }
    }

    // Pattern B: Điểm đi trước, điểm đến sau thông thường
    // "đi từ A đến/ra/về B"
    const routeRegex = /(?:tìm đường\s+|chỉ đường\s+|lộ trình\s+|đi\s+)?từ\s+(.+?)\s+(?:đến|về|sang|qua|tới|ra|vào|lên|xuống)\s+(.+)$/i;
    const matchB = cleaned.match(routeRegex);
    if (matchB && matchB[1] && matchB[2]) {
      const orig = matchB[1]
        .replace(/^(?:tôi|mình|bạn|hãy|giúp|muốn|cần|đi)\s+/i, '')
        .replace(/[,.?!]+$/g, '')
        .trim();

      let dest = matchB[2]
        .replace(/\s+(?:né ngập|tránh tắc|không ngập|an toàn|nhanh nhất|thì|được|có|đi|giúp|với|ạ|nhé|nào).*$/i, '')
        .replace(/\s+(?:đường\s+nào\s+.*|đường\s+nào)$/i, '')
        .replace(/[,.?!]+$/g, '')
        .trim();

      // Nếu điểm đến bị cắt cụt thành chữ "đường" hoặc quá ngắn, tìm xem có điểm đến ở vế trước không
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
          avoidRoad
        };
      }
    }

    return null;
  }

  async processQuery({ query, city = 'hanoi', userApiKey = '', context = {} }) {
    const liveData = botService.getData();
    const allCityFloods = (liveData.floodPoints || []).filter(f => f.city === city);
    const activeFloodPoints = allCityFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];
    const cityStations = (liveData.weatherStations || {})[city] || [];

    // Tự động tra cứu sự kiện nóng thời gian thực từ mạng báo chí chính thống
    let liveEvents = null;
    try {
      liveEvents = await webEventService.searchLiveEvents(query, city);
    } catch (e) {
      console.warn('[AI] Tra cứu sự kiện trực tiếp bỏ qua:', e.message);
    }

    const systemGeminiKey = require('./config').API_KEYS.GEMINI || '';
    const activeKey = (userApiKey && userApiKey.trim().length > 10) ? userApiKey.trim() : systemGeminiKey;

    const isCooldown = this._geminiCooldownUntil && Date.now() < this._geminiCooldownUntil;
    if (activeKey && activeKey.length > 10 && !isCooldown) {
      try {
        return await this.callGeminiAPI(query, liveData, city, activeKey, context, liveEvents);
      } catch (err) {
        const status = err.response?.status;
        if (status === 429 || status === 403 || status === 503 || (err.message && err.message.includes('timeout'))) {
          this._geminiCooldownUntil = Date.now() + 60000; // Cooldown 60s khi quota/timeout để phản hồi tức thì (<5ms)
        }
        console.warn('[AI] Gọi Gemini API thất bại, chuyển sang Bộ não AI tích hợp:', err.message);
      }
    }

    return await this.generateSmartLocalResponse(query, city, activeFloodPoints, allCityFloods, trafficIncidents, weatherAlerts, cityStations, context, liveEvents);
  }

  async generateSmartLocalResponse(query, city, activeFloods, allFloods, traffics, alerts, cityStations = [], context = {}, liveEvents = null) {
    const lower = query.toLowerCase();
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const parsedRoute = this.parseRouteQuery(query);

    // 0a. Nếu là câu hỏi lộ trình từ A đến B (ưu tiên số 1: Xử lý cả lộ trình xuôi, ngược và giả định né đường)
    if (parsedRoute) {
      const { origin, destination, timeOffsetHours, avoidRoad } = parsedRoute;
      const activeJams = traffics.filter(t => t.isJam);
      const timeNote = timeOffsetHours > 0
        ? `\n• **Dự báo trong +${timeOffsetHours} giờ tới**: Hệ thống đã kích hoạt mô hình dự báo lưu lượng +${timeOffsetHours}h trên lộ trình.`
        : '';
      const trafficNote = activeJams.length > 0
        ? `Hiện ghi nhận **${activeJams.length} điểm ùn ứ**, hệ thống đã tự động chọn lộ trình vòng thông thoáng.`
        : `Các trục đường chính hiện tại lưu thông ổn định, thông thoáng.`;

      const avoidHypothesisNote = avoidRoad
        ? `\n• **Tình huống giả định**: Tuyến đường **${avoidRoad}** giả định bị cấm lưu thông. MoveSafe đã kích hoạt thuật toán tìm đường vòng, loại bỏ hoàn toàn các cung đường qua **${avoidRoad}** và chọn hành lang thay thế an toàn.`
        : '';

      return {
        text: `**Đã tự động phân tích và vẽ lộ trình trên bản đồ**\n\n` +
              `• **Điểm xuất phát**: ${origin}\n` +
              `• **Điểm đến**: ${destination}\n` +
              `• **Tình trạng giao thông**: ${trafficNote}${timeNote}${avoidHypothesisNote}\n` +
              `• **Chế độ điều phối**: Ưu tiên lộ trình an toàn, né hoàn toàn các điểm ngập úng, nút giao ùn tắc và tuyến đường cấm giả định.\n\n` +
              `*Bảng chi tiết lộ trình và bản đồ dẫn đường đã được mở tự động ở phía bên trái.*`,
        action: {
          type: 'AUTO_ROUTE',
          origin,
          destination,
          avoidLevel: 1,
          timeOffsetHours,
          avoidRoads: avoidRoad ? [avoidRoad] : []
        }
      };
    }

    // 0b. Nếu người dùng hỏi về ăn uống, quán ngon, rạp chiếu phim, cafe hoặc điểm vui chơi giải trí (ưu tiên số 2)
    if (FOOD_ENTERTAINMENT_DATA.isFoodOrFun(query)) {
      const rec = typeof FOOD_ENTERTAINMENT_DATA.getRecommendationAsync === 'function'
        ? await FOOD_ENTERTAINMENT_DATA.getRecommendationAsync(query, city, context)
        : FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city, context);
      return {
        text: rec.text,
        action: rec.action
      };
    }

    // 0c. Nhận diện các câu hỏi về sự kiện, đông người, kẹt xe diện rộng (Event & Crowd Inquiry)
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

      return {
        text: `**Hiện tượng đông đúc & sự kiện tại khu vực Sân vận động Quốc gia Mỹ Đình**:\n\n` +
              (newsBullet || '') +
              `• **Bối cảnh & Quy mô**: Sân vận động Mỹ Đình thường tổ chức các đại nhạc hội, liveshow âm nhạc quy mô lớn (30.000 - 40.000 khán giả) hoặc các trận thi đấu bóng đá ĐTQG Việt Nam.\n` +
              `• **Khung giờ cao điểm**: Khoảng 18h00 - 22h30 là thời điểm lượng khán giả và xe cộ dồn về cùng lúc, làm quá tải nghiêm trọng các trục tiếp cận: **Lê Đức Thọ, Lê Quang Đạo, Châu Văn Liêm, Nguyễn Hoàng, Mễ Trì và Hồ Tùng Mậu**.\n` +
              `• **Khuyến nghị di chuyển thông minh**: Nếu có lịch trình qua khu vực này trong các ngày diễn ra sự kiện, bạn nên đi sớm trước 2 tiếng, ưu tiên sử dụng tuyến **Đường sắt đô thị Metro Tuyến 3 (Ga Lê Đức Thọ / Ga Cầu Giấy)** hoặc gửi xe tại các bãi ngoài bán kính 1km (Khu liên hợp, Cung Điền kinh, The Garden) rồi đi bộ vào sân.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    if (isEventOrCrowdQuery && (lower.includes('phố đi bộ') || lower.includes('hồ gươm') || lower.includes('hoàn kiếm'))) {
      let newsBullet = '';
      if (liveEvents && liveEvents.articlesCount > 0) {
        newsBullet = `• **Sự kiện văn hóa/nghệ thuật ghi nhận từ báo chí chính thống**:\n` +
          liveEvents.articles.map(a => `  - *${a.source}*: "${a.title}"`).join('\n') + `\n\n`;
      }

      return {
        text: `**Tình hình sự kiện & lưu thông tại Không gian Phố đi bộ Hồ Gươm**:\n\n` +
              (newsBullet || '') +
              `• **Quy chế hoạt động**: Tuyến phố đi bộ Hồ Gươm và phụ cận cấm toàn bộ phương tiện cơ giới lưu thông từ tối thứ Sáu đến hết Chủ nhật hàng tuần.\n` +
              `• **Điểm ùn ứ thường gặp**: Các điểm gửi xe và nút giao tiếp cận (Hàng Bài, Hai Bà Trưng, Tràng Tiền, Đinh Tiên Hoàng) thường có mật độ người và xe rất đông vào khung giờ 19h00 - 23h00.\n` +
              `• **Gợi ý gửi xe**: Gửi xe máy/ô tô tại các điểm quy hoạch trên phố Lý Thái Tổ, Trần Nguyên Hãn, Hai Bà Trưng trước khi đi bộ vào khu vực trung tâm.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    if (isEventOrCrowdQuery && (lower.includes('hội nghị quốc gia') || lower.includes('ncc'))) {
      let newsBullet = '';
      if (liveEvents && liveEvents.articlesCount > 0) {
        newsBullet = `• **Sự kiện ghi nhận từ báo chí (${liveEvents.articles[0].source})**: "${liveEvents.articles[0].title}"\n\n`;
      }

      return {
        text: `**Tình hình giao thông tại Trung tâm Hội nghị Quốc gia (NCC)**:\n\n` +
              (newsBullet || '') +
              `Khu vực cổng đường Phạm Hùng và Đại lộ Thăng Long thường đón các đoàn xe ngoại giao, triển lãm quốc tế hoặc sự kiện hội nghị quy mô lớn. Vào giờ tan tầm hoặc trước giờ khai mạc sự kiện, luồng phương tiện chuyển làn rẽ vào trung tâm thường gây xung đột dòng xe nhẹ tại nút giao Phạm Hùng - Trần Duy Hưng.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    if (isEventOrCrowdQuery && liveEvents && liveEvents.articlesCount > 0) {
      return {
        text: `**Thông tin sự kiện & mật độ giao thông tại ${liveEvents.venue || cityName}**:\n\n` +
              `• **Sự kiện ghi nhận thực tế từ báo chí chính thống**:\n` +
              liveEvents.articles.map(a => `  - *${a.source}*: "${a.title}"`).join('\n') + `\n\n` +
              `• **Ảnh hưởng giao thông**: Các sự kiện tập trung đông người thường tạo áp lực lớn lên các tuyến đường tiếp cận lân cận. Người tham gia giao thông nên chủ động sắp xếp thời gian di chuyển hoặc chọn lộ trình vòng tránh khu vực trong khung giờ cao điểm sự kiện.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    // 1. Nhận diện nếu câu hỏi liên quan đến Phường hoặc Tuyến đường lớn ở Hà Nội (chỉ khi không phải câu hỏi sự kiện)
    let matchedWard = null;
    if (city === 'hanoi' && Array.isArray(HANOI_WARDS_DATA) && !isEventOrCrowdQuery && (lower.includes('phường') || lower.includes('quận') || lower.includes('thoát nước') || lower.startsWith('thông tin') || lower.startsWith('thời tiết'))) {
      matchedWard = HANOI_WARDS_DATA.find(w => {
        const cleanWard = w.ward.toLowerCase().replace(/p\.|x\.|tt\./g, '').trim();
        const fullWard = w.name.toLowerCase();
        if ((cleanWard.length >= 3 && lower.includes(cleanWard)) || lower.includes(fullWard)) return true;
        return (w.mainStreets || []).some(st => {
          const cleanSt = st.toLowerCase().replace(/đường|phố|quốc lộ|đại lộ/gi, '').trim();
          return cleanSt.length >= 4 && lower.includes(cleanSt);
        });
      });
    }

    if (matchedWard && (lower.includes('phường') || lower.includes('đường') || lower.includes('phố') || lower.includes('thời tiết') || lower.includes('ngập') || lower.includes('tắc'))) {
      const streetsList = (matchedWard.mainStreets || []).join(', ');
      const hotspotsList = (matchedWard.trafficHotspots || []).join('; ');
      const liveStation = cityStations.find(s => s.id === matchedWard.id || s.name === matchedWard.name);
      const weatherLine = liveStation
        ? `Thời tiết khu vực hiện tại: **${liveStation.temp}°C**, ${liveStation.description} (Lượng mưa 1h: **${liveStation.rain1h || 0}mm**).`
        : `Thời tiết khu vực hiện tại tạnh ráo, tầm nhìn tốt.`;

      return {
        text: `**Thông tin giao thông & mạng lưới đường lớn tại ${matchedWard.name}**:\n\n` +
              `• **Các trục đường chính qua phường**: ${streetsList}.\n` +
              `• **Điểm giao cắt trọng điểm**: ${hotspotsList}.\n` +
              `• **Đặc điểm thoát nước**: ${matchedWard.floodVulnerability}.\n` +
              `• **Đánh giá lưu thông**: ${matchedWard.description}\n\n` +
              `${weatherLine}`,
        action: {
          type: 'FOCUS_POINT',
          lat: matchedWard.lat,
          lng: matchedWard.lng,
          name: matchedWard.name
        }
      };
    }

    // 2. Hỏi về lộ trình chung
    if (lower.includes('tìm đường') || lower.includes('lộ trình') || lower.includes('chỉ đường')) {
      const matchedFlood = allFloods.find(f => {
        const words = f.name.toLowerCase().split(/[(),-]/);
        return words.some(w => w.trim().length > 3 && lower.includes(w.trim()));
      });

      if (matchedFlood) {
        if (matchedFlood.depth_cm > 0 && matchedFlood.danger_level !== 'safe') {
          return {
            text: `**Cảnh báo ngập nước tại ${matchedFlood.name}**\n\n` +
                  `Hiện trạm đo ghi nhận mực nước ngập **${matchedFlood.depth_cm}cm** (${matchedFlood.advice}).\n\n` +
                  `**Khuyến nghị di chuyển**: Xe máy và ô tô gầm thấp không nên đi qua đoạn này. Hệ thống MoveSafe đã tự động vạch lộ trình vòng qua các tuyến phố cao ráo lân cận.`,
            action: {
              type: 'FOCUS_POINT',
              lat: matchedFlood.lat,
              lng: matchedFlood.lng,
              name: matchedFlood.name
            }
          };
        }
        return {
          text: `**Thông tin trạm đo tại ${matchedFlood.name}**:\n\n` +
                `Hiện tại mặt đường **khô ráo (0cm ngập)**, nước đã rút hoàn toàn (${matchedFlood.advice}). Các phương tiện lưu thông bình thường.`,
          action: {
            type: 'FOCUS_POINT',
            lat: matchedFlood.lat,
            lng: matchedFlood.lng,
            name: matchedFlood.name
          }
        };
      }

      const activeJams = traffics.filter(t => t.isJam);
      const floodSummary = activeFloods.length > 0
        ? `**Các điểm ngập cần tránh**:\n` +
          activeFloods.slice(0, 3).map(f => `• **${f.name}**: Ngập ${f.depth_cm}cm (${f.passable_motorbike ? 'Xe máy đi chậm' : 'Xe máy không nên qua'})`).join('\n')
        : `**Tình trạng ngập úng**: Toàn bộ các trục đường tại ${cityName} hiện đang khô ráo (0 điểm ngập).`;

      return {
        text: `**Phân tích lộ trình thông minh tại ${cityName}**:\n\n` +
              `Hiện tại hệ thống ghi nhận **${activeFloods.length} điểm ngập cục bộ** và **${activeJams.length} điểm ùn ứ**.\n\n` +
              `${floodSummary}\n\n` +
              `**Gợi ý**: Bạn có thể nhập câu hỏi theo cú pháp *"Từ Cầu Giấy đến Hoàn Kiếm"* để hệ thống tự động vẽ đường né ngập.`,
        action: { type: 'SHOW_FLOOD_LAYER' }
      };
    }

    // 3. Hỏi về tình trạng tắc đường, kẹt xe, giao thông
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('giao thông')) {
      let roadInsight = '';
      if (lower.includes('xuân phương')) {
        roadInsight = `\n\n**Đặc thù tuyến đường Xuân Phương (Nam Từ Liêm)**:\n` +
                      `• **Lòng đường hẹp**: Mặt cắt đường đoạn cầu vượt và nối ra QL32 hẹp, dễ tạo nút thắt.\n` +
                      `• **Lưu lượng lớn**: Lượng xe từ các khu đô thị đổ ra trục Trịnh Văn Bô và đường 32 cao vào giờ cao điểm.\n` +
                      `• **Gợi ý**: Chuyển hướng đi qua trục đường Trịnh Văn Bô hoặc đường Trần Hữu Dực kéo dài để thông thoáng hơn.`;
      } else if (lower.includes('nguyễn trãi') || lower.includes('ngã tư sở')) {
        roadInsight = `\n\n**Đặc thù trục Nguyễn Trãi - Ngã Tư Sở**:\n` +
                      `• Lưu lượng giao cắt lớn tại các lối lên/xuống đường Vành đai 2 trên cao.\n` +
                      `• **Gợi ý**: Chú ý quan sát biển phân làn và giữ khoảng cách an toàn.`;
      }

      const activeJams = traffics.filter(t => t.isJam);
      const displayIncidents = activeJams.length > 0 ? activeJams : traffics;

      return {
        text: `**Tình hình giao thông thực tế từ VOV & TomTom Traffic (${cityName})**:\n\n` +
              (displayIncidents.length > 0
                ? displayIncidents.slice(0, 3).map(t => `• **${this.stripEmojis(t.description)}** (Độ trễ dự kiến: ~${Math.round((t.delaySeconds || 60) / 60)} phút)`).join('\n')
                : `• Giao thông hiện tại trên các tuyến trục chính tương đối ổn định, mật độ trung bình.`) +
              roadInsight +
              `\n\nLớp bản đồ mật độ giao thông đã được hiển thị trực tiếp trên bản đồ.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    // 4. Hỏi về thời tiết, mưa, bão, ngập
    if (lower.includes('mưa') || lower.includes('thời tiết') || lower.includes('nhiệt độ') || lower.includes('ngập') || lower.includes('bão') || lower.includes('triều cường')) {
      const matchedFlood = allFloods.find(f => {
        const words = f.name.toLowerCase().split(/[(),-]/);
        return words.some(w => w.trim().length > 3 && lower.includes(w.trim()));
      });

      if (matchedFlood) {
        const isFlooded = matchedFlood.depth_cm > 0 && matchedFlood.danger_level !== 'safe';
        return {
          text: isFlooded
            ? `**Trạm đo ${matchedFlood.name}**: Hiện đang ngập **${matchedFlood.depth_cm}cm** (${matchedFlood.advice}). Trạm bơm: ${matchedFlood.pump_status}.`
            : `**Trạm đo ${matchedFlood.name}**: Hiện mặt đường **khô ráo (0cm ngập)**. ${matchedFlood.advice}`,
          action: {
            type: 'FOCUS_POINT',
            lat: matchedFlood.lat,
            lng: matchedFlood.lng,
            name: matchedFlood.name
          }
        };
      }

      const maxRain = cityStations.reduce((max, s) => Math.max(max, s.rain1h || 0), 0);
      const alertMsg = alerts.length > 0
        ? alerts[0].content
        : (maxRain > 0 ? `Ghi nhận mưa cục bộ ~${maxRain} mm/h tại một số phường.` : 'Thời tiết hiện tại tạnh ráo, tầm nhìn tốt, mặt đường khô ráo.');
      const riskText = activeFloods.some(f => f.danger_level === 'critical')
        ? `Rất cao (Đang có ${activeFloods.length} điểm ngập, ngập sâu >30cm)`
        : (activeFloods.length > 0 ? `Trung bình (${activeFloods.length} điểm ngập cục bộ)` : 'An toàn (0 điểm ngập)');

      return {
        text: `**Dự báo thời tiết & Nguy cơ ngập úng (${cityName})**:\n\n` +
              `• **Trạng thái**: ${alertMsg}\n` +
              `• **Mức độ rủi ro ngập**: ${riskText}\n` +
              `• **Khuyến nghị**: ${activeFloods.length > 0 ? 'Nếu di chuyển bằng xe máy, hãy bật chế độ Chỉ đường An toàn để tự động né các điểm ngập.' : 'Thời tiết thuận lợi cho mọi phương tiện lưu thông.'}`,
        action: { type: 'SHOW_WEATHER_LAYER' }
      };
    }

    // 5. Hỏi về trạm sạc xe điện, pin, trạm sạc Open Charge Map / VinFast
    if (lower.includes('trạm sạc') || lower.includes('sạc xe') || lower.includes('sạc pin') || lower.includes('sạc điện') || lower.includes('xe điện') || lower.includes('đổi pin') || lower.includes('open charge')) {
      const evService = require('./ev-service');
      const stations = evService.getStations(city, false);
      const fastCount = stations.filter(s => s.isFastCharge).length;

      let matchedStation = null;
      for (const st of stations) {
        const cleanName = (st.name || '').toLowerCase();
        if (lower.includes(cleanName) || (st.address && lower.includes(st.address.toLowerCase()))) {
          matchedStation = st;
          break;
        }
      }

      if (matchedStation) {
        return {
          text: `**Thông tin trạm sạc: ${matchedStation.name}**\n\n` +
                `• **Đơn vị vận hành**: ${matchedStation.operator}\n` +
                `• **Địa chỉ**: ${matchedStation.address}\n` +
                `• **Công suất tối đa**: ${matchedStation.maxPowerKw} kW (${matchedStation.isFastCharge ? 'DC Sạc nhanh' : 'AC Tiêu chuẩn'})\n` +
                `• **Trạng thái**: ${matchedStation.isOperational ? 'Đang hoạt động 24/7' : 'Đang bảo trì'}\n` +
                `• **Cổng sạc**: ${(matchedStation.connectors || []).map(c => `${c.type} (${c.powerKw}kW)`).join(', ') || 'CCS2 / Type 2'}\n\n` +
                `*Hệ thống đã tự động định vị trạm sạc trên bản đồ và mở lớp trạm sạc xe điện.*`,
          action: {
            type: 'SHOW_EV_LAYER',
            targetStation: matchedStation.name
          }
        };
      }

      const sampleList = stations.slice(0, 3).map(s => 
        `• **${s.name}** (${s.operator}) - ${s.maxPowerKw}kW - ${s.address}`
      ).join('\n');

      return {
        text: `**Hệ thống Trạm sạc Xe điện (${cityName}) - Open Charge Map & Đối tác**:\n\n` +
              `Hiện có **${stations.length} trạm sạc khả dụng** trong thành phố (gồm **${fastCount} trạm sạc nhanh DC** từ 60kW - 250kW và các trạm đổi pin Selex).\n\n` +
              `**Một số trạm sạc tiêu biểu gần bạn**:\n` +
              sampleList +
              `\n\nLớp trạm sạc xe điện với biểu tượng công suất thực tế đã được hiển thị trực tiếp trên bản đồ. Bạn có thể nhấn vào bất kỳ trạm nào để xem cổng sạc hoặc chọn **Chỉ đường né ngập**.`,
        action: { type: 'SHOW_EV_LAYER' }
      };
    }

    return {
      text: `Xin chào! Tôi là **Trợ lý Di chuyển Thông minh MoveSafe AI**.\n\n` +
            `Tôi theo dõi dữ liệu thời gian thực từ **HSDC Hà Nội**, **UDi Maps TP.HCM**, **VOV Giao Thông** và **TomTom Traffic**.\n\n` +
            `Bạn có thể đặt câu hỏi trực tiếp:\n` +
            `1. *"Từ Cầu Giấy ra Bến xe Mỹ Đình đi đường nào thông thoáng?"*\n` +
            `2. *"Đường Nguyễn Khuyến hiện tại có ngập không?"*\n` +
            `3. *"Tình hình giao thông tại các nút giao lớn lúc này?"*`,
      action: null
    };
  }

  async callGeminiAPI(query, liveData, city, apiKey, context = {}, liveEvents = null) {
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const allFloodPoints = (liveData.floodPoints || []).filter(f => f.city === city);
    const activeFloodPoints = allFloodPoints.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];
    const parsedRoute = this.parseRouteQuery(query);

    const lower = query.toLowerCase();
    const isAskingTrafficOnly = (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('sao lại') || lower.includes('tại sao') || lower.includes('kẹt xe') || lower.includes('đông thế') || lower.includes('đông')) && !lower.includes('ngập') && !lower.includes('mưa');
    const isAskingFloodOnly = (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích') || lower.includes('triều cường')) && !lower.includes('tắc') && !lower.includes('kẹt');
    const isAskingEV = (lower.includes('trạm sạc') || lower.includes('sạc xe') || lower.includes('sạc pin') || lower.includes('sạc điện') || lower.includes('xe điện') || lower.includes('đổi pin') || lower.includes('open charge')) && !lower.includes('tắc');
    const isAskingFoodOrEntertainment = FOOD_ENTERTAINMENT_DATA.isFoodOrFun(query);

    let wardContext = '';
    if (city === 'hanoi' && Array.isArray(HANOI_WARDS_DATA)) {
      const matched = HANOI_WARDS_DATA.find(w => {
        const wLower = w.name.toLowerCase();
        const rawWName = wLower.replace(/^phường\s+|^xã\s+/i, '').trim();
        return lower.includes(wLower) || (rawWName.length >= 3 && lower.includes(rawWName)) || (w.mainStreets || []).some(s => lower.includes(s.toLowerCase()));
      });
      if (matched) {
        wardContext = `Dữ liệu địa phương Hà Nội về ${matched.name} (Q. ${matched.district}):
- Các trục đường lớn: ${matched.mainStreets.join(', ')}
- Điểm giao cắt trọng điểm: ${matched.trafficHotspots.join(' • ')}
- Đặc điểm ngập úng mùa mưa: ${matched.floodVulnerability}\n\n`;
      }
    }

    // Bổ sung tri thức sự kiện đô thị lớn tại Hà Nội
    wardContext += `Tri thức bối cảnh sự kiện đô thị ${cityName}:
- Sân vận động Quốc gia Mỹ Đình: Thường tổ chức đại nhạc hội/concert âm nhạc quy mô 30.000 - 40.000 khán giả (như Concert Anh Trai Say Hi, Anh Trai Vượt Ngàn Chông Gai, đêm nhạc ca sĩ) hoặc trận bóng đá ĐTQG Việt Nam. Khung giờ 18h - 23h lưu lượng phương tiện đổ dồn về các tuyến Lê Đức Thọ, Lê Quang Đạo, Châu Văn Liêm, Mễ Trì, Hồ Tùng Mậu gây ùn tắc giao thông cục bộ.
- Trung tâm Hội nghị Quốc gia NCC: Các hội nghị, triển lãm quốc tế, đại nhạc hội lớn tại đại lộ Thăng Long & Phạm Hùng.
- Phố đi bộ Hồ Gươm: Cấm phương tiện vào tối thứ 6, thứ 7, chủ nhật.\n\n`;

    if (liveEvents && liveEvents.summaryText) {
      wardContext += `\n${liveEvents.summaryText}\n\n`;
    }

    let dynamicContext = wardContext;
    let instructions = '';

    let cachedFoodRec = null;
    if (isAskingTrafficOnly) {
      dynamicContext += `Dữ liệu giao thông thời gian thực từ TomTom & VOV tại ${cityName}:
- Sự cố / tình hình ùn tắc: ${JSON.stringify(trafficIncidents.slice(0, 6).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về TẮC ĐƯỜNG / KẸT XE / ĐÔNG NGƯỜI / SỰ KIỆN GIAO THÔNG.
2. Nếu hỏi về lý do tại sao đông người / kẹt xe (ví dụ ở SVĐ Mỹ Đình hôm qua lúc 8h tối): Hãy giải thích rõ bản chất sự kiện (đại nhạc hội / concert / bóng đá), khung giờ khán giả đổ về và các tuyến đường bị ảnh hưởng, kèm lời khuyên di chuyển thông minh. Tuyệt đối KHÔNG trả lời lạc đề sang báo cáo thời tiết hay hệ thống thoát nước.
3. Nếu người dùng hỏi lộ trình hoặc có tình huống giả định cấm đường / né đường (ví dụ: 'giả sử đường Trịnh Văn Bô cấm đường...', 'cuối tuần đi từ An Trai đến Cafe Cộng đối diện SVĐ Mỹ Đình'):
   - Nhận định tình huống giả định nếu có và đề xuất phương án đi vòng thay thế.
   - Suy luận chính xác Điểm xuất phát (Origin) và Điểm đến (Destination) cụ thể. Điểm đến không bao giờ là từ chung chung như 'đường' hay 'đường nào'.
   - Ở dòng cuối cùng ghi cú pháp: [ACTION_ROUTE: Điểm Xuất Phát -> Điểm Đến | AVOID: Tên đường cần tránh nếu có].
4. Trả lời súc tích, thực tế, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;
    } else if (isAskingFloodOnly) {
      const floodsForPrompt = activeFloodPoints.length > 0 ? activeFloodPoints : allFloodPoints.slice(0, 5);
      dynamicContext += `Dữ liệu đo đạc ngập úng từ trạm HSDC/UDi Maps tại ${cityName} (Số điểm đang ngập thực tế >0cm: ${activeFloodPoints.length}):
- Các điểm đo: ${JSON.stringify(floodsForPrompt.slice(0, 8).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice, passable_motorbike: f.passable_motorbike })))}
- Cảnh báo thời tiết KTTV: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về NGẬP NƯỚC / THỦY KÍCH / MƯA LŨ. Nếu số điểm ngập >0cm là 0, khẳng định hiện tại đường phố khô ráo (0cm ngập). Nếu có điểm ngập >0cm, nêu rõ độ sâu ngập (cm) và hướng đi thay thế.
2. Trả lời súc tích, thực tế, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;
    } else if (isAskingEV) {
      const evService = require('./ev-service');
      const stations = evService.getStations(city, false);
      dynamicContext += `Dữ liệu trạm sạc xe điện Open Charge Map & Đối tác tại ${cityName}:
- Tổng số trạm sạc: ${stations.length}
- Danh sách trạm tiêu biểu: ${JSON.stringify(stations.slice(0, 6).map(s => ({ name: s.name, operator: s.operator, maxPowerKw: s.maxPowerKw, isFastCharge: s.isFastCharge, address: s.address })))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về TRẠM SẠC XE ĐIỆN / ĐỔI PIN PIN LITHIUM.
2. Tư vấn các trạm sạc phù hợp nhất, công suất (kW), sạc nhanh hay sạc chậm, lưu ý đường đi an toàn né ngập.
3. Trả lời súc tích, thực tế, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;
    } else if (isAskingFoodOrEntertainment) {
      const rec = typeof FOOD_ENTERTAINMENT_DATA.getRecommendationAsync === 'function'
        ? await FOOD_ENTERTAINMENT_DATA.getRecommendationAsync(query, city, context)
        : FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city, context);
      cachedFoodRec = rec;
      const catName = rec.categoryType === 'cinema' ? 'rạp chiếu phim' : (rec.categoryType === 'cafe' ? 'quán cà phê' : (rec.categoryType === 'entertainment' ? 'điểm vui chơi giải trí' : 'quán ăn/món ngon'));
      dynamicContext += `Cơ sở dữ liệu địa phương chọn lọc tại ${cityName} (${rec.title}):
${rec.text}`;

      instructions = `YÊU CẦU TRẢ LỜI ĐẶC BIỆT:
1. Người dùng đang hỏi về ${catName.toUpperCase()} tại khu vực này.
2. Bạn là Chuyên gia Bản địa sành sỏi, am hiểu sâu sắc về ẩm thực và điểm vui chơi giải trí tại ${cityName}.
3. Hãy dựa trên danh sách các địa điểm thực tế đã được định vị ở trên (${rec.title}):
   - Giới thiệu cụ thể các ${catName} sát khu vực người dùng hỏi theo đúng danh sách trên.
   - Nêu rõ đặc sản / điểm nổi bật, khoảng cách thực tế (ví dụ cách ~120m, ~210m) và mức giá tham khảo.
4. Kèm theo mẹo giao thông & đỗ xe thực tế: chỗ để xe máy/ô tô có thuận tiện không, khung giờ nên ghé để tránh tắc đường hoặc chờ bàn.
5. Trả lời đúng trọng tâm câu hỏi, văn phong thông minh, thực tế, KHÔNG dùng biểu tượng cảm xúc (emoji/icon) màu mè. Tuyệt đối KHÔNG trả lời lạc đề sang báo cáo thời tiết hay hệ thống thoát nước.`;
    } else {
      dynamicContext += `Dữ liệu đo đạc thời gian thực tại đô thị ${cityName}:
- Số điểm đang ngập (>0cm): ${activeFloodPoints.length}
- Điểm ngập úng trạm đo: ${JSON.stringify((activeFloodPoints.length > 0 ? activeFloodPoints : allFloodPoints).slice(0, 6).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice })))}
- Tình hình giao thông TomTom/VOV: ${JSON.stringify(trafficIncidents.slice(0, 5).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}
- Cảnh báo thời tiết: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi của người dùng, suy luận ngữ cảnh thời gian và sự kiện, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).
2. Nếu hỏi đường đi / lộ trình (hoặc có tình huống giả định cấm đường / né đường):
   - Nhận định tình huống giả định nếu có và đề xuất phương án đi vòng thay thế.
   - Trích xuất chính xác Điểm A và Điểm B (không bao giờ trích xuất điểm đến là từ 'đường' hay câu hỏi).
   - Ở dòng cuối cùng của câu trả lời hãy ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B | AVOID: Tên đường cần tránh nếu có].`;
    }

    const contextPrompt = `Bạn là Trợ lý AI Giao Thông MoveSafe VN thông minh.
Đô thị: ${cityName}.
${dynamicContext}

Câu hỏi của người tham gia giao thông: "${query}"

${instructions}`;

    // Danh sách model Google Gemini khả dụng mới nhất (không dùng các model 1.5/2.0 đã ngưng hoạt động)
    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-3.8-flash'
    ];

    let lastError = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: contextPrompt }] }]
        };
        // Kích hoạt Google Search Grounding cho các câu hỏi sự kiện & giao thông thực tế
        if (isAskingTrafficOnly || lower.includes('sự kiện') || lower.includes('hôm qua') || lower.includes('concert') || lower.includes('đông')) {
          payload.tools = [{ googleSearch: {} }];
        }

        let response;
        try {
          response = await axios.post(url, payload, { timeout: 4500 });
        } catch (apiErr) {
          if (payload.tools && apiErr.response?.status === 400) {
            delete payload.tools;
            response = await axios.post(url, payload, { timeout: 4500 });
          } else {
            throw apiErr;
          }
        }

        let reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          let action = isAskingFoodOrEntertainment
            ? (cachedFoodRec ? cachedFoodRec.action : FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city, context).action)
            : (isAskingTrafficOnly
              ? { type: 'SHOW_TRAFFIC_LAYER' }
              : (isAskingEV ? { type: 'SHOW_EV_LAYER' } : (lower.includes('thời tiết') || lower.includes('mưa') ? { type: 'SHOW_WEATHER_LAYER' } : { type: 'SHOW_FLOOD_LAYER' })));

          const routeMatch = reply.match(/\[ACTION_ROUTE:\s*(.*?)\s*->\s*(.*?)(?:\s*\|\s*AVOID:\s*(.*?))?\]/i);
          let autoOrigin = null;
          let autoDest = null;
          let autoAvoid = null;

          if (routeMatch) {
            autoOrigin = routeMatch[1].trim();
            autoDest = routeMatch[2].trim();
            if (routeMatch[3]) autoAvoid = routeMatch[3].trim();
          } else if (parsedRoute) {
            autoOrigin = parsedRoute.origin;
            autoDest = parsedRoute.destination;
            autoAvoid = parsedRoute.avoidRoad;
          }

          if (autoOrigin && autoDest) {
            action = {
              type: 'AUTO_ROUTE',
              origin: autoOrigin,
              destination: autoDest,
              avoidLevel: 1,
              timeOffsetHours: parsedRoute ? parsedRoute.timeOffsetHours : 0,
              avoidRoads: autoAvoid ? [autoAvoid] : (parsedRoute?.avoidRoad ? [parsedRoute.avoidRoad] : [])
            };
          }

          reply = reply.replace(/\[ACTION_ROUTE:\s*.*?\s*\]/i, '').trim();

          return {
            text: this.stripEmojis(reply),
            action,
            modelUsed: model
          };
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AI] Model ${model} gặp lỗi (${err.response?.status || err.message}), thử model tiếp theo...`);
      }
    }

    throw lastError || new Error('Không thể kết nối với Gemini API');
  }
}

module.exports = new AIAssistantService();

