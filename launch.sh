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
pkill -9 -f "web/app_blackjack_only.py" 2>/dev/null && echo "   Killed Flask processes"
sleep 0.5

# Kill by port (multiple passes to catch reloader processes)
for p in 5000 5001 5002 5003; do
    pids=$(lsof -ti:$p 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "   Killing processes on port $p: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null
    fi
done
sleep 1

# Final verification that port 5003 is clear
if lsof -ti:5003 >/dev/null 2>&1; then
    echo "⚠️  Port 5003 still in use, killing again..."
    lsof -ti:5003 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "✅ Cleanup complete"

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

