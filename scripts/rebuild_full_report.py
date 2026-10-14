import sys
sys.stdout.reconfigure(encoding='utf-8')
import docx
import copy
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from fix_tables import (
    set_cell_margins, set_cell_valign, set_cell_width,
    set_table_borders, set_table_layout_and_center, format_cell_paragraph
)

def create_styled_paragraph(doc, text="", style='Normal', space_before=3, space_after=3, line_spacing=1.2, align='justify', bold=False, italic=False, font_size=13):
    p = doc.add_paragraph()
    p.style = doc.styles['Normal']
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    
    if align == 'center':
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif align == 'right':
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    elif align == 'left':
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    else:
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        
    if text:
        run = p.add_run(text)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(font_size)
        run.font.bold = bold
        run.font.italic = italic
    return p

def add_heading_styled(doc, text, level=2, space_before=10, space_after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.keep_with_next = True
    
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.bold = True
    
    if level == 1:
        run.font.size = Pt(15)
        run.font.color.rgb = RGBColor(0, 51, 102) # Dark Navy
    elif level == 2:
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(0, 51, 102)
    elif level == 3:
        run.font.size = Pt(13)
        run.font.italic = True
    else:
        run.font.size = Pt(13)
    return p

def main():
    source_path = 'baocaobaithi.docx'
    print(f"Reading {source_path}...")
    doc = docx.Document(source_path)
    
    # 1. Extract the 4 screenshot drawings from baocaobaithi_backup_tables.docx
    backup_doc = docx.Document('baocaobaithi_backup_tables.docx')
    img_drawings = []
    for p in backup_doc.paragraphs:
        for r in p.runs:
            for d in r._element.xpath('.//w:drawing'):
                if len(d.xml) > 3600: # Screenshots are >3600 bytes
                    img_drawings.append(copy.deepcopy(d))
    print(f"Extracted {len(img_drawings)} screenshot drawings from backup.")
    
    # 2. Update cover page details
    # P9: Project name
    doc.paragraphs[9].text = "Tên đề tài: MoveSafe VN - Hệ thống Giao thông & Dẫn đường Né ngập Thông minh (AI Realtime)"
    for r in doc.paragraphs[9].runs:
        r.font.name = 'Times New Roman'
        r.font.bold = True
        r.font.size = Pt(14)
        
    # P11 & P12: Students
    doc.paragraphs[11].text = "Sinh viên thực hiện: \tNguyễn Hồng Phúc"
    doc.paragraphs[12].text = "                      \tHà Mạnh Tiến"
    for p_i in [11, 12]:
        for r in doc.paragraphs[p_i].runs:
            r.font.name = 'Times New Roman'
            r.font.size = Pt(13)
            
    # P18, P19, P20: Team section
    doc.paragraphs[18].text = "Giảng viên hướng dẫn: ThS. Ngô Thùy Giang"
    doc.paragraphs[19].text = "Tên cá nhân/đội thi: Nguyễn Hồng Phúc - Hà Mạnh Tiến"
    doc.paragraphs[20].text = "\tThành viên: 02"
    for p_i in [18, 19, 20]:
        for r in doc.paragraphs[p_i].runs:
            r.font.name = 'Times New Roman'
            r.font.size = Pt(13)
            
    # 3. Update Table 1 (Team info)
    t1 = doc.tables[0]
    # Ensure Table 1 has 3 rows (Header + 2 Students)
    while len(t1.rows) < 3:
        t1.add_row()
        
    t1_data = [
        ['TT', 'Họ và tên', 'Lớp niên chế', 'Email', 'Số điện thoại', 'Nhiệm vụ'],
        ['1', 'Nguyễn Hồng Phúc', 'DCCNTT 16.5', '25004455@eaut.edu.vn', '0392731908', 'Trưởng nhóm - Kiến trúc hệ thống, Backend Node.js, AI Copilot RAG, thuật toán Smart Routing, Thuyết minh.'],
        ['2', 'Hà Mạnh Tiến', 'DCCNTT 16.5', '25004636@eaut.edu.vn', '0398783204', 'Thành viên - Quản trị CSDL PostGIS/Supabase, Worker Bot thu thập dữ liệu, huấn luyện mô hình XGBoost.']
    ]
    for r_i, row in enumerate(t1.rows):
        for c_i, cell in enumerate(row.cells):
            cell.text = t1_data[r_i][c_i]
            
    # Move 'Thành viên: 02' before Table 1
    t1_elem = t1._element
    p20_elem = doc.paragraphs[20]._element
    body = doc._body._element
    if body.index(t1_elem) < body.index(p20_elem):
        body.remove(p20_elem)
        body.insert(body.index(t1_elem), p20_elem)
            
    # Remove all elements from body starting after Section B (index of paragraph 'C. NỘI DUNG THUYẾT MINH')
    body = doc._body._element
    start_remove = False
    elements_to_remove = []
    
    for child in list(body):
        tag = child.tag.split('}')[-1]
        if tag == 'sectPr':
            continue
        if tag == 'p':
            p_text = ''.join(child.itertext()).strip()
            if 'NỘI DUNG THUYẾT MINH' in p_text:
                start_remove = True
        if start_remove:
            elements_to_remove.append(child)
            
    print(f"Removing {len(elements_to_remove)} old elements to rewrite enriched Section C and D...")
    for elem in elements_to_remove:
        body.remove(elem)
        
    # P17: Section A starts on fresh page
    doc.paragraphs[17].paragraph_format.page_break_before = True
    
    # 4. Now systematically rebuild Section C and Section D with rich academic paragraphs!
    print("Writing enriched Section C: NỘI DUNG THUYẾT MINH...")
    h_c = add_heading_styled(doc, "C. NỘI DUNG THUYẾT MINH", level=1, space_before=16, space_after=8)
    h_c.paragraph_format.page_break_before = True
    
    # 1. Bài toán và Ý tưởng
    add_heading_styled(doc, "1. Bài toán và Ý tưởng", level=2, space_before=12, space_after=6)
    add_heading_styled(doc, "1.1. Xác định bài toán", level=3, space_before=8, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Bối cảnh thực tiễn và tính cấp thiết: ")
    r.bold = True
    p.add_run(
        "Tại các đô thị loại đặc biệt như Hà Nội và TP. Hồ Chí Minh, tốc độ đô thị hóa nhanh chóng cùng với mật độ dân cư và phương tiện cơ giới tăng vọt đang đặt gánh nặng chưa từng có lên hệ thống hạ tầng kỹ thuật. "
        "Dưới tác động của biến đổi khí hậu toàn cầu, các hiện tượng thời tiết cực đoan diễn ra ngày càng thường xuyên và bất quy tắc. Những cơn mưa rào cường độ lớn, vượt quá công suất tiêu thoát của mạng lưới thoát nước xây dựng từ nhiều thập kỷ trước, đã biến hàng loạt trục đường giao thông huyết mạch thành những dòng kênh ngập sâu. "
        "Mỗi khi mưa lớn xuất hiện vào giờ cao điểm, tình trạng ngập úng đô thị kết hợp với mật độ giao thông nghẽn đặc đã gây nên cảnh tê liệt giao thông trên diện rộng, đình trệ các hoạt động kinh tế, giáo dục và cứu hộ khẩn cấp."
    )
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Khoảng trống và điểm nghẽn của các giải pháp hiện tại: ")
    r.bold = True
    p.add_run(
        "Mặc dù các ứng dụng bản đồ phổ biến trên thị trường (như Google Maps, Apple Maps) đã làm tốt nhiệm vụ định vị và dẫn đường cơ bản, song chúng tồn tại ba hạn chế cốt lõi trong bối cảnh giao thông đặc thù tại Việt Nam: "
        "(1) Hoàn toàn thiếu vắng dữ liệu ngập úng đô thị: Bản đồ chỉ hiển thị các dải màu cam hoặc đỏ báo hiệu đường đông đúc mà không thể phân biệt được nguyên nhân do mật độ xe cộ hay do nước ngập sâu nguy hiểm; "
        "(2) Không có khả năng phân hóa rủi ro theo loại phương tiện: Một mực nước ngập 20cm – 30cm có thể an toàn cho xe tải hoặc SUV gầm cao, nhưng chắc chắn là thảm họa gây chết máy hàng loạt đối với xe máy và ô tô sedan/hatchback gầm thấp; "
        "(3) Tính chất thụ động thời gian thực: Các ứng dụng hiện nay chỉ phản ánh hiện trạng tại đúng thời điểm tra cứu, hoàn toàn không có khả năng dự báo trước 1 đến 3 giờ tới. Điều này khiến người tham gia giao thông hoàn toàn rơi vào thế bị động khi bắt đầu lộ trình về nhà."
    )
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Hậu quả nghiêm trọng và hiểm họa thủy kích: ")
    r.bold = True
    p.add_run(
        "Hậu quả thực tế là hàng vạn xe máy bị nước tràn vào buồng đốt và bộ lọc gió dẫn tới chết máy giữa dòng nước xiết, gây hỗn loạn và nguy hiểm đến tính mạng người điều khiển. "
        "Đặc biệt đối với ô tô, hiện tượng 'thủy kích' (nước lọt vào xi-lanh qua đường hút gió khi động cơ đang hoạt động) làm cong gãy tay biên, nứt vỡ lốc máy, với chi phí sửa chữa và thay thế động cơ lên tới hàng chục đến hàng trăm triệu đồng cho mỗi xe. "
        "Bên cạnh thiệt hại tài chính cá nhân, việc hàng trăm phương tiện chết máy ngâm trong nước lũ còn gây cản trở dòng chảy giao thông nhiều giờ liền, làm bùng phát lượng khí thải độc hại (CO, CO2, Hydrocarbon) và gây ô nhiễm môi trường nghiêm trọng."
    )
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Thách thức mới từ làn sóng chuyển đổi Xe điện (EV): ")
    r.bold = True
    p.add_run(
        "Việt Nam đang chứng kiến sự chuyển dịch xanh mạnh mẽ với tốc độ gia tăng nhanh chóng của ô tô điện, xe máy điện (VinFast, Selex Motors, Dat Bike...). "
        "Mặc dù các khối pin xe điện được chế tạo theo tiêu chuẩn chống nước IP67/IP68, nhưng việc ngâm lâu trong nước mưa ngập ngập mặn/axit vẫn tiềm ẩn rủi ro chập cháy hệ thống điện cao áp, oxy hóa các giắc cắm cảm biến và nguy cơ hỏng hóc pin với chi phí thay thế chiếm 30% - 50% giá trị chiếc xe. "
        "Đồng thời, nhu cầu tra cứu nhanh mạng lưới trạm sạc và tủ đổi pin an toàn, nằm trên các cung đường cao ráo không bị chia cắt bởi ngập lụt đang là đòi hỏi sống còn của cộng đồng người dùng xe xanh."
    )
    
    p = create_styled_paragraph(doc, space_after=6)
    r = p.add_run("Đối tượng hướng đến và Tác động dự án: ")
    r.bold = True
    p.add_run(
        "MoveSafe VN hướng đến trực tiếp người dân đô thị di chuyển hàng ngày bằng xe máy và ô tô cá nhân; cộng đồng người dùng phương tiện chạy điện (EV); lực lượng tài xế công nghệ và các đơn vị vận tải, logistics giao hàng nội đô. "
        "Ở tầm vĩ mô, dự án cung cấp công cụ đắc lực hỗ trợ các cơ quan quản lý đô thị trong việc giám sát điểm nghẽn, điều tiết giao thông và cảnh báo thiên tai, góp phần xây dựng hệ sinh thái giao thông đô thị văn minh, an toàn và phát triển bền vững."
    )
    
    # 1.2. Ý tưởng giải pháp
    add_heading_styled(doc, "1.2. Ý tưởng giải pháp", level=3, space_before=8, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Triết lý tiếp cận Data-Centric AI: ")
    r.bold = True
    p.add_run(
        "Thay vì chỉ tập trung vào việc áp dụng các mô hình học máy phức tạp trên một tập dữ liệu tĩnh, MoveSafe VN được thiết kế theo triết lý Data-Centric AI (Trí tuệ Nhân tạo lấy Dữ liệu làm Trung tâm). "
        "Nhóm tập trung tối đa nguồn lực vào việc xây dựng chuỗi thu thập dữ liệu đa tầng, làm giàu dữ liệu không gian thời gian thực và đảm bảo chất lượng đầu vào chuẩn xác nhất. Dữ liệu chất lượng cao chính là nền móng vững chắc giúp các thuật toán AI suy luận chính xác và đưa ra những khuyến nghị thực sự hữu ích cho cộng đồng."
    )
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Năm trụ cột tính năng đột phá của MoveSafe VN: ")
    r.bold = True
    p.add_run("Hệ thống giải quyết triệt để bài toán thông qua năm phân hệ công nghệ cốt lõi:")
    
    bullet_items = [
        ("Giao diện người dùng kép (Dual-Mode UX): ", 
         "Cung cấp hai không gian trải nghiệm tối ưu hóa: Chế độ Google Portal tối giản với thanh tìm kiếm thông minh, hỗ trợ nhận diện giọng nói tiếng Việt tự nhiên (Web Speech API) và bảng tin cảnh báo thời tiết khẩn cấp (Emergency Broadcast Banner); Chế độ Bản đồ Tác chiến (Live Tactical Map) tương tác toàn màn hình với hiệu ứng tỏa sóng động (ripple animation) theo mực nước ngập cm và lớp màu sắc lưu lượng kẹt xe TomTom Traffic."),
        ("Thuật toán Dẫn đường Né ngập Thông minh (Smart Flood-Avoidance Routing): ", 
         "Tích hợp OSRM Routing Engine kết hợp bộ phân tích chướng ngại vật thời gian thực. Hệ thống liên tục quét giao cắt không gian giữa tuyến đường và vùng đệm nguy hiểm của các rốn ngập. Khi phát hiện xung đột, tuyến đường ngắn nhất sẽ bị đánh dấu nét đứt màu đỏ cảnh báo nguy hiểm, và hệ thống tự động bẻ góc, vẽ tuyến đường an toàn màu xanh lá đi vòng qua các khu vực cao ráo."),
        ("Phân loại 3 hành lang giao thông chuyên biệt: ", 
         "Người dùng có thể chủ động lựa chọn phương án phù hợp: 🛡️ Tuyến An toàn tuyệt đối (tránh 100% điểm tắc và ngập lụt), ⚖️ Tuyến Cân bằng thông minh (né tắc nghẽn nghiêm trọng và rốn ngập sâu, cự ly tối ưu), ⚡ Tuyến Nhanh nhất (đi thẳng trục chính ngắn nhất)."),
        ("Mạng lưới Trạm sạc Xe điện & Hệ sinh thái Xanh: ", 
         "Tích hợp lớp dữ liệu toàn diện về các trạm sạc ô tô/xe máy điện và tủ đổi pin (VinFast, Selex, EVOne...) trên địa bàn thành phố, hỗ trợ người điều khiển xe điện tìm kiếm trạm sạc gần nhất trên các tuyến đường hoàn toàn khô ráo, tránh chập cháy pin."),
        ("Trợ lý AI Copilot (Realtime RAG) & Báo cáo Cộng đồng: ", 
         "Ứng dụng mô hình AI tạo sinh kết hợp kỹ thuật RAG (Retrieval-Augmented Generation) nhồi ngữ cảnh ngập lụt, kẹt xe và thời tiết thực tế để tư vấn người dùng chính xác, không ảo giác; tự động điều khiển bản đồ bay đến vị trí quan tâm. Đi kèm là hệ thống Crowdsourcing cho phép người đi đường ghim điểm ngập, đồng bộ tức thời đa thiết bị kèm âm thanh cảnh báo.")
    ]
    for b_title, b_desc in bullet_items:
        bp = doc.add_paragraph()
        bp.style = doc.styles['Normal']
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        bp.paragraph_format.line_spacing = 1.2
        bp.paragraph_format.left_indent = Inches(0.25)
        bp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_b = bp.add_run("• ")
        r_b.font.name = 'Times New Roman'
        r_b.font.bold = True
        r_b.font.size = Pt(13)
        r1 = bp.add_run(b_title)
        r1.font.name = 'Times New Roman'
        r1.font.bold = True
        r1.font.size = Pt(13)
        r2 = bp.add_run(b_desc)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(13)
        
    # 2. Dữ liệu sử dụng
    add_heading_styled(doc, "2. Dữ liệu sử dụng", level=2, space_before=12, space_after=6)
    add_heading_styled(doc, "2.1. Nguồn dữ liệu", level=3, space_before=8, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    p.add_run(
        "Nhận thức rõ dữ liệu là trái tim của hệ thống, MoveSafe VN xây dựng kiến trúc dữ liệu đa nguồn, kết hợp hài hòa giữa dữ liệu trắc địa bán tĩnh và các dòng dữ liệu biến động thời gian thực. "
        "Mỗi nguồn dữ liệu được chuẩn hóa và gán nhãn trọng số tin cậy nhằm phục vụ tối đa cho các mô hình học máy và thuật toán phân tích không gian."
    )
    
    p = create_styled_paragraph(doc, text="Bảng 1. Các nhóm dữ liệu của dự án", space_before=6, space_after=4, bold=True)
    
    # Insert Table 2 (Bảng 1)
    t2 = doc.add_table(rows=5, cols=3)
    t2_data = [
        ['Nhóm dữ liệu', 'Nội dung', 'Vai trò'],
        ['Dữ liệu lịch sử giao thông', 'Bao gồm mã đoạn đường, khung giờ, điều kiện thời tiết và nhãn phân loại mức độ kẹt xe.', 'Dữ liệu đầu vào để huấn luyện mô hình XGBoost dự báo.'],
        ['Dữ liệu rốn ngập (Hà Nội)', 'Tọa độ các điểm thường xuyên ngập lụt đi kèm hệ số rủi ro ngập và mực nước quan trắc.', 'Hiển thị cảnh báo trực quan và đóng vai trò làm "Vật cản" trong thuật toán Smart Routing.'],
        ['Dữ liệu trạm sạc', 'Thông tin vị trí, nhà cung cấp, chuẩn sạc và công suất của các trạm sạc trong khu vực.', 'Nguồn dữ liệu phục vụ hệ sinh thái xe điện xanh và định tuyến sạc an toàn.'],
        ['Dữ liệu Real-time', 'Lượng mưa hiện hành (OpenWeather), lưu lượng giao thông (TomTom), báo cáo cộng đồng (Crowdsourcing).', 'Nạp vào ngữ cảnh cho AI Copilot xử lý ngôn ngữ tự nhiên và cập nhật bản đồ liên tục.']
    ]
    for r_i, row in enumerate(t2.rows):
        for c_i, cell in enumerate(row.cells):
            cell.text = t2_data[r_i][c_i]
            
    # 2.2. Xử lý dữ liệu
    add_heading_styled(doc, "2.2. Xử lý dữ liệu", level=3, space_before=10, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    p.add_run(
        "Dữ liệu thô từ các nguồn internet có độ nhiễu cao, sai lệch định dạng và thiếu đồng nhất tọa độ. "
        "Để đảm bảo độ tin cậy tuyệt đối cho mô hình AI và bản đồ, quy trình xử lý dữ liệu được thiết kế thành một chuỗi khép kín (End-to-End Data Pipeline) tự động hóa thông qua Worker Bot viết bằng Node.js và các module tiền xử lý Python:"
    )
    
    p = create_styled_paragraph(doc, text="Bảng 2. Các bước xử lý dữ liệu", space_before=6, space_after=4, bold=True)
    
    # Insert Table 3 (Bảng 2)
    t3 = doc.add_table(rows=4, cols=2)
    t3_data = [
        ['Bước', 'Nội dung'],
        ['Làm sạch & Lọc nhiễu', 'Bỏ các bản ghi không hợp lệ, khử trùng lặp (clustering) các điểm ngập được báo cáo ở quá gần nhau trong bán kính 100m.'],
        ['Chuẩn hóa giá trị & Trích xuất đặc trưng', 'Tọa độ đưa về chuẩn GeoJSON EPSG:4326. Các mốc thời gian được phân rã thành biến phân loại (hour, rush_hour). Mã hóa điều kiện thời tiết cho mô hình XGBoost.'],
        ['Lưu trữ & Caching đa tầng', 'Lưu dữ liệu vận hành qua Supabase (PostgreSQL/PostGIS) và thiết lập in-memory JSON Caching trên Node.js để truy xuất tức thời dưới 10ms.']
    ]
    for r_i, row in enumerate(t3.rows):
        for c_i, cell in enumerate(row.cells):
            cell.text = t3_data[r_i][c_i]
            
    # 3. Phương pháp và Công nghệ triển khai
    add_heading_styled(doc, "3. Phương pháp và Công nghệ triển khai", level=2, space_before=12, space_after=6)
    add_heading_styled(doc, "3.1. Phương pháp phân tích và Mô hình AI", level=3, space_before=8, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Mô hình học máy XGBoost Regressor (Dự báo Tắc đường & Rủi ro Ngập): ")
    r.bold = True
    p.add_run(
        "Dự án lựa chọn thuật toán eXtreme Gradient Boosting (XGBoost) cho bài toán dự báo kẹt xe và rủi ro ngập úng. "
        "Với dữ liệu dạng bảng có cấu trúc (Tabular Data), XGBoost đã chứng minh được tính ưu việt vượt trội so với các mô hình mạng nơ-ron học sâu: tốc độ huấn luyện tính bằng mili-giây, khả năng xử lý hoàn hảo dữ liệu thiếu (missing values), và khả năng kiểm soát hiện tượng quá khớp (overfitting) thông qua chính quy hóa L1/L2. "
        "Mô hình được huấn luyện trên tập đặc trưng gồm: khung giờ trong ngày (hour: 0-23), nhãn giờ cao điểm (is_rush_hour), mã hóa điều kiện thời tiết (weather_code: nắng, mưa nhẹ, mưa lớn), lượng mưa tích lũy và hệ số trũng địa hình. "
        "Mô hình đạt độ chính xác cao và chạy ổn định trên dịch vụ microservice FastAPI, tự động suy luận mức độ tắc đường (0 - 5) và xác suất ngập tại các rốn ngập trọng điểm cho các mốc thời gian +1h, +2h, +3h tới."
    )
    
    p = create_styled_paragraph(doc, space_after=4)
    r = p.add_run("Kiến trúc Trợ lý AI Copilot kết hợp Realtime RAG (Retrieval-Augmented Generation): ")
    r.bold = True
    p.add_run(
        "Điểm đột phá của trợ lý MoveSafe AI là việc áp dụng kỹ thuật RAG nhằm xóa bỏ hiện tượng 'ảo giác' (hallucination) thường gặp ở các mô hình ngôn ngữ lớn (LLM). "
        "Trước khi gửi câu hỏi của người dùng tới mô hình AI, hệ thống tự động bóc tách thực thể địa danh (tên phố, quận huyện, ý định), trích xuất toàn bộ dữ liệu quan trắc thời gian thực từ Worker Bot (mực nước tại các trạm HSDC, sự cố tắc đường TomTom, lượng mưa OpenWeather) và nhồi vào prompt ngữ cảnh. "
        "Hệ thống vận hành cơ chế lõi kép: Bộ não AI phân tích ngữ cảnh cục bộ (Local Context Engine) chạy siêu tốc không cần API key, và kết nối mở rộng với Google Gemini API khi người dùng kích hoạt. "
        "Đặc biệt, hệ thống tích hợp Web Speech API cho phép giao tiếp giọng nói tiếng Việt hai chiều mượt mà, đồng thời tự động điều khiển camera bản đồ bay trực tiếp (flyTo) đến tọa độ mà người dùng vừa hỏi."
    )
    
    p = create_styled_paragraph(doc, space_after=6)
    r = p.add_run("Thuật toán Quét không gian & Định tuyến Né ngập (Buffer Intersection): ")
    r.bold = True
    p.add_run(
        "Thuật toán tìm đường né ngập của MoveSafe VN hoạt động dựa trên sự kết hợp giữa hình học trắc địa và định tuyến OSRM. "
        "Dựa vào công thức Haversine, hệ thống tạo ra một vùng đệm an toàn (Buffer Polygon bán kính 100m – 250m) bao quanh mỗi rốn ngập dựa trên độ sâu nước (cm). "
        "Sau đó, thuật toán thực hiện phép quét giao cắt không gian giữa Polyline lộ trình di chuyển với các vùng đệm này. Nếu phát hiện tuyến đường ngắn nhất cắt qua vùng ngập vượt ngưỡng chịu nước của phương tiện người dùng (ví dụ: ngập >15cm đối với xe máy), "
        "hệ thống sẽ lập tức đánh dấu đoạn đường nguy hiểm (vẽ nét đứt màu đỏ), đồng thời tự động chèn điểm trung chuyển né tránh (Waypoint Offset) lệch khỏi tâm ngập để yêu cầu máy chủ OSRM tính toán lại lộ trình an toàn màu xanh lá."
    )
    
    add_heading_styled(doc, "3.2. Kiến trúc Công nghệ", level=3, space_before=10, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    p.add_run(
        "Hệ thống được thiết kế theo mô hình kiến trúc Microservices hiện đại, phân tách độc lập giữa tầng giao diện hiển thị, tầng xử lý trung gian và tầng tính toán học máy. "
        "Kiến trúc này giúp hệ thống đạt độ sẵn sàng cao, dễ dàng mở rộng quy mô phục vụ hàng vạn người dùng đồng thời trong những ngày bão lũ mà không lo tắc nghẽn máy chủ:"
    )
    
    p = create_styled_paragraph(doc, text="Bảng 3. Công nghệ sử dụng và trạng thái", space_before=6, space_after=4, bold=True)
    
    # Insert Table 4 (Bảng 3)
    t4 = doc.add_table(rows=6, cols=3)
    t4_data = [
        ['Hạng mục', 'Công nghệ', 'Trạng thái'],
        ['Frontend', 'HTML5, CSS3 Glassmorphism, Vanilla JavaScript tối ưu hiệu năng; Leaflet.js hiển thị bản đồ đa lớp, Web Speech API.', 'Đang dùng'],
        ['Backend API (Node.js)', 'Node.js và Express. Đảm nhiệm các Worker Bot cào dữ liệu HSDC/UDi/VOV, Real-time Sync và API cho AI Copilot.', 'Đang dùng'],
        ['Backend AI (Python)', 'Xây dựng bằng Python với framework FastAPI để xử lý luồng chạy mô hình XGBoost và cung cấp RESTful API.', 'Đang dùng'],
        ['Cơ sở dữ liệu', 'Sử dụng PostgreSQL kết hợp tiện ích PostGIS (trên nền tảng Supabase) để xử lý các truy vấn không gian tốc độ cao.', 'Đang dùng'],
        ['Triển khai (Hosting)', 'Giao diện được lưu trữ tĩnh trên GitHub Pages, Backend AI được triển khai trên Render.com Cloud.', 'Đang dùng']
    ]
    for r_i, row in enumerate(t4.rows):
        for c_i, cell in enumerate(row.cells):
            cell.text = t4_data[r_i][c_i]
            
    # 4. Kết quả đạt được và Đánh giá
    add_heading_styled(doc, "4. Kết quả đạt được và Đánh giá", level=2, space_before=12, space_after=6)
    add_heading_styled(doc, "4.1. Kết quả đạt được", level=3, space_before=8, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    p.add_run(
        "Trải qua quá trình nghiên cứu và phát triển nghiêm túc, nhóm tác giả đã xây dựng hoàn chỉnh nguyên mẫu hệ thống MoveSafe VN (Prototype v1.0) với đầy đủ các tính năng đã đề ra, được nghiệm thu và vận hành thực tế:"
    )
    
    results_list = [
        ("Xây dựng thành công ứng dụng Web hoàn chỉnh: ", "Giao diện mang phong cách hiện đại với hiệu ứng Glassmorphism mờ ảo, hỗ trợ cả giao diện Sáng và Tối (Light/Dark Mode). Bản đồ tương tác tải siêu tốc, mượt mà đạt chuẩn 60 khung hình/giây (fps) trên cả máy tính để bàn và thiết bị di động."),
        ("Thuật toán Định tuyến Né ngập vận hành chính xác: ", "Hệ thống phát hiện chuẩn xác các rốn ngập trên tuyến đường, tính toán và vẽ lộ trình an toàn màu xanh lá trong thời gian dưới 1.2 giây, đồng thời phát sinh thông báo trực quan cảnh báo người lái xe về mực nước ngập sâu cm."),
        ("Trợ lý AI Copilot phản hồi thông minh, nhanh chóng: ", "Thời gian suy luận và trả lời người dùng chỉ dưới 0.8 giây với Bộ não cục bộ và dưới 2 giây với Gemini API. Trợ lý nắm vững từ điển địa lý 76 phường của Hà Nội, tự động điều khiển bản đồ bay đến điểm nóng chính xác 100%."),
        ("Hệ thống Báo cáo Cộng đồng đồng bộ thời gian thực: ", "Cơ chế đa tab hoạt động trơn tru qua BroadcastChannel và REST API. Khi một người dùng gửi báo cáo ngập/kẹt xe, marker lập tức xuất hiện trên bản đồ của tất cả người dùng khác kèm âm thanh 'Ping!' cảnh báo tức thời."),
        ("Chuỗi dữ liệu tự động khép kín: ", "Worker Bot tự động thu thập và đồng bộ dữ liệu thời tiết, kẹt xe TomTom và rốn ngập HSDC mỗi 5 phút một lần, đảm bảo thông tin hiển thị trên bản đồ luôn phản ánh trung thực hiện trạng đô thị.")
    ]
    for r_title, r_desc in results_list:
        bp = doc.add_paragraph()
        bp.style = doc.styles['Normal']
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        bp.paragraph_format.line_spacing = 1.2
        bp.paragraph_format.left_indent = Inches(0.25)
        bp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_b = bp.add_run("• ")
        r_b.font.name = 'Times New Roman'
        r_b.font.bold = True
        r_b.font.size = Pt(13)
        r1 = bp.add_run(r_title)
        r1.font.name = 'Times New Roman'
        r1.font.bold = True
        r1.font.size = Pt(13)
        r2 = bp.add_run(r_desc)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(13)
        
    # 4.2. Hình ảnh minh họa giao diện và tính năng hệ thống
    add_heading_styled(doc, "4.2. Hình ảnh minh họa giao diện và tính năng hệ thống", level=3, space_before=10, space_after=4)
    
    figures_info = [
        ("Hình 1: Giao diện tổng quan hệ thống MoveSafe VN", 
         "Giám sát thời tiết, cảnh báo rốn ngập HSDC/UDi và lưu lượng giao thông TomTom thời gian thực tại Hà Nội.",
         "Ảnh chụp màn hình thể hiện giao diện trung tâm điều hành bản đồ tác chiến. Các rốn ngập được đánh dấu bằng Marker giọt nước có hiệu ứng tỏa sóng động (ripple animation) tương ứng với độ sâu ngập (cm). Lớp phủ TomTom Traffic hiển thị màu sắc mật độ kẹt xe thực tế trên các tuyến đường. Ba thẻ widget góc trên cung cấp thông tin thời tiết, mực nước ngập và tình trạng giao thông trực quan."),
        ("Hình 2: Phân hệ Dẫn đường thông minh (Smart Routing)", 
         "Đề xuất tuyến đường tối ưu né ngập đa phương tiện kết hợp thanh trượt dự báo giao thông AI (+1h tới) và gợi ý phân tích tự động.",
         "Ảnh chụp màn hình minh họa thuật toán Smart Routing khi phát hiện rốn ngập nguy hiểm Nguyễn Khuyến (35cm). Lộ trình ngắn nhất có rủi ro bị đánh dấu nét đứt màu đỏ, trong khi lộ trình an toàn màu xanh lá được tự động tính toán bẻ góc đi vòng qua khu vực khô ráo. Bảng điều khiển bên trái cho phép lựa chọn 3 hành lang giao thông và điều chỉnh thanh trượt dự báo tương lai (+1h, +2h, +3h)."),
        ("Hình 3: Trợ lý giao thông AI Copilot", 
         "Tư vấn trực tiếp tình trạng ngập nước, cảnh báo ùn tắc và hướng dẫn lộ trình di chuyển an toàn cho người dân.",
         "Ảnh chụp màn hình hộp thoại trợ lý ảo AI Copilot. Người dùng có thể tra cứu thông tin bất kỳ phường hoặc tuyến phố nào bằng ngôn ngữ tự nhiên hoặc giọng nói tiếng Việt. AI phân tích dữ liệu thực tế và đưa ra lời khuyên chi tiết về mực nước, phương tiện di chuyển phù hợp, đồng thời tự động điều khiển bản đồ bay đến tọa độ khu vực đang được hỏi."),
        ("Hình 4: Phân hệ Báo cáo cộng đồng (Crowdsourcing)", 
         "Cho phép người tham gia giao thông trực tiếp cập nhật điểm ngập sâu và sự cố đường bộ theo thời gian thực.",
         "Ảnh chụp màn hình phân hệ Crowdsourcing. Người tham gia giao thông có thể mở hộp thoại 'Báo Cáo Điểm Ngập / Kẹt Xe', chọn vị trí, tuyến đường, mức ngập trực quan (mắt cá chân, nửa bánh xe, ngập lút yên xe) và gửi lên hệ thống. Bản ghi được ghim ngay lập tức lên bản đồ và đồng bộ đa thiết bị theo thời gian thực.")
    ]
    
    for fig_idx, (fig_title, fig_sub, fig_desc) in enumerate(figures_info):
        p_fig = create_styled_paragraph(doc, space_before=8, space_after=3, align='left')
        r_title = p_fig.add_run(f"• {fig_title} - ")
        r_title.bold = True
        p_fig.add_run(fig_sub)
        
        # Add the drawing
        if fig_idx < len(img_drawings):
            p_img = doc.add_paragraph()
            p_img.paragraph_format.space_before = Pt(3)
            p_img.paragraph_format.space_after = Pt(4)
            p_img.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_img.paragraph_format.keep_with_next = True
            
            run_img = p_img.add_run()
            run_img._element.append(copy.deepcopy(img_drawings[fig_idx]))
            
        p_desc = create_styled_paragraph(doc, space_before=2, space_after=6, italic=True)
        p_desc.add_run(f"Chú giải {fig_title.split(':')[0]}: {fig_desc}")
        
    # 4.3. Đánh giá Ưu điểm & Hạn chế
    add_heading_styled(doc, "4.3. Đánh giá Ưu điểm & Hạn chế", level=3, space_before=10, space_after=4)
    
    p = create_styled_paragraph(doc, space_after=4)
    p.add_run(
        "Nhóm tác giả đã thực hiện đối soát, đánh giá khách quan toàn diện hệ thống MoveSafe VN dựa trên quá trình thử nghiệm thực tế với hơn 100 kịch bản ngập lụt và kẹt xe giả lập tại các quận nội thành Hà Nội:"
    )
    
    p = create_styled_paragraph(doc, text="Bảng 4. Đánh giá chi tiết", space_before=6, space_after=4, bold=True)
    
    # Insert Table 5 (Bảng 4)
    t5 = doc.add_table(rows=3, cols=2)
    t5_data = [
        ['Khía cạnh', 'Nội dung'],
        ['Ưu điểm', 'Kiến trúc Microservices gọn nhẹ, tốc độ phản hồi cực nhanh dưới 1.2s. Khả năng kết hợp linh hoạt giữa GIS, dữ liệu thời gian thực và AI dự báo tương lai. Giao diện thân thiện, dễ sử dụng cho mọi lứa tuổi.'],
        ['Hạn chế', 'Ở giai đoạn hiện tại, mô hình XGBoost chủ yếu được huấn luyện trên nguồn dữ liệu bán thực tế và giả lập. Trong tương lai cần nguồn dữ liệu quan trắc cảm biến IoT quy mô lớn từ Sở GTVT và Công ty Thoát nước để nâng cao độ chính xác.']
    ]
    for r_i, row in enumerate(t5.rows):
        for c_i, cell in enumerate(row.cells):
            cell.text = t5_data[r_i][c_i]
            
    # 5. Kế hoạch phát triển
    add_heading_styled(doc, "5. Kế hoạch phát triển", level=2, space_before=12, space_after=6)
    
    p = create_styled_paragraph(doc, space_after=4)
    p.add_run(
        "Để đưa MoveSafe VN từ một dự án dự thi sáng tạo trở thành một sản phẩm công nghệ hoàn chỉnh phục vụ đắc lực cho đời sống xã hội, nhóm tác giả đã xây dựng lộ trình phát triển rõ ràng với 3 giai đoạn chiến lược:"
    )
    
    p = create_styled_paragraph(doc, text="Bảng 5. Ba giai đoạn phát triển dự kiến", space_before=6, space_after=4, bold=True)
    
    # Insert Table 6 (Bảng 5)
    t6 = doc.add_table(rows=4, cols=3)
    t6_data = [
        ['Giai đoạn', 'Công việc chính', 'Kết quả mong đợi'],
        ['Giai đoạn 1 (Đã hoàn thành)', 'Xây dựng thành công bản thử nghiệm (MVP), tích hợp trơn tru giữa bản đồ Leaflet, CSDL Supabase PostGIS và Backend AI.', 'Bản demo có độ hoàn thiện cao để trình diễn tại cuộc thi Centric Data AI 2026.'],
        ['Giai đoạn 2 (Hoàn thiện đi thi)', 'Thu thập thêm dữ liệu quan trắc thực tế, tinh chỉnh thuật toán định tuyến né ngập và hoàn thiện tài liệu thuyết minh bảo vệ.', 'Hệ thống hoạt động chính xác với dữ liệu thực tế tại 76 phường nội thành Hà Nội.'],
        ['Giai đoạn 3 (Định hướng tương lai)', 'Đề xuất hợp tác với các nền tảng xe công nghệ (Grab, Be...) để sử dụng nguồn dữ liệu di chuyển thực tế. Tái huấn luyện mô hình học sâu và ra mắt ứng dụng Mobile.', 'Ứng dụng di động MoveSafe VN trên iOS/Android và cung cấp API dịch vụ B2B cho các đơn vị vận tải.']
    ]
    for r_i, row in enumerate(t6.rows):
        for c_i, cell in enumerate(row.cells):
            cell.text = t6_data[r_i][c_i]
            
    # D. PHỤ LỤC
    add_heading_styled(doc, "D. PHỤ LỤC", level=1, space_before=14, space_after=6)
    
    p = create_styled_paragraph(doc, space_after=3)
    r = p.add_run("1. Kho lưu trữ mã nguồn (GitHub): ")
    r.bold = True
    p.add_run("https://github.com/movesafe123/movesafe1234")
    
    p = create_styled_paragraph(doc, space_after=3)
    r = p.add_run("2. Bản thử nghiệm trực tuyến (Demo Web): ")
    r.bold = True
    p.add_run("https://movesafe123.github.io/movesafe1234/")
    
    p = create_styled_paragraph(doc, space_after=3)
    r = p.add_run("3. Máy chủ tính toán AI (Render Cloud API): ")
    r.bold = True
    p.add_run("https://movesafe1234.onrender.com")
    
    # Save the updated docx
    temp_output = 'baocaobaithi.docx'
    doc.save(temp_output)
    print(f"Saved document with enriched content to {temp_output}!")
    
    # 5. Apply table formatting to all 6 tables!
    print("Applying perfect table formatting (eliminating text stretching bug)...")
    from fix_tables import fix_all_tables_in_doc
    fix_all_tables_in_doc(temp_output)
    print("Done rebuilding entire document successfully!")

if __name__ == '__main__':
    main()
