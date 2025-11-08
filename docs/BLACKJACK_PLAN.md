# Casino Blackjack Game - Development Plan

## 🎯 Project Overview
A web-based casino blackjack game built with Flask backend and modern frontend technologies. The game will feature realistic casino rules, smooth animations, and an engaging user experience.

---

## 🎮 Game Features

### Core Features
- **Standard Blackjack Rules**
  - Dealer must hit on 16, stand on 17
  - Blackjack (21) pays 3:2
  - Double down option
  - Split pairs option
  - Insurance side bet (optional)
  - Surrender option (optional)

- **Gameplay**
  - Single player vs dealer
  - Card dealing animations
  - Hand value calculation
  - Win/loss tracking
  - Betting system with chip denominations

- **UI/UX**
  - Casino-themed design (green felt table)
  - Card animations and transitions
  - Sound effects (optional)
  - Responsive design (mobile-friendly)
  - Chip betting interface
  - Game statistics display

### Advanced Features (Future Phases)
- Multi-hand play
- Side bets (Perfect Pairs, 21+3)
- Leaderboard/high scores
- Different game variants (Spanish 21, Pontoon)
- Chat system
- Multiplayer tables

---

## 🏗️ Architecture

### Technology Stack
- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla or consider Vue.js/React)
- **Card Rendering**: SVG or Canvas-based card system
- **Animations**: CSS3 transitions + JavaScript
- **State Management**: Client-side with periodic server sync

### File Structure
```
blackjack/
├── app.py                 # Flask application
├── game_logic.py          # Core game rules and logic
├── deck.py                # Card deck management
├── player.py              # Player class
├── dealer.py              # Dealer AI logic
├── templates/
│   ├── blackjack.html     # Main game page
│   └── layout.html        # Base template
├── static/
│   ├── css/
│   │   ├── blackjack.css  # Game styles
│   │   └── cards.css      # Card-specific styles
│   ├── js/
│   │   ├── blackjack.js   # Main game logic
│   │   ├── deck.js        # Card rendering
│   │   ├── ui.js          # UI interactions
│   │   └── animations.js  # Animation helpers
│   ├── images/
│   │   └── cards/         # Card images (if using images)
│   └── sounds/            # Sound effects (optional)
└── requirements.txt       # Python dependencies
```

---

## 📋 Implementation Phases

### Phase 1: Core Game Logic (Backend)
**Goal**: Implement the fundamental blackjack game mechanics

**Tasks**:
1. Create `deck.py` - Card and Deck classes
   - Card representation (suit, rank, value)
   - Deck initialization (52 cards)
   - Shuffle functionality
   - Card dealing

2. Create `game_logic.py` - Game state management
   - Game state (dealing, player turn, dealer turn, game over)
   - Hand evaluation (calculate hand value)
   - Blackjack detection
   - Win/loss determination
   - Betting logic

3. Create `player.py` - Player state
   - Current hand(s)
   - Total chips/money
   - Current bet
   - Hand history

4. Create `dealer.py` - Dealer AI
   - Dealer decision logic (hit/stand rules)
   - Card revealing logic

5. Flask routes:
   - `POST /api/new_game` - Start new game
   - `POST /api/deal` - Deal initial cards
   - `POST /api/hit` - Player hits
   - `POST /api/stand` - Player stands
   - `POST /api/double_down` - Player doubles down
   - `POST /api/split` - Player splits hand
   - `GET /api/game_state` - Get current game state

### Phase 2: Frontend - Card Rendering
**Goal**: Display cards visually with smooth animations

**Status**: ✅ Complete

**Timeline Estimate**: 2-3 days

**Dependencies**: 
- Phase 1 complete ✅
- Flask app structure in place ✅

**Summary**:
Phase 2 focuses on creating the visual card system that will display the game. This includes:
1. Card rendering system (CSS/HTML-based cards)
2. Animations (deal, flip, shuffle effects)
3. Card component classes for state management
4. Integration preparation for Phase 3

**Implementation Order**:
1. Start with card rendering (2.1) - Static cards first
2. Add animations (2.2) - Once cards render correctly
3. Build component classes (2.3) - Refactor rendering into reusable components
4. Test thoroughly (2.5) - Verify all cards and animations
5. Prepare integration (2.4) - Structure for Phase 3

**Tasks**:

#### 2.1 Card Rendering System
**Goal**: Create a scalable card rendering system using CSS/SVG

**Technical Approach**: 
- Use CSS-based cards with Unicode suit symbols (lightweight, no images needed)
- SVG suit icons as fallback for better visual quality
- CSS Grid/Flexbox for card layout
- Responsive card sizing

