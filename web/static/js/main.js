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

    // Now that the game instance exists, create UI and settings managers with the game reference
    game.ui = new UIController(game);
    game.settingsManager = new SettingsManager(game);

    // Update API client's message handler to use UI
    apiClient.onMessage = (text, type) => game.ui.showMessage(text, type);

    // Initialize the game
    game.init();

    // Initialize the rules panel UI
    rulesPanel.init();
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

