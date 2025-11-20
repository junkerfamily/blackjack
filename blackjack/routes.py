"""
Blackjack game API endpoints
"""

import json
import logging
import os
from typing import Optional

import redis
from redis.exceptions import RedisError
from flask import Blueprint, request, jsonify, send_file
from blackjack.game_logic import BlackjackGame, GameState

# Store active games locally as an in-memory cache
active_games: dict = {}

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL')
REDIS_TTL_SECONDS = int(os.getenv('GAME_STATE_TTL', '86400'))

try:
    redis_client: Optional[redis.Redis] = redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
except Exception as exc:
    logger.warning("Failed to initialize Redis client: %s", exc)
    redis_client = None


def _redis_key(game_id: str) -> str:
    return f"game:{game_id}"


def _load_game_from_redis(game_id: str) -> Optional[BlackjackGame]:
    if not redis_client:
        return None
    try:
        payload = redis_client.get(_redis_key(game_id))
        if not payload:
            return None
        data = json.loads(payload)
        game = BlackjackGame.from_storage_dict(data)
        # Ensure the stored ID aligns with the requested key
        game.game_id = game_id
        return game
    except (RedisError, json.JSONDecodeError, KeyError, ValueError) as exc:
        logger.warning("Failed to load game %s from Redis: %s", game_id, exc)
        return None


def _save_game_to_redis(game: BlackjackGame):
    if not redis_client:
        return
    try:
        payload = game.to_storage_dict()
        redis_client.setex(_redis_key(game.game_id), REDIS_TTL_SECONDS, json.dumps(payload))
    except RedisError as exc:
        logger.warning("Failed to persist game %s to Redis: %s", game.game_id, exc)


def _delete_game_from_redis(game_id: str):
    if not redis_client:
        return
    try:
        redis_client.delete(_redis_key(game_id))
    except RedisError as exc:
        logger.warning("Failed to delete game %s from Redis: %s", game_id, exc)


blackjack_bp = Blueprint('blackjack', __name__, url_prefix='/api')


