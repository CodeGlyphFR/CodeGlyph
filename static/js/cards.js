// Service cards CRUD operations

import { API_BASE } from './config.js';
import { escapeHtml } from './utils.js';
import { isAdmin } from './admin.js';

// DOM elements (initialized in initCardListeners)
let modal, modalTitle, cardForm, deleteBtn, uploadZone, iconFileInput, uploadPreview, cardIconInput;

export async function loadCards() {
    try {
        const response = await fetch(`${API_BASE}/cards`);
        const data = await response.json();
        renderCards(data.cards);
    } catch (error) {
        console.error('Error loading cards:', error);
    }
}

export function renderCards(cards) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;

    grid.innerHTML = cards.map(card => {
        const isPublic = card.public !== false;
        const isRestricted = !isPublic && !isAdmin;
        return `
        <div class="service-card ${isRestricted ? 'restricted' : ''}"
             data-id="${card.id}"
             data-link="${escapeHtml(card.link)}"
             data-public="${isPublic}"
             onclick="openService(this, event)">
            <div class="card-admin-controls admin-only" style="${isAdmin ? '' : 'display:none'}">
                <button class="edit-card-btn" onclick="editCard(event, '${card.id}')" title="Modifier">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button class="toggle-public-btn ${isPublic ? 'is-public' : ''}" onclick="toggleCardPublic(event, '${card.id}', ${!isPublic})" title="${isPublic ? I18n.t('cards.makePrivate') : I18n.t('cards.makePublic')}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        ${isPublic ? `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ` : `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        `}
                    </svg>
                </button>
            </div>
            <div class="icon">
                <img src="${escapeHtml(card.icon)}" alt="${escapeHtml(card.title)}" onerror="this.src='icons/default.svg'">
            </div>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(I18n.getLocalizedText(card, 'description'))}</p>
        </div>
    `}).join('');
}

export async function toggleCardPublic(event, cardId, newPublicState) {
    event.stopPropagation();
    try {
        await fetch(`${API_BASE}/cards/${cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public: newPublicState })
        });
        loadCards();
    } catch (error) {
        console.error('Error toggling public state:', error);
    }
}

export function openService(card, event) {
    // Don't open if clicking admin controls
    if (event.target.closest('.card-admin-controls')) return;

    const link = card.dataset.link;
    const isPublic = card.dataset.public === 'true';

    if (isPublic || isAdmin) {
        window.open(link, '_blank', 'noopener,noreferrer');
    }
}

export function editCard(event, cardId) {
    event.preventDefault();
    event.stopPropagation();

    fetch(`${API_BASE}/cards/${cardId}`)
        .then(r => r.json())
        .then(card => {
            modalTitle.textContent = I18n.t('modals.editService');
            document.getElementById('card-id').value = card.id;
            document.getElementById('card-title').value = card.title;
            document.getElementById('card-description').value = I18n.getLocalizedText(card, 'description');
            document.getElementById('card-link').value = card.link;
            cardIconInput.value = card.icon || 'icons/default.svg';
            document.getElementById('card-public').checked = card.public !== false;
            setUploadPreview(card.icon);
            deleteBtn.style.display = 'block';
            modal.classList.add('active');
        });
}

async function uploadIcon(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        uploadPreview.innerHTML = '<span>Envoi en cours...</span>';
        const response = await fetch(`${API_BASE}/cards/upload-icon`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            cardIconInput.value = data.path;
            setUploadPreview(data.path);
        } else {
            alert(data.error || I18n.t('errors.uploadError'));
            resetUploadPreview();
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert(I18n.t('errors.uploadError'));
        resetUploadPreview();
    }
}

function setUploadPreview(iconPath) {
    if (iconPath && iconPath !== 'icons/default.svg') {
        uploadPreview.innerHTML = `<img src="${iconPath}" alt="Preview">`;
    } else {
        resetUploadPreview();
    }
}

function resetUploadPreview() {
    uploadPreview.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Cliquer ou glisser une image</span>
    `;
}

export function initCardListeners() {
    // Initialize DOM elements
    modal = document.getElementById('card-modal');
    modalTitle = document.getElementById('modal-title');
    cardForm = document.getElementById('card-form');
    deleteBtn = document.getElementById('delete-card-btn');
    uploadZone = document.getElementById('upload-zone');
    iconFileInput = document.getElementById('icon-file');
    uploadPreview = document.getElementById('upload-preview');
    cardIconInput = document.getElementById('card-icon');

    if (!modal) return;

    // Add card button
    const addCardBtn = document.getElementById('add-card-btn');
    if (addCardBtn) {
        addCardBtn.addEventListener('click', () => {
            modalTitle.textContent = I18n.t('modals.addService');
            cardForm.reset();
            document.getElementById('card-id').value = '';
            cardIconInput.value = 'icons/default.svg';
            document.getElementById('card-public').checked = true;
            resetUploadPreview();
            deleteBtn.style.display = 'none';
            modal.classList.add('active');
        });
    }

    // Modal close
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Form submit
    cardForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cardId = document.getElementById('card-id').value;
        const cardData = {
            title: document.getElementById('card-title').value,
            description: document.getElementById('card-description').value,
            link: document.getElementById('card-link').value,
            icon: cardIconInput.value || 'icons/default.svg',
            public: document.getElementById('card-public').checked,
            source_lang: I18n.getLang()
        };

        const method = cardId ? 'PUT' : 'POST';
        const url = cardId ? `${API_BASE}/cards/${cardId}` : `${API_BASE}/cards`;

        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
        });

        modal.classList.remove('active');
        loadCards();
    });

    // Delete button
    deleteBtn.addEventListener('click', async () => {
        const cardId = document.getElementById('card-id').value;
        if (confirm(I18n.t('confirmations.deleteService'))) {
            await fetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE' });
            modal.classList.remove('active');
            loadCards();
        }
    });

    // Icon upload handling
    uploadZone.addEventListener('click', () => iconFileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            uploadIcon(file);
        }
    });

    iconFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadIcon(file);
        }
    });

    // Listen for admin state changes
    window.addEventListener('adminStateChanged', loadCards);
}

// Expose for onclick handlers
window.openService = openService;
window.editCard = editCard;
window.toggleCardPublic = toggleCardPublic;
