/**
 * Dealer Peek Animation Demo Controller
 * Provides a lightweight playground to showcase the peek animation
 * without needing to run a full blackjack round.
 */

(function () {
    const PEEK_DURATION_MS = 1400;
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const tenValueRanks = ['10', 'J', 'Q', 'K'];

    let dealerManager = null;
    let holeCardInstance = null;
    let peekTimeout = null;
    let isAnimating = false;

    const statusTextEl = document.getElementById('status-text');
    const statusIndicatorEl = document.getElementById('status-indicator');

    const buttons = {
        peek: document.getElementById('btn-peek'),
        ten: document.getElementById('btn-upcard-ten'),
        ace: document.getElementById('btn-upcard-ace'),
        blackjack: document.getElementById('btn-force-blackjack'),
        reveal: document.getElementById('btn-reveal'),
        reset: document.getElementById('btn-reset')
    };

    function getCardValue(rank) {
        if (rank === 'A') return 11;
        if (['J', 'Q', 'K', '10'].includes(rank)) return 10;
        return parseInt(rank, 10);
    }

    function createCardData(rank, suit) {
        return { rank, suit, value: getCardValue(rank) };
    }

    function randomSuit() {
        return suits[Math.floor(Math.random() * suits.length)];
    }

    function randomRank(list = ranks) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function ensureDealerManager() {
        if (!dealerManager) {
            dealerManager = new CardManager('#demo-dealer-hand');
        }
    }

    function clearExistingPeekClasses() {
        const activeElements = document.querySelectorAll('#demo-dealer-hand .peeking');
        activeElements.forEach((el) => el.classList.remove('peeking'));
    }

    function buildHand({ upcardRank, forceBlackjack = false }) {
        ensureDealerManager();

        if (peekTimeout) {
            clearTimeout(peekTimeout);
            peekTimeout = null;
        }

        isAnimating = false;
        clearExistingPeekClasses();
        dealerManager.clear();

        let holeRank = randomRank(ranks);
        let holeSuit = randomSuit();
        let upRank = upcardRank || randomRank(tenValueRanks);
        let upSuit = randomSuit();

        if (forceBlackjack) {
            holeRank = 'A';
            holeSuit = 'spades';
            upRank = randomRank(tenValueRanks);
            upSuit = 'hearts';
        }

        const holeCardData = createCardData(holeRank, holeSuit);
        const upcardData = createCardData(upRank, upSuit);

        holeCardInstance = dealerManager.addCard(holeCardData, true, 0);
        dealerManager.dealCard(upcardData, false, 220);

        setStatus(`Hand ready. Dealer shows ${upRank} of ${upSuit}.`, 'ready');
        updateButtonStates({ handReady: true, holeRevealed: false });
    }

    function animatePeek() {
        if (!holeCardInstance || !holeCardInstance.element) {
            setStatus('Deal a peekable hand first.', 'warn');
            return;
        }

        if (isAnimating) {
            return;
        }

        const holeCardElement = holeCardInstance.element;
        const cardInner = holeCardElement.querySelector('.card-inner');

        if (!cardInner) {
            setStatus('Unable to find hole card inner face.', 'error');
            return;
        }

        clearExistingPeekClasses();
        // Force reflow so animation restarts
        void holeCardElement.offsetWidth;
        holeCardElement.classList.add('peeking');
        cardInner.classList.add('peeking');

        isAnimating = true;
        setStatus('Dealer lifts the hole card for a peek…', 'active');
        updateButtonStates({ handReady: true, holeRevealed: false, animating: true });

        peekTimeout = setTimeout(() => {
            holeCardElement.classList.remove('peeking');
            cardInner.classList.remove('peeking');
            isAnimating = false;
            setStatus('Peek animation complete. Run it again or reveal the card.', 'ready');
            updateButtonStates({ handReady: true, holeRevealed: false });
        }, PEEK_DURATION_MS);
    }

    function revealHoleCard() {
        if (!holeCardInstance) {
            setStatus('No hole card to reveal.', 'warn');
            return;
        }

        holeCardInstance.reveal();
        setStatus('Hole card revealed. Reset to re-run the peek.', 'info');
        updateButtonStates({ handReady: true, holeRevealed: true });
    }

    function resetDemo() {
        if (peekTimeout) {
            clearTimeout(peekTimeout);
            peekTimeout = null;
        }
        clearExistingPeekClasses();
        isAnimating = false;

        if (dealerManager) {
            dealerManager.clear();
        }
        holeCardInstance = null;
        setStatus('Demo reset. Deal a new hand to continue.', 'info');
        updateButtonStates({ handReady: false, holeRevealed: false });
    }

    function setStatus(message, tone = 'info') {
        if (statusTextEl) {
            statusTextEl.textContent = message;
        }

        if (statusIndicatorEl) {
            const toneColors = {
                info: '#72f5ff',
                ready: '#38ef7d',
                warn: '#ffce52',
                error: '#ff6b6b',
                active: '#ffd369'
            };
            const color = toneColors[tone] || toneColors.info;
            statusIndicatorEl.style.background = color;
            statusIndicatorEl.style.boxShadow = `0 0 10px ${color}`;
        }
    }

    function updateButtonStates({ handReady, holeRevealed, animating } = {}) {
        const ready = handReady === true;
        const revealed = holeRevealed === true;
        const running = animating === true || isAnimating;

        buttons.peek.disabled = !ready || running || revealed;
        buttons.reveal.disabled = !ready || revealed || running;
        buttons.reset.disabled = !ready && !revealed;
    }

    function bindEvents() {
        buttons.ten?.addEventListener('click', () => buildHand({ upcardRank: randomRank(tenValueRanks) }));
        buttons.ace?.addEventListener('click', () => buildHand({ upcardRank: 'A' }));
        buttons.blackjack?.addEventListener('click', () => buildHand({ forceBlackjack: true, upcardRank: randomRank(tenValueRanks) }));
        buttons.peek?.addEventListener('click', animatePeek);
        buttons.reveal?.addEventListener('click', revealHoleCard);
        buttons.reset?.addEventListener('click', resetDemo);
    }

    function init() {
        if (!statusTextEl) {
            console.warn('Peek demo status element missing.');
        }
        bindEvents();
        buildHand({ upcardRank: 'A' });
    }

    document.addEventListener('DOMContentLoaded', init);
})();

