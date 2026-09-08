# KaitoKid Shop - Start All Services
param()

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KaitoKid Shop - Starting Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check SQL Server
Write-Host "Checking SQL Server..." -ForegroundColor Yellow
$sqlCheck = sqlcmd -S localhost -E -Q "SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: SQL Server not accessible" -ForegroundColor Red
    exit 1
}
Write-Host "  OK: SQL Server is running" -ForegroundColor Green

# Check Database
Write-Host "Checking KaitoKid Database..." -ForegroundColor Yellow
$dbCheck = sqlcmd -S localhost -E -d KaitoKid -Q "SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: KaitoKid database not found" -ForegroundColor Red
    Write-Host "Run: sqlcmd -S localhost -E -i BACKEND\Database\KaitoKid_Database.sql" -ForegroundColor Yellow
    exit 1
}
Write-Host "  OK: Database exists" -ForegroundColor Green

Write-Host ""
Write-Host "Starting Backend APIs..." -ForegroundColor Cyan

# Get current directory
$rootDir = Get-Location

# Start API.Auth
Write-Host "  Starting API.Auth (port 5053)..." -ForegroundColor White
$authDir = Join-Path $rootDir "BACKEND\API.Auth"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$authDir'; dotnet run"
Start-Sleep -Seconds 2

# Start API.Customer
Write-Host "  Starting API.Customer (port 5265)..." -ForegroundColor White
$customerDir = Join-Path $rootDir "BACKEND\API.Customer"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$customerDir'; dotnet run"
Start-Sleep -Seconds 2

# Start API.Admin
Write-Host "  Starting API.Admin (port 5089)..." -ForegroundColor White
$adminDir = Join-Path $rootDir "BACKEND\API.Admin"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$adminDir'; dotnet run"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Starting Frontend..." -ForegroundColor Cyan

# Start Frontend
Write-Host "  Starting React (port 5173)..." -ForegroundColor White
$frontendDir = Join-Path $rootDir "kaito-kid-react"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services are starting..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Wait 15-20 seconds, then open:" -ForegroundColor Yellow
Write-Host "  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login:" -ForegroundColor Yellow
Write-Host "  Email: admin@kaitokid.vn" -ForegroundColor White
Write-Host "  Password: Admin@123" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to close this window (services will keep running)..."
Read-Host
