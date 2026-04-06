@echo off
title KisanSetu AgriPortal — Start
color 0A

echo.
echo  ================================================
echo    KisanSetu AgriPortal — Starting Server
echo  ================================================
echo.

:: Kill any process on port 8000
echo [1/2] Cleaning port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [2/2] Starting Backend + Admin + Portal (all on port 8000)...
start "KisanSetu Backend :8000" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --port 8000"
timeout /t 4 /nobreak >nul

echo.
echo  ================================================
echo    Server Started!
echo  ================================================
echo.
echo    API Docs     :  http://127.0.0.1:8000/docs
echo    Farmer Portal:  http://127.0.0.1:8000/frontend/pages/login.html
echo    Admin Panel  :  http://127.0.0.1:8000/admin/index.html
echo.
echo    Admin Login  :  admin@agriportal.gov.in  /  admin123
echo    Farmer Login :  ramesh2@farm.in  /  farmer123
echo.
echo  ================================================
echo.
echo  Press any key to open the Admin Panel...
pause >nul
start "" "http://127.0.0.1:8000/admin/index.html"
