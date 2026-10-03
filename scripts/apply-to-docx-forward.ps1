$backupPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi_backup.docx'
$tempWorkPath = 'C:\Users\Admin\temp_work_forward.docx'
$finalDocxPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$finalPdfPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.pdf'
$jsonPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\scripts\doc_content.json'

Copy-Item -Path $backupPath -Destination $tempWorkPath -Force

$jsonText = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$data = ConvertFrom-Json $jsonText

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($tempWorkPath)
    Write-Output "Initial paragraphs: $($doc.Paragraphs.Count)"

    # 1. Tìm và đổi "4.2." thành "4.3."
    $findRange = $doc.Content
    $find = $findRange.Find
    $find.Text = "4.2."
    $found = $find.Execute()
    if (-not $found) {
        throw "Could not find '4.2.'"
    }
    $findRange.Text = "4.3."
    Write-Output "Updated '4.2.' to '4.3.'"

    # 2. Lấy vị trí ngay trước đoạn "4.3."
    $para43 = $findRange.Paragraphs.Item(1)
    $insertPoint = $para43.Range
    $insertPoint.Collapse(1) # 1 = wdCollapseStart

    # 3. Chèn tiêu đề 4.2
    $insertPoint.InsertBefore($data.sectionTitle + "`r`n")
    # Định dạng tiêu đề vừa chèn
    $titlePara = $insertPoint.Paragraphs.Item(1)
    $titlePara.Range.Font.Bold = 1
    $titlePara.Range.Font.Size = 13
    $titlePara.Range.Font.Name = "Times New Roman"
    $titlePara.Range.ParagraphFormat.Alignment = 0 # Left
    $titlePara.Range.ParagraphFormat.SpaceBefore = 14
    $titlePara.Range.ParagraphFormat.SpaceAfter = 10

    # Chuyển con trỏ xuống sau tiêu đề (trước 4.3)
    $currPos = $para43.Range
    $currPos.Collapse(1)

    # 4. Lần lượt chèn từng cặp: [Ảnh] -> [Caption bên dưới ảnh]
    for ($i = 0; $i -lt $data.items.Count; $i++) {
        $item = $data.items[$i]
        $imgNum = $i + 1
        Write-Output "Appending Image ${imgNum} and caption..."

        # Chèn đoạn cho ảnh
        $currPos.InsertParagraphBefore()
        $picPara = $currPos.Paragraphs.Item(1).Previous()
        $picPara.Range.ParagraphFormat.Alignment = 1 # Center
        $picPara.Range.ParagraphFormat.SpaceBefore = 10
        $picPara.Range.ParagraphFormat.SpaceAfter = 4

        # Thêm ảnh vào đoạn
        $shape = $picPara.Range.InlineShapes.AddPicture($item.imagePath)
        $shape.LockAspectRatio = -1 # msoTrue
        $shape.Width = 420

        # Chèn đoạn cho caption ngay dưới ảnh
        $currPos.InsertParagraphBefore()
        $capPara = $currPos.Paragraphs.Item(1).Previous()
        $capPara.Range.Text = $item.caption + "`r`n"
        $capPara.Range.Font.Italic = 1
        $capPara.Range.Font.Bold = 0
        $capPara.Range.Font.Size = 10
        $capPara.Range.Font.Name = "Times New Roman"
        $capPara.Range.ParagraphFormat.Alignment = 1 # Center
        $capPara.Range.ParagraphFormat.SpaceBefore = 3
        $capPara.Range.ParagraphFormat.SpaceAfter = 14
    }

    $doc.Save()
    Write-Output "Document saved successfully! Paragraphs: $($doc.Paragraphs.Count)"

    # Xuất file PDF hoàn thiện
    $doc.SaveAs([ref]$finalPdfPath, [ref]17)
    Write-Output "Exported PDF to: $finalPdfPath"

    $doc.Close([ref]-1)
} catch {
    Write-Error "Error: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Copy-Item -Path $tempWorkPath -Destination $finalDocxPath -Force
Remove-Item -Path $tempWorkPath -Force -ErrorAction SilentlyContinue

Write-Output "SUCCESS: Final baocaobaithi.docx updated with correct order & captions!"
