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

