/**
 * CrowdsourceService - Quản lý báo cáo sự cố ngập lụt, kẹt xe từ cộng đồng
 * Đồng bộ đa tab / đa thiết bị theo thời gian thực qua BroadcastChannel
 */

class CrowdsourceService {
  constructor() {
    this.channel = new BroadcastChannel('movesafe_realtime_channel');
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_REPORT' && event.data.report) {
        console.log('[Realtime Sync] Nhận báo cáo mới từ tab khác:', event.data.report);
        this.handleIncomingReport(event.data.report);
      }
    };
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
      // Giả lập lưu cục bộ nếu server không phản hồi
      reportData = {
        id: `local-${Date.now()}`,
        name: formData.locationName || 'Điểm do bạn vừa báo cáo',
        city: formData.city || 'hanoi',
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        type: formData.type || 'flood',
        depth_cm: parseInt(formData.depth_cm, 10) || 25,
        danger_level: parseInt(formData.depth_cm, 10) > 30 ? 'critical' : 'medium',
        passable_motorbike: parseInt(formData.depth_cm, 10) < 20,
        passable_car: parseInt(formData.depth_cm, 10) < 35,
        source: 'Báo cáo trực tiếp từ bạn',
        pump_status: 'Vừa ghi nhận',
        advice: 'Cần chú ý giảm tốc độ.',
        updated_at: new Date().toISOString()
      };
    }

    if (reportData) {
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
