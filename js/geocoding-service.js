/**
 * GeocodingService - Dịch vụ tìm kiếm địa chỉ, ngõ ngách, số nhà & Reverse Geocoding
 * Chuẩn giao diện và tính năng như Google Maps
 * Sử dụng Photon Komoot (OpenStreetMap Việt Nam) kết hợp Nominatim và MoveSafe Local Cache
 */

class GeocodingService {
  constructor() {
    this.photonBaseUrl = 'https://photon.komoot.io/api/';
    this.photonReverseUrl = 'https://photon.komoot.io/reverse';
    this.nominatimSearchUrl = 'https://nominatim.openstreetmap.org/search';
    this.nominatimReverseUrl = 'https://nominatim.openstreetmap.org/reverse';

    // Tọa độ trung tâm để ưu tiên kết quả tìm kiếm (bias)
    this.cityCenters = {
      hanoi: { lat: 21.0285, lng: 105.8542, name: 'Hà Nội' },
      hcm: { lat: 10.7769, lng: 106.6811, name: 'Hồ Chí Minh' },
      danang: { lat: 16.0544, lng: 108.2022, name: 'Đà Nẵng' }
    };

    // Bộ nhớ đệm tìm kiếm
    this.cache = new Map();
    this.reverseCache = new Map();
  }

  /**
   * Phân loại biểu tượng dựa trên tên hoặc thuộc tính OpenStreetMap
   */
  getCategoryIcon(item) {
    const text = ((item.name || '') + ' ' + (item.street || '') + ' ' + (item.type || '')).toLowerCase();
    
    // Ngõ, ngách, hẻm, kiệt
    if (text.includes('ngõ') || text.includes('ngách') || text.includes('hẻm') || text.includes('kiệt')) {
      return { icon: '🛣️', type: 'alley', typeName: 'Ngõ/Ngách' };
    }
    // Bệnh viện, y tế
    if (text.includes('bệnh viện') || text.includes('phòng khám') || item.osm_value === 'hospital' || item.osm_value === 'clinic') {
      return { icon: '🏥', type: 'hospital', typeName: 'Cơ sở y tế' };
    }
    // Trường học, đại học
    if (text.includes('trường') || text.includes('đại học') || text.includes('học viện') || item.osm_value === 'university' || item.osm_value === 'school') {
      return { icon: '🎓', type: 'education', typeName: 'Giáo dục' };
    }
    // Chợ, siêu thị, trung tâm thương mại
    if (text.includes('chợ') || text.includes('vincom') || text.includes('siêu thị') || text.includes('aeon') || item.osm_value === 'mall' || item.osm_value === 'supermarket') {
      return { icon: '🛍️', type: 'shopping', typeName: 'Mua sắm/Chợ' };
    }
    // Công viên, hồ nước
    if (text.includes('hồ') || text.includes('công viên') || item.osm_value === 'park' || item.osm_value === 'lake') {
      return { icon: '🌳', type: 'park', typeName: 'Công viên/Hồ' };
    }
    // Cầu, hầm, nút giao
    if (text.includes('cầu') || text.includes('nút giao') || text.includes('bùng binh')) {
      return { icon: '🌉', type: 'bridge', typeName: 'Cầu/Nút giao' };
    }
    // Phố, đường lớn
    if (text.includes('đường') || text.includes('phố') || text.includes('đại lộ') || item.osm_key === 'highway') {
      return { icon: '🚗', type: 'street', typeName: 'Đường phố' };
    }
    // Tòa nhà, chung cư
    if (text.includes('tòa') || text.includes('chung cư') || text.includes('building') || item.osm_value === 'apartments') {
      return { icon: '🏢', type: 'building', typeName: 'Tòa nhà' };
    }
    
    return { icon: '📍', type: 'place', typeName: 'Địa điểm' };
  }

  /**
   * Định dạng tên hiển thị chính và phụ cho kết quả tìm kiếm
   */
  formatResultItem(feature) {
    const p = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0];
    const lat = coords[1];
    const lng = coords[0];

    // Xác định tên chính (title)
    let title = p.name;
    if (!title) {
      if (p.housenumber && p.street) {
        title = `Số ${p.housenumber} ${p.street}`;
      } else if (p.street) {
        title = p.street;
      } else if (p.district) {
        title = p.district;
      } else if (p.city) {
        title = p.city;
      } else {
        title = 'Địa điểm trên bản đồ';
      }
    }

    // Xác định địa chỉ chi tiết (subtitle)
    const subParts = [];
    if (p.housenumber && p.street && title !== `Số ${p.housenumber} ${p.street}`) {
      subParts.push(`Số ${p.housenumber} ${p.street}`);
    } else if (p.street && p.street !== title) {
      subParts.push(p.street);
    }

    if (p.district) subParts.push(p.district);
    if (p.city && p.city !== p.district) subParts.push(p.city);

    const subtitle = subParts.join(', ') || p.country || 'Việt Nam';
    const cat = this.getCategoryIcon(p);

