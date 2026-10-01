@echo off
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0..") do set "ROOT=%%~fI"

if not defined NODE_BASE_URL set "NODE_BASE_URL=http://127.0.0.1:5300"

echo ============================================================
echo  KaitoKid Node migration - Phase 11 live smoke
ECHO  NODE_BASE_URL=%NODE_BASE_URL%
echo ============================================================

echo [CHECK] Cho Node API health-ready truoc khi smoke.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0wait-node-health.ps1" -BaseUrl "%NODE_BASE_URL%" -TimeoutSeconds 60
if errorlevel 1 (
  echo.
  echo [FAIL] Node API chua san sang, khong chay smoke de tranh false FAIL do ECONNREFUSED.
  endlocal
  exit /b 1
)

cd /d "%ROOT%\apps\api"
call npm run smoke:final-cutover
if errorlevel 1 (
  echo.
  echo [FAIL] Live smoke Phase 11 failed.
  exit /b 1
)

echo.
echo [PASS] Live Node health/catalog/media smoke passed.
echo [IMPORTANT] Van can protected runtime parity + concurrency + realtime truoc khi merge retirement.
endlocal
exit /b 0
