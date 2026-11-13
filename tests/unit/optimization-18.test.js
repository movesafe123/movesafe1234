/**
 * Test Suite: Toàn Diện 18 Hạng Mục Tối Ưu (OPT-01 -> OPT-18)
 * MoveSafe VN - AI Brain & System Architecture Verification
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const aiService = require('../../server/ai-service');
const botService = require('../../server/bot-service');
const RoutingService = require('../../js/routing-service');

describe('Full-Repo Verification: 18 Optimization Items (OPT-01 -> OPT-18)', () => {

  // --- NHÓM 1: AI BRAIN & ĐỒNG BỘ NGỮ CẢNH ---
  it('[OPT-01] Khoanh vùng ngập theo khu vực câu hỏi (Spatial Scope) thay vì lấy max toàn thành phố', () => {
    const mergedData = {
      allFloods: [
        { name: 'Ngã tư Phan Bội Châu - Lý Thường Kiệt', depth_cm: 0, danger_level: 'safe', lat: 21.026, lng: 105.845 },
        { name: 'Võ Chí Công (Tây Hồ)', depth_cm: 35, danger_level: 'critical', lat: 21.065, lng: 105.801 }
      ],
      activeFloods: [
        { name: 'Võ Chí Công (Tây Hồ)', depth_cm: 35, danger_level: 'critical', lat: 21.065, lng: 105.801 }
      ],
      currentVehicle: 'motorbike'
    };
    // Câu hỏi cụ thể về Hoàn Kiếm / Phan Bội Châu (xa Tây Hồ > 5km)
    const brief = aiService.buildDeterministicDecisionBrief('Từ Bờ Hồ ra Phan Bội Châu có ngập không', 'hanoi', mergedData);
    assert.strictEqual(brief.maxFloodCm, 0, 'Lộ trình Phan Bội Châu không đi qua Tây Hồ nên maxFloodCm phải là 0cm');
    assert.ok(brief.isSafe, 'Lộ trình Phan Bội Châu phải được đánh giá an toàn');

    // Câu hỏi toàn thành phố vẫn bắt trọn điểm ngập sâu nhất
    const cityBrief = aiService.buildDeterministicDecisionBrief('Tình hình ngập toàn thành phố Hà Nội thế nào', 'hanoi', mergedData);
    assert.strictEqual(cityBrief.maxFloodCm, 35, 'Câu hỏi toàn thành phố phải lấy đúng 35cm');
  });

  it('[OPT-02] Server AI đọc chuẩn 100% khi bật Chế độ Giả Lập hoặc Dự báo Tương Lai', () => {
    const webState = {
      isSimulationMode: true,
      predictionOffsetHours: 2,
      visibleFloods: [
        { name: 'Giả lập Ngã Tư Sở', depth_cm: 28, danger_level: 'critical', lat: 21.002, lng: 105.821 }
      ]
    };
    const merged = aiService.mergeLiveAndWebData('hanoi', { webState });
    assert.strictEqual(merged.isSimulationMode, true);
    assert.strictEqual(merged.predictionOffsetHours, 2);
    assert.strictEqual(merged.activeFloods.length, 1);
    assert.strictEqual(merged.activeFloods[0].name, 'Giả lập Ngã Tư Sở');
  });

  it('[OPT-03] Bung từ viết tắt trước khi bóc tách lộ trình & đánh dấu cờ chống vẽ đúp', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('this.expandUrbanAbbreviations(userQuery.trim())'), 'Phải mở rộng viết tắt ngay đầu hàm resolveCoreferenceAndExecutePreActions');
    assert.ok(chatJs.includes('this._preActionRouteExecuted = true'), 'Phải đánh dấu cờ _preActionRouteExecuted');
    assert.ok(chatJs.includes('if (this._preActionRouteExecuted) return;'), 'Phải chặn vẽ lộ trình đúp trong handleMapActionsPipeline');
  });

  it('[OPT-04] Nhánh Fallback AI tại Client tuân thủ cấu trúc 3-Nhịp Co-Pilot', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('[Nhịp 1 - Phán quyết]'), 'Prompt Client Fallback phải có Nhịp 1');
    assert.ok(chatJs.includes('[Nhịp 2 - Phương án & Con số thực địa]'), 'Prompt Client Fallback phải có Nhịp 2');
    assert.ok(chatJs.includes('[Nhịp 3 - Đồng hành chủ động]'), 'Prompt Client Fallback phải có Nhịp 3');
  });

  it('[OPT-05] Đồng bộ chuẩn hóa Sổ tay Nhà/Công ty cả 2 chiều giữa app.js và ai-chat.js', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(appJs.includes('movesafe_commute_presets_v1') && appJs.includes('movesafe_commute_presets'), 'app.js phải ghi cả 2 key');
    assert.ok(chatJs.includes('movesafe_commute_presets_v1') && chatJs.includes('movesafe_commute_presets'), 'ai-chat.js phải đọc cả 2 key');
  });

  // --- NHÓM 2: DẪN ĐƯỜNG, HÌNH HỌC & VẬT LÝ XE ---
  it('[OPT-06] Phép tính Điểm-tới-Đoạn-thẳng (Point-to-Segment) bắt chính xác rốn ngập nằm giữa 2 đỉnh OSRM xa nhau', () => {
    const router = new RoutingService();
    // Đoạn đường thẳng từ (21.000, 105.800) đến (21.000, 105.810) (dài ~1km)
    // Điểm ngập nằm tại (21.000, 105.805) ngay tim đường, nhưng 2 đầu mút cách đó 500m
    const polyline = [[21.000, 105.800], [21.000, 105.810]];
    const blockedFloods = [{ id: 'flood-mid', name: 'Ngập tim đường', lat: 21.000, lng: 105.805, radius: 100 }];
    const res = router.checkRoutePassability(polyline, blockedFloods, [], 110);
    assert.strictEqual(res.isPassable, false, 'Đoạn đường thẳng cắt qua điểm ngập phải bị phát hiện là không thể đi qua');
    assert.strictEqual(res.blockedBy.length, 1);
  });

  it('[OPT-07] Cơ chế 2-Pha (Two-Phase Detour) chia nhỏ lô request OSRM tránh lỗi Rate-Limit 429', () => {
    const routeJs = fs.readFileSync(path.join(__dirname, '../../js/routing-service.js'), 'utf8');
    assert.ok(routeJs.includes('tier1Waypoints = detourWaypoints.slice(0, 4)'), 'Pha 1 chỉ thử tối đa 4 waypoint');
    assert.ok(routeJs.includes('tier2Waypoints = detourWaypoints.slice(4, 8)'), 'Pha 2 chỉ thử tiếp nếu chưa đủ tuyến sạch');
  });

  it('[OPT-08] Hỗ trợ đầy đủ thông số vật lý chi tiết scooter, sedan, suv trong routing-service', () => {
    const router = new RoutingService();
    assert.ok(router.vehicleSpecs.scooter && router.vehicleSpecs.scooter.maxPassableDepth === 18, 'Xe tay ga có ngưỡng ngập 18cm');
    assert.ok(router.vehicleSpecs.sedan && router.vehicleSpecs.sedan.maxPassableDepth === 22, 'Sedan có ngưỡng ngập 22cm');
    assert.ok(router.vehicleSpecs.suv && router.vehicleSpecs.suv.maxPassableDepth === 35, 'SUV có ngưỡng ngập 35cm');

    // Kiểm tra cấm xe 2 bánh trên cao tốc
    const expressRoute = { steps: [{ name: 'Vành đai 3 trên cao' }] };
    const scooterCheck = router.checkVehicleRoadRestrictions(expressRoute, 'scooter');
    assert.strictEqual(scooterCheck.allowed, false, 'Xe tay ga không được lên cao tốc');
    const suvCheck = router.checkVehicleRoadRestrictions(expressRoute, 'suv');
    assert.strictEqual(suvCheck.allowed, true, 'SUV được lên cao tốc');
  });

  // --- NHÓM 3: DẪN ĐƯỜNG GIỌNG NÓI & CHIA SẺ URL ---
  it('[OPT-09] Voice Navigation chuẩn hóa thứ tự tham số toggleSpeakText & dùng đúng trường durationMin/rpi', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(appJs.includes('window.aiChat.toggleSpeakText(targetBtn, voiceScript)'), 'startVoiceNavigation truyền đúng (btn, text)');
    assert.ok(appJs.includes('bestRoute.rpi ?? bestRoute.safetyScore'), 'Phải đọc đúng trường rpi');
    assert.ok(appJs.includes('route.polyline || route.geometry'), 'Phải đọc đúng trường polyline');
    assert.ok(chatJs.includes('if (typeof btn === \'string\' &&'), 'toggleSpeakText phải tự động đảo tham số nếu truyền ngược');
  });

  it('[OPT-10] Chia sẻ lộ trình dùng rpi và đồng bộ selector .gm-mode-tab', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('route.rpi ?? route.safetyScore'), 'shareSafeRoute phải đọc đúng điểm an toàn');
    assert.ok(appJs.includes('.gm-mode-tab, .gm-veh-btn'), 'checkSharedRouteFromUrl phải toggle đúng tab phương tiện');
  });

  // --- NHÓM 4: DỰ BÁO SPATIO-TEMPORAL & CỘNG ĐỒNG ---
  it('[OPT-11] API /api/predictions trả về đầy đủ floodPoints và trafficIncidents chuẩn schema', () => {
    const hoursToPeak = (8 - new Date().getHours() + 24) % 24 || 24;
    const preds = botService.getFuturePredictions('hanoi', hoursToPeak);
    assert.strictEqual(preds.status, 'success');
    assert.ok(Array.isArray(preds.floodPoints), 'Phải có trường floodPoints');
    assert.ok(Array.isArray(preds.trafficIncidents), 'Phải có trường trafficIncidents');
    if (preds.trafficIncidents.length > 0) {
      assert.ok(preds.trafficIncidents.every(t => typeof t.isJam === 'boolean'), 'Mọi sự cố dự báo phải có trường boolean isJam');
      const jam = preds.trafficIncidents.find(t => t.type === 'traffic_jam');
      assert.ok(jam && jam.isJam === true, 'Sự cố tắc đường dự báo vào khung giờ cao điểm phải có isJam = true');
    }
  });

  it('[OPT-12] Bình chọn cộng đồng trả về action removed/updated và xóa ghim tức thì', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, '../../server/server.js'), 'utf8');
    const crowdJs = fs.readFileSync(path.join(__dirname, '../../js/crowdsource.js'), 'utf8');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(serverJs.includes('action: result.removed ? \'removed\' : \'updated\''), 'Server phải trả về cờ action');
    assert.ok(crowdJs.includes('String(p.id) !== String(reportId)'), 'Crowdsource phải xóa ghim khỏi liveData');
    assert.ok(mapEngineJs.includes('crowd-') && mapEngineJs.includes('local-'), 'MapEngine phải nhận diện ID cộng đồng crowd- và local-');
  });

  // --- NHÓM 5: GEOCODING, MAP ENGINE & CLOUD PARITY ---
  it('[OPT-13] server/server.js có khai báo const axios = require(\'axios\')', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, '../../server/server.js'), 'utf8');
    assert.ok(serverJs.includes('const axios = require(\'axios\');'), 'server.js phải import axios');
  });

  it('[OPT-14] Geocoding ưu tiên 0ms local index và đồng bộ window.MOVE_SAFE_EV_STATIONS', () => {
    const geoJs = fs.readFileSync(path.join(__dirname, '../../js/geocoding-service.js'), 'utf8');
    assert.ok(geoJs.includes('MOVE_SAFE_EV_STATIONS'), 'Phải đọc mảng MOVE_SAFE_EV_STATIONS');
    assert.ok(geoJs.includes('maxPowerKw'), 'Phải đọc trường maxPowerKw');
    // searchLocalIndex nằm trước tầng Google Stream Search
    const localIdx = geoJs.indexOf('this.searchLocalIndex(normalizedQ, cityKey)');
    const googleIdx = geoJs.indexOf('google-search?q=');
    assert.ok(localIdx !== -1 && googleIdx !== -1 && localIdx < googleIdx, 'searchLocalIndex phải được gọi trước google-search');
  });

  it('[OPT-15] renderFoodPlaces tôn trọng khung nhìn lộ trình khi có preserveViewport', () => {
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('options = {}') || mapEngineJs.includes('options.preserveViewport'), 'renderFoodPlaces phải nhận options');
    assert.ok(mapEngineJs.includes('shouldPreserve'), 'renderFoodPlaces không được cướp camera khi đang xem lộ trình');
  });

  it('[OPT-16] MapEngine lắng nghe moveend ở zoom >= 15 để nạp trạm thời tiết khi pan', () => {
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('this.map.on(\'moveend\','), 'Phải có sự kiện moveend');
    assert.ok(mapEngineJs.includes('getZoom() >= 15'), 'Chỉ trigger cập nhật trạm thời tiết khi zoom sâu vào phố');
  });

  it('[OPT-17] app.init() gắn sự kiện bindEvents ngay tức thì (0ms TTI) và fetch dữ liệu song song', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    const bindPos = appJs.indexOf('this.bindEvents();');
    const fetchLivePos = appJs.indexOf('this.fetchLiveData()');
    assert.ok(bindPos !== -1 && fetchLivePos !== -1 && bindPos < fetchLivePos, 'bindEvents() phải được gắn trước khi nạp liveData');
    assert.ok(appJs.includes('Promise.allSettled'), 'Phải nạp dữ liệu song song bằng Promise.allSettled');
  });

  it('[OPT-18] Các lệnh fetch đều được bọc bởi window.getApiUrl để tương thích 100% với GitHub Pages', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    const supJs = fs.readFileSync(path.join(__dirname, '../../js/supabase-service.js'), 'utf8');
    assert.ok(appJs.includes('window.getApiUrl(\'/api/config\')'), 'fetchServerConfig dùng getApiUrl');
    assert.ok(appJs.includes('window.getApiUrl(\'/api/bot/refresh\')'), 'bot/refresh dùng getApiUrl');
    assert.ok(supJs.includes('window.getApiUrl(`/api/ev-stations'), 'ev-stations dùng getApiUrl');
    assert.ok(supJs.includes('window.getApiUrl(`/api/history'), 'history dùng getApiUrl');
  });

  it('[OPT-19] [BUG-01] GeocodingService.searchAddresses chạy thực tế không dính ReferenceError và trả về mảng đúng định dạng từ cache', async () => {
    global.window = global.window || {};
    global.window.MOVE_SAFE_EV_STATIONS = require('../../js/ev-stations-data');
    delete require.cache[require.resolve('../../js/geocoding-service')];
    require('../../js/geocoding-service');
    const geo = global.window.geocodingService;
    const res1 = await geo.searchAddresses('Bách Khoa', { city: 'hanoi', limit: 2 });
    assert.ok(Array.isArray(res1) && res1.length >= 1, 'Lần gọi 1 phải trả về kết quả từ Local Index');
    const res2 = await geo.searchAddresses('Bách Khoa', { city: 'hanoi', limit: 1 });
    assert.ok(Array.isArray(res2) && res2.length === 1, 'Lần gọi 2 (từ cache) phải slice được mảng mà không lỗi TypeError');
  });

  it('[OPT-20] [BUG-02] Server chấp nhận payload lớn (>25KB) và collectLiveWebSnapshot rút gọn dữ liệu trạm thời tiết', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, '../../server/server.js'), 'utf8');
    const aiChatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(serverJs.includes("limit: '512kb'"), 'Express json limit phải >= 512kb');
    assert.ok(aiChatJs.includes('const weatherStations = (app.latestWeatherStations || []).map'), 'collectLiveWebSnapshot phải rút gọn mảng weatherStations');
  });

  it('[OPT-21] [BUG-03] RoutingService có doesRouteviolateAvoidRoads và checkRoutePassability phát hiện ngập giữa đoạn đường dài >2km', () => {
    global.window = global.window || {};
    delete require.cache[require.resolve('../../js/routing-service')];
    require('../../js/routing-service');
    const rs = global.window.routingService;
    assert.strictEqual(typeof rs.doesRouteviolateAvoidRoads, 'function', 'Phải có hàm doesRouteviolateAvoidRoads');
    const check = rs.checkRoutePassability(
      [[21.0000, 105.8000], [21.0200, 105.8000]],
      [{ id: 'f-mid', name: 'Ngập giữa đoạn dài', lat: 21.0100, lng: 105.8002, depth_cm: 45, radius: 120 }],
      [],
      130
    );
    assert.strictEqual(check.isPassable, false, 'Đoạn đường dài 2.2km đi xuyên điểm ngập ở trung điểm phải bị đánh dấu không an toàn');
  });

  it('[OPT-22] [BUG-04 & BUG-08] Đồng bộ 100% js/ sang public/js/, 153 trạm sạc EV trên server, và không lỗi [object Object] khi đọc giọng nói', () => {
    const jsFiles = fs.readdirSync(path.join(__dirname, '../../js')).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const rootContent = fs.readFileSync(path.join(__dirname, '../../js', file), 'utf8');
      const pubContent = fs.readFileSync(path.join(__dirname, '../../public/js', file), 'utf8');
      assert.strictEqual(rootContent, pubContent, `File public/js/${file} phải đồng bộ 100% với js/${file}`);
    }
    const serverEv = require('../../server/ev-stations-data');
    assert.ok(serverEv.length >= 220, `Server phải có ít nhất 220 trạm sạc xe điện (thực tế: ${serverEv.length})`);
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(!appJs.includes('${this.translateStepInstruction(s)}'), 'Không được nội suy trực tiếp object translateStepInstruction vào chuỗi');
  });
});

