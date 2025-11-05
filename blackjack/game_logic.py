"""
Game logic and state management for Blackjack game
"""

import uuid
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
    
    def __init__(self, starting_chips: int = 1000, num_decks: int = 1):
        """Initialize a new blackjack game"""
        self.game_id: str = str(uuid.uuid4())
        self.deck: Deck = Deck(num_decks)
        self.deck.shuffle()
        self.player: Player = Player(starting_chips)
        self.dealer: Dealer = Dealer()
        self.state: str = GameState.BETTING
        self.result: Optional[str] = None  # "win", "loss", "push", "blackjack"
    
    def new_game(self):
        """Start a new game round"""
        self.dealer.clear_hand()
        self.player.clear_hands()
        self.player.create_new_hand()
        self.state = GameState.BETTING
        self.result = None
        
        # Reshuffle if low on cards (less than 20 cards remaining)
        if len(self.deck) < 20:
            self.deck.reset()
    
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
        
        return {'success': True, 'message': 'Cards dealt'}
    
    def hit(self) -> Dict[str, Any]:
        """
        Player hits (takes another card).
        
        Returns:
            Dict with success status and game state
        """
        if self.state != GameState.PLAYER_TURN:
            return {'success': False, 'message': 'Not player turn'}
        
        current_hand = self.player.get_current_hand()
        if not current_hand:
            return {'success': False, 'message': 'No active hand'}
        
        # Deal a card
        card = self.deck.deal_card()
        if not card:
            return {'success': False, 'message': 'No more cards in deck'}
        
        current_hand.add_card(card)
        
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
        
        if not current_hand.can_split():
            return {'success': False, 'message': 'Cannot split this hand'}
        
        if self.player.chips < current_hand.bet:
            return {'success': False, 'message': 'Insufficient Funds'}
        
        success = self.player.split_hand(self.player.current_hand_index)
        if not success:
            return {'success': False, 'message': 'Failed to split hand'}
        
        # Deal a card to each split hand
        hands = self.player.hands
        for i, hand in enumerate(hands):
            if len(hand.cards) == 1:  # Newly split hand
                card = self.deck.deal_card()
                if card:
                    hand.add_card(card)
        
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
        
        for i, hand in enumerate(self.player.hands):
            print(f"  Processing hand {i}: value={hand.get_value()}, bust={hand.is_bust()}, bet=${hand.bet}")
            sys.stdout.flush()
            
            if hand.is_bust():
                print(f"    → Hand {i} BUSTED - calling lose()")
                self.player.lose(i)
                if not result_set:
                    self.result = "loss"
                    result_set = True
            elif dealer_bust:
                print(f"    → Dealer BUSTED - calling win() on hand {i}")
                self.player.win(i)
                if not result_set:
                    self.result = "win"
                    result_set = True
            else:
                player_value = hand.get_value()
                if player_value > dealer_value:
                    if hand.is_blackjack():
                        print(f"    → Hand {i} BLACKJACK WIN - calling win(is_blackjack=True)")
                        self.player.win(i, is_blackjack=True)
                        self.result = "blackjack"
                        result_set = True
                    else:
                        print(f"    → Hand {i} WINS ({player_value} > {dealer_value}) - calling win()")
                        self.player.win(i)
                        if self.result != "blackjack":
                            self.result = "win"
                            result_set = True
                elif player_value < dealer_value:
                    print(f"    → Hand {i} LOSES ({player_value} < {dealer_value}) - calling lose()")
                    self.player.lose(i)
                    if self.result != "blackjack":
                        self.result = "loss"
                        result_set = True
                else:
                    print(f"    → Hand {i} PUSH ({player_value} == {dealer_value}) - calling push()")
                    self.player.push(i)
                    if self.result != "blackjack" and self.result != "win" and self.result != "loss":
                        self.result = "push"
                        result_set = True
        
        if not result_set:
            print(f"⚠️ WARNING: No result was set! Setting default to 'loss'")
            self.result = "loss"
        
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
            'deck_remaining': len(self.deck)
        }

