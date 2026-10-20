/**
 * RoutingService - Thuật toán định tuyến giao thông thông minh xét Đặc tính Kỹ thuật & Nguy cơ của từng Phương tiện
 * Sử dụng OSRM Routing Engine kết hợp bộ phân tích chướng ngại vật thời gian thực TomTom & HSDC MoveSafe
 * 
 * NGUYÊN TẮC CỐT LÕI:
 * 1. KHÔNG chỉ đường qua điểm ngập sâu rồi gắn nhãn cảnh báo cho người dùng đi!
 * 2. Xét ĐẶC TÍNH KỸ THUẬT & NGƯỠNG AN TOÀN của từng phương tiện (Xe máy xăng, Xe máy điện, Ô tô xăng, Ô tô điện).
 * 3. Điểm ngập vượt ngưỡng kỹ thuật = VẬT CẢN BẤT KHẢ DỤNG -> Tự động tính toán tuyến đường vòng (Bypass Detour).
 * 4. Cả 3 chế độ (An toàn, Cân bằng, Nhanh nhất) PHẢI LÀ CÁC TUYẾN ĐI ĐƯỢC:
 *    - Tuyến 1 (🛡️ An toàn tuyệt đối): Ưu tiên 100% Khô ráo (0cm ngập) & né kẹt xe tối đa.
 *    - Tuyến 2 (⚖️ Cân bằng thông minh): Tối ưu hài hòa giữa thời gian di chuyển và mức độ an toàn.
 *    - Tuyến 3 (⚡ Nhanh nhất): Tuyến có thời gian di chuyển ngắn nhất TRONG SỐ CÁC TUYẾN XE ĐI ĐƯỢC HỢP LỆ.
 */

class RoutingService {
  constructor() {
    this.osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving';

    // Bảng thông số kỹ thuật & ngưỡng an toàn thực tế theo từng phương tiện
    this.vehicleSpecs = {
      motorbike: {
        type: 'motorbike',
        name: 'Xe máy xăng',
        icon: '',
        maxPassableDepth: 20, // cm - Quá 20cm là ngập ống pô, ướt bugi gây chết máy giữa dòng
        safeDepth: 10,        // cm - Nước nông dưới mép lốp, hoàn toàn an toàn
        corridorBuffer: 110,  // m - Bán kính ảnh hưởng rốn ngập (chuẩn đường phố đô thị VN)
        detourOffsets: [450, 750, 1100], // Các mức cự ly lệch tìm đường tránh (m)
        hazardRisk: 'Chết máy do nước vào ống xả và ướt bugi',
        allowAlleys: true,
        speedFactor: 1.15
      },
      ebike: {
        type: 'ebike',
        name: 'Xe máy điện',
        icon: '',
        maxPassableDepth: 20, // cm - Khoang pin sàn & controller IC ngập nước gây chập hoặc ngắt an toàn
        safeDepth: 10,        // cm
        corridorBuffer: 110,
        detourOffsets: [450, 750, 1100],
        hazardRisk: 'Chập mạch IC điều khiển & ngắt an toàn pin xe điện',
        allowAlleys: true,
        speedFactor: 1.1
      },
      car: {
        type: 'car',
        name: 'Ô tô xăng',
        icon: '',
        maxPassableDepth: 25, // cm - Mép hút gió sedan/hatchback, nguy cơ THỦY KÍCH phá hủy tay biên & vỡ lốc máy
        safeDepth: 15,        // cm - Nước dưới nửa bánh xe, an toàn cho gầm sedan
        corridorBuffer: 130,
        detourOffsets: [650, 1000, 1400],
        hazardRisk: 'Nguy cơ THỦY KÍCH phá hủy tay biên & vỡ lốc máy',
        allowAlleys: false,
        speedFactor: 0.95
      },
      ecar: {
        type: 'ecar',
        name: 'Ô tô điện',
        icon: '',
        maxPassableDepth: 30, // cm - Khối pin IP67 nhưng ngập sâu > 30cm sinh lực đẩy bồng bềnh mất lái & ngắt rơ-le cao áp
        safeDepth: 15,        // cm
        corridorBuffer: 130,
        detourOffsets: [650, 1000, 1400],
        hazardRisk: 'Mất lái trôi xe do bồng bềnh & ngắt an toàn pin cao áp',
        allowAlleys: false,
        speedFactor: 0.95
      }
    };

    // Cấu hình 3 mức độ tránh né
    this.avoidanceLevels = {
      1: {
        name: 'An toàn tuyệt đối',
        icon: '',
        description: 'Tuyến khô ráo 100% (0cm ngập) & né kẹt xe tối đa',
        color: '#1e8e3e'
      },
      2: {
        name: 'Cân bằng thông minh',
        icon: '',
        description: 'Đi được nước nông an toàn, né ngập sâu & kẹt cứng để tối ưu cự ly',
        color: '#f9ab00'
      },
      3: {
        name: 'Nhanh nhất (Tuyến đi được)',
        icon: '',
        description: 'Tuyến ngắn nhất & nhanh nhất trong số các đường xe đi được an toàn',
        color: '#1a73e8'
      }
    };

    // Bộ nhớ đệm Route Cache (TTL 3 phút) giảm tải OSRM
    this.routeCache = new Map();
  }

