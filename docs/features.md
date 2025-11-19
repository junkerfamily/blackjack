# Blackjack Game Features

## Game Mechanics
- Standard casino blackjack rules with 6-deck shoe (312 cards)
- Automatic reshuffle when deck drops below 156 cards (3 decks)
- Hit, Stand, Double Down, Split, and Surrender actions
- Late Surrender: Forfeit hand before taking any actions and recover 50% of bet
- Surrender only available on first action (exactly 2 cards, no actions taken)
- Split pairs up to 4 hands maximum
- Split Aces receive only one card per hand (no hit/double)
- Insurance side bet (pays 2:1 when dealer has blackjack)
- Even Money option - When player has blackjack and dealer shows Ace, player can take Even Money (1:1 payout) to guarantee a win, or decline to risk a push but potentially win 3:2
- 5 Card Charlie rule (automatic win with 5 cards without busting)
- Blackjack pays 3:2
- Dealer must hit on 16 or less, stand on 17 or more
- Dealer Hits Soft 17 option (configurable - dealer can hit on Ace-6)
- Push (tie) returns bet
- Ace value automatically adjusts (1 or 11)

## Betting & Bankroll
- Chip betting interface ($1, $5, $10, $25, $100, $500)
- Customizable starting bankroll (up to $1,000,000)
- Bankroll refresh option
- Bet amount display and clear bet button
- Balance tracking with win/loss amounts displayed
- Table min/max bet limits (configurable, default $5-$500)
- Dynamic chip button enabling/disabling based on limits and balance

## User Interface
- Casino-themed green felt table design
- Animated card dealing and flipping
- Real-time hand value display
- Game history panel (last 5 rounds)
- Rules panel with basic, advanced, shortcuts, and casino info pages
- Settings panel (Config) for voice, bankroll, dealer delay, and dealer rules
- Keyboard shortcuts (D=Deal, H=Hit, S=Stand, R=Surrender, I=Insurance/Even Money, 1=$100 bet, 5=$500 bet)
- Responsive design for mobile and desktop
- Loading overlays and status messages
- Blackjack celebration animation
- Shoe cut card display showing remaining cards and reshuffle warning
- Table sign display at bottom showing casino rules (Blackjack pays 3:2, dealer rules, table limits)
- Table sign with marquee scrolling for long content

## Voice Commentary
- Optional voice commentary ("heckler") with speech synthesis
- Multiple voice options
- Adjustable speech rate
- Voice test feature
- Context-aware phrases for bad plays
- Heckler comments when hitting on hard 17+
- Heckler comments when hitting against dealer bust cards (2-6)
- Heckler comments when hitting on soft 19+
- Heckler comments when standing with 11 or less

## Auto Mode
- Automated gameplay with configurable bet amount
- Set number of hands to play
- Insurance preference (always/never)
- Automatic strategy (hits until >16 against high dealer cards, stands against 2-6)
- Auto mode logging with downloadable log files
- Status display with hands remaining

## Hand Logging
- Log individual hands to LogHand.log file
- One log entry per hand (prevents duplicates)
- Logs include: beginning balance, bet amount, initial cards, insurance info, hit cards, final hands, result, final balance
- Newest entries appear at top of log file
- Download log file from Config section
- Clear log file option
- Log Hand button appears after each completed round

## Game Results & Display
- Win/loss amounts shown in result messages
- Insurance payouts displayed in green when applicable
- Multi-colored messages (red for loss, green for insurance wins)
- Split hand summaries
- Round result tracking (win, loss, push, blackjack)

## Technical Features
- Flask backend with RESTful API
- Round auditing system for complete game tracking
- Persistent game state across rounds
- Client-side state management with server sync
- CSS-based card rendering (no images required)
- Vanilla JavaScript (no external dependencies)

