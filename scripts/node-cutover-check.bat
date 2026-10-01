@echo off
setlocal
chcp 65001 >nul
echo [INFO] Migration cutover da hoan tat; chuyen sang final Node-only gate.
call "%~dp0node-final-cutover-check.bat"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
