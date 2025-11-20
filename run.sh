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

# Method 1: Kill by process name (catches Flask and Python processes)
pkill -9 -f "web/app_blackjack_only.py" 2>/dev/null && echo "   Killed Flask processes by name"
pkill -9 -f "flask run" 2>/dev/null && echo "   Killed Flask run processes"
pkill -9 -f "gunicorn.*app_blackjack" 2>/dev/null && echo "   Killed Gunicorn processes"
sleep 0.5

# Method 2: Kill by port (multiple passes to catch reloader processes)
for attempt in 1 2 3; do
    for PORT in 5000 5001 5002 5003; do
        PORT_CHECK=$(lsof -ti:$PORT 2>/dev/null)
        if [ ! -z "$PORT_CHECK" ]; then
            echo "   Attempt $attempt: Killing processes on port $PORT (PIDs: $PORT_CHECK)"
            echo "$PORT_CHECK" | xargs kill -9 2>/dev/null
        fi
    done
    sleep 0.5
done

# Method 3: Use fuser as backup (if available)
if command -v fuser >/dev/null 2>&1; then
    for PORT in 5000 5001 5002 5003; do
        fuser -k $PORT/tcp 2>/dev/null && echo "   Killed port $PORT using fuser"
    done
    sleep 0.5
fi

# Method 4: Final aggressive cleanup specifically for port 5003
for i in 1 2 3; do
    PORT_CHECK=$(lsof -ti:5003 2>/dev/null)
    if [ ! -z "$PORT_CHECK" ]; then
        echo "⚠️  Port 5003 still in use (attempt $i), killing PIDs: $PORT_CHECK"
        echo "$PORT_CHECK" | xargs kill -9 2>/dev/null
        sleep 1
    else
        break
    fi
done

# Final verification
if lsof -ti:5003 >/dev/null 2>&1; then
    echo "❌ ERROR: Port 5003 is STILL in use after cleanup attempts!"
    echo "   Please manually kill the process:"
    lsof -ti:5003 | xargs -I {} echo "   kill -9 {}"
    echo "   Or check what's using it: lsof -i:5003"
    exit 1
fi

echo "✅ Cleanup complete - port 5003 is free"

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

