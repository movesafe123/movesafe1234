# Kế Hoạch Sửa Lỗi & Nâng Cấp Thực Chiến MoveSafe VN (Production Implementation Plan)

> [!IMPORTANT]
> Tài liệu này được viết dưới dạng **Đặc tả Kỹ thuật Thực thi (Executable Technical Specification)** dành cho AI Model hoặc Lập trình viên. Mọi hạng mục đều chỉ rõ **File mục tiêu**, **Vị trí dòng code/hàm**, **Nguyên nhân lỗi**, **Logic code cần viết** và **Tiêu chí nghiệm thu**.
> 
> **Quy tắc bắt buộc khi thực thi:**
> 1. Thực hiện lần lượt theo thứ tự từ **Task 1 đến Task 12**.
> 2. Sau khi sửa bất kỳ file nào trong `index.html`, `css/style.css`, hoặc `js/*.js`, phải đồng bộ sang thư mục `public/` (xem **Task 12**).
> 3. Giữ nguyên cấu trúc biến toàn cục (`window.appState`, `window.mapEngine`, `window.routingService`, `window.weatherService`, `window.supabaseService`, `window.crowdsourceService`, `window.aiChat`) để đảm bảo tính tương thích.

---

## DANH SÁCH CÁC HẠNG MỤC THỰC THI CHI TIẾT

---

### TASK 1: Bảo mật Hạ tầng, Sửa Rate Limiter Proxy & Đồng bộ Dự báo ở Backend (`server/server.js`)

* **File mục tiêu:** `server/server.js`
* **Vấn đề hiện tại:**
  1. Dòng `9-13`: Chưa bật `app.set('trust proxy', 1)`. Khi chạy thực tế sau Reverse Proxy (Render, Cloudflare, Nginx), `req.ip` của mọi người dùng đều giống nhau -> chỉ cần 1 người hỏi AI 20 lần hoặc gửi 6 báo cáo là toàn bộ người dùng cả nước bị chặn HTTP 429.
  2. Dòng `109-120`: Endpoint `GET /api/config` đang trả thẳng `openweather: config.API_KEYS.OPENWEATHER` ra ngoài trình duyệt.
  3. Thiếu API tính toán/trả về dự báo tương lai (`GET /api/predictions`) và API bình chọn xác thực báo cáo cộng đồng (`POST /api/crowdsource/vote`).
* **Cách thực hiện chi tiết:**
  1. **Tại dòng 10 (ngay sau `const app = express();`):**
     Thêm cấu hình tin cậy Proxy:
     ```javascript
     app.set('trust proxy', 1);
     ```
  2. **Tại hàm `createRateLimiter` (dòng 52):**
     Tách lấy IP đầu tiên trong chuỗi `x-forwarded-for`:
     ```javascript
     const forwarded = req.headers['x-forwarded-for'];
     const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.ip || req.socket.remoteAddress || 'unknown';
     ```
  3. **Tại `GET /api/config` (dòng 109-120):**
     Giữ `tomtom` (vì client cần tải map tiles trực tiếp) nhưng thêm cờ `hasOpenWeather: !!config.API_KEYS.OPENWEATHER`.
  4. **Thêm Endpoint `POST /api/crowdsource/vote` (ngay sau dòng 183):**
     ```javascript
     app.post('/api/crowdsource/vote', reportLimiter, (req, res) => {
       try {
         const { id, voteType } = req.body || {};
         if (!id || !['confirm', 'clear'].includes(voteType)) {
           return res.status(400).json({ status: 'error', message: 'Tham số bình chọn không hợp lệ' });
         }
         const result = botService.voteCrowdsourceReport(String(id), voteType);
         if (!result) {
           return res.status(404).json({ status: 'error', message: 'Không tìm thấy báo cáo sự cố' });
         }
         res.json({ status: 'success', report: result });
       } catch (err) {
         res.status(500).json({ status: 'error', message: err.message });
       }
     });
     ```
  5. **Thêm Endpoint `GET /api/predictions` (ngay sau `/api/history` ở dòng 138):**
     ```javascript
     app.get('/api/predictions', (req, res) => {
       const city = req.query.city || 'hanoi';
       const offset = Math.min(3, Math.max(1, parseInt(req.query.offset, 10) || 1));
       const predictions = botService.getFuturePredictions(city, offset);
       res.json({ status: 'success', ...predictions });
     });
     ```
