Write-Host "Stopping KaitoKidShop Node development processes..." -ForegroundColor Yellow

Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopped Node development processes." -ForegroundColor Green
