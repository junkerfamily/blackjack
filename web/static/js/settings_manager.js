export class SettingsManager {
    constructor(game) {
        this.game = game;
        this.boundOutsideClickHandler = null;
        this.boundEscapeHandler = null;
    }

    getVoiceIdentifier(voice) {
        if (!voice) return null;
        return voice.voiceURI || `${voice.name}|${voice.lang}`;
    }

    populateVoiceOptions(voices) {
        const { hecklerVoiceSelect, pendingPreferredVoiceId } = this.game;
        if (!hecklerVoiceSelect) return;
        if (!Array.isArray(voices)) {
            hecklerVoiceSelect.innerHTML = '';
            hecklerVoiceSelect.disabled = true;
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No voices available';
            hecklerVoiceSelect.appendChild(option);
            return;
        }

        const filteredVoices = voices.filter((voice) => {
            const lang = voice.lang || '';
            return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
        });

        hecklerVoiceSelect.innerHTML = '';
        if (filteredVoices.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No US English voices';
            hecklerVoiceSelect.appendChild(option);
            hecklerVoiceSelect.disabled = true;
            this.game.hecklerVoice = null;
            this.game.pendingPreferredVoiceId = null;
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
            if (this.game.hecklerVoice && identifier === this.getVoiceIdentifier(this.game.hecklerVoice)) {
                option.selected = true;
            } else if (!this.game.hecklerVoice && pendingPreferredVoiceId && identifier === pendingPreferredVoiceId) {
                option.selected = true;
            }
            optionsFragment.appendChild(option);
        });
        hecklerVoiceSelect.appendChild(optionsFragment);
        hecklerVoiceSelect.disabled = false;

        const selectedOption = hecklerVoiceSelect.options[hecklerVoiceSelect.selectedIndex];
        if (selectedOption) {
            hecklerVoiceSelect.value = selectedOption.value;
        }
    }

    assignPreferredVoice(voices) {
        const { hecklerVoice, pendingPreferredVoiceId } = this.game;
        if (!Array.isArray(voices) || !voices.length) return;
        const preferredId = pendingPreferredVoiceId || this.game.hecklerPreferences?.voiceId;
        if (preferredId) {
            const preferredVoice = voices.find((voice) => this.getVoiceIdentifier(voice) === preferredId);
            if (preferredVoice) {
                this.game.hecklerVoice = preferredVoice;
                this.game.pendingPreferredVoiceId = preferredId;
                return;
            }
        }

        const filteredVoices = voices.filter((voice) => {
            const lang = voice.lang || '';
            return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
        });

        if (filteredVoices.length > 0) {
            const defaultVoice = filteredVoices.find((voice) => voice.default);
            if (defaultVoice) {
                this.game.hecklerVoice = defaultVoice;
                this.game.pendingPreferredVoiceId = this.getVoiceIdentifier(defaultVoice);
            } else {
                this.game.hecklerVoice = filteredVoices[0];
                this.game.pendingPreferredVoiceId = this.getVoiceIdentifier(filteredVoices[0]);
            }
        }
    }

    refreshVoiceOptions() {
        if (!this.game.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            return;
        }
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length) {
            this.populateVoiceOptions(voices);
            this.assignPreferredVoice(voices);
        }
    }

    setupHecklerVoices() {
        if (!this.game.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            return;
        }
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
        this.game.hecklerVoicesListener = loadVoices;
    }

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
            game.hecklerSettingsNote = document.getElementById('heckler-settings-note');
            game.bankrollSettingInput = document.getElementById('bankroll-setting-input');
            game.bankrollHelperElement = document.getElementById('bankroll-setting-helper');
            game.dealerDelayInput = document.getElementById('dealer-delay-input');
            game.dealerDelayHelperElement = document.getElementById('dealer-delay-helper');
            game.dealerHitsSoft17Toggle = document.getElementById('dealer-hits-soft17-toggle');
            game.forceDlrHandInput = document.getElementById('force-dlr-hand-input');
            game.testPeekButton = document.getElementById('test-peek-btn');

            if (!game.settingsToggle || !game.settingsPanel) {
                console.warn('Settings panel elements not found in DOM');
                return;
            }

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
                        game.updateTableSign();
                    }
                });
            } else {
                console.warn('Dealer hits soft 17 toggle not found in settings panel');
            }

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

            if (game.testPeekButton) {
                game.testPeekButton.addEventListener('click', () => game.ui.handleTestPeekAnimation());
            } else {
                console.warn('Test peek animation button not found in settings panel');
            }

            game.ui.updateBankrollHelper();
            game.ui.updateDealerDelayHelper();

            if (game.hecklerEnabledToggle) {
                game.hecklerEnabledToggle.checked = game.voiceEnabled;
                game.hecklerEnabledToggle.addEventListener('change', (event) => {
                    game.voiceEnabled = event.target.checked;
                    game.saveHecklerPreferences();
                    const statusMessage = game.voiceEnabled ? 'Voice commentary enabled' : 'Voice commentary disabled';
                    game.log(statusMessage, 'success');
                    if (game.voiceEnabled) {
                        game.previewHecklerVoice(true);
                    } else {
                        game.stopHecklerSpeech();
                    }
                });
            }

            if (game.hecklerTestButton) {
                game.hecklerTestButton.addEventListener('click', () => {
                    game.playVoiceTest();
                });
            }

            if (game.hecklerSpeedRange) {
                const clampedRate = Math.min(
                    parseFloat(game.hecklerSpeedRange.max || '1.6'),
                    Math.max(parseFloat(game.hecklerSpeedRange.min || '0.6'), game.hecklerSpeechRate)
                );
                game.hecklerSpeechRate = clampedRate;
                game.hecklerSpeedRange.value = clampedRate;
                this.updateSpeedDisplay(clampedRate);
                game.hecklerSpeedRange.addEventListener('input', (event) => {
                    const rate = parseFloat(event.target.value);
                    if (!Number.isNaN(rate)) {
                        game.hecklerSpeechRate = rate;
                        this.updateSpeedDisplay(rate);
                        game.saveHecklerPreferences();
                    }
                });
            }

            const updateVoiceSelection = () => {
                if (!game.hecklerVoiceSelect) return;
                game.hecklerVoiceSelect.addEventListener('change', (event) => {
                    const selectedId = event.target.value;
                    game.pendingPreferredVoiceId = selectedId || null;
                    if (!game.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
                        return;
                    }
                    const voices = window.speechSynthesis.getVoices();
                    if (!voices || !voices.length) {
                        return;
                    }
                    const chosenVoice = voices.find((voice) => this.getVoiceIdentifier(voice) === selectedId);
                    if (chosenVoice) {
                        game.hecklerVoice = chosenVoice;
                        if (game.hecklerPreferences === null) {
                            game.hecklerPreferences = {};
                        }
                        game.hecklerPreferences.voiceId = selectedId;
                        game.saveHecklerPreferences();
                        game.previewHecklerVoice(true);
                    }
                });
            };

            if (game.settingsToggle) {
                game.settingsToggle.setAttribute('aria-expanded', 'false');
                game.settingsToggle.addEventListener('click', () => {
                    this.toggleSettingsPanel(!game.settingsPanel.classList.contains('open'));
                });
            }

            if (game.settingsCloseBtn) {
                game.settingsCloseBtn.addEventListener('click', () => this.toggleSettingsPanel(false));
            }

            if (game.useSpeechSynthesis) {
                updateVoiceSelection();
                this.refreshVoiceOptions();
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
            if (game.bankrollSettingInput) {
                game.bankrollSettingInput.value = game.bankrollAmount;
            }
            if (game.dealerDelayInput) {
                game.dealerDelayInput.value = game.dealerHitDelayMs;
            }
            if (game.hecklerEnabledToggle) {
                game.hecklerEnabledToggle.checked = game.voiceEnabled;
            }
            game.updateBankrollHelper();
            game.updateDealerDelayHelper();
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
            game.updateBankrollHelper();
            game.updateDealerDelayHelper();
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

    /**
     * Heckler voice-related methods
     */
    previewHecklerVoice(force = false) {
        const game = this.game;
        if ((!force && !game.voiceEnabled) || !game.useSpeechSynthesis || !game.hecklerVoice) return;
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance('Are you feeling lucky today?');
        utterance.voice = game.hecklerVoice;
        utterance.rate = game.hecklerSpeechRate;
        synth.cancel();
        synth.speak(utterance);
    }

    playVoiceTest() {
        const game = this.game;
        if (!game.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            game.log('Voice test requested but speech synthesis is unavailable', 'warn');
            return;
        }
        const synth = window.speechSynthesis;
        try {
            synth.cancel();
        } catch (error) {
            console.warn('Failed to cancel speech synthesis before test:', error);
        }
        const utterance = new SpeechSynthesisUtterance('Testing 1, Testing 2, Testing 3.');
        if (game.hecklerVoice) {
            utterance.voice = game.hecklerVoice;
        } else {
            const voices = synth.getVoices();
            const usVoice = voices.find((voice) => {
                const lang = voice.lang || '';
                return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
            });
            if (usVoice) {
                utterance.voice = usVoice;
                game.hecklerVoice = usVoice;
                game.pendingPreferredVoiceId = this.getVoiceIdentifier(usVoice);
                game.saveHecklerPreferences();
            }
        }
        utterance.rate = game.hecklerSpeechRate;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        synth.speak(utterance);
    }

    speakHecklerLine(message, token) {
        const game = this.game;
        if (!game.voiceEnabled || !game.useSpeechSynthesis || !message || typeof window === 'undefined') return false;
        const synth = window.speechSynthesis;
        if (!synth) return false;

        try {
            this.stopHecklerSpeech();
            const utterance = new SpeechSynthesisUtterance(message);
            if (game.hecklerVoice) {
                utterance.voice = game.hecklerVoice;
            } else {
                const voices = synth.getVoices();
                const usVoice = voices.find((voice) => {
                    const lang = voice.lang || '';
                    return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
                });
                if (usVoice) {
                    utterance.voice = usVoice;
                    game.hecklerVoice = usVoice;
                    game.pendingPreferredVoiceId = this.getVoiceIdentifier(usVoice);
                    game.saveHecklerPreferences();
                    this.refreshVoiceOptions();
                }
            }
            utterance.rate = game.hecklerSpeechRate;
            utterance.pitch = 1;
            utterance.volume = 0.9;
            utterance.onend = () => {
                game.currentHecklerUtterance = null;
                if (token && token === game.activeHecklerToken) {
                    game.hideHecklerMessage(token);
                }
            };
            utterance.onerror = () => {
                game.currentHecklerUtterance = null;
                if (token && token === game.activeHecklerToken) {
                    game.hideHecklerMessage(token);
                }
            };
            game.currentHecklerUtterance = utterance;
            synth.speak(utterance);
            return true;
        } catch (error) {
            console.error('Heckler speech failed:', error);
            game.useSpeechSynthesis = false;
            game.currentHecklerUtterance = null;
            return false;
        }
    }

    stopHecklerSpeech() {
        const game = this.game;
        if (!game.useSpeechSynthesis || typeof window === 'undefined') return;
        const synth = window.speechSynthesis;
        if (!synth) return;
        try {
            if (synth.speaking || synth.pending) {
                synth.cancel();
            }
        } catch (error) {
            console.error('Failed to cancel heckler speech:', error);
        } finally {
            game.currentHecklerUtterance = null;
        }
    }

    /**
     * Auto mode panel methods
     */
    prefillAutoModeForm() {
        const betInput = document.getElementById('auto-bet-input');
        const handsInput = document.getElementById('auto-hands-input');
        const radios = document.querySelectorAll('input[name="auto-insurance"]:checked');
        if (!betInput || !handsInput || radios.length === 0) return;
        const game = this.game;
        const defaultBet = game.autoSettings?.defaultBet ?? game.defaultBetAmount ?? 100;
        betInput.value = defaultBet || 100;
        const hands = game.autoSettings?.hands ?? 5;
        handsInput.value = hands;
        const insurancePref = game.autoSettings?.insurance ?? 'never';
        radios.forEach(radio => {
            radio.checked = radio.value === insurancePref;
        });
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
    }

    closeAutoModePanel() {
        const panel = document.getElementById('auto-mode-panel');
        if (!panel) return;
        this.game.autoPanelVisible = false;
        panel.style.display = 'none';
        const errorEl = document.getElementById('auto-error');
        if (errorEl) errorEl.textContent = '';
    }
}

