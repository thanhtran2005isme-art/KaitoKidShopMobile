@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Node API + Mobile

set "ROOT=%~dp0"
set "API=%ROOT%apps\api"
set "MOBILE=%ROOT%apps\mobile"

if not exist "%API%\package.json" (
  echo [LOI] Khong tim thay apps\api\package.json
  pause
  exit /b 1
)
if not exist "%API%\.env" (
  echo [LOI] Thieu apps\api\.env. Tao tu .env.example va dien DATABASE_URL/JWT_KEY.
  pause
  exit /b 1
)
if not exist "%MOBILE%\package.json" (
  echo [LOI] Khong tim thay apps\mobile\package.json
  pause
  exit /b 1
)

set "KAITOKID_BACKEND_MODE=node"
set "EXPO_PUBLIC_BACKEND_MODE=node"

echo [1/2] Starting Node API on port 5300...
start "KaitoKid - Node API" cmd /k call "%ROOT%scripts\run-node-api.bat"
timeout /t 2 /nobreak >nul

echo [2/2] Starting Expo Mobile...
start "KaitoKid - Expo Mobile" cmd /k call "%ROOT%scripts\run-mobile.bat"

echo Da mo Node API + Expo Mobile.
endlocal
