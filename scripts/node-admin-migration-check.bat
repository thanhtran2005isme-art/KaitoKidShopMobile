@echo off
setlocal
cd /d "%~dp0..\apps\api"

echo ============================================================
echo  KaitoKid Node migration - Phase 10 API.Admin gate
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

echo.
echo [PASS] Phase 10 API.Admin source/build/DB-audit/contract gate passed.
echo [IMPORTANT] Day CHUA phai final C# retirement gate.
echo [NEXT] Chay runtime parity Admin tren MariaDB va Phase 11 final cutover truoc khi xoa backend C#.
