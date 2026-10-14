# MoveSafe VN - Cổng Thông Tin Giao Thông & Dẫn Đường Né Ngập Thông Minh (AI Realtime)

> **Dự án Web Dự Thi Sáng Tạo & Đề Án Công Nghệ Đô Thị Thông Minh**  
> Tích hợp Thời Tiết • Quan Trắc Ngập Lụt HSDC/UDi Maps • Lưu Lượng Kẹt Xe TomTom Traffic • Dẫn Đường Né Rốn Ngập • Trợ Lý AI Thời Gian Thực • Mạng Lưới Trạm Sạc Xe Điện (EV).

---

## 🌟 Điểm Nhấn Sáng Tạo (Key Features)

1. **Giao Diện Kép Độc Đáo (Dual-Mode UX)**:
   - **Chế độ Google Portal (Tối Giản & Thông Minh)**: Thanh tìm kiếm phong cách Google hỗ trợ ngôn ngữ tự nhiên, tìm đường né ngập, tìm kiếm bằng giọng nói tiếng Việt (Web Speech API), bảng tin cảnh báo khẩn cấp và 3 thẻ widget thời tiết/ngập úng thời gian thực.
   - **Chế độ Bản Đồ Tác Chiến (Live Tactical Map)**: Bản đồ tương tác Leaflet toàn màn hình hiển thị trực quan các rốn ngập (marker giọt nước tỏa sóng theo mực nước cm), lớp lưu lượng kẹt xe TomTom Traffic (đường xanh/cam/đỏ thực tế).

2. **Thuật Toán Tìm Đường Né Ngập Thông Minh (Smart Flood-Avoidance Routing)**:
   - Tự động phân tích toàn bộ tọa độ trên lộ trình ngắn nhất so với các rốn ngập sâu đang hoạt động.
   - Tối ưu hóa theo loại phương tiện: Ô tô (giới hạn ngập 35cm), Xe máy điện / Xe máy xăng (giới hạn 20cm).
   - Nếu phát hiện rốn ngập nguy hiểm (xe máy dễ chết máy, ô tô nguy cơ thủy kích), hệ thống cảnh báo màu đỏ và **tự động bẻ góc tính toán lại lộ trình an toàn màu xanh lá** đi vòng qua khu vực cao ráo.

3. **Mạng Lưới Trạm Sạc & Đổi Pin Xe Điện (EV Hub Layer)**:
   - Tích hợp trạm sạc VinFast, EVOne, trạm đổi pin Selex Motors trên khắp Hà Nội, TP.HCM và Đà Nẵng.
   - Hỗ trợ lưu trữ Cloud Supabase (PostGIS) kèm cơ chế offline mock fallback deterministic, đảm bảo luôn sẵn sàng trình diễn mượt mà dù mất mạng hoặc lỗi database bên ngoài.

4. **Dự Báo Kẹt Xe & Ngập Lụt Tương Lai Bằng Trí Tuệ Nhân Tạo (AI XGBoost Predictions)**:
   - Khả năng dự báo trước mức độ kẹt xe và rủi ro ngập úng trong 1h, 2h, 3h tiếp theo.
   - Thanh trượt mốc thời gian (Time-slider) trên giao diện cho phép quan sát sự biến chuyển của rốn ngập và lưu lượng đường sá trong tương lai.

5. **Bot Bắt Dữ Liệu Địa Phương Chạy Ngầm (Node.js Worker Bot)**:
   - Tự động cào và chuẩn hóa dữ liệu từ **HSDC Hà Nội**, **UDi Maps TP.HCM**, **VOV Giao Thông**, và **Trung tâm Dự báo KTTV Quốc gia (NCHMF)**.
   - Nạp sự cố giao thông thực tế từ **TomTom Live Traffic API v5** cho cả Hà Nội, TP.HCM và Đà Nẵng.
   - Chế độ Demo thuyết trình (`DEMO_FLOOD=true`) giúp giả lập tình huống mưa giông ngập lụt ngay cả khi thời tiết thực tế nắng ráo.
   - Tự động làm mới định kỳ mỗi 5 phút hoặc kích hoạt tức thời bằng nút `🔄` trên bản đồ (có chống spam rate limit 15s).

6. **Trợ Lý AI Di Chuyển (AI Copilot & Realtime RAG)**:
   - Phân tích câu hỏi người dùng bằng tiếng Việt, trích xuất dữ liệu rốn ngập, kẹt xe và đưa ra lời khuyên thiết thực theo từng loại phương tiện.
   - Tự động điều khiển bản đồ bay đến tọa độ rốn ngập người dùng đang quan tâm.
   - Hỗ trợ cả **Bộ não AI nội bộ** (không cần API key) và **Google Gemini API**.

7. **Hệ Thống Báo Cáo Sự Cố Cộng Đồng (Crowdsourcing Realtime)**:
   - Người đi đường có thể bấm `+ Báo Ngập / Tắc`, chọn mức ngập (mắt cá chân, nửa bánh xe, lút yên xe) và gửi lên hệ thống.
   - Điểm báo cáo lập tức được ghim lên bản đồ và **đồng bộ đa tab / đa thiết bị theo thời gian thực** qua `BroadcastChannel`, Server-Sent Events (SSE) và REST API kèm âm thanh cảnh báo.

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

### 1. Khởi động Web Server (Node.js Express)
Mở terminal tại thư mục dự án và chạy:
```bash
npm start
```
Server sẽ chạy tại: `http://localhost:3000`

