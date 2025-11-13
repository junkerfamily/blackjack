"""
Dealer class for Blackjack game
"""

from typing import List, Optional
from blackjack.deck import Card, calculate_hand_value, is_blackjack, is_bust, is_soft_17


class Dealer:
    """Represents the dealer in the blackjack game"""
    
    def __init__(self):
        """Initialize the dealer"""
        self.hand: List[Card] = []
        self.hole_card_hidden: bool = True  # First card is hidden until player's turn ends
    
    def add_card(self, card: Card):
        """Add a card to the dealer's hand"""
        self.hand.append(card)
    
    def add_cards(self, cards: List[Card]):
        """Add multiple cards to the dealer's hand"""
        self.hand.extend(cards)
    
    def get_value(self) -> int:
        """Get the current hand value"""
        return calculate_hand_value(self.hand)
    
    def get_visible_value(self) -> Optional[int]:
        """Get the value of visible cards only (excluding hole card)"""
        if not self.hand:
            return None
        
        if self.hole_card_hidden and len(self.hand) > 0:
            # Return value of visible cards (all except first)
            visible_cards = self.hand[1:]
            if visible_cards:
                return calculate_hand_value(visible_cards)
            return None
        
        return self.get_value()
    
    def is_blackjack(self) -> bool:
        """Check if dealer has blackjack"""
        return is_blackjack(self.hand)
    
    def is_bust(self) -> bool:
        """Check if dealer is bust"""
        return is_bust(self.hand)
    
    def should_hit(self, hits_soft_17: bool = False) -> bool:
        """
        Determine if dealer should hit based on standard rules.
        Dealer must hit on 16 or less, stand on 17 or more.
        If hits_soft_17 is True, dealer will also hit on soft 17.
        
        Args:
            hits_soft_17: If True, dealer hits on soft 17 (Ace + 6)
        
        Returns:
            True if dealer should hit, False if should stand
        """
        value = self.get_value()
        if value < 17:
            return True
        
        # If value is 17, check if it's soft 17 and if we should hit
        if value == 17 and hits_soft_17 and is_soft_17(self.hand):
            return True
        
        return False
    
    def reveal_hole_card(self):
        """Reveal the hole card"""
        self.hole_card_hidden = False
    
    def play_hand(self, deck, hits_soft_17: bool = False):
        """
        Play dealer's hand automatically according to rules.
        Dealer must hit on 16 or less, stand on 17 or more.
        If hits_soft_17 is True, dealer will also hit on soft 17.
        
        Args:
            deck: Deck to draw cards from
            hits_soft_17: If True, dealer hits on soft 17 (Ace + 6)
        """
        self.reveal_hole_card()
        
        while self.should_hit(hits_soft_17):
            card = deck.deal_card()
            if card:
                self.add_card(card)
            else:
                break  # No more cards
    
    def clear_hand(self):
        """Clear the dealer's hand"""
        self.hand = []
        self.hole_card_hidden = True
    
    def get_visible_cards(self) -> List[Card]:
        """Get only the visible cards (excluding hole card if hidden)"""
        if self.hole_card_hidden and len(self.hand) > 1:
            return self.hand[1:]
        return self.hand.copy()
    
    def to_dict(self) -> dict:
        """Convert dealer to dictionary for JSON serialization"""
        return {
            'hand': [card.to_dict() for card in self.get_visible_cards()],
            'full_hand': [card.to_dict() for card in self.hand],  # Always return full hand for rendering
            'value': self.get_visible_value(),
            'full_value': self.get_value() if not self.hole_card_hidden else None,
            'is_blackjack': self.is_blackjack() if not self.hole_card_hidden else False,
            'is_bust': self.is_bust() if not self.hole_card_hidden else False,
            'hole_card_hidden': self.hole_card_hidden
        }

