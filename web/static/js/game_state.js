const hasLocalStorage = () => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export class GameStateManager {
    constructor({ defaultBankrollAmount = 1000, defaultDealerHitDelayMs = 1000 } = {}) {
        this.defaultBankrollAmount = defaultBankrollAmount;
        this.defaultDealerHitDelayMs = defaultDealerHitDelayMs;
        this.bankrollConfigKey = 'blackjack_bankroll_config';
        this.dealerHitDelayKey = 'blackjack_dealer_delay_ms';
        this.dealerHitsSoft17Key = 'blackjack_dealer_hits_soft17';
        this.defaultBetKey = 'blackjack_default_bet';
        this.autoSettingsKey = 'blackjack_auto_settings';
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
        if (!hasLocalStorage()) {
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
        if (!hasLocalStorage()) {
            return;
        }
        try {
            window.localStorage.setItem(this.bankrollConfigKey, JSON.stringify({ amount }));
        } catch (error) {
            console.warn('Failed to save bankroll config:', error);
        }
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

    loadDealerHitDelay() {
        if (!hasLocalStorage()) {
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
        if (!hasLocalStorage()) {
            return;
        }
        try {
            window.localStorage.setItem(this.dealerHitDelayKey, String(delay));
        } catch (error) {
            console.warn('Failed to save dealer delay config:', error);
        }
    }

    loadDealerHitsSoft17() {
        if (!hasLocalStorage()) {
            return false;
        }
        try {
            const stored = window.localStorage.getItem(this.dealerHitsSoft17Key);
            if (stored === null || stored === undefined) {
                return false;
            }
            return stored === 'true';
        } catch (error) {
            console.warn('Failed to load dealer hits soft 17 config:', error);
            return false;
        }
    }

    saveDealerHitsSoft17(value) {
        if (!hasLocalStorage()) {
            return;
        }
        try {
            window.localStorage.setItem(this.dealerHitsSoft17Key, String(value));
        } catch (error) {
            console.warn('Failed to save dealer hits soft 17 config:', error);
        }
    }

    loadDefaultBet() {
        if (!hasLocalStorage()) {
            return null;
        }
        try {
            const stored = window.localStorage.getItem(this.defaultBetKey);
            if (!stored) {
                return null;
            }
            const parsed = Number.parseInt(stored, 10);
            return Number.isNaN(parsed) ? null : parsed;
        } catch (error) {
            console.warn('Failed to load default bet:', error);
            return null;
        }
    }

    saveDefaultBet(value) {
        if (!hasLocalStorage()) {
            return;
        }
        try {
            if (value === null || value === undefined || value === '') {
                window.localStorage.removeItem(this.defaultBetKey);
                return;
            }
            window.localStorage.setItem(this.defaultBetKey, String(value));
        } catch (error) {
            console.warn('Failed to save default bet:', error);
        }
    }

    loadAutoSettings() {
        if (!hasLocalStorage()) {
            return {
                defaultBet: null,
                hands: 5,
                insurance: 'never',
                strategy: 'basic',
                bettingStrategy: 'fixed',
                betPercentage: 5,
                doubleDownPref: 'recommended',
                splitPref: 'recommended',
                surrenderPref: 'recommended'
            };
        }
        try {
            const stored = window.localStorage.getItem(this.autoSettingsKey);
            if (!stored) {
                return {
                    defaultBet: null,
                    hands: 5,
                    insurance: 'never',
                    strategy: 'basic',
                    bettingStrategy: 'fixed',
                    betPercentage: 5,
                    doubleDownPref: 'recommended',
                    splitPref: 'recommended',
                    surrenderPref: 'recommended'
                };
            }
            const parsed = JSON.parse(stored);
            return {
                defaultBet: parsed?.defaultBet ?? null,
                hands: parsed?.hands ?? 5,
                insurance: parsed?.insurance ?? 'never',
                strategy: parsed?.strategy ?? 'basic',
                bettingStrategy: parsed?.bettingStrategy ?? 'fixed',
                betPercentage: parsed?.betPercentage ?? 5,
                doubleDownPref: parsed?.doubleDownPref ?? 'recommended',
                splitPref: parsed?.splitPref ?? 'recommended',
                surrenderPref: parsed?.surrenderPref ?? 'recommended'
            };
        } catch (error) {
            console.warn('Failed to load auto settings:', error);
            return {
                defaultBet: null,
                hands: 5,
                insurance: 'never',
                strategy: 'basic',
                bettingStrategy: 'fixed',
                betPercentage: 5,
                doubleDownPref: 'recommended',
                splitPref: 'recommended',
                surrenderPref: 'recommended'
            };
        }
    }

    saveAutoSettings(settings) {
        if (!hasLocalStorage()) {
            return;
        }
        try {
            window.localStorage.setItem(this.autoSettingsKey, JSON.stringify({
                defaultBet: settings?.defaultBet ?? null,
                hands: settings?.hands ?? 5,
                insurance: settings?.insurance ?? 'never',
                strategy: settings?.strategy ?? 'basic',
                bettingStrategy: settings?.bettingStrategy ?? 'fixed',
                betPercentage: settings?.betPercentage ?? 5,
                doubleDownPref: settings?.doubleDownPref ?? 'recommended',
                splitPref: settings?.splitPref ?? 'recommended',
                surrenderPref: settings?.surrenderPref ?? 'recommended'
            }));
        } catch (error) {
            console.warn('Failed to save auto settings:', error);
        }
    }
}

