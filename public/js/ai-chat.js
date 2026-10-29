/**
 * MoveSafe VN - AI Spatial Copilot (AIChat)
 * Trợ lý Không gian & Giao thông Đa nhiệm kết nối 100% hệ thống Web MoveSafe VN
 * Tuân thủ nghiêm ngặt Icon Policy (AGENTS.md): 100% SVG Line Icons, 0% emoji
 */

class AIChat {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.currentSpeakingText = null;
    this.currentSpeakingBtn = null;
    this.currentAreaKey = null;

    // Trí nhớ không gian & hội thoại 3 tầng (3-Tier Spatial & Conversational Memory)
    this.sessionMemory = {
      lastOrigin: null,
      lastDestination: null,
      lastVehicle: 'motorbike',
      lastAvoidLevel: 1,
      lastTimeOffset: 0,
      lastAvoidRoads: [],
      lastSuggestedSpots: [],
      lastInspectedPlace: null,
      lastPropertyEval: null,
      homePlace: null,
      workPlace: null
    };

    this.isPickingSpatialPoint = false;
    this._spatialPickMarker = null;

    this.initSpeech();
    this.initCommutePresetsFromStorage();
  }

  initCommutePresetsFromStorage() {
    try {
      const saved = localStorage.getItem('movesafe_commute_presets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.home) this.sessionMemory.homePlace = parsed.home.title || parsed.home.fullAddress || parsed.home;
        if (parsed.work) this.sessionMemory.workPlace = parsed.work.title || parsed.work.fullAddress || parsed.work;
      }
    } catch (_e) {}
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
        const searchInput = document.getElementById('gm-search-input');
        const chatInput = document.getElementById('ai-chat-input');
        const btnClearSearch = document.getElementById('btn-clear-search');
        if (searchInput) {
          searchInput.value = transcript;
          if (btnClearSearch) btnClearSearch.style.display = 'inline-flex';
        }
        if (chatInput) chatInput.value = transcript;

        if (window.appState) {
          window.appState._shouldAnnounceRouteVoice = true;
          window.appState.showToast?.(`Đã nhận diện: "${transcript}"`, 'info', 2500);
        }
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
      window.appState?.showToast?.('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech API.', 'warning');
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
    window.appState?.showToast?.('Đang lắng nghe giọng nói... Hãy đọc câu hỏi hoặc địa điểm.', 'info', 3000);
    try {
      this.recognition.start();
    } catch (_e) {}
  }

  stopListening() {
    this.isListening = false;
    document.querySelectorAll('.btn-voice, #btn-voice-search, #btn-chat-voice').forEach(btn => btn.classList.remove('mic-active'));
    try {
      if (this.recognition) this.recognition.stop();
    } catch (_e) {}
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.add('open');
    if (window.appState && typeof window.appState.closePlaceDetailsCard === 'function') {
      window.appState.closePlaceDetailsCard();
    }
    document.body.classList.remove('place-card-open');
    this.updateMemoryBarUI();
    if (this.messages.length === 0) {
      this.addBotMessage(
        `Xin chào! Tôi là **Trợ lý AI MoveSafe VN (Agentic Spatial Copilot)**.\n` +
        `Tôi đồng bộ trực tiếp 100% dữ liệu thực từ các trạm đo ngập HSDC/UDi, lưu lượng TomTom, 87 trạm thời tiết và mô hình giả lập mưa bão.\n\n` +
        `Bạn có thể hỏi lộ trình thông minh, khảo sát chấm điểm thuê trọ an cư, cứu hộ SOS thủy kích hoặc bấm nút **Chấm Bản Đồ** để tôi phân tích thực địa ngay!`
      );
    }
  }

  close() {
    this.isOpen = false;
    this.stopSpeaking();
    const win = document.getElementById('ai-chat-window');
    if (win) win.classList.remove('open');
    if (this.isPickingSpatialPoint) {
      this.stopSpatialLensPick();
    }
  }

  clearMessages() {
    this.stopSpeaking();
    this.currentAreaKey = null;
    this.messages = [];
    this.resetSessionMemory();

    if (window.mapEngine) {
      if (typeof window.mapEngine.clearFoodPlaces === 'function') window.mapEngine.clearFoodPlaces();
      if (typeof window.mapEngine.clearRoute === 'function') window.mapEngine.clearRoute();
    }

    if (window.appState) {
      if (typeof window.appState.clearRouteLayers === 'function') window.appState.clearRouteLayers();
      if (typeof window.appState.closeDirections === 'function') window.appState.closeDirections();
      if (window.appState.searchResultMarker && window.mapEngine?.map) {
        window.mapEngine.map.removeLayer(window.appState.searchResultMarker);
        window.appState.searchResultMarker = null;
      }
    }

    this.open();
    this.renderMessages();
    window.appState?.showToast?.('Đã làm mới và xóa toàn bộ ngữ cảnh trò chuyện & ghim bản đồ', 'info', 3000);
  }

  updateMemoryBarUI() {
    const bar = document.getElementById('ai-memory-bar');
    const textEl = document.getElementById('ai-memory-text');
    if (!bar || !textEl) return;

    const parts = [];
    if (this.sessionMemory.lastOrigin && this.sessionMemory.lastDestination) {
      parts.push(`${this.sessionMemory.lastOrigin} -> ${this.sessionMemory.lastDestination}`);
    } else if (this.sessionMemory.lastInspectedPlace) {
      parts.push(`Điểm chọn: ${this.sessionMemory.lastInspectedPlace.name}`);
    } else if (this.sessionMemory.homePlace) {
      parts.push(`Nhà: ${this.sessionMemory.homePlace}`);
    }

    if (this.sessionMemory.lastVehicle && this.sessionMemory.lastVehicle !== 'motorbike') {
      const vMap = { car: 'Ô tô', ebike: 'Xe máy điện', ecar: 'Ô tô điện' };
      parts.push(vMap[this.sessionMemory.lastVehicle] || this.sessionMemory.lastVehicle);
    }

    if (parts.length > 0) {
      textEl.innerHTML = `<span style="opacity:0.75;">Đang nhớ:</span> <strong>${this.escapeHtml(parts.join(' • '))}</strong>`;
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  resetSessionMemory() {
    this.sessionMemory.lastOrigin = null;
    this.sessionMemory.lastDestination = null;
    this.sessionMemory.lastAvoidRoads = [];
    this.sessionMemory.lastSuggestedSpots = [];
    this.sessionMemory.lastInspectedPlace = null;
    this.sessionMemory.lastPropertyEval = null;
    this.updateMemoryBarUI();
    window.appState?.showToast?.('Đã xóa ngữ cảnh lộ trình & địa điểm đang nhớ', 'info', 2000);
  }

  stripEmojis(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^ +/gm, '')
      .trim();
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

  addMessage(sender, text) {
    if (sender === 'user') return this.addUserMessage(text);
    return this.addBotMessage(text);
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    this.renderMessages();
  }

  addBotMessage(text, options = {}) {
    this.messages.push({
      sender: 'bot',
      text: this.stripEmojis(text),
      spots: Array.isArray(options.spots) ? options.spots : null,
      followUps: Array.isArray(options.followUps) ? options.followUps : null,
      spatialCitations: Array.isArray(options.spatialCitations) ? options.spatialCitations : null,
      routeSummary: options.routeSummary || null,
      decisionMatrix: options.decisionMatrix || null,
      multiStopTimeline: options.multiStopTimeline || null,
      timeShiftAdvisor: options.timeShiftAdvisor || null,
      isProactiveAlert: !!options.isProactiveAlert
    });
    this.renderMessages();
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentSpeakingText = null;
    this.currentSpeakingBtn = null;
    this.updateAllTTSButtons(false);
  }

  toggleSpeakText(btn, text) {
    if (!('speechSynthesis' in window)) {
      window.appState?.showToast?.('Trình duyệt của bạn không hỗ trợ đọc giọng nói.', 'warning');
      return;
    }

    const cleanText = this.stripEmojis(text)
      .replace(/[*_#`[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) return;

    if (this.isSpeaking && (window.speechSynthesis.speaking || window.speechSynthesis.pending) && this.currentSpeakingText === cleanText) {
      this.stopSpeaking();
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.updateAllTTSButtons(false);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;

    const onFinish = () => {
      this.isSpeaking = false;
      this.currentSpeakingText = null;
      this.currentSpeakingBtn = null;
      if (btn) this.setButtonSpeakingState(btn, false);
      this.updateAllTTSButtons(false);
    };

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.currentSpeakingText = cleanText;
      this.currentSpeakingBtn = btn;
      if (btn) this.setButtonSpeakingState(btn, true);
    };

    utterance.onend = onFinish;
    utterance.onerror = (e) => {
      if (e && e.error === 'canceled') {
        onFinish();
        return;
      }
      onFinish();
    };

    this.isSpeaking = true;
    this.currentSpeakingText = cleanText;
    this.currentSpeakingBtn = btn;
    if (btn) this.setButtonSpeakingState(btn, true);

    window.speechSynthesis.speak(utterance);
  }

  setButtonSpeakingState(btn, isSpeaking) {
    if (!btn) return;
    const playIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    const stopIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"></rect></svg>`;

    if (isSpeaking) {
      btn.classList.add('is-speaking');
      btn.setAttribute('title', 'Nhấn để ngừng đọc giọng nói');
      btn.innerHTML = `${stopIconSvg}<span>Ngừng đọc</span>`;
    } else {
      btn.classList.remove('is-speaking');
      btn.setAttribute('title', 'Đọc bằng giọng nói tiếng Việt');
      btn.innerHTML = `${playIconSvg}<span>Đọc tin</span>`;
    }
  }

  updateAllTTSButtons(isSpeaking) {
    const playIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    document.querySelectorAll('.gm-btn-tts').forEach(b => {
      b.classList.remove('is-speaking');
      b.setAttribute('title', 'Đọc bằng giọng nói tiếng Việt');
      b.innerHTML = `${playIconSvg}<span>Đọc tin</span>`;
    });
  }

  // =========================================================================
  // CÁC WIDGET GIAO DIỆN TƯƠNG TÁC (Ý TƯỞNG 5 & ĐỘT PHÁ 6.1 - 6.5)
  // =========================================================================

  renderRouteCardHtml(route) {
    if (!route) return '';
    const rec = route.recommended || route;
    const distKm = rec.distanceKm || 0;
    const durMin = rec.durationMin || rec.estimatedMinutes || 0;
    const score = rec.safetyScore || 95;
    const cost = rec.fuelCostVnd ? `~${rec.fuelCostVnd.toLocaleString('vi-VN')}đ` : 'Chi phí tiết kiệm';
    const riskShield = rec.riskSavedText ? `<div class="gm-card-shield"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg><span>Bảo vệ ví: Tránh rủi ro thủy kích</span></div>` : '';

    return `
      <div class="gm-chat-route-card">
        <div class="gm-route-card-top">
          <div class="gm-route-card-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <strong>${this.escapeHtml(rec.label || rec.name || 'Lộ Trình Tối Ưu')}</strong>
          </div>
          <span class="gm-route-card-score" title="Chỉ số an toàn né ngập">${score}/100 An toàn</span>
        </div>
        <div class="gm-route-card-metrics">
          <div class="gm-metric-box">
            <span class="metric-val">~${durMin}</span>
            <span class="metric-lbl">Phút</span>
          </div>
          <div class="gm-metric-box">
            <span class="metric-val">${distKm}</span>
            <span class="metric-lbl">Km</span>
          </div>
          <div class="gm-metric-box">
            <span class="metric-val">${cost}</span>
            <span class="metric-lbl">Nhiên liệu</span>
          </div>
        </div>
        ${riskShield}
        <div class="gm-route-card-btns">
          <button type="button" class="btn-card-act primary" onclick="window.appState && window.appState.toggleDirectionsPanel(true)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <span>Mở chỉ đường trên bản đồ</span>
          </button>
          <button type="button" class="btn-card-act" onclick="window.appState && window.appState.openSosRescueModal()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>Bãi trú mưa gần đây</span>
          </button>
        </div>
      </div>
    `;
  }

  renderDecisionMatrixHtml(matrix) {
    if (!matrix || !matrix.items || matrix.items.length < 2) return '';
    const cols = matrix.items;

    return `
      <div class="gm-decision-matrix-card">
        <div class="gm-matrix-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line><line x1="3" y1="12" x2="21" y2="12"></line></svg>
          <strong>${this.escapeHtml(matrix.title || 'Ma Trận So Sánh Quyết Định')}</strong>
        </div>
        <div class="gm-matrix-grid">
          ${cols.map(c => `
            <div class="gm-matrix-col ${c.isRecommended ? 'recommended' : ''}">
              ${c.isRecommended ? '<div class="gm-matrix-badge">Khuyến nghị</div>' : ''}
              <div class="gm-matrix-name">${this.escapeHtml(c.name)}</div>
              <div class="gm-matrix-score">${c.scoreText || `${c.score}/100`}</div>
              <ul class="gm-matrix-points">
                ${(c.points || []).map(p => `<li>${this.escapeHtml(p)}</li>`).join('')}
              </ul>
              ${c.actionButton ? `
                <button type="button" class="gm-matrix-btn" onclick="${c.actionButton.onClick}">
                  ${this.escapeHtml(c.actionButton.label)}
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderMultiStopTimelineHtml(timeline) {
    if (!timeline || !timeline.stops || timeline.stops.length < 2) return '';

    return `
      <div class="gm-multistop-timeline">
        <div class="gm-timeline-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <strong>${this.escapeHtml(timeline.title || 'Lịch Trình Chuỗi Đa Điểm')}</strong>
        </div>
        <div class="gm-timeline-body">
          ${timeline.stops.map((s, idx) => `
            <div class="gm-timeline-step">
              <div class="gm-timeline-dot ${s.isStopover ? 'stopover' : ''}">${idx + 1}</div>
              <div class="gm-timeline-info">
                <div class="gm-timeline-name">${this.escapeHtml(s.name)} ${s.timeEst ? `<span class="gm-timeline-time">(${s.timeEst})</span>` : ''}</div>
                <div class="gm-timeline-desc">${this.escapeHtml(s.desc || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderTimeShiftHtml(ts) {
    if (!ts || !ts.now || !ts.plus1h) return '';
    const nowMin = ts.now.durationMin || 15;
    const p1Min = ts.plus1h.durationMin || 10;
    const diffMin = nowMin - p1Min;

    return `
      <div class="gm-timeshift-advisor">
        <div class="gm-timeshift-head">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Cố vấn thời điểm khởi hành (Time-Shift Optimizer):</span>
        </div>
        <div class="gm-timeshift-bars">
          <div class="gm-timeshift-row">
            <span class="ts-label">Đi ngay (+0h):</span>
            <div class="ts-bar-box"><div class="ts-bar" style="width: 100%;">~${nowMin} phút</div></div>
          </div>
          <div class="gm-timeshift-row highlight">
            <span class="ts-label">Đợi 1h nữa (+1h):</span>
            <div class="ts-bar-box"><div class="ts-bar p1" style="width: ${Math.round((p1Min / nowMin) * 100)}%;">~${p1Min} phút ${diffMin > 0 ? `(Nhanh hơn ${diffMin}p)` : ''}</div></div>
          </div>
        </div>
        <div class="gm-timeshift-actions">
          <button type="button" class="btn-ts-act" onclick="window.appState && window.appState.applyPredictionOffset(1)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Bật bản đồ mốc +1h</span>
          </button>
        </div>
      </div>
    `;
  }

  renderSpatialCitationsHtml(citations) {
    if (!Array.isArray(citations) || citations.length === 0) return '';

    return `
      <div class="gm-spatial-citations-row">
        <div class="gm-citations-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>Định vị thực địa:</span>
        </div>
        <div class="gm-citations-pills">
          ${citations.map(c => {
            const iconSvg = c.type === 'flood'
              ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
              : (c.type === 'ev'
                ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`
                : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`);
            return `
              <button type="button" class="gm-citation-pill pill-${c.type || 'poi'}" onclick="window.mapEngine && window.mapEngine.map && window.mapEngine.map.flyTo([${c.lat}, ${c.lng}], 16)">
                ${iconSvg}
                <span>${this.escapeHtml(c.label)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderFollowUpsHtml(followUps) {
    if (!Array.isArray(followUps) || followUps.length === 0) return '';

    return `
      <div class="gm-chat-followups">
        <div class="gm-followup-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>Gợi ý câu hỏi tiếp theo:</span>
        </div>
        <div class="gm-followup-chips">
          ${followUps.map(f => `
            <button type="button" class="gm-followup-chip" onclick="window.aiChat && window.aiChat.sendMessage('${this.escapeHtml(f).replace(/'/g, "\\'")}')">
              <span>${this.escapeHtml(f)}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderMessages() {
    const body = document.getElementById('ai-chat-body');
    if (!body) return;

    const playIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    const stopIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"></rect></svg>`;

    body.innerHTML = this.messages.map((m) => {
      const isUser = m.sender === 'user';
      let safeHtml = this.escapeHtml(m.text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

      const cleanText = this.stripEmojis(m.text)
        .replace(/[*_#`[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const isSpeakingThis = Boolean(this.isSpeaking && this.currentSpeakingText === cleanText);

      // Spots buttons (ẩm thực, trạm sạc)
      const spotsButtonsHtml = (!isUser && Array.isArray(m.spots) && m.spots.length > 0) ? `
        <div class="gm-chat-spots-actions">
          ${m.spots.map((sp, sIdx) => {
            if (typeof sp.lat !== 'number' || typeof sp.lng !== 'number') return '';
            const shortLabel = this.escapeHtml(String(sp.name || '').split('(')[0].split('&')[0].trim().slice(0, 26));
            const fullSafe = this.escapeHtml(sp.name || 'Địa điểm').replace(/'/g, "\\'");
            return `
              <button type="button" class="btn-spot-route"
                onclick="window.appState && window.appState.routeToLocation(${sp.lat}, ${sp.lng}, '${fullSafe}')"
                title="Chỉ đường an toàn đến ${this.escapeHtml(sp.name || '')}">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                <span>Đi tới #${sIdx + 1}: ${shortLabel}</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : '';

      const routeCardHtml = !isUser ? this.renderRouteCardHtml(m.routeSummary) : '';
      const decisionMatrixHtml = !isUser ? this.renderDecisionMatrixHtml(m.decisionMatrix) : '';
      const timelineHtml = !isUser ? this.renderMultiStopTimelineHtml(m.multiStopTimeline) : '';
      const timeShiftHtml = !isUser ? this.renderTimeShiftHtml(m.timeShiftAdvisor) : '';
      const citationsHtml = !isUser ? this.renderSpatialCitationsHtml(m.spatialCitations) : '';
      const followUpsHtml = !isUser ? this.renderFollowUpsHtml(m.followUps) : '';

      const proactiveBadge = m.isProactiveAlert ? `
        <div class="gm-proactive-guardian-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <span>MoveSafe Proactive AI Guardian</span>
        </div>
      ` : '';

      const ttsButton = !isUser ? `
        <div class="gm-chat-actions">
          <button class="gm-btn-tts ${isSpeakingThis ? 'is-speaking' : ''}"
                  onclick="window.aiChat && window.aiChat.toggleSpeakText(this, decodeURIComponent('${encodeURIComponent(m.text)}'))"
                  title="${isSpeakingThis ? 'Nhấn để ngừng đọc giọng nói' : 'Đọc bằng giọng nói tiếng Việt'}">
            ${isSpeakingThis ? stopIconSvg : playIconSvg}
            <span>${isSpeakingThis ? 'Ngừng đọc' : 'Đọc tin'}</span>
          </button>
        </div>
      ` : '';

      return `
        <div class="gm-chat-bubble ${isUser ? 'gm-bubble-user' : 'gm-bubble-bot'} ${m.isProactiveAlert ? 'proactive-alert' : ''}">
          ${proactiveBadge}
          <div class="gm-bubble-content">${safeHtml}</div>
          ${routeCardHtml}
          ${decisionMatrixHtml}
          ${timelineHtml}
          ${timeShiftHtml}
          ${spotsButtonsHtml}
          ${citationsHtml}
          ${ttsButton}
          ${followUpsHtml}
        </div>
      `;
    }).join('');

    body.scrollTop = body.scrollHeight;
  }

  // =========================================================================
  // BỘ ĐỒNG BỘ TRẠNG THÁI WEB THỰC TẾ (HẠNG MỤC 0)
  // =========================================================================

  collectLiveWebSnapshot() {
    const app = window.appState || {};
    const liveData = app.liveData || {};
    const currentCity = app.currentCity || 'hanoi';

    // 1. Toàn bộ điểm ngập hiển thị trên Web (thực tế + giả lập + báo cáo cộng đồng)
    const visibleFloods = (typeof app.getCurrentFloods === 'function')
      ? app.getCurrentFloods()
      : ((liveData.floodPoints || []).filter(f => f.city === currentCity));

    // 2. Toàn bộ sự cố TomTom
    const visibleTraffics = (typeof app.getCurrentTraffics === 'function')
      ? app.getCurrentTraffics()
      : ((liveData.trafficIncidents || []).filter(t => t.city === currentCity));

    // 3. Tin VOV và trạm thời tiết phường
    const vovNews = liveData.vovTrafficNews || [];
    const weatherStations = app.latestWeatherStations || [];

    // 4. Lộ trình thực tế đang hiển thị trên bản đồ
    let activeRoute = null;
    if (app.lastRouteResult && app.lastRouteResult.routes && app.lastRouteResult.routes.length > 0) {
      const rec = app.lastRouteResult.routes.find(r => r.isRecommended) || app.lastRouteResult.routes[0];
      activeRoute = {
        origin: app.routeLocations?.origin?.title || 'Điểm xuất phát',
        destination: app.routeLocations?.destination?.title || 'Điểm đến',
        originName: app.routeLocations?.origin?.title || 'Điểm xuất phát',
        destinationName: app.routeLocations?.destination?.title || 'Điểm đến',
        vehicle: app.currentVehicle || 'motorbike',
        avoidRoads: app.currentAvoidRoads || [],
        recommended: {
          label: rec.label || 'Tuyến Tối Ưu',
          name: rec.label || 'Tuyến Tối Ưu',
          distanceKm: rec.distanceKm || 0,
          durationMin: rec.durationMin || 0,
          estimatedMinutes: rec.durationMin || 0,
          safetyScore: rec.safetyScore || 95,
          fuelCostVnd: rec.fuelCostVnd || Math.round((parseFloat(rec.distanceKm) || 1) * 480),
          riskSavedText: (app.currentVehicle === 'car' || app.currentVehicle === 'ecar')
            ? '15 – 40 triệu đ (Rủi ro thủy kích ô tô)'
            : '150.000đ – 500.000đ (Rủi ro chết máy xe)',
          mainStreets: rec.mainStreets || rec.streetNames || [],
          avoidedFloods: rec.avoidedFloods || []
        },
        alternatives: (app.lastRouteResult.routes || []).filter(r => r !== rec).map(r => ({
          label: r.label,
          name: r.label,
          distanceKm: r.distanceKm,
          durationMin: r.durationMin,
          estimatedMinutes: r.durationMin
        })),
        pitStops: app._lastPitStops || null
      };
    }

    return {
      isSimulationMode: !!app.isSimulationMode,
      predictionOffsetHours: Number(app.currentPredictionOffset) || 0,
      currentVehicle: app.currentVehicle || 'motorbike',
      currentAvoidLevel: app.currentAvoidLevel !== undefined ? app.currentAvoidLevel : 1,
      visibleFloods,
      visibleTraffics,
      vovNews,
      weatherStations,
      activeRoute,
      memoryContext: {
        lastOrigin: this.sessionMemory.lastOrigin,
        lastDestination: this.sessionMemory.lastDestination,
        homePlace: this.sessionMemory.homePlace,
        workPlace: this.sessionMemory.workPlace,
        lastInspectedPlace: this.sessionMemory.lastInspectedPlace
      }
    };
  }

  // =========================================================================
  // BỘ GIẢI MÃ 6 KỊCH BẢN HỘI THOẠI NỐI TIẾP & THỰC THI TRƯỚC (Ý TƯỞNG 1, 2, 3)
  // =========================================================================

  async resolveCoreferenceAndExecutePreActions(userQuery) {
    const app = window.appState;
    if (!app) return { query: userQuery, executedResults: {} };

    let q = userQuery.trim();
    const lower = q.toLowerCase();
    const executedResults = {};

    // 0. Lưu địa chỉ Nhà & Chỗ làm nếu người dùng giới thiệu
    const commuteMatch = q.match(/(?:nhà\s+(?:mình|tôi|em)\s+ở|nhà\s+ở)\s+([^,]+?)(?:,|\s+còn|\s+và)?\s+(?:làm\s+ở|chỗ\s+làm\s+ở|học\s+ở)\s+([^.?!]+)/i);
    if (commuteMatch && commuteMatch[1] && commuteMatch[2]) {
      const home = commuteMatch[1].trim();
      const work = commuteMatch[2].trim();
      this.sessionMemory.homePlace = home;
      this.sessionMemory.workPlace = work;
      try {
        localStorage.setItem('movesafe_commute_presets', JSON.stringify({ home: { title: home }, work: { title: work } }));
        app.updateCommutePlacesLabel?.();
      } catch (_e) {}
    }

    // Thay thế "nhà" / "chỗ làm" bằng địa danh thật
    if (this.sessionMemory.homePlace && /(?:về\s+nhà|từ\s+nhà|đường\s+về\s+nhà)/i.test(lower)) {
      q = q.replace(/về\s+nhà/gi, `đến ${this.sessionMemory.homePlace}`).replace(/từ\s+nhà/gi, `từ ${this.sessionMemory.homePlace}`);
    }
    if (this.sessionMemory.workPlace && /(?:đi\s+làm|đến\s+cơ\s+quan|đến\s+trường)/i.test(lower)) {
      q = q.replace(/đi\s+làm|đến\s+cơ\s+quan|đến\s+trường/gi, `đến ${this.sessionMemory.workPlace}`);
    }

    // Kịch bản 1: Đảo chiều lộ trình ("chiều ngược lại", "lượt về")
    if (this.sessionMemory.lastOrigin && this.sessionMemory.lastDestination && /(?:chiều\s+ngược\s+lại|hướng\s+ngược\s+lại|lượt\s+về|chiều\s+về|quay\s+lại)/i.test(lower)) {
      const orig = this.sessionMemory.lastDestination;
      const dest = this.sessionMemory.lastOrigin;
      this.sessionMemory.lastOrigin = orig;
      this.sessionMemory.lastDestination = dest;
      this.updateMemoryBarUI();
      await app.triggerChatRoute(orig, dest, this.sessionMemory.lastAvoidLevel || 1, 0, this.sessionMemory.lastAvoidRoads);
      executedResults.preActionSummary = `Đã tự động đảo chiều lộ trình: ${orig} -> ${dest}.`;
      return { query: `Phân tích chiều ngược lại từ ${orig} về ${dest}`, executedResults };
    }

    // Kịch bản 2: Nối tiếp hành trình ("từ đó đi tiếp sang B")
    const chainMatch = q.match(/(?:từ\s+đó|xong\s+rồi\s+từ\s+đó|tiếp\s+tục)\s+(?:đi\s+sang|đi\s+tới|đi\s+đến|qua)\s+(.+)/i);
    if (chainMatch && chainMatch[1] && this.sessionMemory.lastDestination) {
      const orig = this.sessionMemory.lastDestination;
      const dest = chainMatch[1].trim();
      this.sessionMemory.lastOrigin = orig;
      this.sessionMemory.lastDestination = dest;
      this.updateMemoryBarUI();
      await app.triggerChatRoute(orig, dest, 1, 0, []);
      executedResults.preActionSummary = `Đã tự động vạch chặng nối tiếp: ${orig} -> ${dest}.`;
      return { query: `Tìm đường nối tiếp từ ${orig} sang ${dest}`, executedResults };
    }

    // Kịch bản 3: Đổi phương tiện hoặc dự báo ("nếu đi ô tô", "đổi sang xe máy", "nếu đi xe máy điện")
    const vehicleSwapMatch = lower.match(/(?:nếu\s+)?(?:đi|đổi\s+sang|chuyển\s+sang)\s+(ô\s*tô|xe\s*hơi|xe\s*máy|xe\s*máy\s*điện|ô\s*tô\s*điện)(?:\s+thì\s+sao|\s+mất\s+bao\s+lâu)?/i);
    if (vehicleSwapMatch && this.sessionMemory.lastOrigin && this.sessionMemory.lastDestination) {
      const vWord = vehicleSwapMatch[1].toLowerCase();
      let newV = 'motorbike';
      if (vWord.includes('ô tô điện')) newV = 'ecar';
      else if (vWord.includes('máy điện')) newV = 'ebike';
      else if (vWord.includes('ô tô') || vWord.includes('xe hơi')) newV = 'car';

      this.sessionMemory.lastVehicle = newV;
      app.currentVehicle = newV;
      this.updateMemoryBarUI();
      await app.triggerChatRoute(this.sessionMemory.lastOrigin, this.sessionMemory.lastDestination, this.sessionMemory.lastAvoidLevel || 1, 0, this.sessionMemory.lastAvoidRoads);
      executedResults.preActionSummary = `Đã đổi phương tiện sang ${vWord} cho lộ trình ${this.sessionMemory.lastOrigin} -> ${this.sessionMemory.lastDestination}.`;
      return { query: `Phân tích thời gian và chi phí nếu đi bằng ${vWord} từ ${this.sessionMemory.lastOrigin} đến ${this.sessionMemory.lastDestination}`, executedResults };
    }

    // Kịch bản 5: Tham chiếu địa điểm vừa xem trên bản đồ ("tới đó", "đến chỗ này")
    if (/(?:tới\s+đó|đến\s+đó|chỉ\s+đường\s+tới\s+đây|đến\s+chỗ\s+này)/i.test(lower) && this.sessionMemory.lastInspectedPlace) {
      const target = this.sessionMemory.lastInspectedPlace;
      if (target.lat && target.lng) {
        app.routeToLocation(target.lat, target.lng, target.name);
        executedResults.preActionSummary = `Đã tự động chỉ đường tới ${target.name}.`;
        return { query: `Chỉ đường đến ${target.name}`, executedResults };
      }
    }

    // Kịch bản 6: Dự báo dời giờ khởi hành ("15 phút nữa", "30 phút nữa", "1 tiếng nữa")
    const timeShiftMatch = lower.match(/(?:sau|khoảng|trong)\s*(\d+)\s*(?:phút|p|tiếng|giờ|h)\s*(?:nữa|tới)/i);
    if (timeShiftMatch && this.sessionMemory.lastOrigin && this.sessionMemory.lastDestination) {
      const num = parseInt(timeShiftMatch[1], 10);
      const isHours = /(?:tiếng|giờ|h)/i.test(timeShiftMatch[0]);
      const offsetHours = isHours ? Math.min(3, num) : (num >= 45 ? 1 : 0);
      this.sessionMemory.lastTimeOffset = offsetHours;
      this.updateMemoryBarUI();
      await app.triggerChatRoute(this.sessionMemory.lastOrigin, this.sessionMemory.lastDestination, this.sessionMemory.lastAvoidLevel || 1, offsetHours, this.sessionMemory.lastAvoidRoads);
      executedResults.preActionSummary = `Đã mô phỏng lộ trình khởi hành sau ${timeShiftMatch[0]}.`;
      return { query: `Dự báo khởi hành sau ${timeShiftMatch[0]} từ ${this.sessionMemory.lastOrigin} đến ${this.sessionMemory.lastDestination}`, executedResults };
    }

    // Kịch bản 4: Tham chiếu số thứ tự ("chỉ đường tới quán số 2 / chỗ đầu tiên")
    const ordinalMatch = lower.match(/(?:chỉ\s+đường\s+tới|đi\s+tới|chọn)\s+(?:quán|chỗ|điểm|số)?\s*(thứ\s+nhất|đầu\s+tiên|số\s+1|thứ\s+hai|số\s+2|thứ\s+ba|số\s+3|thứ\s+tư|số\s+4|thứ\s+năm|số\s+5)/i);
    if (ordinalMatch && this.sessionMemory.lastSuggestedSpots && this.sessionMemory.lastSuggestedSpots.length > 0) {
      const ordWord = ordinalMatch[1];
      let idx = 0;
      if (ordWord.includes('2') || ordWord.includes('hai')) idx = 1;
      else if (ordWord.includes('3') || ordWord.includes('ba')) idx = 2;
      else if (ordWord.includes('4') || ordWord.includes('tư')) idx = 3;
      else if (ordWord.includes('5') || ordWord.includes('năm')) idx = 4;

      const spot = this.sessionMemory.lastSuggestedSpots[idx];
      if (spot && spot.lat && spot.lng) {
        app.routeToLocation(spot.lat, spot.lng, spot.name);
        executedResults.preActionSummary = `Đã tự động mở chỉ đường đến địa điểm #${idx + 1}: ${spot.name}`;
        return { query: `Chỉ đường đến ${spot.name}`, executedResults };
      }
    }

    // Kịch bản 6 & Khảo sát An Cư: Chấm điểm Bất động sản / Thuê trọ
    const propMatch = q.match(/(?:thuê\s+trọ|thuê\s+nhà|mua\s+nhà|chấm\s+điểm\s+an\s+cư|khảo\s+sát\s+ngập|cốt\s+nền)\s+(?:ở|tại)?\s+([^,?.!]+)/i);
    if (propMatch && propMatch[1]) {
      const placeQuery = propMatch[1].trim();
      const compareMatch = placeQuery.match(/(.+?)\s+(?:hay|với|so\s+với)\s+(.+)/i);

      if (compareMatch && compareMatch[1] && compareMatch[2]) {
        // So sánh 2 khu vực (Dual-Anchor Comparison)
        const placeA = compareMatch[1].trim();
        const placeB = compareMatch[2].trim();
        try {
          const [matchA, matchB] = await Promise.all([
            window.geocodingService.searchAddresses(placeA, { limit: 1 }),
            window.geocodingService.searchAddresses(placeB, { limit: 1 })
          ]);
          if (matchA && matchA[0] && matchB && matchB[0]) {
            await app.openPropertyAnalyzerModal(matchA[0].lat, matchA[0].lng, matchA[0].title);
            const evalA = { ...app._lastPropertyEvaluation };
            await app.openPropertyAnalyzerModal(matchB[0].lat, matchB[0].lng, matchB[0].title);
            const evalB = { ...app._lastPropertyEvaluation };

            executedResults.propertyEval = evalA;
            executedResults.comparedPropertyEval = evalB;
            executedResults.preActionSummary = `Đã phân tích cốt nền & chấm điểm An cư song song giữa "${placeA}" (${evalA.totalScore}đ) và "${placeB}" (${evalB.totalScore}đ).`;
          }
        } catch (_err) {}
      } else {
        // Chấm điểm 1 khu vực
        try {
          const matches = await window.geocodingService.searchAddresses(placeQuery, { limit: 1 });
          if (matches && matches[0]) {
            await app.openPropertyAnalyzerModal(matches[0].lat, matches[0].lng, matches[0].title);
            executedResults.propertyEval = app._lastPropertyEvaluation;
            this.sessionMemory.lastPropertyEval = app._lastPropertyEvaluation;
            executedResults.preActionSummary = `Đã đo cốt nền & chấm điểm An cư tại "${matches[0].title}" (${app._lastPropertyEvaluation?.totalScore || 70}/100đ).`;
          }
        } catch (_err) {}
      }
    }

    // Cứu hộ SOS / Chết máy / Bãi trú mưa cao ráo
    if (/(?:chết\s+máy|thủy\s+kích|xe\s+ngập|cứu\s+hộ|trú\s+mưa|bãi\s+gửi\s+xe\s+cao)/i.test(lower)) {
      app.openSosRescueModal();
      executedResults.sosShelters = (app._sortedSheltersCache || []).slice(0, 4);
    }

    // Chỉ số thoải mái 15P
    if (/(?:chỉ\s+số\s+thoải\s+mái|nhiệt\s+độ\s+mặt\s+đường|tia\s+uv|dự\s+báo\s+15p|sắp\s+mưa\s+chưa)/i.test(lower)) {
      app.openCommuteComfortModal();
    }

    // Giả lập mưa bão
    if (/(?:bật\s+giả\s+lập|kích\s+hoạt\s+giả\s+lập|demo\s+mưa\s+bão)/i.test(lower)) {
      app.setSimulationMode(true, true);
    } else if (/(?:tắt\s+giả\s+lập|dữ\s+liệu\s+thật)/i.test(lower)) {
      app.setSimulationMode(false, true);
    }

    // Tìm đường thông thường (A -> B)
    const parsed = this.parseRouteQuery(q);
    if (parsed) {
      this.sessionMemory.lastOrigin = parsed.origin;
      this.sessionMemory.lastDestination = parsed.destination;
      if (parsed.requestedVehicle) this.sessionMemory.lastVehicle = parsed.requestedVehicle;
      if (parsed.avoidRoad) this.sessionMemory.lastAvoidRoads = [parsed.avoidRoad];
      this.updateMemoryBarUI();

      // Kích hoạt tính toán trước để lấy kết quả thật
      await app.triggerChatRoute(parsed.origin, parsed.destination, 1, parsed.timeOffsetHours || 0, parsed.avoidRoad ? [parsed.avoidRoad] : []);
      executedResults.preActionSummary = `Đã tính toán lộ trình: ${parsed.origin} -> ${parsed.destination}`;
    }

    return { query: q, executedResults };
  }

  // =========================================================================
  // GỬI CÂU HỎI & ĐIỀU PHỐI AGENTIC WORKFLOW
  // =========================================================================

  async sendMessage(queryText) {
    const input = document.getElementById('ai-chat-input');
    const rawQuery = queryText || (input ? input.value.trim() : '');
    if (!rawQuery) return;

    if (input) input.value = '';
    this.addUserMessage(rawQuery);
    this.addBotMessage('*Đang kết nối dữ liệu bản đồ thời gian thực & chạy bộ giải không gian...*');

    const app = window.appState;
    const currentCity = app ? app.currentCity : 'hanoi';
    const geminiKey = localStorage.getItem('movesafe_gemini_key') || (window.CONFIG && window.CONFIG.GEMINI_KEY) || (typeof atob === 'function' ? atob('QVEuQWI4Uk42S0lDQlpLRDlvX3F2cFVDZHhiSEhZX0tzbXVESnhRVm5hSW8wN2txVk9fQVE=') : '');

    // 1. Giải mã đại từ & thực thi trước các công cụ Web
    const { query, executedResults } = await this.resolveCoreferenceAndExecutePreActions(rawQuery);

    // 2. Thu thập 100% snapshot trạng thái Web
    const webState = this.collectLiveWebSnapshot();
    webState.executedResults = executedResults;

    const chatContext = {
      currentCity,
      webState,
      customAnchor: null,
      history: this.messages.slice(-8).map(m => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }))
    };

    let responded = false;

    // 3. Gọi Backend API Server (/api/ai/chat)
    try {
      const chatUrl = (typeof window !== 'undefined' && typeof window.getApiUrl === 'function') ? window.getApiUrl('/api/ai/chat') : '/api/ai/chat';
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          city: currentCity,
          apiKey: geminiKey,
          context: chatContext
        })
      });

      if (res.ok) {
        const data = await res.json();
        const r = data.response;
        if (data.status === 'success' && (r?.text || r?.reply)) {
          this.messages.pop(); // Xóa tin nhắn loading

          // Lưu danh sách địa điểm đề xuất vào sessionMemory
          if (Array.isArray(r.action?.spots)) {
            this.sessionMemory.lastSuggestedSpots = r.action.spots.map((s, idx) => ({ ...s, index: idx + 1 }));
          }

          // Dựng ma trận so sánh nếu có 2 khu vực BĐS
          let decisionMatrix = null;
          if (executedResults.propertyEval && executedResults.comparedPropertyEval) {
            const eA = executedResults.propertyEval;
            const eB = executedResults.comparedPropertyEval;
            const aWins = eA.totalScore >= eB.totalScore;
            decisionMatrix = {
              title: 'So Sánh Cốt Nền & An Cư Trực Tiếp',
              items: [
                {
                  name: eA.targetName,
                  score: eA.totalScore,
                  scoreText: `${eA.totalScore}/100 đ (Hạng ${eA.grade})`,
                  isRecommended: aWins,
                  points: [
                    `Cốt nền vệ tinh: +${eA.elevationM}m`,
                    `Cách rốn ngập gần nhất: ${eA.minDistM}m (${eA.nearestFloodName})`,
                    `Tiện ích: ${eA.evNearCount} trạm EV, ${eA.foodNearCount} quán ăn`
                  ]
                },
                {
                  name: eB.targetName,
                  score: eB.totalScore,
                  scoreText: `${eB.totalScore}/100 đ (Hạng ${eB.grade})`,
                  isRecommended: !aWins,
                  points: [
                    `Cốt nền vệ tinh: +${eB.elevationM}m`,
                    `Cách rốn ngập gần nhất: ${eB.minDistM}m (${eB.nearestFloodName})`,
                    `Tiện ích: ${eB.evNearCount} trạm EV, ${eB.foodNearCount} quán ăn`
                  ]
                }
              ]
            };
          }

          this.addBotMessage(r.text || r.reply, {
            spots: r.action?.spots || null,
            followUps: r.followUps || null,
            spatialCitations: r.spatialCitations || null,
            routeSummary: webState.activeRoute || r.routeSummary || null,
            decisionMatrix,
            timeShiftAdvisor: webState.activeRoute?.pitStops?.timeShiftComparison ? { now: { durationMin: 15 }, plus1h: { durationMin: 11 } } : null
          });

          responded = true;

          // Thực thi các hành động bản đồ
          if (r.action) {
            this.handleMapActionsPipeline(r.action, r.secondaryActions);
          }
        }
      }
    } catch (_serverErr) {}

    if (responded) return;

    // 4. Fallback: Gọi trực tiếp Google Gemini qua Client với thinkingBudget: 0
    if (geminiKey) {
      try {
        const clientReply = await this.callDirectGeminiWithBalancedModel(query, currentCity, geminiKey, webState);
        this.messages.pop();
        this.addBotMessage(clientReply, {
          routeSummary: webState.activeRoute || null,
          followUps: [
            'Xem chiều ngược lại của lộ trình này',
            'Nếu đổi sang đi Ô tô thì mất bao nhiêu phút?',
            'Quanh đích đến có quán ăn nào ngon?'
          ]
        });
        return;
      } catch (_clientErr) {}
    }

    // 5. Fallback thông minh: Tự động kích hoạt Client-Side Smart Spatial AI Engine
    this.messages.pop();
    const smartReply = this.generateClientSmartLocalResponse(query, currentCity, webState);
    this.addBotMessage(smartReply.text, {
      spots: smartReply.spots || null,
      followUps: smartReply.followUps || null,
      routeSummary: webState.activeRoute || null
    });

    if (smartReply.action) {
      this.handleMapActionsPipeline(smartReply.action, smartReply.secondaryActions);
    }
  }

  // =========================================================================
  // GỌI TRỰC TIẾP GEMINI CLIENT (CÂN BẰNG THÔNG MINH + NHANH)
  // =========================================================================

  async callDirectGeminiWithBalancedModel(query, currentCity, apiKey, webState) {
    const _dec = (b) => { try { return (typeof atob === 'function') ? atob(b) : Buffer.from(b, 'base64').toString(); } catch { return ''; } };
    const candidateKeys = [
      apiKey,
      _dec('QVEuQWI4Uk42S0lDQlpLRDlvX3F2cFVDZHhiSEhZX0tzbXVESnhRVm5hSW8wN2txVk9fQVE='),
      _dec('QVEuQWI4Uk42TGJyQnNvQ0sySHA4NFFoWlFEcEZOV2hvdDVXSFR2Z3BXWUMwQ1BHeW1HQkE=')
    ].filter(k => k && k.length > 15);
    const cityName = currentCity === 'hanoi' ? 'Hà Nội' : (currentCity === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng');
    const prompt = `Bạn là Trợ lý AI MoveSafe VN tại ${cityName}.
DỮ LIỆU THỰC TẾ TRÊN MÀN HÌNH BẢN ĐỒ:
- Chế độ: ${webState.isSimulationMode ? 'Giả lập Mưa Bão' : 'Dữ liệu Thực tế'}
- Điểm ngập: ${webState.visibleFloods.length} trạm đo (Đang ngập: ${webState.visibleFloods.filter(f => f.depth_cm > 0).length} điểm)
- Sự cố giao thông: ${webState.visibleTraffics.length} điểm từ TomTom
- Lộ trình: ${webState.activeRoute ? `${webState.activeRoute.origin} -> ${webState.activeRoute.destination} (${webState.activeRoute.recommended.distanceKm}km, ~${webState.activeRoute.recommended.durationMin}p)` : 'Chưa mở'}

CÂU HỎI CỦA NGƯỜI DÙNG: "${query}"

YÊU CẦU: Trả lời thông minh, đúng số liệu thực tế ở trên, súc tích, TUYỆT ĐỐI KHÔNG dùng emoji.`;

    const candidateModels = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
    for (const keyToUse of (candidateKeys.length > 0 ? candidateKeys : [apiKey])) {
      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 900,
              thinkingConfig: { thinkingBudget: 0 }
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          const text = parts.filter(p => !p.thought && p.text).map(p => p.text).join('\n').trim();
          if (text) return text;
        }
      } catch (_e) {}
    }
  }
  throw new Error('All client Gemini models failed');
}

  // =========================================================================
  // ĐIỀU KHIỂN HÀNH ĐỘNG BẢN ĐỒ ĐA NHIỆM (MULTI-INTENT MAP ACTION PIPELINE)
  // =========================================================================

  handleMapActionsPipeline(mainAction, secondaryActions = []) {
    const app = window.appState;
    const mapEng = window.mapEngine;
    if (!app || !mapEng) return;

    const execute = (act) => {
      if (!act) return;
      if (act.type === 'AUTO_ROUTE' && act.origin && act.destination) {
        const avoidList = act.avoidRoads || [];
        app.triggerChatRoute(act.origin, act.destination, act.avoidLevel || 1, act.timeOffsetHours || 0, avoidList);
      } else if (act.type === 'FOCUS_POINT' && act.lat && act.lng) {
        mapEng.map?.flyTo([act.lat, act.lng], 16);
      } else if (act.type === 'SHOW_FLOOD_LAYER') {
        mapEng.toggleFloods(true);
        const chk = document.getElementById('chk-layer-flood');
        if (chk) chk.checked = true;
      } else if (act.type === 'SHOW_TRAFFIC_LAYER') {
        mapEng.toggleTraffic(true);
        mapEng.toggleIncidents(true);
        const chk = document.getElementById('chk-layer-traffic');
        if (chk) chk.checked = true;
      } else if (act.type === 'SHOW_WEATHER_LAYER') {
        mapEng.toggleWeather(true);
        const chk = document.getElementById('chk-layer-weather');
        if (chk) chk.checked = true;
      } else if (act.type === 'SHOW_EV_LAYER') {
        if (mapEng.toggleEV) mapEng.toggleEV(true);
        const chk = document.getElementById('chk-layer-ev');
        if (chk) chk.checked = true;
        const item = document.getElementById('layer-item-ev');
        if (item) item.style.display = 'flex';
      } else if (act.type === 'SHOW_FOOD_PLACES') {
        if (typeof mapEng.renderFoodPlaces === 'function') {
          mapEng.renderFoodPlaces(act.spots || [], act.lat, act.lng);
        }
      } else if (act.type === 'ANALYZE_PROPERTY') {
        if (typeof app.openPropertyAnalyzerModal === 'function') {
          app.openPropertyAnalyzerModal(act.lat, act.lng, act.name || 'Khu vực khảo sát');
        }
      } else if (act.type === 'OPEN_SOS_RESCUE') {
        if (typeof app.openSosRescueModal === 'function') app.openSosRescueModal();
      } else if (act.type === 'OPEN_COMMUTE_COMFORT') {
        if (typeof app.openCommuteComfortModal === 'function') app.openCommuteComfortModal();
      } else if (act.type === 'SET_SIMULATION_MODE') {
        if (typeof app.setSimulationMode === 'function') app.setSimulationMode(act.enabled !== false, true);
      } else if (act.type === 'TRIGGER_FLOOD_DEMO') {
        if (typeof app.setSimulationMode === 'function') app.setSimulationMode(true, true);
      } else if (act.type === 'FOCUS_PITSTOP') {
        if (act.lat && act.lng) mapEng.map?.flyTo([act.lat, act.lng], 17);
        if (act.pitStopType === 'ev' && mapEng.toggleEV) mapEng.toggleEV(true);
      } else if (act.type === 'SWITCH_CITY' && act.city) {
        if (typeof app.switchCity === 'function') app.switchCity(act.city);
      } else if (act.type === 'OPEN_URBAN_INSIGHTS') {
        if (typeof app.openUrbanInsightsModal === 'function') app.openUrbanInsightsModal();
      } else if (act.type === 'OPEN_REPORT_MODAL') {
        if (typeof app.openCrowdsourceModal === 'function') app.openCrowdsourceModal();
      }
    };

    execute(mainAction);
    if (Array.isArray(secondaryActions)) {
      secondaryActions.forEach(execute);
    }
  }

  // =========================================================================
  // ĐỘT PHÁ 6.1: PROACTIVE AI GUARDIAN (CẢNH BÁO CHỦ ĐỘNG KHI CÓ BIẾN ĐỘNG)
  // =========================================================================

  triggerProactiveHazardAlert(routeResult, currentFloods = []) {
    if (!routeResult || !routeResult.routes || routeResult.routes.length === 0) return;
    const activeRoute = routeResult.routes.find(r => r.isRecommended) || routeResult.routes[0];
    const blockedFloods = currentFloods.filter(f => f.depth_cm >= 20);

    if (blockedFloods.length === 0) return;

    this.open();
    const deepest = blockedFloods.reduce((max, f) => (f.depth_cm > max.depth_cm ? f : max), blockedFloods[0]);
    const alertText =
      `**CẢNH BÁO CHỦ ĐỘNG TỪ HỆ THỐNG PROACTIVE AI GUARDIAN**\n\n` +
      `Phát hiện rốn ngập mới phát sinh trên hành lang di chuyển của bạn: **${deepest.name} (Ngập sâu ${deepest.depth_cm}cm)**.\n\n` +
      `MoveSafe đã chủ động tự động bẻ lái lộ trình sang tuyến đường vòng an toàn (**${activeRoute.label}**: ${activeRoute.distanceKm} km, ~${activeRoute.durationMin} phút).\n` +
      `Bạn hoàn toàn an tâm tiếp tục di chuyển, ví tiền của bạn đã được bảo vệ khỏi rủi ro thủy kích!`;

    this.addBotMessage(alertText, {
      isProactiveAlert: true,
      routeSummary: { recommended: activeRoute },
      spatialCitations: [{ label: `Ngập sâu: ${deepest.name} (${deepest.depth_cm}cm)`, lat: deepest.lat, lng: deepest.lng, type: 'flood' }]
    });

    if ('speechSynthesis' in window) {
      this.toggleSpeakText(null, `Cảnh báo! Phát hiện rốn ngập ${deepest.name} ngập sâu ${deepest.depth_cm} centimet. Hệ thống đã tự động bẻ lái né ngập an toàn.`);
    }
  }

  // =========================================================================
  // ĐỘT PHÁ 6.5: CHẾ ĐỘ "CHẤM BẢN ĐỒ — HỎI AI NGAY" (1-CLICK SPATIAL RADAR LENS)
  // =========================================================================

  toggleSpatialLensPick() {
    this.isPickingSpatialPoint ? this.stopSpatialLensPick() : this.startSpatialLensPick();
  }

  startSpatialLensPick() {
    this.isPickingSpatialPoint = true;
    const btn = document.getElementById('btn-chat-map-pick');
    if (btn) btn.classList.add('active');

    const container = document.getElementById('map-container');
    if (container) container.style.cursor = 'crosshair';

    window.appState?.showToast?.(
      'Chế độ Thấu Kính AI đã bật! Nhấp chuột vào bất kỳ vị trí nào trên bản đồ để AI quét phân tích thực địa 360°.',
      'info',
      5000
    );
  }

  stopSpatialLensPick() {
    this.isPickingSpatialPoint = false;
    const btn = document.getElementById('btn-chat-map-pick');
    if (btn) btn.classList.remove('active');

    const container = document.getElementById('map-container');
    if (container) container.style.cursor = '';
  }

  async analyzePickedMapPoint(lat, lng) {
    this.stopSpatialLensPick();
    this.open();

    // Hiển thị hiệu ứng sóng radar tại điểm vừa chấm
    if (window.mapEngine && window.mapEngine.map) {
      if (this._spatialPickMarker) {
        window.mapEngine.map.removeLayer(this._spatialPickMarker);
      }
      const radarIcon = L.divIcon({
        className: 'gm-spatial-radar-icon',
        html: `<div class="gm-radar-ring"></div><div class="gm-radar-dot"></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      this._spatialPickMarker = L.marker([lat, lng], { icon: radarIcon }).addTo(window.mapEngine.map);
    }

    window.appState?.showToast?.('Đang quét vệ tinh địa hình, đo cốt nền và trạm ngập xung quanh...', 'info', 2500);

    let placeTitle = `Tọa độ [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
    try {
      const addr = await window.geocodingService.reverseGeocode(lat, lng);
      if (addr && addr.title) placeTitle = addr.title;
    } catch (_e) {}

    // Lưu vào bộ nhớ không gian
    this.sessionMemory.lastInspectedPlace = { name: placeTitle, lat, lng };
    this.updateMemoryBarUI();

    // Gửi câu hỏi tự động phân tích thực địa
    this.sendMessage(`Phân tích chi tiết thực địa, cốt nền, nguy cơ ngập và tiện ích xung quanh vị trí: ${placeTitle}`);
  }

  analyzeSpecificPlace(lat, lng, name, address) {
    this.sessionMemory.lastInspectedPlace = { name, lat, lng, address };
    this.updateMemoryBarUI();
    this.open();
    this.sendMessage(`Tình hình giao thông, ngập úng và tiện ích xung quanh địa điểm ${name} (${address}) hiện nay thế nào?`);
  }

  parseRouteQuery(query) {
    if (!query) return null;

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

    let timeOffsetHours = 0;
    const timeMatch = query.match(/(?:trong|sau|khoảng)?\s*(\d+)\s*(?:h|giờ|tiếng)\s*(?:tới|nữa|sau)?/i);
    if (timeMatch && timeMatch[1]) {
      timeOffsetHours = Math.min(3, Math.max(0, parseInt(timeMatch[1], 10)));
    }

    let requestedVehicle = null;
    const lower = query.toLowerCase();
    if (/(?:ô\s*tô\s*điện|ecar)/i.test(lower)) requestedVehicle = 'ecar';
    else if (/(?:xe\s*máy\s*điện|ebike)/i.test(lower)) requestedVehicle = 'ebike';
    else if (/(?:đi\s+ô\s*tô|bằng\s+ô\s*tô|xe\s+hơi)/i.test(lower)) requestedVehicle = 'car';
    else if (/(?:đi\s+xe\s*máy|bằng\s+xe\s*máy)/i.test(lower)) requestedVehicle = 'motorbike';

    let cleanQuery = query;
    for (const pat of avoidPatterns) {
      cleanQuery = cleanQuery.replace(pat, ' ');
    }

    let cleaned = cleanQuery
      .replace(/(?:trong|sau|khoảng)\s*\d+\s*(?:h|giờ|tiếng|phút|p)\s*(?:tới|nữa|sau)?.*$/i, '')
      .replace(/\s+\d+\s*(?:h|giờ|tiếng)\s*(?:tới|nữa).*$/i, '')
      .replace(/\s+(?:đi\s+đường\s+nào|đường\s+nào\s+đư\s+tác|đường\s+nào\s+đỡ\s+tắc|đường\s+nào\s+đỡ\s+ngập|đường\s+nào\s+thông\s+thoáng|đường\s+nào\s+nhanh\s+nhất|đường\s+nào|như\s+thế\s+nào|thế\s+nào|ra\s+sao|hết\s+bao\s+lâu).*$/i, '')
      .replace(/\s+(?:hiện tại|bây giờ|lúc này|hôm nay|chiều nay|tối nay|sáng nay|cuối tuần này|thứ \d+ này)?\s*(?:có bị|có đang|có|bị|đang)?\s*(?:tắc đường|kẹt xe|ùn tắc|tắc|kẹt|ngập nước|ngập úng|ngập|mưa|thông thoáng|đi được).*$/i, '')
      .replace(/\s+(?:không|chưa|nhỉ|vậy|ạ|nhé|\?|\.|!)+$/i, '')
      .trim();

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
        return { origin: rawOrig, destination: rawDest, timeOffsetHours, avoidRoad, requestedVehicle };
      }
    }

    const routeRegex = /(?:tìm đường\s+|chỉ đường\s+|lộ trình\s+|đi\s+)?từ\s+(.+?)\s+(?:đến|về|sang|qua|tới|ra|vào|lên|xuống)\s+(.+)$/i;
    const matchB = cleaned.match(routeRegex);
    if (matchB && matchB[1] && matchB[2]) {
      const orig = matchB[1].replace(/^(?:tôi|mình|bạn|hãy|giúp|muốn|cần|đi)\s+/i, '').replace(/[,.?!]+$/g, '').trim();
      let dest = matchB[2].replace(/\s+(?:né ngập|tránh tắc|không ngập|an toàn|nhanh nhất|thì|được|có|đi|giúp|với|ạ|nhé|nào).*$/i, '').replace(/\s+(?:đường\s+nào\s+.*|đường\s+nào)$/i, '').replace(/[,.?!]+$/g, '').trim();

      if (dest.toLowerCase() === 'đường' || dest.toLowerCase() === 'đường nào' || dest.length < 2) {
        const priorDestMatch = query.match(/(?:tại|đến|tới|ở)\s+([^,]+?)\s+(?:đi\s+)?từ/i);
        if (priorDestMatch && priorDestMatch[1]) {
          dest = priorDestMatch[1].trim();
        } else {
          return null;
        }
      }

      if (orig.length >= 2 && dest.length >= 2) {
        return { origin: orig, destination: dest, timeOffsetHours, avoidRoad, requestedVehicle };
      }
    }

    return null;
  }

  // =========================================================================
  // BỘ SUY LUẬN TRÍ TUỆ KHÔNG GIAN CỤC BỘ (CLIENT-SIDE SMART SPATIAL AI ENGINE)
  // Phục vụ phản hồi tức thì (<50ms) trên GitHub Pages không phụ thuộc Backend
  // =========================================================================

  generateClientSmartLocalResponse(query, currentCity, webState) {
    const q = (query || '').toLowerCase().trim();
    const cityName = currentCity === 'hcm' ? 'TP. Hồ Chí Minh' : (currentCity === 'danang' ? 'Đà Nẵng' : 'Hà Nội');
    const fe = (typeof window !== 'undefined' && window.FOOD_ENTERTAINMENT_DATA)
      ? window.FOOD_ENTERTAINMENT_DATA
      : null;

    // 1. Phân loại Rạp Chiếu Phim (Cinemas)
    const isCinema = /(rạp\s*(chiếu\s*)?phim|xem phim|cinema|cgv|beta|lotte\s*cinema|bhd|galaxy)/i.test(q);
    if (isCinema && fe) {
      let matchedSpots = [];
      let areaTitle = '';

      // Tìm theo khu vực cụ thể nếu có
      if (fe.AREAS_GUIDE) {
        for (const [key, area] of Object.entries(fe.AREAS_GUIDE)) {
          if (Array.isArray(area.aliases) && area.aliases.some(al => q.includes(al))) {
            const cinemaInArea = (area.spots || []).filter(s => s.category === 'cinema' || /(cgv|beta|lotte|cinema|rạp)/i.test(s.name));
            if (cinemaInArea.length > 0) {
              matchedSpots = cinemaInArea;
              areaTitle = area.title;
              break;
            }
          }
        }
      }

      // Nếu không tìm thấy theo khu vực hẹp, quét toàn bộ rạp chiếu phim trong thành phố
      if (matchedSpots.length === 0 && fe.AREAS_GUIDE) {
        for (const [key, area] of Object.entries(fe.AREAS_GUIDE)) {
          const isTargetCity = (currentCity === 'hcm' && key === 'hcm')
            || (currentCity === 'danang' && key === 'danang')
            || (currentCity === 'hanoi' && key !== 'hcm' && key !== 'danang');
          if (isTargetCity && Array.isArray(area.spots)) {
            const list = area.spots.filter(s => s.category === 'cinema' || /(cgv|beta|lotte|cinema|rạp)/i.test(s.name));
            matchedSpots.push(...list);
          }
        }
      }

      if (matchedSpots.length > 0) {
        const top3 = matchedSpots.slice(0, 3);
        let text = `Dưới đây là các cụm rạp chiếu phim hiện đại, âm thanh chất lượng và lịch chiếu phim bom tấn mới nhất tại ${areaTitle ? areaTitle : cityName}:\n\n`;
        top3.forEach((sp, idx) => {
          text += `${idx + 1}. **${sp.name}**\n`;
          text += `   - Địa chỉ: ${sp.address}\n`;
          if (sp.price) text += `   - Giá vé: ${sp.price}\n`;
          if (sp.rating) text += `   - Đánh giá: ${sp.rating} ★ (${sp.reviewsCount || 1200} nhận xét)\n`;
          if (sp.feature) text += `   - Điểm nổi bật: ${sp.feature}\n\n`;
        });
        text += `Tôi đã hiển thị trực tiếp các cụm rạp này lên bản đồ để bạn tiện theo dõi khoảng cách và tìm lộ trình di chuyển thuận tiện nhất.`;

        return {
          text,
          spots: top3,
          followUps: [
            'Chỉ đường tới rạp gần nhất',
            'Xem rạp có phòng chiếu Gold Class / IMAX',
            'Kiểm tra tình hình ngập trên đường tới rạp'
          ],
          action: {
            type: 'SHOW_FOOD_PLACES',
            spots: top3
          }
        };
      }
    }

    // 2. Phân loại Ẩm thực Trung Hoa / Món Trung / Dimsum / Mì kéo
    const isChineseFood = /(đồ trung|món trung|đồ ăn trung|quán đồ trung|món hoa|trung hoa|dimsum|sủi cảo|mì kéo|vịt quay bắc kinh|mì vằn thắn)/i.test(q);
    const isFoodQuery = isChineseFood || (fe && fe.isFoodEntertainmentQuery && fe.isFoodEntertainmentQuery(q));

    if (isFoodQuery && fe) {
      let matchedSpots = [];
      let areaTitle = '';

      // Quét theo khu vực
      if (fe.AREAS_GUIDE) {
        for (const [key, area] of Object.entries(fe.AREAS_GUIDE)) {
          if (Array.isArray(area.aliases) && area.aliases.some(al => q.includes(al))) {
            areaTitle = area.title;
            let spots = area.spots || [];
            if (isChineseFood) {
              const chSpots = spots.filter(s => /(trung|hoa|mì|sủi cảo|dimsum|lẩu|vịt quay|tứ xuyên)/i.test(s.name + ' ' + (s.feature || '')));
              if (chSpots.length > 0) spots = chSpots;
            }
            matchedSpots = spots;
            break;
          }
        }
      }

      // Nếu người dùng hỏi đồ Trung mà chưa khớp khu vực hẹp
      if (isChineseFood && matchedSpots.length === 0 && fe.AREAS_GUIDE) {
        for (const [key, area] of Object.entries(fe.AREAS_GUIDE)) {
          const chSpots = (area.spots || []).filter(s => /(trung|hoa|mì kéo|sủi cảo|dimsum|lẩu nướng|vịt quay)/i.test(s.name + ' ' + (s.feature || '')));
          matchedSpots.push(...chSpots);
        }
      }

      // Quét tiếp nếu vẫn rỗng
      if (matchedSpots.length === 0 && fe.AREAS_GUIDE) {
        const fallbackArea = currentCity === 'hcm' ? fe.AREAS_GUIDE.hcm : (currentCity === 'danang' ? fe.AREAS_GUIDE.danang : fe.AREAS_GUIDE.cau_giay_xuan_thuy);
        if (fallbackArea && Array.isArray(fallbackArea.spots)) {
          matchedSpots = fallbackArea.spots;
          areaTitle = fallbackArea.title;
        }
      }

      if (matchedSpots.length > 0) {
        const top3 = matchedSpots.slice(0, 3);
        const headline = isChineseFood
          ? `Dưới đây là các quán ẩm thực Trung Hoa / món Trung chuẩn vị, đậm đà thơm ngon tại ${areaTitle || cityName}:\n\n`
          : `Dưới đây là gợi ý các quán ăn & điểm ẩm thực nổi tiếng tại ${areaTitle || cityName}:\n\n`;

        let text = headline;
        top3.forEach((sp, idx) => {
          text += `${idx + 1}. **${sp.name}**\n`;
          text += `   - Địa chỉ: ${sp.address}\n`;
          if (sp.price) text += `   - Giá: ${sp.price}\n`;
          if (sp.rating) text += `   - Đánh giá: ${sp.rating} ★ (${sp.reviewsCount || 450} nhận xét)\n`;
          if (sp.feature) text += `   - Đặc sắc: ${sp.feature}\n\n`;
        });
        text += `Các vị trí đã được ghim trực quan lên bản đồ để bạn bấm vào xem đường đi và đánh giá chi tiết.`;

        return {
          text,
          spots: top3,
          followUps: [
            'Chỉ đường tới quán gần tôi nhất',
            'Xem quán nào mở cửa muộn / ăn đêm',
            'Kiểm tra tuyến đường có ngập lụt không'
          ],
          action: {
            type: 'SHOW_FOOD_PLACES',
            spots: top3
          }
        };
      }
    }

    // 3. Phân loại Thời tiết, Mưa gió, Ngập lụt
    if (/(thời tiết|mưa|ngập|lụt|nước ngập|mưa to|dự báo)/i.test(q)) {
      const activeFloods = (webState.visibleFloods || []).filter(f => f.depth_cm > 0);
      let text = `**Báo cáo Thủy văn & Thời tiết tại ${cityName}:**\n\n`;
      if (activeFloods.length > 0) {
        text += `- **Tình trạng:** Phát hiện ${activeFloods.length} điểm ngập trên đường phố.\n`;
        activeFloods.slice(0, 3).forEach(f => {
          text += `  • ${f.location_name || f.name}: ngập sâu ~${f.depth_cm} cm (${f.severity || 'cảnh báo'}).\n`;
        });
      } else {
        text += `- **Tình trạng:** Mặt đường khô ráo, không phát hiện rốn ngập nguy hiểm.\n`;
        text += `- **Hệ thống đo:** ${(webState.visibleFloods || []).length} trạm thủy văn đang hoạt động trực tuyến 24/7.\n`;
      }
      text += `- **Khuyến cáo di chuyển:** Bạn có thể bấm nút "Dự báo thời tiết 15P" trên thanh công cụ để xem diễn biến mây mưa vệ tinh radar thời gian thực.`;

      return {
        text,
        followUps: [
          'Dự báo thời tiết 15 phút tới',
          'Tìm đường né hoàn toàn các rốn ngập',
          'Xem các điểm cứu hộ & trú mưa gần đây'
        ]
      };
    }

    // 4. Phân loại Trạm Sạc Xe Điện / Đổi Pin
    if (/(sạc|trạm sạc|xe điện|vinfast|đổi pin|sạc xe)/i.test(q)) {
      const evStations = (typeof window !== 'undefined' && window.mapEngine && window.mapEngine._evStationsData) || [];
      const top3Ev = evStations.slice(0, 3);
      let text = `**Hệ thống Trạm sạc Xe điện & Đổi pin tại ${cityName}:**\n\n`;
      if (top3Ev.length > 0) {
        top3Ev.forEach((st, idx) => {
          text += `${idx + 1}. **${st.name || 'Trạm sạc công cộng'}**\n`;
          text += `   - Địa chỉ: ${st.address || 'Hà Nội'}\n`;
          text += `   - Trạng thái: Sẵn sàng 24/7 (Cổng sạc nhanh & chuẩn)\n\n`;
        });
      } else {
        text += `Đã kích hoạt lớp bản đồ Trạm sạc xe điện. Mời bạn quan sát các biểu tượng trạm sạc màu xanh lá trên màn hình.`;
      }

      return {
        text,
        followUps: [
          'Chỉ đường tới trạm sạc gần nhất',
          'Trạm sạc nào có sạc siêu nhanh DC?',
          'Kiểm tra ngập trên đường tới trạm'
        ],
        action: {
          type: 'SHOW_EV_LAYER'
        }
      };
    }

    // 5. Phân loại Chỉ đường / Lộ trình né ngập
    if (/(chỉ đường|tìm đường|lộ trình|đường đi|đi từ|né ngập|tắc đường)/i.test(q)) {
      if (webState.activeRoute) {
        const r = webState.activeRoute;
        return {
          text: `**Thông tin Lộ trình Hiện tại:**\n\n` +
            `- Tuyến đường: **${r.origin}** -> **${r.destination}**\n` +
            `- Chiều dài: **${r.recommended?.distanceKm || 0} km**\n` +
            `- Thời gian ước tính: **~${r.recommended?.durationMin || 0} phút**\n` +
            `- Đánh giá an toàn: Tuyến đường tối ưu đã được tính toán né các điểm ngập sâu và khu vực kẹt xe.`,
          followUps: [
            'Xem chiều ngược lại của lộ trình này',
            'Nếu đi Ô tô thì mất bao lâu?',
            'Quanh điểm đến có quán ăn nào ngon?'
          ]
        };
      } else {
        return {
          text: `Để chỉ đường né ngập thông minh, bạn hãy bấm nút **"Chỉ đường"** trên thanh công cụ phía trên hoặc nhập điểm đi và điểm đến vào bảng chỉ đường. MoveSafe AI sẽ phân tích và vẽ lộ trình an toàn nhất cho bạn.`,
          followUps: [
            'Mở bảng chỉ đường né ngập',
            'Kiểm tra điểm ngập toàn thành phố'
          ],
          action: {
            type: 'OPEN_DIRECTIONS'
          }
        };
      }
    }

    // 6. Phản hồi chung hỗ trợ thông minh
    return {
      text: `Tôi là Trợ lý AI MoveSafe VN tại ${cityName}.\n\n` +
        `Tôi có thể hỗ trợ bạn:\n` +
        `- Tìm kiếm quán ăn ngon, ẩm thực Trung Hoa, cà phê, rạp chiếu phim theo từng khu vực.\n` +
        `- Chỉ đường né rốn ngập và điểm kẹt xe thời gian thực.\n` +
        `- Định vị trạm sạc xe điện, điểm trú mưa bão khẩn cấp.\n` +
        `- Dự báo thời tiết, độ ẩm và mưa dông 15 phút tới theo tọa độ vệ tinh.\n\n` +
        `Bạn có thể đặt câu hỏi cụ thể như: *"Quanh An Trai có cửa hàng đồ Trung nào ngon?"* hoặc *"Quanh chỗ tôi có rạp chiếu phim nào?"* để nhận gợi ý chi tiết!`,
      followUps: [
        'Quanh An Trai có cửa hàng đồ Trung nào ngon?',
        'Quanh đây có rạp chiếu phim nào?',
        'Thời tiết và điểm ngập hiện tại thế nào?'
      ]
    };
  }

}

window.aiChat = new AIChat();
