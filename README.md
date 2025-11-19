# Blackjack Game

A full-featured blackjack web application with Flask backend and vanilla JavaScript frontend.

## Quick Start

### Starting the Server

We provide three ways to start the server, all automatically kill any stuck processes and start on port **5003**:

**Option 1: Quick Launch (Recommended)**
```bash
./launch.sh
```

**Option 2: Standard Launch**
```bash
./run.sh
```

**Option 3: Windows**
```bash
run.bat
```

All scripts will:
- ✅ Auto-kill any existing Flask processes
- ✅ Clear ports 5000-5003
- ✅ Create/activate virtual environment
- ✅ Install dependencies (Flask, Redis, etc.)
- ✅ Start server on port 5003
- ✅ Display a clear banner with the port and URL

### Expected Output

When the server starts successfully, you'll see:

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║              ✅  BLACKJACK SERVER READY  ✅                       ║
║                                                                   ║
║              PORT: 5003                                           ║
║                                                                   ║
║              🎰 PLAY: http://localhost:5003/blackjack            ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Accessing the Game

Open your browser (or use Cursor's built-in browser) and navigate to:
- **Main Game:** http://localhost:5003/blackjack
- **Health Check:** http://localhost:5003/health
- **Card Test:** http://localhost:5003/cards-test

---

## Project Overview

This folder contains all blackjack-related files created/modified today that should be moved to the correct Blackjack project folder.

## Directory Structure

```
blackjack_to_move/
├── README.md (this file)
├── docs/                          # Documentation files
│   ├── BLACKJACK_PLAN.md         # Complete development plan
│   ├── PHASE1_COMPLETE.md        # Phase 1 completion summary
│   ├── PHASE2_LIVE_TEST.md       # Phase 2 live test results
│   └── PHASE2_TEST_RESULTS.md    # Phase 2 test results
├── blackjack/                     # Backend Python module
│   ├── __init__.py
│   ├── dealer.py                 # Dealer AI logic
│   ├── deck.py                   # Card deck management
│   ├── game_logic.py             # Core game rules and logic
│   ├── player.py                 # Player class
│   ├── routes.py                 # Flask API routes
│   └── test_backend.py           # Backend tests
├── web/                          # Frontend files
│   ├── app_blackjack_only.py     # Extracted blackjack Flask routes
│   ├── static/
│   │   ├── css/
│   │   │   └── cards.css         # Card styling and animations
│   │   └── js/
│   │       ├── card.js           # Card rendering classes
│   │       └── animations.js     # Animation utilities
│   └── templates/
│       └── cards_test.html       # Test page for card rendering
└── test_cards_standalone.html    # Standalone test page
```

## Files Included

### New Files (All Untracked in Git)

1. **Documentation** (`docs/`)
   - Complete development plan and phase completion notes
   - Test results and live test documentation

2. **Backend** (`blackjack/`)
   - Complete Python module with all game logic
   - Card deck management
   - Player and dealer classes
   - Flask API routes blueprint
   - Backend tests

3. **Frontend** (`web/`)
   - Card rendering CSS with animations
   - Card JavaScript classes (Card, CardManager)
   - Animation utilities
   - Test HTML template
   - Extracted Flask routes for blackjack

4. **Standalone Test**
   - `test_cards_standalone.html` - Standalone test page

## Files Modified in Main Project

The following files in the main EventMaker project were modified to add blackjack functionality:

### `web/app.py`
**Modified sections:**
- Lines 22-27: Added blackjack blueprint registration
- Lines 290-293: Added `/cards-test` route for card rendering test

**Note:** The blackjack-specific code has been extracted to `web/app_blackjack_only.py` in this folder. You may want to remove these sections from the main project's `web/app.py` after moving files.

### `requirements.txt`
**Likely modified:** Flask dependency was added (though this may have already existed for the EventMaker web app).

### `.gitignore`
**May have been modified:** Standard Python/gitignore updates (no blackjack-specific changes expected).

## What to Do Next

1. **Review the files** in this folder to ensure everything is included
2. **Move the entire `blackjack_to_move/` folder** to your Blackjack project directory
3. **Integrate the files** into the Blackjack project structure:
   - Merge `blackjack/` backend module into your Blackjack project
   - Merge `web/` frontend files into your Blackjack project's web structure
   - Update documentation as needed
   - Adapt `app_blackjack_only.py` routes to your Flask app structure
4. **Clean up the EventMaker project**:
   - Remove blackjack-related code from `web/app.py` (lines 22-27, 290-293)
   - Decide if you want to remove the `blackjack/` directory from EventMaker
   - Remove blackjack frontend files from `web/static/` and `web/templates/`
   - Remove standalone test file if desired

## Dependencies

The blackjack module requires:
- Flask (for web routes)
- Standard Python libraries (no external dependencies beyond Flask)

The frontend uses:
- Vanilla JavaScript (ES6+)
- CSS3 animations
- No external JavaScript libraries

## Integration Notes

- The `blackjack` module is designed as a Flask blueprint, so it can be easily integrated into any Flask app
- The frontend files are self-contained and can be integrated into any web structure
- Card rendering is CSS-based, no images required
- All animations are CSS keyframes for performance

## Status

All files are complete and ready to move. Phase 1 (backend) and Phase 2 (card rendering) are fully implemented and tested.

## Redis Persistence

The blackjack backend now supports persisting live game sessions in Redis so multiplayer runs survive server restarts. Configure the following environment variables before deploying:

- `REDIS_URL` – connection string for your Redis instance (for example `redis://:password@hostname:6379/0`). When unset, the game falls back to in-memory storage only.
- `GAME_STATE_TTL` – optional number of seconds to keep each game snapshot in Redis (defaults to 86,400 seconds / 24 hours).

Each hand update writes the serialized `BlackjackGame` state to Redis and reloads it automatically when a request provides a matching `game_id`. Ensure your Render service (or other host) exposes the chosen `REDIS_URL` to the Flask process.

