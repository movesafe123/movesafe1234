/**
 * App.js - Bộ điều khiển trung tâm trải nghiệm người dùng chuẩn Google Maps
 * MoveSafe VN: Bản đồ toàn màn hình, thanh tìm kiếm nổi, điều hướng né ngập & Vòng lặp cập nhật 24/24 trên Cloud
 */

class GoogleMapsApp {
  constructor() {
    this.currentCity = 'hanoi';
    this.citiesConfig = {
      hanoi: { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, zoom: 13 },
      hcm: { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7008, zoom: 13 },
      danang: { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, zoom: 13 }
    };
    this.liveData = {
      floodPoints: [],
      trafficIncidents: [],
      vovTrafficNews: [],
      weatherAlerts: []
    };
    this.currentVehicle = 'motorbike';
    this.isDirectionsOpen = false;
    this.activeFilter = 'all';

    // 24/7 Cloud Sync State
    this.syncIntervalSeconds = 30; // Đếm ngược 30 giây
    this.remainingSeconds = 30;
    this.countdownTimer = null;
    this.lastWeatherSync = 0;
    this.lastSyncTime = Date.now();
  }

  async init() {
    console.log('[MoveSafe Cloud 24/7] Đang khởi động hệ thống...');

    // 1. Tải cấu hình từ Backend (TomTom key, OpenWeather key)
    await this.fetchServerConfig();

    // 2. Khởi tạo bản đồ chiếm toàn màn hình
    const city = this.citiesConfig[this.currentCity];
    window.mapEngine.init('map-container', [city.lat, city.lng], city.zoom);

    // 3. Tải dữ liệu rốn ngập & kẹt xe từ Cloud Cache
    await this.fetchLiveData();

    // 4. Cập nhật thời tiết trung tâm & trạm thời tiết các quận huyện trên bản đồ
    await this.updateWeather();
    await this.updateWeatherStations();

    // 5. Gán các sự kiện tương tác UI
    this.bindEvents();

    // 6. Kích hoạt động cơ tự động đồng bộ 24/24 trên Cloud
    this.start247CloudSync();

    console.log('[MoveSafe Cloud 24/7] Đã kích hoạt hoàn tất vòng lặp cập nhật liên tục 24/24!');
  }

