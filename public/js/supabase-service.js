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

  // Helper thực hiện truy vấn an toàn kèm timeout (chống treo giao diện khi lỗi DNS/mạng)
  async safeQuery(queryPromise, timeoutMs = 3500) {
    if (!this.supabase || !this.isOnline) return null;

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
      // Ghi nhớ trạng thái offline tạm thời để không spam request hỏng
      this.isOnline = false;
      console.warn('[Supabase] Đám mây không phản hồi, tự động dùng dữ liệu dự phòng cục bộ:', err.message);
      return null;
    }
  }

  // 1. Lấy danh sách trạm sạc xe điện
  async getEVStations(city = 'hanoi') {
    if (this.isOnline && this.supabase) {
      const res = await this.safeQuery(
        this.supabase.from('ev_stations').select('*').eq('is_active', true)
      );
      if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
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

  // 2. Lấy dự báo kẹt xe từ AI (+1h, +2h, +3h)
  async getTrafficPrediction(offsetHours, city = 'hanoi') {
    if (offsetHours === 0) return null;

    if (this.isOnline && this.supabase) {
      const res = await this.safeQuery(
        this.supabase.from('traffic_predictions').select('*').eq('target_hour', offsetHours)
      );
      if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((pred, i) => ({
          lat: 21.033 + (i * 0.01),
          lng: 105.800 + (i * 0.01),
          level: pred.predicted_level || 3,
          description: `AI Dự báo kẹt xe mức ${pred.predicted_level}/5 sau ${offsetHours}h (Độ tin cậy: ${Math.round((pred.confidence || 0.85) * 100)}%)`
        }));
      }
    }

    // Dự báo tất định (không dùng random) theo các nút giao trọng điểm
    const hotspots = {
      hanoi: [
        { name: 'Nút giao Cầu Giấy', lat: 21.0365, lng: 105.7925, baseLevel: 4 },
        { name: 'Ngã Tư Sở', lat: 21.0028, lng: 105.8197, baseLevel: 4 },
        { name: 'Khuất Duy Tiến - Nguyễn Trãi', lat: 20.9984, lng: 105.8002, baseLevel: 3 }
      ],
      hcm: [
        { name: 'Vòng xoay Hàng Xanh', lat: 10.8012, lng: 106.7118, baseLevel: 4 },
        { name: 'Cầu Kênh Tẻ', lat: 10.7533, lng: 106.7027, baseLevel: 3 }
      ],
      danang: [
        { name: 'Nút giao Cầu Rồng', lat: 16.0610, lng: 108.2230, baseLevel: 2 }
      ]
    };

    const citySpots = hotspots[city] || hotspots.hanoi;
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

  // 3. Lấy dự báo ngập lụt từ AI (+1h, +2h, +3h)
  async getFloodPredictions(offsetHours, city = 'hanoi') {
    if (offsetHours === 0) return [];

    if (this.isOnline && this.supabase) {
      const res = await this.safeQuery(
        this.supabase.from('flood_predictions').select('*').eq('target_hour', offsetHours)
      );
      if (res && !res.error && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    }

    // Dự báo ngập tất định cho các rốn ngập kinh niên
    if (city === 'hanoi') {
      const depthMultiplier = offsetHours === 1 ? 1.0 : (offsetHours === 2 ? 0.75 : 0.5);
      return [
        {
          id: 'pred-nk',
          location_name: 'Đường Nguyễn Khuyến',
          lat: 21.0268,
          lng: 105.8409,
          target_hour: offsetHours,
          predicted_depth_cm: Math.round(35 * depthMultiplier),
          confidence: 0.92
        },
        {
          id: 'pred-th',
          location_name: 'Ngã tư Thái Hà - Chùa Bộc',
          lat: 21.0075,
          lng: 105.8245,
          target_hour: offsetHours,
          predicted_depth_cm: Math.round(25 * depthMultiplier),
          confidence: 0.86
        }
      ];
    }

    return [];
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
        const res = await this.safeQuery(
          this.supabase.from('traffic_history')
            .select('*')
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