* **Tiêu chí nghiệm thu:** Gọi `GET /api/predictions?city=hanoi&offset=1` trả về JSON hợp lệ; `POST /api/crowdsource/vote` cập nhật được số lượt vote.

---

### TASK 2: Nâng cấp Mô hình Thủy văn Tích lũy (Drainage Decay), Gộp tin VOV & Xác thực Cộng đồng (`server/bot-service.js`)

* **File mục tiêu:** `server/bot-service.js`
* **Vấn đề hiện tại:**
  1. Dòng `1024-1123` (`computeRealtimeFloodPoints`): Chỉ nhìn lượng mưa tức thời `rain1h`. Khi mưa vừa ngớt (`rain1h < 10mm`), lập tức trả về `depth_cm: 0` (khô ráo), trái với thực tế nước cần 1–3 giờ để rút.
  2. Dòng `496-558` (`crawlVOVTraffic`): Đã bóc tách được `detectedLocation` từ bản tin VOV nhưng không đưa vào `trafficIncidents` nên bản đồ và bộ định tuyến không biết điểm tắc đó.
  3. Dòng `872-937` (`addCrowdsourceReport`): Khi báo cáo là `traffic_jam` hoặc `hazard`, vẫn lấy `depthVal` để tính `danger_level`, `passable_motorbike`, `passable_car`. Thiếu cơ chế cộng đồng xác nhận (`confirm` / `clear`).
  4. Dòng `940-1021` (`crawlWeatherStations`): Ghi đè mọi trạng thái không mưa thành `☀️ Trời tạnh ráo` kể cả ban đêm, và chưa lấy dữ liệu mưa dự báo 3 giờ tới (`hourly=precipitation,rain`).
