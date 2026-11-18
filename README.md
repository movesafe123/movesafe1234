# MoveSafe VN — Hệ thống Bản đồ Giao thông, Dẫn đường Né ngập & Trợ lý AI Gemini Thời gian thực

> **Đồ án / Sản phẩm Công nghệ Đô thị Thông minh (Data-Centric AI)**
> Hợp nhất 5 luồng dữ liệu đô thị thời gian thực tại **Hà Nội, TP. Hồ Chí Minh và Đà Nẵng**: Trạm quan trắc ngập úng (`HSDC` / `UDi Maps`), Lưu lượng giao thông & sự cố (`TomTom v5` + `VOV Giao thông`), `103` trạm thời tiết (`Open-Meteo` Nowcasting `15 phút`), `228` trạm sạc xe điện (`EVCS.VN` + `TomTom EV` + `OpenChargeMap` + `OpenStreetMap`) và Phản ánh cộng đồng realtime (`SSE` / `BroadcastChannel`).

---

## 1. Kiến trúc Data-Centric AI & 5 Luồng Dữ liệu Thời gian thực

Thay vì phụ thuộc mô hình tĩnh, MoveSafe VN lấy chất lượng, khử nhiễu và hợp nhất dữ liệu không gian làm trung tâm:

1. **Quan trắc Ngập lụt Đô thị (`HSDC Hà Nội`, `UDi Maps TP.HCM`, `Đà Nẵng`)**: Tự động cào, chuẩn hóa tọa độ, mô phỏng suy giảm độ sâu ngập theo tốc độ tiêu thoát nước (`12 cm/h`) và cho phép giả lập kịch bản mưa giông đô thị (`DEMO_FLOOD`).
2. **Giao thông & Cảnh báo Ùn tắc (`TomTom Traffic Flow & Incidents v5`, `VOV Giao thông`)**: Bộ lọc tọa độ đa tầng tự động loại bỏ các ghim sai tâm phường và ngõ nhỏ hẹp, kèm nút tìm đường vòng tránh điểm tắc trực tiếp từ thông báo VOV.
3. **Khí tượng & Nowcasting Mưa 15 Phút (`Open-Meteo API`, `OpenWeatherMap`, `NCHMF`)**: Theo dõi `103` điểm đo tại Hà Nội, TP.HCM, Đà Nẵng với biểu đồ mưa ngắn hạn từng 15 phút, chỉ số Thoải mái Đi đường (Commute Comfort Index) và dữ liệu thời tiết theo phường/xã.
4. **Mạng lưới `228` Trạm sạc & Đổi pin Xe điện (`4 Nguồn Hợp nhất`)**:
   - Hợp nhất từ `EVCS.VN (VinFast V-GREEN)`, `TomTom EV Search`, `Open Charge Map v3` và `OpenStreetMap (Overpass API + Nominatim fallback)`.
   - Thuật toán gom cụm trụ trùng trong bán kính `<= 60m`, khử trùng lặp đa tầng theo khoảng cách, hãng vận hành và ngữ nghĩa địa danh (loại bỏ tên quận/huyện khỏi token so khớp), chuẩn hóa 100% Unicode **NFC**.
   - Tách biệt rõ trạm đổi pin xe máy điện (`<= 15kW`) với trụ sạc ô tô điện; độ chính xác tìm kiếm trạm theo ngữ cảnh địa danh đạt **`98.7%`**.
5. **Báo cáo Cộng đồng Realtime (`SSE`, `BroadcastChannel`, `LocalStorage`)**: Người dân gửi điểm ngập/ùn tắc kèm mức độ ngập; sự cố xuất hiện tức thì trên mọi tab đang mở và đồng bộ lịch sử 7 ngày.

---

## 2. Các Tính năng Cốt lõi

### 2.1. Dẫn đường Né ngập Thích ứng 3 Chế độ & 7 Loại Phương tiện (`js/routing-service.js`)
Hệ thống định tuyến trên nền **OSRM** kiểm tra từng phân đoạn tọa độ với các rốn ngập đang hoạt động, xem điểm ngập vượt gầm xe là vật cản bất khả dụng và tự động bẻ đường vòng qua các hành lang cao ráo (hỗ trợ đa điểm dừng trung gian `viaWaypoint`: `+ Ghé qua` / `+ Ghé sạc`):

