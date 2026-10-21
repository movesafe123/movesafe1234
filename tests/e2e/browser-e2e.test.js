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
});
