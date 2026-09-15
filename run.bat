@echo off
setlocal EnableExtensions
chcp 65001 >nul

title KaitoKidShop - Khoi dong moi truong dev USB

set "ROOT=%~dp0"
pushd "%ROOT%" >nul 2>&1

if errorlevel 1 (
    echo [LOI] Khong the truy cap thu muc goc
    pause
    exit /b 1
)

set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"

echo ================================================
echo KaitoKidShop - Dev Launcher USB
 echo Thu muc: %ROOT%
echo ================================================

if not exist "%ROOT%package.json" (
    echo [LOI] Khong tim thay package.json
    pause
    exit /b 1
)

if not exist "%ROOT%BACKEND\API.Customer\API.Customer.csproj" (
    echo [LOI] Khong tim thay API.Customer
    pause
    exit /b 1
)

echo.
echo [1/4] Kiem tra Android device...
adb devices

 echo.
echo [2/4] Cau hinh ADB reverse USB...
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
adb reverse tcp:5265 tcp:5265
adb reverse --list

 echo.
echo [3/4] Mo Backend...

start "KaitoKidShop - API.Customer" cmd /k "cd /d ""%ROOT%BACKEND\API.Customer"" && dotnet run --urls http://0.0.0.0:5265"

timeout /t 3 /nobreak >nul

 echo.
echo [4/4] Chay Expo Mobile...
set EXPO_PUBLIC_API_URL=http://127.0.0.1:5265
set EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081

npx expo start --lan --port 8081 -c

popd
endlocal
