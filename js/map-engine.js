/**
 * MapEngine - Trình điều khiển bản đồ giao diện chuẩn Google Maps
 * Nền bản đồ sáng, trực quan, dễ nhìn, hỗ trợ TomTom Traffic Flow, Cảnh báo ngập & Trạm thời tiết đa điểm
 */

class MapEngine {
  constructor() {
    this.map = null;
    this.tomtomKey = '';
    this.layers = {
      baseStandard: null,
      baseSatellite: null,
      tomtomTraffic: null,
      floodMarkers: null,
      trafficMarkers: null,
      weatherMarkers: null,
      routeSafeOutline: null,
      routeSafe: null,
      routeDanger: null
    };
    this.currentBase = 'standard';
    this.weatherVisible = true;
    this.trafficVisible = true;
    this.floodVisible = true;
  }

  init(containerId = 'map-container', initialCoords = [21.0285, 105.8542], zoom = 13) {
    if (this.map) return;

    this.map = L.map(containerId, {
      center: initialCoords,
      zoom: zoom,
      zoomControl: false, // Ẩn zoom mặc định của Leaflet để dùng cụm nút chuẩn Google Maps
      attributionControl: false // Tắt dòng chữ bản quyền Leaflet ở góc bản đồ
    });

    // Lớp bản đồ tiêu chuẩn: Google Maps chuẩn
    this.layers.baseStandard = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(this.map);

    // Lớp vệ tinh Google Maps Hybrid (Ảnh vệ tinh có tên đường)
    this.layers.baseSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    // Lớp TomTom Traffic Flow (Vệt giao thông thời gian thực xanh/vàng/đỏ)
    this.layers.tomtomTraffic = L.tileLayer(
      `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this.tomtomKey}`,
      { maxZoom: 19, opacity: 0.82 }
    ).addTo(this.map);

    // Nhóm layer rốn ngập, kẹt xe và trạm thời tiết các quận
    this.layers.floodMarkers = L.layerGroup().addTo(this.map);
    this.layers.trafficMarkers = L.layerGroup().addTo(this.map);
    this.layers.weatherMarkers = L.layerGroup().addTo(this.map);

    // Tự động kiểm soát hiển thị theo mức Zoom (LOD - Level of Detail)
    this.map.on('zoom zoomend', () => {
      this.handleZoomLevel();
    });
  }

  // Tự động ẩn/hiện icon theo mức zoom
  handleZoomLevel() {
    if (!this.map) return;
    const currentZoom = this.map.getZoom();

    // 1. Cập nhật các trạm thời tiết theo mức zoom
    if (this.weatherVisible && this.layers.weatherMarkers) {
      this.updateWeatherMarkersByZoom(currentZoom);
    } else if (this.layers.weatherMarkers && this.map.hasLayer(this.layers.weatherMarkers)) {
      this.map.removeLayer(this.layers.weatherMarkers);
    }

    // 2. Với traffic markers
    if (currentZoom < 12) {
      if (this.layers.trafficMarkers && this.map.hasLayer(this.layers.trafficMarkers)) {
        this.map.removeLayer(this.layers.trafficMarkers);
      }
    } else {
      if (this.trafficVisible !== false && this.layers.trafficMarkers && !this.map.hasLayer(this.layers.trafficMarkers)) {
        this.map.addLayer(this.layers.trafficMarkers);
      }
    }

    // 3. Với rốn ngập: nếu lùi ra quá xa (Zoom < 10) thì tạm ẩn để tránh chật bản đồ
    if (currentZoom < 10) {
      if (this.layers.floodMarkers && this.map.hasLayer(this.layers.floodMarkers)) {
        this.map.removeLayer(this.layers.floodMarkers);
      }
    } else {
      if (this.floodVisible !== false && this.layers.floodMarkers && !this.map.hasLayer(this.layers.floodMarkers)) {
        this.map.addLayer(this.layers.floodMarkers);
      }
    }
  }

