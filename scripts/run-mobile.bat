@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKid - Expo Mobile

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
  call npm install
  if errorlevel 1 goto :error
)

where adb >nul 2>&1
if not errorlevel 1 (
  adb start-server >nul 2>&1
  adb reverse tcp:8081 tcp:8081 >nul 2>&1
  adb reverse tcp:5053 tcp:5053 >nul 2>&1
  adb reverse tcp:5265 tcp:5265 >nul 2>&1
)

set "EXPO_PUBLIC_AUTH_API_URL=http://127.0.0.1:5053"
set "EXPO_PUBLIC_CUSTOMER_API_URL=http://127.0.0.1:5265"
set "EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081"

echo.
echo [EXPO] Project: %MOBILE%
echo [EXPO] Starting Metro on port 8081...
echo.

call npx expo start --lan --port 8081 -c
if errorlevel 1 goto :expo_error

popd
endlocal
exit /b 0

:expo_error
set "EXPO_EXIT=%ERRORLEVEL%"
echo.
echo ==================================================
echo [LOI] Expo da dung voi ma loi %EXPO_EXIT%.
echo Cua so nay duoc giu lai de ban doc/copy log loi.
echo ==================================================
echo.
popd
pause
endlocal
exit /b %EXPO_EXIT%

:error
echo.
echo [LOI] Khong the cai dependencies cho Mobile.
popd
pause
endlocal
exit /b 1
