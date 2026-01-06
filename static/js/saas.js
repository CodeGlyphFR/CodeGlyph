// SaaS cards CRUD operations

import { API_BASE } from './config.js';
import { escapeHtml } from './utils.js';
import { isAdmin } from './admin.js';

// DOM elements (initialized in initSaasListeners)
let saasModal, saasModalTitle, saasForm, deleteSaasBtn, saasUploadZone, saasIconFileInput, saasUploadPreview, saasIconInput;

export async function loadSaas() {
    try {
        const response = await fetch(`${API_BASE}/saas`);
        const data = await response.json();
        renderSaas(data.saas);
    } catch (error) {
        console.error('Error loading SaaS:', error);
    }
}

export function renderSaas(items) {
    const grid = document.getElementById('saas-grid');
    if (!grid) return;

    grid.innerHTML = items.map(item => {
        const hasContent = item.title || item.description;
        const hasLink = item.link && item.link.trim() !== '';
        // Migration: inProgress -> status
        let status = item.status || 'live';
        if (item.inProgress === true && !item.status) {
            status = 'development';
        }
        // Teaser mode = pas de lien (grise, non cliquable)
        const isTeaser = !hasLink;
        const cardClasses = [
            'saas-card',
            !hasContent ? 'icon-only' : '',
            isTeaser ? 'teaser' : ''
        ].filter(Boolean).join(' ');

        // Badge selon le status
        const statusBadges = {
            'development': `<div class="status-badge status-development">${I18n.t('status.development')}</div>`,
            'prerelease': `<div class="status-badge status-prerelease">${I18n.t('status.prerelease')}</div>`,
            'live': `<div class="status-badge status-live">${I18n.t('status.live')}</div>`
        };

        return `
        <div class="${cardClasses}"
             data-id="${escapeHtml(item.id)}"
             data-link="${escapeHtml(item.link)}"
             data-status="${status}"
             onclick="openSaas(this, event)">
            <div class="saas-admin-controls admin-only" style="${isAdmin ? '' : 'display:none'}">
                <button class="edit-saas-btn" onclick="editSaas(event, '${item.id}')" title="Modifier">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
            ${statusBadges[status] || ''}
            <div class="saas-icon">
                <img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.title || 'SaaS')}" onerror="this.src='icons/default.svg'">
            </div>
            ${hasContent ? `
            <div class="saas-content">
                ${item.title ? `<h3>${escapeHtml(item.title)}</h3>` : ''}
                ${I18n.getLocalizedText(item, 'description') ? `<p>${escapeHtml(I18n.getLocalizedText(item, 'description'))}</p>` : ''}
            </div>
            ` : ''}
        </div>
    `}).join('');
}

export function openSaas(card, event) {
    // Don't open if clicking admin controls
    if (event.target.closest('.saas-admin-controls')) return;

    const link = card.dataset.link;
    // Only open if there's a link
    if (link && link.trim() !== '') {
        window.open(link, '_blank', 'noopener,noreferrer');
    }
}

export function editSaas(event, saasId) {
    event.preventDefault();
    event.stopPropagation();

    fetch(`${API_BASE}/saas/${saasId}`)
        .then(r => r.json())
        .then(saas => {
            saasModalTitle.textContent = I18n.t('modals.editSaas');
            document.getElementById('saas-id').value = saas.id;
            document.getElementById('saas-title').value = saas.title || '';
            document.getElementById('saas-description').value = I18n.getLocalizedText(saas, 'description');
            document.getElementById('saas-link').value = saas.link;
            saasIconInput.value = saas.icon || 'icons/default.svg';
            // Migration: inProgress -> status
            let status = saas.status || 'live';
            if (saas.inProgress === true && !saas.status) {
                status = 'development';
            }
            document.getElementById('saas-status').value = status;
            setSaasUploadPreview(saas.icon);
            deleteSaasBtn.style.display = 'block';
            saasModal.classList.add('active');
        });
}

