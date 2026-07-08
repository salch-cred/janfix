$files = Get-ChildItem -Path "src\routes\admin.*.tsx"

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    
    # Fix literal backslash-r-backslash-n sequences (from PS escape issue)
    # They appear as backslash + r + backslash + n in the file
    $text = $text.Replace("\r`n", "`r`n")
    $text = $text.Replace("\n", "`n")
    
    $outBytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    [System.IO.File]::WriteAllBytes($file.FullName, $outBytes)
    Write-Host "Fixed: $($file.Name)"
}

Write-Host "Done!"