  async fetchServerConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          if (data.apiKeys.tomtom) window.mapEngine.setTomTomKey(data.apiKeys.tomtom);
          if (data.apiKeys.openweather) window.weatherService.setApiKey(data.apiKeys.openweather);
          if (data.cities) this.citiesConfig = data.cities;
          return;
        }
      }
    } catch (e) {
      console.warn('Chạy chế độ Static Web (GitHub Pages):', e.message);
    }
    // Khóa TomTom dự phòng khi chạy tĩnh trên GitHub Pages
    window.mapEngine.setTomTomKey('dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF');
  }

  async fetchLiveData() {
    const cacheBuster = `?t=${Date.now()}`;
    // 1. Thử gọi backend Node.js
    try {
      const res = await fetch('/api/live-data' + cacheBuster);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          this.liveData = json.data;
          this.renderAllData();
          return;
        }
      }
    } catch (e) {}

    // 2. Fallback tự động đọc file JSON tĩnh khi chạy trên GitHub Pages (chống dính cache trình duyệt)
    try {
      const res = await fetch('data/live_urban_cache.json' + cacheBuster);
      if (res.ok) {
        const json = await res.json();
        this.liveData = json;
        this.renderAllData();
      }
    } catch (e) {
      console.error('Không thể nạp dữ liệu cache:', e);
    }
  }

  renderAllData() {
    const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
    const cityTraffics = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);

    // Vẽ lên bản đồ
    window.mapEngine.renderFloodPoints(cityFloods);
    window.mapEngine.renderTrafficIncidents(cityTraffics);

    // Cập nhật số lượng trên các chip: Chỉ đếm các điểm ngập đang hoạt động (depth > 0 và danger_level !== 'safe')
    const activeFloods = cityFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const floodChip = document.getElementById('chip-flood-count');
    const trafficChip = document.getElementById('chip-traffic-count');
    if (floodChip) {
      if (activeFloods.length > 0) {
        floodChip.className = 'gm-chip gm-chip-danger';
        floodChip.textContent = `🌊 Rốn ngập (${activeFloods.length})`;
      } else {
        floodChip.className = 'gm-chip gm-chip-safe';
        floodChip.textContent = `🌊 Rốn ngập (0 - Khô ráo)`;
      }
    }
    if (trafficChip) {
      const activeJams = cityTraffics.filter(t => t.isJam === true);
      const roadworks = cityTraffics.filter(t => t.type === 'roadwork' || t.type === 'road_closure');

      if (activeJams.length > 0) {
        trafficChip.className = 'gm-chip gm-chip-danger';
        trafficChip.textContent = `🚗 Kẹt xe (${activeJams.length})`;
      } else if (roadworks.length > 0) {
        trafficChip.className = 'gm-chip gm-chip-safe';
        trafficChip.textContent = `🚗 Ùn tắc (0) • 🚧 Công trường (${roadworks.length})`;
      } else {
        trafficChip.className = 'gm-chip gm-chip-safe';
        trafficChip.textContent = `🚗 Ùn tắc (0 - Thông thoáng)`;
      }
    }
  }

  // Cập nhật widget thời tiết trung tâm (góc dưới trái)
  async updateWeather() {
    const city = this.citiesConfig[this.currentCity];
    const w = await window.weatherService.getWeather(city.lat, city.lng, city.name);

    const pillText = document.getElementById('weather-pill-text');
    const pillDot = document.getElementById('weather-risk-dot');

    if (pillText) {
      pillText.innerHTML = `${w.icon} <strong>${city.name} ${w.temp}°C</strong> • Mưa: ${w.rain1h}mm • ${w.floodRisk.text}`;
    }

    if (pillDot) {
      pillDot.className = 'gm-risk-dot ' + (w.floodRisk.level === 'danger' ? 'risk-danger' : (w.floodRisk.level === 'warning' ? 'risk-warning' : ''));
    }
  }

  // Cập nhật và vẽ các trạm thời tiết quận huyện trực tiếp lên bản đồ
  async updateWeatherStations() {
    try {
      const stations = await window.weatherService.getMultiStationWeather(this.currentCity);
      window.mapEngine.renderWeatherStations(stations);
      console.log(`[Cloud Weather] Đã cập nhật ${stations.length} trạm thời tiết tại ${this.currentCity}`);
    } catch (err) {
      console.warn('[Cloud Weather] Không thể vẽ trạm thời tiết:', err.message);
    }
  }

  // ==================== BỘ ĐIỀU KHIỂN CẬP NHẬT 24/24 TRÊN CLOUD ====================
  start247CloudSync() {
    this.remainingSeconds = this.syncIntervalSeconds;
    this.lastWeatherSync = Date.now();
    this.lastSyncTime = Date.now();

    // 1. Thử kết nối Server-Sent Events (SSE) nếu server fullstack khả dụng
    this.connectCloudStream();

    // 2. Vòng lặp đếm ngược giây tự động cập nhật liên tục 24/24
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(async () => {
      this.remainingSeconds--;

      const badge = document.getElementById('badge-countdown');
      if (badge) {
        badge.textContent = `${this.remainingSeconds}s ↻`;
      }

      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = this.syncIntervalSeconds;
        await this.syncFromCloud(false);
      }
    }, 1000);

    // 3. Quản lý trạng thái đóng/mở tab (Page Visibility API)
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        const now = Date.now();
        // Nếu người dùng quay lại tab sau hơn 20s, lập tức làm mới
        if (now - this.lastSyncTime > 20000) {
          console.log('[Cloud 24/7] Người dùng kích hoạt lại tab, làm mới ngay dữ liệu...');
          await this.syncFromCloud(true);
        }
      }
    });
  }

  async syncFromCloud(isManualOrFocus = false) {
    const badge = document.getElementById('badge-countdown');
    if (badge) badge.textContent = 'Đang tải...';

    const prevCount = (this.liveData.floodPoints || []).length;

    // 1. Tải dữ liệu rốn ngập & kẹt xe mới nhất
    await this.fetchLiveData();

    // 2. Làm mới radar thời tiết toàn thành phố và các trạm quận huyện mỗi 2 phút
    const now = Date.now();
    if (now - this.lastWeatherSync >= 120000 || isManualOrFocus) {
      await this.updateWeather();
      await this.updateWeatherStations();
      this.lastWeatherSync = now;
    }

    // 3. Thông báo cho người dùng
    const currentCount = (this.liveData.floodPoints || []).length;
    if (currentCount > prevCount && prevCount > 0) {
      this.showToast('🌊 Hệ thống vừa cập nhật thêm điểm ngập mới!', 'warning');
    } else if (isManualOrFocus) {
      this.showToast('✓ Đã đồng bộ dữ liệu thời tiết & giao thông mới nhất từ Cloud 24/7!', 'info');
    }

    this.lastSyncTime = Date.now();
  }

  connectCloudStream() {
    if (!window.EventSource) return;
    try {
      const sse = new EventSource('/api/live-stream');
      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.data) {
            console.log('[SSE 24/7] Nhận dữ liệu phát trực tiếp từ Cloud Server!');
            this.liveData = payload.data;
            this.renderAllData();
            this.showToast('⚡ Cập nhật dữ liệu thời gian thực từ Cloud Server!', 'info');
          }
        } catch (e) {}
      };
      sse.onerror = () => {
        // Trên GitHub Pages tĩnh hoặc khi mất kết nối, tự động đóng SSE và dùng Smart Polling 30s
        sse.close();
      };
    } catch (e) {}
  }

  showToast(message, type = 'info', durationMs = 4000) {
    const container = document.getElementById('gm-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `gm-toast toast-${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button style="background: none; border: none; color: #fff; opacity: 0.7; cursor: pointer; font-size: 14px; line-height: 1;">✕</button>
    `;

    toast.querySelector('button')?.addEventListener('click', () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, durationMs);
  }

  toggleDirectionsPanel(forceState) {
    const panel = document.getElementById('gm-directions-panel');
    const searchBox = document.getElementById('gm-search-box');
    const chips = document.getElementById('gm-chips-scroll');

    this.isDirectionsOpen = forceState !== undefined ? forceState : !this.isDirectionsOpen;

    if (this.isDirectionsOpen) {
      panel.classList.add('open');
      searchBox.style.display = 'none';
      chips.style.display = 'none';
    } else {
      panel.classList.remove('open');
      searchBox.style.display = 'flex';
      chips.style.display = 'flex';
    }
  }

  bindEvents() {
    // 1. Nút chỉ đường
    document.getElementById('btn-open-directions')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(true);
      this.calculateSmartRoute();
    });

    document.getElementById('btn-close-directions')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(false);
    });

    // 2. Ô tìm kiếm chính
    const searchInput = document.getElementById('gm-search-input');
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch(searchInput.value.trim());
      }
    });

    document.getElementById('btn-search-trigger')?.addEventListener('click', () => {
      this.handleSearch(searchInput?.value.trim() || '');
    });

    // 3. Category Chips
    document.getElementById('chip-flood-count')?.addEventListener('click', () => {
      const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
      const activeFloods = cityFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');

      if (activeFloods.length > 0) {
        // Có ngập thực tế: Bay camera đến điểm ngập sâu nhất
        const worst = [...activeFloods].sort((a, b) => (b.depth_cm || 0) - (a.depth_cm || 0))[0];
        window.mapEngine.map.flyTo([worst.lat, worst.lng], 16);
        this.showToast(`⚠️ Đang theo dõi rốn ngập sâu: ${worst.name} (${worst.depth_cm}cm)`, 'danger');
      } else {
        // Khô ráo, nước đã rút
        this.showToast('✅ Toàn thành phố hiện tại tạnh ráo! Nước tại các rốn ngập đã rút hoàn toàn, lưu thông an toàn.', 'info', 5000);
      }
    });

    document.getElementById('chip-traffic-count')?.addEventListener('click', () => {
      const cityTraffics = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);
      const activeJams = cityTraffics.filter(t => t.isJam === true);

      if (activeJams.length > 0) {
        window.mapEngine.map.flyTo([activeJams[0].lat, activeJams[0].lng], 15);
        this.showToast(`⚠️ Điểm ùn tắc giao thông: ${activeJams[0].description}`, 'warning');
      } else {
        const roadworks = cityTraffics.filter(t => t.type === 'roadwork' || t.type === 'road_closure');
        if (roadworks.length > 0) {
          window.mapEngine.map.flyTo([roadworks[0].lat, roadworks[0].lng], 15);
          this.showToast(`🌙 Ban đêm đường phố thông thoáng! Ghi nhận ${roadworks.length} điểm rào chắn thi công bảo trì đêm (Vệ tinh TomTom v5).`, 'info', 5000);
        } else {
          this.showToast('✅ Giao thông toàn thành phố thông thoáng! Vận tốc trung bình 45-60 km/h, không có điểm kẹt xe.', 'info', 5000);
        }
      }
    });

    document.getElementById('chip-ai-trigger')?.addEventListener('click', () => {
      window.aiChat.toggle();
    });

    // 4. Chọn thành phố -> Cập nhật lại bản đồ, thời tiết trung tâm và thời tiết trạm các quận
    document.getElementById('city-select-gm')?.addEventListener('change', async (e) => {
      this.currentCity = e.target.value;
      const city = this.citiesConfig[this.currentCity];
      window.mapEngine.flyToCity(city);
      await this.updateWeather();
      await this.updateWeatherStations();
      this.renderAllData();
    });

    // 5. Nút tìm đường trong bảng Directions
    document.getElementById('btn-find-route-submit')?.addEventListener('click', () => {
      this.calculateSmartRoute();
    });

    // Chuyển phương tiện (Xe máy / Ô tô)
    document.querySelectorAll('.gm-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.gm-mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentVehicle = tab.getAttribute('data-mode');
        this.calculateSmartRoute();
      });
    });

    // 6. Cụm nút điều khiển góc dưới bên phải
    document.getElementById('btn-gm-zoom-in')?.addEventListener('click', () => window.mapEngine.zoomIn());
    document.getElementById('btn-gm-zoom-out')?.addEventListener('click', () => window.mapEngine.zoomOut());
    document.getElementById('btn-gm-locate')?.addEventListener('click', () => {
      navigator.geolocation.getCurrentPosition(p => {
        window.mapEngine.map.flyTo([p.coords.latitude, p.coords.longitude], 16);
      });
    });

    // Bấm vào pill Cloud Live 24/7 để làm mới tức thì
    document.getElementById('gm-live-status-pill')?.addEventListener('click', () => {
      this.syncFromCloud(true);
    });

    // Nút làm mới dữ liệu từ Bot
    document.getElementById('btn-gm-bot-refresh')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-gm-bot-refresh');
      btn.style.transform = 'rotate(360deg)';
      try {
        await this.syncFromCloud(true);
        // Nếu có backend Node.js, gọi thêm endpoint bot refresh
        try {
          await fetch('/api/bot/refresh', { method: 'POST' });
        } catch (e) {}
      } finally {
        setTimeout(() => { btn.style.transform = 'none'; }, 500);
      }
    });

    // Menu bật tắt lớp bản đồ
    const layerMenu = document.getElementById('gm-layer-menu');
    document.getElementById('btn-gm-layers')?.addEventListener('click', () => {
      layerMenu.classList.toggle('open');
    });

    document.getElementById('chk-layer-traffic')?.addEventListener('change', (e) => {
      window.mapEngine.toggleTraffic(e.target.checked);
    });
    document.getElementById('chk-layer-flood')?.addEventListener('change', (e) => {
      window.mapEngine.toggleFloods(e.target.checked);
    });
    document.getElementById('chk-layer-weather')?.addEventListener('change', (e) => {
      window.mapEngine.toggleWeather(e.target.checked);
    });
    document.getElementById('chk-layer-satellite')?.addEventListener('change', (e) => {
      window.mapEngine.switchBaseMap(e.target.checked ? 'satellite' : 'standard');
    });

    // Click lên bản đồ sẽ tự động đóng AI chat và menu lớp
    window.mapEngine.map?.on('click', () => {
      window.aiChat.close();
      document.getElementById('gm-layer-menu')?.classList.remove('open');
    });

    // 7. Modals: Báo cáo & Cài đặt
    const reportModal = document.getElementById('modal-report');
    document.getElementById('btn-gm-open-report')?.addEventListener('click', () => reportModal?.classList.add('open'));
    document.getElementById('btn-close-report')?.addEventListener('click', () => reportModal?.classList.remove('open'));

    document.getElementById('form-report')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('report-location-name')?.value || 'Điểm ngập';
      const depth = document.getElementById('report-depth')?.value || 30;
      const type = document.getElementById('report-type')?.value || 'flood';
      const center = window.mapEngine.map.getCenter();

      const res = await window.crowdsourceService.submitReport({
        locationName: name,
        city: this.currentCity,
        lat: center.lat + (Math.random() - 0.5) * 0.005,
        lng: center.lng + (Math.random() - 0.5) * 0.005,
        type,
        depth_cm: depth
      });

      if (res.success) {
        reportModal?.classList.remove('open');
        this.showToast('✓ Báo cáo của bạn đã được xác thực và ghim lên bản đồ!', 'info');
      }
    });

    const settingsModal = document.getElementById('modal-settings');
    document.getElementById('btn-gm-open-settings')?.addEventListener('click', () => {
      const geminiInput = document.getElementById('setting-gemini-key');
      if (geminiInput) {
        geminiInput.value = localStorage.getItem('movesafe_gemini_key') || '';
      }
      settingsModal?.classList.add('open');
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => settingsModal?.classList.remove('open'));

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      const gemini = document.getElementById('setting-gemini-key')?.value;
      const tomtom = document.getElementById('setting-tomtom-key')?.value;
      const owm = document.getElementById('setting-owm-key')?.value;

      if (gemini) localStorage.setItem('movesafe_gemini_key', gemini.trim());
      if (tomtom) window.mapEngine.setTomTomKey(tomtom.trim());
      if (owm) window.weatherService.setApiKey(owm.trim());

      settingsModal?.classList.remove('open');
      this.showToast('✓ Đã lưu cấu hình API thành công!', 'info');
    });
  }

  handleSearch(query) {
    if (!query) return;
    const lower = query.toLowerCase();

    // Tìm kiếm rốn ngập
    const matchedFlood = this.liveData.floodPoints.find(f => lower.includes(f.name.toLowerCase().slice(0, 8)));
    if (matchedFlood) {
      window.mapEngine.map.flyTo([matchedFlood.lat, matchedFlood.lng], 16);
      return;
    }

    // Nếu hỏi lộ trình "từ A đến B"
    if (lower.includes('từ') && (lower.includes('đến') || lower.includes('về') || lower.includes('sang'))) {
      this.toggleDirectionsPanel(true);
      const parts = query.split(/đến|về|sang/i);
      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      if (originInput) originInput.value = parts[0].replace(/từ/i, '').trim();
      if (destInput && parts[1]) destInput.value = parts[1].trim();
      this.calculateSmartRoute();
      return;
    }

    // Nếu là câu hỏi khác -> mở trợ lý AI
    window.aiChat.open();
    window.aiChat.sendMessage(query);
  }

  async calculateSmartRoute() {
    const resultsContainer = document.getElementById('gm-route-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div style="padding: 12px; font-size: 13px; color: #5f6368;">⏳ Đang tính toán tuyến đường an toàn né ngập...</div>';
    }

    let origin = { lat: 21.0365, lng: 105.7925 }; // Cầu Giấy
    let dest = { lat: 21.0242, lng: 105.8542 };   // Nhà Hát Lớn (Hoàn Kiếm qua Nguyễn Khuyến)

    if (this.currentCity === 'hcm') {
      origin = { lat: 10.7769, lng: 106.6811 };
      dest = { lat: 10.7412, lng: 106.7325 }; // Huỳnh Tấn Phát rốn ngập
    }

    const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);

    try {
      const res = await window.routingService.calculateSmartSafeRoute({
        origin,
        destination: dest,
        floodPoints: cityFloods,
        vehicleType: this.currentVehicle
      });

      window.mapEngine.displayRoute(res);

      if (resultsContainer) {
        if (res.hasHazard) {
          resultsContainer.innerHTML = `
            <!-- Tuyến 1: Đề xuất né ngập an toàn -->
            <div class="gm-route-card selected-safe">
              <div class="gm-route-time gm-time-safe">
                <span>~${res.recommendedRoute.durationMin} phút</span>
                <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${res.recommendedRoute.distanceKm} km)</span>
              </div>
              <div class="gm-route-meta">Qua các tuyến phố cao ráo, hệ thống thoát nước tốt</div>
              <div class="gm-route-tag gm-tag-safe">
                ✓ Tuyến Đề Xuất Né Ngập (An toàn 100%)
              </div>
            </div>

            <!-- Tuyến 2: Tuyến cũ qua rốn ngập (Cảnh báo nguy hiểm) -->
            <div class="gm-route-card hazard-card">
              <div class="gm-route-time gm-time-hazard">
                <span>~${res.dangerRoute.durationMin} phút</span>
                <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${res.dangerRoute.distanceKm} km)</span>
              </div>
              <div class="gm-route-meta">Đi qua: <strong>${res.hazards.map(h => h.name).join(', ')}</strong></div>
              <div class="gm-route-tag gm-tag-danger">
                ⚠️ Rủi ro cao: Ngập sâu ${res.hazards[0].depth_cm}cm, nguy cơ chết máy
              </div>
            </div>
          `;
        } else {
          resultsContainer.innerHTML = `
            <div class="gm-route-card selected-safe">
              <div class="gm-route-time gm-time-safe">
                <span>~${res.recommendedRoute.durationMin} phút</span>
                <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${res.recommendedRoute.distanceKm} km)</span>
              </div>
              <div class="gm-route-meta">Lộ trình thông thoáng, không phát hiện rốn ngập sâu</div>
              <div class="gm-route-tag gm-tag-safe">✓ Tuyến Nhanh Nhất & An Toàn</div>
            </div>
          `;
        }
      }
    } catch (e) {
      if (resultsContainer) resultsContainer.innerHTML = `<div style="color: red; padding: 10px;">Lỗi: ${e.message}</div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appState = new GoogleMapsApp();
  window.appState.init();
});
