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
  echo [LOI] Khong tim thay npm trong PATH. Hay cai Node.js truoc.
  pause
  exit /b 1
)

pushd "%MOBILE%"

set "NEED_INSTALL=0"
if not exist "node_modules\.bin\expo.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\expo-image-picker\package.json" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo [SETUP] Mobile dependencies thieu hoac chua day du.
  echo [SETUP] Dang chay npm install...
  call npm install
  if errorlevel 1 goto :install_error
)

if not exist "node_modules\.bin\expo.cmd" goto :dependency_error
if not exist "node_modules\expo-image-picker\package.json" goto :dependency_error

set "EXPO_PUBLIC_AUTH_API_URL="
set "EXPO_PUBLIC_API_URL="
set "EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081"

where adb >nul 2>&1
if not errorlevel 1 (
  adb start-server >nul 2>&1
  set "ADB_DEVICE_COUNT=0"

  for /f "skip=1 tokens=1,2" %%A in ('adb devices') do (
    if "%%B"=="device" set /a ADB_DEVICE_COUNT+=1
  )

  if "!ADB_DEVICE_COUNT!"=="1" (
    adb reverse tcp:8081 tcp:8081 >nul 2>&1
    adb reverse tcp:5053 tcp:5053 >nul 2>&1
    adb reverse tcp:5265 tcp:5265 >nul 2>&1
    if not errorlevel 1 (
      set "EXPO_PUBLIC_AUTH_API_URL=http://127.0.0.1:5053"
      set "EXPO_PUBLIC_API_URL=http://127.0.0.1:5265"
      echo [ADB] Da bat reverse 8081/5053/5265 cho 1 thiet bi.
    )
  ) else (
    echo [ADB] Khong co dung 1 thiet bi authorized. Expo se dung LAN auto-detect/emulator fallback.
  )
)

echo.
echo [EXPO] Project: %MOBILE%
echo [EXPO] Starting Metro on port 8081...
echo.

call ".\node_modules\.bin\expo.cmd" start --lan --port 8081 -c
if errorlevel 1 goto :expo_error

popd
endlocal
exit /b 0

:dependency_error
echo.
echo ==================================================
echo [LOI] npm install xong nhung mobile dependency van chua day du.
echo Thu chay thu cong:
echo   cd /d "%MOBILE%"
echo   npm install
echo ==================================================
echo.
popd
pause
endlocal
exit /b 1

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

:install_error
set "INSTALL_EXIT=%ERRORLEVEL%"
echo.
echo ==================================================
echo [LOI] npm install that bai voi ma loi %INSTALL_EXIT%.
echo Cua so nay duoc giu lai de ban doc/copy log loi.
echo ==================================================
echo.
popd
pause
endlocal
exit /b %INSTALL_EXIT%
