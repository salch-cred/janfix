
# Bulk replace Supabase auth patterns in all admin route files with useAdminSession hook

$files = Get-ChildItem -Path "src\routes\admin.*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    # 1. Replace import line
    $content = $content -replace `
        'import \{ supabase \} from "@/integrations/supabase/client";',
        'import { useAdminSession } from "@/hooks/useAdminSession";'

    # 2. Replace session state declarations + useEffect getSession block
    #    Pattern: two useState lines + useEffect with supabase.auth.getSession
    $content = $content -replace `
        '  const \[session, setSession\] = useState<any>\(null\);\r?\n  const \[checking, setChecking\] = useState\(true\);',
        '  const { token: session, checking, logout } = useAdminSession();'

    # 3. Remove the old useEffect that called supabase.auth.getSession
    $content = $content -replace `
        '(?s)  useEffect\(\(\) => \{\r?\n    supabase\.auth\.getSession\(\)\.then\(\(\{ data: \{ session: s \} \}\) => \{\r?\n      if \(!s\) \{\r?\n        navigate\(\{ to: "/auth" \}\);\r?\n      \} else \{\r?\n        setSession\(s\);\r?\n        setChecking\(false\);\r?\n      \}\r?\n    \}\);\r?\n  \}, \[navigate\]\);\r?\n',
        ''

    # 4. Replace signOut logout handler
    $content = $content -replace `
        '(?s)  const handleLogout = async \(\) => \{\r?\n    await supabase\.auth\.signOut\(\);\r?\n    navigate\(\{ to: "/auth" \}\);\r?\n  \};',
        '  const handleLogout = logout;'

    # 5. Replace session?.access_token with session
    $content = $content -replace 'session\?\.access_token', 'session'
    $content = $content -replace 'session\.access_token', 'session'

    # 6. Replace inline supabase.auth.getSession() calls inside async handlers
    $content = $content -replace `
        '      const \{ data: sessionData \} = await supabase\.auth\.getSession\(\);\r?\n      if \(!sessionData\.session\) \{ toast\.error\("Not authenticated"\); return; \}\r?\n      ',
        '      if (!session) { toast.error("Not authenticated"); return; }
      '

    # 7. Replace access_token usage with session directly
    $content = $content -replace 'sessionData\.session\.access_token', 'session'
    $content = $content -replace 'sessionData\.session\?\.access_token', 'session'

    # 8. Remove navigate import if session is the only reason it was used for auth
    # (keep navigate if it's used elsewhere — do NOT remove)

    Set-Content $file.FullName $content -Encoding UTF8
    Write-Host "Processed: $($file.Name)"
}

Write-Host "`nDone! All admin routes updated."