  // Cập nhật marker theo mức zoom: Ẩn bớt để tránh chật bản đồ
  // - Nếu có tuyến đường: Chỉ hiện thời tiết ở các phường tuyến đường đi qua.
  // - Nếu không có tuyến đường: Zoom < 14 ẩn hết, Zoom 14 hiện trung tâm, Zoom >= 15 hiện tất cả.
  updateWeatherMarkersByZoom(currentZoom) {
    if (!this.layers.weatherMarkers || !this.allWeatherStations) return;

    let targetStations = [];
    let hasActiveRoute = false;
    let activePolyline = null;

    if (window.appState && window.appState.lastRouteResult && window.appState.lastRouteResult.routes) {
        const recommended = window.appState.lastRouteResult.routes.find(r => r.isRecommended) || window.appState.lastRouteResult.routes[0];
        if (recommended && recommended.polyline) {
            hasActiveRoute = true;
            activePolyline = recommended.polyline;
        }
    }

    if (hasActiveRoute && currentZoom < 14) {
        // Nếu đang vẽ tuyến đường và zoom out, CHỈ hiện thời tiết các phường mà tuyến đường đi qua (< 1km)
        targetStations = this.allWeatherStations.filter(station => {
            const sampleStep = Math.max(1, Math.floor(activePolyline.length / 20)); // Lấy ~20 điểm mẫu
            return activePolyline.some((pt, idx) => {
                if (idx % sampleStep !== 0) return false;
                const dLat = (station.lat - pt[0]) * 111000;
                const dLng = (station.lng - pt[1]) * 111000;
                return (dLat * dLat + dLng * dLng) < (1200 * 1200); // Bán kính ~1.2km
            });
        });
    } else if (currentZoom < 14) {
        // Zoom out và không có tuyến đường -> Ẩn toàn bộ
        if (this.map.hasLayer(this.layers.weatherMarkers)) {
            this.map.removeLayer(this.layers.weatherMarkers);
        }
        return;
    } else {
        // Zoom gần (>= 14): Hiện bình thường
        targetStations = (currentZoom === 14 && this.allWeatherStations.length > 25)
          ? this.allWeatherStations.filter(s => s.isHub !== false)
          : this.allWeatherStations;
    }

    if (targetStations.length > 0) {
        if (!this.map.hasLayer(this.layers.weatherMarkers)) {
            this.map.addLayer(this.layers.weatherMarkers);
        }
    } else {
        if (this.map.hasLayer(this.layers.weatherMarkers)) {
            this.map.removeLayer(this.layers.weatherMarkers);
        }
        return;
    }

    // Tránh render lại nếu số lượng không đổi
    if (this._lastRenderedStationCount === targetStations.length && this.layers.weatherMarkers.getLayers().length > 0) {
      return;
    }
    this._lastRenderedStationCount = targetStations.length;

    this.layers.weatherMarkers.clearLayers();
    this.createWeatherMarkers(targetStations);
  }

  setTomTomKey(key) {
    if (key && key.trim()) {
      this.tomtomKey = key.trim();
      if (this.layers.tomtomTraffic && this.map) {
        this.map.removeLayer(this.layers.tomtomTraffic);
        this.layers.tomtomTraffic = L.tileLayer(
          `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this.tomtomKey}`,
          { maxZoom: 19, opacity: 0.82 }
        ).addTo(this.map);
      }
    }
  }

  flyToCity(cityObj) {
    if (!this.map || !cityObj) return;
    this.map.flyTo([cityObj.lat, cityObj.lng], cityObj.zoom || 13, {
      animate: true,
      duration: 1.2
    });
  }

  // 1. Nhận danh sách các trạm thời tiết và phân bổ lên bản đồ
  renderWeatherStations(stations = []) {
    this.allWeatherStations = stations;
    this._lastRenderedStationCount = -1;
    if (!this.layers.weatherMarkers) return;
    const currentZoom = this.map ? this.map.getZoom() : 13;
    this.updateWeatherMarkersByZoom(currentZoom);
  }

