/**
 * App.js - Bộ điều khiển trung tâm trải nghiệm người dùng chuẩn Google Maps
 * MoveSafe VN: Bản đồ toàn màn hình, thanh tìm kiếm nổi, điều hướng né ngập & Vòng lặp cập nhật 24/24 trên Cloud
 */

// Kho dữ liệu các rốn ngập trọng điểm đô thị phục vụ Chế độ Giả lập ngẫu nhiên (Simulation Pool)
const SIMULATION_FLOOD_POOLS = {
  hanoi: [
    {
      name: 'Phố Nguyễn Khuyến (Khu vực trước THCS Lý Thường Kiệt)',
      lat: 21.0280,
      lng: 105.8340,
      source: 'Rốn ngập HSDC Văn Miếu',
      pump_status: 'Trạm bơm dã chiến đang xả'
    },
    {
      name: 'Ngã tư Phan Bội Châu - Lý Thường Kiệt',
      lat: 21.0245,
      lng: 105.8450,
      source: 'Rốn ngập HSDC Hoàn Kiếm',
      pump_status: 'Trạm bơm Yên Sở đang vận hành'
    },
    {
      name: 'Ngã tư Thái Hà - Chùa Bộc',
      lat: 21.0075,
      lng: 105.8245,
      source: 'Rốn trũng ngập Đống Đa',
      pump_status: 'Đang điều tiết thoát nước mương Chùa Bộc'
    },
    {
      name: 'Phố Thụy Khuê (Đoạn dốc La Pho - Tam Đa)',
      lat: 21.0435,
      lng: 105.8260,
      source: 'Rốn ngập ven Hồ Tây',
      pump_status: 'Trạm bơm Thụy Khuê đang vận hành'
    },
    {
      name: 'Hầm chui Đại lộ Thăng Long (Số 3 & Km9+656)',
      lat: 20.9965,
      lng: 105.7485,
      source: 'Hầm chui ngập sâu Nam Từ Liêm',
      pump_status: 'Máy bơm công suất lớn hầm chui đang xả'
    },
    {
      name: 'Phố Hoa Bằng (Đoạn qua ngõ 99)',
      lat: 21.0261,
      lng: 105.7947,
      source: 'Vùng trũng Cầu Giấy',
      pump_status: 'Đang khơi thông dòng chảy'
    },
    {
      name: 'Đường Cầu Giấy (Đoạn trước Đại học GTVT)',
      lat: 21.0312,
      lng: 105.8015,
      source: 'Điểm trũng giao thông Cầu Giấy',
      pump_status: 'Cống hộp đang xả'
    },
    {
      name: 'Phố Minh Khai (Chân cầu Vĩnh Tuy)',
      lat: 20.9992,
      lng: 105.8678,
      source: 'Trục giao thông Hai Bà Trưng',
      pump_status: 'Máy bơm đang hoạt động'
    },
    {
      name: 'Phố Vương Thừa Vũ - Hoàng Văn Thái',
      lat: 20.9995,
      lng: 105.8235,
      source: 'Vùng trũng Thanh Xuân',
      pump_status: 'Đang bơm xả ra sông Tô Lịch'
    },
    {
      name: 'Ngã tư Lê Văn Lương - Hoàng Đạo Thúy',
      lat: 21.0052,
      lng: 105.8028,
      source: 'Nút giao ngập Thanh Xuân',
      pump_status: 'Cửa van hồ điều hòa đang mở'
    },
    {
      name: 'Phố Trần Bình (Sau Bến xe Mỹ Đình)',
      lat: 21.0335,
      lng: 105.7760,
      source: 'Rốn ngập Nam Từ Liêm',
      pump_status: 'Trạm bơm dã chiến đang ép nước'
    },
    {
      name: 'Đường Phạm Hùng (Trước tòa nhà Keangnam)',
      lat: 21.0175,
      lng: 105.7842,
      source: 'Trục Vành Đai 3',
      pump_status: 'Đang vận hành trạm bơm Cầu Bươu'
    },
    {
      name: 'Đường Tố Hữu (Đoạn Lương Thế Vinh - Trung Văn)',
      lat: 20.9942,
      lng: 105.7892,
      source: 'Trục hướng tâm Nam Từ Liêm',
      pump_status: 'Cửa cống thoát nước đang xả'
    },
    {
      name: 'Đường Giải Phóng (Trước cổng Bến xe Giáp Bát)',
      lat: 20.9832,
      lng: 105.8425,
      source: 'Cửa ngõ phía Nam Hoàng Mai',
      pump_status: 'Trạm bơm Yên Sở đang xả hết công suất'
    }
  ],
  hcm: [
    {
      name: 'Đường Huỳnh Tấn Phát (Quận 7 - Gần cầu Phú Mỹ)',
      lat: 10.7412,
      lng: 106.7389,
      source: 'Vùng trũng triều cường Quận 7',
      pump_status: 'Trạm bơm Phú Xuân đang xả'
    },
    {
      name: 'Đường Quốc Hương - Thảo Điền (TP. Thủ Đức)',
      lat: 10.8052,
      lng: 106.7351,
      source: 'Rốn ngập bán đảo Thảo Điền',
      pump_status: 'Máy bơm dã chiến công suất lớn đang hút'
    },
    {
      name: 'Đường Nguyễn Văn Quá (Quận 12)',
      lat: 10.8421,
      lng: 106.6289,
      source: 'Vùng trũng Quận 12',
      pump_status: 'Cống hộp đang xả tối đa'
    },
    {
      name: 'Đường Trần Xuân Soạn (Quận 7 - Dọc Kênh Tẻ)',
      lat: 10.7558,
      lng: 106.7082,
      source: 'Điểm tràn bờ kênh Tẻ',
      pump_status: 'Van ngăn triều đang đóng'
    },
    {
      name: 'Đường Ung Văn Khiêm (Bình Thạnh - Gần Bến xe Miền Đông)',
      lat: 10.8068,
      lng: 106.7198,
      source: 'Rốn ngập Bình Thạnh',
      pump_status: 'Trạm bơm Thanh Đa đang vận hành'
    },
    {
      name: 'Đường Lê Đức Thọ (Gò Vấp)',
      lat: 10.8415,
      lng: 106.6712,
      source: 'Vùng trũng Gò Vấp',
      pump_status: 'Đang mở cửa xả rạch Tham Lương'
    },
    {
      name: 'Đường Võ Văn Ngân (TP. Thủ Đức)',
      lat: 10.8505,
      lng: 106.7625,
      source: 'Dốc ngập nước xiết Thủ Đức',
      pump_status: 'Cống thoát dốc đang dẫn nước'
    },
    {
      name: 'Vòng xoay An Lạc (Bình Tân)',
      lat: 10.7242,
      lng: 106.6115,
      source: 'Cửa ngõ miền Tây',
      pump_status: 'Đang mở van tiêu thoát nước'
    }
  ],
  danang: [
    {
      name: 'Nút giao Hàm Nghi - Nguyễn Văn Linh (Thanh Khê)',
      lat: 16.0615,
      lng: 108.2140,
      source: 'Rốn trũng trung tâm Đà Nẵng',
      pump_status: 'Trạm bơm Hồ Thạc Gián xả nước'
    },
    {
      name: 'Đường Mẹ Suốt (Liên Chiểu)',
      lat: 16.0592,
      lng: 108.1583,
      source: 'Vùng trũng chân đồi Mẹ Suốt',
      pump_status: 'Lực lượng chức năng đang chốt chặn cảnh báo'
    },
    {
      name: 'Đường Nguyễn Văn Thoại (Ngũ Hành Sơn - Gần biển)',
      lat: 16.0528,
      lng: 108.2435,
      source: 'Trục ven biển Ngũ Hành Sơn',
      pump_status: 'Cửa xả biển đang mở'
    },
    {
      name: 'Nút giao Lê Duẩn - Chi Lăng (Hải Châu)',
      lat: 16.0695,
      lng: 108.2185,
      source: 'Khu vực trung tâm Hải Châu',
      pump_status: 'Cống ngầm đang điều tiết'
    },
    {
      name: 'Đường Trưng Nữ Vương (Hải Châu)',
      lat: 16.0535,
      lng: 108.2192,
      source: 'Trục nội thành Hải Châu',
      pump_status: 'Trạm bơm đang dẫn dòng'
    }
  ]
};

