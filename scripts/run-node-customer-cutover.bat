@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Node Customer/Auth Cutover Preview

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "API=%ROOT%\apps\api"
set "WEB=%ROOT%\apps\web"
set "BACKEND=%ROOT%\backend"

if not exist "%API%\package.json" (
  echo [LOI] Khong tim thay apps\api
  pause
  exit /b 1
)

echo ===============================================================
echo  NODE CUTOVER PREVIEW
echo  Customer/Auth/Chat/Search: Node :5300
echo  Admin business API: C# API.Admin :5089
echo ===============================================================
echo.
echo [CANH BAO] Day la hybrid preview. API.Admin chua duoc migrate sang Node.
echo [CANH BAO] Khong xoa backend C# va khong bat double worker khi coexistence.
echo.

call "%ROOT%\scripts\load-db-local.bat"
if errorlevel 1 (
  echo [LOI] Khong nap duoc MariaDB local cho API.Admin.
  pause
  exit /b 1
)

start "KaitoKid - Node API" cmd /k "cd /d ""%API%"" && npm run start:dev"
start "KaitoKid - API.Admin" cmd /k "cd /d ""%BACKEND%\API.Admin"" && dotnet run --urls http://0.0.0.0:5089"

timeout /t 2 /nobreak >nul

start "KaitoKid - Web Node Cutover Preview" cmd /k "cd /d ""%WEB%"" && set VITE_API_BASE_URL=http://localhost:5300&& set VITE_API_AUTH_URL=http://localhost:5300&& set VITE_API_ADMIN_URL=http://localhost:5089&& set VITE_CHAT_HUB_URL=http://localhost:5300/hubs/chat&& npm run dev"

echo.
echo Node API + API.Admin + Web preview dang khoi dong.
echo Mobile test: dat EXPO_PUBLIC_API_URL va EXPO_PUBLIC_AUTH_API_URL ve http://IP_MAY:5300.
endlocal
