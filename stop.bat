@echo off
setlocal
set "ROOT=%~dp0"

cd /d "%ROOT%"

echo Stopping Mineraft dev processes on ports 3000 and 5173...

for %%P in (3000 5173) do (
  for /f "tokens=5" %%I in ('netstat -aon ^| findstr /R /C:":%%P .*LISTENING"') do (
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo Done.
pause
endlocal
