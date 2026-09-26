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
    this.currentAvoidLevel = 1; // Mức độ tránh né mặc định: An toàn tuyệt đối
    this.isDirectionsOpen = false;
    this.activeFilter = 'all';

    // Trạng thái tọa độ & địa chỉ ngõ ngách thực tế
    this.routeLocations = {
      origin: { lat: 21.0365, lng: 105.7925, title: 'Cầu Giấy', fullAddress: 'Cầu Giấy, Hà Nội' },
      destination: { lat: 21.0242, lng: 105.8542, title: 'Nhà Hát Lớn', fullAddress: 'Nhà Hát Lớn, Hoàn Kiếm, Hà Nội' }
    };
    this.routeMarkers = {
      origin: null,
      destination: null
    };
    this.searchResultMarker = null;
    this.pickingLocationType = null;
    this.autocompleteDebounce = { origin: null, dest: null };
    this.lastRouteResult = null;

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

    // 5. Gán các sự kiện tương tác UI & Tìm kiếm địa chỉ ngõ ngách
    this.bindEvents();
    this.setupAddressAutocomplete();

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
      this.latestWeatherStations = stations;
      window.mapEngine.renderWeatherStations(stations);
      console.log(`[Cloud Weather] Đã cập nhật ${stations.length} trạm thời tiết tại ${this.currentCity}`);
      const streetsModal = document.getElementById('modal-hanoi-streets');
      if (streetsModal && streetsModal.classList.contains('open')) {
        this.filterHanoiStreets();
      }
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
    document.getElementById('chip-weather-toggle')?.addEventListener('click', () => {
      const city = this.citiesConfig[this.currentCity];
      const currentZoom = window.mapEngine.map.getZoom();

      if (currentZoom < 12) {
        window.mapEngine.map.flyTo([city.lat, city.lng], 13);
        this.showToast(`🌦️ Phóng to vào ${city.name} để xem chi tiết thời tiết & mưa từng phường!`, 'info', 4000);
      } else {
        const nextState = !window.mapEngine.weatherVisible;
        window.mapEngine.toggleWeather(nextState);
        const chip = document.getElementById('chip-weather-toggle');
        if (nextState) {
          chip?.classList.remove('gm-chip-inactive');
          this.showToast(`🌦️ Đã bật hiển thị thời tiết các phường`, 'info');
        } else {
          chip?.classList.add('gm-chip-inactive');
          this.showToast(`Đã ẩn trạm thời tiết các phường`, 'info');
        }
      }
    });

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
      this.resetCityRouteDefaults();
      await this.updateWeather();
      await this.updateWeatherStations();
      this.renderAllData();
      if (this.isDirectionsOpen) {
        this.calculateSmartRoute();
      }
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

    // 5b. Bộ chọn 3 mức độ tránh né
    document.querySelectorAll('.gm-avoidance-option').forEach(option => {
      option.addEventListener('click', () => {
        // Cập nhật trạng thái active của các option
        document.querySelectorAll('.gm-avoidance-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        
        // Cập nhật radio button
        const radio = option.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        
        // Lưu mức độ tránh né
        this.currentAvoidLevel = parseInt(option.getAttribute('data-level'));
        
        // Tự động tính lại đường nếu panel đang mở
        if (this.isDirectionsOpen) {
          this.calculateSmartRoute();
        }
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

    // Click lên bản đồ sẽ tự động đóng AI chat, menu lớp hoặc chọn điểm đi/đến
    window.mapEngine.map?.on('click', async (e) => {
      window.aiChat.close();
      document.getElementById('gm-layer-menu')?.classList.remove('open');

      if (this.pickingLocationType) {
        const type = this.pickingLocationType;
        this.stopPickLocationOnMap();

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        this.showToast('🔍 Đang xác định ngõ ngách, địa chỉ...', 'info');

        try {
          const addrInfo = await window.geocodingService.reverseGeocode(lat, lng);
          this.selectLocation(type, {
            title: addrInfo.title,
            subtitle: addrInfo.subtitle,
            fullAddress: addrInfo.fullAddress,
            lat,
            lng
          });
          this.showToast(`✓ Đã chọn: ${addrInfo.title}`, 'info');
        } catch (err) {
          this.selectLocation(type, {
            title: `Tọa độ [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
            subtitle: 'Vị trí trên bản đồ',
            fullAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            lat,
            lng
          });
        }
      }
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

    // 8. Modal Danh mục đường lớn & Thời tiết các phường Hà Nội
    document.getElementById('chip-hanoi-streets')?.addEventListener('click', () => {
      this.openHanoiStreetsModal();
    });

    document.getElementById('btn-close-hanoi-streets')?.addEventListener('click', () => {
      this.closeHanoiStreetsModal();
    });

    document.getElementById('modal-hanoi-streets')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'modal-hanoi-streets') {
        this.closeHanoiStreetsModal();
      }
    });

    document.querySelectorAll('#district-filter-chips .dist-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#district-filter-chips .dist-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedStreetsDistrict = chip.getAttribute('data-district') || 'all';
        this.filterHanoiStreets();
      });
    });

    document.getElementById('input-search-streets')?.addEventListener('input', () => {
      this.filterHanoiStreets();
    });

    document.getElementById('btn-reset-streets-filter')?.addEventListener('click', () => {
      const input = document.getElementById('input-search-streets');
      if (input) input.value = '';
      this.selectedStreetsDistrict = 'all';
      document.querySelectorAll('#district-filter-chips .dist-chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-district') === 'all');
      });
      this.renderHanoiStreetsCards('all', '');
    });
  }

  // ==================== QUẢN LÝ DANH MỤC ĐƯỜNG LỚN & PHƯỜNG HÀ NỘI ====================
  openHanoiStreetsModal() {
    const modal = document.getElementById('modal-hanoi-streets');
    if (!modal) return;
    modal.classList.add('open');
    this.selectedStreetsDistrict = 'all';
    const input = document.getElementById('input-search-streets');
    if (input) input.value = '';

    document.querySelectorAll('#district-filter-chips .dist-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-district') === 'all');
    });

    this.renderHanoiStreetsCards('all', '');
  }

  closeHanoiStreetsModal() {
    const modal = document.getElementById('modal-hanoi-streets');
    if (modal) modal.classList.remove('open');
  }

  filterHanoiStreets() {
    const input = document.getElementById('input-search-streets');
    const keyword = input ? input.value.trim().toLowerCase() : '';
    this.renderHanoiStreetsCards(this.selectedStreetsDistrict || 'all', keyword);
  }

  renderHanoiStreetsCards(filterDistrict = 'all', keyword = '') {
    const container = document.getElementById('streets-cards-container');
    if (!container) return;

    const wardsData = window.HANOI_WARDS_DATA || [];
    if (!wardsData || wardsData.length === 0) {
      container.innerHTML = `
        <div style="padding: 30px; text-align: center; color: #5f6368;">
          Đang tải dữ liệu mạng lưới đường và các phường Hà Nội...
        </div>
      `;
      return;
    }

    const filtered = wardsData.filter(ward => {
      if (filterDistrict !== 'all' && ward.district !== filterDistrict) {
        return false;
      }
      if (keyword) {
        const nameMatch = ward.name.toLowerCase().includes(keyword);
        const distMatch = ward.district.toLowerCase().includes(keyword);
        const streetMatch = (ward.mainStreets || []).some(st => st.toLowerCase().includes(keyword));
        const hotspotMatch = (ward.trafficHotspots || []).some(h => h.toLowerCase().includes(keyword));
        if (!nameMatch && !distMatch && !streetMatch && !hotspotMatch) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #5f6368;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 600; font-size: 15px; color: #202124;">Không tìm thấy phường hoặc tuyến đường khớp với "${keyword}"</div>
          <div style="font-size: 13px; margin-top: 4px;">Hãy thử tìm kiếm với tên đường (VD: Cầu Diễn, Hoàng Công Chất, Đức Diễn...) hoặc chọn quận khác.</div>
        </div>
      `;
      return;
    }

    const stations = this.latestWeatherStations || (window.mapEngine ? window.mapEngine.allWeatherStations : []) || [];
    const stationMap = new Map();
    stations.forEach(st => {
      stationMap.set(st.name, st);
    });

    let html = '';
    filtered.forEach(ward => {
      const liveWeather = stationMap.get(ward.name);
      const temp = liveWeather ? liveWeather.temp : 26;
      const desc = liveWeather ? liveWeather.description : 'Khô ráo';
      const icon = liveWeather ? (liveWeather.icon || '☀️') : '☀️';
      const risk = liveWeather ? (liveWeather.floodRisk || { level: 'safe', text: 'Khô ráo' }) : { level: 'safe', text: 'Khô ráo' };
      const riskBadgeClass = risk.level === 'danger' ? 'danger' : (risk.level === 'warning' ? 'warning' : 'safe');

      const streetsTags = (ward.mainStreets || []).map(st => `
        <span class="ward-card-street-tag" 
              title="Bấm để kiểm tra chi tiết tuyến đường ${st}"
              onclick="window.appState && window.appState.searchStreetFromWard('${st.replace(/'/g, "\\'")}', '${ward.name.replace(/'/g, "\\'")}')">
          ${st}
        </span>
      `).join('');

      let hotspotsHtml = '';
      if (ward.trafficHotspots && ward.trafficHotspots.length > 0) {
        hotspotsHtml = `
          <div class="ward-card-hotspots">
            🚦 <strong>Giao cắt trọng điểm:</strong> ${ward.trafficHotspots.join(' • ')}
          </div>
        `;
      }

      let floodNoteHtml = '';
      if (ward.floodVulnerability) {
        floodNoteHtml = `
          <div class="ward-card-flood">
            🌊 <strong>Lưu ý úng ngập:</strong> ${ward.floodVulnerability}
          </div>
        `;
      }

      html += `
        <div class="ward-card ${ward.isHub ? 'hub-card' : ''}">
          <div class="ward-card-header">
            <div>
              <div class="ward-card-title">
                ${ward.name}
                ${ward.isHub ? '<span style="font-size: 10px; background: #e8f0fe; color: #1a73e8; padding: 1px 6px; border-radius: 4px; font-weight: 600;">Trung tâm</span>' : ''}
              </div>
              <div class="ward-card-sub">Quận ${ward.district} • Hà Nội</div>
            </div>
            <div class="ward-weather-pill weather-pill-${riskBadgeClass}">
              <span>${icon}</span>
              <span>${temp}°C</span>
              <span>•</span>
              <span style="font-weight: 500;">${desc}</span>
            </div>
          </div>

          <div style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px; text-transform: uppercase;">
            🛣️ Các trục đường huyết mạch (${(ward.mainStreets || []).length} tuyến):
          </div>
          <div class="ward-card-streets">
            ${streetsTags}
          </div>

          ${hotspotsHtml}
          ${floodNoteHtml}

          <div class="ward-card-footer">
            <button class="btn-card-map" 
                    onclick="window.appState && window.appState.flyToWardFromCard(${ward.lat}, ${ward.lng}, '${ward.name.replace(/'/g, "\\'")}')">
              📍 Xem Trên Bản Đồ
            </button>
            <button class="btn-card-ai" 
                    onclick="window.appState && window.appState.askAiAboutWard('${ward.name.replace(/'/g, "\\'")}', '${ward.district.replace(/'/g, "\\'")}')">
              🤖 Hỏi AI Về Phường
            </button>
            <button class="btn-card-route" 
                    title="Chỉ đường đến ${ward.name}"
                    onclick="window.appState && window.appState.routeToWardFromCard(${ward.lat}, ${ward.lng}, '${ward.name.replace(/'/g, "\\'")}')">
              🔀 Đến Đây
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  flyToWardFromCard(lat, lng, wardName) {
    this.closeHanoiStreetsModal();
    if (this.currentCity !== 'hanoi') {
      this.currentCity = 'hanoi';
      const citySelect = document.getElementById('city-select-gm');
      if (citySelect) citySelect.value = 'hanoi';
      const city = this.citiesConfig['hanoi'];
      window.mapEngine.flyToCity(city);
    }
    
    window.mapEngine.map.flyTo([lat, lng], 15);
    this.showToast(`🏛️ Đã chuyển góc nhìn đến ${wardName}`, 'info');

    setTimeout(() => {
      if (window.mapEngine && typeof window.mapEngine.openWardPopup === 'function') {
        window.mapEngine.openWardPopup(lat, lng);
      }
    }, 600);
  }

  askAiAboutWard(wardName, district) {
    this.closeHanoiStreetsModal();
    window.aiChat.open();
    window.aiChat.sendMessage(`Tình hình thời tiết, các trục đường lớn và điểm kẹt xe ngập úng tại ${wardName}, Quận ${district} hiện nay thế nào?`);
  }

  routeToWardFromCard(lat, lng, wardName) {
    this.closeHanoiStreetsModal();
    this.routeToLocation(lat, lng, `${wardName}, Hà Nội`);
  }

  searchStreetFromWard(streetName, wardName) {
    this.closeHanoiStreetsModal();
    this.showToast(`🛣️ Tuyến đường lớn: ${streetName} (${wardName})`, 'info', 4000);
    window.aiChat.open();
    window.aiChat.sendMessage(`Tình hình giao thông, ngập nước và lộ trình lưu thông trên đường ${streetName} qua khu vực ${wardName} như thế nào?`);
  }

  // Đặt lại điểm mặc định khi chuyển thành phố
  resetCityRouteDefaults() {
    if (this.currentCity === 'hcm') {
      this.routeLocations = {
        origin: { lat: 10.7769, lng: 106.6811, title: 'Chợ Bến Thành', fullAddress: 'Chợ Bến Thành, Quận 1, TP. Hồ Chí Minh' },
        destination: { lat: 10.7412, lng: 106.7325, title: 'Khu Đô Thị Phú Mỹ Hưng', fullAddress: 'Phú Mỹ Hưng, Quận 7, TP. Hồ Chí Minh' }
      };
    } else if (this.currentCity === 'danang') {
      this.routeLocations = {
        origin: { lat: 16.0678, lng: 108.2208, title: 'Cầu Rồng', fullAddress: 'Cầu Rồng, Hải Châu, Đà Nẵng' },
        destination: { lat: 16.0471, lng: 108.2068, title: 'Sân Bay Quốc Tế Đà Nẵng', fullAddress: 'Sân Bay Quốc Tế Đà Nẵng' }
      };
    } else {
      this.routeLocations = {
        origin: { lat: 21.0365, lng: 105.7925, title: 'Cầu Giấy', fullAddress: 'Cầu Giấy, Hà Nội' },
        destination: { lat: 21.0242, lng: 105.8542, title: 'Nhà Hát Lớn', fullAddress: 'Nhà Hát Lớn, Hoàn Kiếm, Hà Nội' }
      };
    }
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (originInput) originInput.value = this.routeLocations.origin.fullAddress;
    if (destInput) destInput.value = this.routeLocations.destination.fullAddress;
  }

  // Thiết lập hệ thống tìm kiếm & gợi ý địa chỉ ngõ ngách chuẩn Google Maps
  setupAddressAutocomplete() {
    ['origin', 'dest'].forEach(type => {
      const input = document.getElementById(`gm-route-${type}`);
      const dropdown = document.getElementById(`dropdown-${type}`);
      const clearBtn = document.getElementById(`btn-clear-${type}`);
      if (!input || !dropdown) return;

      const updateClearBtn = () => {
        if (clearBtn) clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
      };
      input.addEventListener('input', updateClearBtn);
      updateClearBtn();

      // Nút Xóa (Clear)
      clearBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        this.routeLocations[type] = null;
        if (this.routeMarkers[type]) {
          window.mapEngine.map.removeLayer(this.routeMarkers[type]);
          this.routeMarkers[type] = null;
        }
        updateClearBtn();
        dropdown.style.display = 'none';
        input.focus();
      });

      // Khi Focus: Hiện gợi ý nhanh hoặc danh sách địa chỉ
      input.addEventListener('focus', async () => {
        const val = input.value.trim();
        if (val.length >= 2) {
          await this.renderAddressSuggestions(type, val);
        } else {
          this.renderQuickActions(type);
        }
      });

      // Khi gõ phím: Debounce 280ms gọi API Geocoding
      input.addEventListener('input', () => {
        const val = input.value.trim();
        clearTimeout(this.autocompleteDebounce[type]);
        if (val.length < 2) {
          this.renderQuickActions(type);
          return;
        }

        dropdown.innerHTML = `
          <div style="padding: 10px 14px; font-size: 12px; color: #5f6368; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; animation: pulse-ring 1s infinite;">🔍</span> Đang tìm kiếm ngõ, ngách, địa chỉ...
          </div>
        `;
        dropdown.style.display = 'flex';

        this.autocompleteDebounce[type] = setTimeout(async () => {
          await this.renderAddressSuggestions(type, val);
        }, 280);
      });

      // Bắt phím điều hướng
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          dropdown.style.display = 'none';
        } else if (e.key === 'Enter') {
          dropdown.style.display = 'none';
          this.calculateSmartRoute();
        }
      });
    });

    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#field-row-origin') && !e.target.closest('#field-row-dest')) {
        document.getElementById('dropdown-origin')?.style.setProperty('display', 'none');
        document.getElementById('dropdown-dest')?.style.setProperty('display', 'none');
      }
    });

    // Nút GPS cho điểm đi
    document.getElementById('btn-gps-origin')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.setOriginToMyLocation();
    });

    // Nút Chọn trên bản đồ cho điểm đến
    document.getElementById('btn-pick-map-dest')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startPickLocationOnMap('dest');
    });

    // Nút Swap (Đảo chiều)
    document.getElementById('btn-swap-route')?.addEventListener('click', () => {
      this.swapRouteLocations();
    });

    // Nút Hủy chế độ chọn trên bản đồ
    document.getElementById('btn-cancel-pick-map')?.addEventListener('click', () => {
      this.stopPickLocationOnMap();
    });
  }

  // Render các tác vụ nhanh (Vị trí hiện tại, Chọn trên bản đồ)
  renderQuickActions(type) {
    const dropdown = document.getElementById(`dropdown-${type}`);
    if (!dropdown) return;

    dropdown.innerHTML = `
      <div class="gm-suggestion-item gm-quick-action" data-action="gps">
        <div class="gm-sugg-icon icon-gps">🎯</div>
        <div class="gm-sugg-content">
          <div class="gm-sugg-title">Vị trí của bạn</div>
          <div class="gm-sugg-subtitle">Sử dụng định vị GPS hiện tại</div>
        </div>
      </div>
      <div class="gm-suggestion-item gm-quick-action" data-action="map">
        <div class="gm-sugg-icon">🗺️</div>
        <div class="gm-sugg-content">
          <div class="gm-sugg-title">Chọn trên bản đồ</div>
          <div class="gm-sugg-subtitle">Click vào bất kỳ điểm nào trên bản đồ</div>
        </div>
      </div>
    `;

    dropdown.querySelectorAll('.gm-suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.getAttribute('data-action');
        dropdown.style.display = 'none';
        if (action === 'gps') {
          if (type === 'origin') await this.setOriginToMyLocation();
          else await this.setDestToMyLocation();
        } else if (action === 'map') {
          this.startPickLocationOnMap(type);
        }
      });
    });

    dropdown.style.display = 'flex';
  }

  // Render danh sách địa chỉ tìm thấy từ Geocoding
  async renderAddressSuggestions(type, query) {
    const dropdown = document.getElementById(`dropdown-${type}`);
    if (!dropdown) return;

    const mapCenter = window.mapEngine.map ? window.mapEngine.map.getCenter() : null;
    const center = mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null;

    try {
      const results = await window.geocodingService.searchAddresses(query, {
        city: this.currentCity,
        center: center,
        limit: 8
      });

      if (!results || results.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 10px 14px; font-size: 12px; color: #5f6368;">
            Không tìm thấy địa chỉ khớp với "${query}".
          </div>
          <div class="gm-suggestion-item gm-quick-action" data-action="map">
            <div class="gm-sugg-icon">🗺️</div>
            <div class="gm-sugg-content">
              <div class="gm-sugg-title">Chọn vị trí này trên bản đồ</div>
              <div class="gm-sugg-subtitle">Click trực tiếp vào vị trí cần đến</div>
            </div>
          </div>
        `;
        dropdown.querySelector('[data-action="map"]')?.addEventListener('click', () => {
          dropdown.style.display = 'none';
          this.startPickLocationOnMap(type);
        });
        dropdown.style.display = 'flex';
        return;
      }

      let html = '';
      results.forEach((item, index) => {
        const isAlley = item.type === 'alley';
        const iconClass = isAlley ? 'icon-alley' : '';
        html += `
          <div class="gm-suggestion-item" data-index="${index}">
            <div class="gm-sugg-icon ${iconClass}">${item.icon || '📍'}</div>
            <div class="gm-sugg-content">
              <div class="gm-sugg-title">${item.title}</div>
              <div class="gm-sugg-subtitle">${item.subtitle}</div>
            </div>
            ${item.typeName ? `<span class="gm-sugg-tag">${item.typeName}</span>` : ''}
          </div>
        `;
      });

      dropdown.innerHTML = html;
      dropdown.querySelectorAll('.gm-suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-index'));
          const selected = results[idx];
          if (selected) {
            this.selectLocation(type, selected);
          }
          dropdown.style.display = 'none';
        });
      });

      dropdown.style.display = 'flex';
    } catch (e) {
      console.warn('[Autocomplete error]', e);
      dropdown.style.display = 'none';
    }
  }

  // Xử lý khi chọn một địa điểm từ gợi ý
  selectLocation(type, item) {
    const input = document.getElementById(`gm-route-${type}`);
    if (input) {
      input.value = item.fullAddress || item.title;
      const clearBtn = document.getElementById(`btn-clear-${type}`);
      if (clearBtn) clearBtn.style.display = 'flex';
    }

    this.routeLocations[type] = {
      lat: item.lat,
      lng: item.lng,
      title: item.title,
      fullAddress: item.fullAddress || item.title
    };

    // Cập nhật marker A hoặc B trên bản đồ
    this.updateRouteMarker(type, item.lat, item.lng, item.title);

    // Di chuyển góc nhìn bản đồ
    if (this.routeLocations.origin && this.routeLocations.destination) {
      const bounds = L.latLngBounds(
        [this.routeLocations.origin.lat, this.routeLocations.origin.lng],
        [this.routeLocations.destination.lat, this.routeLocations.destination.lng]
      );
      window.mapEngine.map.fitBounds(bounds, { padding: [80, 80] });
      this.calculateSmartRoute();
    } else {
      window.mapEngine.map.flyTo([item.lat, item.lng], 15);
    }
  }

  // Cập nhật Marker A/B kéo thả được (Draggable) trên bản đồ
  updateRouteMarker(type, lat, lng, title) {
    const map = window.mapEngine.map;
    if (!map) return;

    if (this.routeMarkers[type]) {
      map.removeLayer(this.routeMarkers[type]);
    }

    const isOrigin = type === 'origin';
    const letter = isOrigin ? 'A' : 'B';
    const pinClass = isOrigin ? 'pin-origin' : 'pin-dest';
    const label = isOrigin ? 'Điểm xuất phát (A)' : 'Điểm đến (B)';

    const icon = L.divIcon({
      className: 'gm-marker-container',
      html: `<div class="gm-route-pin ${pinClass}" title="${label}: ${title}">${letter}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([lat, lng], {
      icon,
      draggable: true,
      zIndexOffset: 1000
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: var(--font-family); font-size: 13px;">
        <strong>${label}</strong><br>
        <span style="color: #202124;">${title}</span><br>
        <small style="color: #1a73e8;">(Kéo thả ghim để đổi vị trí)</small>
      </div>
    `);

    // Kéo thả ghim A hoặc B
    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      const addrInfo = await window.geocodingService.reverseGeocode(pos.lat, pos.lng);
      
      const input = document.getElementById(`gm-route-${type}`);
      if (input) input.value = addrInfo.fullAddress || addrInfo.title;

      this.routeLocations[type] = {
        lat: pos.lat,
        lng: pos.lng,
        title: addrInfo.title,
        fullAddress: addrInfo.fullAddress
      };

      marker.setPopupContent(`
        <div style="font-family: var(--font-family); font-size: 13px;">
          <strong>${label}</strong><br>
          <span style="color: #202124;">${addrInfo.fullAddress}</span>
        </div>
      `);

      this.calculateSmartRoute();
    });

    this.routeMarkers[type] = marker;
  }

  // Bắt đầu chế độ click chọn trên bản đồ
  startPickLocationOnMap(type) {
    this.pickingLocationType = type;
    const banner = document.getElementById('gm-pick-map-banner');
    if (banner) {
      const typeText = type === 'origin' ? 'Điểm xuất phát (A)' : 'Điểm đến (B)';
      banner.querySelector('span').innerText = `🎯 Click vào điểm bất kỳ trên bản đồ để chọn ${typeText}...`;
      banner.style.display = 'flex';
    }

    const container = document.getElementById('map-container');
    if (container) container.style.cursor = 'crosshair';
    this.showToast(`🎯 Hãy nhấp chuột vào một vị trí trên bản đồ để chọn ${type === 'origin' ? 'điểm đi' : 'điểm đến'}`, 'info');
  }

  // Kết thúc chế độ click chọn trên bản đồ
  stopPickLocationOnMap() {
    this.pickingLocationType = null;
    const banner = document.getElementById('gm-pick-map-banner');
    if (banner) banner.style.display = 'none';

    const container = document.getElementById('map-container');
    if (container) container.style.cursor = '';
  }

  // Đảo ngược điểm đi và điểm đến (Swap)
  swapRouteLocations() {
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (!originInput || !destInput) return;

    const tempVal = originInput.value;
    originInput.value = destInput.value;
    destInput.value = tempVal;

    const tempLoc = this.routeLocations.origin;
    this.routeLocations.origin = this.routeLocations.destination;
    this.routeLocations.destination = tempLoc;

    if (this.routeLocations.origin) {
      this.updateRouteMarker('origin', this.routeLocations.origin.lat, this.routeLocations.origin.lng, this.routeLocations.origin.title);
    }
    if (this.routeLocations.destination) {
      this.updateRouteMarker('dest', this.routeLocations.destination.lat, this.routeLocations.destination.lng, this.routeLocations.destination.title);
    }

    this.calculateSmartRoute();
    this.showToast('⇄ Đã đảo ngược điểm đi và điểm đến', 'info');
  }

  // Lấy vị trí GPS hiện tại cho điểm đi
  async setOriginToMyLocation() {
    this.showToast('🎯 Đang xác định vị trí của bạn qua GPS...', 'info');
    try {
      const pos = await window.geocodingService.getCurrentPosition();
      const input = document.getElementById('gm-route-origin');
      if (input) input.value = pos.title;
      this.routeLocations.origin = {
        lat: pos.lat,
        lng: pos.lng,
        title: pos.title,
        fullAddress: pos.fullAddress
      };
      this.updateRouteMarker('origin', pos.lat, pos.lng, pos.title);
      this.showToast(`✓ Đã nhận diện vị trí: ${pos.title}`, 'info');
      if (this.routeLocations.destination) {
        this.calculateSmartRoute();
      }
    } catch (e) {
      this.showToast(`⚠️ Không thể lấy GPS: ${e.message}`, 'warning');
    }
  }

  // Lấy vị trí GPS cho điểm đến
  async setDestToMyLocation() {
    this.showToast('🎯 Đang xác định vị trí của bạn qua GPS...', 'info');
    try {
      const pos = await window.geocodingService.getCurrentPosition();
      const input = document.getElementById('gm-route-dest');
      if (input) input.value = pos.title;
      this.routeLocations.destination = {
        lat: pos.lat,
        lng: pos.lng,
        title: pos.title,
        fullAddress: pos.fullAddress
      };
      this.updateRouteMarker('dest', pos.lat, pos.lng, pos.title);
      this.showToast(`✓ Đã nhận diện vị trí: ${pos.title}`, 'info');
      if (this.routeLocations.origin) {
        this.calculateSmartRoute();
      }
    } catch (e) {
      this.showToast(`⚠️ Không thể lấy GPS: ${e.message}`, 'warning');
    }
  }

  // Điều hướng nhanh đến một địa điểm tìm thấy
  routeToLocation(lat, lng, title) {
    this.toggleDirectionsPanel(true);
    const destInput = document.getElementById('gm-route-dest');
    if (destInput) destInput.value = title;
    this.routeLocations.destination = {
      lat,
      lng,
      title,
      fullAddress: title
    };
    this.updateRouteMarker('dest', lat, lng, title);
    this.calculateSmartRoute();
  }

  // Dịch các chỉ dẫn rẽ sang tiếng Việt tự nhiên chuẩn Google Maps
  translateStepInstruction(step) {
    const raw = (step.instruction || '').toLowerCase();
    const name = step.name || 'đoạn đường';
    let turn = 'Tiếp tục đi';
    let icon = '⬆️';

    if (raw.includes('depart')) {
      turn = 'Khởi hành từ';
      icon = '🟢';
    } else if (raw.includes('arrive')) {
      turn = 'Đến điểm đích tại';
      icon = '🏁';
    } else if (raw.includes('right')) {
      turn = 'Rẽ phải vào';
      icon = '➡️';
    } else if (raw.includes('left')) {
      turn = 'Rẽ trái vào';
      icon = '⬅️';
    } else if (raw.includes('uturn')) {
      turn = 'Quay đầu xe trên';
      icon = '🔄';
    } else if (raw.includes('roundabout') || raw.includes('rotary')) {
      turn = 'Đi vào vòng xuyến rẽ vào';
      icon = '🔄';
    } else if (raw.includes('fork') || raw.includes('slight')) {
      turn = 'Chếch hướng vào';
      icon = '↗️';
    }

    const distText = step.distance > 1000
      ? `${(step.distance / 1000).toFixed(1)} km`
      : `${Math.round(step.distance)} m`;

    return {
      text: `${turn} <strong>${name}</strong>`,
      dist: distText,
      icon
    };
  }

  // Bật/tắt xem danh sách chi tiết các ngõ ngách
  toggleRouteSteps(index) {
    const el = document.getElementById(`steps-list-${index}`);
    if (el) {
      const isHidden = el.style.display === 'none';
      el.style.display = isHidden ? 'flex' : 'none';
    }
  }

  // Xử lý tìm kiếm thông minh từ ô tìm kiếm chính
  async handleSearch(query) {
    if (!query) return;
    const lower = query.toLowerCase();

    // 1. Tìm kiếm rốn ngập trong dữ liệu đã có
    const matchedFlood = this.liveData.floodPoints.find(f => lower.includes(f.name.toLowerCase().slice(0, 8)));
    if (matchedFlood) {
      window.mapEngine.map.flyTo([matchedFlood.lat, matchedFlood.lng], 16);
      this.showToast(`🌊 Rốn ngập: ${matchedFlood.name} (${matchedFlood.depth_cm}cm)`, 'danger');
      return;
    }

    // 1b. Tìm kiếm theo danh mục 76 Phường & 299 Tuyến đường lớn Hà Nội
    if (window.HANOI_WARDS_DATA && window.HANOI_WARDS_DATA.length > 0) {
      const cleanQuery = lower.replace(/^đường\s+|^phố\s+|^phường\s+|^xã\s+|^quốc lộ\s+/i, '').trim();

      // Kiểm tra tên phường (ví dụ: Tây Tựu, Phú Diễn, Phúc Diễn, Cầu Diễn, Mai Dịch...)
      let targetWard = window.HANOI_WARDS_DATA.find(w => {
        const wName = w.name.toLowerCase();
        const rawWName = wName.replace(/^phường\s+|^xã\s+/i, '').trim();
        return lower.includes(wName) || lower.includes(rawWName) || (cleanQuery.length >= 3 && rawWName.includes(cleanQuery));
      });

      let matchedStreetName = '';
      if (!targetWard && cleanQuery.length >= 3) {
        // Kiểm tra tên đường trong danh mục các trục đường lớn (ví dụ: Hoàng Công Chất, Cầu Diễn, Đức Diễn...)
        for (const w of window.HANOI_WARDS_DATA) {
          const st = (w.mainStreets || []).find(s => {
            const sLower = s.toLowerCase();
            const cleanSt = sLower.replace(/^đường\s+|^phố\s+|^quốc lộ\s+/i, '').trim();
            return lower.includes(sLower) || (cleanQuery.length >= 3 && (cleanSt.includes(cleanQuery) || cleanQuery.includes(cleanSt)));
          });
          if (st) {
            targetWard = w;
            matchedStreetName = st;
            break;
          }
        }
      }

      if (targetWard) {
        if (this.currentCity !== 'hanoi') {
          this.currentCity = 'hanoi';
          const citySelect = document.getElementById('city-select-gm');
          if (citySelect) citySelect.value = 'hanoi';
          await this.updateWeatherStations();
        }
        this.flyToWardFromCard(targetWard.lat, targetWard.lng, targetWard.name);
        const streetInfo = matchedStreetName 
          ? ` • Tuyến đường: ${matchedStreetName}` 
          : ` • Các đường lớn: ${(targetWard.mainStreets || []).slice(0, 3).join(', ')}`;
        this.showToast(`🏛️ ${targetWard.name} (${targetWard.district})${streetInfo}`, 'info', 5000);
        return;
      }
    }

    // 2. Nếu hỏi lộ trình "từ A đến B" (hoặc "từ A về B", "từ A sang B")
    if (lower.includes('từ') && (lower.includes('đến') || lower.includes('về') || lower.includes('sang'))) {
      this.toggleDirectionsPanel(true);
      const parts = query.split(/đến|về|sang/i);
      const rawOrigin = parts[0].replace(/từ/i, '').trim();
      const rawDest = parts[1] ? parts[1].trim() : '';

      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      if (originInput) originInput.value = rawOrigin;
      if (destInput) destInput.value = rawDest;

      this.showToast('🔍 Đang tìm kiếm địa chỉ và phân tích lộ trình...', 'info');

      // Tự động Geocode cả 2 điểm
      const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;
      const [origMatches, destMatches] = await Promise.all([
        window.geocodingService.searchAddresses(rawOrigin, { city: this.currentCity, center: cityCenter, limit: 1 }),
        window.geocodingService.searchAddresses(rawDest, { city: this.currentCity, center: cityCenter, limit: 1 })
      ]);

      if (origMatches && origMatches.length > 0) this.routeLocations.origin = origMatches[0];
      if (destMatches && destMatches.length > 0) this.routeLocations.destination = destMatches[0];

      this.calculateSmartRoute();
      return;
    }

    // 3. Nếu là tìm kiếm địa chỉ, ngõ ngách, địa danh cụ thể (ví dụ: "Ngõ 168 Hào Nam", "Chợ Bến Thành", "Vincom")
    try {
      const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;
      const matches = await window.geocodingService.searchAddresses(query, {
        city: this.currentCity,
        center: cityCenter,
        limit: 3
      });

      if (matches && matches.length > 0) {
        const top = matches[0];
        window.mapEngine.map.flyTo([top.lat, top.lng], 16);

        if (this.searchResultMarker) {
          window.mapEngine.map.removeLayer(this.searchResultMarker);
        }

        const icon = L.divIcon({
          className: 'gm-marker-container',
          html: `<div style="font-size: 26px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3)); cursor: pointer;">📍</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });

        this.searchResultMarker = L.marker([top.lat, top.lng], { icon }).addTo(window.mapEngine.map);
        this.searchResultMarker.bindPopup(`
          <div style="font-family: var(--font-family); min-width: 180px; padding: 4px;">
            <div style="font-weight: 700; font-size: 14px; color: #202124;">${top.title}</div>
            <div style="font-size: 12px; color: #5f6368; margin-top: 2px;">${top.subtitle}</div>
            <button onclick="window.appState.routeToLocation(${top.lat}, ${top.lng}, '${top.title.replace(/'/g, "\\'")}')" 
              style="margin-top: 8px; width: 100%; padding: 6px 12px; background: #1a73e8; color: #ffffff; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              🔀 Chỉ đường đến đây
            </button>
          </div>
        `).openPopup();

        this.showToast(`📍 Đã tìm thấy: ${top.title}`, 'info');
        return;
      }
    } catch (e) {
      console.warn('Search geocoding error:', e);
    }

    // 4. Nếu là câu hỏi khác -> mở trợ lý AI
    window.aiChat.open();
    window.aiChat.sendMessage(query);
  }

  // Kích hoạt tìm đường tự động từ Trợ lý AI (không cần gõ tay thủ công)
  async triggerChatRoute(originStr, destStr, avoidLevel = 1) {
    this.toggleDirectionsPanel(true);
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (originInput) originInput.value = originStr;
    if (destInput) destInput.value = destStr;

    this.currentAvoidLevel = avoidLevel;
    // Cập nhật giao diện radio 3 mức độ tránh né
    document.querySelectorAll('.gm-avoidance-option').forEach(o => {
      const lvl = parseInt(o.getAttribute('data-level'));
      if (lvl === avoidLevel) {
        o.classList.add('active');
        const radio = o.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      } else {
        o.classList.remove('active');
      }
    });

    this.showToast(`🚀 AI tự động vẽ lộ trình né ngập: ${originStr} ➔ ${destStr}`, 'info', 4500);

    const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;
    const [origMatches, destMatches] = await Promise.all([
      window.geocodingService.searchAddresses(originStr, { city: this.currentCity, center: cityCenter, limit: 1 }),
      window.geocodingService.searchAddresses(destStr, { city: this.currentCity, center: cityCenter, limit: 1 })
    ]);

    if (origMatches && origMatches.length > 0) this.routeLocations.origin = origMatches[0];
    else this.routeLocations.origin = { title: originStr, fullAddress: originStr, lat: cityCenter.lat, lng: cityCenter.lng };

    if (destMatches && destMatches.length > 0) this.routeLocations.destination = destMatches[0];
    else this.routeLocations.destination = { title: destStr, fullAddress: destStr, lat: cityCenter.lat, lng: cityCenter.lng };

    await this.calculateSmartRoute();
  }

  // Tính toán lộ trình thông minh kết hợp Geocoding ngõ ngách & OSRM
  async calculateSmartRoute() {
    const resultsContainer = document.getElementById('gm-route-results');
    const summaryContainer = document.getElementById('gm-route-summary');
    
    // Hiển thị loading
    if (resultsContainer) {
      const levelConfig = window.routingService.avoidanceLevels[this.currentAvoidLevel];
      resultsContainer.innerHTML = `
        <div style="padding: 16px; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 8px; animation: pulse-ring 1.6s infinite;">🔍</div>
          <div style="font-size: 13px; color: #5f6368;">Đang tìm đường & phân tích ngõ ngách né ngập...</div>
          <div style="font-size: 11px; color: #70757a; margin-top: 4px;">Chế độ: ${levelConfig.icon} ${levelConfig.name}</div>
        </div>
      `;
    }
    if (summaryContainer) summaryContainer.style.display = 'none';

    // 1. Kiểm tra text trong ô input và tự động Geocode nếu cần
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    const originText = originInput?.value.trim();
    const destText = destInput?.value.trim();

    if (!originText || !destText) {
      this.showToast('⚠️ Vui lòng nhập đầy đủ điểm đi và điểm đến', 'warning');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; color: #70757a; font-size: 13px;">
            Vui lòng nhập điểm đi và điểm đến để tìm kiếm lộ trình.
          </div>
        `;
      }
      return;
    }

    const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;

    // Geocode điểm đi nếu chưa có hoặc text thay đổi
    if (!this.routeLocations.origin || (this.routeLocations.origin.fullAddress !== originText && this.routeLocations.origin.title !== originText)) {
      try {
        const matches = await window.geocodingService.searchAddresses(originText, {
          city: this.currentCity,
          center: cityCenter,
          limit: 1
        });
        if (matches && matches.length > 0) {
          this.routeLocations.origin = matches[0];
        }
      } catch (err) {
        console.warn('Geocoding origin error:', err);
      }
    }

    // Geocode điểm đến nếu chưa có hoặc text thay đổi
    if (!this.routeLocations.destination || (this.routeLocations.destination.fullAddress !== destText && this.routeLocations.destination.title !== destText)) {
      try {
        const matches = await window.geocodingService.searchAddresses(destText, {
          city: this.currentCity,
          center: cityCenter,
          limit: 1
        });
        if (matches && matches.length > 0) {
          this.routeLocations.destination = matches[0];
        }
      } catch (err) {
        console.warn('Geocoding dest error:', err);
      }
    }

    let origin = this.routeLocations.origin;
    let dest = this.routeLocations.destination;

    // Nếu vẫn không tìm được tọa độ
    if (!origin || !dest) {
      this.showToast('⚠️ Không tìm thấy địa chỉ cụ thể. Vui lòng bấm chọn gợi ý hoặc bấm "🗺️ Chọn trên bản đồ"', 'warning', 4500);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding: 14px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 6px;">📍</div>
            <div style="color: #d93025; font-size: 13px; font-weight: 500;">Không xác định được địa chỉ</div>
            <div style="color: #70757a; font-size: 12px; margin-top: 4px;">Hãy chọn từ danh sách gợi ý khi gõ hoặc bấm biểu tượng 🗺️ để chọn trực tiếp trên bản đồ.</div>
          </div>
        `;
      }
      return;
    }

    // Cập nhật marker A và B trên bản đồ
    this.updateRouteMarker('origin', origin.lat, origin.lng, origin.title || originText);
    this.updateRouteMarker('dest', dest.lat, dest.lng, dest.title || destText);

    const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
    const cityTraffic = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);

    try {
      const result = await window.routingService.calculateMultiRoutes({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        floodPoints: cityFloods,
        trafficIncidents: cityTraffic,
        vehicleType: this.currentVehicle,
        avoidLevel: this.currentAvoidLevel
      });

      this.lastRouteResult = result;

      // Vẽ tuyến đường lên bản đồ
      this.displayMultiRoutes(result);

      // Render summary bar
      if (summaryContainer) {
        this.renderRouteSummary(summaryContainer, result);
      }

      // Render route cards
      if (resultsContainer) {
        this.renderRouteCards(resultsContainer, result);
      }

      // 🤖 GỢI Ý THÔNG MINH TỰ ĐỘNG (Passive AI - Không tốn lượt API request)
      this.generateSmartSuggestion(result);

    } catch (e) {
      console.error('[Routing Error]', e);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding: 14px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 6px;">😥</div>
            <div style="color: #d93025; font-size: 13px; font-weight: 500;">Lỗi tính toán tuyến đường</div>
            <div style="color: #70757a; font-size: 12px; margin-top: 4px;">${e.message}</div>
            <button onclick="window.appState.calculateSmartRoute()" 
              style="margin-top: 10px; padding: 6px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
              🔄 Thử lại
            </button>
          </div>
        `;
      }
    }
  }

  /**
   * 🤖 GỢI Ý THÔNG MINH TỰ ĐỘNG (PASSIVE AI - KHÔNG TỐN LƯỢT API REQUEST)
   * Phân tích ngữ cảnh: thời gian, phương tiện, thời tiết, ngập, kẹt xe
   * và đưa ra lời khuyên tùy từng trường hợp cụ thể.
   * Chạy 100% logic tất định trên Client, KHÔNG gọi Gemini API.
   */
  generateSmartSuggestion(result) {
    const box = document.getElementById('gm-ai-suggestion');
    if (!box) return;

    const now = new Date();
    const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const vnHour = vnNow.getHours();
    const vnMinute = vnNow.getMinutes();
    const vnDay = vnNow.getDay(); // 0 = CN, 6 = T7
    const timeStr = `${String(vnHour).padStart(2,'0')}:${String(vnMinute).padStart(2,'0')}`;
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[vnDay];
    const dateStr = `${vnNow.getDate()}/${vnNow.getMonth()+1}/${vnNow.getFullYear()}`;

    const vehicle = this.currentVehicle; // 'motorbike' hoặc 'car'
    const vehicleName = vehicle === 'motorbike' ? 'Xe máy' : 'Ô tô';
    const routes = result.routes || [];
    const recommended = routes.find(r => r.isRecommended) || routes[0];
    if (!recommended) { box.style.display = 'none'; return; }

    // Lấy dữ liệu ngập & kẹt xe trong thành phố hiện tại
    const cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity && f.depth_cm > 0 && f.danger_level !== 'safe');
    const cityJams = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity && t.isJam === true);
    const routeFloods = recommended.matchedFloods || [];
    const routeTraffics = recommended.matchedTraffics || [];

    // Lấy thời tiết
    const weatherStations = (this.liveData.weatherStations || {})[this.currentCity] || [];
    const maxRain = weatherStations.reduce((max, s) => Math.max(max, s.rain1h || 0), 0);
    const avgTemp = weatherStations.length > 0
      ? Math.round(weatherStations.reduce((sum, s) => sum + (s.temp || 26), 0) / weatherStations.length)
      : 26;

    // ====== PHÂN TÍCH TÌNH HUỐNG ======
    const isPeakMorning = (vnHour >= 7 && vnHour <= 9);
    const isPeakEvening = (vnHour >= 17 && vnHour <= 19);
    const isPeakHour = isPeakMorning || isPeakEvening;
    const isLateNight = (vnHour >= 22 || vnHour < 5);
    const isEarlyMorning = (vnHour >= 5 && vnHour < 7);
    const isMidday = (vnHour >= 11 && vnHour < 14);
    const isWeekend = (vnDay === 0 || vnDay === 6);
    const isRaining = maxRain >= 1.0;
    const isHeavyRain = maxRain >= 10;
    const isStormRain = maxRain >= 25;
    const hasRouteFlood = routeFloods.length > 0;
    const hasRouteJam = routeTraffics.filter(t => t.isJam).length > 0;
    const hasDeepFlood = routeFloods.some(f => f.depth_cm >= (vehicle === 'motorbike' ? 20 : 35));
    const distKm = parseFloat(recommended.distanceKm) || 5;
    const isLongTrip = distKm > 12;

    // ====== TẠO LỜI KHUYÊN CHÍNH ======
    let mainAdvice = '';
    const details = [];

    // 1. Thời điểm trong ngày
    if (isPeakMorning) {
      mainAdvice = `⏰ Đang là giờ cao điểm sáng (${timeStr}) — Lưu lượng xe rất đông trên các trục chính.`;
      if (vehicle === 'motorbike') {
        details.push({ icon: '🛵', text: `Xe máy nên ưu tiên Tuyến An toàn (🛡️) đi vòng qua các ngõ phố thông thoáng, tránh chen chúc trục đường lớn.` });
      } else {
        details.push({ icon: '🚗', text: `Ô tô nên đi theo Tuyến Cân bằng (⚖️) để tối ưu cự ly. Hạn chế đường nhỏ vì khó quay đầu khi kẹt.` });
      }
    } else if (isPeakEvening) {
      mainAdvice = `⏰ Đang là giờ cao điểm chiều (${timeStr}) — Mật độ phương tiện tan tầm rất lớn.`;
      if (vehicle === 'motorbike') {
        details.push({ icon: '🛵', text: `Xe máy nên chọn Tuyến An toàn (🛡️). Giờ tan tầm xe máy dễ bị kẹt khi trộn với ô tô ở các nút giao lớn.` });
      } else {
        details.push({ icon: '🚗', text: `Ô tô nên chọn Tuyến Cân bằng (⚖️) hoặc chờ sau 19h30 khi lưu lượng giảm rõ rệt.` });
      }
    } else if (isLateNight) {
      mainAdvice = `🌙 Ban đêm (${timeStr}) — Đường phố rất vắng, di chuyển thuận lợi.`;
      details.push({ icon: '⚡', text: `Lúc này mọi tuyến đều thông thoáng. Chọn Tuyến Nhanh nhất (⚡) để tiết kiệm thời gian!` });
      details.push({ icon: '⚠️', text: `Chú ý: Một số đoạn có rào chắn thi công đêm (trải thảm nhựa / sửa cống). Quan sát đèn hiệu.` });
    } else if (isEarlyMorning) {
      mainAdvice = `🌅 Đầu sáng sớm (${timeStr}) — Tầm nhìn hạn chế, đường chưa đông.`;
      details.push({ icon: '⚡', text: `Giao thông thưa thớt, bạn có thể chọn Tuyến Nhanh nhất (⚡). Bật đèn phương tiện sáng rõ!` });
    } else if (isMidday && !isWeekend) {
      mainAdvice = `☀️ Giữa trưa (${timeStr}) — Giao thông nội thành tương đối thoáng.`;
      details.push({ icon: '⚖️', text: `Lượng xe vừa phải. Chọn Tuyến Cân bằng (⚖️) để đi nhanh và không quá xa so với đường thẳng.` });
    } else if (isWeekend && !isPeakHour) {
      mainAdvice = `🎉 ${dayName} (${timeStr}) — Cuối tuần giao thông khá dễ chịu.`;
      details.push({ icon: '⚡', text: `Cuối tuần đường ít xe, chọn Tuyến Nhanh nhất (⚡) hoàn toàn phù hợp!` });
    } else {
      mainAdvice = `📊 ${dayName} ${timeStr} — Lưu lượng giao thông ở mức trung bình.`;
      details.push({ icon: '⚖️', text: `Giao thông ổn định. Tuyến Cân bằng (⚖️) là lựa chọn hợp lý cho khung giờ này.` });
    }

    // 2. Thời tiết & Mưa ngập
    if (isStormRain) {
      details.push({ icon: '⛈️', text: `Mưa xối xả (${maxRain} mm/h)! Bắt buộc chọn Tuyến An toàn (🛡️) né 100% rốn ngập. ${vehicle === 'motorbike' ? 'Xe máy cực kỳ dễ chết máy bugi!' : 'Ô tô gầm thấp nguy cơ thủy kích!'}` });
    } else if (isHeavyRain) {
      details.push({ icon: '🌧️', text: `Đang mưa vừa (${maxRain} mm/h). Các rốn ngập trũng bắt đầu đọng nước 15-20cm. ${vehicle === 'motorbike' ? 'Xe máy nên đi vòng tránh vùng trũng.' : 'Ô tô giữ khoảng cách, giảm tốc qua vũng.'}` });
    } else if (isRaining) {
      details.push({ icon: '🌦️', text: `Mưa nhẹ rải rác (${maxRain} mm/h). Đường hơi trơn, bật đèn và giảm tốc độ.` });
    }
    if (avgTemp >= 37) {
      details.push({ icon: '🌡️', text: `Nhiệt độ cao (${avgTemp}°C). Nếu đi xa hãy nghỉ giữa đường, uống nước đủ. ${vehicle === 'car' ? 'Kiểm tra nước làm mát ô tô.' : ''}` });
    }

    // 3. Ngập trên tuyến
    if (hasDeepFlood) {
      const worstFlood = routeFloods.sort((a,b) => b.depth_cm - a.depth_cm)[0];
      details.push({ icon: '🌊', text: `⚠️ Ngập sâu ${worstFlood.depth_cm}cm tại ${worstFlood.name}. ${vehicle === 'motorbike' ? 'Xe máy KHÔNG THỂ QUA — hệ thống đã tự động bẻ hướng sang đường cao ráo!' : 'Ô tô gầm thấp nguy cơ thủy kích, chọn Tuyến An toàn!'}` });
    } else if (hasRouteFlood) {
      details.push({ icon: '💧', text: `Có điểm ngập nhẹ trên tuyến nhưng vẫn đi được. Giảm tốc khi qua vùng nước đọng.` });
    }

    // 4. Kẹt xe trên tuyến
    if (hasRouteJam) {
      const worstJam = routeTraffics.filter(t => t.isJam).sort((a,b) => (b.delaySeconds||0) - (a.delaySeconds||0))[0];
      const delayMin = worstJam ? Math.round((worstJam.delaySeconds || 300) / 60) : 5;
      details.push({ icon: '🚦', text: `Ùn tắc trên tuyến (trễ ~${delayMin} phút). ${vehicle === 'motorbike' ? 'Xe máy có thể luồn lách, ảnh hưởng nhẹ.' : 'Ô tô nên chuyển sang tuyến ít tắc hơn.'}` });
    }

    // 5. Phương tiện cụ thể
    if (vehicle === 'motorbike') {
      if (isLongTrip) {
        details.push({ icon: '🏍️', text: `Quãng đường ~${distKm}km khá dài cho xe máy. Nếu chở đồ cồng kềnh / nặng, ưu tiên tuyến ít rẽ ngoặt (Tuyến Cân bằng ⚖️).` });
      }
      if (isRaining || isHeavyRain) {
        details.push({ icon: '🧥', text: `Chuẩn bị áo mưa bộ. Tránh đỗ xe ở tầng hầm khu vực trũng.` });
      }
    } else {
      if (isLongTrip) {
        details.push({ icon: '🚗', text: `Quãng đường ~${distKm}km. Ô tô nên đi trục chính rộng, hạn chế ngõ hẹp khó quay đầu.` });
      }
      if (isPeakHour) {
        details.push({ icon: '🅿️', text: `Giờ cao điểm — Cân nhắc bãi đỗ xe tại điểm đến trước khi xuất phát.` });
      }
    }

    // 6. Kết luận tuyến đề xuất
    const recLabel = recommended.avoidLevel === 1 ? '🛡️ An toàn tuyệt đối' : recommended.avoidLevel === 2 ? '⚖️ Cân bằng thông minh' : '⚡ Nhanh nhất';
    details.push({ icon: '✅', text: `<strong>Đề xuất: ${recLabel}</strong> — ${recommended.distanceKm} km, ~${recommended.durationMin} phút (${recommended.trafficDesc}).` });

    // ====== RENDER HTML ======
    const contextTags = [
      { icon: '🕐', text: `${timeStr} ${dayName}` },
      { icon: vehicle === 'motorbike' ? '🛵' : '🚗', text: vehicleName },
      { icon: maxRain >= 1 ? '🌧️' : '☀️', text: maxRain >= 1 ? `Mưa ${maxRain}mm` : `${avgTemp}°C Khô ráo` },
      { icon: '🌊', text: `${cityFloods.length} rốn ngập` },
      { icon: '🚦', text: `${cityJams.length} điểm tắc` }
    ];

    box.innerHTML = `
      <div class="gm-suggestion-header">
        <span class="sug-icon">🤖</span>
        <span>Gợi ý thông minh</span>
        <span class="sug-badge">⚡ Tự động • Không tốn lượt</span>
      </div>
      <div class="gm-suggestion-body">
        <div class="sug-main-advice">${mainAdvice}</div>
        <ul class="sug-detail-list">
          ${details.map(d => `<li><span class="sug-li-icon">${d.icon}</span><span>${d.text}</span></li>`).join('')}
        </ul>
      </div>
      <div class="gm-suggestion-context">
        ${contextTags.map(t => `<span class="ctx-tag"><span class="ctx-icon">${t.icon}</span> ${t.text}</span>`).join('')}
      </div>
      <div class="gm-suggestion-toggle" onclick="this.parentElement.querySelector('.gm-suggestion-body').style.display = this.parentElement.querySelector('.gm-suggestion-body').style.display === 'none' ? 'block' : 'none'; this.textContent = this.textContent.includes('Thu gọn') ? '📖 Xem gợi ý chi tiết' : '📕 Thu gọn'">
        📕 Thu gọn
      </div>
    `;
    box.style.display = 'block';
  }

  // Vẽ đa tuyến đường lên bản đồ (với màu sắc & highlight theo từng chế độ)
  displayMultiRoutes(result) {
    const mapEng = window.mapEngine;
    
    // Xóa các layer route cũ
    if (mapEng.layers.routeSafeOutline) mapEng.map.removeLayer(mapEng.layers.routeSafeOutline);
    if (mapEng.layers.routeSafe) mapEng.map.removeLayer(mapEng.layers.routeSafe);
    if (mapEng.layers.routeDanger) mapEng.map.removeLayer(mapEng.layers.routeDanger);
    
    // Xóa thêm các layer phụ nếu có
    if (mapEng._extraRouteLayers) {
      mapEng._extraRouteLayers.forEach(l => mapEng.map.removeLayer(l));
    }
    mapEng._extraRouteLayers = [];

    const routes = result.routes;
    const recommended = routes.find(r => r.isRecommended) || routes[0];

    // Vẽ các tuyến phụ trước (nằm phía dưới)
    routes.forEach((route, index) => {
      if (route === recommended) return;
      
      const lineColor = route.color || '#70757a';
      
      const line = L.polyline(route.polyline, {
        color: lineColor,
        weight: 5,
        opacity: 0.65,
        dashArray: '6, 8',
        interactive: true
      }).addTo(mapEng.map);

      // Cho phép click trực tiếp lên đường nét đứt trên bản đồ để chọn tuyến đó
      line.on('click', () => {
        this.selectRouteOnMap(index);
      });

      // Bind popup cho route
      line.bindPopup(`
        <div style="font-family: var(--font-family); padding: 4px;">
          <strong style="color: ${lineColor}; font-size: 13px;">${route.label}</strong><br>
          <span style="color: #202124; font-weight: 500;">${route.distanceKm} km • ~${route.durationMin} phút</span><br>
          <span style="color: #5f6368; font-size: 11px;">${route.trafficDesc}</span><br>
          <div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: ${lineColor};">${route.tagText}</div>
          <button onclick="window.appState.selectRouteOnMap(${index})" 
            style="margin-top: 8px; width: 100%; padding: 5px 10px; background: ${lineColor}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
            👉 Chọn tuyến đường này
          </button>
        </div>
      `);

      mapEng._extraRouteLayers.push(line);
    });

    // Vẽ route recommended nổi bật nhất (nằm trên cùng)
    if (recommended) {
      mapEng.layers.routeSafeOutline = L.polyline(recommended.polyline, {
        color: '#ffffff',
        weight: 10,
        opacity: 0.95
      }).addTo(mapEng.map);

      mapEng.layers.routeSafe = L.polyline(recommended.polyline, {
        color: recommended.color || '#1e8e3e',
        weight: 6,
        opacity: 1
      }).addTo(mapEng.map);

      mapEng.layers.routeSafe.bindPopup(`
        <div style="font-family: var(--font-family); padding: 4px;">
          <strong style="color: ${recommended.color}; font-size: 13px;">✓ ${recommended.label} (Đang chọn)</strong><br>
          <span style="color: #202124; font-weight: 600;">${recommended.distanceKm} km • ~${recommended.durationMin} phút</span><br>
          <span style="font-size: 11px; color: #3c4043;">${recommended.trafficDesc}</span><br>
          <div style="margin-top: 4px; font-size: 11px; color: ${recommended.color}; font-weight: 700;">${recommended.tagText}</div>
        </div>
      `);

      mapEng.map.fitBounds(mapEng.layers.routeSafe.getBounds(), { padding: [60, 60] });
    }
  }

  // Render summary bar
  renderRouteSummary(container, result) {
    const { routes } = result;
    const recommended = routes.find(r => r.isRecommended) || routes[0];
    
    let badgeClass = 'badge-safe';
    if (recommended.avoidLevel === 2) badgeClass = 'badge-warning';
    if (recommended.avoidLevel === 3) badgeClass = 'badge-safe';

    container.innerHTML = `
      <span class="gm-summary-badge ${badgeClass}" style="background: ${recommended.color}; color: #fff;">
        Mức ${recommended.avoidLevel}: ${recommended.label}
      </span>
      <span class="gm-summary-text">${recommended.trafficDesc}</span>
    `;
    container.style.display = 'flex';
  }

  // Render route cards phong cách Google Maps kèm thanh phân loại tắc đường trực quan & ngõ ngách
  renderRouteCards(container, result) {
    const { routes } = result;
    let html = '';

    routes.forEach((route, index) => {
      let cardClass = '';
      let labelClass = '';
      let timeClass = '';

      if (route.avoidLevel === 1) {
        cardClass = route.isRecommended ? 'selected-safe' : 'alt-card';
        labelClass = 'gm-route-label-safe';
        timeClass = 'gm-time-safe';
      } else if (route.avoidLevel === 2) {
        cardClass = route.isRecommended ? 'selected-balanced' : 'alt-card';
        labelClass = 'gm-route-label-warning';
        timeClass = 'gm-time-warning';
      } else {
        cardClass = route.isRecommended ? 'selected-fastest' : 'alt-card';
        labelClass = 'gm-route-label-fastest';
        timeClass = 'gm-time-fastest';
      }

      // Render danh sách cảnh báo nếu có
      let warningsHtml = '';
      if (route.warnings && route.warnings.length > 0) {
        const warningItems = route.warnings.slice(0, 3).map(w => {
          const dotClass = w.hazardType === 'flood' ? 'dot-flood' : 'dot-traffic';
          const label = w.hazardType === 'flood' 
            ? `🌊 Ngập ${w.depth_cm}cm - ${w.name}`
            : `🚗 ${w.description || w.categoryName || 'Ùn tắc'}`;
          return `<div class="gm-warning-item"><span class="warn-dot ${dotClass}"></span> ${label}</div>`;
        }).join('');
        
        const moreCount = route.warnings.length - 3;
        warningsHtml = `
          <div class="gm-route-warnings">
            ${warningItems}
            ${moreCount > 0 ? `<div class="gm-warning-item" style="color: #70757a;">+ ${moreCount} cảnh báo khác</div>` : ''}
          </div>
        `;
      }

      // Tính phần trăm thời gian thêm so với đường ngắn nhất
      const shortest = routes.reduce((min, r) => r.durationMin < min.durationMin ? r : min, routes[0]);
      const timeDiff = route.durationMin - shortest.durationMin;
      const timeDiffText = timeDiff > 0 ? `<span style="font-size: 11px; color: #70757a; font-weight: 400;"> (+${timeDiff} phút)</span>` : '';

      // Thanh đánh giá mức độ kẹt xe & ngập nước
      const freeFlow = route.freeFlowPercent !== undefined ? route.freeFlowPercent : 100;
      const moderate = route.moderatePercent !== undefined ? route.moderatePercent : 0;
      const severe = route.severePercent !== undefined ? route.severePercent : 0;
      const jam = route.jamPercent !== undefined ? route.jamPercent : (moderate + severe);

      // Render chi tiết từng bước đi / ngõ ngách (Itinerary)
      let stepsHtml = '';
      if (route.steps && route.steps.length > 0) {
        const stepItems = route.steps.map(s => {
          const trans = this.translateStepInstruction(s);
          return `
            <div class="gm-step-item">
              <span class="gm-step-icon">${trans.icon}</span>
              <div class="gm-step-info">
                <div class="gm-step-instruction">${trans.text}</div>
                <div class="gm-step-distance">${trans.dist}</div>
              </div>
            </div>
          `;
        }).join('');

        stepsHtml = `
          <div class="gm-route-steps-toggle" onclick="event.stopPropagation(); window.appState.toggleRouteSteps(${index})">
            📋 Chi tiết lộ trình & các ngõ ngách (${route.steps.length} bước) ▾
          </div>
          <div class="gm-route-steps-list" id="steps-list-${index}" style="display: none;">
            ${stepItems}
          </div>
        `;
      }

      html += `
        <div class="gm-route-card ${cardClass}" data-route-index="${index}" onclick="window.appState.selectRouteOnMap(${index})">
          ${route.isRecommended ? `<div class="gm-recommended-badge" style="background: ${route.color};">Đang chọn</div>` : ''}
          <div class="gm-route-label ${labelClass}" style="color: ${route.color};">
            ${route.avoidLevel === 1 ? '🛡️' : route.avoidLevel === 2 ? '⚖️' : '⚡'} ${route.label}
          </div>
          <div class="gm-route-time ${timeClass}">
            <span style="color: ${route.color};">~${route.durationMin} phút${timeDiffText}</span>
            <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${route.distanceKm} km)</span>
          </div>
          <div class="gm-route-meta" style="font-size: 12px; color: #3c4043; margin-top: 2px;">${route.trafficDesc}</div>
          
          <!-- Phân loại mức độ tắc đường trực quan (Traffic Congestion Mini-Bar) -->
          <div class="gm-traffic-bar-container">
            <div class="gm-traffic-bar-header">
              <span class="gm-traffic-bar-title">🚦 Đánh giá lưu thông:</span>
              <span class="gm-traffic-bar-ratio" style="color: ${route.color};">
                ${jam === 0 ? '100% Thông thoáng' : `${freeFlow}% thoáng • ${jam}% kẹt`}
              </span>
            </div>
            <div class="gm-traffic-bar">
              <div class="gm-traffic-bar-segment seg-green" style="width: ${freeFlow}%;" title="Thông thoáng: ${freeFlow}%"></div>
              ${moderate > 0 ? `<div class="gm-traffic-bar-segment seg-yellow" style="width: ${moderate}%;" title="Đông nhẹ: ${moderate}%"></div>` : ''}
              ${severe > 0 ? `<div class="gm-traffic-bar-segment seg-red" style="width: ${severe}%;" title="Kẹt cứng: ${severe}%"></div>` : ''}
            </div>
            <div class="gm-traffic-legend">
              <span><span class="gm-traffic-legend-dot dot-green"></span> Thoáng (${freeFlow}%)</span>
              <span><span class="gm-traffic-legend-dot dot-yellow"></span> Đông vừa (${moderate}%)</span>
              <span><span class="gm-traffic-legend-dot dot-red"></span> Kẹt xe (${severe}%)</span>
            </div>
          </div>

          <div class="gm-route-tag ${route.tagClass}" style="margin-top: 6px;">${route.tagText}</div>
          ${warningsHtml}
          ${stepsHtml}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Khi người dùng click vào route card -> highlight tuyến đó trên bản đồ & đồng bộ radio button
  selectRouteOnMap(routeIndex) {
    if (!this.lastRouteResult || !this.lastRouteResult.routes) return;
    const routes = this.lastRouteResult.routes;
    const selectedRoute = routes[routeIndex];
    if (!selectedRoute) return;

    // Đồng bộ mức độ tránh né và radio button trong UI
    this.currentAvoidLevel = selectedRoute.avoidLevel;
    document.querySelectorAll('.gm-avoidance-option').forEach(o => {
      const lvl = parseInt(o.getAttribute('data-level'));
      if (lvl === selectedRoute.avoidLevel) {
        o.classList.add('active');
        const r = o.querySelector('input[type="radio"]');
        if (r) r.checked = true;
      } else {
        o.classList.remove('active');
      }
    });

    // Cập nhật isRecommended trên tất cả các route
    routes.forEach((r, i) => {
      r.isRecommended = (i === routeIndex);
    });

    // Render lại danh sách cards để đổi trạng thái active
    const resultsContainer = document.getElementById('gm-route-results');
    if (resultsContainer) {
      this.renderRouteCards(resultsContainer, this.lastRouteResult);
    }

    // Vẽ lại tuyến trên map
    this.displayMultiRoutes(this.lastRouteResult);

    // Cập nhật summary
    const summaryContainer = document.getElementById('gm-route-summary');
    if (summaryContainer) {
      this.renderRouteSummary(summaryContainer, this.lastRouteResult);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appState = new GoogleMapsApp();
  window.appState.init();
});
