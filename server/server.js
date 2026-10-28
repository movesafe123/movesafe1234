const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const botService = require('./bot-service');
const aiService = require('./ai-service');
const historyService = require('./history-service');
const evService = require('./ev-service');

const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '25kb' }));

// 1. Phục vụ file tĩnh theo danh sách cho phép (Whitelist), từ chối dotfiles
const rootDir = path.join(__dirname, '..');
const staticOptions = {
  dotfiles: 'deny',
  maxAge: '1h'
};

app.use('/css', express.static(path.join(rootDir, 'css'), staticOptions));
app.use('/js', express.static(path.join(rootDir, 'js'), staticOptions));
app.use('/screenshots', express.static(path.join(rootDir, 'public', 'screenshots'), staticOptions));

// Phục vụ cache dữ liệu cho client fallback kèm Cache-Control tối ưu tốc độ tải và làm mới
app.get('/data/live_urban_cache.json', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  res.sendFile(path.join(rootDir, 'data', 'live_urban_cache.json'));
});
app.get('/data/ev_stations_cache.json', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(rootDir, 'data', 'ev_stations_cache.json'));
});
app.use('/data', express.static(path.join(rootDir, 'data'), staticOptions));

// Phục vụ PWA Manifest
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(rootDir, 'manifest.json'));
});

// Phục vụ trang chủ
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Rate Limiter trong bộ nhớ kèm cơ chế tự động dọn dẹp chống rò rỉ RAM (Zero dependency)
const rateLimitMap = new Map();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 5000;

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.startTime > (record.windowMs || 60000)) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS).unref();

function createRateLimiter({ windowMs, maxRequests, message }) {
  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();
    let record = rateLimitMap.get(key);

    if (!record || now - record.startTime > windowMs) {
      if (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS && !rateLimitMap.has(key)) {
        const oldestKey = rateLimitMap.keys().next().value;
        if (oldestKey) rateLimitMap.delete(oldestKey);
      }
      record = { startTime: now, count: 1, windowMs };
    } else {
      record.count++;
    }
    rateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.startTime + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        status: 'error',
        message: message || `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfterSec} giây.`
      });
    }
    next();
  };
}

const aiChatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Bạn đã gửi nhiều câu hỏi trong thời gian ngắn. Vui lòng đợi 1 phút.'
});

const reportLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 6,
  message: 'Bạn đã gửi nhiều báo cáo sự cố trong 1 phút. Vui lòng thử lại sau.'
});

let lastBotRefreshTime = 0;
function botRefreshLimiter(req, res, next) {
  const now = Date.now();
  const COOLDOWN_MS = 60 * 1000; // 60 giây
  if (now - lastBotRefreshTime < COOLDOWN_MS) {
    const remainSec = Math.ceil((lastBotRefreshTime + COOLDOWN_MS - now) / 1000);
    res.setHeader('Retry-After', remainSec);
    return res.status(429).json({
      status: 'error',
      message: `Hệ thống vừa cập nhật dữ liệu. Vui lòng đợi ${remainSec} giây trước khi quét lại.`
    });
  }
  lastBotRefreshTime = now;
  next();
}

// 1. API Cấu hình công khai cho Frontend
app.get('/api/config', (req, res) => {
  res.json({
    status: 'success',
    apiKeys: {
      tomtom: config.API_KEYS.TOMTOM,
      hasOpenWeather: !!config.API_KEYS.OPENWEATHER,
      hasGemini: !!config.API_KEYS.GEMINI
    },
    cities: config.CITIES,
    systemTime: new Date().toISOString()
  });
});

// 2. API Lấy dữ liệu thời gian thực từ Bot
app.get('/api/live-data', (req, res) => {
  const data = botService.getData();
  res.json({
    status: 'success',
    data
  });
});

// 2b. API Lấy dữ liệu lịch sử quan trắc 7 ngày qua (Rolling Time-Series)
app.get('/api/history', (req, res) => {
  const city = req.query.city || 'hanoi';
  const days = parseInt(req.query.days, 10) || 7;
  const history = historyService.getHistory(city, days);
  res.json(history);
});

// 2c. API Lấy dữ liệu dự báo tương lai thực tế (+1h, +2h, +3h)
app.get('/api/predictions', (req, res) => {
  const city = req.query.city || 'hanoi';
  const rawOffset = req.query.offsetHours || req.query.offset || 1;
  const offset = Math.min(3, Math.max(1, parseInt(rawOffset, 10) || 1));
  const predictions = botService.getFuturePredictions(city, offset);
  res.json({
    status: 'success',
    ...predictions
  });
});

