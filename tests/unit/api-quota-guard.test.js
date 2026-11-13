/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: UNIT TESTING
 * Module: API Quota Guard, Circuit Breaker, Dedup & Cache Protection
 * Reference Prefix: TC-QTA
 * ============================================================================
 */

process.env.BOT_DISABLE_AUTO_INIT = '1';

const { describe, it, afterEach } = require('node:test');
const assert = require('assert');
const http = require('http');
const axios = require('axios');

const { ApiQuotaGuard, apiQuotaGuard, parseKeyPool } = require('../../server/api-quota-guard');
const config = require('../../server/config');
const { GeocodingService } = require('../../js/geocoding-service');
const WeatherService = require('../../js/weather-service');
const app = require('../../server/server');

describe('Module TC-QTA: API Key Quota Protection & Caching', () => {
  const originalFetch = global.fetch;
  const originalAxiosGet = axios.get;

  afterEach(() => {
    global.fetch = originalFetch;
    axios.get = originalAxiosGet;
    apiQuotaGuard.keyCooldowns.clear();
    apiQuotaGuard.cache.clear();
    apiQuotaGuard.inflight.clear();
  });

  it('[TC-QTA-001] parseKeyPool parses multi-separator env pools and deduplicates cleanly', () => {
    const pool = parseKeyPool('keyA, keyB;keyC\nkeyA', '  "keyD"  ', ['keyB', 'keyE']);
    assert.deepStrictEqual(pool, ['keyA', 'keyB', 'keyC', 'keyD', 'keyE']);
  });

  it('[TC-QTA-002] ApiQuotaGuard rotates keys and applies cooldown circuit breaker on 403/429 without exposing secrets', () => {
    const guard = new ApiQuotaGuard();
    const keys = ['secret-key-one-1234', 'secret-key-two-5678'];

    assert.strictEqual(guard.getHealthyKey('tomtom', keys), 'secret-key-one-1234');
    const cooldownMs = guard.markRateLimited('tomtom', 'secret-key-one-1234', 429, '1200');
    assert.ok(cooldownMs >= 1200 * 1000, 'Should respect Retry-After seconds');

    assert.strictEqual(guard.isKeyBlocked('tomtom', 'secret-key-one-1234'), true);
    assert.strictEqual(guard.getHealthyKey('tomtom', keys), 'secret-key-two-5678');
    assert.deepStrictEqual(guard.getHealthyKeys('tomtom', keys), ['secret-key-two-5678']);

    guard.markRateLimited('tomtom', 'secret-key-two-5678', 403);
    assert.strictEqual(guard.getHealthyKey('tomtom', keys), null);

    const stats = guard.getStats();
    assert.strictEqual(stats.activeCooldowns.length, 2);
    const serialized = JSON.stringify(stats);
    assert.strictEqual(serialized.includes('secret-key-one'), false, 'Stats must not expose raw API keys');
    assert.strictEqual(serialized.includes('secret-key-two'), false, 'Stats must not expose raw API keys');
  });

  it('[TC-QTA-003] ApiQuotaGuard.withDedupAndCache deduplicates concurrent calls and expires after TTL', async () => {
    const guard = new ApiQuotaGuard();
    let invocations = 0;

    const fetcher = async () => {
      invocations += 1;
      await new Promise(resolve => setTimeout(resolve, 20));
      return { ok: true, count: invocations };
    };

    const [r1, r2, r3] = await Promise.all([
      guard.withDedupAndCache('shared:op', 60, fetcher),
      guard.withDedupAndCache('shared:op', 60, fetcher),
      guard.withDedupAndCache('shared:op', 60, fetcher)
    ]);

    assert.strictEqual(invocations, 1, 'Concurrent callers must share a single underlying fetch');
    assert.strictEqual(r1.value.count, 1);
    assert.strictEqual(r2.value.count, 1);
    assert.strictEqual(r3.cached, true);

    await new Promise(resolve => setTimeout(resolve, 80));
    const r4 = await guard.withDedupAndCache('shared:op', 60, fetcher);
    assert.strictEqual(invocations, 2, 'Expired cache entry must re-fetch after TTL');
    assert.strictEqual(r4.cached, false);
  });

  it('[TC-QTA-004] GeocodingService serves exact local matches with 0 network calls and obeys TomTom cooldown & dedup', async () => {
    const geo = new GeocodingService();
    let fetchCalls = 0;
    const requestedUrls = [];

    global.fetch = async (url) => {
      fetchCalls += 1;
      requestedUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [], features: [] })
      };
    };

    // Exact/high-score local district & street match should exit early with 0 external calls
    const localHits = await geo.searchAddresses('Cầu Giấy', { city: 'hanoi', limit: 2, isAutocomplete: true });
    assert.ok(localHits.length >= 1, 'Should resolve local index match');
    assert.strictEqual(fetchCalls, 0, 'Local exact/autocomplete hit should make 0 external fetch calls');

    // Marking TomTom rate limited stops searchViaTomTom completely
    geo.markTomTomRateLimited(429);
    assert.strictEqual(geo.isTomTomCoolingDown(), true);
    const blockedRes = await geo.searchViaTomTom('Phố Chùa Láng', { lat: 21.0285, lng: 105.8542 }, 5);
    assert.deepStrictEqual(blockedRes, []);
    assert.strictEqual(fetchCalls, 0, 'Cooldown must skip TomTom network calls completely');

    // Reset cooldown & verify in-flight deduplication for uncached query
    geo._ttCooldownUntil = 0;
    requestedUrls.length = 0;
    global.fetch = async (url) => {
      requestedUrls.push(String(url));
      await new Promise(r => setTimeout(r, 25));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          results: [],
          candidates: [],
          features: []
        })
      };
    };

    await Promise.all([
      geo.searchAddresses('Ngách 19/82 Trần Duy Hưng Chưa Có', { city: 'hanoi', limit: 5 }),
      geo.searchAddresses('Ngách 19/82 Trần Duy Hưng Chưa Có', { city: 'hanoi', limit: 5 })
    ]);
    const googleCalls = requestedUrls.filter(u => u.includes('google-search')).length;
    assert.strictEqual(googleCalls, 1, `Concurrent searches must share 1 in-flight pipeline, got ${googleCalls} google calls`);
  });

  it('[TC-QTA-005] WeatherService caches getWeather for 10m and trips OpenWeatherMap circuit breaker onto Open-Meteo', async () => {
    const ws = new WeatherService();
    ws.setApiKey('fake-owm-key-for-test');

    let owmCalls = 0;
    let meteoCalls = 0;

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes('openweathermap.org')) {
        owmCalls += 1;
        return { ok: false, status: 429, json: async () => ({ message: 'Too Many Requests' }) };
      }
      if (target.includes('open-meteo.com')) {
        meteoCalls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            current: {
              temperature_2m: 28,
              apparent_temperature: 30,
              relative_humidity_2m: 75,
              wind_speed_10m: 11,
              rain: 0,
              weather_code: 1
            }
          })
        };
      }
      throw new Error(`Unexpected fetch URL: ${target}`);
    };

    // First call hits OWM (429 -> cooldown) then falls back to Open-Meteo
    const first = await ws.getWeather(21.0285, 105.8542, 'Hà Nội');
    assert.strictEqual(first.temp, 28);
    assert.strictEqual(ws.isOpenWeatherCoolingDown(), true);
    assert.strictEqual(owmCalls, 1);
    assert.strictEqual(meteoCalls, 1);

    // Second call for the same coordinates uses 10-min cache (0 additional calls)
    const second = await ws.getWeather(21.0285, 105.8542, 'Hà Nội');
    assert.strictEqual(second.temp, 28);
    assert.strictEqual(owmCalls, 1);
    assert.strictEqual(meteoCalls, 1);

    // Call for different coordinates while OWM is cooling down must bypass OWM and hit Open-Meteo directly
    const third = await ws.getWeather(10.7769, 106.6811, 'TP. Hồ Chí Minh');
    assert.strictEqual(third.temp, 28);
    assert.strictEqual(owmCalls, 1, 'OpenWeatherMap must not be called while cooling down');
    assert.strictEqual(meteoCalls, 2);
  });

  it('[TC-QTA-006] Server exposes quotaStatus in /api/config and caches /api/geocode/tomtom-* proxies', async () => {
    const origPool = [...(config.API_KEY_POOLS?.tomtom || [])];
    if (!config.API_KEY_POOLS.tomtom || config.API_KEY_POOLS.tomtom.length === 0) {
      config.API_KEY_POOLS.tomtom = ['test-tomtom-pool-key'];
    }

    let upstreamTomTomCalls = 0;
    axios.get = async (url) => {
      upstreamTomTomCalls += 1;
      if (String(url).includes('reverseGeocode')) {
        return {
          data: {
            addresses: [{
              position: '21.0285,105.8542',
              address: { streetName: 'Đinh Tiên Hoàng', freeformAddress: 'Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội' }
            }]
          }
        };
      }
      return {
        data: {
          results: [{
            id: 'poi-1',
            poi: { name: 'Hồ Hoàn Kiếm Mock' },
            address: { freeformAddress: 'Hoàn Kiếm, Hà Nội' },
            position: { lat: 21.0285, lon: 105.8542 }
          }]
        }
      };
    };

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const cfg = await (await originalFetch(`${baseUrl}/api/config`)).json();
      assert.strictEqual(typeof cfg.quotaStatus, 'object');
      assert.strictEqual(typeof cfg.quotaStatus.cacheEntries, 'number');

      const search1 = await (await originalFetch(`${baseUrl}/api/geocode/tomtom-search?q=Ho%20Guom&lat=21.0285&lng=105.8542`)).json();
      assert.strictEqual(search1.status, 'success');
      assert.strictEqual(search1.cached, false);
      assert.strictEqual(search1.results.length, 1);

      const search2 = await (await originalFetch(`${baseUrl}/api/geocode/tomtom-search?q=Ho%20Guom&lat=21.0285&lng=105.8542`)).json();
      assert.strictEqual(search2.status, 'success');
      assert.strictEqual(search2.cached, true);
      assert.strictEqual(upstreamTomTomCalls, 1, 'Second search request must hit shared server cache');

      const rev1 = await (await originalFetch(`${baseUrl}/api/geocode/tomtom-reverse?lat=21.0285&lng=105.8542`)).json();
      const rev2 = await (await originalFetch(`${baseUrl}/api/geocode/tomtom-reverse?lat=21.0285&lng=105.8542`)).json();
      assert.strictEqual(rev1.status, 'success');
      assert.strictEqual(rev2.cached, true);
      assert.strictEqual(upstreamTomTomCalls, 2, 'Second reverse request must hit shared server cache');

      const near1 = await (await originalFetch(`${baseUrl}/api/geocode/tomtom-nearby?lat=21.0285&lng=105.8542&categorySet=7315`)).json();
      const near2 = await (await originalFetch(`${baseUrl}/api/geocode/tomtom-nearby?lat=21.0285&lng=105.8542&categorySet=7315`)).json();
      assert.strictEqual(near1.status, 'success');
      assert.strictEqual(near2.cached, true);
      assert.strictEqual(upstreamTomTomCalls, 3, 'Second nearby request must hit shared server cache');
    } finally {
      config.API_KEY_POOLS.tomtom = origPool;
      await new Promise(resolve => server.close(resolve));
    }
  });
});
