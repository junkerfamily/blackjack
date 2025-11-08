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
    
    # Check if port is available, if not find a free one (only for local dev)
    if not os.environ.get('PORT'):  # PORT is set by Render, skip port checking in production
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
        except OSError:
            print(f"⚠️  Port {port} is already in use. Finding a free port...")
            port = find_free_port(5000)
            if port is None:
                print("❌ Could not find a free port. Please free up a port or specify FLASK_PORT.")
                exit(1)
            print(f"✅ Using port {port} instead")
    
    # Run in debug mode only if PORT is not set (local development)
    debug_mode = not bool(os.environ.get('PORT'))
    
    print(f"\n🚀 Blackjack server starting on port {port}")
    print(f"📍 Game: http://localhost:{port}/blackjack")
    print(f"📍 Card test: http://localhost:{port}/cards-test")
    if debug_mode:
        print(f"\nPress Ctrl+C to stop the server\n")
    
    app.run(debug=debug_mode, host='0.0.0.0', port=port)

