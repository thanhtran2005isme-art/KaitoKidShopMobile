@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Backend Launcher

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "BACKEND=%ROOT%\backend"

if not exist "%BACKEND%\KaitoKidShop.slnx" (
  echo [LOI] Khong tim thay backend\KaitoKidShop.slnx
  pause
  exit /b 1
)

call "%ROOT%\scripts\load-db-local.bat"
if errorlevel 2 (
  echo [DB] Hay luu password trong file vua mo, sau do chay lai script.
  timeout /t 2 /nobreak >nul
  exit /b 1
)
if errorlevel 1 (
  echo [LOI] Khong nap duoc cau hinh MariaDB local.
  pause
  exit /b 1
)

echo [DB] Local MariaDB configuration loaded.

start "KaitoKid - API.Auth" cmd /k "cd /d ""%BACKEND%\API.Auth"" && dotnet run --urls http://0.0.0.0:5053"
start "KaitoKid - API.Customer" cmd /k "cd /d ""%BACKEND%\API.Customer"" && dotnet run --urls http://0.0.0.0:5265"
start "KaitoKid - API.Admin" cmd /k "cd /d ""%BACKEND%\API.Admin"" && dotnet run --urls http://0.0.0.0:5089"
start "KaitoKid - API.Gateway" cmd /k "cd /d ""%BACKEND%\API.Gateway"" && dotnet run --urls http://0.0.0.0:5155"

echo Backend services are starting.
endlocal