| Loại phương tiện | Mã nội bộ | Ngưỡng an toàn (`safeDepth`) | Ngưỡng tối đa vượt qua (`maxPassableDepth`) | Rủi ro kỹ thuật được cảnh báo |
| :--- | :---: | :---: | :---: | :--- |
| Xe tay ga | `scooter` | `10 cm` | **`18 cm`** | Ngập bộ nồi CVT, hút nước vào lọc gió |
| Xe máy xăng | `motorbike` | `10 cm` | **`20 cm`** | Nước tràn ống xả, ướt bugi chết máy |
| Xe máy điện | `ebike` | `10 cm` | **`20 cm`** | Chập mạch IC điều khiển & ngắt bảo vệ BMS |
| Ô tô Sedan gầm thấp | `sedan` | `12 cm` | **`22 cm`** | Sóng nước ngược tràn họng hút gây thủy kích |
| Ô tô xăng | `car` | `15 cm` | **`25 cm`** | Nguy cơ thủy kích tay biên & vỡ lốc máy |
| Ô tô điện | `ecar` | `15 cm` | **`30 cm`** | Mất bám bồng bềnh & ngắt rơ-le pin cao áp |
| Ô tô SUV / Bán tải | `suv` | `20 cm` | **`35 cm`** | Mất bám đường & hư hại cảm biến gầm |

- **3 Chế độ Lộ trình & Smart Contextual Default**:
  - **Mức 1 — An toàn hành lang lớn**: Ưu tiên tuyến khô ráo `0 cm` ngập và né kẹt xe tối đa.
  - **Mức 2 — Trục chính êm ái**: Cân bằng thời gian di chuyển và mức độ an toàn, đi được nước nông trong giới hạn gầm xe.
  - **Mức 3 — Nhanh thực tế**: Ngắn nhất & nhanh nhất trong nhóm tuyến hợp lệ đi được an toàn.
  - Tự động chọn **Mức 3** khi thời tiết khô ráo không ngập, và tự chuyển sang **Mức 1** khi mưa `>= 3 mm/h`, bật dự báo `+1h..+3h`, bật giả lập bão hoặc phát hiện rốn ngập trên hành trình.

### 2.2. Trợ lý AI Gemini & Spatial RAG (`js/ai-chat.js`, `server/ai-service.js`)
- Sử dụng **Google Gemini API** (`gemini-2.5-flash`, `gemini-3-flash-preview` với hedged fallback sang `gemini-2.5-flash-lite`, `gemini-flash-latest`), tự động xoay vòng key và tạm khóa cooldown khi gặp HTTP `429`/`403`, đồng thời có **Bộ não AI Không gian Cục bộ** đảm bảo luôn phản hồi đủ dữ liệu ngay cả khi hết quota hoặc offline.
- **Spatial RAG & Corridor X-Ray**: Cắt lớp nguy cơ theo khoảng cách km và thời gian ETA thực tế tới từng điểm ngập/ùn tắc trên tuyến, hiển thị Ma trận Quyết định, Chấm điểm thực địa 360° (Spatial Lens), nhập giọng nói tiếng Việt (Web Speech API) và điều khiển 2 chiều Bản đồ <-> Chatbox (`+ Ghé qua`, `Radar Pulse`, `Thử kịch bản +1h`).

### 2.3. Dự báo Ngập Cục bộ +1h..+3h & Lớp Bảo vệ Hệ thống
- **Dự báo ngập theo 3 trạm thời tiết gần nhất (`server/bot-service.js`)**: Từng điểm ngập tính tích tụ mưa theo giờ từ 3 trạm Open-Meteo lân cận kết hợp tốc độ rút nước `12 cm/h`, đồng bộ với thanh trượt `+1h`, `+2h`, `+3h` và cả chế độ Giả lập bão.
- **Trung tâm Cứu hộ Thủy kích 24/7 & Điểm Trú mưa**: Số khẩn cấp (`113`, `114`, `115`), sao chép nhanh tọa độ GPS cứu hộ và kết nối trực tiếp tới Trợ lý AI Gemini.
- **Lớp Bảo vệ Quota (`server/api-quota-guard.js`) & Cổng Kiểm toán `/system-log` (`pipeline-log.html`)**: Quản lý pool API key, dedup yêu cầu trùng và Circuit Breaker ngắt tạm thời khi dịch vụ ngoài quá tải; ghi nhận toàn bộ luồng `Input -> Process -> Output` để kiểm toán kỹ thuật.

---

## 3. Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu môi trường
- **Node.js `v18+`** (khuyến nghị `v20+` hoặc `v22+`)
- *(Tùy chọn)* **Python `3.10+`** nếu chạy microservice XGBoost ở `server-ai/`

