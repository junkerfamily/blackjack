"""
Card and Deck classes for Blackjack game
"""

import random
from typing import List, Optional


class Card:
    """Represents a playing card"""
    
    SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
    RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    
    def __init__(self, suit: str, rank: str):
        """Initialize a card with suit and rank"""
        if suit not in self.SUITS:
            raise ValueError(f"Invalid suit: {suit}")
        if rank not in self.RANKS:
            raise ValueError(f"Invalid rank: {rank}")
        
        self.suit = suit
        self.rank = rank
        self._value = self._calculate_value()
    
    def _calculate_value(self) -> int:
        """Calculate the base value of the card"""
        if self.rank in ['J', 'Q', 'K']:
            return 10
        elif self.rank == 'A':
            return 11  # Ace can be 1 or 11, handled in hand evaluation
        else:
            return int(self.rank)
    
    @property
    def value(self) -> int:
        """Get the card's base value"""
        return self._value
    
    def is_ace(self) -> bool:
        """Check if card is an Ace"""
        return self.rank == 'A'
    
    def is_face_card(self) -> bool:
        """Check if card is a face card (J, Q, K)"""
        return self.rank in ['J', 'Q', 'K']
    
    def is_ten_value(self) -> bool:
        """Check if card has value of 10"""
        return self.value == 10
    
    def to_dict(self) -> dict:
        """Convert card to dictionary for JSON serialization"""
        return {
            'suit': self.suit,
            'rank': self.rank,
            'value': self._value
        }
    
    def __str__(self) -> str:
        """String representation with Unicode suit symbols."""
        suit_symbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        }
        suit_symbol = suit_symbols.get(self.suit, self.suit)
        return f"{self.rank}{suit_symbol}"
    
    def __repr__(self) -> str:
        return f"Card({self.suit}, {self.rank})"
    
    def __eq__(self, other) -> bool:
        """Two cards are equal if they have same suit and rank"""
        if not isinstance(other, Card):
            return False
        return self.suit == other.suit and self.rank == other.rank


class Deck:
    """Represents a deck of 52 playing cards"""
    
    def __init__(self, num_decks: int = 1):
        """Initialize a deck with one or more standard 52-card decks"""
        self.cards: List[Card] = []
        self.num_decks = num_decks
        self._build_deck()
    
    def _build_deck(self):
        """Build a standard 52-card deck"""
        self.cards = []
        for _ in range(self.num_decks):
            for suit in Card.SUITS:
                for rank in Card.RANKS:
                    self.cards.append(Card(suit, rank))
    
    def shuffle(self):
        """Shuffle the deck"""
        random.shuffle(self.cards)
    
    def deal_card(self) -> Optional[Card]:
        """Deal one card from the deck"""
        if len(self.cards) == 0:
            return None
        return self.cards.pop()
    
    def deal_cards(self, num_cards: int) -> List[Card]:
        """Deal multiple cards from the deck"""
        cards = []
        for _ in range(num_cards):
            card = self.deal_card()
            if card:
                cards.append(card)
        return cards
    
    def reset(self):
        """Reset the deck by rebuilding and shuffling"""
        self._build_deck()
        self.shuffle()
    
    def remaining_cards(self) -> int:
        """Get the number of remaining cards in the deck"""
        return len(self.cards)
    
    def __len__(self) -> int:
        """Get the number of remaining cards"""
        return len(self.cards)
    
    def __repr__(self) -> str:
        return f"Deck({self.remaining_cards()} cards remaining)"


def calculate_hand_value(cards: List[Card]) -> int:
    """
    Calculate the value of a hand in blackjack.
    Handles Ace as 1 or 11 appropriately.
    
    Args:
        cards: List of Card objects
        
    Returns:
        Total hand value (with Aces optimized)
    """
    total = 0
    aces = 0
    
    # First pass: count all cards
    for card in cards:
        if card.is_ace():
            aces += 1
            total += 11  # Start with Ace as 11
        else:
            total += card.value
    
    # Adjust for aces if we're over 21
    while total > 21 and aces > 0:
        total -= 10  # Convert an Ace from 11 to 1
        aces -= 1
    
    return total


def is_blackjack(cards: List[Card]) -> bool:
    """
    Check if a hand is a blackjack (21 with exactly 2 cards).
    
    Args:
        cards: List of Card objects
    
    Returns:
        True if blackjack, False otherwise
    """
    return len(cards) == 2 and calculate_hand_value(cards) == 21


def is_soft_17(cards: List[Card]) -> bool:
    """
    Check if a hand is a soft 17 (Ace + 6, where Ace counts as 11, total = 17).
    
    Args:
        cards: List of Card objects
    
    Returns:
        True if soft 17, False otherwise
    """
    if calculate_hand_value(cards) != 17:
        return False
    
    # Check if there's an Ace that's being counted as 11
    # A soft 17 means we have an Ace counted as 11, so if we subtract 10 we'd get 7
    total_with_ace_as_11 = 0
    aces = 0
    
    for card in cards:
        if card.is_ace():
            aces += 1
            total_with_ace_as_11 += 11
        else:
            total_with_ace_as_11 += card.value
    
    # If we have an Ace and total is 17, check if subtracting 10 would make it 7
    # This means the Ace is being counted as 11 (soft 17)
    if aces > 0 and total_with_ace_as_11 == 17:
        return True
    
    return False


def is_bust(cards: List[Card]) -> bool:
    """
    Check if a hand is a bust (over 21).
    
    Args:
        cards: List of Card objects
        
    Returns:
        True if bust, False otherwise
    """
    return calculate_hand_value(cards) > 21


def can_split(cards: List[Card]) -> bool:
    """
    Check if a hand can be split (two cards of same rank).
    
    Args:
        cards: List of Card objects
        
    Returns:
        True if can split, False otherwise
    """
    return len(cards) == 2 and cards[0].rank == cards[1].rank

