/**
 * Blackjack Game UI Logic
 * Handles game state, API calls, and UI updates
 */

class BlackjackGame {
    constructor() {
        this.gameId = null;
        this.currentBet = 0;
        this.selectedChip = null;
        this.playerHandManager = null;
        this.dealerHandManager = null;
        this.gameState = null;
        this.isProcessing = false;
        this.previousBalance = 1000; // Track balance for logging changes
        this.gameHistory = []; // Track game history for the panel
        // Don't call init() here - it's async and will be called separately
    }

    /**
     * Log helper with timestamps and emoji indicators
     */
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}]`;
        
        switch(type) {
            case 'error':
                console.error(`${prefix} ❌ ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ⚠️ ${message}`);
                break;
            case 'success':
                console.log(`${prefix} ✅ ${message}`);
                break;
            case 'action':
                console.log(`${prefix} 🎮 ${message}`);
                break;
            case 'deal':
                console.log(`${prefix} 🎴 ${message}`);
                break;
            case 'hit':
                console.log(`${prefix} 🎯 ${message}`);
                break;
            case 'bust':
                console.log(`${prefix} 💥 ${message}`);
                break;
            case 'win':
                console.log(`${prefix} 🎉 ${message}`);
                break;
            default:
                console.log(`${prefix} ℹ️ ${message}`);
        }
    }

    /**
     * Initialize the game
     */
    async init() {
        // Initialize card managers
        this.playerHandManager = new CardManager('#player-hand');
        this.dealerHandManager = new CardManager('#dealer-hand');
        
        // Setup chip selection
        this.setupChipSelection();
        
        // Enable chip buttons initially
        document.querySelectorAll('.chip').forEach(chip => {
            chip.disabled = false;
        });
        
        // Start new game (with error handling)
        try {
            await this.newGame();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showMessage('Game initialization failed. Please refresh the page.', 'error');
        }
    }

    /**
     * Setup chip selection handlers
     */
    setupChipSelection() {
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const value = parseInt(e.currentTarget.dataset.value);
                this.selectChip(value);
            });
        });
    }

    /**
     * Select a chip value
     */
    selectChip(value) {
        // Remove previous selection
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.remove('selected');
        });
        
        // Add selection to clicked chip
        const chip = document.querySelector(`.chip[data-value="${value}"]`);
        if (chip) {
            chip.classList.add('selected');
            this.selectedChip = value;
        }
    }

    /**
     * Add chip value to current bet
     */
    addToBet(value) {
        // Select the chip if not already selected
        if (this.selectedChip !== value) {
            this.selectChip(value);
        }
        
        // Add the chip value to current bet
        this.currentBet += value;
        this.updateBetDisplay();
    }

    /**
     * Clear current bet
     */
    clearBet() {
        this.currentBet = 0;
        this.selectedChip = null;
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.remove('selected');
        });
        this.updateBetDisplay();
    }

    /**
     * Update bet display
     */
    updateBetDisplay() {
        const betElement = document.getElementById('current-bet');
        if (betElement) {
            betElement.textContent = `$${this.currentBet}`;
        }
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
        this.isProcessing = true;
        this.setButtonsEnabled(false);
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
        this.isProcessing = false;
        // Don't blindly enable all buttons - use updateButtonStates instead
        this.updateButtonStates();
    }

    /**
     * Enable/disable buttons based on game state
     */
    setButtonsEnabled(enabled) {
        // Only disable game action buttons, NOT betting chips
        const actionButtons = ['hit-btn', 'stand-btn', 'double-btn', 'split-btn', 'deal-btn'];
        actionButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !enabled;
            }
        });
        
        // Chips should always be enabled during betting phase
        // They're controlled separately by showBettingArea/hideBettingArea
    }

    /**
     * Make API call
     */
    async apiCall(endpoint, method = 'POST', data = {}) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            if (method === 'POST' && Object.keys(data).length > 0) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(endpoint, options);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                const errorMsg = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`;
                console.error('API Error Response:', result);
                throw new Error(errorMsg);
            }
            
            return result;
        } catch (error) {
            console.error('API Error Details:', {
                endpoint,
                method,
                data,
                error: error.message,
                stack: error.stack
            });
            this.showMessage(`Error: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Show game message
     */
    showMessage(text, type = 'info') {
        const messageElement = document.getElementById('game-message');
        if (messageElement) {
            messageElement.textContent = text;
            messageElement.className = `game-message ${type}`;
            
            if (type === 'error') {
                messageElement.style.color = '#dc3545';
            } else if (type === 'win') {
                messageElement.style.color = '#28a745';
            } else {
                messageElement.style.color = '#ffd700';
            }
        }
    }

    /**
     * Start a new game round (preserves balance)
     */
    async newGame() {
        try {
            this.showLoading();
            this.clearBet();
            this.clearHands();
            this.hideGameControls();
            this.showBettingArea(); // Enable betting area for new game
            
            // If we have an existing game, continue it (preserves balance)
            // Otherwise create a new game with $1000
            const requestData = this.gameId ? 
                { game_id: this.gameId } : 
                { starting_chips: 1000 };
            
            const result = await this.apiCall('/api/new_game', 'POST', requestData);
            
            if (result.success) {
                this.gameId = result.game_id;
                this.updateGameState(result.game_state);
                this.previousBalance = this.gameState?.player?.chips || 1000;
                this.updateButtonStates();
                this.showMessage('Place your bet to start!');
                this.log('New game round started - betting area enabled (balance preserved)', 'success');
            }
        } catch (error) {
            this.log(`New game error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Refresh bankroll - reset balance to $1000 (creates completely new game)
     */
    async refreshBankroll() {
        try {
            this.showLoading();
            this.clearBet();
            this.clearHands();
            this.hideGameControls();
            this.showBettingArea();
            
            // Create a completely new game with fresh $1000 bankroll
            const result = await this.apiCall('/api/new_game', 'POST', {
                starting_chips: 1000
            });
            
            if (result.success) {
                this.gameId = result.game_id;
                this.updateGameState(result.game_state);
                this.previousBalance = 1000; // Reset tracking for fresh start
                this.updateButtonStates();
                this.showMessage('Bankroll refreshed! Place your bet to start!');
                this.log('Bankroll refreshed - new game with $1000', 'success');
            }
        } catch (error) {
            this.log(`Refresh bankroll error: ${error.message}`, 'error');
            this.showMessage('Error refreshing bankroll', 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Place a bet
     */
    async placeBet(amount) {
        if (!this.gameId) {
            await this.newGame();
        }
        
        if (amount <= 0) {
            this.showMessage('Please select a bet amount', 'error');
            return false;
        }
        
        // Track balance before bet
        const balanceBeforeBet = this.gameState?.player?.chips || this.previousBalance || 1000;
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/bet', 'POST', {
                game_id: this.gameId,
                amount: amount
            });
            
            if (result.success) {
                this.currentBet = amount;
                this.updateGameState(result.game_state);
                const balanceAfterBet = this.gameState?.player?.chips || 0;
                
                // Update previousBalance to track balance AFTER bet is placed
                this.previousBalance = balanceAfterBet;
                
                console.log('💰 BET PLACED:');
                console.log(`   Bet Amount: $${amount}`);
                console.log(`   Balance Before Bet: $${balanceBeforeBet}`);
                console.log(`   Balance After Bet: $${balanceAfterBet}`);
                console.log(`   Expected Balance: $${balanceBeforeBet - amount}`);
                console.log(`   Actual Balance: $${balanceAfterBet}`);
                
                if (balanceAfterBet !== (balanceBeforeBet - amount)) {
                    console.error(`⚠️ BALANCE MISMATCH at bet placement! Expected $${balanceBeforeBet - amount}, got $${balanceAfterBet}`);
                } else {
                    console.log(`✅ Bet deducted correctly`);
                }
                
                this.updateButtonStates();
                return true;
            } else {
                this.showMessage(result.error || 'Bet failed', 'error');
                return false;
            }
        } catch (error) {
            return false;
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Deal initial cards
     */
    async dealCards() {
        this.log('Starting dealCards process', 'deal');
        
        if (this.currentBet <= 0) {
            this.log('DEAL DENIED: No bet placed', 'warn');
            this.showMessage('Please place a bet first', 'error');
            return;
        }
        
        if (!this.gameId) {
            this.log('DEAL DENIED: No gameId', 'warn');
            this.showMessage('Please start a new game', 'error');
            return;
        }
        
        // Immediately disable betting area once deal starts
        this.hideBettingArea();
        
        try {
            this.showLoading();
            
            // If game is already over, reset it for a new round (same game, same balance)
            // BUT preserve the current bet if user already placed one
            const betToPreserve = this.currentBet;
            if (this.gameState && this.gameState.state === 'game_over') {
                this.log('Previous round finished, resetting for new round...', 'action');
                try {
                    // Call new_game API with existing game_id to continue same game (preserves balance)
                    const result = await this.apiCall('/api/new_game', 'POST', {
                        game_id: this.gameId
                    });
                    
                    if (result.success) {
                        this.gameId = result.game_id;
                        this.updateGameState(result.game_state);
                        this.clearHands();
                        this.hideGameControls();
                        this.showBettingArea();
                        
                        // Restore the bet if user had placed one
                        if (betToPreserve > 0) {
                            this.currentBet = betToPreserve;
                            this.log(`Preserved bet: $${this.currentBet}`, 'action');
                        }
                        
                        this.updateButtonStates();
                        this.log('Game reset for new round (balance preserved)', 'success');
                    } else {
                        throw new Error(result.error || 'Failed to reset game');
                    }
                } catch (error) {
                    this.log(`ERROR resetting game: ${error.message}`, 'error');
                    this.showMessage('Error resetting game', 'error');
                    return;
                }
            }
            
            this.log(`Placing bet: $${this.currentBet}`, 'action');
            
            // Place bet if not already placed
            if (this.currentBet > 0) {
                const betPlaced = await this.placeBet(this.currentBet);
                if (!betPlaced) {
                    this.log('Bet placement failed', 'error');
                    this.showMessage('Bet placement failed', 'error');
                    return;
                }
                this.log(`Bet placed successfully: $${this.currentBet}`, 'success');
            }
            
            this.log(`Dealing cards for game ${this.gameId}`, 'deal');
            const result = await this.apiCall('/api/deal', 'POST', {
                game_id: this.gameId
            });
            
            if (result.success) {
                this.log('Deal API call successful', 'success');
                this.updateGameState(result.game_state);
                this.renderHands();
                this.hideBettingArea();
                this.showGameControls();
                this.updateButtonStates();
                
                // Log player and dealer initial hands
                const playerHand = this.gameState.player?.hands?.[this.gameState.player.current_hand_index];
                const dealerHand = this.gameState.dealer;
                
                if (playerHand) {
                    this.log(`Player dealt: ${playerHand.cards?.length || 0} cards, value: ${playerHand.value}`, 'deal');
                }
                if (dealerHand) {
                    const visibleCards = dealerHand.cards?.filter(c => !c.hidden) || [];
                    this.log(`Dealer dealt: ${visibleCards.length} visible cards (1 hidden)`, 'deal');
                }
                
                // Check if game ended immediately (blackjack or dealer blackjack)
                if (this.gameState.state === 'game_over') {
                    const result = this.gameState.result;
                    this.log(`Game ended immediately after deal. Result: ${result}`, 'action');
                    
                    // Show result message based on outcome
                    if (result === 'blackjack') {
                        this.log('Player wins with BLACKJACK!', 'win');
                        this.showMessage('Blackjack! You Win! 🎉', 'win');
                    } else if (result === 'push') {
                        this.log('Round ends in PUSH (tie)', 'action');
                        this.showMessage("It's a Push - Tie!", 'info');
                    } else if (result === 'loss') {
                        this.log('Player loses - Dealer has BLACKJACK', 'bust');
                        this.showMessage('Dealer Blackjack - You Lose', 'error');
                    } else if (result === 'win') {
                        this.log('Player wins the round', 'win');
                        this.showMessage('You Win! 🎉', 'win');
                    }
                    
                    // Disable game controls and show new game button
                    this.hideGameControls();
                    this.showBettingArea();
                } else {
                    // Game continues - show Your Turn
                    this.log('Player turn begins', 'action');
                    this.showMessage('Your turn!');
                }
            } else {
                this.log(`Deal failed: ${result.error || result.message}`, 'error');
                this.showMessage(result.error || result.message || 'Deal failed', 'error');
            }
        } catch (error) {
            this.log(`Deal error: ${error.message}`, 'error');
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Player hits
     */
    async playerHit() {
        if (!this.gameId) {
            this.log('HIT DENIED: No gameId', 'warn');
            this.showMessage('Cannot hit: No active game', 'error');
            return;
        }
        
        if (this.isProcessing) {
            this.log('HIT DENIED: Already processing another action', 'warn');
            this.showMessage('Please wait, processing previous action...', 'warn');
            return;
        }
        
        if (this.gameState?.state !== 'player_turn') {
            this.log(`HIT DENIED: Game state is "${this.gameState?.state}", not "player_turn"`, 'warn');
            this.showMessage(`Cannot hit: Game is in ${this.gameState?.state} state`, 'error');
            return;
        }
        
        const currentValue = this.gameState?.player?.hands?.[this.gameState.player.current_hand_index]?.value || 0;
        this.log(`Player attempting HIT (current value: ${currentValue})`, 'hit');
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/hit', 'POST', {
                game_id: this.gameId
            });
            
            if (result.success) {
                this.log('Hit API call successful', 'success');
                
                // Log the full response structure for debugging
                this.log(`Hit response structure - bust: ${result.bust}, game_over: ${result.game_over}`, 'action');
                this.log(`Game state before update - state: ${this.gameState?.state}`, 'action');
                
                this.updateGameState(result.game_state);
                
                // Log game state after update
                this.log(`Game state after update - state: ${this.gameState?.state}`, 'action');
                this.log(`Player exists: ${!!this.gameState?.player}, hands: ${this.gameState?.player?.hands?.length || 0}, current_hand_index: ${this.gameState?.player?.current_hand_index}`, 'action');
                
                // Fix: current_hand_index might be out of bounds after bust
                // Use the last hand in the array if index is invalid
                const handsArray = this.gameState?.player?.hands || [];
                const requestedIndex = this.gameState?.player?.current_hand_index || 0;
                const safeIndex = (requestedIndex < handsArray.length) ? requestedIndex : Math.max(0, handsArray.length - 1);
                
                this.log(`Hand access - requested index: ${requestedIndex}, safe index: ${safeIndex}, hands array length: ${handsArray.length}`, 'action');
                
                // Always render player hand - even if busted
                const playerHand = handsArray[safeIndex];
                
                if (!playerHand) {
                    this.log('ERROR: No player hand returned after hit', 'error');
                    this.log(`Debug - gameState.player: ${JSON.stringify(this.gameState?.player)}`, 'error');
                    this.log(`Debug - hands array: ${JSON.stringify(this.gameState?.player?.hands)}`, 'error');
                    this.log(`Debug - current_hand_index: ${this.gameState?.player?.current_hand_index}`, 'error');
                    
                    // Try to refresh from server
                    try {
                        this.log('Attempting to refresh game state from server...', 'action');
                        await this.updateGameStateFromServer();
                        
                        // Use safe index again after refresh
                        const refreshedHandsArray = this.gameState?.player?.hands || [];
                        const refreshedRequestedIndex = this.gameState?.player?.current_hand_index || 0;
                        const refreshedSafeIndex = (refreshedRequestedIndex < refreshedHandsArray.length) ? refreshedRequestedIndex : Math.max(0, refreshedHandsArray.length - 1);
                        const refreshedHand = refreshedHandsArray[refreshedSafeIndex];
                        
                        if (refreshedHand) {
                            this.log('Successfully retrieved hand after refresh', 'success');
                            // Continue with rendering below
                        } else {
                            this.log('ERROR: Still no hand after refresh', 'error');
                            this.showMessage('Error: No hand data received', 'error');
                            return;
                        }
                    } catch (refreshError) {
                        this.log(`ERROR refreshing game state: ${refreshError.message}`, 'error');
                        this.showMessage('Error: Could not refresh game state', 'error');
                        return;
                    }
                }
                
                // Re-get playerHand in case we refreshed, using safe index
                const finalHandsArray = this.gameState?.player?.hands || [];
                const finalRequestedIndex = this.gameState?.player?.current_hand_index || 0;
                const finalSafeIndex = (finalRequestedIndex < finalHandsArray.length) ? finalRequestedIndex : Math.max(0, finalHandsArray.length - 1);
                const finalPlayerHand = finalHandsArray[finalSafeIndex];
                if (!finalPlayerHand) {
                    this.log('ERROR: Player hand still missing after refresh', 'error');
                    this.showMessage('Error: No hand data received', 'error');
                    return;
                }
                
                // Use finalPlayerHand instead of playerHand
                const handToUse = finalPlayerHand || playerHand;
                
                if (handToUse && handToUse.cards && handToUse.cards.length > 0) {
                    const newCard = handToUse.cards[handToUse.cards.length - 1];
                    this.log(`Hit successful: Received ${newCard.rank} of ${newCard.suit}, new value: ${handToUse.value}`, 'hit');
                    
                    // Clear and re-render player hand
                    this.playerHandManager.clear();
                    handToUse.cards.forEach((card, index) => {
                        const delay = index * 150;
                        this.playerHandManager.dealCard(card, false, delay);
                    });
                } else {
                    this.log('ERROR: No cards in player hand after hit', 'error');
                    this.log(`Hand structure: ${JSON.stringify(handToUse)}`, 'error');
                    this.showMessage('Error: No cards received', 'error');
                }
                
                // Check if player busted or got blackjack
                if (handToUse.is_bust) {
                    this.log(`PLAYER BUSTED! Final value: ${handToUse.value}`, 'bust');
                    this.showMessage(`Bust! You lose. (Value: ${handToUse.value})`, 'error');
                    await this.endGame();
                } else if (handToUse.is_blackjack) {
                    this.log('Player got BLACKJACK after hit!', 'win');
                    this.showMessage('Blackjack!', 'win');
                    await this.endGame();
                } else if (this.gameState.state === 'game_over') {
                    // Game ended for some other reason
                    this.log(`Game ended after hit. Result: ${this.gameState.result}`, 'action');
                    await this.endGame();
                } else {
                    // Still player's turn
                    this.log(`Hit successful. New value: ${handToUse.value}, game continues`, 'hit');
                }
            } else {
                this.log(`Hit failed: ${result.error || result.message}`, 'error');
                this.showMessage(result.error || result.message || 'Hit failed', 'error');
            }
        } catch (error) {
            this.log(`Hit error: ${error.message}`, 'error');
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            // hideLoading() will set isProcessing = false and call updateButtonStates()
            this.hideLoading();
        }
    }

    /**
     * Player stands
     */
    async playerStand() {
        if (!this.gameId) {
            this.log('STAND DENIED: No gameId', 'warn');
            this.showMessage('Cannot stand: No active game', 'error');
            return;
        }
        
        if (this.isProcessing) {
            this.log('STAND DENIED: Already processing another action', 'warn');
            this.showMessage('Please wait, processing previous action...', 'warn');
            return;
        }
        
        const playerValue = this.gameState?.player?.hands?.[this.gameState.player.current_hand_index]?.value || 0;
        this.log(`Player STANDS with value: ${playerValue}`, 'action');
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/stand', 'POST', {
                game_id: this.gameId
            });
            
            if (result.success) {
                this.log('Stand API call successful', 'success');
                this.updateGameState(result.game_state);
                this.updateButtonStates();
                
                this.log(`After stand - State: ${this.gameState.state}, Result: ${this.gameState.result}`, 'action');
                
                // Backend automatically plays dealer and determines results
                // So game should be over immediately after stand
                if (this.gameState.state === 'game_over') {
                    this.log('Game over after stand, determining winner...', 'action');
                    await this.endGame();
                } else {
                    // State might be 'dealer_turn' but backend already played - refresh
                    this.log(`State is ${this.gameState.state}, refreshing from server...`, 'action');
                    try {
                        await this.updateGameStateFromServer();
                        await this.endGame();
                    } catch (refreshError) {
                        this.log(`ERROR refreshing game state: ${refreshError.message}`, 'error');
                        this.showMessage('Error: Could not refresh game state', 'error');
                    }
                }
            } else {
                this.log(`Stand failed: ${result.error || result.message}`, 'error');
                this.showMessage(result.error || result.message || 'Stand failed', 'error');
            }
        } catch (error) {
            this.log(`Stand error: ${error.message}`, 'error');
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Player doubles down
     */
    async playerDoubleDown() {
        if (!this.gameId || this.isProcessing) return;
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/double_down', 'POST', {
                game_id: this.gameId
            });
            
            if (result.success) {
                this.updateGameState(result.game_state);
                this.renderHands();
                this.updateButtonStates();
                
                // Double down automatically hits once and stands
                await this.playDealerTurn();
            }
        } catch (error) {
            this.log(`Double down error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Player splits
     */
    async playerSplit() {
        if (!this.gameId || this.isProcessing) return;
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/split', 'POST', {
                game_id: this.gameId
            });
            
            if (result.success) {
                this.updateGameState(result.game_state);
                this.renderHands();
                this.updateButtonStates();
                this.showMessage('Hand split! Continue playing.');
            }
        } catch (error) {
            this.log(`Split error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Play dealer turn
     */
    async playDealerTurn() {
        this.showMessage('Dealer playing...');
        
        // Reveal dealer hole card
        if (this.dealerHandManager && this.dealerHandManager.getCount() > 0) {
            this.dealerHandManager.revealCard(0);
        }
        
        // Wait for dealer to finish (in real game, this would be automated)
        // For now, we'll get the final game state
        await this.updateGameStateFromServer();
        
        if (this.gameState.state === 'game_over') {
            await this.endGame();
        }
    }

    /**
     * End game and show results
     */
    async endGame() {
        this.log('Ending game...', 'action');
        
        try {
            await this.updateGameStateFromServer();
        } catch (error) {
            this.log(`ERROR refreshing game state at end: ${error.message}`, 'error');
        }
        
        // Don't clear - just render everything fresh
        this.renderHands();
        
        // Force update hand values after rendering to ensure correct display
        this.updateHandValues();
        
        // Show result message and log winner
        const result = this.gameState?.result;
        
        // Use safe index for player hand
        const handsArray = this.gameState?.player?.hands || [];
        let playerValue = 0;
        let playerBust = false;
        if (handsArray.length > 0) {
            const requestedIndex = this.gameState?.player?.current_hand_index || 0;
            const safeIndex = (requestedIndex < handsArray.length) ? requestedIndex : Math.max(0, handsArray.length - 1);
            const playerHand = handsArray[safeIndex];
            playerValue = playerHand?.value || 0;
            playerBust = playerHand?.is_bust || false;
            
            // Log all hands for debugging
            this.log(`Player has ${handsArray.length} hand(s)`, 'action');
            handsArray.forEach((hand, idx) => {
                this.log(`  Hand ${idx}: value=${hand.value}, bust=${hand.is_bust}, cards=${hand.cards?.length || 0}`, 'action');
            });
            this.log(`Using hand at index ${safeIndex} (requested: ${requestedIndex})`, 'action');
        }
        
        const dealerValue = this.gameState?.dealer?.value || 0;
        const dealerBust = this.gameState?.dealer?.is_bust || false;
        
        this.log(`Final scores - Player: ${playerValue}${playerBust ? ' (BUST)' : ''}, Dealer: ${dealerValue}${dealerBust ? ' (BUST)' : ''}`, 'action');
        
        // Log the comparison for debugging
        if (playerBust) {
            this.log('Player busted - automatic loss', 'bust');
        } else if (dealerBust) {
            this.log('Dealer busted - player should win', 'win');
        } else if (playerValue > dealerValue) {
            this.log(`Player ${playerValue} > Dealer ${dealerValue} - player should WIN`, 'win');
        } else if (playerValue < dealerValue) {
            this.log(`Player ${playerValue} < Dealer ${dealerValue} - player should LOSE`, 'bust');
        } else {
            this.log(`Player ${playerValue} == Dealer ${dealerValue} - PUSH`, 'action');
        }
        
        if (result === 'win') {
            this.log('ROUND WINNER: PLAYER WINS!', 'win');
            this.showMessage('You Win! 🎉', 'win');
        } else if (result === 'blackjack') {
            this.log('ROUND WINNER: PLAYER WINS WITH BLACKJACK!', 'win');
            this.showMessage('Blackjack! You Win! 🎉', 'win');
        } else if (result === 'loss') {
            this.log('ROUND WINNER: DEALER WINS (Player loses)', 'bust');
            this.showMessage('You Lose', 'error');
        } else if (result === 'push') {
            this.log('ROUND RESULT: PUSH (Tie)', 'action');
            this.showMessage('Push - It\'s a tie!', 'info');
        } else {
            this.log(`ROUND ENDED: Unknown result "${result}"`, 'warn');
            this.showMessage('Game Over', 'info');
        }
        
        const balance = this.gameState?.player?.chips || 0;
        const betAmount = this.currentBet || 0;
        
        // IMPORTANT: previousBalance should be the balance AFTER the bet was placed
        // because the bet is deducted when placed, not when the game ends
        const balanceAfterBet = this.previousBalance || 1000;
        
        // Calculate expected balance change based on result
        let expectedBalanceChange = 0;
        let expectedBalance = balanceAfterBet;
        
        if (result === 'blackjack') {
            // Blackjack pays 3:2 (bet * 1.5 profit)
            // Bet was already deducted, so we get: bet back + 1.5x bet = bet * 2.5 total
            expectedBalanceChange = Math.floor(betAmount * 1.5);
            expectedBalance = balanceAfterBet + betAmount + expectedBalanceChange; // bet back + profit
        } else if (result === 'win') {
            // Regular win pays 1:1 (bet back + bet profit)
            // Bet was already deducted, so we get: bet back + bet = bet * 2 total
            expectedBalanceChange = betAmount; // Profit is 1x bet
            expectedBalance = balanceAfterBet + betAmount + expectedBalanceChange; // bet back + profit
        } else if (result === 'loss') {
            // Loss - bet is already deducted, no payout
            expectedBalanceChange = 0;
            expectedBalance = balanceAfterBet; // No change, bet already lost
        } else if (result === 'push') {
            // Push - bet is returned (no profit, no loss)
            expectedBalanceChange = 0;
            expectedBalance = balanceAfterBet + betAmount; // Bet returned
        }
        
        // Comprehensive game summary logging
        const balanceBeforeBet = balanceAfterBet + betAmount; // Reconstruct balance before bet
        
        console.log('═══════════════════════════════════════════════════════');
        console.log('🎲 GAME SUMMARY');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📊 Dealer Score: ${dealerValue}${dealerBust ? ' (BUST)' : ''}`);
        console.log(`👤 Player Score: ${playerValue}${playerBust ? ' (BUST)' : ''}`);
        console.log(`💰 Bet Amount: $${betAmount}`);
        console.log(`💵 Balance Before Bet: $${balanceBeforeBet}`);
        console.log(`💵 Balance After Bet: $${balanceAfterBet}`);
        console.log(`💵 Balance After Round: $${balance}`);
        console.log(`📈 Actual Balance Change (from after bet): $${balance - balanceAfterBet}`);
        console.log(`📈 Expected Balance Change: $${betAmount + expectedBalanceChange} (bet back + profit)`);
        console.log(`💵 Expected Final Balance: $${expectedBalance}`);
        console.log(`🏆 Result: ${result}`);
        
        if (balance !== expectedBalance) {
            console.error(`❌ BALANCE MISMATCH! Expected $${expectedBalance}, got $${balance}`);
            console.error(`   Difference: $${balance - expectedBalance}`);
            console.error(`   This means the backend paid out incorrectly!`);
        } else {
            console.log(`✅ Balance calculation is CORRECT`);
        }
        console.log('═══════════════════════════════════════════════════════');
        
        // Store balance for next round comparison
        this.previousBalance = balance;
        
        // Add to game history (keep only last 5)
        this.addGameHistory(result, betAmount, balance - balanceBeforeBet);
        
        this.log(`Game ended. Result: ${result}, New balance: $${balance}`, 'action');
        
        // Hide game controls, show betting area but keep it DISABLED until New Game is clicked
        this.hideGameControls();
        this.showBettingAreaDisabled(); // Show but disabled
        // Keep the bet amount for the next round
        this.log(`Bet preserved for next round: $${this.currentBet}`, 'action');
    }

    /**
     * Update game state from server
     */
    async updateGameStateFromServer() {
        if (!this.gameId) return;
        
        try {
            const result = await this.apiCall(`/api/game_state?game_id=${this.gameId}`, 'GET');
            if (result.success) {
                this.updateGameState(result.game_state);
                this.updateButtonStates();
            }
        } catch (error) {
            this.log(`Update state error: ${error.message}`, 'error');
        }
    }

    /**
     * Update game state
     */
    updateGameState(state) {
        this.gameState = state;
        
        // Update balance
        const balanceElement = document.getElementById('balance');
        if (balanceElement && state.player) {
            balanceElement.textContent = `$${state.player.chips}`;
        }
        
        // Update hand values
        this.updateHandValues();
        
        // Don't call updateButtonStates() here - it might be called while isProcessing is true
        // Call it explicitly after hideLoading() or when you know isProcessing is false
    }

    /**
     * Update hand value displays
     */
    updateHandValues() {
        if (!this.gameState) return;
        
        // Player hand value - use safe index to handle out-of-bounds current_hand_index
        const handsArray = this.gameState.player?.hands || [];
        if (handsArray.length > 0) {
            const requestedIndex = this.gameState.player?.current_hand_index || 0;
            const safeIndex = (requestedIndex < handsArray.length) ? requestedIndex : Math.max(0, handsArray.length - 1);
            const playerHand = handsArray[safeIndex];
            
            const playerValueElement = document.getElementById('player-value');
            if (playerValueElement && playerHand) {
                // Log for debugging if there's a mismatch
                if (requestedIndex !== safeIndex) {
                    this.log(`Hand value display - requested index ${requestedIndex} out of bounds, using ${safeIndex}`, 'warn');
                }
                
                // Show value, and if busted, show it clearly
                const valueText = playerHand.is_bust ? 
                    `Value: ${playerHand.value} (BUST!)` : 
                    `Value: ${playerHand.value}`;
                playerValueElement.textContent = valueText;
                
                // Log the actual hand for debugging
                this.log(`Player hand value displayed: ${playerHand.value}, bust: ${playerHand.is_bust}, cards: ${playerHand.cards?.length || 0}`, 'action');
            } else if (playerValueElement && !playerHand) {
                this.log(`ERROR: No player hand found at index ${safeIndex}`, 'error');
            }
        } else {
            const playerValueElement = document.getElementById('player-value');
            if (playerValueElement) {
                this.log('ERROR: No player hands array found', 'error');
            }
        }
        
        // Dealer hand value
        const dealerValueElement = document.getElementById('dealer-value');
        if (dealerValueElement && this.gameState.dealer) {
            if (this.gameState.dealer.hole_card_hidden) {
                // Show only the visible cards value
                const visibleValue = this.gameState.dealer.visible_value;
                if (visibleValue !== null && visibleValue !== undefined) {
                    dealerValueElement.textContent = `Value: ${visibleValue}`;
                } else {
                    dealerValueElement.textContent = 'Value: ?';
                }
            } else {
                const dealerValue = this.gameState.dealer.full_value || this.gameState.dealer.value;
                const dealerBust = this.gameState.dealer.is_bust;
                const valueText = dealerBust ? 
                    `Value: ${dealerValue} (BUST!)` : 
                    `Value: ${dealerValue}`;
                dealerValueElement.textContent = valueText;
                this.log(`Dealer hand value displayed: ${dealerValue}, bust: ${dealerBust}`, 'action');
            }
        }
    }

    /**
     * Update button states based on game state
     */
    updateButtonStates() {
        if (!this.gameState) {
            this.log('Cannot update button states: no gameState', 'warn');
            return;
        }
        
        // If game is over, disable all action buttons
        if (this.gameState.state === 'game_over') {
            this.log('Game over - disabling action buttons', 'action');
            const hitBtn = document.getElementById('hit-btn');
            const standBtn = document.getElementById('stand-btn');
            const doubleBtn = document.getElementById('double-btn');
            const splitBtn = document.getElementById('split-btn');
            
            if (hitBtn) {
                hitBtn.disabled = true;
                this.log('Hit button disabled (game over)', 'action');
            } else {
                this.log('ERROR: hit-btn element not found!', 'error');
            }
            if (standBtn) standBtn.disabled = true;
            if (doubleBtn) doubleBtn.disabled = true;
            if (splitBtn) splitBtn.disabled = true;
            
            return;
        }
        
        const playerHand = this.gameState.player?.hands?.[this.gameState.player.current_hand_index];
        
        // Enable/disable double down
        const doubleBtn = document.getElementById('double-btn');
        if (doubleBtn && playerHand) {
            doubleBtn.disabled = !playerHand.can_double || this.gameState.state !== 'player_turn';
        }
        
        // Enable/disable split
        const splitBtn = document.getElementById('split-btn');
        if (splitBtn && playerHand) {
            const canSplit = playerHand.can_split && this.gameState.state === 'player_turn';
            splitBtn.style.display = canSplit ? 'block' : 'none';
            splitBtn.disabled = !canSplit;
        }
        
        // Enable/disable hit and stand
        const hitBtn = document.getElementById('hit-btn');
        const standBtn = document.getElementById('stand-btn');
        const isPlayerTurn = this.gameState.state === 'player_turn';
        
        this.log(`Button state update - isPlayerTurn: ${isPlayerTurn}, state: ${this.gameState.state}, isProcessing: ${this.isProcessing}`, 'action');
        
        if (!hitBtn) {
            this.log('ERROR: hit-btn element not found in DOM!', 'error');
        } else {
            const shouldBeDisabled = !isPlayerTurn || this.isProcessing;
            hitBtn.disabled = shouldBeDisabled;
            this.log(`Hit button - disabled: ${hitBtn.disabled}, shouldBeDisabled: ${shouldBeDisabled}`, 'action');
        }
        
        if (!standBtn) {
            this.log('ERROR: stand-btn element not found in DOM!', 'error');
        } else {
            const shouldBeDisabled = !isPlayerTurn || this.isProcessing;
            standBtn.disabled = shouldBeDisabled;
            this.log(`Stand button - disabled: ${standBtn.disabled}, shouldBeDisabled: ${shouldBeDisabled}`, 'action');
        }
    }

    /**
     * Render hands (called after dealing initial cards)
     */
    renderHands() {
        if (!this.gameState) return;
        
        // Clear existing hands only if not game over
        // (we want to keep cards visible at end of game)
        if (this.gameState.state !== 'game_over') {
            this.playerHandManager.clear();
            this.dealerHandManager.clear();
        } else {
            // Game is over - clear only if no cards are shown
            // to ensure cards display correctly
            if (this.playerHandManager.cards.length === 0) {
                // Player cards are missing, re-render them
                console.log('⚠️ Player cards missing at game end, re-rendering...');
            }
            if (this.dealerHandManager.cards.length === 0) {
                // Dealer cards are missing, re-render them
                console.log('⚠️ Dealer cards missing at game end, re-rendering...');
            }
        }
        
        // Render player hand
        const playerHand = this.gameState.player.hands[this.gameState.player.current_hand_index];
        if (playerHand && playerHand.cards) {
            // Only add if not already rendered (check by count)
            if (this.playerHandManager.cards.length !== playerHand.cards.length) {
                console.log('Rendering player cards:', playerHand.cards.length);
                this.playerHandManager.clear();
                playerHand.cards.forEach((card, index) => {
                    const delay = index * 150;
                    this.playerHandManager.dealCard(card, false, delay);
                });
            }
        }
        
        // Render dealer hand
        if (this.gameState.dealer && this.gameState.dealer.full_hand) {
            // Only add if not already rendered (check by count)
            if (this.dealerHandManager.cards.length !== this.gameState.dealer.full_hand.length) {
                console.log('Rendering dealer cards:', this.gameState.dealer.full_hand.length);
                this.dealerHandManager.clear();
                this.gameState.dealer.full_hand.forEach((card, index) => {
                    const delay = index * 150;
                    const isHidden = index === 0 && this.gameState.dealer.hole_card_hidden;
                    this.dealerHandManager.dealCard(card, isHidden, delay);
                });
            }
        }
    }
    
    /**
     * Add a new card to player hand (for hits)
     */
    addCardToHand(card) {
        if (!this.playerHandManager) return;
        
        const playerHand = this.gameState.player.hands[this.gameState.player.current_hand_index];
        if (playerHand && playerHand.cards) {
            // Get the number of existing cards to calculate delay
            const cardCount = playerHand.cards.length;
            const delay = (cardCount - 1) * 150;  // Last card has previous delay
            
            console.log('➕ Adding new card to hand (total:', cardCount, ')');
            this.playerHandManager.dealCard(card, false, delay);
        }
    }

    /**
     * Clear hands
     */
    clearHands() {
        this.playerHandManager.clear();
        this.dealerHandManager.clear();
    }

    /**
     * Show betting area (enabled - for active betting)
     */
    showBettingArea() {
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'block';
            this.log('Betting area shown and enabled', 'action');
        }
        
        const dealBtn = document.getElementById('deal-btn');
        if (dealBtn) {
            dealBtn.disabled = false;
        }
        
        // Enable all chip buttons
        document.querySelectorAll('.chip').forEach(chip => {
            chip.disabled = false;
        });
        
        // Enable Clear Bet button
        const clearBetBtn = document.getElementById('clear-bet-btn');
        if (clearBetBtn) {
            clearBetBtn.disabled = false;
        }
    }

    /**
     * Show betting area but keep it disabled (for when game ends)
     */
    showBettingAreaDisabled() {
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'block';
            this.log('Betting area shown but DISABLED (game ended)', 'action');
        }
        
        // Disable Deal Cards button
        const dealBtn = document.getElementById('deal-btn');
        if (dealBtn) {
            dealBtn.disabled = true;
        }
        
        // Disable all chip buttons
        document.querySelectorAll('.chip').forEach(chip => {
            chip.disabled = true;
        });
        
        // Disable Clear Bet button
        const clearBetBtn = document.getElementById('clear-bet-btn');
        if (clearBetBtn) {
            clearBetBtn.disabled = true;
        }
    }

    /**
     * Hide betting area
     */
    hideBettingArea() {
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'none';
            this.log('Betting area hidden and disabled', 'action');
        }
        
        // Disable chip buttons when betting area is hidden
        document.querySelectorAll('.chip').forEach(chip => {
            chip.disabled = true;
        });
        
        // Disable Deal Cards button
        const dealBtn = document.getElementById('deal-btn');
        if (dealBtn) {
            dealBtn.disabled = true;
        }
        
        // Disable Clear Bet button
        const clearBetBtn = document.getElementById('clear-bet-btn');
        if (clearBetBtn) {
            clearBetBtn.disabled = true;
        }
    }

    /**
     * Show game controls
     */
    showGameControls() {
        const controlsElement = document.getElementById('game-controls');
        if (controlsElement) {
            controlsElement.style.display = 'flex';
            this.log('Game controls shown (Hit, Stand, Double Down)', 'action');
        } else {
            this.log('ERROR: game-controls element not found!', 'error');
        }
    }

    /**
     * Hide game controls
     */
    hideGameControls() {
        const controlsElement = document.getElementById('game-controls');
        if (controlsElement) {
            controlsElement.style.display = 'none';
            this.log('Game controls hidden', 'action');
        } else {
            this.log('ERROR: game-controls element not found!', 'error');
        }
    }

    /**
     * Add game result to history
     */
    addGameHistory(result, bet, balanceChange) {
        const timestamp = new Date().toLocaleTimeString();
        
        // Determine the display text and amount change
        let displayResult = result.toUpperCase();
        let amountDisplay = '';
        
        if (result === 'win') {
            amountDisplay = `+$${bet * 2}`; // Bet returned + profit
        } else if (result === 'blackjack') {
            amountDisplay = `+$${Math.floor(bet * 2.5)}`; // Bet returned + 1.5x profit
        } else if (result === 'loss') {
            amountDisplay = `-$${bet}`;
        } else if (result === 'push') {
            amountDisplay = `$0`;
        }
        
        const historyItem = {
            result,
            displayResult,
            bet,
            amountDisplay,
            balanceChange,
            timestamp
        };
        
        // Add to beginning of array
        this.gameHistory.unshift(historyItem);
        
        // Keep only last 5
        if (this.gameHistory.length > 5) {
            this.gameHistory.pop();
        }
        
        this.updateHistoryDisplay();
    }

    /**
     * Update the history panel display
     */
    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        // Clear the list
        historyList.innerHTML = '';
        
        if (this.gameHistory.length === 0) {
            historyList.innerHTML = '<div class="history-item-empty">No games yet</div>';
            return;
        }
        
        // Add items (already in reverse chronological order due to unshift)
        this.gameHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${item.result}`;
            
            // Format result display
            let resultEmoji = '';
            if (item.result === 'win' || item.result === 'blackjack') {
                resultEmoji = '✅';
            } else if (item.result === 'loss') {
                resultEmoji = '❌';
            } else if (item.result === 'push') {
                resultEmoji = '🤝';
            }
            
            const resultText = item.result === 'blackjack' ? 'BLACKJACK' : item.displayResult;
            
            historyItem.innerHTML = `
                <span class="history-result">${resultEmoji} ${resultText}</span>
                <span class="history-amount">${item.amountDisplay}</span>
            `;
            
            historyList.appendChild(historyItem);
        });
    }
}

