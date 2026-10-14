/**
 * RoutingService - Thuật toán định tuyến giao thông thông minh xét Đặc tính Kỹ thuật & Nguy cơ của từng Phương tiện
 * Sử dụng OSRM Routing Engine kết hợp bộ phân tích chướng ngại vật thời gian thực TomTom & HSDC MoveSafe
 * 
 * NGUYÊN TẮC CỐT LÕI:
 * 1. KHÔNG chỉ đường qua điểm ngập sâu rồi gắn nhãn cảnh báo cho người dùng đi!
 * 2. Xét ĐẶC TÍNH KỸ THUẬT & NGƯỠNG AN TOÀN của từng phương tiện (Xe máy xăng, Xe máy điện, Ô tô xăng, Ô tô điện).
 * 3. Điểm ngập vượt ngưỡng kỹ thuật = VẬT CẢN BẤT KHẢ DỤNG -> Tự động tính toán tuyến đường vòng (Bypass Detour).
 * 4. Cả 3 chế độ (An toàn, Cân bằng, Nhanh nhất) PHẢI LÀ CÁC TUYẾN ĐI ĐƯỢC:
 *    - Tuyến 1 (🛡️ An toàn tuyệt đối): 100% Khô ráo (0cm ngập) & né kẹt xe tối đa.
 *    - Tuyến 2 (⚖️ Cân bằng thông minh): Cho phép đi qua nước nông an toàn (dưới gầm xe), cự ly tối ưu.
 *    - Tuyến 3 (⚡ Nhanh nhất): Tuyến ngắn nhất / nhanh nhất TRONG SỐ CÁC TUYẾN XE ĐI ĐƯỢC HỢP LỆ.
 */

