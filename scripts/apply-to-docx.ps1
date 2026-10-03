$backupPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi_backup.docx'
$tempWorkPath = 'C:\Users\Admin\temp_work_final.docx'
$finalDocxPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$finalPdfPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.pdf'
$jsonPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\scripts\doc_content.json'

# Khởi tạo bản nháp từ backup gốc chưa bị chèn lỗi
Copy-Item -Path $backupPath -Destination $tempWorkPath -Force

$jsonText = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$data = ConvertFrom-Json $jsonText

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($tempWorkPath)
    Write-Output "Initial paragraphs in clean doc: $($doc.Paragraphs.Count)"

    # Tìm vị trí tiêu đề "4.2."
    $range = $doc.Content
    $find = $range.Find
    $find.Text = "4.2."
    $found = $find.Execute()

    if ($found) {
        Write-Output "Found '4.2.', converting to '4.3.'..."
        $range.Text = "4.3."

        # Lấy Range tại đầu đoạn văn bản 4.3.
        $targetPara = $range.Paragraphs.Item(1)
        
        # Chèn từng hình theo thứ tự ngược: Hình 4 -> Hình 3 -> Hình 2 -> Hình 1
        # Với mỗi hình: Chèn Caption trước, sau đó Chèn Ảnh phía trên Caption
        for ($i = $data.items.Count - 1; $i -ge 0; $i--) {
            $item = $data.items[$i]
            $num = $i + 1
            Write-Output "Inserting Image ${num}: $($item.imagePath)"

            # 1. Chèn đoạn Caption trước target
            $capRange = $targetPara.Range
            $capRange.Collapse(1) # wdCollapseStart
            $capRange.InsertParagraphBefore()
            $capPara = $capRange.Paragraphs.Item(1)
            $capPara.Range.Text = $item.caption + "`n"
            $capPara.Range.Font.Italic = 1
            $capPara.Range.Font.Bold = 0
            $capPara.Range.Font.Size = 10
            $capPara.Range.Font.Name = "Times New Roman"
            $capPara.Range.ParagraphFormat.Alignment = 1 # Center
            $capPara.Range.ParagraphFormat.SpaceBefore = 3
            $capPara.Range.ParagraphFormat.SpaceAfter = 14

            # 2. Chèn đoạn Ảnh ngay trên đoạn Caption vừa tạo
            $picRange = $capPara.Range
            $picRange.Collapse(1)
            $picRange.InsertParagraphBefore()
            $picPara = $picRange.Paragraphs.Item(1)
            $picPara.Range.ParagraphFormat.Alignment = 1 # Center
            $picPara.Range.ParagraphFormat.SpaceBefore = 10
            $picPara.Range.ParagraphFormat.SpaceAfter = 3

            # Thêm Shape ảnh vào picPara
            $shape = $picPara.Range.InlineShapes.AddPicture($item.imagePath)
            $shape.LockAspectRatio = -1 # msoTrue
            $shape.Width = 430
        }

        # 3. Cuối cùng, chèn Tiêu đề mục 4.2 lên đầu khối hình
        $firstPicPara = $targetPara.Range
        # Di chuyển lên đầu khối vừa chèn (trước hình 1)
        $docContent = $doc.Content
        $find41 = $docContent.Find
        $find41.Text = "4.1."
        if ($find41.Execute()) {
            # Tìm đoạn cuối của 4.1 để chèn tiêu đề 4.2
            Write-Output "Locating insertion point for section 4.2 title..."
        }

        # Lấy vị trí ngay trước bức ảnh đầu tiên (Hình 1)
        # Bức ảnh đầu tiên đang nằm ở đoạn trước caption 1
        # Ta có thể tìm kiếm lại cụm caption 1 để lấy vị trí
        $searchRange = $doc.Content
        $searchFind = $searchRange.Find
        $searchFind.Text = "Hình 1:"
        if ($searchFind.Execute()) {
            $h1CapPara = $searchRange.Paragraphs.Item(1)
            # Đoạn trước caption 1 là đoạn chứa hình 1
            $h1PicPara = $h1CapPara.Previous()
            if ($h1PicPara) {
                $titleRange = $h1PicPara.Range
                $titleRange.Collapse(1)
                $titleRange.InsertParagraphBefore()
                $titlePara = $titleRange.Paragraphs.Item(1)
                $titlePara.Range.Text = $data.sectionTitle + "`n"
                $titlePara.Range.Font.Bold = 1
                $titlePara.Range.Font.Size = 13
                $titlePara.Range.Font.Name = "Times New Roman"
                $titlePara.Range.ParagraphFormat.Alignment = 0 # Left
                $titlePara.Range.ParagraphFormat.SpaceBefore = 14
                $titlePara.Range.ParagraphFormat.SpaceAfter = 8
            }
        }

        $doc.Save()
        Write-Output "Successfully updated Word doc! Total paragraphs: $($doc.Paragraphs.Count)"

        # Xuất ra file PDF chất lượng cao để nộp và xem trước
        $doc.SaveAs([ref]$finalPdfPath, [ref]17)
        Write-Output "Exported PDF to: $finalPdfPath"
    } else {
        Write-Error "Could not find section 4.2. in document!"
    }

    $doc.Close([ref]-1)
} catch {
    Write-Error "Error: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

# Sao chép file hoàn thiện đè vào file gốc của user
Copy-Item -Path $tempWorkPath -Destination $finalDocxPath -Force
Remove-Item -Path $tempWorkPath -Force -ErrorAction SilentlyContinue

Write-Output "SUCCESS: Updated $finalDocxPath with high-res real screenshots!"
