/**
 * Main entry point for the Blackjack game application
 * 
 * This module orchestrates the initialization of all game modules and starts the game.
 * It imports the module classes and sets up the BlackjackGame instance.
 */

import { BlackjackGame, rulesPanel } from './blackjack.js';
import { ApiClient } from './api_client.js';
import { GameStateManager } from './game_state.js';
import { UIController } from './ui_controller.js';
import { SettingsManager } from './settings_manager.js';
import { AutoModeManager } from './auto_mode_manager.js';

/**
 * Initialize the game when the DOM is ready
 */
function initializeGame() {
    // Create module instances
    const apiClient = new ApiClient({
        onMessage: (text, type) => {
            // Message handler will be set up once UI is initialized
        }
    });

    const stateManager = new GameStateManager({
        defaultBankrollAmount: 1000,
        defaultDealerHitDelayMs: 1000
    });

    // Create the main game instance with module dependencies
    const game = new BlackjackGame({
        apiClient,
        stateManager
    });

    // Now that the game instance exists, create UI and manager modules with the game reference
    game.ui = new UIController(game);
    game.settingsManager = new SettingsManager(game);
    game.autoManager = new AutoModeManager(game);

    // Setup heckler voices if speech synthesis is available
    if (game.useSpeechSynthesis) {
        game.settingsManager.setupHecklerVoices();
    }

    // Update API client's message handler to use UI
    apiClient.onMessage = (text, type) => game.ui.showMessage(text, type);

    // Make the game instance available globally for onclick handlers in HTML
    // This allows the HTML template to use inline onclick handlers like onclick="dealCards()"
    window.game = game;

    // Expose global functions for inline onclick handlers
    window.selectChip = (value) => {
        if (window.game) {
            window.game.selectChip(value);
            window.game.addToBet(value);
        }
    };
    window.clearBet = () => {
        if (window.game) {
            window.game.clearBet();
        }
    };
    window.dealCards = () => {
        if (window.game) {
            window.game.dealCards();
        }
    };
    window.playerHit = () => {
        if (window.game) {
            window.game.playerHit();
        }
    };
    window.playerStand = () => {
        if (window.game) {
            window.game.playerStand();
        }
    };
    window.playerDoubleDown = () => {
        if (window.game) {
            window.game.playerDoubleDown();
        }
    };
    window.playerSplit = () => {
        if (window.game) {
            window.game.playerSplit();
        }
    };
    window.playerSurrender = () => {
        if (window.game) {
            window.game.playerSurrender();
        }
    };
    window.newGame = () => {
        if (window.game) {
            window.game.newGame();
        }
    };
    window.refreshBankroll = () => {
        if (window.game) {
            window.game.refreshBankroll();
        }
    };

    // Initialize the game
    game.init();

    // Initialize the rules panel UI
    rulesPanel.init();

    // Greet the player (wait for voices to be ready if needed)
    const greetPlayer = () => {
        if (!game.voiceEnabled) {
            return;
        }

        if (game.ui) {
            game.ui.showMessage('Are you feeling lucky today?');
        }

        if (!game.useSpeechSynthesis || typeof window === 'undefined' || !window.speechSynthesis) {
            return;
        }

        const synth = window.speechSynthesis;

        const trySpeakGreeting = () => {
            if (!game.hecklerVoice) {
                return false;
            }
            game.previewHecklerVoice(true);
            return true;
        };

        if (trySpeakGreeting()) {
            return;
        }

        if (typeof synth.addEventListener !== 'function') {
            return;
        }

        const greetWhenVoicesReady = () => {
            if (trySpeakGreeting()) {
                synth.removeEventListener('voiceschanged', greetWhenVoicesReady);
            }
        };

        synth.addEventListener('voiceschanged', greetWhenVoicesReady);
        setTimeout(() => {
            synth.removeEventListener('voiceschanged', greetWhenVoicesReady);
        }, 5000);
    };

    // Give a moment for voices to initialize before greeting
    setTimeout(greetPlayer, 500);
}

/**
 * Wait for DOM to be ready, then initialize
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOM is already ready
    initializeGame();
}

