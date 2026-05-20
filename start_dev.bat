@echo off
title AI Translator Helper - Dev
echo =======================================================
echo   AI Customer Service Translator - Windows Quick Start
echo =======================================================
echo.
cd /d "%~dp0"
echo Starting Electron app in development mode...
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application crashed or stopped with error code %errorlevel%.
    pause
)
