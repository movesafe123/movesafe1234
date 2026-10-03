$origPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$tempPath = 'C:\Users\Admin\temp_insert_test.docx'
$jsonPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\scripts\doc_content.json'

Copy-Item -Path $origPath -Destination $tempPath -Force

$jsonText = [System.IO.File]::ReadAllText($jsonPath, [System.Text.Encoding]::UTF8)
$data = ConvertFrom-Json $jsonText

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($tempPath)
    Write-Output "Initial paragraphs: $($doc.Paragraphs.Count)"

    # Tìm vị trí "4.2."
    $range = $doc.Content
    $find = $range.Find
    $find.Text = "4.2."
    $found = $find.Execute()

    if ($found) {
        Write-Output "Found 4.2., replacing with 4.3...."
        $range.Text = "4.3."

        # Lấy Range tại đầu đoạn văn bản 4.3.
        $targetPara = $range.Paragraphs.Item(1)
        $insRange = $targetPara.Range
        $insRange.Collapse(1) # 1 = wdCollapseStart

        # Chèn tiêu đề mục 4.2
        $insRange.InsertParagraphBefore()
        $titleRange = $insRange.Paragraphs.Item(1).Range
        $titleRange.Text = $data.sectionTitle + "`n"
        $titleRange.Font.Bold = 1
        $titleRange.Font.Size = 13
        $titleRange.Font.Name = "Times New Roman"
        $titleRange.ParagraphFormat.Alignment = 0 # wdAlignParagraphLeft = 0
        $titleRange.ParagraphFormat.SpaceBefore = 12
        $titleRange.ParagraphFormat.SpaceAfter = 6

        # Lặp qua từng ảnh để chèn
        $currRange = $targetPara.Range
        $currRange.Collapse(1)

        foreach ($item in $data.items) {
            Write-Output "Inserting image: $($item.imagePath)"
            
            # Chèn dòng trống cho ảnh
            $currRange.InsertParagraphBefore()
            $picParaRange = $currRange.Paragraphs.Item(1).Range
            $picParaRange.ParagraphFormat.Alignment = 1 # Center
            $picParaRange.ParagraphFormat.SpaceBefore = 6
            $picParaRange.ParagraphFormat.SpaceAfter = 4

            # Thêm ảnh
            $shape = $picParaRange.InlineShapes.AddPicture($item.imagePath)
            $shape.LockAspectRatio = -1 # msoTrue = -1
            $shape.Width = 440

            # Chèn dòng trống cho caption
            $currRange.InsertParagraphBefore()
            $capParaRange = $currRange.Paragraphs.Item(1).Range
            $capParaRange.Text = $item.caption + "`n"
            $capParaRange.Font.Italic = 1
            $capParaRange.Font.Bold = 0
            $capParaRange.Font.Size = 10
            $capParaRange.Font.Name = "Times New Roman"
            $capParaRange.ParagraphFormat.Alignment = 1 # Center
            $capParaRange.ParagraphFormat.SpaceBefore = 2
            $capParaRange.ParagraphFormat.SpaceAfter = 12
        }

        $doc.Save()
        Write-Output "Successfully saved document! New paragraph count: $($doc.Paragraphs.Count)"
    } else {
        Write-Output "Could not find '4.2.'"
    }

    $doc.Close([ref]-1) # wdSaveChanges = -1
} catch {
    Write-Output "Error: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