### 2. (Tùy chọn) Khởi chạy AI Backend (Python FastAPI + XGBoost)
```bash
cd server-ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. (Tùy chọn) Chạy Worker Bot Cào Dữ Liệu Độc Lập
```bash
npm run bot
```

---

## 🔑 Cấu Hình Biến Môi Trường (.env)

Tạo file `.env` từ mẫu `.env.example`:
```env
PORT=3000

# API Keys bên ngoài (nếu có key riêng)
OPENWEATHER_KEY=your_openweather_key
TOMTOM_KEY=your_tomtom_key
GEMINI_KEY=your_gemini_key

# Chế độ biểu diễn thuyết trình ngập đô thị (Presentation demo)
DEMO_FLOOD=false

# Supabase Cloud Database (PostgreSQL + PostGIS)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
web du thi/
├── index.html                 # Giao diện chính (Google Portal + Live Tactical Map)
├── css/
│   └── style.css              # Thiết kế Glassmorphism, animations và responsive
├── js/
│   ├── app.js                 # Nhạc trưởng điều phối state và tương tác người dùng
│   ├── map-engine.js          # Quản lý Leaflet Map, TomTom Traffic Layer, Marker ngập & EV
│   ├── routing-service.js     # Thuật toán tìm đường né ngập, né tắc & phân tích độ an toàn
│   ├── weather-service.js     # Dữ liệu thời tiết OpenWeather & Open-Meteo
│   ├── supabase-service.js    # Tương tác Supabase Cloud (EV Stations, AI Predictions, Fallback)
│   ├── crowdsource.js         # Báo cáo sự cố cộng đồng & đồng bộ đa tab realtime
│   └── ai-chat.js             # Trợ lý AI Copilot, voice recognition (Web Speech API)
├── server/
│   ├── server.js              # Express REST API, SSE Realtime, Rate Limiter & Whitelist Security
│   ├── bot-service.js         # Worker Bot cào dữ liệu HSDC, UDi, VOV, NCHMF & TomTom
│   ├── ai-service.js          # Bộ não AI xử lý ngữ cảnh thời gian thực & Gemini RAG
│   └── config.js              # Cấu hình trung tâm, API keys và tọa độ đô thị
├── server-ai/
│   ├── main.py                # FastAPI AI Engine huấn luyện XGBoost và dự báo kẹt xe, ngập lụt
│   └── requirements.txt       # Dependencies Python (fastapi, uvicorn, xgboost, supabase, pandas)
├── public/
│   └── screenshots/           # Ảnh chụp màn hình phục vụ báo cáo và thuyết trình
├── data/
│   ├── live_urban_cache.json   # Cache dữ liệu cào tổng hợp từ bot
│   └── crowdsource_reports.json # Lưu trữ các báo cáo sự cố từ người dùng
├── database.sql               # Toàn bộ mã nguồn khởi tạo Schema, PostGIS & RLS trên Supabase
└── database_update_floods.sql # Bản cập nhật bảng dự báo ngập lụt cho Supabase
```

---

## 🎯 Kịch Bản Thuyết Trình Demo Cho Ban Giám Khảo

1. **Demo Trang Chủ Google Portal**:
   - Chỉ cho ban giám khảo thấy thiết kế tối giản, trực quan, widget thời tiết hiển thị lượng mưa mm và mức độ rủi ro ngập.
   - Thử bấm vào nút micro 🎙️ hoặc gõ câu hỏi: *"Thời tiết hôm nay có mưa ngập không?"* để xem AI trả lời.
2. **Demo Tìm Đường Né Ngập (Tính Năng Đắt Giá Nhất)**:
   - Bấm sang chế độ **Bản Đồ Tác Chiến**.
   - Bấm nút **🚀 Tìm Đường**: Quan sát hệ thống phát hiện rốn ngập Nguyễn Khuyến (ngập sâu 35cm) trên đường ngắn nhất (vẽ nét đứt màu đỏ), và **tự động bẻ lộ trình an toàn màu xanh lá** đi vòng qua khu vực khô ráo.
   - Đổi phương tiện sang **Xe máy điện / Xe máy** để thấy phân tích cảnh báo ngập theo độ cao pô/bình ắc quy (20cm).
3. **Demo Lớp Trạm Sạc Xe Điện (EV Hub)**:
   - Bật checkbox **⚡ Trạm Sạc EV**: Toàn bộ các trạm VinFast, Selex Motors, EVOne lập tức xuất hiện với biểu tượng trạm sạc chuyên biệt kèm thông tin số cổng sạc.
4. **Demo Dự Báo Tương Lai Bằng AI**:
   - Di chuyển thanh trượt **Dự báo (+1h, +2h, +3h)** để thấy AI mô phỏng mức độ rủi ro ngập và kẹt xe dịch chuyển theo thời gian.
5. **Demo Bot Cào Dữ Liệu Thời Gian Thực**:
   - Bấm nút `🔄` ở góc phải bản đồ: Bot lập tức quét lại luồng dữ liệu VOV, thời tiết và TomTom Traffic, hiển thị thông báo cập nhật thành công (có chống spam rate limit 15s).
6. **Demo Báo Ngập Cộng Đồng Đồng Bộ Realtime**:
   - Mở 2 tab trình duyệt song song `http://localhost:3000`.
   - Ở tab 1, bấm `+ Báo Ngập / Tắc`, chọn mức ngập và gửi.
   - Ngay lập tức tab 2 phát âm thanh `Ping!` và marker điểm ngập mới xuất hiện tức thì trên bản đồ.
