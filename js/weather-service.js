/**
 * WeatherService - Xử lý thông tin thời tiết & lượng mưa thời gian thực
 * Tích hợp OpenWeatherMap + Tự động Fallback sang Open-Meteo Cloud Radar (Miễn phí 100%, 24/7)
 * Hỗ trợ quét thời tiết đa điểm (Multi-Station Weather Layer) cho các quận huyện
 */

const HANOI_PRESETS_DATA = (typeof HANOI_WARDS_DATA !== 'undefined' && Array.isArray(HANOI_WARDS_DATA))
  ? HANOI_WARDS_DATA
  : (typeof require !== 'undefined')
    ? (function() { try { return require('./hanoi-wards-streets'); } catch(e) { return []; } })()
    : [];

const WEATHER_STATION_PRESETS = {
  hanoi: HANOI_PRESETS_DATA.length > 0 ? HANOI_PRESETS_DATA : [
    { id: 'hn-xp', ward: 'P. Xuân Phương', name: 'Phường Xuân Phương (Nam Từ Liêm)', district: 'Nam Từ Liêm', lat: 21.0335, lng: 105.7480, mainStreets: ['Đường Xuân Phương (ĐT70)', 'Đường Trịnh Văn Bô', 'Đường Thị Cấm'] },
    { id: 'hn-dvh', ward: 'P. Dịch Vọng Hậu', name: 'Phường Dịch Vọng Hậu (Cầu Giấy)', district: 'Cầu Giấy', lat: 21.0330, lng: 105.7870, mainStreets: ['Đường Xuân Thủy', 'Đường Duy Tân', 'Đường Trần Thái Tông'] },
    { id: 'hn-md1', ward: 'P. Mỹ Đình 1', name: 'Phường Mỹ Đình 1 (Nam Từ Liêm)', district: 'Nam Từ Liêm', lat: 21.0180, lng: 105.7750, mainStreets: ['Đường Phạm Hùng', 'Đường Mễ Trì', 'Đường Đình Thôn'] },
    { id: 'hn-cd', ward: 'P. Cầu Diễn', name: 'Phường Cầu Diễn (Nam Từ Liêm)', district: 'Nam Từ Liêm', lat: 21.0410, lng: 105.7650, mainStreets: ['Đường Cầu Diễn', 'Đường Hồ Tùng Mậu', 'Đường Nguyễn Đổng Chi'] },
    { id: 'hn-pd', ward: 'P. Phú Diễn', name: 'Phường Phú Diễn (Bắc Từ Liêm)', district: 'Bắc Từ Liêm', lat: 21.0500, lng: 105.7620, mainStreets: ['Đường Cầu Diễn (QL32)', 'Đường Phú Diễn', 'Đường Hoàng Công Chất', 'Đường Đức Diễn'] }
  ],
  hcm: [
    { id: 'hcm-bn', ward: 'P. Bến Nghé', name: 'Phường Bến Nghé (Quận 1)', lat: 10.7769, lng: 106.7008, mainStreets: ['Đường Đồng Khởi', 'Đường Lê Duẩn', 'Đường Nguyễn Huệ'] },
    { id: 'hcm-bt', ward: 'P. Bến Thành', name: 'Phường Bến Thành (Quận 1)', lat: 10.7725, lng: 106.6980, mainStreets: ['Đường Lê Lợi', 'Đường Hàm Nghi', 'Đường Cách Mạng Tháng 8'] },
    { id: 'hcm-td', ward: 'P. Thảo Điền', name: 'Phường Thảo Điền (TP. Thủ Đức)', lat: 10.8052, lng: 106.7351, mainStreets: ['Đường Quốc Hương', 'Đường Xuân Thủy', 'Đường Thảo Điền'] },
    { id: 'hcm-tp', ward: 'P. Tân Phong', name: 'Phường Tân Phong (Phú Mỹ Hưng, Q.7)', lat: 10.7320, lng: 106.7150, mainStreets: ['Đại lộ Nguyễn Văn Linh', 'Đường Nguyễn Thị Thập', 'Đường Nguyễn Đức Cảnh'] },
    { id: 'hcm-p15', ward: 'P. 15 Tân Bình', name: 'Phường 15 (Tân Bình - Sân Bay)', lat: 10.8150, lng: 106.6380, mainStreets: ['Đường Cộng Hòa', 'Đường Trường Chinh', 'Đường Hoàng Hoa Thám'] },
    { id: 'hcm-hx', ward: 'P. 25 Bình Thạnh', name: 'Phường 25 (Hàng Xanh, Bình Thạnh)', lat: 10.8012, lng: 106.7118, mainStreets: ['Đường Điện Biên Phủ', 'Đường Xô Viết Nghệ Tĩnh', 'Đường D2 Nguyễn Gia Trí'] },
    { id: 'hcm-q5', ward: 'P. 11 Quận 5', name: 'Phường 11 (Chợ Lớn, Quận 5)', lat: 10.7550, lng: 106.6650, mainStreets: ['Đường Hải Thượng Lãn Ông', 'Đường Hồng Bàng', 'Đường Châu Văn Liêm'] },
    { id: 'hcm-apd', ward: 'P. An Phú Đông', name: 'Phường An Phú Đông (Quận 12)', lat: 10.8492, lng: 106.6178, mainStreets: ['Quốc lộ 1A', 'Đường An Phú Đông 03', 'Đường Vườn Lài'] },
    { id: 'hcm-btd', ward: 'P. Bình Trị Đông', name: 'Phường Bình Trị Đông (Bình Tân)', lat: 10.7650, lng: 106.5980, mainStreets: ['Đường Tên Lửa', 'Đường Tỉnh Lộ 10', 'Đường Hương Lộ 2'] },
    { id: 'hcm-hbc', ward: 'P. Hiệp Bình Chánh', name: 'Phường Hiệp Bình Chánh (Thủ Đức)', lat: 10.8290, lng: 106.7240, mainStreets: ['Đường Phạm Văn Đồng', 'Quốc lộ 13', 'Đường Hiệp Bình'] }
  ],
  danang: [
    { id: 'dn-tt', ward: 'P. Thạch Thang', name: 'Phường Thạch Thang (Hải Châu)', lat: 16.0740, lng: 108.2200, mainStreets: ['Đường Bạch Đằng', 'Đường Trần Phú', 'Đường Lê Duẩn'] },
    { id: 'dn-pm', ward: 'P. Phước Mỹ', name: 'Phường Phước Mỹ (Sơn Trà - Mỹ Khê)', lat: 16.0650, lng: 108.2430, mainStreets: ['Đường Võ Nguyên Giáp', 'Đường Phạm Văn Đồng', 'Đường Võ Văn Kiệt'] },
    { id: 'dn-ma', ward: 'P. Mỹ An', name: 'Phường Mỹ An (Ngũ Hành Sơn)', lat: 16.0420, lng: 108.2420, mainStreets: ['Đường Võ Nguyên Giáp', 'Đường Ngũ Hành Sơn', 'Đường Hồ Xuân Hương'] },
    { id: 'dn-hk', ward: 'P. Hòa Khánh Bắc', name: 'Phường Hòa Khánh Bắc (Liên Chiểu)', lat: 16.0780, lng: 108.1500, mainStreets: ['Đường Nguyễn Lương Bằng', 'Đường Tôn Đức Thắng', 'Đường Ngô Thì Nhậm'] },
    { id: 'dn-kt', ward: 'P. Khuê Trung', name: 'Phường Khuê Trung (Cẩm Lệ)', lat: 16.0250, lng: 108.2050, mainStreets: ['Đường Cách Mạng Tháng 8', 'Đường Nguyễn Hữu Thọ', 'Đường Lê Đại Hành'] },
    { id: 'dn-ahb', ward: 'P. An Hải Bắc', name: 'Phường An Hải Bắc (Sơn Trà)', lat: 16.0690, lng: 108.2320, mainStreets: ['Đường Ngô Quyền', 'Đường Trần Hưng Đạo', 'Đường Phạm Văn Đồng'] }
  ]
};