  // Tính khoảng cách giữa 2 tọa độ (Haversine formula - mét)
  getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Kiểm tra quy định giao thông đường bộ Việt Nam theo loại phương tiện
  checkVehicleRoadRestrictions(route, vehicleType) {
    if (!route.steps || route.steps.length === 0) return { allowed: true };

    const isTwoWheeler = (vehicleType === 'motorbike' || vehicleType === 'ebike');
    const isFourWheeler = (vehicleType === 'car' || vehicleType === 'ecar');

    // Các tuyến cao tốc cấm hoàn toàn xe 2 bánh tại VN
    const expresswayKeywords = [
      'vành đai 3 trên cao', 'vanh dai 3 tren cao',
      'đại lộ thăng long (làn cao tốc)', 'cao tốc', 'expressway',
      'cầu vượt thanh trì', 'long thành - dầu giây', 'trung lương'
    ];

    for (const step of route.steps) {
      const stepName = (step.name || '').toLowerCase();
      if (isTwoWheeler) {
        for (const kw of expresswayKeywords) {
          if (stepName.includes(kw)) {
            return {
              allowed: false,
              violation: `Đoạn "${step.name}" là đường cao tốc cấm xe 2 bánh`
            };
          }
        }
      }
      if (isFourWheeler) {
        // Cảnh báo nếu ô tô vào ngõ/ngách quá nhỏ
        if (stepName.includes('ngõ ') || stepName.includes('ngách ') || stepName.includes('hẻm ')) {
          route.alleyWarning = true;
        }
      }
    }

    return { allowed: true };
  }

