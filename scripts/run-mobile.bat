@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title KaitoKid - Expo Mobile

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "MOBILE=%ROOT%\apps\mobile"
set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"
set "PORT_PREP=%ROOT%\scripts\prepare-expo-port.ps1"

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
if not exist "%PORT_PREP%" (
  echo [LOI] Khong tim thay scripts\prepare-expo-port.ps1
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
set "EXPO_PACKAGER_PROXY_URL="
set "EXPO_HOST_FLAG=--lan"
set "ADB_REVERSE_COUNT=0"

echo [EXPO] Kiem tra cong Metro 8081...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PORT_PREP%" -Port 8081
if errorlevel 1 goto :port_error

where adb >nul 2>&1
if not errorlevel 1 (
  adb start-server >nul 2>&1
  for /f "skip=1 tokens=1,2" %%A in ('adb devices') do if "%%B"=="device" (
    adb -s "%%A" reverse --remove tcp:8081 >nul 2>&1
    adb -s "%%A" reverse --remove tcp:5300 >nul 2>&1
    adb -s "%%A" reverse tcp:8081 tcp:8081 >nul 2>&1
    if not errorlevel 1 (
      adb -s "%%A" reverse tcp:5300 tcp:5300 >nul 2>&1
      if not errorlevel 1 (
        set /a ADB_REVERSE_COUNT+=1
        echo [ADB] %%A: reverse 8081/5300 OK.
      ) else (
        adb -s "%%A" reverse --remove tcp:8081 >nul 2>&1
        echo [CANH BAO] %%A: reverse 5300 that bai, bo USB mode cho thiet bi nay.
      )
    ) else (
      echo [CANH BAO] %%A: reverse 8081 that bai.
    )
  )
)

if !ADB_REVERSE_COUNT! GTR 0 (
  set "EXPO_PUBLIC_NODE_API_URL=http://127.0.0.1:5300"
  set "EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081"
  set "EXPO_HOST_FLAG=--localhost"
  echo [EXPO] Ket noi USB/ADB: !ADB_REVERSE_COUNT! thiet bi da reverse thanh cong.
  echo [EXPO] Expo Go co the quet QR hoac nhap: exp://127.0.0.1:8081
) else (
  echo [EXPO] Khong co ADB reverse hoan chinh. Chuyen sang LAN mode.
  echo [EXPO] Dien thoai that KHONG dung exp://127.0.0.1:8081 trong LAN mode.
  echo [EXPO] Hay quet QR KaitoKid hoac dung dia chi LAN ma Expo in ra.
)

echo [EXPO] Project: %MOBILE%
echo [EXPO] Backend: Node :5300
echo [EXPO] Starting Metro on port 8081 with !EXPO_HOST_FLAG!...
call ".\node_modules\.bin\expo.cmd" start !EXPO_HOST_FLAG! --port 8081 -c
if errorlevel 1 goto :expo_error
popd
endlocal
exit /b 0

:port_error
echo [LOI] Khong the chuan bi cong 8081. Expo khong duoc tu nhay sang 8082/8083.
echo [GOI Y] Dong process dang chiem 8081 theo thong bao ben tren roi chay lai run-all.bat.
popd
pause
endlocal
exit /b 1

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