* **Cách thực hiện chi tiết:**
  1. **Thêm bộ nhớ trạng thái ngập trong `constructor()` (dòng 332):**
     ```javascript
     this.floodMemory = new Map(); // Lưu { depth_cm, updatedMs } cho từng trạm để tính tiêu thoát nước từ từ
     ```
  2. **Cập nhật `crawlWeatherStations(cityKey)` (dòng 940-1021):**
     * Đổi URL Open-Meteo (dòng 947) để lấy thêm `is_day` và dự báo `hourly` trong 6 giờ tới:
       ```javascript
       const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,is_day&hourly=precipitation,rain&forecast_hours=6&timezone=Asia%2FBangkok`;
       ```
     * Trích xuất dự báo lượng mưa 1h, 2h, 3h tới từ `item.hourly?.precipitation` hoặc `item.hourly?.rain`:
       ```javascript
       const hourlyRain = item.hourly?.precipitation || item.hourly?.rain || [];
       const forecastRain = [
         Math.round((hourlyRain[1] || 0) * 10) / 10,
         Math.round((hourlyRain[2] || 0) * 10) / 10,
         Math.round((hourlyRain[3] || 0) * 10) / 10
       ];
       const isDay = curr.is_day !== 0;
       ```
     * Sửa biểu tượng thời tiết khi `rain === 0`: Nếu `!isDay` dùng `🌙` (`Đêm tạnh ráo, quang mây`), nếu `curr.weather_code >= 45 && curr.weather_code <= 48` dùng `🌫️` (`Sương mù nhẹ`), nếu `curr.weather_code >= 2 && curr.weather_code <= 3` dùng `⛅`/`☁️` (`Có mây, tạnh ráo`), chỉ khi ban ngày trời quang mới dùng `☀️`.
     * Lưu `isDay` và `forecastRain` vào từng object station.
  3. **Nâng cấp `computeRealtimeFloodPoints` (dòng 1024-1123) với thuật toán Tích lũy & Tiêu thoát nước:**
     * Với mỗi trạm `st` trong `LOCAL_FLOOD_STATIONS`:
       * Lấy trạng thái cũ: `const prev = this.floodMemory.get(st.id) || { depth_cm: 0, updatedMs: Date.now() };`
       * Tính khoảng thời gian trôi qua (giờ): `const elapsedHours = Math.max(0, (Date.now() - prev.updatedMs) / 3600000);`
       * Tốc độ rút nước của trạm bơm/cống: `const drainageRate = 12;` (rút 12 cm mỗi giờ khi ngớt mưa).
       * Tính độ sâu mục tiêu từ lượng mưa hiện tại `localRain` và lấy `Math.max(targetDepth, Math.round(prev.depth_cm - drainageRate * elapsedHours))`. Nếu `< 5cm` thì gán `0`.
       * Cập nhật lại `this.floodMemory.set(st.id, { depth_cm: finalDepth, updatedMs: Date.now() })`.
  4. **Chuyển hóa tin VOV có địa điểm thành sự cố trên bản đồ (trong `crawlAll()`, sau dòng 413):**
     * Duyệt `this.cachedData.vovTrafficNews`: Với mỗi bài tin có `detectedLocation` và tiêu đề chứa từ khóa ùn tắc (`ùn`, `tắc`, `kẹt`, `chậm`, `đông`, `va chạm`, `tai nạn`), nếu trong bán kính 300m quanh `detectedLocation` chưa có incident TomTom nào thì đẩy thêm một incident `id: 'vov-inc-' + news.id` vào `this.cachedData.trafficIncidents`.
  5. **Sửa `addCrowdsourceReport(report)` (dòng 872-937) và thêm `voteCrowdsourceReport(id, voteType)`:**
     * Trong `addCrowdsourceReport`:
       * Lọc bỏ thẻ HTML trong `report.locationName`, `report.note`, `report.userName`: `.replace(/[<>]/g, '')`.
       * Nếu `rType !== 'flood'`, gán `depth_cm: 0`, `passable_motorbike: true`, `passable_car: rType !== 'road_closure'`.
       * Thêm trường `confirmations: 1`, `clearVotes: 0`, `isVerified: false`.
     * Thêm phương thức `voteCrowdsourceReport(id, voteType)`:
       * Tìm báo cáo trong `CROWDSOURCE_FILE`, `this.cachedData.floodPoints` và `this.cachedData.trafficIncidents`.
       * Nếu `voteType === 'confirm'`, tăng `confirmations++`; nếu `confirmations >= 2` thì `isVerified = true`.
       * Nếu `voteType === 'clear'`, tăng `clearVotes++`; nếu `clearVotes >= 2` và `clearVotes >= confirmations`, xóa báo cáo đó khỏi danh sách đang hoạt động.
       * Lưu lại file cache và phát sự kiện `this.emit('data:updated', this.cachedData)`.
  6. **Thêm phương thức `getFuturePredictions(city, offsetHours)` trong `LocalUrbanBot`:**
     * Dựa vào `forecastRain[offsetHours - 1]` của các trạm thời tiết trong thành phố `city` và mực nước hiện tại:
       * Nếu hiện tại không ngập (`depth_cm === 0`) VÀ dự báo mưa ở giờ `+offsetHours` nhỏ hơn `5mm`, trả về `floods: []` (0 điểm ngập).
       * Nếu có mưa dự báo >= 5mm hoặc hiện đang ngập chưa rút hết, tính toán độ sâu dự kiến theo công thức tích lũy mưa trừ tiêu thoát (`12cm/h`).
       * Với dự báo giao thông (`traffic`): Tính theo khung giờ mục tiêu `targetHour = (vnHour + offsetHours) % 24` kết hợp lượng mưa dự báo.
* **Tiêu chí nghiệm thu:** Khi trời nắng ráo (mưa 0mm, dự báo 0mm), gọi `getFuturePredictions('hanoi', 1)` trả về `floods: []`. Khi báo cáo sự cố được vote `clear` 2 lần, sự cố tự động biến mất khỏi bản đồ.

---

### TASK 3: Sửa lỗi Hiển thị Thời tiết Ngày/Đêm & Mã Khí tượng WMO (`js/weather-service.js`)

* **File mục tiêu:** `js/weather-service.js`
* **Vấn đề hiện tại:**
  * Dòng `76-77`, `100-103`, `177-180`: Khi `rain === 0`, code ghi đè cứng `desc = 'Trời tạnh ráo, không mưa'` và `icon = '☀️'`, khiến ban đêm (19h–5h sáng) hoặc trời âm u vẫn hiển thị mặt trời `☀️`.
* **Cách thực hiện chi tiết:**
  1. Tại dòng `90` (`getWeather`) và dòng `153` (`getMultiStationWeather`), thêm tham số `is_day` vào query `current=...` của Open-Meteo.
  2. Sửa hàm `getWmoDescription(code, isDay = true)` và `getWmoIcon(code, isDay = true)` (dòng `288-306`) để phân biệt ngày (`☀️`, `⛅`) và đêm (`🌙`, `☁️`), sương mù (`🌫️`), nhiều mây (`☁️`).
  3. Tại dòng `100-103` và `177-180`: Khi `rain === 0`, giữ nguyên icon/mô tả không mưa từ `getWmoIcon(code, isDay)` và `getWmoDescription(code, isDay)` thay vì gán cứng `☀️`.
* **Tiêu chí nghiệm thu:** Buổi tối (sau 18h) các trạm thời tiết không mưa hiển thị icon mặt trăng `🌙` hoặc mây `☁️`, không còn hiện mặt trời `☀️`.

---

### TASK 4: Sửa lỗi Dự báo Ngập Ảo khi Trời Nắng & Tự Phục hồi Kết nối Supabase (`js/supabase-service.js`)

* **File mục tiêu:** `js/supabase-service.js`
* **Vấn đề hiện tại:**
  1. Dòng `69`: Trong `safeQuery()`, khi gặp lỗi mạng 1 lần, `this.isOnline = false` bị khóa vĩnh viễn cho tới khi F5.
  2. Dòng `152-196` (`getFloodPredictions`): Luôn trả về các điểm ngập 21–38cm ở `+1h, +2h, +3h` ngay cả khi trời đang nắng khô ráo.
  3. Dòng `112-149` (`getTrafficPrediction`): Chưa xét giờ thực tế của mốc dự báo (`currentHour + offsetHours`).
* **Cách thực hiện chi tiết:**
  1. **Cơ chế tự phục hồi kết nối (Auto-Retry Cooldown) trong `safeQuery()` (dòng 55-73):**
     * Thay `this.isOnline = false` bằng `this.offlineUntil = Date.now() + 60000;` (tạm ngưng 60 giây rồi tự động thử lại).
  2. **Ưu tiên gọi API `/api/predictions` từ Backend trong `getTrafficPrediction` & `getFloodPredictions`:**
     * Trước khi gọi Supabase hoặc fallback, gọi `fetch('/api/predictions?city=' + city + '&offset=' + offsetHours)`.
  3. **Sửa logic Fallback của `getFloodPredictions(offsetHours, city)` (dòng 168-195):**
     * Kiểm tra `isSimulationMode`, `currentFloods.length`, và `maxRain`. Nếu trời khô ráo, không ngập và không bật giả lập -> trả về `[]` (0 điểm ngập).
     * Nếu đang có ngập (hoặc đang bật giả lập), tính toán mức nước rút dần từ chính danh sách `currentFloods` hiện tại (`depth * Math.pow(0.75, offsetHours)`).
  4. **Sửa logic Fallback của `getTrafficPrediction(offsetHours, city)` (dòng 139-148):**
     * Tính giờ mục tiêu theo múi giờ Việt Nam `vnHour = (new Date().getUTCHours() + 7 + offsetHours) % 24` để dự báo chuẩn giờ cao điểm sáng/chiều và ban đêm.
* **Tiêu chí nghiệm thu:** Ở chế độ Dữ liệu thật khi trời không mưa (0 rốn ngập), kéo thanh trượt sang `+1h`, `+2h`, `+3h` bản đồ không sinh ra rốn ngập ảo.

---

### TASK 5: Nâng cấp Động cơ Định tuyến Thực chiến (`js/routing-service.js`)

* **File mục tiêu:** `js/routing-service.js`
* **Vấn đề hiện tại:**
  1. Bắn 9 requests cùng lúc tới `router.project-osrm.org` mỗi lần tìm đường, kể cả khi đường thẳng hoàn toàn không có điểm ngập hay kẹt xe.
  2. Dẫn xe máy (`motorbike`, `ebike`) đi vào đường cao tốc / đường vành đai trên cao cấm xe máy.
  3. Chặn nhầm đường trên cao của ô tô khi đường bên dưới gầm cầu bị ngập, và bán kính chặn `200m–250m` quá rộng làm chặn luôn các con phố khô ráo nằm song song.
  4. Chưa lọc ngõ hẹp cho ô tô (`allowAlleys: false` bị bỏ không).
  5. Khi chỉ có 1 tuyến đường khả dụng, `buildThreePassableModes` nhân bản tuyến đó thành 3 thẻ giống hệt nhau.
* **Cách thực hiện chi tiết:**
  1. **Giảm `corridorBuffer` về mức thực tế đô thị (dòng 27, 39, 51, 63):**
     * Đổi `corridorBuffer` của `motorbike`/`ebike` xuống `110` (mét), của `car`/`ecar` xuống `130` (mét).
  2. **Thêm Bộ nhớ đệm OSRM (`this.routeCache`) trong `constructor()` (dòng 18):**
     * Lưu cache tuyến đường theo cặp tọa độ `origin -> destination` trong 3 phút để đổi phương tiện hoặc đổi mức độ tránh né phản hồi trong 0ms.
  3. **Kiểm tra Luật Giao thông Đường bộ cho Xe máy & Ô tô (`checkVehicleRoadRestrictions`):**
     * Nếu là `motorbike` hoặc `ebike`, kiểm tra `route.steps` để chặn các tuyến đi qua `/cao tốc|vành đai 3 trên cao|vành đai 2 trên cao|đường trên cao|pháp vân\s*-\s*cầu giẽ|hà nội\s*-\s*hải phòng/i`.
     * Nếu là `car` hoặc `ecar` (`!specs.allowAlleys`), cộng điểm phạt lớn cho các tuyến đi xuyên ngõ/ngách/hẻm nhỏ (`/^(ngõ|ngách|hẻm|kiệt)\s+/i`), và miễn trừ các điểm ngập mặt đất nếu xe đang đi trên đường vành đai trên cao.
  4. **Chỉ gọi OSRM Detour khi thực sự cần thiết (`calculateMultiRoutes`, dòng 557-583):**
     * Sau khi lấy `directRoutes`, kiểm tra xem tuyến chính có gặp điểm ngập (`blockedFloods`, `cautionFloods`), kẹt cứng (`blockedTraffics`) hoặc vi phạm đường cấm xe máy không. Nếu tuyến trực tiếp hoàn toàn khô ráo và hợp lệ, **không gọi thêm 8 requests detour**.
  5. **Loại bỏ thẻ trùng lặp trong `buildThreePassableModes` (dòng 410-523):**
     * Loại bỏ các tuyến có cùng `polyline` / cùng khoảng cách để không hiển thị 3 thẻ giống hệt nhau; nếu chỉ có 1 tuyến tối ưu duy nhất đạt cả 3 tiêu chí, hiển thị rõ nhãn `"🛡️⚡ Tuyến Tối Ưu Nhất (Khô ráo 100% & Nhanh nhất)"`.
* **Tiêu chí nghiệm thu:** Tìm đường lúc bình thường chỉ tốn 1 request OSRM; đổi mức tránh né không gọi lại OSRM; xe máy không bị dẫn lên Vành đai 3 trên cao.

---

### TASK 6: Sửa lỗi Đóng Popup mỗi 30 giây, Lọc XSS & Thêm Nút Bình chọn Cộng đồng (`js/map-engine.js`)

* **File mục tiêu:** `js/map-engine.js`
* **Vấn đề hiện tại:**
  1. Dòng `327` (`renderFloodPoints`) và dòng `405` (`renderTrafficIncidents`): Gọi `clearLayers()` mỗi lần cập nhật dữ liệu (30 giây/lần), làm đóng sập Popup mà người dùng đang mở xem.
  2. Dòng `40-49`: Dùng tile Google Maps (`mt0.google.com`) chưa có cơ chế tự chuyển sang CartoDB/OSM nếu Google chặn IP.
  3. Chưa escape HTML trong nội dung Popup và chưa có nút bình chọn xác thực cộng đồng.
* **Cách thực hiện chi tiết:**
  1. Thêm hàm `escapeHtml(str)` vào `MapEngine` và áp dụng cho mọi dữ liệu động trong `popupHtml`.
  2. Thêm sự kiện `tileerror` trên `baseStandard` để tự động chuyển sang CartoDB Voyager nếu tile Google lỗi liên tiếp.
  3. Thay thế `clearLayers()` trong `renderFloodPoints` và `renderTrafficIncidents` bằng cơ chế đối chiếu theo `id` (`this._floodLayerMap` và `this._trafficLayerMap`): chỉ xóa marker đã biến mất, thêm marker mới và cập nhật nội dung popup của marker hiện có mà **không đóng popup đang mở**.
  4. Thêm 2 nút tương tác cộng đồng (`👍 Vẫn ngập/tắc` và `✅ Đã rút/thông thoáng`) vào Popup để gọi `window.crowdsourceService.voteReport(id, 'confirm' | 'clear')`.
* **Tiêu chí nghiệm thu:** Mở Popup trên bản đồ, đợi qua chu kỳ 30s, Popup vẫn giữ nguyên trạng thái mở.

---

### TASK 7: Lưu trữ Bền vững Báo cáo Cộng đồng & Bình chọn Xác thực (`js/crowdsource.js`)

* **File mục tiêu:** `js/crowdsource.js`
* **Cách thực hiện chi tiết:**
  1. Lưu các báo cáo cộng đồng vào `localStorage` (`movesafe_crowd_reports`, tự hết hạn sau 2 giờ) để không bị xóa mất khi trang web đồng bộ định kỳ hoặc khi chạy ở chế độ tĩnh.
  2. Sửa `submitReport(formData)` để gán `depth_cm: 0` khi `formData.type !== 'flood'`.
  3. Thêm hàm `voteReport(reportId, voteType)` gọi `POST /api/crowdsource/vote` và cập nhật trực tiếp trạng thái trên bản đồ kèm chống spam vote trùng trên cùng trình duyệt.
* **Tiêu chí nghiệm thu:** Báo cáo cộng đồng giữ nguyên sau khi đồng bộ 30s hoặc F5; bấm vote cập nhật ngay số lượt xác nhận.

---

### TASK 8: Nâng cấp Giao diện Báo cáo Sự cố, Bảng Lịch sử 7 Ngày & Tin VOV (`index.html` & `css/style.css`)

* **File mục tiêu:** `index.html`, `css/style.css`
* **Cách thực hiện chi tiết:**
  1. Trong `#gm-chips-scroll` (`index.html`), thêm chip `#chip-urban-insights` (`📊 Xu hướng 7 ngày & VOV`).
  2. Trong `#modal-report` (`index.html`), bọc trường chọn độ sâu ngập vào `#group-report-depth` (tự động ẩn khi chọn Kẹt xe / Sự cố đường) và thêm 2 nút định vị nhanh: `🎯 Vị trí GPS của tôi` (`#btn-report-use-gps`) và `🗺️ Chấm trên bản đồ` (`#btn-report-pick-map`).
  3. Thêm Modal `#modal-urban-insights` hiển thị biểu đồ xu hướng vận tốc/lượng mưa 7 ngày qua (từ API `/api/history`) và danh sách bản tin VOV Giao thông (`vovTrafficNews`).
  4. Bổ sung CSS cho `#modal-urban-insights`, biểu đồ 7 ngày và thanh trạng thái dẫn đường Live GPS trong `css/style.css`.
