$origPath = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$tempPath = 'C:\Users\Admin\temp_work.docx'

Copy-Item -Path $origPath -Destination $tempPath -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($tempPath)
    Write-Output "Successfully opened temp docx. Paragraph count: $($doc.Paragraphs.Count)"
    
    $range = $doc.Content
    $find = $range.Find
    $find.Text = "4.1."
    $found = $find.Execute()
    Write-Output "Found '4.1.': $found"
    if ($found) {
        Write-Output "Text found: $($range.Text)"
    }

    $range2 = $doc.Content
    $find2 = $range2.Find
    $find2.Text = "4.2."
    $found2 = $find2.Execute()
    Write-Output "Found '4.2.': $found2"
    if ($found2) {
        Write-Output "Text found: $($range2.Text)"
    }

    $doc.Close([ref]0)
} catch {
    Write-Output "Error: $($_.Exception.Message)"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Remove-Item -Path $tempPath -Force -ErrorAction SilentlyContinue
}
