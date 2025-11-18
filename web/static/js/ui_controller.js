export class UIController {
    constructor(game) {
        this.game = game;
        this.actionStatusTimeout = null;
        this.activePeekTimeout = null;
        this.isDealerPeekAnimating = false;
        this.isTestingPeek = false;
        this.shuffleOverlayEl = document.getElementById('shuffle-overlay');
        this.shuffleStatusEl = document.getElementById('shuffle-status');
        this.lastShuffleEventId = null;
        this.shuffleHideTimeout = null;
        this.autoLogViewerOverlayEl = document.getElementById('auto-log-viewer-overlay');
        this.autoLogViewerCloseBtn = document.getElementById('auto-log-viewer-close-btn');
        this.autoLogViewerContentEl = document.getElementById('auto-log-viewer-content');
        if (this.autoLogViewerCloseBtn) {
            this.autoLogViewerCloseBtn.addEventListener('click', () => this.hideAutoModeLogViewer());
        }
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
        this.game.isProcessing = true;
        this.setButtonsEnabled(false);
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        this.game.isProcessing = false;
        this.updateButtonStates();
    }

    setButtonsEnabled(enabled) {
        const actionButtons = ['hit-btn', 'stand-btn', 'double-btn', 'split-btn', 'surrender-btn', 'deal-btn'];
        actionButtons.forEach((btnId) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !enabled;
            }
        });
    }

    updateButtonStates() {
        const game = this.game;
        const gameState = game.gameState;
        if (!gameState) {
            game.log('Cannot update button states: no gameState', 'warn');
            return;
        }

        const autoActive = !!gameState.auto_mode?.active;

        if (gameState.state === 'game_over') {
            game.log('Game over - disabling action buttons', 'action');
            const hitBtn = document.getElementById('hit-btn');
            const standBtn = document.getElementById('stand-btn');
            const doubleBtn = document.getElementById('double-btn');
            const splitBtn = document.getElementById('split-btn');
            const surrenderBtn = document.getElementById('surrender-btn');

            if (hitBtn) {
                hitBtn.disabled = true;
                hitBtn.removeAttribute('title');
                game.log('Hit button disabled (game over)', 'action');
            } else {
                game.log('ERROR: hit-btn element not found!', 'error');
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
            if (dealBtn) {
                dealBtn.disabled = autoActive || game.isProcessing;
                if (!dealBtn.disabled) {
                    dealBtn.title = 'Deal the next hand';
                } else if (autoActive) {
                    dealBtn.title = 'auto mode running';
                }
            }

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

        const playerHand = gameState.player?.hands?.[gameState.player.current_hand_index];
        const isSplitAces = !!playerHand?.is_from_split_aces;
        const insuranceActive = !!gameState.insurance_offer_active || !!gameState.even_money_offer_active;

        const doubleBtn = document.getElementById('double-btn');
        if (doubleBtn && playerHand) {
            const canDouble = playerHand.can_double_down && gameState.state === 'player_turn' && !isSplitAces && !insuranceActive && !autoActive;
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

        const splitBtn = document.getElementById('split-btn');
        if (splitBtn && playerHand) {
            const canSplit = playerHand.can_split && gameState.state === 'player_turn' && !insuranceActive && !autoActive;
            splitBtn.style.display = canSplit ? 'block' : 'none';
            splitBtn.disabled = !canSplit;
        }

        const surrenderBtn = document.getElementById('surrender-btn');
        if (surrenderBtn && playerHand) {
            const hasTwoCards = playerHand.cards && playerHand.cards.length === 2;
            const canSurrender = hasTwoCards &&
                                 gameState.state === 'player_turn' &&
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

        const hitBtn = document.getElementById('hit-btn');
        const standBtn = document.getElementById('stand-btn');
        const isPlayerTurn = gameState.state === 'player_turn';

        game.log(`Button state update - isPlayerTurn: ${isPlayerTurn}, state: ${gameState.state}, isProcessing: ${game.isProcessing}`, 'action');

        if (hitBtn) {
            const shouldBeDisabled = !isPlayerTurn || game.isProcessing || isSplitAces || insuranceActive || autoActive;
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
            game.log(`Hit button - disabled: ${hitBtn.disabled}, shouldBeDisabled: ${shouldBeDisabled}`, 'action');
        } else {
            game.log('ERROR: hit-btn element not found in DOM!', 'error');
        }

        if (standBtn) {
            const shouldBeDisabled = !isPlayerTurn || game.isProcessing || insuranceActive || autoActive;
            standBtn.disabled = shouldBeDisabled;
            if (autoActive) {
                standBtn.title = 'auto mode running';
            } else if (insuranceActive) {
                standBtn.title = 'insurance decision required';
            } else {
                standBtn.removeAttribute('title');
            }
        } else {
            game.log('ERROR: stand-btn element not found!', 'error');
        }

        const refreshBtn = document.getElementById('refresh-bankroll-btn');
        if (refreshBtn) refreshBtn.disabled = autoActive;
    }

    updateHandValues() {
        const game = this.game;
        const gameState = game.gameState;
        if (!gameState) return;

        const handsArray = gameState.player?.hands || [];
        if (handsArray.length > 0) {
            const requestedIndex = gameState.player?.current_hand_index || 0;
            const safeIndex = (requestedIndex < handsArray.length)
                ? requestedIndex
                : Math.max(0, handsArray.length - 1);
            const playerHand = handsArray[safeIndex];

            const playerValueElement = document.getElementById('player-value');
            if (playerValueElement && playerHand) {
                if (requestedIndex !== safeIndex) {
                    game.log(`Hand value display - requested index ${requestedIndex} out of bounds, using ${safeIndex}`, 'warn');
                }

                const valueText = playerHand.is_bust
                    ? `Value: ${playerHand.value} (BUST!)`
                    : `Value: ${playerHand.value}`;
                playerValueElement.textContent = valueText;

                game.log(`Player hand value displayed: ${playerHand.value}, bust: ${playerHand.is_bust}, cards: ${playerHand.cards?.length || 0}`, 'action');
            } else if (playerValueElement && !playerHand) {
                game.log(`ERROR: No player hand found at index ${safeIndex}`, 'error');
            }
        } else {
            const playerValueElement = document.getElementById('player-value');
            if (playerValueElement) {
                game.log('ERROR: No player hands array found', 'error');
            }
        }

        const dealerValueElement = document.getElementById('dealer-value');
        if (dealerValueElement && gameState.dealer) {
            if (gameState.dealer.hole_card_hidden) {
                const visibleValue = gameState.dealer.visible_value;
                if (visibleValue !== null && visibleValue !== undefined) {
                    dealerValueElement.textContent = `Value: ${visibleValue}`;
                } else {
                    dealerValueElement.textContent = 'Value: ?';
                }
            } else {
                const dealerValue = gameState.dealer.full_value || gameState.dealer.value;
                const dealerBust = gameState.dealer.is_bust;
                const valueText = dealerBust
                    ? `Value: ${dealerValue} (BUST!)`
                    : `Value: ${dealerValue}`;
                dealerValueElement.textContent = valueText;
                game.log(`Dealer hand value displayed: ${dealerValue}, bust: ${dealerBust}`, 'action');
            }
        }
    }

    updateHistoryDisplay() {
        const game = this.game;
        const historyListEl = document.getElementById('history-list');
        if (!historyListEl) return;

        historyListEl.innerHTML = '';

        if (!game.gameHistory.length) {
            historyListEl.innerHTML = '<div class="history-item-empty">No games yet</div>';
            return;
        }

        game.gameHistory.forEach((item) => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${item.result}`;

            let resultEmoji = '';
            if (item.result === 'win' || item.result === 'blackjack' || item.result === 'insurance_win') {
                resultEmoji = '✅';
            } else if (item.result === 'loss' || item.result === 'insurance_loss') {
                resultEmoji = '❌';
            } else if (item.result === 'push') {
                resultEmoji = '🤝';
            }

            const resultText = item.result === 'blackjack' ? 'BLACKJACK' : item.displayResult;

            historyItem.innerHTML = `
                <span class="history-result">${resultEmoji} ${resultText}</span>
                <span class="history-amount">${item.amountDisplay}</span>
            `;

            historyListEl.appendChild(historyItem);
        });
    }

    updateBankrollHelper() {
        const game = this.game;
        if (!game.bankrollHelperElement) {
            return;
        }
        const formatted = game.bankrollAmount.toLocaleString();
        game.bankrollHelperElement.textContent = `Used when refreshing bankroll (max $1,000,000). Current: $${formatted}`;
    }

    updateDealerDelayHelper() {
        const game = this.game;
        if (!game.dealerDelayHelperElement) {
            return;
        }
        const delayDisplay = Number.isFinite(game.dealerHitDelayMs) ? game.dealerHitDelayMs : game.defaultDealerHitDelayMs;
        game.dealerDelayHelperElement.textContent = `Delay between dealer hits (0-5000 ms). Current: ${delayDisplay} ms`;
    }

    updateTableSign() {
        const game = this.game;
        const signContent = document.getElementById('table-sign-content');
        if (!signContent) return;

        const limits = game.gameState?.table_limits || { min_bet: 5, max_bet: 500 };
        const dealerHitsSoft17 = game.gameState?.dealer_hits_soft_17 ?? game.dealerHitsSoft17 ?? false;

        const signTexts = [
            'BLACKJACK PAYS 3:2',
            dealerHitsSoft17 ? 'DEALER HITS SOFT 17' : 'DEALER STANDS ON 17',
            `TABLE LIMITS $${limits.min_bet} - $${limits.max_bet}`
        ];

        signContent.innerHTML = '';

        signTexts.forEach((text, index) => {
            const textSpan = document.createElement('span');
            textSpan.className = 'sign-text';
            textSpan.textContent = text;
            signContent.appendChild(textSpan);

            if (index < signTexts.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'sign-separator';
                separator.textContent = '•';
                signContent.appendChild(separator);
            }
        });

        setTimeout(() => {
            const sign = document.getElementById('table-sign');
            if (sign && signContent) {
                const signWidth = sign.offsetWidth - 40;
                const contentWidth = signContent.scrollWidth;

                if (contentWidth > signWidth) {
                    sign.classList.add('marquee-mode');
                    const fullText = Array.from(signContent.querySelectorAll('.sign-text'))
                        .map(span => span.textContent)
                        .join(' • ');
                    signContent.setAttribute('data-content', fullText);
                } else {
                    sign.classList.remove('marquee-mode');
                    signContent.removeAttribute('data-content');
                }
            }
        }, 100);
    }

    updateAutoStatusUI() {
        const game = this.game;
        const statusEl = document.getElementById('auto-status');
        const statusTextEl = document.getElementById('auto-status-text');
        const downloadBtn = document.getElementById('auto-download-log-btn');
        const viewBtn = document.getElementById('auto-view-log-btn');

        if (!statusEl) return;

        const autoMode = game.gameState?.auto_mode;
        if (autoMode?.status) {
            statusEl.style.display = 'block';
            if (statusTextEl) {
                statusTextEl.textContent = autoMode.status;
            }

            if (downloadBtn && autoMode.log_filename) {
                downloadBtn.style.display = 'inline-block';
                downloadBtn.onclick = () => game.downloadAutoModeLog(autoMode.log_filename);
            } else if (downloadBtn) {
                downloadBtn.style.display = 'none';
            }
            if (viewBtn && autoMode.log_filename) {
                viewBtn.style.display = 'inline-block';
                viewBtn.onclick = () => game.openAutoModeLogViewer(autoMode.log_filename);
            } else if (viewBtn) {
                viewBtn.style.display = 'none';
            }
        } else {
            statusEl.style.display = 'none';
            if (statusTextEl) {
                statusTextEl.textContent = '';
            }
            if (downloadBtn) {
                downloadBtn.style.display = 'none';
            }
            if (viewBtn) {
                viewBtn.style.display = 'none';
            }
        }
    }

    showAutoModeLogViewer(content = '') {
        if (!this.autoLogViewerOverlayEl) return;
        if (this.autoLogViewerContentEl) {
            this.autoLogViewerContentEl.value = content || '';
            // Scroll to top - must happen after display change and DOM update
            this.autoLogViewerOverlayEl.style.display = 'flex';
            setTimeout(() => {
                this.autoLogViewerContentEl.scrollTop = 0;
                this.autoLogViewerContentEl.selectionStart = 0;
                this.autoLogViewerContentEl.selectionEnd = 0;
                this.autoLogViewerContentEl.focus();
            }, 50);
        } else {
            this.autoLogViewerOverlayEl.style.display = 'flex';
        }
    }

    hideAutoModeLogViewer() {
        if (!this.autoLogViewerOverlayEl) return;
        this.autoLogViewerOverlayEl.style.display = 'none';
    }

    /**
     * Trigger the shuffle overlay when the backend reports a new shuffle event.
     * @param {Object|null} shuffleData
     */
    handleShuffleOverlay(shuffleData) {
        if (!this.shuffleOverlayEl || !shuffleData?.id) {
            return;
        }

        if (shuffleData.id === this.lastShuffleEventId) {
            return;
        }

        this.lastShuffleEventId = shuffleData.id;

        if (this.shuffleHideTimeout) {
            clearTimeout(this.shuffleHideTimeout);
        }

        // Restart animation by toggling the playing class
        this.shuffleOverlayEl.classList.add('visible');
        this.shuffleOverlayEl.classList.remove('playing');
        void this.shuffleOverlayEl.offsetWidth; // Force reflow
        this.shuffleOverlayEl.classList.add('playing');

        if (this.shuffleStatusEl) {
            const label = shuffleData.reason === 'auto_threshold'
                ? 'Rebuilding shoe…'
                : 'Shuffling…';
            this.shuffleStatusEl.textContent = label;
        }

        this.shuffleHideTimeout = window.setTimeout(() => {
            if (this.shuffleOverlayEl) {
                this.shuffleOverlayEl.classList.remove('visible');
                this.shuffleOverlayEl.classList.remove('playing');
            }
            this.shuffleHideTimeout = null;
        }, 4000);
    }


    setActionStatus(message, duration = 3000) {
        const element = this.game.actionStatusElement;
        if (!element) return;

        if (this.actionStatusTimeout) {
            clearTimeout(this.actionStatusTimeout);
        }

        element.textContent = message.toLowerCase();
        element.classList.remove('inactive');
        element.classList.add('active');

        this.actionStatusTimeout = setTimeout(() => {
            element.classList.remove('active');
            element.classList.add('inactive');
        }, duration);
    }

    clearActionStatus() {
        const element = this.game.actionStatusElement;
        if (!element) return;

        if (this.actionStatusTimeout) {
            clearTimeout(this.actionStatusTimeout);
            this.actionStatusTimeout = null;
        }

        element.textContent = '';
        element.classList.remove('active');
        element.classList.add('inactive');
    }

    showMessage(text, type = 'info') {
        const messageElement = document.getElementById('game-message');
        if (!messageElement) return;

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

    showMessageWithColors(text1, color1, text2, color2) {
        const messageElement = document.getElementById('game-message');
        if (!messageElement) return;

        messageElement.innerHTML = `<span style="color: ${color1}">${text1}</span><span style="color: ${color2}">${text2}</span>`;
        messageElement.className = 'game-message';
        messageElement.style.color = '';
    }

    showBlackjackCelebration() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('blackjack-celebration');
            if (!overlay) {
                resolve();
                return;
            }

            overlay.style.display = 'flex';

            setTimeout(() => {
                overlay.classList.add('fade-out');

                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('fade-out');
                    resolve();
                }, 300);
            }, 2500);
        });
    }

    showBettingArea() {
        const game = this.game;
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'block';
            bettingArea.classList.remove('action-mode');
            game.log('Betting area shown and enabled', 'action');
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
        document.querySelectorAll('.chip').forEach((chip) => {
            chip.disabled = false;
        });
        const clearBetBtn = document.getElementById('clear-bet-btn');
        if (clearBetBtn) {
            clearBetBtn.disabled = false;
        }
    }

    hideBettingArea() {
        const bettingArea = document.getElementById('betting-area');
        if (bettingArea) {
            bettingArea.style.display = 'block';
            bettingArea.classList.add('action-mode');
            this.game.log('Betting area switched to action mode', 'action');
        }
        document.querySelectorAll('.chip').forEach((chip) => {
            chip.disabled = true;
        });
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
        const clearBetBtn = document.getElementById('clear-bet-btn');
        if (clearBetBtn) {
            clearBetBtn.disabled = true;
        }
    }

    showGameControls() {
        const game = this.game;
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
        document.querySelectorAll('.chip').forEach((chip) => {
            chip.disabled = true;
        });
        if (controlsElement) {
            controlsElement.style.display = 'flex';
            game.log('Game controls shown (Hit, Stand, Double Down)', 'action');
        } else {
            game.log('ERROR: game-controls element not found!', 'error');
        }
    }

    hideGameControls() {
        const game = this.game;
        const controlsElement = document.getElementById('game-controls');
        if (controlsElement) {
            controlsElement.style.display = 'none';
            game.log('Game controls hidden', 'action');
        } else {
            game.log('ERROR: game-controls element not found!', 'error');
        }
    }

    clearDealerPeekAnimation() {
        if (this.activePeekTimeout) {
            clearTimeout(this.activePeekTimeout);
            this.activePeekTimeout = null;
        }
        document.querySelectorAll('#dealer-hand .peeking')
            .forEach((el) => el.classList.remove('peeking'));
        this.isDealerPeekAnimating = false;
    }

    async animateDealerPeek(options = {}) {
        const { allowPlaceholder = false, source = 'live' } = options;
        return new Promise((resolve) => {
            if (this.isDealerPeekAnimating) {
                resolve();
                return;
            }

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

            const duration = this.game.peekAnimationDurationMs || 1350;
            const cssDuration = `${duration}ms`;
            const cardInner = holeCard.querySelector('.card-inner');

            this.clearDealerPeekAnimation();
            holeCard.style.setProperty('--peek-duration', cssDuration);
            if (cardInner) {
                cardInner.style.setProperty('--peek-duration', cssDuration);
            }
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
                this.isDealerPeekAnimating = false;
                this.activePeekTimeout = null;

                if (cleanupPlaceholder) {
                    cleanupPlaceholder();
                }

                resolve();
            }, duration);
        });
    }

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

    async handleTestPeekAnimation() {
        if (this.isTestingPeek) {
            this.game.log('Peek animation test already running', 'warn');
            return;
        }

        if (this.isDealerPeekAnimating) {
            this.game.log('Dealer peek animation already running', 'warn');
            return;
        }

        this.isTestingPeek = true;
        const button = this.game.testPeekButton || null;
        const originalLabel = button ? button.textContent : '';

        if (button) {
            button.disabled = true;
            button.textContent = 'Testing...';
        }

        this.setActionStatus('testing dealer peek animation', this.game.peekAnimationDurationMs + 600);
        this.game.log('Manual dealer peek animation test triggered', 'action');

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
}