  // Tạo các marker thời tiết có dữ liệu chi tiết về các đường lớn
  createWeatherMarkers(stations = []) {
    stations.forEach(st => {
      const risk = st.floodRisk || { level: 'safe', text: 'Khô ráo', color: '#1e8e3e' };
      const rainText = st.rain1h > 0 ? `${st.rain1h}mm` : 'Khô';
      const riskClass = risk.level === 'danger' ? 'weather-danger' : (risk.level === 'warning' ? 'weather-warning' : (risk.level === 'caution' ? 'weather-caution' : 'weather-safe'));
      const wardName = st.ward || st.name.split('(')[0].trim();

      const customIcon = L.divIcon({
        className: 'gm-weather-pin-container',
        html: `
          <div class="gm-weather-pin ${riskClass}" title="${st.name}: ${st.temp}°C, ${st.description}">
            <span class="gm-wp-name">${wardName}</span>
            <span class="gm-wp-icon">${st.icon || '☀️'}</span>
            <span class="gm-wp-temp">${st.temp}°</span>
            <span class="gm-wp-rain">${rainText}</span>
          </div>
        `,
        iconSize: [120, 28],
        iconAnchor: [60, 14]
      });

      const marker = L.marker([st.lat, st.lng], { icon: customIcon });

      // Tạo HTML danh sách các trục đường lớn
      let streetsHtml = '';
      if (st.mainStreets && st.mainStreets.length > 0) {
        streetsHtml = `
          <div style="background: #f1f8ff; border: 1px solid #c2e7ff; border-radius: 6px; padding: 7px 9px; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #005ac1; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between;">
              <span>🛣️ CÁC TRỤC ĐƯỜNG LỚN (${st.mainStreets.length} tuyến):</span>
              <span style="font-size: 10px; color: #5f6368; font-weight: 400;">Bấm vào để kiểm tra</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${st.mainStreets.map(street => `
                <span class="gm-street-badge" 
                      style="display: inline-block; background: #ffffff; border: 1px solid #c2e7ff; border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 500; color: #1a73e8; cursor: pointer; transition: all 0.15s ease;"
                      onmouseover="this.style.background='#1a73e8'; this.style.color='#fff';"
                      onmouseout="this.style.background='#fff'; this.style.color='#1a73e8';"
                      onclick="window.appState && window.appState.searchStreetFromWard('${street.replace(/'/g, "\\'")}', '${st.name.replace(/'/g, "\\'")}')"
                      title="Bấm để kiểm tra và phân tích lưu thông trên ${street}">
                  ${street}
                </span>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Điểm giao cắt / Rủi ro
      let extraInfoHtml = '';
      if (st.trafficHotspots && st.trafficHotspots.length > 0) {
        extraInfoHtml += `
          <div style="font-size: 11px; color: #5f6368; margin-bottom: 6px;">
            🚦 <strong>Giao cắt trọng điểm:</strong> ${st.trafficHotspots.join(' • ')}
          </div>
        `;
      }
      if (st.floodVulnerability) {
        extraInfoHtml += `
          <div style="font-size: 11px; color: #d93025; margin-bottom: 6px;">
            🌊 <strong>Lưu ý ngập úng:</strong> ${st.floodVulnerability}
          </div>
        `;
      }

      const popupHtml = `
        <div style="font-family: Roboto, sans-serif; min-width: 290px; max-width: 330px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${risk.color || '#1e8e3e'}; text-transform: uppercase;">
              ${st.icon} ${risk.text}
            </span>
            <span style="background: ${risk.color || '#1e8e3e'}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px;">
              ${st.temp}°C
            </span>
          </div>
          <h3 style="font-size: 15px; font-weight: 700; color: #202124; margin-bottom: 4px; line-height: 1.3;">
            🏛️ ${st.name}
          </h3>
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 8px;">
            Trạng thái: <strong>${st.description}</strong> (Cảm giác như: ${st.feelsLike}°C)
          </div>

          <!-- Danh sách các trục đường lớn thuộc phường -->
          ${streetsHtml}

          <!-- Các chỉ số khí tượng -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 6px; padding: 6px 8px; font-size: 11px; margin-bottom: 8px;">
            <div>🌧️ <strong>Lượng mưa 1h:</strong> ${st.rain1h} mm</div>
            <div>💧 <strong>Độ ẩm:</strong> ${st.humidity}%</div>
            <div>💨 <strong>Tốc độ gió:</strong> ${st.windSpeed} km/h</div>
            <div>⚡ <strong>Cập nhật:</strong> 24/7 Live Radar</div>
          </div>

          ${extraInfoHtml}

          <div style="font-size: 12px; color: ${risk.color || '#1e8e3e'}; font-weight: 500; margin-bottom: 8px;">
            💡 Đánh giá: ${st.rain1h >= 20 ? 'Nguy cơ ngập dồn các tuyến đường trũng xung quanh.' : (st.rain1h > 0 ? 'Mặt đường ướt trơn trượt, giảm tốc độ.' : 'Thời tiết thuận lợi cho việc lưu thông trên các trục đường.')}
          </div>

          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button 
              style="flex: 1; background: #1a73e8; color: #fff; border: none; border-radius: 4px; padding: 6px 8px; font-size: 11px; font-weight: 600; cursor: pointer;"
              onclick="window.aiChat.open(); window.aiChat.sendMessage('Tình hình thời tiết và các tuyến đường lớn tại ${st.name} thế nào?')">
              🤖 Hỏi AI Về Phường & Đường
            </button>
            <button 
              style="background: #e8f0fe; color: #1a73e8; border: 1px solid #c2e7ff; border-radius: 4px; padding: 6px 8px; font-size: 11px; font-weight: 600; cursor: pointer;"
              onclick="window.appState && window.appState.routeToLocation(${st.lat}, ${st.lng}, '${st.name.replace(/'/g, "\\'")}')">
              🔀 Đến Đây
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.layers.weatherMarkers.addLayer(marker);
    });
  }

  // Mở popup thông tin trạm/phường theo tọa độ
  openWardPopup(lat, lng) {
    if (!this.layers.weatherMarkers) return;
    this.layers.weatherMarkers.eachLayer(layer => {
      if (layer && typeof layer.getLatLng === 'function') {
        const pos = layer.getLatLng();
        if (Math.abs(pos.lat - lat) < 0.003 && Math.abs(pos.lng - lng) < 0.003) {
          layer.openPopup();
        }
      }
    });
  }

  // 2. Vẽ các ghim ngập nước chuẩn phong cách Google Maps Pin
  renderFloodPoints(floodPoints) {
    if (!this.layers.floodMarkers) return;
    this.layers.floodMarkers.clearLayers();

    // Chỉ hiển thị các điểm ngập đang hoạt động thực tế (depth > 0 và chưa rút)
    const activePoints = floodPoints.filter(point => point.depth_cm > 0 && point.danger_level !== 'safe');

    // Nếu thời tiết tạnh ráo / nước đã rút hết: Giữ bản đồ sạch sẽ, khô ráo, không cắm ghim rác
    if (activePoints.length === 0) {
      return;
    }

    activePoints.forEach(point => {
      // Đang có ngập thực tế (depth > 0)
      const isCritical = point.danger_level === 'critical';
      const depthText = point.depth_cm ? `${point.depth_cm}cm` : 'Ngập';
      const badgeClass = isCritical ? '' : 'badge-medium';
      const pointClass = isCritical ? '' : 'point-medium';
      const color = isCritical ? '#d93025' : '#f9ab00';

      const customIcon = L.divIcon({
        className: 'gm-flood-pin-container',
        html: `
          <div class="gm-flood-pin">
            <div class="gm-flood-badge ${badgeClass}">
              <span>🌊</span> ${depthText}
            </div>
            <div class="gm-pin-point ${pointClass}"></div>
          </div>
        `,
        iconSize: [60, 32],
        iconAnchor: [30, 32]
      });

      const marker = L.marker([point.lat, point.lng], { icon: customIcon });

      const circle = L.circle([point.lat, point.lng], {
        radius: isCritical ? 240 : 150,
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.12
      });

      const popupHtml = `
        <div style="font-family: Roboto, sans-serif; min-width: 250px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${color}; text-transform: uppercase;">
              ${isCritical ? '🔴 Rốn ngập sâu nguy hiểm' : '🟡 Điểm ngập cục bộ'}
            </span>
            <span style="background: ${color}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 99px;">
              ${depthText}
            </span>
          </div>
          <h3 style="font-size: 14px; font-weight: 700; color: #202124; margin-bottom: 6px; line-height: 1.3;">
            ${point.name}
          </h3>
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 8px;">
            Nguồn trạm đo: <strong>${point.source}</strong>
          </div>
          <div style="background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 6px; padding: 8px; font-size: 12px; margin-bottom: 8px;">
            <div>🛵 <strong>Xe máy:</strong> ${point.passable_motorbike ? '✅ Có thể qua' : '❌ Nguy cơ chết máy bugi'}</div>
            <div>🚗 <strong>Ô tô:</strong> ${point.passable_car ? '✅ Xe gầm cao đi được' : '❌ Nguy cơ thủy kích'}</div>
          </div>
          <div style="font-size: 12px; color: #c5221f; font-weight: 500; margin-bottom: 6px;">
            💡 ${point.advice || 'Khuyến nghị vòng tránh qua tuyến khác.'}
          </div>
          <div style="font-size: 11px; color: #70757a;">
            Trạm bơm: ${point.pump_status || 'Đang vận hành'}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.layers.floodMarkers.addLayer(marker);
      this.layers.floodMarkers.addLayer(circle);
    });

