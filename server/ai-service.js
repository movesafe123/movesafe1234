const axios = require('axios');
const botService = require('./bot-service');
const HANOI_WARDS_DATA = require('../js/hanoi-wards-streets');
const FOOD_ENTERTAINMENT_DATA = require('../js/food-entertainment-data');

class AIAssistantService {
  stripEmojis(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^ +/gm, '')
      .trim();
  }

  parseRouteQuery(query) {
    if (!query) return null;

    let timeOffsetHours = 0;
    const timeMatch = query.match(/(?:trong|sau|khoảng)?\s*(\d+)\s*(?:h|giờ|tiếng)\s*(?:tới|nữa|sau)?/i);
    if (timeMatch && timeMatch[1]) {
      timeOffsetHours = Math.min(3, Math.max(0, parseInt(timeMatch[1], 10)));
    }

    let cleaned = query
      .replace(/(?:trong|sau|khoảng)\s*\d+\s*(?:h|giờ|tiếng|phút|p)\s*(?:tới|nữa|sau)?.*$/i, '')
      .replace(/\s+\d+\s*(?:h|giờ|tiếng)\s*(?:tới|nữa).*$/i, '')
      .replace(/\s+(?:hiện tại|bây giờ|lúc này|hôm nay|chiều nay|tối nay|sáng nay)?\s*(?:có bị|có đang|có|bị|đang)?\s*(?:tắc đường|kẹt xe|ùn tắc|tắc|kẹt|ngập nước|ngập úng|ngập|mưa|thông thoáng|đi được).*$/i, '')
      .replace(/\s+(?:đi đường nào|đường nào|như thế nào|thế nào|ra sao|không|chưa|nhỉ|vậy|ạ|nhé|\?|\.|!)+$/i, '')
      .trim();

    const routeRegex = /(?:tìm đường\s+|chỉ đường\s+|lộ trình\s+|đi\s+)?từ\s+(.+?)\s+(?:đến|về|sang|qua|tới|ra|vào|lên|xuống)\s+(.+)$/i;
    const match = cleaned.match(routeRegex);
    if (!match || !match[1] || !match[2]) return null;

    const orig = match[1]
      .replace(/^(?:tôi|mình|bạn|hãy|giúp|muốn|cần|đi)\s+/i, '')
      .replace(/[,.?!]+$/g, '')
      .trim();

    const dest = match[2]
      .replace(/\s+(?:né ngập|tránh tắc|không ngập|an toàn|nhanh nhất|thì|được|có|đi|giúp|với|ạ|nhé|nào).*$/i, '')
      .replace(/[,.?!]+$/g, '')
      .trim();

    if (orig.length < 2 || dest.length < 2) return null;

    return {
      origin: orig,
      destination: dest,
      timeOffsetHours
    };
  }

  async processQuery({ query, city = 'hanoi', userApiKey = '' }) {
    const liveData = botService.getData();
    const allCityFloods = (liveData.floodPoints || []).filter(f => f.city === city);
    const activeFloodPoints = allCityFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];
    const cityStations = (liveData.weatherStations || {})[city] || [];

    const systemGeminiKey = require('./config').API_KEYS.GEMINI || '';
    const activeKey = (userApiKey && userApiKey.trim().length > 10) ? userApiKey.trim() : systemGeminiKey;

    const isCooldown = this._geminiCooldownUntil && Date.now() < this._geminiCooldownUntil;
    if (activeKey && activeKey.length > 10 && !isCooldown) {
      try {
        return await this.callGeminiAPI(query, liveData, city, activeKey);
      } catch (err) {
        const status = err.response?.status;
        if (status === 429 || status === 403 || status === 503 || (err.message && err.message.includes('timeout'))) {
          this._geminiCooldownUntil = Date.now() + 60000; // Cooldown 60s khi quota/timeout để phản hồi tức thì (<5ms)
        }
        console.warn('[AI] Gọi Gemini API thất bại, chuyển sang Bộ não AI tích hợp:', err.message);
      }
    }

    return this.generateSmartLocalResponse(query, city, activeFloodPoints, allCityFloods, trafficIncidents, weatherAlerts, cityStations);
  }

  generateSmartLocalResponse(query, city, activeFloods, allFloods, traffics, alerts, cityStations = []) {
    const lower = query.toLowerCase();
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const parsedRoute = this.parseRouteQuery(query);

    // 0. Nếu là câu hỏi lộ trình từ A đến B
    if (parsedRoute) {
      const { origin, destination, timeOffsetHours } = parsedRoute;
      const activeJams = traffics.filter(t => t.isJam);
      const timeNote = timeOffsetHours > 0
        ? `\n• **Dự báo trong +${timeOffsetHours} giờ tới**: Hệ thống đã kích hoạt mô hình dự báo lưu lượng +${timeOffsetHours}h trên lộ trình.`
        : '';
      const trafficNote = activeJams.length > 0
        ? `Hiện ghi nhận **${activeJams.length} điểm ùn ứ**, hệ thống đã tự động chọn lộ trình vòng thông thoáng.`
        : `Các trục đường chính hiện tại lưu thông ổn định, thông thoáng.`;

      return {
        text: `**Đã tự động phân tích và vẽ lộ trình trên bản đồ**\n\n` +
              `• **Điểm xuất phát**: ${origin}\n` +
              `• **Điểm đến**: ${destination}\n` +
              `• **Tình trạng giao thông**: ${trafficNote}${timeNote}\n` +
              `• **Chế độ điều phối**: Ưu tiên lộ trình an toàn, né hoàn toàn các điểm ngập úng và nút giao ùn tắc.\n\n` +
              `*Bảng chi tiết lộ trình và bản đồ dẫn đường đã được mở tự động ở phía bên trái.*`,
        action: {
          type: 'AUTO_ROUTE',
          origin,
          destination,
          avoidLevel: 1,
          timeOffsetHours
        }
      };
    }

    // 0b. Nếu người dùng hỏi về ăn uống, quán ngon, cafe hoặc điểm vui chơi giải trí
    if (FOOD_ENTERTAINMENT_DATA.isFoodOrFun(query)) {
      const rec = FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city);
      return {
        text: rec.text,
        action: rec.action
      };
    }

    // 1. Nhận diện nếu câu hỏi liên quan đến Phường hoặc Tuyến đường lớn ở Hà Nội
    let matchedWard = null;
    if (city === 'hanoi' && Array.isArray(HANOI_WARDS_DATA)) {
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

  async callGeminiAPI(query, liveData, city, apiKey) {
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const allFloodPoints = (liveData.floodPoints || []).filter(f => f.city === city);
    const activeFloodPoints = allFloodPoints.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];
    const parsedRoute = this.parseRouteQuery(query);

    const lower = query.toLowerCase();
    const isAskingTrafficOnly = (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('sao lại') || lower.includes('tại sao') || lower.includes('kẹt xe')) && !lower.includes('ngập') && !lower.includes('mưa');
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

    let dynamicContext = wardContext;
    let instructions = '';

    if (isAskingTrafficOnly) {
      dynamicContext += `Dữ liệu giao thông thời gian thực từ TomTom & VOV tại ${cityName}:
- Sự cố / tình hình ùn tắc: ${JSON.stringify(trafficIncidents.slice(0, 6).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về TẮC ĐƯỜNG / KẸT XE.
2. Nếu người dùng hỏi lộ trình từ A đến B kèm câu hỏi tắc đường, hãy phân tích tình hình lưu thông trên tuyến đó và ở dòng cuối cùng ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B] (chỉ ghi tên địa điểm A và B ngắn gọn).
3. Trả lời lịch sự, rõ ràng, súc tích (2-3 đoạn ngắn), KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;
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
      const rec = FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city);
      dynamicContext += `Cơ sở dữ liệu địa phương chọn lọc tại ${cityName}:
${rec.text}`;

      instructions = `YÊU CẦU TRẢ LỜI ĐẶC BIỆT:
1. Người dùng đang hỏi về ĐỊA ĐIỂM ĂN UỐNG, MÓN NGON, QUÁN CAFE HOẶC ĐIỂM VUI CHƠI GIẢI TRÍ tại khu vực này.
2. Bạn là Chuyên gia Bản địa sành sỏi, am hiểu sâu sắc về ẩm thực và điểm vui chơi giải trí tại ${cityName}.
3. Đề xuất cụ thể từ 3 đến 5 địa điểm ẩm thực hoặc vui chơi THỰC TẾ, NỔI TIẾNG, ĐƯỢC ĐÁNH GIÁ CAO NHẤT quanh khu vực người dùng hỏi:
   - Tên quán/địa điểm & Địa chỉ cụ thể hoặc tên phố
   - Món đặc sản / điểm hấp dẫn nhất
   - Không gian / mức giá tham khảo
4. Kèm theo mẹo giao thông & đỗ xe thực tế: chỗ để xe máy/ô tô có thuận tiện không, khung giờ nên ghé để tránh tắc đường hoặc chờ bàn.
5. Trả lời đúng trọng tâm câu hỏi, văn phong thông minh, thực tế, KHÔNG dùng biểu tượng cảm xúc (emoji/icon) màu mè. Tuyệt đối KHÔNG trả lời lạc đề sang báo cáo thời tiết hay hệ thống thoát nước.`;
    } else {
      dynamicContext += `Dữ liệu đo đạc thời gian thực tại đô thị ${cityName}:
- Số điểm đang ngập (>0cm): ${activeFloodPoints.length}
- Điểm ngập úng trạm đo: ${JSON.stringify((activeFloodPoints.length > 0 ? activeFloodPoints : allFloodPoints).slice(0, 6).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice })))}
- Tình hình giao thông TomTom/VOV: ${JSON.stringify(trafficIncidents.slice(0, 5).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}
- Cảnh báo thời tiết: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi của người dùng, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).
2. Nếu hỏi đường đi / lộ trình từ [Điểm A] đến [Điểm B], ở dòng cuối cùng của câu trả lời hãy ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B].`;
    }

    const contextPrompt = `Bạn là Trợ lý AI Giao Thông MoveSafe VN thông minh.
