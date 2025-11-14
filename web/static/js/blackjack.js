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
        this.defaultBetAmount = null; // Default bet amount for quick play
        this.defaultBetStorageKey = 'blackjack_default_bet';
        this.bankrollConfigKey = 'blackjack_bankroll_config';
        this.defaultBankrollAmount = 1000;
        this.bankrollAmount = this.defaultBankrollAmount;
        this.bankrollSettingInput = null;
        this.bankrollHelperElement = null;
        this.defaultDealerHitDelayMs = 1000;
        this.dealerHitDelayKey = 'blackjack_dealer_delay_ms';
        this.dealerHitDelayMs = this.loadDealerHitDelay();
        this.dealerDelayInput = null;
        this.dealerDelayHelperElement = null;
        this.dealerHitsSoft17Key = 'blackjack_dealer_hits_soft17';
        this.dealerHitsSoft17 = this.loadDealerHitsSoft17();
        this.dealerHitsSoft17Toggle = null;
        this.actionStatusElement = null; // Status message element
        this.actionStatusTimeout = null; // Timeout for clearing status
        this.hecklerElement = null;
        this.hecklerTimeout = null;
        this.hecklerRemoveTimeout = null;
        this.hecklerVoice = null;
        this.currentHecklerUtterance = null;
        this.hecklerVoicesListener = null;
        this.hecklerSpeechRate = 1.05;
        this.activeHecklerToken = null;
        this.settingsToggle = null;
        this.settingsPanel = null;
        this.settingsCloseBtn = null;
        this.hecklerVoiceSelect = null;
        this.hecklerSpeedRange = null;
        this.hecklerSpeedDisplay = null;
        this.hecklerTestButton = null;
        this.hecklerSettingsNote = null;
        this.forceDlrHandInput = null;
        this.testPeekButton = null;
        this.isTestingPeek = false;
        this.peekAnimationDurationMs = 1350;
        this.activePeekTimeout = null;
        this.isDealerPeekAnimating = false;
        this.boundOutsideClickHandler = null;
        this.boundEscapeHandler = null;
        this.hecklerSettingsKey = 'blackjack_heckler_settings';
        this.hecklerPreferences = this.loadHecklerPreferences();
        this.pendingPreferredVoiceId = this.hecklerPreferences?.voiceId || null;
        if (this.hecklerPreferences === null || this.hecklerPreferences.enabled === undefined) {
            this.voiceEnabled = true;
        } else {
            this.voiceEnabled = this.hecklerPreferences.enabled === true;
        }
        // Auto mode settings
        this.autoSettingsKey = 'blackjack_auto_settings';
        this.autoSettings = this.loadAutoSettings();
        // Dedupe key for insurance outcome history entries per round
        this.lastInsuranceOutcomeSig = null;
        this.insuranceAnnouncedForGameId = null;
        this.loggedRoundId = null; // Track which round has been logged
        if (this.hecklerPreferences?.rate && !Number.isNaN(parseFloat(this.hecklerPreferences.rate))) {
            this.hecklerSpeechRate = parseFloat(this.hecklerPreferences.rate);
        }
        this.hecklerPhrases = {
            hard17: [
                'You hit on a hard {total}? Did you lose a bet to common sense?',
                'Hard {total} and you still begged for more pain?',
                'A hard {total} hit? The dealer just sent you a thank-you card.'
            ],
            dealerBustCard: [
                'Dealer shows a {dealerCard} and you still swing? Bold move, champ.',
                'That {dealerCard} was begging you to stand. You tipped the house instead.',
                'Every pit boss nodded when you hit against a {dealerCard}. Not in approval.'
            ],
            softHigh: [
                'Soft {total} was already pretty. Why the makeover?',
                'You had a soft {total} and still hit? Even the cocktail waitress winced.',
                'Soft {total} and you asked for more? That cloud above you is pure judgement.'
            ],
            standLow: [
                'Standing on {total}? You know you can\'t win with that, right?',
                '{total} and you\'re done? The dealer just smiled.',
                'Standing on {total}? That\'s not how math works, champ.',
                'You stood on {total}? Even the shoe is laughing.',
                '{total} and you fold? Might as well hand over your wallet now.',
                'Standing on {total}? The house edge just got a promotion.'
            ]
        };
        this.useSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
        if (this.useSpeechSynthesis) {
            this.setupHecklerVoices();
        }
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
     * Pick a random heckler line for a given category
     */
    pickRandomMessage(category) {
        const messages = this.hecklerPhrases?.[category];
        if (!messages || !messages.length) {
            return null;
        }
        const index = Math.floor(Math.random() * messages.length);
        return messages[index];
    }

    /**
     * Replace template placeholders in heckler lines
     */
    formatHecklerMessage(template, context = {}) {
        if (!template) return null;
        return template.replace(/\{(\w+)\}/g, (_, key) => {
            return Object.prototype.hasOwnProperty.call(context, key) ? context[key] : '';
        });
    }

    /**
     * Load speech preferences from localStorage
     */
    loadHecklerPreferences() {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        try {
            const stored = window.localStorage.getItem(this.hecklerSettingsKey);
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            return {
                voiceId: parsed?.voiceId || null,
                rate: parsed?.rate || null,
                enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : undefined
            };
        } catch (error) {
            console.warn('Failed to load heckler preferences:', error);
            return null;
        }
    }

    /**
     * Persist speech preferences
     */
    saveHecklerPreferences() {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const payload = {
                voiceId: this.pendingPreferredVoiceId || null,
                rate: this.hecklerSpeechRate,
                enabled: this.voiceEnabled
            };
            window.localStorage.setItem(this.hecklerSettingsKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save heckler preferences:', error);
        }
    }

    normalizeBankrollAmount(rawValue, fallback = this.defaultBankrollAmount) {
        if (rawValue === null || rawValue === undefined || rawValue === '') {
            return {
                amount: fallback,
                fallbackUsed: true,
                clamped: false,
                clampedToMin: false,
                clampedToMax: false
            };
        }

        const numeric = typeof rawValue === 'number' ? rawValue : parseInt(rawValue, 10);
        if (!Number.isFinite(numeric)) {
            return {
                amount: fallback,
                fallbackUsed: true,
                clamped: false,
                clampedToMin: false,
                clampedToMax: false
            };
        }

        const floored = Math.floor(numeric);
        if (!Number.isFinite(floored)) {
            return {
                amount: fallback,
                fallbackUsed: true,
                clamped: false,
                clampedToMin: false,
                clampedToMax: false
            };
        }

        const minApplied = floored < 1;
        const maxApplied = floored > 1000000;
        const clampedValue = Math.min(Math.max(floored, 1), 1000000);
        return {
            amount: clampedValue,
            fallbackUsed: false,
            clamped: minApplied || maxApplied,
            clampedToMin: minApplied,
            clampedToMax: maxApplied
        };
    }

    loadBankrollConfig() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return this.defaultBankrollAmount;
        }

        try {
            const stored = window.localStorage.getItem(this.bankrollConfigKey);
            if (!stored) {
                return this.defaultBankrollAmount;
            }
            const parsed = JSON.parse(stored);
            const { amount } = this.normalizeBankrollAmount(parsed?.amount, this.defaultBankrollAmount);
            return amount;
        } catch (error) {
            console.warn('Failed to load bankroll config:', error);
            return this.defaultBankrollAmount;
        }
    }

    saveBankrollConfig(amount) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(this.bankrollConfigKey, JSON.stringify({ amount }));
        } catch (error) {
            console.warn('Failed to save bankroll config:', error);
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
        } = this.normalizeBankrollAmount(rawValue, fallbackAmount);

        this.bankrollAmount = amount;

        if (persist) {
            this.saveBankrollConfig(amount);
        }

        if (updateInput && this.bankrollSettingInput) {
            this.bankrollSettingInput.value = amount;
        }

        this.updateBankrollHelper();

        return {
            amount,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax,
            previous: previousAmount
        };
    }

    updateBankrollHelper() {
        if (!this.bankrollHelperElement) {
            return;
        }
        const formatted = this.bankrollAmount.toLocaleString();
        this.bankrollHelperElement.textContent = `Used when refreshing bankroll (max $1,000,000). Current: $${formatted}`;
    }

    normalizeDealerHitDelay(rawValue, fallbackDelay = this.defaultDealerHitDelayMs) {
        const minDelay = 0;
        const maxDelay = 5000;
        const fallbackParsed = Number.parseInt(fallbackDelay, 10);
        const safeFallback = Number.isNaN(fallbackParsed)
            ? this.defaultDealerHitDelayMs
            : Math.min(Math.max(fallbackParsed, minDelay), maxDelay);

        if (rawValue === undefined || rawValue === null || rawValue === '') {
            return {
                delay: safeFallback,
                fallbackUsed: true,
                clamped: false,
                clampedToMin: false,
                clampedToMax: false
            };
        }

        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
            return {
                delay: safeFallback,
                fallbackUsed: true,
                clamped: false,
                clampedToMin: false,
                clampedToMax: false
            };
        }

        const clampedValue = Math.min(Math.max(parsed, minDelay), maxDelay);
        return {
            delay: clampedValue,
            fallbackUsed: false,
            clamped: clampedValue !== parsed,
            clampedToMin: clampedValue === minDelay && parsed < minDelay,
            clampedToMax: clampedValue === maxDelay && parsed > maxDelay
        };
    }

    loadDealerHitsSoft17() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        try {
            const stored = window.localStorage.getItem(this.dealerHitsSoft17Key);
            if (stored === null || stored === undefined) {
                return false; // Default: dealer stands on all 17s
            }
            return stored === 'true';
        } catch (error) {
            console.warn('Failed to load dealer hits soft 17 config:', error);
            return false;
        }
    }

    saveDealerHitsSoft17() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(this.dealerHitsSoft17Key, String(this.dealerHitsSoft17));
        } catch (error) {
            console.warn('Failed to save dealer hits soft 17 config:', error);
        }
    }

    loadDealerHitDelay() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return this.defaultDealerHitDelayMs;
        }

        try {
            const stored = window.localStorage.getItem(this.dealerHitDelayKey);
            if (stored === null || stored === undefined) {
                return this.defaultDealerHitDelayMs;
            }
            const { delay } = this.normalizeDealerHitDelay(stored, this.defaultDealerHitDelayMs);
            return delay;
        } catch (error) {
            console.warn('Failed to load dealer delay config:', error);
            return this.defaultDealerHitDelayMs;
        }
    }

    saveDealerHitDelay(delay) {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            window.localStorage.setItem(this.dealerHitDelayKey, String(delay));
        } catch (error) {
            console.warn('Failed to save dealer delay config:', error);
        }
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
        } = this.normalizeDealerHitDelay(rawValue, fallbackDelay);

        this.dealerHitDelayMs = delay;

        if (persist) {
            this.saveDealerHitDelay(delay);
        }

        if (updateInput && this.dealerDelayInput) {
            this.dealerDelayInput.value = delay;
        }

        this.updateDealerDelayHelper();

        return {
            delay,
            fallbackUsed,
            clamped,
            clampedToMin,
            clampedToMax,
            previous: previousDelay
        };
    }

    updateDealerDelayHelper() {
        if (!this.dealerDelayHelperElement) {
            return;
        }
        const delayDisplay = Number.isFinite(this.dealerHitDelayMs) ? this.dealerHitDelayMs : this.defaultDealerHitDelayMs;
        this.dealerDelayHelperElement.textContent = `Delay between dealer hits (0-5000 ms). Current: ${delayDisplay} ms`;
    }

    /**
     * Generate a stable identifier for a voice
     */
    getVoiceIdentifier(voice) {
        if (!voice) return null;
        return voice.voiceURI || `${voice.name}|${voice.lang}`;
    }

    /**
     * Populate dropdown with available voices
     */
    populateVoiceOptions(voices) {
        if (!this.hecklerVoiceSelect) return;
        if (!Array.isArray(voices)) {
            this.hecklerVoiceSelect.innerHTML = '';
            this.hecklerVoiceSelect.disabled = true;
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No voices available';
            this.hecklerVoiceSelect.appendChild(option);
            return;
        }

        const filteredVoices = voices.filter((voice) => {
            const lang = voice.lang || '';
            return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
        });

        this.hecklerVoiceSelect.innerHTML = '';
        if (filteredVoices.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No US English voices';
            this.hecklerVoiceSelect.appendChild(option);
            this.hecklerVoiceSelect.disabled = true;
            this.hecklerVoice = null;
            this.pendingPreferredVoiceId = null;
            return;
        }

        const optionsFragment = document.createDocumentFragment();
        filteredVoices.forEach((voice) => {
            const option = document.createElement('option');
            const identifier = this.getVoiceIdentifier(voice);
            option.value = identifier;
            let label = `${voice.name}`;
            if (voice.lang) {
                label += ` (${voice.lang})`;
            }
            if (voice.default) {
                label += ' • default';
            }
            option.textContent = label;
            if (this.hecklerVoice && identifier === this.getVoiceIdentifier(this.hecklerVoice)) {
                option.selected = true;
            } else if (!this.hecklerVoice && this.pendingPreferredVoiceId && identifier === this.pendingPreferredVoiceId) {
                option.selected = true;
            }
            optionsFragment.appendChild(option);
        });

        this.hecklerVoiceSelect.appendChild(optionsFragment);
        this.hecklerVoiceSelect.disabled = false;

        const selectedOption = this.hecklerVoiceSelect.options[this.hecklerVoiceSelect.selectedIndex];
        if (selectedOption) {
            const selectedVoice = filteredVoices.find((voice) => this.getVoiceIdentifier(voice) === selectedOption.value);
            if (selectedVoice) {
                this.hecklerVoice = selectedVoice;
                this.pendingPreferredVoiceId = selectedOption.value;
                this.saveHecklerPreferences();
                if (this.voiceEnabled) {
                    this.previewHecklerVoice();
                }
            }
        }
    }

    /**
     * Assign the preferred voice from saved preferences
     */
    assignPreferredVoice(voices) {
        if (!voices || !Array.isArray(voices) || voices.length === 0) {
            return;
        }

        // If we already have a voice assigned, keep it if it's still available
        if (this.hecklerVoice) {
            const currentIdentifier = this.getVoiceIdentifier(this.hecklerVoice);
            const stillAvailable = voices.find((voice) => this.getVoiceIdentifier(voice) === currentIdentifier);
            if (stillAvailable) {
                return; // Voice is still available, no need to reassign
            }
        }

        // Try to find the preferred voice from saved preferences
        const preferredId = this.pendingPreferredVoiceId || this.hecklerPreferences?.voiceId;
        if (preferredId) {
            const preferredVoice = voices.find((voice) => this.getVoiceIdentifier(voice) === preferredId);
            if (preferredVoice) {
                this.hecklerVoice = preferredVoice;
                this.pendingPreferredVoiceId = preferredId;
                return;
            }
        }

        // Fallback to default US English voice or first available US English voice
        const filteredVoices = voices.filter((voice) => {
            const lang = voice.lang || '';
            return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
        });

        if (filteredVoices.length > 0) {
            // Try to find a default voice first
            const defaultVoice = filteredVoices.find((voice) => voice.default);
            if (defaultVoice) {
                this.hecklerVoice = defaultVoice;
                this.pendingPreferredVoiceId = this.getVoiceIdentifier(defaultVoice);
            } else {
                // Use first available US English voice
                this.hecklerVoice = filteredVoices[0];
                this.pendingPreferredVoiceId = this.getVoiceIdentifier(filteredVoices[0]);
            }
        }
    }

    /**
     * Refresh voice list in the settings panel
     */
    refreshVoiceOptions() {
        if (!this.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            return;
        }
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
            this.populateVoiceOptions(voices);
            this.assignPreferredVoice(voices);
        }
    }

    /**
     * Initialize settings panel interactions
     */
    initSettingsPanel() {
        try {
            this.settingsToggle = document.getElementById('settings-toggle');
            this.settingsPanel = document.getElementById('settings-panel');
            this.settingsCloseBtn = document.getElementById('settings-close');
            this.hecklerEnabledToggle = document.getElementById('heckler-enabled-toggle');
            this.hecklerVoiceSelect = document.getElementById('heckler-voice-select');
            this.hecklerSpeedRange = document.getElementById('heckler-speed-range');
            this.hecklerSpeedDisplay = document.getElementById('heckler-speed-display');
            this.hecklerTestButton = document.getElementById('heckler-test-button');
            this.hecklerSettingsNote = document.getElementById('heckler-settings-note');
            this.bankrollSettingInput = document.getElementById('bankroll-setting-input');
            this.bankrollHelperElement = document.getElementById('bankroll-setting-helper');
            this.dealerDelayInput = document.getElementById('dealer-delay-input');
            this.dealerDelayHelperElement = document.getElementById('dealer-delay-helper');
            this.dealerHitsSoft17Toggle = document.getElementById('dealer-hits-soft17-toggle');
            this.forceDlrHandInput = document.getElementById('force-dlr-hand-input');
            this.testPeekButton = document.getElementById('test-peek-btn');

            // Only proceed if the essential elements exist
            if (!this.settingsToggle || !this.settingsPanel) {
                console.warn('Settings panel elements not found in DOM');
                return;
            }

            if (this.bankrollSettingInput) {
                // Ensure the input reflects the current bankroll preference
                this.setBankrollAmount(this.bankrollAmount, { persist: false });

                const applyBankrollChange = () => {
                    const result = this.setBankrollAmount(this.bankrollSettingInput.value);

                    if (result.fallbackUsed) {
                        // Input was empty or invalid; reset to previous value without alerting the user
                        this.bankrollSettingInput.value = result.previous;
                        this.log('Bankroll settings input was empty or invalid; keeping previous value.', 'warn');
                        return;
                    }

                    if (result.clamped) {
                        const clampMessage = result.clampedToMin
                            ? 'Minimum bankroll is $1'
                            : 'Maximum bankroll is $1,000,000';
                        this.showMessage(clampMessage, 'warn');
                    }

                    if (result.amount !== result.previous) {
                        this.log(`Bankroll preference updated to $${result.amount.toLocaleString()}`, 'success');
                    }
                };

                this.bankrollSettingInput.addEventListener('change', applyBankrollChange);
            } else {
                console.warn('Bankroll setting input not found in settings panel');
            }

            if (this.dealerDelayInput) {
                this.dealerDelayInput.value = this.dealerHitDelayMs;
                const applyDealerDelayChange = () => {
                    const result = this.setDealerHitDelay(this.dealerDelayInput.value);

                    if (result.fallbackUsed) {
                        this.dealerDelayInput.value = result.previous;
                        this.log('Dealer delay input was empty or invalid; keeping previous value.', 'warn');
                        return;
                    }

                    if (result.clamped) {
                        const clampMessage = result.clampedToMin
                            ? 'Minimum dealer delay is 0 ms'
                            : 'Maximum dealer delay is 5,000 ms';
                        this.showMessage(clampMessage, 'warn');
                    }

                    if (result.delay !== result.previous) {
                        this.log(`Dealer card delay updated to ${result.delay} ms`, 'success');
                    }
                };

                this.dealerDelayInput.addEventListener('change', applyDealerDelayChange);
                this.dealerDelayInput.addEventListener('blur', applyDealerDelayChange);
            } else {
                console.warn('Dealer delay setting input not found in settings panel');
            }

            if (this.dealerHitsSoft17Toggle) {
                this.dealerHitsSoft17Toggle.checked = this.dealerHitsSoft17;
                this.dealerHitsSoft17Toggle.addEventListener('change', (event) => {
                    this.dealerHitsSoft17 = event.target.checked;
                    this.saveDealerHitsSoft17();
                    const statusMessage = this.dealerHitsSoft17 
                        ? 'Dealer will hit on soft 17 (takes effect on next game)' 
                        : 'Dealer will stand on all 17s (takes effect on next game)';
                    this.log(statusMessage, 'success');
                    this.showMessage(statusMessage, 'info');
                    // Update table sign to reflect new setting
                    if (this.gameState) {
                        this.gameState.dealer_hits_soft_17 = this.dealerHitsSoft17;
                        this.updateTableSign();
                    }
                });
            } else {
                console.warn('Dealer hits soft 17 toggle not found in settings panel');
            }

            if (this.forceDlrHandInput) {
                const applyForceDlrHandChange = async () => {
                    const handString = this.forceDlrHandInput.value.trim();
                    if (!this.gameId) {
                        this.showMessage('Please start a game first', 'warn');
                        return;
                    }
                    try {
                        const result = await this.apiCall('/api/force_dealer_hand', 'POST', {
                            game_id: this.gameId,
                            hand_string: handString || null
                        });
                        if (result.success) {
                            this.updateGameState(result.game_state);
                            this.updateTestModeIndicator();
                            const message = handString 
                                ? `Test mode: Dealer hand forced to ${handString}` 
                                : 'Test mode disabled';
                            this.log(message, 'success');
                        } else {
                            this.showMessage(result.message || 'Failed to set forced dealer hand', 'error');
                        }
                    } catch (e) {
                        // Error handled by apiCall
                    }
                };
                this.forceDlrHandInput.addEventListener('change', applyForceDlrHandChange);
                this.forceDlrHandInput.addEventListener('blur', applyForceDlrHandChange);
            } else {
                console.warn('Force dealer hand input not found in settings panel');
            }

            if (this.testPeekButton) {
                this.testPeekButton.addEventListener('click', () => this.handleTestPeekAnimation());
            } else {
                console.warn('Test peek animation button not found in settings panel');
            }

            this.updateBankrollHelper();
            this.updateDealerDelayHelper();

            if (this.hecklerEnabledToggle) {
                this.hecklerEnabledToggle.checked = this.voiceEnabled;
                this.hecklerEnabledToggle.addEventListener('change', (event) => {
                    this.voiceEnabled = event.target.checked;
                    this.saveHecklerPreferences();
                    const statusMessage = this.voiceEnabled ? 'Voice commentary enabled' : 'Voice commentary disabled';
                    this.log(statusMessage, 'success');
                    if (this.voiceEnabled) {
                        this.previewHecklerVoice(true);
                    } else {
                        this.stopHecklerSpeech();
                    }
                });
            }

            if (this.hecklerTestButton) {
                this.hecklerTestButton.addEventListener('click', () => {
                    this.playVoiceTest();
                });
            }

            if (this.hecklerSpeedRange) {
                const clampedRate = Math.min(
                    parseFloat(this.hecklerSpeedRange.max || '1.6'),
                    Math.max(parseFloat(this.hecklerSpeedRange.min || '0.6'), this.hecklerSpeechRate)
                );
                this.hecklerSpeechRate = clampedRate;
                this.hecklerSpeedRange.value = clampedRate;
                this.updateSpeedDisplay(clampedRate);
                this.hecklerSpeedRange.addEventListener('input', (event) => {
                    const rate = parseFloat(event.target.value);
                    if (!Number.isNaN(rate)) {
                        this.hecklerSpeechRate = rate;
                        this.updateSpeedDisplay(rate);
                        this.saveHecklerPreferences();
                    }
                });
            }

            const updateVoiceSelection = () => {
                if (!this.hecklerVoiceSelect) return;
                this.hecklerVoiceSelect.addEventListener('change', (event) => {
                    const selectedId = event.target.value;
                    this.pendingPreferredVoiceId = selectedId || null;
                    if (!this.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
                        return;
                    }
                    const voices = window.speechSynthesis.getVoices();
                    if (!voices || !voices.length) {
                        return;
                    }
                    const chosenVoice = voices.find((voice) => this.getVoiceIdentifier(voice) === selectedId);
                    if (chosenVoice) {
                        this.hecklerVoice = chosenVoice;
                        if (this.hecklerPreferences === null) {
                            this.hecklerPreferences = {};
                        }
                        this.hecklerPreferences.voiceId = selectedId;
                        this.saveHecklerPreferences();
                        this.previewHecklerVoice(true);
                    }
                });
            };

            this.settingsToggle.setAttribute('aria-expanded', 'false');
            this.settingsToggle.addEventListener('click', () => {
                this.toggleSettingsPanel(!this.settingsPanel.classList.contains('open'));
            });

            if (this.settingsCloseBtn) {
                this.settingsCloseBtn.addEventListener('click', () => this.toggleSettingsPanel(false));
            }

            if (this.useSpeechSynthesis) {
                updateVoiceSelection();
                this.refreshVoiceOptions();
                if (this.hecklerSettingsNote) {
                    this.hecklerSettingsNote.hidden = true;
                }
                if (this.hecklerTestButton) {
                    this.hecklerTestButton.disabled = false;
                    this.hecklerTestButton.title = '';
                }
            } else {
                if (this.hecklerVoiceSelect) {
                    this.hecklerVoiceSelect.innerHTML = '';
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'Speech not supported';
                    this.hecklerVoiceSelect.appendChild(option);
                    this.hecklerVoiceSelect.disabled = true;
                }
                if (this.hecklerSpeedRange) {
                    this.hecklerSpeedRange.disabled = true;
                }
                if (this.hecklerSettingsNote) {
                    this.hecklerSettingsNote.hidden = false;
                }
                if (this.hecklerTestButton) {
                    this.hecklerTestButton.disabled = true;
                    this.hecklerTestButton.title = 'Speech synthesis not supported';
                }
            }
        } catch (error) {
            console.error('Error initializing settings panel:', error);
            // Don't throw - allow the game to continue even if settings panel fails
        }
    }

    /**
     * Update the displayed speech rate
     */
    updateSpeedDisplay(rate) {
        if (!this.hecklerSpeedDisplay) return;
        const rounded = Math.round(rate * 100) / 100;
        this.hecklerSpeedDisplay.textContent = `${rounded.toFixed(2)}×`;
    }

    /**
     * Toggle settings panel visibility
     */
    toggleSettingsPanel(forceOpen = null) {
        if (!this.settingsPanel || !this.settingsToggle) return;
        const shouldOpen = forceOpen !== null ? forceOpen : !this.settingsPanel.classList.contains('open');
        if (shouldOpen) {
            this.settingsPanel.classList.add('open');
            this.settingsPanel.setAttribute('aria-hidden', 'false');
            this.settingsToggle.setAttribute('aria-expanded', 'true');
            if (this.bankrollSettingInput) {
                this.bankrollSettingInput.value = this.bankrollAmount;
            }
            if (this.dealerDelayInput) {
                this.dealerDelayInput.value = this.dealerHitDelayMs;
            }
            if (this.hecklerEnabledToggle) {
                this.hecklerEnabledToggle.checked = this.voiceEnabled;
            }
            this.updateBankrollHelper();
            this.updateDealerDelayHelper();
            if (!this.boundOutsideClickHandler) {
                this.boundOutsideClickHandler = (event) => this.handleOutsideClick(event);
                document.addEventListener('mousedown', this.boundOutsideClickHandler);
            }
            if (!this.boundEscapeHandler) {
                this.boundEscapeHandler = (event) => this.handleEscapeKey(event);
                document.addEventListener('keydown', this.boundEscapeHandler);
            }
        } else {
            this.settingsPanel.classList.remove('open');
            this.settingsPanel.setAttribute('aria-hidden', 'true');
            this.settingsToggle.setAttribute('aria-expanded', 'false');
            if (this.boundOutsideClickHandler) {
                document.removeEventListener('mousedown', this.boundOutsideClickHandler);
                this.boundOutsideClickHandler = null;
            }
            if (this.boundEscapeHandler) {
                document.removeEventListener('keydown', this.boundEscapeHandler);
                this.boundEscapeHandler = null;
            }
            this.updateBankrollHelper();
            this.updateDealerDelayHelper();
        }
    }

    handleOutsideClick(event) {
        if (!this.settingsPanel || !this.settingsToggle) return;
        if (this.settingsPanel.contains(event.target) || this.settingsToggle.contains(event.target)) {
            return;
        }
        this.toggleSettingsPanel(false);
    }

    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            this.toggleSettingsPanel(false);
        }
    }

    /**
     * Setup speech synthesis voice selection for the heckler
     */
    setupHecklerVoices() {
        if (!this.useSpeechSynthesis) return;
        const synth = window.speechSynthesis;
        const loadVoices = () => {
            const voices = synth.getVoices();
            if (voices && voices.length) {
                this.populateVoiceOptions(voices);
                this.assignPreferredVoice(voices);
            }
        };
        loadVoices();
        synth.addEventListener('voiceschanged', loadVoices);
        this.hecklerVoicesListener = loadVoices;
    }

    previewHecklerVoice(force = false) {
        if ((!force && !this.voiceEnabled) || !this.useSpeechSynthesis || !this.hecklerVoice) return;
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance('Are you feeling lucky today?');
        utterance.voice = this.hecklerVoice;
        utterance.rate = this.hecklerSpeechRate;
        synth.cancel();
        synth.speak(utterance);
    }

    playVoiceTest() {
        if (!this.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            this.log('Voice test requested but speech synthesis is unavailable', 'warn');
            return;
        }
        const synth = window.speechSynthesis;
        try {
            synth.cancel();
        } catch (error) {
            console.warn('Failed to cancel speech synthesis before test:', error);
        }
        const utterance = new SpeechSynthesisUtterance('Testing 1, Testing 2, Testing 3.');
        if (this.hecklerVoice) {
            utterance.voice = this.hecklerVoice;
        } else {
            const voices = synth.getVoices();
            const usVoice = voices.find((voice) => {
                const lang = voice.lang || '';
                return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
            });
            if (usVoice) {
                utterance.voice = usVoice;
                this.hecklerVoice = usVoice;
                this.pendingPreferredVoiceId = this.getVoiceIdentifier(usVoice);
                this.saveHecklerPreferences();
            }
        }
        utterance.rate = this.hecklerSpeechRate;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        synth.speak(utterance);
    }

    /**
     * Speak the heckler commentary using Web Speech API
     */
    speakHecklerLine(message, token) {
        if (!this.voiceEnabled || !this.useSpeechSynthesis || !message || typeof window === 'undefined') return false;
        const synth = window.speechSynthesis;
        if (!synth) return false;

        try {
            this.stopHecklerSpeech();
            const utterance = new SpeechSynthesisUtterance(message);
            if (this.hecklerVoice) {
                utterance.voice = this.hecklerVoice;
            } else {
                const voices = synth.getVoices();
                const usVoice = voices.find((voice) => {
                    const lang = voice.lang || '';
                    return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
                });
                if (usVoice) {
                    utterance.voice = usVoice;
                    this.hecklerVoice = usVoice;
                    this.pendingPreferredVoiceId = this.getVoiceIdentifier(usVoice);
                    this.saveHecklerPreferences();
                    this.refreshVoiceOptions();
                }
            }
            utterance.rate = this.hecklerSpeechRate;
            utterance.pitch = 1;
            utterance.volume = 0.9;
            utterance.onend = () => {
                this.currentHecklerUtterance = null;
                if (token && token === this.activeHecklerToken) {
                    this.hideHecklerMessage(token);
                }
            };
            utterance.onerror = () => {
                this.currentHecklerUtterance = null;
                if (token && token === this.activeHecklerToken) {
                    this.hideHecklerMessage(token);
                }
            };
            this.currentHecklerUtterance = utterance;
            synth.speak(utterance);
            return true;
        } catch (error) {
            console.error('Heckler speech failed:', error);
            this.useSpeechSynthesis = false;
            this.currentHecklerUtterance = null;
            return false;
        }
        return false;
    }

    /**
     * Stop any ongoing heckler speech
     */
    stopHecklerSpeech() {
        if (!this.useSpeechSynthesis || typeof window === 'undefined') return;
        const synth = window.speechSynthesis;
        if (!synth) return;
        try {
            if (synth.speaking || synth.pending) {
                synth.cancel();
            }
        } catch (error) {
            console.error('Failed to cancel heckler speech:', error);
        } finally {
            this.currentHecklerUtterance = null;
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
        const parsed = parseInt(rank, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    /**
     * Friendly label for a card rank
     */
    formatCardLabel(card) {
        if (!card || !card.rank) return '';
        const rank = card.rank;
        switch (rank) {
            case 'A':
                return 'Ace';
            case 'K':
                return 'King';
            case 'Q':
                return 'Queen';
            case 'J':
                return 'Jack';
            default:
                return rank;
        }
    }

    /**
     * Determine if a hand is soft (contains an Ace counted as 11)
     */
    isSoftHand(hand) {
        const cards = hand?.cards;
        if (!Array.isArray(cards) || !cards.length) {
            return false;
        }
        let total = 0;
        let aces = 0;
        cards.forEach(card => {
            if (!card || !card.rank) return;
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
        if (!hand || !dealerCard) {
            return { shouldHeckle: false, message: null };
        }
        const total = hand.value ?? 0;
        const isSoft = this.isSoftHand(hand);
        const dealerValue = this.getCardNumericValue(dealerCard);
        const dealerLabel = this.formatCardLabel(dealerCard);

        if (!isSoft && total >= 17) {
            const template = this.pickRandomMessage('hard17');
            return {
                shouldHeckle: !!template,
                message: this.formatHecklerMessage(template, { total })
            };
        }

        const dealerShowingBustCard = dealerValue !== null && dealerValue >= 2 && dealerValue <= 6;
        if (!isSoft && dealerShowingBustCard && total >= 13 && total <= 16) {
            const template = this.pickRandomMessage('dealerBustCard');
            return {
                shouldHeckle: !!template,
                message: this.formatHecklerMessage(template, { total, dealerCard: dealerLabel })
            };
        }

        if (!isSoft && dealerShowingBustCard && total === 12) {
            const template = this.pickRandomMessage('dealerBustCard');
            return {
                shouldHeckle: !!template,
                message: this.formatHecklerMessage(template, { total, dealerCard: dealerLabel })
            };
        }

        if (isSoft && total >= 19) {
            const template = this.pickRandomMessage('softHigh');
            return {
                shouldHeckle: !!template,
                message: this.formatHecklerMessage(template, { total })
            };
        }

        return { shouldHeckle: false, message: null };
    }

    /**
     * Evaluate if standing is a bad decision (for heckler)
     */
    evaluateStandDecision(hand) {
        if (!hand) {
            return { shouldHeckle: false, message: null };
        }
        const total = hand.value ?? 0;
        
        // Standing with 11 or less is always a bad play
        if (total <= 11) {
            const template = this.pickRandomMessage('standLow');
            return {
                shouldHeckle: !!template,
                message: this.formatHecklerMessage(template, { total })
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
        const storedBankroll = this.loadBankrollConfig();
        this.setBankrollAmount(storedBankroll, { persist: false });
        this.initSettingsPanel();
        this.setupKeyboardHotkeys();
        
        if (this.hecklerPreferences === null) {
            this.hecklerPreferences = {};
        }
        if (this.hecklerPreferences.enabled === undefined) {
            this.hecklerPreferences.enabled = this.voiceEnabled;
            this.saveHecklerPreferences();
        }
        
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
        this.updateTableSign();
        
        // Auto mode controls
        this.autoPanelVisible = false;
        const autoBtn = document.getElementById('auto-mode-btn');
        const autoStartBtn = document.getElementById('auto-start-btn');
        const autoCancelBtn = document.getElementById('auto-cancel-btn');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => this.toggleAutoModePanel());
        }
        if (autoCancelBtn) {
            autoCancelBtn.addEventListener('click', () => this.closeAutoModePanel());
        }
        if (autoStartBtn) {
            autoStartBtn.addEventListener('click', () => this.handleAutoModeStart());
        }
        this.prefillAutoModeForm();
        
        // Log Hand button
        const logHandBtn = document.getElementById('log-hand-btn');
        if (logHandBtn) {
            logHandBtn.addEventListener('click', () => this.handleLogHand());
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

    async sendInsuranceDecision(decision) {
        if (!this.gameId) return;
        try {
            this.showLoading();
            const result = await this.apiCall('/api/insurance', 'POST', {
                game_id: this.gameId,
                decision
            });
            if (result.success) {
                // If dealer peeked, show peek animation before updating state
                if (result.dealer_peeked) {
                    await this.animateDealerPeek();
                }
                this.updateGameState(result.game_state);
                // If game ended due to dealer blackjack, end the round
                if (result.game_over) {
                    await this.endGame();
                }
            } else {
                this.showMessage(result.error || 'Insurance action failed', 'error');
            }
        } catch (e) {
            // error surfaced by apiCall
        } finally {
            this.hideLoading();
            this.updateButtonStates();
        }
    }

    /**
     * Show action status message
     */
    setActionStatus(message, duration = 3000) {
        if (!this.actionStatusElement) return;
        
        // Clear existing timeout
        if (this.actionStatusTimeout) {
            clearTimeout(this.actionStatusTimeout);
        }
        
        // Show message
        this.actionStatusElement.textContent = message.toLowerCase();
        this.actionStatusElement.classList.remove('inactive');
        this.actionStatusElement.classList.add('active');
        
        // Auto-hide after duration
        this.actionStatusTimeout = setTimeout(() => {
            this.actionStatusElement.classList.remove('active');
            this.actionStatusElement.classList.add('inactive');
        }, duration);
    }

    /**
     * Clear action status message
     */
    clearActionStatus() {
        if (!this.actionStatusElement) return;
        
        if (this.actionStatusTimeout) {
            clearTimeout(this.actionStatusTimeout);
        }
        
        this.actionStatusElement.textContent = '';
        this.actionStatusElement.classList.remove('active');
        this.actionStatusElement.classList.add('inactive');
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
        // Load default bet from localStorage
        this.loadDefaultBet();
        
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
            this.showMessage(`Maximum bet is $${limits.max_bet}`, 'error');
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
        const actionButtons = ['hit-btn', 'stand-btn', 'double-btn', 'split-btn', 'surrender-btn', 'deal-btn'];
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
     * Make API call with proper error handling
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

            let response;
            try {
                response = await fetch(endpoint, options);
            } catch (fetchError) {
                // Network error - this includes broken pipe errors
                console.error('Network error during fetch:', fetchError.message);
                throw new Error(`Connection failed: ${fetchError.message || 'Server unreachable'}`);
            }
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                const preview = text.substring(0, 100);
                console.error('Non-JSON response received:', { status: response.status, text: preview });
                throw new Error(`Server error (${response.status}): Invalid response format`);
            }
            
            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error('Failed to parse JSON response:', jsonError);
                throw new Error('Server returned invalid JSON');
            }
            
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
     * Show message with multiple colored parts
     * @param {string} text1 - First part of message
     * @param {string} color1 - Color for first part
     * @param {string} text2 - Second part of message
     * @param {string} color2 - Color for second part
     */
    showMessageWithColors(text1, color1, text2, color2) {
        const messageElement = document.getElementById('game-message');
        if (messageElement) {
            messageElement.innerHTML = `<span style="color: ${color1}">${text1}</span><span style="color: ${color2}">${text2}</span>`;
            messageElement.className = 'game-message';
            // Reset inline color style since we're using spans
            messageElement.style.color = '';
        }
    }

    /**
     * Show blackjack celebration animation
     * @returns {Promise} Resolves when animation completes
     */
    showBlackjackCelebration() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('blackjack-celebration');
            if (!overlay) {
                resolve();
                return;
            }

            // Show the overlay
            overlay.style.display = 'flex';
            
            // After 2.5 seconds, start fade out
            setTimeout(() => {
                overlay.classList.add('fade-out');
                
                // After fade out completes (300ms), hide and clean up
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('fade-out');
                    resolve();
                }, 300);
            }, 2500);
        });
    }

    /**
     * Clear current dealer peek animation state
     */
    clearDealerPeekAnimation() {
        if (this.activePeekTimeout) {
            clearTimeout(this.activePeekTimeout);
            this.activePeekTimeout = null;
        }
        const activePeekElements = document.querySelectorAll('#dealer-hand .peeking');
        activePeekElements.forEach((el) => el.classList.remove('peeking'));
        this.isDealerPeekAnimating = false;
    }

    /**
     * Animate dealer peeking at hole card
     * @param {Object} options
     * @param {boolean} options.allowPlaceholder - Create a placeholder card if needed
     * @param {string} options.source - For logging context
     * @returns {Promise} Resolves when animation completes
     */
    async animateDealerPeek(options = {}) {
        const { allowPlaceholder = false, source = 'live' } = options;
        return new Promise((resolve) => {
            const dealerHandContainer = document.getElementById('dealer-hand');
            if (!dealerHandContainer) {
                console.warn('🎰 No dealer hand container found for peek animation');
                resolve();
                return;
            }

            let holeCard = dealerHandContainer.querySelector('.card.flipped');
            let cleanupPlaceholder = null;

            if (!holeCard && allowPlaceholder) {
                holeCard = this.createPeekTestCardElement();
                dealerHandContainer.prepend(holeCard);
                cleanupPlaceholder = () => {
                    if (holeCard && holeCard.parentNode) {
                        holeCard.parentNode.removeChild(holeCard);
                    }
                };
            }

            if (!holeCard) {
                console.warn('🎰 No flipped hole card available for peek animation');
                resolve();
                return;
            }

            console.log(`🎰 Animating dealer peek on hole card... (source: ${source})`);
            
            const duration = this.peekAnimationDurationMs || 1350;
            const cssDuration = `${duration}ms`;
            const cardInner = holeCard.querySelector('.card-inner');

            this.clearDealerPeekAnimation();

            if (cardInner) {
                cardInner.style.setProperty('--peek-duration', cssDuration);
            }
            holeCard.style.setProperty('--peek-duration', cssDuration);

            // Force reflow so the animation restarts
            void holeCard.offsetWidth;

            holeCard.classList.add('peeking');
            if (cardInner) {
                cardInner.classList.add('peeking');
            }

            this.isDealerPeekAnimating = true;

            this.activePeekTimeout = setTimeout(() => {
                holeCard.classList.remove('peeking');
                holeCard.style.removeProperty('--peek-duration');
                
                if (cardInner) {
                    cardInner.classList.remove('peeking');
                    cardInner.style.removeProperty('--peek-duration');
                }

                if (cleanupPlaceholder) {
                    setTimeout(cleanupPlaceholder, 200);
                }

                this.isDealerPeekAnimating = false;
                this.activePeekTimeout = null;
                console.log('🎰 Dealer peek animation complete');
                resolve();
            }, duration);
        });
    }

    /**
     * Build a temporary card element to demo the peek animation
     * without depending on the game state.
     */
    createPeekTestCardElement() {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card suit-spades flipped temp-peek-card';
        cardDiv.dataset.tempPeek = 'true';

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';

        const rankTop = document.createElement('div');
        rankTop.className = 'card-rank-top';
        rankTop.textContent = 'A';

        const suitDiv = document.createElement('div');
        suitDiv.className = 'card-suit';
        suitDiv.textContent = '♠';

        const rankBottom = document.createElement('div');
        rankBottom.className = 'card-rank-bottom';
        rankBottom.textContent = 'A';

        cardFront.appendChild(rankTop);
        cardFront.appendChild(suitDiv);
        cardFront.appendChild(rankBottom);

        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        const backPattern = document.createElement('div');
        backPattern.className = 'card-back-pattern';
        cardBack.appendChild(backPattern);

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        cardDiv.appendChild(cardInner);

        return cardDiv;
    }

    /**
     * Handle manual peek animation testing from the settings panel
     */
    async handleTestPeekAnimation() {
        if (this.isTestingPeek) {
            this.log('Peek animation test already running', 'warn');
            return;
        }

        if (this.isDealerPeekAnimating) {
            this.log('Dealer peek animation already running', 'warn');
            return;
        }

        this.isTestingPeek = true;
        const button = this.testPeekButton || null;
        const originalLabel = button ? button.textContent : '';

        if (button) {
            button.disabled = true;
            button.textContent = 'Testing...';
        }

        this.setActionStatus('testing dealer peek animation', this.peekAnimationDurationMs + 600);
        this.log('Manual dealer peek animation test triggered', 'action');

        try {
            await this.animateDealerPeek({ allowPlaceholder: true, source: 'test-button' });
        } catch (error) {
            console.error('Dealer peek animation test failed:', error);
            this.showMessage('Peek animation test failed - see console for details', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalLabel;
            }
            this.isTestingPeek = false;
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
                { starting_chips: 1000, dealer_hits_soft_17: this.dealerHitsSoft17 };
            
            const result = await this.apiCall('/api/new_game', 'POST', requestData);
            
            if (result.success) {
                this.gameId = result.game_id;
                this.loggedRoundId = null; // Reset logged round when starting new game
                this.updateGameState(result.game_state);
                this.previousBalance = 1000; // Reset tracking for fresh start
                this.lastInsuranceOutcomeSig = null;
                this.insuranceAnnouncedForGameId = null;
                this.updateButtonStates();
                this.showMessage('Bankroll refreshed! Place your bet to start!');
                this.log('Bankroll refreshed - new game with $1000', 'success');
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
            const { amount: bankrollAmount } = this.normalizeBankrollAmount(
                this.bankrollAmount,
                this.defaultBankrollAmount
            );

            if (bankrollAmount !== this.bankrollAmount) {
                this.setBankrollAmount(bankrollAmount);
            }

            this.showLoading();
            this.clearBet();
            this.clearHands();
            this.hideGameControls();
            this.showBettingArea();

            const result = await this.apiCall('/api/new_game', 'POST', {
                starting_chips: bankrollAmount,
                dealer_hits_soft_17: this.dealerHitsSoft17
            });

            if (result.success) {
                this.gameId = result.game_id;
                this.updateGameState(result.game_state);
                this.previousBalance = bankrollAmount; // Reset tracking for fresh start
                this.insuranceAnnouncedForGameId = null;
                this.updateButtonStates();
                this.showMessage(`Bankroll refreshed! Starting with $${bankrollAmount.toLocaleString()}. Place your bet to start!`);
                this.log(`Bankroll refreshed - new game with $${bankrollAmount.toLocaleString()}`, 'success');
            }
        } catch (error) {
            const errorMessage = error?.message || 'Error refreshing bankroll';
            this.log(`Refresh bankroll error: ${errorMessage}`, 'error');
            this.showMessage(errorMessage, 'error');
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

        // Validate against table limits
        const limits = this.gameState?.table_limits || { min_bet: 5, max_bet: 500 };
        if (amount < limits.min_bet) {
            this.showMessage(`Minimum bet is $${limits.min_bet}`, 'error');
            return false;
        }
        if (amount > limits.max_bet) {
            this.showMessage(`Maximum bet is $${limits.max_bet}`, 'error');
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
            this.showMessage('Finish the current hand before dealing again.', 'warn');
            return;
        }

        this.log('Starting dealCards process', 'deal');
        this.setActionStatus('dealing cards');
        
        // Auto-place default bet if no bet and default bet is set
        if (this.currentBet <= 0 && this.defaultBetAmount) {
            this.log(`📌 Auto-placing default bet: $${this.defaultBetAmount}`, 'action');
            this.currentBet = this.defaultBetAmount;
            this.updateBetDisplay();
        }
        
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
                        this.insuranceAnnouncedForGameId = null;
                        this.loggedRoundId = null; // Reset logged round when starting new round
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
                    // Error message already shown by placeBet() method
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
                
                // If dealer peeked (10-value upcard), show peek animation
                if (result.dealer_peeked) {
                    await this.animateDealerPeek();
                    // Update state again after peek animation
                    await this.updateGameStateFromServer();
                    this.renderHands();
                }
                
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
                        await this.showBlackjackCelebration();
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
                        this.showMessage(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉`, 'win');
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
                this.hideGameControls();
                this.showBettingArea();
            }
        } catch (error) {
            this.log(`Deal error: ${error.message}`, 'error');
            this.showMessage(`Error: ${error.message}`, 'error');
            this.hideGameControls();
            this.showBettingArea();
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
        this.setActionStatus('taking hit');
        
        const dealerUpCard = this.getDealerUpCard();
        const heckleAssessment = this.evaluateHitDecision(currentHandBeforeHit, dealerUpCard);
        if (heckleAssessment.shouldHeckle && heckleAssessment.message) {
            this.log(`Heckler triggered: ${heckleAssessment.message}`, 'warn');
            this.showHecklerMessage(heckleAssessment.message);
        }
        
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
                
                // Check for 5 Card Charlie first (before bust check)
                if (result.charlie) {
                    this.log(`🎉 5 CARD CHARLIE! You win! (Value: ${handToUse.value})`, 'win');
                    this.showMessage('5 Card Charlie! You win!', 'win');
                    if (result.game_over) {
                        await this.endGame();
                    }
                } else if (handToUse.is_bust) {
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
            return;
        }
        
        if (this.isProcessing) {
            this.log('STAND DENIED: Already processing another action', 'warn');
            return;
        }
        
        const playerHand = this.gameState?.player?.hands?.[this.gameState.player.current_hand_index];
        const playerValue = playerHand?.value || 0;
        this.log(`Player STANDS with value: ${playerValue}`, 'action');
        this.setActionStatus('standing');
        
        // Check if standing is a bad decision (11 or less)
        const heckleAssessment = this.evaluateStandDecision(playerHand);
        if (heckleAssessment.shouldHeckle && heckleAssessment.message) {
            this.log(`Heckler triggered: ${heckleAssessment.message}`, 'warn');
            this.showHecklerMessage(heckleAssessment.message);
        }
        
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
        this.setActionStatus('surrendering');
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/surrender', 'POST', {
                game_id: this.gameId
            });
            
            if (result.success) {
                this.log('Surrender API call successful', 'success');
                this.updateGameState(result.game_state);
                this.updateButtonStates();
                
                this.log(`After surrender - State: ${this.gameState.state}, Result: ${this.gameState.result}`, 'action');
                
                if (result.game_over) {
                    // If game is over, finalize immediately
                    await this.endGame();
                } else {
                    // If there are more hands, continue playing
                    this.log('More hands to play after surrender', 'action');
                }
                
                if (result.message) {
                    this.showMessage(result.message, 'success');
                }
            } else {
                this.log(`Surrender failed: ${result.error || result.message}`, 'error');
                this.showMessage(result.error || result.message || 'Surrender failed', 'error');
            }
        } catch (error) {
            this.log(`Surrender error: ${error.message}`, 'error');
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
        
        this.setActionStatus('double down');
        
        try {
            this.showLoading();
            const result = await this.apiCall('/api/double_down', 'POST', {
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
                        const delay = index * 150;
                        this.playerHandManager.dealCard(card, false, delay);
                    });
                    
                    // Wait for card animation to complete before proceeding
                    const lastCardDelay = (playerHand.cards.length - 1) * 150;
                    await new Promise(resolve => setTimeout(resolve, lastCardDelay + 300));
                } else {
                    // Fallback to renderHands if hand structure is unexpected
                    this.renderHands();
                }
                
                this.updateButtonStates();
                
                // If current hand is from split aces, surface a clear hint
                if (playerHand?.is_from_split_aces) {
                    this.setActionStatus('split aces: one card only', 4000);
                }
                
                // Double down automatically hits once and stands
                await this.playDealerTurn();
            } else {
                // Show error message if double down failed
                this.log(`Double down failed: ${result.error || result.message}`, 'error');
                this.setActionStatus(result.error || result.message || 'Double down failed', 3000);
            }
        } catch (error) {
            this.log(`Double down error: ${error.message}`, 'error');
            this.setActionStatus(`Error: ${error.message}`, 3000);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Player splits
     */
    async playerSplit() {
        if (!this.gameId || this.isProcessing) return;
        
        this.setActionStatus('splitting hand');
        
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
        
        const balance = this.gameState?.player?.chips || 0;
        const betAmount = this.currentBet || 0;
        
        // IMPORTANT: previousBalance should be the balance AFTER the bet was placed
        // because the bet is deducted when placed, not when the game ends
        const balanceAfterBet = this.previousBalance || 1000;
        
        // Calculate actual balance change (handles single hands, splits, blackjack, insurance)
        const balanceChange = balance - balanceAfterBet;
        const formattedAmount = Math.abs(balanceChange).toLocaleString();
        
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
                    this.showMessageWithColors(`${winMessage} 🎉, `, '#28a745', `Ins Lost: $${formattedInsuranceLoss}`, '#dc3545');
                } else {
                    // Insurance was paid (shouldn't happen on a win, but handle it)
                    const formattedInsurance = insuranceOutcome.amount.toLocaleString();
                    const winMessage = `You Win! +$${formattedWinProfit}`;
                    // Show both in green
                    this.showMessageWithColors(`${winMessage} 🎉, `, '#28a745', `Ins Paid: $${formattedInsurance}`, '#28a745');
                }
            } else {
                // No insurance involved
                const message = `You Win! +$${formattedWinProfit} 🎉`;
                this.showMessage(message, 'win');
            }
        } else if (result === 'blackjack') {
            this.log('ROUND WINNER: PLAYER WINS WITH BLACKJACK!', 'win');
            await this.showBlackjackCelebration();
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
                    this.showMessageWithColors(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉, `, '#28a745', `Ins Lost: $${formattedInsuranceLoss}`, '#dc3545');
                } else {
                    // Insurance was paid (shouldn't happen with blackjack, but handle it)
                    const formattedInsurance = insuranceOutcome.amount.toLocaleString();
                    this.showMessageWithColors(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉, `, '#28a745', `Ins Paid: $${formattedInsurance}`, '#28a745');
                }
            } else {
                // No insurance involved
                this.showMessage(`Blackjack! You Win! +$${formattedBlackjackProfit} 🎉`, 'win');
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
                    this.showMessageWithColors(`Lost $${formattedLoss}, `, '#dc3545', `Ins Paid: $${formattedInsurance}`, '#28a745');
                } else {
                    // Insurance was lost (dealer didn't have blackjack)
                    const formattedInsuranceLoss = insuranceOutcome.amount.toLocaleString();
                    // Show both losses in red
                    this.showMessageWithColors(`Lost $${formattedLoss}, `, '#dc3545', `Ins Lost: $${formattedInsuranceLoss}`, '#dc3545');
                }
            } else {
                // No insurance involved
                this.showMessage(`You Lose -$${formattedLoss}`, 'error');
            }
        } else if (result === 'push') {
            this.log('ROUND RESULT: PUSH (Tie)', 'action');
            this.showMessage('Push - It\'s a tie! $0', 'info');
        } else {
            this.log(`ROUND ENDED: Unknown result "${result}"`, 'warn');
            this.showMessage('Game Over', 'info');
        }
        
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
        
        this.hideGameControls();
        this.showBettingArea();
        this.log('Ready for next round - adjust your bet and deal when ready', 'action');
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
        
        // Update insurance UI
        this.updateInsuranceUI();
        this.updateAutoStatusUI();
        
        // Update cut card display
        this.updateCutCardDisplay();
        
        // Update test mode indicator and input value
        this.updateTestModeIndicator();
        if (this.forceDlrHandInput && state.force_dealer_hand) {
            this.forceDlrHandInput.value = state.force_dealer_hand;
        } else if (this.forceDlrHandInput && !state.force_dealer_hand) {
            this.forceDlrHandInput.value = '';
        }
        
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
                    this.setActionStatus(`insurance paid $${outcome.amount}`, 5000);
                    this.showMessage(`Insurance paid $${outcome.amount}`, 'success');
                    this.addInsuranceHistory(true, outcome.amount);
                } else if (outcome.paid === false) {
                    this.setActionStatus('insurance lost', 4000);
                    this.showMessage('Insurance lost', 'error');
                    this.addInsuranceHistory(false, outcome.amount);
                }
                this.lastInsuranceOutcomeSig = sig;
            }
        }
        
        // Update hand values
        this.updateHandValues();
        
        // Don't call updateButtonStates() here - it might be called while isProcessing is true
        // Call it explicitly after hideLoading() or when you know isProcessing is false
    }
    
    /**
     * Update test mode indicator (red dashed border) on dealer area
     */
    updateTestModeIndicator() {
        const dealerArea = document.querySelector('.dealer-area');
        if (!dealerArea) return;
        
        const isTestMode = this.gameState?.force_dealer_hand && this.gameState.force_dealer_hand.trim();
        if (isTestMode) {
            dealerArea.classList.add('test-mode');
        } else {
            dealerArea.classList.remove('test-mode');
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
            this.setActionStatus('insurance decision required');

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
            this.setActionStatus('even money available');
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
            this.clearActionStatus();
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
        // Green: >200 cards, Yellow: 156-200, Orange: 130-156, Red: <130
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
            
            // Disable if:
            // 1. Would exceed max bet
            // 2. Would exceed balance
            // 3. Chip value is less than min bet (for first bet)
            const wouldExceedMax = newBetAmount > maxBet;
            const wouldExceedBalance = newBetAmount > balance;
            const belowMinBet = currentBet === 0 && chipValue < minBet;
            
            if (wouldExceedMax || wouldExceedBalance || belowMinBet) {
                button.disabled = true;
                button.classList.add('disabled');
                button.title = wouldExceedMax 
                    ? `Maximum bet is $${maxBet}`
                    : wouldExceedBalance
                    ? 'Insufficient funds'
                    : `Minimum bet is $${minBet}`;
            } else {
                button.disabled = false;
                button.classList.remove('disabled');
                button.title = '';
            }
        });
    }

    /**
     * Update table sign display with current rules
     */
    updateTableSign() {
        const signContent = document.getElementById('table-sign-content');
        if (!signContent) return;

        // Use game state if available, otherwise use defaults
        const limits = this.gameState?.table_limits || { min_bet: 5, max_bet: 500 };
        const dealerHitsSoft17 = this.gameState?.dealer_hits_soft_17 || this.dealerHitsSoft17 || false;

        // Build sign text array
        const signTexts = [
            'BLACKJACK PAYS 3:2',
            dealerHitsSoft17 ? 'DEALER HITS SOFT 17' : 'DEALER STANDS ON 17',
            `TABLE LIMITS $${limits.min_bet} - $${limits.max_bet}`
        ];

        // Clear existing content
        signContent.innerHTML = '';

        // Add text elements with separators
        signTexts.forEach((text, index) => {
            const textSpan = document.createElement('span');
            textSpan.className = 'sign-text';
            textSpan.textContent = text;
            signContent.appendChild(textSpan);

            // Add separator between items (not after last)
            if (index < signTexts.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'sign-separator';
                separator.textContent = '•';
                signContent.appendChild(separator);
            }
        });

        // Check if content overflows and enable marquee if needed
        setTimeout(() => {
            const sign = document.getElementById('table-sign');
            if (sign && signContent) {
                const signWidth = sign.offsetWidth - 40; // Account for padding
                const contentWidth = signContent.scrollWidth;
                
                if (contentWidth > signWidth) {
                    // Content overflows - enable marquee
                    sign.classList.add('marquee-mode');
                    // Store content text for ::after pseudo-element duplication
                    const fullText = Array.from(signContent.querySelectorAll('.sign-text'))
                        .map(span => span.textContent)
                        .join(' • ');
                    signContent.setAttribute('data-content', fullText);
                } else {
                    // Content fits - disable marquee
                    sign.classList.remove('marquee-mode');
                    signContent.removeAttribute('data-content');
                }
            }
        }, 100);
    }

    prefillAutoModeForm() {
        const betInput = document.getElementById('auto-bet-input');
        const handsInput = document.getElementById('auto-hands-input');
        const radios = document.querySelectorAll('input[name="auto-insurance"]');
        if (!betInput || !handsInput || radios.length === 0) return;
        const defaultBet = this.autoSettings?.defaultBet ?? this.defaultBetAmount ?? 100;
        betInput.value = defaultBet || 100;
        const hands = this.autoSettings?.hands ?? 5;
        handsInput.value = hands;
        const insurancePref = this.autoSettings?.insurance ?? 'never';
        radios.forEach(radio => {
            radio.checked = radio.value === insurancePref;
        });
        const errorEl = document.getElementById('auto-error');
        if (errorEl) errorEl.textContent = '';
    }

    toggleAutoModePanel() {
        if (this.autoPanelVisible) {
            this.closeAutoModePanel();
        } else {
            this.openAutoModePanel();
        }
    }

    openAutoModePanel() {
        const panel = document.getElementById('auto-mode-panel');
        if (!panel) return;
        this.autoPanelVisible = true;
        panel.style.display = 'block';
        this.prefillAutoModeForm();
    }

    closeAutoModePanel() {
        const panel = document.getElementById('auto-mode-panel');
        if (!panel) return;
        this.autoPanelVisible = false;
        panel.style.display = 'none';
        const errorEl = document.getElementById('auto-error');
        if (errorEl) errorEl.textContent = '';
    }

    async handleAutoModeStart() {
        if (!this.gameId) {
            await this.newGame();
            if (!this.gameId) return;
        }
        const betInput = document.getElementById('auto-bet-input');
        const handsInput = document.getElementById('auto-hands-input');
        const radios = document.querySelectorAll('input[name="auto-insurance"]:checked');
        const errorEl = document.getElementById('auto-error');
        const autoStartBtn = document.getElementById('auto-start-btn');
        if (!betInput || !handsInput || radios.length === 0) return;
        const defaultBet = parseInt(betInput.value, 10);
        const hands = parseInt(handsInput.value, 10);
        const insuranceMode = radios[0].value;
        if (!defaultBet || defaultBet <= 0) {
            if (errorEl) errorEl.textContent = 'Enter a valid default bet.';
            return;
        }
        if (!hands || hands <= 0) {
            if (errorEl) errorEl.textContent = 'Enter how many hands to play.';
            return;
        }
        if (errorEl) errorEl.textContent = '';
        const payload = {
            game_id: this.gameId,
            default_bet: defaultBet,
            hands,
            insurance_mode: insuranceMode
        };
        try {
            if (autoStartBtn) autoStartBtn.disabled = true;
            this.showLoading();
            const result = await this.apiCall('/api/auto_mode/start', 'POST', payload);
            if (result.success) {
                this.updateGameState(result.game_state);
                this.saveAutoSettings({ defaultBet, hands, insurance: insuranceMode });
                const autoStatus = result.game_state?.auto_mode?.status;
                if (autoStatus) {
                    this.showMessage(autoStatus, 'info');
                } else {
                    this.showMessage(result.message || 'Auto mode complete', 'info');
                }
                this.closeAutoModePanel();
            } else {
                const errorMsg = result.error || result.message || 'Auto mode failed';
                this.showMessage(errorMsg, 'error');
                if (errorEl) errorEl.textContent = errorMsg;
            }
        } catch (error) {
            if (errorEl) errorEl.textContent = error.message || 'Auto mode failed';
        } finally {
            this.hideLoading();
            if (autoStartBtn) autoStartBtn.disabled = false;
            this.updateButtonStates();
            this.updateAutoStatusUI();
        }
    }

    updateAutoStatusUI() {
        const statusEl = document.getElementById('auto-status');
        const statusTextEl = document.getElementById('auto-status-text');
        const downloadBtn = document.getElementById('auto-download-log-btn');
        
        if (!statusEl) return;
        
        const autoMode = this.gameState?.auto_mode;
        if (autoMode?.status) {
            statusEl.style.display = 'block';
            if (statusTextEl) {
                statusTextEl.textContent = autoMode.status;
            }
            
            // Show download button if log file is available
            if (downloadBtn && autoMode.log_filename) {
                downloadBtn.style.display = 'inline-block';
                downloadBtn.onclick = () => this.downloadAutoModeLog(autoMode.log_filename);
            } else if (downloadBtn) {
                downloadBtn.style.display = 'none';
            }
        } else {
            statusEl.style.display = 'none';
            if (statusTextEl) {
                statusTextEl.textContent = '';
            }
            if (downloadBtn) {
                downloadBtn.style.display = 'none';
            }
        }
    }

    downloadAutoModeLog(logFilename) {
        if (!this.gameState?.game_id || !logFilename) {
            this.log('Cannot download log: missing game ID or filename', 'error');
            return;
        }
        
        const url = `/api/auto_mode/download_log?game_id=${encodeURIComponent(this.gameState.game_id)}&filename=${encodeURIComponent(logFilename)}`;
        window.location.href = url;
    }

    async handleLogHand() {
        if (!this.gameId) {
            this.showMessage('No active game', 'error');
            return;
        }
        
        // Get current round_id before logging
        const currentRoundId = this.gameState?.latest_round_id;
        if (!currentRoundId) {
            this.showMessage('No completed round to log', 'error');
            return;
        }
        
        // Check if this round has already been logged
        if (this.loggedRoundId === currentRoundId) {
            this.showMessage('This hand has already been logged', 'warn');
            return;
        }
        
        try {
            this.showLoading();
            const payload = {
                game_id: this.gameId
            };
            const result = await this.apiCall('/api/log_hand', 'POST', payload);
            
            if (result.success) {
                // Mark this round as logged and hide the button
                this.loggedRoundId = currentRoundId;
                const logHandBtn = document.getElementById('log-hand-btn');
                if (logHandBtn) {
                    logHandBtn.style.display = 'none';
                    logHandBtn.disabled = false; // Reset for next round
                }
                this.showMessage(result.message || 'Hand logged successfully', 'success');
                this.updateGameState(result.game_state);
            } else {
                this.showMessage(result.error || result.message || 'Failed to log hand', 'error');
            }
        } catch (error) {
            this.showMessage(error.message || 'Failed to log hand', 'error');
        } finally {
            this.hideLoading();
        }
    }

    downloadLogHand() {
        if (!this.gameId) {
            this.showMessage('No active game', 'error');
            return;
        }
        
        const url = `/api/download_log_hand?game_id=${encodeURIComponent(this.gameId)}`;
        window.location.href = url;
    }

    async clearLogHand() {
        if (!this.gameId) {
            this.showMessage('No active game', 'error');
            return;
        }
        
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to clear the LogHand.log file? This action cannot be undone.');
        if (!confirmed) {
            return;
        }
        
        try {
            this.showLoading();
            const payload = {
                game_id: this.gameId
            };
            const result = await this.apiCall('/api/clear_log_hand', 'POST', payload);
            
            if (result.success) {
                this.showMessage(result.message || 'Log file cleared successfully', 'success');
            } else {
                this.showMessage(result.error || result.message || 'Failed to clear log file', 'error');
            }
        } catch (error) {
            this.showMessage(error.message || 'Failed to clear log file', 'error');
        } finally {
            this.hideLoading();
        }
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
            const surrenderBtn = document.getElementById('surrender-btn');
            
            if (hitBtn) {
                hitBtn.disabled = true;
                hitBtn.removeAttribute('title');
                this.log('Hit button disabled (game over)', 'action');
            } else {
                this.log('ERROR: hit-btn element not found!', 'error');
            }
            if (standBtn) standBtn.disabled = true;
            if (doubleBtn) {
                doubleBtn.disabled = true;
                doubleBtn.removeAttribute('title');
            }
            if (splitBtn) splitBtn.disabled = true;
            if (surrenderBtn) {
                surrenderBtn.disabled = true;
                surrenderBtn.style.display = 'none';
            }

            const dealBtn = document.getElementById('deal-btn');
            const autoActive = !!this.gameState.auto_mode?.active;
            if (dealBtn) {
                dealBtn.disabled = autoActive || this.isProcessing;
                if (!dealBtn.disabled) {
                    dealBtn.title = 'Deal the next hand';
                } else if (autoActive) {
                    dealBtn.title = 'auto mode running';
                }
            }

            // Ensure betting UI is interactive again unless auto mode is active
            if (!autoActive) {
                document.querySelectorAll('.chip').forEach((chip) => {
                    chip.disabled = false;
                });
                const clearBetBtn = document.getElementById('clear-bet-btn');
                if (clearBetBtn) {
                    clearBetBtn.disabled = false;
                }
            }
            
            return;
        }
        
        const playerHand = this.gameState.player?.hands?.[this.gameState.player.current_hand_index];
        const isSplitAces = !!playerHand?.is_from_split_aces;
        const insuranceActive = !!this.gameState.insurance_offer_active || !!this.gameState.even_money_offer_active;
        const autoActive = !!this.gameState.auto_mode?.active;
        
        // Enable/disable double down
        const doubleBtn = document.getElementById('double-btn');
        if (doubleBtn && playerHand) {
            const canDouble = playerHand.can_double_down && this.gameState.state === 'player_turn' && !isSplitAces && !insuranceActive && !autoActive;
            doubleBtn.disabled = !canDouble;
            if (isSplitAces) {
                doubleBtn.title = 'split aces: one card only';
            } else if (insuranceActive) {
                doubleBtn.title = 'insurance decision required';
            } else if (autoActive) {
                doubleBtn.title = 'auto mode running';
            } else {
                doubleBtn.removeAttribute('title');
            }
        }
        
        // Enable/disable split
        const splitBtn = document.getElementById('split-btn');
        if (splitBtn && playerHand) {
            const canSplit = playerHand.can_split && this.gameState.state === 'player_turn' && !insuranceActive && !autoActive;
            splitBtn.style.display = canSplit ? 'block' : 'none';
            splitBtn.disabled = !canSplit;
        }
        
        // Enable/disable surrender
        const surrenderBtn = document.getElementById('surrender-btn');
        if (surrenderBtn && playerHand) {
            // Surrender only available on first action (exactly 2 cards, no actions taken)
            const hasTwoCards = playerHand.cards && playerHand.cards.length === 2;
            const canSurrender = hasTwoCards && 
                                 this.gameState.state === 'player_turn' && 
                                 !insuranceActive && 
                                 !autoActive && 
                                 !isSplitAces &&
                                 !playerHand.is_doubled_down &&
                                 !playerHand.is_surrendered;
            surrenderBtn.style.display = canSurrender ? 'block' : 'none';
            surrenderBtn.disabled = !canSurrender;
            if (isSplitAces) {
                surrenderBtn.title = 'not allowed on split aces';
            } else if (insuranceActive) {
                surrenderBtn.title = 'insurance decision required';
            } else if (autoActive) {
                surrenderBtn.title = 'auto mode running';
            } else if (!hasTwoCards) {
                surrenderBtn.title = 'surrender only available before taking any actions';
            } else {
                surrenderBtn.removeAttribute('title');
            }
        }
        
        // Enable/disable hit and stand
        const hitBtn = document.getElementById('hit-btn');
        const standBtn = document.getElementById('stand-btn');
        const isPlayerTurn = this.gameState.state === 'player_turn';
        
        this.log(`Button state update - isPlayerTurn: ${isPlayerTurn}, state: ${this.gameState.state}, isProcessing: ${this.isProcessing}`, 'action');
        
        if (!hitBtn) {
            this.log('ERROR: hit-btn element not found in DOM!', 'error');
        } else {
            const shouldBeDisabled = !isPlayerTurn || this.isProcessing || isSplitAces || insuranceActive || autoActive;
            hitBtn.disabled = shouldBeDisabled;
            if (isSplitAces) {
                hitBtn.title = 'split aces: one card only';
            } else if (insuranceActive) {
                hitBtn.title = 'insurance decision required';
                this.setActionStatus('insurance decision required', 3000);
            } else if (autoActive) {
                hitBtn.title = 'auto mode running';
            } else {
                hitBtn.removeAttribute('title');
            }
            this.log(`Hit button - disabled: ${hitBtn.disabled}, shouldBeDisabled: ${shouldBeDisabled}`, 'action');
        }
        
        if (!standBtn) {
            this.log('ERROR: stand-btn element not found!', 'error');
        } else {
            const shouldBeDisabled = !isPlayerTurn || this.isProcessing || insuranceActive || autoActive;
            standBtn.disabled = shouldBeDisabled;
            if (autoActive) {
                standBtn.title = 'auto mode running';
            } else if (insuranceActive) {
                standBtn.title = 'insurance decision required';
            } else {
                standBtn.removeAttribute('title');
            }
        }
        
        // Disable new game/refresh buttons when auto active
        const autoDisabled = autoActive;
        const refreshBtn = document.getElementById('refresh-bankroll-btn');
        if (refreshBtn) refreshBtn.disabled = autoDisabled;
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
            bettingArea.classList.remove('action-mode');
            this.log('Betting area shown and enabled', 'action');
        }
        
        const bettingLabel = document.getElementById('betting-label');
        if (bettingLabel) {
            bettingLabel.textContent = 'Place Your Bet';
        }
        
        const gameControls = document.getElementById('game-controls');
        if (gameControls) {
            gameControls.style.display = 'none';
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
     * Hide betting area
     */
    hideBettingArea() {
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'block';
            bettingArea.classList.add('action-mode');
            this.log('Betting area switched to action mode', 'action');
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
        
        const bettingLabel = document.getElementById('betting-label');
        if (bettingLabel) {
            bettingLabel.textContent = 'Choose Your Action';
        }
        
        const gameControls = document.getElementById('game-controls');
        if (gameControls) {
            gameControls.style.display = 'flex';
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
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.classList.add('action-mode');
        }
        const bettingLabel = document.getElementById('betting-label');
        if (bettingLabel) {
            bettingLabel.textContent = 'Choose Your Action';
        }
        const dealBtn = document.getElementById('deal-btn');
        if (dealBtn) {
            dealBtn.disabled = true;
        }
        document.querySelectorAll('.chip').forEach(chip => {
            chip.disabled = true;
        });
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
            if (item.result === 'win' || item.result === 'blackjack' || item.result === 'insurance_win') {
                resultEmoji = '✅';
            } else if (item.result === 'loss' || item.result === 'insurance_loss') {
                resultEmoji = '❌';
            } else if (item.result === 'push') {
                resultEmoji = '🤝';
            }
            
            const resultText = (item.result === 'blackjack') ? 'BLACKJACK' : item.displayResult;
            
            historyItem.innerHTML = `
                <span class="history-result">${resultEmoji} ${resultText}</span>
                <span class="history-amount">${item.amountDisplay}</span>
            `;
            
            historyList.appendChild(historyItem);
        });
    }

    /**
     * Load default bet from localStorage
     */
    loadDefaultBet() {
        try {
            const stored = localStorage.getItem(this.defaultBetStorageKey);
            if (stored) {
                this.defaultBetAmount = parseInt(stored);
                this.log(`💾 Default bet loaded: $${this.defaultBetAmount}`, 'info');
            }
        } catch (error) {
            console.warn('Failed to load default bet:', error);
        }
    }

    loadAutoSettings() {
        try {
            const stored = localStorage.getItem(this.autoSettingsKey);
            if (!stored) return { defaultBet: null, hands: 5, insurance: 'never' };
            const parsed = JSON.parse(stored);
            return {
                defaultBet: parsed?.defaultBet ?? null,
                hands: parsed?.hands ?? 5,
                insurance: parsed?.insurance ?? 'never'
            };
        } catch (error) {
            console.warn('Failed to load auto settings:', error);
            return { defaultBet: null, hands: 5, insurance: 'never' };
        }
    }

    saveAutoSettings(settings) {
        try {
            localStorage.setItem(this.autoSettingsKey, JSON.stringify(settings));
            this.autoSettings = settings;
        } catch (error) {
            console.warn('Failed to save auto settings:', error);
        }
    }

    /**
     * Save default bet to localStorage
     */
    saveDefaultBet() {
        try {
            if (this.defaultBetAmount) {
                localStorage.setItem(this.defaultBetStorageKey, this.defaultBetAmount.toString());
            }
        } catch (error) {
            console.warn('Failed to save default bet:', error);
        }
    }

    /**
     * Set a chip as the default bet
     */
    setDefaultBet(value) {
        this.defaultBetAmount = value;
        this.saveDefaultBet();
        this.updateDefaultBetDisplay();
        this.log(`💰 Default bet set to $${value}`, 'action');
        this.showMessage(`Default bet set to $${value}`, 'success');
    }

    /**
     * Update visual display of default bet indicator
     */
    updateDefaultBetDisplay() {
        // Remove previous default indicator
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.remove('default-bet');
            chip.removeAttribute('data-default');
        });
        
        // Add indicator to default bet chip
        if (this.defaultBetAmount) {
            const defaultChip = document.querySelector(`.chip[data-value="${this.defaultBetAmount}"]`);
            if (defaultChip) {
                defaultChip.classList.add('default-bet');
                defaultChip.setAttribute('data-default', 'true');
            }
        }
    }

    addInsuranceHistory(paid, amount) {
        const timestamp = new Date().toLocaleTimeString();
        const historyItem = {
            result: paid ? 'insurance_win' : 'insurance_loss',
            displayResult: 'INSURANCE',
            bet: 0,
            amountDisplay: paid ? `+$${amount}` : `-$${amount}`,
            balanceChange: paid ? amount : -amount,
            timestamp
        };
        this.gameHistory.unshift(historyItem);
        if (this.gameHistory.length > 5) this.gameHistory.pop();
        this.updateHistoryDisplay();
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

function playerSurrender() {
    if (game) {
        game.playerSurrender();
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

/**
 * Rules Panel Management
 */
let rulesPanel = {
    isOpen: false,
    currentPage: 'basic',
    
    init() {
        const infoToggle = document.getElementById('info-toggle');
        const rulesCloseBtn = document.getElementById('rules-close');
        const rulesNextBtn = document.getElementById('rules-next-btn');
        const rulesPrevBtn = document.getElementById('rules-prev-btn');
        const rulesCasinoInfoBtn = document.getElementById('rules-casino-info-btn');
        const rulesBackBtn = document.getElementById('rules-back-btn');
        const rulesShortcutsBtn = document.getElementById('rules-shortcuts-btn');
        const rulesShortcutsBackBtn = document.getElementById('rules-shortcuts-back-btn');
        
        if (infoToggle) {
            infoToggle.addEventListener('click', () => this.toggle());
        }
        
        if (rulesCloseBtn) {
            rulesCloseBtn.addEventListener('click', () => this.close());
        }
        
        if (rulesNextBtn) {
            rulesNextBtn.addEventListener('click', () => this.showPage('advanced'));
        }
        
        if (rulesPrevBtn) {
            rulesPrevBtn.addEventListener('click', () => this.showPage('basic'));
        }
        
        if (rulesCasinoInfoBtn) {
            rulesCasinoInfoBtn.addEventListener('click', () => this.showPage('casino'));
        }
        
        if (rulesBackBtn) {
            rulesBackBtn.addEventListener('click', () => this.showPage('advanced'));
        }
        
        if (rulesShortcutsBtn) {
            rulesShortcutsBtn.addEventListener('click', () => this.showPage('shortcuts'));
        }
        
        if (rulesShortcutsBackBtn) {
            rulesShortcutsBackBtn.addEventListener('click', () => this.showPage('basic'));
        }
        
        // Close rules panel when clicking outside
        document.addEventListener('click', (e) => {
            const rulesPanelEl = document.getElementById('rules-panel');
            const infoToggleEl = document.getElementById('info-toggle');
            
            if (this.isOpen && rulesPanelEl && !rulesPanelEl.contains(e.target) && !infoToggleEl.contains(e.target)) {
                this.close();
            }
        });
        
        // Close rules panel with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    },
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },
    
    open() {
        const rulesPanelEl = document.getElementById('rules-panel');
        const settingsPanelEl = document.getElementById('settings-panel');
        
        if (rulesPanelEl) {
            rulesPanelEl.classList.add('open');
            rulesPanelEl.setAttribute('aria-hidden', 'false');
            this.isOpen = true;
            
            // Close settings panel if open
            if (settingsPanelEl && settingsPanelEl.classList.contains('open')) {
                settingsPanelEl.classList.remove('open');
                settingsPanelEl.setAttribute('aria-hidden', 'true');
            }
        }
    },
    
    close() {
        const rulesPanelEl = document.getElementById('rules-panel');
        
        if (rulesPanelEl) {
            rulesPanelEl.classList.remove('open');
            rulesPanelEl.setAttribute('aria-hidden', 'true');
            this.isOpen = false;
        }
    },
    
    showPage(page) {
        const basicPageEl = document.getElementById('rules-page-basic');
        const advancedPageEl = document.getElementById('rules-page-advanced');
        const casinoPageEl = document.getElementById('rules-page-casino');
        const shortcutsPageEl = document.getElementById('rules-page-shortcuts');
        
        if (page === 'basic') {
            if (basicPageEl) basicPageEl.style.display = 'block';
            if (advancedPageEl) advancedPageEl.style.display = 'none';
            if (casinoPageEl) casinoPageEl.style.display = 'none';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
            this.currentPage = 'basic';
        } else if (page === 'advanced') {
            if (basicPageEl) basicPageEl.style.display = 'none';
            if (advancedPageEl) advancedPageEl.style.display = 'block';
            if (casinoPageEl) casinoPageEl.style.display = 'none';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
            this.currentPage = 'advanced';
        } else if (page === 'casino') {
            if (basicPageEl) basicPageEl.style.display = 'none';
            if (advancedPageEl) advancedPageEl.style.display = 'none';
            if (casinoPageEl) casinoPageEl.style.display = 'block';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
            this.currentPage = 'casino';
        } else if (page === 'shortcuts') {
            if (basicPageEl) basicPageEl.style.display = 'none';
            if (advancedPageEl) advancedPageEl.style.display = 'none';
            if (casinoPageEl) casinoPageEl.style.display = 'none';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'block';
            this.currentPage = 'shortcuts';
        }
    }
};

// Initialize rules panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    rulesPanel.init();
});
