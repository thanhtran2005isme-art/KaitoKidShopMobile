@echo off
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0..") do set "ROOT=%%~fI"

echo ============================================================
echo  KaitoKid Node-only final source/build/contract gate
echo ============================================================

call "%ROOT%\scripts\node-admin-migration-check.bat"
if errorlevel 1 exit /b 1

cd /d "%ROOT%\apps\api"
call npm run test:final-cutover
if errorlevel 1 exit /b 1

echo [PASS] Node-only source/build/DB-audit/final contracts passed.
echo [NEXT] Neu dang nghiem thu runtime, chay node-final-runtime-smoke + protected + race + realtime gates.
endlocal
exit /b 0
