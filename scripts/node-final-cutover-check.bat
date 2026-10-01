@echo off
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0..") do set "ROOT=%%~fI"

echo ============================================================
echo  KaitoKid Node migration - Phase 11 final cutover source gate
echo ============================================================

echo [1/2] Running complete Phase 1-10 gate...
call "%ROOT%\scripts\node-admin-migration-check.bat"
if errorlevel 1 exit /b 1

echo.
echo [2/2] Running Phase 11 cutover contracts...
cd /d "%ROOT%\apps\api"
call npm run test:final-cutover
if errorlevel 1 exit /b 1

echo.
echo [PASS] Phase 11 source/build/DB-audit/final-cutover contract gate passed.
echo [IMPORTANT] Chua xoa backend C# chi dua tren gate nay.
echo [NEXT 1] Chay scripts\run-node-cutover.bat
ECHO [NEXT 2] Khi Node API da listening, chay scripts\node-final-runtime-smoke.bat
ECHO [NEXT 3] Chay runtime parity Admin/Auth/Customer + concurrency/soak/rollback theo docs\NODE_FINAL_CUTOVER_PHASE11.md
endlocal
exit /b 0
