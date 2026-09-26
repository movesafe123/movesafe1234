const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType
} = require('docx');
const fs = require('fs');
const path = require('path');

async function generateDocx() {
  const primaryColor = '1A73E8'; // Google Blue
  const secondaryColor = '1E8E3E'; // Google Green
  const darkNavy = '1E1E38'; // Dark Navy Slide Theme
  const cardBgLeft = '241442'; // Purple/Indigo Dark
  const cardBgRight = '122646'; // Blue Dark
  const neonGreen = '00E676';
  const textColor = '202124';
  const lightGray = 'F8F9FA';
  const borderGray = 'DADCE0';

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22, // 11pt
            color: '202124'
          }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1000,
            bottom: 1000,
            left: 1000,
            right: 1000
          }
        }
      },
      children: [
        // ================= HEADER TITLE =================
        new Paragraph({
          spacing: { before: 0, after: 120 },
          children: [
            new TextRun({
              text: '▌ ',
              color: '1A73E8',
              bold: true,
              size: 40
            }),
            new TextRun({
              text: 'CÔNG NGHỆ SỬ DỤNG - HỆ THỐNG MOVESAFE VN',
              color: '1A1F36',
              bold: true,
              size: 34
            })
          ]
        }),

        new Paragraph({
          spacing: { before: 0, after: 280 },
          children: [
            new TextRun({
              text: 'Dự án: ',
              bold: true,
              color: '5F6368',
              size: 22
            }),
            new TextRun({
              text: 'Bản Đồ Giao Thông Thông Minh, Cảnh Báo Ngập Lụt HSDC/UDi, Dẫn Đường Né Ùn Tắc 3 Cấp Độ & Trợ Lý Trí Tuệ Nhân Tạo (AI Copilot)',
              italics: true,
              color: '1A73E8',
              size: 22
            })
          ]
        }),

        // ================= SECTION 1: BẢNG FORM ĐỐI XỨNG (GIỐNG ẢNH MẪU) =================
        new Paragraph({
          spacing: { before: 180, after: 140 },
          children: [
            new TextRun({
              text: '1. Bảng phân loại công nghệ theo chuẩn Form mẫu (Slide Overview)',
              bold: true,
              size: 26,
              color: '1A73E8'
            })
          ]
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                // CỘT 1: BACKEND & AI
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  shading: { fill: 'F4F1FA' },
                  margins: { top: 200, bottom: 200, left: 200, right: 200 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 12, color: '6C5CE7' },
                    bottom: { style: BorderStyle.SINGLE, size: 12, color: '6C5CE7' },
                    left: { style: BorderStyle.SINGLE, size: 12, color: '6C5CE7' },
                    right: { style: BorderStyle.SINGLE, size: 12, color: '6C5CE7' }
                  },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 140 },
                      children: [
                        new TextRun({
                          text: '⚡ Backend & AI',
                          bold: true,
                          size: 26,
                          color: '4834D4'
                        })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Runtime & Ngôn ngữ: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Node.js (v20+) / JavaScript (ES6+ Asynchronous).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Backend Framework: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Express.js (Framework API hiệu năng cao, RESTful endpoints).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• AI Assistant & NLP: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Google Gemini 1.5 Flash (Phân tích ngập lụt, tư vấn lộ trình thông minh).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Web Scraping & Crawler Bot: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Axios & Cheerio (Cào dữ liệu HSDC Hà Nội, UDiMaps HCM, VOV Giao thông, NCHMF).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Traffic & Incidents API: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'TomTom Traffic API v5 (Ùn tắc thực tế, rào chắn, độ trễ và vận tốc lưu thông).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Weather Data API: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'OpenWeatherMap & Open-Meteo API (Lượng mưa mm/h, dự báo 24h trạm các quận).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Database & Cache: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'JSON Flat-File Real-time Cache (live_urban_cache.json & LocalStorage 24/7).' })
                      ]
                    })
                  ]
                }),

                // CỘT 2: FRONTEND & INFRA
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  shading: { fill: 'EDF5FF' },
                  margins: { top: 200, bottom: 200, left: 200, right: 200 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 12, color: '1A73E8' },
                    bottom: { style: BorderStyle.SINGLE, size: 12, color: '1A73E8' },
                    left: { style: BorderStyle.SINGLE, size: 12, color: '1A73E8' },
                    right: { style: BorderStyle.SINGLE, size: 12, color: '1A73E8' }
                  },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 140 },
                      children: [
                        new TextRun({
                          text: '🌐 Frontend & Infra',
                          bold: true,
                          size: 26,
                          color: '1A73E8'
                        })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Frontend Core: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'HTML5 Semantic, Modern Vanilla JS (ES6+ Classes), Modern CSS3 (Google Maps Design System).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Map & GIS Engine: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Leaflet.js (v1.9.4), OpenStreetMap, CartoDB Positron & Esri World Imagery (Vệ tinh).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Routing Engine: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'OSRM (Open Source Routing Machine) API kết hợp thuật toán Multi-Corridor Bypass 3 cấp độ.' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Geocoding & Ngõ ngách: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Photon API (Komoot/OSM) & Nominatim (tìm ngõ, ngách, số nhà chi tiết toàn Việt Nam).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Định vị người dùng: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'HTML5 Geolocation API (Định vị GPS tọa độ chuẩn xác của thiết bị).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Version Control: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Git & GitHub Repository (Chuẩn Gitflow workflow).' })
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 40, after: 60 },
                      children: [
                        new TextRun({ text: '• Infrastructure & Hosting: ', bold: true, color: '1A1F36' }),
                        new TextRun({ text: 'Node.js Web Server, Localhost / Cloud Server (Port 3000), sẵn sàng Docker / Vercel.' })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),

        // ================= SECTION 2: BẢNG CHI TIẾT THÔNG SỐ KỸ THUẬT =================
        new Paragraph({
          spacing: { before: 300, after: 120 },
          children: [
            new TextRun({
              text: '2. Bảng kê chi tiết thông số kỹ thuật, thư viện và chức năng',
              bold: true,
              size: 26,
              color: '1A73E8'
            })
          ]
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Header Row
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 6, type: WidthType.PERCENTAGE },
                  shading: { fill: '1A73E8' },
                  children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                  width: { size: 22, type: WidthType.PERCENTAGE },
                  shading: { fill: '1A73E8' },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Thành phần / Công cụ', bold: true, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                  width: { size: 14, type: WidthType.PERCENTAGE },
                  shading: { fill: '1A73E8' },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Phiên bản / Nguồn', bold: true, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  shading: { fill: '1A73E8' },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Phân loại', bold: true, color: 'FFFFFF' })] })]
                }),
                new TableCell({
                  width: { size: 38, type: WidthType.PERCENTAGE },
                  shading: { fill: '1A73E8' },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Vai trò & Chức năng trong MoveSafe VN', bold: true, color: 'FFFFFF' })] })]
                })
              ]
            }),

            // Data Rows
            createTableRow('1', 'Node.js', 'v20.x / v24.x', 'Backend Runtime', 'Môi trường thực thi JavaScript không đồng bộ, xử lý đa luồng ngầm cho Crawler Bot và API Server.'),
            createTableRow('2', 'Express.js', '^4.21.2', 'Backend Framework', 'Cung cấp RESTful API (/api/live-data, /api/bot/refresh, /api/crowdsource), điều phối CORS và phục vụ tĩnh.'),
            createTableRow('3', 'Google Gemini AI', 'gemini-1.5-flash', 'AI & NLP', 'Trợ lý AI thông minh phân tích ngôn ngữ tự nhiên, hỏi đáp tình trạng ngập lụt, tư vấn lộ trình di chuyển.'),
            createTableRow('4', 'Axios & Cheerio', '^1.7.9 / ^1.0.0', 'Web Crawler Bot', 'Tự động cào dữ liệu thủy văn thời gian thực từ HSDC Hà Nội, UDiMaps TP.HCM, VOV Giao thông và NCHMF.'),
            createTableRow('5', 'TomTom Traffic API', 'v5 REST API', 'Traffic Incident Data', 'Cung cấp dữ liệu sự cố giao thông, rào chắn công trường, ùn tắc thực tế, độ trễ và tốc độ dòng xe.'),
            createTableRow('6', 'OpenWeatherMap & Open-Meteo', 'v2.5 / v1 Free', 'Weather Forecast API', 'Cung cấp nhiệt độ, độ ẩm, lượng mưa mm/h và cảnh báo dông lốc cho 18 trạm quận Hà Nội, 10 trạm HCM, 6 trạm Đà Nẵng.'),
            createTableRow('7', 'Leaflet.js', 'v1.9.4', 'Map Engine / GIS', 'Engine hiển thị bản đồ số tương tác mượt mà, render lớp rốn ngập (Pulse Ring), điểm kẹt xe, trạm thời tiết và đa tuyến đường.'),
            createTableRow('8', 'OSRM Routing Engine', 'v5 Car / Bike', 'Routing & Navigation', 'Tính toán lộ trình di chuyển nhanh chóng, kết hợp thuật toán Multi-Corridor Bypass để tạo 3 tuyến đường khác biệt.'),
            createTableRow('9', 'Photon Geocoding (OSM)', 'Komoot API', 'Geocoding & Address', 'Hệ thống tìm kiếm địa chỉ, ngõ, ngách, hẻm, phố, số nhà chi tiết trên toàn quốc với độ trễ thấp.'),
            createTableRow('10', 'Vanilla CSS3 & JS', 'ES6+ Classes', 'Frontend UI/UX', 'Thiết kế giao diện phong cách Google Maps hiện đại, responsive mobile, thanh đo Traffic Congestion Mini-Bar và vi tương tác.'),
            createTableRow('11', 'Git & GitHub', 'Gitflow Workflow', 'Version Control', 'Quản lý phiên bản mã nguồn, theo dõi thay đổi và phối hợp phát triển theo chuẩn Gitflow.'),
            createTableRow('12', 'Local & Flat-file Cache', 'JSON Cache 24/7', 'Database & Cache', 'Lưu trữ điểm ngập, sự cố giao thông và dữ liệu cộng đồng thời gian thực với tốc độ truy xuất cực nhanh.')
          ]
        }),

        // ================= SECTION 3: ĐẶC ĐIỂM NỔI BẬT CỦA THUẬT TOÁN 3 CHẾ ĐỘ =================
        new Paragraph({
          spacing: { before: 300, after: 120 },
          children: [
            new TextRun({
              text: '3. Điểm nhấn công nghệ: Thuật toán chỉ đường né ngập & kẹt xe 3 cấp độ',
              bold: true,
              size: 26,
              color: '1A73E8'
            })
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 80 },
          children: [
            new TextRun({ text: '• Mức 1 - An toàn tuyệt đối (🛡️ Màu Xanh lá #1E8E3E): ', bold: true }),
            new TextRun({ text: 'Thuật toán tìm hành lang vòng tránh qua các ngõ phố cao ráo, đạt 96% - 100% đường thông thoáng, 0% kẹt xe và 0% ngập nước.' })
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 80 },
          children: [
            new TextRun({ text: '• Mức 2 - Cân bằng thông minh (⚖️ Màu Vàng cam #F9AB00): ', bold: true }),
            new TextRun({ text: 'Hành lang cân bằng né 100% điểm kẹt cứng đỏ đậm (<12 km/h) và ngập sâu xe máy, chấp nhận ~8-11% đoạn đông nhẹ để tối ưu cự ly.' })
          ]
        }),

        new Paragraph({
          spacing: { before: 40, after: 80 },
          children: [
            new TextRun({ text: '• Mức 3 - Nhanh nhất / Trục chính (⚡ Màu Xanh dương #1A73E8): ', bold: true }),
            new TextRun({ text: 'Tuyến đường ngắn nhất đi thẳng trục chính xuyên tâm, chấp nhận qua các đoạn đông/ùn tắc để đến đích nhanh nhất.' })
          ]
        }),

        // ================= SECTION 4: THÔNG TIN TÁC GIẢ & BẢN QUYỀN =================
        new Paragraph({
          spacing: { before: 260, after: 80 },
          children: [
            new TextRun({
              text: 'Dự án: MoveSafe VN | Cập nhật: 2026 | Nền tảng: Web Application (Cross-Platform Responsive)',
              italics: true,
              color: '5F6368',
              size: 20
            })
          ],
          alignment: AlignmentType.CENTER
        })
      ]
    }]
  });

  function createTableRow(stt, name, version, type, role) {
    const isEven = parseInt(stt) % 2 === 0;
    const bg = isEven ? 'F8F9FA' : 'FFFFFF';
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 6, type: WidthType.PERCENTAGE },
          shading: { fill: bg },
          children: [new Paragraph({ children: [new TextRun({ text: stt, bold: true })], alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          shading: { fill: bg },
          children: [new Paragraph({ children: [new TextRun({ text: name, bold: true, color: '1A73E8' })] })]
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          shading: { fill: bg },
          children: [new Paragraph({ children: [new TextRun({ text: version, italics: true })], alignment: AlignmentType.CENTER })]
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: bg },
          children: [new Paragraph({ children: [new TextRun({ text: type })] })]
        }),
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          shading: { fill: bg },
          children: [new Paragraph({ children: [new TextRun({ text: role })] })]
        })
      ]
    });
  }

  const buffer = await Packer.toBuffer(doc);
  
  // Lưu file vào thư mục dự án
  const outPath1 = path.join(__dirname, '..', 'Cong_Nghe_Su_Dung_MoveSafe_VN.docx');
  fs.writeFileSync(outPath1, buffer);
  console.log('✓ Đã tạo file thành công tại:', outPath1);

  // Tạo thêm bản sao ngắn gọn
  const outPath2 = path.join(__dirname, '..', 'Cong_Nghe_Su_Dung.docx');
  fs.writeFileSync(outPath2, buffer);
  console.log('✓ Đã tạo bản sao tại:', outPath2);
}

generateDocx().catch(console.error);
