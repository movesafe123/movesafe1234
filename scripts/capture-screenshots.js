const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function capture() {
  console.log('🚀 Launching Edge browser...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });

  // 1. Chụp Bản đồ tổng quan thời gian thực
  console.log('📸 1. Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000)); // Đợi bản đồ Leaflet render ghim & thời tiết

  const img1 = path.join(OUTPUT_DIR, 'hinh1_tongquan_bando.png');
  await page.screenshot({ path: img1 });
  console.log('✅ Đã lưu:', img1);

  // 2. Chụp Bảng chỉ đường né ngập (Directions Panel) với dự báo giao thông & lộ trình
  console.log('📸 2. Mở Directions Panel & tìm đường...');
  try {
    await page.click('#btn-open-directions');
    await new Promise(r => setTimeout(r, 1000));
    
    // Đổi slider dự báo giao thông sang +1h hoặc +2h
    await page.evaluate(() => {
      const slider = document.getElementById('traffic-prediction-slider');
      if (slider) {
        slider.value = 1;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    // Bấm tìm đường
    await page.click('#btn-find-route-submit');
    await new Promise(r => setTimeout(r, 4000)); // Chờ OSRM / định tuyến và vẽ polyline
  } catch (e) {
    console.warn('Lỗi tương tác chỉ đường:', e.message);
  }

  const img2 = path.join(OUTPUT_DIR, 'hinh2_dieu_huong_ai.png');
  await page.screenshot({ path: img2 });
  console.log('✅ Đã lưu:', img2);

  // 3. Chụp Trợ lý AI Copilot
  console.log('📸 3. Mở Trợ lý AI Copilot...');
  try {
    // Đóng panel chỉ đường trước nếu mở
    await page.evaluate(() => {
      const closeDir = document.getElementById('btn-close-directions');
      if (closeDir) closeDir.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Bật Trợ lý AI
    await page.click('#chip-ai-trigger');
    await new Promise(r => setTimeout(r, 1000));

    // Gửi 1 câu hỏi mẫu hoặc thêm tin nhắn mẫu vào khung chat để hiển thị sống động
    await page.evaluate(() => {
      if (window.aiChat) {
        window.aiChat.addMessage('user', 'Tuyến đường từ Cầu Giấy về Hoàn Kiếm có điểm nào ngập hoặc ùn tắc không AI?');
        window.aiChat.addMessage('bot', '🤖 **Phân tích lộ trình thông minh:**\n- Tuyến Kim Mã - Nguyễn Thái Học: Hiện thông thoáng, không ghi nhận ngập nước.\n- Cảnh báo: Khu vực đường Đội Cấn đang có lưu lượng đông cục bộ.\n- Đề xuất lộ trình: Di chuyển theo hướng Kim Mã -> Tràng Thi -> Nhà Hát Lớn là tối ưu nhất (tiết kiệm 12 phút, an toàn 100%).');
      }
    });
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.warn('Lỗi tương tác AI:', e.message);
  }

  const img3 = path.join(OUTPUT_DIR, 'hinh3_tro_ly_ai.png');
  await page.screenshot({ path: img3 });
  console.log('✅ Đã lưu:', img3);

  // 4. Chụp Báo cáo sự cố cộng đồng (Crowdsourcing Modal)
  console.log('📸 4. Mở Modal Báo cáo cộng đồng...');
  try {
    // Đóng drawer AI
    await page.evaluate(() => {
      if (window.aiChat) window.aiChat.close();
    });
    await new Promise(r => setTimeout(r, 500));

    // Mở modal báo cáo
    await page.click('#btn-gm-open-report');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.warn('Lỗi tương tác Report modal:', e.message);
  }

  const img4 = path.join(OUTPUT_DIR, 'hinh4_bao_cao_cong_dong.png');
  await page.screenshot({ path: img4 });
  console.log('✅ Đã lưu:', img4);

  await browser.close();
  console.log('🎉 Hoàn tất chụp 4 ảnh giao diện thực tế của MoveSafe VN!');
}

capture().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
