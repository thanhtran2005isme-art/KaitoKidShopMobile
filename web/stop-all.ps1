#!/usr/bin/env pwsh
# KaitoKid Shop - Stop All Services

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "║     🛑 KaitoKid Shop - Stopping All Services     ║" -ForegroundColor Red
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""

# Stop all dotnet processes
Write-Host "Stopping .NET Backend APIs..." -ForegroundColor Yellow
$dotnetProcesses = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue
if ($dotnetProcesses) {
    $dotnetProcesses | ForEach-Object {
        Write-Host "  Stopping process: $($_.Id)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Backend APIs stopped" -ForegroundColor Green
} else {
    Write-Host "  No dotnet processes running" -ForegroundColor Gray
}

# Stop Node.js processes (Vite)
Write-Host ""
Write-Host "Stopping Node.js Frontend..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Write-Host "  Stopping process: $($_.Id)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Frontend stopped" -ForegroundColor Green
} else {
    Write-Host "  No node processes running" -ForegroundColor Gray
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ All services have been stopped" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