### Bước 1: Cài đặt dependencies & cấu hình `.env`
```bash
npm install
```
Tạo tệp `.env` từ mẫu [`.env.example`](.env.example):
```env
PORT=3000

# API Keys bên ngoài (hỗ trợ xoay vòng pool nếu khai báo dạng *_KEYS cách nhau bằng dấu phẩy)
OPENWEATHER_KEY=your_openweather_api_key_here
TOMTOM_KEY=your_tomtom_api_key_here
GEMINI_KEY=your_gemini_api_key_here

# Đặt true nếu muốn bật sẵn chế độ giả lập mưa ngập thuyết trình
DEMO_FLOOD=false

# Tùy chọn đồng bộ cơ sở dữ liệu Supabase (PostgreSQL + PostGIS)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Bước 2: Khởi chạy ứng dụng & các lệnh chính
```bash
# Chạy Web Server Express & Frontend tại http://localhost:3000
npm start

# Chạy Worker Bot thu thập dữ liệu độc lập
npm run bot

# Đồng bộ mã nguồn tĩnh sang public/ (phục vụ Hosting tĩnh / GitHub Pages)
npm run sync:public

# Chạy toàn bộ bộ kiểm thử tự động & xuất tests/test-results.json
npm test
```
> *(Tùy chọn)* Chạy microservice dự báo Python FastAPI + XGBoost:
> ```bash
> cd server-ai && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
> ```
> Cổng kiểm toán luồng xử lý hệ thống truy cập tại: `http://localhost:3000/system-log` (hoặc `/pipeline-log.html`).

---

## 4. Kiến trúc Thư mục Dự án

```text
web du thi/
├── index.html                           # Giao diện bản đồ chính (Google Maps UX + Live Tactical Map)
├── pipeline-log.html                    # Cổng Kiểm toán Kỹ thuật /system-log (Input -> Process -> Output)
├── manifest.json                        # Cấu hình PWA Mobile
├── css/
│   ├── style.css                        # Giao diện responsive, Dark Mode, EV drawer, thanh trượt dự báo
│   └── pipeline-log.css                 # Style cho cổng kiểm toán /system-log
├── js/
│   ├── app.js                           # Điều phối state, tìm kiếm, lộ trình, mô phỏng & 7 phương tiện
│   ├── map-engine.js                    # Bản đồ Leaflet, lớp TomTom Traffic, marker ngập/EV/POI & Radar Pulse
│   ├── routing-service.js               # Thuật toán né ngập 3 chế độ, 7 loại xe & điểm dừng trung gian
│   ├── ai-chat.js                       # Trợ lý AI Gemini (Client Spatial RAG, Corridor X-Ray, Voice)
│   ├── geocoding-service.js             # Chuẩn hóa địa danh tiếng Việt, phân giải địa chỉ & viết tắt đô thị
│   ├── weather-service.js               # Dữ liệu thời tiết Open-Meteo & Nowcasting 15 phút
│   ├── crowdsource.js                   # Báo cáo sự cố cộng đồng & đồng bộ đa tab SSE / BroadcastChannel
│   ├── supabase-service.js              # Kết nối Supabase Cloud kèm fallback cục bộ
│   ├── pipeline-logger.js               # Ghi nhật ký kỹ thuật client gửi về /system-log
│   ├── icons.js                         # Bộ SVG icon tối giản chuẩn Lucide
│   ├── ev-stations-data.js              # Dữ liệu trạm sạc EV dùng trên frontend
│   ├── food-entertainment-data.js       # Dữ liệu POI ẩm thực, giải trí, rạp phim, nhà thuốc, cây xăng
│   └── hanoi-wards-streets.js           # Danh mục phường/xã mới & tuyến phố trọng điểm Hà Nội
├── server/
│   ├── server.js                        # Express REST API, SSE Live Stream, Rate Limiter & Proxy Bảo mật
│   ├── config.js                        # Nạp biến môi trường (.env) & pool API keys
│   ├── bot-service.js                   # Crawler HSDC/UDi/VOV/TomTom/Open-Meteo & dự báo ngập +1h..+3h
│   ├── bot-runner.js                    # Điểm chạy bot độc lập cho GitHub Actions / Cron 24/7
│   ├── ev-service.js                    # Hợp nhất 4 nguồn EV, gom cụm <= 60m & khử trùng lặp đa tầng
│   ├── ev-stations-data.js              # Nguồn dữ liệu thực địa EVCS.VN gốc
│   ├── ai-service.js                    # Backend Trợ lý AI Gemini RAG & đối chiếu ngữ cảnh
│   ├── api-quota-guard.js               # Bảo vệ quota key, xoay vòng key & Circuit Breaker HTTP 429/403
│   ├── history-service.js               # Lưu trữ & thống kê xu hướng đô thị lịch sử
│   ├── system-logger.js                 # Lưu trữ nhật ký kiểm toán /api/system-logs
│   └── web-event-service.js             # Tra cứu sự kiện đô thị & tin tức giao thông thực tế
├── server-ai/
│   ├── main.py                          # Microservice FastAPI + XGBoost dự báo ngập & lưu lượng
│   └── requirements.txt                 # Thư viện Python cho server-ai
├── data/
│   ├── ev_stations_cache.json           # Single Source of Truth (228 trạm EV chuẩn NFC)
│   ├── live_urban_cache.json            # Cache dữ liệu ngập, giao thông & thời tiết đồng bộ 24/7
│   ├── crowdsource_reports.json         # Lưu trữ báo cáo sự cố cộng đồng
│   └── history/history_summary.json     # Tổng hợp dữ liệu lịch sử đô thị
├── public/                              # Bản build đồng bộ tĩnh phục vụ Hosting / GitHub Pages
├── scripts/
│   ├── sync-public.js                   # Đồng bộ 21 tệp mã nguồn từ root sang public/
│   ├── sync_to_supabase.js              # Tiện ích đồng bộ dữ liệu lên Supabase
│   └── generate_test_report_docx.js     # Xuất báo cáo kết quả kiểm thử DOCX
├── tests/
│   ├── run-all-tests.js                 # Script chạy 8 bộ test chính thức & xuất test-results.json
│   ├── test-results.json                # Kết quả kiểm thử JSON mới nhất
│   ├── unit/                            # Unit test: routing-engine, weather-parser, user-features, web-event, optimization-18, api-quota-guard
│   ├── api/                             # Integration test REST API & bảo mật
│   ├── e2e/                             # End-to-End Browser & UI test
│   └── adaptive/                        # Kiểm thử thích ứng dự báo & né ngập
├── .github/workflows/cloud-sync-247.yml # GitHub Actions tự động cào & đồng bộ cache mỗi 30 phút
├── database.sql                         # Schema khởi tạo bảng & PostGIS trên Supabase
├── database_update_floods.sql           # Schema bảng flood_predictions trên Supabase
├── supabase_setup.sql                   # Script thiết lập lịch sử 7 ngày trên Supabase
├── render.yaml / Procfile               # Cấu hình triển khai Web Service trên Render / PaaS
└── CONG_NGHE_SU_DUNG.md                 # Phân tích chi tiết tech stack & đối chiếu lựa chọn công nghệ
```

