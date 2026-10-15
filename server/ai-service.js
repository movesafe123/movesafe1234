const axios = require('axios');
const botService = require('./bot-service');
const HANOI_WARDS_DATA = require('../js/hanoi-wards-streets');

class AIAssistantService {
  async processQuery({ query, city = 'hanoi', userApiKey = '' }) {
    const liveData = botService.getData();
    const allCityFloods = (liveData.floodPoints || []).filter(f => f.city === city);
    const activeFloodPoints = allCityFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];
    const cityStations = (liveData.weatherStations || {})[city] || [];

    // Kiểm tra Google Gemini API Key (từ người dùng hoặc cấu hình mặc định hệ thống)
    const systemGeminiKey = require('./config').API_KEYS.GEMINI || '';
    const activeKey = (userApiKey && userApiKey.trim().length > 10) ? userApiKey.trim() : systemGeminiKey;

    if (activeKey && activeKey.length > 10) {
      try {
        return await this.callGeminiAPI(query, liveData, city, activeKey);
      } catch (err) {
        console.warn('[AI] Gọi Gemini API thất bại, chuyển sang Bộ não AI tích hợp:', err.message);
      }
    }

    // Bộ não AI suy luận ngữ cảnh thời gian thực tích hợp sẵn (Local Context Engine)
    return this.generateSmartLocalResponse(query, city, activeFloodPoints, allCityFloods, trafficIncidents, weatherAlerts, cityStations);
  }

  // Phân tích câu hỏi bằng Bộ não AI thông minh chạy trực tiếp
  generateSmartLocalResponse(query, city, activeFloods, allFloods, traffics, alerts, cityStations = []) {
    const lower = query.toLowerCase();
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');

    // 0. Nhận diện nếu câu hỏi liên quan đến Phường hoặc Tuyến đường lớn ở Hà Nội
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

    // Nếu người dùng hỏi cụ thể về phường hoặc tuyến đường thuộc phường (và không phải câu lệnh tìm đường từ A đến B)
    const isRouteCommand = /(?:tìm đường|chỉ đường|lộ trình|đi)\s*từ\s+.+?\s+(?:đến|về|sang|qua|tới)\s+/i.test(query);
    if (!isRouteCommand && matchedWard && (lower.includes('phường') || lower.includes('đường') || lower.includes('phố') || lower.includes('thời tiết') || lower.includes('ngập') || lower.includes('tắc'))) {
      const streetsList = (matchedWard.mainStreets || []).join(', ');
      const hotspotsList = (matchedWard.trafficHotspots || []).join('; ');
      const liveStation = cityStations.find(s => s.id === matchedWard.id || s.name === matchedWard.name);
      const weatherLine = liveStation
        ? `${liveStation.icon || '☀️'} Thời tiết khu vực hiện tại: **${liveStation.temp}°C**, ${liveStation.description} (Lượng mưa 1h: **${liveStation.rain1h || 0}mm**).`
        : `🌦️ Thời tiết khu vực hiện tại tạnh ráo, tầm nhìn tốt.`;

      return {
        text: `🏛️ **Thông tin Giao thông & Mạng lưới Đường lớn tại ${matchedWard.name}**:\n\n` +
              `• 🛣️ **Các trục đường huyết mạch qua phường**: ${streetsList}.\n` +
              `• 🚦 **Điểm giao cắt & Nút nghẽn**: ${hotspotsList}.\n` +
              `• 🌊 **Đặc điểm ngập úng**: ${matchedWard.floodVulnerability}.\n` +
              `• 💡 **Đánh giá lưu thông**: ${matchedWard.description}\n\n` +
              `${weatherLine} Bạn có thể nhấn trực tiếp vào ghim của phường này trên bản đồ để xem chi tiết!`,
        action: {
          type: 'FOCUS_POINT',
          lat: matchedWard.lat,
          lng: matchedWard.lng,
          name: matchedWard.name
        }
      };
    }

    // 1. Hỏi về lộ trình / tìm đường tránh ngập (Ví dụ: từ A đến B)
    if (lower.includes('tìm đường') || lower.includes('lộ trình') || lower.includes('chỉ đường') || isRouteCommand) {
      const routeRegex = /(?:từ|đi từ|chỉ đường từ|lộ trình từ)\s+(.+?)\s+(?:đến|về|sang|qua|tới)\s+(.+?)(?:\.|\?|,|né ngập|tránh tắc|không ngập|$)/i;
      const rMatch = query.match(routeRegex);
      if (rMatch && rMatch[1] && rMatch[2]) {
        const originClean = rMatch[1].replace(/^(tôi|bạn|hãy|giúp|với)\s+/i, '').trim();
        const destClean = rMatch[2].replace(/(\?|!|\.|né ngập|tránh tắc|tránh ngập|an toàn)$/i, '').trim();

        if (originClean.length >= 2 && destClean.length >= 2) {
          return {
            text: `🎯 **Đã kích hoạt tự động vẽ lộ trình thông minh trên bản đồ!**\n\n` +
                  `📍 **Lộ trình**: Điểm đi: **${originClean}** ➔ Điểm đến: **${destClean}**\n` +
                  `🛡️ **Điều phối tự động né ngập & ùn tắc**: MoveSafe tự động kích hoạt chế độ **An toàn tuyệt đối (Né 100% rốn ngập)**. Nếu phát hiện rốn ngập sâu trên trục chính, hệ thống sẽ bẻ hướng sang hành lang đường vòng cao ráo.\n\n` +
                  `*Bản đồ tác chiến và bảng chỉ đường đã được mở tự động cho bạn!*`,
            action: {
              type: 'AUTO_ROUTE',
              origin: originClean,
              destination: destClean,
              avoidLevel: 1
            }
          };
        }
      }

      const matchedFlood = allFloods.find(f => {
        const words = f.name.toLowerCase().split(/[(),-]/);
        return words.some(w => w.trim().length > 3 && lower.includes(w.trim()));
      });

      if (matchedFlood) {
        if (matchedFlood.depth_cm > 0 && matchedFlood.danger_level !== 'safe') {
          return {
            text: `⚠️ **Cảnh báo rủi ro cao tại ${matchedFlood.name}**!\n\n` +
                  `Hiện trạm đo ghi nhận mực nước ngập sâu **${matchedFlood.depth_cm}cm** (${matchedFlood.advice}).\n\n` +
                  `💡 **Khuyến nghị di chuyển**: Xe máy và ô tô gầm thấp tuyệt đối không đi qua đoạn này vì nguy cơ thủy kích rất cao. Hệ thống MoveSafe đã tự động vạch lộ trình vòng qua các tuyến phố cao ráo lân cận!`,
            action: {
              type: 'FOCUS_POINT',
              lat: matchedFlood.lat,
              lng: matchedFlood.lng,
              name: matchedFlood.name
            }
          };
        }
        return {
          text: `✅ **Thông tin trạm đo tại ${matchedFlood.name}**:\n\n` +
                `Hiện tại mặt đường **khô ráo (0cm ngập)**, nước đã rút hoàn toàn (${matchedFlood.advice}). Các phương tiện xe máy và ô tô có thể lưu thông qua đây bình thường!`,
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
        ? `📍 **Các rốn ngập cần tránh tuyệt đối**:\n` +
          activeFloods.slice(0, 3).map(f => `• **${f.name}**: Ngập sâu ${f.depth_cm}cm (${f.passable_motorbike ? 'Xe máy đi chậm' : 'Xe máy KHÔNG THỂ QUA'})`).join('\n')
        : `✅ **Tình trạng ngập úng**: Toàn bộ các trục đường tại ${cityName} hiện đang khô ráo (0 điểm ngập).`;

      return {
        text: `🚗 **Phân tích lộ trình thông minh tại ${cityName}**:\n\n` +
              `Hiện tại hệ thống Bot ghi nhận đang có **${activeFloods.length} điểm ngập cục bộ** và **${activeJams.length} điểm ùn ứ**.\n\n` +
              `${floodSummary}\n\n` +
              `👉 **Gợi ý**: Bạn có thể nói hoặc gõ ví dụ *"Tìm đường từ Cầu Giấy đến Hoàn Kiếm"* để MoveSafe tự động vẽ đường né ngập tức thì!`,
        action: { type: 'SHOW_FLOOD_LAYER' }
      };
    }

    // 2. Hỏi về tình trạng tắc đường, kẹt xe, giao thông
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('giao thông')) {
      let roadInsight = '';
      if (lower.includes('xuân phương')) {
        roadInsight = `\n\n📌 **Đặc thù tuyến đường Xuân Phương (Nam Từ Liêm)**:\n` +
                      `• **Lòng đường hẹp**: Mặt cắt đường đoạn cầu vượt và nối ra QL32 khá hẹp, dễ tạo nút thắt cổ chai.\n` +
                      `• **Lưu lượng dồn ứ cực lớn**: Lượng xe lớn từ các khu đô thị (Vân Canh, Hateco Apollo, Foresa...) đổ ra trục Trịnh Văn Bô và đường 32.\n` +
                      `• **Xung đột giao thông**: Nhiều xe tải, xe buýt giao cắt với dòng xe máy vào giờ cao điểm.\n` +
                      `💡 **Gợi ý**: Bạn có thể chuyển hướng đi qua trục đường Trịnh Văn Bô hoặc đường Trần Hữu Dực kéo dài để thoáng hơn!`;
      } else if (lower.includes('nguyễn trãi') || lower.includes('ngã tư sở')) {
        roadInsight = `\n\n📌 **Đặc thù trục Nguyễn Trãi - Ngã Tư Sở**:\n` +
                      `• Xung đột giao thông tại các điểm mở quay đầu và lối lên/xuống đường vành đai 2 trên cao.\n` +
                      `💡 **Gợi ý**: Chú ý quan sát biển phân làn và giữ khoảng cách an toàn.`;
      }

      const activeJams = traffics.filter(t => t.isJam);
      const displayIncidents = activeJams.length > 0 ? activeJams : traffics;

      return {
        text: `🚦 **Tình hình giao thông thực tế từ VOV & TomTom Traffic (${cityName})**:\n\n` +
              (displayIncidents.length > 0
                ? displayIncidents.slice(0, 3).map(t => `• 🚗 **${t.description}** (Độ trễ dự kiến: ~${Math.round((t.delaySeconds || 60) / 60)} phút)`).join('\n')
                : `• Giao thông hiện tại trên các tuyến trục chính tương đối ổn định, mật độ trung bình.`) +
              roadInsight +
              `\n\nBản đồ nhiệt giao thông (đường xanh/vàng/đỏ) đã được kích hoạt trực tiếp trên giao diện Live Map.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    // 3. Hỏi về thời tiết, mưa, bão, ngập
    if (lower.includes('mưa') || lower.includes('thời tiết') || lower.includes('nhiệt độ') || lower.includes('ngập') || lower.includes('bão') || lower.includes('triều cường')) {
      const matchedFlood = allFloods.find(f => {
        const words = f.name.toLowerCase().split(/[(),-]/);
        return words.some(w => w.trim().length > 3 && lower.includes(w.trim()));
      });

      if (matchedFlood) {
        const isFlooded = matchedFlood.depth_cm > 0 && matchedFlood.danger_level !== 'safe';
        return {
          text: isFlooded
            ? `🌊 **Trạm đo ${matchedFlood.name}**: Hiện đang ngập sâu **${matchedFlood.depth_cm}cm** (${matchedFlood.advice}). Trạm bơm: ${matchedFlood.pump_status}.`
            : `✅ **Trạm đo ${matchedFlood.name}**: Hiện mặt đường **khô ráo (0cm ngập)**. ${matchedFlood.advice}`,
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
        ? `🔴 RẤT CAO (Đang có ${activeFloods.length} điểm ngập, ngập sâu >30cm)`
        : (activeFloods.length > 0 ? `🟡 TRUNG BÌNH (${activeFloods.length} điểm ngập cục bộ)` : '🟢 AN TOÀN (0 điểm ngập)');

      return {
        text: `🌧️ **Dự báo thời tiết & Nguy cơ ngập úng (${cityName})**:\n\n` +
              `• **Trạng thái**: ${alertMsg}\n` +
              `• **Mức độ rủi ro ngập**: ${riskText}\n` +
              `• **Lời khuyên**: ${activeFloods.length > 0 ? 'Nếu di chuyển bằng xe máy, hãy chuẩn bị áo mưa bộ và bật chế độ Chỉ đường An toàn để né các rốn ngập.' : 'Thời tiết thuận lợi cho mọi phương tiện lưu thông.'}`,
        action: { type: 'SHOW_WEATHER_LAYER' }
      };
    }

    // Câu trả lời tổng quan mặc định
    return {
      text: `Xin chào! Tôi là **Trợ lý Di chuyển Thông minh MoveSafe AI** 🤖.\n\n` +
            `Tôi theo dõi dữ liệu thời gian thực từ **HSDC Hà Nội**, **UDi Maps TP.HCM**, **VOV Giao Thông** và **TomTom Traffic**.\n\n` +
            `Bạn có thể hỏi tôi:\n` +
            `1. *"Đi từ Cầu Giấy sang Hà Đông đường nào không ngập?"*\n` +
            `2. *"Đường Nguyễn Khuyến hiện tại ngập sâu bao nhiêu cm?"*\n` +
            `3. *"Tình hình tắc đường tại các nút giao lớn lúc này?"*\n` +
            `4. Hoặc nhấn biểu tượng micro để tìm đường bằng giọng nói!`,
      action: null
    };
  }

  // Gọi Google Gemini API với cơ chế tự động chuyển đổi Model chính thức
  async callGeminiAPI(query, liveData, city, apiKey) {
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const allFloodPoints = (liveData.floodPoints || []).filter(f => f.city === city);
    const activeFloodPoints = allFloodPoints.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];

    const lower = query.toLowerCase();
    const isAskingTrafficOnly = (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('sao lại') || lower.includes('tại sao') || lower.includes('kẹt xe')) && !lower.includes('ngập') && !lower.includes('mưa');
    const isAskingFloodOnly = (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích') || lower.includes('triều cường')) && !lower.includes('tắc') && !lower.includes('kẹt');

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
1. Người dùng chỉ hỏi về TẮC ĐƯỜNG / KẸT XE, hoàn toàn KHÔNG hỏi về ngập úng hay thời tiết.
2. TUYỆT ĐỐI KHÔNG tự động liệt kê danh sách các điểm ngập nước (mức ngập 0cm) hay cảnh báo mang áo mưa vì không liên quan.
3. Nếu người dùng hỏi về một tuyến đường hoặc khu vực cụ thể: Hãy kết hợp kiến thức thực tế về tuyến đường đó tại ${cityName} để giải thích nguyên nhân rõ ràng và gợi ý hướng đi thay thế nếu có.
4. Trả lời thẳng thắn, ngắn gọn, súc tích (2-3 đoạn ngắn), dùng emoji phù hợp.`;
    } else if (isAskingFloodOnly) {
      const floodsForPrompt = activeFloodPoints.length > 0 ? activeFloodPoints : allFloodPoints.slice(0, 5);
      dynamicContext += `Dữ liệu đo đạc ngập úng từ trạm HSDC/UDi Maps tại ${cityName} (Số điểm đang ngập thực tế >0cm: ${activeFloodPoints.length}):
- Các điểm đo: ${JSON.stringify(floodsForPrompt.slice(0, 8).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice, passable_motorbike: f.passable_motorbike })))}
- Cảnh báo thời tiết KTTV: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về NGẬP NƯỚC / THỦY KÍCH / MƯA LŨ. Nếu số điểm ngập >0cm là 0, hãy khẳng định hiện tại đường phố khô ráo (0cm ngập), an toàn di chuyển. Nếu có điểm ngập >0cm, nêu rõ độ sâu ngập (cm), các rốn ngập cần tránh, khả năng đi qua của xe máy và ô tô.
2. Trả lời súc tích, thực tế và mang tính hành động cao.`;
    } else {
      dynamicContext += `Dữ liệu đo đạc thời gian thực tại đô thị ${cityName}:
- Số điểm đang ngập (>0cm): ${activeFloodPoints.length}
- Điểm ngập úng trạm đo: ${JSON.stringify((activeFloodPoints.length > 0 ? activeFloodPoints : allFloodPoints).slice(0, 6).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice })))}
- Tình hình giao thông TomTom/VOV: ${JSON.stringify(trafficIncidents.slice(0, 5).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}
- Cảnh báo thời tiết: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi của người dùng. Không liệt kê lan man những thông tin không liên quan.
2. Nếu hỏi đường, gợi ý lộ trình kết hợp cả né ngập và né kẹt xe. Súc tích, định dạng Markdown rõ ràng.
3. ĐẶC BIỆT: Nếu người dùng hỏi đường đi / lộ trình từ [Điểm A] đến [Điểm B], ở dòng cuối cùng của câu trả lời hãy ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B] để ứng dụng tự động vẽ tuyến đường né ngập.`;
    }

    const contextPrompt = `Bạn là Trợ lý AI Giao Thông MoveSafe VN thông minh.
Đô thị: ${cityName}.
${dynamicContext}

Câu hỏi của người tham gia giao thông: "${query}"

${instructions}`;

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-flash-lite-latest'
    ];

    let lastError = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: contextPrompt }] }]
        }, { timeout: 10000 });

        let reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          let action = isAskingTrafficOnly
            ? { type: 'SHOW_TRAFFIC_LAYER' }
            : (lower.includes('thời tiết') || lower.includes('mưa') ? { type: 'SHOW_WEATHER_LAYER' } : { type: 'SHOW_FLOOD_LAYER' });

          const routeMatch = reply.match(/\[ACTION_ROUTE:\s*(.*?)\s*->\s*(.*?)\]/i);
          if (routeMatch) {
            action = {
              type: 'AUTO_ROUTE',
              origin: routeMatch[1].trim(),
              destination: routeMatch[2].trim(),
              avoidLevel: 1
            };
            reply = reply.replace(/\[ACTION_ROUTE:\s*.*?\s*->\s*.*?\]/i, '').trim();
          } else {
            const qMatch = query.match(/(?:từ|đi từ|chỉ đường từ|lộ trình từ)\s+(.+?)\s+(?:đến|về|sang|qua|tới)\s+(.+?)(?:\.|\?|,|né ngập|tránh tắc|$)/i);
            if (qMatch && qMatch[1] && qMatch[2]) {
              action = {
                type: 'AUTO_ROUTE',
                origin: qMatch[1].replace(/^(tôi|bạn|hãy)\s+/i, '').trim(),
                destination: qMatch[2].replace(/(\?|!|\.|né ngập)$/i, '').trim(),
                avoidLevel: 1
              };
            }
          }

          return {
            text: reply.trim(),
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
