@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo [INFO] Cutover da hoan tat. Script nay duoc giu lam alias tuong thich.
echo [INFO] Dang chay Node-only stack qua scripts\run-all.bat...
call "%~dp0run-all.bat"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