---

## 5. Kiểm chứng Chất lượng Tự động

Hệ thống được bảo vệ bởi **9 bộ kiểm thử tự động (`104/104` ca đạt `100%` PASS)**:

| Bộ kiểm thử | Tệp kiểm thử | Kết quả |
| :--- | :--- | :---: |
| Unit: Thuật toán Dẫn đường Né ngập | `tests/unit/routing-engine.test.js` | **12 / 12 PASS** |
| Unit: Dữ liệu Khí tượng & Cảnh báo | `tests/unit/weather-parser.test.js` | **8 / 8 PASS** |
| Unit: Giao diện & Trợ lý AI Gemini | `tests/unit/user-features.test.js` | **31 / 31 PASS** |
| Unit: Tra cứu Sự kiện Web & Tin tức | `tests/unit/web-event.test.js` | **4 / 4 PASS** |
| Unit: 18 Hạng mục Tối ưu Toàn diện | `tests/unit/optimization-18.test.js` | **22 / 22 PASS** |
| Integration: Backend REST API & Bảo mật | `tests/api/server-api.test.js` | **10 / 10 PASS** |
| E2E: Trải nghiệm Người dùng & Giao diện | `tests/e2e/browser-e2e.test.js` | **7 / 7 PASS** |
| Adaptive: Dự báo Ngập & Né ngập Thích ứng | `tests/adaptive/adaptive-flood-detection.test.js` | **4 / 4 PASS** |
| Unit: Bảo vệ Quota & Key Pool (`ApiQuotaGuard`) | `tests/unit/api-quota-guard.test.js` | **6 / 6 PASS** |
| **Tổng cộng** | **`npm test` + `api-quota-guard.test.js`** | **`104 / 104 PASS (100%)`** |

Ngoài ra, bài kiểm thử tích hợp 7 bước (`node scratch/verify_all_features.js`) xác nhận toàn bộ dữ liệu `228` trạm EV sạch lỗi Unicode NFD, độ chính xác tìm trạm theo ngữ cảnh đạt **`98.7%`**, hỗ trợ đủ `7` phương tiện và đồng bộ `100%` sang `public/`.