Đô thị: ${cityName}.
${dynamicContext}

Câu hỏi của người tham gia giao thông: "${query}"

${instructions}`;

    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let lastError = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: contextPrompt }] }]
        }, { timeout: 3500 });

        let reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          let action = isAskingFoodOrEntertainment
            ? FOOD_ENTERTAINMENT_DATA.getRecommendation(query, city).action
            : (isAskingTrafficOnly
              ? { type: 'SHOW_TRAFFIC_LAYER' }
              : (isAskingEV ? { type: 'SHOW_EV_LAYER' } : (lower.includes('thời tiết') || lower.includes('mưa') ? { type: 'SHOW_WEATHER_LAYER' } : { type: 'SHOW_FLOOD_LAYER' })));

          const routeMatch = reply.match(/\[ACTION_ROUTE:\s*(.*?)\s*->\s*(.*?)\]/i);
          if (parsedRoute) {
            action = {
              type: 'AUTO_ROUTE',
              origin: parsedRoute.origin,
              destination: parsedRoute.destination,
              avoidLevel: 1,
              timeOffsetHours: parsedRoute.timeOffsetHours
            };
          } else if (routeMatch) {
            action = {
              type: 'AUTO_ROUTE',
              origin: routeMatch[1].trim(),
              destination: routeMatch[2].trim(),
              avoidLevel: 1
            };
          }
          reply = reply.replace(/\[ACTION_ROUTE:\s*.*?\s*->\s*.*?\]/i, '').trim();

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

