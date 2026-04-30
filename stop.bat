@echo off
setlocal
set "ROOT=%~dp0"

cd /d "%ROOT%"

echo Stopping Minecraft panel processes (backend/frontend/caddy/start.vbs)...
powershell -NoProfile -ExecutionPolicy Bypass -File ".\deploy\scripts\stop-panel.ps1"
if errorlevel 1 (
  echo Stop completed with warnings.
) else (
  echo Done.
)
pause
endlocal
