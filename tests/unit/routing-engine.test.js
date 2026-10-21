/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: UNIT TESTING
 * Module: Routing Engine & Smart Flood Avoidance Algorithm
 * Reference Prefix: TC-NAV (Navigation & Routing)
 * ============================================================================
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('assert');
const RoutingService = require('../../js/routing-service');

describe('Module TC-NAV: Routing Engine & Smart Flood Avoidance', () => {
  let router;

  beforeEach(() => {
    router = new RoutingService();
  });

  // TC-NAV-001: Kiểm tra độ chính xác công thức khoảng cách Haversine
  it('[TC-NAV-001] Haversine formula calculates real-world distance accurately', () => {
    // Tọa độ Bệnh viện Bạch Mai -> Lotte Center Hà Nội (~4.4km theo đường chim bay)
    const bachMai = { lat: 21.0025, lng: 105.8395 };
    const lotte = { lat: 21.0335, lng: 105.8118 };

    const distance = router.getDistanceMeters(bachMai.lat, bachMai.lng, lotte.lat, lotte.lng);
    
    // Khoảng cách thực tế xấp xỉ 4520m - 4550m
    assert.ok(distance > 4400 && distance < 4600, `Distance should be ~4.5km, got ${distance}m`);
    
    // Khoảng cách cùng 1 điểm phải bằng 0
    const zeroDist = router.getDistanceMeters(bachMai.lat, bachMai.lng, bachMai.lat, bachMai.lng);
    assert.strictEqual(zeroDist, 0, 'Distance to same coordinate must be 0');
  });

  // TC-NAV-002: Kiểm tra bảng thông số kỹ thuật ngưỡng an toàn theo phương tiện
  it('[TC-NAV-002] Vehicle specifications must enforce strict safety thresholds', () => {
    const specs = router.vehicleSpecs;
    
    // Xe máy xăng: Giới hạn 20cm (ngập ống xả, bugi)
    assert.strictEqual(specs.motorbike.maxPassableDepth, 20);
    assert.strictEqual(specs.motorbike.safeDepth, 10);
    assert.strictEqual(specs.motorbike.allowAlleys, true);

    // Xe máy điện: Giới hạn 20cm (sàn pin & controller IC)
    assert.strictEqual(specs.ebike.maxPassableDepth, 20);
    assert.strictEqual(specs.ebike.safeDepth, 10);

    // Ô tô xăng: Giới hạn 25cm (họng hút gió sedan, chống thủy kích)
    assert.strictEqual(specs.car.maxPassableDepth, 25);
    assert.strictEqual(specs.car.safeDepth, 15);
    assert.strictEqual(specs.car.allowAlleys, false, 'Car must not enter narrow alleys');

    // Ô tô điện: Giới hạn 30cm (chống nổi bồng bềnh, ngắt relay pin)
    assert.strictEqual(specs.ecar.maxPassableDepth, 30);
    assert.strictEqual(specs.ecar.safeDepth, 15);
  });

  // TC-NAV-003: Kiểm tra luật cấm xe máy lên đường cao tốc / đường trên cao
  it('[TC-NAV-003] Road restrictions forbid 2-wheelers on expressways', () => {
    const routeWithExpressway = {
      steps: [
        { name: 'Đường Giải Phóng' },
        { name: 'Đoạn Vành Đai 3 Trên Cao' },
        { name: 'Đường Khuất Duy Tiến' }
      ]
    };

    const routeStandard = {
      steps: [
        { name: 'Đường Giải Phóng' },
        { name: 'Đường Trường Chinh' },
        { name: 'Đường Tây Sơn' }
      ]
    };

    // Xe máy không được đi Vành đai 3 trên cao
    const checkMotorbike = router.checkVehicleRoadRestrictions(routeWithExpressway, 'motorbike');
    assert.strictEqual(checkMotorbike.allowed, false);
    assert.ok(checkMotorbike.violation.includes('cao tốc cấm xe 2 bánh'));

    // Xe máy điện cũng bị cấm
    const checkEbike = router.checkVehicleRoadRestrictions(routeWithExpressway, 'ebike');
    assert.strictEqual(checkEbike.allowed, false);

    // Ô tô được phép đi cao tốc
    const checkCar = router.checkVehicleRoadRestrictions(routeWithExpressway, 'car');
    assert.strictEqual(checkCar.allowed, true);

    // Tuyến bình thường cả 2 xe đều được đi
    assert.strictEqual(router.checkVehicleRoadRestrictions(routeStandard, 'motorbike').allowed, true);
    assert.strictEqual(router.checkVehicleRoadRestrictions(routeStandard, 'car').allowed, true);
  });

  // TC-NAV-004: Lọc bỏ tuyến trùng lặp hình học
  it('[TC-NAV-004] Filter removes geometrically duplicate routes', () => {
    const mockRoutes = [
      {
        distanceMeters: 5000,
        polyline: [[21.0, 105.8], [21.01, 105.81], [21.02, 105.82]]
      },
      {
        distanceMeters: 5020, // Sai lệch chỉ 20m và cùng mid point
        polyline: [[21.0, 105.8], [21.0101, 105.8101], [21.02, 105.82]]
      },
      {
        distanceMeters: 6200, // Tuyến khác hẳn
        polyline: [[21.0, 105.8], [21.04, 105.85], [21.02, 105.82]]
      }
    ];

    const filtered = router.filterDistinctRoutes(mockRoutes);
    assert.strictEqual(filtered.length, 2, 'Should filter out 1 near-identical duplicate route');
    assert.strictEqual(filtered[0].distanceMeters, 5000);
    assert.strictEqual(filtered[1].distanceMeters, 6200);
  });

  // TC-NAV-005: Phát hiện đường vòng lặp ngược (Backtracking detection)
  it('[TC-NAV-005] Detects unnatural detour backtracking', () => {
    const origin = [21.0, 105.8];
    const destination = [21.1, 105.8]; // Đi về hướng Bắc 11km

    // Tuyến thẳng tiến về đích (>= 10 điểm)
    const straightRoute = [];
    for (let i = 0; i <= 10; i++) {
      straightRoute.push([21.0 + (0.1 * i / 10), 105.8]);
    }
    assert.strictEqual(router.detectBacktracking(straightRoute, origin[0], origin[1], destination[0], destination[1]), false);

    // Tuyến tiến gần đến đích (đến 21.09), rồi lùi ngược lại về cực xa phía Nam (21.01)
    const backtrackRoute = [];
    // Giai đoạn 1: Tiến sát đích (minDistSoFar chỉ còn ~1km)
    for (let i = 0; i <= 8; i++) {
      backtrackRoute.push([21.0 + (0.09 * i / 8), 105.8]);
    }
    // Giai đoạn 2: Bị bẻ lái lùi ngược về Nam hơn 5km (vượt ngưỡng backtrackThreshold)
    for (let i = 1; i <= 8; i++) {
      backtrackRoute.push([21.09 - (0.05 * i / 8), 105.8]);
    }
    assert.strictEqual(router.detectBacktracking(backtrackRoute, origin[0], origin[1], destination[0], destination[1]), true);
  });

  // TC-NAV-006: Phân loại rốn ngập thành Vật cản bất khả dụng vs Nước nông an toàn
  it('[TC-NAV-006] Classifies active flood zones based on vehicle threshold', () => {
    const floodPoints = [
      { id: 'f1', title: 'Ngập Nguyễn Khuyến', depth_cm: 35, lat: 21.025, lng: 105.84 },
      { id: 'f2', title: 'Nước nông Chùa Bộc', depth_cm: 12, lat: 21.008, lng: 105.83 },
      { id: 'f3', title: 'Khô ráo Thái Hà', depth_cm: 0, lat: 21.012, lng: 105.82 }
    ];

    const specsMotorbike = router.vehicleSpecs.motorbike; // max 20, safe 10

    const blocked = [];
    const caution = [];
    const safe = [];

    floodPoints.forEach(f => {
      if (f.depth_cm > specsMotorbike.maxPassableDepth) {
        blocked.push(f);
      } else if (f.depth_cm > specsMotorbike.safeDepth) {
        caution.push(f);
      } else {
        safe.push(f);
      }
    });

    assert.strictEqual(blocked.length, 1, 'Nguyễn Khuyến (35cm) must be BLOCKED for motorbike');
    assert.strictEqual(blocked[0].id, 'f1');
    assert.strictEqual(caution.length, 1, 'Chùa Bộc (12cm) must be CAUTION');
    assert.strictEqual(safe.length, 1, 'Thái Hà (0cm) is SAFE');
  });

  // TC-NAV-007: Tính toán tham số lệch Detour theo phương tiện
  it('[TC-NAV-007] Detour offsets scale with vehicle mobility footprint', () => {
    const motorbikeOffsets = router.vehicleSpecs.motorbike.detourOffsets;
    const carOffsets = router.vehicleSpecs.car.detourOffsets;

    // Xe máy cần detour ngắn hơn (hẻm, phố nhỏ)
    assert.deepStrictEqual(motorbikeOffsets, [450, 750, 1100]);
    // Ô tô cần detour rộng hơn để tránh mắc kẹt ngõ cụt
    assert.deepStrictEqual(carOffsets, [650, 1000, 1400]);
  });
});
