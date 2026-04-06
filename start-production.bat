@echo off
title AgriPortal — Production Build
color 0B

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║    AgriPortal — Production Build + Launch         ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

:: Build the React app
echo  [1/2] Building React app...
cd /d %~dp0\frontend-react
call npm run build

if %ERRORLEVEL% neq 0 (
    echo  ❌ Build failed! Check errors above.
    pause
    exit /b 1
)

echo  ✅ React build successful → backend/static/react/
echo.

:: Start FastAPI (serves both the API and the React build)
echo  [2/2] Starting FastAPI server on port 8000...
cd /d %~dp0
start "" "http://127.0.0.1:8000/app"
python -m uvicorn backend.main:app --port 8000

pause
