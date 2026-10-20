/**
 * ev-service.js - Dịch vụ Quản lý & Đồng bộ Trạm sạc Xe điện MoveSafe VN
 * Nguồn dữ liệu: Open Charge Map (OCM) API v3 & Mạng lưới Trạm sạc Quốc gia
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

class EVService {
  constructor() {
    this.apiKey = config.API_KEYS.OPEN_CHARGE_MAP || 'ef996480-7ae1-4c38-adef-acfd69ace0d6';
    this.cacheDir = path.join(__dirname, '..', 'data');
    this.publicCacheDir = path.join(__dirname, '..', 'public', 'data');
    this.cacheFile = path.join(this.cacheDir, 'ev_stations_cache.json');
    this.stations = [];
    this.lastSyncTime = 0;
    this.SYNC_INTERVAL_MS = 60 * 60 * 1000; // Đồng bộ lại mỗi 1 giờ

    // Tải dữ liệu từ cache lúc khởi động
    this.loadFromCache();
  }

  // Tải dữ liệu đệm từ ổ cứng
  loadFromCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.stations = parsed;
          console.log(`[EVService] Đã nạp ${this.stations.length} trạm sạc xe điện từ cache cục bộ.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[EVService] Không thể đọc cache trạm sạc:', err.message);
    }

    // Nếu chưa có file cache, tạo dữ liệu khởi tạo
    this.stations = this.getCuratedStations();
    this.saveToCache();
  }

  // Lưu dữ liệu vào cache
  saveToCache() {
    try {
      if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true });
      if (!fs.existsSync(this.publicCacheDir)) fs.mkdirSync(this.publicCacheDir, { recursive: true });

      const jsonStr = JSON.stringify(this.stations, null, 2);
      fs.writeFileSync(this.cacheFile, jsonStr, 'utf8');
      fs.writeFileSync(path.join(this.publicCacheDir, 'ev_stations_cache.json'), jsonStr, 'utf8');
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

      return ocmList.map(item => {
        const addr = item.AddressInfo || {};
        const lat = addr.Latitude;
        const lng = addr.Longitude;
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

        // Nếu OCM chưa ghi công suất, mặc định cổng sạc nhanh 60kW DC hoặc 22kW AC
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

        return {
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
          connectors: connectors.length > 0 ? connectors : [
            { type: 'CCS (Type 2)', powerKw: maxPower, current: isFast ? 'DC' : 'AC', quantity: 2 }
          ],
          source: 'Open Charge Map API (Live)',
          lastUpdated: item.DateLastStatusUpdate || new Date().toISOString()
        };
      });
    } catch (err) {
      console.warn('[EVService] Lỗi gọi Open Charge Map API:', err.message);
      return [];
    }
  }

  // Danh mục trạm sạc tiêu chuẩn thực tế tại Việt Nam (VinFast, EVOne, Selex, Eboost, Porsche)
  // Chuẩn hóa theo định dạng Open Charge Map
  getCuratedStations() {
    return require('./ev-stations-data');
  }

  // Đồng bộ toàn diện: Gọi Open Charge Map API và kết hợp mạng lưới chuẩn hóa
  async syncAllStations() {
    console.log('[EVService] Đang đồng bộ trạm sạc từ Open Charge Map API...');
    const liveOCM = await this.fetchFromOpenChargeMap();
    const curated = this.getCuratedStations();

    const mergedMap = new Map();

    // 1. Nạp danh mục trạm sạc chuẩn hoá
    curated.forEach(st => {
      mergedMap.set(st.id, st);
    });

    // 2. Bổ sung hoặc cập nhật từ Open Charge Map thực tế
    liveOCM.forEach(ocmSt => {
      // Kiểm tra xem có trạm nào gần đó (< 150m) đã có trong danh mục không
      let existingId = null;
      for (const [id, st] of mergedMap.entries()) {
        const dLat = (st.lat - ocmSt.lat) * 111000;
        const dLng = (st.lng - ocmSt.lng) * 111000;
        const distM = Math.sqrt(dLat * dLat + dLng * dLng);
        if (distM < 150) {
          existingId = id;
          break;
        }
      }

      if (existingId) {
        // Ghép thêm thông tin kết nối từ OCM
        const existing = mergedMap.get(existingId);
        existing.ocmId = ocmSt.id;
        existing.lastUpdated = ocmSt.lastUpdated;
        if (ocmSt.connectors && ocmSt.connectors.length > 0) {
          existing.connectors = ocmSt.connectors;
          existing.maxPowerKw = Math.max(existing.maxPowerKw, ocmSt.maxPowerKw);
        }
      } else {
        mergedMap.set(ocmSt.id, ocmSt);
      }
    });

    this.stations = Array.from(mergedMap.values());
    this.lastSyncTime = Date.now();
    this.saveToCache();
    console.log(`[EVService] Hoàn tất đồng bộ trạm sạc! Tổng cộng ${this.stations.length} trạm sạc xe điện.`);
    return this.stations;
  }

  // Lấy danh sách trạm sạc theo thành phố và bộ lọc
  getStations(city = 'hanoi', fastOnly = false) {
    let result = this.stations;

    if (city) {
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

// Tự động đồng bộ ngay khi máy chủ khởi động
evService.syncAllStations().catch(err => {
  console.warn('[EVService] Lỗi chạy đồng bộ ban đầu:', err.message);
});

module.exports = evService;

