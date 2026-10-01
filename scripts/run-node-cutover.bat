@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKid - Node Phase 11 Cutover

for %%I in ("%~dp0..") do set "ROOT=%%~fI"

echo ============================================================
echo  KaitoKid Node migration - Phase 11 local cutover launcher
echo ============================================================
echo.

powershell.exe -NoProfile -Command "$ports=5053,5265,5089,5155; $busy=@(); foreach ($p in $ports) { $busy += @(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) }; if ($busy.Count -gt 0) { foreach ($c in $busy) { Write-Host ('LISTEN {0}:{1} PID={2}' -f $c.LocalAddress,$c.LocalPort,$c.OwningProcess) }; exit 1 }; exit 0"
if errorlevel 1 (
  echo [BLOCK] Phat hien backend C# legacy dang LISTENING tren 5053/5265/5089/5155.
  echo De tranh dual-worker, dung C# truoc roi chay lai Phase 11 cutover.
  echo Co the dung: scripts\stop-all.bat
  pause
  exit /b 1
)

set "BACKGROUND_WORKER_OWNER=node"
set "CART_SWEEPER_ENABLED=true"
set "PAYMENT_SWEEPER_ENABLED=true"
set "CHAT_IDLE_SWEEPER_ENABLED=true"
set "SHIPPING_SIMULATOR_ENABLED=true"
set "IMAGE_INDEXER_ENABLED=false"

set "VITE_NODE_API_URL=http://127.0.0.1:5300"
set "VITE_CHAT_HUB_URL=http://127.0.0.1:5300"
set "VITE_CHAT_HUB_PATH=/chatHub"
set "KAITOKID_BACKEND_MODE=node"
set "EXPO_PUBLIC_BACKEND_MODE=node"

start "KaitoKid Node API" cmd /k call "%ROOT%\scripts\run-node-api.bat"
timeout /t 2 /nobreak >nul
start "KaitoKid Web - Node" cmd /k call "%ROOT%\scripts\run-web.bat"
start "KaitoKid Mobile - Node" cmd /k call "%ROOT%\scripts\run-mobile.bat"

echo.
echo [NODE CUTOVER] Da khoi dong Node API + Web + Mobile.
echo [WORKER OWNER] Node owns Cart/Payment/Chat/Shipping workers. Image indexer van tat.
echo [SMOKE] Sau khi Node API bao listening, chay: scripts\node-final-runtime-smoke.bat
echo [ROLLBACK] scripts\stop-all.bat, sau do chay run.bat hoac scripts\run-backend.bat de quay lai C#.
echo.
endlocal
exit /b 0
