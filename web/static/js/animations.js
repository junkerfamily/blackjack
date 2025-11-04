/**
 * Animation utilities for Blackjack game
 * Provides helper functions for coordinated animations
 */

/**
 * Shuffle animation for deck
 * @param {HTMLElement} deckElement - Deck element to animate
 * @returns {Promise} Resolves when animation completes
 */
function animateShuffle(deckElement) {
    return new Promise((resolve) => {
        if (!deckElement) {
            resolve();
            return;
        }

        deckElement.classList.add('shuffling');
        
        setTimeout(() => {
            deckElement.classList.remove('shuffling');
            resolve();
        }, 300);
    });
}

/**
 * Stagger deal cards with delay
 * @param {Array} cards - Array of card elements
 * @param {number} delayBetween - Delay between each card in milliseconds
 * @returns {Promise} Resolves when all animations complete
 */
function staggerDeal(cards, delayBetween = 150) {
    const promises = cards.map((card, index) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (card.animateDeal) {
                    card.animateDeal().then(resolve);
                } else {
                    resolve();
                }
            }, index * delayBetween);
        });
    });

    return Promise.all(promises);
}

/**
 * Wait for all animations to complete
 * @param {Array} elements - Array of elements with animations
 * @param {number} maxWait - Maximum wait time in milliseconds
 * @returns {Promise} Resolves when animations complete
 */
function waitForAnimations(elements, maxWait = 2000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkComplete = () => {
            const allComplete = elements.every(el => {
                if (el.isAnimating !== undefined) {
                    return !el.isAnimating;
                }
                return true;
            });

            if (allComplete || (Date.now() - startTime) > maxWait) {
                resolve();
            } else {
                requestAnimationFrame(checkComplete);
            }
        };

        checkComplete();
    });
}

/**
 * Create a smooth transition between states
 * @param {Function} callback - Function to execute
 * @param {number} duration - Transition duration
 * @returns {Promise} Resolves when transition completes
 */
function transition(callback, duration = 300) {
    return new Promise((resolve) => {
        callback();
        setTimeout(resolve, duration);
    });
}

