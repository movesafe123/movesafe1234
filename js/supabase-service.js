/**
 * SupabaseService - Quản lý kết nối Cơ sở dữ liệu Đám mây Supabase
 * Tự động chuyển sang chế độ dự phòng (Offline Mock Fallback) nếu không có mạng hoặc chưa cấu hình KEY
 */

class SupabaseService {
  constructor() {
    this.SUPABASE_URL = 'https://cuvleafsohxtchhgbdbk.supabase.co';
    this.SUPABASE_KEY = 'sb_publishable_IL2L6IKBOYusIzdEGkK6PQ_QTD5OE4e';

    this.supabase = null;
    this.isOnline = true; // Cờ kiểm tra kết nối Supabase

    // Các nút giao trọng điểm theo từng thành phố phục vụ dự báo kẹt xe AI
    this.trafficHotspots = {
      hanoi: [
        { name: 'Nút giao Cầu Giấy', lat: 21.0365, lng: 105.7925, baseLevel: 4 },
        { name: 'Ngã Tư Sở', lat: 21.0028, lng: 105.8197, baseLevel: 4 },
        { name: 'Khuất Duy Tiến - Nguyễn Trãi', lat: 20.9984, lng: 105.8002, baseLevel: 3 }
      ],
      hcm: [
        { name: 'Vòng xoay Hàng Xanh', lat: 10.8012, lng: 106.7118, baseLevel: 4 },
        { name: 'Cầu Kênh Tẻ', lat: 10.7533, lng: 106.7027, baseLevel: 3 },
        { name: 'Ngã tư Cộng Hòa - Hoàng Hoa Thám', lat: 10.8034, lng: 106.6521, baseLevel: 4 }
      ],
      danang: [
        { name: 'Nút giao Cầu Rồng', lat: 16.0610, lng: 108.2230, baseLevel: 2 },
        { name: 'Ngã ba Huế - Điện Biên Phủ', lat: 16.0680, lng: 108.1880, baseLevel: 3 }
      ]
    };

    if (window.supabase && this.SUPABASE_URL && !this.SUPABASE_URL.includes('YOUR_SUPABASE_URL')) {
      try {
        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY, {
          auth: { persistSession: false }
        });
      } catch (e) {
        console.warn('[Supabase] Không thể khởi tạo client:', e.message);
        this.isOnline = false;
      }
    } else {
      this.isOnline = false;
    }
  }

  // Nhận diện thành phố dựa vào tọa độ (hỗ trợ tương thích ngược khi bảng Supabase chưa có cột city)
  inferCityFromCoords(lat, lng) {
    if (lat >= 19.5 && lat <= 22.0) return 'hanoi';
    if (lat >= 10.0 && lat <= 11.5) return 'hcm';
    if (lat >= 15.5 && lat <= 16.5) return 'danang';
    return 'hanoi';
  }

  // Helper thực hiện truy vấn an toàn kèm timeout (chống treo giao diện khi lỗi DNS/mạng)
  async safeQuery(queryPromise, timeoutMs = 3500) {
    if (!this.supabase) return null;
    if (!this.isOnline) {
      // Cooldown 60s trước khi thử lại
      if (Date.now() - (this._lastFailTime || 0) < 60000) {
        return null;
      }
      this.isOnline = true;
    }

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Supabase request timeout')), timeoutMs);
    });

    try {
      const res = await Promise.race([queryPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      this.isOnline = false;
      this._lastFailTime = Date.now();
      console.warn('[Supabase] Đám mây không phản hồi (tự động thử lại sau 60s):', err.message);
      return null;
    }
  }

  // 1. Lấy danh sách trạm sạc xe điện theo đúng thành phố
  async getEVStations(city = 'hanoi') {
    if (this.isOnline && this.supabase) {
      const res = await this.safeQuery(
        this.supabase.from('ev_stations').select('*').eq('is_active', true)
      );
      if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
        const filtered = res.data.filter(st => {
          const stCity = st.city || this.inferCityFromCoords(st.lat, st.lng);
          return !city || stCity === city;
        });
        if (filtered.length > 0) return filtered;
      }
    }

    // Dữ liệu dự phòng chuẩn cho các thành phố
    const mockStations = [
      // Hà Nội
      { id: 'ev-hn-1', name: 'Trạm sạc Vincom Metropolis', provider: 'VinFast', city: 'hanoi', lat: 21.0319, lng: 105.8115, capacity: 6 },
      { id: 'ev-hn-2', name: 'Trạm sạc Vincom Trần Duy Hưng', provider: 'VinFast', city: 'hanoi', lat: 21.0069, lng: 105.7951, capacity: 8 },
      { id: 'ev-hn-3', name: 'Trạm sạc Royal City', provider: 'VinFast', city: 'hanoi', lat: 21.0028, lng: 105.8155, capacity: 12 },
      { id: 'ev-hn-4', name: 'Tủ thay pin Selex Motors Bách Khoa', provider: 'Selex', city: 'hanoi', lat: 21.0041, lng: 105.8437, capacity: 4 },
      { id: 'ev-hn-5', name: 'Trạm sạc EVOne Hồ Tây', provider: 'EVOne', city: 'hanoi', lat: 21.0620, lng: 105.8230, capacity: 4 },
      { id: 'ev-hn-6', name: 'Trạm sạc Aeon Mall Hà Đông', provider: 'VinFast', city: 'hanoi', lat: 20.9818, lng: 105.7538, capacity: 10 },
      // TP. Hồ Chí Minh
      { id: 'ev-hcm-1', name: 'Trạm sạc Vincom Landmark 81', provider: 'VinFast', city: 'hcm', lat: 10.7950, lng: 106.7218, capacity: 10 },
      { id: 'ev-hcm-2', name: 'Trạm sạc Vincom Đồng Khởi', provider: 'VinFast', city: 'hcm', lat: 10.7780, lng: 106.7020, capacity: 8 },
      { id: 'ev-hcm-3', name: 'Tủ thay pin Selex Q.10', provider: 'Selex', city: 'hcm', lat: 10.7712, lng: 106.6685, capacity: 4 },
      // Đà Nẵng
      { id: 'ev-dn-1', name: 'Trạm sạc Vincom Ngô Quyền', provider: 'VinFast', city: 'danang', lat: 16.0714, lng: 108.2312, capacity: 8 },
      { id: 'ev-dn-2', name: 'Trạm sạc Cầu Rồng EVOne', provider: 'EVOne', city: 'danang', lat: 16.0610, lng: 108.2230, capacity: 4 }
    ];

    return mockStations.filter(s => s.city === city || !city);
  }

  // 2. Lấy dự báo kẹt xe từ AI (+1h, +2h, +3h) theo đúng tọa độ thành phố
  async getTrafficPrediction(offsetHours, city = 'hanoi') {
    if (offsetHours === 0) return null;

    // 1. Thử gọi API backend Node.js
    try {
      const res = await fetch(`/api/predictions?city=${city}&offsetHours=${offsetHours}`);
      if (res.ok) {
        const json = await res.json();
        if (json.trafficPredictions && json.trafficPredictions.length > 0) {
          return json.trafficPredictions;
        }
      }
    } catch (e) {}

    const citySpots = this.trafficHotspots[city] || this.trafficHotspots.hanoi;
    const expectedPrefix = city === 'hcm' ? 'HCM' : (city === 'danang' ? 'DANANG' : 'HANOI');

    if (this.isOnline && this.supabase) {
      const res = await this.safeQuery(
        this.supabase.from('traffic_predictions').select('*').eq('target_hour', offsetHours)
      );
      if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
        const matchedRow = res.data.find(r => String(r.segment_id || '').toUpperCase().includes(expectedPrefix)) || res.data[0];
        const basePredLevel = matchedRow.predicted_level || 3;
        const confPct = Math.round((matchedRow.confidence || 0.88) * 100);

        return citySpots.map((spot, idx) => {
          const level = Math.min(5, Math.max(1, idx === 0 ? basePredLevel : basePredLevel - (idx % 2)));
          return {
            lat: spot.lat,
            lng: spot.lng,
            level,
            description: `AI Dự báo kẹt xe mức ${level}/5 tại ${spot.name} sau +${offsetHours}h (Độ tin cậy: ${confPct}%)`
          };
        });
      }
    }

    // Dự báo tất định theo các nút giao trọng điểm của từng thành phố
    return citySpots.map(s => {
      const level = Math.min(5, Math.max(1, s.baseLevel + (offsetHours === 1 ? 0 : (offsetHours === 2 ? -1 : -2))));
      return {
        lat: s.lat,
        lng: s.lng,
        level,
        description: `AI Dự báo ùn ứ mức ${level}/5 tại ${s.name} sau +${offsetHours}h`
      };
    });
  }

  // 3. Lấy dự báo ngập lụt từ AI (+1h, +2h, +3h) hỗ trợ cả 3 thành phố
  async getFloodPredictions(offsetHours, city = 'hanoi') {
    if (offsetHours === 0) return [];

    // 1. Thử gọi API backend Node.js
    try {
      const res = await fetch(`/api/predictions?city=${city}&offsetHours=${offsetHours}`);
      if (res.ok) {
        const json = await res.json();
        if (json.floodPredictions) {
          return json.floodPredictions;
        }
      }
    } catch (e) {}

    if (this.isOnline && this.supabase) {
      const res = await this.safeQuery(
        this.supabase.from('flood_predictions').select('*').eq('target_hour', offsetHours)
      );
      if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
        const cityFiltered = res.data.filter(row => {
          const rowCity = row.city || this.inferCityFromCoords(row.lat, row.lng);
          return rowCity === city;
        });
        if (cityFiltered.length > 0) return cityFiltered;
      }
    }

    // Kiểm tra xem hiện tại có mưa hoặc chế độ mô phỏng đang bật không
    const isSimulating = Boolean(window.appState?.simulationMode);
    const hasRain = (window.appState?.currentWeather?.rain1h || 0) > 0 ||
      (window.appState?.liveData?.floodPoints && window.appState.liveData.floodPoints.length > 0);

    if (!isSimulating && !hasRain) {
      // Trời tạnh ráo hoàn toàn và không có dữ liệu ngập => không tạo điểm ngập giả định
      return [];
    }

    // Dự báo ngập tất định cho các rốn ngập kinh niên tại cả 3 đô thị khi có mưa/mô phỏng
    const depthMultiplier = offsetHours === 1 ? 1.0 : (offsetHours === 2 ? 0.8 : 0.6);
    const cityPresets = {
      hanoi: [
        { id: 'pred-hn-nk', location_name: 'Đường Nguyễn Khuyến', lat: 21.0268, lng: 105.8409, baseDepth: 35, confidence: 0.92 },
        { id: 'pred-hn-th', location_name: 'Ngã tư Thái Hà - Chùa Bộc', lat: 21.0075, lng: 105.8245, baseDepth: 25, confidence: 0.86 }
      ],
      hcm: [
        { id: 'pred-hcm-qh', location_name: 'Đường Quốc Hương (Thảo Điền)', lat: 10.8052, lng: 106.7351, baseDepth: 35, confidence: 0.90 },
        { id: 'pred-hcm-htp', location_name: 'Đường Huỳnh Tấn Phát (Quận 7)', lat: 10.7412, lng: 106.7325, baseDepth: 38, confidence: 0.88 }
      ],
      danang: [
        { id: 'pred-dn-hn', location_name: 'Nút giao Hàm Nghi - Nguyễn Văn Linh', lat: 16.0615, lng: 108.2140, baseDepth: 28, confidence: 0.85 },
        { id: 'pred-dn-ms', location_name: 'Đường Mẹ Suốt (Liên Chiểu)', lat: 16.0592, lng: 108.1583, baseDepth: 34, confidence: 0.89 }
      ]
    };

    const selected = cityPresets[city] || cityPresets.hanoi;
    return selected.map(item => ({
      id: item.id,
      city,
      location_name: item.location_name,
      lat: item.lat,
      lng: item.lng,
      target_hour: offsetHours,
      predicted_depth_cm: Math.round(item.baseDepth * depthMultiplier),
      confidence: item.confidence
    }));
  }

  // 4. Lấy dữ liệu lịch sử quan trắc 7 ngày qua (Tự động kết hợp Supabase & Local History API)
  async getHistoricalTrends(city = 'hanoi', days = 7) {
    // 1. Thử gọi API backend Node.js
    try {
      const res = await fetch(`/api/history?city=${city}&days=${days}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          return json;
        }
      }
    } catch (e) {}

    // 2. Thử truy vấn trực tiếp Supabase nếu có kết nối
    if (this.isOnline && this.supabase) {
      try {
        const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
        const segId = city === 'hcm' ? 'HCM_CITY_AVG' : (city === 'danang' ? 'DN_CITY_AVG' : 'HN_CITY_AVG');
        const res = await this.safeQuery(
          this.supabase.from('traffic_history')
            .select('*')
            .eq('segment_id', segId)
            .gte('recorded_at', cutoff)
            .order('recorded_at', { ascending: true })
        );
        if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
          return { status: 'success', source: 'supabase', timeSeries: res.data };
        }
      } catch (err) {}
    }

    return { status: 'fallback', city, retentionDays: days, timeSeries: [] };
  }
}

// Khởi tạo service
window.supabaseService = new SupabaseService();
