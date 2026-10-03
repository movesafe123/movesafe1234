$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$doc = $word.Documents.Add()
$range = $doc.Content

# Add Title
$range.Text = "TEST INSERT PICTURE`r`n"
$range.Font.Bold = 1
$range.Font.Size = 14

# Collapse to end
$range.Collapse(0)

# Add Picture
$imgPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\public\screenshots\hinh1_tongquan_bando.png'
$shape = $range.InlineShapes.AddPicture($imgPath)
$shape.LockAspectRatio = -1
$shape.Width = 420
Write-Output "Shape added. Type: $($shape.Type), Width: $($shape.Width)"

# Move to end after picture
$capRange = $doc.Content
$capRange.Collapse(0)
$capRange.InsertParagraphAfter()
$capRange.Collapse(0)
$capRange.Text = "Hinh 1: Giao dien tong quan MoveSafe VN`r`n"
$capRange.Font.Italic = 1

$testPath = 'C:\Users\Admin\test_single_pic.docx'
$doc.SaveAs([ref]$testPath)
$doc.Close([ref]0)
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

Write-Output "Test saved. Checking inline shapes count in saved file:"
$word2 = New-Object -ComObject Word.Application
$word2.Visible = $false
$doc2 = $word2.Documents.Open($testPath)
Write-Output "InlineShapes in saved file: $($doc2.InlineShapes.Count)"
$doc2.Close([ref]0)
$word2.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word2) | Out-Null
Remove-Item $testPath -Force
