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
    const reportList = [];

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
    console.log('🔬 BẮT ĐẦU KIỂM TRA TỪNG NÚT BẤM (BUTTON-BY-BUTTON VERIFICATION)');
    console.log('===============================================================\n');

    async function checkBtn(category, btnLabel, actionFn, ...args) {
      process.stdout.write(`[${category}] ${btnLabel}... `);
      try {
        const res = await page.evaluate(actionFn, ...args);
        if (res && res.error) {
          console.log(`❌ LỖI: ${res.error}`);
          reportList.push({ category, btnLabel, pass: false, error: res.error });
        } else {
          console.log(`✓ OK`, res ? JSON.stringify(res) : '');
          reportList.push({ category, btnLabel, pass: true, details: res });
        }
      } catch (err) {
        console.log(`❌ EXCEPTION: ${err.message}`);
        reportList.push({ category, btnLabel, pass: false, error: err.message });
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // --- NHÓM 1: THANH TÌM KIẾM ---
    await checkBtn('Search', 'Nút Tìm kiếm (#btn-search-trigger)', () => {
      const btn = document.getElementById('btn-search-trigger');
      if (!btn) return { error: 'Không tìm thấy #btn-search-trigger' };
      btn.click();
      return { clicked: true };
    });

    await checkBtn('Search', 'Nút Xóa tìm kiếm (#btn-clear-search)', () => {
      const input = document.getElementById('gm-search-input');
      const btn = document.getElementById('btn-clear-search');
      if (!input || !btn) return { error: 'Thiếu phần tử input hoặc nút clear' };
      input.value = 'Trường Chinh';
      input.dispatchEvent(new Event('input'));
      btn.click();
      return { cleared: input.value === '', inputVal: input.value };
    });

    await checkBtn('Search', 'Nút Tìm bằng giọng nói (#btn-voice-search)', () => {
      const btn = document.getElementById('btn-voice-search');
      if (!btn) return { error: 'Không tìm thấy #btn-voice-search' };
      btn.click();
      return { clicked: true };
    });

    // --- NHÓM 2: CÁC NÚT CATEGORY CHIPS TRÊN ĐẦU TRANG ---
    const chips = [
      { id: 'btn-open-directions', name: 'Chip Chỉ đường' },
      { id: 'chip-commute-comfort', name: 'Chip Dự báo thời tiết 15P' },
      { id: 'chip-weather-toggle', name: 'Chip Thời tiết phường' },
      { id: 'chip-hanoi-streets', name: 'Chip Tuyến đường lớn Hà Nội' },
      { id: 'chip-urban-insights', name: 'Chip Xu hướng & VOV' },
      { id: 'chip-food-places', name: 'Chip Quán ăn & Cafe' },
      { id: 'chip-ev-stations', name: 'Chip Trạm Sạc' },
      { id: 'chip-flood-count', name: 'Chip Rốn ngập' },
      { id: 'chip-traffic-count', name: 'Chip Ùn tắc' },
      { id: 'chip-ai-trigger', name: 'Chip Trợ lý AI' },
      { id: 'chip-sos-rescue', name: 'Chip Cứu hộ & Trú mưa' }
    ];

    for (const c of chips) {
      await checkBtn('Category Chips', c.name, (chipId) => {
        const btn = document.getElementById(chipId);
        if (!btn) return { error: `Không tìm thấy #${chipId}` };
        btn.click();
        const active = btn.classList.contains('active');
        // Đóng modal/panel nếu mở ra để tránh che màn hình
        document.getElementById('modal-commute-comfort')?.classList.remove('open');
        document.getElementById('modal-hanoi-streets')?.classList.remove('open');
        document.getElementById('modal-urban-insights')?.classList.remove('open');
        document.getElementById('modal-sos-rescue')?.classList.remove('open');
        document.getElementById('gm-directions-panel')?.classList.remove('open');
        document.getElementById('ai-chat-window')?.classList.remove('open');
        return { clicked: true, active };
      }, c.id);
    }

    // --- NHÓM 3: CÁC NÚT GIẢ LẬP (SIMULATION BANNER) ---
    await checkBtn('Simulation', 'Toggle Giả lập (#chk-simulation-mode)', () => {
      const chk = document.getElementById('chk-simulation-mode');
      if (!chk) return { error: 'Thiếu #chk-simulation-mode' };
      chk.click();
      return { isSimMode: window.appState.isSimulationMode };
    });

    await checkBtn('Simulation', 'Nút Đổi kịch bản (#btn-reroll-simulation)', () => {
      const btn = document.getElementById('btn-reroll-simulation');
      if (!btn) return { error: 'Thiếu #btn-reroll-simulation' };
      const prevCount = window.appState.getCurrentFloods().length;
      btn.click();
      const newCount = window.appState.getCurrentFloods().length;
      return { prevCount, newCount };
    });

    await checkBtn('Simulation', 'Nút Demo Né ngập 1-Click (#btn-demo-flood-route)', async () => {
      const btn = document.getElementById('btn-demo-flood-route');
      if (!btn) return { error: 'Thiếu #btn-demo-flood-route' };
      btn.click();
      await new Promise(r => setTimeout(r, 2000));
      return { hasResult: !!window.appState.lastRouteResult };
    });

    await checkBtn('Simulation', 'Nút Tắt giả lập (#btn-exit-simulation)', () => {
      const btn = document.getElementById('btn-exit-simulation');
      if (!btn) return { error: 'Thiếu #btn-exit-simulation' };
      btn.click();
      return { isOff: !window.appState.isSimulationMode };
    });

    // --- NHÓM 4: CÁC NÚT TRONG BẢNG CHỈ ĐƯỜNG (DIRECTIONS PANEL) ---
    await checkBtn('Directions', 'Mở bảng chỉ đường (#btn-open-directions)', () => {
      document.getElementById('btn-open-directions')?.click();
      return { isOpen: document.getElementById('gm-directions-panel')?.classList.contains('open') };
    });

    await checkBtn('Directions', 'Chuyển 4 tab Phương tiện (Xe máy, Ô tô, Xe máy điện, Ô tô điện)', () => {
      const tabs = Array.from(document.querySelectorAll('.gm-mode-tab'));
      if (tabs.length < 4) return { error: `Chỉ tìm thấy ${tabs.length}/4 tabs` };
      const modes = [];
      tabs.forEach(t => {
        t.click();
        modes.push(window.appState.currentVehicle);
      });
      tabs[0].click(); // trả về xe máy
      return { modesTested: modes };
    });

    await checkBtn('Directions', 'Chọn 3 Mức độ Tránh né (An toàn, Cân bằng, Nhanh nhất)', () => {
      const opts = Array.from(document.querySelectorAll('.gm-avoidance-option'));
      if (opts.length < 3) return { error: `Chỉ tìm thấy ${opts.length}/3 mức độ` };
      const levels = [];
      opts.forEach(o => {
        o.click();
        levels.push(window.appState.currentAvoidLevel);
      });
      opts[0].click(); // trả về an toàn
      return { levelsTested: levels };
    });

    await checkBtn('Directions', 'Nút Điểm xuất phát GPS (#btn-gps-origin)', () => {
      const btn = document.getElementById('btn-gps-origin');
      if (!btn) return { error: 'Thiếu #btn-gps-origin' };
      btn.click();
      return { clicked: true };
    });

    await checkBtn('Directions', 'Nút Chọn điểm đến trên bản đồ (#btn-pick-map-dest) & Hủy', () => {
      const btnPick = document.getElementById('btn-pick-map-dest');
      const btnCancel = document.getElementById('btn-cancel-pick-map');
      if (!btnPick || !btnCancel) return { error: 'Thiếu #btn-pick-map-dest hoặc #btn-cancel-pick-map' };
      btnPick.click();
      const picking = !!window.appState.pickingLocationType;
      btnCancel.click();
      const cancelled = !window.appState.pickingLocationType;
      return { picking, cancelled };
    });

    await checkBtn('Directions', 'Nút Xóa điểm đi & điểm đến (#btn-clear-origin, #btn-clear-dest)', () => {
      const origInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      const clearOrig = document.getElementById('btn-clear-origin');
      const clearDest = document.getElementById('btn-clear-dest');
      if (!origInput || !destInput || !clearOrig || !clearDest) return { error: 'Thiếu input hoặc nút clear' };

      origInput.value = 'Địa điểm A';
      origInput.dispatchEvent(new Event('input'));
      clearOrig.click();
      const origCleared = origInput.value === '';

      destInput.value = 'Địa điểm B';
      destInput.dispatchEvent(new Event('input'));
      clearDest.click();
      const destCleared = destInput.value === '';

      return { origCleared, destCleared };
    });

    await checkBtn('Directions', 'Nút Đảo chiều lộ trình (#btn-swap-route)', () => {
      const origInput = document.getElementById('gm-route-origin');
      const destInput = document.getElementById('gm-route-dest');
      const btnSwap = document.getElementById('btn-swap-route');
      origInput.value = 'Điểm 1';
      destInput.value = 'Điểm 2';
      btnSwap.click();
      return { swapped: origInput.value === 'Điểm 2' && destInput.value === 'Điểm 1' };
    });

    await checkBtn('Directions', 'Nút Đi làm / Đi học (#btn-commute-go-work)', async () => {
      const btn = document.getElementById('btn-commute-go-work');
      if (!btn) return { error: 'Thiếu #btn-commute-go-work' };
      btn.click();
      await new Promise(r => setTimeout(r, 2500));
      return { hasResult: !!window.appState.lastRouteResult };
    });

    await checkBtn('Directions', 'Nút Về nhà ngay (#btn-commute-go-home)', async () => {
      const btn = document.getElementById('btn-commute-go-home');
      if (!btn) return { error: 'Thiếu #btn-commute-go-home' };
      btn.click();
      await new Promise(r => setTimeout(r, 2500));
      return { hasResult: !!window.appState.lastRouteResult };
    });

    await checkBtn('Directions', 'Nút Lưu cố định lộ trình (#btn-save-commute-places)', () => {
      const btn = document.getElementById('btn-save-commute-places');
      if (!btn) return { error: 'Thiếu #btn-save-commute-places' };
      btn.click();
      return { clicked: true };
    });

    await checkBtn('Directions', 'Nút Trú mưa / SOS trong panel (#btn-directions-sos)', () => {
      const btn = document.getElementById('btn-directions-sos');
      if (!btn) return { error: 'Thiếu #btn-directions-sos' };
      btn.click();
      const isOpen = document.getElementById('modal-sos-rescue')?.classList.contains('open');
      document.getElementById('modal-sos-rescue')?.classList.remove('open');
      return { isOpen };
    });

    await checkBtn('Directions', 'Nút Tìm lộ trình thông minh (#btn-find-route-submit)', async () => {
      const btn = document.getElementById('btn-find-route-submit');
      if (!btn) return { error: 'Thiếu #btn-find-route-submit' };
      btn.click();
      await new Promise(r => setTimeout(r, 2000));
      return { hasResult: !!window.appState.lastRouteResult };
    });

    await checkBtn('Directions', 'Nút Đọc giọng nói dẫn đường (.gm-btn-voice-nav)', () => {
      const btn = document.querySelector('.gm-btn-voice-nav');
      if (!btn) return { error: 'Chưa có thẻ lộ trình để render .gm-btn-voice-nav' };
      btn.click();
      return { clicked: true, isSpeaking: !!window.appState.isSpeaking };
    });

    await checkBtn('Directions', 'Nút Đóng bảng chỉ đường (#btn-close-directions)', () => {
      const btn = document.getElementById('btn-close-directions');
      if (!btn) return { error: 'Thiếu #btn-close-directions' };
      btn.click();
      return { isClosed: !document.getElementById('gm-directions-panel')?.classList.contains('open') };
    });

    // --- NHÓM 5: TRỢ LÝ AI COPILOT DRAWER ---
    await checkBtn('AI Drawer', 'Mở AI Copilot (#chip-ai-trigger)', () => {
      document.getElementById('chip-ai-trigger')?.click();
      return { isOpen: document.getElementById('ai-chat-window')?.classList.contains('open') };
    });

    await checkBtn('AI Drawer', 'Gợi ý nhanh 1: Tình hình hiện tại', async () => {
      const chips = Array.from(document.querySelectorAll('.gm-ai-prompt-chip'));
      if (chips.length < 1) return { error: 'Không thấy prompt chips' };
      chips[0].click();
      await new Promise(r => setTimeout(r, 2500));
      return { clicked: true, msgs: document.querySelectorAll('.gm-chat-bubble').length };
    });

    await checkBtn('AI Drawer', 'Gợi ý nhanh 2: Cầu Giấy đi Mỹ Đình', async () => {
      const chips = Array.from(document.querySelectorAll('.gm-ai-prompt-chip'));
      if (chips.length < 2) return { error: 'Không thấy prompt chip 2' };
      chips[1].click();
      await new Promise(r => setTimeout(r, 2500));
      return { clicked: true, msgs: document.querySelectorAll('.gm-chat-bubble').length };
    });

    await checkBtn('AI Drawer', 'Gợi ý nhanh 3: Ăn chơi Mỹ Đình', async () => {
      const chips = Array.from(document.querySelectorAll('.gm-ai-prompt-chip'));
      if (chips.length < 3) return { error: 'Không thấy prompt chip 3' };
      chips[2].click();
      await new Promise(r => setTimeout(r, 2500));
      return { clicked: true, msgs: document.querySelectorAll('.gm-chat-bubble').length };
    });

    await checkBtn('AI Drawer', 'Gợi ý nhanh 4: Dự báo thời tiết', async () => {
      const chips = Array.from(document.querySelectorAll('.gm-ai-prompt-chip'));
      if (chips.length < 4) return { error: 'Không thấy prompt chip 4' };
      chips[3].click();
      await new Promise(r => setTimeout(r, 2500));
      return { clicked: true, msgs: document.querySelectorAll('.gm-chat-bubble').length };
    });

    await checkBtn('AI Drawer', 'Nút Chấm bản đồ hỏi AI (#btn-chat-map-pick)', () => {
      const btn = document.getElementById('btn-chat-map-pick');
      if (!btn) return { error: 'Thiếu #btn-chat-map-pick' };
      btn.click();
      const picking = !!window.aiChat?.isPickingSpatialPoint;
      btn.click(); // toggle off
      return { picking, toggleOff: !window.aiChat?.isPickingSpatialPoint };
    });

    await checkBtn('AI Drawer', 'Nút Nhập giọng nói AI (#btn-chat-voice)', () => {
      const btn = document.getElementById('btn-chat-voice');
      if (!btn) return { error: 'Thiếu #btn-chat-voice' };
      btn.click();
      return { clicked: true };
    });

    await checkBtn('AI Drawer', 'Nút Gửi tin nhắn (.gm-btn-send)', async () => {
      const input = document.getElementById('ai-chat-input');
      const btn = document.querySelector('.gm-btn-send');
      if (!input || !btn) return { error: 'Thiếu input hoặc nút send' };
      input.value = 'Hôm nay đường Nguyễn Trãi có ngập không?';
      btn.click();
      await new Promise(r => setTimeout(r, 3000));
      return { clicked: true, msgs: document.querySelectorAll('.gm-chat-bubble').length };
    });

    await checkBtn('AI Drawer', 'Nút Làm mới lịch sử chat (.gm-btn-text-sm)', () => {
      const refreshBtn = document.querySelector('.gm-ai-header-actions .gm-btn-text-sm');
      if (!refreshBtn) return { error: 'Không tìm thấy nút làm mới' };
      refreshBtn.click();
      return { messagesCleared: window.aiChat.messages.length <= 1 };
    });

    await checkBtn('AI Drawer', 'Nút Đóng AI Drawer (.gm-ai-header-actions .gm-btn-close)', () => {
      const closeBtn = document.querySelector('.gm-ai-header-actions .gm-btn-close');
      if (!closeBtn) return { error: 'Không tìm thấy nút đóng AI' };
      closeBtn.click();
      return { isClosed: !document.getElementById('ai-chat-window')?.classList.contains('open') };
    });

    // --- NHÓM 6: CÁC NÚT TRONG CÁC MODAL ---
    await checkBtn('Modals', 'Mở & Đóng Modal Báo cáo (#btn-gm-open-report, #btn-close-report)', () => {
      const btnOpen = document.getElementById('btn-gm-open-report');
      const modal = document.getElementById('modal-report');
      const btnClose = document.getElementById('btn-close-report');
      btnOpen.click();
      const opened = modal.classList.contains('open');
      btnClose.click();
      const closed = !modal.classList.contains('open');
      return { opened, closed };
    });

    await checkBtn('Modals', 'Nút Lấy GPS trong form báo cáo (#btn-report-current-gps)', () => {
      const btn = document.getElementById('btn-report-current-gps');
      if (!btn) return { error: 'Thiếu #btn-report-current-gps' };
      btn.click();
      return { clicked: true };
    });

    await checkBtn('Modals', 'Mở & Đóng Modal Tuyến đường lớn Hà Nội & Reset lọc (#chip-hanoi-streets)', () => {
      document.getElementById('chip-hanoi-streets')?.click();
      const modal = document.getElementById('modal-hanoi-streets');
      const opened = modal.classList.contains('open');

      // Click thử chip quận
      const distChips = Array.from(document.querySelectorAll('#district-filter-chips .dist-chip'));
      if (distChips.length > 2) distChips[2].click();

      // Click reset
      document.getElementById('btn-reset-streets-filter')?.click();

      document.getElementById('btn-close-hanoi-streets')?.click();
      const closed = !modal.classList.contains('open');
      return { opened, closed, distChipsCount: distChips.length };
    });

    await checkBtn('Modals', 'Mở & Đóng Modal Thoải mái Đi đường (#gm-weather-pill)', () => {
      document.getElementById('gm-weather-pill')?.click();
      const modal = document.getElementById('modal-commute-comfort');
      const opened = modal.classList.contains('open');

      document.getElementById('btn-comfort-refresh')?.click();
      document.querySelector('#modal-commute-comfort .btn-modal-close')?.click();
      const closed = !modal.classList.contains('open');
      return { opened, closed };
    });

    await checkBtn('Modals', 'Mở & Đóng Modal Cứu hộ SOS & Tab switcher (#chip-sos-rescue)', () => {
      document.getElementById('chip-sos-rescue')?.click();
      const modal = document.getElementById('modal-sos-rescue');
      const opened = modal.classList.contains('open');

      // Switch 3 tabs
      const tabs = Array.from(document.querySelectorAll('.sos-tab-btn'));
      tabs.forEach(t => t.click());

      document.getElementById('btn-sos-copy-gps')?.click();
      document.querySelector('#modal-sos-rescue .btn-modal-close')?.click();
      const closed = !modal.classList.contains('open');
      return { opened, closed, tabsTested: tabs.length };
    });

    await checkBtn('Modals', 'Mở & Đóng Modal Chấm điểm An cư (#modal-property-score)', async () => {
      window.appState.openPropertyAnalyzerModal(21.0285, 105.8542, 'Hồ Gươm');
      await new Promise(r => setTimeout(r, 1000));
      const modal = document.getElementById('modal-property-score');
      const opened = modal.classList.contains('open');

      document.getElementById('btn-copy-prop-report')?.click();
      document.querySelector('#modal-property-score .btn-modal-close')?.click();
      const closed = !modal.classList.contains('open');
      return { opened, closed };
    });

    // --- NHÓM 7: PLACE DETAILS CARD (KHI CLICK ĐỊA ĐIỂM) ---
    await checkBtn('Place Card', 'Mở Place Details Card và thử 7 nút chức năng', async () => {
      const mockSpot = {
        name: 'Trường Đại học Quốc gia Hà Nội',
        address: '144 Xuân Thủy, Cầu Giấy, Hà Nội',
        lat: 21.0375,
        lng: 105.7815,
        type: 'education',
        category: 'Trường đại học',
        rating: 4.8,
        reviewsCount: 150
      };
      window.appState.openPlaceDetailsCard(mockSpot);
      await new Promise(r => setTimeout(r, 600));

      const card = document.getElementById('gm-place-card');
      const isOpen = card && card.classList.contains('open');

      // Thử các nút
      document.getElementById('btn-place-save')?.click();
      document.getElementById('btn-place-nearby')?.click();
      document.getElementById('btn-place-share')?.click();
      document.getElementById('btn-close-place-card')?.click();

      return { isOpen, closedAfterClick: !card.classList.contains('open') };
    });

    // --- NHÓM 8: ĐIỀU KHIỂN BẢN ĐỒ (MAP CONTROLS GÓC PHẢI DƯỚI) ---
    await checkBtn('Map Controls', 'Nút Menu Lớp bản đồ (#btn-gm-layers)', () => {
      const btn = document.getElementById('btn-gm-layers');
      const menu = document.getElementById('gm-layer-menu');
      btn.click();
      const opened = menu.classList.contains('open');
      btn.click();
      const closed = !menu.classList.contains('open');
      return { opened, closed };
    });

    await checkBtn('Map Controls', 'Nút Định vị GPS của tôi (#btn-gm-locate)', () => {
      const btn = document.getElementById('btn-gm-locate');
      btn.click();
      return { clicked: true };
    });

    await checkBtn('Map Controls', 'Nút Phóng to & Thu nhỏ (#btn-gm-zoom-in, #btn-gm-zoom-out)', () => {
      const zIn = document.getElementById('btn-gm-zoom-in');
      const zOut = document.getElementById('btn-gm-zoom-out');
      const z0 = window.mapEngine.map.getZoom();
      zIn.click();
      const z1 = window.mapEngine.map.getZoom();
      zOut.click();
      const z2 = window.mapEngine.map.getZoom();
      return { z0, z1, z2 };
    });

    // --- NHÓM 9: THANH ĐIỀU HƯỚNG MOBILE (BOTTOM NAVIGATION) ---
    const mnavTabs = [
      { id: 'mnav-explore', name: 'Tab Bản đồ' },
      { id: 'mnav-route', name: 'Tab Chỉ đường' },
      { id: 'mnav-report', name: 'Tab Báo ngập' },
      { id: 'mnav-ai', name: 'Tab Trợ lý AI' },
      { id: 'mnav-insights', name: 'Tab Xu hướng' }
    ];

    for (const t of mnavTabs) {
      await checkBtn('Mobile Nav', t.name, (tabId) => {
        const btn = document.getElementById(tabId);
        if (!btn) return { error: `Thiếu #${tabId}` };
        btn.click();
        // Dọn dẹp
        document.getElementById('modal-report')?.classList.remove('open');
        document.getElementById('modal-urban-insights')?.classList.remove('open');
        document.getElementById('gm-directions-panel')?.classList.remove('open');
        window.aiChat?.close();
        return { clicked: true };
      }, t.id);
    }

    console.log('\n===============================================================');
    console.log('📊 TỔNG HỢP KIỂM TRA TẤT CẢ CÁC NÚT BẤM (BUTTON AUDIT REPORT):');
    const passed = reportList.filter(r => r.pass).length;
    const total = reportList.length;
    console.log(`Kết quả: ${passed}/${total} nút bấm hoạt động chính xác (${Math.round(passed/total*100)}%)`);
    console.log(`Lỗi JavaScript Runtime: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Chi tiết lỗi:', JSON.stringify(errors, null, 2));
    }
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Fatal error in test script:', err);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
})();
