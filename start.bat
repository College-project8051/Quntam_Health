@echo off
echo ========================================
echo    Quantum Healthcare Application
echo ========================================
echo.
echo Starting Backend and Frontend servers...
echo.

:: Start Backend in a new window
echo Starting Backend server...
start "Quantum Backend" cmd /k "cd /d %~dp0Backend && npm run dev"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend in a new window
echo Starting Frontend server...
start "Quantum Frontend" cmd /k "cd /d %~dp0Frontend && npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Close the server windows to stop them.
echo ========================================
