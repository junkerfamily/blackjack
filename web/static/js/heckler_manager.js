
/**
 * Heckler Manager
 * Handles voice commentary, speech synthesis, and heckler preferences.
 */
export class HecklerManager {
    constructor(game) {
        this.game = game;
        this.voiceEnabled = true; // Default, will be overwritten by prefs
        this.hecklerSpeechRate = 1.05;
        this.hecklerVoice = null;
        this.pendingPreferredVoiceId = null;
        this.currentHecklerUtterance = null;
        this.hecklerSettingsKey = 'blackjack_heckler_settings';
        this.useSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
        
        // Heckler phrases
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

        // Load preferences immediately
        this.loadPreferences();
    }

    /**
     * Load speech preferences from localStorage
     */
    loadPreferences() {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const stored = window.localStorage.getItem(this.hecklerSettingsKey);
            if (!stored) return;
            
            const parsed = JSON.parse(stored);
            const prefs = {
                voiceId: parsed?.voiceId || null,
                rate: parsed?.rate || null,
                enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : undefined
            };

            this.pendingPreferredVoiceId = prefs.voiceId || null;
            
            if (prefs.enabled !== undefined) {
                this.voiceEnabled = prefs.enabled === true;
            }
            
            if (prefs.rate && !Number.isNaN(parseFloat(prefs.rate))) {
                this.hecklerSpeechRate = parseFloat(prefs.rate);
            }
        } catch (error) {
            console.warn('Failed to load heckler preferences:', error);
        }
    }

    /**
     * Persist speech preferences
     */
    savePreferences() {
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
     * Speech Synthesis Methods
     */

    getVoiceIdentifier(voice) {
        if (!voice) return null;
        return voice.voiceURI || `${voice.name}|${voice.lang}`;
    }

    populateVoiceOptions(voices) {
        const hecklerVoiceSelect = this.game.hecklerVoiceSelect;
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
        hecklerVoiceSelect.appendChild(optionsFragment);
        hecklerVoiceSelect.disabled = false;

        const selectedOption = hecklerVoiceSelect.options[hecklerVoiceSelect.selectedIndex];
        if (selectedOption) {
            hecklerVoiceSelect.value = selectedOption.value;
        }
    }

    assignPreferredVoice(voices) {
        if (!Array.isArray(voices) || !voices.length) return;
        
        const preferredId = this.pendingPreferredVoiceId;
        if (preferredId) {
            const preferredVoice = voices.find((voice) => this.getVoiceIdentifier(voice) === preferredId);
            if (preferredVoice) {
                this.hecklerVoice = preferredVoice;
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
                this.hecklerVoice = defaultVoice;
                this.pendingPreferredVoiceId = this.getVoiceIdentifier(defaultVoice);
            } else {
                this.hecklerVoice = filteredVoices[0];
                this.pendingPreferredVoiceId = this.getVoiceIdentifier(filteredVoices[0]);
            }
        }
    }

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

    setupHecklerVoices() {
        if (!this.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
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
        // Some browsers load voices asynchronously
        if (synth.onvoiceschanged !== undefined) {
             synth.onvoiceschanged = loadVoices;
        }
    }

    previewVoice(force = false) {
        if ((!force && !this.voiceEnabled) || !this.useSpeechSynthesis || !this.hecklerVoice) return;
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance('Are you feeling lucky today?');
        utterance.voice = this.hecklerVoice;
        utterance.rate = this.hecklerSpeechRate;
        
        try {
             synth.cancel();
        } catch (e) {
            // ignore
        }
        synth.speak(utterance);
    }

    playVoiceTest() {
        if (!this.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            this.game.log('Voice test requested but speech synthesis is unavailable', 'warn');
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
                this.savePreferences();
            }
        }
        utterance.rate = this.hecklerSpeechRate;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        synth.speak(utterance);
    }

    speak(message, token) {
        if (!this.voiceEnabled || !this.useSpeechSynthesis || !message || typeof window === 'undefined') return false;
        const synth = window.speechSynthesis;
        if (!synth) return false;

        try {
            this.stop();
            const utterance = new SpeechSynthesisUtterance(message);
            if (this.hecklerVoice) {
                utterance.voice = this.hecklerVoice;
            } else {
                // Fallback if no voice selected yet
                const voices = synth.getVoices();
                const usVoice = voices.find((voice) => {
                    const lang = voice.lang || '';
                    return typeof lang === 'string' && lang.toLowerCase().startsWith('en-us');
                });
                if (usVoice) {
                    utterance.voice = usVoice;
                    this.hecklerVoice = usVoice;
                    this.pendingPreferredVoiceId = this.getVoiceIdentifier(usVoice);
                    this.savePreferences();
                    this.refreshVoiceOptions();
                }
            }
            utterance.rate = this.hecklerSpeechRate;
            utterance.pitch = 1;
            utterance.volume = 0.9;
            utterance.onend = () => {
                this.currentHecklerUtterance = null;
                if (token && token === this.game.activeHecklerToken) {
                    this.game.hideHecklerMessage(token);
                }
            };
            utterance.onerror = () => {
                this.currentHecklerUtterance = null;
                if (token && token === this.game.activeHecklerToken) {
                    this.game.hideHecklerMessage(token);
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
    }

    stop() {
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
}
