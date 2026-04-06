@echo off
title AgriPortal — Development Mode
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║     AgriPortal — React + FastAPI Dev Launcher     ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

:: Start FastAPI backend in a new window
echo  [1/2] Starting FastAPI backend on port 8000...
start "AgriPortal — Backend (FastAPI)" cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --reload --port 8000"

:: Wait 3 seconds for backend to warm up
timeout /t 3 /nobreak >nul

:: Start Vite React dev server in a new window
echo  [2/2] Starting React dev server on port 5173...
start "AgriPortal — Frontend (React)" cmd /k "cd /d %~dp0\frontend-react && npm run dev"

:: Wait 3 seconds then open browser
timeout /t 3 /nobreak >nul

echo.
echo  ✅ Both servers started!
echo.
echo  📌 React App  →  http://localhost:5173
echo  📌 API Docs   →  http://127.0.0.1:8000/docs
echo  📌 Legacy UI  →  http://127.0.0.1:8000/legacy-frontend
echo.

start "" "http://localhost:5173"

pause
