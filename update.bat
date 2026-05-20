@echo off
echo =======================================================
echo   AI Customer Service Translator - Windows Update Utility
echo =======================================================
echo.
echo Step 1: Pulling latest changes from git...
git pull
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git pull failed! Please check your network or git configuration.
    pause
    exit /b %errorlevel%
)
echo.
echo Step 2: Installing/updating npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed! Please review logs above.
    pause
    exit /b %errorlevel%
)
echo.
echo =======================================================
echo   Update completed successfully! App is ready.
echo =======================================================
pause
