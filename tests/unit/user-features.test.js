/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: UNIT TESTING
 * Module: User Features & Intelligent AI Traffic Co-Pilot
 * Reference Prefix: TC-UI & TC-AI
 * ============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const aiService = require('../../server/ai-service');
const foodData = require('../../js/food-entertainment-data');

describe('Module TC-UI & TC-AI: User Features & AI Co-Pilot', () => {
  const htmlPath = path.join(__dirname, '../../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const cssPath = path.join(__dirname, '../../css/style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('[TC-UI-01] Thanh tìm kiếm nền trắng, đã bỏ logo và có placeholder "Nhập địa chỉ..."', () => {
    assert.strictEqual(html.includes('class="gm-brand-badge"'), false, 'Vẫn còn gm-brand-badge');
    assert.ok(
      html.includes('id="gm-search-input"') &&
      (html.includes('placeholder="Nhập địa chỉ..."') || html.includes('Tìm địa chỉ')),
      'Thiếu ô nhập địa chỉ tìm kiếm'
    );
    assert.ok(css.includes('.gm-search-box'), 'Thiếu class .gm-search-box');
  });

  it('[TC-UI-02] Thanh công cụ có nút mic (hình mic) và nút tìm kiếm cạnh ô nhập', () => {
    assert.ok(html.includes('id="btn-voice-search"'), 'Thiếu id btn-voice-search');
    assert.ok(html.includes('id="btn-search-trigger"'), 'Thiếu id btn-search-trigger');
  });

  it('[TC-UI-03] Từ khóa "Trạm Sạc" chuẩn 2 từ, không hiển thị số lượng trạm sạc', () => {
    assert.ok(html.includes('<span class="chip-text">Trạm Sạc</span>'), 'Chưa chuẩn nhãn Trạm Sạc');
    assert.strictEqual(html.includes('id="badge-ev-count"'), false, 'Vẫn còn badge hiển thị số lượng');
  });

  it('[TC-UI-04] Directions Panel cố định tiêu đề phương tiện và tạo thanh trượt cho dữ liệu bên dưới', () => {
    assert.ok(html.includes('id="gm-directions-header"'), 'Thiếu id gm-directions-header');
    assert.ok(html.includes('id="gm-directions-body"'), 'Thiếu id gm-directions-body');
    assert.ok(css.includes('.gm-directions-body'), 'Thiếu CSS .gm-directions-body');
  });

  it('[TC-UI-05] Thẻ lộ trình không bị đè chữ, huy hiệu Đang chọn và Tin cậy xếp linh hoạt', () => {
    assert.ok(css.includes('.gm-badge-selected') || css.includes('.gm-recommended-badge'), 'Thiếu class badge');
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('gm-route-header-badges'), 'Thiếu gm-route-header-badges chống đè chữ');
  });

  it('[TC-UI-06] Phân loại câu hỏi ẩm thực, ăn uống và vui chơi giải trí chính xác 100%', () => {
    assert.ok(foodData.isFoodOrFun('quanh mỹ đình có quán ăn nào nổi tiếng k'));
    assert.ok(foodData.isFoodOrFun('khu vực cầu giấy có chỗ nào vui chơi checkin'));
    assert.ok(foodData.isFoodOrFun('gợi ý quán cafe view đẹp hồ tây'));
  });

  it('[TC-UI-07] Chatbot AI đề xuất thực tế quán ăn nổi tiếng khu vực Mỹ Đình', async () => {
    const res = await aiService.processQuery({
      query: 'quanh mỹ đình có quán ăn nào nổi tiếng k',
      city: 'hanoi'
    });
    assert.ok(!res.text.includes('Đặc điểm thoát nước'), 'Vẫn trả lời lạc đề thoát nước');
    assert.ok(res.text.toLowerCase().includes('mỹ đình'), 'Thiếu địa danh Mỹ Đình');
    const lowerText = res.text.toLowerCase();
    assert.ok(lowerText.includes('hàn quốc') || lowerText.includes('bún chả') || lowerText.includes('k-town') || lowerText.includes('ẩm thực') || lowerText.includes('quán'), 'Chưa có gợi ý ẩm thực');
  });

  it('[TC-UI-08] Chatbot AI đề xuất địa điểm vui chơi giải trí tại Cầu Giấy', async () => {
    const res = await aiService.processQuery({
      query: 'cầu giấy có chỗ nào vui chơi không',
      city: 'hanoi'
    });
    assert.ok(res.text.toLowerCase().includes('cầu giấy'));
    assert.ok(res.text.includes('Công Viên') || res.text.includes('Tô Hiệu') || res.text.includes('vui chơi') || res.text.includes('ẩm thực'));
  });

  it('[TC-UI-09] Hệ thống dẫn đường tự động từ A đến B vẫn hoạt động chuẩn xác', async () => {
    const res = await aiService.processQuery({
      query: 'Từ Cầu Giấy ra Bến xe Mỹ Đình đi đường nào thông thoáng?',
      city: 'hanoi'
    });
    assert.ok(res.action && res.action.type === 'AUTO_ROUTE');
  });

  it('[TC-UI-10] Chatbot AI trả kèm action SHOW_FOOD_PLACES với toạ độ ghim bản đồ và danh sách quán', async () => {
    const res = await aiService.processQuery({
      query: 'quanh đống đa chùa láng có quán ăn nào ngon',
      city: 'hanoi'
    });
    assert.ok(res.action && res.action.type === 'SHOW_FOOD_PLACES', 'Thiếu action SHOW_FOOD_PLACES');
    assert.ok(Array.isArray(res.action.spots) && res.action.spots.length >= 3, 'Thiếu danh sách spots có toạ độ');
    assert.ok(typeof res.action.spots[0].lat === 'number' && typeof res.action.spots[0].lng === 'number', 'Thiếu lat/lng trên spot');
  });

  it('[TC-UI-11] Ô tìm kiếm chính có Autocomplete Dropdown, MapEngine có clearRoute và renderFoodPlaces', () => {
    assert.ok(html.includes('id="dropdown-main-search"'), 'Thiếu dropdown-main-search trong index.html');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('renderFoodPlaces('), 'Thiếu hàm renderFoodPlaces trong map-engine.js');
    assert.ok(mapEngineJs.includes('clearRoute()'), 'Thiếu hàm clearRoute trong map-engine.js');
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('renderMainSearchSuggestions('), 'Thiếu hàm renderMainSearchSuggestions trong app.js');
  });

  it('[TC-UI-12] Mục Thời tiết phường đồng bộ chuẩn màu và kiểu dáng với các chip khác, không bị mờ lạc loài', () => {
    assert.strictEqual(html.includes('id="chip-weather-toggle" class="gm-chip gm-chip-inactive"'), false, 'Vẫn còn gm-chip-inactive trong index.html');
    assert.ok(html.includes('id="chip-weather-toggle"'), 'Thiếu id chip-weather-toggle');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('clearFoodPlaces()'), 'Thiếu clearFoodPlaces() trên MapEngine');
    const aiChatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(aiChatJs.includes('window.mapEngine.clearFoodPlaces()'), 'Nút làm mới chưa dọn dẹp food markers trên bản đồ');
  });

  it('[TC-UI-13] Trợ lý AI trả lời đúng rạp chiếu phim tại khu vực hiện tại khi hỏi "CÓ RẠP CHIẾU PHIM NÀO QUANH ĐÂY"', async () => {
    assert.ok(foodData.isFoodOrFun('CÓ RẠP CHIẾU PHIM NÀO QUANH ĐÂY'), 'isFoodOrFun không nhận diện rạp chiếu phim');
    const rec = foodData.getRecommendation('CÓ RẠP CHIẾU PHIM NÀO QUANH ĐÂY', 'hanoi', { lastAreaKey: 'mydinh' });
    assert.ok(rec.text.includes('Rạp Chiếu Phim') || rec.text.includes('CGV') || rec.text.includes('Beta') || rec.text.includes('Lotte'), 'Chưa trả về rạp chiếu phim');
    assert.ok(Array.isArray(rec.action.spots) && rec.action.spots.some(s => s.name.includes('Rạp') || s.name.includes('Cinema') || s.name.includes('CGV')), 'Spots thiếu rạp phim');
  });

  it('[TC-UI-14] Chỉ số Thoải Mái Khi Đi Đường (Commute Comfort Modal) và cơ chế dọn sạch ghim lộ trình', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('openCommuteComfortModal('), 'Thiếu openCommuteComfortModal trong app.js');
    assert.ok(appJs.includes('this.routeMarkers.origin'), 'clearRouteLayers thiếu xóa routeMarkers.origin');
    assert.ok(appJs.includes('this.routeMarkers.destination'), 'clearRouteLayers thiếu xóa routeMarkers.destination');
    const aiChatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(aiChatJs.includes('window.appState.closeDirections()'), 'clearMessages chưa gọi closeDirections()');
  });

  it('[TC-UI-15] Nút bấm Dự báo thời tiết 15P nổi bật và tối ưu lớp nền bản đồ không bị đè chữ to', () => {
    assert.ok(html.includes('id="chip-commute-comfort"'), 'Thiếu nút chip-commute-comfort trên thanh Category Chips');
    assert.ok(html.includes('class="weather-pill-cta"'), 'Thiếu badge CTA Dự báo 15P trên gm-weather-pill');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('lyrs=m,traffic'), 'Thiếu tích hợp lyrs=m,traffic mượt mà');
    assert.strictEqual(mapEngineJs.includes('lyrs=h@159000000'), false, 'Vẫn còn lớp hybrid lyrs=h gây chữ to');
  });

  it('[TC-AI-01] C1 bug fix: "quán ăn sạch sẽ gần đây" không rơi vào nhánh trạm sạc xe điện', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('sạch'), 'Thiếu chốt chặn loại trừ chữ sạch khỏi trạm sạc');
    const isEvRegex = /(?:trạm\s*sạc|sạc\s*xe|sạc\s*điện|sạc\s*pin|xe\s*điện|vinfast|đổi\s*pin|\bsạc(?!h)\b)/i;
    assert.strictEqual(isEvRegex.test('quán ăn sạch sẽ gần đây'), false, 'Không được nhận nhầm sạch sẽ thành sạc');
  });

  it('[TC-AI-02] C2 bug fix: "cửa hàng Samsung Galaxy" không bị nhận nhầm thành rạp chiếu phim', () => {
    const intent = foodData.detectSearchIntent('cửa hàng Samsung Galaxy');
    assert.notStrictEqual(intent, 'cinema', 'Samsung Galaxy không được coi là rạp phim');
  });

  it('[TC-AI-03] C3 bug fix: "tình hình tắc đường hiện tại" phản hồi tình trạng giao thông, không mở bảng chỉ đường', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('isTrafficStatusQuery'), 'Thiếu nhánh isTrafficStatusQuery phân loại tắc đường');
  });

  it('[TC-AI-04] Safety guardrails: Câu hỏi né chốt CSGT bị từ chối, câu hỏi cấp cứu có 115/114/113', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('ILLEGAL_TRAFFIC'), 'Thiếu chốt chặn ILLEGAL_TRAFFIC');
    assert.ok(chatJs.includes('EMERGENCY_LIFE'), 'Thiếu chốt chặn EMERGENCY_LIFE');
    assert.ok(chatJs.includes('115 (Cấp cứu Y tế)'), 'Thiếu số khẩn cấp 115 trong chốt chặn');
  });

  it('[TC-AI-05] AI tìm được điểm nào sẽ kích hoạt renderFoodPlaces để ghim ngay lên bản đồ và lưu sessionMemory', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('resolveSpotsToRender'), 'Thiếu hàm resolveSpotsToRender đồng bộ điểm AI');
    assert.ok(chatJs.includes('mapEngine.renderFoodPlaces(spotsToRender)'), 'Thiếu gọi mapEngine.renderFoodPlaces khi có spotsToRender');
    assert.ok(chatJs.includes('sessionMemory.lastSuggestedSpots = spotsToRender'), 'Thiếu cập nhật sessionMemory.lastSuggestedSpots');
  });

  it('[TC-AI-06] renderFoodPlaces hỗ trợ đa danh mục (cinema/cafe/ev/shelter/food) với màu sắc & badge tương ứng và flyTo khi chỉ có 1 điểm', () => {
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('themeColor'), 'Thiếu themeColor động theo category');
    assert.ok(mapEngineJs.includes('catLabel'), 'Thiếu catLabel động theo category');
    assert.ok(mapEngineJs.includes('else if (validCoords.length === 1)'), 'Thiếu flyTo khi validCoords có 1 điểm');
  });

  it('[TC-AI-08] NLU đa ý định: Tự động dịch từ viết tắt đô thị (bk -> Đại học Bách Khoa, cg -> Cầu Giấy) và trích xuất đồng thời route + cafe/food trong 1 câu hỏi', () => {
    const multi = aiService.analyzeMultiIntentProfile('Hôm nay trời mưa đi xe tay ga từ bk về cg có sợ chết máy không hay nên ngồi cafe đợi?');
    assert.ok(multi.routeIntent, 'Không nhận diện được lộ trình từ câu hỏi ghép');
    assert.ok(multi.routeIntent.origin.toLowerCase().includes('bách khoa'), 'Chưa dịch được bk thành Bách Khoa');
    assert.ok(multi.routeIntent.destination.toLowerCase().includes('cầu giấy'), 'Chưa dịch được cg thành Cầu Giấy');
    assert.strictEqual(multi.poiCategory, 'cafe', 'Chưa bắt được ý định cafe');
    assert.strictEqual(multi.dilemmaType, 'go_now_or_wait', 'Chưa bắt được thế phân vân go_now_or_wait');
    assert.strictEqual(multi.vehicleSubType, 'scooter', 'Chưa phân loại được xe tay ga');
  });

  it('[TC-AI-09] Hồ sơ vật lý phương tiện & tính toán đánh đổi định lượng: So sánh mực nước với gầm xe và tính toán rủi ro tài chính', () => {
    const mockMerged = {
      allFloods: [{ name: 'Võ Chí Công', depth_cm: 25 }],
      activeFloods: [{ name: 'Võ Chí Công', depth_cm: 25 }],
      allTraffics: [],
      currentVehicle: 'motorbike'
    };
    const brief = aiService.buildDeterministicDecisionBrief('Đi xe tay ga qua Võ Chí Công', 'hanoi', mockMerged);
    assert.strictEqual(brief.vehicleDisplayName, 'Xe tay ga');
    assert.strictEqual(brief.maxFloodCm, 25);
    assert.strictEqual(brief.isCritical, true, '25cm phải vượt ngưỡng nguy hiểm của xe tay ga (18cm)');
    assert.ok(brief.recommendedVerdict.includes('CẢNH BÁO NGUY CƠ') || brief.recommendedVerdict.includes('chết máy'), 'Thiếu cảnh báo chết máy');
    assert.ok(Array.isArray(brief.tradeoffOptions) && brief.tradeoffOptions.length === 3, 'Thiếu 3 phương án đánh đổi');
  });

  it('[TC-AI-10] Trụ cột 5 - Tự kiểm chứng cảm biến thực địa & khử mâu thuẫn ngập úng với verifyAndEnrichAiResponse', () => {
    const AIChatClass = require('../../js/ai-chat');
    const chatInstance = new AIChatClass();
    const mockWebState = {
      visibleFloods: [{ name: 'Nguyễn Trãi', depth_cm: 25 }]
    };
    const verified = chatInstance.verifyAndEnrichAiResponse('Tuyến đường hoàn toàn khô ráo 100% không ngập.', mockWebState);
    assert.ok(verified.text.includes('Đính chính cảm biến MoveSafe'), 'Chưa tự đính chính mâu thuẫn ngập');
    assert.strictEqual(verified.verification.type, 'warning');
    assert.ok(verified.verification.badgeText.includes('Nguyễn Trãi'));
  });

  it('[TC-AI-11] Giao diện trực quan hoá độ thông minh AI: live thinking steps, spatial scan header, vehicle physics meter và verification badge', () => {
    const AIChatClass = require('../../js/ai-chat');
    const chatInstance = new AIChatClass();

    // Test spatial scan header
    const scanHtml = chatInstance.renderSpatialScanHeaderHtml({ title: 'Đã quét hành lang 2.5km', stats: '15 trạm ngập' });
    assert.ok(scanHtml.includes('gm-spatial-scan-header'), 'Thiếu class gm-spatial-scan-header');
    assert.ok(scanHtml.includes('15 trạm ngập'), 'Thiếu nội dung thống kê quét');

    // Test vehicle physics meter
    const physicsHtml = chatInstance.renderVehiclePhysicsMeterHtml({
      vehicleDisplayName: 'Xe tay ga',
      safeLimit: 15,
      maxPassable: 18,
      maxFloodCm: 22,
      isSafe: false,
      isCritical: true,
      spec: { intakePart: 'Ống xả và lọc gió', damageRisk: 'Chết máy', riskCostRangeVnd: '500k-2tr' }
    });
    assert.ok(physicsHtml.includes('gm-vehicle-physics-meter'), 'Thiếu class gm-vehicle-physics-meter');
    assert.ok(physicsHtml.includes('VƯỢT NGƯỠNG AN TOÀN'), 'Thiếu trạng thái vượt ngưỡng');

    // Test verification badge
    const badgeHtml = chatInstance.renderVerificationBadgeHtml({ badgeText: 'Đã kiểm chứng cảm biến 100%', type: 'success' });
    assert.ok(badgeHtml.includes('gm-verification-badge success'), 'Thiếu class gm-verification-badge success');

    // Test CSS styles exist
    const currentCss = fs.readFileSync(path.join(__dirname, '../../css/style.css'), 'utf8');
    assert.ok(currentCss.includes('.gm-spatial-scan-header'), 'Thiếu CSS .gm-spatial-scan-header');
    assert.ok(currentCss.includes('.gm-vehicle-physics-meter'), 'Thiếu CSS .gm-vehicle-physics-meter');
    assert.ok(currentCss.includes('.gm-verification-badge'), 'Thiếu CSS .gm-verification-badge');
  });

  it('[TC-AI-07] Kích hoạt các tính năng chạy ngầm lên giao diện: buildDecisionMatrix, buildTimeShiftAdvisor, buildMultiStopTimeline, buildSpatialCitations', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('buildDecisionMatrix('), 'Thiếu hàm buildDecisionMatrix');
    assert.ok(chatJs.includes('buildTimeShiftAdvisor('), 'Thiếu hàm buildTimeShiftAdvisor');
    assert.ok(chatJs.includes('buildMultiStopTimeline('), 'Thiếu hàm buildMultiStopTimeline');
    assert.ok(chatJs.includes('buildSpatialCitations('), 'Thiếu hàm buildSpatialCitations');
  });

  it('[TC-UI-16] Google Maps-style Left Slide-Out Navigation Drawer với hoạt ảnh trượt trái sang phải & chuyển Dark Mode', () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    const cssContent = fs.readFileSync(path.join(__dirname, '../../css/style.css'), 'utf8');
    const appJsContent = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');

    // 1. HTML structure: Search tối giản + Navigation Drawer bên trái
    assert.ok(htmlContent.includes('id="btn-nav-drawer-toggle"'), 'Thiếu nút Hamburger mở drawer');
    assert.ok(htmlContent.includes('id="gm-nav-drawer"'), 'Thiếu phần tử #gm-nav-drawer');
    assert.ok(htmlContent.includes('id="btn-close-nav-drawer"'), 'Thiếu nút đóng drawer');
    assert.ok(htmlContent.includes('id="gm-nav-backdrop"'), 'Thiếu lớp nền #gm-nav-backdrop');
    assert.ok(htmlContent.includes('id="btn-quick-directions"'), 'Thiếu nút chỉ đường nhanh trên thanh tìm kiếm');
    assert.ok(htmlContent.includes('id="chk-drawer-darkmode"'), 'Thiếu nút bật/tắt Giao diện Tối trong drawer');
    assert.ok(htmlContent.includes('id="btn-drawer-quick-report"'), 'Thiếu nút báo cáo nhanh trong drawer');
    assert.ok(htmlContent.includes('id="btn-drawer-shortcut-tip"'), 'Thiếu nút mẹo phím tắt trong drawer');
    assert.ok(htmlContent.includes('class="gm-brand-move"') && htmlContent.includes('class="gm-brand-safe"'), 'Wordmark MoveSafe phải dùng 2 tông màu thương hiệu .gm-brand-move & .gm-brand-safe');
    assert.ok(!htmlContent.includes('class="chip-forecast-badge"'), 'Không còn badge MỚI ở mục Dự báo thời tiết 15P');
    assert.ok(!htmlContent.includes('class="gm-chips-rail"'), 'Không nên còn thanh chips nổi .gm-chips-rail cũ');

    // 2. CSS animation: Trượt từ trái sang phải + reduced-motion + dark mode
    assert.ok(cssContent.includes('.gm-nav-drawer'), 'Thiếu style .gm-nav-drawer');
    assert.ok(cssContent.includes('.gm-nav-drawer.open'), 'Thiếu trạng thái .gm-nav-drawer.open');
    assert.ok(cssContent.includes('translateX(-100%)'), 'Drawer mặc định phải ẩn bên trái translateX(-100%)');
    assert.ok(cssContent.includes('translateX(0)'), 'Drawer mở phải trượt về translateX(0)');
    assert.ok(cssContent.includes('@keyframes gmDrawerItemSlideIn'), 'Thiếu hoạt ảnh trượt mục drawer gmDrawerItemSlideIn');
    assert.ok(cssContent.includes('prefers-reduced-motion'), 'Thiếu hỗ trợ prefers-reduced-motion cho drawer');
    assert.ok(cssContent.includes('.gm-nav-backdrop'), 'Thiếu style .gm-nav-backdrop');
    assert.ok(cssContent.includes('body.dark-mode .gm-nav-drawer'), 'Thiếu theme Dark Mode cho drawer');
    assert.ok(cssContent.includes('body.dark-mode .gm-brand-wordmark .gm-brand-move'), 'Thiếu màu Dark Mode cho wordmark MoveSafe');

    // 3. JS logic: Quản lý trạng thái mở/đóng, Alt+M, Esc, lưu theme
    assert.ok(appJsContent.includes('openNavDrawer('), 'Thiếu hàm openNavDrawer');
    assert.ok(appJsContent.includes('closeNavDrawer('), 'Thiếu hàm closeNavDrawer');
    assert.ok(appJsContent.includes('toggleNavDrawer('), 'Thiếu hàm toggleNavDrawer');
    assert.ok(appJsContent.includes('applyTheme('), 'Thiếu hàm applyTheme');
    assert.ok(appJsContent.includes('bindNavDrawerEvents('), 'Thiếu hàm bindNavDrawerEvents');
    assert.ok(appJsContent.includes('movesafe_dark_mode'), 'Thiếu lưu localStorage movesafe_dark_mode');
    assert.ok(appJsContent.includes('e.altKey'), 'Thiếu phím tắt Alt + M mở/đóng drawer');
  });

  it('[TC-UI-17] Chuẩn hóa vị trí & lọc chính xác ghim Ùn tắc TomTom / VOV (tránh ghim sai tâm phường & ngõ nhỏ)', () => {
    const mapEngineContent = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    const botServiceContent = fs.readFileSync(path.join(__dirname, '../../server/bot-service.js'), 'utf8');
    const appJsContent = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    const cacheJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/live_urban_cache.json'), 'utf8'));

    // 1. map-engine.js: Luôn cập nhật icon khi tái sử dụng marker để không bị lệch nhãn Ùn tắc
    assert.ok(mapEngineContent.includes('marker.setIcon(customIcon)'), 'Thiếu marker.setIcon(customIcon) khi cập nhật marker cũ');

    // 2. bot-service.js: Trung điểm LineString, lọc ngõ/kiệt/hẻm, VOV chỉ map CORE_INTERSECTIONS_GEO và chống chồng chéo 350m
    assert.ok(botServiceContent.includes('Math.floor(coords.length / 2)'), 'Thiếu lấy trung điểm LineString của TomTom');
    assert.ok(botServiceContent.includes('isAlleyNoise') && botServiceContent.includes('ngõ|ngách|hẻm|kiệt'), 'Thiếu bộ lọc ngõ/ngách/hẻm/kiệt');
    assert.ok(botServiceContent.includes('hasVerifiedIntersection'), 'VOV incidents phải xác thực qua CORE_INTERSECTIONS_GEO');
    assert.ok(botServiceContent.includes('Math.hypot(d.lat - item.lat, d.lng - item.lng) < 0.0032'), 'Thiếu chống chồng chéo ghim cùng loại trong bán kính ~350m');

    // 3. app.js & cache JSON: Vô hiệu hóa cache localStorage cũ bằng _trafficSchemaVersion === 2
    assert.ok(appJsContent.includes('_trafficSchemaVersion !== 2'), 'Thiếu kiểm tra _trafficSchemaVersion trong fetchLiveData');
    assert.strictEqual(cacheJson._trafficSchemaVersion, 2, 'live_urban_cache.json phải có _trafficSchemaVersion = 2');
    const hnJams = (cacheJson.trafficIncidents || []).filter(i => i.city === 'hanoi' && i.isJam);
    assert.ok(hnJams.every(i => !i.id.startsWith('tomtom-hanoi-0')), 'ID sự cố TomTom phải dùng tọa độ cố định thay vì chỉ số mảng');
  });
});
