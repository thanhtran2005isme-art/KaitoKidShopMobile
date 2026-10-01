$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $root 'apps\api'

function Read-PlainSecret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

Write-Host '============================================================'
Write-Host ' KaitoKid Node Phase 11 - protected runtime parity'
Write-Host '============================================================'
Write-Host 'Gate nay chi login/refresh/read + RBAC. Khong tao don, khong sua ton kho.'
Write-Host ''

$customerIdentifier = Read-Host 'Customer email/username test'
$customerPassword = Read-PlainSecret 'Customer password'
$staffEmail = Read-Host 'Staff email test'
$staffPassword = Read-PlainSecret 'Staff password'

if ([string]::IsNullOrWhiteSpace($customerIdentifier) -or
    [string]::IsNullOrWhiteSpace($customerPassword) -or
    [string]::IsNullOrWhiteSpace($staffEmail) -or
    [string]::IsNullOrWhiteSpace($staffPassword)) {
    throw 'Credential test khong duoc de trong.'
}

$old = @{
    NODE_BASE_URL = $env:NODE_BASE_URL
    RUNTIME_CUSTOMER_IDENTIFIER = $env:RUNTIME_CUSTOMER_IDENTIFIER
    RUNTIME_CUSTOMER_PASSWORD = $env:RUNTIME_CUSTOMER_PASSWORD
    RUNTIME_STAFF_EMAIL = $env:RUNTIME_STAFF_EMAIL
    RUNTIME_STAFF_PASSWORD = $env:RUNTIME_STAFF_PASSWORD
}

try {
    if ([string]::IsNullOrWhiteSpace($env:NODE_BASE_URL)) {
        $env:NODE_BASE_URL = 'http://127.0.0.1:5300'
    }
    $env:RUNTIME_CUSTOMER_IDENTIFIER = $customerIdentifier
    $env:RUNTIME_CUSTOMER_PASSWORD = $customerPassword
    $env:RUNTIME_STAFF_EMAIL = $staffEmail
    $env:RUNTIME_STAFF_PASSWORD = $staffPassword

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
    Write-Host '[PASS] Protected runtime parity customer/staff/RBAC passed.' -ForegroundColor Green
    Write-Host '[NEXT] Chay concurrency/race gate tren DB da backup truoc khi retire C#.'
}
finally {
    $env:NODE_BASE_URL = $old.NODE_BASE_URL
    $env:RUNTIME_CUSTOMER_IDENTIFIER = $old.RUNTIME_CUSTOMER_IDENTIFIER
    $env:RUNTIME_CUSTOMER_PASSWORD = $old.RUNTIME_CUSTOMER_PASSWORD
    $env:RUNTIME_STAFF_EMAIL = $old.RUNTIME_STAFF_EMAIL
    $env:RUNTIME_STAFF_PASSWORD = $old.RUNTIME_STAFF_PASSWORD
    $customerPassword = $null
    $staffPassword = $null
}
