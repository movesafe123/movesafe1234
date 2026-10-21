/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: INTEGRATION & API TESTING
 * Module: Backend Express REST API & Security Middleware
 * Reference Prefix: TC-API (Application Programming Interface)
 * ============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const app = require('../../server/server');

describe('Module TC-API: Backend REST API & Security Architecture', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TC-API-001: Kiểm tra cấu hình công khai an toàn, không lộ secret keys
  it('[TC-API-001] GET /api/config returns public configuration without exposing private secrets', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.ok(body.apiKeys, 'Must have apiKeys object');
    assert.strictEqual(typeof body.apiKeys.hasOpenWeather, 'boolean');
    assert.strictEqual(typeof body.apiKeys.hasGemini, 'boolean');
    assert.ok(body.cities, 'Must contain supported cities config');
    assert.ok(body.cities.hanoi && body.cities.hcm && body.cities.danang);
  });

  // TC-API-002: Kiểm tra dữ liệu thời gian thực tổng hợp từ Bot
  it('[TC-API-002] GET /api/live-data provides multi-source urban flood and traffic data', async () => {
    const res = await fetch(`${baseUrl}/api/live-data`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.ok(body.data, 'Must contain data payload');
    assert.ok(Array.isArray(body.data.floodPoints), 'Flood points must be an array');
    assert.ok(Array.isArray(body.data.trafficIncidents), 'Traffic incidents must be an array');
    assert.ok(body.data.weatherStations, 'Weather stations must be mapped');
  });

  // TC-API-003: Kiểm tra API lịch sử quan trắc chuỗi thời gian 7 ngày (Rolling time-series)
  it('[TC-API-003] GET /api/history returns 7-day rolling time-series records', async () => {
    const res = await fetch(`${baseUrl}/api/history?city=hanoi&days=7`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.city, 'hanoi');
    assert.ok(Array.isArray(body.timeSeries), 'TimeSeries must be an array');
    assert.ok(body.summary, 'Summary stats must exist');
  });

  // TC-API-004: Kiểm tra API dự báo tương lai (+1h, +2h, +3h)
  it('[TC-API-004] GET /api/predictions delivers AI forecast with target hours', async () => {
    const res = await fetch(`${baseUrl}/api/predictions?city=hanoi&offset=2`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.targetHour, 2);
    assert.ok(Array.isArray(body.floods) || Array.isArray(body.floodPredictions));
    assert.ok(Array.isArray(body.traffic) || Array.isArray(body.trafficPredictions));

    // Thử offset ngoài phạm vi (offset=10) phải tự động clamp về tối đa 3h
    const clampedRes = await fetch(`${baseUrl}/api/predictions?city=hanoi&offset=10`);
    const clampedBody = await clampedRes.json();
    assert.strictEqual(clampedBody.targetHour, 3, 'Offset > 3 must be clamped to 3');
  });

  // TC-API-005: Kiểm tra API mạng lưới trạm sạc xe điện EV
  it('[TC-API-005] GET /api/ev-stations returns EV charging stations with fast charger filter', async () => {
    const resAll = await fetch(`${baseUrl}/api/ev-stations?city=hanoi`);
    assert.strictEqual(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.strictEqual(bodyAll.status, 'success');
    assert.ok(bodyAll.count > 0, 'Should return non-empty EV stations for Hanoi');

    // Lọc chỉ trạm sạc nhanh (fastOnly=true)
    const resFast = await fetch(`${baseUrl}/api/ev-stations?city=hanoi&fastOnly=true`);
    assert.strictEqual(resFast.status, 200);
    const bodyFast = await resFast.json();
    assert.strictEqual(bodyFast.status, 'success');
    assert.ok(bodyFast.count <= bodyAll.count, 'Fast stations count must be <= all stations');
    if (bodyFast.data.length > 0) {
      assert.strictEqual(bodyFast.data[0].isFastCharge, true);
    }
  });

  // TC-API-006: Kiểm tra gửi báo cáo sự cố cộng đồng hợp lệ
  it('[TC-API-006] POST /api/crowdsource/report accepts and stores valid user reports', async () => {
    const validReport = {
      type: 'flood',
      severity: 'half_wheel',
      depth_cm: 25,
      lat: 21.0285,
      lng: 105.8542,
      locationName: 'Ngã tư Tràng Tiền - Hàng Bài',
      description: 'Nước ngập nửa bánh xe máy, xe gầm thấp di chuyển chậm'
    };

    const res = await fetch(`${baseUrl}/api/crowdsource/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReport)
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.ok(body.report && body.report.id, 'Report must be assigned an ID');
    assert.strictEqual(body.report.depth_cm, 25);
  });

  // TC-API-007: Kiểm tra xác thực dữ liệu đầu vào (Validation guard)
  it('[TC-API-007] POST /api/crowdsource/report rejects invalid/missing coordinates with HTTP 400', async () => {
    const invalidReport = {
      type: 'flood',
      lat: 'invalid_lat', // Tọa độ không hợp lệ
      lng: 105.8542,
      description: 'Test invalid'
    };

    const res = await fetch(`${baseUrl}/api/crowdsource/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidReport)
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.status, 'error');
    assert.ok(body.message.includes('tọa độ'));
  });

  // TC-API-008: Kiểm tra xác thực bình chọn sự cố cộng đồng
  it('[TC-API-008] POST /api/crowdsource/vote validates vote types and IDs', async () => {
    // Vote type không hợp lệ
    const resInvalidVote = await fetch(`${baseUrl}/api/crowdsource/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'any-id', voteType: 'spam_fake_action' })
    });

    assert.strictEqual(resInvalidVote.status, 400);
    const body = await resInvalidVote.json();
    assert.strictEqual(body.status, 'error');
  });

  // TC-API-009: Bảo mật Whitelist: Từ chối truy cập file nhạy cảm và dotfiles
  it('[TC-API-009] Security Whitelist denies access to dotfiles like .env and .git', async () => {
    const resDotEnv = await fetch(`${baseUrl}/.env`);
    assert.notStrictEqual(resDotEnv.status, 200, 'Must NOT serve .env file');

    const resDotGit = await fetch(`${baseUrl}/.git/config`);
    assert.notStrictEqual(resDotGit.status, 200, 'Must NOT serve .git files');
  });

  // TC-API-010: Khả năng tự phục vụ giao diện chính và manifest PWA
  it('[TC-API-010] GET / and /manifest.json serve application shell and PWA manifest', async () => {
    const resHome = await fetch(`${baseUrl}/`);
    assert.strictEqual(resHome.status, 200);
    const html = await resHome.text();
    assert.ok(html.includes('MoveSafe VN'), 'Index HTML must include title MoveSafe VN');
    assert.ok(html.includes('id="map-container"'), 'Must contain map element');

    const resManifest = await fetch(`${baseUrl}/manifest.json`);
    assert.strictEqual(resManifest.status, 200);
    const manifest = await resManifest.json();
    assert.strictEqual(manifest.name, 'MoveSafe VN - Hệ Thống Điều Phối & Tránh Ngập Đô Thị Thông Minh');
    assert.strictEqual(manifest.display, 'standalone');
  });
});
