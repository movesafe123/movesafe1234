const fs = require('fs');
const path = require('path');
const config = require('../server/config');

const SUPABASE_URL = config.API_KEYS.SUPABASE_URL;
const SUPABASE_KEY = config.API_KEYS.SUPABASE_KEY;

async function syncToSupabase() {
  console.log('=== ĐỒNG BỘ DỮ LIỆU LỊCH SỬ LÊN SUPABASE CLOUD ===');
  console.log('Supabase URL:', SUPABASE_URL);

  const historyFile = path.join(__dirname, '..', 'data', 'history', 'history_summary.json');
  if (!fs.existsSync(historyFile)) {
    console.error('Không tìm thấy file history_summary.json');
    return;
  }

  const fileData = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  const snapshots = fileData.snapshots || [];
  console.log(`Tìm thấy ${snapshots.length} snapshots cục bộ.`);

  // Chuyển đổi snapshots sang định dạng traffic_history
  const trafficRows = [];
  const floodRows = [];

  snapshots.forEach(s => {
    // Hà Nội
    if (s.hanoi) {
      trafficRows.push({
        segment_id: 'HN_CITY_AVG',
        recorded_at: s.timestamp,
        speed_kmh: Math.round(s.hanoi.avgSpeedKmh || 30),
        congestion_level: Math.min(5, Math.max(1, Math.round(s.hanoi.congestionIndex || 1))),
        weather_condition: s.hanoi.maxRainMm > 20 ? 'heavy_rain' : (s.hanoi.maxRainMm > 0 ? 'light_rain' : 'clear')
      });
      if (s.hanoi.activeFloodSpots && s.hanoi.activeFloodSpots.length > 0) {
        s.hanoi.activeFloodSpots.forEach(f => {
          floodRows.push({
            station_id: 'HN_' + f.name.replace(/\s+/g, '_').toUpperCase(),
            station_name: f.name,
            city: 'hanoi',
            depth_cm: f.depth_cm,
            danger_level: f.depth_cm >= 30 ? 'CRITICAL' : 'WARNING',
            recorded_at: s.timestamp
          });
        });
      }
    }

    // TP. Hồ Chí Minh
    if (s.hcm) {
      trafficRows.push({
        segment_id: 'HCM_CITY_AVG',
        recorded_at: s.timestamp,
        speed_kmh: Math.round(s.hcm.avgSpeedKmh || 28),
        congestion_level: Math.min(5, Math.max(1, Math.round(s.hcm.congestionIndex || 1))),
        weather_condition: s.hcm.maxRainMm > 20 ? 'heavy_rain' : (s.hcm.maxRainMm > 0 ? 'light_rain' : 'clear')
      });
      if (s.hcm.activeFloodSpots && s.hcm.activeFloodSpots.length > 0) {
        s.hcm.activeFloodSpots.forEach(f => {
          floodRows.push({
            station_id: 'HCM_' + f.name.replace(/\s+/g, '_').toUpperCase(),
            station_name: f.name,
            city: 'hcm',
            depth_cm: f.depth_cm,
            danger_level: f.depth_cm >= 30 ? 'CRITICAL' : 'WARNING',
            recorded_at: s.timestamp
          });
        });
      }
    }

    // Đà Nẵng
    if (s.danang) {
      trafficRows.push({
        segment_id: 'DN_CITY_AVG',
        recorded_at: s.timestamp,
        speed_kmh: Math.round(s.danang.avgSpeedKmh || 35),
        congestion_level: Math.min(5, Math.max(1, Math.round(s.danang.congestionIndex || 1))),
        weather_condition: s.danang.maxRainMm > 20 ? 'heavy_rain' : (s.danang.maxRainMm > 0 ? 'light_rain' : 'clear')
      });
      if (s.danang.activeFloodSpots && s.danang.activeFloodSpots.length > 0) {
        s.danang.activeFloodSpots.forEach(f => {
          floodRows.push({
            station_id: 'DN_' + f.name.replace(/\s+/g, '_').toUpperCase(),
            station_name: f.name,
            city: 'danang',
            depth_cm: f.depth_cm,
            danger_level: f.depth_cm >= 30 ? 'CRITICAL' : 'WARNING',
            recorded_at: s.timestamp
          });
        });
      }
    }
  });

  console.log(`Chuẩn bị đẩy ${trafficRows.length} dòng traffic_history và ${floodRows.length} dòng flood_history lên Supabase...`);

  // Hàm chia mẻ (batch) để gửi POST
  async function batchInsert(table, rows, batchSize = 100) {
    let successCount = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(chunk)
        });

        if (res.status === 201 || res.status === 200) {
          successCount += chunk.length;
          console.log(`[${table}] Đã đẩy thành công ${successCount}/${rows.length} dòng...`);
        } else {
          const errText = await res.text();
          console.error(`[${table}] Lỗi HTTP ${res.status}: ${errText}`);
          break;
        }
      } catch (err) {
        console.error(`[${table}] Ngoại lệ mạng:`, err.message);
        break;
      }
    }
    return successCount;
  }

  const trafficSuccess = await batchInsert('traffic_history', trafficRows);
  console.log(`=> Kết quả traffic_history: ${trafficSuccess}/${trafficRows.length} dòng.`);

  if (floodRows.length > 0) {
    const floodSuccess = await batchInsert('flood_history', floodRows);
    console.log(`=> Kết quả flood_history: ${floodSuccess}/${floodRows.length} dòng.`);
  }

  console.log('=== HOÀN TẤT ĐỒNG BỘ ===');
}

syncToSupabase();
