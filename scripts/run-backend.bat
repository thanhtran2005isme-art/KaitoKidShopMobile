@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Node Backend

for %%I in ("%~dp0") do set "SCRIPTS=%%~fI"
call "%SCRIPTS%run-node-api.bat"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
