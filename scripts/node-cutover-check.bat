@echo off
setlocal
cd /d "%~dp0..\apps\api"

echo ============================================================
echo  KaitoKid Node migration - Phase 9 gate
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

cd /d "..\web"
call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1

echo.
echo [PASS] Node Auth + Customer + Web realtime adapter source/static gates passed.
echo [IMPORTANT] Van CHUA duoc tat API.Admin C#: 23 admin controllers chua migrate Node.
echo [NEXT] Chay runtime parity theo docs\NODE_CUTOVER_RUNBOOK.md.