async function uploadSaasIcon(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'saas');

    try {
        saasUploadPreview.innerHTML = '<span>Envoi en cours...</span>';
        const response = await fetch(`${API_BASE}/cards/upload-icon`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            saasIconInput.value = data.path;
            setSaasUploadPreview(data.path);
        } else {
            alert(data.error || I18n.t('errors.uploadError'));
            resetSaasUploadPreview();
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert(I18n.t('errors.uploadError'));
        resetSaasUploadPreview();
    }
}

function setSaasUploadPreview(iconPath) {
    if (iconPath && iconPath !== 'icons/default.svg') {
        saasUploadPreview.innerHTML = `<img src="${iconPath}" alt="Preview">`;
    } else {
        resetSaasUploadPreview();
    }
}

function resetSaasUploadPreview() {
    saasUploadPreview.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Cliquer ou glisser une image</span>
    `;
}

export function initSaasListeners() {
    // Initialize DOM elements
    saasModal = document.getElementById('saas-modal');
    saasModalTitle = document.getElementById('saas-modal-title');
    saasForm = document.getElementById('saas-form');
    deleteSaasBtn = document.getElementById('delete-saas-btn');
    saasUploadZone = document.getElementById('saas-upload-zone');
    saasIconFileInput = document.getElementById('saas-icon-file');
    saasUploadPreview = document.getElementById('saas-upload-preview');
    saasIconInput = document.getElementById('saas-icon');

    if (!saasModal) return;

    // Add SaaS button
    const addSaasBtn = document.getElementById('add-saas-btn');
    if (addSaasBtn) {
        addSaasBtn.addEventListener('click', () => {
            saasModalTitle.textContent = I18n.t('modals.addSaas');
            saasForm.reset();
            document.getElementById('saas-id').value = '';
            saasIconInput.value = 'icons/default.svg';
            document.getElementById('saas-status').value = 'development';
            resetSaasUploadPreview();
            deleteSaasBtn.style.display = 'none';
            saasModal.classList.add('active');
        });
    }

    // Modal close
    const saasModalClose = document.getElementById('saas-modal-close');
    if (saasModalClose) {
        saasModalClose.addEventListener('click', () => {
            saasModal.classList.remove('active');
        });
    }

    saasModal.addEventListener('click', (e) => {
        if (e.target === saasModal) saasModal.classList.remove('active');
    });

    // Form submit
    saasForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saasId = document.getElementById('saas-id').value;
        const saasData = {
            title: document.getElementById('saas-title').value,
            description: document.getElementById('saas-description').value,
            link: document.getElementById('saas-link').value,
            icon: saasIconInput.value || 'icons/default.svg',
            status: document.getElementById('saas-status').value,
            source_lang: I18n.getLang()
        };

        const method = saasId ? 'PUT' : 'POST';
        const url = saasId ? `${API_BASE}/saas/${saasId}` : `${API_BASE}/saas`;

        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saasData)
        });

        saasModal.classList.remove('active');
        loadSaas();
    });

    // Delete button
    deleteSaasBtn.addEventListener('click', async () => {
        const saasId = document.getElementById('saas-id').value;
        if (confirm(I18n.t('confirmations.deleteSaas'))) {
            await fetch(`${API_BASE}/saas/${saasId}`, { method: 'DELETE' });
            saasModal.classList.remove('active');
            loadSaas();
        }
    });

    // SaaS Icon upload handling
    saasUploadZone.addEventListener('click', () => saasIconFileInput.click());

    saasUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        saasUploadZone.classList.add('dragover');
    });

    saasUploadZone.addEventListener('dragleave', () => {
        saasUploadZone.classList.remove('dragover');
    });

    saasUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        saasUploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            uploadSaasIcon(file);
        }
    });

    saasIconFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadSaasIcon(file);
        }
    });

    // Listen for admin state changes
    window.addEventListener('adminStateChanged', loadSaas);
}

// Expose for onclick handlers
window.openSaas = openSaas;
window.editSaas = editSaas;
