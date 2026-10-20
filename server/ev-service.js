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
    return [
      // ==================== HÀ NỘI ====================
      {
        id: 'ev-hn-smartcity',
        name: 'Trạm sạc Siêu Nhanh Vincom Smart City',
        operator: 'VinFast',
        address: 'Khu đô thị Vinhomes Smart City, Tây Mỗ, Nam Từ Liêm, Hà Nội',
        city: 'hanoi',
        lat: 20.9942,
        lng: 105.7482,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 250,
        isFastCharge: true,
        totalPoints: 16,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 250, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 8 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Tầng hầm B1 và bãi đỗ xe nổi phân khu Sapphire'
      },
      {
        id: 'ev-hn-metropolis',
        name: 'Trạm sạc Vincom Center Liễu Giai',
        operator: 'VinFast',
        address: '29 Liễu Giai, Ngọc Khánh, Ba Đình, Hà Nội',
        city: 'hanoi',
        lat: 21.0319,
        lng: 105.8115,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 150,
        isFastCharge: true,
        totalPoints: 10,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Tầng hầm B2 sảnh thương mại'
      },
      {
        id: 'ev-hn-royalcity',
        name: 'Trạm sạc Vincom Mega Mall Royal City',
        operator: 'VinFast',
        address: '72A Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
        city: 'hanoi',
        lat: 21.0028,
        lng: 105.8155,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 180,
        isFastCharge: true,
        totalPoints: 18,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 180, current: 'DC', quantity: 6 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 8 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Tầng hầm B3 cột R12-R18'
      },
      {
        id: 'ev-hn-oceanpark',
        name: 'Trạm sạc Siêu Nhanh Ocean Park 1',
        operator: 'VinFast',
        address: 'Khu đô thị Vinhomes Ocean Park, Gia Lâm, Hà Nội',
        city: 'hanoi',
        lat: 20.9925,
        lng: 105.9458,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 250,
        isFastCharge: true,
        totalPoints: 24,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 250, current: 'DC', quantity: 6 },
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 10 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 8 }
        ],
        accessComments: 'Nhà xe nổi 5 tầng khu Sapphire 2'
      },
      {
        id: 'ev-hn-timescity',
        name: 'Trạm sạc Vincom Mega Mall Times City',
        operator: 'VinFast',
        address: '458 Minh Khai, Vĩnh Tuy, Hai Bà Trưng, Hà Nội',
        city: 'hanoi',
        lat: 20.9950,
        lng: 105.8682,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 150,
        isFastCharge: true,
        totalPoints: 12,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 6 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Tầng hầm B2 sảnh T11'
      },
      {
        id: 'ev-hn-tranduyhung',
        name: 'Trạm sạc Vincom Trần Duy Hưng',
        operator: 'VinFast',
        address: '119 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội',
        city: 'hanoi',
        lat: 21.0069,
        lng: 105.7951,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 150,
        isFastCharge: true,
        totalPoints: 8,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Tầng hầm B3 sảnh chính'
      },
      {
        id: 'ev-hn-aeonhadong',
        name: 'Trạm sạc Aeon Mall Hà Đông',
        operator: 'VinFast',
        address: 'Dương Nội, Hà Đông, Hà Nội',
        city: 'hanoi',
        lat: 20.9818,
        lng: 105.7538,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 180,
        isFastCharge: true,
        totalPoints: 14,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 180, current: 'DC', quantity: 6 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Bãi đỗ xe ngoài trời Cổng 3'
      },
      {
        id: 'ev-hn-aeonlongbien',
        name: 'Trạm sạc Aeon Mall Long Biên',
        operator: 'VinFast',
        address: '27 Cổ Linh, Long Biên, Hà Nội',
        city: 'hanoi',
        lat: 21.0268,
        lng: 105.8988,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 150,
        isFastCharge: true,
        totalPoints: 12,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 6 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Bãi xe ngoài trời Cổng Nam'
      },
      {
        id: 'ev-hn-evone-tayho',
        name: 'Trạm sạc EVOne Hồ Tây',
        operator: 'EVOne',
        address: 'Lạc Long Quân, Nhật Tân, Tây Hồ, Hà Nội',
        city: 'hanoi',
        lat: 21.0620,
        lng: 105.8230,
        isOperational: true,
        statusText: 'Đang hoạt động',
        maxPowerKw: 120,
        isFastCharge: true,
        totalPoints: 6,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 120, current: 'DC', quantity: 2 },
          { type: 'Type 2', powerKw: 22, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Bãi đỗ xe công cộng Vườn hoa Lạc Long Quân'
      },
      {
        id: 'ev-hn-selex-bachkhoa',
        name: 'Tủ đổi pin Xe máy điện Selex Bách Khoa',
        operator: 'Selex Motors',
        address: 'Đại Cồ Việt, Bách Khoa, Hai Bà Trưng, Hà Nội',
        city: 'hanoi',
        lat: 21.0041,
        lng: 105.8437,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 15,
        isFastCharge: false,
        totalPoints: 8,
        connectors: [
          { type: 'Battery Swap Cabinet', powerKw: 15, current: 'DC', quantity: 8 }
        ],
        accessComments: 'Trạm đổi pin tự động 2 phút cho xe máy điện'
      },
      {
        id: 'ev-hn-selex-caugiay',
        name: 'Tủ đổi pin Selex Cầu Giấy',
        operator: 'Selex Motors',
        address: 'Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
        city: 'hanoi',
        lat: 21.0305,
        lng: 105.7830,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 15,
        isFastCharge: false,
        totalPoints: 8,
        connectors: [
          { type: 'Battery Swap Cabinet', powerKw: 15, current: 'DC', quantity: 8 }
        ],
        accessComments: 'Ngõ 86 Duy Tân'
      },
      {
        id: 'ev-hn-porsche',
        name: 'Trạm sạc Porsche Destination Charging Hà Nội',
        operator: 'Porsche',
        address: 'Đường Thụy Khuê, Tây Hồ, Hà Nội',
        city: 'hanoi',
        lat: 21.0410,
        lng: 105.8190,
        isOperational: true,
        statusText: 'Đang hoạt động',
        maxPowerKw: 175,
        isFastCharge: true,
        totalPoints: 4,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 175, current: 'DC', quantity: 2 },
          { type: 'Type 2', powerKw: 22, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Khách sạn ven hồ, sạc nhanh cho khách lưu trú & công cộng'
      },

      // ==================== TP. HỒ CHÍ MINH ====================
      {
        id: 'ev-hcm-landmark81',
        name: 'Trạm sạc Siêu Nhanh Vincom Landmark 81',
        operator: 'VinFast',
        address: '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP. Hồ Chí Minh',
        city: 'hcm',
        lat: 10.7950,
        lng: 106.7218,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 250,
        isFastCharge: true,
        totalPoints: 16,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 250, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 8 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Tầng hầm B2 và B3'
      },
      {
        id: 'ev-hcm-dongkhoi',
        name: 'Trạm sạc Vincom Center Đồng Khởi',
        operator: 'VinFast',
        address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        city: 'hcm',
        lat: 10.7780,
        lng: 106.7020,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 150,
        isFastCharge: true,
        totalPoints: 10,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Tầng hầm B3 sảnh Lê Thánh Tôn'
      },
      {
        id: 'ev-hcm-crescentmall',
        name: 'Trạm sạc Crescent Mall Phú Mỹ Hưng',
        operator: 'EVOne',
        address: '101 Tôn Dật Tiên, Tân Phú, Quận 7, TP. Hồ Chí Minh',
        city: 'hcm',
        lat: 10.7295,
        lng: 106.7210,
        isOperational: true,
        statusText: 'Đang hoạt động',
        maxPowerKw: 120,
        isFastCharge: true,
        totalPoints: 8,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 120, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 22, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Tầng hầm B1 sảnh Crescent Mall 2'
      },
      {
        id: 'ev-hcm-aeontanphu',
        name: 'Trạm sạc Aeon Mall Tân Phú Celadon',
        operator: 'VinFast',
        address: '30 Bờ Bao Tân Thắng, Sơn Kỳ, Tân Phú, TP. Hồ Chí Minh',
        city: 'hcm',
        lat: 10.8012,
        lng: 106.6162,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 180,
        isFastCharge: true,
        totalPoints: 14,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 180, current: 'DC', quantity: 6 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Bãi đỗ xe ngoài trời Cổng C'
      },
      {
        id: 'ev-hcm-sala',
        name: 'Trạm sạc Đô thị Sala Thủ Thiêm',
        operator: 'EVOne',
        address: 'Mai Chí Thọ, An Lợi Đông, TP. Thủ Đức, TP. Hồ Chí Minh',
        city: 'hcm',
        lat: 10.7680,
        lng: 106.7250,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 160,
        isFastCharge: true,
        totalPoints: 10,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 160, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 22, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Bãi xe công viên Sala'
      },
      {
        id: 'ev-hcm-selex-q10',
        name: 'Tủ đổi pin Selex Motors Quận 10',
        operator: 'Selex Motors',
        address: 'Đường 3 Tháng 2, Phường 14, Quận 10, TP. Hồ Chí Minh',
        city: 'hcm',
        lat: 10.7712,
        lng: 106.6685,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 15,
        isFastCharge: false,
        totalPoints: 8,
        connectors: [
          { type: 'Battery Swap Cabinet', powerKw: 15, current: 'DC', quantity: 8 }
        ],
        accessComments: 'Tủ đổi pin xe máy điện thông minh'
      },

      // ==================== ĐÀ NẴNG ====================
      {
        id: 'ev-dn-ngoquyen',
        name: 'Trạm sạc Siêu Nhanh Vincom Plaza Ngô Quyền',
        operator: 'VinFast',
        address: '910A Ngô Quyền, An Hải Bắc, Sơn Trà, Đà Nẵng',
        city: 'danang',
        lat: 16.0714,
        lng: 108.2312,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 250,
        isFastCharge: true,
        totalPoints: 12,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 250, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 6 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 2 }
        ],
        accessComments: 'Bãi đỗ xe ngoài trời sảnh chính'
      },
      {
        id: 'ev-dn-caurong',
        name: 'Trạm sạc EVOne Cầu Rồng',
        operator: 'EVOne',
        address: 'Đường Bạch Đằng, Hải Châu, Đà Nẵng',
        city: 'danang',
        lat: 16.0610,
        lng: 108.2230,
        isOperational: true,
        statusText: 'Đang hoạt động',
        maxPowerKw: 120,
        isFastCharge: true,
        totalPoints: 8,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 120, current: 'DC', quantity: 4 },
          { type: 'Type 2', powerKw: 22, current: 'AC', quantity: 4 }
        ],
        accessComments: 'Ven sông Hàn gần đuôi Cầu Rồng'
      },
      {
        id: 'ev-dn-lottemart',
        name: 'Trạm sạc Lotte Mart Đà Nẵng',
        operator: 'VinFast',
        address: 'Đường 2 Tháng 9, Hòa Cường Bắc, Hải Châu, Đà Nẵng',
        city: 'danang',
        lat: 16.0350,
        lng: 108.2280,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 150,
        isFastCharge: true,
        totalPoints: 10,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 150, current: 'DC', quantity: 4 },
          { type: 'CCS (Type 2)', powerKw: 60, current: 'DC', quantity: 6 }
        ],
        accessComments: 'Bãi đỗ xe trước cổng siêu thị'
      },
      {
        id: 'ev-dn-airport',
        name: 'Trạm sạc Sân bay Quốc tế Đà Nẵng',
        operator: 'VinFast',
        address: 'Đường Duy Tân, Hòa Thuận Tây, Hải Châu, Đà Nẵng',
        city: 'danang',
        lat: 16.0520,
        lng: 108.2000,
        isOperational: true,
        statusText: 'Đang hoạt động 24/7',
        maxPowerKw: 180,
        isFastCharge: true,
        totalPoints: 12,
        connectors: [
          { type: 'CCS (Type 2)', powerKw: 180, current: 'DC', quantity: 6 },
          { type: 'Type 2', powerKw: 11, current: 'AC', quantity: 6 }
        ],
        accessComments: 'Bãi đỗ xe Ga Quốc nội T1'
      }
    ];
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