* **Tiêu chí nghiệm thu:** Các modal mới hiển thị đẹp, chuẩn responsive trên cả máy tính và điện thoại.

---

### TASK 9: Tối ưu Đồng bộ SSE, Chế độ Dẫn đường Live GPS (Voice Alert) & Kết nối UI (`js/app.js`)

* **File mục tiêu:** `js/app.js`
* **Cách thực hiện chi tiết:**
  1. Trong `fetchLiveData()`, gộp các báo cáo còn hiệu lực từ `window.crowdsourceService.getLocalReports()` để không làm mất báo cáo của người dùng.
  2. Trong `connectCloudStream()` & `syncFromCloud()`, đánh dấu `this.isSseConnected = true` khi SSE hoạt động để tắt việc gọi lặp `/api/live-data` mỗi 30 giây.
  3. Tự động ẩn chip `#chip-hanoi-streets` khi người dùng chuyển thành phố sang TP.HCM hoặc Đà Nẵng.
  4. Kết nối sự kiện ẩn/hiện `#group-report-depth`, nút `#btn-report-use-gps`, `#btn-report-pick-map` trong `#modal-report`.
  5. Thêm hàm `openUrbanInsightsModal()` tải dữ liệu từ `window.supabaseService.getHistoricalTrends(this.currentCity, 7)` và `this.liveData.vovTrafficNews` để hiển thị lên `#modal-urban-insights`.
  6. Thêm tính năng **Dẫn đường Thực chiến Live GPS (`toggleLiveNavigation`, `startLiveNavigation`, `stopLiveNavigation`)**:
     * Thêm nút `"🧭 Bắt đầu dẫn đường (Live GPS)"` trên thẻ lộ trình đang chọn.
     * Sử dụng `navigator.geolocation.watchPosition` để cập nhật vị trí xe di chuyển trên bản đồ và tự động phát giọng nói tiếng Việt (`window.speechSynthesis`) cảnh báo sớm khi xe tiến vào bán kính `450m` trước điểm ngập hoặc điểm ùn tắc.
