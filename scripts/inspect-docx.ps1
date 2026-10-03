$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open('C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx')
Write-Output "Total Paragraphs: $($doc.Paragraphs.Count)"
for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
    $txt = $doc.Paragraphs.Item($i).Range.Text.Trim()
    if ($txt -match "^4\." -or $txt -match "^4 " -or $txt -match "^5\.") {
        Write-Output "P $i : $txt"
    }
}
$doc.Close()
$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
