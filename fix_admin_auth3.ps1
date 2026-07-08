
# Fix the literal \r\n that was introduced by the previous script

$files = Get-ChildItem -Path "src\routes\admin.*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    # Fix literal \r\n and \n strings back to actual newlines
    $content = $content -replace '\\r\\n', "`r`n"
    $content = $content -replace '\\n', "`n"

    # Also simplify the redundant "if (!session) + const token = session" pattern
    # into just "if (!session) throw..." and use session directly
    $content = $content -replace `
        '      if \(!session\) throw new Error\("Not authenticated"\);\r?\n      const token = session;\r?\n\r?\n',
        "      if (!session) throw new Error(`"Not authenticated`");`r`n"

    Set-Content $file.FullName $content -Encoding UTF8
    Write-Host "Fixed: $($file.Name)"
}

Write-Host "Done!"
