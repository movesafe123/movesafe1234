$src = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$dst = 'C:\Users\Admin\temp_test.docx'
Copy-Item $src $dst
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($dst)
    Write-Output "SUCCESS: Paragraph Count = $($doc.Paragraphs.Count)"
    $doc.Close([ref]0) # wdDoNotSaveChanges
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Remove-Item $dst -ErrorAction SilentlyContinue
}
