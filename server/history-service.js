const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

// Đảm bảo thư mục data/history tồn tại
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

class HistoryService {
  constructor() {
    this.retentionDays = 7; // Cửa sổ trượt 7 ngày (Rolling 7 days)
    this.historySummaryFile = path.join(HISTORY_DIR, 'history_summary.json');
    this.lastRecordTime = 0;
    this.recordIntervalMs = 15 * 60 * 1000; // Lưu 1 snapshot mỗi 15 phút
    
    // Khởi tạo hoặc nạp sẵn dữ liệu 7 ngày qua nếu chưa có
    this.ensureHistoricalData();
  }

  // Đảm bảo luôn có sẵn dữ liệu 7 ngày qua để tra cứu và vẽ biểu đồ
  ensureHistoricalData() {
    if (!fs.existsSync(this.historySummaryFile)) {
      this.seedSevenDaysHistory();
    }
  }

  // Tạo sẵn dữ liệu lịch sử quan trắc 7 ngày gần nhất (từ 7 ngày trước đến hôm nay)
  seedSevenDaysHistory() {
    console.log('[HistoryService] Đang khởi tạo bộ dữ liệu lịch sử quan trắc 7 ngày qua...');
    const now = new Date();
    const records = [];

    // Tạo dữ liệu cho 7 ngày qua (mỗi ngày 24 mốc giờ)
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const targetDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayOfWeek = targetDate.getDay(); // 0 = CN, 6 = T7

      // Ngày 3 ngày trước (giả định có trận mưa dông ngập lớn tại Hà Nội & HCM)
      const isHeavyRainDay = (dayOffset === 2 || dayOffset === 4);

      for (let hour = 0; hour < 24; hour++) {
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        const timestamp = new Date(`${dateStr}T${timeStr}:00+07:00`).toISOString();

        // Mô phỏng lưu lượng theo giờ cao điểm
        const isMorningPeak = (hour >= 7 && hour <= 8);
        const isEveningPeak = (hour >= 17 && hour <= 19);
        const isPeak = isMorningPeak || isEveningPeak;

        // Vận tốc trung bình đô thị (km/h)
        let avgSpeedHanoi = isPeak ? (isHeavyRainDay ? 12 : 16) : (hour >= 23 || hour <= 5 ? 45 : 32);
        let avgSpeedHcm = isPeak ? (isHeavyRainDay ? 11 : 15) : (hour >= 23 || hour <= 5 ? 42 : 30);
        let avgSpeedDanang = isPeak ? 24 : 38;

        // Mưa & Ngập
        let maxRainHanoi = 0;
        let floodDepthCatLinh = 0;
        let floodDepthNguyenKhuyen = 0;

        if (isHeavyRainDay && hour >= 15 && hour <= 19) {
          maxRainHanoi = hour === 17 ? 42 : 25; // 42mm/h lúc cao điểm
          floodDepthCatLinh = hour === 17 ? 35 : (hour === 18 ? 28 : 15);
          floodDepthNguyenKhuyen = hour === 17 ? 30 : 20;
        }

        records.push({
          timestamp,
          date: dateStr,
          hour,
          hanoi: {
            avgSpeedKmh: avgSpeedHanoi,
            congestionIndex: isPeak ? (isHeavyRainDay ? 4.6 : 3.8) : 1.4,
            maxRainMm: maxRainHanoi,
            activeFloodSpots: floodDepthCatLinh > 0 ? [
              { name: 'Nút giao Cát Linh - Giảng Võ', depth_cm: floodDepthCatLinh },
              { name: 'Đường Nguyễn Khuyến', depth_cm: floodDepthNguyenKhuyen }
            ] : []
          },
          hcm: {
            avgSpeedKmh: avgSpeedHcm,
            congestionIndex: isPeak ? 4.0 : 1.5,
            maxRainMm: (isHeavyRainDay && hour >= 16 && hour <= 18) ? 35 : 0,
            activeFloodSpots: (isHeavyRainDay && hour >= 16 && hour <= 18) ? [
              { name: 'Đường Quốc Hương (Thảo Điền)', depth_cm: 32 }
            ] : []
          },
          danang: {
            avgSpeedKmh: avgSpeedDanang,
            congestionIndex: isPeak ? 2.5 : 1.1,
            maxRainMm: 0,
            activeFloodSpots: []
          }
        });
      }
    }

