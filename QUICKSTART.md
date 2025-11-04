# Quick Start Guide

## Running the Game (Easiest Way)

**Just run the startup script:**
```bash
./run.sh
```

Or on Windows:
```batch
run.bat
```

That's it! The script will:
- Create virtual environment if needed
- Install dependencies automatically
- Start the Flask server

Then open your browser to:
- **Main game:** http://localhost:5000/blackjack
- **Card test page:** http://localhost:5000/cards-test

## Manual Setup (Alternative)

If you prefer to run things manually:

1. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask app:**
   ```bash
   python3 web/app_blackjack_only.py
   ```

## Notes

- The startup script (`run.sh` or `run.bat`) handles everything automatically
- The app runs on port 5000 by default
- Press `Ctrl+C` to stop the server
- On macOS/Linux, make sure `run.sh` is executable (it should be already)

