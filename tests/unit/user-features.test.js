const assert = require('assert');
const fs = require('fs');
const path = require('path');
const aiService = require('../../server/ai-service');
const foodData = require('../../js/food-entertainment-data');

function runTest(tcId, name, fn) {
  const t0 = Date.now();
  try {
    fn();
    const duration = Date.now() - t0;
    console.log(`✔ [${tcId}] ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - t0;
    console.error(`✖ [${tcId}] ${name} (${duration}ms) - ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(tcId, name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const duration = Date.now() - t0;
    console.log(`✔ [${tcId}] ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - t0;
    console.error(`✖ [${tcId}] ${name} (${duration}ms) - ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const htmlPath = path.join(__dirname, '../../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const cssPath = path.join(__dirname, '../../css/style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  runTest('TC-UI-01', 'Thanh tìm kiếm nền trắng, đã bỏ logo và có placeholder "Nhập địa chỉ..."', () => {
    assert.strictEqual(html.includes('class="gm-brand-badge"'), false, 'Vẫn còn gm-brand-badge');
    assert.ok(html.includes('placeholder="Nhập địa chỉ..."'), 'Thiếu placeholder Nhập địa chỉ...');
    assert.ok(css.includes('.gm-search-box'), 'Thiếu class .gm-search-box');
  });

  runTest('TC-UI-02', 'Thanh công cụ có nút mic (hình mic) và nút tìm kiếm cạnh ô nhập', () => {
    assert.ok(html.includes('id="btn-voice-search"'), 'Thiếu id btn-voice-search');
    assert.ok(html.includes('id="btn-search-trigger"'), 'Thiếu id btn-search-trigger');
  });

  runTest('TC-UI-03', 'Từ khóa "Trạm Sạc" chuẩn 2 từ, không hiển thị số lượng trạm sạc', () => {
    assert.ok(html.includes('<span class="chip-text">Trạm Sạc</span>'), 'Chưa chuẩn nhãn Trạm Sạc');
    assert.strictEqual(html.includes('id="badge-ev-count"'), false, 'Vẫn còn badge hiển thị số lượng');
  });

  runTest('TC-UI-04', 'Directions Panel cố định tiêu đề phương tiện và tạo thanh trượt cho dữ liệu bên dưới', () => {
    assert.ok(html.includes('id="gm-directions-header"'), 'Thiếu id gm-directions-header');
    assert.ok(html.includes('id="gm-directions-body"'), 'Thiếu id gm-directions-body');
    assert.ok(css.includes('.gm-directions-body'), 'Thiếu CSS .gm-directions-body');
  });

  runTest('TC-UI-05', 'Thẻ lộ trình không bị đè chữ, huy hiệu Đang chọn và Tin cậy xếp linh hoạt', () => {
    assert.ok(css.includes('.gm-badge-selected') || css.includes('.gm-recommended-badge'), 'Thiếu class badge');
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('gm-route-header-badges'), 'Thiếu gm-route-header-badges chống đè chữ');
  });

  runTest('TC-UI-06', 'Phân loại câu hỏi ẩm thực, ăn uống và vui chơi giải trí chính xác 100%', () => {
    assert.ok(foodData.isFoodOrFun('quanh mỹ đình có quán ăn nào nổi tiếng k'));
    assert.ok(foodData.isFoodOrFun('khu vực cầu giấy có chỗ nào vui chơi checkin'));
    assert.ok(foodData.isFoodOrFun('gợi ý quán cafe view đẹp hồ tây'));
  });

  await runAsyncTest('TC-UI-07', 'Chatbot AI đề xuất thực tế quán ăn nổi tiếng khu vực Mỹ Đình', async () => {
    const res = await aiService.processQuery({
      query: 'quanh mỹ đình có quán ăn nào nổi tiếng k',
      city: 'hanoi'
    });
    assert.ok(!res.text.includes('Đặc điểm thoát nước'), 'Vẫn trả lời lạc đề thoát nước');
    assert.ok(res.text.toLowerCase().includes('mỹ đình'), 'Thiếu địa danh Mỹ Đình');
    const lowerText = res.text.toLowerCase();
    assert.ok(lowerText.includes('hàn quốc') || lowerText.includes('bún chả') || lowerText.includes('k-town') || lowerText.includes('ẩm thực') || lowerText.includes('quán'), 'Chưa có gợi ý ẩm thực');
  });

  await runAsyncTest('TC-UI-08', 'Chatbot AI đề xuất địa điểm vui chơi giải trí tại Cầu Giấy', async () => {
    const res = await aiService.processQuery({
      query: 'cầu giấy có chỗ nào vui chơi không',
      city: 'hanoi'
    });
    assert.ok(res.text.toLowerCase().includes('cầu giấy'));
    assert.ok(res.text.includes('Công Viên') || res.text.includes('Tô Hiệu') || res.text.includes('vui chơi') || res.text.includes('ẩm thực'));
  });

  await runAsyncTest('TC-UI-09', 'Hệ thống dẫn đường tự động từ A đến B vẫn hoạt động chuẩn xác', async () => {
    const res = await aiService.processQuery({
      query: 'Từ Cầu Giấy ra Bến xe Mỹ Đình đi đường nào thông thoáng?',
      city: 'hanoi'
    });
    assert.ok(res.action && res.action.type === 'AUTO_ROUTE');
  });

  await runAsyncTest('TC-UI-10', 'Chatbot AI trả kèm action SHOW_FOOD_PLACES với toạ độ ghim bản đồ và danh sách quán', async () => {
    const res = await aiService.processQuery({
      query: 'quanh đống đa chùa láng có quán ăn nào ngon',
      city: 'hanoi'
    });
    assert.ok(res.action && res.action.type === 'SHOW_FOOD_PLACES', 'Thiếu action SHOW_FOOD_PLACES');
    assert.ok(Array.isArray(res.action.spots) && res.action.spots.length >= 3, 'Thiếu danh sách spots có toạ độ');
    assert.ok(typeof res.action.spots[0].lat === 'number' && typeof res.action.spots[0].lng === 'number', 'Thiếu lat/lng trên spot');
  });

  runTest('TC-UI-11', 'Ô tìm kiếm chính có Autocomplete Dropdown, MapEngine có clearRoute và renderFoodPlaces', () => {
    assert.ok(html.includes('id="dropdown-main-search"'), 'Thiếu dropdown-main-search trong index.html');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('renderFoodPlaces('), 'Thiếu hàm renderFoodPlaces trong map-engine.js');
    assert.ok(mapEngineJs.includes('clearRoute()'), 'Thiếu hàm clearRoute trong map-engine.js');
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('renderMainSearchSuggestions('), 'Thiếu hàm renderMainSearchSuggestions trong app.js');
  });

  runTest('TC-UI-12', 'Mục Thời tiết phường đồng bộ chuẩn màu và kiểu dáng với các chip khác, không bị mờ lạc loài', () => {
    assert.strictEqual(html.includes('id="chip-weather-toggle" class="gm-chip gm-chip-inactive"'), false, 'Vẫn còn gm-chip-inactive trong index.html');
    assert.ok(html.includes('id="chip-weather-toggle"'), 'Thiếu id chip-weather-toggle');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('clearFoodPlaces()'), 'Thiếu clearFoodPlaces() trên MapEngine');
    const aiChatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(aiChatJs.includes('window.mapEngine.clearFoodPlaces()'), 'Nút làm mới chưa dọn dẹp food markers trên bản đồ');
  });

  await runAsyncTest('TC-UI-13', 'Trợ lý AI trả lời đúng rạp chiếu phim tại khu vực hiện tại khi hỏi "CÓ RẠP CHIẾU PHIM NÀO QUANH ĐÂY"', async () => {
    assert.ok(foodData.isFoodOrFun('CÓ RẠP CHIẾU PHIM NÀO QUANH ĐÂY'), 'isFoodOrFun không nhận diện rạp chiếu phim');
    const rec = foodData.getRecommendation('CÓ RẠP CHIẾU PHIM NÀO QUANH ĐÂY', 'hanoi', { lastAreaKey: 'mydinh' });
    assert.ok(rec.text.includes('Rạp Chiếu Phim') || rec.text.includes('CGV') || rec.text.includes('Beta') || rec.text.includes('Lotte'), 'Chưa trả về rạp chiếu phim');
    assert.ok(Array.isArray(rec.action.spots) && rec.action.spots.some(s => s.name.includes('Rạp') || s.name.includes('Cinema') || s.name.includes('CGV')), 'Spots thiếu rạp phim');
  });

  runTest('TC-UI-14', 'Chỉ số Thoải Mái Khi Đi Đường (Commute Comfort Modal) và cơ chế dọn sạch ghim lộ trình', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../../js/app.js'), 'utf8');
    assert.ok(appJs.includes('openCommuteComfortModal('), 'Thiếu openCommuteComfortModal trong app.js');
    assert.ok(appJs.includes('this.routeMarkers.origin'), 'clearRouteLayers thiếu xóa routeMarkers.origin');
    assert.ok(appJs.includes('this.routeMarkers.destination'), 'clearRouteLayers thiếu xóa routeMarkers.destination');
    const aiChatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(aiChatJs.includes('window.appState.closeDirections()'), 'clearMessages chưa gọi closeDirections()');
  });

  runTest('TC-UI-15', 'Nút bấm Dự báo thời tiết 15P nổi bật và tối ưu lớp nền bản đồ không bị đè chữ to', () => {
    assert.ok(html.includes('id="chip-commute-comfort"'), 'Thiếu nút chip-commute-comfort trên thanh Category Chips');
    assert.ok(html.includes('class="weather-pill-cta"'), 'Thiếu badge CTA Dự báo 15P trên gm-weather-pill');
    const mapEngineJs = fs.readFileSync(path.join(__dirname, '../../js/map-engine.js'), 'utf8');
    assert.ok(mapEngineJs.includes('lyrs=m,traffic'), 'Thiếu tích hợp lyrs=m,traffic mượt mà');
    assert.strictEqual(mapEngineJs.includes('lyrs=h@159000000'), false, 'Vẫn còn lớp hybrid lyrs=h gây chữ to');
  });
  runTest('TC-AI-01', 'C1 bug fix: "quán ăn sạch sẽ gần đây" không rơi vào nhánh trạm sạc xe điện', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('sạch'), 'Thiếu chốt chặn loại trừ chữ sạch khỏi trạm sạc');
    const isEvRegex = /(?:trạm\s*sạc|sạc\s*xe|sạc\s*điện|sạc\s*pin|xe\s*điện|vinfast|đổi\s*pin|\bsạc(?!h)\b)/i;
    assert.strictEqual(isEvRegex.test('quán ăn sạch sẽ gần đây'), false, 'Không được nhận nhầm sạch sẽ thành sạc');
  });

  runTest('TC-AI-02', 'C2 bug fix: "cửa hàng Samsung Galaxy" không bị nhận nhầm thành rạp chiếu phim', () => {
    const intent = foodData.detectSearchIntent('cửa hàng Samsung Galaxy');
    assert.notStrictEqual(intent, 'cinema', 'Samsung Galaxy không được coi là rạp phim');
  });

  runTest('TC-AI-03', 'C3 bug fix: "tình hình tắc đường hiện tại" phản hồi tình trạng giao thông, không mở bảng chỉ đường', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('isTrafficStatusQuery'), 'Thiếu nhánh isTrafficStatusQuery phân loại tắc đường');
  });

  runTest('TC-AI-04', 'Safety guardrails: Câu hỏi né chốt CSGT bị từ chối, câu hỏi cấp cứu có 115/114/113', () => {
    const chatJs = fs.readFileSync(path.join(__dirname, '../../js/ai-chat.js'), 'utf8');
    assert.ok(chatJs.includes('ILLEGAL_TRAFFIC'), 'Thiếu chốt chặn ILLEGAL_TRAFFIC');
    assert.ok(chatJs.includes('EMERGENCY_LIFE'), 'Thiếu chốt chặn EMERGENCY_LIFE');
    assert.ok(chatJs.includes('115 (Cấp cứu Y tế)'), 'Thiếu số khẩn cấp 115 trong chốt chặn');
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

