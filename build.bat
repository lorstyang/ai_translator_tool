@echo off
echo =======================================================
echo   AI Customer Service Translator - Windows Packaging Tool
echo =======================================================
echo.
REM Set environment variables for Electron and Builder mirror sources
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed!
    pause
    exit /b %errorlevel%
)
echo.
echo Step 2: Building React production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] React build compilation failed!
    pause
    exit /b %errorlevel%
)
echo.
echo Step 3: Packaging Electron app to executable (.exe)...
call npm run dist
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Electron packaging failed!
    pause
    exit /b %errorlevel%
)
echo.
echo =======================================================
echo   Build and packaging completed successfully!
echo   Outputs are located in the "release" directory.
echo =======================================================
pause
