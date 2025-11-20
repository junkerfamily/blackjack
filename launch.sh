#!/bin/bash

# Simplified Blackjack Server Launcher
# Quick startup with auto-cleanup and clear port display

cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║              🎰  BLACKJACK SERVER LAUNCHER  🎰               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Auto-cleanup - be aggressive about killing Flask processes
echo "🧹 Cleaning up old processes..."

# Method 1: Kill by process name (catches Flask and Python processes)
pkill -9 -f "web/app_blackjack_only.py" 2>/dev/null && echo "   Killed Flask processes by name"
pkill -9 -f "flask run" 2>/dev/null && echo "   Killed Flask run processes"
pkill -9 -f "gunicorn.*app_blackjack" 2>/dev/null && echo "   Killed Gunicorn processes"
sleep 0.5

# Method 2: Kill by port (multiple passes to catch reloader processes)
for attempt in 1 2 3; do
    for p in 5000 5001 5002 5003; do
        pids=$(lsof -ti:$p 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo "   Attempt $attempt: Killing processes on port $p (PIDs: $pids)"
            echo "$pids" | xargs kill -9 2>/dev/null
        fi
    done
    sleep 0.5
done

# Method 3: Use fuser as backup (if available)
if command -v fuser >/dev/null 2>&1; then
    for p in 5000 5001 5002 5003; do
        fuser -k $p/tcp 2>/dev/null && echo "   Killed port $p using fuser"
    done
    sleep 0.5
fi

# Method 4: Final aggressive cleanup specifically for port 5003
for i in 1 2 3; do
    pids=$(lsof -ti:5003 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "⚠️  Port 5003 still in use (attempt $i), killing PIDs: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null
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

# Activate venv
[ ! -d "venv" ] && python3 -m venv venv
source venv/bin/activate

# Install deps silently if needed
python3 -c "import flask, redis" 2>/dev/null || pip install -q -r requirements.txt

# Force port
export FLASK_PORT=5003

echo "   Starting on PORT 5003..."
echo ""

# Launch
python3 web/app_blackjack_only.py

