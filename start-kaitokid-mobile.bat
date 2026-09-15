@echo off
 title KaitoKid Mobile USB Dev

cd /d %~dp0

set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"

 echo ==========================
 echo KaitoKid Mobile Dev Start
 echo ==========================

 echo.
 echo [1] Checking Android device...
adb devices

 echo.
 echo [2] Setup ADB reverse USB...
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
adb reverse tcp:5265 tcp:5265

 echo.
adb reverse --list

 echo.
 echo [3] Setup environment...
set EXPO_PUBLIC_API_URL=http://127.0.0.1:5265
set EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081

 echo.
 echo [4] Starting Expo...
npx expo start --lan --port 8081 -c
