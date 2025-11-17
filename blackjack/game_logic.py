"""
Game logic and state management for Blackjack game
"""

import uuid
import os
import copy
import traceback
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
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
    
    def __init__(self, starting_chips: int = 1000, num_decks: int = 6, min_bet: int = 5, max_bet: int = 500, dealer_hits_soft_17: bool = False):
        """Initialize a new blackjack game (default 6 decks like a casino shoe)"""
        self.game_id: str = str(uuid.uuid4())
        self.num_decks: int = num_decks
        self.deck: Deck = Deck(num_decks)
        self.deck.shuffle()
        self.player: Player = Player(starting_chips)
        self.dealer: Dealer = Dealer()
        self.state: str = GameState.BETTING
        self.result: Optional[str] = None  # "win", "loss", "push", "blackjack"
        # Table limits
        self.min_bet: int = min_bet
        self.max_bet: int = max_bet
        # Dealer rules
        self.dealer_hits_soft_17: bool = dealer_hits_soft_17
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
        self.auto_strategy: str = 'basic'  # 'basic' | 'conservative' | 'aggressive'
        self.auto_betting_strategy: str = 'fixed'  # 'fixed' | 'progressive' | 'percentage'
        self.auto_bet_percentage: Optional[int] = None  # Percentage for percentage betting (1-100)
        self.auto_double_down_pref: str = 'recommended'  # 'always' | 'never' | 'recommended'
        self.auto_split_pref: str = 'recommended'  # 'always' | 'never' | 'recommended'
        self.auto_surrender_pref: str = 'recommended'  # 'always' | 'never' | 'recommended'
        self.auto_progressive_bet: int = 0  # Current bet for progressive strategy
        self.auto_last_result: Optional[str] = None  # Track last round result for progressive betting
        self.auto_status: Optional[str] = None
        self.auto_mode_log_file: Optional[Any] = None  # File handle for auto mode logging
        self.auto_mode_log_filename: Optional[str] = None  # Log filename for download
        # Round auditing
        self.round_history: list = []
        self.current_round_audit: Optional[Dict[str, Any]] = None
        self.round_counter: int = 0
        # Shuffle animation state for UI
        self.last_shuffle_event: Optional[Dict[str, Any]] = None
        # Dealer peek state
        self.dealer_peeked: bool = False
        # Test mode: forced dealer hand (format: "rank1,rank2" e.g., "10,A" or "A,10")
        self.force_dealer_hand: Optional[str] = None
        self._pending_forced_dealer_cards: Optional[Tuple[Card, Card]] = None

    # ------------------------------------------------------------
    # Round auditing helpers
    # ------------------------------------------------------------
    def _format_card(self, card: Card) -> str:
        return f"{card.rank} of {card.suit}"

    def _snapshot_hand(self, hand: Hand) -> Dict[str, Any]:
        return {
            'cards': [self._format_card(card) for card in hand.cards],
            'value': hand.get_value(),
            'bet': hand.bet,
            'is_blackjack': hand.is_blackjack(),
            'is_bust': hand.is_bust(),
            'is_doubled_down': hand.is_doubled_down,
            'is_split': hand.is_split,
            'is_from_split_aces': hand.is_from_split_aces,
            'is_surrendered': hand.is_surrendered
        }

    def _start_round_audit(self, starting_balance: int, bet_amount: int):
        self.round_counter += 1
        self.current_round_audit = {
            'round_id': self.round_counter,
            'started_at': datetime.utcnow().isoformat(),
            'starting_balance': starting_balance,
            'bet_amount': bet_amount,
            'player_initial_cards': [],
            'dealer_initial_cards': [],
            'dealer_visible_card': None,
            'insurance_offered': False,
            'even_money_offered': False,
            'insurance_amount': 0,
            'insurance_taken': False,
            'insurance_declined': False,
            'insurance_payout': 0,
            'result': None,
            'final_balance': None,
            'dealer_final_hand': [],
            'dealer_final_value': None,
            'player_final_hands': [],
            'events': []
        }
        self._record_round_event('bet_placed', {
            'bet_amount': bet_amount,
            'balance_before': starting_balance,
            'balance_after': self.player.chips
        })

    def _update_audit(self, updates: Dict[str, Any]):
        if not self.current_round_audit:
            return
        self.current_round_audit.update(updates)

    def _record_round_event(self, event: str, details: Optional[Dict[str, Any]] = None):
        if not self.current_round_audit:
            return
        self.current_round_audit.setdefault('events', []).append({
            'timestamp': datetime.utcnow().isoformat(),
            'event': event,
            'details': details or {}
        })

    def _capture_initial_hands(self):
        if not self.current_round_audit:
            return
        if not self.current_round_audit.get('player_initial_cards'):
            current_hand = self.player.get_current_hand()
            if current_hand:
                self.current_round_audit['player_initial_cards'] = [
                    self._format_card(card) for card in current_hand.cards
                ]
        if not self.current_round_audit.get('dealer_initial_cards'):
            self.current_round_audit['dealer_initial_cards'] = [
                self._format_card(card) for card in self.dealer.hand
            ]
            if len(self.dealer.hand) > 1:
                self.current_round_audit['dealer_visible_card'] = self._format_card(self.dealer.hand[1])

    def _finalize_round_audit(self):
        if not self.current_round_audit or self.current_round_audit.get('finalized'):
            return
        self.current_round_audit['completed_at'] = datetime.utcnow().isoformat()
        self.current_round_audit['result'] = self.result
        self.current_round_audit['final_balance'] = self.player.chips
        self.current_round_audit['dealer_final_hand'] = [
            self._format_card(card) for card in self.dealer.hand
        ]
        self.current_round_audit['dealer_final_value'] = self.dealer.get_value()
        self.current_round_audit['player_final_hands'] = [
            self._snapshot_hand(hand) for hand in self.player.hands
        ]
        if self.insurance_outcome:
            paid = bool(self.insurance_outcome.get('paid'))
            amount = self.insurance_outcome.get('amount', 0)
            self.current_round_audit['insurance_payout'] = amount if paid else 0
            self.current_round_audit['insurance_paid'] = paid
            self.current_round_audit['insurance_loss'] = 0 if paid else amount
        self._record_round_event('round_completed', {
            'result': self.result,
            'final_balance': self.player.chips
        })
        self.current_round_audit['finalized'] = True
        audit_copy = copy.deepcopy(self.current_round_audit)
        self.round_history.append(audit_copy)
        # Keep the most recent 50 rounds to avoid unbounded growth
        if len(self.round_history) > 50:
            self.round_history = self.round_history[-50:]
        self.current_round_audit = None

        
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
        # Reset dealer peek state and forced-card cache
        self.dealer_peeked = False
        self._pending_forced_dealer_cards = None
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
            self._record_shuffle_event(reason='auto_threshold')
    
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
        
        if amount < self.min_bet:
            return {'success': False, 'message': f'Minimum bet is ${self.min_bet}'}
        
        if amount > self.max_bet:
            return {'success': False, 'message': f'Maximum bet is ${self.max_bet}'}
        
        if self.player.chips < amount:
            return {'success': False, 'message': 'Insufficient Funds'}
        
        starting_balance = self.player.chips
        success = self.player.place_bet(amount)
        if success:
            self._start_round_audit(starting_balance, amount)
            return {'success': True, 'message': f'Bet of ${amount} placed'}
        else:
            return {'success': False, 'message': 'Failed to place bet'}
    
    def _should_dealer_peek(self) -> bool:
        """Check if dealer should peek at hole card (Ace or 10-value upcard)."""
        if len(self.dealer.hand) < 2:
            return False
        # Dealer's upcard is the second card (index 1)
        upcard = self.dealer.hand[1]
        # Peek if upcard is Ace or 10-value (10, J, Q, K)
        return upcard.rank == 'A' or upcard.is_ten_value()
    
    def _force_dealer_hand(self) -> bool:
        """
        Force dealer to receive specific cards based on force_dealer_hand setting.
        Format: "rank1,rank2" where rank1 is hole card, rank2 is upcard.
        Example: "10,A" means 10-value hole card + Ace upcard.
        
        Returns:
            True if forced successfully, False otherwise
        """
        if not self.force_dealer_hand or not self.force_dealer_hand.strip():
            self._pending_forced_dealer_cards = None
            return False
        
        try:
            # Parse the forced hand (format: "rank1,rank2")
            parts = [p.strip().upper() for p in self.force_dealer_hand.split(',')]
            if len(parts) != 2:
                return False
            
            hole_rank, upcard_rank = parts
            
            # Normalize rank format (handle "10" vs "T", etc.)
            rank_map = {'T': '10'}
            hole_rank = rank_map.get(hole_rank, hole_rank)
            upcard_rank = rank_map.get(upcard_rank, upcard_rank)
            
            # Find cards matching these ranks in the deck
            hole_card = None
            upcard_card = None
            
            # Search deck for hole card
            for i, card in enumerate(self.deck.cards):
                if card.rank == hole_rank:
                    hole_card = self.deck.cards.pop(i)
                    break
            
            # Search deck for upcard (must be different card)
            for i, card in enumerate(self.deck.cards):
                if card.rank == upcard_rank:
                    upcard_card = self.deck.cards.pop(i)
                    break
            
            if not hole_card or not upcard_card:
                # Couldn't find matching cards - reset and return False
                if hole_card:
                    self.deck.cards.append(hole_card)
                if upcard_card:
                    self.deck.cards.append(upcard_card)
                self._pending_forced_dealer_cards = None
                return False
            
            # Store cards to be dealt to the dealer explicitly (we already removed them from deck)
            self._pending_forced_dealer_cards = (hole_card, upcard_card)
            
            import sys
            print(f"🧪 TEST MODE: Forcing dealer hand - hole: {hole_card}, upcard: {upcard_card}")
            sys.stdout.flush()
            
            return True
            
        except Exception as e:
            import sys
            print(f"⚠️ Error forcing dealer hand: {e}")
            sys.stdout.flush()
            self._pending_forced_dealer_cards = None
            return False
    
    def _dealer_peek_and_check_blackjack(self) -> Dict[str, Any]:
        """
        Dealer peeks at hole card and checks for blackjack.
        If dealer has blackjack, reveal immediately and end round.
        Returns dict with peek status and whether game ended.
        """
        if not self._should_dealer_peek():
            return {'peeked': False, 'game_over': False}
        
        if self.dealer_peeked:
            # Already peeked, don't peek again
            return {'peeked': False, 'game_over': False}
        
        # Mark as peeked
        self.dealer_peeked = True
        
        # Peek: check for blackjack WITHOUT revealing hole card yet
        # Temporarily check if dealer has blackjack by accessing the hole card directly
        if len(self.dealer.hand) >= 2:
            hole_card = self.dealer.hand[0]
            upcard = self.dealer.hand[1]
            # Check if it's blackjack (Ace + 10-value card)
            is_blackjack_check = (
                (hole_card.rank == 'A' and upcard.value == 10) or
                (upcard.rank == 'A' and hole_card.value == 10)
            )
        else:
            is_blackjack_check = False
        
        self._record_round_event('dealer_peeked', {})
        
        # Only reveal hole card if dealer has blackjack
        if is_blackjack_check:
            self.dealer.reveal_hole_card()
            # Dealer has blackjack - end round immediately
            self.state = GameState.GAME_OVER
            
            # Process all player hands as losses (unless player also has blackjack)
            for i, hand in enumerate(self.player.hands):
                if hand.is_blackjack():
                    # Player also has blackjack - push
                    self.player.push(i)
                    if not self.result:
                        self.result = "push"
                else:
                    # Player loses
                    self.player.lose(i)
                    if not self.result:
                        self.result = "loss"
            
            # Resolve insurance if taken
            if self.insurance_taken:
                # Pay 2:1 on insurance; stake already deducted -> add 3x stake
                self.player.chips += self.insurance_amount * 3
                self.insurance_outcome = {
                    'paid': True,
                    'amount': self.insurance_amount * 2
                }
                import sys
                print(f"🛡️ Insurance paid ${self.insurance_amount * 2} (2:1)")
                sys.stdout.flush()
            
            self._finalize_round_audit()
            return {'peeked': True, 'game_over': True, 'dealer_blackjack': True}
        
        # Dealer doesn't have blackjack - hole card stays hidden, continue game
        return {'peeked': True, 'game_over': False, 'dealer_blackjack': False}
    
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
        
        # Prepare forced dealer hand if configured
        if self.force_dealer_hand and not self._pending_forced_dealer_cards:
            self._force_dealer_hand()
        
        # If forced dealer hand is set, stack the deck
        if self.force_dealer_hand:
            self._force_dealer_hand()
        
        # Deal two cards to player
        player_cards = self.deck.deal_cards(2)
        current_hand.add_cards(player_cards)
        
        # Deal two cards to dealer (hole card stays hidden)
        if self._pending_forced_dealer_cards:
            hole_card, upcard_card = self._pending_forced_dealer_cards
            self.dealer.add_cards([hole_card, upcard_card])
            self._pending_forced_dealer_cards = None
        else:
            dealer_cards = self.deck.deal_cards(2)
            self.dealer.add_cards(dealer_cards)
        
        # Check for player blackjack and dealer Ace - offer Even Money BEFORE revealing hole card
        current_hand = self.player.get_current_hand()
        player_has_blackjack = current_hand.is_blackjack() if current_hand else False
        dealer_shows_ace = len(self.dealer.hand) >= 2 and self.dealer.hand[1].rank == 'A'
        
        if player_has_blackjack and dealer_shows_ace:
            # Even Money scenario: Player has blackjack, dealer shows Ace
            # Offer Even Money BEFORE revealing dealer's hole card
            self.even_money_offer_active = True
            self.state = GameState.PLAYER_TURN  # Wait for Even Money decision
            self._update_audit({'even_money_offered': True})
            self._record_round_event('even_money_offered', {
                'bet_amount': current_hand.bet if current_hand else 0
            })
            self._capture_initial_hands()
            self._record_round_event('initial_deal', {
                'player_cards': self.current_round_audit.get('player_initial_cards') if self.current_round_audit else [],
                'dealer_cards': self.current_round_audit.get('dealer_initial_cards') if self.current_round_audit else []
            })
            return {'success': True, 'message': 'Cards dealt - Even Money offered', 'even_money_offered': True}
        
        elif player_has_blackjack:
            # Player has blackjack, dealer doesn't show Ace - resolve immediately
            # Reveal dealer's hole card to check if dealer also has it
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
            
            # INSURANCE/OFFERS: If dealer up-card is Ace, offer insurance
            if dealer_shows_ace:
                # Insurance: 50% of bet (rounded down)
                self.insurance_offer_active = True
                self.insurance_for_hand_index = self.player.current_hand_index
                bet = current_hand.bet if current_hand else 0
                self.insurance_amount = int(bet * 0.5)
                self._update_audit({
                    'insurance_offered': True,
                    'insurance_amount': self.insurance_amount
                })
                self._record_round_event('insurance_offered', {
                    'insurance_amount': self.insurance_amount,
                    'hand_index': self.player.current_hand_index
                })
            # PEEK: If dealer shows 10-value (no insurance), peek immediately
            elif self._should_dealer_peek():
                # Dealer shows 10-value - peek immediately to check for blackjack
                peek_result = self._dealer_peek_and_check_blackjack()
                if peek_result.get('game_over'):
                    # Dealer has blackjack - round ended
                    self._capture_initial_hands()
                    self._record_round_event('initial_deal', {
                        'player_cards': self.current_round_audit.get('player_initial_cards') if self.current_round_audit else [],
                        'dealer_cards': self.current_round_audit.get('dealer_initial_cards') if self.current_round_audit else []
                    })
                    self._finalize_round_audit()
                    return {'success': True, 'message': 'Cards dealt - dealer blackjack', 'game_over': True, 'dealer_peeked': True}
        
        self._capture_initial_hands()
        self._record_round_event('initial_deal', {
            'player_cards': self.current_round_audit.get('player_initial_cards') if self.current_round_audit else [],
            'dealer_cards': self.current_round_audit.get('dealer_initial_cards') if self.current_round_audit else []
        })
        if self.state == GameState.GAME_OVER:
            self._finalize_round_audit()
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
        self._record_round_event('player_hit', {
            'card': self._format_card(card),
            'hand_value': current_hand.get_value(),
            'hand_index': self.player.current_hand_index
        })
        
        # Check for 5 Card Charlie (5 cards without busting = automatic win)
        if len(current_hand.cards) == 5 and not current_hand.is_bust():
            current_hand_index = self.player.current_hand_index
            self.player.win(current_hand_index)
            self._record_round_event('five_card_charlie', {
                'hand_index': current_hand_index,
                'hand_value': current_hand.get_value()
            })
            
            # Move to next hand or finish game
            if self._move_to_next_hand():
                return {'success': True, 'message': '5 Card Charlie! You win! Next hand', 'charlie': True}
            else:
                # All hands done - player wins with 5 Card Charlie
                self.dealer.reveal_hole_card()
                self.state = GameState.GAME_OVER
                self.result = "win"
                self._finalize_round_audit()
                return {'success': True, 'message': '5 Card Charlie! You win!', 'charlie': True, 'game_over': True}
        
        # Check if bust
        if current_hand.is_bust():
            # Move to next hand or dealer turn
            self._record_round_event('player_bust', {
                'hand_index': self.player.current_hand_index,
                'hand_value': current_hand.get_value()
            })
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
        
        self._record_round_event('player_stand', {
            'hand_index': self.player.current_hand_index
        })
        # Move to next hand or dealer turn
        if self._move_to_next_hand():
            return {'success': True, 'message': 'Standing. Next hand'}
        else:
            # All hands done, dealer plays and determine results
            self.state = GameState.DEALER_TURN
            self.dealer.play_hand(self.deck, self.dealer_hits_soft_17)
            self._determine_results()  # Only call once here
            return {'success': True, 'message': 'Standing. Dealer playing', 'game_over': True}
    
    def surrender(self) -> Dict[str, Any]:
        """
        Player surrenders (forfeits hand and recovers half bet).
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        
        if self.insurance_offer_active or self.even_money_offer_active:
            return {'success': False, 'message': 'Insurance decision required'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand:
            return {'success': False, 'message': 'No active hand'}
        
        # Surrender only available on first action (exactly 2 cards, no actions taken)
        if len(current_hand.cards) != 2:
            return {'success': False, 'message': 'Surrender only available before taking any actions'}
        
        # Cannot surrender if already doubled down or hit
        if current_hand.is_doubled_down:
            return {'success': False, 'message': 'Cannot surrender after doubling down'}
        
        # Cannot surrender split Aces hands
        if hasattr(current_hand, 'is_from_split_aces') and current_hand.is_from_split_aces:
            return {'success': False, 'message': 'Not allowed on split aces'}
        
        # Mark hand as surrendered
        current_hand.is_surrendered = True
        
        # Return 50% of bet to player (house keeps 50%)
        surrender_refund = current_hand.bet // 2
        self.player.chips += surrender_refund
        
        self._record_round_event('player_surrender', {
            'hand_index': self.player.current_hand_index,
            'bet_amount': current_hand.bet,
            'refund_amount': surrender_refund
        })
        
        # Move to next hand or end game
        if self._move_to_next_hand():
            return {'success': True, 'message': f'Surrendered. Refunded ${surrender_refund}. Next hand'}
        else:
            # All hands done - dealer plays and determine results
            # For surrendered hands, we still need to process them in _determine_results
            self.state = GameState.DEALER_TURN
            self.dealer.play_hand(self.deck, self.dealer_hits_soft_17)
            self._determine_results()
            return {'success': True, 'message': f'Surrendered. Refunded ${surrender_refund}. Game over', 'game_over': True}
    
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
        self._record_round_event('double_down', {
            'hand_index': self.player.current_hand_index,
            'bet_after_double': current_hand.bet,
            'chips_remaining': self.player.chips
        })
        
        # Deal one card
        card = self.deck.deal_card()
        if not card:
            return {'success': False, 'message': 'No more cards in deck'}
        
        current_hand.add_card(card)
        self._record_round_event('double_down_card', {
            'card': self._format_card(card),
            'hand_value': current_hand.get_value()
        })
        
        # Check if bust
        if current_hand.is_bust():
            # Move to next hand or dealer turn
            if self._move_to_next_hand():
                return {'success': True, 'message': 'Doubled down - bust! Next hand', 'bust': True}
            else:
                # All hands busted - dealer plays and determine results
                self.state = GameState.DEALER_TURN
                self.dealer.play_hand(self.deck, self.dealer_hits_soft_17)
                self._determine_results()
                return {'success': True, 'message': 'Doubled down - bust! Game over', 'bust': True, 'game_over': True}
        
        # Move to next hand or dealer turn
        if self._move_to_next_hand():
            return {'success': True, 'message': 'Doubled down'}
        else:
            # All hands done, dealer plays and determine results
            self.state = GameState.DEALER_TURN
            self.dealer.play_hand(self.deck, self.dealer_hits_soft_17)
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
        previous_index = self.player.current_hand_index
        self.player.current_hand_index += 1
        if self.player.current_hand_index >= len(self.player.hands):
            # All hands done - dealer will play but don't determine results here
            # Results will be determined by the caller (stand/hit/double_down)
            return False
        self._record_round_event('advance_to_next_hand', {
            'from_hand': previous_index,
            'to_hand': self.player.current_hand_index
        })
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
            
            # Skip surrendered hands (already processed, player got 50% back)
            if hand.is_surrendered:
                print(f"    → Hand {i} SURRENDERED - skipping (already processed)")
                split_summaries.append((i, 'Surrender', hand.bet // 2))
                if not result_set:
                    self.result = "loss"
                    result_set = True
                continue
            
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
                elif label == 'Surrender':
                    parts.append(f"Split-Hand{hand_no} - Surrender {amt}")
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
        self._finalize_round_audit()
    
    def _finish_game(self):
        """Finish the game when player busts on all hands"""
        print(f"🏁 _finish_game() called - player busted on all hands")
        self.dealer.reveal_hole_card()
        self.state = GameState.GAME_OVER
        self.result = "loss"
        print(f"✅ Game finished: result={self.result}, player chips: ${self.player.chips}")
        # Already lost on bust hands, no need to determine results
        self._finalize_round_audit()
    
    def get_game_state(self) -> Dict[str, Any]:
        """Get the current game state for API responses"""
        # Get the latest round_id if there's a completed round
        latest_round_id = None
        if self.round_history:
            latest_round_id = self.round_history[-1].get('round_id')
        
        # Calculate cut card information
        deck_remaining = len(self.deck)
        total_cards = self.num_decks * 52
        cut_card_threshold = total_cards // 2
        cards_until_reshuffle = max(0, cut_card_threshold - deck_remaining)
        percent_remaining = (deck_remaining / total_cards * 100) if total_cards > 0 else 0
        approaching_cut_card = deck_remaining <= (cut_card_threshold + 20) and deck_remaining > cut_card_threshold
        
        return {
            'game_id': self.game_id,
            'state': self.state,
            'player': self.player.to_dict(),
            'dealer': self.dealer.to_dict(),
            'result': self.result,
            'deck_remaining': deck_remaining,
            'cut_card_threshold': cut_card_threshold,
            'cards_until_reshuffle': cards_until_reshuffle,
            'percent_remaining': round(percent_remaining, 1),
            'approaching_cut_card': approaching_cut_card,
            'total_cards': total_cards,
            'table_limits': {
                'min_bet': self.min_bet,
                'max_bet': self.max_bet
            },
            'dealer_hits_soft_17': self.dealer_hits_soft_17,
            'insurance_offer_active': self.insurance_offer_active,
            'insurance_amount': self.insurance_amount,
            'even_money_offer_active': self.even_money_offer_active,
            'insurance_outcome': self.insurance_outcome,
            'split_summary': getattr(self, 'split_summary', None),
            'dealer_peeked': self.dealer_peeked,
            'force_dealer_hand': self.force_dealer_hand,
            'has_completed_round': len(self.round_history) > 0,
            'latest_round_id': latest_round_id,
            'shuffle_animation': self.last_shuffle_event,
            'auto_mode': {
                'active': self.auto_mode_active,
                'hands_remaining': self.auto_hands_remaining,
                'default_bet': self.auto_default_bet,
                'insurance_mode': self.auto_insurance_mode,
                'status': self.auto_status,
                'log_filename': self.auto_mode_log_filename if not self.auto_mode_active and self.auto_mode_log_filename else None
            }
        }

    def _record_shuffle_event(self, reason: str):
        """Record shuffle metadata so the frontend can trigger an overlay animation."""
        self.last_shuffle_event = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.utcnow().isoformat(timespec='milliseconds') + 'Z',
            'reason': reason
        }
    
    def set_force_dealer_hand(self, hand_string: Optional[str]) -> Dict[str, Any]:
        """
        Set or clear the forced dealer hand for testing.
        
        Args:
            hand_string: Format "rank1,rank2" (e.g., "10,A" or "A,10") or None/empty to disable
            
        Returns:
            Dict with success status
        """
        if hand_string and hand_string.strip():
            # Validate format
            parts = [p.strip().upper() for p in hand_string.split(',')]
            if len(parts) != 2:
                return {'success': False, 'message': 'Invalid format. Use "rank1,rank2" (e.g., "10,A")'}
            
            # Validate ranks
            valid_ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
            rank_map = {'T': '10'}
            parts = [rank_map.get(p, p) for p in parts]
            
            if parts[0] not in valid_ranks or parts[1] not in valid_ranks:
                return {'success': False, 'message': 'Invalid rank. Use A, 2-10, J, Q, K'}
            
            self.force_dealer_hand = hand_string.strip()
            import sys
            print(f"🧪 TEST MODE: Force dealer hand set to: {self.force_dealer_hand}")
            sys.stdout.flush()
        else:
            self.force_dealer_hand = None
            import sys
            print("🧪 TEST MODE: Force dealer hand disabled")
            sys.stdout.flush()
        
        # Clear any pending forced cards; they will be regenerated on next deal
        self._pending_forced_dealer_cards = None
        return {'success': True, 'message': 'Force dealer hand updated'}

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
                self._record_round_event('even_money_taken', {
                    'payout': payout,
                    'hand_index': self.player.current_hand_index
                })
                self._update_audit({
                    'even_money_taken': True,
                    'even_money_payout': payout
                })
                self._finalize_round_audit()
                return {'success': True, 'message': 'Even money paid', 'game_over': True}
            elif decision == 'decline':
                # Player declined Even Money - now reveal dealer's hole card and resolve
                self.even_money_offer_active = False
                self._record_round_event('even_money_declined', {})
                self._update_audit({'even_money_taken': False})
                
                # Reveal dealer's hole card to check if dealer also has blackjack
                self.dealer.reveal_hole_card()
                if self.dealer.is_blackjack():
                    # Both have blackjack - push
                    self.state = GameState.GAME_OVER
                    self.result = "push"
                    self.player.push()
                    self._finalize_round_audit()
                    return {'success': True, 'message': 'Even money declined - Push (both blackjack)', 'game_over': True}
                else:
                    # Player blackjack, dealer doesn't - player wins 3:2
                    self.state = GameState.GAME_OVER
                    self.result = "blackjack"
                    self.player.win(is_blackjack=True)
                    self._finalize_round_audit()
                    return {'success': True, 'message': 'Even money declined - Blackjack wins 3:2', 'game_over': True}
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
                self._record_round_event('insurance_bought', {
                    'insurance_amount': self.insurance_amount
                })
                self._update_audit({
                    'insurance_taken': True,
                    'insurance_declined': False
                })
                # After insurance decision, dealer peeks at hole card
                peek_result = self._dealer_peek_and_check_blackjack()
                if peek_result.get('game_over'):
                    return {'success': True, 'message': 'Insurance purchased - dealer blackjack', 'game_over': True, 'dealer_peeked': True}
                return {'success': True, 'message': 'Insurance purchased', 'dealer_peeked': True}
            elif decision == 'decline':
                self.insurance_offer_active = False
                self.insurance_taken = False
                self._record_round_event('insurance_declined', {})
                self._update_audit({
                    'insurance_taken': False,
                    'insurance_declined': True
                })
                # After insurance decision, dealer peeks at hole card
                peek_result = self._dealer_peek_and_check_blackjack()
                if peek_result.get('game_over'):
                    return {'success': True, 'message': 'Insurance declined - dealer blackjack', 'game_over': True, 'dealer_peeked': True}
                return {'success': True, 'message': 'Insurance declined', 'dealer_peeked': True}
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
    
    def _log_auto_event(self, message: str, spacer_before: bool = False):
        """Write an event to the auto mode log file."""
        if self.auto_mode_log_file:
            try:
                if spacer_before:
                    self.auto_mode_log_file.write("\n")
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
        
        summary_divider = "-" * 70
        self._log_auto_event(summary_divider, spacer_before=True)
        self._log_auto_event("Round Summary")
        
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
        self._log_auto_event(summary_divider)

    def _log_round_header(self, hand_number: int):
        """Create a visually distinct header whenever a new auto-mode hand begins."""
        if not self.auto_mode_log_file:
            return
        header_divider = "=" * 70
        header_text = (
            f"HAND {hand_number:03d} | Hands Remaining: {self.auto_hands_remaining} | "
            f"Bankroll: ${self.player.chips}"
        )
        self._log_auto_event(header_divider, spacer_before=True)
        self._log_auto_event(header_text)
        self._log_auto_event(header_divider)

    def log_hand(self) -> Dict[str, Any]:
        """
        Log the current round's hand data to LogHand.log file.
        Only logs if there's a finalized round audit available.
        
        Returns:
            Dict with success status and message
        """
        try:
            # Get the most recent finalized round audit
            if not self.round_history:
                return {'success': False, 'message': 'No completed round to log'}
            
            # Get the most recent round audit
            round_audit = self.round_history[-1]
            
            # Get the project root directory
            current_file = os.path.abspath(__file__)
            blackjack_dir = os.path.dirname(current_file)
            project_root = os.path.dirname(blackjack_dir)
            
            # Fallback to current working directory if path resolution fails
            if not os.path.exists(project_root):
                project_root = os.getcwd()
            
            # Log file path
            log_path = os.path.join(project_root, 'LogHand.log')
            
            # Build the new log entry
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            new_entry_lines = []
            new_entry_lines.append(f"{'='*80}\n")
            new_entry_lines.append(f"Hand Logged: {timestamp}\n")
            new_entry_lines.append(f"{'='*80}\n")
            
            # Round ID
            new_entry_lines.append(f"Round ID: {round_audit.get('round_id', 'N/A')}\n")
            
            # Beginning balance
            new_entry_lines.append(f"Beginning Balance: ${round_audit.get('starting_balance', 0)}\n")
            
            # Bet amount
            new_entry_lines.append(f"Bet Amount: ${round_audit.get('bet_amount', 0)}\n")
            
            # Initial cards dealt
            new_entry_lines.append(f"\nInitial Cards Dealt:\n")
            new_entry_lines.append(f"  Player: {', '.join(round_audit.get('player_initial_cards', []))}\n")
            dealer_initial = round_audit.get('dealer_initial_cards', [])
            if dealer_initial:
                new_entry_lines.append(f"  Dealer: {dealer_initial[0]} (hole card hidden), {dealer_initial[1] if len(dealer_initial) > 1 else 'N/A'}\n")
            
            # Insurance information
            insurance_offered = round_audit.get('insurance_offered', False)
            even_money_offered = round_audit.get('even_money_offered', False)
            if insurance_offered or even_money_offered:
                new_entry_lines.append(f"\nInsurance:\n")
                if even_money_offered:
                    new_entry_lines.append(f"  Even Money Offered: Yes\n")
                    new_entry_lines.append(f"  Even Money Taken: {'Yes' if round_audit.get('even_money_taken', False) else 'No'}\n")
                    if round_audit.get('even_money_taken', False):
                        new_entry_lines.append(f"  Even Money Payout: ${round_audit.get('even_money_payout', 0)}\n")
                else:
                    new_entry_lines.append(f"  Insurance Offered: Yes\n")
                    new_entry_lines.append(f"  Insurance Amount: ${round_audit.get('insurance_amount', 0)}\n")
                    new_entry_lines.append(f"  Insurance Taken: {'Yes' if round_audit.get('insurance_taken', False) else 'No'}\n")
                    if round_audit.get('insurance_taken', False):
                        insurance_paid = round_audit.get('insurance_paid', False)
                        if insurance_paid:
                            new_entry_lines.append(f"  Insurance Payout: ${round_audit.get('insurance_payout', 0)}\n")
                        else:
                            new_entry_lines.append(f"  Insurance Lost: ${round_audit.get('insurance_loss', 0)}\n")
            else:
                new_entry_lines.append(f"\nInsurance: Not Offered\n")
            
            # Hit cards (extract from events)
            hit_cards = []
            surrender_info = []
            for event in round_audit.get('events', []):
                if event.get('event') == 'player_hit':
                    card = event.get('details', {}).get('card')
                    if card:
                        hit_cards.append(card)
                elif event.get('event') == 'double_down_card':
                    card = event.get('details', {}).get('card')
                    if card:
                        hit_cards.append(f"{card} (double down)")
                elif event.get('event') == 'player_surrender':
                    details = event.get('details', {})
                    surrender_info.append({
                        'hand_index': details.get('hand_index', 0),
                        'bet_amount': details.get('bet_amount', 0),
                        'refund_amount': details.get('refund_amount', 0)
                    })
            
            if hit_cards:
                new_entry_lines.append(f"\nHit Cards:\n")
                for i, card in enumerate(hit_cards, 1):
                    new_entry_lines.append(f"  Hit {i}: {card}\n")
            else:
                new_entry_lines.append(f"\nHit Cards: None\n")
            
            # Surrender information
            if surrender_info:
                new_entry_lines.append(f"\nSurrender:\n")
                for surr in surrender_info:
                    hand_no = surr['hand_index'] + 1
                    new_entry_lines.append(f"  Hand {hand_no}: Surrendered (Bet: ${surr['bet_amount']}, Refund: ${surr['refund_amount']})\n")
            
            # Final hands
            new_entry_lines.append(f"\nFinal Hands:\n")
            player_final_hands = round_audit.get('player_final_hands', [])
            if player_final_hands:
                for idx, hand in enumerate(player_final_hands):
                    hand_label = f"Hand {idx + 1}" if len(player_final_hands) > 1 else "Hand"
                    cards = ', '.join(hand.get('cards', []))
                    value = hand.get('value', 0)
                    bet = hand.get('bet', 0)
                    is_surrendered = hand.get('is_surrendered', False)
                    status = " (Surrendered)" if is_surrendered else ""
                    new_entry_lines.append(f"  {hand_label}: {cards} (Value: {value}, Bet: ${bet}){status}\n")
            
            dealer_final_hand = round_audit.get('dealer_final_hand', [])
            dealer_final_value = round_audit.get('dealer_final_value', 0)
            if dealer_final_hand:
                new_entry_lines.append(f"  Dealer: {', '.join(dealer_final_hand)} (Value: {dealer_final_value})\n")
            
            # Result
            new_entry_lines.append(f"\nResult: {round_audit.get('result', 'N/A').upper()}\n")
            
            # Final balance
            new_entry_lines.append(f"Final Balance: ${round_audit.get('final_balance', 0)}\n")
            
            new_entry_lines.append(f"{'='*80}\n\n")
            
            # Read existing file content (if it exists)
            existing_content = ''
            if os.path.exists(log_path):
                with open(log_path, 'r', encoding='utf-8') as log_file:
                    existing_content = log_file.read()
            
            # Write new entry first, then existing content (prepend mode)
            new_entry = ''.join(new_entry_lines)
            with open(log_path, 'w', encoding='utf-8') as log_file:
                log_file.write(new_entry)
                if existing_content:
                    log_file.write(existing_content)
            
            return {'success': True, 'message': 'Hand logged successfully'}
        except Exception as e:
            error_msg = f"Failed to log hand: {str(e)}"
            print(f"⚠️ {error_msg}")
            traceback.print_exc()
            return {'success': False, 'message': error_msg}

    def start_auto_mode(
        self,
        default_bet: int,
        hands: int,
        insurance_mode: str,
        strategy: str = 'basic',
        betting_strategy: str = 'fixed',
        bet_percentage: Optional[int] = None,
        double_down_pref: str = 'recommended',
        split_pref: str = 'recommended',
        surrender_pref: str = 'recommended'
    ) -> Dict[str, Any]:
        if self.auto_mode_active:
            return {'success': False, 'message': 'Auto mode already running'}
        if default_bet <= 0:
            return {'success': False, 'message': 'Default bet must be greater than 0'}
        if hands <= 0:
            return {'success': False, 'message': 'Hands must be greater than 0'}
        if insurance_mode not in ('always', 'never'):
            return {'success': False, 'message': 'Invalid insurance preference'}
        if strategy not in ('basic', 'conservative', 'aggressive'):
            strategy = 'basic'
        if betting_strategy not in ('fixed', 'progressive', 'percentage'):
            betting_strategy = 'fixed'
        if betting_strategy == 'percentage' and (bet_percentage is None or bet_percentage <= 0 or bet_percentage > 100):
            return {'success': False, 'message': 'Valid bet percentage (1-100) required for percentage betting strategy'}
        if double_down_pref not in ('always', 'never', 'recommended'):
            double_down_pref = 'recommended'
        if split_pref not in ('always', 'never', 'recommended'):
            split_pref = 'recommended'
        if surrender_pref not in ('always', 'never', 'recommended'):
            surrender_pref = 'recommended'
        
        # Check bankroll based on betting strategy
        if betting_strategy == 'percentage':
            min_bet = max(1, int(self.player.chips * bet_percentage / 100))
            if self.player.chips < min_bet:
                return {'success': False, 'message': 'Insufficient bankroll for auto mode'}
        elif self.player.chips < default_bet:
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
        self.auto_strategy = strategy
        self.auto_betting_strategy = betting_strategy
        self.auto_bet_percentage = bet_percentage
        self.auto_double_down_pref = double_down_pref
        self.auto_split_pref = split_pref
        self.auto_surrender_pref = surrender_pref
        self.auto_progressive_bet = default_bet
        self.auto_last_result = None
        self.auto_status = f'Auto mode running ({hands} hands remaining)'
        
        config_str = f"Default Bet: ${default_bet}, Hands: {hands}, Insurance: {insurance_mode}"
        config_str += f", Strategy: {strategy}, Betting: {betting_strategy}"
        if betting_strategy == 'percentage':
            config_str += f" ({bet_percentage}%)"
        config_str += f", Double Down: {double_down_pref}, Split: {split_pref}, Surrender: {surrender_pref}"
        self._log_auto_event(f"Auto Mode Started - {config_str}")
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
        self.auto_strategy = 'basic'
        self.auto_betting_strategy = 'fixed'
        self.auto_bet_percentage = None
        self.auto_double_down_pref = 'recommended'
        self.auto_split_pref = 'recommended'
        self.auto_surrender_pref = 'recommended'
        self.auto_progressive_bet = 0
        self.auto_last_result = None
        self.auto_status = status

    def is_auto_mode_active(self) -> bool:
        return self.auto_mode_active and self.auto_hands_remaining > 0

    def _get_auto_play_decision(self):
        """Determine whether to hit or stand based on dealer up card and selected strategy.
        
        Basic Strategy:
        - Dealer shows 2-6: stand
        - Dealer shows 7-A: hit until >16
        
        Conservative Strategy:
        - Dealer shows 2-6: stand at 13+
        - Dealer shows 7-A: stand at 17+
        
        Aggressive Strategy:
        - Dealer shows 2-6: hit until 18
        - Dealer shows 7-A: hit until 17
        """
        current_hand = self.player.get_current_hand()
        if not current_hand or current_hand.is_bust():
            return 'stand'  # Hand is already bust
        
        player_value = current_hand.get_value()
        dealer_up_card = self.dealer.hand[0] if self.dealer.hand else None
        
        if not dealer_up_card:
            return 'stand'
        
        dealer_rank = dealer_up_card.rank
        strategy = self.auto_strategy
        
        # Dealer shows 2-6
        if dealer_rank in ['2', '3', '4', '5', '6']:
            if strategy == 'basic':
                return 'stand'
            elif strategy == 'conservative':
                return 'stand' if player_value >= 13 else 'hit'
            elif strategy == 'aggressive':
                return 'stand' if player_value >= 18 else 'hit'
        
        # Dealer shows 7, 8, 9, 10, J, Q, K, A
        if dealer_rank in ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']:
            if strategy == 'basic':
                return 'stand' if player_value > 16 else 'hit'
            elif strategy == 'conservative':
                return 'stand' if player_value >= 17 else 'hit'
            elif strategy == 'aggressive':
                return 'stand' if player_value >= 17 else 'hit'
        
        # Default to stand
        return 'stand'

    def _should_double_down(self) -> bool:
        """Determine if player should double down based on preference and basic strategy."""
        pref = self.auto_double_down_pref
        if pref == 'never':
            return False
        if pref == 'always':
            current_hand = self.player.get_current_hand()
            return current_hand and current_hand.can_double_down() and self.player.chips >= current_hand.bet
        
        # 'recommended' - use basic strategy
        current_hand = self.player.get_current_hand()
        if not current_hand or not current_hand.can_double_down() or self.player.chips < current_hand.bet:
            return False
        
        player_value = current_hand.get_value()
        dealer_up_card = self.dealer.hand[0] if self.dealer.hand else None
        if not dealer_up_card:
            return False
        
        dealer_rank = dealer_up_card.rank
        
        # Basic strategy: Double on 9-11 vs dealer 2-6
        if player_value in (9, 10, 11) and dealer_rank in ('2', '3', '4', '5', '6'):
            return True
        
        # Double on soft 13-18 vs dealer 4-6 (simplified - check if hand is soft)
        if len(current_hand.cards) == 2:
            has_ace = any(card.rank == 'A' for card in current_hand.cards)
            if has_ace and player_value in (13, 14, 15, 16, 17, 18) and dealer_rank in ('4', '5', '6'):
                return True
        
        return False

    def _should_split(self) -> bool:
        """Determine if player should split based on preference and basic strategy."""
        pref = self.auto_split_pref
        if pref == 'never':
            return False
        if pref == 'always':
            current_hand = self.player.get_current_hand()
            return current_hand and current_hand.can_split() and len(self.player.hands) < 4 and self.player.chips >= current_hand.bet
        
        # 'recommended' - use basic strategy
        current_hand = self.player.get_current_hand()
        if not current_hand or not current_hand.can_split() or len(self.player.hands) >= 4 or self.player.chips < current_hand.bet:
            return False
        
        if len(current_hand.cards) != 2:
            return False
        
        card1_rank = current_hand.cards[0].rank
        card2_rank = current_hand.cards[1].rank
        dealer_up_card = self.dealer.hand[0] if self.dealer.hand else None
        
        if not dealer_up_card:
            return False
        
        dealer_rank = dealer_up_card.rank
        
        # Always split Aces and 8s
        if card1_rank == card2_rank and card1_rank in ('A', '8'):
            return True
        
        # Split 2s, 3s, 6s, 7s, 9s vs dealer 2-6
        if card1_rank == card2_rank and card1_rank in ('2', '3', '6', '7', '9') and dealer_rank in ('2', '3', '4', '5', '6'):
            return True
        
        # Split 4s vs dealer 5-6
        if card1_rank == card2_rank and card1_rank == '4' and dealer_rank in ('5', '6'):
            return True
        
        return False

    def _should_surrender(self) -> bool:
        """Determine if player should surrender based on preference and basic strategy."""
        pref = self.auto_surrender_pref
        if pref == 'never':
            return False
        if pref == 'always':
            current_hand = self.player.get_current_hand()
            if not current_hand or len(current_hand.cards) != 2 or current_hand.is_blackjack():
                return False
            # Surrender is only available on first action (exactly 2 cards, no actions taken)
            return True
        
        # 'recommended' - use basic strategy
        current_hand = self.player.get_current_hand()
        if not current_hand or len(current_hand.cards) != 2 or current_hand.is_blackjack():
            return False
        
        player_value = current_hand.get_value()
        dealer_up_card = self.dealer.hand[0] if self.dealer.hand else None
        if not dealer_up_card:
            return False
        
        dealer_rank = dealer_up_card.rank
        
        # Basic strategy: Surrender hard 15-16 vs dealer 10, hard 16 vs dealer 9
        if dealer_rank == '10' and player_value in (15, 16):
            return True
        if dealer_rank == '9' and player_value == 16:
            return True
        
        return False

    def run_auto_cycle(self):
        """Execute auto-mode rounds until finished or interrupted."""
        hand_number = 0
        while self.is_auto_mode_active():
            hand_number += 1
            self._log_round_header(hand_number)
            
            # Ensure we're in betting state for new round
            if self.state != GameState.BETTING:
                self.new_game(preserve_auto=True)
            
            # Calculate bet amount based on betting strategy
            if self.auto_betting_strategy == 'fixed':
                bet_amount = self.auto_default_bet
            elif self.auto_betting_strategy == 'progressive':
                # Progressive: double after loss, reset to default after win/push
                if self.auto_last_result == 'loss':
                    # Double the previous bet (or default if first round after loss)
                    prev_bet = self.auto_progressive_bet if self.auto_progressive_bet > 0 else self.auto_default_bet
                    bet_amount = min(prev_bet * 2, self.max_bet)
                    bet_amount = max(bet_amount, self.auto_default_bet)  # Don't go below default
                else:
                    # Reset to default after win/push/blackjack
                    bet_amount = self.auto_default_bet
                self.auto_progressive_bet = bet_amount
            elif self.auto_betting_strategy == 'percentage':
                # Percentage: bet X% of current bankroll
                bet_amount = max(1, int(self.player.chips * self.auto_bet_percentage / 100))
                bet_amount = min(bet_amount, self.max_bet)  # Respect max bet limit
            else:
                bet_amount = self.auto_default_bet
            
            # Check bankroll
            if self.player.chips < bet_amount:
                self._log_auto_event(f"Bankroll check failed: ${self.player.chips} < ${bet_amount}")
                self.stop_auto_mode('Auto mode stopped: insufficient bankroll')
                break
            
            # Place bet
            bet_result = self.place_bet(bet_amount)
            if not bet_result.get('success'):
                self._log_auto_event(f"Bet placement failed: {bet_result.get('message')}")
                self.stop_auto_mode(f"Auto mode stopped: {bet_result.get('message')}")
                break
            self._log_auto_event(f"Bet placed: ${bet_amount} (Bankroll: ${self.player.chips})")
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
            # If round still in player turn, check for actions and apply hit/stand strategy
            if self.state == GameState.PLAYER_TURN:
                # Process all hands (in case of splits)
                while self.state == GameState.PLAYER_TURN:
                    current_hand = self.player.get_current_hand()
                    if not current_hand:
                        break
                    
                    player_value = current_hand.get_value()
                    
                    # Check for surrender (only on first action, exactly 2 cards)
                    if self._should_surrender():
                        self._log_auto_event(f"Player value {player_value} - Auto surrendering")
                        surrender_result = self.surrender()
                        if not surrender_result.get('success', False):
                            self._log_auto_event(f"Surrender failed: {surrender_result.get('message')}")
                            self.stop_auto_mode(f"Auto mode stopped: {surrender_result.get('message')}")
                            break
                        # Surrender moves to next hand or ends round
                        continue
                    
                    # Check for split
                    if self._should_split():
                        self._log_auto_event(f"Player cards: {', '.join(str(c) for c in current_hand.cards)} - Auto splitting")
                        split_result = self.split()
                        if not split_result.get('success', False):
                            self._log_auto_event(f"Split failed: {split_result.get('message')}")
                            # Continue with play if split fails
                        else:
                            # Split successful, continue to play each hand
                            continue
                    
                    # If this is a split aces hand, no further actions allowed - stand automatically
                    if hasattr(current_hand, 'is_from_split_aces') and current_hand.is_from_split_aces:
                        self._log_auto_event("Split aces hand - auto standing (hits not allowed)")
                        stand_result = self.stand()
                        if not stand_result.get('success', False):
                            self._log_auto_event(f"Stand failed: {stand_result.get('message')}")
                            self.stop_auto_mode(f"Auto mode stopped: {stand_result.get('message')}")
                            break
                        continue

                    # Check for double down
                    if self._should_double_down():
                        self._log_auto_event(f"Player value {player_value} - Auto doubling down")
                        double_result = self.double_down()
                        if not double_result.get('success', False):
                            self._log_auto_event(f"Double down failed: {double_result.get('message')}")
                            # Continue with hit/stand if double down fails
                        else:
                            # Double down automatically hits once and stands
                            continue
                    
                    # Hit/stand decision
                    decision = self._get_auto_play_decision()
                    
                    if decision == 'hit':
                        self._log_auto_event(f"Player value {player_value} - Auto hitting")
                        hit_result = self.hit()
                        if not hit_result.get('success', False):
                            error_msg = hit_result.get('message', '')
                            if error_msg and 'split aces' in error_msg.lower():
                                self._log_auto_event("Hit blocked on split aces - auto standing instead")
                                stand_result = self.stand()
                                if not stand_result.get('success', False):
                                    self._log_auto_event(f"Stand failed after split-ace hit block: {stand_result.get('message')}")
                                    self.stop_auto_mode(f"Auto mode stopped: {stand_result.get('message')}")
                                    break
                                continue
                            self._log_auto_event(f"Hit failed: {error_msg}")
                            self.stop_auto_mode(f"Auto mode stopped: {error_msg}")
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
            
            # Track result for progressive betting
            if self.result:
                self.auto_last_result = self.result  # 'win', 'loss', 'push', 'blackjack'
            else:
                self.auto_last_result = None
            
            self.auto_hands_remaining -= 1
            if self.auto_hands_remaining <= 0:
                self.stop_auto_mode('Auto mode finished')
            else:
                self.auto_status = f'Auto mode running ({self.auto_hands_remaining} hands remaining)'
                self.new_game(preserve_auto=True)

        if not self.auto_mode_active and not self.auto_status:
            self.auto_status = 'Auto mode stopped'

