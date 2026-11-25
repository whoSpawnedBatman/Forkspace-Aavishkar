# Run with: powershell -ExecutionPolicy Bypass -File .\demo.ps1
# Uses two existing, confirmed accounts. Demo snippets remain available afterward.
[CmdletBinding()]
param(
    [string]$ApiUrl = 'http://localhost:8000',
    [string]$AuthUrl,
    [string]$PublishableKey
)

$ErrorActionPreference = 'Stop'
$ApiUrl = $ApiUrl.TrimEnd('/')

function Read-EnvFile([string]$Path) {
    $values = @{}
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in Get-Content -LiteralPath $Path) {
            if ($line -match '^([A-Z_]+)=(.*)$') {
                $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }
    return $values
}

function Assert-Demo([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    Write-Host "PASS  $Message" -ForegroundColor Green
}

function Invoke-Api([string]$Method, [string]$Path, [hashtable]$Headers = @{}, $Body) {
    $request = @{ Uri = "$ApiUrl$Path"; Method = $Method; Headers = $Headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $request.ContentType = 'application/json'
        $request.Body = $Body | ConvertTo-Json -Depth 10
    }
    return Invoke-RestMethod @request
}

function Sign-In([string]$Label) {
    Write-Host "Sign in as $Label using an existing confirmed account."
    $credential = Get-Credential -Message "$Label Supabase email and password"
    if ($null -eq $credential) { throw 'Sign-in cancelled.' }
    $body = @{
        email = $credential.UserName
        password = $credential.GetNetworkCredential().Password
    } | ConvertTo-Json
    $session = Invoke-RestMethod -Uri "$AuthUrl/token?grant_type=password" -Method Post -Headers @{ apikey = $PublishableKey } -ContentType 'application/json' -Body $body -TimeoutSec 30
    Assert-Demo ([bool]$session.access_token) "$Label authenticated"
    return $session
}

try {
    $config = Read-EnvFile (Join-Path $PSScriptRoot '.env')
    $frontendConfig = Read-EnvFile (Join-Path $PSScriptRoot 'apps/frontend/.env.local')
    if (-not $AuthUrl) { $AuthUrl = $config['SUPABASE_AUTH_URL'] }
    if (-not $PublishableKey) { $PublishableKey = $config['SUPABASE_PUBLISHABLE_KEY'] }
    if (-not $PublishableKey) { $PublishableKey = $frontendConfig['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] }
    if (-not $AuthUrl -or -not $PublishableKey) { throw 'Set AuthUrl and PublishableKey parameters, or configure them in .env.' }
    $AuthUrl = $AuthUrl.TrimEnd('/')
    Assert-Demo ((Invoke-Api GET '/health').status -eq 'ok') 'Backend is healthy'
    $owner = Sign-In 'User A'
    $other = Sign-In 'User B'
    Assert-Demo ($owner.user.id -ne $other.user.id) 'Two distinct users authenticated'
    $ownerHeaders = @{ Authorization = "Bearer $($owner.access_token)" }
    $otherHeaders = @{ Authorization = "Bearer $($other.access_token)" }
    $tag = 'demo-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    $files = @(
        @{ path = 'index.html'; content = '<h1>Hello from User A</h1>' },
        @{ path = 'app.js'; content = "console.log('User A');" },
        @{ path = 'styles.css'; content = 'h1 { color: blue; }' }
    )
    $inputData = @{ title = "CLI original $tag"; visibility = 'public'; tags = @($tag); files = $files }
    $original = Invoke-Api POST '/snippets' $ownerHeaders $inputData
    $reopened = Invoke-Api GET "/snippets/$($original.id)" $ownerHeaders
    Assert-Demo (($reopened.files | ConvertTo-Json -Compress) -eq ($files | ConvertTo-Json -Compress)) 'Created and reopened all three files exactly'
    $embedUrl = "$ApiUrl/embed/$($original.id)"
    Write-Host "Embed link  $embedUrl"
    if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
        try { Set-Clipboard -Value $embedUrl; Write-Host 'Embed link copied to clipboard.' }
        catch { Write-Warning 'Clipboard unavailable. Copy the printed embed link.' }
    }
    $embed = Invoke-WebRequest -Uri $embedUrl -UseBasicParsing -TimeoutSec 30
    foreach ($file in $files) {
        Assert-Demo ($embed.Content.Contains($file.path)) "Anonymous embed includes $($file.path)"
    }
    $fork = Invoke-Api POST "/snippets/$($original.id)/fork" $otherHeaders
    $forkDetail = Invoke-Api GET "/snippets/$($fork.id)" $otherHeaders
    Assert-Demo ($forkDetail.parent_snippet_id -eq $original.id) 'User B fork is linked to original'
    $editedFiles = @($forkDetail.files | ForEach-Object { @{ path = $_.path; content = $_.content } })
    $editedFiles[1].content = "console.log('Edited by User B');"
    $edit = @{ title = "CLI fork $tag"; visibility = 'public'; tags = @($tag); files = $editedFiles }
    $null = Invoke-Api PUT "/snippets/$($fork.id)" $otherHeaders $edit
    $savedFork = Invoke-Api GET "/snippets/$($fork.id)" $otherHeaders
    Assert-Demo ($savedFork.files[1].content -eq $editedFiles[1].content) 'User B edit persisted and fork published'
    $unchanged = Invoke-Api GET "/snippets/$($original.id)" $ownerHeaders
    Assert-Demo (($unchanged.files | ConvertTo-Json -Compress) -eq ($files | ConvertTo-Json -Compress)) 'Original files remain intact'
    $results = Invoke-Api GET "/snippets?scope=public&tag=$tag"
    Assert-Demo (($results.items.id -contains $original.id) -and ($results.items.id -contains $fork.id)) 'Tag search finds original and edited fork'
    $results.items | Select-Object id, title, visibility, file_count | Format-Table -AutoSize
    Write-Host "Demo completed. Search tag  $tag" -ForegroundColor Green
    Write-Host 'Both public demo snippets are saved in the database.'
}
catch {
    Write-Error "Demo stopped. $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}