// Global game instance
let game = null;

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        game = new BlackjackGame();
        await game.init();
    } catch (error) {
        console.error('Failed to initialize Blackjack game:', error);
        const messageEl = document.getElementById('game-message');
        if (messageEl) {
            messageEl.textContent = 'Failed to load game. Please check the console and refresh.';
            messageEl.style.color = '#dc3545';
        }
    }
});

// Global functions for button onclick handlers
function selectChip(value) {
    if (game) {
        game.selectChip(value);
        game.addToBet(value);
    }
}

function clearBet() {
    if (game) {
        game.clearBet();
    }
}

function dealCards() {
    if (game) {
        game.dealCards();
    }
}

function playerHit() {
    console.log('🖱️ Hit button clicked! game exists:', !!game, 'gameId:', game?.gameId, 'isProcessing:', game?.isProcessing);
    if (game) {
        // Check if button is actually disabled
        const hitBtn = document.getElementById('hit-btn');
        if (hitBtn && hitBtn.disabled) {
            console.warn('⚠️ Hit button is disabled! State:', game.gameState?.state);
            return;
        }
        game.playerHit();
    } else {
        console.error('❌ Game object not initialized!');
    }
}

function playerStand() {
    if (game) {
        game.playerStand();
    }
}

function playerDoubleDown() {
    if (game) {
        game.playerDoubleDown();
    }
}

function playerSplit() {
    if (game) {
        game.playerSplit();
    }
}

function newGame() {
    if (game) {
        game.newGame();
    }
}

function refreshBankroll() {
    if (game) {
        game.refreshBankroll();
    }
}

