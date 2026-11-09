const puppeteer = require('puppeteer-core');
const app = require('../server/server');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function runAiCopilotUpgradeTests() {
  console.log('===============================================================');
  console.log('🤖 KIỂM THỬ THÍCH ỨNG: AI COPILOT V2.0 UPGRADE (ADAPTIVE E2E)');
  console.log('===============================================================');

  let server;
  let browser;

  try {
    server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Test Server] Đang chạy tại ${baseUrl}`);

    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const results = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('  [Browser Error]:', msg.text());
      }
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // -------------------------------------------------------------------------
    // TEST INTENT 1: NLU Phân tích đa ràng buộc (Multi-constraint Natural Query)
    // -------------------------------------------------------------------------
    console.log('\n[Intent 1] Kiểm tra NLU phân tích đa ràng buộc qua parseRouteQuery()...');
    const nluResult = await page.evaluate(() => {
      const chat = window.aiChat;
      const q = "từ Bách Khoa về Cầu Giấy, né Thái Hà và Nguyễn Trãi, tiện đường tìm quán cafe";
      const parsed = chat.parseRouteQuery(q);
      return {
        query: q,
        origin: parsed.origin,
        destination: parsed.destination,
        avoidRoads: parsed.avoidRoads,
        isRouteIntent: parsed.isRouteIntent,
        hasPitstopIntent: parsed.hasPitstopIntent,
        pitstopKeyword: parsed.pitstopKeyword
      };
    });

    const nluPass = nluResult.isRouteIntent &&
      nluResult.origin.toLowerCase().includes('bách khoa') &&
      nluResult.destination.toLowerCase().includes('cầu giấy') &&
      !nluResult.destination.toLowerCase().includes('tiện đường') &&
      nluResult.avoidRoads && nluResult.avoidRoads.length >= 2 &&
      nluResult.avoidRoads.some(r => r.toLowerCase().includes('thái hà')) &&
      nluResult.avoidRoads.some(r => r.toLowerCase().includes('nguyễn trãi')) &&
      nluResult.hasPitstopIntent;

    console.log(nluPass ? '  ✓ ĐẠT!' : '  ✗ THẤT BẠI!', JSON.stringify(nluResult));
    results.push({ intent: 'NLU Phân tích đa ràng buộc', pass: nluPass, details: nluResult });

    // -------------------------------------------------------------------------
    // TEST INTENT 2: Corridor X-Ray tính toán km & ETA của điểm nguy cơ
    // -------------------------------------------------------------------------
    console.log('\n[Intent 2] Kiểm tra Corridor X-Ray (cumulativeMeters, atKm, etaMinutes)...');
    const xrayResult = await page.evaluate(async () => {
      const routing = window.routingService;
      const dummyCoords = [
        [21.0042, 105.8436],
        [21.0100, 105.8300],
        [21.0150, 105.8200],
        [21.0200, 105.8100],
        [21.0300, 105.8000]
      ];
      const dummyHazards = [
        {
          id: 'flood-1',
          lat: 21.0102,
          lng: 105.8298,
          street: 'Thái Hà',
          depth: 35,
          type: 'flood'
        }
      ];

      const passability = routing.checkRoutePassability(dummyCoords, dummyHazards, [], 60);
      return {
        isPassable: passability.isPassable,
        blockedReasons: passability.blockedReasons,
        blockedCount: passability.blockedBy ? passability.blockedBy.length : 0,
        firstBlocked: passability.blockedBy && passability.blockedBy[0] ? {
          hazard: passability.blockedBy[0].street,
          atKm: passability.blockedBy[0].atKm,
          etaMinutes: passability.blockedBy[0].etaMinutes,
          cumulativeMeters: passability.blockedBy[0].cumulativeMeters
        } : null
      };
    });

    const xrayPass = !xrayResult.isPassable &&
      xrayResult.firstBlocked &&
      typeof xrayResult.firstBlocked.atKm === 'number' &&
      typeof xrayResult.firstBlocked.etaMinutes === 'number' &&
      xrayResult.firstBlocked.atKm > 0;

    console.log(xrayPass ? '  ✓ ĐẠT!' : '  ✗ THẤT BẠI!', JSON.stringify(xrayResult));
    results.push({ intent: 'Corridor X-Ray km & ETA', pass: xrayPass, details: xrayResult });

    // -------------------------------------------------------------------------
    // TEST INTENT 3: Gợi ý POI dọc hành trình (Spatial RAG Along-Corridor Projection)
    // -------------------------------------------------------------------------
    console.log('\n[Intent 3] Kiểm tra Spatial RAG Along-Corridor Projection (minDetourKm, corridorTag)...');
    const ragResult = await page.evaluate(async () => {
      const poly = [
        [21.0042, 105.8436],
        [21.0150, 105.8430],
        [21.0250, 105.8420],
        [21.0350, 105.8400]
      ];
      window.appState.currentRoute = {
        distance: 8.5,
        duration: 25,
        summary: 'Tuyến qua Giải Phóng - Lê Duẩn',
        polyline: poly,
        coordinates: poly
      };
      window.appState.lastRouteResult = {
        routes: [window.appState.currentRoute]
      };

      if (window.FOOD_ENTERTAINMENT_DATA && window.FOOD_ENTERTAINMENT_DATA.AREAS_GUIDE) {
        if (!window.FOOD_ENTERTAINMENT_DATA.AREAS_GUIDE.cau_giay) {
          window.FOOD_ENTERTAINMENT_DATA.AREAS_GUIDE.cau_giay = {
            aliases: ['cầu giấy', 'cau giay'],
            title: 'Khu vực Cầu Giấy',
            spots: []
          };
        }
        window.FOOD_ENTERTAINMENT_DATA.AREAS_GUIDE.cau_giay.spots.unshift({
          name: 'Cafe Dọc Đường Test',
          lat: 21.0150,
          lng: 105.8430,
          category: 'cafe',
          address: 'Gần Lê Duẩn'
        });
      }

      const rag = await window.aiChat.prepareSpatialRagAndSafety('tìm quán cafe tiện đường');
      const nearSpot = rag.verifiedSpots && rag.verifiedSpots.find(s => s.name === 'Cafe Dọc Đường Test');

      return {
        hasVerifiedSpots: Array.isArray(rag.verifiedSpots),
        spotsCount: rag.verifiedSpots ? rag.verifiedSpots.length : 0,
        nearSpotCorridor: nearSpot ? {
          name: nearSpot.name,
          isAlongCorridor: nearSpot.isAlongCorridor,
          corridorTag: nearSpot.corridorTag,
          minDetourKm: nearSpot.minDetourKm,
          alongKm: nearSpot.alongKm
        } : null
      };
    });

    const ragPass = ragResult.hasVerifiedSpots &&
      ragResult.nearSpotCorridor &&
      ragResult.nearSpotCorridor.isAlongCorridor === true &&
      ragResult.nearSpotCorridor.corridorTag &&
      ragResult.nearSpotCorridor.corridorTag.includes('Thuận đường');

    console.log(ragPass ? '  ✓ ĐẠT!' : '  ✗ THẤT BẠI!', JSON.stringify(ragResult));
    results.push({ intent: 'Spatial RAG Along-Corridor Projection', pass: ragPass, details: ragResult });

    // -------------------------------------------------------------------------
    // TEST INTENT 4: Điểm dừng 1-Chạm (insertWaypointToRoute) & 3-Waypoint Routing
    // -------------------------------------------------------------------------
    console.log('\n[Intent 4] Kiểm tra chèn điểm dừng 1-chạm (insertWaypointToRoute) & 3-Waypoint Routing...');
    const waypointResult = await page.evaluate(async () => {
      window.appState.routeLocations = {
        origin: { lat: 21.0042, lng: 105.8436, title: 'Đại học Bách Khoa', fullAddress: 'Đại học Bách Khoa' },
        destination: { lat: 21.0333, lng: 105.8145, title: 'Công viên Thủ Lệ', fullAddress: 'Công viên Thủ Lệ' }
      };

      await window.appState.insertWaypointToRoute(21.0150, 105.8300, 'Quán Cafe Tiện Đường');

      const hasViaMarker = !!window.appState._viaWaypointMarker;
      const currentVia = window.appState.currentViaWaypoint;
      const routes = window.appState.lastRouteResult?.routes || [];
      const hasMultiRoutes = routes.length > 0;

      return {
        hasViaMarker,
        currentVia,
        hasMultiRoutes,
        routeCount: routes.length,
        primarySummary: routes[0]?.summary || null
      };
    });

    const waypointPass = waypointResult.hasViaMarker &&
      waypointResult.currentVia &&
      waypointResult.currentVia.title === 'Quán Cafe Tiện Đường' &&
      waypointResult.hasMultiRoutes;

    console.log(waypointPass ? '  ✓ ĐẠT!' : '  ✗ THẤT BẠI!', JSON.stringify(waypointResult));
    results.push({ intent: 'Điểm dừng 1-Chạm & 3-Waypoint Routing', pass: waypointPass, details: waypointResult });

    // -------------------------------------------------------------------------
    // TEST INTENT 5: Hiệu ứng Radar Pulse định vị điểm nguy cơ trên bản đồ
    // -------------------------------------------------------------------------
    console.log('\n[Intent 5] Kiểm tra hiệu ứng Radar Pulse định vị nguy cơ (focusAndPulseHazardOnMap)...');
    const pulseResult = await page.evaluate(() => {
      window.appState.focusAndPulseHazardOnMap(21.0123, 105.8234, 'Điểm ngập Thái Hà 40cm');
      const pulseMarker = window.appState._chatPulseMarker;
      const domPulse = document.querySelector('.gm-radar-ring') || document.querySelector('.gm-spatial-radar-icon');
      return {
        hasPulseMarker: !!pulseMarker,
        domElementExists: !!domPulse
      };
    });

    const pulsePass = pulseResult.hasPulseMarker && pulseResult.domElementExists;
    console.log(pulsePass ? '  ✓ ĐẠT!' : '  ✗ THẤT BẠI!', JSON.stringify(pulseResult));
    results.push({ intent: 'Radar Pulse định vị nguy cơ', pass: pulsePass, details: pulseResult });

    // -------------------------------------------------------------------------
    // TEST INTENT 6: Gợi ý nhanh thích ứng theo ngữ cảnh (updateDynamicQuickPrompts)
    // -------------------------------------------------------------------------
    console.log('\n[Intent 6] Kiểm tra cập nhật Dynamic Quick Prompts theo lộ trình...');
    const promptResult = await page.evaluate(() => {
      window.aiChat.updateDynamicQuickPrompts();
      const container = document.getElementById('ai-quick-prompts');
      const buttons = container ? Array.from(container.querySelectorAll('.gm-ai-prompt-chip, button')) : [];
      const texts = buttons.map(b => b.innerText.trim());
      return {
        btnCount: buttons.length,
        texts: texts
      };
    });

    const promptPass = promptResult.btnCount >= 3 &&
      promptResult.texts.some(t => t.includes('tuyến đường') || t.includes('trú mưa') || t.includes('cafe') || t.includes('Tình hình') || t.includes('lộ trình'));

    console.log(promptPass ? '  ✓ ĐẠT!' : '  ✗ THẤT BẠI!', JSON.stringify(promptResult));
    results.push({ intent: 'Dynamic Contextual Quick Prompts', pass: promptPass, details: promptResult });

    // -------------------------------------------------------------------------
    // TỔNG KẾT
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    const allPass = results.every(r => r.pass);
    console.log(`KẾT QUẢ ADAPTIVE E2E TEST: ${results.filter(r => r.pass).length}/${results.length} PASS`);
    console.log(`TRẠNG THÁI CHUNG: ${allPass ? 'PASS (100%)' : 'FAIL'}`);
    console.log('===============================================================');

  } catch (err) {
    console.error('Lỗi khi chạy Adaptive E2E Test:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

runAiCopilotUpgradeTests();
