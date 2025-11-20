import { ApiClient } from './api_client.js';
import { GameStateManager } from './game_state.js';
import { UIController } from './ui_controller.js';
import { SettingsManager } from './settings_manager.js';
import { CardManager } from './card.js';

/**
 * Blackjack Game UI Logic
 * Handles game state, API calls, and UI updates
 */

export class BlackjackGame {
    constructor(options = {}) {
        this.gameId = null;
        this.currentBet = 0;
        this.selectedChip = null;
        this.playerHandManager = null;
        this.dealerHandManager = null;
        this.gameState = null;
        this.isProcessing = false;
        this.previousBalance = 1000; // Track balance for logging changes
        this.gameHistory = []; // Track game history for the panel
        this.stateManager = options.stateManager || new GameStateManager({
            defaultBankrollAmount: 1000,
            defaultDealerHitDelayMs: 1000
        });
        this.defaultBetAmount = this.stateManager.loadDefaultBet();
        this.defaultBankrollAmount = this.stateManager.defaultBankrollAmount;
        this.bankrollAmount = this.stateManager.loadBankrollConfig();
        this.bankrollSettingInput = null;
        this.bankrollHelperElement = null;
        this.defaultDealerHitDelayMs = this.stateManager.defaultDealerHitDelayMs;
        this.dealerHitDelayMs = this.stateManager.loadDealerHitDelay();
        this.dealerDelayInput = null;
        this.dealerDelayHelperElement = null;
        this.defaultPlayerHitDelayMs = this.stateManager.defaultPlayerHitDelayMs;
        this.playerHitDelayMs = this.stateManager.loadPlayerHitDelay();
        this.playerDelayInput = null;
        this.playerDelayHelperElement = null;
        this.dealerHitsSoft17 = this.stateManager.loadDealerHitsSoft17();
        this.dealerHitsSoft17Toggle = null;
        this.forcePlayerHandInput = null;
        this.actionStatusElement = null; // Status message element
        this.actionStatusTimeout = null; // Timeout for clearing status
        this.hecklerElement = null;
        this.hecklerTimeout = null;
        this.hecklerRemoveTimeout = null;
        this.activeHecklerToken = null;
        this.settingsToggle = null;
        this.settingsPanel = null;
        this.settingsCloseBtn = null;
        this.hecklerVoiceSelect = null;
        this.hecklerSpeedRange = null;
        this.hecklerSpeedDisplay = null;
        this.hecklerTestButton = null;
        this.trumpetTestButton = null;
        this.hecklerSettingsNote = null;
        this.forceDlrHandInput = null;
        this.testPeekButton = null;
        this.peekAnimationDurationMs = 1350;
        
        // Auto mode settings
        this.autoSettings = this.stateManager.loadAutoSettings();
        // Dedupe key for insurance outcome history entries per round
        this.lastInsuranceOutcomeSig = null;
        this.insuranceAnnouncedForGameId = null;
        this.loggedRoundId = null; // Track which round has been logged
        
        // UI, SettingsManager, APIClient, and AutoManager are initialized by main.js
        // Don't create them here to avoid circular dependencies
        this.ui = null;
        this.settingsManager = null;
        this.apiClient = options.apiClient || new ApiClient({
            onMessage: () => {} // Will be updated in main.js when UI is ready
        });
        this.autoManager = null;
        this.hecklerManager = null; // Will be set by main.js
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

    setBankrollAmount(rawValue, { fallback, persist = true, updateInput = true } = {}) {
        const previousAmount = this.bankrollAmount ?? this.defaultBankrollAmount;
        const fallbackAmount = fallback ?? previousAmount;
        const {
            amount,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax
        } = this.stateManager.normalizeBankrollAmount(rawValue, fallbackAmount);

        this.bankrollAmount = amount;

        if (persist) {
            this.stateManager.saveBankrollConfig(amount);
        }

        if (updateInput && this.bankrollSettingInput) {
            this.bankrollSettingInput.value = amount;
        }

        this.ui.updateBankrollHelper();

        return {
            amount,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax,
            previous: previousAmount
        };
    }

    setDealerHitDelay(rawValue, { fallback, persist = true, updateInput = true } = {}) {
        const previousDelay = Number.isFinite(this.dealerHitDelayMs) ? this.dealerHitDelayMs : this.defaultDealerHitDelayMs;
        const fallbackDelay = fallback ?? previousDelay;
        const {
            delay,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax
        } = this.stateManager.normalizeDealerHitDelay(rawValue, fallbackDelay);

        this.dealerHitDelayMs = delay;

        if (persist) {
            this.stateManager.saveDealerHitDelay(delay);
        }

        if (updateInput && this.dealerDelayInput) {
            this.dealerDelayInput.value = delay;
        }

        return {
            delay,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax,
            previous: previousDelay
        };
    }

    setPlayerHitDelay(rawValue, { fallback, persist = true, updateInput = true } = {}) {
        const previousDelay = Number.isFinite(this.playerHitDelayMs) ? this.playerHitDelayMs : this.defaultPlayerHitDelayMs;
        const fallbackDelay = fallback ?? previousDelay;
        const {
            delay,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax
        } = this.stateManager.normalizePlayerHitDelay(rawValue, fallbackDelay);

        this.playerHitDelayMs = delay;

        if (persist) {
            this.stateManager.savePlayerHitDelay(delay);
        }

        if (updateInput && this.playerDelayInput) {
            this.playerDelayInput.value = delay;
        }

        return {
            delay,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax,
            previous: previousDelay
        };
    }

    /**
     * Helper to set default bet on right click
     */
    setDefaultBet(value) {
        this.defaultBetAmount = value;
        this.stateManager.saveDefaultBet(value);
        this.log(`Default bet set to $${value}`, 'success');
        
        // Update UI to show change
        this.updateDefaultBetDisplay();
        
        // Also select this chip for current bet if we haven't bet yet
        if (this.currentBet === 0) {
            this.selectChip(value);
        }
    }
    
    updateDefaultBetDisplay() {
        document.querySelectorAll('.chip').forEach(chip => {
            const val = parseInt(chip.dataset.value);
            if (val === this.defaultBetAmount) {
                chip.classList.add('default-bet');
                chip.title = 'Default Bet (Right-click to change)';
            } else {
                chip.classList.remove('default-bet');
                chip.title = 'Right-click to set as default';
            }
        });
    }

    /**
     * Add game result to history list
     */
    addGameHistory(result, amount, netChange) {
        const historyItem = {
            result: result, // 'win', 'loss', 'push', 'blackjack'
            amount: amount,
            netChange: netChange,
            timestamp: Date.now(),
            displayResult: result.charAt(0).toUpperCase() + result.slice(1),
            amountDisplay: netChange > 0 ? `+$${netChange}` : (netChange < 0 ? `-$${Math.abs(netChange)}` : '$0')
        };
        
        this.gameHistory.unshift(historyItem);
        
        // Keep only last 5
        if (this.gameHistory.length > 5) {
            this.gameHistory.pop();
        }
        
        this.ui.updateHistoryDisplay();
    }

    addInsuranceHistory(won, amount) {
        // Add a specialized history item for insurance
        const historyItem = {
            result: won ? 'insurance_win' : 'insurance_loss',
            amount: amount,
            netChange: won ? amount : -amount,
            timestamp: Date.now(),
            displayResult: won ? 'Ins. Win' : 'Ins. Loss',
            amountDisplay: won ? `+$${amount}` : `-$${amount}`
        };
        
        this.gameHistory.unshift(historyItem);
        if (this.gameHistory.length > 5) {
            this.gameHistory.pop();
        }
        
        this.ui.updateHistoryDisplay();
    }

    /**
     * Clear all hands visually
     */
    clearHands() {
        if (this.playerHandManager) this.playerHandManager.clear();
        if (this.dealerHandManager) this.dealerHandManager.clear();
    }
    
    /**
     * Initialize settings panel (delegates to settingsManager)
     */
    initSettingsPanel() {
        if (this.settingsManager) {
            this.settingsManager.initSettingsPanel();
        }
    }

    /**
     * Heckler voice methods (delegated to hecklerManager)
     */
    previewHecklerVoice(force = false) {
        if (this.hecklerManager) {
            this.hecklerManager.previewVoice(force);
        }
    }

    playVoiceTest() {
        if (this.hecklerManager) {
            this.hecklerManager.playVoiceTest();
        }
    }

    speakHecklerLine(message, token) {
        if (this.hecklerManager) {
            return this.hecklerManager.speak(message, token);
        }
        return false;
    }

    stopHecklerSpeech() {
        if (this.hecklerManager) {
            this.hecklerManager.stop();
        }
    }

    /**
     * Determine the dealer's visible up card
     */
    getDealerUpCard() {
        const dealer = this.gameState?.dealer;
        if (!dealer) return null;
        const fullHand = Array.isArray(dealer.full_hand) ? dealer.full_hand : [];
        if (!fullHand.length) return null;
        if (dealer.hole_card_hidden) {
            return fullHand[1] || null;
        }
        return fullHand[0] || null;
    }

    /**
     * Convert a card dictionary to its numeric value for strategy heuristics
     */
    getCardNumericValue(card) {
        if (!card || !card.rank) return null;
        const rank = card.rank;
        if (rank === 'A') return 11;
        if (['K', 'Q', 'J', '10'].includes(rank)) return 10;
        return parseInt(rank, 10) || null;
    }

    /**
     * Create a short label for a card (e.g., "Ace", "10", "7")
     */
    formatCardLabel(card) {
        if (!card || !card.rank) return '';
        if (card.rank === 'A') return 'Ace';
        if (['K', 'Q', 'J'].includes(card.rank)) return 'Face card';
        return card.rank;
    }

    /**
     * Check if a hand is "soft" (contains an Ace counted as 11)
     * This is a simplified client-side check for heckler logic
     */
    isSoftHand(hand) {
        if (!hand || !hand.cards) return false;
        let total = 0;
        let aces = 0;
        hand.cards.forEach(card => {
            if (card.rank === 'A') {
                total += 11;
                aces += 1;
            } else if (['K', 'Q', 'J', '10'].includes(card.rank)) {
                total += 10;
            } else {
                const parsed = parseInt(card.rank, 10);
                total += Number.isNaN(parsed) ? 0 : parsed;
            }
        });
        let acesAsEleven = aces;
        while (total > 21 && acesAsEleven > 0) {
            total -= 10;
            acesAsEleven -= 1;
        }
        return acesAsEleven > 0;
    }

    /**
     * Evaluate whether a hit decision deserves heckling
     */
    evaluateHitDecision(hand, dealerCard) {
        if (!hand || !dealerCard || !this.hecklerManager) {
            return { shouldHeckle: false, message: null };
        }
        const total = hand.value ?? 0;
        const isSoft = this.isSoftHand(hand);
        const dealerValue = this.getCardNumericValue(dealerCard);
        const dealerLabel = this.formatCardLabel(dealerCard);

        if (!isSoft && total >= 17) {
            const template = this.hecklerManager.pickRandomMessage('hard17');
            return {
                shouldHeckle: !!template,
                message: this.hecklerManager.formatHecklerMessage(template, { total })
            };
        }

        const dealerShowingBustCard = dealerValue !== null && dealerValue >= 2 && dealerValue <= 6;
        if (!isSoft && dealerShowingBustCard && total >= 13 && total <= 16) {
            const template = this.hecklerManager.pickRandomMessage('dealerBustCard');
            return {
                shouldHeckle: !!template,
                message: this.hecklerManager.formatHecklerMessage(template, { total, dealerCard: dealerLabel })
            };
        }

        if (!isSoft && dealerShowingBustCard && total === 12) {
            const template = this.hecklerManager.pickRandomMessage('dealerBustCard');
            return {
                shouldHeckle: !!template,
                message: this.hecklerManager.formatHecklerMessage(template, { total, dealerCard: dealerLabel })
            };
        }

        if (isSoft && total >= 19) {
            const template = this.hecklerManager.pickRandomMessage('softHigh');
            return {
                shouldHeckle: !!template,
                message: this.hecklerManager.formatHecklerMessage(template, { total })
            };
        }

        return { shouldHeckle: false, message: null };
    }

    /**
     * Evaluate if standing is a bad decision (for heckler)
     */
    evaluateStandDecision(hand) {
        if (!hand || !this.hecklerManager) {
            return { shouldHeckle: false, message: null };
        }
        const total = hand.value ?? 0;
        
        // Standing with 11 or less is always a bad play
        if (total <= 11) {
            const template = this.hecklerManager.pickRandomMessage('standLow');
            return {
                shouldHeckle: !!template,
                message: this.hecklerManager.formatHecklerMessage(template, { total })
            };
        }

        return { shouldHeckle: false, message: null };
    }

    /**
     * Show the heckler popover with disdainful commentary
     */
    showHecklerMessage(message) {
        if (!message) return;
        const container = document.querySelector('.player-area');
        if (!container) return;

        const token = Symbol('heckle');
        this.activeHecklerToken = token;

        this.stopHecklerSpeech();

        if (this.hecklerTimeout) {
            clearTimeout(this.hecklerTimeout);
            this.hecklerTimeout = null;
        }
        if (this.hecklerRemoveTimeout) {
            clearTimeout(this.hecklerRemoveTimeout);
            this.hecklerRemoveTimeout = null;
        }

        if (!this.hecklerElement) {
            this.hecklerElement = document.createElement('div');
            this.hecklerElement.className = 'heckler-popover';
            this.hecklerElement.textContent = message;
            container.appendChild(this.hecklerElement);
            const animateIn = () => {
                if (this.hecklerElement) {
                    this.hecklerElement.classList.add('visible');
                }
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(animateIn);
            } else {
                setTimeout(animateIn, 16);
            }
        } else {
            this.hecklerElement.textContent = message;
            this.hecklerElement.classList.remove('fade-out');
            this.hecklerElement.classList.add('visible');
        }

        const spoke = this.speakHecklerLine(message, token);
        if (!spoke) {
            this.hecklerTimeout = setTimeout(() => {
                if (this.activeHecklerToken === token) {
                    this.hideHecklerMessage(token);
                }
            }, 5000);
        }
    }

    /**
     * Hide and remove the heckler popover
     */
    hideHecklerMessage(token = null) {
        if (token && token !== this.activeHecklerToken) {
            return;
        }
        if (!this.hecklerElement) {
            if (!token || token === this.activeHecklerToken) {
                this.activeHecklerToken = null;
            }
            return;
        }
        this.hecklerElement.classList.add('fade-out');
        this.hecklerTimeout = null;
        this.stopHecklerSpeech();
        this.hecklerRemoveTimeout = setTimeout(() => {
            if (this.hecklerElement && this.hecklerElement.parentElement) {
                this.hecklerElement.parentElement.removeChild(this.hecklerElement);
            }
            this.hecklerElement = null;
            this.hecklerRemoveTimeout = null;
            if (!token || token === this.activeHecklerToken) {
                this.activeHecklerToken = null;
            }
        }, 300);
    }

    /**
     * Initialize the game
     */
    async init() {
        // Initialize card managers
        this.playerHandManager = new CardManager('#player-hand');
        this.dealerHandManager = new CardManager('#dealer-hand');
        
        // Setup status element
        this.actionStatusElement = document.getElementById('action-status');
        
        // Setup chip selection
        this.setupChipSelection();
        const storedBankroll = this.stateManager.loadBankrollConfig();
        this.setBankrollAmount(storedBankroll, { persist: false });
        this.initSettingsPanel();
        this.setupKeyboardHotkeys();
        
        // Initial heckler setup is done in HecklerManager and SettingsManager
        
        // Wire insurance buttons
        const insuranceBtn = document.getElementById('insurance-btn');
        const insuranceDecline = document.getElementById('insurance-decline');
        if (insuranceBtn) {
            insuranceBtn.addEventListener('click', async () => {
                const decision = insuranceBtn.dataset.decision || 'buy';
                await this.sendInsuranceDecision(decision);
            });
        }
        if (insuranceDecline) {
            insuranceDecline.addEventListener('click', async () => {
                await this.sendInsuranceDecision('decline');
            });
        }
        
        // Initialize table sign with default values
        this.ui.updateTableSign();
        
        // Log Hand button
        const logHandBtn = document.getElementById('log-hand-btn');
        if (logHandBtn) {
            logHandBtn.addEventListener('click', () => this.handleLogHand());
        }
        
        // View LogHand.log button
        const viewLogHandBtn = document.getElementById('view-log-hand-btn');
        if (viewLogHandBtn) {
            viewLogHandBtn.addEventListener('click', () => this.openLogHandViewer());
        }
        // Download LogHand.log link
        const downloadLogHandLink = document.getElementById('download-log-hand-link');
        if (downloadLogHandLink) {
            downloadLogHandLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.downloadLogHand();
            });
        }
        
