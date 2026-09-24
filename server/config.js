const fs = require('fs');
const path = require('path');

// Đọc tự động file .env nếu có
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

// Cấu hình trung tâm cho hệ sinh thái MoveSafe VN
module.exports = {
  PORT: process.env.PORT || 3000,
  
  // API Keys được nạp từ biến môi trường
  API_KEYS: {
    OPENWEATHER: process.env.OPENWEATHER_KEY || '1e050d36d170249efaf439dcdb324228',
    TOMTOM: process.env.TOMTOM_KEY || 'dz8wjRiOa8pDrr1g9Grzk0Qnp6O6wLbF',
    GEMINI: process.env.GEMINI_KEY || ''
  },

  // Tọa độ trung tâm các đô thị trọng điểm
  CITIES: {
    hanoi: {
      name: 'Hà Nội',
      lat: 21.028511,
      lng: 105.854167,
      zoom: 13,
      bbox: '105.70,20.90,105.95,21.15'
    },
    hcm: {
      name: 'TP. Hồ Chí Minh',
      lat: 10.776889,
      lng: 106.700806,
      zoom: 13,
      bbox: '106.55,10.65,106.85,10.90'
    },
    danang: {
      name: 'Đà Nẵng',
      lat: 16.054407,
      lng: 108.202167,
      zoom: 13,
      bbox: '108.10,15.95,108.30,16.15'
    }
  },

  // Cấu hình Bot Crawler địa phương
  BOT_CONFIG: {
    CRAWL_INTERVAL_MS: 5 * 60 * 1000, // 5 phút quét 1 lần
    TIMEOUT_MS: 8000,
    ENDPOINTS: {
      VOV_TRAFFIC: 'https://vovgiaothong.vn/tin-tuc',
      NCHMF: 'https://nchmf.gov.vn',
      HSDC_PORTAL: 'http://maps.hsdc.com.vn',
      UDI_HCM_PORTAL: 'http://udimaps.com.vn'
    }
  }
};
