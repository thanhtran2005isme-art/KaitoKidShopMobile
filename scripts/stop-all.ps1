Write-Host "Stopping KaitoKidShop development processes..." -ForegroundColor Yellow

Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopped dotnet/node development processes." -ForegroundColor Green
