@echo off
setlocal
cd /d "%~dp0"

if "%1"=="" (
    echo [OmniRouter] Starting background gateway...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\daemon.ps1" start
    timeout /t 2 /nobreak >nul
    start http://127.0.0.1:3000/
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\daemon.ps1" %*
)
