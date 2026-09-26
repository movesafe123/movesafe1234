/**
 * AIChat - Giao diện và logic tương tác Trợ lý AI Copilot
 */

class AIChat {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.initSpeech();
  }

  initSpeech() {
    // Khởi tạo nhận diện giọng nói tiếng Việt
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'vi-VN';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('[Voice] Nhận diện được:', transcript);
        const searchInput = document.getElementById('search-input');
        const chatInput = document.getElementById('ai-chat-input');
        if (searchInput) searchInput.value = transcript;
        if (chatInput) chatInput.value = transcript;

        // Tự động gửi câu hỏi vào AI
        this.open();
        this.sendMessage(transcript);
        this.stopListening();
      };

      this.recognition.onerror = () => this.stopListening();
      this.recognition.onend = () => this.stopListening();
    }
  }

  toggleVoiceSearch() {
    if (!this.recognition) {
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech API.');
      return;
    }
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening() {
    if (!this.recognition) return;
    this.isListening = true;
    document.querySelectorAll('.btn-voice').forEach(btn => btn.classList.add('mic-active'));
    try {
      this.recognition.start();
    } catch (e) {}
  }

  stopListening() {
    this.isListening = false;
    document.querySelectorAll('.btn-voice').forEach(btn => btn.classList.remove('mic-active'));
    try {
      if (this.recognition) this.recognition.stop();
    } catch (e) {}
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.add('open');
    if (this.messages.length === 0) {
      this.addBotMessage(`Xin chào! Tôi là **Trợ lý AI MoveSafe** 🤖.\nTôi theo dõi mực nước trạm đo HSDC, UDi Maps và kẹt xe TomTom.\nBạn cần tôi tư vấn tuyến đường khô ráo hay kiểm tra rốn ngập nào?`);
    }
  }

  close() {
    this.isOpen = false;
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.remove('open');
  }

  clearMessages() {
    this.messages = [];
    this.renderMessages();
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    this.renderMessages();
  }

  addBotMessage(text) {
    this.messages.push({ sender: 'bot', text });
    this.renderMessages();
  }

  renderMessages() {
    const body = document.getElementById('ai-chat-body');
    if (!body) return;

    body.innerHTML = this.messages.map(m => `
      <div class="gm-chat-bubble ${m.sender === 'user' ? 'gm-bubble-user' : 'gm-bubble-bot'}">
        ${m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
      </div>
    `).join('');

    body.scrollTop = body.scrollHeight;
  }

  async sendMessage(queryText) {
    const input = document.getElementById('ai-chat-input');
    const query = queryText || (input ? input.value.trim() : '');
    if (!query) return;

    if (input) input.value = '';
    this.addUserMessage(query);

    // Hiển thị đang suy nghĩ
    this.addBotMessage('⏳ *Đang phân tích dữ liệu thời gian thực...*');

    const currentCity = window.appState ? window.appState.currentCity : 'hanoi';
    const geminiKey = localStorage.getItem('movesafe_gemini_key') || '';

    let responded = false;

    // 1. Thử gọi backend API server nếu có (/api/ai/chat)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, city: currentCity, apiKey: geminiKey })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.response?.text) {
          this.messages.pop(); // Xóa tin nhắn chờ
          this.addBotMessage(data.response.text);
          responded = true;

          // Thực hiện hành động trên bản đồ nếu có
          if (data.response.action && window.mapEngine) {
            const act = data.response.action;
            if (act.type === 'AUTO_ROUTE' && act.origin && act.destination) {
              if (window.appState && window.appState.triggerChatRoute) {
                window.appState.triggerChatRoute(act.origin, act.destination, act.avoidLevel || 1);
              }
            } else if (act.type === 'FOCUS_POINT' && act.lat && act.lng) {
              if (window.appState && window.appState.switchMode) window.appState.switchMode('map');
              window.mapEngine.map.flyTo([act.lat, act.lng], 16);
            } else if (act.type === 'SHOW_FLOOD_LAYER') {
              if (window.appState && window.appState.switchMode) window.appState.switchMode('map');
            }
          }
        }
      }
    } catch (serverErr) {
      // Backend không phản hồi (ví dụ khi chạy tĩnh trên GitHub Pages)
    }

    if (responded) return;

    // 2. Thử gọi trực tiếp Google Gemini API qua Client (dành cho GitHub Pages hoặc khi backend bận)
    if (geminiKey) {
      try {
        let geminiReply = await this.callDirectGemini(query, currentCity, geminiKey);
        this.messages.pop();

        let autoOrigin = null;
        let autoDest = null;
        const routeMatch = geminiReply.match(/\[ACTION_ROUTE:\s*(.*?)\s*->\s*(.*?)\]/i);
        if (routeMatch) {
          autoOrigin = routeMatch[1].trim();
          autoDest = routeMatch[2].trim();
          geminiReply = geminiReply.replace(/\[ACTION_ROUTE:\s*.*?\s*->\s*.*?\]/i, '').trim();
        } else {
          const qMatch = query.match(/(?:từ|đi từ|chỉ đường từ)\s+(.*?)\s+(?:đến|về|sang|qua)\s+(.*?)(?:\.|\?|,|né ngập|tránh tắc|$)/i);
          if (qMatch && qMatch[1] && qMatch[2]) {
            autoOrigin = qMatch[1].replace(/^(tôi|bạn|hãy)/i, '').trim();
            autoDest = qMatch[2].replace(/(\?|!|\.|né ngập)$/i, '').trim();
          }
        }

        this.addBotMessage(geminiReply);

        if (autoOrigin && autoDest && window.appState && window.appState.triggerChatRoute) {
          window.appState.triggerChatRoute(autoOrigin, autoDest, 1);
        }
        return;
      } catch (geminiErr) {
        console.warn('[AIChat] Direct Gemini call fallback to local rule engine:', geminiErr);
      }
    }

    // 3. Fallback sang Bộ não AI cục bộ dựa trên dữ liệu trạm đo thực tế
    this.messages.pop();
    const floods = window.appState ? window.appState.liveData.floodPoints.filter(f => f.city === currentCity) : [];
    const traffics = window.appState ? window.appState.liveData.trafficIncidents.filter(t => t.city === currentCity) : [];
    const lower = query.toLowerCase();

    // 3a. Kiểm tra nếu hỏi lộ trình từ A đến B (Tự động vẽ đường né ngập trên bản đồ)
    const routeRegex = /(?:từ|đi từ|chỉ đường từ|lộ trình từ)\s+(.*?)\s+(?:đến|về|sang|qua)\s+(.*?)(?:\.|\?|,|né ngập|tránh tắc|không ngập|$)/i;
    const rMatch = query.match(routeRegex);
    if (rMatch && rMatch[1] && rMatch[2]) {
      const orig = rMatch[1].replace(/^(tôi|bạn|hãy|giúp)/i, '').trim();
      const dest = rMatch[2].replace(/(\?|!|\.|né ngập|tránh tắc|không ngập)$/i, '').trim();

      if (orig.length >= 2 && dest.length >= 2) {
        let reply = `🎯 **Đã kích hoạt tự động vẽ lộ trình thông minh trên bản đồ!**\n\n` +
                    `📍 **Lộ trình**: Điểm đi: **${orig}** ➔ Điểm đến: **${dest}**\n` +
                    `🛡️ **Điều phối tự động né ngập & ùn tắc**: MoveSafe tự động chọn chế độ **An toàn tuyệt đối (Né 100% rốn ngập)**. Nếu phát hiện rốn ngập sâu trên trục chính, hệ thống sẽ tự động bẻ hướng sang hành lang đường vòng cao ráo.\n\n` +
                    `*Bản đồ tác chiến và bảng chỉ đường đã được mở tự động cho bạn!*`;
        this.addBotMessage(reply);
        if (window.appState && window.appState.triggerChatRoute) {
          window.appState.triggerChatRoute(orig, dest, 1);
        }
        return;
      }
    }

    // 3b. Kiểm tra nếu hỏi về phường hoặc trục đường cụ thể tại Hà Nội
    if (currentCity === 'hanoi' && window.HANOI_WARDS_DATA) {
      let matchedWard = window.HANOI_WARDS_DATA.find(w => {
        const wLower = w.name.toLowerCase();
        const rawWName = wLower.replace(/^phường\s+|^xã\s+/i, '').trim();
        return lower.includes(wLower) || lower.includes(rawWName) || (lower.includes(w.district.toLowerCase()) && lower.includes(rawWName));
      });

      let matchedStreetName = '';
      if (!matchedWard) {
        for (const w of window.HANOI_WARDS_DATA) {
          const st = (w.mainStreets || []).find(s => {
            const cleanSt = s.toLowerCase().replace(/^đường\s+|^phố\s+|^quốc lộ\s+/i, '').trim();
            return lower.includes(s.toLowerCase()) || (cleanSt.length >= 4 && lower.includes(cleanSt));
          });
          if (st) {
            matchedWard = w;
            matchedStreetName = st;
            break;
          }
        }
      }

      if (matchedWard) {
        const liveStations = (window.appState && window.appState.latestWeatherStations) || [];
        const stWeather = liveStations.find(s => s.name === matchedWard.name);
        const temp = stWeather ? stWeather.temp : 26;
        const desc = stWeather ? stWeather.description : 'Khô ráo';
        const rain = stWeather ? stWeather.rain1h : 0;
        const weatherText = rain > 0 ? `🌧️ ${temp}°C, mưa ${rain}mm (${desc})` : `☀️ ${temp}°C, khô ráo (${desc})`;

        let reply = `🏛️ **Thông tin Giao thông & Thời tiết: ${matchedWard.name} (Q. ${matchedWard.district})**\n\n`;
        reply += `🌦️ **Thời tiết hiện tại**: ${weatherText}\n`;
        reply += `🛣️ **Các trục đường huyết mạch qua phường**:\n` +
                 (matchedWard.mainStreets || []).map(s => `  • **${s}**`).join('\n') + `\n\n`;
        if (matchedWard.trafficHotspots && matchedWard.trafficHotspots.length > 0) {
          reply += `🚦 **Điểm giao cắt & Nút thắt ùn tắc thường gặp**:\n` +
                   matchedWard.trafficHotspots.map(h => `  • ${h}`).join('\n') + `\n\n`;
        }
        if (matchedWard.floodVulnerability) {
          reply += `🌊 **Đặc điểm ngập úng mùa mưa bão**: ${matchedWard.floodVulnerability}\n\n`;
        }
        reply += `💡 **Gợi ý**: Bạn có thể bấm vào ghim **${matchedWard.name}** trên bản đồ hoặc bấm **🔀 Chỉ đường** để MoveSafe tự động vạch lộ trình né ùn tắc & ngập úng!`;

        this.addBotMessage(reply);
        if (window.mapEngine && window.mapEngine.map) {
          window.mapEngine.map.flyTo([matchedWard.lat, matchedWard.lng], 15);
        }
        return;
      }
    }

    let reply = `🚗 **Phân tích Trợ lý AI MoveSafe**:\n\n`;
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('kẹt xe')) {
      if (lower.includes('xuân phương')) {
        reply += `🚦 **Tình trạng tuyến đường Xuân Phương (Nam Từ Liêm)**:\n` +
                 `• **Nguyên nhân chính**: Mặt cắt đường hẹp, lưu lượng phương tiện từ các khu đô thị (Vân Canh, Hateco, Foresa...) đổ ra đường 32 và Trịnh Văn Bô rất lớn vào giờ cao điểm.\n` +
                 `• **Điểm nghẽn**: Nút giao thắt cổ chai và xung đột xe máy với xe buýt, xe tải.\n` +
                 `💡 **Khuyến nghị**: Nên chuyển hướng sang trục Trịnh Văn Bô hoặc đường Trần Hữu Dực để di chuyển thông thoáng hơn!`;
      } else {
        reply += `Khu vực hiện ghi nhận **${traffics.length} điểm ùn tắc** trên hệ thống TomTom Traffic.\n` +
                 `Giao thông trên các tuyến trục chính đang có mật độ cao vào khung giờ này. Bạn hãy theo dõi lớp bản đồ nhiệt giao thông trực tiếp trên MoveSafe nhé!`;
      }
    } else if (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích')) {
      reply += `Hiện hệ thống ghi nhận **${floods.length} rốn ngập** tại khu vực.\n\n` +
               `📍 **Các điểm ngập sâu cần tránh**:\n` +
               floods.slice(0, 3).map(f => `• **${f.name}**: Ngập sâu ${f.depth_cm}cm (${f.passable_motorbike ? 'Xe máy đi chậm' : 'Xe máy KHÔNG THỂ QUA'})`).join('\n') +
               `\n\n💡 **Gợi ý**: Bạn bấm vào nút **🔀 Chỉ đường** trên thanh tìm kiếm để MoveSafe tự động vạch lộ trình né ngập màu xanh lá nhé!`;
    } else {
      reply += `Khu vực hiện có **${floods.length} rốn ngập** và **${traffics.length} điểm ùn tắc**. Bạn cần kiểm tra tuyến đường nào hãy nhập vào thanh tìm kiếm nhé!`;
    }
    this.addBotMessage(reply);
  }

  // Gọi trực tiếp Google Gemini API từ trình duyệt
  async callDirectGemini(query, currentCity, apiKey) {
    const cityName = currentCity === 'hanoi' ? 'Hà Nội' : (currentCity === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const liveData = window.appState ? window.appState.liveData : { floodPoints: [], trafficIncidents: [], weatherAlerts: [] };
    const floods = (liveData.floodPoints || []).filter(f => f.city === currentCity);
    const traffics = (liveData.trafficIncidents || []).filter(t => t.city === currentCity);
    const alerts = liveData.weatherAlerts || [];

    const lower = query.toLowerCase();
    const isAskingTrafficOnly = (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('sao lại') || lower.includes('tại sao') || lower.includes('kẹt xe')) && !lower.includes('ngập') && !lower.includes('mưa');
    const isAskingFloodOnly = (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích') || lower.includes('triều cường')) && !lower.includes('tắc') && !lower.includes('kẹt');

    let dynamicContext = '';
    // Thêm ngữ cảnh phường và trục đường Hà Nội nếu có
    if (currentCity === 'hanoi' && window.HANOI_WARDS_DATA) {
      const matched = window.HANOI_WARDS_DATA.find(w => {
        const wLower = w.name.toLowerCase();
        const rawWName = wLower.replace(/^phường\s+|^xã\s+/i, '').trim();
        return lower.includes(wLower) || lower.includes(rawWName) || (w.mainStreets || []).some(s => lower.includes(s.toLowerCase()));
      });
      if (matched) {
        dynamicContext += `Dữ liệu địa phương Hà Nội về ${matched.name} (Q. ${matched.district}):
- Các trục đường lớn: ${matched.mainStreets.join(', ')}
- Điểm giao cắt trọng điểm: ${matched.trafficHotspots.join(' • ')}
- Đặc điểm ngập úng mùa mưa: ${matched.floodVulnerability}\n\n`;
      }
    }
    let instructions = '';

    if (isAskingTrafficOnly) {
      dynamicContext = `Dữ liệu giao thông thời gian thực từ TomTom & VOV tại ${cityName}:
- Sự cố / tình hình ùn tắc: ${JSON.stringify(traffics.slice(0, 6).map(t => ({ description: t.description, delay_min: Math.round(t.delaySeconds / 60) })))}`;
      
      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng chỉ hỏi về TẮC ĐƯỜNG / KẸT XE, hoàn toàn KHÔNG hỏi về ngập úng hay thời tiết.
2. TUYỆT ĐỐI KHÔNG tự động liệt kê danh sách các điểm ngập nước (mức ngập 0cm) hay cảnh báo mang áo mưa vì không liên quan.
3. Nếu người dùng hỏi về một tuyến đường hoặc khu vực cụ thể (ví dụ: đường Xuân Phương, Giải Phóng, Nguyễn Trãi, Cầu Giấy, Trường Chinh...): Hãy kết hợp kiến thức thực tế về tuyến đường đó tại ${cityName} (lòng đường hẹp, nút thắt cổ chai, mật độ phương tiện từ các khu dân cư/đô thị lân cận đổ về vào giờ cao điểm, nút giao cắt đường sắt/đèn đỏ, xe tải...) để giải thích nguyên nhân rõ ràng và gợi ý hướng đi thay thế nếu có.
4. Trả lời thẳng thắn, ngắn gọn, súc tích (2-3 đoạn ngắn), dùng emoji phù hợp.`;
    } else if (isAskingFloodOnly) {
      dynamicContext = `Dữ liệu đo đạc ngập úng từ trạm HSDC/UDi Maps tại ${cityName}:
- Các điểm đo ngập: ${JSON.stringify(floods.slice(0, 8).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice, passable_motorbike: f.passable_motorbike })))}
- Cảnh báo thời tiết KTTV: ${JSON.stringify(alerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về NGẬP NƯỚC / THỦY KÍCH / MƯA LŨ. Nêu rõ độ sâu ngập (cm), các rốn ngập cần tránh, khả năng đi qua của xe máy và ô tô.
2. Trả lời súc tích, thực tế và mang tính hành động cao.`;
    } else {
      dynamicContext = `Dữ liệu đo đạc thời gian thực tại đô thị ${cityName}:
- Điểm ngập úng trạm đo: ${JSON.stringify(floods.slice(0, 6).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice })))}
- Tình hình giao thông TomTom/VOV: ${JSON.stringify(traffics.slice(0, 5).map(t => ({ description: t.description, delay_min: Math.round(t.delaySeconds / 60) })))}
- Cảnh báo thời tiết: ${JSON.stringify(alerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi của người dùng. Không liệt kê lan man những thông tin không liên quan.
2. Nếu hỏi đường, gợi ý lộ trình kết hợp cả né ngập và né kẹt xe. Súc tích, định dạng Markdown rõ ràng.
3. ĐẶC BIỆT: Nếu người dùng hỏi đường đi / lộ trình từ [Điểm A] đến [Điểm B], ở dòng cuối cùng của câu trả lời hãy ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B] để ứng dụng tự động vẽ tuyến đường né ngập.`;
    }

    const prompt = `Bạn là Trợ lý AI Giao Thông MoveSafe VN thông minh.
Đô thị: ${cityName}.
${dynamicContext}

Câu hỏi của người tham gia giao thông: "${query}"

${instructions}`;

    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash'
    ];
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && reply.trim().length > 0) {
            return reply.trim();
          }
        }
      } catch (e) {
        console.warn(`[Client AI] Model ${model} gặp lỗi:`, e);
      }
    }
    throw new Error('All client Gemini models failed');
  }
}

window.aiChat = new AIChat();
