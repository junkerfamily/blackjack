#!/bin/bash

# Blackjack Game - Flask Server Startup Script

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "════════════════════════════════════════════════════════════"
echo "  BLACKJACK SERVER LAUNCHER"
echo "════════════════════════════════════════════════════════════"
echo ""

# Kill any existing Flask processes
echo "🧹 Cleaning up existing processes..."
pkill -f "web/app_blackjack_only.py" 2>/dev/null && echo "   Killed previous Flask instance" || echo "   No previous instances found"

# Kill processes on common ports
for PORT in 5000 5001 5002 5003; do
    PORT_CHECK=$(lsof -ti:$PORT 2>/dev/null)
    if [ ! -z "$PORT_CHECK" ]; then
        echo "   Killing process on port $PORT (PID: $PORT_CHECK)"
        kill -9 $PORT_CHECK 2>/dev/null
        sleep 0.5
    fi
done

echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "📦 Installing dependencies..."
    source venv/bin/activate
    pip install -q -r requirements.txt
    echo "✅ Virtual environment ready"
else
    # Activate virtual environment
    source venv/bin/activate
fi

# Check if all dependencies are installed
echo "🔍 Verifying dependencies..."
if ! python3 -c "import flask, redis" 2>/dev/null; then
    echo "📦 Installing missing dependencies..."
    pip install -q -r requirements.txt
    echo "✅ Dependencies installed"
else
    echo "✅ All dependencies present"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🚀 Starting server on port 5003..."
echo "════════════════════════════════════════════════════════════"
echo ""

# Export the port so the app uses it
export FLASK_PORT=5003

# Run the Flask app
python3 web/app_blackjack_only.py