* **Tiêu chí nghiệm thu:** Toàn bộ tính năng mới trên UI hoạt động mượt mà, không phát sinh lỗi Console.

---

### TASK 10: Nâng cấp Trợ lý AI Render Markdown An toàn & Đọc Giọng nói (`js/ai-chat.js`)

* **File mục tiêu:** `js/ai-chat.js`
* **Cách thực hiện chi tiết:**
  1. Trong `renderMessages()`, lọc ký tự HTML (`escapeHtml`), chuyển đổi Markdown (`**đậm**`, `*nghiêng*`, danh sách `•`, xuống dòng `\n` -> `<br>`).
  2. Thêm nút `🔊 Đọc to` (`speakMessage(index)`) trên mỗi tin nhắn của AI để người đang lái xe có thể nghe tư vấn bằng giọng nói tiếng Việt mà không cần nhìn màn hình.
* **Tiêu chí nghiệm thu:** Tin nhắn AI hiển thị đẹp, rõ từng dòng và bấm nút `🔊` phát âm thanh tiếng Việt.

---

### TASK 11: Sửa lỗi nạp `.env` trong `server-ai/main.py` & Đồng bộ Đà Nẵng trong `scripts/sync_to_supabase.js`

* **File mục tiêu:** `server-ai/main.py`, `scripts/sync_to_supabase.js`
* **Cách thực hiện chi tiết:**
  1. Trong `server-ai/main.py`: Thêm bộ đọc file `.env` từ thư mục gốc trước khi khởi tạo Supabase client; sửa logic dự báo ngập khi `w_code == 0` trả về `0cm` thay vì nhân `0.85`.
  2. Trong `scripts/sync_to_supabase.js`: Bổ sung đồng bộ `activeFloodSpots` và `weather_condition` cho Đà Nẵng (`s.danang`).
* **Tiêu chí nghiệm thu:** Cả 2 script chạy độc lập thành công không lỗi.

---

### TASK 12: Cấu hình PWA (`manifest.json`), Đồng bộ `public/` & Kiểm thử Toàn diện

* **File mục tiêu:** `manifest.json`, `server/server.js`, `public/*`
* **Cách thực hiện chi tiết:**
  1. Tạo `manifest.json` và nhúng vào `index.html` để hỗ trợ cài đặt PWA trên điện thoại iOS/Android.
  2. Copy đồng bộ toàn bộ `index.html`, `manifest.json`, `css/style.css`, và `js/*.js` sang thư mục `public/`.
  3. Chạy `node --check` trên tất cả các file `.js` và kiểm tra các API endpoints (`/api/config`, `/api/live-data`, `/api/predictions`, `/api/history`, `/api/crowdsource/report`, `/api/crowdsource/vote`).
* **Tiêu chí nghiệm thu:** 100% file hợp lệ, đồng bộ hoàn toàn giữa thư mục gốc và `public/`.
