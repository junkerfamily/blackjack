@echo off
REM Blackjack Game - Flask Server Startup Script (Windows)

REM Change to script directory
cd /d "%~dp0"

echo ============================================================
echo   BLACKJACK SERVER LAUNCHER
echo ============================================================
echo.

REM Kill any existing Flask processes
echo Cleaning up existing processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *app_blackjack_only*" >nul 2>&1

REM Kill processes on common ports
for %%P in (5000 5001 5002 5003) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%P') do (
        taskkill /F /PID %%a >nul 2>&1
        echo    Killed process on port %%P
    )
)

echo    No previous instances found (or already cleaned)
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo Installing dependencies...
    call venv\Scripts\activate.bat
    pip install -q -r requirements.txt
    echo Virtual environment ready
) else (
    REM Activate virtual environment
    call venv\Scripts\activate.bat
)

REM Check if all dependencies are installed
echo Verifying dependencies...
python -c "import flask, redis" 2>nul
if errorlevel 1 (
    echo Installing missing dependencies...
    pip install -q -r requirements.txt
    echo Dependencies installed
) else (
    echo All dependencies present
)

echo.
echo ============================================================
echo Starting server on port 5003...
echo ============================================================
echo.

REM Set the port
set FLASK_PORT=5003

REM Run the Flask app
python web\app_blackjack_only.py

pause

