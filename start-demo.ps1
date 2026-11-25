$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (!(Test-Path -LiteralPath .env.demo)) {
        $bytes = New-Object byte[] 48
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $secret = [Convert]::ToBase64String($bytes)
        Set-Content -LiteralPath .env.demo -Encoding ascii -Value "TEST_JWT_SECRET=$secret"
    }
    docker compose --env-file .env.demo -f compose.demo.yaml up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'Demo startup failed.' }
    Write-Output 'Snipbase is ready at http://localhost:3100'
} finally {
    Pop-Location
}
