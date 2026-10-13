@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title KaitoKid - Expo Mobile

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "MOBILE=%ROOT%\apps\mobile"
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
set "ADB_DEVICE_COUNT=0"
set "ADB_UNAUTHORIZED_COUNT=0"
set "ADB_BIN="

echo [EXPO] Kiem tra cong Metro 8081...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PORT_PREP%" -Port 8081
if errorlevel 1 goto :port_error

rem Tim ADB theo thu tu: PATH -> ANDROID_SDK_ROOT -> ANDROID_HOME -> Android Studio mac dinh -> C:\platform-tools.
for /f "delims=" %%A in ('where adb 2^>nul') do if not defined ADB_BIN set "ADB_BIN=%%~fA"
if not defined ADB_BIN if defined ANDROID_SDK_ROOT if exist "!ANDROID_SDK_ROOT!\platform-tools\adb.exe" set "ADB_BIN=!ANDROID_SDK_ROOT!\platform-tools\adb.exe"
if not defined ADB_BIN if defined ANDROID_HOME if exist "!ANDROID_HOME!\platform-tools\adb.exe" set "ADB_BIN=!ANDROID_HOME!\platform-tools\adb.exe"
if not defined ADB_BIN if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB_BIN=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not defined ADB_BIN if exist "C:\platform-tools\adb.exe" set "ADB_BIN=C:\platform-tools\adb.exe"

if defined ADB_BIN (
  echo [ADB] Su dung: !ADB_BIN!
  "!ADB_BIN!" start-server >nul 2>&1
  for /f "skip=1 tokens=1,2" %%A in ('"!ADB_BIN!" devices 2^>nul') do (
    if not "%%A"=="" (
      if "%%B"=="device" (
        set /a ADB_DEVICE_COUNT+=1
        "!ADB_BIN!" -s "%%A" reverse --remove tcp:8081 >nul 2>&1
        "!ADB_BIN!" -s "%%A" reverse --remove tcp:5300 >nul 2>&1
        "!ADB_BIN!" -s "%%A" reverse tcp:8081 tcp:8081 >nul 2>&1
        if not errorlevel 1 (
          "!ADB_BIN!" -s "%%A" reverse tcp:5300 tcp:5300 >nul 2>&1
          if not errorlevel 1 (
            set /a ADB_REVERSE_COUNT+=1
            echo [ADB] %%A: reverse 8081/5300 OK.
          ) else (
            "!ADB_BIN!" -s "%%A" reverse --remove tcp:8081 >nul 2>&1
            echo [CANH BAO] %%A: reverse 5300 that bai, bo USB mode cho thiet bi nay.
          )
        ) else (
          echo [CANH BAO] %%A: reverse 8081 that bai.
        )
      ) else if "%%B"=="unauthorized" (
        set /a ADB_UNAUTHORIZED_COUNT+=1
        echo [CANH BAO] %%A: ADB unauthorized - mo khoa dien thoai va chap nhan RSA USB debugging.
      ) else if not "%%B"=="" (
        echo [CANH BAO] %%A: ADB state = %%B.
      )
    )
  )
  if !ADB_DEVICE_COUNT! EQU 0 (
    if !ADB_UNAUTHORIZED_COUNT! GTR 0 (
      echo [ADB] Chua co thiet bi authorized. Expo se dung LAN cho den khi chap nhan RSA.
    ) else (
      echo [ADB] Khong co thiet bi Android o trang thai device. Expo se dung LAN.
    )
  )
) else (
  echo [CANH BAO] Khong tim thay adb.exe trong PATH, ANDROID_SDK_ROOT, ANDROID_HOME, Android SDK mac dinh hoac C:\platform-tools.
  echo [CANH BAO] Expo se dung LAN; neu LAN bi client isolation/firewall thi Expo Go co the xoay mai khi tai bundle.
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
