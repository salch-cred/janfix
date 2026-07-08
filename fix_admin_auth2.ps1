
# Fix remaining inline supabase.auth.getSession() calls in admin routes
# These have a different indentation/format that the first script missed

$files = Get-ChildItem -Path "src\routes\admin.*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content

    # Pattern A: the call plus the next line using sessionData.session
    $content = $content -replace `
        '      const \{ data: sessionData \} = await supabase\.auth\.getSession\(\);\r?\n      const token = sessionData\.session;\r?\n      if \(!token\) throw new Error\("Not authenticated"\);\r?\n\r?\n',
        "      if (!session) throw new Error(`"Not authenticated`");\r`n      const token = session;\r`n`r`n"

    # Pattern B: the call plus the next line using sessionData.session?.access_token
    $content = $content -replace `
        '      const \{ data: sessionData \} = await supabase\.auth\.getSession\(\);\r?\n',
        ''

    # Replace remaining sessionData.session.access_token references
    $content = $content -replace 'access_token: sessionData\.session\?\.access_token', 'access_token: session'
    $content = $content -replace 'access_token: sessionData\.session\.access_token', 'access_token: session'
    $content = $content -replace 'if \(!sessionData\.session\)', 'if (!session)'
    $content = $content -replace 'sessionData\.session\?\.access_token', 'session'
    $content = $content -replace 'sessionData\.session\.access_token', 'session'
    $content = $content -replace 'sessionData\.session', 'session'

    if ($content -ne $original) {
        Set-Content $file.FullName $content -Encoding UTF8
        Write-Host "Updated: $($file.Name)"
    } else {
        Write-Host "No changes: $($file.Name)"
    }
}

Write-Host "`nDone!"
