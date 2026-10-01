param(
    [string]$BaseUrl = $env:NODE_BASE_URL,
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'SilentlyContinue'

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = 'http://127.0.0.1:5300'
}

$BaseUrl = $BaseUrl.TrimEnd('/')
$healthUrl = "$BaseUrl/health"
$deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
$lastError = ''

Write-Host "[WAIT] Cho Node API san sang tai $healthUrl ..."

while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -Method Get -TimeoutSec 3
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            Write-Host "[READY] Node API da san sang: HTTP $($response.StatusCode) $healthUrl" -ForegroundColor Green
            exit 0
        }
        $lastError = "HTTP $($response.StatusCode)"
    }
    catch {
        $lastError = $_.Exception.Message
    }

    Start-Sleep -Milliseconds 500
}

Write-Host "[FAIL] Node API khong san sang sau $TimeoutSeconds giay: $healthUrl" -ForegroundColor Red
if (-not [string]::IsNullOrWhiteSpace($lastError)) {
    Write-Host "[LAST ERROR] $lastError" -ForegroundColor DarkRed
}
exit 1
