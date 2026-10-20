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
      routeDanger: null,
      evLayer: null
    };
    this.currentBase = 'standard';
    this.weatherVisible = true;
    this.trafficVisible = true;
    this.floodVisible = true;
    this._loadedEvCity = null;
  }

  init(containerId = 'map-container', initialCoords = [21.0285, 105.8542], zoom = 13) {
    if (this.map) return;

    this.map = L.map(containerId, {
      center: initialCoords,
      zoom: zoom,
      zoomControl: false, // Ẩn zoom mặc định của Leaflet để dùng cụm nút chuẩn Google Maps
      attributionControl: false // Tắt dòng chữ bản quyền Leaflet ở góc bản đồ
    });

    // Lớp bản đồ tiêu chuẩn: Google Maps chuẩn (Tối ưu buffer & không tải tile ngắt quãng khi zoom)
    this.layers.baseStandard = L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 6,
      crossOrigin: true
    }).addTo(this.map);

    // Lớp vệ tinh Google Maps Hybrid (Chuyển sang lyrs=y pre-rendered + keepBuffer để tải nhanh gấp đôi)
    this.layers.baseSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 6,
      crossOrigin: true
    });

    // Lớp TomTom Traffic Flow (Vệt giao thông thời gian thực xanh/vàng/đỏ)
    this.layers.tomtomTraffic = L.tileLayer(
      `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this.tomtomKey}`,
      {
        maxZoom: 19,
        opacity: 0.82,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 4,
        crossOrigin: true
      }
    ).addTo(this.map);

    // Nhóm layer rốn ngập, kẹt xe và trạm thời tiết các quận
    this.layers.floodMarkers = L.layerGroup().addTo(this.map);
    this.layers.trafficMarkers = L.layerGroup().addTo(this.map);
    this.layers.weatherMarkers = L.layerGroup().addTo(this.map);
    this.layers.evLayer = L.layerGroup(); // Không addTo(this.map) ngay từ đầu

    // Tự động kiểm soát hiển thị theo mức Zoom (Chỉ chạy khi kết thúc zoom để giữ 60fps mượt mà)
    this.map.on('zoomend', () => {
      this.handleZoomLevel();
    });

    // Kích hoạt nạp trước bộ đệm ảnh vệ tinh trong thời gian rảnh rỗi (Pre-warm)
    this.prewarmSatellite();
  }

  // Tự động ẩn/hiện icon theo mức zoom
  handleZoomLevel() {
    if (!this.map) return;
    const currentZoom = Math.round(this.map.getZoom());
    if (this._lastProcessedZoom === currentZoom) return;
    this._lastProcessedZoom = currentZoom;

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
      targetStations = this.allWeatherStations.filter(station => {
        const sampleStep = Math.max(1, Math.floor(activePolyline.length / 20));
        return activePolyline.some((pt, idx) => {
          if (idx % sampleStep !== 0) return false;
          const dLat = (station.lat - pt[0]) * 111000;
          const dLng = (station.lng - pt[1]) * 111000;
          return (dLat * dLat + dLng * dLng) < (1200 * 1200);
        });
      });
    } else if (currentZoom < 14) {
      if (this.map.hasLayer(this.layers.weatherMarkers)) {
        this.map.removeLayer(this.layers.weatherMarkers);
      }
      return;
    } else {
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
        const wasOnMap = this.map.hasLayer(this.layers.tomtomTraffic);
        this.map.removeLayer(this.layers.tomtomTraffic);
        this.layers.tomtomTraffic = L.tileLayer(
          `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this.tomtomKey}`,
          {
            maxZoom: 19,
            opacity: 0.82,
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 4,
            crossOrigin: true
          }
        );
        if (wasOnMap) {
          this.layers.tomtomTraffic.addTo(this.map);
        }
      }
    }
  }

  flyToCity(cityObj) {
    if (!this.map || !cityObj) return;
    this.map.flyTo([cityObj.lat, cityObj.lng], cityObj.zoom || 13, {
      animate: true,
      duration: 1.2
    });
    this._satellitePrewarmed = false;
    setTimeout(() => this.prewarmSatellite(), 1500);
  }

  // Nạp trước bộ nhớ đệm (Pre-warm) ảnh vệ tinh cho khu vực đang xem để mở tức thì
  prewarmSatellite() {
    if (!this.map || this._satellitePrewarmed) return;
    this._satellitePrewarmed = true;

    const doPrewarm = () => {
      try {
        if (!this.map) return;
        const zoom = Math.round(this.map.getZoom());
        const center = this.map.getCenter();
        const latRad = center.lat * Math.PI / 180;
        const n = Math.pow(2, zoom);
        const centerX = Math.floor((center.lng + 180) / 360 * n);
        const centerY = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);

        const subdomains = ['mt0', 'mt1', 'mt2', 'mt3'];
        // Tải trước 9 tile trung tâm (3x3 grid) xung quanh điểm nhìn
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const x = centerX + dx;
            const y = centerY + dy;
            const s = subdomains[Math.abs(x + y) % 4];
            const img = new Image();
            img.src = `https://${s}.google.com/vt/lyrs=y&hl=vi&x=${x}&y=${y}&z=${zoom}`;
          }
        }
      } catch (e) {
        // Safe ignore
      }
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(doPrewarm, { timeout: 3500 });
    } else {
      setTimeout(doPrewarm, 2000);
    }
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
            <span class="gm-wp-temp">${st.temp}°</span>
            <span class="gm-wp-rain">${rainText}</span>
          </div>
        `,
        iconSize: [115, 26],
        iconAnchor: [58, 13]
      });

      const marker = L.marker([st.lat, st.lng], { icon: customIcon });

      // Tối ưu: Popup Lazy Loading - chỉ render HTML khi click vào pin
      marker.bindPopup(() => this.generateWeatherPopupHtml(st));
      this.layers.weatherMarkers.addLayer(marker);
    });
  }

  generateWeatherPopupHtml(st) {
    const risk = st.floodRisk || { level: 'safe', text: 'Khô ráo', color: '#1e8e3e' };
    let streetsHtml = '';
    if (st.mainStreets && st.mainStreets.length > 0) {
      streetsHtml = `
        <div style="background: #f8fafc; border: 1px solid #dbeafe; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: 700; color: #1d4ed8; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span>CÁC TRỤC ĐƯỜNG LỚN (${st.mainStreets.length} tuyến):</span>
            <span style="font-size: 10px; color: #64748b; font-weight: 400;">Nhấn để kiểm tra</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${st.mainStreets.map(street => `
              <span class="gm-street-badge" 
                    style="display: inline-block; background: #ffffff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 500; color: #1d4ed8; cursor: pointer; transition: all 0.15s ease;"
                    onmouseover="this.style.background='#1d4ed8'; this.style.color='#fff';"
                    onmouseout="this.style.background='#fff'; this.style.color='#1d4ed8';"
                    onclick="window.appState && window.appState.searchStreetFromWard('${street.replace(/'/g, "\\'")}', '${st.name.replace(/'/g, "\\'")}')"
                    title="Nhấn để kiểm tra lưu thông trên ${street}">
                ${street}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    let extraInfoHtml = '';
    if (st.trafficHotspots && st.trafficHotspots.length > 0) {
      extraInfoHtml += `
        <div style="font-size: 11.5px; color: #475569; margin-bottom: 6px;">
          <strong>Giao cắt trọng điểm:</strong> ${st.trafficHotspots.join(' • ')}
        </div>
      `;
    }
    if (st.floodVulnerability) {
      extraInfoHtml += `
        <div style="font-size: 11.5px; color: #dc2626; margin-bottom: 6px;">
          <strong>Lưu ý ngập úng:</strong> ${st.floodVulnerability}
        </div>
      `;
    }

    return `
      <div style="font-family: var(--font-family); min-width: 280px; max-width: 320px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; color: ${risk.color || '#1e8e3e'}; text-transform: uppercase;">
            ${risk.text}
          </span>
          <span style="background: ${risk.color || '#1e8e3e'}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px;">
            ${st.temp}°C
          </span>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">
          ${st.name}
        </h3>
        <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
          Trạng thái: <strong>${st.description}</strong> (Cảm giác như: ${st.feelsLike}°C)
        </div>

        ${streetsHtml}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; font-size: 11px; margin-bottom: 8px; color: #334155;">
          <div><strong>Lượng mưa 1h:</strong> ${st.rain1h} mm</div>
          <div><strong>Độ ẩm:</strong> ${st.humidity}%</div>
          <div><strong>Tốc độ gió:</strong> ${st.windSpeed} km/h</div>
          <div><strong>Cập nhật:</strong> Trực tuyến 24/7</div>
        </div>

        ${extraInfoHtml}

        <div style="font-size: 12px; color: ${risk.color || '#1e8e3e'}; font-weight: 500; margin-bottom: 8px;">
          Đánh giá: ${st.rain1h >= 20 ? 'Nguy cơ ngập dồn các tuyến đường trũng xung quanh.' : (st.rain1h > 0 ? 'Mặt đường ướt trơn trượt, giảm tốc độ.' : 'Thời tiết thuận lợi cho việc lưu thông trên các trục đường.')}
        </div>

        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button 
            style="flex: 1; background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 7px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer;"
            onclick="window.aiChat.open(); window.aiChat.sendMessage('Tình hình thời tiết và các tuyến đường lớn tại ${st.name.replace(/'/g, "\\'")} thế nào?')">
            Hỏi trợ lý AI
          </button>
          <button 
            style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 7px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer;"
            onclick="window.appState && window.appState.routeToLocation(${st.lat}, ${st.lng}, '${st.name.replace(/'/g, "\\'")}')">
            Chỉ đường đến đây
          </button>
        </div>
      </div>
    `;
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 2. Vẽ các ghim ngập nước chuẩn phong cách Google Maps Pin
  renderFloodPoints(floodPoints = []) {
    if (!this.layers.floodMarkers) return;
    if (!this._floodMarkerMap) this._floodMarkerMap = new Map();

    const activePoints = floodPoints.filter(point => point.depth_cm > 0 && point.danger_level !== 'safe');
    const newIds = new Set(activePoints.map(p => String(p.id)));

    for (const [id, item] of this._floodMarkerMap.entries()) {
      if (!newIds.has(id)) {
        this.layers.floodMarkers.removeLayer(item.marker);
        if (item.circle) this.layers.floodMarkers.removeLayer(item.circle);
        this._floodMarkerMap.delete(id);
      }
    }

    activePoints.forEach(point => {
      const pId = String(point.id);
      const isCritical = point.danger_level === 'critical';
      const depthText = point.depth_cm ? `Ngập ${point.depth_cm}cm` : 'Điểm ngập';
      const badgeClass = isCritical ? '' : 'badge-medium';
      const pointClass = isCritical ? '' : 'point-medium';
      const color = isCritical ? '#d93025' : '#f9ab00';

      const safeName = this.escapeHtml(point.name || 'Điểm ngập');
      const safeSource = this.escapeHtml(point.source || 'Cộng đồng');
      const safeAdvice = this.escapeHtml(point.advice || 'Khuyến nghị vòng tránh qua tuyến khác.');
      const safePump = this.escapeHtml(point.pump_status || 'Đang vận hành');

      const isCrowdsource = String(point.source || '').toLowerCase().includes('cộng đồng') || String(point.id || '').includes('cs-');
      const verifyButtons = isCrowdsource ? `
        <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
          <button style="flex: 1; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;"
                  onclick="window.crowdsourceService && window.crowdsourceService.voteReport('${pId}', 'up')">
            Xác nhận vẫn ngập
          </button>
          <button style="flex: 1; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;"
                  onclick="window.crowdsourceService && window.crowdsourceService.voteReport('${pId}', 'down')">
            Đã rút nước
          </button>
        </div>
      ` : '';

      const popupHtml = `
        <div style="font-family: var(--font-family); min-width: 250px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${color}; text-transform: uppercase;">
              ${isCritical ? 'Rốn ngập sâu nguy hiểm' : 'Điểm ngập cục bộ'}
            </span>
            <span style="background: ${color}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px;">
              ${point.depth_cm}cm
            </span>
          </div>
          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; line-height: 1.3;">
            ${safeName}
          </h3>
          <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
            Nguồn trạm đo: <strong>${safeSource}</strong>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 12px; margin-bottom: 8px; line-height: 1.5;">
            <div><strong>Xe máy:</strong> ${point.passable_motorbike ? 'Có thể đi qua chậm' : 'Không nên đi (nguy cơ chết máy)'}</div>
            <div><strong>Ô tô:</strong> ${point.passable_car ? 'Xe gầm cao đi được' : 'Cảnh báo nguy cơ thủy kích'}</div>
          </div>
          <div style="font-size: 12px; color: #b91c1c; font-weight: 500; margin-bottom: 6px;">
            ${safeAdvice}
          </div>
          <div style="font-size: 11px; color: #64748b;">
            Trạm bơm: ${safePump}
          </div>
          ${verifyButtons}
        </div>
      `;

      if (this._floodMarkerMap.has(pId)) {
        const existing = this._floodMarkerMap.get(pId);
        existing.marker.setPopupContent(popupHtml);
        existing.marker.setLatLng([point.lat, point.lng]);
        if (existing.circle) existing.circle.setLatLng([point.lat, point.lng]);
      } else {
        const customIcon = L.divIcon({
          className: 'gm-flood-pin-container',
          html: `
            <div class="gm-flood-pin">
              <div class="gm-flood-badge ${badgeClass}">
                ${depthText}
              </div>
              <div class="gm-pin-point ${pointClass}"></div>
            </div>
          `,
          iconSize: [72, 32],
          iconAnchor: [36, 32]
        });

        const marker = L.marker([point.lat, point.lng], { icon: customIcon });
        const circle = L.circle([point.lat, point.lng], {
          radius: isCritical ? 240 : 150,
          color: color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.12
        });

        marker.bindPopup(popupHtml);
        this.layers.floodMarkers.addLayer(marker);
        this.layers.floodMarkers.addLayer(circle);

        this._floodMarkerMap.set(pId, { marker, circle });
      }
    });

    this.handleZoomLevel();
  }

  // 3. Vẽ các ghim sự cố giao thông TomTom / VOV
  renderTrafficIncidents(incidents = []) {
    if (!this.layers.trafficMarkers) return;
    if (!this._trafficMarkerMap) this._trafficMarkerMap = new Map();

    const newIds = new Set(incidents.map(i => String(i.id)));

    for (const [id, marker] of this._trafficMarkerMap.entries()) {
      if (!newIds.has(id)) {
        this.layers.trafficMarkers.removeLayer(marker);
        this._trafficMarkerMap.delete(id);
      }
    }

    incidents.forEach(inc => {
      const incId = String(inc.id);
      const isRoadwork = inc.type === 'roadwork';
      const isClosure = inc.type === 'road_closure';
      const isAccident = inc.type === 'accident';
      const isRealJam = inc.isJam === true;

      let pinText = 'Tắc';
      let pinBg = '#f29900';
      let headerText = 'Cảnh báo đường bộ';
      let headerColor = '#b06000';

      if (isRoadwork) {
        pinText = 'Thi công';
        pinBg = '#e37400';
        headerText = 'Công trường thi công bảo trì';
        headerColor = '#b06000';
      } else if (isClosure) {
        pinText = 'Cấm đường';
        pinBg = '#d93025';
        headerText = 'Đoạn đường tạm cấm / Rào chắn';
        headerColor = '#d93025';
      } else if (isAccident) {
        pinText = 'Sự cố';
        pinBg = '#ea4335';
        headerText = 'Sự cố va chạm phương tiện';
        headerColor = '#ea4335';
      } else if (isRealJam) {
        pinText = 'Ùn tắc';
        pinBg = '#d93025';
        headerText = 'Ùn tắc phương tiện cao điểm';
        headerColor = '#d93025';
      } else {
        pinText = 'Lưu thông';
        pinBg = '#1e8e3e';
        headerText = 'Lưu thông bình thường';
        headerColor = '#1e8e3e';
      }

      const speedText = isClosure
        ? 'Tạm cấm lưu thông một chiều phục vụ thi công'
        : (isRealJam ? `Vận tốc ùn ứ: ~${inc.speedKmh || 8} km/h` : `Vận tốc lưu thông: ~${inc.speedKmh || 40} km/h`);

      const cleanDesc = String(inc.description || inc.categoryName || 'Sự cố trên tuyến đường')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
        .trim();
      const safeDesc = this.escapeHtml(cleanDesc);
      const safeSource = this.escapeHtml(inc.source || 'TomTom Traffic v5');

      const isCrowdsource = String(inc.source || '').toLowerCase().includes('cộng đồng') || incId.includes('cs-');
      const verifyButtons = isCrowdsource ? `
        <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
          <button style="flex: 1; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;"
                  onclick="window.crowdsourceService && window.crowdsourceService.voteReport('${incId}', 'up')">
            Xác nhận vẫn tắc
          </button>
          <button style="flex: 1; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;"
                  onclick="window.crowdsourceService && window.crowdsourceService.voteReport('${incId}', 'down')">
            Đã thông thoáng
          </button>
        </div>
      ` : '';

      const popupHtml = `
        <div style="font-family: var(--font-family); min-width: 240px;">
          <div style="font-size: 11px; font-weight: 700; color: ${headerColor}; text-transform: uppercase; margin-bottom: 4px;">
            ${headerText}
          </div>
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; line-height: 1.3;">
            ${safeDesc}
          </h4>
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">
            ${speedText} ${inc.delaySeconds > 0 ? `• Độ trễ: <strong>+${Math.round(inc.delaySeconds / 60)} phút</strong>` : ''}
          </div>
          <div style="font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 6px;">
            Nguồn: ${safeSource}
          </div>
          ${verifyButtons}
        </div>
      `;

      if (this._trafficMarkerMap.has(incId)) {
        const marker = this._trafficMarkerMap.get(incId);
        marker.setPopupContent(popupHtml);
        marker.setLatLng([inc.lat, inc.lng]);
      } else {
        const customIcon = L.divIcon({
          className: 'gm-traffic-pin-container',
          html: `<div class="gm-traffic-pin" style="background: ${pinBg};">${pinText}</div>`,
          iconSize: [64, 24],
          iconAnchor: [32, 12]
        });

        const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });
        marker.bindPopup(popupHtml);
        this.layers.trafficMarkers.addLayer(marker);
        this._trafficMarkerMap.set(incId, marker);
      }
    });

    this.handleZoomLevel();
  }

  // 4. Vẽ tuyến đường chuẩn phong cách Google Maps
  displayRoute({ recommendedRoute, dangerRoute, hasHazard }) {
    if (this.layers.routeSafeOutline) this.map.removeLayer(this.layers.routeSafeOutline);
    if (this.layers.routeSafe) this.map.removeLayer(this.layers.routeSafe);
    if (this.layers.routeDanger) this.map.removeLayer(this.layers.routeDanger);

    if (hasHazard && dangerRoute) {
      this.layers.routeDanger = L.polyline(dangerRoute.polyline, {
        color: '#d93025',
        weight: 6,
        opacity: 0.75,
        dashArray: '8, 8'
      }).addTo(this.map);
    }

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
      if (this.currentBase === 'satellite') return;
      this.currentBase = 'satellite';

      // 1. Thêm lớp vệ tinh lên trên trước, giữ lớp chuẩn bên dưới để không bị nháy màn hình xám
      if (this.layers.baseSatellite.setZIndex) this.layers.baseSatellite.setZIndex(2);
      if (this.layers.baseStandard.setZIndex) this.layers.baseStandard.setZIndex(1);
      this.layers.baseSatellite.addTo(this.map);

      // 2. Gỡ lớp chuẩn sau khi các ô vệ tinh đầu tiên đã nạp xong (hoặc tối đa 600ms)
      const onSatelliteReady = () => {
        if (this.currentBase === 'satellite' && this.map.hasLayer(this.layers.baseStandard)) {
          this.map.removeLayer(this.layers.baseStandard);
        }
      };
      this.layers.baseSatellite.once('load', onSatelliteReady);
      setTimeout(onSatelliteReady, 600);
    } else {
      if (this.currentBase === 'standard') return;
      this.currentBase = 'standard';

      if (this.layers.baseStandard.setZIndex) this.layers.baseStandard.setZIndex(2);
      if (this.layers.baseSatellite.setZIndex) this.layers.baseSatellite.setZIndex(1);
      this.layers.baseStandard.addTo(this.map);

      const onStandardReady = () => {
        if (this.currentBase === 'standard' && this.map.hasLayer(this.layers.baseSatellite)) {
          this.map.removeLayer(this.layers.baseSatellite);
        }
      };
      this.layers.baseStandard.once('load', onStandardReady);
      setTimeout(onStandardReady, 600);
    }
  }

  async toggleEV(show, forceReload = false) {
    if (!this.map) return;
    if (show) {
      if (!this.map.hasLayer(this.layers.evLayer)) {
        this.layers.evLayer.addTo(this.map);
      }
      const currentCity = window.appState ? window.appState.currentCity : 'hanoi';
      const needsLoad = forceReload || this._loadedEvCity !== currentCity || this.layers.evLayer.getLayers().length === 0;

      if (needsLoad && !this._evLoading && window.supabaseService) {
        this._evLoading = true;
        try {
          this.layers.evLayer.clearLayers();
          const stations = await window.supabaseService.getEVStations(currentCity);
          if (Array.isArray(stations)) {
            this._evStationsData = stations;
            stations.forEach(st => {
              if (typeof st.lat !== 'number' || typeof st.lng !== 'number') return;
              
              const isFast = st.isFastCharge || (st.maxPowerKw && st.maxPowerKw >= 50);
              const isSwap = (st.name && st.name.toLowerCase().includes('selex')) || (st.operator && st.operator.toLowerCase().includes('selex'));
              const pinClass = isSwap ? 'ev-swap' : (isFast ? 'ev-fast' : 'ev-standard');

              const zapSvg = `<svg class="ev-pin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
              const powerLabel = isSwap ? 'Đổi pin' : (st.maxPowerKw ? `${st.maxPowerKw}kW` : (isFast ? 'DC Fast' : '22kW'));

              const pinHtml = `
                <div class="gm-ev-pin ${pinClass}" title="${String(st.name || 'Trạm sạc').replace(/"/g, '&quot;')} (${powerLabel})">
                  ${zapSvg}
                  <span>${powerLabel}</span>
                </div>
              `;

              const icon = L.divIcon({
                className: 'gm-ev-pin-container',
                html: pinHtml,
                iconSize: [66, 24],
                iconAnchor: [33, 12],
                popupAnchor: [0, -14]
              });

              const marker = L.marker([st.lat, st.lng], { icon: icon });
              marker.bindPopup(() => this.generateEVPopupHtml(st), {
                maxWidth: 340,
                autoPanPadding: [20, 20]
              });
              
              // Gắn thông tin để tìm kiếm nhanh
              marker._evStation = st;
              this.layers.evLayer.addLayer(marker);
            });
            this._loadedEvCity = currentCity;
          }
        } catch (err) {
          console.warn('[MapEngine] Lỗi nạp trạm sạc EV:', err);
        } finally {
          this._evLoading = false;
        }
      }
    } else {
      if (this.map.hasLayer(this.layers.evLayer)) {
        this.map.removeLayer(this.layers.evLayer);
      }
    }
  }

  generateEVPopupHtml(st) {
    const isFast = st.isFastCharge || (st.maxPowerKw && st.maxPowerKw >= 50);
    const isSwap = (st.name && st.name.toLowerCase().includes('selex')) || (st.operator && st.operator.toLowerCase().includes('selex'));
    
    const safeName = String(st.name || 'Trạm sạc xe điện').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeAddress = String(st.address || st.town || 'Việt Nam').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeOperator = String(st.operator || st.provider || 'Hệ thống đối tác').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const statusText = st.isOperational !== false ? 'Đang hoạt động 24/7' : 'Đang bảo trì';
    const statusColor = st.isOperational !== false ? '#10b981' : '#f59e0b';
    
    // Thẻ cổng kết nối
    let connectorsHtml = '';
    if (Array.isArray(st.connectors) && st.connectors.length > 0) {
      connectorsHtml = `
        <div style="margin-top: 8px; margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px;">Cổng kết nối khả dụng:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${st.connectors.map(c => {
              const isDc = (c.current === 'DC') || (c.powerKw && c.powerKw >= 50);
              const tagClass = isDc ? 'tag-dc' : 'tag-ac';
              const pLabel = c.powerKw ? `${c.powerKw}kW` : '';
              return `<span class="ev-connector-tag ${tagClass}">⚡ ${c.type || 'Tiêu chuẩn'} ${pLabel}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    const typeBadge = isSwap ? 'Đổi pin xe máy điện' : (isFast ? 'DC Supercharge' : 'AC Tiêu chuẩn');
    const badgeBg = isSwap ? '#fef3c7' : (isFast ? '#eff6ff' : '#f0fdf4');
    const badgeColor = isSwap ? '#b45309' : (isFast ? '#1d4ed8' : '#047857');
    const badgeBorder = isSwap ? '#fde68a' : (isFast ? '#bfdbfe' : '#bbf7d0');

    return `
      <div style="font-family: var(--font-family); min-width: 280px; max-width: 320px; line-height: 1.4;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 6px;">
            ${typeBadge}
          </span>
          <span style="font-size: 11px; font-weight: 600; color: ${statusColor}; display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${statusColor};"></span>
            ${statusText}
          </span>
        </div>

        <h3 style="font-size: 14.5px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; line-height: 1.35;">
          ${safeName}
        </h3>

        <div style="font-size: 11.5px; color: #64748b; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>${safeAddress}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; font-size: 11px; margin-bottom: 8px; color: #334155;">
          <div><strong>Đơn vị:</strong> ${safeOperator}</div>
          <div><strong>Công suất:</strong> ${st.maxPowerKw || (isFast ? 60 : 22)} kW</div>
          <div><strong>Quy mô:</strong> ${st.totalPoints || st.capacity || 2} trụ sạc</div>
          <div><strong>Nguồn:</strong> ${st.source ? 'OpenChargeMap' : 'MoveSafe VN'}</div>
        </div>

        ${connectorsHtml}

        <div style="display: flex; gap: 6px; margin-top: 10px;">
          <button 
            style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 8px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: background 0.15s ease;"
            onmouseover="this.style.background='#1d4ed8'"
            onmouseout="this.style.background='#2563eb'"
            onclick="window.appState && window.appState.routeToLocation(${st.lat}, ${st.lng}, '${safeName.replace(/'/g, "\\'")}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3" transform="rotate(45 12 12)"></rect><path d="M9.5 14.5v-3a1 1 0 0 1 1-1h4"></path><polyline points="12.5 8.5 14.5 10.5 12.5 12.5"></polyline></svg>
            Chỉ đường né ngập
          </button>
          <button 
            style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: background 0.15s ease;"
            onmouseover="this.style.background='#dbeafe'"
            onmouseout="this.style.background='#eff6ff'"
            onclick="window.aiChat && (window.aiChat.open(), window.aiChat.sendMessage('Tư vấn lộ trình xe điện đến trạm sạc ${safeName.replace(/'/g, "\\'")} (${safeAddress.replace(/'/g, "\\'")}), dọc đường có điểm ngập nào cần tránh không?'))">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path></svg>
            Hỏi AI
          </button>
        </div>
      </div>
    `;
  }

  focusEVStation(stationIdOrName) {
    if (!this.layers.evLayer) return false;
    const term = String(stationIdOrName || '').toLowerCase().trim();
    let foundMarker = null;

    this.layers.evLayer.eachLayer(marker => {
      const st = marker._evStation;
      if (st && (st.id === term || st.name.toLowerCase().includes(term) || (st.address && st.address.toLowerCase().includes(term)))) {
        foundMarker = marker;
      }
    });

    if (foundMarker) {
      const latlng = foundMarker.getLatLng();
      this.map.flyTo(latlng, 16);
      setTimeout(() => {
        foundMarker.openPopup();
      }, 500);
      return true;
    }
    return false;
  }

  zoomIn() { if (this.map) this.map.zoomIn(); }
  zoomOut() { if (this.map) this.map.zoomOut(); }
}

window.mapEngine = new MapEngine();