    const payload = {
      description: 'Lịch sử quan trắc lưu thông & ngập lụt đô thị 7 ngày gần nhất',
      retentionDays: 7,
      totalSnapshots: records.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshots: records
    };

    fs.writeFileSync(this.historySummaryFile, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[HistoryService] ✓ Đã tạo thành công ${records.length} mốc lịch sử 7 ngày qua.`);
  }

  // Tự động ghi 1 snapshot mới mỗi 15 phút (Rolling Window)
  recordSnapshot(liveData) {
    const now = Date.now();
    if (now - this.lastRecordTime < this.recordIntervalMs) {
      return; // Chưa đến chu kỳ 15 phút
    }
    this.lastRecordTime = now;

    try {
      let payload = { snapshots: [] };
      if (fs.existsSync(this.historySummaryFile)) {
        payload = JSON.parse(fs.readFileSync(this.historySummaryFile, 'utf-8'));
      }

      const isoNow = new Date().toISOString();
      const dateStr = isoNow.split('T')[0];
      const hour = new Date().getHours();

      // Trích xuất thống kê từ liveData hiện tại
      const floodPoints = liveData.floodPoints || [];
      const trafficIncidents = liveData.trafficIncidents || [];
      const weatherStations = liveData.weatherStations || {};

      const hanoiFloods = floodPoints.filter(f => f.city === 'hanoi' && f.depth_cm > 0);
      const hcmFloods = floodPoints.filter(f => f.city === 'hcm' && f.depth_cm > 0);
      const danangFloods = floodPoints.filter(f => f.city === 'danang' && f.depth_cm > 0);

      const newSnapshot = {
        timestamp: isoNow,
        date: dateStr,
        hour,
        hanoi: {
          avgSpeedKmh: this.calcAvgSpeed(trafficIncidents.filter(t => t.city === 'hanoi')),
          congestionIndex: this.calcCongestionIndex(trafficIncidents.filter(t => t.city === 'hanoi')),
          maxRainMm: this.calcMaxRain(weatherStations.hanoi || []),
          activeFloodSpots: hanoiFloods.map(f => ({ name: f.name, depth_cm: f.depth_cm }))
        },
        hcm: {
          avgSpeedKmh: this.calcAvgSpeed(trafficIncidents.filter(t => t.city === 'hcm')),
          congestionIndex: this.calcCongestionIndex(trafficIncidents.filter(t => t.city === 'hcm')),
          maxRainMm: this.calcMaxRain(weatherStations.hcm || []),
          activeFloodSpots: hcmFloods.map(f => ({ name: f.name, depth_cm: f.depth_cm }))
        },
        danang: {
          avgSpeedKmh: this.calcAvgSpeed(trafficIncidents.filter(t => t.city === 'danang')),
          congestionIndex: this.calcCongestionIndex(trafficIncidents.filter(t => t.city === 'danang')),
          maxRainMm: this.calcMaxRain(weatherStations.danang || []),
          activeFloodSpots: danangFloods.map(f => ({ name: f.name, depth_cm: f.depth_cm }))
        }
      };

      payload.snapshots.push(newSnapshot);

      // ÁP DỤNG CƠ CHẾ CỬA SỔ TRƯỢT 7 NGÀY (Xóa toàn bộ bản ghi cũ hơn 7 ngày)
      const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
      payload.snapshots = payload.snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoffTime);

      payload.totalSnapshots = payload.snapshots.length;
      payload.updatedAt = isoNow;

      fs.writeFileSync(this.historySummaryFile, JSON.stringify(payload, null, 2), 'utf-8');
      console.log(`[HistoryService] 💾 Đã lưu snapshot lịch sử lúc ${new Date().toLocaleTimeString()} (Tổng số mốc: ${payload.snapshots.length})`);

      // Đẩy nhẹ lên Supabase Cloud (chế độ nền, không chặn tiến trình)
      this.pushSnapshotToSupabase(newSnapshot);
    } catch (e) {
      console.warn('[HistoryService] Lỗi khi ghi snapshot lịch sử:', e.message);
    }
  }

  // Đẩy snapshot lên Supabase (Fire-and-forget)
  async pushSnapshotToSupabase(newSnapshot) {
    const url = config.API_KEYS.SUPABASE_URL;
    const key = config.API_KEYS.SUPABASE_KEY;
    if (!url || !key) return;

    try {
      const trafficRows = [
        {
          segment_id: 'HN_CITY_AVG',
          recorded_at: newSnapshot.timestamp,
          speed_kmh: newSnapshot.hanoi.avgSpeedKmh,
          congestion_level: Math.round(newSnapshot.hanoi.congestionIndex),
          weather_condition: newSnapshot.hanoi.maxRainMm > 20 ? 'heavy_rain' : (newSnapshot.hanoi.maxRainMm > 0 ? 'light_rain' : 'clear')
        },
        {
          segment_id: 'HCM_CITY_AVG',
          recorded_at: newSnapshot.timestamp,
          speed_kmh: newSnapshot.hcm.avgSpeedKmh,
          congestion_level: Math.round(newSnapshot.hcm.congestionIndex),
          weather_condition: newSnapshot.hcm.maxRainMm > 20 ? 'heavy_rain' : (newSnapshot.hcm.maxRainMm > 0 ? 'light_rain' : 'clear')
        },
        {
          segment_id: 'DN_CITY_AVG',
          recorded_at: newSnapshot.timestamp,
          speed_kmh: newSnapshot.danang.avgSpeedKmh,
          congestion_level: Math.round(newSnapshot.danang.congestionIndex),
          weather_condition: 'clear'
        }
      ];

      fetch(`${url}/rest/v1/traffic_history`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(trafficRows)
      }).catch(() => {});
    } catch (err) {}
  }

  calcAvgSpeed(incidents) {
    const withSpeed = incidents.filter(i => i.speedKmh && i.speedKmh > 0);
    if (withSpeed.length === 0) return 35; // Mặc định đô thị bình thường
    const sum = withSpeed.reduce((acc, cur) => acc + cur.speedKmh, 0);
    return Math.round(sum / withSpeed.length);
  }

  calcCongestionIndex(incidents) {
    const jams = incidents.filter(i => i.isJam).length;
    return Math.min(5, Math.max(1, +(1 + (jams * 0.4)).toFixed(1)));
  }

  calcMaxRain(stations) {
    if (!stations || stations.length === 0) return 0;
    return stations.reduce((max, s) => Math.max(max, s.rain1h || 0), 0);
  }

  // Lấy dữ liệu lịch sử theo thành phố và số ngày
  getHistory(city = 'hanoi', days = 7) {
    try {
      if (!fs.existsSync(this.historySummaryFile)) {
        this.seedSevenDaysHistory();
      }
      const data = JSON.parse(fs.readFileSync(this.historySummaryFile, 'utf-8'));
      const snapshots = data.snapshots || [];

      // Lọc theo số ngày yêu cầu
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const filtered = snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);

      // Trích xuất chuỗi thời gian cho thành phố yêu cầu
      const timeSeries = filtered.map(s => ({
        timestamp: s.timestamp,
        date: s.date,
        hour: s.hour,
        ...(s[city] || s.hanoi)
      }));

      // Tìm các trận ngập đỉnh điểm trong 7 ngày qua
      const peakFloods = [];
      timeSeries.forEach(t => {
        if (t.activeFloodSpots && t.activeFloodSpots.length > 0) {
          t.activeFloodSpots.forEach(f => {
            if (!peakFloods.some(p => p.name === f.name && Math.abs(p.depth_cm - f.depth_cm) <= 5)) {
              peakFloods.push({
                name: f.name,
                depth_cm: f.depth_cm,
                date: t.date,
                hour: t.hour
              });
            }
          });
        }
      });

      return {
        status: 'success',
        city,
        retentionDays: days,
        totalSnapshots: timeSeries.length,
        timeSeries,
        peakFloods: peakFloods.sort((a, b) => b.depth_cm - a.depth_cm).slice(0, 5),
        summary: {
          minSpeedKmh: Math.min(...timeSeries.map(t => t.avgSpeedKmh || 30)),
          maxSpeedKmh: Math.max(...timeSeries.map(t => t.avgSpeedKmh || 40)),
          maxRainMm: Math.max(...timeSeries.map(t => t.maxRainMm || 0)),
          floodEventsCount: peakFloods.length
        }
      };
    } catch (e) {
      return { status: 'error', message: e.message, timeSeries: [] };
    }
  }
}

module.exports = new HistoryService();
