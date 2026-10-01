@echo off
setlocal
cd /d "%~dp0..\apps\api"

echo ============================================================
echo  KaitoKid Node backend - source/build/DB/contract gate
echo ============================================================

call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
call npm run db:audit
if errorlevel 1 exit /b 1
call npm run test:catalog
if errorlevel 1 exit /b 1
call npm run test:customer-aux
if errorlevel 1 exit /b 1
call npm run test:cart-reservation
if errorlevel 1 exit /b 1
call npm run test:checkout-order
if errorlevel 1 exit /b 1
call npm run test:auth-rbac
if errorlevel 1 exit /b 1
call npm run test:realtime-cutover
if errorlevel 1 exit /b 1
call npm run test:admin-migration
if errorlevel 1 exit /b 1

cd /d "..\web"
call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1

echo [PASS] Node backend source/build/DB-audit/contracts + Web build passed.
endlocal
exit /b 0
