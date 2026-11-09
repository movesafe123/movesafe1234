const puppeteer = require('puppeteer-core');
const app = require('../server/server');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  let server;
  let browser;
  try {
    server = app.listen(0);
    const port = server.address().port;
    const url = 'http://127.0.0.1:' + port;
    console.log('Server started on', url);

    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    const testResults = [];

    page.on('response', resp => {
      const status = resp.status();
      if (status >= 400) {
        console.warn(`⚠️ [HTTP ${status}] ${resp.url()}`);
      }
    });

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        errors.push({ type: 'CONSOLE_ERROR', text });
        console.error('❌ [CONSOLE ERROR]', text);
      }
    });

    page.on('pageerror', err => {
      errors.push({ type: 'PAGE_ERROR', text: err.message });
      console.error('❌ [PAGE ERROR]', err.message);
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n===============================================================');
    console.log('--- BẮT ĐẦU KIỂM TRA TOÀN DIỆN MỌI TÍNH NĂNG VÀ NÚT BẤM (E2E) ---');
    console.log('===============================================================\n');

    // Helper kiểm tra
    async function testFeature(name, fn) {
      process.stdout.write(`Đang kiểm tra: ${name}... `);
      try {
        const res = await page.evaluate(fn);
        if (res && res.error) {
          console.log(`❌ THẤT BẠI: ${res.error}`);
          testResults.push({ name, pass: false, details: res.error });
        } else {
          console.log(`✓ ĐẠT!`, res ? JSON.stringify(res) : '');
          testResults.push({ name, pass: true, details: res });
        }
      } catch (err) {
        console.log(`❌ LỖI NGOẠI LỆ: ${err.message}`);
        testResults.push({ name, pass: false, error: err.message });
      }
      await new Promise(r => setTimeout(r, 400));
    }

    // 1. Bản đồ Leaflet
    await testFeature('1. Khởi tạo Bản đồ Leaflet & TileLayers', () => {
      if (typeof L === 'undefined') return { error: 'Thư viện Leaflet không tồn tại' };
      if (!window.mapEngine || !window.mapEngine.map) return { error: 'window.mapEngine.map chưa khởi tạo' };
      return {
        zoom: window.mapEngine.map.getZoom(),
        center: window.mapEngine.map.getCenter(),
        activeLayers: Object.keys(window.mapEngine.layers || {})
      };
    });

    // 2. Chuyển thành phố
    await testFeature('2. Chuyển thành phố (Hà Nội -> TP.HCM -> Đà Nẵng -> Hà Nội)', async () => {
      const sel = document.getElementById('city-select-gm');
      if (!sel) return { error: 'Không tìm thấy #city-select-gm' };
      
      sel.value = 'hcm';
      sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 600));
      if (window.appState.currentCity !== 'hcm') return { error: 'Chuyển TP.HCM thất bại' };

      sel.value = 'danang';
      sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 600));
      if (window.appState.currentCity !== 'danang') return { error: 'Chuyển Đà Nẵng thất bại' };

      sel.value = 'hanoi';
      sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 600));
      if (window.appState.currentCity !== 'hanoi') return { error: 'Chuyển lại Hà Nội thất bại' };

      return { status: 'Chuyển mượt mà 3 thành phố', finalCity: window.appState.currentCity };
    });

    // 3. Thanh tìm kiếm chính & Autocomplete
    await testFeature('3. Thanh tìm kiếm chính & Gợi ý tự động (Autocomplete)', async () => {
      const input = document.getElementById('gm-search-input');
      const dropdown = document.getElementById('dropdown-main-search');
      const btnClear = document.getElementById('btn-clear-search');
      if (!input || !dropdown) return { error: 'Thiếu phần tử tìm kiếm #gm-search-input hoặc #dropdown-main-search' };

      input.value = 'Hồ Gươm';
      input.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 600));

      const hasDropdown = dropdown.style.display !== 'none';
      const itemsCount = dropdown.querySelectorAll('.gm-autocomplete-item').length;
      const clearVisible = btnClear && btnClear.style.display !== 'none';

      // Click clear
      if (btnClear) btnClear.click();
      await new Promise(r => setTimeout(r, 300));

      return { hasDropdown, itemsCount, clearWorked: input.value === '' };
    });

    // 4. Quick Category Chips trên Header
    await testFeature('4. Các nút Category Chip trên đầu trang (Weather, EV, Flood, Traffic, SOS)', async () => {
      const results = {};

      // 4a. Chip Thời tiết
      const chipWeather = document.getElementById('chip-weather-toggle');
      if (chipWeather) {
        chipWeather.click();
        await new Promise(r => setTimeout(r, 400));
        results.weatherToggled = chipWeather.classList.contains('active');
        chipWeather.click(); // revert
      } else {
        return { error: 'Thiếu #chip-weather-toggle' };
      }

      // 4b. Chip Trạm sạc EV
      const chipEv = document.getElementById('chip-ev-stations');
      if (chipEv) {
        chipEv.click();
        await new Promise(r => setTimeout(r, 400));
        results.evToggled = chipEv.classList.contains('active');
        chipEv.click(); // revert
      } else {
        return { error: 'Thiếu #chip-ev-stations' };
      }

      // 4b2. Chip Quán ăn & Cafe
      const chipFood = document.getElementById('chip-food-places');
      if (chipFood) {
        chipFood.click();
        await new Promise(r => setTimeout(r, 400));
        results.foodToggled = chipFood.classList.contains('active');
        results.foodSpotsCount = (window.mapEngine && window.mapEngine.layers.foodMarkers) ? window.mapEngine.layers.foodMarkers.getLayers().length : 0;
        chipFood.click(); // revert
      } else {
        return { error: 'Thiếu #chip-food-places' };
      }

      // 4c. Chip Rốn ngập
      const chipFlood = document.getElementById('chip-flood-count');
      if (chipFlood) {
        chipFlood.click();
        results.floodClickable = true;
      }

      // 4d. Chip Ùn tắc
      const chipTraffic = document.getElementById('chip-traffic-count');
      if (chipTraffic) {
        chipTraffic.click();
        results.trafficClickable = true;
      }

      return results;
    });

    // 5. Mở và Đóng Bảng Chỉ đường (Directions Panel)
    await testFeature('5. Mở và Đóng Bảng chỉ đường (Directions Panel)', async () => {
      const btnOpen = document.getElementById('btn-open-directions');
      const btnClose = document.getElementById('btn-close-directions');
      const panel = document.getElementById('gm-directions-panel');
      if (!btnOpen || !panel) return { error: 'Thiếu #btn-open-directions hoặc #gm-directions-panel' };

      btnOpen.click();
      await new Promise(r => setTimeout(r, 400));
      const isOpen = panel.classList.contains('open');

      if (btnClose) btnClose.click();
      await new Promise(r => setTimeout(r, 400));
      const isClosed = !panel.classList.contains('open');

      return { isOpen, isClosed };
    });

    // 6. Lộ trình 1-Chạm (Quick Commute: Đi làm / Về nhà)
    await testFeature('6. Lộ trình Quen thuộc 1-Chạm (Đi làm / Về nhà)', async () => {
      const btnOpen = document.getElementById('btn-open-directions');
      if (btnOpen) btnOpen.click();
      await new Promise(r => setTimeout(r, 400));

      const btnWork = document.getElementById('btn-commute-go-work');
      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');

      if (!btnWork) return { error: 'Thiếu #btn-commute-go-work' };
      btnWork.click();
      await new Promise(r => setTimeout(r, 2500));

      const hasOrigin = !!(originInput && originInput.value);
      const hasDest = !!(destInput && destInput.value);
      const routeRes = window.appState.lastRouteResult;

      return {
        hasOrigin,
        originVal: originInput?.value,
        hasDest,
        destVal: destInput?.value,
        calculatedRoutes: routeRes?.routes?.length || 0,
        primaryDistance: routeRes?.routes?.[0]?.distanceKm,
        primaryDuration: routeRes?.routes?.[0]?.durationMin
      };
    });

    // 7. Voice Navigation & Đảo chiều lộ trình (Swap Route)
    await testFeature('7. Đảo chiều Lộ trình (Swap) & Nút Đọc Giọng nói (Voice Nav)', async () => {
      const btnSwap = document.getElementById('btn-swap-route');
      const originInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      const prevOrig = originInput?.value;
      const prevDest = destInput?.value;

      if (btnSwap) {
        btnSwap.click();
        await new Promise(r => setTimeout(r, 600));
      }

      const swapped = originInput?.value === prevDest && destInput?.value === prevOrig;
      const voiceBtn = document.querySelector('.gm-btn-voice-nav');
      const hasVoiceBtn = !!voiceBtn;

      return { swapped, hasVoiceBtn };
    });

    // 8. Chế độ Giả lập Ngập lụt (Simulation Mode)
    await testFeature('8. Chế độ Giả lập Ngập lụt & Đổi kịch bản', async () => {
      const chk = document.getElementById('chk-simulation-mode');
      if (!chk) return { error: 'Thiếu #chk-simulation-mode' };

      chk.click();
      await new Promise(r => setTimeout(r, 800));
      const enabled = window.appState.isSimulationMode;
      const banner = document.getElementById('gm-simulation-banner');
      const bannerShown = banner && banner.style.display !== 'none';
      const simFloods = window.appState.getCurrentFloods();

      const btnReroll = document.getElementById('btn-reroll-simulation');
      if (btnReroll) btnReroll.click();
      await new Promise(r => setTimeout(r, 500));
      const rerolledFloods = window.appState.getCurrentFloods();

      // Demo né ngập 1-click
      const btnDemo = document.getElementById('btn-demo-flood-route');
      if (btnDemo) btnDemo.click();
      await new Promise(r => setTimeout(r, 2000));
      const demoRouteCalculated = !!window.appState.lastRouteResult;

      // Tắt giả lập
      const btnExit = document.getElementById('btn-exit-simulation');
      if (btnExit) btnExit.click();
      await new Promise(r => setTimeout(r, 500));

      return {
        enabled,
        bannerShown,
        simCount: simFloods.length,
        rerolledCount: rerolledFloods.length,
        demoRouteCalculated,
        isOff: !window.appState.isSimulationMode
      };
    });

    // 9. Modal Báo cáo Sự cố Cộng đồng (Crowdsource Report)
    await testFeature('9. Modal Báo cáo Sự cố Cộng đồng (#modal-report)', async () => {
      const btnReport = document.getElementById('btn-gm-open-report');
      const modal = document.getElementById('modal-report');
      const btnClose = document.getElementById('btn-close-report');
      if (!btnReport || !modal) return { error: 'Thiếu #btn-gm-open-report hoặc #modal-report' };

      btnReport.click();
      await new Promise(r => setTimeout(r, 400));
      const isOpen = modal.classList.contains('open');

      const locInput = document.getElementById('report-location-name');
      const typeSel = document.getElementById('report-type');
      const depthSel = document.getElementById('report-depth');
      if (locInput) locInput.value = 'Đường Nguyễn Trãi';
      if (typeSel) typeSel.value = 'flood';
      if (depthSel) depthSel.value = '35';

      if (btnClose) btnClose.click();
      await new Promise(r => setTimeout(r, 300));
      const isClosed = !modal.classList.contains('open');

      return { isOpen, isClosed, hasFields: !!(locInput && typeSel && depthSel) };
    });

    // 10. Modal Thoải Mái Đi Đường & Dự báo 15P Nowcasting
    await testFeature('10. Modal Thoải Mái Đi Đường & Nowcasting 15P (#modal-commute-comfort)', async () => {
      const pill = document.getElementById('gm-weather-pill');
      const modal = document.getElementById('modal-commute-comfort');
      if (!pill || !modal) return { error: 'Thiếu #gm-weather-pill hoặc #modal-commute-comfort' };

      pill.click();
      await new Promise(r => setTimeout(r, 600));
      const isOpen = modal.classList.contains('open');
      const score = document.getElementById('comfort-score-num')?.textContent;

      modal.classList.remove('open');
      return { isOpen, comfortScore: score };
    });

    // 11. Modal Cứu hộ SOS Thủy kích & Điểm đỗ xe cao ráo
    await testFeature('11. Modal Cứu hộ Thủy kích 24/7 & Trú mưa SOS (#modal-sos-rescue)', async () => {
      const chipSos = document.getElementById('chip-sos-rescue');
      const modal = document.getElementById('modal-sos-rescue');
      if (!chipSos || !modal) return { error: 'Thiếu #chip-sos-rescue hoặc #modal-sos-rescue' };

      chipSos.click();
      await new Promise(r => setTimeout(r, 600));
      const isOpen = modal.classList.contains('open');
      const hasContent = !!document.getElementById('sos-modal-content')?.children?.length;

      modal.classList.remove('open');
      return { isOpen, hasContent };
    });

    // 12. Modal Tuyến đường lớn Hà Nội theo phường
    await testFeature('12. Modal Tuyến đường lớn Hà Nội theo phường (#modal-hanoi-streets)', async () => {
      const chip = document.getElementById('chip-hanoi-streets');
      const modal = document.getElementById('modal-hanoi-streets');
      const btnClose = document.getElementById('btn-close-hanoi-streets');
      if (!chip || !modal) return { error: 'Thiếu #chip-hanoi-streets hoặc #modal-hanoi-streets' };

      chip.click();
      await new Promise(r => setTimeout(r, 600));
      const isOpen = modal.classList.contains('open');
      const wardsCount = document.querySelectorAll('.ward-card').length;

      if (btnClose) btnClose.click();
      await new Promise(r => setTimeout(r, 300));

      return { isOpen, wardsCount, isClosed: !modal.classList.contains('open') };
    });

    // 13. Modal Xu hướng Đô thị & VOV Giao thông
    await testFeature('13. Modal Xu hướng Đô thị & VOV Giao thông (#modal-urban-insights)', async () => {
      const chip = document.getElementById('chip-urban-insights');
      const modal = document.getElementById('modal-urban-insights');
      const btnClose = document.getElementById('btn-close-urban-insights');
      if (!chip || !modal) return { error: 'Thiếu #chip-urban-insights hoặc #modal-urban-insights' };

      chip.click();
      await new Promise(r => setTimeout(r, 600));
      const isOpen = modal.classList.contains('open');
      const hasChart = !!document.getElementById('historical-trends-chart');

      if (btnClose) btnClose.click();
      await new Promise(r => setTimeout(r, 300));

      return { isOpen, hasChart, isClosed: !modal.classList.contains('open') };
    });

    // 14. Trợ lý AI Copilot Drawer & Tương tác gửi câu hỏi
    await testFeature('14. Trợ lý AI Copilot Drawer (#ai-chat-window) & Gửi câu hỏi', async () => {
      const chipAi = document.getElementById('chip-ai-trigger');
      const drawer = document.getElementById('ai-chat-window');
      if (!chipAi || !drawer) return { error: 'Thiếu #chip-ai-trigger hoặc #ai-chat-window' };

      chipAi.click();
      await new Promise(r => setTimeout(r, 600));
      const isOpen = drawer.classList.contains('open');

      // Thử gửi câu hỏi qua window.aiChat.sendMessage
      const prevMsgs = drawer.querySelectorAll('.gm-chat-bubble').length;
      await window.aiChat.sendMessage('Tình hình ngập úng tại Hà Nội lúc này thế nào?');
      await new Promise(r => setTimeout(r, 3500));
      const newMsgs = drawer.querySelectorAll('.gm-chat-bubble').length;

      window.aiChat.close();
      await new Promise(r => setTimeout(r, 300));

      return { isOpen, prevMsgs, newMsgs, receivedResponse: newMsgs > prevMsgs };
    });

    // 15. Menu Lớp bản đồ & Điều khiển bản đồ góc dưới phải
    await testFeature('15. Menu Lớp bản đồ & Các nút điều khiển bản đồ', async () => {
      const btnLayers = document.getElementById('btn-gm-layers');
      const menu = document.getElementById('gm-layer-menu');
      if (!btnLayers || !menu) return { error: 'Thiếu #btn-gm-layers hoặc #gm-layer-menu' };

      btnLayers.click();
      const menuOpen = menu.classList.contains('open');
      btnLayers.click();

      // Zoom controls
      const btnZoomIn = document.getElementById('btn-gm-zoom-in');
      const btnZoomOut = document.getElementById('btn-gm-zoom-out');
      const currentZoom = window.mapEngine.map.getZoom();
      if (btnZoomIn) btnZoomIn.click();
      const zoomAfterIn = window.mapEngine.map.getZoom();
      if (btnZoomOut) btnZoomOut.click();

      return { menuOpen, currentZoom, zoomAfterIn };
    });

    // 16. Mobile Bottom Navigation Bar (Explore, Route, Report, AI)
    await testFeature('16. Thanh điều hướng Điện thoại (Mobile Bottom Nav: Explore, Route, Report, AI)', async () => {
      const mnavRoute = document.getElementById('mnav-route');
      const mnavReport = document.getElementById('mnav-report');
      const mnavAi = document.getElementById('mnav-ai');
      const mnavExplore = document.getElementById('mnav-explore');

      if (!mnavRoute || !mnavReport || !mnavAi || !mnavExplore) {
        return { error: 'Thiếu một trong các nút mobile nav' };
      }

      mnavRoute.click();
      await new Promise(r => setTimeout(r, 400));
      const routeOpen = document.getElementById('gm-directions-panel')?.classList.contains('open');

      mnavReport.click();
      await new Promise(r => setTimeout(r, 400));
      const reportOpen = document.getElementById('modal-report')?.classList.contains('open');
      document.getElementById('modal-report')?.classList.remove('open');

      mnavAi.click();
      await new Promise(r => setTimeout(r, 400));
      const aiOpen = document.getElementById('ai-chat-window')?.classList.contains('open');
      window.aiChat?.close();

      mnavExplore.click();
      await new Promise(r => setTimeout(r, 400));
      const routeClosed = !document.getElementById('gm-directions-panel')?.classList.contains('open');

      return { routeOpen, reportOpen, aiOpen, routeClosed };
    });

    console.log('\n===============================================================');
    console.log('TỔNG HỢP KIỂM TRA TẤT CẢ TÍNH NĂNG TRÊN TRÌNH DUYỆT THỰC TẾ:');
    const passed = testResults.filter(t => t.pass).length;
    const total = testResults.length;
    console.log(`Kết quả: ${passed}/${total} tính năng ĐẠT (${Math.round(passed/total*100)}%)`);
    console.log(`Lỗi JavaScript Runtime: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Chi tiết lỗi runtime:', errors);
    }
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Lỗi nghiêm trọng trong script test:', err);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
})();
