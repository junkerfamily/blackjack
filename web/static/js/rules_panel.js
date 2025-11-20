
/**
 * Rules Panel Management
 * Handles navigation and display of the game rules.
 */
export const rulesPanel = {
    isOpen: false,
    currentPage: 'basic',
    
    init() {
        const infoToggle = document.getElementById('info-toggle');
        const rulesCloseBtn = document.getElementById('rules-close');
        const rulesNextBtn = document.getElementById('rules-next-btn');
        const rulesPrevBtn = document.getElementById('rules-prev-btn');
        const rulesCasinoInfoBtn = document.getElementById('rules-casino-info-btn');
        const rulesBackBtn = document.getElementById('rules-back-btn');
        const rulesShortcutsBtn = document.getElementById('rules-shortcuts-btn');
        const rulesShortcutsBackBtn = document.getElementById('rules-shortcuts-back-btn');
        
        if (infoToggle) {
            infoToggle.addEventListener('click', () => this.toggle());
        }
        
        if (rulesCloseBtn) {
            rulesCloseBtn.addEventListener('click', () => this.close());
        }
        
        if (rulesNextBtn) {
            rulesNextBtn.addEventListener('click', () => this.showPage('advanced'));
        }
        
        if (rulesPrevBtn) {
            rulesPrevBtn.addEventListener('click', () => this.showPage('basic'));
        }
        
        if (rulesCasinoInfoBtn) {
            rulesCasinoInfoBtn.addEventListener('click', () => this.showPage('casino'));
        }
        
        if (rulesBackBtn) {
            rulesBackBtn.addEventListener('click', () => this.showPage('advanced'));
        }
        
        if (rulesShortcutsBtn) {
            rulesShortcutsBtn.addEventListener('click', () => this.showPage('shortcuts'));
        }
        
        if (rulesShortcutsBackBtn) {
            rulesShortcutsBackBtn.addEventListener('click', () => this.showPage('basic'));
        }
        
        // Close rules panel when clicking outside
        document.addEventListener('click', (e) => {
            const rulesPanelEl = document.getElementById('rules-panel');
            const infoToggleEl = document.getElementById('info-toggle');
            
            if (this.isOpen && rulesPanelEl && !rulesPanelEl.contains(e.target) && !infoToggleEl.contains(e.target)) {
                this.close();
            }
        });
        
        // Close rules panel with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    },
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },
    
    open() {
        const rulesPanelEl = document.getElementById('rules-panel');
        const settingsPanelEl = document.getElementById('settings-panel');
        
        if (rulesPanelEl) {
            rulesPanelEl.classList.add('open');
            rulesPanelEl.setAttribute('aria-hidden', 'false');
            this.isOpen = true;
            
            // Close settings panel if open
            if (settingsPanelEl && settingsPanelEl.classList.contains('open')) {
                settingsPanelEl.classList.remove('open');
                settingsPanelEl.setAttribute('aria-hidden', 'true');
            }
        }
    },
    
    close() {
        const rulesPanelEl = document.getElementById('rules-panel');
        
        if (rulesPanelEl) {
            rulesPanelEl.classList.remove('open');
            rulesPanelEl.setAttribute('aria-hidden', 'true');
            this.isOpen = false;
        }
    },
    
    showPage(page) {
        const basicPageEl = document.getElementById('rules-page-basic');
        const advancedPageEl = document.getElementById('rules-page-advanced');
        const casinoPageEl = document.getElementById('rules-page-casino');
        const shortcutsPageEl = document.getElementById('rules-page-shortcuts');
        
        if (page === 'basic') {
            if (basicPageEl) basicPageEl.style.display = 'block';
            if (advancedPageEl) advancedPageEl.style.display = 'none';
            if (casinoPageEl) casinoPageEl.style.display = 'none';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
            this.currentPage = 'basic';
        } else if (page === 'advanced') {
            if (basicPageEl) basicPageEl.style.display = 'none';
            if (advancedPageEl) advancedPageEl.style.display = 'block';
            if (casinoPageEl) casinoPageEl.style.display = 'none';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
            this.currentPage = 'advanced';
        } else if (page === 'casino') {
            if (basicPageEl) basicPageEl.style.display = 'none';
            if (advancedPageEl) advancedPageEl.style.display = 'none';
            if (casinoPageEl) casinoPageEl.style.display = 'block';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
            this.currentPage = 'casino';
        } else if (page === 'shortcuts') {
            if (basicPageEl) basicPageEl.style.display = 'none';
            if (advancedPageEl) advancedPageEl.style.display = 'none';
            if (casinoPageEl) casinoPageEl.style.display = 'none';
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'block';
            this.currentPage = 'shortcuts';
        }
    }
};
