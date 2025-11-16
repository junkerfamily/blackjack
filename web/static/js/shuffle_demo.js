const overlay = document.getElementById('shuffle-overlay');
const scaleSlider = document.getElementById('scale-slider');
const scaleValue = document.getElementById('scale-value');
const playButton = document.getElementById('play-button');
const resetButton = document.getElementById('reset-button');
const statusText = document.getElementById('shuffle-status');

/**
 * Update the CSS variable that drives the overall shuffle scale.
 */
function updateScale(value) {
    const numericValue = Number.parseFloat(value) || 1;
    document.documentElement.style.setProperty('--shuffle-scale', numericValue);
    if (scaleValue) {
        scaleValue.textContent = `${numericValue.toFixed(2)}×`;
    }
}

/**
 * Trigger the shuffle animation by toggling the playing class.
 */
function playShuffle() {
    if (!overlay) return;

    overlay.classList.remove('playing');
    // Force reflow so the animation can restart every time.
    void overlay.offsetWidth;
    overlay.classList.add('playing');

    if (statusText) {
        statusText.textContent = 'Shuffling…';
    }

    window.setTimeout(() => {
        if (statusText) {
            statusText.textContent = 'Shuffle complete';
        }
    }, 1100);
}

/**
 * Reset slider + overlay to defaults.
 */
function resetDemo() {
    if (scaleSlider) {
        scaleSlider.value = '1';
    }
    updateScale(1);
    if (overlay) {
        overlay.classList.remove('playing');
    }
    if (statusText) {
        statusText.textContent = 'Tap play to shuffle';
    }
}

if (scaleSlider) {
    updateScale(scaleSlider.value);
    scaleSlider.addEventListener('input', (event) => {
        updateScale(event.target.value);
    });
}

if (playButton) {
    playButton.addEventListener('click', () => {
        playShuffle();
    });
}

if (resetButton) {
    resetButton.addEventListener('click', () => {
        resetDemo();
    });
}

// Kick off an initial shuffle to show motion when the demo opens.
window.addEventListener('load', () => {
    playShuffle();
});

