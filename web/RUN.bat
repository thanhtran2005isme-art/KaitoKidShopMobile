@echo off
setlocal EnableExtensions
chcp 65001 >nul

title KaitoKid Shop - Web Launcher
set "SCRIPT_DIR=%~dp0"

echo ========================================
echo   KaitoKid Shop - Starting Web Stack
echo ========================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-all.ps1"

if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi dong day du dich vu.
    pause
    exit /b 1
)

endlocal