**Implementation Steps**:
1. **Design Card Component Structure**
   - Create `static/js/card.js` - Card class/component
   - Create `static/css/cards.css` - Card styling
   - Card element structure:
     ```html
     <div class="card">
       <div class="card-front">
         <div class="card-rank-top">A</div>
         <div class="card-suit">♠</div>
         <div class="card-rank-bottom">A</div>
       </div>
       <div class="card-back">
         <div class="card-back-pattern"></div>
       </div>
     </div>
     ```

2. **Card Visual Design**
   - Card dimensions: 70px × 100px (mobile: 60px × 85px)
   - Border radius: 8px
   - Shadow: subtle depth effect
   - Colors:
     - Red suits (hearts, diamonds): #dc3545
     - Black suits (clubs, spades): #212529
     - Card background: #ffffff
     - Card back: Casino-style pattern (diagonal stripes or logo)

3. **Card Rendering Functions**
   - `createCardElement(cardData, isHidden)` - Create DOM element
   - `renderCard(card, container, position)` - Render card to container
   - `renderCardBack(container, position)` - Render hidden card
   - `getCardHTML(card)` - Generate card HTML string

4. **Suit and Rank Display**
   - Unicode suit symbols: ♠ ♥ ♦ ♣
   - Rank display: A, 2-10, J, Q, K
   - Two-rank display (top-left, bottom-right)
   - Center suit symbol (larger size)

**Files to Create**:
- `web/static/js/card.js` - Card rendering logic
- `web/static/css/cards.css` - Card styles and animations

#### 2.2 Card Animations
**Goal**: Smooth, casino-like card animations

**Animation Types**:

1. **Deal Animation** (Card sliding from deck)
   - Start: Off-screen or deck position
   - End: Player/dealer hand position
   - Duration: 400-600ms
   - Easing: ease-out
   - Stagger: 100-150ms delay between cards

2. **Flip Animation** (Revealing hidden cards)
   - 3D flip effect using CSS transform
   - Duration: 500ms
   - Halfway point: Card back → Card front transition
   - Axis: Y-axis rotation (180deg)

3. **Shuffle Effect** (Visual feedback)
   - Deck shake animation
   - Duration: 300ms
   - Small rotation/translation
   - Triggered when new deck initialized

4. **Hit Animation** (New card dealt)
   - Slide from deck
   - Slight rotation for natural feel
   - Bounce effect on landing

5. **Win/Loss Animation** (Card highlight)
   - Winning hand: Subtle glow/pulse
   - Losing hand: Dim/fade effect
   - Duration: 1-2 seconds

**Implementation**:
- CSS keyframes for core animations
- JavaScript for timing and coordination
- RequestAnimationFrame for smooth 60fps animations
- CSS transitions for simple state changes

**Animation Utility Functions**:
- `animateDeal(cardElement, from, to)` - Deal animation
- `animateFlip(cardElement)` - Flip animation
- `animateShuffle(deckElement)` - Shuffle effect
- `animateWinHand(handElements)` - Win highlight
- `animateLossHand(handElements)` - Loss fade

**Files to Create**:
- `web/static/js/animations.js` - Animation utilities
- CSS animations in `web/static/css/cards.css`

#### 2.3 Card Component/Class
**Goal**: Reusable card component with state management

**Card Class Structure**:
```javascript
class Card {
  constructor(cardData, isHidden = false) {
    this.suit = cardData.suit;
    this.rank = cardData.rank;
    this.value = cardData.value;
    this.isHidden = isHidden;
    this.element = null;
    this.position = { x: 0, y: 0 };
    this.isRevealed = !isHidden;
  }
  
  render() { /* Create DOM element */ }
  reveal() { /* Flip card to show face */ }
  hide() { /* Flip card to show back */ }
  animateTo(x, y) { /* Animate card movement */ }
  flip() { /* Flip animation */ }
  destroy() { /* Remove from DOM */ }
}
```

**CardManager Class** (Handles multiple cards):
```javascript
class CardManager {
  constructor(container) {
    this.container = container;
    this.cards = [];
  }
  
  addCard(cardData, isHidden) { /* Add card */ }
  dealCard(cardData, isHidden, delay) { /* Deal with animation */ }
  revealCard(index) { /* Reveal specific card */ }
  revealAll() { /* Reveal all cards */ }
  clear() { /* Clear all cards */ }
  getHandElement() { /* Get container element */ }
}
```

**Hand Positioning**:
- Calculate card positions dynamically
- Overlap cards slightly (10-15px) for hand feel
- Responsive spacing based on container width
- Center cards in hand area

