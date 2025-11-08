#!/usr/bin/env python3
"""
Simple test script for Blackjack backend
Run this to verify Phase 1 implementation works correctly
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from blackjack.deck import Deck, Card, calculate_hand_value, is_blackjack, is_bust
from blackjack.player import Player, Hand
from blackjack.dealer import Dealer
from blackjack.game_logic import BlackjackGame, GameState


def test_card():
    """Test Card class"""
    print("Testing Card class...")
    card = Card('hearts', 'A')
    assert card.suit == 'hearts'
    assert card.rank == 'A'
    assert card.value == 11
    print("✓ Card class works")


def test_deck():
    """Test Deck class"""
    print("Testing Deck class...")
    deck = Deck()
    assert len(deck) == 52
    card = deck.deal_card()
    assert card is not None
    assert len(deck) == 51
    print("✓ Deck class works")


def test_hand_value():
    """Test hand value calculation"""
    print("Testing hand value calculation...")
    cards = [Card('hearts', 'A'), Card('hearts', 'K')]
    assert calculate_hand_value(cards) == 21
    
    cards = [Card('hearts', 'A'), Card('hearts', 'A'), Card('hearts', 'K')]
    assert calculate_hand_value(cards) == 12  # Aces adjusted
    
    cards = [Card('hearts', '10'), Card('hearts', 'J'), Card('hearts', 'Q')]
    assert calculate_hand_value(cards) == 30
    assert is_bust(cards)
    print("✓ Hand value calculation works")


def test_blackjack():
    """Test blackjack detection"""
    print("Testing blackjack detection...")
    cards = [Card('hearts', 'A'), Card('hearts', 'K')]
    assert is_blackjack(cards)
    
    cards = [Card('hearts', 'A'), Card('hearts', '10')]
    assert is_blackjack(cards)
    
    cards = [Card('hearts', 'A'), Card('hearts', '5'), Card('hearts', '5')]
    assert not is_blackjack(cards)  # 21 but not blackjack
    print("✓ Blackjack detection works")


def test_player():
    """Test Player class"""
    print("Testing Player class...")
    player = Player(starting_chips=1000)
    assert player.chips == 1000
    
    player.create_new_hand()
    assert player.place_bet(50)
    assert player.chips == 950
    
    hand = player.get_current_hand()
    assert hand.bet == 50
    print("✓ Player class works")


def test_dealer():
    """Test Dealer class"""
    print("Testing Dealer class...")
    dealer = Dealer()
    dealer.add_card(Card('hearts', '10'))
    dealer.add_card(Card('hearts', '6'))
    assert dealer.get_value() == 16
    assert dealer.should_hit()
    
    dealer.add_card(Card('hearts', '2'))
    assert dealer.get_value() == 18
    assert not dealer.should_hit()
    print("✓ Dealer class works")


def test_game():
    """Test full game flow"""
    print("Testing full game flow...")
    game = BlackjackGame(starting_chips=1000)
    
    # Start new game round
    game.new_game()
    
    # Place bet
    result = game.place_bet(50)
    assert result['success']
    assert game.state == GameState.BETTING
    
    # Deal cards
    result = game.deal_initial_cards()
    assert result['success']
    assert game.state in [GameState.PLAYER_TURN, GameState.GAME_OVER]
    
    if game.state == GameState.PLAYER_TURN:
        # Get initial hand value
        initial_value = game.player.get_current_hand().get_value()
        
        # Player can hit (might bust, might not)
        result = game.hit()
        assert result['success']
        
        # If not bust and game still in progress, player can stand
        if not result.get('game_over', False) and game.state == GameState.PLAYER_TURN:
            result = game.stand()
            assert result['success']
            assert game.state == GameState.GAME_OVER
        else:
            # Game ended (bust or blackjack)
            assert game.state == GameState.GAME_OVER
    
    print("✓ Full game flow works")


def test_split_basic():
    """Test splitting a regular pair with auto bet duplication"""
    print("Testing split (basic)...")
    game = BlackjackGame(starting_chips=1000)
    game.new_game()
    # Set up a pair: 8,8 and bet
    game.player.get_current_hand().cards = [Card('hearts', '8'), Card('clubs', '8')]
    game.player.get_current_hand().bet = 100
    game.player.chips -= 100  # simulate deduction
    game.state = GameState.PLAYER_TURN
    before_chips = game.player.chips
    result = game.split()
    assert result['success']
    assert len(game.player.hands) == 2
    # Each new hand has a bet, and chips were deducted once more
    assert game.player.hands[0].bet == 100 and game.player.hands[1].bet == 100
    assert game.player.chips == before_chips - 100
    print("✓ Split basic works")


def test_split_aces():
    """Test splitting Aces: one card to each, no further actions"""
    print("Testing split Aces...")
    game = BlackjackGame(starting_chips=1000)
    game.new_game()
    game.player.get_current_hand().cards = [Card('hearts', 'A'), Card('clubs', 'A')]
    game.player.get_current_hand().bet = 50
    game.player.chips -= 50
    game.state = GameState.PLAYER_TURN
    result = game.split()
    assert result['success']
    assert len(game.player.hands) == 2
    h0, h1 = game.player.hands[0], game.player.hands[1]
    assert h0.is_from_split_aces and h1.is_from_split_aces
    # Attempt to hit should be rejected
    res2 = game.hit()
    assert not res2['success']
    assert 'split aces' in res2['message']
    print("✓ Split Aces rules enforced")


def test_insurance_offer_and_payout():
    """Insurance appears with dealer Ace and pays correctly when dealer BJ"""
    print("Testing insurance offer and payout...")
    game = BlackjackGame(starting_chips=1000)
    game.new_game()
    # Set player non-blackjack and dealer Ace up
    game.player.get_current_hand().cards = [Card('hearts','9'), Card('clubs','9')]
    game.player.get_current_hand().bet = 100
    game.player.chips -= 100
    game.dealer.hand = [Card('spades','K'), Card('hearts','A')]  # hole + upcard Ace
    game.state = GameState.PLAYER_TURN
    # Manually trigger offer state like deal would
    game.insurance_offer_active = True
    game.insurance_amount = 50
    # Buy insurance
    res = game.insurance_decision('buy')
    assert res['success']
    assert game.player.chips == 850  # 100 bet + 50 insurance deducted
    # Dealer has blackjack -> run results
    game.dealer.reveal_hole_card()
    game._determine_results()
    # Insurance pays +150 -> 850 + 150 = 1000 (break-even)
    assert game.player.chips == 1000
    print("✓ Insurance payout correct")


def test_even_money():
    """Even money pays immediately 1:1"""
    print("Testing even money...")
    game = BlackjackGame(starting_chips=1000)
    game.new_game()
    # Player blackjack, dealer Ace up
    hand = game.player.get_current_hand()
    hand.cards = [Card('hearts','A'), Card('clubs','K')]
    hand.bet = 100
    game.player.chips -= 100
    game.dealer.hand = [Card('spades','9'), Card('hearts','A')]
    game.state = GameState.PLAYER_TURN
    game.even_money_offer_active = True
    res = game.insurance_decision('even_money')
    assert res['success'] and res.get('game_over')
    # Even money pays +200 -> back to 1100? start 1000-100+200=1100
    assert game.player.chips == 1100
    print("✓ Even money payout correct")


def test_auto_mode_insufficient_start():
    """Auto mode should refuse to start without enough bankroll."""
    print("Testing auto mode insufficient funds...")
    game = BlackjackGame(starting_chips=80)
    game.new_game()
    res = game.start_auto_mode(100, 5, 'never')
    assert not res['success']
    assert 'Insufficient bankroll' in res['message']
    print("✓ Auto mode rejects insufficient bankroll")


def test_auto_mode_runs_and_finishes_with_insurance():
    """Auto mode plays a round with insurance payout."""
    print("Testing auto mode run with insurance...")
    game = BlackjackGame(starting_chips=1000)
    game.new_game()
    # Rig deck: player 8+7, dealer hole K, up A → dealer blackjack
    game.deck.cards = [
        Card('hearts', '8'),  # player first (pop last)
        Card('hearts', '7'),  # player second
        Card('diamonds', 'K'),  # dealer hole
        Card('spades', 'A')     # dealer up
    ]
    res = game.start_auto_mode(100, 1, 'always')
    assert res['success']
    game.run_auto_cycle()
    state = game.get_game_state()
    assert not state['auto_mode']['active']
    assert state['auto_mode']['status'] in ('Auto mode finished', 'Auto mode stopped: insufficient bankroll') or state['auto_mode']['status'] is not None
    assert game.player.chips == 1000  # Insurance covers blackjack loss
    assert state['insurance_outcome'] and state['insurance_outcome']['paid']
    print("✓ Auto mode resolved insurance round")


def test_auto_mode_aborts_when_bankroll_drops():
    """Auto mode stops mid-session when bankroll cannot cover next bet."""
    print("Testing auto mode abort on low bankroll...")
    game = BlackjackGame(starting_chips=150)
    game.new_game()
    # Ensure first hand is a loss: player 2+3 (value 5), dealer hole K, up 9 => dealer 19
    game.deck.cards = [
        Card('clubs', '2'),
        Card('diamonds', '3'),
        Card('spades', 'K'),
        Card('hearts', '9')
    ]
    res = game.start_auto_mode(100, 2, 'never')
    assert res['success']
    game.run_auto_cycle()
    state = game.get_game_state()
    assert state['auto_mode']['status'] == 'Auto mode stopped: insufficient bankroll'
    assert not state['auto_mode']['active']
    print("✓ Auto mode aborts when bankroll insufficient")


def main():
    """Run all tests"""
    print("=" * 50)
    print("Blackjack Backend Phase 1 Tests")
    print("=" * 50)
    print()
    
    try:
        test_card()
        test_deck()
        test_hand_value()
        test_blackjack()
        test_player()
        test_dealer()
        test_game()
        test_split_basic()
        test_split_aces()
        test_insurance_offer_and_payout()
        test_even_money()
        test_auto_mode_insufficient_start()
        test_auto_mode_runs_and_finishes_with_insurance()
        test_auto_mode_aborts_when_bankroll_drops()
        
        print()
        print("=" * 50)
        print("✓ All tests passed!")
        print("=" * 50)
        return 0
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())

