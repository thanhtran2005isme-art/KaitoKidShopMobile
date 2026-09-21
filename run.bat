@echo off
setlocal EnableExtensions
chcp 65001 >nul

title KaitoKidShop - Launcher

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "MOBILE=%ROOT%apps\mobile"

echo ================================================
echo KaitoKidShop - Mobile + Backend
echo Root: %ROOT%
echo ================================================
echo.

if not exist "%BACKEND%\API.Auth\API.Auth.csproj" (
    echo [LOI] Khong tim thay backend\API.Auth
    pause
    exit /b 1
)

if not exist "%BACKEND%\API.Customer\API.Customer.csproj" (
    echo [LOI] Khong tim thay backend\API.Customer
    pause
    exit /b 1
)

if not exist "%MOBILE%\package.json" (
    echo [LOI] Khong tim thay apps\mobile\package.json
    pause
    exit /b 1
)

echo [1/3] Starting API.Auth on port 5053...
start "KaitoKid - API.Auth" cmd /k "cd /d ""%BACKEND%\API.Auth"" && dotnet run --urls http://0.0.0.0:5053"

timeout /t 2 /nobreak >nul

echo [2/3] Starting API.Customer on port 5265...
start "KaitoKid - API.Customer" cmd /k "cd /d ""%BACKEND%\API.Customer"" && dotnet run --urls http://0.0.0.0:5265"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Expo Mobile in a persistent window...
start "KaitoKid - Expo Mobile" cmd /k "call ""%ROOT%scripts\run-mobile.bat"""

echo.
echo Da mo 3 cua so: API.Auth, API.Customer, Expo Mobile.
echo Neu Expo loi, cua so Expo se GIU NGUYEN de xem log.
timeout /t 2 /nobreak >nul

endlocal
