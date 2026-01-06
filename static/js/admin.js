// Admin mode management

import { API_BASE } from './config.js';

export let isAdmin = false;
export let pendingSwitchToDayView = false;

// Callbacks for heatmap view switching (set by heatmap.js)
let onDayViewSwitch = null;

export function setDayViewSwitchCallback(callback) {
    onDayViewSwitch = callback;
}

export function resetPendingSwitchToDayView() {
    pendingSwitchToDayView = false;
}

export function setPendingSwitchToDayView(value) {
    pendingSwitchToDayView = value;
}

export function checkAdminSession() {
    isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    updateAdminUI();
}

export function updateAdminUI() {
    // Show/hide admin-only elements
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });

    // Update admin button appearance
    const adminBtn = document.getElementById('admin-toggle');
    if (!adminBtn) return;

    adminBtn.classList.toggle('active', isAdmin);

    // Update admin button icon (open/closed lock)
    if (isAdmin) {
        adminBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
        `;
        adminBtn.title = I18n.t('header.adminLogout');
    } else {
        adminBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        `;
        adminBtn.title = I18n.t('header.adminMode');
    }
}

export function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-form').reset();
    document.getElementById('login-username').focus();
}

export function hideLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
    pendingSwitchToDayView = false;
}

export function logout() {
    isAdmin = false;
    sessionStorage.removeItem('isAdmin');
    updateAdminUI();
    // Dispatch event to notify cards and saas modules to reload
    window.dispatchEvent(new CustomEvent('adminStateChanged'));
}

export function initAdminListeners() {
    // Admin button click
    const adminBtn = document.getElementById('admin-toggle');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            if (isAdmin) {
                logout();
            } else {
                showLoginModal();
            }
        });
    }

    // Login modal close
    const loginModalClose = document.getElementById('login-modal-close');
    if (loginModalClose) {
        loginModalClose.addEventListener('click', hideLoginModal);
    }

    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target.id === 'login-modal') hideLoginModal();
        });
    }

    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    isAdmin = true;
                    sessionStorage.setItem('isAdmin', 'true');
                    updateAdminUI();

                    // Dispatch event to notify cards and saas modules to reload
                    window.dispatchEvent(new CustomEvent('adminStateChanged'));

                    // Save before hideLoginModal resets it
                    const shouldSwitchToDayView = pendingSwitchToDayView;
                    hideLoginModal();

                    // Switch to day view if login was triggered from day view button
                    if (shouldSwitchToDayView && onDayViewSwitch) {
                        onDayViewSwitch();
                    }
                } else {
                    let errorMsg = data.error || I18n.t('errors.loginFailed');
                    if (data.attemptsLeft !== undefined && data.attemptsLeft > 0) {
                        errorMsg += ' ' + I18n.t('errors.attemptsLeft', {count: data.attemptsLeft});
                    }
                    errorEl.textContent = errorMsg;
                }
            } catch (error) {
                console.error('Login error:', error);
                errorEl.textContent = I18n.t('errors.connectionError');
            }
        });
    }
}

// Expose for onclick handlers
window.showLoginModal = showLoginModal;