**State Management**:
- Track card visibility state
- Manage animation states (isAnimating flag)
- Handle multiple hands (player splits)

**Files to Create**:
- `web/static/js/card.js` - Card and CardManager classes

#### 2.4 Integration Points
**Goal**: Prepare for Phase 3 integration

**API Data Format**:
- Cards arrive as: `{suit: 'hearts', rank: 'A', value: 11}`
- Hidden cards: `{hidden: true}` or `null`
- Hand structure: `[{suit: '...', rank: '...'}, ...]`

**Event System**:
- Card events: `card-revealed`, `card-dealt`, `animation-complete`
- Hand events: `hand-updated`, `hand-cleared`
- Listen for game state changes from backend

**Placeholder Layout**:
- Create basic table structure (Phase 3 preview)
- Player area: `<div id="player-hand"></div>`
- Dealer area: `<div id="dealer-hand"></div>`
- Deck area: `<div id="deck"></div>` (for animation origin)

#### 2.5 Testing Strategy
**Goal**: Ensure cards render correctly

**Test Cases**:
1. ✅ Single card renders correctly
2. ✅ All 52 cards render with correct suits/ranks
3. ✅ Hidden card shows back
4. ✅ Card flip animation works
5. ✅ Deal animation works
6. ✅ Multiple cards in hand layout correctly
7. ✅ Responsive sizing on mobile
8. ✅ Animations don't overlap incorrectly
9. ✅ Cards clear properly
10. ✅ Card positioning is accurate

**Browser Testing**:
- Chrome/Edge (Chromium)
- Firefox
- Safari (iOS and macOS)
- Mobile browsers

**Performance Considerations**:
- Animation performance (60fps target)
- DOM manipulation efficiency
- Memory management (clean up removed cards)
- Avoid layout thrashing

---

**Phase 2 Deliverables**:
- [x] Card rendering system (`card.js`, `cards.css`)
- [x] Card animations (`animations.js`, CSS keyframes)
- [x] Card component class (`Card`, `CardManager`)
- [x] Test page showing all cards (`/cards-test` route)
- [x] Animation demos (included in test page)
- [x] Documentation/comments in code

**Quick Reference - Card Structure**:
```javascript
// Example usage
const card = new Card({suit: 'hearts', rank: 'A', value: 11}, false);
card.render(); // Creates DOM element
card.animateTo(100, 200); // Animate to position
card.reveal(); // Flip to show face

// CardManager example
const playerHand = new CardManager(document.getElementById('player-hand'));
playerHand.dealCard({suit: 'spades', rank: 'K', value: 10}, false, 0);
playerHand.dealCard({suit: 'hearts', rank: 'A', value: 11}, false, 150);
```

**Suit Symbol Mapping**:
- Hearts: ♥ (Unicode: U+2665)
- Diamonds: ♦ (Unicode: U+2666)
- Clubs: ♣ (Unicode: U+2663)
- Spades: ♠ (Unicode: U+2660)

