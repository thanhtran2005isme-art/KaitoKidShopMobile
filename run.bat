@echo off
setlocal EnableExtensions
chcp 65001 >nul

title KaitoKidShop - Khoi dong du an

rem Luon lay thu muc chua run.bat lam thu muc goc.
rem Nho vay script khong phu thuoc vao terminal dang dung o Mobile, web hay thu muc khac.
set "ROOT=%~dp0"

pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong the truy cap thu muc goc: %ROOT%
    pause
    exit /b 1
)

if not exist "%ROOT%package.json" (
    echo [LOI] Khong tim thay package.json tai: %ROOT%
    echo Hay dat run.bat o thu muc goc KaitoKidShopMobile.
    popd
    pause
    exit /b 1
)

if not exist "%ROOT%BACKEND\API.Auth\API.Auth.csproj" (
    echo [LOI] Khong tim thay BACKEND\API.Auth\API.Auth.csproj
    popd
    pause
    exit /b 1
)

if not exist "%ROOT%BACKEND\API.Customer\API.Customer.csproj" (
    echo [LOI] Khong tim thay BACKEND\API.Customer\API.Customer.csproj
    popd
    pause
    exit /b 1
)

echo ================================================
echo       KaitoKidShop - Khoi dong moi truong dev
echo ================================================
echo Thu muc goc: %ROOT%
echo.

echo [1/3] Dang mo API.Auth tai http://0.0.0.0:5053 ...
start "KaitoKidShop - API.Auth" cmd /k "cd /d ""%ROOT%BACKEND\API.Auth"" && dotnet run --urls http://0.0.0.0:5053"

timeout /t 2 /nobreak >nul

echo [2/3] Dang mo API.Customer tai http://0.0.0.0:5265 ...
start "KaitoKidShop - API.Customer" cmd /k "cd /d ""%ROOT%BACKEND\API.Customer"" && dotnet run --urls http://0.0.0.0:5265"

timeout /t 2 /nobreak >nul

echo [3/3] Dang mo Expo Mobile bang tunnel ...
start "KaitoKidShop - Expo Mobile" cmd /k "cd /d ""%ROOT%"" && npx expo start --tunnel -c"

echo.
echo Da mo 3 cua so:
echo   - API.Auth     : http://localhost:5053
echo   - API.Customer : http://localhost:5265
echo   - Expo Mobile  : tunnel + xoa Metro cache

echo.
echo Luu y: dien thoai that can dung IP LAN cua may tinh de goi backend.
echo Vi du API.Customer: http://192.168.1.10:5265

echo.
echo Co the dong cua so launcher nay sau khi 3 tien trinh da mo.
popd
pause
endlocal
