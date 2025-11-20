
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
        
        // Sidebar navigation buttons
        const navBasic = document.getElementById('rules-nav-basic');
        const navAdvanced = document.getElementById('rules-nav-advanced');
        const navShortcuts = document.getElementById('rules-nav-shortcuts');
        const navCasino = document.getElementById('rules-nav-casino');
        
        if (infoToggle) {
            infoToggle.addEventListener('click', () => this.toggle());
        }
        
        if (rulesCloseBtn) {
            rulesCloseBtn.addEventListener('click', () => this.close());
        }
        
        // Sidebar navigation
        if (navBasic) {
            navBasic.addEventListener('click', () => this.showPage('basic'));
        }
        
        if (navAdvanced) {
            navAdvanced.addEventListener('click', () => this.showPage('advanced'));
        }
        
        if (navShortcuts) {
            navShortcuts.addEventListener('click', () => this.showPage('shortcuts'));
        }
        
        if (navCasino) {
            navCasino.addEventListener('click', () => this.showPage('casino'));
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
            
            // Ensure current page is shown and sidebar button is active
            this.showPage(this.currentPage);
            
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
        
        // Update sidebar button states
        const navBasic = document.getElementById('rules-nav-basic');
        const navAdvanced = document.getElementById('rules-nav-advanced');
        const navShortcuts = document.getElementById('rules-nav-shortcuts');
        const navCasino = document.getElementById('rules-nav-casino');
        
        // Remove active class from all buttons
        [navBasic, navAdvanced, navShortcuts, navCasino].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        // Hide all pages
        if (basicPageEl) basicPageEl.style.display = 'none';
        if (advancedPageEl) advancedPageEl.style.display = 'none';
        if (casinoPageEl) casinoPageEl.style.display = 'none';
        if (shortcutsPageEl) shortcutsPageEl.style.display = 'none';
        
        // Show selected page and activate corresponding button
        if (page === 'basic') {
            if (basicPageEl) basicPageEl.style.display = 'block';
            if (navBasic) navBasic.classList.add('active');
            this.currentPage = 'basic';
        } else if (page === 'advanced') {
            if (advancedPageEl) advancedPageEl.style.display = 'block';
            if (navAdvanced) navAdvanced.classList.add('active');
            this.currentPage = 'advanced';
        } else if (page === 'casino') {
            if (casinoPageEl) casinoPageEl.style.display = 'block';
            if (navCasino) navCasino.classList.add('active');
            this.currentPage = 'casino';
        } else if (page === 'shortcuts') {
            if (shortcutsPageEl) shortcutsPageEl.style.display = 'block';
            if (navShortcuts) navShortcuts.classList.add('active');
            this.currentPage = 'shortcuts';
        }
    }
};
