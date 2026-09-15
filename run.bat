@echo off
setlocal EnableExtensions
chcp 65001 >nul

title KaitoKidShop - Dev Launcher USB

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

if not exist "%ROOT%BACKEND\API.Auth\API.Auth.csproj" (
    echo [LOI] Khong tim thay API.Auth
    pause
    exit /b 1
)

if not exist "%ROOT%BACKEND\API.Customer\API.Customer.csproj" (
    echo [LOI] Khong tim thay API.Customer
    pause
    exit /b 1
)

echo.
echo [CHECK] Kiem tra node_modules...
if not exist "%ROOT%node_modules" (
    echo Chua co node_modules. Dang cai dat npm...
    npm install
)

if not exist "%ROOT%node_modules\expo-secure-store" (
    echo Thieu expo-secure-store. Dang cai dat...
    npx expo install expo-secure-store
)

echo Dependency mobile OK

echo.
echo [1/5] Kiem tra Android device...

adb start-server >nul 2>&1
adb devices | findstr /R "device$" >nul

if errorlevel 1 (
    echo [LOI] Khong tim thay Android device!
    pause
    exit /b 1
)

echo Android device OK

echo.
echo [2/5] Cau hinh ADB reverse USB...
adb reverse --remove-all
adb reverse tcp:8081 tcp:8081
adb reverse tcp:5053 tcp:5053
adb reverse tcp:5265 tcp:5265
adb reverse --list

if errorlevel 1 (
    echo [LOI] Khong the cau hinh ADB reverse
    pause
    exit /b 1
)

echo.
echo [3/5] Mo API.Auth...
start "KaitoKidShop - API.Auth" cmd /k "cd /d ""%ROOT%BACKEND\API.Auth"" && dotnet run --urls http://0.0.0.0:5053"

timeout /t 2 /nobreak >nul

echo.
echo [4/5] Mo API.Customer...
start "KaitoKidShop - API.Customer" cmd /k "cd /d ""%ROOT%BACKEND\API.Customer"" && dotnet run --urls http://0.0.0.0:5265"

timeout /t 3 /nobreak >nul

echo.
echo [5/5] Chay Expo Mobile...
set EXPO_PUBLIC_AUTH_API_URL=http://127.0.0.1:5053
set EXPO_PUBLIC_CUSTOMER_API_URL=http://127.0.0.1:5265
set EXPO_PACKAGER_PROXY_URL=http://127.0.0.1:8081

echo Auth API: %EXPO_PUBLIC_AUTH_API_URL%
echo Customer API: %EXPO_PUBLIC_CUSTOMER_API_URL%

echo Khoi dong Expo...
npx expo start --lan --port 8081 -c

popd
endlocal
