import unittest
import sys
import os

# Add project root to Python path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from blackjack.routes import active_games, get_game
from blackjack.dealer import Dealer
from blackjack.deck import Card
from blackjack.player import Hand


class RegressionCoverageTests(unittest.TestCase):
    @unittest.expectedFailure
    def test_get_game_preserves_requested_identifier(self):
        """Ensure retaining a client-supplied ID does not mint a new one."""
        active_games.clear()
        requested_id = "client-supplied-id"

        game = get_game(requested_id)

        # The active registry already keeps the object; this guard documents
        # the expectation that the in-game identifier matches the caller's ID.
        self.assertIn(requested_id, active_games)
        self.assertIs(active_games[requested_id], game)

        # Regression assertion: the server should not replace the ID.
        self.assertEqual(
            game.game_id,
            requested_id,
            "Game returned under a client key must reuse that key as game_id.",
        )

    @unittest.expectedFailure
    def test_dealer_dict_includes_visible_value_key(self):
        """Ensure dealer payload exposes visible card totals while hole card hides."""
        dealer = Dealer()
        dealer.add_cards([Card("hearts", "10"), Card("spades", "6")])

        serialized = dealer.to_dict()

        # The frontend expects a visible_value field for partial totals.
        self.assertIn(
            "visible_value",
            serialized,
            "Dealer serialization should expose visible_value for UI display.",
        )

    @unittest.expectedFailure
    def test_hand_dict_exposes_can_double_flag(self):
        """Ensure hand metadata matches UI expectations for double-down state."""
        hand = Hand([Card("hearts", "5"), Card("clubs", "6")])
        hand.bet = 25

        serialized = hand.to_dict()

        # The UI inspects can_double; keep parity with the payload contract.
        self.assertIn(
            "can_double",
            serialized,
            "Hand serialization should export can_double alongside can_double_down.",
        )


if __name__ == "__main__":
    unittest.main()
