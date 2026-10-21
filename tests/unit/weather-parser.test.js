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
});
