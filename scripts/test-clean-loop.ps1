$backupPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi_backup.docx'
$tempWorkPath = 'C:\Users\Admin\temp_clean_loop.docx'
$finalPdfPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocao_test_loop.pdf'
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
    if (-not $found) { throw "Could not find 4.2." }
    $findRange.Text = "4.3."
    Write-Output "Replaced 4.2. with 4.3."

    # Lấy đoạn 4.3
    $targetPara = $findRange.Paragraphs.Item(1)

    # 2. Chèn tiêu đề 4.2 trước targetPara
    $rng = $targetPara.Range
    $rng.Collapse(1) # wdCollapseStart
    $rng.InsertBefore($data.sectionTitle + "`r`n")
    
    # Định dạng tiêu đề 4.2
    $titlePara = $targetPara.Previous()
    $titlePara.Range.Font.Bold = 1
    $titlePara.Range.Font.Size = 13
    $titlePara.Range.Font.Name = "Times New Roman"
    $titlePara.Range.ParagraphFormat.Alignment = 0 # Left
    $titlePara.Range.ParagraphFormat.SpaceBefore = 14
    $titlePara.Range.ParagraphFormat.SpaceAfter = 10

    # 3. Lần lượt chèn 4 ảnh và caption
    for ($i = 0; $i -lt $data.items.Count; $i++) {
        $item = $data.items[$i]
        $imgNum = $i + 1
        Write-Output "Inserting Image ${imgNum}..."

        # Điểm chèn ngay trước targetPara
        $rng = $targetPara.Range
        $rng.Collapse(1)

        # Chèn ảnh
        $shape = $rng.InlineShapes.AddPicture($item.imagePath)
        $shape.LockAspectRatio = -1
        $shape.Width = 420
        $shape.Range.ParagraphFormat.Alignment = 1 # Center
        $shape.Range.ParagraphFormat.SpaceBefore = 10
        $shape.Range.ParagraphFormat.SpaceAfter = 4

        # Điểm chèn cho caption (ngay trước targetPara, tức là ngay dưới ảnh)
        $rng = $targetPara.Range
        $rng.Collapse(1)
        $rng.InsertBefore($item.caption + "`r`n")

        # Định dạng caption
        $capPara = $targetPara.Previous()
        $capPara.Range.Font.Italic = 1
        $capPara.Range.Font.Bold = 0
        $capPara.Range.Font.Size = 10
        $capPara.Range.Font.Name = "Times New Roman"
        $capPara.Range.ParagraphFormat.Alignment = 1
        $capPara.Range.ParagraphFormat.SpaceBefore = 3
        $capPara.Range.ParagraphFormat.SpaceAfter = 14
    }

    Write-Output "InlineShapes in document: $($doc.InlineShapes.Count)"
    $doc.Save()
    $doc.SaveAs([ref]$finalPdfPath, [ref]17)
    Write-Output "Exported test PDF to: $finalPdfPath"
    $doc.Close([ref]-1)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
