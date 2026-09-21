@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "DB_LOCAL=%ROOT%\backend\db.local.bat"
set "DB_EXAMPLE=%ROOT%\backend\db.local.example.bat"

if not exist "%DB_EXAMPLE%" (
  echo [DB] Khong tim thay backend\db.local.example.bat
  endlocal
  exit /b 1
)

if not exist "%DB_LOCAL%" (
  copy /y "%DB_EXAMPLE%" "%DB_LOCAL%" >nul
  if errorlevel 1 (
    echo [DB] Khong the tao backend\db.local.bat
    endlocal
    exit /b 1
  )

  echo.
  echo ==================================================
  echo [DB] Lan chay dau: da tao backend\db.local.bat
  echo [DB] Hay thay CHANGE_ME bang password MariaDB local.
  echo [DB] File nay da duoc .gitignore, se khong push len Git.
  echo ==================================================
  echo.
  start "" notepad "%DB_LOCAL%"
  endlocal
  exit /b 2
)

findstr /C:"Password=CHANGE_ME" "%DB_LOCAL%" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ==================================================
  echo [DB] backend\db.local.bat van con Password=CHANGE_ME
  echo [DB] Hay nhap password MariaDB cua user kaitokid.
  echo ==================================================
  echo.
  start "" notepad "%DB_LOCAL%"
  endlocal
  exit /b 2
)

endlocal & call "%DB_LOCAL%"

if "%ConnectionStrings__DefaultConnection%"=="" (
  echo [DB] db.local.bat khong dat ConnectionStrings__DefaultConnection
  exit /b 1
)

exit /b 0
