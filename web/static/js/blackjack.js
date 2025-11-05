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
        this.hecklerSettingsNote = null;
        this.boundOutsideClickHandler = null;
        this.boundEscapeHandler = null;
        this.hecklerSettingsKey = 'blackjack_heckler_settings';
        this.hecklerPreferences = this.loadHecklerPreferences();
        this.pendingPreferredVoiceId = this.hecklerPreferences?.voiceId || null;
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
                rate: parsed?.rate || null
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
                rate: this.hecklerSpeechRate
            };
            window.localStorage.setItem(this.hecklerSettingsKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to save heckler preferences:', error);
        }
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
            this.hecklerVoiceSelect = document.getElementById('heckler-voice-select');
            this.hecklerSpeedRange = document.getElementById('heckler-speed-range');
            this.hecklerSpeedDisplay = document.getElementById('heckler-speed-display');
            this.hecklerSettingsNote = document.getElementById('heckler-settings-note');

            // Only proceed if the essential elements exist
            if (!this.settingsToggle || !this.settingsPanel) {
                console.warn('Settings panel elements not found in DOM');
                return;
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
                        this.saveHecklerPreferences();
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
        try {
            const synth = window.speechSynthesis;
            if (!synth) {
                this.useSpeechSynthesis = false;
                return;
            }

            const assignVoice = () => {
                const voices = synth.getVoices();
                if (!voices || !voices.length) {
                    return;
                }

                const usVoices = voices.filter((voice) => {
                    const lang = voice.lang || '';
                    return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
                });

                let selectedVoice = null;
                if (this.pendingPreferredVoiceId) {
                    selectedVoice = usVoices.find((voice) => this.getVoiceIdentifier(voice) === this.pendingPreferredVoiceId) || null;
                }

                if (!selectedVoice && usVoices.length > 0) {
                    selectedVoice = usVoices[0];
                    this.pendingPreferredVoiceId = this.getVoiceIdentifier(selectedVoice);
                }

                this.hecklerVoice = selectedVoice || null;
                this.populateVoiceOptions(voices);
                this.saveHecklerPreferences();
            };

            assignVoice();
            synth.addEventListener('voiceschanged', assignVoice);
            this.hecklerVoicesListener = assignVoice;
        } catch (error) {
            console.error('Heckler voice setup failed:', error);
            this.useSpeechSynthesis = false;
            this.hecklerVoice = null;
        }
    }

    /**
     * Speak the heckler commentary using Web Speech API
     */
    speakHecklerLine(message, token) {
        if (!this.useSpeechSynthesis || !message || typeof window === 'undefined') return false;
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
        
        // Setup chip selection
        this.setupChipSelection();
        this.initSettingsPanel();
        this.setupKeyboardHotkeys();
        
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
     * Setup keyboard hotkeys for quick game actions
     */
    setupKeyboardHotkeys() {
        // Log hotkeys to console for user reference
        console.log('%c⌨️ KEYBOARD HOTKEYS AVAILABLE', 'color: #FFD700; font-size: 14px; font-weight: bold');
        console.log('%cN%c = New Game', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cH%c = Hit', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cS%c = Stand', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%cD%c = Deal Cards', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%c1%c = Bet $100', 'color: #FFD700; font-weight: bold', 'color: #fff');
        console.log('%c5%c = Bet $500', 'color: #FFD700; font-weight: bold', 'color: #fff');

        document.addEventListener('keydown', (event) => {
            // Don't trigger hotkeys if user is typing in an input field
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = event.key.toLowerCase();

            switch(key) {
                case 'n':
                    this.log('⌨️ Hotkey: New Game (N)', 'action');
                    this.newGame();
                    break;
                case 'h':
                    this.log('⌨️ Hotkey: Hit (H)', 'action');
                    this.playerHit();
                    break;
                case 's':
                    this.log('⌨️ Hotkey: Stand (S)', 'action');
                    this.playerStand();
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

        const handsBeforeHit = this.gameState?.player?.hands || [];
        const requestedIndexBeforeHit = this.gameState?.player?.current_hand_index || 0;
        const safeIndexBeforeHit = (requestedIndexBeforeHit < handsBeforeHit.length) ? requestedIndexBeforeHit : Math.max(0, handsBeforeHit.length - 1);
        const currentHandBeforeHit = handsBeforeHit[safeIndexBeforeHit] || null;
        const currentValue = currentHandBeforeHit?.value || 0;
        this.log(`Player attempting HIT (current value: ${currentValue})`, 'hit');
        
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
     * Show betting area but keep it disabled (for when game ends)
     */
    showBettingAreaDisabled() {
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'block';
            bettingArea.classList.remove('action-mode');
            this.log('Betting area shown but DISABLED (game ended)', 'action');
        }
        
        const bettingLabel = document.getElementById('betting-label');
        if (bettingLabel) {
            bettingLabel.textContent = 'Betting Locked';
        }
        
        const gameControls = document.getElementById('game-controls');
        if (gameControls) {
            gameControls.style.display = 'none';
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
