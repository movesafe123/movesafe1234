$backupPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi_backup.docx'
$tempWorkPath = 'C:\Users\Admin\temp_fixed_paras.docx'
$finalPdfPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocao_test_fixed.pdf'
$jsonPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\scripts\doc_content.json'

Copy-Item -Path $backupPath -Destination $tempWorkPath -Force

$jsonText = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$data = ConvertFrom-Json $jsonText

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($tempWorkPath)

    # 1. Tìm và đổi "4.2." thành "4.3."
    $findRange = $doc.Content
    $find = $findRange.Find
    $find.Text = "4.2."
    $found = $find.Execute()
    if (-not $found) { throw "Could not find 4.2." }
    $findRange.Text = "4.3."

    # Lấy đoạn 4.3 làm mốc chặn dưới
    $para43 = $findRange.Paragraphs.Item(1)

    # Thêm Tiêu đề 4.2
    $ins = $para43.Range
    $ins.Collapse(1)
    $ins.InsertBefore($data.sectionTitle + "`r`n")
    $titlePara = $para43.Previous()
    $titlePara.Range.Font.Bold = 1
    $titlePara.Range.Font.Size = 13
    $titlePara.Range.Font.Name = "Times New Roman"
    $titlePara.Range.ParagraphFormat.SpaceBefore = 14
    $titlePara.Range.ParagraphFormat.SpaceAfter = 8

    # Lần lượt với từng ảnh:
    for ($i = 0; $i -lt $data.items.Count; $i++) {
        $item = $data.items[$i]

        # 1. Tạo đoạn cho Ảnh
        $ins = $para43.Range
        $ins.Collapse(1)
        $ins.InsertParagraphBefore()
        $pPic = $para43.Previous()
        $pPic.Range.ParagraphFormat.Alignment = 1 # Center
        $pPic.Range.ParagraphFormat.SpaceBefore = 10
        $pPic.Range.ParagraphFormat.SpaceAfter = 4
        $pPic.Range.ParagraphFormat.KeepWithNext = -1 # Luôn đi liền với caption bên dưới!

        # Chèn ảnh vào đúng đoạn $pPic
        $picRange = $pPic.Range
        $picRange.Collapse(1)
        $shape = $picRange.InlineShapes.AddPicture($item.imagePath)
        $shape.LockAspectRatio = -1
        $shape.Width = 400

        # 2. Tạo đoạn cho Caption ngay sau ảnh (trước para43)
        $ins = $para43.Range
        $ins.Collapse(1)
        $ins.InsertParagraphBefore()
        $pCap = $para43.Previous()
        $pCap.Range.Text = $item.caption + "`r`n"
        $pCap.Range.Font.Italic = 1
        $pCap.Range.Font.Bold = 0
        $pCap.Range.Font.Size = 10
        $pCap.Range.Font.Name = "Times New Roman"
        $pCap.Range.ParagraphFormat.Alignment = 1 # Center
        $pCap.Range.ParagraphFormat.SpaceBefore = 2
        $pCap.Range.ParagraphFormat.SpaceAfter = 14
    }

    $doc.Save()
    $doc.SaveAs([ref]$finalPdfPath, [ref]17)
    Write-Output "Exported PDF to: $finalPdfPath"
    $doc.Close([ref]-1)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
