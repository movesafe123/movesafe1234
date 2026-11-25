/**
 * ev-service.js - Dịch vụ Quản lý & Đồng bộ Trạm sạc Xe điện MoveSafe VN
 * Nguồn sự thật duy nhất (Single Source of Truth): data/ev_stations_cache.json
 * Hợp nhất 4 nguồn: Kho thực địa EVCS.VN + TomTom EV Search + Open Charge Map v3 + OpenStreetMap (Overpass API)
 * Áp dụng Khử trùng lặp Đa tầng (Khoảng cách + Hãng + Ngữ nghĩa) & Thứ tự Ưu tiên Nguồn (Cache TTL 6h)
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const systemLogger = require('./system-logger');
const { apiQuotaGuard } = require('./api-quota-guard');

const STATION_STOP_WORDS = new Set([
  'tram', 'sac', 'xe', 'dien', 'o', 'to', 'may', 'diem', 'doi', 'pin',
  'vinfast', 'vgreen', 'v', 'green', 'selex', 'evone', 'eboost', 'porsche',
  'cong', 'ty', 'tnhh', 'cp', 'duong', 'pho', 'phuong', 'quan', 'huyen',
  'xa', 'thi', 'tran', 'thanh', 'tp', 'ha', 'noi', 'hcm', 'ho', 'chi',
  'minh', 'da', 'nang', 'viet', 'nam', 'khu', 'vuc', 'so', 'tai', 'va',
  'gan', 'bai', 'do', 'station', 'charging', 'charger', 'ev', 'fast',
  'super', 'quick', 'sieu', 'nhanh', 'cua', 'hang', 'showroom', 'motor',
  'motors', 'escooter', 'scooter', 'khong', 'ro'
]);

const ADMIN_AREA_PHRASES = /\b(hai\s+ba\s+trung|hoan\s+kiem|ba\s+dinh|dong\s+da|cau\s+giay|thanh\s+xuan|hoang\s+mai|long\s+bien|tay\s+ho|bac\s+tu\s+liem|nam\s+tu\s+liem|ha\s+dong|gia\s+lam|dong\s+anh|thanh\s+tri|hoai\s+duc|chuong\s+my|quoc\s+oai|thach\s+that|dan\s+phuong|me\s+linh|soc\s+son|son\s+tay|binh\s+thanh|go\s+vap|phu\s+nhuan|tan\s+binh|tan\s+phu|binh\s+tan|thu\s+duc|binh\s+chanh|nha\s+be|hoc\s+mon|cu\s+chi|can\s+gio|hai\s+chau|thanh\s+khe|son\s+tra|ngu\s+hanh\s+son|lien\s+chieu|cam\s+le|hoa\s+vang|quan\s+\d+|district\s+\d+)\b/g;

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

function stripAccentsLower(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function parsePowerKwValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const match = String(raw || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function normalizeOperatorKey(operator = '', name = '') {
  const combined = stripAccentsLower(`${operator} ${name}`);
  if (/vinfast|v-?green|vincom|vinhomes/.test(combined)) return 'vinfast';
  if (/selex/.test(combined)) return 'selex';
  if (/ev\s*one|evone/.test(combined)) return 'evone';
  if (/eboost/.test(combined)) return 'eboost';
  if (/porsche/.test(combined)) return 'porsche';
  if (/dat\s*bike|datbike/.test(combined)) return 'datbike';
  if (/ever\s*charge|evercharge/.test(combined)) return 'evercharge';
  return 'generic';
}

function tokenizeStationText(input, { stripAdminAreas = true } = {}) {
  const rawText = typeof input === 'string'
    ? input
    : `${input?.name || ''} ${input?.address || ''} ${input?.town || ''}`;
  let normalized = stripAccentsLower(rawText);
  if (stripAdminAreas) {
    normalized = normalized.replace(ADMIN_AREA_PHRASES, ' ');
  }
  const clean = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(tok => tok && !STATION_STOP_WORDS.has(tok) && (tok.length >= 2 || /^\d+$/.test(tok)));
  if (clean.length === 0 && stripAdminAreas) {
    return tokenizeStationText(input, { stripAdminAreas: false });
  }
  return new Set(clean);
}

function computeTextSimilarity(stationA, stationB) {
  const tokensA = tokenizeStationText(stationA);
  const tokensB = tokenizeStationText(stationB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const tok of tokensA) {
    if (tokensB.has(tok)) intersection++;
  }
  return intersection / Math.min(tokensA.size, tokensB.size);
}

function isEscooterOnlyStation(st) {
  if (!st) return false;
  if (st.stationKind === 'battery_swap') return true;
  if (st.stationKind === 'charging') return false;
  const vTypes = Array.isArray(st.vehicleTypes) ? st.vehicleTypes : [];
  if (vTypes.includes('ecar')) return false;
  if (vTypes.includes('ebike') && !vTypes.includes('ecar')) return true;
  const combined = stripAccentsLower(`${st.operator || ''} ${st.name || ''}`);
  if (/selex|doi\s*pin|xe\s*may\s*dien|escooter|e-?scooter|dat\s*bike/.test(combined) && !/o\s*to|ccs/.test(combined)) {
    return true;
  }
  return false;
}

function resolveStationKind(st) {
  if (!st) return 'charging';
  if (st.stationKind === 'battery_swap') return 'battery_swap';
  if (st.stationKind === 'charging') return 'charging';
  const hasCarConnector = Array.isArray(st.connectors) && st.connectors.some(c => /ccs|type\s*2|chademo/i.test(String(c?.type || '')));
  if ((st.maxPowerKw || 0) >= 20 || hasCarConnector) return 'charging';
  if (st.supportsBatterySwap === true || isEscooterOnlyStation(st)) return 'battery_swap';
  return 'charging';
}

function getSourcePriority(st) {
  const id = String(st?.id || '');
  const src = String(st?.source || '');
  if (id.startsWith('evcs-') || id.startsWith('ev-') || id.startsWith('vn-') || /EVCS\.VN|MoveSafe/i.test(src) || (!src && !id.startsWith('ocm-') && !id.startsWith('osm-') && !id.startsWith('tt-'))) {
    return 4;
  }
  if (id.startsWith('tt-') || /TomTom/i.test(src)) return 3;
  if (id.startsWith('ocm-') || /Open Charge Map/i.test(src)) return 2;
  if (id.startsWith('osm-') || /OpenStreetMap|Overpass/i.test(src)) return 1;
  return 2;
}

function resolveShortSourceLabel(st) {
  const id = String(st?.id || '');
  const src = String(st?.source || '');
  if (id.startsWith('evcs-') || /EVCS\.VN/i.test(src)) return 'EVCS.VN';
  if (id.startsWith('tt-') || /TomTom/i.test(src)) return 'TomTom EV';
  if (id.startsWith('ocm-') || /Open Charge Map/i.test(src)) return 'OpenChargeMap';
  if (id.startsWith('osm-') || /OpenStreetMap|Overpass/i.test(src)) return 'OpenStreetMap';
  if (id.startsWith('ev-') || /MoveSafe/i.test(src)) return 'MoveSafe VN';
  return 'MoveSafe VN';
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

  // Gọi trực tiếp Open Charge Map API v3 với Key Pool & Circuit Breaker
  async fetchFromOpenChargeMap() {
    const ocmPool = (config.API_KEY_POOLS && config.API_KEY_POOLS.openchargemap) || [this.apiKey].filter(Boolean);
    const healthyKeys = apiQuotaGuard.getHealthyKeys('openchargemap', ocmPool);
    if (healthyKeys.length === 0) {
      return [];
    }

    try {
      let res = null;
      for (const activeKey of healthyKeys) {
        const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=VN&maxresults=500&compact=true&verbose=false&key=${activeKey}`;
        const attempt = await fetch(url, {
          headers: {
            'User-Agent': 'MoveSafeVN/1.0',
            'X-API-Key': activeKey
          },
          signal: AbortSignal.timeout(10000)
        });
        if (attempt.status === 403 || attempt.status === 429) {
          apiQuotaGuard.markRateLimited('openchargemap', activeKey, attempt.status, attempt.headers?.get('retry-after'));
          continue;
        }
        res = attempt;
        break;
      }

      if (!res || !res.ok) {
        if (res) console.warn(`[EVService] Open Charge Map API trả về mã lỗi ${res.status}`);
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

  // Gọi TomTom Search EV API tiết kiệm quota (chỉ ~5 request cho mỗi chu kỳ cache 6 giờ + Circuit Breaker 403/429)
  async fetchFromTomTomEV() {
    const ttPool = (config.API_KEY_POOLS && config.API_KEY_POOLS.tomtom) || [this.tomtomKey].filter(Boolean);
    if (ttPool.length === 0 || apiQuotaGuard.getHealthyKeys('tomtom', ttPool).length === 0) {
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
      const healthyKey = apiQuotaGuard.getHealthyKey('tomtom', ttPool);
      if (!healthyKey) break; // Mọi key đang nghỉ cooldown -> dừng vòng lặp ngay
      try {
        const u = new URL(`https://api.tomtom.com/search/2/${hub.path}`);
        u.searchParams.set('key', healthyKey);
        u.searchParams.set('countrySet', 'VN');
        u.searchParams.set('lat', String(hub.lat));
        u.searchParams.set('lon', String(hub.lon));
        u.searchParams.set('radius', String(hub.radius));
        u.searchParams.set('limit', '100');

        const res = await fetch(u.toString(), { signal: AbortSignal.timeout(8000) });
        if (res.status === 403 || res.status === 429) {
          apiQuotaGuard.markRateLimited('tomtom', healthyKey, res.status, res.headers?.get('retry-after'));
          continue;
        }
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
          const cityKey = this.detectSupportedCity(lat, lng, addrText);
          if (!cityKey) continue;
          const isSwapOnly = /tủ đổi pin|trạm đổi pin|đổi pin xe máy|trạm tđp/i.test(poiName) && !/trạm sạc|ô tô|ccs/i.test(poiName);
          const isEscooter = isSwapOnly || /đổi pin|xe máy điện|escooter|selex|eboost/i.test(`${poiName} ${addrText}`);
          let operator = 'TomTom EV Network';
          if (/vinfast/i.test(poiName)) operator = 'VinFast';
          else if (/ev one/i.test(poiName)) operator = 'EV ONE';
          else if (/porsche/i.test(poiName)) operator = 'Porsche';
          else if (/selex/i.test(poiName)) operator = 'Selex Motors';

          const maxKw = isSwapOnly ? 3.5 : (isEscooter ? 11 : 60);
          collected.push(normalizeNFCDeep({
            id: `tt-${item.id}`,
            name: poiName,
            operator: operator,
            stationKind: isSwapOnly ? 'battery_swap' : 'charging',
            stationKindLabel: isSwapOnly ? 'Trạm đổi pin' : 'Trạm sạc xe điện',
            address: addrText,
            city: cityKey,
            lat: lat,
            lng: lng,
            isOperational: true,
            statusText: 'Đang hoạt động 24/7',
            maxPowerKw: maxKw,
            isFastCharge: maxKw >= 50,
            totalPoints: 4,
            vehicleTypes: isSwapOnly ? ['ebike'] : (isEscooter ? ['ebike', 'ecar'] : ['ecar']),
            supportsEscooter: isEscooter,
            supportsBatterySwap: isSwapOnly,
            connectors: [
              { type: isSwapOnly ? 'Tủ đổi pin (e-Scooter)' : (isEscooter ? 'e-Scooter / Type 2' : 'CCS2 DC / Type 2'), powerKw: maxKw, current: maxKw >= 50 ? 'DC' : 'AC', quantity: 4 }
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

  normalizeOperatorKey(operator = '', name = '') {
    return normalizeOperatorKey(operator, name);
  }

  computeTextSimilarity(stationA, stationB) {
    return computeTextSimilarity(stationA, stationB);
  }

  getSourcePriority(station) {
    return getSourcePriority(station);
  }

  /**
   * Kiểm tra 2 bản ghi có phải cùng 1 trạm sạc vật lý hay không theo quy tắc đa tầng:
   * - < 40m: Gộp làm 1, trừ khi rõ ràng 2 hãng khác nhau (hoặc 1 ô tô vs 1 tủ đổi pin xe máy khác hãng).
   * - 40m - 150m: Chỉ gộp khi cùng hãng (hoặc 1 bên là generic) VÀ tương đồng tên/địa chỉ (>= 0.35),
   *   hoặc cùng hãng xác định trong phạm vi <= 75m cùng loại xe.
   */
  shouldMergeStations(existing, incoming) {
    if (!existing || !incoming) return false;
    const distM = calcHaversineMeters(existing.lat, existing.lng, incoming.lat, incoming.lng);
    if (!Number.isFinite(distM) || distM > 150) return false;

    const opA = normalizeOperatorKey(existing.operator, existing.name);
    const opB = normalizeOperatorKey(incoming.operator, incoming.name);
    const distinctNamedOps = opA !== 'generic' && opB !== 'generic' && opA !== opB;
    const onlyScooterA = isEscooterOnlyStation(existing);
    const onlyScooterB = isEscooterOnlyStation(incoming);
    const kindA = resolveStationKind(existing);
    const kindB = resolveStationKind(incoming);

    // Không bao giờ gộp Trạm sạc với Trạm đổi pin thành một
    if (kindA !== kindB) return false;

    if (distM < 40) {
      if (distinctNamedOps && (onlyScooterA !== onlyScooterB || distM >= 15)) {
        return false;
      }
      return true;
    }

    if (distinctNamedOps) return false;
    if (onlyScooterA !== onlyScooterB) return false;

    const textSim = computeTextSimilarity(existing, incoming);
    if (textSim >= 0.35) return true;
    if (distM <= 75 && opA !== 'generic' && opA === opB) return true;

    return false;
  }

  /**
   * Hợp nhất thông tin & áp dụng Quy tắc Ưu tiên Nguồn:
   * Luôn giữ tọa độ và danh tính chính từ nguồn có getSourcePriority() cao hơn (EVCS.VN > TomTom > OCM > OSM).
   */
  enrichExistingStation(existing, incoming, idField) {
    if (!existing || !incoming) return existing;

    const prioExisting = getSourcePriority(existing);
    const prioIncoming = getSourcePriority(incoming);

    const existingSrc = resolveShortSourceLabel(existing);
    const incomingSrc = resolveShortSourceLabel(incoming);
    const verifiedSet = new Set(Array.isArray(existing.verifiedSources) ? existing.verifiedSources : [existingSrc]);
    verifiedSet.add(existingSrc);
    verifiedSet.add(incomingSrc);

    const mergedVehicleTypes = Array.from(new Set([
      ...(Array.isArray(existing.vehicleTypes) ? existing.vehicleTypes : []),
      ...(Array.isArray(incoming.vehicleTypes) ? incoming.vehicleTypes : [])
    ]));

    if (prioIncoming > prioExisting) {
      existing.lat = incoming.lat;
      existing.lng = incoming.lng;
      existing.name = incoming.name || existing.name;
      existing.address = incoming.address || existing.address;
      existing.operator = incoming.operator || existing.operator;
      existing.city = incoming.city || existing.city;
      if ((incoming.maxPowerKw || 0) > 0) {
        existing.maxPowerKw = incoming.maxPowerKw;
        existing.isFastCharge = existing.maxPowerKw >= 50;
      }
      if (!existing.osmId && String(existing.id || '').startsWith('osm-')) {
        existing.osmId = existing.id;
      }
    } else {
      if ((incoming.maxPowerKw || 0) > (existing.maxPowerKw || 0) && !(existing.connectors && existing.connectors.length > 1)) {
        existing.maxPowerKw = incoming.maxPowerKw;
        existing.isFastCharge = existing.maxPowerKw >= 50;
      }
      if ((!existing.connectors || existing.connectors.length === 0) && Array.isArray(incoming.connectors) && incoming.connectors.length > 0) {
        existing.connectors = incoming.connectors;
      }
      if (!existing.address && incoming.address) {
        existing.address = incoming.address;
      }
    }

    if (idField) {
      existing[idField] = incoming.id;
    }
    if ((incoming.totalPoints || 0) > (existing.totalPoints || 0)) {
      existing.totalPoints = incoming.totalPoints;
    }
    if (mergedVehicleTypes.length > 0) {
      existing.vehicleTypes = mergedVehicleTypes;
    }
    if (existing.supportsEscooter || incoming.supportsEscooter) {
      existing.supportsEscooter = true;
    }
    if (!existing.openingHours && incoming.openingHours) {
      existing.openingHours = incoming.openingHours;
    }

    existing.verifiedSources = Array.from(verifiedSet);
    existing.lastUpdated = incoming.lastUpdated || new Date().toISOString();
    return normalizeNFCDeep(existing);
  }

  /**
   * Gom cụm nội bộ các trụ/node OpenStreetMap nằm cùng 1 bãi đỗ xe (<= 60m, cùng hãng),
   * tránh 1 bãi sạc 5-10 trụ bị hiển thị thành 10 ghim chồng chéo trên bản đồ.
   */
  clusterOverpassStations(rawStations = []) {
    if (!Array.isArray(rawStations) || rawStations.length === 0) return [];

    const sorted = [...rawStations].sort((a, b) => {
      const score = (item) => {
        const opBonus = normalizeOperatorKey(item.operator, item.name) !== 'generic' ? 20 : 0;
        const nameLen = String(item.name || '').length;
        const powerBonus = (item.maxPowerKw || 0) > 22 ? 10 : 0;
        return opBonus + powerBonus + Math.min(30, nameLen);
      };
      return score(b) - score(a);
    });

    const clusters = [];
    for (const st of sorted) {
      if (!st || !Number.isFinite(st.lat) || !Number.isFinite(st.lng)) continue;
      const opNew = normalizeOperatorKey(st.operator, st.name);
      const scooterNew = isEscooterOnlyStation(st);

      let matchedCluster = null;
      for (const cl of clusters) {
        const distM = calcHaversineMeters(cl.lat, cl.lng, st.lat, st.lng);
        if (distM > 60) continue;

        const opCl = normalizeOperatorKey(cl.operator, cl.name);
        const scooterCl = isEscooterOnlyStation(cl);
        const compatibleOp = opCl === opNew || opCl === 'generic' || opNew === 'generic';
        if (compatibleOp && scooterCl === scooterNew) {
          matchedCluster = cl;
          break;
        }
      }

      if (matchedCluster) {
        const addPts = Math.max(1, Number(st._rawPoints || st.totalPoints || 1));
        matchedCluster.totalPoints = Math.min(24, (matchedCluster.totalPoints || 2) + addPts);
        if ((st.maxPowerKw || 0) > (matchedCluster.maxPowerKw || 0)) {
          matchedCluster.maxPowerKw = st.maxPowerKw;
          matchedCluster.isFastCharge = matchedCluster.maxPowerKw >= 50;
        }
        if (normalizeOperatorKey(matchedCluster.operator, matchedCluster.name) === 'generic' && opNew !== 'generic') {
          matchedCluster.operator = st.operator;
        }
        if (!Array.isArray(matchedCluster._clusteredOsmIds)) {
          matchedCluster._clusteredOsmIds = [matchedCluster.id];
        }
        matchedCluster._clusteredOsmIds.push(st.id);
      } else {
        const initPts = Math.max(2, Number(st._rawPoints || st.totalPoints || 2));
        clusters.push({
          ...st,
          totalPoints: initPts,
          _clusteredOsmIds: [st.id]
        });
      }
    }

    return clusters.map(cl => {
      const copy = { ...cl };
      delete copy._rawPoints;
      delete copy._clusteredOsmIds;
      return normalizeNFCDeep(copy);
    });
  }

  /**
   * Kiểm tra tọa độ và địa chỉ có thuộc 3 đô thị trọng điểm (Hà Nội, TP.HCM, Đà Nẵng) hay không.
   */
  detectSupportedCity(lat, lng, addressHint = '') {
    const lowerAddr = stripAccentsLower(addressHint);
    if (/(bac ninh|tu son|kinh bac|yen phong|vinh phuc|vinh yen|phu tho|hung yen|hai duong|thai nguyen|ha nam|binh duong|dong nai|long an|tay ninh|quang nam|thua thien hue)/.test(lowerAddr)) {
      return null;
    }
    if (lat >= 20.68 && lat <= 21.24 && lng >= 105.42 && lng <= 105.97) return 'hanoi';
    if (lat >= 15.90 && lat <= 16.20 && lng >= 108.05 && lng <= 108.35) return 'danang';
    if (lat >= 10.55 && lat <= 11.02 && lng >= 106.45 && lng <= 106.88) return 'hcm';
    return null;
  }

  /**
   * Chuẩn hóa 1 phần tử OpenStreetMap (từ Overpass hoặc Nominatim) thành bản ghi trạm sạc MoveSafe.
   */
  buildOSMStationRecord({ osmType = 'node', osmId, lat, lng, tags = {}, fallbackName = '', fallbackAddress = '', timestamp = null }) {
    const addrParts = [
      [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim(),
      tags['addr:suburb'] || tags['addr:quarter'],
      tags['addr:district'],
      tags['addr:city'] || tags['addr:province']
    ].filter(Boolean);

    const address = addrParts.length > 0
      ? addrParts.join(', ')
      : (tags['addr:full'] || fallbackAddress || fallbackName || 'Việt Nam (OpenStreetMap)');

    const cityKey = this.detectSupportedCity(lat, lng, address);
    if (!cityKey) return null;

    if (tags.motorcar === 'no' && tags.motorcycle === 'no' && (tags.bicycle === 'yes' || /phone|laptop/i.test(String(tags.description || '')))) {
      return null;
    }

    const rawBrand = String(tags.brand || tags.operator || tags.network || '').trim();
    const rawName = String(tags['name:vi'] || tags.name || fallbackName || '').trim();
    const opKey = normalizeOperatorKey(rawBrand, rawName);

    let operator = rawBrand || 'OpenStreetMap EV';
    if (opKey === 'vinfast') operator = 'VinFast';
    else if (opKey === 'selex') operator = 'Selex Motors';
    else if (opKey === 'evone') operator = 'EV ONE';
    else if (opKey === 'eboost') operator = 'Eboost';
    else if (opKey === 'porsche') operator = 'Porsche';
    else if (opKey === 'datbike') operator = 'Dat Bike';

    const genericName = !rawName || /^(?:trạm\s*sạc(?:\s*vinfast|\s*xe\s*điện)?|car\s*charging\s*station|charging\s*station)$/i.test(rawName);
    const addrSnippet = String(address).split(',').map(p => p.trim()).filter(Boolean).slice(0, 2).join(', ');
    let stationName = rawName;
    if (genericName) {
      const baseTitle = (rawName && !/charging\s*station/i.test(rawName))
        ? rawName
        : `Trạm sạc ${operator !== 'OpenStreetMap EV' ? operator : 'Xe điện'}`;
      stationName = addrSnippet ? `${baseTitle} (${addrSnippet})` : baseTitle;
    }

    const powerCandidates = [
      parsePowerKwValue(tags['socket:type2_combo:output']),
      parsePowerKwValue(tags['socket:ccs:output']),
      parsePowerKwValue(tags['socket:chademo:output']),
      parsePowerKwValue(tags['socket:type2:output']),
      parsePowerKwValue(tags.maxpower),
      parsePowerKwValue(tags.power),
      parsePowerKwValue(tags.output)
    ].filter(v => v > 0 && v <= 500);

    const isScooter = tags.motorcycle === 'yes' || tags.moped === 'yes' || tags.scooter === 'yes' ||
      /selex|dat\s*bike|eboost|xe\s*may|doi\s*pin|escooter/i.test(stripAccentsLower(`${rawBrand} ${stationName}`));
    const maxPowerKw = powerCandidates.length > 0 ? Math.max(...powerCandidates) : (isScooter ? 11 : 60);
    const rawPts = Number(tags.capacity) || Number(tags['socket:type2_combo']) || Number(tags['socket:type2']) || 1;
    const isFast = maxPowerKw >= 50;

    const connectors = [];
    if (tags['socket:type2_combo'] || tags['socket:ccs'] || isFast) {
      connectors.push({
        type: 'CCS (Type 2)',
        powerKw: maxPowerKw,
        current: 'DC',
        quantity: Number(tags['socket:type2_combo']) || Number(tags['socket:ccs']) || Math.max(1, rawPts)
      });
    }
    if (tags['socket:type2'] || !isFast) {
      connectors.push({
        type: isScooter ? 'e-Scooter / Type 2' : 'Type 2',
        powerKw: Math.min(22, maxPowerKw),
        current: 'AC',
        quantity: Number(tags['socket:type2']) || Math.max(1, rawPts)
      });
    }

    const fullOsmId = `osm-${osmType}-${osmId}`;
    return normalizeNFCDeep({
      id: fullOsmId,
      osmId: fullOsmId,
      name: stationName,
      operator,
      address,
      city: cityKey,
      lat,
      lng,
      isOperational: tags.operational_status !== 'broken' && tags.operational_status !== 'closed',
      statusText: tags.operational_status === 'broken' ? 'Tạm bảo trì (OSM)' : 'Đang hoạt động 24/7',
      maxPowerKw,
      isFastCharge: isFast,
      totalPoints: Math.max(2, rawPts),
      _rawPoints: Math.max(1, rawPts),
      vehicleTypes: isScooter ? (tags.motorcar === 'no' ? ['ebike'] : ['ebike', 'ecar']) : ['ecar'],
      supportsEscooter: isScooter,
      connectors,
      openingHours: tags.opening_hours || undefined,
      accessComments: 'Đồng bộ từ OpenStreetMap theo giấy phép mở ODbL',
      source: 'OpenStreetMap (Overpass/Nominatim)',
      lastUpdated: timestamp || new Date().toISOString()
    });
  }

  /**
   * Dự phòng OpenStreetMap Nominatim API khi cụm máy chủ Overpass công cộng bị nghẽn/timeout.
   */
  async fetchFromNominatimOSM() {
    const queries = [
      'amenity=charging_station&countrycodes=vn&limit=50',
      'q=tram+sac+VinFast&countrycodes=vn&viewbox=105.45,21.25,106.05,20.75&bounded=1&limit=40',
      'q=tram+sac+VinFast&countrycodes=vn&viewbox=106.50,10.95,106.88,10.60&bounded=1&limit=40',
      'q=tram+sac+VinFast&countrycodes=vn&viewbox=108.10,16.16,108.32,15.95&bounded=1&limit=25'
    ];

    const seenIds = new Set();
    const rawStations = [];

    for (let i = 0; i < queries.length; i++) {
      try {
        if (i > 0) await new Promise(r => setTimeout(r, 1100)); // Tôn trọng giới hạn 1 req/giây của Nominatim
        const url = `https://nominatim.openstreetmap.org/search?${queries[i]}&format=jsonv2&addressdetails=1&extratags=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'MoveSafeVN/1.0 (https://movesafe1234.onrender.com)' },
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) continue;
        const items = await res.json();
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !item.osm_id) continue;

          const itemName = String(item.name || '').trim();
          const dispName = String(item.display_name || '').trim();
          const isChargingNode = item.type === 'charging_station' ||
            /(trạm\s*sạc|tram\s*sac|charging|v-?green|selex|đổi\s*pin)/i.test(`${itemName} ${dispName}`);
          const isPureShowroom = /(showroom|đại\s*lý|xưởng\s*dịch\s*vụ)/i.test(itemName) && !/trạm\s*sạc|charging/i.test(itemName);
          if (!isChargingNode || isPureShowroom) continue;

          const uid = `osm-${item.osm_type || 'node'}-${item.osm_id}`;
          if (seenIds.has(uid)) continue;
          seenIds.add(uid);

          const addrObj = item.address || {};
          const fallbackAddr = [
            [addrObj.house_number, addrObj.road].filter(Boolean).join(' ').trim(),
            addrObj.suburb || addrObj.quarter,
            addrObj.city_district || addrObj.county || addrObj.town,
            addrObj.city || addrObj.state
          ].filter(Boolean).join(', ') || dispName;

          const rec = this.buildOSMStationRecord({
            osmType: item.osm_type || 'node',
            osmId: item.osm_id,
            lat,
            lng,
            tags: item.extratags || {},
            fallbackName: itemName || (dispName ? dispName.split(',')[0].trim() : ''),
            fallbackAddress: fallbackAddr
          });
          if (rec) rawStations.push(rec);
        }
      } catch (err) {
        console.warn('[EVService] Lỗi gọi Nominatim OSM:', err.message);
      }
    }

    return rawStations;
  }

  /**
   * Nguồn thứ 4: OpenStreetMap (Overpass API chính + fallback Nominatim OSM, miễn phí 100%, chuẩn ODbL).
   * Lấy các trạm sạc tại Hà Nội, TP.HCM & Đà Nẵng rồi gom cụm nội bộ trước khi hợp nhất.
   */
  async fetchFromOverpassOSM() {
    const query = [
      '[out:json][timeout:6];',
      '(',
      '  nw["amenity"="charging_station"](20.75,105.45,21.25,106.05);',
      '  nw["amenity"="charging_station"](10.60,106.50,10.95,106.88);',
      '  nw["amenity"="charging_station"](15.95,108.10,16.16,108.32);',
      ');',
      'out center tags;'
    ].join('\n');

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ];

    let elements = null;
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'MoveSafeVN/1.0 (https://movesafe1234.onrender.com)'
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) {
          console.warn(`[EVService] Overpass (${endpoint}) trả về HTTP ${res.status}`);
          continue;
        }
        const json = await res.json();
        if (json && Array.isArray(json.elements) && json.elements.length > 0) {
          elements = json.elements;
          break;
        }
      } catch (err) {
        console.warn(`[EVService] Lỗi gọi Overpass (${endpoint}):`, err.message);
      }
    }

    let rawStations = [];
    if (elements && elements.length > 0) {
      for (const el of elements) {
        const lat = Number(el.lat ?? el.center?.lat);
        const lng = Number(el.lon ?? el.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const rec = this.buildOSMStationRecord({
          osmType: el.type || 'node',
          osmId: el.id,
          lat,
          lng,
          tags: el.tags || {},
          timestamp: el.timestamp
        });
        if (rec) rawStations.push(rec);
      }
    } else {
      console.log('[EVService] Overpass tạm chậm, chuyển sang OpenStreetMap Nominatim API...');
      rawStations = await this.fetchFromNominatimOSM();
    }

    const clustered = this.clusterOverpassStations(rawStations);
    console.log(`[EVService] OpenStreetMap trả về ${rawStations.length} bản ghi -> gom cụm thành ${clustered.length} trạm sạch.`);
    return clustered;
  }

  // Đồng bộ toàn diện với TTL 6 giờ: Cache JSON -> Curated -> OpenChargeMap + TomTom EV + Overpass OSM
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

    console.log('[EVService] Đang đồng bộ trạm sạc từ OpenChargeMap, TomTom EV Search & OpenStreetMap Overpass...');
    const [liveOCM, liveTomTom, liveOSM] = await Promise.all([
      this.fetchFromOpenChargeMap(),
      this.fetchFromTomTomEV(),
      this.fetchFromOverpassOSM()
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
        let closestDist = Infinity;

        for (const [id, st] of mergedMap.entries()) {
          if (this.shouldMergeStations(st, inc)) {
            const d = calcHaversineMeters(st.lat, st.lng, inc.lat, inc.lng);
            if (d < closestDist) {
              closestDist = d;
              existingId = id;
            }
          }
        }

        if (existingId) {
          const existing = mergedMap.get(existingId);
          this.enrichExistingStation(existing, inc, idField);
          enrichedCount++;
        } else {
          const newEntry = normalizeNFCDeep({
            ...inc,
            verifiedSources: Array.isArray(inc.verifiedSources) ? inc.verifiedSources : [resolveShortSourceLabel(inc)]
          });
          mergedMap.set(inc.id, newEntry);
          addedCount++;
        }
      }
    };

    // 2. Hợp nhất đa nguồn theo thứ tự ưu tiên độ tin cậy & Khử trùng lặp đa tầng
    mergeIncoming(liveTomTom, 'tomtomId');
    mergeIncoming(liveOCM, 'ocmId');
    mergeIncoming(liveOSM, 'osmId');

    this.stations = Array.from(mergedMap.values());
    this.lastSyncTime = Date.now();
    this.saveToCache();

    console.log(`[EVService] Hoàn tất đồng bộ 4 nguồn! Tổng ${this.stations.length} trạm (thêm mới: ${addedCount}, làm giàu/gộp trùng: ${enrichedCount}).`);

    systemLogger.record({
      category: 'ev',
      title: `Đồng bộ 4 nguồn Trạm sạc EV (${this.stations.length} trạm, +${addedCount} mới)`,
      source: 'server/ev-service.js :: syncAllStations',
      durationMs: Date.now() - startMs,
      input: {
        force,
        ocmFetched: liveOCM.length,
        tomtomFetched: liveTomTom.length,
        osmFetched: liveOSM.length,
        dedupPolicy: '2-tier (<40m physical | 40-150m operator+semantic)'
      },
      steps: [
        {
          stepName: 'Bước 1: Nạp nguồn nền ưu tiên cao (EVCS.VN + Cache đã kiểm chứng)',
          formulaOrRule: 'Priority: EVCS/MoveSafe (4) > TomTom (3) > OCM (2) > OSM (1)',
          detail: 'Bảo toàn tọa độ thực địa làm gốc trước khi đối chiếu các nguồn mở.'
        },
        {
          stepName: 'Bước 2: Gom cụm nội bộ OSM <= 60m & Khử trùng lặp đa tầng',
          formulaOrRule: 'clusterOverpassStations(60m) + shouldMergeStations(<40m | 40-150m)',
          detail: `Nhận ${liveTomTom.length} TomTom + ${liveOCM.length} OCM + ${liveOSM.length} OSM; thêm mới ${addedCount} trạm, hợp nhất/làm giàu ${enrichedCount} trạm trùng.`
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

// Tự động đồng bộ theo TTL cache (chỉ gọi API ngoài khi cache quá 6 giờ; bỏ qua trong test)
const _isTestMode = process.env.NODE_ENV === 'test' ||
  process.env.BOT_DISABLE_AUTO_INIT === '1' ||
  process.execArgv.some(arg => arg.startsWith('--test'));
if (!_isTestMode) {
  evService.syncAllStations({ force: false }).catch(err => {
    console.warn('[EVService] Lỗi chạy đồng bộ ban đầu:', err.message);
  });
}

module.exports = evService;
