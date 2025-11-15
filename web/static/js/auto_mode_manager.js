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
    }

    closePanel() {
        if (!this.panel) return;
        this.panelVisible = false;
        this.panel.style.display = 'none';
        if (this.errorEl) {
            this.errorEl.textContent = '';
        }
    }

    prefillForm() {
        const betInput = document.getElementById('auto-bet-input');
        const handsInput = document.getElementById('auto-hands-input');
        const radios = document.querySelectorAll('input[name="auto-insurance"]');
        if (!betInput || !handsInput || radios.length === 0) return;
        const defaultBet = this.game.autoSettings?.defaultBet ?? this.game.defaultBetAmount ?? 100;
        betInput.value = defaultBet || 100;
        const hands = this.game.autoSettings?.hands ?? 5;
        handsInput.value = hands;
        const insurancePref = this.game.autoSettings?.insurance ?? 'never';
        radios.forEach((radio) => {
            radio.checked = radio.value === insurancePref;
        });
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
        if (!betInput || !handsInput || radios.length === 0) return;
        const defaultBet = parseInt(betInput.value, 10);
        const hands = parseInt(handsInput.value, 10);
        const insuranceMode = radios[0].value;

        if (!defaultBet || defaultBet <= 0) {
            this.setError('Enter a valid default bet.');
            return;
        }

        if (!hands || hands <= 0) {
            this.setError('Enter how many hands to play.');
            return;
        }

        this.setError('');

        const payload = {
            game_id: game.gameId,
            default_bet: defaultBet,
            hands,
            insurance_mode: insuranceMode
        };

        try {
            if (this.autoStartBtn) this.autoStartBtn.disabled = true;
            game.ui.showLoading();
            const result = await game.apiClient.startAutoMode(payload);
            if (result.success) {
                game.updateGameState(result.game_state);
                game.autoSettings = { defaultBet, hands, insurance: insuranceMode };
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

