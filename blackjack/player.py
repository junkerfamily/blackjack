"""
Player class for Blackjack game
"""

from typing import List, Optional
from blackjack.deck import Card, calculate_hand_value, is_blackjack, is_bust, can_split


class Hand:
    """Represents a player's hand"""
    
    def __init__(self, cards: Optional[List[Card]] = None):
        """Initialize a hand with optional cards"""
        self.cards: List[Card] = cards or []
        self.bet: int = 0
        self.is_doubled_down: bool = False
        self.is_split: bool = False
        self.is_surrendered: bool = False
        self.is_from_split_aces: bool = False
    
    def add_card(self, card: Card):
        """Add a card to the hand"""
        self.cards.append(card)
    
    def add_cards(self, cards: List[Card]):
        """Add multiple cards to the hand"""
        self.cards.extend(cards)
    
    def get_value(self) -> int:
        """Get the current hand value"""
        return calculate_hand_value(self.cards)
    
    def is_blackjack(self) -> bool:
        """Check if hand is blackjack"""
        return is_blackjack(self.cards)
    
    def is_bust(self) -> bool:
        """Check if hand is bust"""
        return is_bust(self.cards)
    
    def can_double_down(self) -> bool:
        """Check if hand can be doubled down (exactly 2 cards, not doubled, not from split aces)"""
        return len(self.cards) == 2 and not self.is_doubled_down and not self.is_from_split_aces
    
    def can_split(self) -> bool:
        """Check if hand can be split"""
        return can_split(self.cards) and not self.is_split
    
    def double_down(self):
        """Mark hand as doubled down"""
        if not self.can_double_down():
            raise ValueError("Cannot double down this hand")
        self.is_doubled_down = True
        self.bet *= 2
    
    def clear(self):
        """Clear the hand"""
        self.cards = []
        self.bet = 0
        self.is_doubled_down = False
        self.is_split = False
        self.is_surrendered = False
        self.is_from_split_aces = False
    
    def to_dict(self) -> dict:
        """Convert hand to dictionary for JSON serialization"""
        return {
            'cards': [card.to_dict() for card in self.cards],
            'value': self.get_value(),
            'bet': self.bet,
            'is_blackjack': self.is_blackjack(),
            'is_bust': self.is_bust(),
            'is_doubled_down': self.is_doubled_down,
            'is_split': self.is_split,
            'is_from_split_aces': self.is_from_split_aces,
            'is_surrendered': self.is_surrendered,
            'can_double_down': self.can_double_down(),
            'can_split': self.can_split()
        }


