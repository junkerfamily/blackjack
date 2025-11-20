/**
 * Card and CardManager classes for Blackjack game
 * Handles card rendering, animations, and hand management
 */

export class Card {
    /**
     * Create a card instance
     * @param {Object} cardData - Card data {suit, rank, value}
     * @param {boolean} isHidden - Whether card is hidden (shows back)
     */
    constructor(cardData, isHidden = false) {
        this.suit = cardData.suit;
        this.rank = cardData.rank;
        this.value = cardData.value;
        this.isHidden = isHidden;
        this.element = null;
        this.position = { x: 0, y: 0 };
        this.isRevealed = !isHidden;
        this.isAnimating = false;
    }

    /**
     * Get suit symbol
     * @returns {string} Unicode suit symbol
     */
    getSuitSymbol() {
        const symbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        return symbols[this.suit] || '?';
    }

    /**
     * Get suit color class
     * @returns {string} CSS class name
     */
    getSuitClass() {
        return `suit-${this.suit}`;
    }

    /**
     * Create DOM element for this card
     * @returns {HTMLElement} Card element
     */
    render() {
        if (this.element) {
            return this.element;
        }

        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${this.getSuitClass()}`;
        if (this.isHidden) {
            cardDiv.classList.add('flipped');
        }

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        // Card front
        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';
        
        const rankTop = document.createElement('div');
        rankTop.className = 'card-rank-top';
        rankTop.textContent = this.rank;
        
        const suitDiv = document.createElement('div');
        suitDiv.className = 'card-suit';
        suitDiv.textContent = this.getSuitSymbol();
        
        const rankBottom = document.createElement('div');
        rankBottom.className = 'card-rank-bottom';
        rankBottom.textContent = this.rank;
        
        cardFront.appendChild(rankTop);
        cardFront.appendChild(suitDiv);
        cardFront.appendChild(rankBottom);

        // Card back
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        const backPattern = document.createElement('div');
        backPattern.className = 'card-back-pattern';
        cardBack.appendChild(backPattern);

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        cardDiv.appendChild(cardInner);

        this.element = cardDiv;
        return cardDiv;
    }

    /**
     * Reveal the card (flip to show face)
     * @param {number} delay - Animation delay in milliseconds
     * @returns {Promise} Resolves when animation completes
     */
    reveal(delay = 0) {
        if (this.isRevealed || !this.element) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                this.isHidden = false;
                this.isRevealed = true;
                this.isAnimating = true;
                
                this.element.classList.remove('flipped');
                this.element.classList.add('flipping');
                
                setTimeout(() => {
                    this.element.classList.remove('flipping');
                    this.isAnimating = false;
                    resolve();
                }, 500);
            }, delay);
        });
    }

    /**
     * Hide the card (flip to show back)
     */
    hide() {
        if (!this.isRevealed || !this.element) {
            return;
        }

        this.isHidden = true;
        this.isRevealed = false;
        this.element.classList.add('flipped');
    }

    /**
     * Animate card to a position
     * @param {number} x - Target X position
     * @param {number} y - Target Y position
     * @param {number} duration - Animation duration in milliseconds
     * @returns {Promise} Resolves when animation completes
     */
    animateTo(x, y, duration = 500) {
        if (!this.element) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.isAnimating = true;
            this.element.style.transition = `transform ${duration}ms ease-out`;
            this.element.style.transform = `translate(${x}px, ${y}px)`;
            
            setTimeout(() => {
                this.position = { x, y };
                this.isAnimating = false;
                this.element.style.transition = '';
                resolve();
            }, duration);
        });
    }

    /**
     * Add deal animation
     * @param {number} delay - Animation delay in milliseconds
     * @returns {Promise} Resolves when animation completes
     */
    animateDeal(delay = 0) {
        if (!this.element) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                this.isAnimating = true;
                this.element.classList.add('dealing');
                
                setTimeout(() => {
                    this.element.classList.remove('dealing');
                    this.isAnimating = false;
                    resolve();
                }, 500);
            }, delay);
        });
    }

    /**
     * Add hit animation
     * @returns {Promise} Resolves when animation completes
     */
    animateHit() {
        if (!this.element) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.isAnimating = true;
            this.element.classList.add('hitting');
            
            setTimeout(() => {
                this.element.classList.remove('hitting');
                this.isAnimating = false;
                resolve();
            }, 600);
        });
    }

    /**
     * Remove card from DOM
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    /**
     * Convert card to dictionary format
     * @returns {Object} Card data
     */
    toDict() {
        return {
            suit: this.suit,
            rank: this.rank,
            value: this.value,
            isHidden: this.isHidden
        };
    }
}

export class CardManager {
    /**
     * Create a card manager for a hand
     * @param {HTMLElement|string} container - Container element or selector
     */
    constructor(container) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!this.container) {
            throw new Error('Container element not found');
        }

        // Ensure container has card-hand class
        this.container.classList.add('card-hand');
        
        this.cards = [];
        this.cardOverlap = 15; // Pixels to overlap cards
    }

    /**
     * Add a card to the hand
     * @param {Object} cardData - Card data {suit, rank, value}
     * @param {boolean} isHidden - Whether card is hidden
     * @param {number} delay - Animation delay in milliseconds
     * @returns {Card} The created card instance
     */
    addCard(cardData, isHidden = false, delay = 0) {
        const card = new Card(cardData, isHidden);
        this.cards.push(card);
        
        const cardElement = card.render();
        // Start visible, don't fade in from 0
        cardElement.style.opacity = '1';
        this.container.appendChild(cardElement);
        
        // Trigger deal animation after card is in DOM
        setTimeout(() => {
            card.animateDeal(0);  // No delay since we're already delaying above
        }, delay);
        
        return card;
    }

    /**
     * Deal a card with animation
     * @param {Object} cardData - Card data
     * @param {boolean} isHidden - Whether card is hidden
     * @param {number} delay - Animation delay in milliseconds
     * @returns {Promise} Resolves when card is dealt
     */
    dealCard(cardData, isHidden = false, delay = 0) {
        return new Promise((resolve) => {
            const card = this.addCard(cardData, isHidden, delay);
            
            // Wait for animation to complete
            setTimeout(() => {
                card.animateDeal(delay).then(() => {
                    resolve(card);
                });
            }, delay);
        });
    }

    /**
     * Reveal a specific card
     * @param {number} index - Card index
     * @returns {Promise} Resolves when card is revealed
     */
    revealCard(index) {
        if (index < 0 || index >= this.cards.length) {
            return Promise.resolve();
        }

        return this.cards[index].reveal();
    }

    /**
     * Reveal all cards
     * @param {number} staggerDelay - Delay between each card reveal
     * @returns {Promise} Resolves when all cards are revealed
     */
    revealAll(staggerDelay = 100) {
        const promises = this.cards.map((card, index) => {
            return card.reveal(index * staggerDelay);
        });

        return Promise.all(promises);
    }

    /**
     * Clear all cards
     */
    clear() {
        this.cards.forEach(card => card.destroy());
        this.cards = [];
    }

    /**
     * Get hand element
     * @returns {HTMLElement} Container element
     */
    getHandElement() {
        return this.container;
    }

    /**
     * Add win animation to hand
     */
    animateWin() {
        this.container.classList.add('winning');
        setTimeout(() => {
            this.container.classList.remove('winning');
        }, 2000);
    }

    /**
     * Add loss animation to hand
     */
    animateLoss() {
        this.container.classList.add('losing');
    }

    /**
     * Reset hand animations
     */
    resetAnimations() {
        this.container.classList.remove('winning', 'losing');
    }

    /**
     * Get number of cards
     * @returns {number} Card count
     */
    getCount() {
        return this.cards.length;
    }

    /**
     * Get all cards as array
     * @returns {Array<Card>} Array of card instances
     */
    getCards() {
        return this.cards.slice();
    }
}

