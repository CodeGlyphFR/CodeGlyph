// Main application entry point

import { initTheme } from './theme.js';
import { checkAdminSession, initAdminListeners, updateAdminUI, isAdmin } from './admin.js';
import { loadCards, initCardListeners } from './cards.js';
import { loadSaas, initSaasListeners } from './saas.js';
import { loadRepos, initHeatmapListeners, initDragScroll, initTooltipListeners, renderCurrentView, getCurrentHeatmapData } from './heatmap.js';
import { initRepoListeners, updateInfoButton, loadManagedRepos } from './repos.js';
import { startMonitoring, initServiceTooltipListeners } from './monitoring.js';

// Initialize theme immediately (before DOMContentLoaded)
initTheme();

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await I18n.init();

    // Initialize admin state
    checkAdminSession();

    // Initialize all event listeners
    initAdminListeners();
    initCardListeners();
    initSaasListeners();
    initHeatmapListeners();
    initDragScroll();
    initTooltipListeners();
    initServiceTooltipListeners();
    initRepoListeners();

    // Load initial data
    loadCards();
    loadSaas();
    loadRepos();
    startMonitoring();
});

// Handle language changes - reload dynamic content
window.addEventListener('languageChanged', () => {
    loadCards();
    loadSaas();
    const heatmapData = getCurrentHeatmapData();
    if (heatmapData) {
        renderCurrentView();
    }
    updateAdminUI();
    // Update repo info tooltip with localized description (admin only)
    if (isAdmin) {
        const select = document.getElementById('repo-select');
        if (select && select.value) {
            updateInfoButton(select.value);
        }
    }
    // Reload repo modal if open
    const repoModal = document.getElementById('repo-modal');
    if (repoModal && repoModal.classList.contains('active')) {
        loadManagedRepos();
    }
});