// 2d. API Lấy danh sách Trạm sạc Xe điện (Open Charge Map API v3 & Mạng lưới Trạm sạc Quốc gia)
app.get('/api/ev-stations', (req, res) => {
  const city = req.query.city || 'hanoi';
  const fastOnly = req.query.fastOnly === 'true' || req.query.fastOnly === '1';
  const stations = evService.getStations(city, fastOnly);
  res.json({
    status: 'success',
    source: 'Open Charge Map API v3 & Hybrid Network',
    count: stations.length,
    city,
    data: stations
  });
});

// 3. API Kích hoạt Bot cào dữ liệu ngay lập tức
app.post('/api/bot/refresh', botRefreshLimiter, async (req, res) => {
  try {
    const updated = await botService.crawlAll();
    res.json({
      status: 'success',
      message: 'Đã hoàn tất chu trình cào dữ liệu từ hệ thống địa phương!',
      data: updated
    });
  } catch (err) {
    lastBotRefreshTime = 0; // Cho phép thử lại nếu lần cào gặp lỗi
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. API Gửi báo cáo cộng đồng (Crowdsourcing)
app.post('/api/crowdsource/report', reportLimiter, (req, res) => {
  try {
    const report = req.body;
    const lat = Number(report?.lat);
    const lng = Number(report?.lng);

    if (!report || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ status: 'error', message: 'Thiếu tọa độ sự cố hợp lệ' });
    }

    if (report.locationName && typeof report.locationName === 'string') {
      report.locationName = report.locationName.slice(0, 150);
    }

    const saved = botService.addCrowdsourceReport({
      ...report,
      lat,
      lng
    });

    res.json({
      status: 'success',
      message: 'Báo cáo sự cố đã được xác thực và ghim lên bản đồ!',
      report: saved
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4b. API Bình chọn xác thực báo cáo cộng đồng (Confirm / Clear)
app.post('/api/crowdsource/vote', reportLimiter, (req, res) => {
  try {
    const { id, voteType } = req.body || {};
    if (!id || !['confirm', 'clear'].includes(voteType)) {
      return res.status(400).json({ status: 'error', message: 'Tham số bình chọn không hợp lệ' });
    }
    const result = botService.voteCrowdsourceReport(String(id), voteType);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy báo cáo sự cố hoặc đã hết hiệu lực' });
    }
    res.json({ status: 'success', report: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. API Trợ lý AI Thông Minh

// 5.1 API Tra cứu Địa điểm Google Maps Công Khai (Zero API Key - Tốc độ cao ~300ms)
function parseGoogleTbmMapPayload(txt, refLat = null, refLng = null) {
  if (!txt || typeof txt !== 'string') return [];
  const results = [];
  const seen = new Set();
  const re = /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\],\s*"(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)",\s*"((?:[^"\\]|\\.)+)"/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    const cid = m[3];
    let rawTitle = '';
    try { rawTitle = JSON.parse(`"${m[4]}"`); } catch { rawTitle = m[4]; }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !rawTitle) continue;
    if (seen.has(cid)) continue;
    seen.add(cid);

    const beforeSlice = txt.slice(Math.max(0, m.index - 180), m.index);
    const afterSlice = txt.slice(m.index + m[0].length, m.index + m[0].length + 650);

    let rating = null;
    let reviewsCount = null;
    const rateMatch = beforeSlice.match(/,(\d\.\d),(\d+)\],null,null,null,null,$/);
    if (rateMatch) {
      rating = parseFloat(rateMatch[1]);
      reviewsCount = parseInt(rateMatch[2], 10);
    }

    let category = 'Địa điểm';
    const catMatch = afterSlice.match(/^,\s*null,\s*\["((?:[^"\\]|\\.)+)"/);
    if (catMatch) {
      try { category = JSON.parse(`"${catMatch[1]}"`); } catch {}
    }

    let address = '';
    const strMatches = [...afterSlice.matchAll(/"((?:[^"\\]|\\.)+)"/g)].map(x => {
      try { return JSON.parse(`"${x[1]}"`); } catch { return x[1]; }
    });
    for (const s of strMatches) {
      if (s.length > rawTitle.length + 5 && (s.includes(',') || s.includes('Hà Nội') || s.includes('Hồ Chí Minh') || s.includes('Đà Nẵng') || s.includes('Việt Nam'))) {
        address = s.replace(/^.*?\b(?=\d+\s+|\bNgõ\b|\bPhố\b|\bĐường\b)/, '');
        if (!address || address.length < 6) address = s;
        break;
      }
    }
    if (address.startsWith(rawTitle + ', ')) {
      address = address.slice(rawTitle.length + 2).trim();
    }

    const distM = (Number.isFinite(refLat) && Number.isFinite(refLng))
      ? Math.round(Math.hypot((lat - refLat) * 111320, (lng - refLng) * 104000))
      : null;

    results.push({
      title: rawTitle,
      subtitle: address || category,
      fullAddress: address ? `${rawTitle}, ${address}` : rawTitle,
      category,
      lat,
      lng,
      rating,
      reviewsCount,
      distM,
      source: 'google-map-stream'
    });
  }
  return results;
}

