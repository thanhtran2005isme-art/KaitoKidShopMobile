@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Mobile

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "MOBILE=%ROOT%\apps\mobile"
set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"

if not exist "%MOBILE%\package.json" (
  echo [LOI] Khong tim thay apps\mobile\package.json
  pause
  exit /b 1
)

pushd "%MOBILE%"

if not exist "node_modules" (
  echo [SETUP] Installing mobile dependencies...
  npm install
  if errorlevel 1 goto :error
)

where adb >nul 2>&1
if not errorlevel 1 (
  adb start-server >nul 2>&1
  adb reverse tcp:8081 tcp:8081 >nul 2>&1
  adb reverse tcp:5053 tcp:5053 >nul 2>&1
  adb reverse tcp:5265 tcp:5265 >nul 2>&1
)

set EXPO_PUBLIC_AUTH_API_URL=http://127.0.0.1:5053
set EXPO_PUBLIC_CUSTOMER_API_URL=http://127.0.0.1:5265
set EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081

npx expo start --lan --port 8081 -c
goto :eof

:error
echo [LOI] Khong the khoi dong Mobile.
popd
pause
exit /b 1
