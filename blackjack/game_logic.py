"""
Game logic and state management for Blackjack game
"""

import uuid
import os
import traceback
from datetime import datetime
from typing import Optional, Dict, Any
from blackjack.deck import Deck, Card, calculate_hand_value, is_blackjack
from blackjack.player import Player, Hand
from blackjack.dealer import Dealer


class GameState:
    """Enum-like class for game states"""
    BETTING = "betting"
    DEALING = "dealing"
    PLAYER_TURN = "player_turn"
    DEALER_TURN = "dealer_turn"
    GAME_OVER = "game_over"


class BlackjackGame:
    """Main game class that manages the blackjack game state"""
    
    def __init__(self, starting_chips: int = 1000, num_decks: int = 6):
        """Initialize a new blackjack game (default 6 decks like a casino shoe)"""
        self.game_id: str = str(uuid.uuid4())
        self.num_decks: int = num_decks
        self.deck: Deck = Deck(num_decks)
        self.deck.shuffle()
        self.player: Player = Player(starting_chips)
        self.dealer: Dealer = Dealer()
        self.state: str = GameState.BETTING
        self.result: Optional[str] = None  # "win", "loss", "push", "blackjack"
        # Insurance / Even Money state
        self.insurance_offer_active: bool = False
        self.insurance_for_hand_index: Optional[int] = None
        self.insurance_amount: int = 0
        self.insurance_taken: bool = False
        self.even_money_offer_active: bool = False
        self.insurance_outcome: Optional[Dict[str, Any]] = None
        # Auto mode state
        self.auto_mode_active: bool = False
        self.auto_hands_remaining: int = 0
        self.auto_default_bet: int = 0
        self.auto_insurance_mode: Optional[str] = None  # 'always' | 'never'
        self.auto_status: Optional[str] = None
        self.auto_mode_log_file: Optional[Any] = None  # File handle for auto mode logging
        self.auto_mode_log_filename: Optional[str] = None  # Log filename for download
        
    def new_game(self, preserve_auto: bool = False):
        """Start a new game round"""
        self.dealer.clear_hand()
        self.player.clear_hands()
        self.player.create_new_hand()
        self.state = GameState.BETTING
        self.result = None
        # Reset insurance/even money
        self.insurance_offer_active = False
        self.insurance_for_hand_index = None
        self.insurance_amount = 0
        self.insurance_taken = False
        self.even_money_offer_active = False
        self.insurance_outcome = None
        self.split_summary = None
        if not preserve_auto:
            self.auto_mode_active = False
            self.auto_hands_remaining = 0
            self.auto_default_bet = 0
            self.auto_insurance_mode = None
            self.auto_status = None
        else:
            # Preserve auto mode state, but refresh status copy
            if self.auto_mode_active and self.auto_hands_remaining > 0:
                self.auto_status = f'Auto mode running ({self.auto_hands_remaining} hands remaining)'
        
        # Reshuffle if less than half the shoe remaining (3 decks out of 6)
        # 6 decks = 312 cards, half = 156 cards (3 decks)
        min_cards_threshold = (self.num_decks * 52) // 2
        if len(self.deck) < min_cards_threshold:
            import sys
            print(f"🔄 Reshuffling shoe: {len(self.deck)} cards remaining (threshold: {min_cards_threshold})")
            sys.stdout.flush()
            self.deck = Deck(self.num_decks)
            self.deck.shuffle()
    
    def place_bet(self, amount: int) -> Dict[str, Any]:
        """
        Place a bet for the player.
        
        Args:
            amount: Bet amount
            
        Returns:
            Dict with success status and message
        """
        if self.state != GameState.BETTING:
            return {'success': False, 'message': 'Not in betting phase'}
        
        if amount <= 0:
            return {'success': False, 'message': 'Bet must be greater than 0'}
        
        if self.player.chips < amount:
            return {'success': False, 'message': 'Insufficient Funds'}
        
        success = self.player.place_bet(amount)
        if success:
            return {'success': True, 'message': f'Bet of ${amount} placed'}
        else:
            return {'success': False, 'message': 'Failed to place bet'}
    
    def deal_initial_cards(self) -> Dict[str, Any]:
        """
        Deal initial cards to player and dealer.
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.BETTING:
            return {'success': False, 'message': 'Not in betting phase'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand or current_hand.bet == 0:
            return {'success': False, 'message': 'Must place a bet first'}
        
        # Deal cards: player, dealer, player, dealer
        self.state = GameState.DEALING
        
        # Deal two cards to player
        player_cards = self.deck.deal_cards(2)
        current_hand.add_cards(player_cards)
        
        # Deal two cards to dealer (hole card stays hidden)
        dealer_cards = self.deck.deal_cards(2)
        self.dealer.add_cards(dealer_cards)
        
        # Check for player blackjack (player wins immediately only if dealer doesn't have blackjack)
        if self.player.get_current_hand().is_blackjack():
            # Player has blackjack - reveal dealer's hole card to check if dealer also has it
            self.dealer.reveal_hole_card()
            if self.dealer.is_blackjack():
                # Both have blackjack - push
                self.state = GameState.GAME_OVER
                self.result = "push"
                self.player.push()
            else:
                # Player blackjack, dealer doesn't - player wins 3:2
                self.state = GameState.GAME_OVER
                self.result = "blackjack"
                self.player.win(is_blackjack=True)
        else:
            # Normal play continues - dealer's hole card remains hidden
            self.state = GameState.PLAYER_TURN
            
            # INSURANCE/OFFERS: If dealer up-card is Ace, offer insurance/even money per rules
            if len(self.dealer.hand) >= 2 and self.dealer.hand[1].rank == 'A':
                current_hand = self.player.get_current_hand()
                if current_hand and current_hand.is_blackjack():
                    # Even money (authentic rule) – but this branch won't occur because we handled blackjack above
                    self.even_money_offer_active = True
                else:
                    # Insurance: 50% of bet (rounded down)
                    self.insurance_offer_active = True
                    self.insurance_for_hand_index = self.player.current_hand_index
                    bet = current_hand.bet if current_hand else 0
                    self.insurance_amount = int(bet * 0.5)
        
        return {'success': True, 'message': 'Cards dealt'}
    
    def hit(self) -> Dict[str, Any]:
        """
        Player hits (takes another card).
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        
        # Gate actions if an insurance/even money decision is pending
        if self.insurance_offer_active or self.even_money_offer_active:
            return {'success': False, 'message': 'Insurance decision required'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand:
            return {'success': False, 'message': 'No active hand'}
        
        # Disallow hitting on split Aces hands
        if hasattr(current_hand, 'is_from_split_aces') and current_hand.is_from_split_aces:
            return {'success': False, 'message': 'Not allowed on split aces'}
        
        # Deal a card
        card = self.deck.deal_card()
        if not card:
            return {'success': False, 'message': 'No more cards in deck'}
        
        current_hand.add_card(card)
        
        # Check for 5 Card Charlie (5 cards without busting = automatic win)
        if len(current_hand.cards) == 5 and not current_hand.is_bust():
            current_hand_index = self.player.current_hand_index
            self.player.win(current_hand_index)
            
            # Move to next hand or finish game
            if self._move_to_next_hand():
                return {'success': True, 'message': '5 Card Charlie! You win! Next hand', 'charlie': True}
            else:
                # All hands done - player wins with 5 Card Charlie
                self.dealer.reveal_hole_card()
                self.state = GameState.GAME_OVER
                self.result = "win"
                return {'success': True, 'message': '5 Card Charlie! You win!', 'charlie': True, 'game_over': True}
        
        # Check if bust
        if current_hand.is_bust():
            # Move to next hand or dealer turn
            if self._move_to_next_hand():
                return {'success': True, 'message': 'Bust! Next hand', 'bust': True}
            else:
                # All hands done, dealer wins remaining hands
                self._finish_game()
                return {'success': True, 'message': 'Bust! Game over', 'bust': True, 'game_over': True}
        
        return {'success': True, 'message': 'Card dealt'}
    
    def stand(self) -> Dict[str, Any]:
        """
        Player stands (ends their turn).
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        
        if self.insurance_offer_active or self.even_money_offer_active:
            return {'success': False, 'message': 'Insurance decision required'}
        
        # Move to next hand or dealer turn
        if self._move_to_next_hand():
            return {'success': True, 'message': 'Standing. Next hand'}
        else:
            # All hands done, dealer plays and determine results
            self.state = GameState.DEALER_TURN
            self.dealer.play_hand(self.deck)
            self._determine_results()  # Only call once here
            return {'success': True, 'message': 'Standing. Dealer playing', 'game_over': True}
    
    def double_down(self) -> Dict[str, Any]:
        """
        Player doubles down (doubles bet and takes exactly one card).
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand:
            return {'success': False, 'message': 'No active hand'}
        
        if hasattr(current_hand, 'is_from_split_aces') and current_hand.is_from_split_aces:
            return {'success': False, 'message': 'Not allowed on split aces'}
        
        if not current_hand.can_double_down():
            return {'success': False, 'message': 'Cannot double down'}
        
        if self.player.chips < current_hand.bet:
            return {'success': False, 'message': 'Insufficient Funds'}
        
        # Double the bet
        current_hand.double_down()
        self.player.chips -= current_hand.bet // 2  # Already deducted original bet
        
        # Deal one card
        card = self.deck.deal_card()
        if not card:
            return {'success': False, 'message': 'No more cards in deck'}
        
        current_hand.add_card(card)
        
        # Check if bust
        if current_hand.is_bust():
            # Move to next hand or dealer turn
            if self._move_to_next_hand():
                return {'success': True, 'message': 'Doubled down - bust! Next hand', 'bust': True}
            else:
                # All hands busted - dealer plays and determine results
                self.state = GameState.DEALER_TURN
                self.dealer.play_hand(self.deck)
                self._determine_results()
                return {'success': True, 'message': 'Doubled down - bust! Game over', 'bust': True, 'game_over': True}
        
        # Move to next hand or dealer turn
        if self._move_to_next_hand():
            return {'success': True, 'message': 'Doubled down'}
        else:
            # All hands done, dealer plays and determine results
            self.state = GameState.DEALER_TURN
            self.dealer.play_hand(self.deck)
            self._determine_results()  # Only call once here
            return {'success': True, 'message': 'Doubled down. Dealer playing', 'game_over': True}
    
    def split(self) -> Dict[str, Any]:
        """
        Player splits their hand.
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand:
            return {'success': False, 'message': 'No active hand'}
        
        # Prevent actions on split Aces hands
        if hasattr(current_hand, 'is_from_split_aces') and current_hand.is_from_split_aces:
            return {'success': False, 'message': 'Not allowed on split aces'}
        
        if not current_hand.can_split():
            return {'success': False, 'message': 'Cannot split this hand'}
        
        # Max 3 splits -> up to 4 hands total
        if len(self.player.hands) >= 4:
            return {'success': False, 'message': 'Maximum splits reached'}
        
        if self.player.chips < current_hand.bet:
            return {'success': False, 'message': 'Insufficient Funds'}
        
        success = self.player.split_hand(self.player.current_hand_index)
        if not success:
            return {'success': False, 'message': 'Failed to split hand'}
        
        # Deal a card to each split hand (both will have len == 1 right after split)
        for hand in self.player.hands:
            if len(hand.cards) == 1:
                card = self.deck.deal_card()
                if card:
                    hand.add_card(card)
        
        # Log split action immediately
        try:
            import sys
            print(f"🔀 Split performed: duplicated bet ${current_hand.bet}, total hands={len(self.player.hands)}")
            sys.stdout.flush()
        except Exception:
            pass
        
        self.state = GameState.PLAYER_TURN
        return {'success': True, 'message': 'Hand split'}
    
    def _move_to_next_hand(self) -> bool:
        """Move to next hand if available, return True if moved, False if done"""
        self.player.current_hand_index += 1
        if self.player.current_hand_index >= len(self.player.hands):
            # All hands done - dealer will play but don't determine results here
            # Results will be determined by the caller (stand/hit/double_down)
            return False
        return True
    
    def _determine_results(self):
        """Determine win/loss/push for all hands"""
        dealer_value = self.dealer.get_value()
        dealer_bust = self.dealer.is_bust()
        
        import sys
        print(f"🎯 Determining results: dealer_value={dealer_value}, dealer_bust={dealer_bust}, player_hands={len(self.player.hands)}")
        sys.stdout.flush()
        
        # Track if we have at least one result
        result_set = False
        
        # Collect per-hand summary if split
        split_summaries = []
        
        for i, hand in enumerate(self.player.hands):
            print(f"  Processing hand {i}: value={hand.get_value()}, bust={hand.is_bust()}, bet=${hand.bet}")
            sys.stdout.flush()
            
            if hand.is_bust():
                print(f"    → Hand {i} BUSTED - calling lose()")
                self.player.lose(i)
                split_summaries.append((i, 'Lose', hand.bet))
                if not result_set:
                    self.result = "loss"
                    result_set = True
            elif dealer_bust:
                print(f"    → Dealer BUSTED - calling win() on hand {i}")
                self.player.win(i)
                split_summaries.append((i, 'Win', hand.bet))
                if not result_set:
                    self.result = "win"
                    result_set = True
            else:
                player_value = hand.get_value()
                if player_value > dealer_value:
                    if hand.is_blackjack() and not hand.is_split:
                        print(f"    → Hand {i} BLACKJACK WIN - calling win(is_blackjack=True)")
                        self.player.win(i, is_blackjack=True)
                        split_summaries.append((i, 'Blackjack', int(hand.bet * 1.5)))
                        self.result = "blackjack"
                        result_set = True
                    else:
                        print(f"    → Hand {i} WINS ({player_value} > {dealer_value}) - calling win()")
                        self.player.win(i)
                        split_summaries.append((i, 'Win', hand.bet))
                        if self.result != "blackjack":
                            self.result = "win"
                            result_set = True
                elif player_value < dealer_value:
                    print(f"    → Hand {i} LOSES ({player_value} < {dealer_value}) - calling lose()")
                    self.player.lose(i)
                    split_summaries.append((i, 'Lose', hand.bet))
                    if self.result != "blackjack":
                        self.result = "loss"
                        result_set = True
                else:
                    print(f"    → Hand {i} PUSH ({player_value} == {dealer_value}) - calling push()")
                    self.player.push(i)
                    split_summaries.append((i, 'Push', 0))
                    if self.result != "blackjack" and self.result != "win" and self.result != "loss":
                        self.result = "push"
                        result_set = True
        
        if not result_set:
            print(f"⚠️ WARNING: No result was set! Setting default to 'loss'")
            self.result = "loss"
        
        # If there were multiple hands, print one-line summary and expose it
        self.split_summary = None
        if len(self.player.hands) > 1 and split_summaries:
            parts = []
            for idx, label, amt in split_summaries:
                hand_no = idx + 1
                if label == 'Win':
                    parts.append(f"Split-Hand{hand_no} - Win {amt}")
                elif label == 'Lose':
                    parts.append(f"Split-Hand{hand_no} - Lose {amt}")
                elif label == 'Push':
                    parts.append(f"Split-Hand{hand_no} - Push 0")
                elif label == 'Blackjack':
                    parts.append(f"Split-Hand{hand_no} - Blackjack {amt}")
            summary_line = ", ".join(parts)
            self.split_summary = summary_line
            print(f"📝 {summary_line}")
            try:
                import sys
                sys.stdout.flush()
            except Exception:
                pass
        
        # Resolve insurance if any
        if self.insurance_taken:
            if self.dealer.is_blackjack():
                # Pay 2:1 on insurance; stake already deducted -> add 3x stake
                self.player.chips += self.insurance_amount * 3
                self.insurance_outcome = {
                    'paid': True,
                    'amount': self.insurance_amount * 2
                }
                print(f"🛡️ Insurance paid ${self.insurance_amount * 2} (2:1)")
            else:
                # Insurance lost
                self.insurance_outcome = {
                    'paid': False,
                    'amount': self.insurance_amount
                }
                print(f"🛡️ Insurance lost ${self.insurance_amount}")
            # Clear insurance state
            self.insurance_taken = False
            self.insurance_amount = 0
            self.insurance_for_hand_index = None
        else:
            # If insurance was not taken but an offer existed and dealer not blackjack, no outcome
            if self.insurance_offer_active:
                self.insurance_outcome = {'paid': False, 'amount': 0}
        print(f"✅ Final result: {self.result}, player chips: ${self.player.chips}")
        import sys
        sys.stdout.flush()
        self.state = GameState.GAME_OVER
    
    def _finish_game(self):
        """Finish the game when player busts on all hands"""
        print(f"🏁 _finish_game() called - player busted on all hands")
        self.dealer.reveal_hole_card()
        self.state = GameState.GAME_OVER
        self.result = "loss"
        print(f"✅ Game finished: result={self.result}, player chips: ${self.player.chips}")
        # Already lost on bust hands, no need to determine results
    
    def get_game_state(self) -> Dict[str, Any]:
        """Get the current game state for API responses"""
        return {
            'game_id': self.game_id,
            'state': self.state,
            'player': self.player.to_dict(),
            'dealer': self.dealer.to_dict(),
            'result': self.result,
            'deck_remaining': len(self.deck),
            'insurance_offer_active': self.insurance_offer_active,
            'insurance_amount': self.insurance_amount,
            'even_money_offer_active': self.even_money_offer_active,
            'insurance_outcome': self.insurance_outcome,
            'split_summary': getattr(self, 'split_summary', None),
            'auto_mode': {
                'active': self.auto_mode_active,
                'hands_remaining': self.auto_hands_remaining,
                'default_bet': self.auto_default_bet,
                'insurance_mode': self.auto_insurance_mode,
                'status': self.auto_status,
                'log_filename': self.auto_mode_log_filename if not self.auto_mode_active and self.auto_mode_log_filename else None
            }
        }

    def insurance_decision(self, decision: str) -> Dict[str, Any]:
        """Handle insurance/even-money decisions."""
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        if not (self.insurance_offer_active or self.even_money_offer_active):
            return {'success': False, 'message': 'No insurance offer active'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand:
            return {'success': False, 'message': 'No active hand'}
        
        if self.even_money_offer_active:
            if decision == 'even_money':
                # Pay 1:1 immediately (bet was already deducted earlier)
                payout = current_hand.bet * 2
                self.player.chips += payout
                self.result = 'even_money'
                # End round immediately
                self.even_money_offer_active = False
                self.insurance_offer_active = False
                self.insurance_taken = False
                self.state = GameState.GAME_OVER
                return {'success': True, 'message': 'Even money paid', 'game_over': True}
            elif decision == 'decline':
                self.even_money_offer_active = False
                return {'success': True, 'message': 'Even money declined'}
            else:
                return {'success': False, 'message': 'Invalid decision'}
        
        if self.insurance_offer_active:
            if decision == 'buy':
                print(f"🛡️ Insurance purchased for ${self.insurance_amount}")
                if self.player.chips < self.insurance_amount:
                    return {'success': False, 'message': 'Insufficient Funds'}
                self.player.chips -= self.insurance_amount
                self.insurance_taken = True
                self.insurance_offer_active = False
                return {'success': True, 'message': 'Insurance purchased'}
            elif decision == 'decline':
                self.insurance_offer_active = False
                self.insurance_taken = False
                return {'success': True, 'message': 'Insurance declined'}
            else:
                return {'success': False, 'message': 'Invalid decision'}

    def _init_auto_mode_log(self) -> bool:
        """Initialize the auto mode log file. Returns True if successful."""
        try:
            # Get the project root directory (parent of blackjack package)
            current_file = os.path.abspath(__file__)
            blackjack_dir = os.path.dirname(current_file)
            project_root = os.path.dirname(blackjack_dir)
            
            # Fallback to current working directory if path resolution fails
            if not os.path.exists(project_root):
                project_root = os.getcwd()
            
            # Create AutoMode directory if it doesn't exist
            log_dir = os.path.join(project_root, 'AutoMode')
            os.makedirs(log_dir, exist_ok=True)
            
            # Verify directory was created and is writable
            if not os.path.isdir(log_dir):
                raise OSError(f"Could not create log directory: {log_dir}")
            if not os.access(log_dir, os.W_OK):
                raise OSError(f"Log directory is not writable: {log_dir}")
            
            # Create timestamped log file
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            log_filename = f'{timestamp}.log'
            log_path = os.path.join(log_dir, log_filename)
            
            # Store filename for download
            self.auto_mode_log_filename = log_filename
            
            # Open file for writing
            self.auto_mode_log_file = open(log_path, 'w', encoding='utf-8')
            self._log_auto_event(f"Auto Mode Log Started - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            self._log_auto_event(f"Log file: {log_path}")
            return True
        except Exception as e:
            error_msg = f"Failed to initialize auto mode log: {str(e)}"
            print(f"⚠️ {error_msg}")
            print(f"   Attempted log directory: {log_dir if 'log_dir' in locals() else 'unknown'}")
            traceback.print_exc()
            # Store error for better reporting
            self._auto_mode_log_error = error_msg
            return False
    
    def _log_auto_event(self, message: str):
        """Write an event to the auto mode log file."""
        if self.auto_mode_log_file:
            try:
                timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]  # Include milliseconds
                self.auto_mode_log_file.write(f"[{timestamp}] {message}\n")
                self.auto_mode_log_file.flush()
            except Exception as e:
                print(f"⚠️ Failed to write to auto mode log: {e}")
    
    def _close_auto_mode_log(self):
        """Close the auto mode log file."""
        if self.auto_mode_log_file:
            try:
                self._log_auto_event(f"Auto Mode Log Ended - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                self.auto_mode_log_file.close()
                self.auto_mode_log_file = None
            except Exception as e:
                print(f"⚠️ Failed to close auto mode log: {e}")
    
    def _log_round_result(self):
        """Log the result of a completed round."""
        if not self.auto_mode_log_file:
            return
        
        # Log dealer's final hand
        dealer_cards = [str(card) for card in self.dealer.hand]
        dealer_value = self.dealer.get_value()
        self._log_auto_event(f"Dealer final: {', '.join(dealer_cards)} (Value: {dealer_value})")
        
        # Log all player hands and results
        for idx, hand in enumerate(self.player.hands):
            hand_cards = [str(card) for card in hand.cards]
            hand_value = hand.get_value()
            hand_bet = hand.bet
            hand_label = f"Hand {idx + 1}" if len(self.player.hands) > 1 else "Hand"
            self._log_auto_event(f"{hand_label} final: {', '.join(hand_cards)} (Value: {hand_value}, Bet: ${hand_bet})")
        
        # Log insurance outcome if applicable
        if self.insurance_outcome:
            if self.insurance_outcome.get('paid'):
                self._log_auto_event(f"Insurance paid: ${self.insurance_outcome.get('amount', 0)}")
            else:
                self._log_auto_event(f"Insurance lost: ${self.insurance_outcome.get('amount', 0)}")
        
        # Log split summary if applicable
        if hasattr(self, 'split_summary') and self.split_summary:
            self._log_auto_event(f"Split summary: {self.split_summary}")
        
        # Log round result
        if self.result:
            self._log_auto_event(f"Round result: {self.result.upper()}")
        
        # Log bankroll after round
        self._log_auto_event(f"Bankroll after round: ${self.player.chips}")

    def start_auto_mode(self, default_bet: int, hands: int, insurance_mode: str) -> Dict[str, Any]:
        if self.auto_mode_active:
            return {'success': False, 'message': 'Auto mode already running'}
        if default_bet <= 0:
            return {'success': False, 'message': 'Default bet must be greater than 0'}
        if hands <= 0:
            return {'success': False, 'message': 'Hands must be greater than 0'}
        if insurance_mode not in ('always', 'never'):
            return {'success': False, 'message': 'Invalid insurance preference'}
        if self.player.chips < default_bet:
            return {'success': False, 'message': 'Insufficient bankroll for auto mode'}
        if self.state not in (GameState.BETTING, GameState.GAME_OVER):
            return {'success': False, 'message': 'Finish current round before starting auto mode'}
        if self.state == GameState.GAME_OVER:
            self.new_game()

        # Initialize logging
        if not self._init_auto_mode_log():
            error_msg = getattr(self, '_auto_mode_log_error', 'Failed to initialize log file')
            return {'success': False, 'message': error_msg}
        
        self.auto_mode_active = True
        self.auto_hands_remaining = hands
        self.auto_default_bet = default_bet
        self.auto_insurance_mode = insurance_mode
        self.auto_status = f'Auto mode running ({hands} hands remaining)'
        
        self._log_auto_event(f"Auto Mode Started - Default Bet: ${default_bet}, Hands: {hands}, Insurance: {insurance_mode}")
        self._log_auto_event(f"Starting Bankroll: ${self.player.chips}")
        return {'success': True, 'message': 'Auto mode started'}

    def stop_auto_mode_request(self) -> Dict[str, Any]:
        if not self.auto_mode_active:
            return {'success': False, 'message': 'Auto mode is not active'}
        self.stop_auto_mode('Auto mode stopped by player')
        return {'success': True, 'message': 'Auto mode stopped'}

    def stop_auto_mode(self, status: Optional[str] = None):
        """Stop auto mode and optionally set a status message."""
        if status:
            self._log_auto_event(f"Auto Mode Stopped - Reason: {status}")
        self._log_auto_event(f"Final Bankroll: ${self.player.chips}")
        self._close_auto_mode_log()
        self.auto_mode_active = False
        self.auto_hands_remaining = 0
        self.auto_default_bet = 0
        self.auto_insurance_mode = None
        self.auto_status = status

    def is_auto_mode_active(self) -> bool:
        return self.auto_mode_active and self.auto_hands_remaining > 0

    def _get_auto_play_decision(self):
        """Determine whether to hit or stand based on dealer up card.
        
        Strategy:
        - Dealer shows 2-6: stand (don't hit)
        - Dealer shows 7, 8, 9, 10, J, Q, K, A: hit until player > 16
        """
        current_hand = self.player.get_current_hand()
        if not current_hand or current_hand.is_bust():
            return 'stand'  # Hand is already bust
        
        player_value = current_hand.get_value()
        dealer_up_card = self.dealer.hand[0] if self.dealer.hand else None
        
        if not dealer_up_card:
            return 'stand'
        
        dealer_rank = dealer_up_card.rank
        
        # Dealer shows 2-6: stand (don't hit)
        if dealer_rank in ['2', '3', '4', '5', '6']:
            return 'stand'
        
        # Dealer shows 7, 8, 9, 10, J, Q, K, A: hit until > 16
        if dealer_rank in ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']:
            if player_value > 16:
                return 'stand'
            else:
                return 'hit'
        
        # Default to stand
        return 'stand'

    def run_auto_cycle(self):
        """Execute auto-mode rounds until finished or interrupted."""
        hand_number = 0
        while self.is_auto_mode_active():
            hand_number += 1
            self._log_auto_event(f"--- Round {hand_number} (Hands Remaining: {self.auto_hands_remaining}) ---")
            
            # Ensure we're in betting state for new round
            if self.state != GameState.BETTING:
                self.new_game(preserve_auto=True)
            # Check bankroll
            if self.player.chips < self.auto_default_bet:
                self._log_auto_event(f"Bankroll check failed: ${self.player.chips} < ${self.auto_default_bet}")
                self.stop_auto_mode('Auto mode stopped: insufficient bankroll')
                break
            # Place bet
            bet_result = self.place_bet(self.auto_default_bet)
            if not bet_result.get('success'):
                self._log_auto_event(f"Bet placement failed: {bet_result.get('message')}")
                self.stop_auto_mode(f"Auto mode stopped: {bet_result.get('message')}")
                break
            self._log_auto_event(f"Bet placed: ${self.auto_default_bet} (Bankroll: ${self.player.chips})")
            # Deal cards
            deal_result = self.deal_initial_cards()
            if not deal_result.get('success'):
                self._log_auto_event(f"Deal failed: {deal_result.get('message')}")
                self.stop_auto_mode(f"Auto mode stopped: {deal_result.get('message')}")
                break
            
            # Log initial cards
            current_hand = self.player.get_current_hand()
            if current_hand:
                player_cards = [str(card) for card in current_hand.cards]
                player_value = current_hand.get_value()
                self._log_auto_event(f"Player cards: {', '.join(player_cards)} (Value: {player_value})")
            dealer_cards = [str(card) for card in self.dealer.hand]
            dealer_value = self.dealer.get_value()
            self._log_auto_event(f"Dealer up card: {dealer_cards[0] if dealer_cards else 'None'}")
            
            # Handle insurance offers per preference
            if self.insurance_offer_active:
                decision = 'buy' if self.auto_insurance_mode == 'always' else 'decline'
                self._log_auto_event(f"Insurance offer active: ${self.insurance_amount} (Decision: {decision})")
                ins_result = self.insurance_decision(decision)
                if not ins_result.get('success', False):
                    self._log_auto_event(f"Insurance decision failed: {ins_result.get('message')}")
                    self.stop_auto_mode(f"Auto mode stopped: {ins_result.get('message')}")
                    break
                if decision == 'buy':
                    self._log_auto_event(f"Insurance purchased: ${self.insurance_amount}")
            if self.even_money_offer_active:
                decision = 'even_money' if self.auto_insurance_mode == 'always' else 'decline'
                self._log_auto_event(f"Even money offer active (Decision: {decision})")
                ins_result = self.insurance_decision(decision)
                if not ins_result.get('success', False):
                    self._log_auto_event(f"Even money decision failed: {ins_result.get('message')}")
                    self.stop_auto_mode(f"Auto mode stopped: {ins_result.get('message')}")
                    break
                if decision == 'even_money':
                    self._log_auto_event(f"Even money taken")
                # even money resolves round immediately
                if self.state == GameState.GAME_OVER:
                    self._log_round_result()
                    self.auto_hands_remaining -= 1
                    if self.auto_hands_remaining <= 0:
                        self.stop_auto_mode('Auto mode finished')
                    else:
                        self.auto_status = f'Auto mode running ({self.auto_hands_remaining} hands remaining)'
                        self.new_game(preserve_auto=True)
                    continue
            # If round still in player turn, apply hit/stand strategy
            if self.state == GameState.PLAYER_TURN:
                while self.state == GameState.PLAYER_TURN:
                    decision = self._get_auto_play_decision()
                    current_hand = self.player.get_current_hand()
                    player_value = current_hand.get_value() if current_hand else 0
                    
                    if decision == 'hit':
                        self._log_auto_event(f"Player value {player_value} - Auto hitting")
                        hit_result = self.hit()
                        if not hit_result.get('success', False):
                            self._log_auto_event(f"Hit failed: {hit_result.get('message')}")
                            self.stop_auto_mode(f"Auto mode stopped: {hit_result.get('message')}")
                            break
                        # Check if busted after hit
                        if hit_result.get('bust', False):
                            self._log_auto_event(f"Player busted with {player_value + hit_result.get('new_card_value', 0)}")
                            break
                    else:  # decision == 'stand'
                        self._log_auto_event(f"Player value {player_value} - Auto standing")
                        stand_result = self.stand()
                        if not stand_result.get('success', False):
                            self._log_auto_event(f"Stand failed: {stand_result.get('message')}")
                            self.stop_auto_mode(f"Auto mode stopped: {stand_result.get('message')}")
                            break
                        break
                
                # If stop_auto_mode was called, break outer loop
                if not self.auto_mode_active:
                    break
            # After stand or blackjack, state should now be GAME_OVER
            if self.state != GameState.GAME_OVER:
                # Safety: force finish if needed
                self._determine_results()
            
            # Log round result
            self._log_round_result()
            
            self.auto_hands_remaining -= 1
            if self.auto_hands_remaining <= 0:
                self.stop_auto_mode('Auto mode finished')
            else:
                self.auto_status = f'Auto mode running ({self.auto_hands_remaining} hands remaining)'
                self.new_game(preserve_auto=True)

        if not self.auto_mode_active and not self.auto_status:
            self.auto_status = 'Auto mode stopped'

