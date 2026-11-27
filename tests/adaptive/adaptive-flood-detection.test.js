/**
 * ============================================================================
 * MOVESAFE VN - ADAPTIVE FEATURE TESTING SUITE
 * Feature: Resilient Multi-Source Rain Extraction & Dynamic Flood Hazard Detection
 * Intent-driven, resilient verification of end-to-end flood detection & routing
 * ============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('assert');

// Khám phá động module theo Ý định (Intent-Driven Dynamic Discovery)
const WeatherService = require('../../js/weather-service');
const RoutingService = require('../../js/routing-service');
const botService = require('../../server/bot-service');

describe('Adaptive Feature Test: Resilient Rain & Flood Hazard Engine', () => {
  const weather = new WeatherService();
  const router = new RoutingService();

  // Test Intent 1: Trích xuất không thất thoát lượng mưa đối lưu nhiệt đới (Convective Rain)
  it('[AFT-01] Resilient rain extraction preserves convective precipitation and applies safe WMO floor', () => {
    // Kịch bản A: Open-Meteo trả về rain = 0 (do không phải stratiform), nhưng precipitation = 14.8mm
    const convectiveRain = {
      precipitation: 14.8,
      rain: 0,
      showers: 12.5,
      weather_code: 80
    };
    const extractedRain = weather.extractSafeRain(convectiveRain);
    assert.strictEqual(extractedRain, 14.8, 'Lượng mưa đối lưu không được bị triệt tiêu về 0');

    // Kịch bản B: Cảm biến lag gần 0 (0.1mm) nhưng mã WMO báo dông sét nghiêm trọng (Code 95)
    const stormLag = {
      precipitation: 0.1,
      rain: 0,
      showers: 0.1,
      weather_code: 95
    };
    const stormFloor = weather.extractSafeRain(stormLag);
    assert.ok(stormFloor >= 15, 'Dông bão phải kích hoạt ngưỡng sàn tối thiểu 15mm');

    // Kịch bản C: Bot backend cũng phải trích xuất chính xác với cùng kịch bản
    const botExtracted = botService.extractSafeRain(convectiveRain);
    assert.strictEqual(botExtracted, 14.8, 'Bot backend phải đồng bộ logic bóc tách lượng mưa');
  });

  // Test Intent 2: Động cơ Thủy văn Client-Side tính toán chính xác điểm ngập khi có mưa
  it('[AFT-02] Client-side hydrological engine dynamically elevates flood points when nearby stations report rain', () => {
    const mockFloodPoints = [
      {
        id: 'hsdc-01',
        name: 'Phố Nguyễn Khuyến (Khu vực trước cổng trường Lý Thường Kiệt)',
        city: 'hanoi',
        lat: 21.0268,
        lng: 105.8409,
        base_depth_cm: 35,
        depth_cm: 0,
        danger_level: 'safe',
        passable_motorbike: true,
        passable_car: true
      },
      {
        id: 'hsdc-07',
        name: 'Khu vực Triều Khúc - Tân Triều ("Vịnh Triều Khúc")',
        city: 'hanoi',
        lat: 20.9820,
        lng: 105.8015,
        base_depth_cm: 45,
        depth_cm: 0,
        danger_level: 'safe',
        passable_motorbike: true,
        passable_car: true
      }
    ];

    // Trạm thời tiết khu vực Hoàn Kiếm/Đống Đa (gần Nguyễn Khuyến) ghi nhận mưa to 32mm/h
    const stationsHanoi = [
      { id: 'st-dvh', city: 'hanoi', lat: 21.0260, lng: 105.8400, rain1h: 32 },
      { id: 'st-tk', city: 'hanoi', lat: 20.9830, lng: 105.8020, rain1h: 18 }
    ];

    const computedFloods = weather.computeFloodPointsFromWeather(mockFloodPoints, stationsHanoi, 'hanoi');

    // 1. Điểm Nguyễn Khuyến mưa 32mm -> Ngập sâu nguy hiểm (Critical)
    const nguyenKhuyen = computedFloods.find(f => f.id === 'hsdc-01');
    assert.ok(nguyenKhuyen, 'Phải tìm thấy điểm ngập Nguyễn Khuyến');
    assert.ok(nguyenKhuyen.depth_cm >= 30, `Độ sâu ngập phải >= 30cm, thực tế: ${nguyenKhuyen.depth_cm}cm`);
    assert.strictEqual(nguyenKhuyen.danger_level, 'critical');
    assert.strictEqual(nguyenKhuyen.passable_motorbike, false);
    assert.strictEqual(nguyenKhuyen.passable_car, false);

    // 2. Điểm Triều Khúc mưa 18mm -> Ngập vừa hoặc ngập sâu
    const trieuKhuc = computedFloods.find(f => f.id === 'hsdc-07');
    assert.ok(trieuKhuc, 'Phải tìm thấy điểm ngập Triều Khúc');
    assert.ok(trieuKhuc.depth_cm >= 15, `Độ sâu ngập phải >= 15cm, thực tế: ${trieuKhuc.depth_cm}cm`);
    assert.strictEqual(trieuKhuc.passable_motorbike, false); // Triều Khúc ngập sâu thì xe máy không qua được
  });

  // Test Intent 3: Tích hợp với Thuật toán Dẫn đường Né ngập (Hazard Avoidance Routing)
  it('[AFT-03] Routing engine recognizes dynamic flood hazards and classifies them correctly for vehicle types', () => {
    const activeFloods = [
      {
        id: 'hsdc-01',
        name: 'Phố Nguyễn Khuyến',
        city: 'hanoi',
        lat: 21.0268,
        lng: 105.8409,
        depth_cm: 35,
        danger_level: 'critical',
        passable_motorbike: false,
        passable_car: false
      },
      {
        id: 'hsdc-04',
        name: 'Đường Thái Hà',
        city: 'hanoi',
        lat: 21.0173,
        lng: 105.8175,
        depth_cm: 18,
        danger_level: 'medium',
        passable_motorbike: true,
        passable_car: true
      }
    ];

    // Đối với Xe Máy: Nguyễn Khuyến (35cm) bị chặn hoàn toàn (blockedFloods), Thái Hà (18cm) là cảnh báo (cautionFloods)
    const motorbikeHazards = router.classifyHazards(activeFloods, [], 'motorbike');
    assert.strictEqual(motorbikeHazards.blockedFloods.length, 1, 'Xe máy phải bị chặn tại điểm ngập sâu 35cm');
    assert.strictEqual(motorbikeHazards.blockedFloods[0].id, 'hsdc-01');
    assert.strictEqual(motorbikeHazards.cautionFloods.length, 1, 'Xe máy phải được cảnh báo tại điểm ngập 18cm');
    assert.strictEqual(motorbikeHazards.cautionFloods[0].id, 'hsdc-04');

    // Đối với Ô tô: Nguyễn Khuyến (35cm) bị chặn
    const carHazards = router.classifyHazards(activeFloods, [], 'car');
    assert.strictEqual(carHazards.blockedFloods.length, 1, 'Ô tô phải bị chặn tại điểm ngập sâu 35cm');
  });

  // Test Intent 4: Nước rút tự nhiên khi ngớt mưa (Drainage & Safe State Restoration)
  it('[AFT-04] Flood points cleanly reset to safe status (depth_cm = 0) when weather returns to dry', () => {
    const previouslyFlooded = [
      {
        id: 'hsdc-01',
        name: 'Phố Nguyễn Khuyến',
        city: 'hanoi',
        lat: 21.0268,
        lng: 105.8409,
        base_depth_cm: 35,
        depth_cm: 35,
        danger_level: 'critical'
      }
    ];

    // Trạm thời tiết báo tạnh mưa hoàn toàn (0mm/h)
    const dryStations = [
      { id: 'st-01', city: 'hanoi', lat: 21.0260, lng: 105.8400, rain1h: 0 }
    ];

    const safeFloods = weather.computeFloodPointsFromWeather(previouslyFlooded, dryStations, 'hanoi');
    const resetPoint = safeFloods[0];

    assert.strictEqual(resetPoint.depth_cm, 0, 'Độ sâu ngập phải reset về 0cm');
    assert.strictEqual(resetPoint.danger_level, 'safe', 'Trạng thái phải an toàn');
    assert.strictEqual(resetPoint.passable_motorbike, true);
    assert.strictEqual(resetPoint.passable_car, true);
  });

  // Test Intent 5: Dự báo tương lai +2h vẫn giữ ngập tồn dư từ cơn mưa lớn ở +1h & tích lũy mưa liên tiếp
  it('[AFT-05] Spatio-temporal future prediction preserves residual flooding at +2h from a +1h storm and accumulates sustained rain', () => {
    const prevStations = botService.cachedData.weatherStations;
    const prevFloods = botService.cachedData.floodPoints;
    const prevMemory = new Map(botService.floodMemory);

    try {
      botService.floodMemory.clear();
      botService.cachedData.floodPoints = [];

      // Kịch bản A: Hiện tại khô, +1h mưa 35mm/h, +2h tạnh mưa (0mm/h)
      botService.cachedData.weatherStations = {
        hanoi: [
          {
            id: 'st-test-hn',
            city: 'hanoi',
            lat: 21.0268,
            lng: 105.8409,
            rain1h: 0,
            forecastRain: [35, 0, 0]
          }
        ]
      };

      const pred2h = botService.getFuturePredictions('hanoi', 2);
      assert.strictEqual(pred2h.peakWindowRain, 35, 'Phải ghi nhận đỉnh mưa cửa sổ +1h..+2h là 35mm');
      const nk2h = pred2h.floodPoints.find(f => f.id === 'ai-pred-hsdc-01');
      assert.ok(nk2h, 'Dù +2h đã tạnh mưa nhưng nước ngập do mưa 35mm lúc +1h chưa thể rút sạch ngay');
      assert.ok(nk2h.depth_cm >= 20, `Mực nước tồn dư ở +2h phải >= 20cm, thực tế: ${nk2h.depth_cm}cm`);

      // Kịch bản B: Mưa vừa 20mm/h kéo dài 2 giờ liên tiếp [20, 20, 0] -> phải cao hơn mưa 1 giờ đơn lẻ
      botService.cachedData.weatherStations = {
        hanoi: [
          {
            id: 'st-test-hn',
            city: 'hanoi',
            lat: 21.0268,
            lng: 105.8409,
            rain1h: 0,
            forecastRain: [20, 20, 0]
          }
        ]
      };
      const sustained1h = botService.getFuturePredictions('hanoi', 1).floodPoints.find(f => f.id === 'ai-pred-hsdc-01');
      const sustained2h = botService.getFuturePredictions('hanoi', 2).floodPoints.find(f => f.id === 'ai-pred-hsdc-01');
      assert.ok(sustained1h && sustained2h, 'Mưa liên tiếp 20mm/h phải xuất hiện điểm ngập');
      assert.ok(sustained2h.depth_cm > sustained1h.depth_cm, `Mưa 20mm/h kéo dài 2h (${sustained2h.depth_cm}cm) phải tích lũy sâu hơn 1h (${sustained1h.depth_cm}cm)`);
    } finally {
      botService.cachedData.weatherStations = prevStations;
      botService.cachedData.floodPoints = prevFloods;
      botService.floodMemory = prevMemory;
    }
  });

  // Test Intent 6: Mô hình Render AI (server-ai/main.py) & Supabase fallback đọc đúng trạng thái thời tiết và schema chuẩn
  it('[AFT-06] Render server-ai model fetches live Open-Meteo hourly forecast and aligns prediction schema with client', () => {
    const fs = require('fs');
    const path = require('path');
    const pyCode = fs.readFileSync(path.join(__dirname, '../../server-ai/main.py'), 'utf8');
    const supaCode = fs.readFileSync(path.join(__dirname, '../../js/supabase-service.js'), 'utf8');

    // 1. server-ai/main.py phải gọi trực tiếp Open-Meteo hourly forecast + trích xuất WMO floor + tự làm mới cache
    assert.ok(pyCode.includes('api.open-meteo.com/v1/forecast'), 'Render AI phải gọi Open-Meteo trực tiếp thay vì chỉ đọc file JSON tĩnh');
    assert.ok(pyCode.includes('extract_safe_rain_py'), 'Render AI phải đồng bộ extract_safe_rain_py');
    assert.ok(pyCode.includes('_ensure_fresh_predictions'), 'Render AI phải tự làm mới dự báo theo TTL thay vì kẹt dữ liệu boot');
    assert.ok(pyCode.includes('"floodPoints": active_flood_points') && pyCode.includes('"trafficIncidents": traffic_geo'), 'Render AI phải trả về đầy đủ floodPoints & trafficIncidents khớp Client');
    assert.ok(pyCode.includes('@app.get("/api/health")'), 'Render AI phải có route /api/health cho healthCheckPath');

    // 2. Supabase fallback không đọc nhầm tên thuộc tính appState (isSimulationMode / latestCityWeather / active flood)
    assert.ok(!supaCode.includes('window.appState?.simulationMode'), 'Phải dùng isSimulationMode thay vì simulationMode');
    assert.ok(!supaCode.includes('window.appState?.currentWeather'), 'Phải dùng latestCityWeather/latestWeatherStations thay vì currentWeather');
    assert.ok(supaCode.includes('hasActiveFlood'), 'Chỉ tính ngập khi có trạm depth_cm > 0, không đếm cả 23 trạm 0cm');
  });

  // Test Intent 7: HistoryService.pushSnapshotToSupabase hoàn tất đồng bộ (await) tránh bị process.exit cắt ngang
  it('[AFT-07] HistoryService awaits Supabase snapshot push and handles network errors safely', async () => {
    const historyService = require('../../server/history-service');
    const origFetch = global.fetch;
    const calledUrls = [];

    try {
      global.fetch = async (url) => {
        calledUrls.push(String(url));
        return { ok: true, status: 201 };
      };

      const sampleSnapshot = {
        timestamp: new Date().toISOString(),
        hanoi: { avgSpeedKmh: 28, congestionIndex: 2.2, maxRainMm: 12, activeFloodSpots: [{ id: 'hsdc-01', name: 'Nguyễn Khuyến', depth_cm: 20, danger_level: 'medium' }] },
        hcm: { avgSpeedKmh: 25, congestionIndex: 2.5, maxRainMm: 0, activeFloodSpots: [] },
        danang: { avgSpeedKmh: 36, congestionIndex: 1.2, maxRainMm: 0, activeFloodSpots: [] }
      };

      const res = await historyService.pushSnapshotToSupabase(sampleSnapshot);
      assert.strictEqual(res.ok, true, 'pushSnapshotToSupabase phải await và trả về kết quả thành công');
      assert.ok(calledUrls.some(u => u.includes('/rest/v1/traffic_history')), 'Phải ghi traffic_history');
      assert.ok(calledUrls.some(u => u.includes('/rest/v1/flood_history')), 'Phải ghi flood_history khi có điểm ngập');
    } finally {
      global.fetch = origFetch;
    }
  });
});
