/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: UNIT TESTING
 * Module: Weather Parser & Meteorological Service
 * Reference Prefix: TC-WTH (Weather & Climate)
 * ============================================================================
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('assert');
const WeatherService = require('../../js/weather-service');

describe('Module TC-WTH: Weather Parser & Meteorological Services', () => {
  let weather;

  beforeEach(() => {
    weather = new WeatherService();
  });

  // TC-WTH-001: Giải mã mã WMO (World Meteorological Organization)
  it('[TC-WTH-001] WMO weather codes are parsed into accurate Vietnamese text', () => {
    // Code 0: Trời quang đãng
    assert.strictEqual(weather.getWmoDescription(0, true), 'Trời quang đãng, nắng nhẹ');
    assert.strictEqual(weather.getWmoDescription(0, false), 'Trời quang mây, tạnh ráo');

    // Code 2-3: Nhiều mây
    assert.strictEqual(weather.getWmoDescription(2, true), 'Có mây rải rác');
    assert.strictEqual(weather.getWmoDescription(3, false), 'Nhiều mây về đêm');

    // Code 51-55: Mưa phùn
    assert.strictEqual(weather.getWmoDescription(53, true), 'Mưa phùn hạt nhỏ');

    // Code 61-65: Mưa rào
    assert.strictEqual(weather.getWmoDescription(63, true), 'Mưa rào từ nhẹ đến vừa');

    // Code 80-82: Mưa to dông sét
    assert.strictEqual(weather.getWmoDescription(81, true), 'Mưa rào rất to, dông sét');

    // Code 95+: Dông sấm sét nguy hiểm
    assert.strictEqual(weather.getWmoDescription(95, true), 'Dông kèm sấm chớp nguy hiểm');
  });

  // TC-WTH-002: Chu kỳ ngày / đêm tránh hiển thị mặt trời ban đêm
  it('[TC-WTH-002] Prevents daylight sun rendering during night hours', () => {
    const dayDesc = weather.getWmoDescription(0, true);
    const nightDesc = weather.getWmoDescription(0, false);

    assert.ok(dayDesc.includes('nắng') || dayDesc.includes('quang đãng'));
    assert.ok(nightDesc.includes('về đêm') || nightDesc.includes('quang mây') || nightDesc.includes('tạnh ráo'));
    assert.strictEqual(nightDesc.includes('nắng'), false, 'Night weather must not state sunny');
  });

  // TC-WTH-003: Phân loại rủi ro ngập theo lượng mưa 1 giờ
  it('[TC-WTH-003] Flood risk calculation aligns with urban drainage capacity', () => {
    // Lượng mưa = 0mm -> An toàn, khô ráo
    const safeRisk = weather.calculateFloodRisk(0);
    assert.strictEqual(safeRisk.level, 'safe');
    assert.strictEqual(safeRisk.badgeClass, 'badge-safe');

    // Lượng mưa nhỏ < 15mm/h -> Chú ý
    const lowRisk = weather.calculateFloodRisk(8.5);
    assert.strictEqual(lowRisk.level, 'caution');

    // Lượng mưa trung bình 10 - 24mm/h -> Nguy cơ ngập vừa
    const medRisk = weather.calculateFloodRisk(15);
    assert.strictEqual(medRisk.level, 'warning');

    // Lượng mưa lớn >= 25mm/h -> Nguy cơ ngập úng nghiêm trọng
    const highRisk = weather.calculateFloodRisk(30);
    assert.strictEqual(highRisk.level, 'danger');
    assert.ok(highRisk.text.includes('Ngập sâu') || highRisk.text.includes('Nguy cơ ngập'));
  });

  // TC-WTH-004: Tính toàn vẹn của danh sách trạm quan trắc đô thị
  it('[TC-WTH-004] Presets contain rich station coordinates for Hanoi, HCM and Danang', () => {
    const presets = weather.stationPresets;
    
    assert.ok(Array.isArray(presets.hanoi), 'Hanoi presets must be an array');
    assert.ok(presets.hanoi.length >= 5, 'Hanoi must have at least 5 key ward presets');

    assert.ok(Array.isArray(presets.hcm), 'HCM presets must be an array');
    assert.strictEqual(presets.hcm.length, 10, 'HCM presets must have 10 districts');

    assert.ok(Array.isArray(presets.danang), 'Danang presets must be an array');
    assert.strictEqual(presets.danang.length, 6, 'Danang presets must have 6 districts');

    // Kiểm tra cấu trúc mỗi trạm
    const sample = presets.hcm[0];
    assert.ok(sample.id);
    assert.ok(sample.ward);
    assert.ok(typeof sample.lat === 'number' && sample.lat > 0);
    assert.ok(typeof sample.lng === 'number' && sample.lng > 0);
    assert.ok(Array.isArray(sample.mainStreets));
  });

  // TC-WTH-005: Tính toán Chỉ số Thoải Mái Khi Đi Đường (Commute Comfort & 15P Nowcasting)
  it('[TC-WTH-005] getCommuteComfortData provides Road RealFeel, CCI score, and 15P timeline', async () => {
    const data = await weather.getCommuteComfortData(21.0285, 105.8542, 'Hà Nội');
    
    assert.ok(typeof data.comfortScore === 'number' && data.comfortScore >= 0 && data.comfortScore <= 100, 'CCI Score phải từ 0 đến 100');
    assert.ok(typeof data.roadRealFeel === 'number', 'roadRealFeel phải là số');
    assert.ok(typeof data.uvIndex === 'number', 'uvIndex phải là số');
    assert.ok(typeof data.humidity === 'number', 'humidity phải là số');
    assert.ok(typeof data.windSpeed === 'number', 'windSpeed phải là số');
    assert.ok(data.comfortStatus, 'Thiếu comfortStatus');
    assert.ok(data.commuteAdvice, 'Thiếu commuteAdvice');
    assert.ok(Array.isArray(data.gearList) && data.gearList.length >= 2, 'gearList phải có ít nhất 2 trang bị');
    assert.ok(Array.isArray(data.timeline15), 'timeline15 phải là mảng');
  });

  // TC-WTH-006: Kiểm tra giao diện Modal Trải Nghiệm Thoải Mái Đi Đường trong index.html
  it('[TC-WTH-006] index.html contains Commute Comfort modal and required interactive elements', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

    assert.ok(html.includes('id="modal-commute-comfort"'), 'Thiếu id modal-commute-comfort');
    assert.ok(html.includes('id="comfort-score-num"'), 'Thiếu id comfort-score-num');
    assert.ok(html.includes('id="comfort-timeline-chart"'), 'Thiếu id comfort-timeline-chart');
    assert.ok(html.includes('id="comfort-gear-container"'), 'Thiếu id comfort-gear-container');
    assert.ok(html.includes('id="btn-comfort-refresh"'), 'Thiếu id btn-comfort-refresh');
    assert.ok(html.includes('id="btn-comfort-route"'), 'Thiếu id btn-comfort-route');
    assert.ok(html.includes('id="gm-weather-pill"'), 'Thiếu id gm-weather-pill');
  });

  // TC-WTH-007: Trích xuất an toàn lượng mưa đa nguồn & Dự phòng WMO Floor Rain
  it('[TC-WTH-007] extractSafeRain accurately parses precipitation/showers and preserves tropical convective rain', () => {
    // 1. Trường hợp Open-Meteo trả về rain: 0 nhưng precipitation: 4.5 (Mưa rào đối lưu)
    const convectiveSample = { rain: 0, precipitation: 4.5, showers: 3.8, weather_code: 80 };
    assert.strictEqual(weather.extractSafeRain(convectiveSample), 4.5, 'Phải trích xuất được 4.5mm thay vì bị nuốt về 0');

    // 2. Trường hợp chỉ có showers lớn
    const showerSample = { rain: 0, precipitation: 0, showers: 8.2, weather_code: 63 };
    assert.strictEqual(weather.extractSafeRain(showerSample), 8.2, 'Phải ưu tiên giá trị showers lớn nhất');

    // 3. Dự phòng WMO Code: Dông bão nguy hiểm (code 95) nhưng cảm biến lag 0mm -> Gán ngưỡng sàn bảo vệ 15mm
    const stormLagSample = { rain: 0, precipitation: 0, showers: 0, weather_code: 95 };
    assert.strictEqual(weather.extractSafeRain(stormLagSample), 15.0, 'Mã WMO 95 dông bão phải kích hoạt ngưỡng sàn tối thiểu 15mm');

    // 4. Dự phòng WMO Code: Mưa rào rất to (code 81) nhưng cảm biến lag 0.2mm -> Gán ngưỡng sàn bảo vệ 10mm
    const heavyShowerLag = { rain: 0, precipitation: 0.2, showers: 0, weather_code: 81 };
    assert.strictEqual(weather.extractSafeRain(heavyShowerLag), 10.0, 'Mã WMO 81 mưa to phải kích hoạt ngưỡng sàn tối thiểu 10mm');

    // 5. Trời khô ráo hoàn toàn (code 0, mưa 0mm) -> Trả về 0
    const drySample = { rain: 0, precipitation: 0, showers: 0, weather_code: 0 };
    assert.strictEqual(weather.extractSafeRain(drySample), 0, 'Trời khô ráo phải trả về 0');
  });

  // TC-WTH-008: Động cơ Thủy văn Độc lập phía Client tính toán độ sâu ngập chính xác
  it('[TC-WTH-008] computeFloodPointsFromWeather calculates dynamic flood depths and hazard levels on client side', () => {
    const baseFloods = [
      {
        id: 'hsdc-01',
        name: 'Phố Nguyễn Khuyến (Khu vực trước cổng trường Lý Thường Kiệt)',
        city: 'hanoi',
        lat: 21.0268,
        lng: 105.8409,
        base_depth_cm: 35,
        depth_cm: 0,
        danger_level: 'safe'
      }
    ];

    // Trạm thời tiết ngay gần Nguyễn Khuyến có mưa to 28mm/h
    const heavyRainStations = [
      { id: 'st-01', city: 'hanoi', lat: 21.0270, lng: 105.8415, rain1h: 28 }
    ];

    const criticalResult = weather.computeFloodPointsFromWeather(baseFloods, heavyRainStations, 'hanoi');
    assert.strictEqual(criticalResult.length, 1);
    const criticalFlood = criticalResult[0];
    assert.ok(criticalFlood.depth_cm >= 30, 'Độ sâu ngập phải >= 30cm khi mưa 28mm/h');
    assert.strictEqual(criticalFlood.danger_level, 'critical', 'Trạng thái phải là critical');
    assert.strictEqual(criticalFlood.passable_motorbike, false, 'Xe máy không thể qua được');

    // Trạm thời tiết có mưa vừa 12mm/h
    const moderateRainStations = [
      { id: 'st-01', city: 'hanoi', lat: 21.0270, lng: 105.8415, rain1h: 12 }
    ];
    const mediumResult = weather.computeFloodPointsFromWeather(baseFloods, moderateRainStations, 'hanoi');
    const mediumFlood = mediumResult[0];
    assert.ok(mediumFlood.depth_cm >= 15 && mediumFlood.depth_cm <= 28, 'Mưa vừa độ sâu phải từ 15-28cm');
    assert.strictEqual(mediumFlood.danger_level, 'medium');

    // Trạm thời tiết tạnh mưa 0mm/h
    const dryStations = [
      { id: 'st-01', city: 'hanoi', lat: 21.0270, lng: 105.8415, rain1h: 0 }
    ];
    const safeResult = weather.computeFloodPointsFromWeather(baseFloods, dryStations, 'hanoi');
    const safeFlood = safeResult[0];
    assert.strictEqual(safeFlood.depth_cm, 0);
    assert.strictEqual(safeFlood.danger_level, 'safe');
    assert.strictEqual(safeFlood.passable_motorbike, true);
  });
});
