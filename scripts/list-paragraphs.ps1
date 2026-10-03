$src = 'C:\Users\Admin\OneDrive\Desktop\web du thi\baocaobaithi.docx'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($src)
    for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
        $text = $doc.Paragraphs.Item($i).Range.Text.Trim()
        if ($text.Length -gt 0) {
            # In ra nếu là tiêu đề hoặc đoạn ngắn
            if ($text.Length -lt 80 -or $text -match '^[0-9]\.' -or $text -match '^[A-Z]\.') {
                Write-Output "[$i] $text"
            }
        }
    }
    $doc.Close([ref]0)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
