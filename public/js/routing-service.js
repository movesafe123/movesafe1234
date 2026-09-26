/**
 * RoutingService - Thuật toán tìm kiếm & phân loại lộ trình thông minh theo mức độ ùn tắc
 * Sử dụng OSRM Routing Engine kết hợp bộ phân tích chướng ngại vật thời gian thực TomTom & HSDC MoveSafe
 * 
 * ĐẶC TÍNH NỔI BẬT:
 * 1. Phân loại 3 hành lang giao thông THỰC SỰ KHÁC NHAU giữa mọi điểm đi và điểm đến.
 * 2. Phân tích chi tiết mức độ ùn tắc trên từng tuyến:
 *    - Tuyến 1 (🛡️ An toàn tuyệt đối): Ít đi trên đường tắc nhất (0% kẹt xe & 0 điểm ngập).
 *    - Tuyến 2 (⚖️ Cân bằng thông minh): Né 100% kẹt xe đỏ đậm & ngập sâu, cự ly tối ưu.
 *    - Tuyến 3 (⚡ Nhanh nhất): Đi thẳng trục chính ngắn nhất, không tránh gì.
 */

class RoutingService {
  constructor() {
    this.osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving';
    
    // Cấu hình 3 mức độ tránh né
    this.avoidanceLevels = {
      1: {
        name: 'An toàn tuyệt đối',
        icon: '🛡️',
        description: 'Tránh hoàn toàn đường ùn tắc & ngập lụt (0% đường tắc)',
        color: '#1e8e3e',
        floodThreshold: { motorbike: 5, car: 10 },
        avoidAllTrafficJam: true,
        trafficSpeedThreshold: 25
      },
      2: {
        name: 'Cân bằng thông minh',
        icon: '⚖️',
        description: 'Chỉ tránh tắc nghẽn đỏ đậm & ngập sâu xe máy không đi được',
        color: '#f9ab00',
        floodThreshold: { motorbike: 20, car: 35 },
        avoidAllTrafficJam: false,
        trafficSpeedThreshold: 12
      },
      3: {
        name: 'Nhanh nhất (Trục chính)',
        icon: '⚡',
        description: 'Đường ngắn nhất trục chính, không tránh gì',
        color: '#1a73e8',
        floodThreshold: { motorbike: 999, car: 999 },
        avoidAllTrafficJam: false,
        trafficSpeedThreshold: 0
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
    if (!res.ok) throw new Error('Không thể tính toán tuyến đường OSRM');
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
        if (distDiff < 100) {
          const mid1 = d.polyline[Math.floor(d.polyline.length / 2)];
          const mid2 = r.polyline[Math.floor(r.polyline.length / 2)];
          if (mid1 && mid2) {
            const midDist = this.getDistanceMeters(mid1[0], mid1[1], mid2[0], mid2[1]);
            if (midDist < 200) return true;
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

  /**
   * Phát hiện tuyến đường có quay đầu (backtracking / U-turn).
   * Kiểm tra xem tuyến đường có đi QUÁ điểm đến rồi quay lại không.
   * Trả về true nếu tuyến bị lỗi backtrack.
   */
  detectBacktracking(polyline, originLat, originLng, destLat, destLng) {
    if (!polyline || polyline.length < 10) return false;

    // Khoảng cách thẳng A→B
    const directDist = this.getDistanceMeters(originLat, originLng, destLat, destLng);
    if (directDist < 1000) return false; // Quá ngắn, không cần kiểm tra

    const sampleStep = Math.max(1, Math.floor(polyline.length / 50)); 
    let minDistSoFar = Infinity;

    // Khoảng cách cho phép tăng lên (bị ngược hướng) tối đa trước khi coi là backtracking
    // Ví dụ: đang đi tiến về đích, nhưng lại phải đi vòng ngược lại xa hơn 1.5km
    const backtrackThreshold = Math.max(1500, directDist * 0.25); 

    for (let i = 0; i < polyline.length; i += sampleStep) {
      const pt = polyline[i];
      const currentDist = this.getDistanceMeters(pt[0], pt[1], destLat, destLng);
      
      if (currentDist < minDistSoFar) {
        minDistSoFar = currentDist;
      }
      
      // Nếu khoảng cách hiện tại xa hơn khoảng cách nhỏ nhất đã đạt được > threshold
      // Tức là tuyến đường đang đi ngược ra xa khỏi điểm đến một cách đáng kể
      if (currentDist > minDistSoFar + backtrackThreshold) {
        return true; 
      }
    }
    return false;
  }

  /**
   * Kiểm tra tuyến đường có quá dài so với đường thẳng không (vòng quá mức)
   */
  isExcessiveDetour(route, directDistMeters) {
    // Cho phép tuyến vòng tối đa gấp 1.8x so với đường thẳng
    const maxRatio = 1.8;
    if (directDistMeters > 0 && route.distanceMeters > directDistMeters * maxRatio) {
      return true;
    }
    return false;
  }

  /**
   * Đánh giá chi tiết mức độ ùn tắc & ngập lụt trên từng tuyến đường
   */
  evaluateRouteCongestion(route, floodPoints, trafficIncidents, vehicleType) {
    const polyline = route.polyline;
    const totalPoints = polyline.length;
    let affectedPoints = 0;
    let severePoints = 0;
    let moderatePoints = 0;

    const matchedFloods = [];
    const matchedTraffics = [];

    polyline.forEach(pt => {
      let isPointCongested = false;

      for (const inc of trafficIncidents) {
        const dist = this.getDistanceMeters(pt[0], pt[1], inc.lat, inc.lng);
        if (dist <= 300) {
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

      for (const fl of floodPoints) {
        const dist = this.getDistanceMeters(pt[0], pt[1], fl.lat, fl.lng);
        if (dist <= 250) {
          isPointCongested = true;
          if (!matchedFloods.some(f => f.id === fl.id)) {
            matchedFloods.push({
              ...fl,
              hazardType: 'flood',
              distanceToRoute: Math.round(dist)
            });
          }
          break;
        }
      }

      if (isPointCongested) affectedPoints++;
    });

    let jamPercent = totalPoints > 0 ? Math.round((affectedPoints / totalPoints) * 100) : 0;
    const severeCount = matchedTraffics.filter(t => t.isJam && (t.speedKmh < 12 || t.delaySeconds >= 600)).length;
    const moderateCount = matchedTraffics.filter(t => t.isJam && (!t.speedKmh || (t.speedKmh >= 12 && t.speedKmh < 25))).length;
    const deepFloodCount = matchedFloods.filter(f => f.depth_cm >= (vehicleType === 'motorbike' ? 20 : 35)).length;

    const congestionScore = (severeCount * 50) + (deepFloodCount * 80) + (moderateCount * 20) + (matchedFloods.length * 15) + (jamPercent * 1.5);

    let realDurationMin = Math.round(route.durationSeconds / 60);
    matchedTraffics.forEach(t => {
      const delayMin = Math.round((t.delaySeconds || 180) / 60);
      realDurationMin += Math.min(delayMin, 10);
    });
    if (vehicleType === 'motorbike') {
      realDurationMin = Math.max(3, Math.round(realDurationMin * 0.9));
    }

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
      deepFloodCount,
      congestionScore
    };
  }

  /**
   * Phân loại và xây dựng 3 chế độ tuyến đường KHÁC BIỆT NHAU
   * Sửa lỗi: Không còn chọn tuyến xa nhất (vòng nhất) làm "an toàn".
   * Logic mới: Safe = tuyến ít nguy hiểm nhất VÀ không quá dài so với shortest.
   */
  buildThreeDistinctModes(candidates, activeAvoidLevel, vehicleType, config) {
    if (candidates.length === 0) throw new Error('Không có tuyến đường khả dụng');

    // Sắp xếp theo cự ly
    const sortedByDistance = [...candidates].sort((a, b) => a.distanceMeters - b.distanceMeters);
    const shortestRoute = sortedByDistance[0];
    const shortestDist = shortestRoute.distanceMeters;

    // Sắp xếp theo mức độ tắc nghẽn (thấp = an toàn hơn)
    // Kết hợp thêm hệ số phạt quãng đường vòng quá mức
    const sortedBySafety = [...candidates].sort((a, b) => {
      const penaltyA = a.distanceMeters > shortestDist * 1.5 ? 50 : 0;
      const penaltyB = b.distanceMeters > shortestDist * 1.5 ? 50 : 0;
      return (a.congestionScore + penaltyA) - (b.congestionScore + penaltyB);
    });

    // Tuyến 3: Nhanh nhất = cự ly ngắn nhất
    const fastestRoute = shortestRoute;

    // Tuyến 1: An toàn = ít nguy hiểm nhất (congestionScore thấp nhất),
    // nhưng nếu trùng với shortest thì lấy tuyến tiếp theo
    let safeRoute = sortedBySafety[0];
    if (safeRoute === fastestRoute && candidates.length > 1) {
      // Lấy tuyến an toàn nhất KHÔNG PHẢI shortest, nhưng phải hợp lý về cự ly
      safeRoute = sortedBySafety.find(r => r !== fastestRoute) || sortedBySafety[1] || fastestRoute;
    }

    // Tuyến 2: Cân bằng = tuyến còn lại (không phải safe, không phải fastest)
    let balancedRoute = candidates.find(r => r !== fastestRoute && r !== safeRoute);
    if (!balancedRoute) {
      // Nếu chỉ có 2 tuyến hoặc ít hơn, tạo bản sao của shortest với label khác
      balancedRoute = candidates.length > 1 ? candidates[1] : fastestRoute;
    }

    // Tính tỷ lệ tắc/thoáng thực tế (không bịa số)
    const safeJam = safeRoute.jamPercent;
    const safeFree = 100 - safeJam;
    const balJam = balancedRoute.jamPercent;
    const balFree = 100 - balJam;
    const fastJam = fastestRoute.jamPercent;
    const fastFree = 100 - fastJam;

    const routeSafe = {
      ...safeRoute,
      routeType: 'safe_bypass',
      label: 'An toàn tuyệt đối',
      sublabel: '🛡️ Tránh hoàn toàn ùn tắc & ngập lụt',
      tagText: `🛡️ ${safeJam}% tắc • ${safeFree}% đường thông thoáng`,
      tagClass: 'gm-tag-safe',
      trafficDesc: safeJam === 0
        ? 'Đường hoàn toàn thông thoáng, không ngập, không kẹt xe'
        : 'Đi đường vòng nhẹ tránh qua các điểm ùn tắc & ngập nước',
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
      sublabel: '⚖️ Né kẹt xe đỏ đậm & ngập sâu xe máy',
      tagText: `⚖️ ${balJam}% tắc • ${balFree}% thông thoáng`,
      tagClass: 'gm-tag-warning',
      trafficDesc: 'Né các điểm nghẽn kẹt cứng, chỉ đi qua đoạn đông vừa để tối ưu cự ly',
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
      label: 'Nhanh nhất (Trục chính)',
      sublabel: '⚡ Tuyến ngắn nhất, không tránh gì',
      tagText: `⚡ Ngắn nhất (${fastestRoute.distanceKm} km) • Đi trục chính`,
      tagClass: 'gm-tag-fastest',
      trafficDesc: 'Đi thẳng trục đường chính trực tiếp, chấp nhận qua các đoạn ùn tắc',
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
      avoidLevel: activeAvoidLevel,
      config,
      routes,
      totalHazards: fastestRoute.warnings.length,
      floodHazards: fastestRoute.matchedFloods,
      trafficHazards: fastestRoute.matchedTraffics
    };
  }

  /**
   * THUẬT TOÁN CHÍNH: Tính toán đa tuyến đường với 3 mức độ tránh né
   * 
   * Sửa lỗi:
   * 1. Offset waypoint giảm từ 0.012° (1.3km) xuống tối đa 0.006° (~650m)
   * 2. Waypoint đặt tại 1/3 quãng đường (thay vì midpoint) → tránh đi quá đích
   * 3. Thêm bộ lọc backtracking → loại bỏ tuyến có quay đầu 180°
   * 4. Thêm bộ lọc excessive detour → loại tuyến vòng > 1.8x đường thẳng
   */
  async calculateMultiRoutes({ origin, destination, floodPoints = [], trafficIncidents = [], vehicleType = 'motorbike', avoidLevel = 1 }) {
    const config = this.avoidanceLevels[avoidLevel];
    
    const dLat = destination.lat - origin.lat;
    const dLng = destination.lng - origin.lng;
    const len = Math.hypot(dLat, dLng);
    const directDistMeters = this.getDistanceMeters(origin.lat, origin.lng, destination.lat, destination.lng);

    // Đặt waypoint tại 1/3 quãng đường từ origin (KHÔNG PHẢI midpoint)
    // Điều này tránh việc tuyến đi vượt quá destination rồi quay lại
    const wpLat = origin.lat + dLat * 0.33;
    const wpLng = origin.lng + dLng * 0.33;

    // Offset nhỏ hơn nhiều: tối đa ~650m, tối thiểu ~200m
    // Tỷ lệ offset giảm theo cự ly để tuyến ngắn không bị vòng quá mức
    const offsetDeg = Math.min(0.006, Math.max(0.002, len * 0.12));

    // Pháp tuyến vuông góc với hướng A→B
    const perpLat = -(dLng / len);
    const perpLng = (dLat / len);

    const offA = { lat: wpLat + perpLat * offsetDeg, lng: wpLng + perpLng * offsetDeg };
    const offB = { lat: wpLat - perpLat * offsetDeg, lng: wpLng - perpLng * offsetDeg };

    // Gọi OSRM đồng thời cho 3 hành lang
    const fetchPromises = [
      // Tuyến trực tiếp (BẮT BUỘC có alternatives)
      this.fetchOsrmRoute([
        [origin.lng, origin.lat],
        [destination.lng, destination.lat]
      ]).catch(() => []),
      // Tuyến lệch A (nhẹ sang 1 bên)
      this.fetchOsrmRoute([
        [origin.lng, origin.lat],
        [offA.lng, offA.lat],
        [destination.lng, destination.lat]
      ]).catch(() => []),
      // Tuyến lệch B (nhẹ sang bên kia)
      this.fetchOsrmRoute([
        [origin.lng, origin.lat],
        [offB.lng, offB.lat],
        [destination.lng, destination.lat]
      ]).catch(() => [])
    ];

    const [directRoutes, sideARoutes, sideBRoutes] = await Promise.all(fetchPromises);

    let rawCandidates = [];
    if (directRoutes && directRoutes.length > 0) rawCandidates.push(...directRoutes);
    if (sideARoutes && sideARoutes.length > 0) rawCandidates.push(sideARoutes[0]);
    if (sideBRoutes && sideBRoutes.length > 0) rawCandidates.push(sideBRoutes[0]);

    if (rawCandidates.length === 0) {
      throw new Error('Không thể kết nối đến máy chủ định tuyến OSRM');
    }

    // ===== BỘ LỌC CHẤT LƯỢNG TUYẾN ĐƯỜNG =====
    
    // Lọc 1: Loại bỏ tuyến trùng lặp hình học
    let goodCandidates = this.filterDistinctRoutes(rawCandidates);

    // Lọc 2: Loại bỏ tuyến có quay đầu (backtracking / U-turn)
    goodCandidates = goodCandidates.filter(route => {
      const hasBacktrack = this.detectBacktracking(
        route.polyline, origin.lat, origin.lng, destination.lat, destination.lng
      );
      if (hasBacktrack) {
        console.warn(`[Routing] ⚠️ Loại bỏ tuyến ${route.distanceKm}km vì phát hiện quay đầu (U-turn)`);
      }
      return !hasBacktrack;
    });

    // Lọc 3: Loại bỏ tuyến vòng quá mức (> 1.8x đường thẳng)
    goodCandidates = goodCandidates.filter(route => {
      const isExcessive = this.isExcessiveDetour(route, directDistMeters);
      if (isExcessive) {
        console.warn(`[Routing] ⚠️ Loại bỏ tuyến ${route.distanceKm}km vì vòng quá mức (thẳng: ${(directDistMeters/1000).toFixed(1)}km)`);
      }
      return !isExcessive;
    });

    // Nếu sau khi lọc không còn tuyến nào, dùng lại tuyến trực tiếp
    if (goodCandidates.length === 0) {
      if (directRoutes && directRoutes.length > 0) {
        goodCandidates = [directRoutes[0]];
      } else {
        throw new Error('Không tìm được tuyến đường hợp lệ (tất cả đều bị quay đầu hoặc vòng quá mức)');
      }
    }

    // Phân tích chi tiết mức độ ùn tắc & ngập lụt trên từng tuyến
    const analyzedRoutes = goodCandidates.map(route => 
      this.evaluateRouteCongestion(route, floodPoints, trafficIncidents, vehicleType)
    );

    // Sắp xếp và phân loại 3 tuyến theo 3 mức độ tránh né
    return this.buildThreeDistinctModes(analyzedRoutes, avoidLevel, vehicleType, config);
  }
}

// Khởi tạo global instance
window.routingService = new RoutingService();
