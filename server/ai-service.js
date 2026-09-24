const axios = require('axios');
const botService = require('./bot-service');

class AIAssistantService {
  async processQuery({ query, city = 'hanoi', userApiKey = '' }) {
    const liveData = botService.getData();
    const floodPoints = (liveData.floodPoints || []).filter(f => f.city === city);
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];

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
    return this.generateSmartLocalResponse(query, city, floodPoints, trafficIncidents, weatherAlerts);
  }

  // Phân tích câu hỏi bằng Bộ não AI thông minh chạy trực tiếp
  generateSmartLocalResponse(query, city, floods, traffics, alerts) {
    const lower = query.toLowerCase();
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');

    // 1. Hỏi về tình trạng tắc đường, kẹt xe trên tuyến đường cụ thể
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('kẹt xe')) {
      // Nhận diện một số tuyến đường đặc thù hay tắc ở Hà Nội & TP.HCM
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

      return {
        text: `🚦 **Tình hình giao thông thực tế từ VOV & TomTom Traffic (${cityName})**:\n\n` +
              (traffics.length > 0
                ? traffics.slice(0, 3).map(t => `• 🚗 **${t.description}** (Độ trễ dự kiến: ~${Math.round(t.delaySeconds / 60)} phút)`).join('\n')
                : `• Giao thông hiện tại trên các tuyến trục chính tương đối ổn định, mật độ trung bình.`) +
              roadInsight +
              `\n\nBản đồ nhiệt giao thông (đường xanh/vàng/đỏ) đã được kích hoạt trực tiếp trên giao diện Live Map.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
      };
    }

    // 2. Hỏi về lộ trình / tìm đường tránh ngập (Ví dụ: từ A đến B)
    if (lower.includes('tìm đường') || lower.includes('lộ trình') || lower.includes('chỉ đường') || (lower.includes('từ') && lower.includes('đến'))) {
      const floodNames = floods.map(f => f.name).join(', ');
      
      let matchedFlood = floods.find(f => {
        const words = f.name.toLowerCase().split(/[(),-]/);
        return words.some(w => w.trim().length > 3 && lower.includes(w.trim()));
      });

      if (matchedFlood) {
        return {
          text: `⚠️ **Cảnh báo rủi ro cao tại ${matchedFlood.name}**!\n\n` +
                `Hiện trạm đo ghi nhận mực nước ngập sâu **${matchedFlood.depth_cm}cm** (${matchedFlood.advice}).\n\n` +
                `💡 **Khuyến nghị di chuyển**: Xe máy và ô tô gầm thấp tuyệt đối không đi qua đoạn này vì nguy cơ thủy kích rất cao. Hãy chuyển sang chế độ **Bản đồ Tác chiến** trên ứng dụng, hệ thống MoveSafe đã tự động vạch lộ trình vòng qua các tuyến phố cao ráo lân cận!`,
          action: {
            type: 'FOCUS_POINT',
            lat: matchedFlood.lat,
            lng: matchedFlood.lng,
            name: matchedFlood.name
          }
        };
      }

      return {
        text: `🚗 **Phân tích lộ trình thông minh tại ${cityName}**:\n\n` +
              `Hiện tại hệ thống Bot ghi nhận đang có **${floods.length} điểm ngập cục bộ** và **${traffics.length} điểm ùn ứ**.\n\n` +
              `📍 **Các rốn ngập cần tránh tuyệt đối**:\n` +
              floods.slice(0, 3).map(f => `• **${f.name}**: Ngập sâu ${f.depth_cm}cm (${f.passable_motorbike ? 'Xe máy đi chậm' : 'Xe máy KHÔNG THỂ QUA'})`).join('\n') +
              `\n\n👉 **Gợi ý**: Bạn có thể nhập trực tiếp Điểm đi và Điểm đến vào thanh tìm kiếm phía trên để MoveSafe kích hoạt thuật toán tự động bẻ hướng né ngập tức thì!`,
        action: { type: 'SHOW_FLOOD_LAYER' }
      };
    }

    // 2. Hỏi về thời tiết, mưa, bão
    if (lower.includes('mưa') || lower.includes('thời tiết') || lower.includes('nhiệt độ') || lower.includes('ngập không') || lower.includes('bão') || lower.includes('triều cường')) {
      const alertMsg = alerts.length > 0 ? alerts[0].content : 'Thời tiết có mây dông rải rác vào chiều tối.';
      return {
        text: `🌧️ **Dự báo thời tiết & Nguy cơ ngập úng (${cityName})**:\n\n` +
              `• **Trạng thái**: ${alertMsg}\n` +
              `• **Mức độ rủi ro ngập**: ${floods.some(f => f.danger_level === 'critical') ? '🔴 RẤT CAO (Có điểm ngập >30cm)' : '🟡 TRUNG BÌNH'}\n` +
              `• **Lời khuyên**: Nếu di chuyển bằng xe máy, hãy chuẩn bị áo mưa bộ và tránh đỗ xe ở các tầng hầm tòa nhà khu vực trũng thấp.`,
        action: { type: 'SHOW_WEATHER_LAYER' }
      };
    }

    // 3. Hỏi về tình trạng tắc đường, kẹt xe
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('giao thông')) {
      return {
        text: `🚦 **Tình hình giao thông thực tế từ VOV & TomTom Traffic (${cityName})**:\n\n` +
              (traffics.length > 0
                ? traffics.slice(0, 3).map(t => `• 🚗 **${t.description}** (Độ trễ dự kiến: ~${Math.round(t.delaySeconds / 60)} phút)`).join('\n')
                : `• Giao thông hiện tại trên các tuyến trục chính tương đối ổn định, mật độ trung bình.`) +
              `\n\nBản đồ nhiệt giao thông (đường xanh/vàng/đỏ) đã được kích hoạt trực tiếp trên giao diện Live Map.`,
        action: { type: 'SHOW_TRAFFIC_LAYER' }
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

  // Gọi Google Gemini API với cơ chế tự động chuyển đổi Model thông minh
  async callGeminiAPI(query, liveData, city, apiKey) {
    const cityName = city === 'hanoi' ? 'Hà Nội' : (city === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const floodPoints = (liveData.floodPoints || []).filter(f => f.city === city);
    const trafficIncidents = (liveData.trafficIncidents || []).filter(t => t.city === city);
    const weatherAlerts = liveData.weatherAlerts || [];

    const lower = query.toLowerCase();
    const isAskingTrafficOnly = (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('sao lại') || lower.includes('tại sao') || lower.includes('kẹt xe')) && !lower.includes('ngập') && !lower.includes('mưa');
    const isAskingFloodOnly = (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích') || lower.includes('triều cường')) && !lower.includes('tắc') && !lower.includes('kẹt');

    let dynamicContext = '';
    let instructions = '';

    if (isAskingTrafficOnly) {
      dynamicContext = `Dữ liệu giao thông thời gian thực từ TomTom & VOV tại ${cityName}:
- Sự cố / tình hình ùn tắc: ${JSON.stringify(trafficIncidents.slice(0, 6).map(t => ({ description: t.description, delay_min: Math.round(t.delaySeconds / 60) })))}`;
      
      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng chỉ hỏi về TẮC ĐƯỜNG / KẸT XE, hoàn toàn KHÔNG hỏi về ngập úng hay thời tiết.
2. TUYỆT ĐỐI KHÔNG tự động liệt kê danh sách các điểm ngập nước (mức ngập 0cm) hay cảnh báo mang áo mưa vì không liên quan.
3. Nếu người dùng hỏi về một tuyến đường hoặc khu vực cụ thể (ví dụ: đường Xuân Phương, Giải Phóng, Nguyễn Trãi, Cầu Giấy, Trường Chinh...): Hãy kết hợp kiến thức thực tế về tuyến đường đó tại ${cityName} (lòng đường hẹp, nút thắt cổ chai, mật độ phương tiện từ các khu dân cư/đô thị lân cận đổ về vào giờ cao điểm, nút giao cắt đường sắt/đèn đỏ, xe tải...) để giải thích nguyên nhân rõ ràng và gợi ý hướng đi thay thế nếu có.
4. Trả lời thẳng thắn, ngắn gọn, súc tích (2-3 đoạn ngắn), dùng emoji phù hợp.`;
    } else if (isAskingFloodOnly) {
      dynamicContext = `Dữ liệu đo đạc ngập úng từ trạm HSDC/UDi Maps tại ${cityName}:
- Các điểm đo ngập: ${JSON.stringify(floodPoints.slice(0, 8).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice, passable_motorbike: f.passable_motorbike })))}
- Cảnh báo thời tiết KTTV: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về NGẬP NƯỚC / THỦY KÍCH / MƯA LŨ. Nêu rõ độ sâu ngập (cm), các rốn ngập cần tránh, khả năng đi qua của xe máy và ô tô.
2. Trả lời súc tích, thực tế và mang tính hành động cao.`;
    } else {
      dynamicContext = `Dữ liệu đo đạc thời gian thực tại đô thị ${cityName}:
- Điểm ngập úng trạm đo: ${JSON.stringify(floodPoints.slice(0, 6).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice })))}
- Tình hình giao thông TomTom/VOV: ${JSON.stringify(trafficIncidents.slice(0, 5).map(t => ({ description: t.description, delay_min: Math.round(t.delaySeconds / 60) })))}
- Cảnh báo thời tiết: ${JSON.stringify(weatherAlerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi của người dùng. Không liệt kê lan man những thông tin không liên quan.
2. Nếu hỏi đường, gợi ý lộ trình kết hợp cả né ngập và né kẹt xe. Súc tích, định dạng Markdown rõ ràng.`;
    }

    const contextPrompt = `Bạn là Trợ lý AI Giao Thông MoveSafe VN thông minh.
Đô thị: ${cityName}.
${dynamicContext}

Câu hỏi của người tham gia giao thông: "${query}"

${instructions}`;

    const candidateModels = [
      'gemini-3.6-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-flash-lite-latest',
      'gemini-2.5-pro'
    ];

    let lastError = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: contextPrompt }] }]
        }, { timeout: 12000 });

        const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          return {
            text: reply.trim(),
            action: { type: 'SHOW_FLOOD_LAYER' },
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
