$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $root 'apps\api'

Write-Host '============================================================'
Write-Host ' KaitoKid Node Phase 11 - protected runtime parity'
Write-Host '============================================================'
Write-Host 'Gate tu tao customer/staff fixture tam, login that qua Node va cleanup sau test.'
Write-Host 'Khong phu thuoc password bootstrap hoac credential thu cong trong DB.'
Write-Host ''

$old = @{
    NODE_BASE_URL = $env:NODE_BASE_URL
    RUNTIME_AUTH_FIXTURE_CONFIRM = $env:RUNTIME_AUTH_FIXTURE_CONFIRM
}

try {
    if ([string]::IsNullOrWhiteSpace($env:NODE_BASE_URL)) {
        $env:NODE_BASE_URL = 'http://127.0.0.1:5300'
    }
    $env:RUNTIME_AUTH_FIXTURE_CONFIRM = 'YES'

    Push-Location $api
    try {
        & npm.cmd run test:protected-runtime
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host '[PASS] Protected runtime: fixture login/session + register/verify + OTP/2FA + lockout/reset/change-password + RBAC passed.' -ForegroundColor Green
    Write-Host '[NEXT] Chay concurrency/race gate tren DB da backup truoc khi retire C#.'
}
finally {
    $env:NODE_BASE_URL = $old.NODE_BASE_URL
    $env:RUNTIME_AUTH_FIXTURE_CONFIRM = $old.RUNTIME_AUTH_FIXTURE_CONFIRM
}