    this.handleZoomLevel();
  }

  // 3. Vẽ các ghim sự cố giao thông TomTom / VOV theo đúng phân loại
  renderTrafficIncidents(incidents) {
    if (!this.layers.trafficMarkers) return;
    this.layers.trafficMarkers.clearLayers();

    incidents.forEach(inc => {
      const isRoadwork = inc.type === 'roadwork';
      const isClosure = inc.type === 'road_closure';
      const isAccident = inc.type === 'accident';
      const isRealJam = inc.isJam === true;

      // Icon và màu sắc chuẩn theo bản chất sự cố
      let pinIcon = '🚗';
      let pinBg = '#f29900';
      let headerText = '⚠️ Cảnh báo đường bộ';
      let headerColor = '#b06000';

      if (isRoadwork) {
        pinIcon = '🚧';
        pinBg = '#e37400';
        headerText = '🚧 Công trường thi công bảo trì';
        headerColor = '#b06000';
      } else if (isClosure) {
        pinIcon = '⛔';
        pinBg = '#d93025';
        headerText = '⛔ Đoạn đường tạm cấm / Rào chắn';
        headerColor = '#d93025';
      } else if (isAccident) {
        pinIcon = '⚠️';
        pinBg = '#ea4335';
        headerText = '⚠️ Sự cố va chạm phương tiện';
        headerColor = '#ea4335';
      } else if (isRealJam) {
        pinIcon = '🚗';
        pinBg = '#d93025';
        headerText = '🔴 Ùn tắc phương tiện cao điểm';
        headerColor = '#d93025';
      } else {
        pinIcon = '🚗';
        pinBg = '#1e8e3e';
        headerText = '🟢 Lưu thông bình thường';
        headerColor = '#1e8e3e';
      }

      const customIcon = L.divIcon({
        className: 'gm-traffic-pin-container',
        html: `<div class="gm-traffic-pin" style="background: ${pinBg}; display: flex; align-items: center; justify-content: center; font-size: 14px;">${pinIcon}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });

      const speedText = isClosure
        ? 'Tạm cấm lưu thông một chiều phục vụ thi công'
        : (isRealJam ? `Vận tốc ùn ứ: ~${inc.speedKmh || 8} km/h` : `Vận tốc lưu thông: ~${inc.speedKmh || 40} km/h`);

      const popupHtml = `
        <div style="font-family: Roboto, sans-serif; min-width: 240px;">
          <div style="font-size: 11px; font-weight: 700; color: ${headerColor}; text-transform: uppercase; margin-bottom: 4px;">
            ${headerText}
          </div>
          <h4 style="font-size: 13px; font-weight: 700; color: #202124; margin-bottom: 6px; line-height: 1.3;">
            ${inc.description || inc.categoryName || 'Sự cố trên tuyến đường'}
          </h4>
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">
            ${speedText} ${inc.delaySeconds > 0 ? `• Độ trễ: <strong>+${Math.round(inc.delaySeconds / 60)} phút</strong>` : ''}
          </div>
          <div style="font-size: 11px; color: #70757a; border-top: 1px solid #eee; padding-top: 4px; margin-top: 6px;">
            🛰️ Vệ tinh TomTom Traffic v5 thời gian thực
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.layers.trafficMarkers.addLayer(marker);
    });

    this.handleZoomLevel();
  }

  // 4. Vẽ tuyến đường chuẩn phong cách Google Maps
  displayRoute({ recommendedRoute, dangerRoute, hasHazard }) {
    if (this.layers.routeSafeOutline) this.map.removeLayer(this.layers.routeSafeOutline);
    if (this.layers.routeSafe) this.map.removeLayer(this.layers.routeSafe);
    if (this.layers.routeDanger) this.map.removeLayer(this.layers.routeDanger);

    // Tuyến cũ nguy hiểm (nét đứt đỏ)
    if (hasHazard && dangerRoute) {
      this.layers.routeDanger = L.polyline(dangerRoute.polyline, {
        color: '#d93025',
        weight: 6,
        opacity: 0.75,
        dashArray: '8, 8'
      }).addTo(this.map);
    }

    // Tuyến né ngập an toàn (viền trắng + ruột xanh lá đậm)
    if (recommendedRoute) {
      this.layers.routeSafeOutline = L.polyline(recommendedRoute.polyline, {
        color: '#ffffff',
        weight: 10,
        opacity: 0.95
      }).addTo(this.map);

      this.layers.routeSafe = L.polyline(recommendedRoute.polyline, {
        color: '#1e8e3e',
        weight: 6,
        opacity: 1
      }).addTo(this.map);

      this.map.fitBounds(this.layers.routeSafe.getBounds(), { padding: [60, 60] });
    }
  }

  // Bật / tắt các lớp
  toggleTraffic(show) {
    if (!this.map) return;
    if (show) this.layers.tomtomTraffic.addTo(this.map);
    else this.map.removeLayer(this.layers.tomtomTraffic);
  }

  toggleFloods(show) {
    if (!this.map) return;
    this.floodVisible = show;
    this.handleZoomLevel();
  }

  toggleIncidents(show) {
    if (!this.map) return;
    this.trafficVisible = show;
    this.handleZoomLevel();
  }

  toggleWeather(show) {
    if (!this.map) return;
    this.weatherVisible = show;
    this.handleZoomLevel();
  }

  switchBaseMap(type) {
    if (!this.map) return;
    if (type === 'satellite') {
      this.map.removeLayer(this.layers.baseStandard);
      this.layers.baseSatellite.addTo(this.map);
      this.currentBase = 'satellite';
    } else {
      this.map.removeLayer(this.layers.baseSatellite);
      this.layers.baseStandard.addTo(this.map);
      this.currentBase = 'standard';
    }
  }

  zoomIn() { if (this.map) this.map.zoomIn(); }
  zoomOut() { if (this.map) this.map.zoomOut(); }
}

window.mapEngine = new MapEngine();