class GoogleMapsApp {
  constructor() {
    this.currentCity = 'hanoi';
    this.citiesConfig = {
      hanoi: { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, zoom: 14.2 },
      hcm: { name: 'TP. Hồ Chí Minh', lat: 10.7769, lng: 106.7008, zoom: 14.2 },
      danang: { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, zoom: 14.2 }
    };
    this.liveData = {
      floodPoints: [],
      trafficIncidents: [],
      vovTrafficNews: [],
      weatherAlerts: []
    };
    // Chế độ Giả lập / Dữ liệu thật: Mặc định luôn là FALSE (Dữ liệu thật 100%)
    this.isSimulationMode = false;
    this.simulatedFloods = []; // Danh sách các rốn ngập ngẫu nhiên đang được mô phỏng
    this.simulatedCity = null;

    this.currentVehicle = 'motorbike';
    this.currentAvoidLevel = 1; // Mức độ tránh né mặc định: An toàn tuyệt đối
    this.isDirectionsOpen = false;
    this.activeFilter = 'all';

    // Trạng thái tọa độ & địa chỉ ngõ ngách thực tế
    this.routeLocations = {
      origin: null,
      destination: null
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

    // AI Prediction State
    this.currentPredictionOffset = 0;
    this.predictionOverlay = { floodPoints: [], trafficIncidents: [] };
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
    this.initQuickCommutePresets();

    // 6. Kích hoạt động cơ tự động đồng bộ 24/24 trên Cloud
    this.start247CloudSync();

    // 7. Tự động khôi phục lộ trình chia sẻ từ URL (nếu người dùng mở từ link chia sẻ)
    this.checkSharedRouteFromUrl();

    console.log('[MoveSafe Cloud 24/7] Đã kích hoạt hoàn tất vòng lặp cập nhật liên tục 24/24!');
  }

  async fetchServerConfig() {
    const savedTomTom = localStorage.getItem('movesafe_tomtom_key');
    const savedOwm = localStorage.getItem('movesafe_owm_key');

    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          const tomtomKey = savedTomTom || data.apiKeys.tomtom;
          const owmKey = savedOwm || data.apiKeys.openweather;
          if (tomtomKey) window.mapEngine.setTomTomKey(tomtomKey);
          if (owmKey) window.weatherService.setApiKey(owmKey);
          if (data.cities) this.citiesConfig = data.cities;
          return;
        }
      }
    } catch (e) {
      console.warn('Chạy chế độ Static Web (GitHub Pages):', e.message);
    }
    // Khóa dự phòng khi chạy tĩnh trên GitHub Pages
    window.mapEngine.setTomTomKey(savedTomTom || 'dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF');
    if (savedOwm) window.weatherService.setApiKey(savedOwm);
  }

  async fetchLiveData() {
    // 0. Tối ưu tốc độ tải tức thì cho thiết bị: Nạp ngay từ LocalStorage để không phải chờ mạng (0ms latency)
    if (!this._hasInitialRendered) {
      try {
        const cached = localStorage.getItem('movesafe_cached_livedata');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.floodPoints)) {
            parsed.floodPoints = parsed.floodPoints.filter(f => f.name !== 'Ngã tư Tràng Tiền - Hàng Bài');
            this.liveData = parsed;
            this.renderAllData();
            this._hasInitialRendered = true;
          }
        }
      } catch (err) {}
    }

    // Tối ưu làm mới: Gom nhóm theo chu kỳ 30 giây để tận dụng bộ nhớ đệm HTTP
    const cacheBucket = Math.floor(Date.now() / 30000);
    const cacheBuster = `?v=${cacheBucket}`;
    let fetchedData = null;

    // 1. Thử gọi backend Node.js
    try {
      const res = await fetch('/api/live-data' + cacheBuster);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          fetchedData = json.data;
        }
      }
    } catch (e) {}

    // 2. Fallback tự động đọc file JSON tĩnh khi chạy trên GitHub Pages (chống dính cache trình duyệt)
    if (!fetchedData) {
      try {
        const res = await fetch('data/live_urban_cache.json' + cacheBuster);
        if (res.ok) {
          fetchedData = await res.json();
        }
      } catch (e) {
        console.error('Không thể nạp dữ liệu cache:', e);
      }
    }

    if (fetchedData) {
      if (Array.isArray(fetchedData.floodPoints)) {
        fetchedData.floodPoints = fetchedData.floodPoints.filter(f => f.name !== 'Ngã tư Tràng Tiền - Hàng Bài');
      }
      this.liveData = fetchedData;
      this._hasInitialRendered = true;
      try {
        localStorage.setItem('movesafe_cached_livedata', JSON.stringify(fetchedData));
      } catch (e) {}

      // Hợp nhất các báo cáo người dùng đã gửi từ localStorage
      if (window.crowdsourceService && typeof window.crowdsourceService.getLocalReports === 'function') {
        const localReports = window.crowdsourceService.getLocalReports();
        if (Array.isArray(localReports) && localReports.length > 0) {
          if (!this.liveData.floodPoints) this.liveData.floodPoints = [];
          if (!this.liveData.trafficIncidents) this.liveData.trafficIncidents = [];

          localReports.forEach(report => {
            if (report.type === 'flood') {
              if (!this.liveData.floodPoints.some(f => f.id === report.id)) {
                this.liveData.floodPoints.unshift(report);
              }
            } else {
              if (!this.liveData.trafficIncidents.some(t => t.id === report.id)) {
                this.liveData.trafficIncidents.unshift(report);
              }
            }
          });
        }
      }

      this.renderAllData();
    }
  }

  // Sinh kịch bản giả lập ngập ngẫu nhiên: Vị trí ngẫu nhiên + Mức ngập ngẫu nhiên
  generateRandomSimulatedFloods(city = this.currentCity) {
    const pool = SIMULATION_FLOOD_POOLS[city] || SIMULATION_FLOOD_POOLS.hanoi;
    // Xáo trộn ngẫu nhiên thứ tự các rốn ngập trong hồ dữ liệu
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    
    // Chọn ngẫu nhiên từ 3 đến 6 điểm ngập
    const maxCount = Math.min(pool.length, 6);
    const minCount = Math.min(pool.length, 3);
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    const selected = shuffled.slice(0, count);

    // Dải độ sâu ngập ngẫu nhiên: 15cm đến 50cm (mức ngập đô thị thực tế)
    const depths = [15, 20, 25, 30, 35, 40, 45, 50];

    const generated = selected.map((item, idx) => {
      // Random độ sâu ngập
      const depth_cm = depths[Math.floor(Math.random() * depths.length)];
      
      let danger_level = 'medium';
      let passable_motorbike = false;
      let passable_car = false;
      let advice = '';

      if (depth_cm < 20) {
        danger_level = 'low';
        passable_motorbike = true;
        passable_car = true;
        advice = `Kịch bản giả lập ngẫu nhiên: Ngập nhẹ ~${depth_cm}cm mép đường. Phương tiện đi chậm quan sát.`;
      } else if (depth_cm <= 30) {
        danger_level = 'medium';
        passable_motorbike = false;
        passable_car = true;
        advice = `Kịch bản giả lập ngẫu nhiên: Ngập ~${depth_cm}cm (nửa bánh xe). Xe máy nguy cơ chết máy, ô tô gầm cao đi được.`;
      } else {
        danger_level = 'critical';
        passable_motorbike = false;
        passable_car = false;
        advice = `Kịch bản giả lập ngẫu nhiên: Ngập sâu ${depth_cm}cm vượt gầm xe! Nguy cơ thủy kích ô tô xăng. Tuyệt đối rẽ vòng né ngập!`;
      }

      return {
        id: `sim-${city}-${Date.now()}-${idx + 1}`,
        name: item.name,
        city,
        lat: item.lat,
        lng: item.lng,
        depth_cm,
        danger_level,
        passable_motorbike,
        passable_car,
        isSimulated: true,
        source: `Kịch bản Giả lập Ngẫu nhiên (${item.source})`,
        pump_status: item.pump_status,
        advice,
        updated_at: new Date().toISOString()
      };
    });

    this.simulatedFloods = generated;
    this.simulatedCity = city;
    return generated;
  }

  // Lấy danh sách điểm ngập mô phỏng ngẫu nhiên
  getSimulatedFloods(city = this.currentCity) {
    if (!this.simulatedFloods || this.simulatedFloods.length === 0 || this.simulatedCity !== city) {
      this.generateRandomSimulatedFloods(city);
    }
    return this.simulatedFloods;
  }

  // Đổi kịch bản ngẫu nhiên: Xáo trộn vị trí điểm ngập và mức ngập mới tức thì
  rerollSimulation() {
    if (!this.isSimulationMode) {
      this.setSimulationMode(true);
      return;
    }
    const newFloods = this.generateRandomSimulatedFloods(this.currentCity);
    this.renderAllData();
    if (this.isDirectionsOpen) {
      this.calculateSmartRoute();
    }
    const depths = newFloods.map(f => f.depth_cm);
    const minD = Math.min(...depths);
    const maxD = Math.max(...depths);
    const cityName = this.citiesConfig[this.currentCity] ? this.citiesConfig[this.currentCity].name : this.currentCity;
    this.showToast(`Đã đổi kịch bản ngẫu nhiên: ${newFloods.length} rốn ngập (${minD}cm - ${maxD}cm) tại ${cityName}!`, 'warning', 4500);
  }

  // Lấy toàn bộ rốn ngập hiện tại (bao gồm kịch bản mô phỏng hoặc dự báo AI nếu đang xem +1h/+2h/+3h)
  getCurrentFloods() {
    if (this.currentPredictionOffset > 0 && this.predictionOverlay) {
      return this.predictionOverlay.floodPoints || [];
    }
    let floods = (this.liveData.floodPoints || []).filter(f => f.city === this.currentCity);
    if (this.isSimulationMode) {
      const simFloods = this.getSimulatedFloods(this.currentCity);
      floods = [...simFloods, ...floods];
    }
    return floods;
  }

  // Lấy danh sách sự cố giao thông hiện tại (hoặc theo dự báo AI nếu đang xem +1h/+2h/+3h)
  getCurrentTraffics() {
    if (this.currentPredictionOffset > 0 && this.predictionOverlay) {
      return this.predictionOverlay.trafficIncidents || [];
    }
    return (this.liveData.trafficIncidents || []).filter(t => t.city === this.currentCity);
  }

  // Chuyển đổi trạng thái Chế độ Giả lập / Dữ liệu thật
  setSimulationMode(enabled, showToast = true) {
    this.isSimulationMode = !!enabled;

    if (this.isSimulationMode) {
      // Tạo kịch bản ngẫu nhiên mới mỗi lần bật
      this.generateRandomSimulatedFloods(this.currentCity);
    }

    // 1. Cập nhật các phần tử giao diện
    const chkMode = document.getElementById('chk-simulation-mode');
    const chkLayer = document.getElementById('chk-layer-simulation');
    const container = document.getElementById('mode-toggle-container');
    const badge = document.getElementById('mode-status-badge');
    const banner = document.getElementById('gm-simulation-banner');

    if (chkMode) chkMode.checked = this.isSimulationMode;
    if (chkLayer) chkLayer.checked = this.isSimulationMode;

    if (container) {
      container.classList.toggle('sim-active', this.isSimulationMode);
    }

    if (badge) {
      const modeText = badge.querySelector('.mode-text');
      if (modeText) {
        modeText.textContent = this.isSimulationMode ? 'Giả lập ngẫu nhiên' : 'Dữ liệu thật';
      }
    }

    if (banner) {
      banner.style.display = this.isSimulationMode ? 'flex' : 'none';
      const bannerText = document.getElementById('gm-sim-banner-text');
      if (bannerText && this.isSimulationMode && this.simulatedFloods.length > 0) {
        const depths = this.simulatedFloods.map(f => f.depth_cm);
        const minD = Math.min(...depths);
        const maxD = Math.max(...depths);
        bannerText.innerHTML = `<strong>Chế độ Giả lập ngẫu nhiên:</strong> Đang mô phỏng ${this.simulatedFloods.length} rốn ngập (${minD}cm - ${maxD}cm) ngẫu nhiên để thử nghiệm thuật toán né ngập.`;
      }
    }

    // 2. Vẽ lại toàn bộ dữ liệu trên bản đồ
    this.renderAllData();

    // 3. Nếu bảng chỉ đường đang mở, tự động tính toán lại lộ trình né ngập
    if (this.isDirectionsOpen) {
      this.calculateSmartRoute();
    }

    // 4. Thông báo Toast chuyên nghiệp
    if (showToast) {
      if (this.isSimulationMode) {
        const depths = this.simulatedFloods.map(f => f.depth_cm);
        const minD = Math.min(...depths);
        const maxD = Math.max(...depths);
        this.showToast(`Đã bật Chế độ Giả lập ngẫu nhiên: ${this.simulatedFloods.length} rốn ngập (${minD}cm - ${maxD}cm) để thử nghiệm thuật toán né ngập!`, 'warning', 4500);
      } else {
        this.showToast('Đã chuyển về Dữ liệu thật: 100% dữ liệu thời gian thực từ TomTom và trạm khí tượng.', 'info', 4000);
      }
    }
  }

  updateStatsCounters() {
    let cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
    if (this.isSimulationMode) {
      const simFloods = this.getSimulatedFloods(this.currentCity);
      cityFloods = [...simFloods, ...cityFloods];
    }
    let cityTraffics = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);

    // Nếu đang áp dụng dự báo tương lai (+1h/+2h/+3h), hiển thị trạng thái của tương lai
    if (this.currentPredictionOffset > 0 && this.predictionOverlay) {
      cityFloods = this.predictionOverlay.floodPoints || [];
      cityTraffics = this.predictionOverlay.trafficIncidents || [];
    }

    // Cập nhật số lượng trên các chip: Chỉ đếm các điểm ngập đang hoạt động (depth > 0 và danger_level !== 'safe')
    const activeFloods = cityFloods.filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
    const floodChip = document.getElementById('chip-flood-count');
    const trafficChip = document.getElementById('chip-traffic-count');
    const setChipText = (chip, text, className) => {
      if (!chip) return;
      if (className) chip.className = className;
      const textSpan = chip.querySelector('.chip-text');
      if (textSpan) {
        textSpan.textContent = text;
      } else {
        chip.textContent = text;
      }
    };

    if (floodChip) {
      if (this.currentPredictionOffset > 0) {
        if (activeFloods.length > 0) {
          setChipText(floodChip, `Dự báo ngập (${activeFloods.length} • +${this.currentPredictionOffset}h)`, 'gm-chip gm-chip-danger active');
        } else {
          setChipText(floodChip, `Dự báo ngập (0 • +${this.currentPredictionOffset}h)`, 'gm-chip gm-chip-safe');
        }
      } else if (activeFloods.length > 0) {
        if (this.isSimulationMode) {
          setChipText(floodChip, `Rốn ngập (${activeFloods.length} - Giả lập)`, 'gm-chip gm-chip-warning active');
        } else {
          setChipText(floodChip, `Rốn ngập (${activeFloods.length})`, 'gm-chip gm-chip-danger');
        }
      } else {
        setChipText(floodChip, 'Rốn ngập (0 - Khô ráo)', 'gm-chip gm-chip-safe');
      }
    }
    if (trafficChip) {
      const activeJams = cityTraffics.filter(t => t.isJam === true);
      const roadworks = cityTraffics.filter(t => t.type === 'roadwork' || t.type === 'road_closure');

      if (this.currentPredictionOffset > 0) {
        if (activeJams.length > 0) {
          setChipText(trafficChip, `Kẹt xe (${activeJams.length} • +${this.currentPredictionOffset}h)`, 'gm-chip gm-chip-danger active');
        } else if (roadworks.length > 0) {
          setChipText(trafficChip, `Thông thoáng (+${this.currentPredictionOffset}h) • Công trường (${roadworks.length})`, 'gm-chip gm-chip-safe');
        } else {
          setChipText(trafficChip, `Thông thoáng (+${this.currentPredictionOffset}h)`, 'gm-chip gm-chip-safe');
        }
      } else if (activeJams.length > 0) {
        setChipText(trafficChip, `Kẹt xe (${activeJams.length})`, 'gm-chip gm-chip-danger');
      } else if (roadworks.length > 0) {
        setChipText(trafficChip, `Ùn tắc (0) • Công trường (${roadworks.length})`, 'gm-chip gm-chip-safe');
      } else {
        setChipText(trafficChip, 'Ùn tắc (0 - Thông thoáng)', 'gm-chip gm-chip-safe');
      }
    }
  }

  renderAllData() {
    let cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
    let cityTraffics = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);

    // Bổ sung các điểm ngập mô phỏng nếu đang bật Chế độ Giả lập
    if (this.isSimulationMode) {
      const simFloods = this.getSimulatedFloods(this.currentCity);
      cityFloods = [...simFloods, ...cityFloods];
    }

    // Nếu đang áp dụng dự báo tương lai (+1h/+2h/+3h), thay thế bằng trạng thái tương lai (không dồn ứ các điểm quá khứ đã tan)
    if (this.currentPredictionOffset > 0 && this.predictionOverlay) {
      cityFloods = this.predictionOverlay.floodPoints || [];
      cityTraffics = this.predictionOverlay.trafficIncidents || [];
    }

    // Vẽ lên bản đồ
    window.mapEngine.renderFloodPoints(cityFloods);
    window.mapEngine.renderTrafficIncidents(cityTraffics);

    this.updateStatsCounters();
  }

  // Cập nhật widget thời tiết trung tâm (góc dưới trái)
  async updateWeather() {
    const city = this.citiesConfig[this.currentCity];
    const w = await window.weatherService.getWeather(city.lat, city.lng, city.name);

    const pillText = document.getElementById('weather-pill-text');
    const pillDot = document.getElementById('weather-risk-dot');

    if (pillText) {
      pillText.innerHTML = `<strong>${city.name} ${w.temp}°C</strong> • Mưa: ${w.rain1h}mm • ${w.floodRisk.text}`;
    }

    const pillIcon = document.querySelector('#gm-weather-pill .weather-pill-icon');
    if (pillIcon && window.getSvgIcon) {
      const iconHtml = window.getSvgIcon(w.rain1h > 0 ? 'cloud-rain' : 'cloud-sun', 'weather-pill-icon', 18);
      pillIcon.outerHTML = iconHtml;
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
        badge.textContent = `${this.remainingSeconds}s`;
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

    // 1. Tải dữ liệu rốn ngập & kẹt xe mới nhất (nếu SSE đang kết nối ổn định thì không cần poll lại API)
    if (!this.isSseConnected || isManualOrFocus) {
      await this.fetchLiveData();
    }

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
      this.showToast('Hệ thống vừa cập nhật thêm điểm ngập mới!', 'warning');
    } else if (isManualOrFocus) {
      this.showToast('Đã đồng bộ dữ liệu thời tiết & giao thông mới nhất từ Cloud 24/7!', 'info');
    }

    this.lastSyncTime = Date.now();
  }

  connectCloudStream() {
    if (!window.EventSource) return;
    try {
      const sse = new EventSource('/api/live-stream');
      let isInitialConnect = true;

      sse.onopen = () => {
        isInitialConnect = false;
        this.isSseConnected = true;
      };

      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.data) {
            this.liveData = payload.data;
            this.renderAllData();
            // Reset đếm ngược 30s khi nhận cập nhật realtime
            this.remainingSeconds = this.syncIntervalSeconds;
            // Chỉ hiển thị toast khi có gói update mới, không hiện với gói init
            if (payload.type === 'update') {
              this.showToast('Cập nhật dữ liệu thời gian thực từ Cloud Server!', 'info', 3000);
            }
          }
        } catch (e) {}
      };

      sse.onerror = () => {
        this.isSseConnected = false;
        // Trên GitHub Pages tĩnh (không có backend Node), đóng SSE sau lần đầu thất bại
        if (isInitialConnect) {
          sse.close();
        }
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
      <button style="background: none; border: none; color: #fff; opacity: 0.7; cursor: pointer; font-size: 13px; font-weight: 600; line-height: 1;">Đóng</button>
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

  setMobileActiveTab(tabName) {
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  toggleDirectionsPanel(forceState) {
    const panel = document.getElementById('gm-directions-panel');
    const searchBox = document.getElementById('gm-search-box');
    const chips = document.getElementById('gm-chips-scroll');
    const isMobile = window.innerWidth <= 768;

    this.isDirectionsOpen = forceState !== undefined ? forceState : !this.isDirectionsOpen;

    if (this.isDirectionsOpen) {
      panel.classList.add('open');
      panel.classList.remove('sheet-minimized');
      if (!isMobile) {
        if (searchBox) searchBox.style.display = 'none';
        if (chips) chips.style.display = 'none';
      }
      this.setMobileActiveTab('route');
    } else {
      panel.classList.remove('open');
      panel.classList.remove('sheet-minimized');
      if (searchBox) searchBox.style.display = 'flex';
      if (chips) chips.style.display = 'flex';
      this.setMobileActiveTab('explore');
    }
  }

  bindEvents() {
    // 1. Nút chỉ đường
    document.getElementById('btn-open-directions')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(true);
      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      if (originInput?.value.trim() && destInput?.value.trim()) {
        this.calculateSmartRoute();
      }
    });

    document.getElementById('btn-close-directions')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(false);
    });

    // 1b. Thanh kéo thu gọn/mở rộng Bottom Sheet trên điện thoại
    const sheetHandle = document.getElementById('directions-sheet-handle');
    if (sheetHandle) {
      sheetHandle.addEventListener('click', () => {
        const panel = document.getElementById('gm-directions-panel');
        if (panel) panel.classList.toggle('sheet-minimized');
      });

      let touchStartY = 0;
      sheetHandle.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      sheetHandle.addEventListener('touchend', (e) => {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const panel = document.getElementById('gm-directions-panel');
        if (!panel) return;
        if (deltaY > 35) {
          // Vuốt xuống -> thu gọn
          panel.classList.add('sheet-minimized');
        } else if (deltaY < -35) {
          // Vuốt lên -> mở rộng
          panel.classList.remove('sheet-minimized');
        }
      }, { passive: true });
    }

    // 1c. Thanh điều hướng dưới cùng cho Điện thoại (Mobile Bottom Navigation Bar)
    document.getElementById('mnav-explore')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(false);
      window.aiChat?.close();
      document.getElementById('modal-report')?.classList.remove('open');
      document.getElementById('modal-urban-insights')?.classList.remove('open');
      this.setMobileActiveTab('explore');
    });

    document.getElementById('mnav-route')?.addEventListener('click', () => {
      window.aiChat?.close();
      document.getElementById('modal-report')?.classList.remove('open');
      document.getElementById('modal-urban-insights')?.classList.remove('open');
      this.toggleDirectionsPanel(true);
      this.calculateSmartRoute();
    });

    document.getElementById('mnav-report')?.addEventListener('click', () => {
      document.getElementById('modal-report')?.classList.add('open');
    });

    document.getElementById('mnav-ai')?.addEventListener('click', () => {
      this.toggleDirectionsPanel(false);
      document.getElementById('modal-report')?.classList.remove('open');
      document.getElementById('modal-urban-insights')?.classList.remove('open');
      window.aiChat?.toggle();
      if (window.aiChat?.isOpen) {
        this.setMobileActiveTab('ai');
      } else {
        this.setMobileActiveTab('explore');
      }
    });

    document.getElementById('mnav-insights')?.addEventListener('click', () => {
      window.aiChat?.close();
      this.openUrbanInsightsModal();
      this.setMobileActiveTab('insights');
    });

    // 2. Ô tìm kiếm chính & Gợi ý địa chỉ thông minh (Autocomplete) & Nút Xóa nhanh
    const searchInput = document.getElementById('gm-search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const mainDropdown = document.getElementById('dropdown-main-search');
    let mainSearchDebounce = null;

    searchInput?.addEventListener('input', () => {
      const val = searchInput.value.trim();
      if (btnClearSearch) {
        btnClearSearch.style.display = val.length > 0 ? 'inline-flex' : 'none';
      }
      clearTimeout(mainSearchDebounce);
      if (val.length < 2) {
        if (mainDropdown) mainDropdown.style.display = 'none';
        return;
      }
      mainSearchDebounce = setTimeout(() => {
        this.renderMainSearchSuggestions(val);
      }, 240);
    });

    searchInput?.addEventListener('focus', () => {
      const val = searchInput.value.trim();
      if (val.length >= 2) {
        this.renderMainSearchSuggestions(val);
      }
    });

    btnClearSearch?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      btnClearSearch.style.display = 'none';
      if (mainDropdown) mainDropdown.style.display = 'none';
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (mainDropdown) mainDropdown.style.display = 'none';
        this.handleSearch(searchInput.value.trim());
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        if (btnClearSearch) btnClearSearch.style.display = 'none';
        if (mainDropdown) mainDropdown.style.display = 'none';
        searchInput.blur();
      }
    });

    document.getElementById('btn-search-trigger')?.addEventListener('click', () => {
      if (mainDropdown) mainDropdown.style.display = 'none';
      this.handleSearch(searchInput?.value.trim() || '');
    });

    document.addEventListener('click', (e) => {
      if (mainDropdown && !e.target.closest('#gm-search-box')) {
        mainDropdown.style.display = 'none';
      }
    });

    // 3. Category Chips
    document.getElementById('chip-weather-toggle')?.addEventListener('click', () => {
      const city = this.citiesConfig[this.currentCity];
      const currentZoom = window.mapEngine.map.getZoom();

      if (currentZoom < 12) {
        window.mapEngine.map.flyTo([city.lat, city.lng], 13);
        this.showToast(`Phóng to vào ${city.name} để xem chi tiết thời tiết & mưa từng phường!`, 'info', 4000);
      } else {
        const nextState = !window.mapEngine.weatherVisible;
        window.mapEngine.toggleWeather(nextState);
        const chkWeather = document.getElementById('chk-layer-weather');
        if (chkWeather) chkWeather.checked = nextState;
        const chip = document.getElementById('chip-weather-toggle');
        if (nextState) {
          chip?.classList.add('active');
          this.showToast(`Đã bật hiển thị thời tiết các phường`, 'info');
        } else {
          chip?.classList.remove('active');
          this.showToast(`Đã ẩn trạm thời tiết các phường`, 'info');
        }
      }
    });

    document.getElementById('chip-flood-count')?.addEventListener('click', () => {
      const activeFloods = this.getCurrentFloods().filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');

      if (activeFloods.length > 0) {
        // Có ngập: Bay camera đến điểm ngập sâu nhất
        const worst = [...activeFloods].sort((a, b) => (b.depth_cm || 0) - (a.depth_cm || 0))[0];
        window.mapEngine.map.flyTo([worst.lat, worst.lng], 16);
        const prefix = this.currentPredictionOffset > 0 ? `[Dự báo +${this.currentPredictionOffset}h]` : (this.isSimulationMode ? '[Kịch bản Giả lập]' : 'Cảnh báo:');
        this.showToast(`${prefix} Đang theo dõi rốn ngập sâu: ${worst.name} (${worst.depth_cm}cm)`, 'danger');
      } else {
        // Khô ráo, nước đã rút
        this.showToast(this.currentPredictionOffset > 0
          ? `AI Dự báo sau +${this.currentPredictionOffset}h: Toàn thành phố khô ráo, không có điểm ngập úng.`
          : 'Toàn thành phố hiện tại tạnh ráo! Nước tại các rốn ngập đã rút hoàn toàn, lưu thông an toàn.', 'info', 5000);
      }
    });

    document.getElementById('chip-traffic-count')?.addEventListener('click', () => {
      const cityTraffics = this.getCurrentTraffics();
      const activeJams = cityTraffics.filter(t => t.isJam === true);

      if (activeJams.length > 0) {
        window.mapEngine.map.flyTo([activeJams[0].lat, activeJams[0].lng], 15);
        this.showToast(`Điểm ùn tắc giao thông: ${activeJams[0].description}`, 'warning');
      } else {
        const roadworks = cityTraffics.filter(t => t.type === 'roadwork' || t.type === 'road_closure');
        if (roadworks.length > 0) {
          window.mapEngine.map.flyTo([roadworks[0].lat, roadworks[0].lng], 15);
          this.showToast(`Đường phố thông thoáng! Ghi nhận ${roadworks.length} điểm rào chắn thi công bảo trì (Vệ tinh TomTom v5).`, 'info', 5000);
        } else {
          this.showToast(this.currentPredictionOffset > 0
            ? `AI Dự báo sau +${this.currentPredictionOffset}h: Tuyến đường toàn thành phố thông thoáng, không có điểm kẹt xe!`
            : 'Giao thông toàn thành phố thông thoáng! Vận tốc trung bình 45-60 km/h, không có điểm kẹt xe.', 'info', 5000);
        }
      }
    });

    document.getElementById('chip-ai-trigger')?.addEventListener('click', () => {
      window.aiChat.toggle();
    });

    // 4. Chọn thành phố -> Cập nhật lại bản đồ, thời tiết trung tâm và thời tiết trạm các quận
    document.getElementById('city-select-gm')?.addEventListener('change', async (e) => {
      this.currentCity = e.target.value;
      const hanoiStreetsChip = document.getElementById('chip-hanoi-streets');
      if (hanoiStreetsChip) {
        hanoiStreetsChip.style.display = (this.currentCity === 'hanoi') ? 'inline-flex' : 'none';
      }

      if (this.isSimulationMode) {
        this.generateRandomSimulatedFloods(this.currentCity);
      }
      const city = this.citiesConfig[this.currentCity];
      window.mapEngine.flyToCity(city);
      this.resetCityRouteDefaults();
      this.updateCommutePlacesLabel();
      await this.updateWeather();
      await this.updateWeatherStations();

      const chkEv = document.getElementById('chk-layer-ev');
      const chipEv = document.getElementById('chip-ev-stations');

      if ((chkEv && chkEv.checked) || (chipEv && chipEv.classList.contains('active'))) {
        if (window.mapEngine && window.mapEngine.toggleEV) {
          await window.mapEngine.toggleEV(true, true);
        }
      }
      if (this.currentPredictionOffset > 0) {
        await this.applyPredictionOffset(this.currentPredictionOffset);
      } else {
        this.renderAllData();
      }
      if (this.isDirectionsOpen) {
        this.calculateSmartRoute();
      }
    });

    // 4b. Chip Xu hướng & VOV Giao thông
    document.getElementById('chip-urban-insights')?.addEventListener('click', () => {
      this.openUrbanInsightsModal();
    });

    // 4c. Chip Trạm sạc xe điện (Bật/Tắt trực tiếp trên thanh công cụ)
    document.getElementById('chip-ev-stations')?.addEventListener('click', () => {
      const chip = document.getElementById('chip-ev-stations');
      const isNowActive = !chip.classList.contains('active');
      chip.classList.toggle('active', isNowActive);

      const chkEv = document.getElementById('chk-layer-ev');
      if (chkEv) chkEv.checked = isNowActive;

      if (window.mapEngine && window.mapEngine.toggleEV) {
        window.mapEngine.toggleEV(isNowActive);
      }

      const count = (window.mapEngine && window.mapEngine._evStationsData) ? window.mapEngine._evStationsData.length : 63;
      if (isNowActive) {
        this.showToast(`Đang hiển thị ${count} trạm sạc xe điện & tủ đổi pin tại ${this.getCityName(this.currentCity)}`, 'info', 2500);
      } else {
        this.showToast('Đã ẩn lớp trạm sạc xe điện', 'info', 1800);
      }
    });

    document.getElementById('btn-close-urban-insights')?.addEventListener('click', () => {
      document.getElementById('modal-urban-insights')?.classList.remove('open');
    });

    // 4d. Bảng Chỉ Số Thoải Mái Khi Đi Đường (Commute Comfort & 15P Nowcasting)
    document.getElementById('gm-weather-pill')?.addEventListener('click', () => {
      this.openCommuteComfortModal();
    });

    document.getElementById('chip-commute-comfort')?.addEventListener('click', () => {
      this.openCommuteComfortModal();
    });

    document.getElementById('btn-comfort-refresh')?.addEventListener('click', () => {
      this.openCommuteComfortModal();
      this.showToast('Đang cập nhật chỉ số thoải mái & 15P Nowcasting...', 'info', 2000);
    });

    document.getElementById('btn-comfort-route')?.addEventListener('click', () => {
      document.getElementById('modal-commute-comfort')?.classList.remove('open');
      this.toggleDirectionsPanel(true);
      this.showToast('Đã mở chỉ đường. Hãy chọn điểm đến để hệ thống tìm lộ trình râm mát & né ngập!', 'info', 3500);
    });

    // 5. Nút tìm đường trong bảng Directions
    document.getElementById('btn-find-route-submit')?.addEventListener('click', () => {
      this.calculateSmartRoute();
    });

    // Chuyển phương tiện (Xe máy / Ô tô / Xe điện)
    document.querySelectorAll('.gm-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.gm-mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentVehicle = tab.getAttribute('data-mode');
        
        // Tự động bật layer Trạm sạc nếu chọn xe điện
        const evLayerItem = document.getElementById('layer-item-ev');
        const chipEv = document.getElementById('chip-ev-stations');
        if (this.currentVehicle === 'ebike' || this.currentVehicle === 'ecar') {
          if (evLayerItem) evLayerItem.style.display = 'flex';
          const chkEv = document.getElementById('chk-layer-ev');
          if (chkEv) chkEv.checked = true;
          if (chipEv) chipEv.classList.add('active');
          if (window.mapEngine.toggleEV) {
            window.mapEngine.toggleEV(true);
            this.showToast('Đã kích hoạt lớp bản đồ Trạm sạc xe điện', 'info', 2500);
          }
        } else {
          if (evLayerItem) evLayerItem.style.display = 'none';
          const chkEv = document.getElementById('chk-layer-ev');
          if (chkEv && chkEv.checked) {
             chkEv.checked = false;
             if (chipEv) chipEv.classList.remove('active');
             if (window.mapEngine.toggleEV) window.mapEngine.toggleEV(false);
          }
        }
        
        this.calculateSmartRoute();
      });
    });

    // Lắng nghe thanh trượt dự báo giao thông
    const predictionSlider = document.getElementById('traffic-prediction-slider');
    if (predictionSlider) {
      predictionSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const labels = ['Hiện tại', '+1 Giờ tới', '+2 Giờ tới', '+3 Giờ tới'];
        const labelEl = document.getElementById('prediction-time-label');
        if (labelEl) labelEl.textContent = labels[val];
        this.currentPredictionOffset = val;
      });
      predictionSlider.addEventListener('change', async (e) => {
        const val = parseInt(e.target.value, 10);
        await this.applyPredictionOffset(val);
        if (this.isDirectionsOpen) {
          this.calculateSmartRoute();
        }
      });
    }

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
      try {
        this.showToast('Đang kích hoạt Bot quét dữ liệu mới từ các nguồn...', 'info', 2500);
        // Gọi server crawl trước
        try {
          const resp = await fetch('/api/bot/refresh', { method: 'POST' });
          if (resp.status === 429) {
            const data = await resp.json().catch(() => ({}));
            this.showToast(`${data.message || 'Vui lòng đợi thêm giây lát trước khi quét lại.'}`, 'warning', 4000);
            return;
          }
        } catch (e) {}

        // Sau đó sync dữ liệu mới về giao diện
        await this.syncFromCloud(true);
      } catch (err) {}
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
      const chip = document.getElementById('chip-weather-toggle');
      if (chip) chip.classList.toggle('active', e.target.checked);
    });
    document.getElementById('chk-layer-satellite')?.addEventListener('change', (e) => {
      window.mapEngine.switchBaseMap(e.target.checked ? 'satellite' : 'standard');
    });
    document.getElementById('chk-layer-ev')?.addEventListener('change', (e) => {
      if (window.mapEngine.toggleEV) window.mapEngine.toggleEV(e.target.checked);
      const chipEv = document.getElementById('chip-ev-stations');
      if (chipEv) chipEv.classList.toggle('active', e.target.checked);
    });

    // 6b. Nút gạt Chế độ Giả lập (Simulation Mode) ở góc trên bên phải
    document.getElementById('chk-simulation-mode')?.addEventListener('change', (e) => {
      this.setSimulationMode(e.target.checked, true);
    });

    // Toggle Giả lập trong menu Lớp Bản Đồ
    document.getElementById('chk-layer-simulation')?.addEventListener('change', (e) => {
      this.setSimulationMode(e.target.checked, true);
    });

    // Bấm vào card chứa nút gạt ở góc phải trên để toggle
    document.getElementById('mode-toggle-container')?.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.classList.contains('gm-slider')) return;
      this.setSimulationMode(!this.isSimulationMode, true);
    });

    // Nút [Đổi kịch bản] trên Floating Banner
    document.getElementById('btn-reroll-simulation')?.addEventListener('click', () => {
      this.rerollSimulation();
    });

    // Nút [Tắt giả lập] trên Floating Banner
    document.getElementById('btn-exit-simulation')?.addEventListener('click', () => {
      this.setSimulationMode(false, true);
    });

    // Click lên bản đồ sẽ tự động đóng AI chat, menu lớp hoặc chọn điểm đi/đến (hoặc hiện POI)
    window.mapEngine.map?.on('click', async (e) => {
      window.aiChat.close();
      document.getElementById('gm-layer-menu')?.classList.remove('open');

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (this.pickingLocationType) {
        const type = this.pickingLocationType;
        this.stopPickLocationOnMap();

        this.showToast('Đang xác định ngõ ngách, địa chỉ...', 'info');

        try {
          const addrInfo = await window.geocodingService.reverseGeocode(lat, lng);
          this.selectLocation(type, {
            title: addrInfo.title,
            subtitle: addrInfo.subtitle,
            fullAddress: addrInfo.fullAddress,
            lat,
            lng
          });
          this.showToast(`Đã chọn: ${addrInfo.title}`, 'info');
        } catch (err) {
          this.selectLocation(type, {
            title: `Tọa độ [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
            subtitle: 'Vị trí trên bản đồ',
            fullAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            lat,
            lng
          });
        }
      } else {
        // Thêm tính năng click chọn địa điểm tự do như Google Maps
        if (this._tempClickMarker) window.mapEngine.map.removeLayer(this._tempClickMarker);
        
        this._tempClickMarker = L.marker([lat, lng], {
            icon: L.divIcon({ className: 'gm-temp-click-icon', html: '<div class="spinner"></div>' })
        }).addTo(window.mapEngine.map);

        try {
            const addrInfo = await window.geocodingService.reverseGeocode(lat, lng);
            
            // Xây dựng popup chuẩn Google Maps
            const popupContent = `
              <div class="gm-poi-popup">
                <div class="gm-poi-title">${addrInfo.title}</div>
                <div class="gm-poi-address">${addrInfo.subtitle}</div>
                <div class="gm-poi-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                <div class="gm-poi-actions">
                  <button class="gm-btn-dir from" onclick="window.appState.setRouteFromPOI(${lat}, ${lng}, '${addrInfo.title.replace(/'/g, "\\'")}', '${addrInfo.fullAddress.replace(/'/g, "\\'")}')">
                    Từ đây
                  </button>
                  <button class="gm-btn-dir to" onclick="window.appState.setRouteToPOI(${lat}, ${lng}, '${addrInfo.title.replace(/'/g, "\\'")}', '${addrInfo.fullAddress.replace(/'/g, "\\'")}')">
                    Tới đây
                  </button>
                </div>
              </div>
            `;
            
            this._tempClickMarker.bindPopup(popupContent, {
                closeButton: true,
                className: 'gm-poi-popup-container',
                minWidth: 260
            }).openPopup();
            
        } catch (err) {
            this._tempClickMarker.bindPopup(`Vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`).openPopup();
        }
      }
    });

    // 7. Modals: Báo cáo & Cài đặt
    const reportModal = document.getElementById('modal-report');
    document.getElementById('btn-gm-open-report')?.addEventListener('click', () => reportModal?.classList.add('open'));
    document.getElementById('btn-close-report')?.addEventListener('click', () => reportModal?.classList.remove('open'));

    // Toggle hiển thị mực nước khi đổi loại sự cố
    document.getElementById('report-type')?.addEventListener('change', (e) => {
      const depthGroup = document.getElementById('group-report-depth');
      if (depthGroup) {
        depthGroup.style.display = (e.target.value === 'flood') ? 'block' : 'none';
      }
    });

    // Lấy vị trí GPS cho form báo cáo
    document.getElementById('btn-report-current-gps')?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        this.showToast('Trình duyệt không hỗ trợ định vị GPS', 'warning');
        return;
      }
      this.showToast('Đang xác định tọa độ GPS của bạn...', 'info');
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const latInput = document.getElementById('report-lat');
        const lngInput = document.getElementById('report-lng');
        const coordDisplay = document.getElementById('report-coord-display');
        const locInput = document.getElementById('report-location-name');

        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lng;
        if (coordDisplay) {
          coordDisplay.textContent = `Đã ghim tọa độ GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          coordDisplay.style.display = 'block';
        }

        // Tự động reverse geocode điền tên đường
        try {
          const addr = await window.geocodingService.reverseGeocode(lat, lng);
          if (locInput && addr && addr.title) {
            locInput.value = addr.title;
          }
        } catch (e) {}

        this.showToast('Đã lấy tọa độ GPS chính xác!', 'info');
      }, (err) => {
        this.showToast('Không thể lấy vị trí GPS: ' + err.message, 'warning');
      });
    });

    document.getElementById('form-report')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.querySelector('#form-report button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang gửi...';
      }

      try {
        const name = (document.getElementById('report-location-name')?.value || '').trim() || 'Điểm ngập';
        const depth = parseInt(document.getElementById('report-depth')?.value, 10) || 30;
        const type = document.getElementById('report-type')?.value || 'flood';

        let targetLat = parseFloat(document.getElementById('report-lat')?.value) || null;
        let targetLng = parseFloat(document.getElementById('report-lng')?.value) || null;

        // Định vị tọa độ chính xác bằng tên đường trong thành phố hiện tại nếu chưa có GPS
        if ((targetLat === null || targetLng === null) && window.geocodingService && name.length >= 2) {
          try {
            const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;
            const geoMatches = await window.geocodingService.searchAddresses(name, {
              city: this.currentCity,
              center: cityCenter,
              limit: 1
            });
            if (geoMatches && geoMatches.length > 0) {
              targetLat = geoMatches[0].lat;
              targetLng = geoMatches[0].lng;
            }
          } catch (geoErr) {
            console.warn('Không thể geocode tên địa điểm báo cáo:', geoErr);
          }
        }

        // Nếu không tìm thấy qua geocoding, dùng tâm bản đồ hiện tại (không dùng jitter ngẫu nhiên)
        if (targetLat === null || targetLng === null) {
          const center = window.mapEngine.map.getCenter();
          targetLat = center.lat;
          targetLng = center.lng;
        }

        const res = await window.crowdsourceService.submitReport({
          locationName: name,
          city: this.currentCity,
          lat: targetLat,
          lng: targetLng,
          type,
          depth_cm: depth
        });

        if (res && res.success) {
          reportModal?.classList.remove('open');
          const form = document.getElementById('form-report');
          if (form) form.reset();
          this.showToast('Báo cáo của bạn đã được xác thực và ghim lên bản đồ!', 'info');
        } else {
          this.showToast('Không thể gửi báo cáo: ' + (res?.message || 'Lỗi không xác định'), 'warning');
        }
      } catch (err) {
        console.error('Lỗi khi gửi báo cáo sự cố:', err);
        this.showToast('Có lỗi xảy ra khi gửi báo cáo: ' + err.message, 'danger');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Gửi Báo Cáo';
        }
      }
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

    // 9. Phím tắt toàn cục Escape (Đóng modal, drawer, menu và hủy thao tác)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-overlay.open');
        if (openModal) {
          openModal.classList.remove('open');
          if (openModal.id === 'modal-urban-insights' && window.aiChat) {
            window.aiChat.stopSpeaking();
          }
          return;
        }
        if (window.aiChat && window.aiChat.isOpen) {
          window.aiChat.close();
          this.setMobileActiveTab('explore');
          return;
        }
        const layerMenu = document.getElementById('gm-layer-menu');
        if (layerMenu && layerMenu.classList.contains('open')) {
          layerMenu.classList.remove('open');
          return;
        }
        if (this.pickingLocationType) {
          this.stopPickLocationOnMap();
          return;
        }
        const dirPanel = document.getElementById('gm-directions-panel');
        if (dirPanel && dirPanel.classList.contains('open') && window.innerWidth <= 768) {
          this.toggleDirectionsPanel(false);
          return;
        }
      }
    });

    // 10. Bấm ra ngoài (Backdrop click) để đóng tất cả Modals
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
          if (overlay.id === 'modal-urban-insights' && window.aiChat) {
            window.aiChat.stopSpeaking();
          }
        }
      });
    });

    // 11. Bấm ra ngoài để đóng Menu Lớp bản đồ
    document.addEventListener('pointerdown', (e) => {
      const layerMenu = document.getElementById('gm-layer-menu');
      const btnLayers = document.getElementById('btn-gm-layers');
      if (layerMenu && layerMenu.classList.contains('open')) {
        if (!layerMenu.contains(e.target) && !btnLayers?.contains(e.target)) {
          layerMenu.classList.remove('open');
        }
      }
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
            <strong>Giao cắt trọng điểm:</strong> ${ward.trafficHotspots.join(' • ')}
          </div>
        `;
      }

      let floodNoteHtml = '';
      if (ward.floodVulnerability) {
        floodNoteHtml = `
          <div class="ward-card-flood">
            <strong>Lưu ý úng ngập:</strong> ${ward.floodVulnerability}
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
              <span>${temp}°C</span>
              <span>•</span>
              <span style="font-weight: 500;">${desc}</span>
            </div>
          </div>

          <div style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px; text-transform: uppercase;">
            Các trục đường huyết mạch (${(ward.mainStreets || []).length} tuyến):
          </div>
          <div class="ward-card-streets">
            ${streetsTags}
          </div>

          ${hotspotsHtml}
          ${floodNoteHtml}

          <div class="ward-card-footer">
            <button class="btn-card-map" 
                    onclick="window.appState && window.appState.flyToWardFromCard(${ward.lat}, ${ward.lng}, '${ward.name.replace(/'/g, "\\'")}')">
              Xem Trên Bản Đồ
            </button>
            <button class="btn-card-ai" 
                    onclick="window.appState && window.appState.askAiAboutWard('${ward.name.replace(/'/g, "\\'")}', '${ward.district.replace(/'/g, "\\'")}')">
              Hỏi AI Về Phường
            </button>
            <button class="btn-card-route" 
                    title="Chỉ đường đến ${ward.name}"
                    onclick="window.appState && window.appState.routeToWardFromCard(${ward.lat}, ${ward.lng}, '${ward.name.replace(/'/g, "\\'")}')">
              Đến Đây
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
    this.showToast(`Đã chuyển góc nhìn đến ${wardName}`, 'info');

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
    this.showToast(`Tuyến đường lớn: ${streetName} (${wardName})`, 'info', 4000);
    window.aiChat.open();
    window.aiChat.sendMessage(`Tình hình giao thông, ngập nước và lộ trình lưu thông trên đường ${streetName} qua khu vực ${wardName} như thế nào?`);
  }

  async openUrbanInsightsModal() {
    const modal = document.getElementById('modal-urban-insights');
    if (!modal) return;
    modal.classList.add('open');

    // 1. Render tin tức VOV
    const vovContainer = document.getElementById('vov-news-list');
    if (vovContainer) {
      const news = this.liveData.vovTrafficNews || [];
      if (news.length === 0) {
        vovContainer.innerHTML = '<div style="color: #5f6368;">Hiện tại không có tin tức ùn tắc phát thanh khẩn cấp.</div>';
      } else {
        vovContainer.innerHTML = news.map(item => {
          const title = item.title || 'Tin giao thông';
          const content = item.summary || item.content || '';
          const fullText = `${title}. ${content}`;
          return `
            <div style="border-bottom: 1px solid #e8eaed; padding: 8px 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
              <div style="flex: 1;">
                <div style="font-weight: 700; color: #202124;">${title}</div>
                <div style="color: #5f6368; font-size: 11px; margin-top: 2px;">${content}</div>
                <div style="color: #1a73e8; font-size: 10px; margin-top: 3px;">Nguồn: VOV Giao thông 91MHz</div>
              </div>
              <button class="gm-btn-tts" 
                      style="flex-shrink: 0; margin-top: 2px;"
                      onclick="window.aiChat && window.aiChat.toggleSpeakText(this, decodeURIComponent('${encodeURIComponent(fullText)}'))"
                      title="Đọc bằng giọng nói tiếng Việt">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                <span>Đọc tin</span>
              </button>
            </div>
          `;
        }).join('');
      }
    }

    // 2. Render biểu đồ xu hướng 7 ngày từ SupabaseService
    const chartContainer = document.getElementById('historical-trends-chart');
    if (chartContainer && window.supabaseService) {
      try {
        const hist = await window.supabaseService.getHistoricalTrends(this.currentCity, 7);
        const series = hist.timeSeries || [];
        if (series.length === 0) {
          chartContainer.innerHTML = `
            <div style="color: #5f6368; text-align: center; padding: 20px;">
              Chỉ số ùn tắc trung bình 7 ngày tại ${this.citiesConfig[this.currentCity]?.name || 'đô thị'}: <strong>Cấp độ 2.4/5.0 (Mức trung bình nhẹ)</strong><br>
              <span style="font-size: 11px;">Giờ cao điểm ghi nhận ùn ứ nhiều nhất: 07:30 - 08:45 và 17:15 - 18:30 hàng ngày.</span>
            </div>
          `;
        } else {
          chartContainer.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 8px; height: 120px; padding-top: 10px;">
              ${series.slice(-7).map(item => {
                const lvl = item.congestion_level || 2;
                const height = Math.min(100, lvl * 20);
                const dateStr = item.recorded_at ? new Date(item.recorded_at).toLocaleDateString('vi-VN', { weekday: 'short' }) : '';
                return `
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                    <span style="font-size: 10px; font-weight: 700; color: #1a73e8;">${lvl}</span>
                    <div style="width: 100%; height: ${height}%; background: ${lvl >= 4 ? '#d93025' : (lvl >= 3 ? '#f9ab00' : '#1e8e3e')}; border-radius: 4px 4px 0 0;"></div>
                    <span style="font-size: 10px; color: #5f6368;">${dateStr}</span>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }
      } catch (e) {
        chartContainer.innerHTML = '<div style="color: #5f6368;">Chưa thể nạp chuỗi thời gian Supabase.</div>';
      }
    }
  }

  // Mở modal Chỉ số Thoải Mái Khi Đi Đường (Commute Comfort & 15P Nowcasting)
  async openCommuteComfortModal(targetLat = null, targetLng = null, targetName = null) {
    const modal = document.getElementById('modal-commute-comfort');
    if (!modal) return;
    modal.classList.add('open');

    const city = this.citiesConfig[this.currentCity] || { lat: 21.0285, lng: 105.8542, name: 'Hà Nội' };
    const lat = typeof targetLat === 'number' ? targetLat : city.lat;
    const lng = typeof targetLng === 'number' ? targetLng : city.lng;
    const cityName = targetName || city.name;

    const subTitle = document.getElementById('comfort-location-subtitle');
    if (subTitle) {
      subTitle.textContent = `Khu vực: ${cityName} • Cập nhật dữ liệu thời gian thực từ Open-Meteo`;
    }

    const scoreNum = document.getElementById('comfort-score-num');
    const statusBadge = document.getElementById('comfort-status-badge');
    const adviceQuote = document.getElementById('comfort-advice-quote');
    if (statusBadge) statusBadge.textContent = 'Đang phân tích thời tiết mặt đường...';
    if (adviceQuote) adviceQuote.textContent = 'Đang kết nối Open-Meteo và tính toán chỉ số cảm nhận nhiệt mặt đường...';

    if (!window.weatherService || typeof window.weatherService.getCommuteComfortData !== 'function') {
      if (adviceQuote) adviceQuote.textContent = 'Dịch vụ phân tích thời tiết đang khởi động, vui lòng thử lại sau.';
      return;
    }

    try {
      const data = await window.weatherService.getCommuteComfortData(lat, lng, cityName);
      if (!data) return;

      // 1. Điểm số và trạng thái
      if (scoreNum) scoreNum.textContent = data.comfortScore;
      const scoreCircle = document.getElementById('comfort-score-circle');
      if (scoreCircle) {
        scoreCircle.style.borderColor = data.comfortThemeColor || '#10b981';
      }

      if (statusBadge) {
        statusBadge.textContent = data.comfortStatus;
        statusBadge.className = `comfort-status-badge ${data.comfortBadgeClass || 'cci-good'}`;
      }

      if (adviceQuote) {
        adviceQuote.textContent = data.commuteAdvice;
      }

      // 2. 4 Thẻ chỉ số môi trường
      const elRoadFeel = document.getElementById('cm-val-roadfeel');
      const elSubRoadFeel = document.getElementById('cm-sub-roadfeel');
      if (elRoadFeel) elRoadFeel.textContent = `${data.roadRealFeel}°C`;
      if (elSubRoadFeel) elSubRoadFeel.textContent = `Nhiệt kế: ${data.temp}°C (Cảm nhận: ${data.apparentTemp}°C)`;

      const elUv = document.getElementById('cm-val-uv');
      const elSubUv = document.getElementById('cm-sub-uv');
      if (elUv) elUv.textContent = `${data.uvIndex}`;
      if (elSubUv) {
        const uvLevel = data.uvIndex >= 8 ? 'Cực gắt (Cháy rát da)' : (data.uvIndex >= 6 ? 'Cao (Cần bảo vệ)' : (data.uvIndex >= 3 ? 'Trung bình' : 'Thấp'));
        elSubUv.textContent = `Mức độ: ${uvLevel}`;
      }

      const elHumidity = document.getElementById('cm-val-humidity');
      const elSubHumidity = document.getElementById('cm-sub-humidity');
      if (elHumidity) elHumidity.textContent = `${data.humidity}%`;
      if (elSubHumidity) {
        const humLevel = data.humidity >= 85 ? 'Oi bức nồng nặc' : (data.humidity >= 70 ? 'Khá ẩm' : 'Thoáng đãng mồ hôi');
        elSubHumidity.textContent = humLevel;
      }

      const elWind = document.getElementById('cm-val-wind');
      const elSubWind = document.getElementById('cm-sub-wind');
      if (elWind) elWind.textContent = `${data.windSpeed} km/h`;
      if (elSubWind) elSubWind.textContent = `Gió giật: ${data.windGusts} km/h`;

      // 3. Biểu đồ diễn biến 15 phút (8 mốc trong 2 giờ tới)
      const chartContainer = document.getElementById('comfort-timeline-chart');
      if (chartContainer) {
        const timeline = data.timeline15 || [];
        if (timeline.length === 0) {
          chartContainer.innerHTML = '<div style="color: #64748b; font-size: 12px; padding: 12px; text-align: center;">Chưa có dữ liệu dự báo 15P cho vị trí này.</div>';
        } else {
          chartContainer.innerHTML = timeline.map(item => `
            <div class="comfort-chart-col">
              <div class="col-realfeel" style="color: ${item.barColor}">${item.realFeel}°</div>
              <div class="col-bar-track">
                <div class="col-bar-fill" style="height: ${Math.max(16, Math.min(100, (item.realFeel - 20) * 4))}%; background: ${item.barColor};"></div>
              </div>
              <div class="col-time">${item.relTime}</div>
              <div class="col-hour">${item.timeLabel}</div>
              <div class="col-rain ${item.rain > 0 ? 'has-rain' : ''}">${item.rain > 0 ? `${item.rain}mm` : '0mm'}</div>
              <div class="col-status">${item.roadStatus}</div>
            </div>
          `).join('');
        }
      }

      // 4. Hộp đề xuất trang bị
      const gearContainer = document.getElementById('comfort-gear-container');
      if (gearContainer) {
        const gears = data.gearList || [];
        if (gears.length === 0) {
          gearContainer.innerHTML = '<div style="color: #64748b; font-size: 12px;">Không có đề xuất đặc biệt.</div>';
        } else {
          gearContainer.innerHTML = gears.map(g => `
            <div class="gear-pill ${g.needed ? 'gear-needed' : 'gear-optional'}">
              <svg class="gear-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                ${g.needed 
                  ? '<polyline points="20 6 9 17 4 12"></polyline>' 
                  : '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
              </svg>
              <span class="gear-name">${g.name}</span>
              <span class="gear-reason">(${g.reason})</span>
            </div>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Lỗi hiển thị Commute Comfort modal:', e);
      if (adviceQuote) adviceQuote.textContent = 'Không thể tải dữ liệu thời tiết trực tiếp từ Open-Meteo. Vui lòng bấm "Làm mới" để thử lại.';
    }
  }

  // Đặt lại điểm lộ trình khi chuyển thành phố hoặc bắt đầu mới
  resetCityRouteDefaults() {
    this.routeLocations = {
      origin: null,
      destination: null
    };
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (originInput) originInput.value = '';
    if (destInput) destInput.value = '';

    if (this.routeMarkers.origin && window.mapEngine?.map) {
      window.mapEngine.map.removeLayer(this.routeMarkers.origin);
      this.routeMarkers.origin = null;
    }
    if (this.routeMarkers.destination && window.mapEngine?.map) {
      window.mapEngine.map.removeLayer(this.routeMarkers.destination);
      this.routeMarkers.destination = null;
    }
    if (window.mapEngine && window.mapEngine.clearRoute) {
      window.mapEngine.clearRoute();
    }
    const resultsContainer = document.getElementById('gm-route-results');
    if (resultsContainer) resultsContainer.innerHTML = '';
    const summaryContainer = document.getElementById('gm-route-summary');
    if (summaryContainer) summaryContainer.style.display = 'none';
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
        const stateKey = type === 'dest' ? 'destination' : type;
        input.value = '';
        this.routeLocations[stateKey] = null;
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
            Đang tìm kiếm ngõ, ngách, địa chỉ...
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
        <div class="gm-sugg-content">
          <div class="gm-sugg-title">Vị trí của bạn</div>
          <div class="gm-sugg-subtitle">Sử dụng định vị GPS hiện tại</div>
        </div>
      </div>
      <div class="gm-suggestion-item gm-quick-action" data-action="map">
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
        html += `
          <div class="gm-suggestion-item" data-index="${index}">
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
  // --- GOOGLE MAPS POI CLICKS ---
  setRouteFromPOI(lat, lng, title, fullAddress) {
    if (this._tempClickMarker && window.mapEngine.map) {
      window.mapEngine.map.removeLayer(this._tempClickMarker);
      this._tempClickMarker = null;
    }
    this.selectLocation('origin', { lat, lng, title, subtitle: fullAddress, fullAddress });
    this.showToast('Đã đặt Điểm Đi: ' + title, 'info');
  }

  setRouteToPOI(lat, lng, title, fullAddress) {
    if (this._tempClickMarker && window.mapEngine.map) {
      window.mapEngine.map.removeLayer(this._tempClickMarker);
      this._tempClickMarker = null;
    }
    this.selectLocation('destination', { lat, lng, title, subtitle: fullAddress, fullAddress });
    this.showToast('Đã đặt Điểm Đến: ' + title, 'info');
  }

  selectLocation(type, item) {
    const inputId = type === 'destination' ? 'dest' : type;
    const stateKey = type === 'dest' ? 'destination' : type;

    const input = document.getElementById(`gm-route-${inputId}`);
    if (input) {
      input.value = item.fullAddress || item.title;
      const clearBtn = document.getElementById(`btn-clear-${inputId}`);
      if (clearBtn) clearBtn.style.display = 'flex';
    }

    this.routeLocations[stateKey] = {
      lat: item.lat,
      lng: item.lng,
      title: item.title,
      fullAddress: item.fullAddress || item.title
    };

    // Cập nhật marker A hoặc B trên bản đồ
    this.updateRouteMarker(inputId, item.lat, item.lng, item.title);

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

    const markerKey = (type === 'destination' || type === 'dest') ? 'dest' : 'origin';
    const stateKey = markerKey === 'dest' ? 'destination' : 'origin';

    if (this.routeMarkers[markerKey]) {
      map.removeLayer(this.routeMarkers[markerKey]);
    }

    const isOrigin = markerKey === 'origin';
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

      const input = document.getElementById(`gm-route-${markerKey}`);
      if (input) input.value = addrInfo.fullAddress || addrInfo.title;

      this.routeLocations[stateKey] = {
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

    this.routeMarkers[markerKey] = marker;
  }

  // Bắt đầu chế độ click chọn trên bản đồ
  startPickLocationOnMap(type) {
    this.pickingLocationType = type;
    const banner = document.getElementById('gm-pick-map-banner');
    if (banner) {
      const typeText = type === 'origin' ? 'Điểm xuất phát (A)' : 'Điểm đến (B)';
      banner.querySelector('span').innerText = `Click vào điểm bất kỳ trên bản đồ để chọn ${typeText}...`;
      banner.style.display = 'flex';
    }

    const container = document.getElementById('map-container');
    if (container) container.style.cursor = 'crosshair';
    this.showToast(`Hãy nhấp chuột vào một vị trí trên bản đồ để chọn ${type === 'origin' ? 'điểm đi' : 'điểm đến'}`, 'info');
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
    this.showToast('Đã đảo ngược điểm đi và điểm đến', 'info');
  }

  // Lấy vị trí GPS hiện tại cho điểm đi
  async setOriginToMyLocation() {
    this.showToast('Đang xác định vị trí của bạn qua GPS...', 'info');
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
      this.showToast(`Đã nhận diện vị trí: ${pos.title}`, 'info');
      if (this.routeLocations.destination) {
        this.calculateSmartRoute();
      }
    } catch (e) {
      this.showToast(`Không thể lấy GPS: ${e.message}`, 'warning');
    }
  }

  // Lấy vị trí GPS cho điểm đến
  async setDestToMyLocation() {
    this.showToast('Đang xác định vị trí của bạn qua GPS...', 'info');
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
      this.showToast(`Đã nhận diện vị trí: ${pos.title}`, 'info');
      if (this.routeLocations.origin) {
        this.calculateSmartRoute();
      }
    } catch (e) {
      this.showToast(`Không thể lấy GPS: ${e.message}`, 'warning');
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

  // Dịch các chỉ dẫn rẽ sang tiếng Việt tự nhiên chuẩn Google Maps kèm Icon SVG tối giản
  translateStepInstruction(step) {
    const raw = (step.instruction || '').toLowerCase();
    const name = step.name || 'đoạn đường';
    let turn = 'Tiếp tục đi';
    let iconName = 'straight';

    if (raw.includes('depart')) {
      turn = 'Khởi hành từ';
      iconName = 'map-pin';
    } else if (raw.includes('arrive')) {
      turn = 'Đến điểm đích tại';
      iconName = 'flag';
    } else if (raw.includes('right')) {
      turn = 'Rẽ phải vào';
      iconName = 'turn-right';
    } else if (raw.includes('left')) {
      turn = 'Rẽ trái vào';
      iconName = 'turn-left';
    } else if (raw.includes('uturn')) {
      turn = 'Quay đầu xe trên';
      iconName = 'uturn';
    } else if (raw.includes('roundabout') || raw.includes('rotary')) {
      turn = 'Đi vào vòng xuyến rẽ vào';
      iconName = 'roundabout';
    } else if (raw.includes('fork') || raw.includes('slight')) {
      turn = 'Chếch hướng vào';
      iconName = 'fork';
    }

    const distText = step.distance > 1000
      ? `${(step.distance / 1000).toFixed(1)} km`
      : `${Math.round(step.distance)} m`;

    const icon = window.getSvgIcon ? window.getSvgIcon(iconName, `step-icon-svg step-${iconName}`, 16) : '•';

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

  // Hiển thị gợi ý tự động cho ô tìm kiếm chính (Địa điểm, Phường/Đường, Quán ăn, Trạm sạc)
  async renderMainSearchSuggestions(query) {
    const dropdown = document.getElementById('dropdown-main-search');
    if (!dropdown) return;

    const clean = (query || '').trim();
    if (clean.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    const lower = clean.toLowerCase();
    const suggestions = [];

    // 1. Gợi ý nếu người dùng đang hỏi ẩm thực / vui chơi
    if (window.FOOD_ENTERTAINMENT_DATA && window.FOOD_ENTERTAINMENT_DATA.isFoodOrFun(clean)) {
      suggestions.push({
        type: 'ai-food',
        title: `Gợi ý ăn uống & vui chơi: "${clean}"`,
        subtitle: 'Trợ lý AI đề xuất quán nổi tiếng + Ghim vị trí lên bản đồ',
        query: clean
      });
    }

    // 2. Gợi ý các quán ăn / điểm vui chơi khớp tên trực tiếp trong CSDL
    if (window.FOOD_ENTERTAINMENT_DATA && window.FOOD_ENTERTAINMENT_DATA.areas) {
      for (const area of window.FOOD_ENTERTAINMENT_DATA.areas) {
        if (area.city && area.city !== this.currentCity) continue;
        const allSpots = [...(area.food || []), ...(area.entertainment || [])];
        for (const spot of allSpots) {
          if (
            spot.name.toLowerCase().includes(lower) ||
            spot.specialty.toLowerCase().includes(lower) ||
            spot.address.toLowerCase().includes(lower)
          ) {
            suggestions.push({
              type: 'spot',
              title: spot.name,
              subtitle: `${spot.address} • ${spot.specialty}`,
              lat: spot.lat || area.lat,
              lng: spot.lng || area.lng
            });
            if (suggestions.length >= 4) break;
          }
        }
        if (suggestions.length >= 4) break;
      }
    }

    // 3. Gợi ý Phường / Tuyến đường lớn Hà Nội
    if (this.currentCity === 'hanoi' && window.HANOI_WARDS_DATA) {
      for (const w of window.HANOI_WARDS_DATA) {
        if (w.name.toLowerCase().includes(lower) || (w.district && w.district.toLowerCase().includes(lower))) {
          suggestions.push({
            type: 'ward',
            title: `${w.name} (${w.district})`,
            subtitle: `Các trục chính: ${(w.mainStreets || []).slice(0, 3).join(', ')}`,
            lat: w.lat,
            lng: w.lng,
            wardName: w.name
          });
        } else {
          const matchedSt = (w.mainStreets || []).find(s => s.toLowerCase().includes(lower));
          if (matchedSt) {
            suggestions.push({
              type: 'street',
              title: `${matchedSt} — ${w.name}`,
              subtitle: `Quận/Huyện: ${w.district} • Chạm để xem khu vực`,
              lat: w.lat,
              lng: w.lng,
              wardName: w.name
            });
          }
        }
        if (suggestions.length >= 6) break;
      }
    }

    // 4. Gợi ý từ bộ máy Geocoding (Địa danh, Trạm sạc, Điểm ngập, OSM)
    if (window.geocodingService && suggestions.length < 7) {
      try {
        const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;
        const geoMatches = await window.geocodingService.searchAddresses(clean, {
          city: this.currentCity,
          center: cityCenter,
          limit: 5
        });
        for (const m of (geoMatches || [])) {
          if (!suggestions.some(s => s.title === m.title)) {
            suggestions.push({
              type: m.source || 'place',
              title: m.title,
              subtitle: m.subtitle || 'Địa điểm trên bản đồ',
              lat: m.lat,
              lng: m.lng
            });
          }
          if (suggestions.length >= 7) break;
        }
      } catch (e) {
        // Ignore geocoding errors in autocomplete
      }
    }

    if (suggestions.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = suggestions.map((item, idx) => {
      const iconSvg = item.type === 'ai-food'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`
        : item.type === 'spot'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const routeBtn = (item.lat && item.lng)
        ? `<button type="button" class="gm-sug-route-btn" data-idx="${idx}" title="Chỉ đường an toàn đến đây" style="margin-left:auto; padding:4px 8px; border-radius:6px; border:1px solid #dbeafe; background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:600; cursor:pointer; flex-shrink:0;">Chỉ đường</button>`
        : '';

      return `
        <div class="gm-autocomplete-item" data-idx="${idx}" style="display:flex; align-items:center; gap:10px;">
          <div class="gm-item-icon" style="flex-shrink:0;">${iconSvg}</div>
          <div class="gm-item-info" style="flex:1; min-width:0;">
            <div class="gm-item-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
            <div class="gm-item-subtitle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.subtitle}</div>
          </div>
          ${routeBtn}
        </div>
      `;
    }).join('');

    dropdown.style.display = 'block';

    // Gắn sự kiện click cho từng dòng gợi ý
    dropdown.querySelectorAll('.gm-autocomplete-item').forEach(el => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      const item = suggestions[idx];
      if (!item) return;

      const routeBtn = el.querySelector('.gm-sug-route-btn');
      if (routeBtn) {
        routeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          dropdown.style.display = 'none';
          const mainInput = document.getElementById('gm-search-input');
          if (mainInput) mainInput.value = item.title;
          this.routeToLocation(item.lat, item.lng, item.title);
        });
      }

      el.addEventListener('click', () => {
        dropdown.style.display = 'none';
        const mainInput = document.getElementById('gm-search-input');
        if (mainInput) mainInput.value = item.title;

        if (item.type === 'ai-food') {
          window.aiChat.open();
          window.aiChat.sendMessage(item.query);
          return;
        }
        if (item.wardName) {
          this.flyToWardFromCard(item.lat, item.lng, item.wardName);
          return;
        }
        if (item.lat && item.lng) {
          window.mapEngine.map.flyTo([item.lat, item.lng], 16, { duration: 1.0 });
          if (this.searchResultMarker) {
            window.mapEngine.map.removeLayer(this.searchResultMarker);
          }
          const icon = L.divIcon({
            className: 'gm-marker-container',
            html: `<div class="gm-route-pin pin-dest" style="cursor: pointer;">•</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          this.searchResultMarker = L.marker([item.lat, item.lng], { icon }).addTo(window.mapEngine.map);
          this.searchResultMarker.bindPopup(`
            <div style="font-family: var(--font-family); min-width: 190px; padding: 4px;">
              <div style="font-weight: 700; font-size: 14px; color: #202124;">${item.title}</div>
              <div style="font-size: 12px; color: #5f6368; margin-top: 2px;">${item.subtitle}</div>
              <button onclick="window.appState.routeToLocation(${item.lat}, ${item.lng}, '${item.title.replace(/'/g, "\\'")}')" 
                style="margin-top: 8px; width: 100%; padding: 6px 12px; background: #1a73e8; color: #ffffff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                Chỉ đường an toàn đến đây
              </button>
            </div>
          `).openPopup();
        }
      });
    });
  }

  // Xử lý tìm kiếm thông minh từ ô tìm kiếm chính
  async handleSearch(query) {
    if (!query) return;
    const lower = query.toLowerCase();
    const mainDropdown = document.getElementById('dropdown-main-search');
    if (mainDropdown) mainDropdown.style.display = 'none';

    // 0. Nếu hỏi lộ trình rõ ràng "từ A đến/ra/vào/về/lên/xuống B" -> ưu tiên xử lý ngay
    const parsedRoute = (window.aiChat && typeof window.aiChat.parseRouteQuery === 'function')
      ? window.aiChat.parseRouteQuery(query)
      : null;

    const targetDest = parsedRoute ? (parsedRoute.destination || parsedRoute.dest) : null;
    if (parsedRoute && parsedRoute.origin && targetDest) {
      await this.triggerChatRoute(parsedRoute.origin, targetDest, 1, parsedRoute.timeOffsetHours || 0);
      return;
    }

    // 0b. Nếu là câu hỏi ẩm thực, vui chơi hoặc câu hỏi tự nhiên (có ... không, quán nào, ăn gì...) -> mở AI Chat & ghim bản đồ
    const isFoodQuery = window.FOOD_ENTERTAINMENT_DATA && window.FOOD_ENTERTAINMENT_DATA.isFoodOrFun(query);
    const isNaturalQuestion = /(có\s+.*(không|ko|k\b|chưa)|quán\s+nào|ăn\s+gì|chơi\s+gì|ở\s+đâu\s+ngon|đi\s+đường\s+nào|tắc\s+không|ngập\s+không|\?)/i.test(lower);
    if (isFoodQuery || isNaturalQuestion) {
      window.aiChat.open();
      window.aiChat.sendMessage(query);
      return;
    }

    // 1. Tìm kiếm rốn ngập trong dữ liệu hiện hành (chỉ khớp tên đường cụ thể, không cắt 8 ký tự đầu gây khớp nhầm)
    const matchedFlood = this.getCurrentFloods().find(f => {
      const baseName = f.name.split('(')[0].toLowerCase().replace(/^(phố|đường|ngã tư|nút giao|kđt)\s+/i, '').trim();
      return baseName.length >= 4 && lower.includes(baseName);
    });
    if (matchedFlood) {
      window.mapEngine.map.flyTo([matchedFlood.lat, matchedFlood.lng], 16);
      if (matchedFlood.depth_cm > 0 && matchedFlood.danger_level !== 'safe') {
        this.showToast(`Rốn ngập: ${matchedFlood.name} (${matchedFlood.depth_cm}cm)`, 'danger');
      } else {
        this.showToast(`Trạm đo ${matchedFlood.name}: Hiện tại khô ráo (0cm ngập)`, 'info');
      }
      return;
    }

    // 1b. Nếu người dùng gõ đích danh tên Phường/Xã trong danh mục 76 Phường Hà Nội (ví dụ: "Phường Tây Tựu", "Phường Dịch Vọng Hậu", "Tây Tựu")
    const isSpecificAddressOrPoi = /\b(số|sn|ngõ|ngách|hẻm|kiệt|đh|đại học|bv|bệnh viện|bx|bến xe|chợ|tttm|vincom|aeon|lotte|chung cư|tòa nhà|cầu|hồ|sân bay|ga)\b|\d+/i.test(lower);
    if (!isSpecificAddressOrPoi && window.HANOI_WARDS_DATA && window.HANOI_WARDS_DATA.length > 0) {
      const noAccentLower = window.geocodingService ? window.geocodingService.removeAccents(lower) : lower;
      const cleanQuery = noAccentLower.replace(/^(duong|pho|phuong|xa|quoc lo)\s+/i, '').trim();

      let targetWard = window.HANOI_WARDS_DATA.find(w => {
        const wNorm = window.geocodingService ? window.geocodingService.removeAccents(w.name) : w.name.toLowerCase();
        const rawWName = wNorm.replace(/^(phuong|xa)\s+/i, '').trim();
        return noAccentLower === wNorm || noAccentLower === rawWName || ( lower.startsWith('phường ') && rawWName.includes(cleanQuery) );
      });

      if (targetWard) {
        if (this.currentCity !== 'hanoi') {
          this.currentCity = 'hanoi';
          const citySelect = document.getElementById('city-select-gm');
          if (citySelect) citySelect.value = 'hanoi';
          await this.updateWeatherStations();
        }
        this.flyToWardFromCard(targetWard.lat, targetWard.lng, targetWard.name);
        const streetInfo = ` • Các đường lớn: ${(targetWard.mainStreets || []).slice(0, 3).join(', ')}`;
        this.showToast(`${targetWard.name} (${targetWard.district})${streetInfo}`, 'info', 5000);
        return;
      }
    }

    // 2. Tìm kiếm địa chỉ chính xác Đa tầng (TomTom Commercial + Esri ArcGIS + CSDL Nội bộ + Photon/Nominatim + Lùi cấp địa chỉ)
    try {
      const cityCenter = this.citiesConfig[this.currentCity] || this.citiesConfig.hanoi;
      const matches = await window.geocodingService.searchAddresses(query, {
        city: this.currentCity,
        center: cityCenter,
        limit: 5
      });

      if (matches && matches.length > 0) {
        const top = matches[0];
        window.mapEngine.map.flyTo([top.lat, top.lng], 16, { duration: 1.0 });

        if (this.searchResultMarker) {
          window.mapEngine.map.removeLayer(this.searchResultMarker);
        }

        const icon = L.divIcon({
          className: 'gm-marker-container',
          html: `<div class="gm-route-pin pin-dest" style="cursor: pointer;">•</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const safeTitle = (top.title || query).replace(/'/g, "\\'");
        this.searchResultMarker = L.marker([top.lat, top.lng], { icon }).addTo(window.mapEngine.map);
        this.searchResultMarker.bindPopup(`
          <div style="font-family: var(--font-family); min-width: 210px; padding: 4px;">
            <div style="font-weight: 700; font-size: 14px; color: #202124;">${top.title}</div>
            <div style="font-size: 12px; color: #5f6368; margin-top: 2px;">${top.subtitle || ''}</div>
            <div style="display: flex; gap: 6px; margin-top: 8px;">
              <button onclick="window.appState.routeToLocation(${top.lat}, ${top.lng}, '${safeTitle}')" 
                style="flex: 1; padding: 6px 10px; background: #1a73e8; color: #ffffff; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                Chỉ đường tới đây
              </button>
              <button onclick="window.appState.openSosRescueModal(${top.lat}, ${top.lng}, '${safeTitle}')" 
                style="padding: 6px 8px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;" title="Xem điểm trú mưa & cứu hộ gần vị trí này">
                SOS
              </button>
            </div>
          </div>
        `).openPopup();

        this.showToast(`Đã định vị: ${top.title} (${top.subtitle || ''})`, 'info', 3500);
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
  async triggerChatRoute(originStr, destStr, avoidLevel = 1, timeOffsetHours = 0) {
    this.toggleDirectionsPanel(true);
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (originInput) originInput.value = originStr;
    if (destInput) destInput.value = destStr;

    if (timeOffsetHours > 0) {
      const clampedOffset = Math.min(3, Math.max(0, Math.round(timeOffsetHours)));
      const predictionSlider = document.getElementById('traffic-prediction-slider');
      const labelEl = document.getElementById('prediction-time-label');
      const labels = ['Hiện tại', '+1 Giờ tới', '+2 Giờ tới', '+3 Giờ tới'];
      if (predictionSlider) predictionSlider.value = clampedOffset;
      if (labelEl) labelEl.textContent = labels[clampedOffset];
      await this.applyPredictionOffset(clampedOffset);
    }

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

    const timeNote = timeOffsetHours > 0 ? ` (Dự báo +${timeOffsetHours}h tới)` : '';
    this.showToast(`Tự động vẽ lộ trình: ${originStr} đến ${destStr}${timeNote}`, 'info', 4500);

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

  // Áp dụng độ lệch dự báo AI tương lai (+1h, +2h, +3h) lên bản đồ
  async applyPredictionOffset(offset) {
    this.currentPredictionOffset = offset;
    if (offset > 0 && window.supabaseService) {
      try {
        const [predictions, floodPreds] = await Promise.all([
          window.supabaseService.getTrafficPrediction(offset, this.currentCity),
          window.supabaseService.getFloodPredictions(offset, this.currentCity)
        ]);

        const aiFloods = (floodPreds || []).map(f => ({
          id: `ai-flood-${f.id || f.location_name}`,
          lat: f.lat,
          lng: f.lng,
          city: this.currentCity,
          depth_cm: f.predicted_depth_cm || 25,
          danger_level: (f.predicted_depth_cm || 25) > 30 ? 'critical' : 'medium',
          passable_motorbike: (f.predicted_depth_cm || 25) < 20,
          passable_car: (f.predicted_depth_cm || 25) < 35,
          name: `[AI DỰ BÁO +${offset}h] ${f.location_name}`,
          source: 'Mô hình AI dự báo ngập lụt',
          advice: `Nguy cơ ngập úng trong ${offset}h tới. Cân nhắc chọn lộ trình thay thế.`,
          updated_at: new Date().toISOString()
        }));

        const aiTraffics = (predictions || [])
          .filter(p => {
            const lvl = p.level || p.predicted_level || (p.isJam ? 3 : 1);
            return lvl >= 3 || p.type === 'roadwork' || p.type === 'road_closure';
          })
          .map((p, idx) => {
            const lvl = p.level || p.predicted_level || 3;
            const isWork = p.type === 'roadwork' || p.type === 'road_closure';
            return {
              id: p.id || `ai-traffic-${idx}`,
              lat: p.lat,
              lng: p.lng,
              city: this.currentCity,
              type: p.type || 'traffic_jam',
              categoryName: isWork ? (p.categoryName || 'Công trường thi công') : `AI Dự báo kẹt xe +${offset}h`,
              icon: p.icon || '',
              isJam: !isWork && lvl >= 3,
              level: lvl,
              speedKmh: p.speedKmh || (lvl >= 4 ? 8 : (lvl === 3 ? 15 : 35)),
              delaySeconds: p.delaySeconds || (lvl >= 4 ? 600 : (lvl === 3 ? 300 : 0)),
              confidence: p.confidence || 0.88,
              description: p.description || `AI dự báo ùn tắc mức ${lvl}/5 sau +${offset}h`,
              source: p.source || 'Mô hình AI Spatio-Temporal',
              updated_at: new Date().toISOString()
            };
          });

        this.predictionOverlay = { floodPoints: aiFloods, trafficIncidents: aiTraffics };
        this.renderAllData();

        if (aiFloods.length > 0) {
          this.showToast(`AI: Phát hiện ${aiFloods.length} điểm có nguy cơ ngập lụt sau +${offset}h tới!`, 'warning', 4500);
        }
        if (aiTraffics.length > 0) {
          const jamCount = aiTraffics.filter(t => t.isJam).length;
          const roadworkCount = aiTraffics.filter(t => !t.isJam).length;
          let msg = `AI: Dự báo sau +${offset}h ghi nhận ${jamCount} điểm ùn tắc`;
          if (roadworkCount > 0) msg += ` và ${roadworkCount} điểm công trường`;
          this.showToast(msg, 'info', 4000);
        } else {
          this.showToast(`AI: Dự báo sau +${offset}h đường phố thông thoáng, không phát hiện ùn tắc lớn!`, 'info', 4000);
        }
      } catch (err) {
        console.warn('Lỗi khi nạp dữ liệu dự báo AI:', err);
      }
    } else {
      this.predictionOverlay = { floodPoints: [], trafficIncidents: [] };
      this.renderAllData();
      this.showToast('Đã khôi phục dữ liệu thời gian thực hiện tại', 'info', 2500);
    }
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
          <div style="font-size: 13px; color: #5f6368; font-weight: 500;">Đang tìm đường & phân tích ngõ ngách né ngập...</div>
          <div style="font-size: 11px; color: #70757a; margin-top: 4px;">Chế độ: ${levelConfig.name}</div>
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
      this.showToast('Vui lòng nhập đầy đủ điểm đi và điểm đến', 'warning');
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
      this.showToast('Không tìm thấy địa chỉ cụ thể. Vui lòng bấm chọn gợi ý hoặc bấm "Chọn trên bản đồ"', 'warning', 4500);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding: 14px; text-align: center;">
            <div style="color: #d93025; font-size: 13px; font-weight: 600;">Không xác định được địa chỉ</div>
            <div style="color: #70757a; font-size: 12px; margin-top: 4px;">Hãy chọn từ danh sách gợi ý khi gõ hoặc bấm nút Bản đồ để chọn trực tiếp trên bản đồ.</div>
          </div>
        `;
      }
      return;
    }

    // Cập nhật marker A và B trên bản đồ
    this.updateRouteMarker('origin', origin.lat, origin.lng, origin.title || originText);
    this.updateRouteMarker('dest', dest.lat, dest.lng, dest.title || destText);

    let effectiveFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity);
    let effectiveTraffic = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity);

    // [CHẾ ĐỘ GIẢ LẬP]: Bổ sung các điểm ngập mô phỏng vào phân tích lộ trình nếu đang bật Giả lập
    if (this.isSimulationMode) {
      const simFloods = this.getSimulatedFloods(this.currentCity);
      effectiveFloods = [...simFloods, ...effectiveFloods];
    }

    // [DỰ BÁO TƯƠNG LAI]: Sử dụng trạng thái ngập và kẹt xe dự đoán thay vì dồn ứ các điểm quá khứ
    if (this.currentPredictionOffset > 0 && this.predictionOverlay) {
      effectiveFloods = this.predictionOverlay.floodPoints || [];
      effectiveTraffic = this.predictionOverlay.trafficIncidents || [];
    }

    try {
      const result = await window.routingService.calculateMultiRoutes({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        floodPoints: effectiveFloods,
        trafficIncidents: effectiveTraffic,
        vehicleType: this.currentVehicle,
        avoidLevel: this.currentAvoidLevel
      });

      this.lastRouteResult = result;

      // Xử lý khi KHÔNG CÓ TUYẾN ĐƯỜNG ĐI ĐƯỢC CHO PHƯƠNG TIỆN
      if (result.noPassableRoute) {
        this.clearRouteLayers();

        if (summaryContainer) {
          this.renderRouteSummary(summaryContainer, result);
        }

        if (resultsContainer) {
          this.renderNoPassableCard(resultsContainer, result);
        }

        const box = document.getElementById('gm-ai-suggestion');
        if (box) box.style.display = 'none';

        this.showToast(`Không có đường đi được cho ${result.vehicleSpecs ? result.vehicleSpecs.name : 'xe'} do ngập sâu!`, 'danger', 5000);
        return;
      }

      // Vẽ các tuyến đường hợp lệ lên bản đồ
      this.displayMultiRoutes(result);

      // Render summary bar
      if (summaryContainer) {
        this.renderRouteSummary(summaryContainer, result);
      }

      // Render route cards
      if (resultsContainer) {
        this.renderRouteCards(resultsContainer, result);
      }

      // GỢI Ý THÔNG MINH TỰ ĐỘNG (Passive AI - Không tốn lượt API request)
      this.generateSmartSuggestion(result);

    } catch (e) {
      console.error('[Routing Error]', e);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding: 14px; text-align: center;">
            <div style="color: #d93025; font-size: 13px; font-weight: 600;">Lỗi tính toán tuyến đường</div>
            <div style="color: #70757a; font-size: 12px; margin-top: 4px;">${e.message}</div>
            <button onclick="window.appState.calculateSmartRoute()" 
              style="margin-top: 10px; padding: 6px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
              Thử lại
            </button>
          </div>
        `;
      }
    }
  }

  /**
   * GỢI Ý THÔNG MINH TỰ ĐỘNG (PASSIVE AI - KHÔNG TỐN LƯỢT API REQUEST)
   * Phân tích ngữ cảnh: thời gian, phương tiện, thời tiết, ngập, kẹt xe
   * và đưa ra lời khuyên tùy từng trường hợp cụ thể.
   * Chạy 100% logic tất định trên Client, KHÔNG gọi Gemini API.
   */
  generateSmartSuggestion(result) {
    const box = document.getElementById('gm-ai-suggestion');
    if (!box) return;

    const now = new Date();
    const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    let vnHour = vnNow.getHours();
    if (this.currentPredictionOffset > 0) {
      vnHour = (vnHour + this.currentPredictionOffset) % 24;
    }
    const vnMinute = vnNow.getMinutes();
    const vnDay = vnNow.getDay(); // 0 = CN, 6 = T7
    const timeStr = `${String(vnHour).padStart(2,'0')}:${String(vnMinute).padStart(2,'0')}`;
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[vnDay];

    const vehicle = this.currentVehicle; // 'motorbike', 'car', 'ebike', 'ecar'
    const vehicleNames = {
      motorbike: 'Xe máy',
      car: 'Ô tô',
      ebike: 'Xe máy điện',
      ecar: 'Ô tô điện'
    };
    const vehicleName = vehicleNames[vehicle] || 'Xe máy';
    const isTwoWheeler = (vehicle === 'motorbike' || vehicle === 'ebike');

    const routes = result.routes || [];
    const recommended = routes.find(r => r.isRecommended) || routes[0];
    if (!recommended) { box.style.display = 'none'; return; }

    // Lấy dữ liệu ngập & kẹt xe trong thành phố hiện tại (hoặc theo dự báo AI nếu đang xem tương lai)
    let cityFloods = this.liveData.floodPoints.filter(f => f.city === this.currentCity && f.depth_cm > 0 && f.danger_level !== 'safe');
    let cityJams = this.liveData.trafficIncidents.filter(t => t.city === this.currentCity && t.isJam === true);
    if (this.currentPredictionOffset > 0 && this.predictionOverlay) {
      cityFloods = (this.predictionOverlay.floodPoints || []).filter(f => f.depth_cm > 0 && f.danger_level !== 'safe');
      cityJams = (this.predictionOverlay.trafficIncidents || []).filter(t => t.isJam === true);
    }
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
    const hasDeepFlood = routeFloods.some(f => f.depth_cm >= (isTwoWheeler ? 20 : 35));
    const distKm = parseFloat(recommended.distanceKm) || 5;
    const isLongTrip = distKm > 12;

    // ====== TẠO LỜI KHUYÊN CHÍNH ======
    let mainAdvice = '';
    const details = [];

    // 1. Thời điểm trong ngày
    if (isPeakMorning) {
      mainAdvice = `Đang là giờ cao điểm sáng (${timeStr}) — Lưu lượng xe rất đông trên các trục chính.`;
      if (vehicle === 'motorbike') {
        details.push({ text: `Xe máy nên ưu tiên Tuyến An toàn đi vòng qua các ngõ phố thông thoáng, tránh chen chúc trục đường lớn.` });
      } else {
        details.push({ text: `Ô tô nên đi theo Tuyến Cân bằng để tối ưu cự ly. Hạn chế đường nhỏ vì khó quay đầu khi kẹt.` });
      }
    } else if (isPeakEvening) {
      mainAdvice = `Đang là giờ cao điểm chiều (${timeStr}) — Mật độ phương tiện tan tầm rất lớn.`;
      if (vehicle === 'motorbike') {
        details.push({ text: `Xe máy nên chọn Tuyến An toàn. Giờ tan tầm xe máy dễ bị kẹt khi trộn với ô tô ở các nút giao lớn.` });
      } else {
        details.push({ text: `Ô tô nên chọn Tuyến Cân bằng hoặc chờ sau 19h30 khi lưu lượng giảm rõ rệt.` });
      }
    } else if (isLateNight) {
      mainAdvice = `Ban đêm (${timeStr}) — Đường phố rất vắng, di chuyển thuận lợi.`;
      details.push({ text: `Lúc này mọi tuyến đều thông thoáng. Chọn Tuyến Nhanh nhất để tiết kiệm thời gian!` });
      details.push({ text: `Chú ý: Một số đoạn có rào chắn thi công đêm (trải thảm nhựa / sửa cống). Quan sát đèn hiệu.` });
    } else if (isEarlyMorning) {
      mainAdvice = `Đầu sáng sớm (${timeStr}) — Tầm nhìn hạn chế, đường chưa đông.`;
      details.push({ text: `Giao thông thưa thớt, bạn có thể chọn Tuyến Nhanh nhất. Bật đèn phương tiện sáng rõ!` });
    } else if (isMidday && !isWeekend) {
      mainAdvice = `Giữa trưa (${timeStr}) — Giao thông nội thành tương đối thoáng.`;
      details.push({ text: `Lượng xe vừa phải. Chọn Tuyến Cân bằng để đi nhanh và không quá xa so với đường thẳng.` });
    } else if (isWeekend && !isPeakHour) {
      mainAdvice = `${dayName} (${timeStr}) — Cuối tuần giao thông khá dễ chịu.`;
      details.push({ text: `Cuối tuần đường ít xe, chọn Tuyến Nhanh nhất hoàn toàn phù hợp!` });
    } else {
      mainAdvice = `${dayName} ${timeStr} — Lưu lượng giao thông ở mức trung bình.`;
      details.push({ text: `Giao thông ổn định. Tuyến Cân bằng là lựa chọn hợp lý cho khung giờ này.` });
    }

    // 2. Thời tiết & Mưa ngập
    if (isStormRain) {
      details.push({ text: `Mưa xối xả (${maxRain} mm/h)! Bắt buộc chọn Tuyến An toàn né 100% rốn ngập. ${vehicle === 'motorbike' ? 'Xe máy cực kỳ dễ chết máy bugi!' : 'Ô tô gầm thấp nguy cơ thủy kích!'}` });
    } else if (isHeavyRain) {
      details.push({ text: `Đang mưa vừa (${maxRain} mm/h). Các rốn ngập trũng bắt đầu đọng nước 15-20cm. ${vehicle === 'motorbike' ? 'Xe máy nên đi vòng tránh vùng trũng.' : 'Ô tô giữ khoảng cách, giảm tốc qua vũng.'}` });
    } else if (isRaining) {
      details.push({ text: `Mưa nhẹ rải rác (${maxRain} mm/h). Đường hơi trơn, bật đèn và giảm tốc độ.` });
    }
    if (avgTemp >= 37) {
      details.push({ text: `Nhiệt độ cao (${avgTemp}°C). Nếu đi xa hãy nghỉ giữa đường, uống nước đủ. ${vehicle === 'car' ? 'Kiểm tra nước làm mát ô tô.' : ''}` });
    }

    // 3. Ngập trên tuyến
    if (hasDeepFlood) {
      const worstFlood = routeFloods.sort((a,b) => b.depth_cm - a.depth_cm)[0];
      details.push({ text: `Ngập sâu ${worstFlood.depth_cm}cm tại ${worstFlood.name}. ${vehicle === 'motorbike' ? 'Xe máy KHÔNG THỂ QUA — hệ thống đã tự động bẻ hướng sang đường cao ráo!' : 'Ô tô gầm thấp nguy cơ thủy kích, chọn Tuyến An toàn!'}` });
    } else if (hasRouteFlood) {
      details.push({ text: `Có điểm ngập nhẹ trên tuyến nhưng vẫn đi được. Giảm tốc khi qua vùng nước đọng.` });
    }

    // 4. Kẹt xe trên tuyến
    if (hasRouteJam) {
      const worstJam = routeTraffics.filter(t => t.isJam).sort((a,b) => (b.delaySeconds||0) - (a.delaySeconds||0))[0];
      const delayMin = worstJam ? Math.round((worstJam.delaySeconds || 300) / 60) : 5;
      details.push({ text: `Ùn tắc trên tuyến (trễ ~${delayMin} phút). ${vehicle === 'motorbike' ? 'Xe máy có thể luồn lách, ảnh hưởng nhẹ.' : 'Ô tô nên chuyển sang tuyến ít tắc hơn.'}` });
    }

    // 5. Phương tiện cụ thể
    if (vehicle === 'ebike') {
      details.push({ text: `Xe máy điện: Động cơ bánh sau và khoang pin sàn rất nhạy cảm với nước. Tuyệt đối không qua rốn ngập sâu >15cm.` });
      if (isLongTrip) {
        details.push({ text: `Quãng đường ~${distKm}km: Lưu ý kiểm tra dung lượng pin còn lại trước khi xuất phát.` });
      }
    } else if (vehicle === 'ecar') {
      details.push({ text: `Ô tô điện: Bộ pin gầm xe chống nước IP67 nhưng vẫn cần tránh rốn ngập sâu trên 30cm để đảm bảo an toàn cảm biến.` });
      if (isPeakHour) {
        details.push({ text: `Giờ cao điểm: Ưu tiên điểm đỗ có sẵn trạm sạc nếu cần bổ sung năng lượng.` });
      }
    } else if (vehicle === 'motorbike') {
      if (isLongTrip) {
        details.push({ text: `Quãng đường ~${distKm}km khá dài cho xe máy. Nếu chở đồ cồng kềnh / nặng, ưu tiên tuyến ít rẽ ngoặt (Tuyến Cân bằng).` });
      }
      if (isRaining || isHeavyRain) {
        details.push({ text: `Chuẩn bị áo mưa bộ. Tránh đỗ xe ở tầng hầm khu vực trũng.` });
      }
    } else {
      if (isLongTrip) {
        details.push({ text: `Quãng đường ~${distKm}km. Ô tô nên đi trục chính rộng, hạn chế ngõ hẹp khó quay đầu.` });
      }
      if (isPeakHour) {
        details.push({ text: `Giờ cao điểm — Cân nhắc bãi đỗ xe tại điểm đến trước khi xuất phát.` });
      }
    }

    // 6. Kết luận tuyến đề xuất
    const recLabel = recommended.label || (recommended.avoidLevel === 1 ? 'An toàn hành lang lớn' : recommended.avoidLevel === 2 ? 'Trục chính êm ái' : 'Nhanh thực tế');
    details.push({ text: `<strong>Đề xuất: ${recLabel}</strong> — ${recommended.distanceKm} km, ~${recommended.durationMin} phút (${recommended.trafficDesc}).` });

    // ====== RENDER HTML ======
    const contextTags = [
      { text: `${timeStr} ${dayName}` },
      { text: vehicleName },
      { text: maxRain >= 1 ? `Mưa ${maxRain}mm` : `${avgTemp}°C Khô ráo` },
      { text: `${cityFloods.length} rốn ngập` },
      { text: `${cityJams.length} điểm tắc` }
    ];

    box.innerHTML = `
      <div class="gm-suggestion-header">
        <span>Gợi ý thông minh</span>
        <span class="sug-badge">Tự động • Không tốn lượt</span>
      </div>
      <div class="gm-suggestion-body">
        <div class="sug-main-advice">${mainAdvice}</div>
        <ul class="sug-detail-list">
          ${details.map(d => `<li><span>•</span><span>${d.text}</span></li>`).join('')}
        </ul>
      </div>
      <div class="gm-suggestion-context">
        ${contextTags.map(t => `<span class="ctx-tag">${t.text}</span>`).join('')}
      </div>
      <div class="gm-suggestion-toggle" onclick="this.parentElement.querySelector('.gm-suggestion-body').style.display = this.parentElement.querySelector('.gm-suggestion-body').style.display === 'none' ? 'block' : 'none'; this.textContent = this.textContent.includes('Thu gọn') ? 'Xem gợi ý chi tiết' : 'Thu gọn'">
        Thu gọn
      </div>
    `;
    box.style.display = 'block';
  }

  // Xóa sạch các layer route trên bản đồ
  clearRouteLayers() {
    const mapEng = window.mapEngine;
    if (!mapEng || !mapEng.map) return;
    if (mapEng.layers.routeSafeOutline) {
      mapEng.map.removeLayer(mapEng.layers.routeSafeOutline);
      mapEng.layers.routeSafeOutline = null;
    }
    if (mapEng.layers.routeSafe) {
      mapEng.map.removeLayer(mapEng.layers.routeSafe);
      mapEng.layers.routeSafe = null;
    }
    if (mapEng.layers.routeDanger) {
      mapEng.map.removeLayer(mapEng.layers.routeDanger);
      mapEng.layers.routeDanger = null;
    }
    if (mapEng._extraRouteLayers) {
      mapEng._extraRouteLayers.forEach(l => mapEng.map.removeLayer(l));
    }
    mapEng._extraRouteLayers = [];

    // Xóa điểm ghim xuất phát A và điểm đến B
    if (this.routeMarkers) {
      if (this.routeMarkers.origin && mapEng.map) {
        mapEng.map.removeLayer(this.routeMarkers.origin);
        this.routeMarkers.origin = null;
      }
      if (this.routeMarkers.destination && mapEng.map) {
        mapEng.map.removeLayer(this.routeMarkers.destination);
        this.routeMarkers.destination = null;
      }
    }
  }

  // Render thẻ cảnh báo khi KHÔNG CÓ ĐƯỜNG ĐI ĐƯỢC
  renderNoPassableCard(container, result) {
    const specs = result.vehicleSpecs || { name: 'Phương tiện của bạn', maxPassableDepth: 20, hazardRisk: 'Ngập nước chết máy' };
    const blockedFloods = result.blockedFloods || [];

    const spotsListHtml = blockedFloods.map(f => `
      <li style="margin-bottom: 6px;">
        <strong>${f.name}:</strong> Ngập sâu <strong style="color: #d93025;">${f.depth_cm}cm</strong>
        <span style="color: #70757a; font-size: 11px;"> (vượt quá giới hạn lội nước ${specs.maxPassableDepth}cm của ${specs.name})</span>
      </li>
    `).join('');

    container.innerHTML = `
      <div class="gm-impassable-card" style="margin: 12px; padding: 16px; background: #fff5f5; border: 1.5px solid #ea4335; border-radius: 10px;">
        <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
          <div>
            <div style="color: #d93025; font-size: 14px; font-weight: 700; text-transform: uppercase;">
              Không có tuyến đường đi được cho ${specs.name}
            </div>
            <div style="color: #5f6368; font-size: 12px; margin-top: 2px;">
              Đặc tính kỹ thuật: Giới hạn lội nước tối đa <strong>${specs.maxPassableDepth} cm</strong>
            </div>
          </div>
        </div>

        <div style="font-size: 12px; color: #3c4043; line-height: 1.5; margin-bottom: 10px; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #fad2cf;">
          <strong>MoveSafe bảo vệ xe của bạn:</strong> Hệ thống không chỉ đường liều lĩnh qua các rốn ngập sâu vì nguy cơ cốt tử: 
          <strong style="color: #d93025;">${specs.hazardRisk}</strong>.
        </div>

        ${blockedFloods.length > 0 ? `
          <div style="font-size: 12px; font-weight: 600; color: #202124; margin-bottom: 6px;">
            Các điểm ngập sâu đang cô lập hành lang đến đích:
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #3c4043;">
            ${spotsListHtml}
          </ul>
        ` : ''}

        <div style="margin-top: 12px; padding: 8px 10px; background: #e8f0fe; border-radius: 6px; font-size: 11px; color: #1a73e8; line-height: 1.4;">
          <strong>Khuyến nghị:</strong> Bạn nên tạm hoãn di chuyển 30-45 phút chờ các trạm bơm tiêu thoát nước, hoặc chuyển sang phương tiện gầm cao (SUV / bán tải) hoặc tuyến metro trên cao.
        </div>

        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button type="button" onclick="window.appState && window.appState.openSosRescueModal()" 
            style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #dc2626; color: #ffffff; border: none; border-radius: 7px; padding: 9px 12px; font-size: 12px; font-weight: 700; cursor: pointer;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span>Tìm Điểm Trú Mưa Cao Ráo & Cứu Hộ 24/7</span>
          </button>
        </div>
      </div>
    `;
  }

  // Vẽ đa tuyến đường lên bản đồ (với màu sắc & highlight theo từng chế độ)
  displayMultiRoutes(result) {
    const mapEng = window.mapEngine;
    
    // Xóa sạch các layer route cũ
    this.clearRouteLayers();

    if (!result || result.noPassableRoute || !result.routes || result.routes.length === 0) {
      return;
    }

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
            style="margin-top: 8px; width: 100%; padding: 5px 10px; background: ${lineColor}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">
            Chọn tuyến đường này
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
          <strong style="color: ${recommended.color}; font-size: 13px;">${recommended.label} (Đang chọn)</strong><br>
          <span style="color: #202124; font-weight: 600;">${recommended.distanceKm} km • ~${recommended.durationMin} phút</span><br>
          <span style="font-size: 11px; color: #3c4043;">${recommended.trafficDesc}</span><br>
          <div style="margin-top: 4px; font-size: 11px; color: ${recommended.color}; font-weight: 700;">${recommended.tagText}</div>
        </div>
      `);

      mapEng.map.fitBounds(mapEng.layers.routeSafe.getBounds(), { padding: [60, 60] });
    }
  }

  getCoordDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  getNearbyEVStationsForRoute(routeCoords, maxStations = 3) {
    const allStations = (window.mapEngine && window.mapEngine._evStationsData) || window.MOVE_SAFE_EV_STATIONS || [];
    const cityStations = allStations.filter(s => !s.city || s.city === this.currentCity);
    if (!cityStations.length || !routeCoords || !routeCoords.length) return [];

    const sampleStep = Math.max(1, Math.floor(routeCoords.length / 30));
    const sampledPoints = [];
    for (let i = 0; i < routeCoords.length; i += sampleStep) {
      sampledPoints.push(routeCoords[i]);
    }
    sampledPoints.push(routeCoords[routeCoords.length - 1]);

    const results = [];
    cityStations.forEach(st => {
      if (typeof st.lat !== 'number' || typeof st.lng !== 'number') return;
      let minDist = Infinity;
      for (let p of sampledPoints) {
        const d = this.getCoordDistanceMeters(p[0], p[1], st.lat, st.lng);
        if (d < minDist) minDist = d;
      }
      if (minDist <= 3000) {
        results.push({
          ...st,
          routeDistMeters: Math.round(minDist)
        });
      }
    });

    results.sort((a, b) => a.routeDistMeters - b.routeDistMeters);
    return results.slice(0, maxStations);
  }

  // Render summary bar
  renderRouteSummary(container, result) {
    if (result.noPassableRoute) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
          <span class="gm-summary-badge" style="background: #d93025; color: #fff;">
            Không thể đi
          </span>
          <span class="gm-summary-text" style="color: #d93025; font-weight: 600;">
            ${result.message}
          </span>
        </div>
      `;
      container.style.display = 'flex';
      return;
    }

    const { routes, vehicleSpecs, blockedRoutes } = result;
    const recommended = routes.find(r => r.isRecommended) || routes[0];
    const fastestRoute = routes.find(r => r.avoidLevel === 3) || routes[0];
    
    let badgeClass = 'badge-safe';
    if (recommended.avoidLevel === 2) badgeClass = 'badge-warning';
    if (recommended.avoidLevel === 3) badgeClass = 'badge-safe';

    let diffHtml = '';
    if (recommended.avoidLevel !== 3 && recommended.durationMin > fastestRoute.durationMin) {
      const diff = Math.round(recommended.durationMin - fastestRoute.durationMin);
      diffHtml = `
        <div style="font-size: 12px; color: #1e8e3e; margin-top: 6px; font-weight: 500; display: flex; align-items: center; gap: 4px;">
          Lộ trình này chậm hơn ${diff} phút nhưng đảm bảo an toàn kỹ thuật cho ${vehicleSpecs ? vehicleSpecs.name : 'xe'}.
        </div>
      `;
    }

    let avoidedNotice = '';
    if (blockedRoutes && blockedRoutes.length > 0) {
      const b = blockedRoutes[0];
      avoidedNotice = `
        <div style="font-size: 11px; color: #137333; margin-top: 6px; padding: 5px 8px; background: #e6f4ea; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
          <strong>Đã tự động né ngập:</strong> Trục ngắn nhất (${b.distanceKm} km) bị loại bỏ vì ${b.reason}.
        </div>
      `;
    }

    let evSuggestionsHtml = '';
    const routeCoords = recommended.polyline || recommended.coordinates;
    if ((this.currentVehicle === 'ecar' || this.currentVehicle === 'ebike') && routeCoords && routeCoords.length > 0) {
      const nearbyEVs = this.getNearbyEVStationsForRoute(routeCoords);
      if (nearbyEVs.length > 0) {
        const estBattery = Math.max(1, Math.round(recommended.distanceKm * 0.42));
        evSuggestionsHtml = `
          <div class="ev-route-suggestions">
            <div class="ev-route-header">
              <div class="ev-route-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>Trạm sạc dọc lộ trình (${nearbyEVs.length} trạm tiện đường)</span>
              </div>
              <span class="ev-battery-tag">Tiêu thụ ước tính: ~${estBattery}% pin (${recommended.distanceKm} km)</span>
            </div>
            <div class="ev-stations-inline-list">
              ${nearbyEVs.map(st => `
                <div class="ev-station-inline-card" onclick="window.mapEngine && window.mapEngine.focusEVStation('${st.id}')" title="Bấm để xem vị trí trên bản đồ">
                  <div class="ev-station-info">
                    <div class="ev-station-name">${st.name}</div>
                    <div class="ev-station-meta">
                      <span class="ev-meta-power">⚡ ${st.maxPowerKw ? st.maxPowerKw + 'kW' : 'Đổi pin'}</span>
                      <span class="ev-meta-dist">Cách tuyến ~${st.routeDistMeters < 1000 ? st.routeDistMeters + 'm' : (st.routeDistMeters/1000).toFixed(1) + 'km'}</span>
                      <span class="ev-meta-op">${st.operator || 'VinFast'}</span>
                    </div>
                  </div>
                  <button class="ev-btn-view" type="button">Xem trạm</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="gm-summary-badge ${badgeClass}" style="background: ${recommended.color}; color: #fff;">
              Mức ${recommended.avoidLevel}: ${recommended.label}
            </span>
            <span class="gm-summary-text">${recommended.trafficDesc}</span>
          </div>
          ${vehicleSpecs ? `
            <span style="font-size: 11px; padding: 2px 8px; background: #f1f3f4; border-radius: 12px; color: #3c4043; font-weight: 600;" title="Ngưỡng an toàn kỹ thuật của ${vehicleSpecs.name}">
              ${vehicleSpecs.name} (Ngưỡng lội: ${vehicleSpecs.maxPassableDepth}cm)
            </span>
          ` : ''}
        </div>
        ${avoidedNotice}
        ${diffHtml}
        ${evSuggestionsHtml}
      </div>
    `;
    container.style.display = 'flex';
  }

  // Render route cards phong cách Google Maps kèm thanh phân loại tắc đường trực quan & ngõ ngách
  renderRouteCards(container, result) {
    const { routes, vehicleSpecs, blockedRoutes } = result;
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
            ? `Nước nông ${w.depth_cm}cm - ${w.name} (Đi an toàn)`
            : `${w.description || w.categoryName || 'Ùn tắc'}`;
          return `<div class="gm-warning-item"><span class="warn-dot ${dotClass}"></span> ${label}</div>`;
        }).join('');
        
        const moreCount = route.warnings.length - 3;
        warningsHtml = `
          <div class="gm-route-warnings">
            ${warningItems}
            ${moreCount > 0 ? `<div class="gm-warning-item" style="color: #70757a;">+ ${moreCount} điểm khác</div>` : ''}
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
        const stepItems = route.steps.map((s, sIdx) => {
          const trans = this.translateStepInstruction(s);
          return `
            <div class="gm-step-item clickable-step" title="Nhấp để định vị và nghe đọc bước rẽ này" onclick="event.stopPropagation(); window.appState.previewRouteStep(${index}, ${sIdx})">
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
            Chi tiết lộ trình & các ngõ ngách (${route.steps.length} bước) ▾
          </div>
          <div class="gm-route-steps-list" id="steps-list-${index}" style="display: none;">
            ${stepItems}
          </div>
        `;
      }

      // Huy hiệu RPI (Độ tin cậy thời gian thực tế)
      let rpiHtml = '';
      if (route.rpi !== undefined) {
        const rpiClass = route.rpi >= 85 ? 'gm-rpi-high' : (route.rpi >= 65 ? 'gm-rpi-med' : 'gm-rpi-low');
        const rpiIcon = route.rpi >= 85 ? '✓' : (route.rpi >= 65 ? '~' : '⚠️');
        rpiHtml = `<span class="gm-route-rpi-badge ${rpiClass}" title="Độ tin cậy lộ trình: ${route.rpi}% (xác suất đến đúng giờ dự kiến)">${rpiIcon} Tin cậy ${route.rpi}%</span>`;
      }

      // Thẻ tốc độ thực tế dòng xe & độ trễ
      let speedTagHtml = '';
      if (route.realAvgSpeedKmh) {
        const delayStr = route.delayMin > 0 ? ` • Trễ +${route.delayMin}p do tắc` : ' • Lưu thông đều';
        speedTagHtml = `
          <div class="gm-route-speed-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Tốc độ thực tế: <strong>~${route.realAvgSpeedKmh} km/h</strong>${delayStr}
          </div>
        `;
      }

      // Cảnh báo nút thắt cổ chai
      let bottleneckHtml = '';
      if (route.bottleneckWarnings && route.bottleneckWarnings.length > 0) {
        bottleneckHtml = `
          <div class="gm-bottleneck-tag">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Nút thắt cổ chai: ${route.bottleneckWarnings.slice(0, 2).join(', ')}
          </div>
        `;
      }

      // Cảnh báo bẫy ngõ hẹp cho ô tô
      let alleyTrapHtml = '';
      if (route.hasAlleyTrap) {
        alleyTrapHtml = `
          <div class="gm-alley-warning-tag">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Đoạn ngõ hẹp (${route.alleyDistanceMeters}m) • Ô tô khó quay đầu
          </div>
        `;
      }

      html += `
        <div class="gm-route-card ${cardClass}" data-route-index="${index}" onclick="window.appState.selectRouteOnMap(${index})">
          <div class="gm-route-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px;">
            <div class="gm-route-label ${labelClass}" style="color: ${route.color}; margin-bottom: 0;">
              <span>${route.label}</span>
            </div>
            <div class="gm-route-header-badges" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              ${route.isRecommended ? `<span class="gm-badge-selected" style="background: ${route.color}; color: #ffffff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;">Đang chọn</span>` : ''}
              ${rpiHtml}
            </div>
          </div>
          <div class="gm-route-time ${timeClass}">
            <span style="color: ${route.color};">~${route.durationMin} phút${timeDiffText}</span>
            <span style="font-size: 13px; font-weight: normal; color: #5f6368;">(${route.distanceKm} km)</span>
          </div>
          ${speedTagHtml}
          <div class="gm-route-meta" style="font-size: 12px; color: #3c4043; margin-top: 3px;">${route.trafficDesc}</div>
          ${bottleneckHtml}
          ${alleyTrapHtml}

          <!-- Huy hiệu kiểm định kỹ thuật phương tiện -->
          <div style="font-size: 11px; color: #137333; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
            <span>•</span> Tuyến xe ĐI ĐƯỢC an toàn (${vehicleSpecs ? vehicleSpecs.name : 'Phương tiện'})
          </div>
          
          <!-- Phân loại mức độ tắc đường trực quan (Traffic Congestion Mini-Bar) -->
          <div class="gm-traffic-bar-container">
            <div class="gm-traffic-bar-header">
              <span class="gm-traffic-bar-title">Đánh giá lưu thông:</span>
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

          <!-- Cụm nút Dẫn đường Giọng nói (Turn-by-Turn) & Chia sẻ Link Lộ trình An toàn -->
          <div class="gm-route-card-actions">
            <button type="button" class="gm-btn-voice-nav" onclick="event.stopPropagation(); window.appState.startVoiceNavigation(${index}, this)" title="Phóng to lộ trình và đọc hướng dẫn từng bước bằng giọng nói tiếng Việt">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              <span>Bắt đầu dẫn đường (Giọng nói)</span>
            </button>
            <button type="button" class="gm-btn-share-route" onclick="event.stopPropagation(); window.appState.shareSafeRoute(${index})" title="Sao chép link lộ trình an toàn này để gửi cho người thân hoặc đồng nghiệp">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              <span>Chia sẻ lộ trình</span>
            </button>
          </div>

          ${stepsHtml}
        </div>
      `;
    });

    // Phần hiển thị các trục đường đã được MoveSafe chủ động né tránh để bảo vệ xe
    if (blockedRoutes && blockedRoutes.length > 0) {
      html += `
        <div style="margin: 12px 0 6px 0; padding: 10px 12px; background: #fff8e1; border: 1px dashed #f9ab00; border-radius: 8px;">
          <div style="font-size: 12px; font-weight: 700; color: #b06000; display: flex; align-items: center; justify-content: space-between; cursor: pointer;"
               onclick="const d = this.nextElementSibling; d.style.display = d.style.display === 'none' ? 'block' : 'none';">
            <span>MoveSafe đã chủ động loại bỏ ${blockedRoutes.length} trục đường ngập sâu</span>
            <span style="font-size: 11px;">Chi tiết ▾</span>
          </div>
          <div style="display: none; margin-top: 8px; font-size: 11px; color: #5f6368; line-height: 1.4;">
            <p style="margin: 0 0 6px 0;">Hệ thống không chỉ đường qua các trục này do vượt quá ngưỡng an toàn kỹ thuật của ${vehicleSpecs ? vehicleSpecs.name : 'xe'}:</p>
            <ul style="margin: 0; padding-left: 16px;">
              ${blockedRoutes.map(b => `
                <li style="margin-bottom: 4px;">
                  <strong>Tuyến ${b.distanceKm} km:</strong> ${b.reason} — 
                  <span style="color: #d93025; font-weight: 600;">${vehicleSpecs ? vehicleSpecs.hazardRisk : 'Nguy hiểm'}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    }

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

  // =========================================================================
  // 13. 4 TÍNH NĂNG MỚI: QUICK COMMUTE, SHARE ROUTE, VOICE NAV, SOS RESCUE
  // =========================================================================

  initQuickCommutePresets() {
    this.updateCommutePlacesLabel();

    document.getElementById('btn-commute-go-work')?.addEventListener('click', () => {
      this.triggerQuickCommute('work');
    });

    document.getElementById('btn-commute-go-home')?.addEventListener('click', () => {
      this.triggerQuickCommute('home');
    });

    document.getElementById('btn-save-commute-places')?.addEventListener('click', () => {
      this.saveCurrentCommutePlaces();
    });

    document.getElementById('btn-directions-sos')?.addEventListener('click', () => {
      this.openSosRescueModal();
    });

    document.getElementById('chip-sos-rescue')?.addEventListener('click', () => {
      this.openSosRescueModal();
    });

    document.getElementById('btn-close-sos-rescue')?.addEventListener('click', () => {
      document.getElementById('modal-sos-rescue')?.classList.remove('open');
    });

    document.getElementById('btn-sos-copy-gps')?.addEventListener('click', () => {
      this.copySosGpsLocation();
    });
  }

  getCommutePresets() {
    const city = this.currentCity || 'hanoi';
    const defaults = {
      hanoi: {
        home: { name: 'Nhà (KĐT Cầu Giấy, Hà Nội)', lat: 21.0285, lng: 105.7820 },
        work: { name: 'Cơ quan (Hồ Hoàn Kiếm, Hà Nội)', lat: 21.0285, lng: 105.8542 }
      },
      hcm: {
        home: { name: 'Nhà (Thảo Điền, TP. Thủ Đức)', lat: 10.8030, lng: 106.7365 },
        work: { name: 'Cơ quan (Chợ Bến Thành, Quận 1)', lat: 10.7725, lng: 106.6980 }
      },
      danang: {
        home: { name: 'Nhà (Hải Châu, Đà Nẵng)', lat: 16.0471, lng: 108.2198 },
        work: { name: 'Cơ quan (Cầu Rồng, Sơn Trà)', lat: 16.0611, lng: 108.2274 }
      }
    };

    try {
      const saved = JSON.parse(localStorage.getItem('movesafe_commute_presets_v1') || '{}');
      if (saved[city] && saved[city].home && saved[city].work) {
        return saved[city];
      }
    } catch (e) {
      // ignore storage errors
    }
    return defaults[city] || defaults.hanoi;
  }

  updateCommutePlacesLabel() {
    const labelEl = document.getElementById('gm-qc-places-label');
    if (!labelEl) return;
    const presets = this.getCommutePresets();
    const shortHome = presets.home.name.length > 26 ? presets.home.name.slice(0, 26) + '...' : presets.home.name;
    const shortWork = presets.work.name.length > 26 ? presets.work.name.slice(0, 26) + '...' : presets.work.name;
    labelEl.innerHTML = `<strong>Nhà:</strong> ${shortHome} &nbsp;↔&nbsp; <strong>Cơ quan:</strong> ${shortWork}`;
  }

  saveCurrentCommutePlaces() {
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (!originInput || !destInput) return;

    const oName = originInput.value.trim();
    const dName = destInput.value.trim();
    const oLoc = this.routeLocations?.origin;
    const dLoc = this.routeLocations?.destination;
    const oLat = oLoc ? Number(oLoc.lat) : parseFloat(originInput.dataset.lat);
    const oLng = oLoc ? Number(oLoc.lng) : parseFloat(originInput.dataset.lng);
    const dLat = dLoc ? Number(dLoc.lat) : parseFloat(destInput.dataset.lat);
    const dLng = dLoc ? Number(dLoc.lng) : parseFloat(destInput.dataset.lng);

    if (!oName || !dName || isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      this.showToast('Hãy chọn Điểm đi (Nhà) và Điểm đến (Cơ quan) hợp lệ trước khi lưu!', 'warning', 3000);
      return;
    }

    const city = this.currentCity || 'hanoi';
    try {
      const saved = JSON.parse(localStorage.getItem('movesafe_commute_presets_v1') || '{}');
      saved[city] = {
        home: { name: oName, lat: oLat, lng: oLng },
        work: { name: dName, lat: dLat, lng: dLng }
      };
      localStorage.setItem('movesafe_commute_presets_v1', JSON.stringify(saved));
      this.updateCommutePlacesLabel();
      this.showToast(`Đã lưu lộ trình cố định: Nhà (${oName}) ↔ Cơ quan (${dName})`, 'success', 3500);
    } catch (e) {
      this.showToast('Không thể lưu vào trình duyệt', 'error', 2000);
    }
  }

  triggerQuickCommute(direction = 'work') {
    const presets = this.getCommutePresets();
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (!originInput || !destInput) return;

    const btnWork = document.getElementById('btn-commute-go-work');
    const btnHome = document.getElementById('btn-commute-go-home');
    btnWork?.classList.toggle('active', direction === 'work');
    btnHome?.classList.toggle('active', direction === 'home');

    const fromPlace = direction === 'work' ? presets.home : presets.work;
    const toPlace = direction === 'work' ? presets.work : presets.home;

    originInput.value = fromPlace.name;
    originInput.dataset.lat = fromPlace.lat;
    originInput.dataset.lng = fromPlace.lng;
    this.routeLocations.origin = { title: fromPlace.name, fullAddress: fromPlace.name, lat: fromPlace.lat, lng: fromPlace.lng };

    destInput.value = toPlace.name;
    destInput.dataset.lat = toPlace.lat;
    destInput.dataset.lng = toPlace.lng;
    this.routeLocations.destination = { title: toPlace.name, fullAddress: toPlace.name, lat: toPlace.lat, lng: toPlace.lng };

    const label = direction === 'work' ? 'Đi làm / Đi học (Nhà → Cơ quan)' : 'Về nhà ngay (Cơ quan → Nhà)';
    this.showToast(`Đang phân tích lộ trình an toàn 1-chạm: ${label}...`, 'info', 2800);
    this.calculateSmartRoute();
  }

  // --- CHIA SẺ LỘ TRÌNH AN TOÀN QUA LINK ---
  shareSafeRoute(routeIndex = 0) {
    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (!originInput || !destInput) return;

    const oLoc = this.routeLocations?.origin;
    const dLoc = this.routeLocations?.destination;

    const params = new URLSearchParams();
    params.set('city', this.currentCity || 'hanoi');
    params.set('fromName', originInput.value || 'Điểm đi');
    params.set('fromLat', String(oLoc?.lat || originInput.dataset.lat || ''));
    params.set('fromLng', String(oLoc?.lng || originInput.dataset.lng || ''));
    params.set('toName', destInput.value || 'Điểm đến');
    params.set('toLat', String(dLoc?.lat || destInput.dataset.lat || ''));
    params.set('toLng', String(dLoc?.lng || destInput.dataset.lng || ''));
    params.set('veh', this.currentVehicle || 'motorbike');
    params.set('avoid', String(this.currentAvoidLevel || 1));
    params.set('offset', String(this.currentPredictionOffset || 0));
    params.set('rIdx', String(routeIndex || 0));

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', shareUrl);

    const route = this.lastRouteResult?.routes?.[routeIndex];
    const safetyScore = route ? route.safetyScore : 95;
    const shareSummary = `[MoveSafe VN] Lộ trình an toàn (${safetyScore}/100): ${originInput.value} → ${destInput.value}. Xem bản đồ né ngập & kẹt xe: ${shareUrl}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast('Đã sao chép Link lộ trình an toàn vào bộ nhớ tạm! Hãy dán gửi cho người thân.', 'success', 4000);
      }).catch(() => {
        prompt('Sao chép link lộ trình an toàn bên dưới:', shareSummary);
      });
    } else {
      prompt('Sao chép link lộ trình an toàn bên dưới:', shareSummary);
    }
  }

  checkSharedRouteFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromLat = parseFloat(params.get('fromLat'));
      const fromLng = parseFloat(params.get('fromLng'));
      const toLat = parseFloat(params.get('toLat'));
      const toLng = parseFloat(params.get('toLng'));

      if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) return;

      const city = params.get('city');
      if (city && ['hanoi', 'hcm', 'danang'].includes(city) && city !== this.currentCity) {
        this.currentCity = city;
        const citySelect = document.getElementById('city-select-gm');
        if (citySelect) citySelect.value = city;
        window.mapEngine.flyToCity(city);
      }

      const veh = params.get('veh');
      if (veh) {
        this.currentVehicle = veh;
        document.querySelectorAll('.gm-veh-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.vehicle === veh);
        });
      }

      const avoid = parseInt(params.get('avoid'), 10);
      if (!isNaN(avoid) && [1, 2, 3].includes(avoid)) {
        this.currentAvoidLevel = avoid;
        document.querySelectorAll('.gm-avoidance-option').forEach(opt => {
          const isMatch = parseInt(opt.dataset.level, 10) === avoid;
          opt.classList.toggle('active', isMatch);
          const radio = opt.querySelector('input[type="radio"]');
          if (radio) radio.checked = isMatch;
        });
      }

      const fromName = params.get('fromName') || 'Điểm xuất phát đã chia sẻ';
      const toName = params.get('toName') || 'Điểm đến đã chia sẻ';
      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      if (originInput && destInput) {
        originInput.value = fromName;
        originInput.dataset.lat = String(fromLat);
        originInput.dataset.lng = String(fromLng);
        this.routeLocations.origin = { title: fromName, fullAddress: fromName, lat: fromLat, lng: fromLng };

        destInput.value = toName;
        destInput.dataset.lat = String(toLat);
        destInput.dataset.lng = String(toLng);
        this.routeLocations.destination = { title: toName, fullAddress: toName, lat: toLat, lng: toLng };

        setTimeout(() => {
          this.toggleDirectionsPanel(true);
          this.showToast('Đã tải lộ trình an toàn được chia sẻ qua liên kết!', 'info', 3500);
          this.calculateSmartRoute();
        }, 500);
      }
    } catch (e) {
      console.warn('Không thể đọc lộ trình từ URL:', e);
    }
  }

  // --- CHẾ ĐỘ DẪN ĐƯỜNG TỪNG BƯỚC BẰNG GIỌNG NÓI (VOICE NAVIGATION) ---
  startVoiceNavigation(routeIndex = 0, btnEl = null) {
    if (!this.lastRouteResult || !this.lastRouteResult.routes) return;
    const route = this.lastRouteResult.routes[routeIndex];
    if (!route) return;

    this.selectRouteOnMap(routeIndex);

    // Mở danh sách các bước đi của thẻ này
    const cardEl = document.querySelector(`.gm-route-card[data-route-index="${routeIndex}"]`);
    if (cardEl) {
      const stepsEl = cardEl.querySelector('.gm-route-steps');
      if (stepsEl) stepsEl.style.display = 'block';
    }

    // Phóng bản đồ tới điểm xuất phát
    if (route.geometry && route.geometry.length > 0 && window.mapEngine && window.mapEngine.map) {
      window.mapEngine.map.flyTo(route.geometry[0], 15, { duration: 1.0 });
    }

    const originName = document.getElementById('gm-route-origin')?.value || 'Điểm xuất phát';
    const destName = document.getElementById('gm-route-dest')?.value || 'Điểm đến';
    const firstSteps = (route.steps || []).slice(0, 3).map(s => {
      return `${s.instruction}${s.distance > 0 ? ` trong ${s.distanceText}` : ''}`;
    }).join('. Tiếp theo, ');

    const floodNotice = route.floodRiskCount > 0
      ? `Chú ý có ${route.floodRiskCount} điểm nguy cơ ngập trên tuyến.`
      : `Tuyến đường hoàn toàn khô ráo, không qua điểm ngập.`;

    const voiceScript = `Bắt đầu dẫn đường lộ trình ${route.label} từ ${originName} đến ${destName}. Tổng quãng đường ${route.distanceKm} ki lô mét, thời gian dự kiến ${route.estimatedMinutes} phút, chỉ số an toàn ${route.safetyScore} trên 100. ${floodNotice} Hướng dẫn chặng đầu: ${firstSteps}. Bạn có thể bấm vào từng chặng bên dưới để nghe đọc chi tiết.`;

    this.showToast(`Đang phát giọng nói dẫn đường: ${route.label} (${route.distanceKm} km)`, 'info', 4000);

    if (window.aiChat && typeof window.aiChat.toggleSpeakText === 'function') {
      const targetBtn = btnEl || cardEl?.querySelector('.gm-btn-voice-nav');
      window.aiChat.toggleSpeakText(voiceScript, targetBtn);
    }
  }

  previewRouteStep(routeIndex, stepIndex) {
    const route = this.lastRouteResult?.routes?.[routeIndex];
    if (!route || !route.steps || !route.steps[stepIndex]) return;
    const step = route.steps[stepIndex];

    // Highlight step item
    document.querySelectorAll('.gm-step-item.active-voice-step').forEach(el => el.classList.remove('active-voice-step'));
    const cardEl = document.querySelector(`.gm-route-card[data-route-index="${routeIndex}"]`);
    const stepEls = cardEl?.querySelectorAll('.gm-step-item');
    if (stepEls && stepEls[stepIndex]) {
      stepEls[stepIndex].classList.add('active-voice-step');
    }

    // Ước lượng vị trí bước đi dọc theo geometry của route để flyTo
    if (route.geometry && route.geometry.length > 1 && window.mapEngine && window.mapEngine.map) {
      const ratio = stepIndex / Math.max(1, route.steps.length - 1);
      const geoIdx = Math.min(route.geometry.length - 1, Math.floor(ratio * route.geometry.length));
      const coord = route.geometry[geoIdx];
      if (coord) {
        window.mapEngine.map.flyTo(coord, 16, { duration: 0.8 });
      }
    }

    const textToSpeak = `Chặng ${stepIndex + 1}: ${step.instruction}${step.distance > 0 ? `, đi tiếp ${step.distanceText}` : ''}.`;
    this.showToast(textToSpeak, 'info', 2500);
    if (window.aiChat && typeof window.aiChat.toggleSpeakText === 'function') {
      window.aiChat.toggleSpeakText(textToSpeak, null);
    }
  }

  // --- CỨU HỘ THỦY KÍCH & ĐIỂM TRÚ MƯA CAO RÁO (SOS & SAFE SHELTER) ---
  getSafeSheltersByCity(city) {
    const db = {
      hanoi: [
        { name: 'Ga Metro Cát Linh (Nhà ga trên cao Tầng 2-3)', address: '167 Hào Nam, Đống Đa, Hà Nội', lat: 21.0282, lng: 105.8268, elevation: '+14.5m (Tuyệt đối không ngập)', capacity: 'Gửi xe máy & Trú mưa 24/7', phone: '02438565656', type: 'metro' },
        { name: 'Ga Metro Cầu Giấy - ĐH Giao Thông Vận Tải', address: 'Nút giao Cầu Giấy - Kim Mã, Ba Đình', lat: 21.0292, lng: 105.8025, elevation: '+12.0m (Sảnh cao ráo)', capacity: 'Bãi gửi xe cao + Sảnh chờ có mái che', phone: '02437663311', type: 'metro' },
        { name: 'TTTM Lotte Center Hà Nội (Bãi đỗ xe nổi & Sảnh cao)', address: '54 Liễu Giai, Ba Đình, Hà Nội', lat: 21.0321, lng: 105.8127, elevation: '+9.5m (Hệ thống bơm chống ngập kép)', capacity: 'Ô tô, Xe máy, Trạm sạc EV', phone: '02433332500', type: 'mall' },
        { name: 'TTTM Aeon Mall Long Biên (Bãi đỗ xe nổi Tầng 2-3)', address: '27 Cổ Linh, Long Biên, Hà Nội', lat: 21.0268, lng: 105.8992, elevation: '+11.0m (Đường dốc lên tầng nổi)', capacity: 'Sức chứa >1.500 ô tô & xe máy', phone: '02432693000', type: 'mall' },
        { name: 'Vincom Center Trần Duy Hưng (Khu vực đỗ xe có đập chắn ngập)', address: '119 Trần Duy Hưng, Cầu Giấy, Hà Nội', lat: 21.0063, lng: 105.7955, elevation: '+8.2m (Có vách ngăn chống tràn)', capacity: 'Ô tô, Xe máy, Sạc VinFast', phone: '02439749999', type: 'mall' }
      ],
      hcm: [
        { name: 'Ga Metro Tân Cảng - Tuyến Metro Số 1 (Trên cao)', address: 'Chân cầu Sài Gòn, Bình Thạnh, TP.HCM', lat: 10.7985, lng: 106.7225, elevation: '+15.0m (Bãi giữ xe trên cao)', capacity: 'Giữ xe máy chống ngập + Trú mưa', phone: '02838221111', type: 'metro' },
        { name: 'Ga Metro Thảo Điền (Bãi xe kết nối cầu bộ hành)', address: 'Xa lộ Hà Nội, Thảo Điền, TP. Thủ Đức', lat: 10.8035, lng: 106.7355, elevation: '+13.5m (Cao hơn đỉnh triều cường)', capacity: 'Cứu hộ trú mưa cho người đi đường', phone: '02838221112', type: 'metro' },
        { name: 'TTTM Giga Mall Thủ Đức (Bãi xe nổi & Sảnh cao)', address: '240 Phạm Văn Đồng, Hiệp Bình Chánh, Thủ Đức', lat: 10.8278, lng: 106.7215, elevation: '+10.5m (Cốt nền cao ráo)', capacity: 'Ô tô, Xe máy, Trạm sạc EV', phone: '02871003838', type: 'mall' },
        { name: 'TTTM Crescent Mall Quận 7 (Nhà xe nổi nhiều tầng)', address: '101 Tôn Dật Tiên, Tân Phú, Quận 7', lat: 10.7289, lng: 106.7186, elevation: '+12.0m (Nhà để xe nổi an toàn)', capacity: 'Tránh triều cường Huỳnh Tấn Phát / Nguyễn Thị Thập', phone: '02854133333', type: 'mall' },
        { name: 'Diamond Plaza Quận 1 (Khu vực trung tâm cốt nền cao)', address: '34 Lê Duẩn, Bến Nghé, Quận 1', lat: 10.7812, lng: 106.6989, elevation: '+9.8m (Khu vực lịch sử không ngập)', capacity: 'Ô tô, Xe máy, Trú mưa an toàn', phone: '02838225500', type: 'mall' }
      ],
      danang: [
        { name: 'TTTM Vincom Plaza Ngô Quyền (Bãi đỗ xe cao ráo)', address: '910A Ngô Quyền, Sơn Trà, Đà Nẵng', lat: 16.0715, lng: 108.2305, elevation: '+9.5m (An toàn mưa lớn)', capacity: 'Ô tô, Xe máy, Trạm sạc EV', phone: '02363996688', type: 'mall' },
        { name: 'Sân vận động Hòa Xuân / Khu vực Đảo Xanh (Cốt nền cao)', address: 'Hòa Xuân, Cẩm Lệ, Đà Nẵng', lat: 16.0125, lng: 108.2155, elevation: '+10.0m (Bãi đỗ xe rộng chống ngập)', capacity: 'Điểm tập kết cứu hộ ô tô khi mưa bão', phone: '02363822333', type: 'shelter' },
        { name: 'Nhà ga T2 Sân bay Quốc tế Đà Nẵng (Nhà để xe nổi)', address: 'Duy Tân, Hải Châu, Đà Nẵng', lat: 16.0538, lng: 108.2045, elevation: '+12.5m (Nhà xe nổi 2 tầng)', capacity: 'Sức chứa lớn cho Ô tô & Xe máy', phone: '02363539555', type: 'metro' },
        { name: 'Lotte Mart Đà Nẵng (Bãi đỗ xe ngoài trời cốt cao)', address: '06 Nại Nam, Hòa Cường Bắc, Hải Châu', lat: 16.0389, lng: 108.2289, elevation: '+9.0m (Thoát nước trực tiếp sông Hàn)', capacity: 'Ô tô, Xe máy, Trú mưa 24/7', phone: '02363611999', type: 'mall' }
      ]
    };
    return db[city] || db.hanoi;
  }

  getRescueHotlinesByCity(city) {
    const common = [
      { name: 'Tổng đài Cứu hộ Giao thông & Cứu nạn Khẩn cấp Toàn quốc', desc: 'Cảnh sát PCCC & Cứu nạn cứu hộ (Mắc kẹt trong vùng ngập sâu, cây đổ)', phone: '114', badge: 'Khẩn cấp 24/7' },
      { name: 'Cứu hộ Kỹ thuật & Kéo xe Thủy kích VinFast / Xe điện 24/7', desc: 'Hỗ trợ cẩu kéo xe điện & ô tô chết máy do ngập nước về xưởng an toàn', phone: '1900232389', badge: 'Hỗ trợ EV & Ô tô' }
    ];
    const byCity = {
      hanoi: [
        { name: 'Đội Cứu hộ Giao thông 116 Hà Nội (Cẩu kéo Ô tô ngập nước)', desc: 'Trực chiến tại Cầu Giấy, Nguyễn Xiển, Giải Phóng, Long Biên', phone: '0909116116', badge: 'Có mặt sau 15p' },
        { name: 'Đội Cứu hộ Xe máy Chết máy & Thủy kích lưu động Hà Nội', desc: 'Sửa bugi, hút nước pô, thay dầu tại chỗ hoặc chở xe qua vùng ngập', phone: '0988116116', badge: 'Cứu hộ Xe máy' },
        { name: 'Đường dây nóng Công ty Thoát nước Hà Nội (Báo mất nắp cống / Ngập sâu)', desc: 'Ứng trực mở đập tràn và cắm biển cảnh báo hố ga nguy hiểm', phone: '02439746225', badge: 'Trực ban Mưa bão' }
      ],
      hcm: [
        { name: 'Cứu hộ Giao thông Sài Gòn 116 (Kéo xe ngập triều cường)', desc: 'Chuyên ứng cứu Nguyễn Hữu Cảnh, Huỳnh Tấn Phát, Thảo Điền, Quốc lộ 13', phone: '0934116116', badge: 'Trực chiến 24/7' },
        { name: 'Đội Hiệp sĩ & Cứu hộ Xe máy lưu động TP.HCM', desc: 'Hỗ trợ kích bình, xử lý xe tay ga vào nước nồi & chết máy ban đêm', phone: '0906116116', badge: 'Cứu hộ Xe máy' },
        { name: 'Trung tâm Chống ngập & Hạ tầng Kỹ thuật TP.HCM', desc: 'Tiếp nhận điểm ngập mới, hố sụt và sự cố cây xanh ngã đổ', phone: '02839102126', badge: 'Trực ban Đô thị' }
      ],
      danang: [
        { name: 'Cứu hộ Ô tô & Thủy kích Đà Nẵng 24/7 (116 Miền Trung)', desc: 'Xe sàn trượt chuyên dụng cứu hộ ngập lụt Hải Châu, Thanh Khê, Liên Chiểu', phone: '0905116116', badge: 'Có mặt sau 15p' },
        { name: 'Đội Cứu hộ Xe máy Lưu động Đà Nẵng (SOS Mưa bão)', desc: 'Hỗ trợ sửa xe chết máy do ngập nước tại chỗ', phone: '0935116116', badge: 'Cứu hộ Xe máy' },
        { name: 'Tổng đài Dịch vụ Công & Phòng chống Thiên tai Đà Nẵng (1022)', desc: 'Cập nhật rào chắn ngập lụt, hầm chui Điện Biên Phủ, Nguyễn Tri Phương', phone: '02361022', badge: 'Tổng đài 1022' }
      ]
    };
    return [...(byCity[city] || byCity.hanoi), ...common];
  }

  openSosRescueModal(targetLat = null, targetLng = null, targetName = null) {
    const modal = document.getElementById('modal-sos-rescue');
    if (!modal) return;

    // Lưu tọa độ tham chiếu để tính khoảng cách đến điểm trú mưa gần nhất
    if (targetLat && targetLng) {
      this._sosRefLocation = { lat: Number(targetLat), lng: Number(targetLng), name: targetName || 'Điểm ngập đang chọn' };
    } else if (this.userLocation && this.userLocation.lat) {
      this._sosRefLocation = { lat: this.userLocation.lat, lng: this.userLocation.lng, name: 'Vị trí GPS của bạn' };
    } else if (this.routeLocations?.origin?.lat) {
      this._sosRefLocation = { lat: Number(this.routeLocations.origin.lat), lng: Number(this.routeLocations.origin.lng), name: this.routeLocations.origin.title || 'Điểm xuất phát' };
    } else {
      const originInput = document.getElementById('gm-route-origin');
      const oLat = parseFloat(originInput?.dataset?.lat);
      const oLng = parseFloat(originInput?.dataset?.lng);
      if (!isNaN(oLat) && !isNaN(oLng)) {
        this._sosRefLocation = { lat: oLat, lng: oLng, name: originInput.value || 'Điểm xuất phát' };
      } else {
        const center = window.mapEngine?.map?.getCenter();
        this._sosRefLocation = {
          lat: center ? center.lat : 21.0285,
          lng: center ? center.lng : 105.8542,
          name: `Trung tâm ${this.getCityName(this.currentCity)}`
        };
      }
    }

    const subtitleEl = document.getElementById('sos-modal-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `Đang sắp xếp theo khoảng cách gần nhất từ: ${this._sosRefLocation.name}`;
    }

    modal.classList.add('open');
    this.switchSosTab('shelters');
  }

  switchSosTab(tabName = 'shelters') {
    this._currentSosTab = tabName;
    document.querySelectorAll('.sos-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sosTab === tabName);
    });
    this.renderSosContent(tabName);
  }

  _calcDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  renderSosContent(tabName = 'shelters') {
    const bodyEl = document.getElementById('sos-modal-body');
    if (!bodyEl) return;

    const ref = this._sosRefLocation || { lat: 21.0285, lng: 105.8542, name: 'Vị trí hiện tại' };

    if (tabName === 'shelters') {
      const shelters = this.getSafeSheltersByCity(this.currentCity).map((s, idx) => {
        const distKm = this._calcDistanceKm(ref.lat, ref.lng, s.lat, s.lng);
        return { ...s, originalIdx: idx, distKm };
      }).sort((a, b) => a.distKm - b.distKm);

      this._sortedSheltersCache = shelters;

      bodyEl.innerHTML = `
        <div class="sos-shelters-grid">
          ${shelters.map((s, idx) => `
            <div class="sos-shelter-card">
              <div class="sos-shelter-info">
                <h4>
                  ${idx === 0 ? '<span class="sos-shelter-badge" style="background:#dcfce7;color:#15803d;">GẦN NHẤT</span>' : ''}
                  ${s.name}
                  <span class="sos-shelter-badge">Cách ${s.distKm.toFixed(1)} km</span>
                </h4>
                <div class="sos-shelter-meta">
                  <span>Cốt nền: <strong>${s.elevation}</strong></span>
                  <span>•</span>
                  <span>${s.capacity}</span>
                  <span>•</span>
                  <span>Đ/c: ${s.address}</span>
                </div>
              </div>
              <div class="sos-shelter-actions">
                <button class="sos-btn-action" onclick="window.appState.viewShelterOnMap(${idx})">Xem bản đồ</button>
                <button class="sos-btn-action primary" onclick="window.appState.routeToShelter(${idx})">Chỉ đường trú ngay</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tabName === 'hotlines') {
      const hotlines = this.getRescueHotlinesByCity(this.currentCity);
      bodyEl.innerHTML = `
        <div class="sos-hotline-grid">
          ${hotlines.map(h => `
            <div class="sos-hotline-card">
              <div class="sos-hotline-info">
                <h4>${h.name} <span class="sos-shelter-badge">${h.badge}</span></h4>
                <p>${h.desc}</p>
              </div>
              <a href="tel:${h.phone}" class="sos-call-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Gọi ${h.phone}
              </a>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div class="sos-guide-grid">
          <div class="sos-guide-card">
            <h4>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              1. Ô tô & Xe máy Chết máy Giữa Vùng Ngập (Quy tắc Vàng)
            </h4>
            <ul>
              <li><strong>TUYỆT ĐỐI KHÔNG ĐỀ NỔ LẠI (KHÔNG KHỞI ĐỘNG LẠI):</strong> Nước đã tràn vào cổ hút gió hoặc ống xả, việc cố đề nổ sẽ làm cong tay biên, vỡ lốc máy (Thủy kích) khiến chi phí sửa chữa tăng gấp 10–30 lần.</li>
              <li><strong>Rút chìa khóa / Tắt nguồn điện ngay:</strong> Đẩy xe lên vỉa hè cao ráo hoặc bấm sang tab <em>"Điểm Gửi Xe & Trú Mưa Cao Ráo"</em> để tìm bãi đỗ trên cao gần nhất.</li>
              <li><strong>Với Xe tay ga:</strong> Nước rất dễ vào lốc nồi và hộp số (dầu láp chuyển màu cà phê sữa). Cần thay dầu máy & dầu láp ngay sau khi thoát ngập.</li>
            </ul>
          </div>
          <div class="sos-guide-card">
            <h4>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              2. Xe Điện (EV / Xe máy điện) Đi Qua Vùng Ngập
            </h4>
            <ul>
              <li><strong>Chuẩn kháng nước IP67 chỉ chịu được ngâm tĩnh tạm thời:</strong> Khi di chuyển nhanh, áp lực sóng nước và sóng từ xe tải ngược chiều có thể phá vỡ gioăng bảo vệ pin & mô-tơ.</li>
              <li><strong>Nếu bắt buộc phải đi qua vùng nước xấp xỉ 20–25cm:</strong> Tắt điều hòa (với ô tô), giữ đều chân ga ở tốc độ thấp (dưới 10–15 km/h), không giảm ga đột ngột.</li>
              <li><strong>Không cắm sạc ngay sau khi lội nước:</strong> Hãy để cổng sạc và gầm pin khô ráo hoàn toàn hoặc kiểm tra cách điện trước khi kết nối trụ sạc nhanh DC.</li>
            </ul>
          </div>
        </div>
      `;
    }
  }

  viewShelterOnMap(sortedIdx) {
    const shelter = this._sortedSheltersCache?.[sortedIdx];
    if (!shelter) return;
    document.getElementById('modal-sos-rescue')?.classList.remove('open');
    if (window.mapEngine && typeof window.mapEngine.focusShelterOnMap === 'function') {
      window.mapEngine.focusShelterOnMap(shelter);
    }
  }

  routeToShelter(sortedIdx) {
    const shelter = this._sortedSheltersCache?.[sortedIdx];
    if (!shelter) return;

    document.getElementById('modal-sos-rescue')?.classList.remove('open');
    this.toggleDirectionsPanel(true);

    const originInput = document.getElementById('gm-route-origin');
    const destInput = document.getElementById('gm-route-dest');
    if (originInput && destInput) {
      if (this._sosRefLocation) {
        originInput.value = this._sosRefLocation.name;
        originInput.dataset.lat = String(this._sosRefLocation.lat);
        originInput.dataset.lng = String(this._sosRefLocation.lng);
        this.routeLocations.origin = {
          title: this._sosRefLocation.name,
          fullAddress: this._sosRefLocation.name,
          lat: this._sosRefLocation.lat,
          lng: this._sosRefLocation.lng
        };
      }
      destInput.value = shelter.name;
      destInput.dataset.lat = String(shelter.lat);
      destInput.dataset.lng = String(shelter.lng);
      this.routeLocations.destination = {
        title: shelter.name,
        fullAddress: shelter.address || shelter.name,
        lat: shelter.lat,
        lng: shelter.lng
      };

      this.showToast(`Đang tìm đường an toàn nhất tới điểm trú mưa: ${shelter.name}`, 'success', 3500);
      this.calculateSmartRoute();
    }
  }

  copySosGpsLocation() {
    const ref = this._sosRefLocation || { lat: 21.0285, lng: 105.8542, name: 'Vị trí hiện tại' };
    const text = `[SOS CỨU HỘ THỦY KÍCH - MOVESAFE VN] Tôi đang cần hỗ trợ tại: ${ref.name} (Tọa độ GPS: ${ref.lat.toFixed(5)}, ${ref.lng.toFixed(5)}) - Bản đồ: https://www.google.com/maps?q=${ref.lat},${ref.lng}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Đã sao chép Tọa độ GPS Cứu hộ! Hãy dán gửi cho Đội cứu hộ hoặc người thân.', 'success', 4000);
      }).catch(() => {
        prompt('Sao chép tọa độ GPS cứu hộ:', text);
      });
    } else {
      prompt('Sao chép tọa độ GPS cứu hộ:', text);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.appState = new GoogleMapsApp();
  window.appState.init();
});
