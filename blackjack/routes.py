"""
Blackjack game API endpoints
"""

import json
from flask import Blueprint, request, jsonify
from blackjack.game_logic import BlackjackGame, GameState

# Store active games (in production, use Redis or database)
active_games: dict = {}

blackjack_bp = Blueprint('blackjack', __name__, url_prefix='/api')


def get_game(game_id: str) -> BlackjackGame:
    """Get a game by ID, create if doesn't exist"""
    if game_id not in active_games:
        active_games[game_id] = BlackjackGame(starting_chips=10000)
    return active_games[game_id]


@blackjack_bp.route('/new_game', methods=['POST'])
def new_game():
    """Start a new game"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if game_id:
            # Continue existing game
            game = get_game(game_id)
        else:
            # Create new game
            starting_chips = data.get('starting_chips', 1000)
            
            # Validate starting_chips
            try:
                starting_chips = int(starting_chips)
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Invalid starting_chips value'
                }), 400
            
            if starting_chips < 1:
                return jsonify({
                    'success': False,
                    'error': 'Starting chips must be at least 1'
                }), 400
            
            if starting_chips > 1000000:
                return jsonify({
                    'success': False,
                    'error': 'Maximum starting chips is 1,000,000'
                }), 400
            
            game = BlackjackGame(starting_chips=starting_chips)
            active_games[game.game_id] = game
        
        game.new_game()
        
        return jsonify({
            'success': True,
            'game_id': game.game_id,
            'game_state': game.get_game_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/bet', methods=['POST'])
def place_bet():
    """Place a bet"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        game_id = data.get('game_id')
        amount = data.get('amount')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        if not amount or amount <= 0:
            return jsonify({'success': False, 'error': 'Valid bet amount required'}), 400
        
        game = get_game(game_id)
        result = game.place_bet(amount)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result['message'],
                'game_state': game.get_game_state()
            })
        else:
            return jsonify({
                'success': False,
                'error': result['message'],
                'game_state': game.get_game_state()
            }), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/deal', methods=['POST'])
def deal():
    """Deal initial cards"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.deal_initial_cards()
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': result['message'],
                'game_state': game.get_game_state()
            })
        else:
            return jsonify({
                'success': False,
                'error': result['message'],
                'game_state': game.get_game_state()
            }), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/hit', methods=['POST'])
def hit():
    """Player hits"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.hit()
        
        return jsonify({
            'success': result['success'],
            'message': result.get('message', ''),
            'bust': result.get('bust', False),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/stand', methods=['POST'])
def stand():
    """Player stands"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.stand()
        
        return jsonify({
            'success': result['success'],
            'message': result.get('message', ''),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/double_down', methods=['POST'])
def double_down():
    """Player doubles down"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.double_down()
        
        return jsonify({
            'success': result['success'],
            'message': result.get('message', ''),
            'bust': result.get('bust', False),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/split', methods=['POST'])
def split():
    """Player splits hand"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.split()
        
        return jsonify({
            'success': result['success'],
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/game_state', methods=['GET'])
def get_game_state():
    """Get current game state"""
    try:
        game_id = request.args.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        return jsonify({
            'success': True,
            'game_state': game.get_game_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/insurance', methods=['POST'])
def insurance():
    """Handle insurance/even money decision"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        decision = data.get('decision')  # 'buy' | 'decline' | 'even_money'
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        if decision not in ('buy', 'decline', 'even_money'):
            return jsonify({'success': False, 'error': 'Invalid decision'}), 400
        
        game = get_game(game_id)
        result = game.insurance_decision(decision)
        status = 200 if result.get('success') else 400
        return jsonify({
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        }), status
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/auto_mode/start', methods=['POST'])
def auto_mode_start():
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        default_bet = data.get('default_bet')
        hands = data.get('hands')
        insurance_mode = data.get('insurance_mode', 'never')

        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        if default_bet is None or hands is None:
            return jsonify({'success': False, 'error': 'Default bet and hands required'}), 400

        game = get_game(game_id)
        result = game.start_auto_mode(int(default_bet), int(hands), insurance_mode)
        if result.get('success'):
            game.run_auto_cycle()
        status = 200 if result.get('success') else 400
        return jsonify({
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }), status
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        return jsonify({'success': False, 'error': error_msg, 'message': error_msg}), 500


@blackjack_bp.route('/auto_mode/stop', methods=['POST'])
def auto_mode_stop():
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')

        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400

        game = get_game(game_id)
        result = game.stop_auto_mode_request()
        status = 200 if result.get('success') else 400
        return jsonify({
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }), status
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

