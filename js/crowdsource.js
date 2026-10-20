/**
 * CrowdsourceService - Quản lý báo cáo sự cố ngập lụt, kẹt xe từ cộng đồng
 * Đồng bộ đa tab / đa thiết bị theo thời gian thực qua BroadcastChannel
 */

class CrowdsourceService {
  constructor() {
    this.storageKey = 'movesafe_crowdsource_reports';
    this.channel = new BroadcastChannel('movesafe_realtime_channel');
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_REPORT' && event.data.report) {
        console.log('[Realtime Sync] Nhận báo cáo mới từ tab khác:', event.data.report);
        this.handleIncomingReport(event.data.report);
      }
    };
  }

  // Lấy các báo cáo đã lưu trong localStorage (TTL 2 giờ)
  getLocalReports() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const list = JSON.parse(raw);
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      const valid = list.filter(item => {
        const t = new Date(item.updated_at || item.created_at || Date.now()).getTime();
        return t > twoHoursAgo;
      });
      if (valid.length !== list.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(valid));
      }
      return valid;
    } catch (e) {
      return [];
    }
  }

  saveReportToStorage(report) {
    try {
      const list = this.getLocalReports();
      if (!list.some(r => r.id === report.id)) {
        list.unshift(report);
        localStorage.setItem(this.storageKey, JSON.stringify(list.slice(0, 50)));
      }
    } catch (e) {}
  }

  // Phát âm thanh cảnh báo ngắn (Web Audio API)
  playAlertTone() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }

  handleIncomingReport(report) {
    if (!report || !report.id) return;
    this.playAlertTone();
    this.saveReportToStorage(report);

    if (window.appState && window.appState.liveData) {
      // Chống thêm trùng ID báo cáo
      const existingFlood = window.appState.liveData.floodPoints.some(f => f.id === report.id);
      const existingTraffic = window.appState.liveData.trafficIncidents.some(t => t.id === report.id);
      if (existingFlood || existingTraffic) return;

      if (report.type === 'flood') {
        window.appState.liveData.floodPoints.unshift(report);
      } else {
        window.appState.liveData.trafficIncidents.unshift(report);
      }

      // Vẽ lại dữ liệu cho thành phố hiện tại & cập nhật bộ đếm
      window.appState.renderAllData();
    }
  }

  // Xác thực cộng đồng (Vote Up: Vẫn ngập/tắc; Vote Down: Đã thông thoáng)
  async voteReport(reportId, voteType) {
    try {
      const res = await fetch('/api/crowdsource/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, voteType: voteType === 'up' ? 'confirm' : 'clear' })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(voteType === 'up' ? 'Cảm ơn bạn đã xác nhận tình trạng!' : 'Cảm ơn bạn đã báo đường thông thoáng!');
        if (data.action === 'removed') {
          if (window.appState && window.appState.liveData) {
            window.appState.liveData.floodPoints = window.appState.liveData.floodPoints.filter(p => p.id !== reportId);
            window.appState.liveData.trafficIncidents = window.appState.liveData.trafficIncidents.filter(p => p.id !== reportId);
            window.appState.renderAllData();
          }
        }
      } else {
        alert(data.message || 'Không thể gửi bình chọn');
      }
    } catch (err) {
      alert('Đã ghi nhận ý kiến của bạn vào bộ nhớ cục bộ.');
    }
  }

  async submitReport(formData) {
    let reportData = null;

    try {
      const res = await fetch('/api/crowdsource/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.status === 'success' && data.report) {
        reportData = data.report;
      } else {
        throw new Error(data.message || 'Lỗi khi gửi báo cáo lên server');
      }
    } catch (networkErr) {
      console.warn('Lỗi kết nối server, chuyển sang lưu báo cáo cục bộ:', networkErr.message);
      const rType = formData.type || 'flood';
      const depthVal = parseInt(formData.depth_cm, 10) || 25;
      const locName = formData.locationName || 'Điểm do bạn vừa báo cáo';
      const isJam = rType === 'traffic_jam';

      reportData = {
        id: `local-${Date.now()}`,
        name: locName,
        city: formData.city || 'hanoi',
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        type: rType,
        depth_cm: rType === 'flood' ? depthVal : 0,
        danger_level: depthVal > 30 ? 'critical' : 'medium',
        passable_motorbike: depthVal < 20,
        passable_car: depthVal < 35,
        isJam,
        categoryName: isJam ? 'Báo cáo ùn tắc cộng đồng' : (rType === 'hazard' ? 'Cảnh báo vật cản' : 'Điểm ngập cộng đồng'),
        icon: '',
        description: isJam
          ? `Cộng đồng báo kẹt xe tại ${locName}`
          : (rType === 'hazard' ? `Sự cố/vật cản tại ${locName}` : `Ngập ${depthVal}cm tại ${locName}`),
        delaySeconds: isJam ? 450 : 180,
        speedKmh: isJam ? 10 : 25,
        source: 'Báo cáo trực tiếp từ bạn',
        pump_status: 'Vừa ghi nhận',
        advice: 'Cần chú ý giảm tốc độ.',
        updated_at: new Date().toISOString()
      };
    }

    if (reportData) {
      this.saveReportToStorage(reportData);

      // 1. Đồng bộ tới các tab khác
      try {
        this.channel.postMessage({
          type: 'NEW_REPORT',
          report: reportData
        });
      } catch (e) {}

      // 2. Cập nhật ngay trên máy người dùng
      try {
        this.handleIncomingReport(reportData);
      } catch (renderErr) {
        console.error('Lỗi khi vẽ báo cáo lên bản đồ:', renderErr);
      }

      return { success: true, report: reportData };
    }

    return { success: false, message: 'Không thể tạo báo cáo sự cố' };
  }
}

window.crowdsourceService = new CrowdsourceService();
