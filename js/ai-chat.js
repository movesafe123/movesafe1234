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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'vi-VN';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('[Voice] Nhận diện được:', transcript);
        const searchInput = document.getElementById('gm-search-input');
        const chatInput = document.getElementById('ai-chat-input');
        if (searchInput) searchInput.value = transcript;
        if (chatInput) chatInput.value = transcript;

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
    document.querySelectorAll('.btn-voice, #btn-voice-search, #btn-chat-voice').forEach(btn => btn.classList.add('mic-active'));
    try {
      this.recognition.start();
    } catch (e) {}
  }

  stopListening() {
    this.isListening = false;
    document.querySelectorAll('.btn-voice, #btn-voice-search, #btn-chat-voice').forEach(btn => btn.classList.remove('mic-active'));
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
      this.addBotMessage(`Xin chào! Tôi là **Trợ lý AI MoveSafe**.\nTôi theo dõi trực tiếp mực nước các trạm đo HSDC, UDi Maps và lưu lượng giao thông TomTom.\nBạn cần tư vấn lộ trình di chuyển hay kiểm tra tình trạng ngập úng, kẹt xe tại khu vực nào?`);
    }
  }

  close() {
    this.isOpen = false;
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.remove('open');
  }

  clearMessages() {
    this.messages = [];
    this.open();
    this.renderMessages();
  }

  stripEmojis(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^ +/gm, '')
      .trim();
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    this.renderMessages();
  }

  addBotMessage(text) {
    this.messages.push({ sender: 'bot', text: this.stripEmojis(text) });
    this.renderMessages();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  speakText(text) {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ đọc giọng nói.');
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = this.stripEmojis(text).replace(/[*_#`[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  renderMessages() {
    const body = document.getElementById('ai-chat-body');
    if (!body) return;

    body.innerHTML = this.messages.map((m) => {
      const isUser = m.sender === 'user';
      let safeHtml = this.escapeHtml(m.text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

      const ttsButton = !isUser ? `
        <div class="gm-chat-actions">
          <button class="gm-btn-tts"
                  onclick="window.aiChat && window.aiChat.speakText(decodeURIComponent('${encodeURIComponent(m.text)}'))"
                  title="Đọc bằng giọng nói tiếng Việt">
            Đọc tin nhắn
          </button>
        </div>
      ` : '';

      return `
        <div class="gm-chat-bubble ${isUser ? 'gm-bubble-user' : 'gm-bubble-bot'}">
          <div class="gm-bubble-content">${safeHtml}</div>
          ${ttsButton}
        </div>
      `;
    }).join('');

    body.scrollTop = body.scrollHeight;
  }

  /**
   * Phân tích câu hỏi tìm đường tự nhiên tiếng Việt
   * Xử lý chính xác các câu như: "từ an trai ra bến xe mỹ đình trong 2h tới có bị tắc đường không"
   */
  parseRouteQuery(query) {
    if (!query) return null;

    // 1. Trích xuất mốc thời gian dự báo nếu có (VD: "trong 2h tới", "sau 1 giờ nữa", "3 tiếng tới")
    let timeOffsetHours = 0;
    const timeMatch = query.match(/(?:trong|sau|khoảng)?\s*(\d+)\s*(?:h|giờ|tiếng)\s*(?:tới|nữa|sau)?/i);
    if (timeMatch && timeMatch[1]) {
      timeOffsetHours = Math.min(3, Math.max(0, parseInt(timeMatch[1], 10)));
    }

    // 2. Làm sạch phần đuôi câu hỏi (thời gian, câu hỏi tắc đường/ngập nước) trước khi tách điểm đi - điểm đến
    let cleaned = query
      .replace(/(?:trong|sau|khoảng)\s*\d+\s*(?:h|giờ|tiếng|phút|p)\s*(?:tới|nữa|sau)?.*$/i, '')
      .replace(/\s+\d+\s*(?:h|giờ|tiếng)\s*(?:tới|nữa).*$/i, '')
      .replace(/\s+(?:hiện tại|bây giờ|lúc này|hôm nay|chiều nay|tối nay|sáng nay)?\s*(?:có bị|có đang|có|bị|đang)?\s*(?:tắc đường|kẹt xe|ùn tắc|tắc|kẹt|ngập nước|ngập úng|ngập|mưa|thông thoáng|đi được).*$/i, '')
      .replace(/\s+(?:đi đường nào|đường nào|như thế nào|thế nào|ra sao|không|chưa|nhỉ|vậy|ạ|nhé|\?|\.|!)+$/i, '')
      .trim();

    // 3. Tách Điểm đi và Điểm đến với các giới từ chỉ hướng phổ biến (đến, về, sang, qua, tới, ra, vào, lên, xuống)
    const routeRegex = /(?:tìm đường\s+|chỉ đường\s+|lộ trình\s+|đi\s+)?từ\s+(.+?)\s+(?:đến|về|sang|qua|tới|ra|vào|lên|xuống)\s+(.+)$/i;
    const match = cleaned.match(routeRegex);
    if (!match || !match[1] || !match[2]) return null;

    const orig = match[1]
      .replace(/^(?:tôi|mình|bạn|hãy|giúp|muốn|cần|đi)\s+/i, '')
      .replace(/[,.?!]+$/g, '')
      .trim();

    const dest = match[2]
      .replace(/\s+(?:né ngập|tránh tắc|không ngập|an toàn|nhanh nhất).*$/i, '')
      .replace(/[,.?!]+$/g, '')
      .trim();

    if (orig.length < 2 || dest.length < 2) return null;

    return {
      origin: orig,
      destination: dest,
      timeOffsetHours
    };
  }

  handleMapAction(act) {
    if (!act || !window.mapEngine) return;
    if (act.type === 'AUTO_ROUTE' && act.origin && act.destination) {
      if (window.appState && window.appState.triggerChatRoute) {
        window.appState.triggerChatRoute(act.origin, act.destination, act.avoidLevel || 1, act.timeOffsetHours || 0);
      }
    } else if (act.type === 'FOCUS_POINT' && act.lat && act.lng) {
      window.mapEngine.map?.flyTo([act.lat, act.lng], 16);
      setTimeout(() => {
        if (typeof window.mapEngine.openWardPopup === 'function') {
          window.mapEngine.openWardPopup(act.lat, act.lng);
        }
      }, 650);
    } else if (act.type === 'SHOW_FLOOD_LAYER') {
      window.mapEngine.toggleFloods(true);
      const chk = document.getElementById('chk-layer-flood');
      if (chk) chk.checked = true;
    } else if (act.type === 'SHOW_TRAFFIC_LAYER') {
      window.mapEngine.toggleTraffic(true);
      window.mapEngine.toggleIncidents(true);
      const chk = document.getElementById('chk-layer-traffic');
      if (chk) chk.checked = true;
    } else if (act.type === 'SHOW_WEATHER_LAYER') {
      window.mapEngine.toggleWeather(true);
      const chk = document.getElementById('chk-layer-weather');
      if (chk) chk.checked = true;
    }
  }

  async sendMessage(queryText) {
    const input = document.getElementById('ai-chat-input');
    const query = queryText || (input ? input.value.trim() : '');
    if (!query) return;

    if (input) input.value = '';
    this.addUserMessage(query);

    this.addBotMessage('*Đang phân tích dữ liệu giao thông thời gian thực...*');

    const currentCity = window.appState ? window.appState.currentCity : 'hanoi';
    const geminiKey = localStorage.getItem('movesafe_gemini_key') || '';
    const parsedRoute = this.parseRouteQuery(query);

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
          this.messages.pop();

          // Nếu câu hỏi là lộ trình từ A đến B nhưng backend trả kết quả bị tách sai, ưu tiên bộ phân tích chuẩn
          if (parsedRoute && data.response.action?.type === 'AUTO_ROUTE') {
            data.response.action.origin = parsedRoute.origin;
            data.response.action.destination = parsedRoute.destination;
            data.response.action.timeOffsetHours = parsedRoute.timeOffsetHours;
          }

          this.addBotMessage(data.response.text);
          responded = true;

          if (parsedRoute) {
            this.handleMapAction({
              type: 'AUTO_ROUTE',
              origin: parsedRoute.origin,
              destination: parsedRoute.destination,
              avoidLevel: 1,
              timeOffsetHours: parsedRoute.timeOffsetHours
            });
          } else if (data.response.action) {
            this.handleMapAction(data.response.action);
          }
        }
      }
    } catch (serverErr) {
      // Backend không phản hồi
    }

    if (responded) return;

    // 2. Thử gọi trực tiếp Google Gemini API qua Client
    if (geminiKey) {
      try {
        let geminiReply = await this.callDirectGemini(query, currentCity, geminiKey);
        this.messages.pop();

        let autoOrigin = parsedRoute ? parsedRoute.origin : null;
        let autoDest = parsedRoute ? parsedRoute.destination : null;
        const routeMatch = geminiReply.match(/\[ACTION_ROUTE:\s*(.*?)\s*->\s*(.*?)\]/i);
        if (routeMatch) {
          if (!autoOrigin) autoOrigin = routeMatch[1].trim();
          if (!autoDest) autoDest = routeMatch[2].trim();
          geminiReply = geminiReply.replace(/\[ACTION_ROUTE:\s*.*?\s*->\s*.*?\]/i, '').trim();
        }

        this.addBotMessage(geminiReply);

        if (autoOrigin && autoDest && window.appState && window.appState.triggerChatRoute) {
          window.appState.triggerChatRoute(autoOrigin, autoDest, 1, parsedRoute ? parsedRoute.timeOffsetHours : 0);
        }
        return;
      } catch (geminiErr) {
        console.warn('[AIChat] Direct Gemini call fallback to local rule engine:', geminiErr);
      }
    }

    // 3. Fallback sang Bộ não AI cục bộ dựa trên dữ liệu trạm đo thực tế
    this.messages.pop();
    const allFloods = (window.appState && typeof window.appState.getCurrentFloods === 'function')
      ? window.appState.getCurrentFloods()
      : (window.appState ? window.appState.liveData.floodPoints.filter(f => f.city === currentCity) : []);
    const activeFloods = allFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const traffics = window.appState ? window.appState.liveData.trafficIncidents.filter(t => t.city === currentCity) : [];
    const activeJams = traffics.filter(t => t.isJam === true);
    const lower = query.toLowerCase();

    // 3a. Nếu hỏi lộ trình từ A đến B (ví dụ: "từ an trai ra bến xe mỹ đình trong 2h tới có bị tắc đường không")
    if (parsedRoute) {
      const { origin, destination, timeOffsetHours } = parsedRoute;
      const timeNote = timeOffsetHours > 0
        ? `\n**Dự báo trong +${timeOffsetHours} giờ tới**: Hệ thống đã kích hoạt mô hình dự báo giao thông +${timeOffsetHours}h. Lưu lượng trên các trục chính hướng về **${destination}** được phân tích trực tiếp trên thanh trạng thái lộ trình.`
        : '';

      const trafficNote = activeJams.length > 0
        ? `Hiện ghi nhận **${activeJams.length} điểm ùn ứ** trong khu vực, hệ thống đã tự động ưu tiên đường vòng thông thoáng.`
        : `Hiện tại các trục đường chính tương đối thông thoáng, không ghi nhận điểm ùn tắc nghiêm trọng.`;

      const reply = `**Đã tự động phân tích và vẽ lộ trình trên bản đồ**\n\n` +
                    `• **Điểm xuất phát**: ${origin}\n` +
                    `• **Điểm đến**: ${destination}\n` +
                    `• **Tình trạng giao thông**: ${trafficNote}${timeNote}\n` +
                    `• **Chế độ điều phối**: Ưu tiên lộ trình an toàn, né hoàn toàn các điểm ngập úng và nút giao ùn tắc.\n\n` +
                    `*Bảng chi tiết lộ trình và bản đồ dẫn đường đã được mở ở phía bên trái màn hình.*`;

      this.addBotMessage(reply);
      if (window.appState && window.appState.triggerChatRoute) {
        window.appState.triggerChatRoute(origin, destination, 1, timeOffsetHours);
      }
      return;
    }

    // 3b. Kiểm tra nếu hỏi về phường hoặc trục đường cụ thể tại Hà Nội
    if (currentCity === 'hanoi' && window.HANOI_WARDS_DATA) {
      let matchedWard = window.HANOI_WARDS_DATA.find(w => {
        const wLower = w.name.toLowerCase();
        const rawWName = wLower.replace(/^phường\s+|^xã\s+/i, '').trim();
        return lower.includes(wLower) || (rawWName.length >= 3 && lower.includes(rawWName)) || (lower.includes(w.district.toLowerCase()) && lower.includes(rawWName));
      });

      if (!matchedWard) {
        for (const w of window.HANOI_WARDS_DATA) {
          const st = (w.mainStreets || []).find(s => {
            const cleanSt = s.toLowerCase().replace(/^đường\s+|^phố\s+|^quốc lộ\s+/i, '').trim();
            return lower.includes(s.toLowerCase()) || (cleanSt.length >= 4 && lower.includes(cleanSt));
          });
          if (st) {
            matchedWard = w;
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
        const weatherText = rain > 0 ? `${temp}°C, lượng mưa ${rain}mm (${desc})` : `${temp}°C, khô ráo (${desc})`;

        let reply = `**Thông tin giao thông & thời tiết: ${matchedWard.name} (Quận ${matchedWard.district})**\n\n`;
        reply += `• **Thời tiết hiện tại**: ${weatherText}\n`;
        reply += `• **Các trục đường chính**: ${(matchedWard.mainStreets || []).join(', ')}\n`;
        if (matchedWard.trafficHotspots && matchedWard.trafficHotspots.length > 0) {
          reply += `• **Nút giao trọng điểm**: ${matchedWard.trafficHotspots.join('; ')}\n`;
        }
        if (matchedWard.floodVulnerability) {
          reply += `• **Đặc điểm thoát nước**: ${matchedWard.floodVulnerability}\n`;
        }
        reply += `\nBạn có thể nhấn vào nút **Chỉ đường** trên thanh tìm kiếm để vạch lộ trình chi tiết qua khu vực này.`;

        this.addBotMessage(reply);
        if (window.mapEngine && window.mapEngine.map) {
          window.mapEngine.map.flyTo([matchedWard.lat, matchedWard.lng], 15);
        }
        return;
      }
    }

    let reply = `**Phân tích giao thông MoveSafe**:\n\n`;
    if (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('kẹt xe')) {
      if (lower.includes('xuân phương')) {
        reply += `**Tình trạng tuyến đường Xuân Phương (Nam Từ Liêm)**:\n` +
                 `• **Nguyên nhân**: Mặt cắt đường hẹp, lưu lượng phương tiện từ các khu đô thị đổ ra đường 32 và Trịnh Văn Bô lớn vào giờ cao điểm.\n` +
                 `• **Điểm nghẽn**: Nút giao cầu vượt và các điểm giao cắt với xe tải, xe buýt.\n` +
                 `• **Khuyến nghị**: Chuyển hướng sang trục Trịnh Văn Bô hoặc đường Trần Hữu Dực để di chuyển thông thoáng hơn.`;
      } else {
        reply += `Khu vực hiện ghi nhận **${activeJams.length} điểm ùn tắc** trên hệ thống TomTom Traffic.\n` +
                 `Lớp bản đồ mật độ giao thông đã được hiển thị trực tiếp trên màn hình để bạn theo dõi.`;
      }
      this.handleMapAction({ type: 'SHOW_TRAFFIC_LAYER' });
    } else if (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích')) {
      if (activeFloods.length > 0) {
        reply += `Hiện hệ thống ghi nhận **${activeFloods.length} điểm ngập** tại khu vực:\n\n` +
                 activeFloods.slice(0, 3).map(f => `• **${f.name}**: Ngập ${f.depth_cm}cm (${f.passable_motorbike ? 'Xe máy đi chậm' : 'Xe máy không nên đi qua'})`).join('\n') +
                 `\n\nBạn có thể mở mục **Chỉ đường** để hệ thống tự động vạch lộ trình vòng tránh các điểm ngập này.`;
      } else {
        reply += `Hiện tại toàn bộ các trạm quan trắc trong thành phố đều **khô ráo (0 điểm ngập)**. Các phương tiện lưu thông bình thường và an toàn.`;
      }
      this.handleMapAction({ type: 'SHOW_FLOOD_LAYER' });
    } else {
      reply += `Khu vực hiện có **${activeFloods.length} điểm ngập** và **${activeJams.length} điểm ùn tắc**. Để tìm đường tự động, bạn có thể nhập câu hỏi theo cú pháp *"Từ [Điểm đi] đến [Điểm đến]"*.`;
    }
    this.addBotMessage(reply);
  }

  async callDirectGemini(query, currentCity, apiKey) {
    const cityName = currentCity === 'hanoi' ? 'Hà Nội' : (currentCity === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const liveData = window.appState ? window.appState.liveData : { floodPoints: [], trafficIncidents: [], weatherAlerts: [] };
    const allFloods = (window.appState && typeof window.appState.getCurrentFloods === 'function')
      ? window.appState.getCurrentFloods()
      : ((liveData.floodPoints || []).filter(f => f.city === currentCity));
    const activeFloods = allFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const traffics = (liveData.trafficIncidents || []).filter(t => t.city === currentCity);
    const alerts = liveData.weatherAlerts || [];

    const lower = query.toLowerCase();
    const isAskingTrafficOnly = (lower.includes('tắc') || lower.includes('kẹt') || lower.includes('ùn') || lower.includes('sao lại') || lower.includes('tại sao') || lower.includes('kẹt xe')) && !lower.includes('ngập') && !lower.includes('mưa');
    const isAskingFloodOnly = (lower.includes('ngập') || lower.includes('nước') || lower.includes('thủy kích') || lower.includes('triều cường')) && !lower.includes('tắc') && !lower.includes('kẹt');

    let dynamicContext = '';
    if (currentCity === 'hanoi' && window.HANOI_WARDS_DATA) {
      const matched = window.HANOI_WARDS_DATA.find(w => {
        const wLower = w.name.toLowerCase();
        const rawWName = wLower.replace(/^phường\s+|^xã\s+/i, '').trim();
        return lower.includes(wLower) || (rawWName.length >= 3 && lower.includes(rawWName)) || (w.mainStreets || []).some(s => lower.includes(s.toLowerCase()));
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
      dynamicContext += `Dữ liệu giao thông thời gian thực từ TomTom & VOV tại ${cityName}:
- Sự cố / tình hình ùn tắc: ${JSON.stringify(traffics.slice(0, 6).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về TẮC ĐƯỜNG / KẸT XE.
2. Nếu người dùng hỏi lộ trình từ A đến B kèm câu hỏi tắc đường, hãy nhận định tình hình lưu thông trên trục đó và ở dòng cuối cùng ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B] (chỉ ghi tên địa điểm A và B ngắn gọn, không kèm cụm từ 'trong 2h tới' hay 'có bị tắc đường không').
3. Trả lời lịch sự, rõ ràng, ngắn gọn (2-3 đoạn ngắn), KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;
    } else if (isAskingFloodOnly) {
      const floodsForPrompt = activeFloods.length > 0 ? activeFloods : allFloods.slice(0, 5);
      dynamicContext += `Dữ liệu đo đạc ngập úng từ trạm HSDC/UDi Maps tại ${cityName} (Số điểm ngập >0cm hiện tại: ${activeFloods.length}):
- Các điểm đo ngập: ${JSON.stringify(floodsForPrompt.slice(0, 8).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice, passable_motorbike: f.passable_motorbike })))}
- Cảnh báo thời tiết KTTV: ${JSON.stringify(alerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Người dùng hỏi về NGẬP NƯỚC / THỦY KÍCH / MƯA LŨ. Nếu số điểm ngập >0cm là 0, khẳng định hiện tại đường khô ráo (0cm ngập). Nếu có ngập >0cm, nêu rõ độ sâu ngập (cm) và hướng đi thay thế.
2. Trả lời súc tích, thực tế, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).`;
    } else {
      dynamicContext += `Dữ liệu đo đạc thời gian thực tại đô thị ${cityName} (Số điểm ngập >0cm: ${activeFloods.length}):
- Điểm ngập úng trạm đo: ${JSON.stringify((activeFloods.length > 0 ? activeFloods : allFloods).slice(0, 6).map(f => ({ name: f.name, depth_cm: f.depth_cm, advice: f.advice })))}
- Tình hình giao thông TomTom/VOV: ${JSON.stringify(traffics.slice(0, 5).map(t => ({ description: t.description, delay_min: Math.round((t.delaySeconds || 60) / 60) })))}
- Cảnh báo thời tiết: ${JSON.stringify(alerts.slice(0, 2))}`;

      instructions = `YÊU CẦU TRẢ LỜI:
1. Trả lời đúng trọng tâm câu hỏi của người dùng, trình bày lịch sự, dễ đọc, KHÔNG dùng biểu tượng cảm xúc (emoji/icon).
2. Nếu hỏi đường đi / lộ trình từ [Điểm A] đến [Điểm B], ở dòng cuối cùng của câu trả lời hãy ghi cú pháp: [ACTION_ROUTE: Điểm A -> Điểm B] (chỉ trích xuất tên địa danh Điểm A và Điểm B chuẩn xác).`;
    }

    const prompt = `Bạn là Trợ lý AI Giao Thông MoveSafe VN thông minh.
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