def get_game(game_id: Optional[str]) -> BlackjackGame:
    """Get a game by ID, restoring from Redis if available or creating a new one."""
    if game_id:
        cached = active_games.get(game_id)
        if cached:
            return cached

        restored = _load_game_from_redis(game_id)
        if restored:
            active_games[game_id] = restored
            return restored

        # No stored game - create a fresh instance with provided ID
        game = BlackjackGame(starting_chips=10000, num_decks=6)
        game.game_id = game_id
        active_games[game_id] = game
        return game

    # No game_id provided - create a new game with its own ID
    game = BlackjackGame(starting_chips=10000, num_decks=6)
    active_games[game.game_id] = game
    return game


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
            num_decks = data.get('num_decks', 6)
            
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
            
            # Validate num_decks
            try:
                num_decks = int(num_decks)
            except (ValueError, TypeError):
                num_decks = 6
            
            if num_decks < 1 or num_decks > 8:
                num_decks = 6
            
            dealer_hits_soft_17 = data.get('dealer_hits_soft_17', False)
            
            game = BlackjackGame(starting_chips=starting_chips, num_decks=num_decks, dealer_hits_soft_17=dealer_hits_soft_17)
            active_games[game.game_id] = game
        
        game.new_game()
        _save_game_to_redis(game)
        
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
        success = result.get('success', False)
        status = 200 if success else 400
        payload = {
            'success': success,
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        if not success:
            payload['error'] = result.get('message', '')
        _save_game_to_redis(game)
        return jsonify(payload), status
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
        success = result.get('success', False)
        status = 200 if success else 400
        payload = {
            'success': success,
            'message': result.get('message', ''),
            'game_over': result.get('game_over', False),
            'dealer_peeked': result.get('dealer_peeked', False),
            'game_state': game.get_game_state()
        }
        if not success:
            payload['error'] = result.get('message', '')
        _save_game_to_redis(game)
        return jsonify(payload), status
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
        payload = {
            'success': result['success'],
            'message': result.get('message', ''),
            'bust': result.get('bust', False),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
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
        payload = {
            'success': result['success'],
            'message': result.get('message', ''),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
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
        payload = {
            'success': result['success'],
            'message': result.get('message', ''),
            'bust': result.get('bust', False),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
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
        payload = {
            'success': result['success'],
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/surrender', methods=['POST'])
def surrender():
    """Player surrenders hand"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.surrender()
        payload = {
            'success': result['success'],
            'message': result.get('message', ''),
            'game_over': result.get('game_over', False),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
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
        payload = {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_over': result.get('game_over', False),
            'dealer_peeked': result.get('dealer_peeked', False),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload), status
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
        strategy = data.get('strategy', 'basic')
        betting_strategy = data.get('betting_strategy', 'fixed')
        bet_percentage = data.get('bet_percentage')
        double_down_pref = data.get('double_down_pref', 'recommended')
        split_pref = data.get('split_pref', 'recommended')
        surrender_pref = data.get('surrender_pref', 'recommended')

        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        if default_bet is None or hands is None:
            return jsonify({'success': False, 'error': 'Default bet and hands required'}), 400

        # Validate strategy
        if strategy not in ('basic', 'conservative', 'aggressive'):
            strategy = 'basic'
        
        # Validate betting strategy
        if betting_strategy not in ('fixed', 'progressive', 'percentage'):
            betting_strategy = 'fixed'
        
        # Validate bet percentage if using percentage strategy
        if betting_strategy == 'percentage':
            if bet_percentage is None or bet_percentage <= 0 or bet_percentage > 100:
                return jsonify({'success': False, 'error': 'Valid bet percentage (1-100) required for percentage betting strategy'}), 400
        
        # Validate action preferences
        if double_down_pref not in ('always', 'never', 'recommended'):
            double_down_pref = 'recommended'
        if split_pref not in ('always', 'never', 'recommended'):
            split_pref = 'recommended'
        if surrender_pref not in ('always', 'never', 'recommended'):
            surrender_pref = 'recommended'

        game = get_game(game_id)
        result = game.start_auto_mode(
            int(default_bet),
            int(hands),
            insurance_mode,
            strategy=strategy,
            betting_strategy=betting_strategy,
            bet_percentage=bet_percentage,
            double_down_pref=double_down_pref,
            split_pref=split_pref,
            surrender_pref=surrender_pref
        )
        if result.get('success'):
            game.run_auto_cycle()
        status = 200 if result.get('success') else 400
        payload = {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload), status
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
        payload = {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload), status
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/auto_mode/download_log', methods=['GET'])
def download_auto_mode_log():
    """Download the auto mode log file"""
    try:
        game_id = request.args.get('game_id')
        log_filename = request.args.get('filename')

        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        if not log_filename:
            return jsonify({'success': False, 'error': 'Log filename required'}), 400

        game = get_game(game_id)
        
        # Verify the log filename belongs to this game
        if game.auto_mode_log_filename != log_filename:
            return jsonify({'success': False, 'error': 'Invalid log filename'}), 403

        # Get the project root directory
        current_file = os.path.abspath(__file__)
        blackjack_dir = os.path.dirname(current_file)
        project_root = os.path.dirname(blackjack_dir)
        
        # If project root doesn't exist, try current working directory
        if not os.path.exists(project_root):
            project_root = os.getcwd()
        
        # Construct log file path
        log_dir = os.path.join(project_root, 'AutoMode')
        log_path = os.path.join(log_dir, log_filename)
        
        # Verify file exists
        if not os.path.exists(log_path):
            return jsonify({'success': False, 'error': 'Log file not found'}), 404
        
        # Send file as download
        return send_file(
            log_path,
            mimetype='text/plain',
            as_attachment=True,
            download_name=log_filename
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/auto_mode/log_contents', methods=['GET'])
def view_auto_mode_log():
    """Retrieve the auto mode log file content for viewing"""
    try:
        game_id = request.args.get('game_id')
        log_filename = request.args.get('filename')

        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        if not log_filename:
            return jsonify({'success': False, 'error': 'Log filename required'}), 400

        game = get_game(game_id)

        if game.auto_mode_log_filename != log_filename:
            return jsonify({'success': False, 'error': 'Invalid log filename'}), 403

        current_file = os.path.abspath(__file__)
        blackjack_dir = os.path.dirname(current_file)
        project_root = os.path.dirname(blackjack_dir)

        if not os.path.exists(project_root):
            project_root = os.getcwd()

        log_dir = os.path.join(project_root, 'AutoMode')
        log_path = os.path.join(log_dir, log_filename)

        if not os.path.exists(log_path):
            return jsonify({'success': False, 'error': 'Log file not found'}), 404

        with open(log_path, 'r', encoding='utf-8') as log_file:
            content = log_file.read()

        return jsonify({'success': True, 'content': content})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/log_hand', methods=['POST'])
def log_hand():
    """Log the current round's hand data to LogHand.log"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.log_hand()
        
        status = 200 if result.get('success') else 400
        payload = {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload), status
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/download_log_hand', methods=['GET'])
def download_log_hand():
    """Download the LogHand.log file"""
    try:
        game_id = request.args.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        # Get the project root directory
        current_file = os.path.abspath(__file__)
        blackjack_dir = os.path.dirname(current_file)
        project_root = os.path.dirname(blackjack_dir)
        
        # If project root doesn't exist, try current working directory
        if not os.path.exists(project_root):
            project_root = os.getcwd()
        
        # Construct log file path
        log_path = os.path.join(project_root, 'LogHand.log')
        
        # Verify file exists
        if not os.path.exists(log_path):
            return jsonify({'success': False, 'error': 'Log file not found'}), 404
        
        # Send file as download
        return send_file(
            log_path,
            mimetype='text/plain',
            as_attachment=True,
            download_name='LogHand.log'
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/clear_log_hand', methods=['POST'])
def clear_log_hand():
    """Clear (empty) the LogHand.log file"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        # Get the project root directory
        current_file = os.path.abspath(__file__)
        blackjack_dir = os.path.dirname(current_file)
        project_root = os.path.dirname(blackjack_dir)
        
        # If project root doesn't exist, try current working directory
        if not os.path.exists(project_root):
            project_root = os.getcwd()
        
        # Construct log file path
        log_path = os.path.join(project_root, 'LogHand.log')
        
        # Clear the file by opening in write mode (truncates to 0 bytes)
        # If file doesn't exist, create an empty file
        with open(log_path, 'w', encoding='utf-8') as log_file:
            pass  # File is now empty
        
        return jsonify({
            'success': True,
            'message': 'Log file cleared successfully'
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/log_hand/contents', methods=['GET'])
def view_log_hand():
    """Retrieve the LogHand.log file content for viewing"""
    try:
        game_id = request.args.get('game_id')

        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400

        # Get the project root directory
        current_file = os.path.abspath(__file__)
        blackjack_dir = os.path.dirname(current_file)
        project_root = os.path.dirname(blackjack_dir)

        # If project root doesn't exist, try current working directory
        if not os.path.exists(project_root):
            project_root = os.getcwd()

        # Construct log file path
        log_path = os.path.join(project_root, 'LogHand.log')

        if not os.path.exists(log_path):
            return jsonify({'success': True, 'content': ''})  # Return empty if file doesn't exist

        with open(log_path, 'r', encoding='utf-8') as log_file:
            content = log_file.read()

        return jsonify({'success': True, 'content': content})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/force_dealer_hand', methods=['POST'])
def force_dealer_hand():
    """Set or clear forced dealer hand for testing"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        hand_string = data.get('hand_string')  # Format: "rank1,rank2" or None/empty
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.set_force_dealer_hand(hand_string)
        payload = {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@blackjack_bp.route('/force_player_hand', methods=['POST'])
def force_player_hand():
    """Set or clear forced player hand for testing"""
    try:
        data = request.get_json() or {}
        game_id = data.get('game_id')
        hand_string = data.get('hand_string')  # Format: "rank1,rank2" or None/empty
        
        if not game_id:
            return jsonify({'success': False, 'error': 'Game ID required'}), 400
        
        game = get_game(game_id)
        result = game.set_force_player_hand(hand_string)
        payload = {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'game_state': game.get_game_state()
        }
        _save_game_to_redis(game)
        return jsonify(payload)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

