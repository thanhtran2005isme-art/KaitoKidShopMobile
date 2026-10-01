@echo off
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0..") do set "ROOT=%%~fI"

if not defined NODE_BASE_URL set "NODE_BASE_URL=http://127.0.0.1:5300"

echo ============================================================
echo  KaitoKid Node migration - Phase 11 live smoke
ECHO  NODE_BASE_URL=%NODE_BASE_URL%
echo ============================================================

echo [CHECK] Node API phai dang chay truoc khi smoke.
cd /d "%ROOT%\apps\api"
call npm run smoke:final-cutover
if errorlevel 1 (
  echo.
  echo [FAIL] Live smoke Phase 11 failed.
  exit /b 1
)

echo.
echo [PASS] Live Node health/catalog/media smoke passed.
echo [IMPORTANT] Van can protected runtime parity + concurrency + soak + rollback truoc khi retire C#.
endlocal
exit /b 0
