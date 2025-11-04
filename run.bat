@echo off
REM Blackjack Game - Flask Server Startup Script (Windows)

REM Change to script directory
cd /d "%~dp0"

REM Check if virtual environment exists
if not exist "venv" (
    echo Virtual environment not found!
    echo Creating virtual environment...
    python -m venv venv
    echo Installing dependencies...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    REM Activate virtual environment
    call venv\Scripts\activate.bat
)

REM Check if Flask is installed
python -c "import flask" 2>nul
if errorlevel 1 (
    echo Flask not found in virtual environment!
    echo Installing Flask...
    pip install -r requirements.txt
)

REM Check if port 5000 is in use
netstat -ano | findstr :5000 >nul
if %errorlevel% equ 0 (
    echo Port 5000 is already in use.
    echo The app will automatically find a free port.
    echo.
)

echo Starting Blackjack Flask server...
echo Press Ctrl+C to stop the server
echo.

REM Run the Flask app
python web\app_blackjack_only.py

pause

