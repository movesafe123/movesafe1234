$src = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($src)
    $range = $doc.Content
    $find = $range.Find
    $find.Text = "4. Kết quả và Đánh giá"
    $found = $find.Execute()
    Write-Output "Found '4. Kết quả và Đánh giá': $found"

    $range2 = $doc.Content
    $find2 = $range2.Find
    $find2.Text = "4.1. Kết quả đạt được"
    $found2 = $find2.Execute()
    Write-Output "Found '4.1. Kết quả đạt được': $found2"

    $range3 = $doc.Content
    $find3 = $range3.Find
    $find3.Text = "4.2. Ưu điểm và Hạn chế"
    $found3 = $find3.Execute()
    Write-Output "Found '4.2. Ưu điểm và Hạn chế': $found3"

    $doc.Close([ref]0)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
