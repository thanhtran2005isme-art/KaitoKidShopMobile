@echo off
setlocal
chcp 65001 >nul

where pwsh.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0node-realtime-runtime-gate.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0node-realtime-runtime-gate.ps1"
)

set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
