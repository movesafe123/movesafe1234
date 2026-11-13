/**
 * ev-service.js - Dịch vụ Quản lý & Đồng bộ Trạm sạc Xe điện MoveSafe VN
 * Nguồn sự thật duy nhất (Single Source of Truth): data/ev_stations_cache.json
 * Hợp nhất: Kho thực địa đối chiếu EVCS.VN + Open Charge Map API v3 + TomTom EV Search API (Cache TTL 6h)
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const systemLogger = require('./system-logger');

function normalizeNFCDeep(val) {
  if (typeof val === 'string') return val.normalize('NFC');
  if (Array.isArray(val)) return val.map(normalizeNFCDeep);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = normalizeNFCDeep(v);
    }
    return out;
  }
  return val;
}

function calcHaversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class EVService {
  constructor() {
    this.apiKey = config.API_KEYS.OPEN_CHARGE_MAP || 'ef996480-7ae1-4c38-adef-acfd69ace0d6';
    this.tomtomKey = config.API_KEYS.TOMTOM || '';
    this.rootDir = path.join(__dirname, '..');
    this.cacheDir = path.join(this.rootDir, 'data');
    this.publicCacheDir = path.join(this.rootDir, 'public', 'data');
    this.cacheFile = path.join(this.cacheDir, 'ev_stations_cache.json');
    this.stations = [];
    this.lastSyncTime = 0;
    this.lastManualSyncAt = 0;
    this.SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // Đồng bộ tối đa mỗi 6 giờ để bảo vệ quota TomTom

    // Tải dữ liệu từ cache lúc khởi động
    this.loadFromCache();
  }

  // Tải dữ liệu đệm từ ổ cứng (Single Source of Truth: data/ev_stations_cache.json)
  loadFromCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.stations = parsed.map(normalizeNFCDeep);
          if (this.stations.length >= 170) {
            try {
              const stat = fs.statSync(this.cacheFile);
              this.lastSyncTime = stat.mtimeMs || Date.now();
            } catch (_e) {
              this.lastSyncTime = Date.now();
            }
          }
          console.log(`[EVService] Đã nạp ${this.stations.length} trạm sạc xe điện từ cache cục bộ.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[EVService] Không thể đọc cache trạm sạc:', err.message);
    }

    // Nếu chưa có file cache, tạo dữ liệu khởi tạo
    this.stations = this.getCuratedStations().map(normalizeNFCDeep);
    this.saveToCache();
  }

  // Lưu dữ liệu vào cache JSON duy nhất và tự động đồng bộ các bundle .js / public/
  saveToCache() {
    try {
      if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
      if (!fs.existsSync(this.publicCacheDir)) fs.mkdirSync(this.publicCacheDir, { recursive: true });

      const cleanStations = this.stations.map(normalizeNFCDeep);
      this.stations = cleanStations;

      const jsonStr = (JSON.stringify(cleanStations, null, 2) + '\n').normalize('NFC');
      fs.writeFileSync(this.cacheFile, jsonStr, 'utf8');
      fs.writeFileSync(path.join(this.publicCacheDir, 'ev_stations_cache.json'), jsonStr, 'utf8');

      // Tự động sinh lại các bundle JS để Client & Server đọc chung 1 nguồn dữ liệu sạch
      const header = `/**\n * MoveSafe VN - Dữ liệu Mạng lưới Trạm sạc Xe điện & e-Scooter Toàn quốc (${cleanStations.length} trạm)\n * Tự động đồng bộ từ Nguồn Sự Thật Duy Nhất: data/ev_stations_cache.json\n */\n`;
      const jsPayload = `${header}(function() {\n  var evStations = ${JSON.stringify(cleanStations, null, 2)};\n  if (typeof window !== 'undefined') {\n    window.MOVE_SAFE_EV_STATIONS = evStations;\n  }\n  if (typeof module !== 'undefined' && module.exports) {\n    module.exports = evStations;\n  }\n})();\n`.normalize('NFC');

      const jsTargets = [
        path.join(this.rootDir, 'js', 'ev-stations-data.js'),
        path.join(this.rootDir, 'public', 'js', 'ev-stations-data.js'),
        path.join(this.rootDir, 'server', 'ev-stations-data.js')
      ];
      for (const target of jsTargets) {
        const dir = path.dirname(target);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(target, jsPayload, 'utf8');
      }
    } catch (e) {
      console.warn('[EVService] Lỗi ghi cache trạm sạc:', e.message);
    }
  }

  // Phân loại thành phố từ tọa độ
  inferCity(lat, lng) {
    if (lat >= 20.5 && lat <= 21.6 && lng >= 105.3 && lng <= 106.3) return 'hanoi';
    if (lat >= 15.7 && lat <= 16.5 && lng >= 107.8 && lng <= 108.6) return 'danang';
    if (lat >= 10.3 && lat <= 11.3 && lng >= 106.2 && lng <= 107.3) return 'hcm';
    return 'hanoi';
  }

  // Gọi trực tiếp Open Charge Map API v3 với API Key
  async fetchFromOpenChargeMap() {
    if (!this.apiKey) {
      console.warn('[EVService] Chưa cấu hình OPEN_CHARGE_MAP_KEY.');
      return [];
    }

    try {
      const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=VN&maxresults=500&compact=true&verbose=false&key=${this.apiKey}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MoveSafeVN/1.0',
          'X-API-Key': this.apiKey
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        console.warn(`[EVService] Open Charge Map API trả về mã lỗi ${res.status}`);
        return [];
      }

      const ocmList = await res.json();
      if (!Array.isArray(ocmList)) return [];

      console.log(`[EVService] Đã nhận ${ocmList.length} trạm sạc từ Open Charge Map API.`);

      return ocmList
        .filter(item => item?.AddressInfo && Number.isFinite(item.AddressInfo.Latitude) && Number.isFinite(item.AddressInfo.Longitude))
        .map(item => {
          const addr = item.AddressInfo || {};
          const lat = Number(addr.Latitude);
          const lng = Number(addr.Longitude);
          const conns = item.Connections || [];

          let maxPower = 0;
          let isFast = false;
          const connectors = conns.map(c => {
            const pKw = Number(c.PowerKW) || 0;
            if (pKw > maxPower) maxPower = pKw;
            const isDc = (c.CurrentType && c.CurrentType.Title && c.CurrentType.Title.includes('DC')) || pKw >= 50;
            if (isDc || pKw >= 50) isFast = true;

            return {
              type: c.ConnectionType ? c.ConnectionType.Title : 'Cổng sạc chuẩn',
              powerKw: pKw || 22,
              current: isDc ? 'DC' : 'AC',
              quantity: c.Quantity || 1
            };
          });

          if (maxPower === 0) {
            maxPower = isFast ? 60 : 22;
          }

          const operatorTitle = item.OperatorInfo ? item.OperatorInfo.Title : '';
          const name = addr.Title || 'Trạm sạc xe điện';

          let brand = 'EVOne';
          if (name.includes('VinFast') || name.includes('Vincom') || operatorTitle.includes('VinFast')) {
            brand = 'VinFast';
          } else if (name.includes('Porsche') || operatorTitle.includes('Porsche')) {
            brand = 'Porsche';
          } else if (name.includes('Selex')) {
            brand = 'Selex Motors';
          } else if (name.includes('Eboost')) {
            brand = 'Eboost';
          } else if (operatorTitle && !operatorTitle.includes('Unknown')) {
            brand = operatorTitle;
          }

          const isEscooter = /selex|e-scooter|escooter|xe máy điện|đổi pin/i.test(`${name} ${brand}`);

          return normalizeNFCDeep({
            id: `ocm-${item.ID}`,
            name: name,
            operator: brand,
            address: addr.AddressLine1 || addr.Title || 'Việt Nam',
            town: addr.Town || addr.StateOrProvince || '',
            city: this.inferCity(lat, lng),
            lat: lat,
            lng: lng,
            isOperational: item.StatusType ? item.StatusType.IsOperational !== false : true,
            statusText: item.StatusType ? (item.StatusType.Title || 'Đang hoạt động') : 'Đang hoạt động',
            maxPowerKw: maxPower,
            isFastCharge: isFast || maxPower >= 50,
            totalPoints: item.NumberOfPoints || connectors.reduce((sum, c) => sum + (c.quantity || 1), 0) || 4,
            vehicleTypes: isEscooter ? ['ecar', 'ebike'] : ['ecar'],
            supportsEscooter: isEscooter,
            connectors: connectors.length > 0 ? connectors : [
              { type: 'CCS (Type 2)', powerKw: maxPower, current: isFast ? 'DC' : 'AC', quantity: 2 }
            ],
            source: 'Open Charge Map API (Live)',
            lastUpdated: item.DateLastStatusUpdate || new Date().toISOString()
          });
        });
    } catch (err) {
      console.warn('[EVService] Lỗi gọi Open Charge Map API:', err.message);
      return [];
    }
  }

  // Gọi TomTom Search EV API tiết kiệm quota (chỉ ~5 request cho mỗi chu kỳ cache 6 giờ)
  async fetchFromTomTomEV() {
    if (!this.tomtomKey) {
      return [];
    }

    const hubs = [
      { label: 'Hà Nội EV Category', kind: 'category', lat: 21.0285, lon: 105.8542, radius: 35000, path: 'categorySearch/electric%20vehicle%20station.json' },
      { label: 'Hà Nội VinFast EV', kind: 'poi', lat: 21.0285, lon: 105.8542, radius: 35000, path: 'poiSearch/Tr%E1%BA%A1m%20s%E1%BA%A1c%20VinFast.json' },
      { label: 'Xuân Mai - Hòa Lạc EV', kind: 'poi', lat: 20.9100, lon: 105.6200, radius: 25000, path: 'poiSearch/Tr%E1%BA%A1m%20s%E1%BA%A1c%20VinFast.json' },
      { label: 'TP.HCM EV Category', kind: 'category', lat: 10.7769, lon: 106.7009, radius: 35000, path: 'categorySearch/electric%20vehicle%20station.json' },
      { label: 'Đà Nẵng EV Category', kind: 'category', lat: 16.0544, lon: 108.2022, radius: 25000, path: 'categorySearch/electric%20vehicle%20station.json' }
    ];

    const collected = [];
    const seenIds = new Set();

    for (const hub of hubs) {
      try {
        const u = new URL(`https://api.tomtom.com/search/2/${hub.path}`);
        u.searchParams.set('key', this.tomtomKey);
        u.searchParams.set('countrySet', 'VN');
        u.searchParams.set('lat', String(hub.lat));
        u.searchParams.set('lon', String(hub.lon));
        u.searchParams.set('radius', String(hub.radius));
        u.searchParams.set('limit', '100');

        const res = await fetch(u.toString(), { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const data = await res.json();
        const results = Array.isArray(data.results) ? data.results : [];

        for (const item of results) {
          if (!item?.id || seenIds.has(item.id)) continue;
          const pos = item.position || {};
          const lat = Number(pos.lat);
          const lng = Number(pos.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const poiName = String(item.poi?.name || 'Trạm sạc EV').trim();
          const addrText = String(item.address?.freeformAddress || poiName).trim();
          const lowerName = poiName.toLowerCase();

          // Với poiSearch, loại bỏ cửa hàng xăng dầu thuần túy hoặc showroom không ghi rõ sạc/đổi pin
          if (hub.kind === 'poi') {
            const looksLikeCharger = /(sạc|sac|đổi pin|doi pin|charging|ev one|porsche|eboost|v-green)/i.test(poiName) ||
              (/vinfast/i.test(poiName) && !/(đại lý|showroom|bán xe|sửa chữa)/i.test(poiName));
            if (!looksLikeCharger || /trạm xăng/i.test(lowerName)) continue;
          }

          seenIds.add(item.id);
          const isEscooter = /đổi pin|xe máy điện|escooter|selex|eboost/i.test(`${poiName} ${addrText}`);
          let operator = 'TomTom EV Network';
          if (/vinfast/i.test(poiName)) operator = 'VinFast';
          else if (/ev one/i.test(poiName)) operator = 'EV ONE';
          else if (/porsche/i.test(poiName)) operator = 'Porsche';
          else if (/selex/i.test(poiName)) operator = 'Selex Motors';

          const maxKw = isEscooter ? 11 : 60;
          collected.push(normalizeNFCDeep({
            id: `tt-${item.id}`,
            name: poiName,
            operator: operator,
            address: addrText,
            city: this.inferCity(lat, lng),
            lat: lat,
            lng: lng,
            isOperational: true,
            statusText: 'Đang hoạt động 24/7',
            maxPowerKw: maxKw,
            isFastCharge: maxKw >= 50,
            totalPoints: 4,
            vehicleTypes: isEscooter ? ['ebike', 'ecar'] : ['ecar'],
            supportsEscooter: isEscooter,
            connectors: [
              { type: isEscooter ? 'e-Scooter / Đổi pin' : 'CCS2 DC / Type 2', powerKw: maxKw, current: maxKw >= 50 ? 'DC' : 'AC', quantity: 4 }
            ],
            accessComments: `Đồng bộ tự động từ TomTom EV Search (${hub.label})`,
            source: 'TomTom EV Search API (Cached)',
            lastUpdated: new Date().toISOString()
          }));
        }
      } catch (err) {
        console.warn(`[EVService] TomTom EV fetch lỗi tại ${hub.label}:`, err.message);
      }
    }

    console.log(`[EVService] Đã nhận ${collected.length} trạm EV hợp lệ từ TomTom Search API.`);
    return collected;
  }

  // Danh mục trạm sạc tiêu chuẩn thực tế tại Việt Nam
  getCuratedStations() {
    try {
      const resolved = require.resolve('./ev-stations-data');
      delete require.cache[resolved];
    } catch (_e) {}
    return require('./ev-stations-data');
  }

  // Đồng bộ toàn diện với TTL 6 giờ: Cache JSON -> Curated -> OpenChargeMap -> TomTom EV
  async syncAllStations({ force = false } = {}) {
    const startMs = Date.now();
    const ageMs = Date.now() - (this.lastSyncTime || 0);

    if (!force && this.stations.length >= 170 && ageMs < this.SYNC_INTERVAL_MS) {
      systemLogger.record({
        category: 'ev',
        title: `Cache Hit Trạm sạc EV (${this.stations.length} trạm - TTL 6h còn hiệu lực)`,
        source: 'server/ev-service.js :: syncAllStations',
        durationMs: Date.now() - startMs,
        input: { force, cachedCount: this.stations.length, cacheAgeMinutes: Math.round(ageMs / 60000), ttlMinutes: 360 },
        steps: [
          {
            stepName: 'Kiểm tra TTL Cache (6 giờ)',
            formulaOrRule: 'ageMs < 6 * 3600 * 1000',
            detail: 'Bỏ qua gọi API ngoài để bảo toàn hạn mức 2.500 lượt/ngày của TomTom và giữ phản hồi 0ms.'
          }
        ],
        output: { usedCache: true, totalStations: this.stations.length, cacheFile: 'data/ev_stations_cache.json' }
      });
      return this.stations;
    }

    console.log('[EVService] Đang đồng bộ trạm sạc từ OpenChargeMap & TomTom EV Search (lưu Cache)...');
    const [liveOCM, liveTomTom] = await Promise.all([
      this.fetchFromOpenChargeMap(),
      this.fetchFromTomTomEV()
    ]);

    const curated = this.getCuratedStations();
    const mergedMap = new Map();

    // 1. Giữ nguyên kho cache hiện có & danh mục chuẩn hoá làm nền
    for (const st of [...this.stations, ...curated]) {
      if (st && st.id && Number.isFinite(st.lat) && Number.isFinite(st.lng)) {
        mergedMap.set(st.id, normalizeNFCDeep({ ...st }));
      }
    }

    let addedCount = 0;
    let enrichedCount = 0;

    const mergeIncoming = (incomingList, idField) => {
      for (const inc of incomingList) {
        let existingId = null;
        for (const [id, st] of mergedMap.entries()) {
          if (calcHaversineMeters(st.lat, st.lng, inc.lat, inc.lng) < 150) {
            existingId = id;
            break;
          }
        }

        if (existingId) {
          const existing = mergedMap.get(existingId);
          existing[idField] = inc.id;
          existing.lastUpdated = inc.lastUpdated;
          enrichedCount++;
        } else {
          mergedMap.set(inc.id, inc);
          addedCount++;
        }
      }
    };

    // 2. Hợp nhất và khử trùng lặp không gian <= 150m
    mergeIncoming(liveOCM, 'ocmId');
    mergeIncoming(liveTomTom, 'tomtomId');

    this.stations = Array.from(mergedMap.values());
    this.lastSyncTime = Date.now();
    this.saveToCache();

    console.log(`[EVService] Hoàn tất đồng bộ! Tổng ${this.stations.length} trạm (thêm mới: ${addedCount}, làm giàu: ${enrichedCount}).`);

    systemLogger.record({
      category: 'ev',
      title: `Đồng bộ & Lưu Cache Trạm sạc EV (${this.stations.length} trạm, +${addedCount} mới)`,
      source: 'server/ev-service.js :: syncAllStations',
      durationMs: Date.now() - startMs,
      input: {
        force,
        ocmFetched: liveOCM.length,
        tomtomFetched: liveTomTom.length,
        dedupRadiusMeters: 150
      },
      steps: [
        {
          stepName: 'Bước 1: Nạp nguồn nền (EVCS.VN verified + Cache cũ)',
          formulaOrRule: 'Seed from data/ev_stations_cache.json',
          detail: `Bảo toàn kho thực địa đã kiểm chứng.`
        },
        {
          stepName: 'Bước 2: Gọi API mở hợp lệ & Khử trùng lặp 150m',
          formulaOrRule: 'calcHaversineMeters(a, b) < 150m',
          detail: `Nhận ${liveOCM.length} trạm OpenChargeMap + ${liveTomTom.length} trạm TomTom EV; thêm mới ${addedCount} trạm, làm giàu ${enrichedCount} trạm trùng vùng.`
        },
        {
          stepName: 'Bước 3: Chuẩn hóa NFC & Đồng bộ Single Source of Truth',
          formulaOrRule: 'Unicode NFC -> data/ev_stations_cache.json -> js/ev-stations-data.js & public/',
          detail: `Ghi đồng nhất ${this.stations.length} trạm vào 1 nguồn JSON và tự động cập nhật bản Client.`
        }
      ],
      output: {
        totalStations: this.stations.length,
        addedCount,
        enrichedCount,
        cacheFile: 'data/ev_stations_cache.json'
      }
    });

    return this.stations;
  }

  // Lấy danh sách trạm sạc theo thành phố và bộ lọc
  getStations(city = 'all', fastOnly = false) {
    let result = this.stations;

    if (city && city !== 'all') {
      result = result.filter(s => s.city === city);
    }

    if (fastOnly) {
      result = result.filter(s => s.isFastCharge === true);
    }

    return result;
  }
}

// Singleton instance
const evService = new EVService();

// Tự động đồng bộ theo TTL cache (chỉ gọi API ngoài khi cache quá 6 giờ)
evService.syncAllStations({ force: false }).catch(err => {
  console.warn('[EVService] Lỗi chạy đồng bộ ban đầu:', err.message);
});

module.exports = evService;
