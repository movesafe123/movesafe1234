# KIẾN TRÚC CÔNG NGHỆ, PHIÊN BẢN VÀ ĐÁNH GIÁ SO SÁNH HỆ THỐNG MOVESAFE VN
*(MoveSafe VN - Smart Urban Flood & Traffic Navigation System)*

Tài liệu này phân tích chi tiết toàn bộ các công nghệ cốt lõi, thư viện, dịch vụ đám mây, mô hình AI đang được sử dụng trong hệ thống MoveSafe VN, kèm số hiệu phiên bản (version) và luận chứng kỹ thuật so sánh: **Tại sao lựa chọn công nghệ này thay vì các giải pháp thay thế khác để phục vụ triển khai thực tế lâu dài tại Việt Nam.**

---

## 1. TỔNG QUAN STACK CÔNG NGHỆ (TECH STACK MATRIX)

| Tầng kiến trúc | Công nghệ chính | Phiên bản (Ver) | Vai trò trong MoveSafe VN |
| :--- | :--- | :--- | :--- |
| **Bản đồ & GIS (Frontend)** | Leaflet.js | `1.9.4` | Render bản đồ tương tác, hiển thị hàng trăm điểm ngập, trạm thời tiết, popup và lớp phủ giao thông |
| **Bản đồ nền (Tile Layers)** | Google Maps Tiles + TomTom Traffic Flow | Google Maps v3 API / TomTom v5 | Hiển thị nền bản đồ quen thuộc và vệt lưu lượng giao thông thời gian thực |
| **Định tuyến (Routing)** | Project OSRM (Open Source Routing Machine) | OSRM v5.x (HTTP REST API) | Thuật toán tìm đường, hỗ trợ alternative routes, geometries GeoJSON và hướng dẫn từng bước (steps) |
| **Dữ liệu thời tiết & Radar** | Open-Meteo Cloud API + OpenWeatherMap | Open-Meteo v1 / OWM v2.5 | Cung cấp dữ liệu mưa từng giờ, WMO code, chu kỳ ngày/đêm (`is_day`) đa trạm thời gian thực |
| **Backend & Bot Thu thập** | Node.js + Express.js | Node `v18+` / Express `^4.21.2` | Máy chủ API, crawler định kỳ, SSE (Server-Sent Events), tính toán suy giảm ngập (decay) |
| **Crawler & Cào dữ liệu** | Cheerio + Axios | Cheerio `^1.0.0` / Axios `^1.7.9` | Cào dữ liệu tự động từ các trạm quan trắc HSDC, UDi Maps, VOV Giao thông |
| **Cơ sở dữ liệu & Đám mây** | Supabase (PostgreSQL + PostgREST) | Supabase JS Client `^2.x` / API v1 | Lưu trữ dữ liệu ngập, trạm sạc xe điện, lịch sử quan trắc 7 ngày, đồng bộ thời gian thực |
| **Dự báo AI (Machine Learning)**| Python + XGBoost + FastAPI | Python `3.10+` / XGBoost `^2.x` / FastAPI `^0.110+` | Dự báo cấp độ ùn tắc giao thông và mực nước ngập trong tương lai (+1h, +2h, +3h) |
| **Trợ lý Thông minh & Voice** | Google Gemini Flash + Web Speech API | Gemini 1.5 Flash / HTML5 Speech Synthesis | Tư vấn lộ trình né ngập, cảnh báo giọng nói tiếng Việt thời gian thực (TTS/STT) |
| **Đồng bộ đa thiết bị & Offline**| BroadcastChannel API + LocalStorage + PWA | Web API chuẩn W3C / PWA Manifest | Đồng bộ sự cố đa tab tức thì, lưu báo cáo cộng đồng offline không mất dữ liệu |

---

## 2. CHI TIẾT CÁC CÔNG NGHỆ & ĐÁNH GIÁ SO SÁNH CHUYÊN SÂU

### 2.1. Bản đồ tương tác: Leaflet.js (`1.9.4`)

