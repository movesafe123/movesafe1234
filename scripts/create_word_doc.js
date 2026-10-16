const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType
} = require('docx');

// Màu sắc chủ đạo (Corporate / Modern Blue Theme)
const COLOR_PRIMARY = "1A73E8";    // Google Blue
const COLOR_SECONDARY = "0D47A1";  // Deep Blue
const COLOR_TEXT = "202124";       // Dark Charcoal
const COLOR_MUTED = "5F6368";      // Gray
const COLOR_BG_LIGHT = "F8F9FA";   // Light gray background
const COLOR_ACCENT = "E8F0FE";     // Light blue highlight
const COLOR_BORDER = "DADCE0";     // Soft border gray

function createTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: 32, // 16pt
        color: COLOR_SECONDARY,
        font: "Segoe UI"
      })
    ]
  });
}

function createSubtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 300 },
    children: [
      new TextRun({
        text: text,
        italics: true,
        size: 22, // 11pt
        color: COLOR_MUTED,
        font: "Segoe UI"
      })
    ]
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: 26, // 13pt
        color: COLOR_PRIMARY,
        font: "Segoe UI"
      })
    ]
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: 22, // 11pt
        color: COLOR_SECONDARY,
        font: "Segoe UI"
      })
    ]
  });
}

function createParagraph(text, isBold = false) {
  return new Paragraph({
    spacing: { before: 60, after: 80, line: 276 },
    children: [
      new TextRun({
        text: text,
        bold: isBold,
        size: 20, // 10pt
        color: COLOR_TEXT,
        font: "Segoe UI"
      })
    ]
  });
}

function createBullet(title, desc) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 260 },
    children: [
      new TextRun({
        text: title + ": ",
        bold: true,
        size: 20,
        color: COLOR_TEXT,
        font: "Segoe UI"
      }),
      new TextRun({
        text: desc,
        size: 20,
        color: COLOR_TEXT,
        font: "Segoe UI"
      })
    ]
  });
}

function createTableCell(text, isHeader = false, widthPercent = 25, isBold = false, align = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: {
      type: ShadingType.CLEAR,
      fill: isHeader ? COLOR_PRIMARY : (isBold ? COLOR_BG_LIGHT : "FFFFFF")
    },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: text,
            bold: isHeader || isBold,
            size: isHeader ? 19 : 18,
            color: isHeader ? "FFFFFF" : COLOR_TEXT,
            font: "Segoe UI"
          })
        ]
      })
    ]
  });
}