class Player:
    """Represents a player in the blackjack game"""
    
    def __init__(self, starting_chips: int = 1000):
        """Initialize a player with starting chips"""
        self.chips: int = starting_chips
        self.hands: List[Hand] = []
        self.current_hand_index: int = 0
        self.total_wins: int = 0
        self.total_losses: int = 0
        self.total_blackjacks: int = 0
    
    def get_current_hand(self) -> Optional[Hand]:
        """Get the current active hand"""
        if self.hands and 0 <= self.current_hand_index < len(self.hands):
            return self.hands[self.current_hand_index]
        return None
    
    def create_new_hand(self):
        """Create a new hand"""
        self.hands = [Hand()]
        self.current_hand_index = 0
    
    def add_hand(self, hand: Hand):
        """Add a hand to the player's hands"""
        self.hands.append(hand)
    
    def place_bet(self, amount: int, hand_index: int = 0) -> bool:
        """
        Place a bet on a hand.
        
        Args:
            amount: Bet amount
            hand_index: Index of hand to bet on
            
        Returns:
            True if bet placed successfully, False otherwise
        """
        if amount <= 0:
            return False
        
        if self.chips < amount:
            return False
        
        if hand_index >= len(self.hands):
            return False
        
        self.hands[hand_index].bet = amount
        print(f"💵 Placing bet: ${amount}, chips before=${self.chips}, chips after=${self.chips - amount}")
        self.chips -= amount
        return True
    
    def split_hand(self, hand_index: int = 0) -> bool:
        """
        Split a hand into two hands.
        
        Args:
            hand_index: Index of hand to split
            
        Returns:
            True if split successful, False otherwise
        """
        if hand_index >= len(self.hands):
            return False
        
        hand = self.hands[hand_index]
        
        if not hand.can_split():
            return False
        
        if self.chips < hand.bet:
            return False  # Need chips to match the bet
        
        # Create new hand with second card
        new_hand = Hand([hand.cards.pop()])
        new_hand.bet = hand.bet
        new_hand.is_split = True
        hand.is_split = True
        if (hand.cards and hand.cards[0].rank == 'A') or (new_hand.cards and new_hand.cards[0].rank == 'A'):
            hand.is_from_split_aces = True
            new_hand.is_from_split_aces = True
        
        # Place bet on new hand
        self.chips -= hand.bet
        
        # Add new hand
        self.hands.insert(hand_index + 1, new_hand)
        
        return True
    
    def win(self, hand_index: int = 0, is_blackjack: bool = False):
        """Process a win for a hand"""
        if hand_index >= len(self.hands):
            print(f"❌ ERROR: win() called with invalid hand_index={hand_index}, only {len(self.hands)} hands exist!")
            import sys
            sys.stdout.flush()
            return
        
        hand = self.hands[hand_index]
        
        if is_blackjack and hand.is_blackjack():
            # Blackjack pays 3:2 (bet * 1.5 = 150% of bet)
            # Bet was already deducted, so we return bet back + 1.5x bet = bet * 2.5 total
            payout = int(hand.bet * 2.5)
            self.total_blackjacks += 1
        else:
            # Regular win pays 1:1
            # Bet was already deducted, so we return bet back + winnings = bet * 2
            payout = hand.bet * 2
        
        chips_before = self.chips
        self.chips += payout
        
        # Force flush to ensure logs appear immediately
        import sys
        print(f"💰 Win payout: hand_index={hand_index}, bet=${hand.bet}, is_blackjack={is_blackjack}, payout=${payout}, chips before=${chips_before}, chips after=${self.chips}")
        sys.stdout.flush()
        
        self.total_wins += 1
    
    def lose(self, hand_index: int = 0):
        """Process a loss for a hand"""
        hand = self.hands[hand_index] if hand_index < len(self.hands) else None
        chips_before = self.chips
        print(f"💸 Loss: hand_index={hand_index}, bet=${hand.bet if hand else 0}, chips before=${chips_before}, chips after=${self.chips} (bet already deducted)")
        self.total_losses += 1
        # Bet is already deducted, no need to do anything
    
    def push(self, hand_index: int = 0):
        """Process a push (tie) for a hand"""
        hand = self.hands[hand_index] if hand_index < len(self.hands) else None
        chips_before = self.chips
        if hand:
            self.chips += hand.bet
            print(f"🤝 Push: hand_index={hand_index}, bet=${hand.bet}, chips before=${chips_before}, chips after=${self.chips} (bet returned)")
        else:
            print(f"⚠️ Push called but no hand at index {hand_index}")
    
    def clear_hands(self):
        """Clear all hands"""
        self.hands = []
        self.current_hand_index = 0
    
    def get_stats(self) -> dict:
        """Get player statistics"""
        return {
            'chips': self.chips,
            'total_wins': self.total_wins,
            'total_losses': self.total_losses,
            'total_blackjacks': self.total_blackjacks,
            'total_games': self.total_wins + self.total_losses
        }
    
    def to_dict(self) -> dict:
        """Convert player to dictionary for JSON serialization"""
        return {
            'chips': self.chips,
            'hands': [hand.to_dict() for hand in self.hands],
            'current_hand_index': self.current_hand_index,
            'stats': self.get_stats()
        }