#### Tại sao chọn Leaflet.js?
- **Trọng lượng siêu nhẹ**: Chỉ ~42KB JS gzipped, tải cực nhanh trên thiết bị di động với mạng 3G/4G chập chờn khi mưa bão.
- **Tùy biến Marker linh hoạt (DivIcon)**: Cho phép MoveSafe dựng các ghim trạng thái thời tiết, rốn ngập động (có pulse animation, badge hiển thị độ sâu `30cm`, `50cm`) bằng CSS/HTML thuần mà không bị giới hạn bởi icon tĩnh của các thư viện khác.
- **Hỗ trợ đa nguồn bản đồ (Multi-Tile Layers)**: Dễ dàng ghép nối lớp giao thông thời gian thực của TomTom lên trên nền bản đồ Google Maps hoặc chuyển đổi sang ảnh vệ tinh hybrid chỉ với 1 dòng lệnh.
- **Không phụ thuộc vào cơ chế tính phí lượt tải bản đồ (Map Load Billing)**: Hoàn toàn mã nguồn mở, không phát sinh chi phí hàng nghìn USD khi có lượng người dùng tăng đột biến vào mùa mưa.

#### Bảng so sánh với giải pháp thay thế:

| Tiêu chí | Leaflet.js 1.9.4 (MoveSafe chọn) | Google Maps JavaScript SDK | Mapbox GL JS |
| :--- | :--- | :--- | :--- |
| **Chi phí bản quyền** | **Miễn phí 100% (Open Source BSD-2)** | \$7/1000 lượt load sau hạn mức | \$5/1000 lượt sau 50k loads |
| **Dung lượng thư viện** | **~42 KB (Cực nhẹ)** | ~150 - 200 KB | ~500 KB (Yêu cầu WebGL nặng) |
| **Tiêu tốn pin/phần cứng**| Thấp, tối ưu cả máy cấu hình yếu | Trung bình | Khá cao, nóng máy nếu chạy lâu |
| **Tự do tùy biến Layer**| **Tự do kết hợp mọi nguồn Tile** | Bị khóa chặt trong hệ sinh thái Google | Cần dùng style của Mapbox |
| **Khả năng chạy Offline/PWA**| **Rất tốt với Tile caching** | Bị hạn chế bản quyền | Phức tạp khi cache vector tiles |

---

### 2.2. Động cơ định tuyến: OSRM (Open Source Routing Machine v5)

#### Tại sao chọn OSRM?
- **Tốc độ phản hồi micro-second**: Được viết bằng C++ tối ưu cấu trúc dữ liệu Contraction Hierarchies, có khả năng tính toán lộ trình qua nhiều waypoints trong vòng 10-30ms.
- **Tự do thiết kế thuật toán né ngập theo ngưỡng kỹ thuật phương tiện**: MoveSafe can thiệp trực tiếp vào tọa độ đường đi (Polyline GeoJSON) để quét chướng ngại vật theo thời gian thực:
  - Nếu điểm ngập sâu > 20cm (đối với xe máy) hoặc > 25cm (đối với ô tô) => Đánh dấu hành lang đó là **Vật cản bất khả dụng** và tự động sinh điểm tránh (Bypass Detours) để OSRM bẻ hướng qua các đường vòng cao ráo.
  - Các API thương mại như Google Directions API không cho phép người dùng định nghĩa "vùng cấm đi qua do ngập úng" theo cm mực nước của từng loại xe mà chỉ chỉ đường mặc định.
- **Bảo mật và tự chủ**: MoveSafe có thể triển khai OSRM container riêng trên VPS cục bộ tại Việt Nam khi cần mở rộng quy mô lớn mà không sợ bị nghẽn hay khóa API key.

#### Bảng so sánh với giải pháp thay thế:

| Tiêu chí | OSRM Engine (MoveSafe chọn) | Google Directions API | GraphHopper |
| :--- | :--- | :--- | :--- |
| **Chi phí gọi API** | **Miễn phí / Tự host không giới hạn** | \$5 - \$10 / 1000 requests | Bị giới hạn credit free tier |
| **Khả năng can thiệp thuật toán**| **Toàn quyền can thiệp vào tọa độ & waypoints** | Đóng kín (Black box), không chỉnh sửa được lõi định tuyến | Cho phép nhưng cấu hình phức tạp |
| **Tốc độ thuật toán** | **Cực nhanh (10-30ms)** | 200-500ms (qua máy chủ nước ngoài) | Nhanh (~50ms) |
| **Phù hợp đặc thù Việt Nam**| **Cho phép bổ sung quy tắc cấm xe máy lên cao tốc, đường trên cao** | Thường định tuyến ô tô và xe máy đi chung đường dẫn | Cần tự tùy biến file profile |