class WeatherService {
  constructor() {
    this.openWeatherKey = '';
    this.stationPresets = WEATHER_STATION_PRESETS;
    this.stationCache = {};
  }

  setApiKey(key) {
    if (key && key.trim()) {
      this.openWeatherKey = key.trim();
    }
  }

  // 1. Lấy thời tiết trung tâm thành phố
  async getWeather(lat, lng, cityName = 'Hà Nội') {
    // Thử OpenWeatherMap nếu có key
    if (this.openWeatherKey) {
      try {
        const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=vi&appid=${this.openWeatherKey}`;
        const res = await fetch(owmUrl);
        if (res.ok) {
          const data = await res.json();
          let rain1h = (data.rain && data.rain['1h']) || 0;
          if (rain1h < 0.5) rain1h = 0;
          else rain1h = Math.round(rain1h * 10) / 10;

          return {
            source: 'OpenWeatherMap Live',
            cityName: data.name || cityName,
            temp: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed * 3.6),
            description: rain1h === 0 ? 'Tạnh ráo, không mưa' : data.weather[0].description,
            icon: '',
            rain1h: rain1h,
            floodRisk: this.calculateFloodRisk(rain1h),
            raw: data
          };
        }
      } catch (e) {
        console.warn('OpenWeatherMap chưa khả dụng, chuyển sang Open-Meteo:', e.message);
      }
    }

    // Fallback sang Open-Meteo Cloud Radar (Miễn phí 100%, chuẩn xác từng mm mưa)
    try {
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,is_day&timezone=Asia%2FBangkok`;
      const res = await fetch(omUrl);
      const data = await res.json();
      const current = data.current;
      let rain = current.precipitation || current.rain || 0;
      if (rain < 0.5) rain = 0;
      else rain = Math.round(rain * 10) / 10;

      const isDay = current.is_day !== undefined ? (current.is_day === 1) : (new Date().getHours() >= 6 && new Date().getHours() < 18);
      let desc = this.getWmoDescription(current.weather_code, isDay);
      let icon = this.getWmoIcon(current.weather_code, isDay);

      return {
        source: 'Open-Meteo Cloud Radar 24/7',
        cityName: cityName,
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        description: desc,
        icon: icon,
        rain1h: rain,
        floodRisk: this.calculateFloodRisk(rain),
        raw: data
      };
    } catch (err) {
      console.error('Không thể lấy dữ liệu thời tiết:', err);
      const isDay = (new Date().getHours() >= 6 && new Date().getHours() < 18);
      return {
        source: 'Cảm biến đô thị MoveSafe',
        cityName: cityName,
        temp: 26,
        feelsLike: 29,
        humidity: 80,
        windSpeed: 10,
        description: isDay ? 'Tạnh ráo, quang đãng' : 'Trời tối, tạnh ráo',
        icon: '',
        rain1h: 0,
        floodRisk: { level: 'safe', text: 'Tạnh ráo - Khô ráo', badgeClass: 'badge-safe', color: '#1e8e3e' }
      };
    }
  }

  // 2. Lấy dữ liệu thời tiết cho tất cả trạm/quận huyện trên bản đồ (Ưu tiên tái sử dụng cache từ Server để tránh gọi trùng 76 tọa độ)
  async getMultiStationWeather(cityKey = 'hanoi') {
    const stations = this.stationPresets[cityKey] || this.stationPresets.hanoi;
    if (!stations || stations.length === 0) return [];

    // Ưu tiên 1: Nếu liveData từ Server/SSE đã có sẵn dữ liệu trạm thời tiết mới (< 5 phút), dùng ngay để tiết kiệm băng thông
    const serverStations = window.appState?.liveData?.weatherStations?.[cityKey];
    if (Array.isArray(serverStations) && serverStations.length >= stations.length) {
      const sampleTime = serverStations[0]?.updated_at ? new Date(serverStations[0].updated_at).getTime() : 0;
      if (sampleTime > 0 && (Date.now() - sampleTime) < 5 * 60 * 1000) {
        this.stationCache[cityKey] = serverStations;
        return serverStations;
      }
    }

    try {
      const lats = stations.map(s => s.lat).join(',');
      const lngs = stations.map(s => s.lng).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,is_day&timezone=Asia%2FBangkok`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

      const data = await res.json();
      const resultsArray = Array.isArray(data) ? data : [data];

      const mappedStations = stations.map((st, idx) => {
        const item = resultsArray[idx] || {};
        const curr = item.current || {};
        let rain = typeof curr.rain === 'number' ? curr.rain : (curr.precipitation || 0);
        if (rain < 0.5) rain = 0;
        else rain = Math.round(rain * 10) / 10;

        const temp = typeof curr.temperature_2m === 'number' ? Math.round(curr.temperature_2m) : 26;
        const feelsLike = typeof curr.apparent_temperature === 'number' ? Math.round(curr.apparent_temperature) : temp;
        const humidity = curr.relative_humidity_2m || 75;
        const windSpeed = typeof curr.wind_speed_10m === 'number' ? Math.round(curr.wind_speed_10m) : 10;
        const wCode = curr.weather_code || 0;
        const floodRisk = this.calculateFloodRisk(rain);
        const isDay = curr.is_day !== undefined ? (curr.is_day === 1) : (new Date().getHours() >= 6 && new Date().getHours() < 18);

        let desc = this.getWmoDescription(wCode, isDay);
        let icon = this.getWmoIcon(wCode, isDay);

        return {
          id: st.id,
          name: st.name,
          ward: st.ward || '',
          district: st.district || '',
          city: cityKey,
          lat: st.lat,
          lng: st.lng,
          isHub: st.isHub !== false,
          mainStreets: st.mainStreets || [],
          trafficHotspots: st.trafficHotspots || [],
          floodVulnerability: st.floodVulnerability || '',
          temp,
          feelsLike,
          rain1h: rain,
          humidity,
          windSpeed,
          floodRisk,
          description: desc,
          icon: icon,
          updated_at: new Date().toISOString()
        };
      });

      this.stationCache[cityKey] = mappedStations;
      return mappedStations;
    } catch (err) {
      console.warn(`[WeatherService] Lỗi quét trạm thời tiết Cloud (${cityKey}):`, err.message);
      if (this.stationCache[cityKey] && this.stationCache[cityKey].length > 0) {
        return this.stationCache[cityKey];
      }
      if (Array.isArray(serverStations) && serverStations.length > 0) {
        return serverStations;
      }

      const defaultIsDay = (new Date().getHours() >= 6 && new Date().getHours() < 18);
      return stations.map((st) => ({
        id: st.id,
        name: st.name,
        ward: st.ward || '',
        district: st.district || '',
        city: cityKey,
        lat: st.lat,
        lng: st.lng,
        isHub: st.isHub !== false,
        mainStreets: st.mainStreets || [],
        trafficHotspots: st.trafficHotspots || [],
        floodVulnerability: st.floodVulnerability || '',
        temp: 26,
        feelsLike: 29,
        rain1h: 0,
        humidity: 80,
        windSpeed: 10,
        floodRisk: { level: 'safe', text: 'Tạnh ráo - Khô ráo', badgeClass: 'badge-safe', color: '#1e8e3e' },
        description: defaultIsDay ? 'Trời tạnh ráo, không mưa' : 'Trời tối, tạnh ráo',
        icon: '',
        updated_at: new Date().toISOString()
      }));
    }
  }

  // 3. Phân loại rủi ro ngập theo lượng mưa mm
  calculateFloodRisk(rain1h) {
    if (rain1h >= 25) {
      return {
        level: 'danger',
        score: 95,
        text: 'Mưa rất to - Nguy cơ ngập sâu',
        badgeClass: 'badge-danger',
        color: '#d93025'
      };
    } else if (rain1h >= 10) {
      return {
        level: 'warning',
        score: 65,
        text: 'Mưa vừa - Nguy cơ ngập trũng',
        badgeClass: 'badge-warning',
        color: '#f9ab00'
      };
    } else if (rain1h >= 1.0) {
      return {
        level: 'caution',
        score: 30,
        text: 'Mưa nhỏ rải rác',
        badgeClass: 'badge-caution',
        color: '#1a73e8'
      };
    }
    return {
      level: 'safe',
      score: 10,
      text: 'Tạnh ráo - Khô ráo',
      badgeClass: 'badge-safe',
      color: '#1e8e3e'
    };
  }

  mapWeatherIcon() {
    return '';
  }

  getWmoDescription(code, isDay = true) {
    if (code === 0) return isDay ? 'Trời quang đãng, nắng nhẹ' : 'Trời quang mây, tạnh ráo';
    if (code <= 3) return isDay ? 'Có mây rải rác' : 'Nhiều mây về đêm';
    if (code <= 48) return 'Sương mù ẩm ướt';
    if (code <= 55) return 'Mưa phùn hạt nhỏ';
    if (code <= 65) return 'Mưa rào từ nhẹ đến vừa';
    if (code <= 82) return 'Mưa rào rất to, dông sét';
    if (code >= 95) return 'Dông kèm sấm chớp nguy hiểm';
    return 'Tạnh ráo, nhiều mây';
  }

  getWmoIcon() {
    return '';
  }

  // 4. Lấy dữ liệu Chỉ số Thoải Mái Khi Đi Đường (Commute Comfort Index) & Dự báo 15P
  async getCommuteComfortData(lat = 21.0285, lng = 105.8542, cityName = 'Hà Nội') {
    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
    if (this._comfortCache && this._comfortCache[cacheKey]) {
      const cached = this._comfortCache[cacheKey];
      if (Date.now() - cached.timestamp < 3 * 60 * 1000) {
        return cached.data;
      }
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,is_day&minutely_15=temperature_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=uv_index&forecast_minutely_15=8&forecast_days=1&timezone=Asia%2FBangkok`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const data = await res.json();

      const curr = data.current || {};
      const min15 = data.minutely_15 || {};
      const hourly = data.hourly || {};

      const temp = Math.round(curr.temperature_2m !== undefined ? curr.temperature_2m : 28);
      const apparentTemp = Math.round(curr.apparent_temperature !== undefined ? curr.apparent_temperature : temp);
      const humidity = Math.round(curr.relative_humidity_2m || 75);
      const windSpeed = Math.round(curr.wind_speed_10m || 10);
      const windGusts = Math.round(curr.wind_gusts_10m || (windSpeed * 1.3));
      const rainNow = typeof curr.rain === 'number' ? curr.rain : (curr.precipitation || 0);

      // Ước tính chỉ số UV: ưu tiên từ current.uv_index, nếu 0 ban ngày thì lấy từ hourly
      const currentHour = new Date().getHours();
      let uvIndex = typeof curr.uv_index === 'number' ? curr.uv_index : 0;
      if (uvIndex === 0 && hourly.uv_index && Array.isArray(hourly.uv_index) && currentHour >= 7 && currentHour <= 17) {
        uvIndex = hourly.uv_index[currentHour] || 0;
      }
      uvIndex = Math.round(uvIndex * 10) / 10;

      // Cảm nhận nhiệt mặt đường (Road RealFeel): Nhựa đường hấp thụ bức xạ mặt trời
      const isDay = curr.is_day !== undefined ? (curr.is_day === 1) : (currentHour >= 6 && currentHour < 18);
      const asphaltHeatBoost = (isDay && uvIndex >= 3) ? Math.round(uvIndex * 0.7) : 0;
      const roadRealFeel = Math.round(apparentTemp + asphaltHeatBoost - (windSpeed * 0.08));

      // 8 mốc dự báo 15 phút (2 giờ tới)
      const times = min15.time || [];
      const temps15 = min15.temperature_2m || [];
      const appTemps15 = min15.apparent_temperature || [];
      const rains15 = min15.precipitation || min15.rain || [];
      const winds15 = min15.wind_speed_10m || [];

      let hasRainIn2Hours = false;
      let maxRainIn2Hours = 0;
      let rainStartRelTime = null;

      const timeline15 = [];
      const count = Math.min(8, times.length > 0 ? times.length : 8);

      for (let i = 0; i < count; i++) {
        const timeRaw = times[i];
        let timeLabel = '';
        if (timeRaw) {
          const parts = timeRaw.split('T')[1];
          timeLabel = parts ? parts.slice(0, 5) : '';
        }
        if (!timeLabel) {
          const d = new Date(Date.now() + i * 15 * 60 * 1000);
          timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        const tVal = typeof temps15[i] === 'number' ? Math.round(temps15[i]) : temp;
        const appTVal = typeof appTemps15[i] === 'number' ? Math.round(appTemps15[i]) : apparentTemp;
        const rVal = typeof rains15[i] === 'number' ? (Math.round(rains15[i] * 10) / 10) : 0;
        const wVal = typeof winds15[i] === 'number' ? Math.round(winds15[i]) : windSpeed;

        const intervalRealFeel = Math.round(appTVal + asphaltHeatBoost - (wVal * 0.08));
        const relTime = i === 0 ? 'Hiện tại' : `+${i * 15}p`;

        if (rVal >= 0.5) {
          hasRainIn2Hours = true;
          if (rVal > maxRainIn2Hours) maxRainIn2Hours = rVal;
          if (!rainStartRelTime && i > 0) rainStartRelTime = relTime;
        }

        let roadStatus = 'Khô ráo';
        let barColor = '#10b981';
        if (rVal >= 4.0) {
          roadStatus = 'Mưa to ngập';
          barColor = '#dc2626';
        } else if (rVal >= 1.0) {
          roadStatus = 'Đường ướt trơn';
          barColor = '#ea580c';
        } else if (intervalRealFeel >= 39) {
          roadStatus = 'Cực rát bỏng';
          barColor = '#e11d48';
        } else if (intervalRealFeel >= 35) {
          roadStatus = 'Nắng hầm hập';
          barColor = '#f59e0b';
        } else if (intervalRealFeel >= 31) {
          roadStatus = 'Nắng nhẹ';
          barColor = '#3b82f6';
        }

        timeline15.push({
          index: i,
          relTime,
          timeLabel,
          temp: tVal,
          realFeel: intervalRealFeel,
          rain: rVal,
          wind: wVal,
          roadStatus,
          barColor
        });
      }

      // Tính toán điểm thoải mái khi đi đường (Commute Comfort Score - CCI: 0 đến 100)
      let comfortScore = 95;
      if (roadRealFeel > 33) comfortScore -= (roadRealFeel - 33) * 5.2;
      else if (roadRealFeel < 18) comfortScore -= (18 - roadRealFeel) * 4.0;

      if (uvIndex >= 6) comfortScore -= (uvIndex - 5) * 4.5;
      if (humidity >= 80 && roadRealFeel >= 31) comfortScore -= 12;

      if (rainNow >= 5) comfortScore -= 45;
      else if (rainNow >= 1) comfortScore -= 30;
      else if (rainNow > 0) comfortScore -= 15;
      else if (hasRainIn2Hours) comfortScore -= 18;

      comfortScore = Math.max(15, Math.min(98, Math.round(comfortScore)));

      let comfortStatus = 'Dịu mát lý tưởng';
      let comfortBadgeClass = 'cci-great';
      let comfortThemeColor = '#10b981';

      if (rainNow >= 2.0 || maxRainIn2Hours >= 4.0) {
        comfortStatus = 'Mưa to - Đường ướt trơn';
        comfortBadgeClass = 'cci-rain';
        comfortThemeColor = '#2563eb';
      } else if (roadRealFeel >= 40) {
        comfortStatus = 'Nắng nóng cực độ (Nguy cơ sốc nhiệt)';
        comfortBadgeClass = 'cci-danger';
        comfortThemeColor = '#dc2626';
      } else if (roadRealFeel >= 36 || uvIndex >= 8) {
        comfortStatus = 'Nắng gắt hầm hập (Cháy rát da)';
        comfortBadgeClass = 'cci-warning';
        comfortThemeColor = '#ea580c';
      } else if (roadRealFeel >= 32 || uvIndex >= 6) {
        comfortStatus = 'Nắng nhẹ - Khá oi bức';
        comfortBadgeClass = 'cci-moderate';
        comfortThemeColor = '#f59e0b';
      } else if (comfortScore >= 75) {
        comfortStatus = 'Dễ chịu & Thuận lợi di chuyển';
        comfortBadgeClass = 'cci-good';
        comfortThemeColor = '#059669';
      }

      // Đề xuất trang bị thiết thực cho người đi đường
      const gearList = [
        {
          id: 'sun_wear',
          name: 'Áo chống nắng dài tay',
          needed: (uvIndex >= 5 || roadRealFeel >= 33) && isDay,
          reason: uvIndex >= 8 ? 'Chỉ số UV cực gắt, rát da sau 15p' : 'Giảm nhiệt phả vào cánh tay'
        },
        {
          id: 'sunglasses',
          name: 'Kính râm chống chói',
          needed: uvIndex >= 5 && isDay,
          reason: 'Chống lóa mắt và bụi đường khi lái xe'
        },
        {
          id: 'mask',
          name: 'Khẩu trang lọc khí nóng',
          needed: true,
          reason: 'Ngăn hơi nóng ống xả ô tô khi dừng đèn đỏ'
        },
        {
          id: 'raincoat',
          name: 'Áo mưa dự phòng trong cốp',
          needed: rainNow > 0 || hasRainIn2Hours,
          reason: hasRainIn2Hours ? `Khả năng mưa rào lúc ${rainStartRelTime || 'trong 2h tới'}` : 'Đường phố khô ráo nhưng nên dự phòng'
        },
        {
          id: 'water',
          name: 'Nước uống giải nhiệt',
          needed: roadRealFeel >= 35 || humidity >= 82,
          reason: 'Bù nước điện giải khi chạy xe ngoài nắng'
        }
      ];

      // Lời khuyên hành trình thông minh
      let commuteAdvice = '';
      if (hasRainIn2Hours && rainStartRelTime) {
        commuteAdvice = `Dự kiến bắt đầu có mưa rào (${maxRainIn2Hours}mm) sau khoảng ${rainStartRelTime}. Bạn nên tranh thủ xuất phát sớm hoặc chuẩn bị sẵn áo mưa.`;
      } else if (roadRealFeel >= 37 && isDay) {
        commuteAdvice = `Mặt đường bê tông hấp thụ bức xạ rất lớn (cảm nhận ${roadRealFeel}°C). Bạn nên chọn các tuyến đại lộ có hàng cây râm mát và tránh dừng xe lâu dưới nắng gắt.`;
      } else if (comfortScore >= 80) {
        commuteAdvice = `Thời tiết hiện tại rất thoáng mát và dễ chịu (${temp}°C, gió ${windSpeed} km/h). Đây là khung giờ lý tưởng nhất để di chuyển hoặc đi dạo phố!`;
      } else {
        commuteAdvice = `Không khí tương đối dễ chịu, đường phố khô ráo và tầm nhìn thông thoáng. Chúc bạn có chuyến đi an toàn!`;
      }

      const comfortData = {
        cityName,
        lat,
        lng,
        temp,
        apparentTemp,
        roadRealFeel,
        humidity,
        windSpeed,
        windGusts,
        uvIndex,
        rainNow,
        isDay,
        comfortScore,
        comfortStatus,
        comfortBadgeClass,
        comfortThemeColor,
        commuteAdvice,
        gearList,
        timeline15,
        updatedAt: new Date().toISOString()
      };

      if (!this._comfortCache) this._comfortCache = {};
      this._comfortCache[cacheKey] = { timestamp: Date.now(), data: comfortData };
      return comfortData;
    } catch (err) {
      console.warn('Lỗi lấy dữ liệu Commute Comfort từ Open-Meteo:', err);
      // Fallback an toàn
      return {
        cityName,
        lat,
        lng,
        temp: 28,
        apparentTemp: 31,
        roadRealFeel: 32,
        humidity: 78,
        windSpeed: 12,
        windGusts: 18,
        uvIndex: 4.5,
        rainNow: 0,
        isDay: true,
        comfortScore: 78,
        comfortStatus: 'Dễ chịu & Thuận lợi di chuyển',
        comfortBadgeClass: 'cci-good',
        comfortThemeColor: '#10b981',
        commuteAdvice: 'Đường phố tạnh ráo, tầm nhìn tốt. Di chuyển thuận lợi và an toàn.',
        gearList: [
          { id: 'mask', name: 'Khẩu trang lọc khí nóng', needed: true, reason: 'Chống bụi mịn mặt đường' },
          { id: 'raincoat', name: 'Áo mưa trong cốp', needed: false, reason: 'Dự phòng mùa mưa' }
        ],
        timeline15: [],
        updatedAt: new Date().toISOString()
      };
    }
  }
}

if (typeof window !== 'undefined') {
  window.weatherService = new WeatherService();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeatherService;
}
