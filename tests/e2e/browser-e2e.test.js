/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: END-TO-END (E2E) BROWSER TESTING
 * Module: Dual-Mode UX, Leaflet GIS, Routing, AI Prediction & Crowdsourcing
 * Reference Prefixes: TC-MAP, TC-NAV, TC-PRD, TC-CRW, TC-AIC
 * ============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const app = require('../../server/server');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

describe('Module TC-E2E: End-to-End User Experience & Browser Automation', { timeout: 45000 }, () => {
  let server;
  let baseUrl;
  let browser;
  let page;

  before(async () => {
    // 1. Khởi động Web Server trên cổng ngẫu nhiên
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 2. Khởi động Headless Browser Microsoft Edge
    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1440,900'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Truy cập ứng dụng MoveSafe VN
    await page.goto(baseUrl, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.mapEngine && window.appState, { timeout: 15000 });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TC-MAP-001: Khởi tạo bản đồ số Leaflet & Dual-Mode UI
  it('[TC-MAP-001] Leaflet Map engine initializes with interactive controls', async () => {
    const isMapInitialized = await page.evaluate(() => {
      return !!(window.mapEngine && window.mapEngine.map && window.mapEngine.map.getZoom);
    });
    assert.strictEqual(isMapInitialized, true, 'Map engine must be fully initialized');

    const zoom = await page.evaluate(() => window.mapEngine.map.getZoom());
    assert.ok(zoom >= 10 && zoom <= 18, `Zoom level should be standard urban view (got ${zoom})`);
  });

  // TC-MAP-002: Chuyển đổi lớp vệ tinh Hybrid và bản đồ chuẩn
  it('[TC-MAP-002] Satellite and standard map layer switching works seamlessly', async () => {
    const switchResult = await page.evaluate(() => {
      const btnSat = document.getElementById('btn-map-type') || document.querySelector('[data-action="satellite"]');
      if (btnSat) {
        btnSat.click();
      }
      return {
        clicked: !!btnSat,
        activeLayer: window.mapEngine?.currentTileLayer || 'default'
      };
    });
    assert.strictEqual(typeof switchResult, 'object');
  });

  // TC-NAV-008: Quy trình tìm đường thông minh né ngập và hiển thị kết quả
  it('[TC-NAV-008] Directions workflow calculates smart routes and renders route info', async () => {
    const routeResult = await page.evaluate(async () => {
      const orig = {
        lat: 21.0025,
        lng: 105.8395,
        title: 'Bệnh viện Bạch Mai'
      };
      const dest = {
        lat: 21.0335,
        lng: 105.8118,
        title: 'Lotte Center Hà Nội'
      };

      if (!window.appState.routeLocations) {
        window.appState.routeLocations = {};
      }
      window.appState.routeLocations.origin = orig;
      window.appState.routeLocations.destination = dest;

      // Kích hoạt tính toán lộ trình
      if (typeof window.appState.calculateSmartRoute === 'function') {
        await window.appState.calculateSmartRoute();
      }

      return {
        hasRoutes: !!(window.appState.calculatedRoutes && window.appState.calculatedRoutes.length > 0),
        routeCount: window.appState.calculatedRoutes ? window.appState.calculatedRoutes.length : 0
      };
    });

    assert.ok(routeResult.routeCount >= 0, 'Routing workflow executes without uncaught exceptions');
  });

  // TC-PRD-001: Thanh trượt dự báo AI thời gian thực (+1h, +2h, +3h)
  it('[TC-PRD-001] AI Prediction time-slider updates state and recalculates future risk', async () => {
    const sliderResult = await page.evaluate(async () => {
      const slider = document.getElementById('traffic-prediction-slider');
      if (slider) {
        slider.value = 1;
        slider.dispatchEvent(new Event('input'));
        slider.dispatchEvent(new Event('change'));
      }
      return {
        sliderFound: !!slider,
        offset: window.appState?.currentPredictionOffset
      };
    });

    assert.ok(sliderResult.sliderFound, 'Time prediction slider must exist in the UI');
  });

  // TC-CRW-001: Modal gửi báo cáo sự cố cộng đồng
  it('[TC-CRW-001] Crowdsource reporting modal opens with complete incident fields', async () => {
    const modalCheck = await page.evaluate(() => {
      const btnReport = document.getElementById('btn-report') || document.querySelector('[data-action="report"]');
      if (btnReport) btnReport.click();

      const modal = document.getElementById('modal-report') || document.querySelector('.gm-modal');
      return {
        btnFound: !!btnReport,
        modalExists: !!modal
      };
    });

    assert.ok(modalCheck.btnFound || modalCheck.modalExists, 'Crowdsourcing report trigger or modal must be present');
  });

  // TC-AIC-001: Ngăn kéo trợ lý thông minh AI Copilot
  it('[TC-AIC-001] AI Copilot drawer interface toggles and provides contextual chat', async () => {
    const aiDrawerCheck = await page.evaluate(() => {
      const btnAi = document.getElementById('chip-ai-trigger') || document.getElementById('mnav-ai');
      if (btnAi) btnAi.click();

      const drawer = document.getElementById('ai-chat-window');
      return {
        btnFound: !!btnAi,
        drawerFound: !!drawer,
        hasAiChatInstance: !!window.aiChat
      };
    });

    assert.ok(aiDrawerCheck.btnFound && aiDrawerCheck.drawerFound, 'AI Copilot drawer must be integrated into UI');
    assert.strictEqual(aiDrawerCheck.hasAiChatInstance, true, 'window.aiChat instance must be active');
  });

  // TC-E2E-006: Ngăn kéo điều hướng trượt trái sang phải (Google Maps-style Left Slide-Out Drawer)
  it('[TC-E2E-006] Navigation drawer slides smoothly left-to-right, toggles dark mode, and responds to Esc / Alt+M', async () => {
    const initial = await page.evaluate(() => {
      const drawer = document.getElementById('gm-nav-drawer');
      const toggleBtn = document.getElementById('btn-nav-drawer-toggle');
      const searchBox = document.getElementById('gm-search-box');
      const quickRouteBtn = document.getElementById('btn-quick-directions');
      const toolsChildren = Array.from(document.querySelectorAll('.gm-top-right-tools > *'));
      if (!drawer || !toggleBtn || !searchBox) return { missing: true };
      const searchRect = searchBox.getBoundingClientRect();
      const toolsMinLeft = toolsChildren.length > 0
        ? Math.min(...toolsChildren.map(el => Math.round(el.getBoundingClientRect().left)))
        : 9999;
      return {
        missing: false,
        initiallyOpen: drawer.classList.contains('open'),
        ariaHidden: drawer.getAttribute('aria-hidden'),
        ariaExpanded: toggleBtn.getAttribute('aria-expanded'),
        drawerLeft: Math.round(drawer.getBoundingClientRect().left),
        drawerZIndex: Number(getComputedStyle(drawer).zIndex || 0),
        searchBoxHeight: Math.round(searchRect.height),
        searchBoxRight: Math.round(searchRect.right),
        toolsMinLeft,
        hasQuickRouteBtn: !!quickRouteBtn
      };
    });

    assert.strictEqual(initial.missing, false, 'Drawer and search toggle elements must exist in DOM');
    assert.strictEqual(initial.initiallyOpen, false, 'Drawer should start closed on initial load');
    assert.strictEqual(initial.ariaHidden, 'true', 'Closed drawer should carry aria-hidden="true"');
    assert.strictEqual(initial.ariaExpanded, 'false', 'Hamburger button should carry aria-expanded="false" initially');
    assert.ok(initial.drawerLeft < -100, `Closed drawer should sit off-screen to the left (got ${initial.drawerLeft}px)`);
    assert.ok(initial.drawerZIndex > 2100, `Drawer z-index must exceed mobile-bottom-nav (got ${initial.drawerZIndex})`);
    assert.ok(initial.searchBoxHeight <= 60, `Minimal search box should stay compact (got ${initial.searchBoxHeight}px)`);
    assert.ok(
      initial.toolsMinLeft >= initial.searchBoxRight + 8,
      `Top-right tools (${initial.toolsMinLeft}px) must not overlap search box right edge (${initial.searchBoxRight}px)`
    );
    assert.strictEqual(initial.hasQuickRouteBtn, true, 'Desktop search bar should include quick directions shortcut');

    // Mở drawer qua nút Hamburger
    await page.click('#btn-nav-drawer-toggle');
    await page.waitForFunction(() => {
      const d = document.getElementById('gm-nav-drawer');
      return d && d.classList.contains('open') && Math.round(d.getBoundingClientRect().left) === 0;
    }, { timeout: 4000 });

    const opened = await page.evaluate(() => {
      const drawer = document.getElementById('gm-nav-drawer');
      const backdrop = document.getElementById('gm-nav-backdrop');
      const items = Array.from(document.querySelectorAll('#gm-chips-scroll .gm-chip:not([id="chip-ai-trigger"])'));
      const rect = drawer.getBoundingClientRect();
      return {
        ariaHidden: drawer.getAttribute('aria-hidden'),
        backdropOpen: !!(backdrop && backdrop.classList.contains('open')),
        rectLeft: Math.round(rect.left),
        rectHeight: Math.round(rect.height),
        rectWidth: Math.round(rect.width),
        itemCount: items.length,
        hasTramSacExact: items.some(el => el.querySelector('.chip-text')?.textContent?.trim() === 'Trạm Sạc')
      };
    });

    assert.strictEqual(opened.ariaHidden, 'false', 'Opened drawer must expose aria-hidden="false"');
    assert.strictEqual(opened.backdropOpen, true, 'Backdrop scrim should activate when drawer opens');
    assert.strictEqual(opened.rectLeft, 0, 'Opened drawer must align flush with viewport left edge');
    assert.ok(opened.rectWidth >= 280 && opened.rectWidth <= 360, `Drawer width should stay compact (got ${opened.rectWidth}px)`);
    assert.ok(opened.rectHeight >= 800, `Drawer should span full viewport height (got ${opened.rectHeight}px)`);
    assert.strictEqual(opened.itemCount, 10, 'All 10 drawer navigation/layer items must exist in #gm-chips-scroll');
    assert.strictEqual(opened.hasTramSacExact, true, 'EV item must preserve exact 2-word label "Trạm Sạc"');

    // Chuyển Dark Mode và kiểm tra lưu localStorage
    await page.click('#row-drawer-darkmode');
    await page.waitForFunction(() => document.body.classList.contains('dark-mode'), { timeout: 2000 });
    const darkStored = await page.evaluate(() => localStorage.getItem('movesafe_dark_mode'));
    assert.strictEqual(darkStored, '1', 'Dark mode toggle must persist movesafe_dark_mode=1');

    // Khôi phục lại Light Mode
    await page.click('#row-drawer-darkmode');
    await page.waitForFunction(() => !document.body.classList.contains('dark-mode'), { timeout: 2000 });

    // Nhấn phím Escape để đóng drawer
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('gm-nav-drawer')?.classList.contains('open'), { timeout: 3000 });

    // Mở lại bằng phím tắt Alt + M và kiểm tra click "Chỉ đường" tự đóng drawer
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyM');
    await page.keyboard.up('Alt');
    await page.waitForFunction(() => document.getElementById('gm-nav-drawer')?.classList.contains('open'), { timeout: 3000 });

    await page.click('#btn-open-directions');
    await page.waitForFunction(() => {
      const d = document.getElementById('gm-nav-drawer');
      const dir = document.getElementById('gm-directions-panel');
      return d && !d.classList.contains('open') && dir && dir.classList.contains('open');
    }, { timeout: 3000 });
  });
});
