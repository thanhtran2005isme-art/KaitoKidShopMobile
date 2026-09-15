# KaitoKid Shop - Start All Web Services
param()

$ErrorActionPreference = "Stop"

$webDir = $PSScriptRoot
$projectRoot = Split-Path -Parent $webDir

$authDir = Join-Path $projectRoot "BACKEND\API.Auth"
$customerDir = Join-Path $projectRoot "BACKEND\API.Customer"
$adminDir = Join-Path $projectRoot "BACKEND\API.Admin"
$frontendDir = Join-Path $webDir "kaito-kid-react"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KaitoKid Shop - Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project root : $projectRoot"
Write-Host "Web root     : $webDir"
Write-Host ""

$requiredPaths = @(
    @{ Name = "API.Auth"; Path = (Join-Path $authDir "API.Auth.csproj") },
    @{ Name = "API.Customer"; Path = (Join-Path $customerDir "API.Customer.csproj") },
    @{ Name = "API.Admin"; Path = (Join-Path $adminDir "API.Admin.csproj") },
    @{ Name = "Frontend"; Path = (Join-Path $frontendDir "package.json") }
)

foreach ($item in $requiredPaths) {
    if (-not (Test-Path $item.Path)) {
        Write-Host "[LOI] Khong tim thay $($item.Name): $($item.Path)" -ForegroundColor Red
        exit 1
    }
}

# Check SQL Server when sqlcmd is available.
$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($sqlcmd) {
    Write-Host "Checking SQL Server..." -ForegroundColor Yellow
    & $sqlcmd.Source -S localhost -E -Q "SELECT 1" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LOI] SQL Server khong truy cap duoc." -ForegroundColor Red
        exit 1
    }

    Write-Host "Checking KaitoKid database..." -ForegroundColor Yellow
    & $sqlcmd.Source -S localhost -E -d KaitoKid -Q "SELECT 1" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LOI] Khong tim thay database KaitoKid." -ForegroundColor Red
        Write-Host "SQL script: $projectRoot\BACKEND\Database\KaitoKid_Database.sql" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[CANH BAO] Khong tim thay sqlcmd, bo qua buoc kiem tra SQL Server." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Backend APIs..." -ForegroundColor Cyan

Write-Host "  Starting API.Auth (port 5053)..." -ForegroundColor White
Start-Process powershell.exe -WorkingDirectory $authDir -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "dotnet run --urls http://0.0.0.0:5053"
)
Start-Sleep -Seconds 2

Write-Host "  Starting API.Customer (port 5265)..." -ForegroundColor White
Start-Process powershell.exe -WorkingDirectory $customerDir -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "dotnet run --urls http://0.0.0.0:5265"
)
Start-Sleep -Seconds 2

Write-Host "  Starting API.Admin..." -ForegroundColor White
Start-Process powershell.exe -WorkingDirectory $adminDir -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "dotnet run"
)
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Frontend..." -ForegroundColor Cyan
Write-Host "  Starting React..." -ForegroundColor White
Start-Process powershell.exe -WorkingDirectory $frontendDir -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-Command",
    "npm run dev"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services are starting..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend paths now resolve from project root, not from the web folder." -ForegroundColor Green
Write-Host "Auth     : $authDir"
Write-Host "Customer : $customerDir"
Write-Host "Admin    : $adminDir"
Write-Host "Frontend : $frontendDir"
Write-Host ""
Write-Host "Press Enter to close this launcher window (services keep running)..."
Read-Host
