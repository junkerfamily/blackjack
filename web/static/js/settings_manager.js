export class SettingsManager {
    constructor(game) {
        this.game = game;
        this.boundOutsideClickHandler = null;
        this.boundEscapeHandler = null;
    }

    /**
     * Initialize settings panel
     */
    initSettingsPanel() {
        const game = this.game;
        try {
            game.settingsToggle = document.getElementById('settings-toggle');
            game.settingsPanel = document.getElementById('settings-panel');
            game.settingsCloseBtn = document.getElementById('settings-close');
            game.hecklerEnabledToggle = document.getElementById('heckler-enabled-toggle');
            game.hecklerVoiceSelect = document.getElementById('heckler-voice-select');
            game.hecklerSpeedRange = document.getElementById('heckler-speed-range');
            game.hecklerSpeedDisplay = document.getElementById('heckler-speed-display');
            game.hecklerTestButton = document.getElementById('heckler-test-button');
            game.trumpetTestButton = document.getElementById('trumpet-test-button');
            game.hecklerSettingsNote = document.getElementById('heckler-settings-note');
            game.bankrollSettingInput = document.getElementById('bankroll-setting-input');
            game.bankrollHelperElement = document.getElementById('bankroll-setting-helper');
            game.dealerDelayInput = document.getElementById('dealer-delay-input');
            game.dealerDelayHelperElement = document.getElementById('dealer-delay-helper');
            game.playerDelayInput = document.getElementById('player-delay-input');
            game.playerDelayHelperElement = document.getElementById('player-delay-helper');
            game.dealerHitsSoft17Toggle = document.getElementById('dealer-hits-soft17-toggle');
            game.forceDlrHandInput = document.getElementById('force-dlr-hand-input');
            game.forcePlayerHandInput = document.getElementById('force-player-hand-input');
            game.testPeekButton = document.getElementById('test-peek-btn');

            if (!game.settingsToggle || !game.settingsPanel) {
                console.warn('Settings panel elements not found in DOM');
                return;
            }

            // Bankroll Setting
            if (game.bankrollSettingInput) {
                game.setBankrollAmount(game.bankrollAmount, { persist: false });
                const applyBankrollChange = () => {
                    const result = game.setBankrollAmount(game.bankrollSettingInput.value);
                    if (result.fallbackUsed) {
                        game.bankrollSettingInput.value = result.previous;
                        game.log('Bankroll settings input was empty or invalid; keeping previous value.', 'warn');
                        return;
                    }

                    if (result.clamped) {
                        const clampMessage = result.clampedToMin
                            ? 'Minimum bankroll is $1'
                            : 'Maximum bankroll is $1,000,000';
                        game.ui.showMessage(clampMessage, 'warn');
                    }

                    if (result.amount !== result.previous) {
                        game.log(`Bankroll preference updated to $${result.amount.toLocaleString()}`, 'success');
                    }
                };
                game.bankrollSettingInput.addEventListener('change', applyBankrollChange);
            } else {
                console.warn('Bankroll setting input not found in settings panel');
            }

            // Dealer Delay Setting
            if (game.dealerDelayInput) {
                game.dealerDelayInput.value = game.dealerHitDelayMs;
                const applyDealerDelayChange = () => {
                    const result = game.setDealerHitDelay(game.dealerDelayInput.value);
                    if (result.fallbackUsed) {
                        game.dealerDelayInput.value = result.previous;
                        game.log('Dealer delay input was empty or invalid; keeping previous value.', 'warn');
                        return;
                    }

                    if (result.clamped) {
                        const clampMessage = result.clampedToMin
                            ? 'Minimum dealer delay is 0 ms'
                            : 'Maximum dealer delay is 5,000 ms';
                        game.ui.showMessage(clampMessage, 'warn');
                    }

                    if (result.delay !== result.previous) {
                        game.log(`Dealer card delay updated to ${result.delay} ms`, 'success');
                    }
                };
                game.dealerDelayInput.addEventListener('change', applyDealerDelayChange);
                game.dealerDelayInput.addEventListener('blur', applyDealerDelayChange);
            } else {
                console.warn('Dealer delay setting input not found in settings panel');
            }

            // Player Delay Setting
            if (game.playerDelayInput) {
                game.playerDelayInput.value = game.playerHitDelayMs;
                const applyPlayerDelayChange = () => {
                    const result = game.setPlayerHitDelay(game.playerDelayInput.value);
                    if (result.fallbackUsed) {
                        game.playerDelayInput.value = result.previous;
                        game.log('Player delay input was empty or invalid; keeping previous value.', 'warn');
                        return;
                    }

                    if (result.clamped) {
                        const clampMessage = result.clampedToMin
                            ? 'Minimum player delay is 0 ms'
                            : 'Maximum player delay is 5,000 ms';
                        game.ui.showMessage(clampMessage, 'warn');
                    }

                    if (result.delay !== result.previous) {
                        game.log(`Player card delay updated to ${result.delay} ms`, 'success');
                    }
                    game.ui.updatePlayerDelayHelper();
                };
                game.playerDelayInput.addEventListener('change', applyPlayerDelayChange);
                game.playerDelayInput.addEventListener('blur', applyPlayerDelayChange);
            } else {
                console.warn('Player delay setting input not found in settings panel');
            }

            // Dealer Hits Soft 17 Setting
            if (game.dealerHitsSoft17Toggle) {
                game.dealerHitsSoft17Toggle.checked = game.dealerHitsSoft17;
                game.dealerHitsSoft17Toggle.addEventListener('change', (event) => {
                    game.dealerHitsSoft17 = event.target.checked;
                    game.stateManager.saveDealerHitsSoft17(game.dealerHitsSoft17);
                    const statusMessage = game.dealerHitsSoft17
                        ? 'Dealer will hit on soft 17 (takes effect on next game)'
                        : 'Dealer will stand on all 17s (takes effect on next game)';
                    game.log(statusMessage, 'success');
                    game.ui.showMessage(statusMessage, 'info');
                    if (game.gameState) {
                        game.gameState.dealer_hits_soft_17 = game.dealerHitsSoft17;
                        game.ui.updateTableSign();
                    }
                });
            } else {
                console.warn('Dealer hits soft 17 toggle not found in settings panel');
            }

            // Force Dealer Hand (Test Mode)
            if (game.forceDlrHandInput) {
                const applyForceDlrHandChange = async () => {
                    const handString = game.forceDlrHandInput.value.trim();
                    if (!game.gameId) {
                        game.ui.showMessage('Please start a game first', 'warn');
                        return;
                    }
                    try {
                        const result = await game.apiClient.forceDealerHand({
                            game_id: game.gameId,
                            hand_string: handString || null
                        });
                        if (result.success) {
                            game.updateGameState(result.game_state);
                            game.updateTestModeIndicator();
                            const message = handString
                                ? `Test mode: Dealer hand forced to ${handString}`
                                : 'Test mode disabled';
                            game.log(message, 'success');
                        } else {
                            game.ui.showMessage(result.message || 'Failed to set forced dealer hand', 'error');
                        }
                    } catch (e) {
                        // Error handled by ApiClient
                    }
                };
                game.forceDlrHandInput.addEventListener('change', applyForceDlrHandChange);
                game.forceDlrHandInput.addEventListener('blur', applyForceDlrHandChange);
            } else {
                console.warn('Force dealer hand input not found in settings panel');
            }

            // Force Player Hand (Test Mode)
            if (game.forcePlayerHandInput) {
                const applyForcePlayerHandChange = async () => {
                    const handString = game.forcePlayerHandInput.value.trim();
                    console.log('🎯 Force Player Hand Input Changed:', handString);
                    if (!game.gameId) {
                        console.warn('⚠️ No game ID - cannot set forced player hand');
                        game.ui.showMessage('Please start a game first', 'warn');
                        return;
                    }
                    try {
                        console.log('📤 Sending force player hand request:', { game_id: game.gameId, hand_string: handString || null });
                        const result = await game.apiClient.forcePlayerHand({
                            game_id: game.gameId,
                            hand_string: handString || null
                        });
                        console.log('📥 Force player hand response:', result);
                        if (result.success) {
                            console.log('✅ Force player hand successful, updating game state');
                            console.log('   Game state force_player_hand:', result.game_state?.force_player_hand);
                            game.updateGameState(result.game_state);
                            game.updateTestModeIndicator();
                            const message = handString
                                ? `Test mode: Player hand forced to ${handString}`
                                : 'Test mode disabled';
                            game.log(message, 'success');
                        } else {
                            console.error('❌ Force player hand failed:', result.message || result.error);
                            game.ui.showMessage(result.message || 'Failed to set forced player hand', 'error');
                        }
                    } catch (e) {
                        console.error('❌ Force player hand error:', e);
                        // Error handled by ApiClient
                    }
                };
                game.forcePlayerHandInput.addEventListener('change', applyForcePlayerHandChange);
                game.forcePlayerHandInput.addEventListener('blur', applyForcePlayerHandChange);
            } else {
                console.warn('Force player hand input not found in settings panel');
            }

            // Test Peek Button
            if (game.testPeekButton) {
                game.testPeekButton.addEventListener('click', () => game.ui.handleTestPeekAnimation());
            } else {
                console.warn('Test peek animation button not found in settings panel');
            }

            game.ui.updateBankrollHelper();
            game.ui.updateDealerDelayHelper();
            game.ui.updatePlayerDelayHelper();

            // Heckler Settings - Delegate to HecklerManager
            if (game.hecklerManager) {
                if (game.hecklerEnabledToggle) {
                    game.hecklerEnabledToggle.checked = game.hecklerManager.voiceEnabled;
                    game.hecklerEnabledToggle.addEventListener('change', (event) => {
                        game.hecklerManager.voiceEnabled = event.target.checked;
                        game.hecklerManager.savePreferences();
                        const statusMessage = game.hecklerManager.voiceEnabled ? 'Voice commentary enabled' : 'Voice commentary disabled';
                        game.log(statusMessage, 'success');
                        if (game.hecklerManager.voiceEnabled) {
                            game.hecklerManager.previewVoice(true);
                        } else {
                            game.hecklerManager.stop();
                        }
                    });
                }

                if (game.hecklerTestButton) {
                    game.hecklerTestButton.addEventListener('click', () => {
                        game.hecklerManager.playVoiceTest();
                    });
                }

                if (game.hecklerSpeedRange) {
                    const hm = game.hecklerManager;
                    const clampedRate = Math.min(
                        parseFloat(game.hecklerSpeedRange.max || '1.6'),
                        Math.max(parseFloat(game.hecklerSpeedRange.min || '0.6'), hm.hecklerSpeechRate)
                    );
                    hm.hecklerSpeechRate = clampedRate;
                    game.hecklerSpeedRange.value = clampedRate;
                    this.updateSpeedDisplay(clampedRate);
                    game.hecklerSpeedRange.addEventListener('input', (event) => {
                        const rate = parseFloat(event.target.value);
                        if (!Number.isNaN(rate)) {
                            hm.hecklerSpeechRate = rate;
                            this.updateSpeedDisplay(rate);
                            hm.savePreferences();
                        }
                    });
                }

                // Initialize Voice Selection Listener
                if (game.hecklerVoiceSelect) {
                    game.hecklerVoiceSelect.addEventListener('change', (event) => {
                        const selectedId = event.target.value;
                        game.hecklerManager.pendingPreferredVoiceId = selectedId || null;
                        
                        if (!game.hecklerManager.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
                            return;
                        }
                        const voices = window.speechSynthesis.getVoices();
                        if (!voices || !voices.length) {
                            return;
                        }
                        
                        const chosenVoice = voices.find((voice) => game.hecklerManager.getVoiceIdentifier(voice) === selectedId);
                        if (chosenVoice) {
                            game.hecklerManager.hecklerVoice = chosenVoice;
                            game.hecklerManager.savePreferences();
                            game.hecklerManager.previewVoice(true);
                        }
                    });
                }

                // Initial UI State for Heckler
                if (game.hecklerManager.useSpeechSynthesis) {
                    game.hecklerManager.refreshVoiceOptions();
                    if (game.hecklerSettingsNote) {
                        game.hecklerSettingsNote.hidden = true;
                    }
                    if (game.hecklerTestButton) {
                        game.hecklerTestButton.disabled = false;
                        game.hecklerTestButton.title = '';
                    }
                } else {
                    if (game.hecklerVoiceSelect) {
                        game.hecklerVoiceSelect.innerHTML = '';
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = 'Speech not supported';
                        game.hecklerVoiceSelect.appendChild(option);
                        game.hecklerVoiceSelect.disabled = true;
                    }
                    if (game.hecklerSpeedRange) {
                        game.hecklerSpeedRange.disabled = true;
                    }
                    if (game.hecklerSettingsNote) {
                        game.hecklerSettingsNote.hidden = false;
                    }
                    if (game.hecklerTestButton) {
                        game.hecklerTestButton.disabled = true;
                        game.hecklerTestButton.title = 'Speech synthesis not supported';
                    }
                }
            }

            if (game.trumpetTestButton) {
                game.trumpetTestButton.addEventListener('click', () => {
                    game.ui.playTrumpetToot();
                });
            }

            // Settings Toggle Logic
            if (game.settingsToggle) {
                game.settingsToggle.setAttribute('aria-expanded', 'false');
                game.settingsToggle.addEventListener('click', () => {
                    this.toggleSettingsPanel(!game.settingsPanel.classList.contains('open'));
                });
            }

            if (game.settingsCloseBtn) {
                game.settingsCloseBtn.addEventListener('click', () => this.toggleSettingsPanel(false));
            }

        } catch (error) {
            console.error('Error initializing settings panel:', error);
        }
    }

    updateSpeedDisplay(rate) {
        const display = this.game.hecklerSpeedDisplay;
        if (!display) return;
        const rounded = Math.round(rate * 100) / 100;
        display.textContent = `${rounded.toFixed(2)}×`;
    }

    toggleSettingsPanel(forceOpen = null) {
        const game = this.game;
        if (!game.settingsPanel || !game.settingsToggle) return;
        const shouldOpen = forceOpen !== null ? forceOpen : !game.settingsPanel.classList.contains('open');
        if (shouldOpen) {
            game.settingsPanel.classList.add('open');
            game.settingsPanel.setAttribute('aria-hidden', 'false');
            game.settingsToggle.setAttribute('aria-expanded', 'true');
            
            // Sync UI values with game state
            if (game.bankrollSettingInput) {
                game.bankrollSettingInput.value = game.bankrollAmount;
            }
            if (game.dealerDelayInput) {
                game.dealerDelayInput.value = game.dealerHitDelayMs;
            }
            if (game.playerDelayInput) {
                game.playerDelayInput.value = game.playerHitDelayMs;
            }
            
            if (game.hecklerManager && game.hecklerEnabledToggle) {
                game.hecklerEnabledToggle.checked = game.hecklerManager.voiceEnabled;
            }

            game.ui.updateBankrollHelper();
            game.ui.updateDealerDelayHelper();
            game.ui.updatePlayerDelayHelper();
            
            if (!this.boundOutsideClickHandler) {
                this.boundOutsideClickHandler = (event) => this.handleOutsideClick(event);
                document.addEventListener('mousedown', this.boundOutsideClickHandler);
            }
            if (!this.boundEscapeHandler) {
                this.boundEscapeHandler = (event) => this.handleEscapeKey(event);
                document.addEventListener('keydown', this.boundEscapeHandler);
            }
        } else {
            game.settingsPanel.classList.remove('open');
            game.settingsPanel.setAttribute('aria-hidden', 'true');
            game.settingsToggle.setAttribute('aria-expanded', 'false');
            if (this.boundOutsideClickHandler) {
                document.removeEventListener('mousedown', this.boundOutsideClickHandler);
                this.boundOutsideClickHandler = null;
            }
            if (this.boundEscapeHandler) {
                document.removeEventListener('keydown', this.boundEscapeHandler);
                this.boundEscapeHandler = null;
            }
            game.ui.updateBankrollHelper();
            game.ui.updateDealerDelayHelper();
            game.ui.updatePlayerDelayHelper();
        }
    }

    handleOutsideClick(event) {
        const game = this.game;
        if (!game.settingsPanel || !game.settingsToggle) return;
        if (game.settingsPanel.contains(event.target) || game.settingsToggle.contains(event.target)) {
            return;
        }
        this.toggleSettingsPanel(false);
    }

    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            this.toggleSettingsPanel(false);
        }
    }

    // Delegate methods to HecklerManager for backward compatibility/convenience
    
    setupHecklerVoices() {
        if (this.game.hecklerManager) {
            this.game.hecklerManager.setupHecklerVoices();
        }
    }
    
    speakHecklerLine(message, token) {
        if (this.game.hecklerManager) {
            return this.game.hecklerManager.speak(message, token);
        }
        return false;
    }
    
    stopHecklerSpeech() {
        if (this.game.hecklerManager) {
            this.game.hecklerManager.stop();
        }
    }
    
    previewHecklerVoice(force = false) {
         if (this.game.hecklerManager) {
            this.game.hecklerManager.previewVoice(force);
        }
    }
    
    playVoiceTest() {
         if (this.game.hecklerManager) {
            this.game.hecklerManager.playVoiceTest();
        }
    }

    /**
     * Auto mode panel methods
     */
    prefillAutoModeForm() {
        const betInput = document.getElementById('auto-bet-input');
        const handsInput = document.getElementById('auto-hands-input');
        const radios = document.querySelectorAll('input[name="auto-insurance"]');
        const strategySelect = document.getElementById('auto-strategy-select');
        const bettingStrategySelect = document.getElementById('auto-betting-strategy-select');
        const percentageInput = document.getElementById('auto-percentage-input');
        const percentageContainer = document.getElementById('auto-percentage-container');
        const doubleDownSelect = document.getElementById('auto-double-down-select');
        const splitSelect = document.getElementById('auto-split-select');
        const surrenderSelect = document.getElementById('auto-surrender-select');
        
        if (!betInput || !handsInput || radios.length === 0) return;
        
        const game = this.game;
        const settings = game.autoSettings || {};
        const defaultBet = settings.defaultBet ?? game.defaultBetAmount ?? 100;
        betInput.value = defaultBet || 100;
        
        const hands = settings.hands ?? 5;
        handsInput.value = hands;
        
        const insurancePref = settings.insurance ?? 'never';
        radios.forEach(radio => {
            radio.checked = radio.value === insurancePref;
        });
        
        if (strategySelect) {
            strategySelect.value = settings.strategy ?? 'basic';
        }
        
        if (bettingStrategySelect) {
            bettingStrategySelect.value = settings.bettingStrategy ?? 'fixed';
            // Show/hide percentage input based on betting strategy
            if (percentageContainer) {
                percentageContainer.style.display = bettingStrategySelect.value === 'percentage' ? 'block' : 'none';
            }
        }
        
        if (percentageInput) {
            percentageInput.value = settings.betPercentage ?? 5;
        }
        
        if (doubleDownSelect) {
            doubleDownSelect.value = settings.doubleDownPref ?? 'recommended';
        }
        
        if (splitSelect) {
            splitSelect.value = settings.splitPref ?? 'recommended';
        }
        
        if (surrenderSelect) {
            surrenderSelect.value = settings.surrenderPref ?? 'recommended';
        }
        
        const errorEl = document.getElementById('auto-error');
        if (errorEl) errorEl.textContent = '';
    }

    toggleAutoModePanel() {
        if (this.game.autoPanelVisible) {
            this.closeAutoModePanel();
        } else {
            this.openAutoModePanel();
        }
    }

    openAutoModePanel() {
        const panel = document.getElementById('auto-mode-panel');
        if (!panel) return;
        this.game.autoPanelVisible = true;
        panel.style.display = 'block';
        this.prefillAutoModeForm();

        // Hide dealer/player areas and move panel into their space
        const primaryColumn = document.querySelector('.primary-column');
        if (primaryColumn) {
            primaryColumn.classList.add('auto-mode-panel-open');
        }
    }

    closeAutoModePanel() {
        const panel = document.getElementById('auto-mode-panel');
        if (!panel) return;
        this.game.autoPanelVisible = false;
        panel.style.display = 'none';
        const errorEl = document.getElementById('auto-error');
        if (errorEl) errorEl.textContent = '';

        // Restore original layout when panel closes
        const primaryColumn = document.querySelector('.primary-column');
        if (primaryColumn) {
            primaryColumn.classList.remove('auto-mode-panel-open');
        }
    }
}