    return {
      title,
      subtitle,
      fullAddress: `${title}, ${subtitle}`,
      lat,
      lng,
      icon: cat.icon,
      type: cat.type,
      typeName: cat.typeName,
      raw: p
    };
  }

  /**
   * Tìm kiếm địa chỉ, ngõ ngách, số nhà bằng Photon API (OSM Việt Nam)
   * Có bias theo vị trí hiện tại hoặc trung tâm thành phố
   */
  async searchAddresses(query, options = {}) {
    const q = (query || '').trim();
    if (!q || q.length < 2) return [];

    const cityKey = options.city || 'hanoi';
    const center = options.center || this.cityCenters[cityKey] || this.cityCenters.hanoi;
    const limit = options.limit || 8;

    const cacheKey = `${q.toLowerCase()}_${center.lat.toFixed(2)}_${center.lng.toFixed(2)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // 1. Thử gọi Photon API (rất nhanh, nhạy với ngõ ngách & typo)
      const url = `${this.photonBaseUrl}?q=${encodeURIComponent(q)}&lat=${center.lat}&lon=${center.lng}&limit=${limit}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const results = data.features.map(f => this.formatResultItem(f));
          
          // Loại bỏ kết quả trùng lặp tọa độ
          const uniqueResults = [];
          const seen = new Set();
          for (const item of results) {
            const key = `${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueResults.push(item);
            }
          }

          if (this.cache.size > 150) this.cache.clear();
          this.cache.set(cacheKey, uniqueResults);
          return uniqueResults;
        }
      }
    } catch (e) {
      console.warn('[Geocoding] Photon lookup warning, trying Nominatim fallback...', e);
    }

    // 2. Dự phòng bằng OpenStreetMap Nominatim
    try {
      const nomUrl = `${this.nominatimSearchUrl}?q=${encodeURIComponent(q)}&format=json&countrycodes=vn&addressdetails=1&limit=${limit}`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'User-Agent': 'MoveSafeVN-App/1.0 (contact: info@movesafe.vn)' }
      });

      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const results = nomData.map(d => {
          const addr = d.address || {};
          const title = addr.road || addr.suburb || addr.neighbourhood || d.name || q;
          const subParts = [addr.suburb, addr.city_district || addr.county, addr.city || addr.state].filter(Boolean);
          const subtitle = subParts.join(', ') || d.display_name;

          return {
            title,
            subtitle,
            fullAddress: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            icon: '📍',
            type: 'place',
            typeName: 'Địa điểm'
          };
        });

        if (this.cache.size > 150) this.cache.clear();
        this.cache.set(cacheKey, results);
        return results;
      }
    } catch (nomErr) {
      console.warn('[Geocoding] Nominatim lookup error:', nomErr);
    }

    return [];
  }

  /**
   * Reverse Geocoding: Lấy địa chỉ cụ thể từ kinh độ/vĩ độ
   */
  async reverseGeocode(lat, lng) {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (this.reverseCache.has(cacheKey)) {
      return this.reverseCache.get(cacheKey);
    }

    try {
      const url = `${this.photonReverseUrl}?lat=${lat}&lon=${lng}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const item = this.formatResultItem(data.features[0]);
          const result = {
            title: item.title,
            subtitle: item.subtitle,
            fullAddress: item.fullAddress,
            lat,
            lng
          };
          this.reverseCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (e) {
      console.warn('[Reverse Geocoding] Photon reverse failed:', e);
    }

    // Dự phòng Nominatim reverse
    try {
      const nomUrl = `${this.nominatimReverseUrl}?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(nomUrl, {
        headers: { 'User-Agent': 'MoveSafeVN-App/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const title = addr.road || addr.suburb || 'Vị trí đã chọn';
        const subParts = [addr.suburb, addr.city_district, addr.city].filter(Boolean);
        const subtitle = subParts.join(', ') || data.display_name;
        const result = {
          title,
          subtitle,
          fullAddress: data.display_name,
          lat,
          lng
        };
        this.reverseCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('[Reverse Geocoding] Nominatim reverse failed:', e);
    }

    // Mặc định trả về tọa độ nếu không phân giải được
    return {
      title: `Tọa độ [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
      subtitle: 'Vị trí trên bản đồ',
      fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      lat,
      lng
    };
  }

  /**
   * Lấy vị trí GPS hiện tại của người dùng kèm địa chỉ cụ thể
   */
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Trình duyệt không hỗ trợ định vị GPS'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          try {
            const addrInfo = await this.reverseGeocode(lat, lng);
            resolve({
              lat,
              lng,
              title: 'Vị trí của bạn',
              subtitle: addrInfo.fullAddress,
              fullAddress: addrInfo.fullAddress
            });
          } catch {
            resolve({
              lat,
              lng,
              title: 'Vị trí của bạn',
              subtitle: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              fullAddress: 'Vị trí GPS hiện tại'
            });
          }
        },
        (err) => {
          reject(new Error(err.message || 'Không thể lấy tọa độ vị trí'));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }
}

// Khởi tạo global instance
window.geocodingService = new GeocodingService();
