export class AutoModeManager {
    constructor(game) {
        this.game = game;
        this.panel = null;
        this.errorEl = null;
        this.autoStartBtn = null;
        this.autoCancelBtn = null;
        this.autoToggleBtn = null;
        this.panelVisible = false;
    }

    init() {
        this.panel = document.getElementById('auto-mode-panel');
        this.errorEl = document.getElementById('auto-error');
        this.autoToggleBtn = document.getElementById('auto-mode-btn');
        this.autoStartBtn = document.getElementById('auto-start-btn');
        this.autoCancelBtn = document.getElementById('auto-cancel-btn');

        if (this.autoToggleBtn) {
            this.autoToggleBtn.addEventListener('click', () => this.togglePanel());
        }

        if (this.autoCancelBtn) {
            this.autoCancelBtn.addEventListener('click', () => this.closePanel());
        }

        if (this.autoStartBtn) {
            this.autoStartBtn.addEventListener('click', () => this.handleStart());
        }

        // Show/hide percentage input based on betting strategy
        const bettingStrategySelect = document.getElementById('auto-betting-strategy-select');
        const percentageContainer = document.getElementById('auto-percentage-container');
        if (bettingStrategySelect && percentageContainer) {
            bettingStrategySelect.addEventListener('change', () => {
                percentageContainer.style.display = bettingStrategySelect.value === 'percentage' ? 'block' : 'none';
            });
        }

        this.prefillForm();
    }

    togglePanel() {
        if (this.panelVisible) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    openPanel() {
        if (!this.panel) return;
        this.panelVisible = true;
        this.panel.style.display = 'block';
        this.prefillForm();
        
        // Add class to primary-column to hide dealer/player areas and position panel overlay
        const primaryColumn = document.querySelector('.primary-column');
        if (primaryColumn) {
            primaryColumn.classList.add('auto-mode-panel-open');
        }
    }

    closePanel() {
        if (!this.panel) return;
        this.panelVisible = false;
        this.panel.style.display = 'none';
        if (this.errorEl) {
            this.errorEl.textContent = '';
        }
        
        // Remove class from primary-column to restore dealer/player areas
        const primaryColumn = document.querySelector('.primary-column');
        if (primaryColumn) {
            primaryColumn.classList.remove('auto-mode-panel-open');
        }
    }

    prefillForm() {
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
        
        const settings = this.game.autoSettings || {};
        const defaultBet = settings.defaultBet ?? this.game.defaultBetAmount ?? 100;
        betInput.value = defaultBet || 100;
        
        const hands = settings.hands ?? 5;
        handsInput.value = hands;
        
        const insurancePref = settings.insurance ?? 'never';
        radios.forEach((radio) => {
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
        
        if (this.errorEl) {
            this.errorEl.textContent = '';
        }
    }

    async handleStart() {
        const game = this.game;
        if (!game.gameId) {
            await game.newGame();
            if (!game.gameId) return;
        }

        const betInput = document.getElementById('auto-bet-input');
        const handsInput = document.getElementById('auto-hands-input');
        const radios = document.querySelectorAll('input[name="auto-insurance"]:checked');
        const strategySelect = document.getElementById('auto-strategy-select');
        const bettingStrategySelect = document.getElementById('auto-betting-strategy-select');
        const percentageInput = document.getElementById('auto-percentage-input');
        const doubleDownSelect = document.getElementById('auto-double-down-select');
        const splitSelect = document.getElementById('auto-split-select');
        const surrenderSelect = document.getElementById('auto-surrender-select');
        
        if (!betInput || !handsInput || radios.length === 0) return;
        
        const defaultBet = parseInt(betInput.value, 10);
        const hands = parseInt(handsInput.value, 10);
        const insuranceMode = radios[0].value;
        const strategy = strategySelect?.value || 'basic';
        const bettingStrategy = bettingStrategySelect?.value || 'fixed';
        const betPercentage = bettingStrategy === 'percentage' ? parseInt(percentageInput?.value || 5, 10) : null;
        const doubleDownPref = doubleDownSelect?.value || 'recommended';
        const splitPref = splitSelect?.value || 'recommended';
        const surrenderPref = surrenderSelect?.value || 'recommended';

        if (!defaultBet || defaultBet <= 0) {
            this.setError('Enter a valid default bet.');
            return;
        }

        if (!hands || hands <= 0) {
            this.setError('Enter how many hands to play.');
            return;
        }

        if (bettingStrategy === 'percentage') {
            if (!betPercentage || betPercentage <= 0 || betPercentage > 100) {
                this.setError('Enter a valid bet percentage (1-100).');
                return;
            }
        } else {
            // Ensure percentage value is cleared if not applicable
            betPercentage = null;
        }

        this.setError('');

        const payload = {
            game_id: game.gameId,
            default_bet: defaultBet,
            hands,
            insurance_mode: insuranceMode,
            strategy: strategy,
            betting_strategy: bettingStrategy,
            bet_percentage: betPercentage,
            double_down_pref: doubleDownPref,
            split_pref: splitPref,
            surrender_pref: surrenderPref
        };

        try {
            if (this.autoStartBtn) this.autoStartBtn.disabled = true;
            game.ui.showLoading();
            const result = await game.apiClient.startAutoMode(payload);
            if (result.success) {
                game.updateGameState(result.game_state);
                game.autoSettings = {
                    defaultBet,
                    hands,
                    insurance: insuranceMode,
                    strategy,
                    bettingStrategy,
                    betPercentage,
                    doubleDownPref,
                    splitPref,
                    surrenderPref
                };
                game.stateManager.saveAutoSettings(game.autoSettings);
                const autoStatus = result.game_state?.auto_mode?.status;
                game.ui.showMessage(autoStatus || result.message || 'Auto mode complete', 'info');
                this.closePanel();
            } else {
                const errorMsg = result.error || result.message || 'Auto mode failed';
                game.ui.showMessage(errorMsg, 'error');
                this.setError(errorMsg);
            }
        } catch (error) {
            this.setError(error.message || 'Auto mode failed');
        } finally {
            game.ui.hideLoading();
            if (this.autoStartBtn) this.autoStartBtn.disabled = false;
            game.ui.updateButtonStates();
            game.ui.updateAutoStatusUI();
        }
    }

    setError(message) {
        if (!this.errorEl) return;
        this.errorEl.textContent = message;
    }
}