// Bảng ma trận công nghệ
function buildTechStackTable() {
  const headers = ["Tầng Kiến Trúc", "Công Nghệ Cốt Lõi", "Phiên Bản (Ver)", "Vai Trò Trong MoveSafe VN"];
  const widths = [20, 25, 18, 37];

  const rowsData = [
    ["Bản đồ & GIS (Frontend)", "Leaflet.js", "1.9.4", "Render bản đồ tương tác, hiển thị hàng trăm điểm ngập, trạm thời tiết, popup và lớp phủ giao thông"],
    ["Lớp bản đồ nền (Tiles)", "Google Maps Tiles + TomTom Flow", "Google Maps v3 / TomTom v5", "Hiển thị nền bản đồ đường phố chuẩn Google Maps & vệt lưu lượng giao thông thời gian thực"],
    ["Động cơ định tuyến", "Project OSRM Engine", "v5.x (HTTP REST API)", "Thuật toán tìm đường, alternative routes, geometries GeoJSON và phân tích từng bước rẽ"],
    ["Khí tượng & Cảm biến mưa", "Open-Meteo Cloud + OpenWeatherMap", "Open-Meteo v1 / OWM v2.5", "Cung cấp lượng mưa mm từng giờ, WMO code, chu kỳ ngày/đêm (is_day) đa trạm 24/7"],
    ["Backend & Bot Thu thập", "Node.js + Express.js", "Node v18+ / Express ^4.21.2", "Máy chủ API, crawler định kỳ, SSE (Server-Sent Events), tính toán mô hình thoát nước dần"],
    ["Bộ cào dữ liệu mạng lưới", "Cheerio + Axios", "Cheerio ^1.0.0 / Axios ^1.7.9", "Tự động thu thập dữ liệu quan trắc từ HSDC, UDi Maps, tin phát thanh VOV Giao thông"],
    ["Đám mây & Database", "Supabase (PostgreSQL + PostgREST)", "Supabase JS Client ^2.x / API v1", "Lưu trữ rốn ngập, trạm sạc xe điện, chuỗi thời gian lịch sử 7 ngày, bảo mật RLS"],
    ["Dự báo AI (Machine Learning)", "Python + XGBoost + FastAPI", "Python 3.10+ / XGBoost ^2.x / FastAPI", "Dự báo cấp độ ùn tắc và độ sâu ngập tương lai (+1h, +2h, +3h) theo chuỗi thời gian"],
    ["Trợ lý AI & Giọng nói", "Google Gemini 1.5 Flash + Web Speech", "Gemini 1.5 Flash / HTML5 Speech", "Tư vấn lộ trình né ngập thông minh, nhận diện & phát âm tiếng Việt chuẩn (TTS/STT)"],
    ["Đồng bộ đa thiết bị & Offline", "BroadcastChannel + LocalStorage + PWA", "W3C Web Standards / PWA Manifest", "Đồng bộ tức thì đa tab, lưu trữ báo cáo cộng đồng 2h, cài đặt như ứng dụng native"]
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => createTableCell(h, true, widths[i], true, AlignmentType.CENTER))
    })
  ];

  rowsData.forEach(row => {
    tableRows.push(
      new TableRow({
        children: [
          createTableCell(row[0], false, widths[0], true),
          createTableCell(row[1], false, widths[1]),
          createTableCell(row[2], false, widths[2], false, AlignmentType.CENTER),
          createTableCell(row[3], false, widths[3])
        ]
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
  });
}

// Bảng so sánh 1: Leaflet vs Google vs Mapbox
function buildLeafletComparisonTable() {
  const headers = ["Tiêu Chí So Sánh", "Leaflet.js 1.9.4 (MoveSafe Chọn)", "Google Maps JS SDK", "Mapbox GL JS"];
  const widths = [25, 27, 24, 24];
  const data = [
    ["Chi phí bản quyền", "Miễn phí 100% (Mã nguồn mở BSD-2)", "$7 / 1,000 lượt sau quota", "$5 / 1,000 lượt sau 50k"],
    ["Dung lượng thư viện", "~42 KB (Cực kỳ nhẹ)", "~150 - 200 KB", "~500 KB (Yêu cầu WebGL nặng)"],
    ["Tiêu hao phần cứng/pin", "Rất thấp, tối ưu máy yếu/mạng 3G", "Trung bình", "Khá cao, dễ nóng máy di động"],
    ["Tùy biến Layer & Marker", "Toàn quyền tùy biến HTML/CSS (DivIcon)", "Bị bó buộc trong chuẩn Google", "Cần cấu hình style vector phức tạp"],
    ["Chạy Offline & PWA", "Rất tốt với Tile caching", "Bị hạn chế bản quyền", "Phức tạp khi cache vector tiles"]
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => createTableCell(h, true, widths[i], true, AlignmentType.CENTER))
    })
  ];
  data.forEach(r => {
    tableRows.push(
      new TableRow({
        children: [
          createTableCell(r[0], false, widths[0], true),
          createTableCell(r[1], false, widths[1], true),
          createTableCell(r[2], false, widths[2]),
          createTableCell(r[3], false, widths[3])
        ]
      })
    );
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

// Bảng so sánh 2: OSRM vs Google Directions vs GraphHopper
function buildRoutingComparisonTable() {
  const headers = ["Tiêu Chí So Sánh", "OSRM Engine v5 (MoveSafe Chọn)", "Google Directions API", "GraphHopper API"];
  const widths = [25, 27, 24, 24];
  const data = [
    ["Chi phí gọi API", "Miễn phí / Tự host không giới hạn", "$5 - $10 / 1,000 requests", "Giới hạn khắt khe gói Free"],
    ["Can thiệp lõi thuật toán", "Toàn quyền can thiệp Waypoints & Polyline", "Đóng kín (Black box hoàn toàn)", "Cho phép nhưng cấu hình phức tạp"],
    ["Tốc độ phản hồi", "10 - 30ms (Cực nhanh)", "200 - 500ms (Máy chủ nước ngoài)", "~50ms"],
    ["Hỗ trợ cấm xe máy cao tốc", "Chủ động lọc steps cấm đường trên cao", "Thường ghép chung lộ trình ô tô", "Phải cấu hình lại file profile"]
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => createTableCell(h, true, widths[i], true, AlignmentType.CENTER))
    })
  ];
  data.forEach(r => {
    tableRows.push(
      new TableRow({
        children: [
          createTableCell(r[0], false, widths[0], true),
          createTableCell(r[1], false, widths[1], true),
          createTableCell(r[2], false, widths[2]),
          createTableCell(r[3], false, widths[3])
        ]
      })
    );
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

// Bảng so sánh 3: Open-Meteo vs OpenWeatherMap vs WeatherAPI
function buildWeatherComparisonTable() {
  const headers = ["Tiêu Chí So Sánh", "Open-Meteo Cloud (MoveSafe Chọn)", "OpenWeatherMap Free Tier", "WeatherAPI Free"];
  const widths = [25, 27, 24, 24];
  const data = [
    ["Hạn mức truy vấn", "10,000 req/ngày (Không cần API key)", "60 req/phút, 1,000 req/ngày", "1,000,000 req/tháng (cần key)"],
    ["Quét đa trạm cùng lúc", "Hỗ trợ Batch Coords trong 1 request", "Không hỗ trợ (Gửi từng request lẻ)", "Không hỗ trợ batch coords"],
    ["Độ chính xác lượng mưa", "Từng 0.1 mm tích lũy hàng giờ", "Thường báo 0 nếu mưa rào nhỏ", "Chỉ có mức chung chung"],
    ["Phân định ngày/đêm", "Trường is_day chuẩn xác 100%", "Phải tự suy luận qua icon code", "Có trường is_day"]
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => createTableCell(h, true, widths[i], true, AlignmentType.CENTER))
    })
  ];
  data.forEach(r => {
    tableRows.push(
      new TableRow({
        children: [
          createTableCell(r[0], false, widths[0], true),
          createTableCell(r[1], false, widths[1], true),
          createTableCell(r[2], false, widths[2]),
          createTableCell(r[3], false, widths[3])
        ]
      })
    );
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

// Bảng so sánh 4: Supabase vs Firebase vs MongoDB
function buildDatabaseComparisonTable() {
  const headers = ["Tiêu Chí So Sánh", "Supabase Cloud (MoveSafe Chọn)", "Firebase Firestore", "MongoDB Atlas"];
  const widths = [25, 27, 24, 24];
  const data = [
    ["Mô hình dữ liệu", "PostgreSQL (Chuẩn quan hệ ACID)", "NoSQL Document JSON", "NoSQL BSON Document"],
    ["Xử lý địa lý không gian", "PostGIS, tính khoảng cách cực mạnh", "Rất yếu, khó lọc theo bán kính", "Hỗ trợ 2dsphere index"],
    ["Truy vấn chuỗi thời gian", "Cực nhanh với B-tree Index trên thời gian", "Tốn chi phí đọc từng document", "Tốt nhưng cần tinh chỉnh pipeline"],
    ["Nguy cơ Vendor Lock-in", "Không (Có thể migrate sang Postgres bất kỳ)", "Khóa chặt trong Google Cloud", "Trung bình"]
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => createTableCell(h, true, widths[i], true, AlignmentType.CENTER))
    })
  ];
  data.forEach(r => {
    tableRows.push(
      new TableRow({
        children: [
          createTableCell(r[0], false, widths[0], true),
          createTableCell(r[1], false, widths[1], true),
          createTableCell(r[2], false, widths[2]),
          createTableCell(r[3], false, widths[3])
        ]
      })
    );
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

// Bảng so sánh 5: XGBoost vs Deep Learning LSTM vs Linear Regression
function buildAiComparisonTable() {
  const headers = ["Tiêu Chí So Sánh", "XGBoost Regressor (MoveSafe Chọn)", "Deep Learning (LSTM / GRU)", "Linear / Random Forest"];
  const widths = [25, 27, 24, 24];
  const data = [
    ["Yêu cầu tài nguyên", "Cực thấp (Chạy tốt trên 1 CPU, 512MB RAM)", "Cần GPU hoặc vCPU lớn, RAM > 4GB", "Thấp"],
    ["Độ chính xác dữ liệu bảng", "Rất cao trên dữ liệu chuỗi số có cấu trúc", "Dễ overfitting nếu dữ liệu thô ít", "Thấp, dự báo bị thô"],
    ["Độ trễ suy luận (Latency)", "< 5ms cho 100 điểm giao cắt", "80 - 200ms", "~10ms"],
    ["Thời gian huấn luyện lại", "Chỉ mất 2 - 3 giây", "Mất từ 15 - 45 phút", "1 - 2 giây"]
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => createTableCell(h, true, widths[i], true, AlignmentType.CENTER))
    })
  ];
  data.forEach(r => {
    tableRows.push(
      new TableRow({
        children: [
          createTableCell(r[0], false, widths[0], true),
          createTableCell(r[1], false, widths[1], true),
          createTableCell(r[2], false, widths[2]),
          createTableCell(r[3], false, widths[3])
        ]
      })
    );
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

async function generateDocx() {
  console.log("Đang khởi tạo tài liệu Word...");

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Segoe UI", size: 20, color: COLOR_TEXT }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } // 2.1cm margins
          }
        },
        children: [
          createTitle("BÁO CÁO KIẾN TRÚC CÔNG NGHỆ, PHIÊN BẢN & ĐÁNH GIÁ SO SÁNH"),
          createSubtitle("Hệ Thống Điều Phối & Tránh Ngập Đô Thị Thông Minh MoveSafe VN (Bản Triển Khai Thực Tế)"),

          createHeading1("1. TỔNG QUAN HỆ SINH THÁI CÔNG NGHỆ (TECH STACK MATRIX)"),
          createParagraph("Hệ thống MoveSafe VN được thiết kế theo triết lý 'Production-Ready 24/7', hướng tới phục vụ thực tế người dân và tài xế trong đô thị Việt Nam trong dài hạn. Dự án kết hợp hài hòa giữa bản đồ tương tác, dữ liệu cảm biến đa nguồn thời gian thực, cơ sở dữ liệu phân tán và mô hình AI dự báo phụ trợ."),
          createParagraph("Bảng dưới đây tổng hợp chi tiết toàn bộ các công nghệ cốt lõi cùng số hiệu phiên bản đang vận hành:"),
          
          buildTechStackTable(),

          createHeading1("2. PHÂN TÍCH CHUYÊN SÂU & LUẬN CHỨNG LỰA CHỌN CÔNG NGHỆ"),

          createHeading2("2.1. Bản Đồ Tương Tác: Leaflet.js (v1.9.4)"),
          createParagraph("Leaflet.js được lựa chọn làm xương sống bản đồ tương tác của MoveSafe VN thay vì Google Maps SDK hay Mapbox GL JS vì các lý do chiến lược:"),
          createBullet("Tối ưu băng thông mạng di động", "Trọng lượng thư viện chỉ ~42KB (gzipped), giúp ứng dụng khởi động tức thì ngay cả khi người dùng đang di chuyển trong mưa gió với kết nối 3G/4G chập chờn."),
          createBullet("Tùy biến Marker linh hoạt (DivIcon)", "Cho phép dựng các ghim rốn ngập động hiển thị độ sâu (15cm, 30cm, 50cm), màu cảnh báo nhấp nháy (pulse animation) và trạm thời tiết bằng HTML/CSS thuần mà không bị giới hạn bởi icon ảnh bitmap tĩnh."),
          createBullet("Kết hợp đa nguồn bản đồ linh hoạt", "Dễ dàng phủ lớp lưu lượng kẹt xe TomTom thời gian thực lên trên nền bản đồ Google Maps hoặc chuyển đổi sang ảnh vệ tinh chỉ với một thao tác."),
          createBullet("Độc lập tài chính 100%", "Hoàn toàn mã nguồn mở, không phát sinh chi phí tính theo lượt tải bản đồ (Map Load Billing), đảm bảo hệ thống duy trì bền vững khi lượng truy cập tăng vọt trong mùa bão."),
          createParagraph("Bảng so sánh kỹ thuật giữa Leaflet.js và các giải pháp thương mại:"),
          buildLeafletComparisonTable(),

          createHeading2("2.2. Động Cơ Định Tuyến: Project OSRM Engine (v5.x)"),
          createParagraph("MoveSafe VN sử dụng OSRM v5.x để hiện thực hóa bài toán: 'Định tuyến thích ứng theo ngưỡng chịu ngập của từng loại phương tiện':"),
          createBullet("Tốc độ siêu việt", "Thuật toán Contraction Hierarchies cho phép OSRM tính toán lộ trình qua nhiều waypoints chỉ trong 10-30 mili-giây."),
          createBullet("Can thiệp thuật toán né ngập theo ngưỡng kỹ thuật", "Hệ thống kiểm tra trực tiếp tọa độ đường đi cắt qua rốn ngập. Nếu vượt quá giới hạn xe (20cm với xe máy xăng/điện; 25cm với ô tô con), hệ thống tự động đánh dấu cung đường là Vật Cản Bất Khả Dụng và sinh các điểm tránh (Bypass Detours) để bẻ hướng sang lộ trình cao ráo."),
          createBullet("Tuân thủ luật giao thông đường bộ Việt Nam", "Chủ động kiểm tra các bước di chuyển (steps) để ngăn chặn hoàn toàn việc dẫn xe 2 bánh lên đường cao tốc, cầu cạn trên cao (Vành đai 3 trên cao, Đại lộ Thăng Long làn cao tốc...) và cảnh báo ngõ hẻm cho xe ô tô."),
          createParagraph("Bảng so sánh kỹ thuật động cơ định tuyến:"),
          buildRoutingComparisonTable(),

          createHeading2("2.3. Khí Tượng & Cảm Biến Lượng Mưa: Open-Meteo Cloud Radar + OpenWeatherMap"),
          createParagraph("Dữ liệu thời tiết và lượng mưa thời gian thực được thu thập qua cơ chế lai ghép (Hybrid Fallback):"),
          createBullet("Truy vấn chùm đa tọa độ (Batch Coordinates)", "Open-Meteo cho phép MoveSafe quét toàn bộ 76 phường xã Hà Nội chỉ trong 01 HTTP request duy nhất, giảm 98% tải kết nối và triệt tiêu nguy cơ bị khóa IP (HTTP 429)."),
          createBullet("Chính xác từng mm mưa", "Cung cấp lượng mưa tích lũy mm từng giờ (precipitation & rain), cho phép mô hình thủy văn phát hiện nguy cơ ngập dồn trước khi nước tràn mặt đường."),
          createBullet("Chu kỳ ngày/đêm chuẩn xác (is_day)", "Khắc phục triệt để lỗi hiển thị icon mặt trời vào ban đêm của các phần mềm khác, hiển thị đúng trăng đêm (🌙) và mây (☁️)."),
          createParagraph("Bảng so sánh kỹ thuật dịch vụ thời tiết:"),
          buildWeatherComparisonTable(),

          createHeading2("2.4. Đám Mây & Cơ Sở Dữ Liệu: Supabase (PostgreSQL + PostgREST)"),
          createParagraph("Supabase đóng vai trò nền tảng dữ liệu phân tán cho MoveSafe VN:"),
          createBullet("PostgreSQL chuẩn doanh nghiệp", "Hỗ trợ lưu trữ chuỗi thời gian (traffic history) và dữ liệu không gian tọa độ các trạm sạc xe điện VinFast, Selex, EVOne."),
          createBullet("Cơ chế tự động phòng vệ (SafeQuery & Cooldown)", "Tích hợp bộ đệm timeout 3.5s và cooldown 60s khi mất sóng, giúp ứng dụng tự động chuyển sang chế độ hoạt động cục bộ mượt mà không bị treo giao diện."),
          createBullet("Bảo mật Row Level Security (RLS)", "Phân quyền chặt chẽ giữa người dùng chỉ đọc và Bot dịch vụ có quyền ghi dữ liệu quan trắc."),
          createParagraph("Bảng so sánh kỹ thuật cơ sở dữ liệu:"),
          buildDatabaseComparisonTable(),

          createHeading2("2.5. Trí Tuệ Nhân Tạo Dự Báo: Python XGBoost + FastAPI"),
          createParagraph("Thay vì sử dụng các mạng nơ-ron hồi quy phức tạp đòi hỏi GPU đắt tiền, MoveSafe VN ứng dụng XGBoost Regressor:"),
          createBullet("Tối ưu vượt trội cho dữ liệu bảng", "Mô hình XGBoost học mối tương quan phi tuyến giữa giờ trong ngày, lượng mưa và đặc trưng từng đô thị với độ chính xác cao."),
          createBullet("Mô hình suy giảm thủy văn (Hydrological Decay)", "Nước ngập rút dần với tốc độ tự nhiên 12 cm/h khi tạnh mưa, đảm bảo phản ánh đúng thực tế thoát nước tại Hà Nội và TP.HCM thay vì để điểm ngập biến mất đột ngột."),
          createBullet("Siêu nhẹ và ổn định", "Mô hình chỉ tốn dưới 50MB RAM, chạy tốt trên máy chủ tiêu chuẩn hoặc thiết bị nhúng."),
          createParagraph("Bảng so sánh kỹ thuật mô hình AI:"),
          buildAiComparisonTable(),

          createHeading2("2.6. Trợ Lý Tương Tác & Giọng Nói: Google Gemini 1.5 Flash + Web Speech API"),
          createParagraph("Trợ lý MoveSafe Copilot hỗ trợ người dân tham gia giao thông an toàn:"),
          createBullet("Bóc tách hành động tự động", "Tự động phân tích câu hỏi tự nhiên của người dùng để kích hoạt vẽ đường né ngập trên bản đồ mà không cần nhập liệu thủ công."),
          createBullet("Cảnh báo giọng nói tiếng Việt (Text-to-Speech)", "Tài xế lái xe trong mưa có thể lắng nghe trợ lý đọc to cảnh báo lộ trình và tình trạng rốn ngập mà không cần nhìn vào màn hình."),
          createBullet("Chống tấn công XSS", "Toàn bộ câu trả lời từ AI và báo cáo cộng đồng đều được làm sạch qua bộ lọc HTML trước khi hiển thị lên giao diện."),

          createHeading1("3. TỔNG KẾT NGUYÊN TẮC THIẾT KẾ HỆ THỐNG"),
          createParagraph("MoveSafe VN được xây dựng xoay quanh 3 trụ cột phát triển bền vững:"),
          createBullet("Khả năng chịu lỗi tuyệt đối (Zero-Failure Architecture)", "Mọi tầng công nghệ đều có phương án dự phòng 2 lớp: Mất mạng backend -> Dùng dữ liệu cache tĩnh; Mất sóng Supabase -> Dùng thuật toán tất định; AI Cloud bận -> Dùng bộ quy tắc chuyên gia cục bộ."),
          createBullet("Vận hành bền vững với chi phí 0 VNĐ (Cost-Zero Sustainability)", "Lựa chọn các nền tảng mã nguồn mở và gói miễn phí dồi dào, đảm bảo hệ thống có thể duy trì phục vụ cộng đồng xuyên suốt nhiều năm."),
          createBullet("Lấy an toàn phương tiện làm trọng tâm (Vehicle-Centric Safety)", "Không định tuyến người dân đi vào vùng ngập sâu rồi gắn mác cảnh báo; kiên quyết tìm đường tránh cao ráo bảo vệ động cơ xe và tính mạng người tham gia giao thông.")
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const rootDir = path.join(__dirname, '..');
  const outPath = path.join(rootDir, 'CONG_NGHE_SU_DUNG.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Đã tạo thành công file Word tại: ${outPath}`);

  // Copy sang public
  const publicOutPath = path.join(rootDir, 'public', 'CONG_NGHE_SU_DUNG.docx');
  fs.writeFileSync(publicOutPath, buffer);
  console.log(`✅ Đã copy sang public: ${publicOutPath}`);
}

generateDocx();
