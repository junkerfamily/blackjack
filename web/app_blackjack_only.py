#!/usr/bin/env python3
"""
Blackjack-specific Flask routes extracted from web/app.py
This file contains only the blackjack-related routes and blueprint registration.
"""

import os
import sys
import socket
from flask import Flask, render_template, jsonify

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Add project root to Python path so we can import blackjack module
sys.path.insert(0, PROJECT_ROOT)

app = Flask(__name__, 
            template_folder=os.path.join(SCRIPT_DIR, 'templates'),
            static_folder=os.path.join(SCRIPT_DIR, 'static'))

# Register blackjack blueprint
try:
    from blackjack.routes import blackjack_bp
    app.register_blueprint(blackjack_bp)
    print("✅ Blackjack blueprint registered successfully")
except ImportError as e:
    print(f"❌ Warning: Could not import blackjack routes: {e}")
    print("Make sure you're running from the project root directory")
except Exception as e:
    print(f"❌ Error registering blackjack blueprint: {e}")
    import traceback
    traceback.print_exc()

@app.route('/')
@app.route('/blackjack')
def blackjack():
    """Main blackjack game page"""
    return render_template('blackjack.html')

@app.route('/cards-test')
def cards_test():
    """Test page for blackjack card rendering"""
    return render_template('cards_test.html')

@app.route('/dealer-peek-demo')
def dealer_peek_demo():
    """Standalone page to showcase the dealer peek animation"""
    return render_template('peek_demo.html')

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Server is running'
    })

def find_free_port(start_port=5000, max_attempts=10):
    """Find a free port starting from start_port"""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    return None

if __name__ == '__main__':
    # Get port from environment variable (Render uses PORT, fallback to FLASK_PORT or 5000)
    port = int(os.environ.get('PORT', os.environ.get('FLASK_PORT', 5000)))
    flask_port_explicitly_set = bool(os.environ.get('FLASK_PORT'))
    
    # Flask's reloader runs code in a child process. WERKZEUG_RUN_MAIN is set in the child.
    # We only want to do port checking in the actual Flask process, not the reloader parent.
    is_reloader_child = os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
    
    # Only do port checking in the reloader child (actual Flask process), not the parent
    # Skip port checking entirely in production (when PORT env var is set by Render)
    if not os.environ.get('PORT') and is_reloader_child:
        # Do a quick, non-blocking check - if port is busy, warn but let Flask try anyway
        # Flask's reloader can cause false positives, so we're lenient here
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(('', port))
        except OSError:
            # Port appears busy, but Flask will handle the actual binding
            # Don't exit - let Flask try and give its own error if it fails
            if flask_port_explicitly_set:
                print(f"⚠️  Note: Port {port} appears busy, but Flask will attempt to bind...")
            else:
                # No explicit port set, find a free one
                print(f"⚠️  Port {port} is already in use. Finding a free port...")
                port = find_free_port(5000)
                if port is None:
                    print("❌ Could not find a free port. Please free up a port or specify FLASK_PORT.")
                    exit(1)
                print(f"✅ Using port {port} instead")
    
    # Run in debug mode only if PORT is not set (local development)
    debug_mode = not bool(os.environ.get('PORT'))
    
    # Print big obvious banner with port info
    print("\n")
    print("╔═══════════════════════════════════════════════════════════════════╗")
    print("║                                                                   ║")
    print("║              ✅  BLACKJACK SERVER READY  ✅                       ║")
    print("║                                                                   ║")
    print(f"║              PORT: {port:<4}                                          ║")
    print("║                                                                   ║")
    print(f"║              🎰 PLAY: http://localhost:{port}/blackjack{' ' * (19 - len(str(port)))}║")
    print("║                                                                   ║")
    print("╚═══════════════════════════════════════════════════════════════════╝")
    print("")
    print(f"   📍 Card test:        http://localhost:{port}/cards-test")
    print(f"   📍 Dealer peek demo: http://localhost:{port}/dealer-peek-demo")
    print(f"   📍 Health check:     http://localhost:{port}/health")
    if debug_mode:
        print(f"\n   Press Ctrl+C to stop the server")
        print(f"   ⚠️  Note: Flask debug mode may show reloader messages - actual port is {port}\n")
    else:
        print("")
    
    # Explicitly print the port one more time right before starting
    print(f"🚀 Starting Flask server on port {port}...")
    app.run(debug=debug_mode, host='0.0.0.0', port=port)

