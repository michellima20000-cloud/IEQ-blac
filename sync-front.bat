@echo off
echo ========================================================
echo IEQ - Sincronizar frontend e publicar na Vercel
echo ========================================================
echo.

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-front.ps1"
set "RESULT=%errorlevel%"

echo.
pause
exit /b %RESULT%
