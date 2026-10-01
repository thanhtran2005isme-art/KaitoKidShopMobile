@echo off
setlocal EnableExtensions EnableDelayedExpansion
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
where npm >nul 2>&1
if errorlevel 1 (
  echo [LOI] Khong tim thay npm trong PATH.
  pause
  exit /b 1
)

pushd "%MOBILE%"
set "NEED_INSTALL=0"
if not exist "node_modules\.bin\expo.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\expo-image-picker\package.json" set "NEED_INSTALL=1"
if not exist "node_modules\expo-symbols\package.json" set "NEED_INSTALL=1"
if "%NEED_INSTALL%"=="1" (
  echo [SETUP] Dang chay npm install...
  call npm install
  if errorlevel 1 goto :install_error
)

set "EXPO_PUBLIC_BACKEND_MODE=node"
set "EXPO_PUBLIC_NODE_API_URL="
set "EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081"

where adb >nul 2>&1
if not errorlevel 1 (
  adb start-server >nul 2>&1
  set "ADB_DEVICE_COUNT=0"
  for /f "skip=1 tokens=1,2" %%A in ('adb devices') do if "%%B"=="device" set /a ADB_DEVICE_COUNT+=1
  if "!ADB_DEVICE_COUNT!"=="1" (
    adb reverse tcp:8081 tcp:8081 >nul 2>&1
    adb reverse tcp:5300 tcp:5300 >nul 2>&1
    if not errorlevel 1 (
      set "EXPO_PUBLIC_NODE_API_URL=http://127.0.0.1:5300"
      echo [ADB] Reverse 8081/5300 cho 1 thiet bi.
    )
  ) else (
    echo [ADB] Khong co dung 1 thiet bi authorized. Expo se dung LAN auto-detect/emulator fallback.
  )
)

echo [EXPO] Project: %MOBILE%
echo [EXPO] Backend: Node :5300
echo [EXPO] Starting Metro on port 8081...
call ".\node_modules\.bin\expo.cmd" start --lan --port 8081 -c
if errorlevel 1 goto :expo_error
popd
endlocal
exit /b 0

:expo_error
set "EXPO_EXIT=%ERRORLEVEL%"
echo [LOI] Expo dung voi ma loi %EXPO_EXIT%.
popd
pause
endlocal
exit /b %EXPO_EXIT%

:install_error
set "INSTALL_EXIT=%ERRORLEVEL%"
echo [LOI] npm install that bai voi ma loi %INSTALL_EXIT%.
popd
pause
endlocal
exit /b %INSTALL_EXIT%
