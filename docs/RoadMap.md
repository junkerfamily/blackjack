# Blackjack Game Roadmap

## Priority Guide
- **1** = Must Have (Critical features for core gameplay)
- **2** = High Priority (Important casino authenticity)
- **3** = Medium Priority (Nice to have, improves experience)
- **4** = Low Priority (Enhancement features)
- **5** = Ya-Maybe (Future consideration, low impact)

---

## Core Casino Rules

### In Game ✅
- **Insurance** - Payout 2:1 when dealer has blackjack
- **Even Money Option** - Offer even money when player has blackjack vs dealer Ace
- **Split Aces One Card Rule** - Restrict to one card per split Ace
- **Re-Split Limit (4 Hands Max)** - Allow up to 4 split hands
- **Double After Split (DAS)** - Permit double down after splits
- **Surrender (Late)** - Forfeit hand before taking any actions and recover 50% of bet
- **Table Min/Max Limits** - Displayed on table sign and enforced in betting logic
- **Dealer Hits Soft 17 Toggle** - Configurable rule (H17 vs S17) available in settings panel

### To Add

| Feature | Complexity | Priority | Notes |
|---------|-----------|----------|-------|
| **Cut Card Penetration Simulation** | Medium | 3 | Trigger reshuffle when cut card reached - already have reshuffle logic |
| **Multiple Player Hands (3 Seats)** | High | 4 | Allow player to play multiple hands per round - major feature |

> _Note:_ Rebet / repeat bet UI is unnecessary—the app already remembers and reuses the most recent wager automatically.

---

## Optional Casino Variants

| Feature | Complexity | Priority | Notes |
|---------|-----------|----------|-------|
| **Side Bets (Perfect Pairs, 21+3)** | High | 4 | Add popular side bets with correct payouts - new betting system required |
| **Shoe Cut Card Display** | Low | 4 | Visually show cut card before reshuffle - visual enhancement |
| **Table Sign Display** | Low | 4 | Show casino signage with rules (e.g., Blackjack pays 3:2) - visual element |
| **Burn Card After Shuffle** | Low | 5 | Burn one card after shuffle - minor rule, low impact |

### Completed Optional Variants
- **Dealer Peek Animation** – Implemented with standalone demo sandbox and integrated lift/glow effect (Nov 2025)

---

## Realism Enhancements

| Feature | Complexity | Priority | Notes |
|---------|-----------|----------|-------|
| **Chip Color & Stacks** | Medium | 5 | Use casino chip colors and stack visuals - visual polish |
| **Dealer Personality Voice** | Low | 5 | Use realistic dealer dialogue only - already have voice system |
| **Multi-Table Rule Selection** | High | 5 | Offer tables with different rule sets - major architectural change |
| **Dealer Tip Option** | Medium | 5 | Simulate tipping dealer for immersion - new system |
| **Bet Behind Feature** | High | 5 | Allow betting behind other hands - complex betting system |

---

## Summary by Priority

### Priority 1 (Must Have)
*None - all critical features are already implemented*

### Priority 2 (High Priority)
-*None - currently no outstanding items*

### Priority 3 (Medium Priority)
- Cut Card Penetration Simulation

### Priority 4 (Low Priority)
- Multiple Player Hands (3 Seats)
- Side Bets (Perfect Pairs, 21+3)
- Shoe Cut Card Display
- Table Sign Display

### Priority 5 (Ya-Maybe)
- Burn Card After Shuffle
- Chip Color & Stacks
- Dealer Personality Voice
- Multi-Table Rule Selection
- Dealer Tip Option
- Bet Behind Feature

---

## Implementation Order Recommendation

1. **Cut Card Penetration Simulation** (Priority 3, Medium Complexity) - Enhance existing reshuffle
2. **Shoe Cut Card Display** (Priority 4, Low Complexity) - Visual polish
3. **Table Sign Display** (Priority 4, Low Complexity) - Visual enhancement
4. **Multiple Player Hands** (Priority 4, High Complexity) - Major feature
5. **Side Bets** (Priority 4, High Complexity) - Complex betting system
6. **Future Considerations** (Priority 5) - All optional enhancements