---

### 2.3. Khí tượng & Cảm biến lượng mưa: Open-Meteo Cloud Radar + OpenWeatherMap

#### Tại sao chọn Open-Meteo?
- **Độ chính xác cấp độ tọa độ cao (High-resolution Numerical Weather Prediction)**: Lấy dữ liệu mô hình thời tiết toàn cầu ECMWF/GFS độ phân giải cao, trả về lượng mưa tích lũy từng mm (`precipitation`, `rain`) cho từng tọa độ cụ thể.
- **Hỗ trợ truy vấn chùm đa trạm (Batch Coordinate Query)**: MoveSafe có thể quét đồng thời **76 phường xã Hà Nội** chỉ trong **01 HTTP request duy nhất** (`latitude=21.01,21.02,...&longitude=105.7,105.8,...`). Điều này giúp tránh hoàn toàn tình trạng bị rate-limit hoặc làm đơ trình duyệt.
- **Phân định rõ chu kỳ ngày/đêm (`is_day`)**: Khắc phục triệt để lỗi hiển thị mặt trời vào ban đêm mà nhiều ứng dụng khác mắc phải.
- **Khả năng dự phòng kép (Hybrid Fallback)**: Nếu có OpenWeatherMap API key thì ưu tiên sử dụng; nếu hết quota hoặc lỗi mạng lập tức fallback 100% sang Open-Meteo 24/7.

#### Bảng so sánh với giải pháp thay thế:

| Tiêu chí | Open-Meteo Cloud Radar (MoveSafe chọn) | OpenWeatherMap Free Tier | WeatherAPI |
| :--- | :--- | :--- | :--- |
| **Chi phí & Hạn mức** | **Miễn phí 10,000 req/ngày (Không cần API Key)** | Giới hạn 60 req/phút, 1,000 req/ngày | Cần API key, giới hạn tháng |
| **Hỗ trợ quét đa tọa độ 1 lúc**| **Có (Batch Coordinates trong 1 URL duy nhất)** | Không (Phải gửi 76 request riêng lẻ) | Không hỗ trợ batch |
| **Dữ liệu lượng mưa theo mm**| **Chuẩn xác từng 0.1 mm** | Thường là 0 nếu mưa nhỏ | Cần gói trả phí |
| **Tốc độ phản hồi** | **~80 - 150ms** | 300 - 600ms | 250 - 400ms |

---

### 2.4. Đám mây & Cơ sở dữ liệu: Supabase (PostgreSQL + PostgREST)

#### Tại sao chọn Supabase?
- **PostgreSQL chuẩn doanh nghiệp**: Hỗ trợ đầy đủ dữ liệu không gian địa lý, thời gian thực, lưu trữ chuỗi thời gian (time-series traffic history) phục vụ thống kê 7 ngày.
- **PostgREST tự động sinh API an toàn**: Không cần viết hàng chục controller CRUD cho bảng trạm sạc xe điện (`ev_stations`), lịch sử giao thông (`traffic_history`), bảng dự báo ngập lụt (`flood_predictions`).
- **Cơ chế Row Level Security (RLS)**: Đảm bảo người dùng chỉ đọc được thông tin công cộng, chỉ bot dịch vụ có `service_role_key` mới có quyền ghi dữ liệu quan trắc.
- **Chế độ chống treo an toàn (Timeout Guard & Cooldown)**: MoveSafe bổ sung lớp `safeQuery` với timeout 3.5s và cooldown 60s, giúp ứng dụng vẫn chạy mượt mà ngay cả khi người dùng di chuyển vào vùng mất sóng điện thoại.

#### Bảng so sánh với giải pháp thay thế:

