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

# Auto-cleanup
pkill -9 -f "web/app_blackjack_only.py" 2>/dev/null
for p in 5000 5001 5002 5003; do lsof -ti:$p 2>/dev/null | xargs kill -9 2>/dev/null; done
sleep 1

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