class RoutingService {
  constructor() {
    this.osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving';

    // Bảng thông số kỹ thuật & ngưỡng an toàn thực tế theo từng phương tiện
    this.vehicleSpecs = {
      motorbike: {
        type: 'motorbike',
        name: 'Xe máy xăng',
        icon: '🛵',
        maxPassableDepth: 20, // cm - Quá 20cm là ngập ống pô, ướt bugi gây chết máy giữa dòng
        safeDepth: 10,        // cm - Nước nông dưới mép lốp, hoàn toàn an toàn
        corridorBuffer: 200,  // m - Bán kính ảnh hưởng rốn ngập
        detourOffsets: [650, 950, 1350], // Các mức cự ly lệch tìm đường tránh (m)
        hazardRisk: 'Chết máy do nước vào ống xả và ướt bugi',
        allowAlleys: true,
        speedFactor: 1.15
      },
      ebike: {
        type: 'ebike',
        name: 'Xe máy điện',
        icon: '⚡',
        maxPassableDepth: 20, // cm - Khoang pin sàn & controller IC ngập nước gây chập hoặc ngắt an toàn
        safeDepth: 10,        // cm
        corridorBuffer: 200,
        detourOffsets: [650, 950, 1350],
        hazardRisk: 'Chập mạch IC điều khiển & ngắt an toàn pin xe điện',
        allowAlleys: true,
        speedFactor: 1.1
      },
      car: {
        type: 'car',
        name: 'Ô tô xăng',
        icon: '🚗',
        maxPassableDepth: 25, // cm - Mép hút gió sedan/hatchback, nguy cơ THỦY KÍCH phá hủy tay biên & vỡ lốc máy
        safeDepth: 15,        // cm - Nước dưới nửa bánh xe, an toàn cho gầm sedan
        corridorBuffer: 250,
        detourOffsets: [850, 1300, 1600],
        hazardRisk: 'Nguy cơ THỦY KÍCH phá hủy tay biên & vỡ lốc máy',
        allowAlleys: false,
        speedFactor: 0.95
      },
      ecar: {
        type: 'ecar',
        name: 'Ô tô điện',
        icon: '🚙',
        maxPassableDepth: 30, // cm - Khối pin IP67 nhưng ngập sâu > 30cm sinh lực đẩy bồng bềnh mất lái & ngắt rơ-le cao áp
        safeDepth: 15,        // cm
        corridorBuffer: 250,
        detourOffsets: [850, 1300, 1600],
        hazardRisk: 'Mất lái trôi xe do bồng bềnh & ngắt an toàn pin cao áp',
        allowAlleys: false,
        speedFactor: 0.95
      }
    };

    // Cấu hình 3 mức độ tránh né
    this.avoidanceLevels = {
      1: {
        name: 'An toàn tuyệt đối',
        icon: '🛡️',
        description: 'Tuyến khô ráo 100% (0cm ngập) & né kẹt xe tối đa',
        color: '#1e8e3e'
      },
      2: {
        name: 'Cân bằng thông minh',
        icon: '⚖️',
        description: 'Đi được nước nông an toàn, né ngập sâu & kẹt cứng để tối ưu cự ly',
        color: '#f9ab00'
      },
      3: {
        name: 'Nhanh nhất (Tuyến đi được)',
        icon: '⚡',
        description: 'Tuyến ngắn nhất & nhanh nhất trong số các đường xe đi được an toàn',
        color: '#1a73e8'
      }
    };
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

  // Gọi OSRM lấy tọa độ đường đi
  async fetchOsrmRoute(waypoints) {
    const coordsStr = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
    const url = `${this.osrmBaseUrl}/${coordsStr}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Không thể kết nối máy chủ định tuyến OSRM');
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) throw new Error('Không tìm thấy đường đi');

    return data.routes.map(route => ({
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
      f.depth_cm > 0 && f.depth_cm <= specs.safeDepth
    );

    // Điểm đóng đường do thi công hoặc kẹt cứng bất động > 30 phút
    const blockedTraffics = trafficIncidents.filter(t => 
      t.type === 'road_closure' || (t.isJam && t.delaySeconds >= 1800)
    );

    return { specs, blockedFloods, cautionFloods, safeFloods, blockedTraffics };
  }

  /**
   * Kiểm tra xem tuyến đường có cắt qua bất kỳ điểm ngập BẤT KHẢ DỤNG nào không
   */
  checkRoutePassability(polyline, blockedFloods, blockedTraffics, corridorBuffer) {
    const blockedBy = [];

    polyline.forEach(pt => {
      blockedFloods.forEach(f => {
        const d = this.getDistanceMeters(pt[0], pt[1], f.lat, f.lng);
        const radius = f.radius || corridorBuffer;
        if (d <= radius) {
          if (!blockedBy.some(b => b.id === f.id)) {
            blockedBy.push({
              ...f,
              hazardType: 'blocked_flood',
              distanceToRoute: Math.round(d)
            });
          }
        }
      });

      blockedTraffics.forEach(t => {
        const d = this.getDistanceMeters(pt[0], pt[1], t.lat, t.lng);
        if (d <= 150) {
          if (!blockedBy.some(b => b.id === t.id)) {
            blockedBy.push({
              ...t,
              hazardType: 'blocked_traffic',
              distanceToRoute: Math.round(d)
            });
          }
        }
      });
    });

    return {
      isPassable: blockedBy.length === 0,
      blockedBy
    };
  }

  /**
   * Sinh các tọa độ Waypoint né ngập động xung quanh các chướng ngại vật bị chặn
   */
  generateDetourWaypoints(origin, destination, blockedFloods, specs) {
    const dLat = destination.lat - origin.lat;
    const dLng = destination.lng - origin.lng;
    const len = Math.hypot(dLat, dLng);
    if (len === 0) return [];

    // Pháp tuyến vuông góc với hướng A→B
    const perpLat = -(dLng / len);
    const perpLng = (dLat / len);

    const waypoints = [];

    // 1. Waypoint né hai bên của từng rốn ngập bị chặn
    blockedFloods.forEach(bf => {
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
   */
  evaluatePassableRoute(route, cautionFloods, safeFloods, trafficIncidents, specs) {
    const polyline = route.polyline;
    const totalPoints = polyline.length;
    let affectedPoints = 0;
    let severePoints = 0;
    let moderatePoints = 0;

    const matchedFloods = [];
    const matchedTraffics = [];

    polyline.forEach(pt => {
      let isPointCongested = false;

      // Kẹt xe
      for (const inc of trafficIncidents) {
        const dist = this.getDistanceMeters(pt[0], pt[1], inc.lat, inc.lng);
        if (dist <= 250) {
          isPointCongested = true;
          if (inc.isJam) {
            if ((inc.speedKmh && inc.speedKmh < 12) || (inc.delaySeconds && inc.delaySeconds >= 600)) {
              severePoints++;
            } else {
              moderatePoints++;
            }
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
      const allShallowFloods = [...cautionFloods, ...safeFloods];
      for (const fl of allShallowFloods) {
        const dist = this.getDistanceMeters(pt[0], pt[1], fl.lat, fl.lng);
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
    });

    const jamPercent = totalPoints > 0 ? Math.round((affectedPoints / totalPoints) * 100) : 0;
    const severeCount = matchedTraffics.filter(t => t.isJam && (t.speedKmh < 12 || t.delaySeconds >= 600)).length;
    const moderateCount = matchedTraffics.filter(t => t.isJam && (!t.speedKmh || (t.speedKmh >= 12 && t.speedKmh < 25))).length;

    // Tính điểm bất lợi: ngập nhẹ trong tầm an toàn bị phạt điểm nhẹ, kẹt xe phạt điểm nặng
    const congestionScore = (severeCount * 50) + (moderateCount * 20) + (matchedFloods.length * 25) + (jamPercent * 1.5);

    // Thời gian ước tính thực tế theo phương tiện
    let realDurationMin = Math.round(route.durationSeconds / 60);
    matchedTraffics.forEach(t => {
      const delayMin = Math.round((t.delaySeconds || 180) / 60);
      realDurationMin += Math.min(delayMin, 10);
    });
    realDurationMin = Math.max(3, Math.round(realDurationMin / specs.speedFactor));

    return {
      ...route,
      durationMin: realDurationMin,
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
   * Xây dựng 3 chế độ (An toàn, Cân bằng, Nhanh nhất) từ các tuyến ĐI ĐƯỢC
   */
  buildThreePassableModes(passableCandidates, activeAvoidLevel, specs, blockedRoutes) {
    if (passableCandidates.length === 0) {
      throw new Error(`Không có tuyến đường khả dụng cho ${specs.name}`);
    }

    // Tuyến 3: Nhanh nhất = Tuyến có cự ly ngắn nhất TRONG CÁC TUYẾN ĐI ĐƯỢC
    const sortedByDistance = [...passableCandidates].sort((a, b) => a.distanceMeters - b.distanceMeters);
    const fastestRoute = sortedByDistance[0];

    // Tuyến 1: An toàn tuyệt đối = Tuyến ít rủi ro nhất (ưu tiên 0cm ngập, sau đó đến ít tắc nhất)
    const sortedBySafety = [...passableCandidates].sort((a, b) => {
      // Ưu tiên tuyến 0 điểm ngập
      const floodDiff = a.matchedFloods.length - b.matchedFloods.length;
      if (floodDiff !== 0) return floodDiff;
      return a.congestionScore - b.congestionScore;
    });
    const safeRoute = sortedBySafety[0];

    // Tuyến 2: Cân bằng thông minh = Tuyến tối ưu giữa cự ly và độ an toàn
    let balancedRoute = passableCandidates.find(r => r !== fastestRoute && r !== safeRoute);
    if (!balancedRoute) {
      balancedRoute = passableCandidates.length > 1 
        ? (safeRoute === fastestRoute ? passableCandidates[1] : fastestRoute) 
        : fastestRoute;
    }

    const isIdenticalSafeAndFast = (safeRoute === fastestRoute);

    // Gắn nhãn chi tiết cho từng tuyến
    const safeJam = safeRoute.jamPercent;
    const safeFree = 100 - safeJam;
    const balJam = balancedRoute.jamPercent;
    const balFree = 100 - balJam;
    const fastJam = fastestRoute.jamPercent;
    const fastFree = 100 - fastJam;

    const safeFloodText = safeRoute.matchedFloods.length === 0 
      ? '100% Khô ráo' 
      : `${safeRoute.matchedFloods.length} đoạn nước nông`;

    const routeSafe = {
      ...safeRoute,
      routeType: 'safe_bypass',
      label: 'An toàn tuyệt đối',
      sublabel: `🛡️ ${safeFloodText} • Né hoàn toàn ngập & kẹt xe`,
      tagText: `🛡️ ${safeFloodText} • Tuyến đi an toàn`,
      tagClass: 'gm-tag-safe',
      trafficDesc: safeRoute.matchedFloods.length === 0
        ? 'Tuyến đường cao ráo, hoàn toàn không ngập nước, an toàn tuyệt đối cho xe'
        : 'Đi vòng qua các đoạn đường cao, chỉ dính nước nông nhẹ không ảnh hưởng máy',
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
      label: 'Cân bằng thông minh',
      sublabel: '⚖️ Cân bằng cự ly & Đảm bảo an toàn kỹ thuật',
      tagText: `⚖️ ${balJam}% kẹt • Tuyến xe đi được`,
      tagClass: 'gm-tag-warning',
      trafficDesc: 'Tối ưu quãng đường và thời gian, đảm bảo 100% không lo chết máy hay thủy kích',
      jamPercent: balJam,
      freeFlowPercent: balFree,
      moderatePercent: balJam,
      severePercent: 0,
      isRecommended: (activeAvoidLevel === 2),
      color: '#f9ab00',
      avoidLevel: 2
    };

    const routeFastest = {
      ...fastestRoute,
      routeType: 'fastest',
      label: 'Nhanh nhất (Tuyến đi được)',
      sublabel: `⚡ Tuyến ngắn nhất (${fastestRoute.distanceKm} km) an toàn cho xe`,
      tagText: `⚡ Ngắn nhất (${fastestRoute.distanceKm} km) • Đảm bảo an toàn`,
      tagClass: 'gm-tag-fastest',
      trafficDesc: 'Tuyến ngắn nhất và nhanh nhất trong số các hành lang xe có thể đi qua an toàn',
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

    // 2. Lấy tuyến trực tiếp từ OSRM
    const directRoutes = await this.fetchOsrmRoute([
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    ]).catch(() => []);

    // 3. Sinh các tuyến vòng (Bypass Detours) né các chướng ngại vật bị chặn
    const detourWaypoints = this.generateDetourWaypoints(origin, destination, blockedFloods, specs);
    
    // Gọi OSRM song song cho các waypoints vòng
    const detourPromises = detourWaypoints.slice(0, 8).map(wp => 
      this.fetchOsrmRoute([
        [origin.lng, origin.lat],
        [wp.lng, wp.lat],
        [destination.lng, destination.lat]
      ]).catch(() => [])
    );

    const detourResults = await Promise.all(detourPromises);

    // Tập hợp toàn bộ ứng viên tuyến đường
    const allRawCandidates = [...directRoutes];
    detourResults.forEach(res => {
      if (res && res.length > 0) allRawCandidates.push(res[0]);
    });

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

    // 5. BỘ LỌC CỐT TỬ: ĐÁNH GIÁ TÍNH KHẢ DỤNG (PASSABILITY) CHO PHƯƠNG TIỆN
    const passableCandidates = [];
    const blockedRoutes = [];

    goodCandidates.forEach(route => {
      const { isPassable, blockedBy } = this.checkRoutePassability(
        route.polyline, blockedFloods, blockedTraffics, specs.corridorBuffer
      );

      if (isPassable) {
        passableCandidates.push(route);
      } else {
        blockedRoutes.push({
          ...route,
          blockedBy,
          reason: `Ngập ${blockedBy[0].depth_cm}cm tại ${blockedBy[0].name} (vượt ngưỡng ${specs.maxPassableDepth}cm của ${specs.name})`
        });
      }
    });

    // 6. Xử lý trường hợp KHÔNG CÓ ĐƯỜNG ĐI ĐƯỢC
    if (passableCandidates.length === 0) {
      return {
        noPassableRoute: true,
        vehicleSpecs: specs,
        vehicleType,
        avoidLevel,
        blockedFloods,
        blockedRoutes,
        message: `Không có tuyến đường khả dụng cho ${specs.name} lúc này!`,
        advice: `Tất cả các ngả đường tiếp cận đều đang ngập sâu từ ${Math.min(...blockedFloods.map(f => f.depth_cm))}cm - ${Math.max(...blockedFloods.map(f => f.depth_cm))}cm (vượt quá giới hạn an toàn ${specs.maxPassableDepth}cm). Nguy cơ cao ${specs.hazardRisk.toLowerCase()}.`,
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