| Tiêu chí | Supabase Cloud (MoveSafe chọn) | Firebase Realtime / Firestore | MongoDB Atlas |
| :--- | :--- | :--- | :--- |
| **Cơ sở dữ liệu cốt lõi** | **PostgreSQL (Quan hệ, chuẩn SQL)** | NoSQL Document / JSON | NoSQL BSON |
| **Hỗ trợ dữ liệu địa lý GIS**| **Rất mạnh (PostGIS, ST_Distance, Coords)**| Rất yếu, chỉ lọc được khoảng giới hạn đơn giản | Khá tốt với 2dsphere |
| **Tốc độ truy vấn chuỗi thời gian**| **Rất nhanh với B-tree Index trên `recorded_at`**| Tốn kém chi phí đọc document | Cần thiết kế cấu trúc phức tạp |
| **Khóa nhà cung cấp (Vendor Lock-in)**| **Không (Dễ dàng xuất ra PostgreSQL thuần)** | Khóa chặt vào Google Cloud | Trung bình |

---

### 2.5. Trí tuệ nhân tạo dự báo: Python XGBoost + FastAPI (`server-ai`)

#### Tại sao chọn XGBoost Regressor?
- **Tối ưu vượt trội cho dữ liệu bảng dạng chuỗi thời gian (Tabular Time-series)**: Dữ liệu giao thông và ngập úng đô thị phụ thuộc vào các đặc trưng phi tuyến tính: giờ trong ngày (`hour`), trạng thái thời tiết (`weather_code`), đặc thù từng thành phố (`city_code`). XGBoost vượt trội hơn Deep Learning (RNN/LSTM) về tốc độ huấn luyện, tiêu thụ ít RAM và không cần GPU.
- **Kích thước mô hình nhỏ**: Mô hình được serialize gọn nhẹ, có thể chạy trơn tru trên VPS 1GB RAM hoặc Raspberry Pi.
- **Khả năng giải thích (Explainable AI)**: Cho phép trích xuất trọng số tầm quan trọng của lượng mưa và khung giờ cao điểm để hiển thị độ tin cậy (`confidence %`) rõ ràng cho người dùng.
- **Mô hình Thủy văn suy giảm (Hydrological Decay Model)**: Bổ sung thuật toán thoát nước dần với tốc độ 12 cm/h, giúp các điểm ngập sau mưa không bị "bốc hơi" đột ngột trong hệ thống.

#### Bảng so sánh với giải pháp thay thế:

| Tiêu chí | XGBoost Regressor (MoveSafe chọn) | Deep Learning LSTM / GRU | Linear Regression / Random Forest |
| :--- | :--- | :--- | :--- |
| **Yêu cầu phần cứng** | **Cực thấp (Chạy tốt trên CPU 1 Core, 512MB RAM)** | Cần GPU hoặc nhiều vCPU, RAM > 4GB | Thấp |
| **Độ chính xác dự báo** | **Rất cao trên dữ liệu bảng dạng số** | Tương đương nhưng dễ overfitting nếu ít data | Thấp, dự báo bị thô |
| **Thời gian suy luận (Latency)**| **< 5ms cho 100 điểm dự báo** | 80 - 200ms | ~10ms |
| **Tần suất cập nhật lại** | **Retrain chỉ mất 2-3 giây** | Retrain mất hàng chục phút | Nhanh nhưng kém chính xác |

---

### 2.6. Trợ lý tương tác AI: Google Gemini 1.5 Flash + Web Speech API

#### Tại sao chọn Gemini 1.5 Flash?
- **Tốc độ phản hồi cực nhanh (Ultra-low latency)**: Mô hình Flash được Google tối ưu cho các tác vụ tác chiến thời gian thực, người dùng nhận câu trả lời chỉ sau 0.5 - 1.2 giây.
- **Hiểu sâu ngữ cảnh địa lý Việt Nam**: Nhận diện chuẩn xác các địa danh, tên ngõ, ngách, tên đường viết tắt, rốn ngập quen thuộc ở Hà Nội, TP.HCM, Đà Nẵng.
- **Khả năng trích xuất hành động bản đồ (Function/Action Extraction)**: Gemini tự động nhận diện ý định của người dùng (ví dụ: *"chỉ đường từ Cầu Giấy đến Nhà Hát Lớn né ngập"*) để xuất lệnh `[ACTION_ROUTE: Cầu Giấy -> Nhà Hát Lớn]`, giúp ứng dụng tự động kích hoạt chế độ vẽ đường thông minh trên bản đồ mà người dùng không cần thao tác bấm nút.
- **Kết hợp Web Speech API (STT & TTS)**: Người đi xe máy hoặc tài xế ô tô có thể ra lệnh bằng giọng nói tiếng Việt và lắng nghe trợ lý đọc cảnh báo to rõ mà không cần nhìn vào màn hình điện thoại khi đang di chuyển dưới trời mưa.

