#!/bin/bash

# Blackjack Game - Flask Server Startup Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
else
    # Activate virtual environment
    source venv/bin/activate
fi

# Check if Flask is installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "❌ Flask not found in virtual environment!"
    echo "Installing Flask..."
    pip install -r requirements.txt
fi

# Check if port 5003 is in use and kill it if needed
PORT_CHECK=$(lsof -ti:5003 2>/dev/null)
if [ ! -z "$PORT_CHECK" ]; then
    echo "⚠️  Port 5003 is in use (PID: $PORT_CHECK)"
    read -p "Kill the process using port 5003? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PORT_CHECK 2>/dev/null
        echo "✅ Killed process on port 5003"
        sleep 1
    else
        echo "ℹ️  Continuing with port detection (app will find a free port)..."
    fi
fi

echo "🚀 Starting Blackjack Flask server..."
echo "Press Ctrl+C to stop the server"
echo ""

# Run the Flask app
python3 web/app_blackjack_only.py

