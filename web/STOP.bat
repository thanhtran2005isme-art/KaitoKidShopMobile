@echo off
REM KaitoKid Shop - Quick Stop
echo.
echo ========================================
echo   KaitoKid Shop - Stopping...
echo ========================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"
pause
