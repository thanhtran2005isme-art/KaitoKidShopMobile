@echo off
setlocal EnableExtensions
chcp 65001 >nul
title KaitoKidShop - Run All

set "SCRIPTS=%~dp0"
set "KAITOKID_BACKEND_MODE=node"
set "EXPO_PUBLIC_BACKEND_MODE=node"
set "VITE_NODE_API_URL=http://127.0.0.1:5300"
set "VITE_CHAT_HUB_URL=http://127.0.0.1:5300"
set "VITE_CHAT_HUB_PATH=/chatHub"

start "KaitoKid - Node API" cmd /k call "%SCRIPTS%run-node-api.bat"
timeout /t 2 /nobreak >nul
start "KaitoKid - Web" cmd /k call "%SCRIPTS%run-web.bat"
start "KaitoKid - Mobile" cmd /k call "%SCRIPTS%run-mobile.bat"

echo KaitoKidShop Node API + Web + Mobile dang khoi dong.
endlocal