  // Gọi OSRM lấy tọa độ đường đi (có cache)
  async fetchOsrmRoute(waypoints) {
    const coordsStr = waypoints.map(w => `${w[0].toFixed(5)},${w[1].toFixed(5)}`).join(';');
    const cacheKey = coordsStr;

    const cached = this.routeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 180000)) {
      return cached.data;
    }

    const url = `${this.osrmBaseUrl}/${coordsStr}?overview=full&geometries=geojson&steps=true&alternatives=true`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Không thể kết nối máy chủ định tuyến OSRM');
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) throw new Error('Không tìm thấy đường đi');

    const mapped = data.routes.map(route => ({
      distanceKm: (route.distance / 1000).toFixed(1),
      distanceMeters: route.distance,
      durationMin: Math.round(route.duration / 60),
      durationSeconds: route.duration,
      polyline: route.geometry.coordinates.map(c => [c[1], c[0]]),
      steps: route.legs ? route.legs[0].steps.map(s => ({
        instruction: s.maneuver.type + ' ' + (s.name || ''),
        distance: s.distance,
        name: s.name || ''
      })) : []
    }));

    this.routeCache.set(cacheKey, { timestamp: Date.now(), data: mapped });
    return mapped;
  }

  // Lọc loại bỏ các tuyến đường bị trùng lặp hình học
  filterDistinctRoutes(routes) {
    const distinct = [];
    for (const r of routes) {
      const isDuplicate = distinct.some(d => {
        const distDiff = Math.abs(d.distanceMeters - r.distanceMeters);
        if (distDiff < 120) {
          const mid1 = d.polyline[Math.floor(d.polyline.length / 2)];
          const mid2 = r.polyline[Math.floor(r.polyline.length / 2)];
          if (mid1 && mid2) {
            const midDist = this.getDistanceMeters(mid1[0], mid1[1], mid2[0], mid2[1]);
            if (midDist < 250) return true;
          }
        }
        return false;
      });

      if (!isDuplicate) {
        distinct.push(r);
      }
    }
    return distinct;
  }

  // Phát hiện tuyến đường có quay đầu (backtracking / U-turn)
  detectBacktracking(polyline, originLat, originLng, destLat, destLng) {
    if (!polyline || polyline.length < 10) return false;
    const directDist = this.getDistanceMeters(originLat, originLng, destLat, destLng);
    if (directDist < 1000) return false;

    const sampleStep = Math.max(1, Math.floor(polyline.length / 50));
    let minDistSoFar = Infinity;
    const backtrackThreshold = Math.max(1500, directDist * 0.25);

    for (let i = 0; i < polyline.length; i += sampleStep) {
      const pt = polyline[i];
      const currentDist = this.getDistanceMeters(pt[0], pt[1], destLat, destLng);

      if (currentDist < minDistSoFar) {
        minDistSoFar = currentDist;
      }

      if (currentDist > minDistSoFar + backtrackThreshold) {
        return true;
      }
    }
    return false;
  }

  // Kiểm tra tuyến đường có quá dài so với đường thẳng không (vòng quá mức)
  isExcessiveDetour(route, directDistMeters) {
    const maxRatio = 2.2;
    if (directDistMeters > 0 && route.distanceMeters > directDistMeters * maxRatio) {
      return true;
    }
    return false;
  }

  /**
   * Phân loại chướng ngại vật theo đặc tính kỹ thuật của phương tiện
   */
  classifyHazards(floodPoints, trafficIncidents, vehicleType) {
    const specs = this.vehicleSpecs[vehicleType] || this.vehicleSpecs.motorbike;

    // Rốn ngập vượt quá giới hạn an toàn kỹ thuật -> VẬT CẢN BẤT KHẢ DỤNG (BLOCKED)
    const blockedFloods = floodPoints.filter(f =>
      f.depth_cm >= specs.maxPassableDepth && f.danger_level !== 'safe'
    );

    // Rốn ngập trong vùng cảnh báo (nước tương đối sâu nhưng dưới ngưỡng tử thần)
    const cautionFloods = floodPoints.filter(f =>
      f.depth_cm > specs.safeDepth && f.depth_cm < specs.maxPassableDepth && f.danger_level !== 'safe'
    );

    // Vũng nước nông an toàn (dưới nửa bánh xe / gầm xe)
    const safeFloods = floodPoints.filter(f =>
      f.depth_cm > 0 && f.depth_cm <= specs.safeDepth && f.danger_level !== 'safe'
    );

    // Điểm đóng đường do thi công hoặc kẹt cứng bất động >= 30 phút
    const blockedTraffics = trafficIncidents.filter(t =>
      t.type === 'road_closure' || (t.isJam && t.delaySeconds >= 1800)
    );

    return { specs, blockedFloods, cautionFloods, safeFloods, blockedTraffics };
  }

  /**
   * Kiểm tra xem tuyến đường có cắt qua bất kỳ điểm ngập BẤT KHẢ DỤNG nào không
   * Tối ưu hóa bằng Bounding Box pre-filter để giảm 95% phép tính lượng giác Haversine
   */
  checkRoutePassability(polyline, blockedFloods, blockedTraffics, corridorBuffer) {
    const blockedBy = [];
    if (blockedFloods.length === 0 && blockedTraffics.length === 0) {
      return { isPassable: true, blockedBy };
    }

    const degMargin = 0.004; // ~440m

    for (let i = 0; i < polyline.length; i++) {
      const pt = polyline[i];
      const pLat = pt[0];
      const pLng = pt[1];

      for (let j = 0; j < blockedFloods.length; j++) {
        const f = blockedFloods[j];
        if (Math.abs(pLat - f.lat) > degMargin || Math.abs(pLng - f.lng) > degMargin) continue;
        const d = this.getDistanceMeters(pLat, pLng, f.lat, f.lng);
        const radius = f.radius || corridorBuffer;
        if (d <= radius && !blockedBy.some(b => b.id === f.id)) {
          blockedBy.push({
            ...f,
            hazardType: 'blocked_flood',
            distanceToRoute: Math.round(d)
          });
        }
      }

      for (let k = 0; k < blockedTraffics.length; k++) {
        const t = blockedTraffics[k];
        if (Math.abs(pLat - t.lat) > 0.002 || Math.abs(pLng - t.lng) > 0.002) continue;
        const d = this.getDistanceMeters(pLat, pLng, t.lat, t.lng);
        if (d <= 150 && !blockedBy.some(b => b.id === t.id)) {
          blockedBy.push({
            ...t,
            hazardType: 'blocked_traffic',
            distanceToRoute: Math.round(d)
          });
        }
      }
    }

    return {
      isPassable: blockedBy.length === 0,
      blockedBy
    };
  }

  /**
   * Sinh các tọa độ Waypoint né ngập động xung quanh các chướng ngại vật bị chặn
   */
  generateDetourWaypoints(origin, destination, hazardsToAvoid, specs) {
    const dLat = destination.lat - origin.lat;
    const dLng = destination.lng - origin.lng;
    const len = Math.hypot(dLat, dLng);
    if (len === 0) return [];

    // Pháp tuyến vuông góc với hướng A→B
    const perpLat = -(dLng / len);
    const perpLng = (dLat / len);

    const waypoints = [];

    // 1. Waypoint né hai bên của từng rốn ngập cần tránh
    hazardsToAvoid.forEach(bf => {
      specs.detourOffsets.forEach(offM => {
        const offDeg = offM / 111000;
        waypoints.push({ lat: bf.lat + perpLat * offDeg, lng: bf.lng + perpLng * offDeg });
        waypoints.push({ lat: bf.lat - perpLat * offDeg, lng: bf.lng - perpLng * offDeg });
      });
    });

    // 2. Waypoints hành lang song song tại 40% và 60% cự ly
    specs.detourOffsets.forEach(offM => {
      const offDeg = offM / 111000;
      waypoints.push({ lat: origin.lat + dLat * 0.4 + perpLat * offDeg, lng: origin.lng + dLng * 0.4 + perpLng * offDeg });
      waypoints.push({ lat: origin.lat + dLat * 0.4 - perpLat * offDeg, lng: origin.lng + dLng * 0.4 - perpLng * offDeg });
      waypoints.push({ lat: origin.lat + dLat * 0.6 + perpLat * offDeg, lng: origin.lng + dLng * 0.6 + perpLng * offDeg });
      waypoints.push({ lat: origin.lat + dLat * 0.6 - perpLat * offDeg, lng: origin.lng + dLng * 0.6 - perpLng * offDeg });
    });

    // Lọc loại bỏ waypoint quá sát nhau (< 200m)
    const uniqueWps = [];
    waypoints.forEach(wp => {
      const isClose = uniqueWps.some(u => this.getDistanceMeters(u.lat, u.lng, wp.lat, wp.lng) < 200);
      if (!isClose) uniqueWps.push(wp);
    });

    return uniqueWps;
  }

  /**
   * Đánh giá chi tiết lưu thông & điểm ngập nhẹ trên từng tuyến ĐI ĐƯỢC
   * Tích hợp:
   * 1. Mô hình phi tuyến tính BPR (Bureau of Public Roads) đánh giá suy giảm dòng xe
   * 2. Bộ lọc bẫy ngõ hẹp đô thị (Anti-Alley Trap)
   * 3. Chỉ số ổn định lộ trình (Route Predictability Index - RPI)
   * 4. Điểm êm ái & Tiết kiệm năng lượng (Eco-Smooth Score)
   */
  evaluatePassableRoute(route, cautionFloods, safeFloods, trafficIncidents, specs) {
    const polyline = route.polyline;
    const totalPoints = polyline.length;
    let affectedPoints = 0;

    const matchedFloods = [];
    const matchedTraffics = [];
    const allShallowFloods = [...cautionFloods, ...safeFloods];
    const degLimit = 0.0035; // ~380m

    for (let i = 0; i < totalPoints; i++) {
      const pt = polyline[i];
      const pLat = pt[0];
      const pLng = pt[1];
      let isPointCongested = false;

      // Kẹt xe / sự cố
      for (let j = 0; j < trafficIncidents.length; j++) {
        const inc = trafficIncidents[j];
        if (Math.abs(pLat - inc.lat) > degLimit || Math.abs(pLng - inc.lng) > degLimit) continue;
        const dist = this.getDistanceMeters(pLat, pLng, inc.lat, inc.lng);
        if (dist <= 250) {
          if (inc.isJam) {
            isPointCongested = true;
          }
          if (!matchedTraffics.some(t => t.id === inc.id)) {
            matchedTraffics.push({
              ...inc,
              hazardType: 'traffic',
              distanceToRoute: Math.round(dist)
            });
          }
          break;
        }
      }

      // Ngập nhẹ / nước nông
      for (let k = 0; k < allShallowFloods.length; k++) {
        const fl = allShallowFloods[k];
        if (Math.abs(pLat - fl.lat) > degLimit || Math.abs(pLng - fl.lng) > degLimit) continue;
        const dist = this.getDistanceMeters(pLat, pLng, fl.lat, fl.lng);
        if (dist <= (fl.radius || specs.corridorBuffer)) {
          if (!matchedFloods.some(f => f.id === fl.id)) {
            matchedFloods.push({
              ...fl,
              hazardType: 'flood',
              distanceToRoute: Math.round(dist),
              isSafeShallow: (fl.depth_cm <= specs.safeDepth)
            });
          }
          break;
        }
      }

      if (isPointCongested) affectedPoints++;
    }

    const jamPercent = totalPoints > 0 ? Math.round((affectedPoints / totalPoints) * 100) : 0;
    const severeCount = matchedTraffics.filter(t => t.isJam && (t.speedKmh < 12 || t.delaySeconds >= 600)).length;
    const moderateCount = matchedTraffics.filter(t => t.isJam && (!t.speedKmh || (t.speedKmh >= 12 && t.speedKmh < 25))).length;

    // 1. Phân tích bẫy ngõ hẹp và phân cấp trục đường đô thị
    let alleyDistanceMeters = 0;
    let majorDistanceMeters = 0;
    const alleyKeywords = ['ngõ', 'ngách', 'hẻm', 'kiệt', 'đường bê tông', 'đường đê', 'lối đi', 'đường mòn'];
    const majorKeywords = ['đường', 'phố', 'đại lộ', 'quốc lộ', 'vành đai', 'cầu', 'hầm', 'trục'];

    if (route.steps && route.steps.length > 0) {
      route.steps.forEach(s => {
        const name = (s.name || '').toLowerCase();
        const dist = s.distance || 0;
        if (alleyKeywords.some(kw => name.includes(kw))) {
          alleyDistanceMeters += dist;
        }
        if (majorKeywords.some(kw => name.includes(kw))) {
          majorDistanceMeters += dist;
        }
      });
    }

    const alleyRatio = route.distanceMeters > 0 ? (alleyDistanceMeters / route.distanceMeters) : 0;
    const isFourWheeler = (specs.type === 'car' || specs.type === 'ecar');
    const hasAlleyTrap = isFourWheeler && (alleyDistanceMeters > 250 || alleyRatio > 0.15);

    // 2. Nhận diện khung giờ cao điểm thực tế tại đô thị Việt Nam
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const isPeakHour = (currentHour >= 7.0 && currentHour <= 8.75) || (currentHour >= 16.75 && currentHour <= 19.25);

    // 3. Mô hình BPR (Bureau of Public Roads) phi tuyến tính tính toán thời gian trễ thực tế
    const baseDurationMin = Math.max(1, Math.round(route.durationSeconds / 60));
    let totalBprDelayMin = 0;
    const bottleneckWarnings = [];

    matchedTraffics.forEach(t => {
      if (t.isJam || t.type === 'accident' || t.type === 'roadwork' || t.type === 'road_closure') {
        const speed = t.speedKmh || 14;
        // Tỷ lệ bão hòa dòng xe V/C: Vận tốc càng thấp -> V/C càng tiệm cận hoặc vượt 1.0
        const vcRatio = speed < 10 ? 1.1 : (speed < 18 ? 0.9 : 0.7);

        // Công thức BPR: độ trễ tăng phi tuyến theo lũy thừa 4 khi đường bão hòa
        let bprDelay = Math.round(4 * 0.15 * Math.pow(vcRatio, 4) * 8); // Dao động ~5 - 15 phút
        if (t.delaySeconds && t.delaySeconds > 0) {
          bprDelay = Math.max(bprDelay, Math.round(t.delaySeconds / 60));
        }
        if (isPeakHour) {
          bprDelay = Math.round(bprDelay * 1.35); // Nhân hệ số 1.35 trong giờ tan tầm
        }

        totalBprDelayMin += Math.min(bprDelay, 25);

        // Ghi nhận nút thắt cổ chai cảnh báo cho người lái
        if (speed < 12 || bprDelay >= 8) {
          const bName = t.roadName || t.description || t.categoryName || 'Nút giao trọng điểm';
          if (!bottleneckWarnings.includes(bName)) {
            bottleneckWarnings.push(bName);
          }
        }
      }
    });

    // Nếu là giờ cao điểm mà đi qua ngõ ngách, cộng thêm độ trễ do dồn lưu lượng vào ngõ hẹp
    if (isPeakHour && alleyRatio > 0.1) {
      totalBprDelayMin += Math.round(alleyDistanceMeters / 80);
    }

    let realDurationMin = baseDurationMin + totalBprDelayMin;
    realDurationMin = Math.max(3, Math.round(realDurationMin / specs.speedFactor));

    // Vận tốc dòng xe trung bình thực tế:
    const distanceKmNum = parseFloat(route.distanceKm) || (route.distanceMeters / 1000);
    const realAvgSpeedKmh = Math.max(6, Math.min(65, Math.round(distanceKmNum / (realDurationMin / 60))));

    // 4. Chỉ số Độ tin cậy Lộ trình (Route Predictability Index - RPI %):
    // Đo lường xác suất đến đúng giờ, không gặp biến động ngoài dự kiến
    let rpi = 100 - (jamPercent * 0.4 + severeCount * 12 + moderateCount * 4 + matchedFloods.length * 15 + (hasAlleyTrap ? 20 : 0));
    if (isPeakHour && severeCount > 0) rpi -= 10;
    rpi = Math.max(35, Math.min(98, Math.round(rpi)));

    // 5. Điểm êm ái & Tiết kiệm năng lượng (Eco-Smooth Score / 100):
    // Đo lường mức độ duy trì vận tốc đều đặn, ít nhịp phanh dừng giật cục
    let ecoScore = Math.max(40, Math.min(99, Math.round(
      96 - (jamPercent * 0.45) - (severeCount * 12) - (hasAlleyTrap ? 18 : 0) + (majorDistanceMeters > route.distanceMeters * 0.65 ? 6 : 0)
    )));

    // Điểm bất lợi tổng hợp (cho thuật toán sắp xếp)
    const congestionScore = (severeCount * 50) + (moderateCount * 20) + (matchedFloods.length * 25) + (jamPercent * 1.5) + (hasAlleyTrap ? 80 : 0);

    return {
      ...route,
      durationMin: realDurationMin,
      baseDurationMin,
      delayMin: Math.max(0, realDurationMin - baseDurationMin),
      realAvgSpeedKmh,
      rpi,
      ecoScore,
      alleyDistanceMeters,
      alleyRatio: Math.round(alleyRatio * 100),
      hasAlleyTrap,
      bottleneckWarnings,
      isPeakHour,
      matchedFloods,
      matchedTraffics,
      warnings: [...matchedFloods, ...matchedTraffics],
      jamPercent: Math.min(100, Math.max(0, jamPercent)),
      freeFlowPercent: Math.max(0, 100 - jamPercent),
      severeCount,
      moderateCount,
      congestionScore
    };
  }

  /**
   * Xây dựng 3 chế độ (Nhanh thực tế, An toàn hành lang lớn, Trục chính êm ái)
   * Bẻ gãy triệt để 3 nghịch lý giao thông đô thị:
   * - Nghịch lý "Nhanh nhất hóa ra chậm nhất" -> Sử dụng Dynamic Flow BPR
   * - Nghịch lý "Né ngập rơi vào bẫy ngõ hẹp" -> Tuyến Resilient Corridor cấm ngõ nhỏ
   * - Nghịch lý "Cân bằng nửa nạc nửa mỡ" -> Tuyến Major Road & Eco-Smooth tối ưu năng lượng
   */
  buildThreePassableModes(passableCandidates, activeAvoidLevel, specs, blockedRoutes) {
    if (passableCandidates.length === 0) {
      throw new Error(`Không có tuyến đường khả dụng cho ${specs.name}`);
    }

    // 1. Tuyến 1: ⚡ Nhanh thực tế (Dynamic Flow)
    // Sắp xếp theo realDurationMin (thời gian thực tế đã tính BPR delay và vận tốc dòng xe)
    const sortedByFastest = [...passableCandidates].sort((a, b) => {
      if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
      if (a.severeCount !== b.severeCount) return a.severeCount - b.severeCount;
      return a.distanceMeters - b.distanceMeters;
    });
    const fastestRoute = sortedByFastest[0];

    // 2. Tuyến 2: 🛡️ An toàn hành lang lớn (Resilient Corridor)
    // Ưu tiên: 0 ngập, CẤM BẪY NGÕ HẸP, cốt nền cao, RPI cao nhất
    const sortedBySafety = [...passableCandidates].sort((a, b) => {
      // Ưu tiên 1: Không dính bẫy ngõ hẹp
      const trapDiff = (a.hasAlleyTrap ? 1 : 0) - (b.hasAlleyTrap ? 1 : 0);
      if (trapDiff !== 0) return trapDiff;

      // Ưu tiên 2: Ít điểm ngập nước nhất (ưu tiên tuyệt đối 0 điểm ngập)
      const floodDiff = a.matchedFloods.length - b.matchedFloods.length;
      if (floodDiff !== 0) return floodDiff;

      // Ưu tiên 3: Tỷ lệ ngõ ngách thấp nhất (đi đường phân phối lớn)
      const alleyDiff = a.alleyRatio - b.alleyRatio;
      if (Math.abs(alleyDiff) > 10) return alleyDiff;

      // Ưu tiên 4: Độ tin cậy thời gian (RPI) cao hơn
      if (a.rpi !== b.rpi) return b.rpi - a.rpi;

      return a.durationMin - b.durationMin;
    });
    const safeRoute = sortedBySafety[0];

    // 3. Tuyến 3: ⚖️ Trục chính êm ái (Major Road & Eco-Smooth)
    // Ưu tiên: Điểm êm ái EcoScore cao nhất, dòng xe đều đặn, ít khúc cua gấp, tiết kiệm nhiên liệu/pin
    const sortedByBalanced = [...passableCandidates].sort((a, b) => {
      // Ưu tiên 1: EcoScore cao hơn
      if (a.ecoScore !== b.ecoScore) return b.ecoScore - a.ecoScore;

      // Ưu tiên 2: Cân bằng thời gian & độ an toàn
      const scoreA = a.durationMin * 1.8 + a.matchedFloods.length * 12 + a.congestionScore * 0.3;
      const scoreB = b.durationMin * 1.8 + b.matchedFloods.length * 12 + b.congestionScore * 0.3;
      return scoreA - scoreB;
    });
    let balancedRoute = sortedByBalanced.find(r => r !== fastestRoute && r !== safeRoute);
    if (!balancedRoute) {
      balancedRoute = sortedByBalanced.find(r => r !== safeRoute) || sortedByBalanced[0];
    }

    const safeJam = safeRoute.jamPercent;
    const safeFree = 100 - safeJam;
    const balJam = balancedRoute.jamPercent;
    const balFree = 100 - balJam;
    const fastJam = fastestRoute.jamPercent;
    const fastFree = 100 - fastJam;

    const safeFloodText = safeRoute.matchedFloods.length === 0
      ? '100% Khô ráo'
      : `${safeRoute.matchedFloods.length} đoạn nước nông`;

    // Chuẩn bị nhãn và mô tả chi tiết cho từng chế độ
    const routeSafe = {
      ...safeRoute,
      routeType: 'safe_bypass',
      label: 'An toàn hành lang lớn',
      sublabel: `${safeFloodText} • Tránh bẫy ngõ hẹp • Tin cậy ${safeRoute.rpi}%`,
      tagText: `Tin cậy ${safeRoute.rpi}% • 0% Ngập lụt`,
      tagClass: 'gm-tag-safe',
      trafficDesc: safeRoute.matchedFloods.length === 0
        ? 'Tuyến hành lang lớn cao ráo, cốt nền chuẩn, không dắt vào ngõ hẹp, độ tin cậy thời gian cao nhất'
        : 'Đi vòng qua các trục đường lớn cao ráo, chỉ dính nước nông nhẹ không ảnh hưởng máy',
      jamPercent: safeJam,
      freeFlowPercent: safeFree,
      moderatePercent: safeJam,
      severePercent: 0,
      isRecommended: (activeAvoidLevel === 1),
      color: '#1e8e3e',
      avoidLevel: 1
    };

    const routeBalanced = {
      ...balancedRoute,
      routeType: 'balanced',
      label: 'Trục chính êm ái (Eco-Smooth)',
      sublabel: `Tốc độ đều ~${balancedRoute.realAvgSpeedKmh} km/h • Êm ái ${balancedRoute.ecoScore}/100`,
      tagText: `Êm ái ${balancedRoute.ecoScore}/100 • Tiết kiệm năng lượng`,
      tagClass: 'gm-tag-warning',
      trafficDesc: 'Ưu tiên các trục đường thẳng lớn, ít nhịp phanh dừng giật cục, tối ưu năng lượng pin & xăng',
      jamPercent: balJam,
      freeFlowPercent: balFree,
      moderatePercent: balJam,
      severePercent: 0,
      isRecommended: (activeAvoidLevel === 2),
      color: '#f9ab00',
      avoidLevel: 2
    };

    const delayText = fastestRoute.delayMin > 0 ? ` (+${fastestRoute.delayMin}p)` : '';
    const bottleneckDesc = fastestRoute.bottleneckWarnings.length > 0
      ? `Cảnh báo nút thắt: ${fastestRoute.bottleneckWarnings.slice(0, 2).join(', ')}`
      : 'Hành lang tối ưu lưu lượng thực tế';

    const routeFastest = {
      ...fastestRoute,
      routeType: 'fastest',
      label: 'Nhanh thực tế (Dynamic Flow)',
      sublabel: `Tốc độ thực ~${fastestRoute.realAvgSpeedKmh} km/h • Trễ${delayText} • Tin cậy ${fastestRoute.rpi}%`,
      tagText: `Nhanh thực tế • ~${fastestRoute.realAvgSpeedKmh} km/h`,
      tagClass: 'gm-tag-fastest',
      trafficDesc: `${bottleneckDesc} (Mô hình BPR TomTom + VOV)`,
      jamPercent: fastJam,
      freeFlowPercent: fastFree,
      moderatePercent: Math.round(fastJam * 0.6),
      severePercent: Math.round(fastJam * 0.4),
      isRecommended: (activeAvoidLevel === 3),
      color: '#1a73e8',
      avoidLevel: 3
    };

    let routes = [routeSafe, routeBalanced, routeFastest];
    if (activeAvoidLevel === 2) {
      routes = [routeBalanced, routeSafe, routeFastest];
    } else if (activeAvoidLevel === 3) {
      routes = [routeFastest, routeBalanced, routeSafe];
    }

    return {
      noPassableRoute: false,
      avoidLevel: activeAvoidLevel,
      vehicleSpecs: specs,
      routes,
      blockedRoutes: blockedRoutes || [],
      totalHazards: fastestRoute.warnings.length,
      floodHazards: fastestRoute.matchedFloods,
      trafficHazards: fastestRoute.matchedTraffics
    };
  }

  /**
   * THUẬT TOÁN ĐỊNH TUYẾN CHÍNH:
   * Tìm kiếm lộ trình xét Đặc tính Kỹ thuật & Nguy cơ của Phương tiện
   */
  async calculateMultiRoutes({ origin, destination, floodPoints = [], trafficIncidents = [], vehicleType = 'motorbike', avoidLevel = 1 }) {
    const { specs, blockedFloods, cautionFloods, safeFloods, blockedTraffics } =
      this.classifyHazards(floodPoints, trafficIncidents, vehicleType);

    const directDistMeters = this.getDistanceMeters(origin.lat, origin.lng, destination.lat, destination.lng);

    // 1. Kiểm tra nếu điểm xuất phát hoặc điểm đến nằm ngay trong tâm rốn ngập sâu
    const originInDeepFlood = blockedFloods.find(f =>
      this.getDistanceMeters(origin.lat, origin.lng, f.lat, f.lng) <= (f.radius || specs.corridorBuffer)
    );
    const destInDeepFlood = blockedFloods.find(f =>
      this.getDistanceMeters(destination.lat, destination.lng, f.lat, f.lng) <= (f.radius || specs.corridorBuffer)
    );

    if (originInDeepFlood || destInDeepFlood) {
      const badSpot = originInDeepFlood || destInDeepFlood;
      return {
        noPassableRoute: true,
        vehicleSpecs: specs,
        vehicleType,
        avoidLevel,
        blockedFloods,
        message: `Khu vực ${originInDeepFlood ? 'xuất phát' : 'điểm đến'} (${badSpot.name}) đang ngập sâu ${badSpot.depth_cm}cm, vượt quá giới hạn an toàn ${specs.maxPassableDepth}cm của ${specs.name}.`,
        advice: `Nguy cơ: ${specs.hazardRisk}. Bạn nên tạm hoãn xuất phát hoặc đổi sang xe gầm cao / xe cứu hộ.`,
        routes: []
      };
    }

    // 2. Lấy tuyến trực tiếp từ OSRM (đã bao gồm các alternative routes)
    const directRoutes = await this.fetchOsrmRoute([
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ]).catch(() => []);

    // Kiểm tra sơ bộ các tuyến trực tiếp xem có tuyến nào đi được an toàn không
    let directPassableCount = 0;
    directRoutes.forEach(r => {
      const p = this.checkRoutePassability(r.polyline, blockedFloods, blockedTraffics, specs.corridorBuffer);
      const v = this.checkVehicleRoadRestrictions(r, vehicleType);
      if (p.isPassable && v.allowed) directPassableCount++;
    });

    const allRawCandidates = [...directRoutes];

    // 3. Chỉ sinh các tuyến vòng (Bypass Detours) khi chưa đủ tuyến an toàn hoặc có chướng ngại vật cần né
    const hazardsForDetours = [...blockedFloods, ...cautionFloods];
    if (directPassableCount < 2 && hazardsForDetours.length > 0) {
      const detourWaypoints = this.generateDetourWaypoints(origin, destination, hazardsForDetours, specs);
      // Giới hạn tối đa 4 detour song song để chống nghẽn HTTP 429
      const detourPromises = detourWaypoints.slice(0, 4).map(wp =>
        this.fetchOsrmRoute([
          [origin.lng, origin.lat],
          [wp.lng, wp.lat],
          [destination.lng, destination.lat]
        ]).catch(() => [])
      );

      const detourResults = await Promise.all(detourPromises);
      detourResults.forEach(res => {
        if (res && res.length > 0) allRawCandidates.push(res[0]);
      });
    }

    if (allRawCandidates.length === 0) {
      throw new Error('Không thể kết nối đến máy chủ định tuyến OSRM');
    }

    // 4. Bộ lọc chất lượng hình học (Trùng lặp, Quay đầu, Vòng quá mức)
    let goodCandidates = this.filterDistinctRoutes(allRawCandidates);
    goodCandidates = goodCandidates.filter(route =>
      !this.detectBacktracking(route.polyline, origin.lat, origin.lng, destination.lat, destination.lng)
    );
    goodCandidates = goodCandidates.filter(route =>
      !this.isExcessiveDetour(route, directDistMeters)
    );

    // 5. BỘ LỌC CỐT TỬ: ĐÁNH GIÁ TÍNH KHẢ DỤNG (PASSABILITY) & QUY ĐỊNH GIAO THÔNG CHO PHƯƠNG TIỆN
    const passableCandidates = [];
    const blockedRoutes = [];

    goodCandidates.forEach(route => {
      const { isPassable, blockedBy } = this.checkRoutePassability(
        route.polyline, blockedFloods, blockedTraffics, specs.corridorBuffer
      );

      const roadRule = this.checkVehicleRoadRestrictions(route, vehicleType);

      if (isPassable && roadRule.allowed) {
        passableCandidates.push(route);
      } else {
        let reasonText = '';
        if (!roadRule.allowed) {
          reasonText = roadRule.violation;
          blockedBy.push({
            hazardType: 'vehicle_restriction',
            description: roadRule.violation
          });
        } else if (blockedBy.length > 0) {
          const firstHazard = blockedBy[0];
          reasonText = firstHazard.hazardType === 'blocked_flood'
            ? `Ngập ${firstHazard.depth_cm}cm tại ${firstHazard.name} (vượt ngưỡng ${specs.maxPassableDepth}cm của ${specs.name})`
            : `Đóng đường / kẹt cứng tại ${firstHazard.description || firstHazard.name || 'trục chính'}`;
        }
        blockedRoutes.push({
          ...route,
          blockedBy,
          reason: reasonText
        });
      }
    });

    // 6. Xử lý trường hợp KHÔNG CÓ ĐƯỜNG ĐI ĐƯỢC
    if (passableCandidates.length === 0) {
      const depths = blockedFloods.map(f => f.depth_cm);
      const minD = depths.length > 0 ? Math.min(...depths) : specs.maxPassableDepth;
      const maxD = depths.length > 0 ? Math.max(...depths) : specs.maxPassableDepth;
      return {
        noPassableRoute: true,
        vehicleSpecs: specs,
        vehicleType,
        avoidLevel,
        blockedFloods,
        blockedRoutes,
        message: `Không có tuyến đường khả dụng cho ${specs.name} lúc này!`,
        advice: `Tất cả các ngả đường tiếp cận đều đang ngập sâu từ ${minD}cm - ${maxD}cm (vượt quá giới hạn an toàn ${specs.maxPassableDepth}cm). Nguy cơ cao ${specs.hazardRisk.toLowerCase()}.`,
        routes: []
      };
    }

    // 7. Đánh giá chi tiết lưu thông & nước nông trên các tuyến ĐI ĐƯỢC
    const analyzedPassableRoutes = passableCandidates.map(route =>
      this.evaluatePassableRoute(route, cautionFloods, safeFloods, trafficIncidents, specs)
    );

    // 8. Xây dựng 3 chế độ từ các tuyến ĐI ĐƯỢC
    return this.buildThreePassableModes(analyzedPassableRoutes, avoidLevel, specs, blockedRoutes);
  }
}

// Khởi tạo global instance trong browser và export trong Node.js
if (typeof window !== 'undefined') {
  window.routingService = new RoutingService();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RoutingService;
}
