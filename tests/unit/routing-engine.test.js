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
  // TC-NAV-008: Quy tắc lọc trùng mới - Chênh lệch >= 100m luôn giữ làm 2 tuyến riêng
  it('[TC-NAV-008] filterDistinctRoutes preserves routes differing by >= 100m', () => {
    const mockRoutes = [
      {
        distanceMeters: 5000,
        polyline: [[21.0, 105.8], [21.01, 105.81], [21.02, 105.82]]
      },
      {
        distanceMeters: 5100, // Chênh đúng 100m -> Bắt buộc giữ lại làm tuyến riêng
        polyline: [[21.0, 105.8], [21.0101, 105.8101], [21.02, 105.82]]
      },
      {
        distanceMeters: 5050, // Chênh chỉ 50m so với tuyến 1 (< 100m) và cùng mid point -> Lọc bỏ
        polyline: [[21.0, 105.8], [21.01005, 105.81005], [21.02, 105.82]]
      }
    ];

    const filtered = router.filterDistinctRoutes(mockRoutes);
    assert.strictEqual(filtered.length, 2, 'Should keep routes differing by >= 100m and filter < 100m');
    assert.strictEqual(filtered[0].distanceMeters, 5000);
    assert.strictEqual(filtered[1].distanceMeters, 5100);
  });

  // TC-NAV-009: buildThreePassableModes gộp trùng: 3 chế độ trùng -> 1 thẻ Nhanh nhất; 2 chế độ trùng -> ghép tên Nhanh -> An toàn -> Êm ái
  it('[TC-NAV-009] buildThreePassableModes merges identical modes accurately', () => {
    const specs = router.vehicleSpecs.motorbike;
    const baseCandidate = {
      distanceKm: '4.6',
      distanceMeters: 4600,
      durationMin: 6,
      realAvgSpeedKmh: 46,
      rpi: 95,
      ecoScore: 90,
      jamPercent: 0,
      freeFlowPercent: 100,
      moderatePercent: 0,
      severePercent: 0,
      matchedFloods: [],
      matchedTraffics: [],
      warnings: [],
      bottleneckWarnings: [],
      polyline: [[21.0, 105.7], [21.02, 105.75], [21.03, 105.78]]
    };

    // Khi chỉ có 1 tuyến khả dụng: Cả 3 chế độ trùng nhau
    const resSingle = router.buildThreePassableModes([baseCandidate], 1, specs, []);
    assert.strictEqual(resSingle.routes.length, 1, '3 chế độ trùng nhau chỉ được trả về đúng 1 thẻ');
    assert.strictEqual(resSingle.routes[0].label, 'Nhanh nhất');
    assert.strictEqual(resSingle.routes[0].isRecommended, true);

    // Khi có 2 tuyến khác nhau: Tuyến 1 nhanh & an toàn, Tuyến 2 êm ái hơn
    const cand1 = { ...baseCandidate, durationMin: 6, ecoScore: 80 };
    const cand2 = {
      ...baseCandidate,
      distanceMeters: 5200,
      durationMin: 9,
      ecoScore: 98,
      polyline: [[21.0, 105.7], [21.04, 105.75], [21.03, 105.78]]
    };

    const resTwo = router.buildThreePassableModes([cand1, cand2], 1, specs, []);
    assert.strictEqual(resTwo.routes.length, 2, '2 tuyến khác nhau trả về 2 thẻ');
    const mergedCard = resTwo.routes.find(r => r.label.includes('+'));
    assert.ok(mergedCard, 'Phải có thẻ ghép tên 2 chế độ trùng nhau');
    assert.strictEqual(mergedCard.label, 'Nhanh thực tế + An toàn hành lang lớn');
    assert.strictEqual(mergedCard.shortLabel, 'Nhanh + An toàn');
  });

  // TC-NAV-010: Ngập cảnh báo (cautionFloods) phải cộng độ trễ cho Nhanh thực tế & Chế độ An toàn phải chọn tuyến khô ráo
  it('[TC-NAV-010] evaluatePassableRoute adds flood delay and Mode 1 prefers 0cm dry route over caution flood', () => {
    const specs = router.vehicleSpecs.motorbike; // safeDepth = 10, maxPassableDepth = 20
    const cautionFloods = [
      { id: 'f-caution', name: 'Ngập cận ngưỡng 16cm', lat: 21.01, lng: 105.81, depth_cm: 16, danger_level: 'medium', radius: 120 }
    ];

    const wetRouteRaw = {
      distanceKm: '4.0',
      distanceMeters: 4000,
      durationSeconds: 480, // 8 phút nền
      polyline: [[21.00, 105.80], [21.01, 105.81], [21.02, 105.82]],
      steps: [{ name: 'Đường Xã Đàn', distance: 4000, instruction: 'depart ' }]
    };

    const dryRouteRaw = {
      distanceKm: '4.6',
      distanceMeters: 4600,
      durationSeconds: 540, // 9 phút nền
      polyline: [[21.00, 105.80], [21.03, 105.85], [21.02, 105.82]],
      steps: [{ name: 'Đại lộ Võ Văn Kiệt', distance: 4600, instruction: 'depart ' }]
    };

    const wetEval = router.evaluatePassableRoute(wetRouteRaw, cautionFloods, [], [], specs);
    const dryEval = router.evaluatePassableRoute(dryRouteRaw, cautionFloods, [], [], specs);

    assert.strictEqual(wetEval.cautionFloodCount, 1);
    assert.ok(wetEval.floodDelayMin >= 2, `Đi qua ngập 16cm phải cộng độ trễ >= 2 phút (nhận ${wetEval.floodDelayMin}p)`);
    assert.strictEqual(dryEval.cautionFloodCount, 0);
    assert.strictEqual(dryEval.floodDelayMin, 0);
    assert.ok(dryEval.rpi > wetEval.rpi, 'Tuyến khô ráo phải có RPI cao hơn tuyến ngập cảnh báo');

    const res = router.buildThreePassableModes([wetEval, dryEval], 1, specs, []);
    const safeCard = res.routes.find(r => Array.isArray(r.mergedLevels) && r.mergedLevels.includes(1));
    assert.ok(safeCard, 'Phải trả về tuyến cho Chế độ 1 (An toàn hành lang lớn)');
    assert.strictEqual(safeCard.cautionFloodCount, 0, 'Chế độ 1 phải chọn tuyến 0cm ngập khô ráo');
    assert.ok(safeCard.label.includes('An toàn'), 'Thẻ chế độ 1 phải mang nhãn An toàn');
  });

  // TC-NAV-011: Khi tuyến Nhanh nhất cũng là tuyến An toàn nhất, Chế độ 1 KHÔNG được hạ cấp sang tuyến kém an toàn hơn
  it('[TC-NAV-011] Mode 1 merges with Mode 3 instead of downgrading to a less safe route', () => {
    const specs = router.vehicleSpecs.car;
    const bestOverall = {
      distanceKm: '6.0',
      distanceMeters: 6000,
      durationMin: 12,
      realAvgSpeedKmh: 30,
      rpi: 96,
      ecoScore: 86,
      jamPercent: 0,
      freeFlowPercent: 100,
      moderatePercent: 0,
      severePercent: 0,
      severeCount: 0,
      cautionFloodCount: 0,
      safeFloodCount: 0,
      alleyRatio: 0,
      majorRatio: 85,
      hasAlleyTrap: false,
      matchedFloods: [],
      matchedTraffics: [],
      warnings: [],
      bottleneckWarnings: [],
      congestionScore: 0,
      polyline: [[21.0, 105.7], [21.02, 105.75], [21.04, 105.80]]
    };

    // Tuyến phụ chậm hơn, dính kẹt cứng severeCount = 1 và RPI thấp (72%)
    const worseAlternative = {
      ...bestOverall,
      distanceKm: '6.8',
      distanceMeters: 6800,
      durationMin: 14,
      rpi: 72,
      ecoScore: 76,
      jamPercent: 25,
      freeFlowPercent: 75,
      moderatePercent: 10,
      severePercent: 15,
      severeCount: 1,
      congestionScore: 80,
      polyline: [[21.0, 105.7], [21.05, 105.78], [21.04, 105.80]]
    };

    const res = router.buildThreePassableModes([bestOverall, worseAlternative], 1, specs, []);
    const safeCard = res.routes.find(r => r.mergedLevels.includes(1));
    assert.ok(safeCard, 'Phải có thẻ gộp chứa mức 1');
    assert.strictEqual(safeCard.rpi, 96, 'Chế độ 1 phải giữ tuyến an toàn RPI 96%, không bị hạ xuống RPI 72%');
    assert.ok(safeCard.mergedLevels.includes(3), 'Tuyến tốt nhất toàn diện phải gộp Nhanh thực tế + An toàn hành lang lớn');
  });

  // TC-NAV-012: Chế độ 2 (Trục chính êm ái) trừ điểm ngõ nhỏ/nhiều cua và từ chối đi vòng quá xa (> 1.35x)
  it('[TC-NAV-012] Mode 2 penalizes high turn/alley routes and rejects excessive detours', () => {
    const specs = router.vehicleSpecs.motorbike;
    const zigZagRouteRaw = {
      distanceKm: '3.0',
      distanceMeters: 3000,
      durationSeconds: 600,
      polyline: [[21.00, 105.80], [21.01, 105.81], [21.02, 105.82]],
      steps: Array.from({ length: 12 }, (_, idx) => ({
        name: idx % 2 === 0 ? 'Ngõ 120 Trường Chinh' : 'Ngách 45 Thái Hà',
        distance: 250,
        instruction: 'turn right'
      }))
    };

    const smoothMajorRaw = {
      distanceKm: '3.4',
      distanceMeters: 3400,
      durationSeconds: 600,
      polyline: [[21.00, 105.80], [21.03, 105.84], [21.02, 105.82]],
      steps: [
        { name: 'Đại lộ Nguyễn Trãi', distance: 1700, instruction: 'depart ' },
        { name: 'Đường Lê Văn Lương', distance: 1700, instruction: 'continue ' }
      ]
    };

    const zigZagEval = router.evaluatePassableRoute(zigZagRouteRaw, [], [], [], specs);
    const smoothEval = router.evaluatePassableRoute(smoothMajorRaw, [], [], [], specs);

    assert.ok(smoothEval.ecoScore > zigZagEval.ecoScore, `Trục chính lớn (${smoothEval.ecoScore}) phải có ecoScore cao hơn lộ trình ngõ ngoằn ngoèo (${zigZagEval.ecoScore})`);

    // Tuyến đi vòng quá xa (35 phút vs nhanh nhất 12 phút > 1.35x) dù ecoScore = 99 cũng không được chọn cho Chế độ 2
    const fastRoute = { ...smoothEval, durationMin: 12, ecoScore: 84, majorRatio: 60, rpi: 94 };
    const midSmoothRoute = {
      ...smoothEval,
      distanceMeters: 4200,
      durationMin: 14,
      ecoScore: 95,
      majorRatio: 90,
      rpi: 92,
      polyline: [[21.00, 105.80], [21.04, 105.85], [21.02, 105.82]]
    };
    const absurdDetour = {
      ...smoothEval,
      distanceMeters: 9500,
      durationMin: 35,
      ecoScore: 99,
      majorRatio: 100,
      rpi: 94,
      polyline: [[21.00, 105.80], [21.08, 105.90], [21.02, 105.82]]
    };

    const res = router.buildThreePassableModes([fastRoute, midSmoothRoute, absurdDetour], 2, specs, []);
    const balancedCard = res.routes.find(r => r.mergedLevels.includes(2));
    assert.ok(balancedCard, 'Phải chọn được tuyến cho Chế độ 2');
    assert.strictEqual(balancedCard.durationMin, 14, 'Chế độ 2 phải chọn tuyến 14 phút hợp lý thay vì tuyến đi vòng 35 phút');
  });
});