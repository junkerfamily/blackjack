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

### To Add

| Feature | Complexity | Priority | Notes |
|---------|-----------|----------|-------|
| **Table Min/Max Limits** | Low | 2 | Display and enforce realistic casino table limits - essential for realism |
| **Dealer Hits Soft 17 Option** | Low | 3 | Toggle rule between S17 and H17 - simple config option |
| **Rebet / Repeat Bet Button** | Low | 3 | Allow rebetting last wager easily - UX improvement |
| **Cut Card Penetration Simulation** | Medium | 3 | Trigger reshuffle when cut card reached - already have reshuffle logic |
| **Multiple Player Hands (3 Seats)** | High | 4 | Allow player to play multiple hands per round - major feature |

---

## Optional Casino Variants

| Feature | Complexity | Priority | Notes |
|---------|-----------|----------|-------|
| **Side Bets (Perfect Pairs, 21+3)** | High | 4 | Add popular side bets with correct payouts - new betting system required |
| **Dealer Peek Animation** | Medium | 4 | Add authentic dealer peek for Ace or 10 upcard - animation work |
| **Shoe Cut Card Display** | Low | 4 | Visually show cut card before reshuffle - visual enhancement |
| **Table Sign Display** | Low | 4 | Show casino signage with rules (e.g., Blackjack pays 3:2) - visual element |
| **Burn Card After Shuffle** | Low | 5 | Burn one card after shuffle - minor rule, low impact |

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
- Table Min/Max Limits

### Priority 3 (Medium Priority)
- Dealer Hits Soft 17 Option
- Rebet / Repeat Bet Button
- Cut Card Penetration Simulation

### Priority 4 (Low Priority)
- Multiple Player Hands (3 Seats)
- Side Bets (Perfect Pairs, 21+3)
- Dealer Peek Animation
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

1. **Table Min/Max Limits** (Priority 2, Low Complexity) - Quick win for authenticity
2. **Rebet / Repeat Bet Button** (Priority 3, Low Complexity) - Easy UX improvement
3. **Dealer Hits Soft 17 Option** (Priority 3, Low Complexity) - Simple toggle
4. **Cut Card Penetration Simulation** (Priority 3, Medium Complexity) - Enhance existing reshuffle
5. **Shoe Cut Card Display** (Priority 4, Low Complexity) - Visual polish
6. **Table Sign Display** (Priority 4, Low Complexity) - Visual enhancement
7. **Dealer Peek Animation** (Priority 4, Medium Complexity) - Animation work
8. **Multiple Player Hands** (Priority 4, High Complexity) - Major feature
9. **Side Bets** (Priority 4, High Complexity) - Complex betting system
10. **Future Considerations** (Priority 5) - All optional enhancements


