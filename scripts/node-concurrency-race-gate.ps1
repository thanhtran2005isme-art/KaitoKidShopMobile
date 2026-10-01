$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Api = Join-Path $Root 'apps\api'
$EnvFile = Join-Path $Api '.env'
$BaseUrl = if ($env:NODE_BASE_URL) { $env:NODE_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:5300' }

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' KaitoKid Node Phase 11 - commerce concurrency/race gate' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "NODE_BASE_URL=$BaseUrl"
Write-Host ''

try {
    $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health" -TimeoutSec 10
} catch {
    throw "Node API is not running at $BaseUrl. Run scripts\run-node-cutover.bat first. $($_.Exception.Message)"
}

if ($health.status -ne 'ok' -or $health.database.expectedTables -ne 52 -or $health.database.actualTables -ne 52) {
    throw 'Health/DB audit is not 52/52; destructive race gate is blocked.'
}

if (-not (Test-Path $EnvFile)) {
    throw "Missing $EnvFile"
}

$dbLine = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $dbLine) {
    throw 'Missing DATABASE_URL in apps/api/.env'
}

$dbUrl = ($dbLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
try {
    $uri = [Uri]$dbUrl
} catch {
    throw 'DATABASE_URL cannot be parsed for backup.'
}

if ($uri.Scheme -notin @('mysql', 'mariadb')) {
    throw "DATABASE_URL scheme '$($uri.Scheme)' is not supported by backup gate."
}

$userInfo = $uri.UserInfo -split ':', 2
$dbUser = [Uri]::UnescapeDataString($userInfo[0])
$dbPassword = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
$dbHost = $uri.Host
$dbPort = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }
$dbName = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
if (-not $dbName) { throw 'DATABASE_URL has no database name.' }

$dumpCandidates = @(
    $env:MYSQLDUMP_BIN,
    'C:\xampp\mysql\bin\mysqldump.exe',
    'C:\xampp\mysql\bin\mariadb-dump.exe'
) | Where-Object { $_ -and (Test-Path $_) }

$dumpExe = $dumpCandidates | Select-Object -First 1
if (-not $dumpExe) {
    $command = Get-Command mysqldump.exe -ErrorAction SilentlyContinue
    if (-not $command) { $command = Get-Command mariadb-dump.exe -ErrorAction SilentlyContinue }
    if ($command) { $dumpExe = $command.Source }
}
if (-not $dumpExe) {
    throw 'mysqldump/mariadb-dump not found. Set MYSQLDUMP_BIN to the MariaDB/MySQL dump executable.'
}

$backupDir = Join-Path $Root '.runtime-backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $backupDir "kaitokid-phase11-race-$stamp.sql"
$tempDefaults = Join-Path $env:TEMP "kaitokid-mysql-$PID-$stamp.cnf"

$defaults = @(
    '[client]',
    "host=$dbHost",
    "port=$dbPort",
    "user=$dbUser",
    "password=$dbPassword"
)
Set-Content -Path $tempDefaults -Value $defaults -Encoding ASCII

try {
    Write-Host "[BACKUP] $backupFile" -ForegroundColor Yellow
    & $dumpExe "--defaults-extra-file=$tempDefaults" '--single-transaction' '--quick' '--skip-lock-tables' '--databases' $dbName "--result-file=$backupFile"
    if ($LASTEXITCODE -ne 0) {
        throw "mysqldump failed with exit code $LASTEXITCODE. Race gate is blocked."
    }
} finally {
    Remove-Item $tempDefaults -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -lt 1024) {
    throw 'Backup file is invalid or too small; race gate is blocked.'
}

Write-Host '[BACKUP PASS] Database snapshot created.' -ForegroundColor Green
Write-Host '[RACE] Test uses only a temporary customer fixture and a product without active cart/reservation.' -ForegroundColor Yellow
Write-Host '[RACE] finally removes fixture data and restores product/variant snapshot.' -ForegroundColor Yellow

$env:RUNTIME_RACE_CONFIRM = 'YES'
$env:NODE_BASE_URL = $BaseUrl

Push-Location $Api
try {
    npm run test:concurrency-runtime
    if ($LASTEXITCODE -ne 0) {
        throw "Concurrency runtime test FAIL (exit $LASTEXITCODE). Keep backup at $backupFile for investigation/rollback."
    }
} finally {
    Pop-Location
    Remove-Item Env:RUNTIME_RACE_CONFIRM -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '[PASS] Phase 11 commerce concurrency/race gate passed.' -ForegroundColor Green
Write-Host "[BACKUP] $backupFile" -ForegroundColor Green
Write-Host '[NEXT] Realtime Socket.IO + staff claim race, then rollback/soak gate.' -ForegroundColor Cyan
