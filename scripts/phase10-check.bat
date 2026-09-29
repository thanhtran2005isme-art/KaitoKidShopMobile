@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKid - PHASE 10 Check

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

echo ==================================================
echo KaitoKid PHASE 10 - Static + build + backend tests
echo ==================================================
echo.

call npm run phase10:check
if errorlevel 1 (
  echo.
  echo [FAIL] PHASE 10 check co loi. Copy log loi va gui lai de sua tiep.
  exit /b 1
)

echo.
echo [PASS] Lint/typecheck/Web build/backend tests da pass.
echo [NOTE] Van can manual E2E tren Android/Expo Web theo docs/PHASES_5_10.md.
exit /b 0
