/**
 * MoveSafe VN - Cloud Bot Runner (24/7 Automated Worker)
 * Chạy độc lập trên Cloud VM / GitHub Actions / CLI để cào và chuẩn hóa dữ liệu 24/24.
 * Bao gồm: VOV Giao thông, NCHMF Thời tiết, HSDC Hà Nội, UDi TP.HCM, TomTom Traffic v5 & Open-Meteo Trạm Đô Thị.
 */

const botService = require('./bot-service');

async function runBotTask() {
  const startTime = Date.now();
  console.log('===============================================================');
  console.log(`🚀 [MoveSafe VN] KHỞI ĐỘNG TIẾN TRÌNH CÀO DỮ LIỆU ĐÁM MÂY 24/7`);
  console.log(`⏰ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  console.log('===============================================================');

  try {
    const data = await botService.crawlAll();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('---------------------------------------------------------------');
    console.log(`✅ [MoveSafe VN] ĐÃ HOÀN TẤT CHU TRÌNH CÀO DỮ LIỆU TRONG ${duration}s!`);
    console.log(`🌊 Tổng số điểm ngập lụt: ${data.stats.totalFloods} (${data.stats.criticalFloods} điểm nguy hiểm)`);
    console.log(`🚗 Tổng số sự cố giao thông / tin VOV: ${data.stats.trafficAlerts}`);
    console.log(`🌦️ Trạm thời tiết các quận: ${Object.keys(data.weatherStations || {}).length} thành phố`);
    console.log(`📁 Dữ liệu cache đã ghi vào: data/live_urban_cache.json`);
    console.log('===============================================================');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ [MoveSafe VN] Lỗi trong quá trình cào dữ liệu đám mây:', err);
    process.exit(1);
  }
}

runBotTask();
