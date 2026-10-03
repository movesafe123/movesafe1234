class SupabaseService {
  constructor() {
    // 1. Thay thế 2 dòng này bằng thông tin lấy từ Dashboard Supabase của bạn
    this.SUPABASE_URL = 'https://cuvleafsohxtchhgdbdk.supabase.co';
    this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlYWZzb2h4dGNoaGdiZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Nzk4MDIsImV4cCI6MjEwNjU1NTgwMn0.r7qAMKdo3-oKhPXAVDYGILkuh32ckpELHMJAZ0tX9yk';
    
    // Khởi tạo Client thực sự của Supabase (Đã load qua CDN ở index.html)
    this.supabase = null;
    if (window.supabase) {
      this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
    }
  }

  // Lấy danh sách trạm sạc xe điện từ Cloud
  async getEVStations() {
    console.log("Đang lấy dữ liệu Trạm sạc từ Supabase Cloud...");
    
    // Nếu bạn ĐÃ điền URL và KEY ở trên, hãy xóa dấu comment (//) đoạn dưới đây:
    
    if (this.supabase && this.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
      const { data, error } = await this.supabase
        .from('ev_stations')
        .select('*')
        .eq('is_active', true);
        
      if (error) {
        console.error("Lỗi lấy dữ liệu trạm sạc:", error);
        return [];
      }
      return data;
    }
    

    // Giai đoạn hiện tại (Khi chưa điền KEY), trả về Mock Data:
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          { id: 1, name: 'Trạm sạc Vincom Metropolis', provider: 'VinFast', lat: 21.0319, lng: 105.8115, capacity: 4 },
          { id: 2, name: 'Trạm sạc Vincom Trần Duy Hưng', provider: 'VinFast', lat: 21.0069, lng: 105.7951, capacity: 6 },
          { id: 3, name: 'Trạm sạc Royal City', provider: 'VinFast', lat: 21.0028, lng: 105.8155, capacity: 10 },
          { id: 4, name: 'Tủ thay pin Selex Motors', provider: 'Selex', lat: 21.0041, lng: 105.8437, capacity: 2 },
          { id: 5, name: 'Trạm sạc EVOne Hồ Tây', provider: 'EVOne', lat: 21.0620, lng: 105.8230, capacity: 2 }
        ]);
      }, 500); // Giả lập độ trễ mạng
    });
  }

  // Lấy dự báo kẹt xe từ XGBoost Model (Đã lưu trong Database)
  async getTrafficPrediction(offsetHours) {
    if (offsetHours === 0) return null; // Dùng live data
    
    console.log(`Lấy dữ liệu dự báo từ AI (Cloud) cho +${offsetHours}h tới...`);
    
    // Đọc từ bảng traffic_predictions (nơi Server Python lưu kết quả)
    if (this.supabase && this.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
      const { data, error } = await this.supabase
        .from('traffic_predictions')
        .select('*')
        .eq('target_hour', offsetHours);
        
      if (!error && data && data.length > 0) {
        // AI chỉ trả về mức độ (level), ta gán tọa độ ngẫu nhiên hoặc theo segment_id
        // (Trong phiên bản thật, segment_id sẽ mapping với 1 mảng tọa độ)
        return data.map(pred => ({
          lat: 21.033 + (Math.random() - 0.5) * 0.05,
          lng: 105.800 + (Math.random() - 0.5) * 0.05,
          level: pred.predicted_level,
          description: `AI Dự báo kẹt xe mức ${pred.predicted_level}/5 sau ${offsetHours}h (Độ tin cậy: ${pred.confidence * 100}%)`
        }));
      }
    }

    // Nếu AI chưa chạy hoặc lỗi mạng, trả về Mock Data dự phòng:
    return new Promise(resolve => {
      setTimeout(() => {
        const mockPredictions = [
          { lat: 21.033, lng: 105.800, level: 4, description: `Dự báo kẹt xe mức 4 tại nút giao Cầu Giấy sau ${offsetHours}h` },
          { lat: 21.008, lng: 105.820, level: 3, description: `Dự báo ùn ứ mức 3 ngã tư Tây Sơn sau ${offsetHours}h` }
        ];
        resolve(mockPredictions);
      }, 300);
    });
  }

  // Lấy dự báo ngập lụt từ AI
  async getFloodPredictions(offsetHours) {
    if (offsetHours === 0) return []; // Không có offset thì không lấy dự báo
    
    console.log(`Lấy dữ liệu dự báo NGẬP LỤT từ AI cho +${offsetHours}h tới...`);
    
    if (this.supabase && this.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
      const { data, error } = await this.supabase
        .from('flood_predictions')
        .select('*')
        .eq('target_hour', offsetHours);
        
      if (!error && data && data.length > 0) {
        return data;
      }
    }
    return [];
  }
}

// Khởi tạo service
window.supabaseService = new SupabaseService();