**Card Color Rules**:
- Red suits: hearts, diamonds → Use red color (#dc3545)
- Black suits: clubs, spades → Use black color (#212529)

### Phase 3: Game UI
**Goal**: Build the game interface

**Tasks**:
1. Design casino table layout
   - Green felt background
   - Player area
   - Dealer area
   - Betting area
   - Chip tray

2. Create betting interface
   - Chip selection (1, 5, 10, 25, 100, 500)
   - Bet placement
   - Bet display
   - Clear bet button

3. Create game controls
   - Hit button
   - Stand button
   - Double Down button
   - Split button (when applicable)
   - New Game button

4. Display game information
   - Player hand value
   - Dealer hand value (hidden until reveal)
   - Player chips balance
   - Current bet amount
   - Win/loss message

### Phase 4: Game Flow Integration
**Goal**: Connect frontend and backend

**Tasks**:
1. Implement game state management
   - Sync backend state with frontend
   - Handle game phases (betting, playing, dealer turn)
   - Update UI based on game state

2. Implement API calls
   - AJAX/Fetch requests to Flask routes
   - Error handling
   - Loading states

3. Game flow logic
   - New game initialization
   - Dealing sequence
   - Player action handling
   - Dealer turn automation
   - Result display and payout

### Phase 5: Polish & Enhancements
**Goal**: Improve user experience

**Tasks**:
1. Visual polish
   - Smooth animations
   - Card dealing timing
   - Hover effects
   - Button states

2. Sound effects (optional)
   - Card deal sound
   - Chip click sound
   - Win/loss sounds
   - Background casino ambiance

3. Responsive design
   - Mobile optimization
   - Tablet layout
   - Touch-friendly controls

4. Game statistics
   - Win/loss record
   - Average bet
   - Total games played
   - Best streak

---

## 🎴 Card Representation

### Card Structure
```python
class Card:
    def __init__(self, suit, rank):
        self.suit = suit  # 'hearts', 'diamonds', 'clubs', 'spades'
        self.rank = rank  # 'A', '2', '3', ..., '10', 'J', 'Q', 'K'
        self.value = self._get_value()  # Numerical value for blackjack
    
    def _get_value(self):
        if self.rank in ['J', 'Q', 'K']:
            return 10
        elif self.rank == 'A':
            return 11  # Can be 1 or 11 (handled in hand evaluation)
        else:
            return int(self.rank)
```

### Hand Evaluation Logic
```python
def calculate_hand_value(cards):
    total = 0
    aces = 0
    
    for card in cards:
        if card.rank == 'A':
            aces += 1
            total += 11
        else:
            total += card.value
    
    # Adjust for aces
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    
    return total
```

---

## 🎨 UI Design Mockup

### Layout Structure
```
┌─────────────────────────────────────────┐
│           CASINO BLACKJACK               │
├─────────────────────────────────────────┤
│                                          │
│         DEALER AREA                      │
│         [Hidden Card] [Visible Card]     │
│         Dealer Value: ?                  │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│         PLAYER AREA                      │
│         [Card] [Card] [Card]             │
│         Player Value: 18                 │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│      CHIPS: [1] [5] [10] [25] [100]     │
│      BET: $25                            │
│                                          │
├─────────────────────────────────────────┤
│   [New Game] [Deal] [Hit] [Stand] [DD]  │
│                                          │
│   Balance: $1,000                        │
│   This Session: +$75                     │
└─────────────────────────────────────────┘
```

### Color Scheme
- **Table**: Dark green (#0f5132 or #1a5f3f)
- **Cards**: White background, black/red suits
- **Background**: Dark casino theme (#1a1a1a)
- **Buttons**: Gold/yellow accents (#ffd700)
- **Text**: White/cream (#f5f5dc)

---

## 🎲 Game Rules Implementation

### Standard Blackjack Rules
1. **Objective**: Get closer to 21 than dealer without going over
2. **Card Values**:
   - Number cards: Face value
   - Face cards (J, Q, K): 10
   - Ace: 1 or 11 (whichever is better)
3. **Dealer Rules**:
   - Must hit on 16 or less
   - Must stand on 17 or more
   - Dealer's first card is hidden until player's turn ends
4. **Player Options**:
   - **Hit**: Take another card
   - **Stand**: Keep current hand
   - **Double Down**: Double bet, take exactly one card
   - **Split**: Split pair into two hands (if applicable)
5. **Payouts**:
   - Win: 1:1 (bet back + win)
   - Blackjack (21 with 2 cards): 3:2
   - Push (tie): Bet returned
   - Loss: Bet forfeited

---

## 🔧 Technical Considerations

### Backend API Design
```python
# Example API structure
{
    "game_id": "unique_id",
    "state": "betting" | "playing" | "dealer_turn" | "game_over",
    "player": {
        "chips": 1000,
        "hand": [{"suit": "hearts", "rank": "A"}, ...],
        "hand_value": 21,
        "bet": 25,
        "can_double": true,
        "can_split": false
    },
    "dealer": {
        "hand": [{"suit": "spades", "rank": "K"}, ...],
        "hand_value": 20,
        "visible_card": true  # First card visible
    },
    "result": null | "win" | "loss" | "push" | "blackjack"
}
```

### Frontend State Management
- Use a game state object to track current game
- Update UI reactively based on state changes
- Handle async API calls properly
- Implement proper error handling

### Card Animation Strategy
- Use CSS transforms for card movement
- JavaScript animations for timing
- RequestAnimationFrame for smooth animations
- CSS transitions for card flips

---

## 🚀 Getting Started Checklist

### Setup
- [ ] Create new Flask route for blackjack game
- [ ] Set up game routes and templates
- [ ] Create static file structure
- [ ] Initialize git branch (if using version control)

### Backend Development
- [ ] Implement Card class
- [ ] Implement Deck class with shuffle
- [ ] Implement Hand evaluation logic
- [ ] Create Game class to manage state
- [ ] Implement dealer logic
- [ ] Create Flask API endpoints
- [ ] Add error handling and validation

### Frontend Development
- [ ] Design card rendering system
- [ ] Create card CSS/styles
- [ ] Build game table layout
- [ ] Implement betting interface
- [ ] Create game control buttons
- [ ] Add card animations
- [ ] Connect API calls
- [ ] Implement game flow

### Testing
- [ ] Test game logic (backend)
- [ ] Test card dealing
- [ ] Test all player actions
- [ ] Test edge cases (blackjack, bust, etc.)
- [ ] Test UI responsiveness
- [ ] Test on different browsers
- [ ] Test mobile compatibility

### Polish
- [ ] Add sound effects (optional)
- [ ] Improve animations
- [ ] Add loading states
- [ ] Add error messages
- [ ] Add game statistics
- [ ] Optimize performance

---

## 📚 Resources & References

### Blackjack Rules
- Standard casino blackjack rules
- Consider variations for future expansion

### Design Inspiration
- Real casino blackjack tables
- Online casino games
- Card game UI patterns

### Technologies
- Flask documentation
- CSS3 animations
- JavaScript ES6+
- SVG/Canvas for graphics

---

## 🎯 Success Criteria

### MVP (Minimum Viable Product)
- ✅ Full game can be played end-to-end
- ✅ All basic actions work (hit, stand, double down)
- ✅ Correct win/loss logic
- ✅ Betting system functional
- ✅ Cards display correctly
- ✅ Game is playable and fun

### Full Release
- ✅ Polished UI with smooth animations
- ✅ Mobile responsive
- ✅ Sound effects (optional)
- ✅ Game statistics tracking
- ✅ Error handling and edge cases covered
- ✅ Performance optimized

---

## 🔄 Future Enhancements

- Multiple game variants
- Multi-hand play
- Side bets
- Leaderboards
- User accounts/sessions
- Tournament mode
- Chat functionality
- Progressive jackpots
- Card counting practice mode

---

**Ready to start building? Begin with Phase 1: Core Game Logic!**

### Pending Feature: Auto Mode

**Goal**: Allow players to autoplay a set number of rounds using their configured default bet.

**User Choices**
- Default bet amount (use existing default bet UI, but prompt if not set)
- Number of hands to autoplay (e.g., 5/10/25)
- Insurance preference during auto mode:
  - Always take insurance
  - Never take insurance
  - Follow existing manual behaviour (skip if not selected)
- Abort behaviour: if bankroll drops below default bet before completing the requested hands, stop autoplay, show message “Auto mode stopped: insufficient bankroll”, return to manual control.

**Backend Plan**
1. Extend `BlackjackGame` with auto mode state:
   - `auto_mode_active: bool`
   - `auto_hands_remaining: int`
   - `auto_default_bet: int`
   - `auto_insurance_mode: Literal['always','never']`
2. Add API endpoints:
   - `POST /api/auto_mode/start` -> validate bankroll ≥ default bet, set state, return updated game state.
   - `POST /api/auto_mode/stop` -> allow user to cancel.
3. Game loop adjustments:
   - After each round (in `_determine_results` or when game reaches GAME_OVER), if `auto_mode_active` and hands remaining > 0, automatically:
     - Place bet (`auto_default_bet`), bail out if bankroll < bet → stop auto mode and return message.
     - Deal cards, auto-play using existing logic: hit/stand via basic strategy? (Simplify: stand immediately after initial deal; configurable?)
       - For MVP: stand immediately (player not interacting) to keep flow predictable.
     - Insurance: follow preference (auto call `insurance_decision('buy')` or `'decline'`).
     - Decrement hands remaining.
     - When hands remaining reaches 0, stop auto mode and notify.
4. Game state response should include auto mode status (`auto_mode_active`, `auto_hands_remaining`).

**Frontend Plan**
1. UI additions near default bet section:
   - “Start Auto Mode” button opening a modal/panel to choose:
     - Default bet amount field (prefill with current default bet; warn if missing)
     - Number of hands (dropdown or input)
     - Insurance preference (always / never)
   - Display auto mode status banner (“Auto mode running – hands left: X”) with Stop button.
2. While auto mode active:
   - Disable manual controls (bet chips, action buttons) except “Stop Auto Mode”.
   - Automatically show progress in history/status.
   - Show toast/message when auto mode finishes or aborts.
3. Handle backend responses:
   - On insufficient bankroll => display modal “Auto mode stopped: insufficient bankroll after N hands”.
   - On manual stop => confirm and reset state.

**Tests**
- Backend unit tests: start/stop flow, insufficient funds abort, insurance preference respected.
- Frontend integration tests (if applicable): ensure UI transitions, disable controls, auto cycle.

