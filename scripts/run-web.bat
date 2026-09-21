@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Web

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "WEB=%ROOT%\apps\web"

if not exist "%WEB%\package.json" (
  echo [LOI] Khong tim thay apps\web\package.json
  pause
  exit /b 1
)

pushd "%WEB%"

if not exist "node_modules" (
  echo [SETUP] Installing web dependencies...
  npm install
  if errorlevel 1 goto :error
)

npm run dev
goto :eof

:error
echo [LOI] Khong the khoi dong Web.
popd
pause
exit /b 1