        // Clear Log Hand button
        const clearLogHandBtn = document.getElementById('clear-log-hand-btn');
        if (clearLogHandBtn) {
            clearLogHandBtn.addEventListener('click', () => this.clearLogHand());
        }

        const shuffleTriggerBtn = document.getElementById('shuffle-trigger-btn');
        if (shuffleTriggerBtn) {
            shuffleTriggerBtn.addEventListener('click', () => {
                this.ui.handleShuffleOverlay({
                    id: `manual-${Date.now()}`,
                    reason: 'manual'
                });
            });
        }
        
        // Enable chip buttons initially
        document.querySelectorAll('.chip').forEach(chip => {
            chip.disabled = false;
        });
        
        // Start new game (with error handling)
        try {
            await this.newGame();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.ui.showMessage('Game initialization failed. Please refresh the page.', 'error');
        }
    }

    async sendInsuranceDecision(decision) {
        if (!this.gameId) return;
        try {
            this.ui.showLoading();
            const result = await this.apiClient.requestInsurance({
                game_id: this.gameId,
                decision
            });
            if (result.success) {
                // If dealer peeked, show peek animation before updating state
                if (result.dealer_peeked) {
                    await this.ui.animateDealerPeek();
                }
                this.updateGameState(result.game_state);
                // If game ended due to dealer blackjack, end the round
                if (result.game_over) {
                    await this.endGame();
                }
            } else {
                this.ui.showMessage(result.error || 'Insurance action failed', 'error');
            }
        } catch (e) {
            // error surfaced by ApiClient
        } finally {
            this.ui.hideLoading();
            this.ui.updateButtonStates();
        }
    }

    /**
     * Setup keyboard hotkeys for quick game actions
     */
    setupKeyboardHotkeys() {
        // Log hotkeys to console for user reference
        console.log('%c⌨️ KEYBOARD HOTKEYS AVAILABLE', 'color: #FFD700; font-size: 14px; font-weight: bold');
        console.log('%cH%c = Hit', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cS%c = Stand', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cR%c = Surrender', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cD%c = Deal Cards', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%c1%c = Bet $100', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%c5%c = Bet $500', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cI%c = Insurance', 'color: #FFD700; font-weight: bold', 'color: #fff');
        
        document.addEventListener('keydown', (event) => {
            // Don't trigger hotkeys if user is typing in an input field
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = event.key.toLowerCase();

            switch(key) {
                case 'h':
                    this.log('⌨️ Hotkey: Hit (H)', 'action');
                    this.playerHit();
                    break;
                case 's':
                    this.log('⌨️ Hotkey: Stand (S)', 'action');
                    this.playerStand();
                    break;
                case 'r':
                    this.log('⌨️ Hotkey: Surrender (R)', 'action');
                    this.playerSurrender();
                    break;
                case 'd':
                    this.log('⌨️ Hotkey: Deal Cards (D)', 'action');
                    this.dealCards();
                    break;
                case '1':
                    this.log('⌨️ Hotkey: $100 Bet (1)', 'action');
                    this.selectChip(100);
                    this.addToBet(100);
                    break;
                case '5':
                    this.log('⌨️ Hotkey: $500 Bet (5)', 'action');
                    this.selectChip(500);
                    this.addToBet(500);
                    break;
                case 'i':
                    // Check if insurance is available
                    const insuranceBtn = document.getElementById('insurance-btn');
                    const insuranceAvailable = insuranceBtn && 
                        !insuranceBtn.classList.contains('disabled') && 
                        insuranceBtn.style.display !== 'none' &&
                        this.gameState && 
                        (this.gameState.insurance_offer_active || this.gameState.even_money_offer_active);
                    if (insuranceAvailable) {
                        this.log('⌨️ Hotkey: Insurance (I)', 'action');
                        const decision = insuranceBtn.dataset.decision || 'buy';
                        this.sendInsuranceDecision(decision);
                    }
                    break;
                case 'n':
                    // Check if "No thanks" button is available
                    const declineBtn = document.getElementById('insurance-decline');
                    const declineAvailable = declineBtn && 
                        declineBtn.style.display !== 'none' &&
                        this.gameState && 
                        (this.gameState.insurance_offer_active || this.gameState.even_money_offer_active);
                    if (declineAvailable) {
                        this.log('⌨️ Hotkey: No thanks (N)', 'action');
                        this.sendInsuranceDecision('decline');
                    }
                    break;
                default:
                    // Ignore other keys
                    break;
            }
        });
    }

    /**
     * Setup chip selection handlers
     */
    setupChipSelection() {
        // Default bet is already loaded from localStorage in constructor
        // Just update the visual display
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const value = parseInt(e.currentTarget.dataset.value);
                this.selectChip(value);
            });
            
            // Add right-click context menu for setting default bet
            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const value = parseInt(e.currentTarget.dataset.value);
                this.setDefaultBet(value);
            });
        });
        
        // Update visual indicators
        this.updateDefaultBetDisplay();
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
        
        // Validate against table limits before adding
        const limits = this.gameState?.table_limits || { min_bet: 5, max_bet: 500 };
        const newBetAmount = this.currentBet + value;
        
        if (newBetAmount > limits.max_bet) {
            this.ui.showMessage(`Maximum bet is $${limits.max_bet}`, 'error');
            return;
        }
        
        // Add the chip value to current bet
        this.currentBet += value;
        this.updateBetDisplay();
        
        // Update chip button states after bet change
        if (this.gameState?.table_limits) {
            this.updateChipButtonStates(this.gameState.table_limits);
        }
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
        
        // Update chip button states after clearing bet
        if (this.gameState?.table_limits) {
            this.updateChipButtonStates(this.gameState.table_limits);
        }
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
     * Start a new game round (preserves balance)
     */
    async newGame() {
        try {
            this.ui.showLoading();
            this.clearBet();
            this.clearHands();
            this.ui.hideGameControls();
            this.ui.showBettingArea(); // Enable betting area for new game
            
            // If we have an existing game, continue it (preserves balance)
            // Otherwise create a new game with $1000
            const requestData = this.gameId ? 
                { game_id: this.gameId } : 
                { starting_chips: 1000, dealer_hits_soft_17: this.dealerHitsSoft17 };
            
            const result = await this.apiClient.startNewGame(requestData);
            
            if (result.success) {
                this.gameId = result.game_id;
                this.loggedRoundId = null; // Reset logged round when starting new game
                this.updateGameState(result.game_state);
                this.previousBalance = 1000; // Reset tracking for fresh start
                this.lastInsuranceOutcomeSig = null;
                this.insuranceAnnouncedForGameId = null;
                this.ui.updateButtonStates();
                this.ui.showMessage('Bankroll refreshed! Place your bet to start!');
                this.log('Bankroll refreshed - new game with $1000', 'success');
            }
        } catch (error) {
            this.log(`New game error: ${error.message}`, 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Refresh bankroll - reset balance to $1000 (creates completely new game)
     */
    async refreshBankroll() {
        try {
            const { amount: bankrollAmount } = this.stateManager.normalizeBankrollAmount(
                this.bankrollAmount,
                this.defaultBankrollAmount
            );

            if (bankrollAmount !== this.bankrollAmount) {
                this.setBankrollAmount(bankrollAmount);
            }

            this.ui.showLoading();
            this.clearBet();
            this.clearHands();
            this.ui.hideGameControls();
            this.ui.showBettingArea();

            const result = await this.apiClient.startNewGame({
                starting_chips: bankrollAmount,
                dealer_hits_soft_17: this.dealerHitsSoft17
            });

            if (result.success) {
                this.gameId = result.game_id;
                this.updateGameState(result.game_state);
                this.previousBalance = bankrollAmount; // Reset tracking for fresh start
                this.insuranceAnnouncedForGameId = null;
                this.ui.updateButtonStates();
                this.ui.showMessage(`Bankroll refreshed! Starting with $${bankrollAmount.toLocaleString()}. Place your bet to start!`);
                this.log(`Bankroll refreshed - new game with $${bankrollAmount.toLocaleString()}`, 'success');
            }
        } catch (error) {
            const errorMessage = error?.message || 'Error refreshing bankroll';
            this.log(`Refresh bankroll error: ${errorMessage}`, 'error');
            this.ui.showMessage(errorMessage, 'error');
        } finally {
            this.ui.hideLoading();
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
            this.ui.showMessage('Please select a bet amount', 'error');
            return false;
        }

        // Validate against table limits
        const limits = this.gameState?.table_limits || { min_bet: 5, max_bet: 500 };
        if (amount < limits.min_bet) {
            this.ui.showMessage(`Minimum bet is $${limits.min_bet}`, 'error');
            return false;
        }
        if (amount > limits.max_bet) {
            this.ui.showMessage(`Maximum bet is $${limits.max_bet}`, 'error');
            return false;
        }
        
        // Track balance before bet
        const balanceBeforeBet = this.gameState?.player?.chips || this.previousBalance || 1000;
        
        try {
            this.ui.showLoading();
            const result = await this.apiClient.placeBet({
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
                
                this.ui.updateButtonStates();
                return true;
            } else {
                this.ui.showMessage(result.error || 'Bet failed', 'error');
                return false;
            }
        } catch (error) {
            return false;
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Deal initial cards
     */
    async dealCards() {
        if (this.isProcessing) {
            this.log('DEAL DENIED: Another action is still processing', 'warn');
            return;
        }

        // Ensure we have the latest game state before starting a new deal
        const safeStates = ['betting', 'game_over'];
        if (!this.gameState || !safeStates.includes(this.gameState.state)) {
            try {
                await this.updateGameStateFromServer();
            } catch (error) {
                this.log(`Failed to sync game state before dealing: ${error.message}`, 'error');
            }
        }

        const stateBeforeDeal = this.gameState?.state;
        if (stateBeforeDeal && !safeStates.includes(stateBeforeDeal)) {
            this.log(`DEAL DENIED: Game state is "${stateBeforeDeal}", expected betting or game_over`, 'warn');
            this.ui.showMessage('Finish the current hand before dealing again.', 'warn');
            return;
        }

        this.log('Starting dealCards process', 'deal');
        this.ui.setActionStatus('dealing cards');
        
        // Auto-place default bet if no bet and default bet is set
        if (this.currentBet <= 0 && this.defaultBetAmount) {
            this.log(`📌 Auto-placing default bet: $${this.defaultBetAmount}`, 'action');
            this.currentBet = this.defaultBetAmount;
            this.updateBetDisplay();
        }
        
        if (this.currentBet <= 0) {
            this.log('DEAL DENIED: No bet placed', 'warn');
            this.ui.showMessage('Please place a bet first', 'error');
            return;
        }
        
        if (!this.gameId) {
            this.log('DEAL DENIED: No gameId', 'warn');
            this.ui.showMessage('Please start a new game', 'error');
            return;
        }
        
        // Immediately disable betting area once deal starts
        this.ui.hideBettingArea();
        
        try {
            this.ui.showLoading();
            
            // If game is already over, reset it for a new round (same game, same balance)
            // BUT preserve the current bet if user already placed one
            const betToPreserve = this.currentBet;
            if (this.gameState && this.gameState.state === 'game_over') {
                this.log('Previous round finished, resetting for new round...', 'action');
                try {
                    // Call new_game API with existing game_id to continue same game (preserves balance)
                    const result = await this.apiClient.startNewGame({
                        game_id: this.gameId
                    });
                    
                    if (result.success) {
                        this.gameId = result.game_id;
                        this.insuranceAnnouncedForGameId = null;
                        this.loggedRoundId = null; // Reset logged round when starting new round
                        this.updateGameState(result.game_state);
                        this.clearHands();
                        this.ui.hideGameControls();
                        this.ui.showBettingArea();
                        
                        // Restore the bet if user had placed one
                        if (betToPreserve > 0) {
                            this.currentBet = betToPreserve;
                            this.log(`Preserved bet: $${this.currentBet}`, 'action');
                        }
                        
                        this.ui.updateButtonStates();
                        this.log('Game reset for new round (balance preserved)', 'success');
                    } else {
                        throw new Error(result.error || 'Failed to reset game');
                    }
                } catch (error) {
                    this.log(`ERROR resetting game: ${error.message}`, 'error');
                    this.ui.showMessage('Error resetting game', 'error');
                    return;
                }
            }
            
            this.log(`Placing bet: $${this.currentBet}`, 'action');
            
            // Place bet if not already placed
            if (this.currentBet > 0) {
                const betPlaced = await this.placeBet(this.currentBet);
                if (!betPlaced) {
                    this.log('Bet placement failed', 'error');
                    // Error message already shown by placeBet() method
                    return;
                }
                this.log(`Bet placed successfully: $${this.currentBet}`, 'success');
            }
            
            this.log(`Dealing cards for game ${this.gameId}`, 'deal');
            console.log('🎲 DEALING CARDS:');
            console.log('   Game ID:', this.gameId);
            console.log('   Force player hand before deal:', this.gameState?.force_player_hand);
            console.log('   Force dealer hand before deal:', this.gameState?.force_dealer_hand);
            
            const result = await this.apiClient.deal({
                game_id: this.gameId
            });
            
            console.log('📥 Deal API response:', result);
            
            if (result.success) {
                this.log('Deal API call successful', 'success');
                console.log('✅ Deal successful');
                console.log('   Result game_state force_player_hand:', result.game_state?.force_player_hand);
                console.log('   Player hands:', result.game_state?.player?.hands);
                if (result.game_state?.player?.hands?.[0]?.cards) {
                    const cards = result.game_state.player.hands[0].cards;
                    console.log('   Player cards received:', cards.map(c => `${c.rank} of ${c.suit}`));
                }
                this.updateGameState(result.game_state);
                this.renderHands();
                
                // If dealer peeked (10-value upcard), show peek animation
                if (result.dealer_peeked) {
                    await this.ui.animateDealerPeek();
                    // Update state again after peek animation
                    await this.updateGameStateFromServer();
                    this.renderHands();
                }
                
                this.ui.hideBettingArea();
                this.ui.showGameControls();
                this.ui.updateButtonStates();
                
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
                
                // Debug: Log forced player hand state
                console.log('🎲 After dealing cards:');
                console.log('   force_player_hand:', this.gameState.force_player_hand);
                console.log('   Player hands:', this.gameState.player?.hands);
                if (this.gameState.player?.hands?.[0]?.cards) {
                    const playerCards = this.gameState.player.hands[0].cards;
                    console.log('   Player cards received:', playerCards.map(c => `${c.rank} of ${c.suit}`));
                }
                
                // Check if game ended immediately (blackjack or dealer blackjack)
                if (this.gameState.state === 'game_over') {
                    const result = this.gameState.result;
                    this.log(`Game ended immediately after deal. Result: ${result}`, 'action');
                    
                    // Show result message based on outcome
                    if (result === 'blackjack') {
                        this.log('Player wins with BLACKJACK!', 'win');
                        await this.ui.showBlackjackCelebration();
                        // Calculate blackjack win amount (3:2 payout = 1.5x bet profit)
                        const handsArray = this.gameState?.player?.hands || [];
                        let totalBet = 0;
                        if (handsArray.length > 0) {
                            totalBet = handsArray.reduce((sum, hand) => sum + (hand.bet || 0), 0);
                        } else {
                            totalBet = this.currentBet || 0;
                        }
                        const blackjackProfit = Math.floor(totalBet * 1.5);
                        const formattedBlackjackProfit = blackjackProfit > 0 ? blackjackProfit.toLocaleString() : '0';
                        this.ui.showMessage(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉`, 'win');
                    } else if (result === 'push') {
                        this.log('Round ends in PUSH (tie)', 'action');
                        this.ui.showMessage("It's a Push - Tie!", 'info');
                    } else if (result === 'loss') {
                        this.log('Player loses - Dealer has BLACKJACK', 'bust');
                        this.ui.showMessage('Dealer Blackjack - You Lose', 'error');
                    } else if (result === 'win') {
                        this.log('Player wins the round', 'win');
                        this.ui.showMessage('You Win! 🎉', 'win');
                    }
                    
                    // Disable game controls and show new game button
                    this.ui.hideGameControls();
                    this.ui.showBettingArea();
                } else {
                    // Game continues - show Your Turn
                    this.log('Player turn begins', 'action');
                    this.ui.showMessage('Your turn!');
                }
            } else {
                this.log(`Deal failed: ${result.error || result.message}`, 'error');
                this.ui.showMessage(result.error || result.message || 'Deal failed', 'error');
                this.ui.hideGameControls();
                this.ui.showBettingArea();
            }
        } catch (error) {
            this.log(`Deal error: ${error.message}`, 'error');
            this.ui.showMessage(`Error: ${error.message}`, 'error');
            this.ui.hideGameControls();
            this.ui.showBettingArea();
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Player hits
     */
    async playerHit() {
        if (!this.gameId) {
            this.log('HIT DENIED: No gameId', 'warn');
            return;
        }
        
        if (this.isProcessing) {
            this.log('HIT DENIED: Already processing another action', 'warn');
            return;
        }
        
        if (this.gameState?.state !== 'player_turn') {
            this.log(`HIT DENIED: Game state is "${this.gameState?.state}", not "player_turn"`, 'warn');
            return;
        }

        const handsBeforeHit = this.gameState?.player?.hands || [];
        const requestedIndexBeforeHit = this.gameState?.player?.current_hand_index || 0;
        const safeIndexBeforeHit = (requestedIndexBeforeHit < handsBeforeHit.length) ? requestedIndexBeforeHit : Math.max(0, handsBeforeHit.length - 1);
        const currentHandBeforeHit = handsBeforeHit[safeIndexBeforeHit] || null;
        const currentValue = currentHandBeforeHit?.value || 0;
        this.log(`Player attempting HIT (current value: ${currentValue})`, 'hit');
        this.ui.setActionStatus('taking hit');
        
        const dealerUpCard = this.getDealerUpCard();
        const heckleAssessment = this.evaluateHitDecision(currentHandBeforeHit, dealerUpCard);
        if (heckleAssessment.shouldHeckle && heckleAssessment.message) {
            this.log(`Heckler triggered: ${heckleAssessment.message}`, 'warn');
            this.showHecklerMessage(heckleAssessment.message);
        }
        
        try {
            this.ui.showLoading();
            const result = await this.apiClient.hit({
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
                            this.ui.showMessage('Error: No hand data received', 'error');
                            return;
                        }
                    } catch (refreshError) {
                        this.log(`ERROR refreshing game state: ${refreshError.message}`, 'error');
                        this.ui.showMessage('Error: Could not refresh game state', 'error');
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
                    this.ui.showMessage('Error: No hand data received', 'error');
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
                        const playerHitDelay = Math.max(0, Number.isFinite(this.playerHitDelayMs) ? this.playerHitDelayMs : this.defaultPlayerHitDelayMs);
                        const delay = index * playerHitDelay;
                        this.playerHandManager.dealCard(card, false, delay);
                    });
                } else {
                    this.log('ERROR: No cards in player hand after hit', 'error');
                    this.log(`Hand structure: ${JSON.stringify(handToUse)}`, 'error');
                    this.ui.showMessage('Error: No cards received', 'error');
                }
                
                // Check for 5 Card Charlie first (before bust check)
                if (result.charlie) {
                    this.log(`🎉 5 CARD CHARLIE! You win! (Value: ${handToUse.value})`, 'win');
                    this.ui.showMessage('5 Card Charlie! You win!', 'win');
                    if (result.game_over) {
                        await this.endGame();
                    }
                } else if (handToUse.is_bust) {
                    this.log(`PLAYER BUSTED! Final value: ${handToUse.value}`, 'bust');
                    this.ui.showMessage(`Bust! You lose. (Value: ${handToUse.value})`, 'error');
                    await this.endGame();
                } else if (handToUse.is_blackjack) {
                    this.log('Player got BLACKJACK after hit!', 'win');
                    this.ui.showMessage('Blackjack!', 'win');
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
                this.ui.showMessage(result.error || result.message || 'Hit failed', 'error');
            }
        } catch (error) {
            this.log(`Hit error: ${error.message}`, 'error');
            this.ui.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            // hideLoading() will set isProcessing = false and call updateButtonStates()
            this.ui.hideLoading();
        }
    }

    /**
     * Player stands
     */
    async playerStand() {
        if (!this.gameId) {
            this.log('STAND DENIED: No gameId', 'warn');
            return;
        }
        
        if (this.isProcessing) {
            this.log('STAND DENIED: Already processing another action', 'warn');
            return;
        }
        
        const playerHand = this.gameState?.player?.hands?.[this.gameState.player.current_hand_index];
        const playerValue = playerHand?.value || 0;
        this.log(`Player STANDS with value: ${playerValue}`, 'action');
        this.ui.setActionStatus('standing');
        
        // Check if standing is a bad decision (11 or less)
        const heckleAssessment = this.evaluateStandDecision(playerHand);
        if (heckleAssessment.shouldHeckle && heckleAssessment.message) {
            this.log(`Heckler triggered: ${heckleAssessment.message}`, 'warn');
            this.showHecklerMessage(heckleAssessment.message);
        }
        
        try {
            this.ui.showLoading();
            const result = await this.apiClient.stand({
                game_id: this.gameId
            });
            
            if (result.success) {
                this.log('Stand API call successful', 'success');
                this.updateGameState(result.game_state);
                this.ui.updateButtonStates();
                
                this.log(`After stand - State: ${this.gameState.state}, Result: ${this.gameState.result}`, 'action');
                
                const currentDealerCardCount = this.dealerHandManager?.getCount?.() || 0;
                const finalDealerHand = this.gameState?.dealer?.full_hand;
                const dealerNeedsPlayback = Array.isArray(finalDealerHand) && finalDealerHand.length > currentDealerCardCount;
                
                if (this.gameState.state !== 'game_over' || dealerNeedsPlayback) {
                    this.log('Dealer still has actions to display; invoking playDealerTurn()', 'action');
                    await this.playDealerTurn();
                } else {
                    this.log('Dealer hand already resolved; finalizing round immediately', 'action');
                    await this.endGame();
                }
            } else {
                this.log(`Stand failed: ${result.error || result.message}`, 'error');
                this.ui.showMessage(result.error || result.message || 'Stand failed', 'error');
            }
        } catch (error) {
            this.log(`Stand error: ${error.message}`, 'error');
            this.ui.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Player surrenders hand
     */
    async playerSurrender() {
        if (!this.gameId) {
            this.log('SURRENDER DENIED: No gameId', 'warn');
            return;
        }
        
        if (this.isProcessing) {
            this.log('SURRENDER DENIED: Already processing another action', 'warn');
            return;
        }
        
        const playerHand = this.gameState?.player?.hands?.[this.gameState.player.current_hand_index];
        const betAmount = playerHand?.bet || 0;
        this.log(`Player SURRENDERS hand with bet: $${betAmount}`, 'action');
        this.ui.setActionStatus('surrendering');
        
        try {
            this.ui.showLoading();
            const result = await this.apiClient.surrender({
                game_id: this.gameId
            });
            
            if (result.success) {
                this.log('Surrender API call successful', 'success');
                this.updateGameState(result.game_state);
                this.ui.updateButtonStates();
                
                this.log(`After surrender - State: ${this.gameState.state}, Result: ${this.gameState.result}`, 'action');
                
                if (result.game_over) {
                    // If game is over, finalize immediately
                    await this.endGame();
                } else {
                    // If there are more hands, continue playing
                    this.log('More hands to play after surrender', 'action');
                }
                
                if (result.message) {
                    this.ui.showMessage(result.message, 'success');
                }
            } else {
                this.log(`Surrender failed: ${result.error || result.message}`, 'error');
                this.ui.showMessage(result.error || result.message || 'Surrender failed', 'error');
            }
        } catch (error) {
            this.log(`Surrender error: ${error.message}`, 'error');
            this.ui.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Player doubles down
     */
    async playerDoubleDown() {
        if (!this.gameId || this.isProcessing) return;
        
        this.ui.setActionStatus('double down');
        
        try {
            this.ui.showLoading();
            const result = await this.apiClient.doubleDown({
                game_id: this.gameId
            });
            
            if (result.success) {
                this.updateGameState(result.game_state);
                
                // Get the current hand after update
                const handsArray = this.gameState?.player?.hands || [];
                const requestedIndex = this.gameState?.player?.current_hand_index || 0;
                const safeIndex = (requestedIndex < handsArray.length) ? requestedIndex : Math.max(0, handsArray.length - 1);
                const playerHand = handsArray[safeIndex];
                
                if (playerHand && playerHand.cards && playerHand.cards.length > 0) {
                    // Clear and re-render all cards to ensure the new card is displayed
                    this.playerHandManager.clear();
                    playerHand.cards.forEach((card, index) => {
                        const playerHitDelay = Math.max(0, Number.isFinite(this.playerHitDelayMs) ? this.playerHitDelayMs : this.defaultPlayerHitDelayMs);
                        const delay = index * playerHitDelay;
                        this.playerHandManager.dealCard(card, false, delay);
                    });
                    
                    // Wait for card animation to complete before proceeding
                    const playerHitDelay = Math.max(0, Number.isFinite(this.playerHitDelayMs) ? this.playerHitDelayMs : this.defaultPlayerHitDelayMs);
                    const lastCardDelay = (playerHand.cards.length - 1) * playerHitDelay;
                    await new Promise(resolve => setTimeout(resolve, lastCardDelay + 300));
                } else {
                    // Fallback to renderHands if hand structure is unexpected
                    this.renderHands();
                }
                
                this.ui.updateButtonStates();
                
                // If current hand is from split aces, surface a clear hint
                if (playerHand?.is_from_split_aces) {
                    this.ui.setActionStatus('split aces: one card only', 4000);
                }
                
                // Double down automatically hits once and stands
                await this.playDealerTurn();
            } else {
                // Show error message if double down failed
                this.log(`Double down failed: ${result.error || result.message}`, 'error');
                this.ui.setActionStatus(result.error || result.message || 'Double down failed', 3000);
            }
        } catch (error) {
            this.log(`Double down error: ${error.message}`, 'error');
            this.ui.setActionStatus(`Error: ${error.message}`, 3000);
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Player splits
     */
    async playerSplit() {
        if (!this.gameId || this.isProcessing) return;
        
        this.ui.setActionStatus('splitting hand');
        
        try {
            this.ui.showLoading();
            const result = await this.apiClient.split({
                game_id: this.gameId
            });
            
            if (result.success) {
                this.updateGameState(result.game_state);
                this.renderHands();
                this.ui.updateButtonStates();
                this.ui.showMessage('Hand split! Continue playing.');
            }
        } catch (error) {
            this.log(`Split error: ${error.message}`, 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Play dealer turn
     */
    async playDealerTurn() {
        this.ui.showMessage('Dealer playing...');
        
        // Check if we're in auto mode - skip delays if so
        const isAutoMode = this.gameState?.auto_mode?.active || false;
        
        // Reveal dealer hole card
        if (this.dealerHandManager && this.dealerHandManager.getCount() > 0) {
            this.dealerHandManager.revealCard(0);
            // Small delay after revealing hole card (unless auto mode)
            if (!isAutoMode) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        // Get the final game state (dealer has already played on backend)
        await this.updateGameStateFromServer();
        
        // Get current dealer hand count before rendering new cards
        // After revealing hole card, we should have 2 cards (both visible)
        const currentDealerCardCount = this.dealerHandManager?.cards?.length || 0;
        const finalDealerHand = this.gameState?.dealer?.full_hand || [];
        
        // If dealer has more cards than currently displayed, render them progressively
        if (finalDealerHand.length > currentDealerCardCount) {
            const dealerHitDelay = Math.max(
                0,
                Number.isFinite(this.dealerHitDelayMs) ? this.dealerHitDelayMs : this.defaultDealerHitDelayMs
            );
            // Start rendering from the first new card (index = currentDealerCardCount)
            // This will be index 2 if dealer had 2 initial cards and is now hitting
            for (let i = currentDealerCardCount; i < finalDealerHand.length; i++) {
                const card = finalDealerHand[i];
                // Add delay before each new card (skip in auto mode)
                if (!isAutoMode && dealerHitDelay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, dealerHitDelay));
                }
                // Render the card with animation
                const delay = 0; // No delay for individual card animation
                this.dealerHandManager.dealCard(card, false, delay);
            }
        }
        
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
        this.ui.updateHandValues();
        
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
        
        const balance = this.gameState?.player?.chips || 0;
        const betAmount = this.currentBet || 0;
        
        // IMPORTANT: previousBalance should be the balance AFTER the bet was placed
        // because the bet is deducted when placed, not when the game ends
        const balanceAfterBet = this.previousBalance || 1000;
        
        // Calculate actual balance change (handles single hands, splits, blackjack, insurance)
        const balanceChange = balance - balanceAfterBet;
        
        if (result === 'win') {
            this.log('ROUND WINNER: PLAYER WINS!', 'win');
            
            // For regular wins (including 5-card Charlie), always calculate the amount won from bet amount (1:1 payout = 1x bet profit)
            // This is more reliable than using balanceChange which may be incorrect
            const handsArray = this.gameState?.player?.hands || [];
            let totalBet = 0;
            if (handsArray.length > 0) {
                totalBet = handsArray.reduce((sum, hand) => sum + (hand.bet || 0), 0);
            } else {
                totalBet = betAmount || 0;
            }
            // Regular win pays 1:1, so profit is 1x the bet (bet back + bet profit = 2x bet total, but profit is 1x bet)
            const winProfit = totalBet;
            const formattedWinProfit = winProfit > 0 ? winProfit.toLocaleString() : '0';
            
            // Check insurance outcome
            const insuranceOutcome = this.gameState?.insurance_outcome;
            if (insuranceOutcome && insuranceOutcome.amount > 0) {
                if (insuranceOutcome.paid === false) {
                    // Player won but insurance was lost (dealer didn't have blackjack)
                    const formattedInsuranceLoss = insuranceOutcome.amount.toLocaleString();
                    const winMessage = `You Win! +$${formattedWinProfit}`;
                    // Show win in green and insurance loss in red
                    this.ui.showMessageWithColors(`${winMessage} 🎉, `, '#28a745', `Ins Lost: $${formattedInsuranceLoss}`, '#dc3545');
                } else {
                    // Insurance was paid (shouldn't happen on a win, but handle it)
                    const formattedInsurance = insuranceOutcome.amount.toLocaleString();
                    const winMessage = `You Win! +$${formattedWinProfit}`;
                    // Show both in green
                    this.ui.showMessageWithColors(`${winMessage} 🎉, `, '#28a745', `Ins Paid: $${formattedInsurance}`, '#28a745');
                }
            } else {
                // No insurance involved
                const message = `You Win! +$${formattedWinProfit} 🎉`;
                this.ui.showMessage(message, 'win');
            }
        } else if (result === 'blackjack') {
            this.log('ROUND WINNER: PLAYER WINS WITH BLACKJACK!', 'win');
            await this.ui.showBlackjackCelebration();
            // For blackjack, always calculate the amount won from bet amount (3:2 payout = 1.5x bet profit)
            // This is more reliable than using balanceChange which may be incorrect
            const handsArray = this.gameState?.player?.hands || [];
            let totalBet = 0;
            if (handsArray.length > 0) {
                totalBet = handsArray.reduce((sum, hand) => sum + (hand.bet || 0), 0);
            } else {
                totalBet = betAmount || 0;
            }
            // Blackjack pays 3:2, so profit is 1.5x the bet
            const blackjackProfit = Math.floor(totalBet * 1.5);
            const formattedBlackjackProfit = blackjackProfit > 0 ? blackjackProfit.toLocaleString() : '0';
            
            // Check insurance outcome (unlikely but possible edge case)
            const insuranceOutcome = this.gameState?.insurance_outcome;
            if (insuranceOutcome && insuranceOutcome.amount > 0) {
                if (insuranceOutcome.paid === false) {
                    // Blackjack win but insurance was lost
                    const formattedInsuranceLoss = insuranceOutcome.amount.toLocaleString();
                    this.ui.showMessageWithColors(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉, `, '#28a745', `Ins Lost: $${formattedInsuranceLoss}`, '#dc3545');
                } else {
                    // Insurance was paid (shouldn't happen with blackjack, but handle it)
                    const formattedInsurance = insuranceOutcome.amount.toLocaleString();
                    this.ui.showMessageWithColors(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉, `, '#28a745', `Ins Paid: $${formattedInsurance}`, '#28a745');
                }
            } else {
                // No insurance involved
                this.ui.showMessage(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉`, 'win');
            }
        } else if (result === 'loss') {
            this.log('ROUND WINNER: DEALER WINS (Player loses)', 'bust');
            // Calculate total bet lost (for splits, sum all bets)
            const handsArray = this.gameState?.player?.hands || [];
            let totalBetLost = 0;
            if (handsArray.length > 0) {
                totalBetLost = handsArray.reduce((sum, hand) => sum + (hand.bet || 0), 0);
            } else {
                totalBetLost = betAmount;
            }
            const formattedLoss = totalBetLost.toLocaleString();
            
            // Check insurance outcome
            const insuranceOutcome = this.gameState?.insurance_outcome;
            if (insuranceOutcome && insuranceOutcome.amount > 0) {
                if (insuranceOutcome.paid === true) {
                    // Insurance was paid (dealer had blackjack)
                    const formattedInsurance = insuranceOutcome.amount.toLocaleString();
                    // Show loss in red and insurance payout in green
                    this.ui.showMessageWithColors(`Lost $${formattedLoss}, `, '#dc3545', `Ins Paid: $${formattedInsurance}`, '#28a745');
                } else {
                    // Insurance was lost (dealer didn't have blackjack)
                    const formattedInsuranceLoss = insuranceOutcome.amount.toLocaleString();
                    // Show both losses in red
                    this.ui.showMessageWithColors(`Lost $${formattedLoss}, `, '#dc3545', `Ins Lost: $${formattedInsuranceLoss}`, '#dc3545');
                }
            } else {
                // No insurance involved
                this.ui.showMessage(`You Lose -$${formattedLoss}`, 'error');
            }
        } else if (result === 'push') {
            this.log('ROUND RESULT: PUSH (Tie)', 'action');
            const insuranceOutcome = this.gameState?.insurance_outcome;
            if (insuranceOutcome && insuranceOutcome.amount > 0) {
                const formattedInsurance = insuranceOutcome.amount.toLocaleString();
                if (insuranceOutcome.paid === true) {
                    // Dealer had blackjack and insurance paid out even though final result pushed
                    this.ui.showMessageWithColors('Push - It\'s a tie! $0, ', '#ffd700', `Ins Paid: $${formattedInsurance}`, '#28a745');
                } else {
                    // Dealer did not have blackjack, insurance was lost
                    this.ui.showMessageWithColors('Push - It\'s a tie! $0, ', '#ffd700', `Ins Lost: $${formattedInsurance}`, '#dc3545');
                }
            } else {
                this.ui.showMessage('Push - It\'s a tie! $0', 'info');
            }
        } else {
            this.log(`ROUND ENDED: Unknown result "${result}"`, 'warn');
            this.ui.showMessage('Game Over', 'info');
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
        console.log('═══════════════════════════════════════════════════════');
        
        // Store balance for next round comparison
        this.previousBalance = balance;
        
        // Add to game history (keep only last 5)
        this.addGameHistory(result, betAmount, balance - balanceBeforeBet);
        
        this.log(`Game ended. Result: ${result}, New balance: $${balance}`, 'action');
        
        this.ui.hideGameControls();
        this.ui.showBettingArea();
        this.log('Ready for next round - adjust your bet and deal when ready', 'action');
    }

    /**
     * Update game state from server
     */
    async updateGameStateFromServer() {
        if (!this.gameId) return;
        
        try {
            const result = await this.apiClient.fetchGameState(this.gameId);
            if (result.success) {
                this.updateGameState(result.game_state);
                this.ui.updateButtonStates();
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
        
        // Update insurance UI
        this.updateInsuranceUI();
        this.ui.updateAutoStatusUI();
        this.ui.handleShuffleOverlay(state.shuffle_animation);
        
        // Update cut card display
        this.updateCutCardDisplay();
        
        // Update test mode indicator and input value
        this.updateTestModeIndicator();
        if (this.forceDlrHandInput && state.force_dealer_hand) {
            this.forceDlrHandInput.value = state.force_dealer_hand;
        } else if (this.forceDlrHandInput && !state.force_dealer_hand) {
            this.forceDlrHandInput.value = '';
        }
        if (this.forcePlayerHandInput && state.force_player_hand) {
            console.log('🔄 Updating force player hand input:', state.force_player_hand);
            this.forcePlayerHandInput.value = state.force_player_hand;
        } else if (this.forcePlayerHandInput && !state.force_player_hand) {
            console.log('🔄 Clearing force player hand input');
            this.forcePlayerHandInput.value = '';
        }
        console.log('📊 Game state update - force_player_hand:', state.force_player_hand);
        
        // Show/hide Log Hand button based on game state
        const logHandBtn = document.getElementById('log-hand-btn');
        if (logHandBtn) {
            // Show button whenever there's a completed round available to log
            const hasCompletedRound = state.has_completed_round || false;
            const latestRoundId = state.latest_round_id || null;
            
            // Show button only if there's a completed round that hasn't been logged yet
            const shouldShow = hasCompletedRound && latestRoundId !== null && latestRoundId !== this.loggedRoundId;
            
            if (shouldShow) {
                // New round available to log - show and enable the button
                logHandBtn.style.display = 'inline-block';
                logHandBtn.disabled = false;
            } else {
                // Round already logged or no completed round - hide the button
                logHandBtn.style.display = 'none';
                logHandBtn.disabled = false; // Reset disabled state for next round
            }
        }
        
        // Show insurance outcome if present
        const outcome = state.insurance_outcome;
        if (outcome) {
            const sig = `${outcome.paid}:${outcome.amount}`;
            if (sig !== this.lastInsuranceOutcomeSig) {
                if (outcome.paid) {
                    this.ui.setActionStatus(`insurance paid $${outcome.amount}`, 5000);
                    this.ui.showMessage(`Insurance paid $${outcome.amount}`, 'success');
                    this.addInsuranceHistory(true, outcome.amount);
                } else if (outcome.paid === false) {
                    this.ui.setActionStatus('insurance lost', 4000);
                    this.ui.showMessage('Insurance lost', 'error');
                    this.addInsuranceHistory(false, outcome.amount);
                }
                this.lastInsuranceOutcomeSig = sig;
            }
        }
        
        // Update hand values
        this.ui.updateHandValues();
        
        // Don't call updateButtonStates() here - it might be called while isProcessing is true
        // Call it explicitly after hideLoading() or when you know isProcessing is false
    }
    
    /**
     * Update test mode indicator (red dashed border) on dealer area
     */
    updateTestModeIndicator() {
        const dealerArea = document.querySelector('.dealer-area');
        const playerArea = document.querySelector('.player-area');
        
        const dealerTestMode = this.gameState?.force_dealer_hand && this.gameState.force_dealer_hand.trim();
        const playerTestMode = this.gameState?.force_player_hand && this.gameState.force_player_hand.trim();
        
        if (dealerArea) {
            if (dealerTestMode) {
                dealerArea.classList.add('test-mode');
            } else {
                dealerArea.classList.remove('test-mode');
            }
        }
        
        if (playerArea) {
            if (playerTestMode) {
                playerArea.classList.add('test-mode');
            } else {
                playerArea.classList.remove('test-mode');
            }
        }
    }

    updateInsuranceUI() {
        const container = document.getElementById('insurance-offer');
        const btn = document.getElementById('insurance-btn');
        const decline = document.getElementById('insurance-decline');
        if (!container || !btn || !decline || !this.gameState) return;
        
        const offerActive = !!this.gameState.insurance_offer_active;
        const evenMoney = !!this.gameState.even_money_offer_active;
        
        // Container is always visible
        container.style.display = 'flex';
        
        if (offerActive) {
            const cost = this.gameState.insurance_amount || 0;
            btn.textContent = `Insurance – pays 2:1 – cost: $${cost}`;
            btn.dataset.decision = 'buy';
            btn.classList.remove('disabled');
            btn.classList.add('active');
            btn.disabled = false;
            btn.setAttribute('aria-disabled', 'false');
            btn.title = 'Insurance available';
            decline.style.display = 'inline-block';
            this.ui.setActionStatus('insurance decision required');

            const announcementKey = this.gameId ?? '__no_game__';
            if (this.insuranceAnnouncedForGameId !== announcementKey) {
                this.insuranceAnnouncedForGameId = announcementKey;
                this.speakHecklerLine('Dealer is showing an ace, would you like insurance?', null);
            }
        } else if (evenMoney) {
            const hands = this.gameState.player?.hands || [];
            const idx = this.gameState.player?.current_hand_index || 0;
            const hand = hands[idx];
            const bet = hand?.bet || 0;
            btn.textContent = `Even money – pays 1:1 – payout: $${bet}`;
            btn.dataset.decision = 'even_money';
            btn.classList.remove('disabled');
            btn.classList.add('active');
            btn.disabled = false;
            btn.setAttribute('aria-disabled', 'false');
            btn.title = 'Even money available';
            decline.style.display = 'inline-block';
            this.ui.setActionStatus('even money available');
        } else {
            btn.textContent = 'Insurance – pays 2:1';
            btn.dataset.decision = '';
            btn.classList.add('disabled');
            btn.classList.remove('active');
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            btn.title = 'Available when dealer shows Ace';
            decline.style.display = 'none';
            // Clear action status when insurance offer is no longer active
            this.ui.clearActionStatus();
        }
    }

    /**
     * Update cut card display with current deck information
     */
    updateCutCardDisplay() {
        if (!this.gameState) return;

        const display = document.getElementById('cut-card-display');
        const countEl = document.getElementById('cut-card-count');
        const fillEl = document.getElementById('cut-card-fill');
        const warningEl = document.getElementById('cut-card-warning');
        
        if (!display || !countEl || !fillEl) return;

        const deckRemaining = this.gameState.deck_remaining || 312;
        const totalCards = this.gameState.total_cards || 312;
        const cutCardThreshold = this.gameState.cut_card_threshold || 156;
        const percentRemaining = this.gameState.percent_remaining || 100;
        const approachingCutCard = this.gameState.approaching_cut_card || false;

        // Update card count display
        countEl.textContent = `${deckRemaining} cards`;

        // Calculate progress bar width (percentage of deck remaining)
        const progressWidth = Math.max(0, Math.min(100, percentRemaining));
        fillEl.style.width = `${progressWidth}%`;

        // Determine color state based on card count
        display.classList.remove('warning', 'danger');
        
        if (deckRemaining <= cutCardThreshold) {
            // At or below cut card - reshuffle will happen
            display.classList.add('danger');
            if (warningEl) warningEl.style.display = 'block';
        } else if (approachingCutCard || deckRemaining <= 200) {
            // Approaching cut card
            display.classList.add('warning');
            if (warningEl && approachingCutCard) {
                warningEl.style.display = 'block';
            } else if (warningEl) {
                warningEl.style.display = 'none';
            }
        } else {
            // Well above cut card
            if (warningEl) warningEl.style.display = 'none';
        }

        // Update fill color based on proximity to cut card
        let fillColor = '';
        if (deckRemaining > 200) {
            // Green
            fillColor = 'linear-gradient(90deg, rgba(40, 167, 69, 0.8) 0%, rgba(40, 167, 69, 0.8) 100%)';
        } else if (deckRemaining > cutCardThreshold) {
            // Yellow to Orange gradient
            const progress = (deckRemaining - cutCardThreshold) / (200 - cutCardThreshold);
            if (progress > 0.5) {
                fillColor = 'linear-gradient(90deg, rgba(255, 193, 7, 0.8) 0%, rgba(255, 193, 7, 0.8) 100%)';
            } else {
                fillColor = 'linear-gradient(90deg, rgba(255, 152, 0, 0.8) 0%, rgba(255, 152, 0, 0.8) 100%)';
            }
        } else {
            // Red - reshuffle imminent
            fillColor = 'linear-gradient(90deg, rgba(220, 53, 69, 0.8) 0%, rgba(220, 53, 69, 0.8) 100%)';
        }
        
        fillEl.style.background = fillColor;
    }

    /**
     * Update table limits display
     */
    updateTableLimitsDisplay() {
        if (!this.gameState) return;

        const limitsEl = document.getElementById('table-limits-value');
        if (!limitsEl) return;

        const limits = this.gameState.table_limits || { min_bet: 5, max_bet: 500 };
        limitsEl.textContent = `$${limits.min_bet} - $${limits.max_bet}`;

        // Update chip button states based on limits and balance
        this.updateChipButtonStates(limits);
    }

    /**
     * Update chip button states based on table limits and balance
     */
    updateChipButtonStates(limits) {
        const chipButtons = document.querySelectorAll('.chip-tray .chip');
        const currentBet = this.currentBet || 0;
        const balance = this.gameState?.player?.chips || 0;
        const maxBet = limits.max_bet || 500;
        const minBet = limits.min_bet || 5;

        chipButtons.forEach(button => {
            const chipValue = parseInt(button.dataset.value) || 0;
            const newBetAmount = currentBet + chipValue;
            
            // Hide chips that are below minimum bet (can't use them for first bet anyway)
            // Only hide if no bet is placed yet - once you have a bet, you can add smaller chips
            const belowMinBet = currentBet === 0 && chipValue < minBet;
            
            if (belowMinBet) {
                // Hide chips below minimum bet when placing first bet
                button.style.display = 'none';
                return;
            } else {
                // Show the chip
                button.style.display = '';
            }
            
            // Disable if:
            // 1. Would exceed max bet
            // 2. Would exceed balance
            const wouldExceedMax = newBetAmount > maxBet;
            const wouldExceedBalance = newBetAmount > balance;
            
            if (wouldExceedMax || wouldExceedBalance) {
                button.disabled = true;
                button.classList.add('disabled');
                button.title = wouldExceedMax 
                    ? `Maximum bet is $${maxBet}`
                    : 'Insufficient funds';
            } else {
                button.disabled = false;
                button.classList.remove('disabled');
                button.title = '';
            }
        });
    }

    downloadAutoModeLog(logFilename) {
        if (!this.gameState?.game_id || !logFilename) {
            this.log('Cannot download log: missing game ID or filename', 'error');
            return;
        }
        const url = this.apiClient.getAutoModeLogUrl(this.gameState.game_id, logFilename);
        if (url) {
            window.location.href = url;
        } else {
            this.log('Unable to build auto mode log URL', 'error');
        }
    }

    async openAutoModeLogViewer(logFilename) {
        if (!this.gameState?.game_id || !logFilename) {
            this.ui.showMessage('Log viewer unavailable: missing game ID or filename', 'error');
            return;
        }

        try {
            this.ui.showLoading();
            const result = await this.apiClient.fetchAutoModeLogContent(this.gameState.game_id, logFilename);
            if (result?.success) {
                this.ui.showAutoModeLogViewer(result.content || '');
            } else {
                this.ui.showMessage(result?.error || result?.message || 'Failed to load auto mode log', 'error');
            }
        } catch (error) {
            this.ui.showMessage(error?.message || 'Failed to load auto mode log', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    copyAutoModeLogToClipboard() {
        const textarea = document.getElementById('auto-log-viewer-content');
        if (!textarea || !textarea.value) {
            this.ui.showMessage('Nothing to copy', 'warn');
            return;
        }

        try {
            navigator.clipboard.writeText(textarea.value).then(() => {
                this.ui.showMessage('Log copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback for older browsers
                textarea.select();
                document.execCommand('copy');
                this.ui.showMessage('Log copied to clipboard!', 'success');
            });
        } catch (error) {
            this.ui.showMessage('Failed to copy to clipboard', 'error');
        }
    }

    async handleLogHand() {
        if (!this.gameId) {
            this.ui.showMessage('No active game', 'error');
            return;
        }
        
        // Get current round_id before logging
        const currentRoundId = this.gameState?.latest_round_id;
        if (!currentRoundId) {
            this.ui.showMessage('No completed round to log', 'error');
            return;
        }
        
        // Check if this round has already been logged
        if (this.loggedRoundId === currentRoundId) {
            this.ui.showMessage('This hand has already been logged', 'warn');
            return;
        }
        
        try {
            this.ui.showLoading();
            const payload = {
                game_id: this.gameId
            };
            const result = await this.apiClient.logHand(payload);
            
            if (result.success) {
                // Mark this round as logged and hide the button
                this.loggedRoundId = currentRoundId;
                const logHandBtn = document.getElementById('log-hand-btn');
                if (logHandBtn) {
                    logHandBtn.style.display = 'none';
                    logHandBtn.disabled = false; // Reset for next round
                }
                this.ui.showMessage(result.message || 'Hand logged successfully', 'success');
                this.updateGameState(result.game_state);
            } else {
                this.ui.showMessage(result.error || result.message || 'Failed to log hand', 'error');
            }
        } catch (error) {
            this.ui.showMessage(error.message || 'Failed to log hand', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    downloadLogHand() {
        if (!this.gameId) {
            this.ui.showMessage('No active game', 'error');
            return;
        }
        
        const url = this.apiClient.getLogHandUrl(this.gameId);
        if (url) {
            window.location.href = url;
        } else {
            this.log('Unable to build hand log URL', 'error');
        }
    }

    async openLogHandViewer() {
        if (!this.gameId) {
            this.ui.showMessage('Log viewer unavailable: no active game', 'error');
            return;
        }

        try {
            this.ui.showLoading();
            const result = await this.apiClient.fetchLogHandContent(this.gameId);
            if (result?.success) {
                this.ui.showLogHandViewer(result.content || '');
            } else {
                this.ui.showMessage(result?.error || result?.message || 'Failed to load hand log', 'error');
            }
        } catch (error) {
            this.ui.showMessage(error?.message || 'Failed to load hand log', 'error');
        } finally {
            this.ui.hideLoading();
        }
    }

    async clearLogHand() {
        if (!this.gameId) {
            this.ui.showMessage('No active game', 'error');
            return;
        }
        
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to clear the LogHand.log file? This action cannot be undone.');
        if (!confirmed) {
            return;
        }
        
        try {
            this.ui.showLoading();
            const payload = {
                game_id: this.gameId
            };
            const result = await this.apiClient.clearLog(payload);
            
            if (result.success) {
                this.ui.showMessage(result.message || 'Log file cleared successfully', 'success');
            } else {
                this.ui.showMessage(result.error || result.message || 'Failed to clear log file', 'error');
            }
        } catch (error) {
            this.ui.showMessage(error.message || 'Failed to clear log file', 'error');
        } finally {
            this.ui.hideLoading();
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
        
        // Player hands
        if (this.gameState.player && Array.isArray(this.gameState.player.hands)) {
            const requestedIndex = this.gameState.player.current_hand_index || 0;
            const handsArray = this.gameState.player.hands;
            
            // Use safe index logic to prevent crashes if backend index is out of sync
            let handIndexToUse = 0;
            if (requestedIndex < handsArray.length) {
                handIndexToUse = requestedIndex;
            } else if (handsArray.length > 0) {
                // Fallback to last available hand if index is out of bounds
                handIndexToUse = Math.max(0, handsArray.length - 1);
                console.warn(`⚠️ Hand index ${requestedIndex} out of bounds (length: ${handsArray.length}), using ${handIndexToUse}`);
            }
            
            const hand = handsArray[handIndexToUse];
            
            if (hand && Array.isArray(hand.cards)) {
                // Only render if we cleared, OR if we have more cards than displayed
                const currentCardCount = this.playerHandManager.cards.length;
                if (currentCardCount === 0 || hand.cards.length > currentCardCount) {
                    // If re-rendering on game over or switching hands, clear first
                    if (currentCardCount > 0 && currentCardCount !== hand.cards.length) {
                        this.playerHandManager.clear();
                    }
                    
                    hand.cards.forEach(card => {
                        // Only add if not already present (simple check)
                        // For full robustness we might want to track card IDs
                        this.playerHandManager.dealCard(card, false, 0);
                    });
                }
            }
        }

        // Dealer hand
        if (this.gameState.dealer) {
            const dealer = this.gameState.dealer;
            
            // Determine which cards to show
            let cardsToShow = [];
            
            if (dealer.hole_card_hidden && Array.isArray(dealer.full_hand) && dealer.full_hand.length >= 2) {
                // Show first card hidden (back), second card visible
                // In CardManager, 'true' as second arg means hidden/face down
                
                // Logic update: The backend sends [hidden_card, visible_card]
                // We want to render: [FaceDown, VisibleCard]
                
                // Clear first to ensure correct state
                if (this.dealerHandManager.cards.length === 0) {
                    this.dealerHandManager.dealCard(dealer.full_hand[0], true, 0); // Hole card (hidden)
                    this.dealerHandManager.dealCard(dealer.full_hand[1], false, 0); // Up card (visible)
                }
            } else if (Array.isArray(dealer.full_hand)) {
                // Show all cards visible
                const currentCount = this.dealerHandManager.cards.length;
                if (currentCount === 0 || dealer.full_hand.length > currentCount) {
                    // If we have cards but count mismatches (e.g. hole card revealed), 
                    // we might need to clear to ensure correct order/visibility
                    // BUT, playDealerTurn handles the animation of revealing hole card.
                    // Here we just ensure consistency.
                    
                    if (currentCount === 0) {
                        dealer.full_hand.forEach(card => {
                            this.dealerHandManager.dealCard(card, false, 0);
                        });
                    } else {
                        // We have some cards. 
                        // If hole card was hidden but now isn't, we need to reveal it visually
                        // This is usually handled by dealerHandManager.revealCard(0) called in playDealerTurn
                        // So here we just add any NEW cards
                        for (let i = currentCount; i < dealer.full_hand.length; i++) {
                            this.dealerHandManager.dealCard(dealer.full_hand[i], false, 0);
                        }
                    }
                }
            }
        }
    }
}