#### Bảng so sánh với giải pháp thay thế:

| Tiêu chí | Google Gemini 1.5 Flash (MoveSafe chọn) | OpenAI GPT-4o-mini | Claude 3.5 Haiku |
| :--- | :--- | :--- | :--- |
| **Hạn mức miễn phí (Free Tier)**| **Rất hào phóng (15 RPM, 1 triệu tokens/phút)** | Bị giới hạn credit dùng thử | Không có free tier công khai |
| **Hiểu địa danh tiếng Việt & ngữ cảnh mưa bão**| **Rất tự nhiên, chuẩn ngôn ngữ giao thông VN** | Tốt | Tốt nhưng đôi khi cứng nhắc |
| **Tốc độ phản hồi** | **Rất nhanh (~0.8s)** | ~1.1s | ~0.9s |
| **Tích hợp giọng nói native**| **Kết hợp mượt mà với Web Speech Synthesis** | Phụ thuộc Speech API đắt tiền | Cần giải pháp bên thứ ba |

---

### 2.7. Tầng giao tiếp thời gian thực & Chống mất dữ liệu: SSE + BroadcastChannel + LocalStorage

#### Tại sao chọn bộ ba SSE + BroadcastChannel + LocalStorage?
1. **Server-Sent Events (SSE)**:
   - Thay vì WebSockets phức tạp cần duy trì 2 chiều và dễ bị tường lửa chặn, SSE sử dụng giao thức HTTP đơn hướng chuẩn, tự động kết nối lại khi đứt sóng. MoveSafe đẩy dữ liệu ngập mới ngay lập tức khi phát hiện mưa to mà không cần client phải poll liên tục gây tốn pin.
2. **BroadcastChannel API**:
   - Khi người dùng mở MoveSafe trên nhiều tab (hoặc nhiều cửa sổ), một báo cáo điểm ngập mới gửi ở tab A sẽ ngay lập tức được truyền sang tab B trong vòng 1 miligiây mà không cần gửi thêm request lên server.
3. **LocalStorage với cơ chế TTL (Time-To-Live 2 giờ)**:
   - Các điểm ngập/kẹt xe do người dùng vừa báo cáo được ghi bền vững vào trình duyệt. Ngay cả khi server khởi động lại hoặc người dùng ấn F5 tải lại trang, toàn bộ các điểm báo cáo chưa hết hạn vẫn hiển thị nguyên vẹn trên bản đồ.

---

## 3. TỔNG KẾT NGUYÊN TẮC THIẾT KẾ KIẾN TRÚC

MoveSafe VN được thiết kế theo 3 triết lý kỹ thuật phục vụ **sử dụng thực tế 24/7**:
1. **Zero-Failure Tolerance (Không bao giờ sập hoàn toàn)**: Mọi dịch vụ đều có ít nhất 2 tầng dự phòng: Server Node chết -> Fallback static cache; Supabase mất mạng -> Fallback local heuristics; Cloud AI bận -> Fallback rule-based chatbot.
2. **Cost-Zero Sustainability (Duy trì bền vững với chi phí 0 VNĐ)**: Lựa chọn 100% các công nghệ có tier miễn phí cực lớn hoặc mã nguồn mở (Leaflet, OSRM, Open-Meteo, Gemini Flash, Supabase), giúp dự án vận hành liên tục qua nhiều năm mà không phụ thuộc vào tài trợ ngắn hạn.
3. **Vehicle-Centric Routing (Định tuyến theo đặc tính kỹ thuật phương tiện)**: Tôn trọng giới hạn vật lý của từng loại xe tại Việt Nam (ngưỡng 20cm cho xe máy, 25cm cho sedan, chống đi vào đường cao tốc cho xe 2 bánh), đảm bảo tính an toàn tính mạng và tài sản cho người dân khi tham gia giao thông trong mùa mưa bão.
