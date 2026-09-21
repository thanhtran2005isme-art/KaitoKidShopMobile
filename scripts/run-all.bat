@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Run All

set "SCRIPTS=%~dp0"

call "%SCRIPTS%run-backend.bat"
timeout /t 2 /nobreak >nul

start "KaitoKid - Web" cmd /k ""%SCRIPTS%run-web.bat""
start "KaitoKid - Mobile" cmd /k ""%SCRIPTS%run-mobile.bat""

echo KaitoKidShop stack is starting.
endlocal
