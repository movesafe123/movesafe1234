$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open('C:\Users\Admin\temp_insert_test.docx')
    $pdfPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocao_preview.pdf'
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    Write-Output "Exported PDF successfully to $pdfPath"
    $doc.Close([ref]0)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
