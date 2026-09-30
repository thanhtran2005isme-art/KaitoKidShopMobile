@echo off
setlocal
cd /d "%~dp0.."

echo ============================================================
echo  KaitoKid - Node API migration runtime
echo ============================================================

if not exist "apps\api\node_modules" (
  echo [INFO] apps\api\node_modules chua co - dang npm install...
  call npm --prefix apps\api install
  if errorlevel 1 exit /b 1
)

cd /d "apps\api"
call npm run build
if errorlevel 1 exit /b 1

echo [INFO] Starting NestJS API on PORT from apps\api\.env...
call npm run start
