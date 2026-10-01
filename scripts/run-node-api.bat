@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKid - Node API

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "API=%ROOT%\apps\api"

if not exist "%API%\package.json" (
  echo [LOI] Khong tim thay apps\api\package.json
  pause
  exit /b 1
)

if not exist "%API%\.env" (
  echo [LOI] Thieu apps\api\.env.
  echo Tao file tu apps\api\.env.example va dien DATABASE_URL/JWT local truoc khi cutover.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [LOI] Khong tim thay npm trong PATH.
  pause
  exit /b 1
)

pushd "%API%"
if not exist "node_modules\.bin\nest.cmd" (
  echo [SETUP] Dang cai Node API dependencies...
  call npm install
  if errorlevel 1 goto :error
)

echo [NODE] Starting NestJS API on PORT from .env ^(default 5300^)...
call npm run start:dev
if errorlevel 1 goto :error

popd
endlocal
exit /b 0

:error
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [LOI] Node API dung voi ma loi %EXIT_CODE%.
popd
pause
endlocal
exit /b %EXIT_CODE%