app.get('/api/geocode/google-search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ status: 'success', results: [] });

  const refLat = req.query.lat ? parseFloat(req.query.lat) : null;
  const refLng = req.query.lng ? parseFloat(req.query.lng) : null;
  const cityName = req.query.city === 'hcm' ? 'Hồ Chí Minh' : (req.query.city === 'danang' ? 'Đà Nẵng' : 'Hà Nội');
  const fullQ = q.includes(cityName) ? q : `${q} ${cityName}`;

  try {
    const url = 'https://www.google.com/search?tbm=map&authuser=0&hl=vi&gl=vn&q=' + encodeURIComponent(fullQ);
    const gRes = await axios.get(url, {
      timeout: 3800,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const parsed = parseGoogleTbmMapPayload(gRes.data, refLat, refLng);
    res.json({ status: 'success', results: parsed });
  } catch (err) {
    res.json({ status: 'fallback', results: [], message: err.message });
  }
});

app.get('/api/geocode/google-reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ status: 'error', message: 'Tọa độ không hợp lệ' });
  }

  try {
    const pb = `!4m12!1m3!1d55!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i600!2i600!4f13.1!7i15!10b1`;
    const searchTasks = ['quán ăn', 'cửa hàng', 'công ty'].map(term =>
      axios.get(`https://www.google.com/search?tbm=map&authuser=0&hl=vi&gl=vn&pb=${pb}&q=${encodeURIComponent(term)}`, {
        timeout: 3500,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }).then(r => parseGoogleTbmMapPayload(r.data, lat, lng)).catch(() => [])
    );

    const batches = await Promise.all(searchTasks);
    const all = batches.flat();
    const seen = new Set();
    const unique = [];
    for (const item of all) {
      if (!seen.has(item.title)) {
        seen.add(item.title);
        unique.push(item);
      }
    }
    unique.sort((a, b) => (a.distM || 999) - (b.distM || 999));

    const exactMatch = unique.find(p => (p.distM || 999) <= 22) || null;
    res.json({
      status: 'success',
      exactMatch,
      nearbyCandidates: unique.slice(0, 5)
    });
  } catch (err) {
    res.json({ status: 'fallback', exactMatch: null, nearbyCandidates: [], message: err.message });
  }
});

app.post('/api/ai/chat', aiChatLimiter, async (req, res) => {
  try {
    const { query, city, apiKey, context } = req.body;
    if (!query) {
      return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp câu hỏi' });
    }

    const response = await aiService.processQuery({
      query,
      city: city || 'hanoi',
      userApiKey: apiKey || config.API_KEYS.GEMINI,
      context: context || {}
    });

    res.json({
      status: 'success',
      response
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 6. API Server-Sent Events (SSE) Phát trực tiếp cập nhật 24/7 tới Client
app.get('/api/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Gửi dữ liệu khởi tạo
  res.write(`data: ${JSON.stringify({ type: 'init', status: 'connected', data: botService.getData() })}\n\n`);

  // Lắng nghe sự kiện cập nhật từ bot
  const onUpdate = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'update', data })}\n\n`);
  };

  botService.on('data:updated', onUpdate);

  // Ping giữ kết nối mỗi 20 giây
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    botService.removeListener('data:updated', onUpdate);
  });
});

// 7. API Kiểm tra sức khỏe hệ thống 24/7 (Health Check hợp nhất)
app.get('/api/health', (req, res) => {
  const data = botService.getData();
  const uptimeSec = Math.round(process.uptime());
  res.json({
    status: 'ok',
    health: 'healthy',
    mode: 'cloud-24-7',
    uptime: uptimeSec,
    uptimeSeconds: uptimeSec,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    lastCrawl: data.lastUpdated,
    stats: data.stats,
    timestamp: new Date().toISOString()
  });
});

// Fallback route cho Single Page Application (chỉ xử lý các route không chứa đuôi file)
app.get('*', (req, res) => {
  if (req.path.includes('.')) {
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Khởi động server có cơ chế tự động chuyển cổng nếu cổng 3000 bị bận
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 [MoveSafe VN] Server & Bot đã hoạt động trên PORT ${port}`);
    console.log(`🌐 Truy cập ứng dụng tại: http://localhost:${port}`);
    console.log(`📡 Bot cào dữ liệu: HSDC Hà Nội, UDi TP.HCM, VOV, TomTom`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(port) + 1;
      console.warn(`[MoveSafe] ⚠️ Cổng ${port} đang bận, tự động chuyển sang cổng ${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error('[MoveSafe] Lỗi máy chủ:', err.message);
    }
  });
}

if (require.main === module) {
  startServer(Number(config.PORT) || 3000);
}

module.exports = app;
