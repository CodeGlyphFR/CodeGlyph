// Repository management

import { API_BASE } from './config.js';
import { escapeHtml } from './utils.js';
import { reposData } from './heatmap.js';

// DOM elements (initialized in initRepoListeners)
let repoModal, managedReposList, discoveredReposList;

export async function loadManagedRepos() {
    try {
        const response = await fetch(`${API_BASE}/git/repos`);
        const data = await response.json();
        renderManagedRepos(data.repos);
    } catch (error) {
        console.error('Error loading managed repos:', error);
        if (managedReposList) {
            managedReposList.innerHTML = '<p class="repo-empty">Erreur de chargement</p>';
        }
    }
}

export function renderManagedRepos(repos) {
    if (!managedReposList) return;

    if (repos.length === 0) {
        managedReposList.innerHTML = '<p class="repo-empty">Aucun depot configure</p>';
        return;
    }

    const isLastRepo = repos.length === 1;

    managedReposList.innerHTML = repos.map(repo => `
        <div class="repo-item ${repo.isDefault ? 'is-default' : ''}" data-id="${escapeHtml(repo.id)}">
            ${!isLastRepo ? `
            <button class="btn-icon-small delete repo-delete-btn"
                    onclick="removeRepo('${escapeHtml(repo.id)}')"
                    title="Supprimer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            ` : ''}
            <button class="btn-icon-small star ${repo.isDefault ? 'active' : ''}" onclick="setDefaultRepo('${escapeHtml(repo.id)}')" title="${repo.isDefault ? 'Depot par defaut' : 'Definir par defaut'}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="${repo.isDefault ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            </button>
            <div class="repo-info">
                <div class="repo-name-row">
                    <span class="repo-name">${escapeHtml(repo.displayName || repo.name)}</span>
                    <button class="btn-icon-tiny edit" onclick="editRepoName('${escapeHtml(repo.id)}')" title="Renommer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
                <span class="repo-path">${escapeHtml(repo.path)}</span>
                <input type="url"
                       class="repo-url-input"
                       data-i18n-placeholder="placeholders.projectUrl"
                       placeholder="${I18n.t('placeholders.projectUrl')}"
                       value="${escapeHtml(repo.url || '')}"
                       onblur="saveRepoUrl('${escapeHtml(repo.id)}', this.value)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
                <input type="text"
                       class="repo-description-input"
                       data-i18n-placeholder="placeholders.addDescription"
                       placeholder="${I18n.t('placeholders.addDescription')}"
                       value="${escapeHtml(I18n.getLocalizedText(repo, 'description'))}"
                       onblur="saveRepoDescription('${escapeHtml(repo.id)}', this.value)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
        </div>
    `).join('');
}

export async function removeRepo(repoId) {
    try {
        const response = await fetch(`${API_BASE}/git/repos/${repoId}`, { method: 'DELETE' });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || I18n.t('errors.deleteError'));
            return;
        }

        loadManagedRepos();
        refreshRepoSelect();
    } catch (error) {
        console.error('Error removing repo:', error);
        alert(I18n.t('errors.deleteError'));
    }
}

export async function setDefaultRepo(repoId) {
    try {
        const response = await fetch(`${API_BASE}/git/repos/${repoId}/default`, { method: 'POST' });
        if (!response.ok) {
            const data = await response.json();
            console.error('Error setting default:', data.error);
            return;
        }
        await loadManagedRepos();
        await refreshRepoSelect();
    } catch (error) {
        console.error('Error setting default repo:', error);
    }
}

export async function discoverRepos() {
    if (!discoveredReposList) return;
    discoveredReposList.innerHTML = '<p class="repo-loading">Scan en cours...</p>';

    try {
        const response = await fetch(`${API_BASE}/git/repos/discover`);
        const data = await response.json();
        renderDiscoveredRepos(data.discovered);
    } catch (error) {
        console.error('Error discovering repos:', error);
        discoveredReposList.innerHTML = '<p class="repo-empty">Erreur lors du scan</p>';
    }
}

export function renderDiscoveredRepos(repos) {
    if (!discoveredReposList) return;

    if (repos.length === 0) {
        discoveredReposList.innerHTML = '<p class="repo-empty">Aucun nouveau depot trouve</p>';
        return;
    }

    discoveredReposList.innerHTML = repos.map(repo => `
        <div class="repo-item" data-path="${escapeHtml(repo.path)}">
            <button class="btn-icon-small add repo-add-btn" onclick="addRepo('${escapeHtml(repo.path)}', '${escapeHtml(repo.name)}')" title="Ajouter">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
            </button>
            <div class="repo-info">
                <span class="repo-name">${escapeHtml(repo.name)}</span>
                <span class="repo-path">${escapeHtml(repo.path)}</span>
            </div>
        </div>
    `).join('');
}

export async function addRepo(path, name) {
    try {
        const response = await fetch(`${API_BASE}/git/repos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, name })
        });

        if (response.ok) {
            loadManagedRepos();
            refreshRepoSelect();
            // Remove from discovered list
            if (discoveredReposList) {
                const item = discoveredReposList.querySelector(`[data-path="${path}"]`);
                if (item) item.remove();

                // Check if discovered list is empty
                if (discoveredReposList.querySelectorAll('.repo-item').length === 0) {
                    discoveredReposList.innerHTML = '<p class="repo-empty">Aucun nouveau depot trouve</p>';
                }
            }
        } else {
            const data = await response.json();
            alert(data.error || I18n.t('errors.addError'));
        }
    } catch (error) {
        console.error('Error adding repo:', error);
        alert(I18n.t('errors.addError'));
    }
}

export async function refreshRepoSelect() {
    const select = document.getElementById('repo-select');
    if (!select) return;

    const currentValue = select.value;

    // Clear all options
    select.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/git/repos`);
        const data = await response.json();

        // Update data cache (in heatmap.js)
        // Note: We can't directly modify reposData from here, but it will be updated on next loadRepos
        data.repos.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.id;
            option.textContent = repo.displayName || repo.name;
            select.appendChild(option);
        });

        // Restore selection if still available, or select default/first
        if (data.repos.length > 0) {
            const exists = Array.from(select.options).some(opt => opt.value === currentValue);
            if (exists) {
                select.value = currentValue;
            } else {
                // Select the new default or first repo
                select.value = data.defaultRepo || data.repos[0].id;
                select.dispatchEvent(new Event('change'));
            }
        }

        // Update info button
        updateInfoButton(select.value);
    } catch (error) {
        console.error('Error refreshing repos:', error);
    }
}

export function editRepoName(repoId) {
    if (!managedReposList) return;

    const repoItem = managedReposList.querySelector(`[data-id="${repoId}"]`);
    if (!repoItem) return;

    const nameSpan = repoItem.querySelector('.repo-name');
    const currentName = nameSpan.textContent;

    // Replace with input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'repo-name-input';
    input.value = currentName;
    input.placeholder = 'Nom du depot';

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    // Save on Enter or blur
    const saveEdit = async () => {
        const newName = input.value.trim();

        if (newName && newName !== currentName) {
            try {
                await fetch(`${API_BASE}/git/repos/${repoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: newName })
                });
                await refreshRepoSelect();
            } catch (error) {
                console.error('Error updating repo name:', error);
            }
        }

        // Reload the list to restore display
        loadManagedRepos();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        if (e.key === 'Escape') {
            loadManagedRepos(); // Cancel
        }
    });
}

export async function saveRepoDescription(repoId, description) {
    try {
        const response = await fetch(`${API_BASE}/git/repos/${repoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: description.trim(),
                source_lang: I18n.getLang()
            })
        });
        const updatedRepo = await response.json();

        // Update cache with bilingual description
        if (reposData[repoId]) {
            reposData[repoId].description = updatedRepo.description || '';
        }
        const select = document.getElementById('repo-select');
        if (select && select.value === repoId) {
            updateInfoButton(repoId);
        }
    } catch (error) {
        console.error('Error saving description:', error);
    }
}

export async function saveRepoUrl(repoId, url) {
    try {
        await fetch(`${API_BASE}/git/repos/${repoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url.trim() })
        });

        // Update cache and info button if it's the selected repo
        if (reposData[repoId]) {
            reposData[repoId].url = url.trim();
        }
        const select = document.getElementById('repo-select');
        if (select && select.value === repoId) {
            updateInfoButton(repoId);
        }
    } catch (error) {
        console.error('Error saving URL:', error);
    }
}

export function updateInfoButton(repoId) {
    const infoBtn = document.getElementById('repo-info-btn');
    if (!infoBtn) return;

    const tooltip = infoBtn.querySelector('.info-tooltip');
    const data = reposData[repoId] || {};
    // Get localized description (handles bilingual {fr: ..., en: ...} objects)
    const descObj = data.description || '';
    const description = typeof descObj === 'object' ? (descObj[I18n.getLang()] || descObj.fr || descObj.en || '') : descObj;
    const url = data.url || '';

    if ((description && description.trim()) || (url && url.trim())) {
        infoBtn.style.display = 'flex';

        // Build tooltip content: description first, then URL (like GitHub)
        let content = '';
        if (description && description.trim()) {
            content += `<div class="tooltip-description">${escapeHtml(description)}</div>`;
        }
        if (url && url.trim()) {
            content += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="tooltip-link" onclick="event.stopPropagation();"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>${escapeHtml(url)}</a>`;
        }

        tooltip.innerHTML = content;
        tooltip.classList.remove('active'); // Reset on change
        infoBtn.title = '';
    } else {
        infoBtn.style.display = 'none';
    }
}

export function initRepoListeners() {
    // Initialize DOM elements
    repoModal = document.getElementById('repo-modal');
    managedReposList = document.getElementById('managed-repos-list');
    discoveredReposList = document.getElementById('discovered-repos-list');

    if (!repoModal) return;

    // Open repo settings modal
    const repoSettingsBtn = document.getElementById('repo-settings-btn');
    if (repoSettingsBtn) {
        repoSettingsBtn.addEventListener('click', () => {
            repoModal.classList.add('active');
            loadManagedRepos();
            // Reset discovered list
            if (discoveredReposList) {
                discoveredReposList.innerHTML = '<p class="repo-empty">Cliquez sur Scanner pour rechercher de nouveaux depots.</p>';
            }
        });
    }

    // Close modal
    const repoModalClose = document.getElementById('repo-modal-close');
    if (repoModalClose) {
        repoModalClose.addEventListener('click', () => {
            repoModal.classList.remove('active');
        });
    }

    repoModal.addEventListener('click', (e) => {
        if (e.target === repoModal) repoModal.classList.remove('active');
    });

    // Discover repos
    const discoverBtn = document.getElementById('discover-btn');
    if (discoverBtn) {
        discoverBtn.addEventListener('click', discoverRepos);
    }

    // Toggle tooltip on click (mobile support)
    const infoBtn = document.getElementById('repo-info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = e.currentTarget.querySelector('.info-tooltip');
            if (tooltip) {
                tooltip.classList.toggle('active');
            }
        });
    }

    // Close tooltip when clicking outside
    document.addEventListener('click', (e) => {
        const infoBtn = document.getElementById('repo-info-btn');
        if (infoBtn && !infoBtn.contains(e.target)) {
            const tooltip = infoBtn.querySelector('.info-tooltip');
            if (tooltip) {
                tooltip.classList.remove('active');
            }
        }
    });
}

// Expose for onclick handlers
window.removeRepo = removeRepo;
window.setDefaultRepo = setDefaultRepo;
window.addRepo = addRepo;
window.editRepoName = editRepoName;
window.saveRepoDescription = saveRepoDescription;
window.saveRepoUrl = saveRepoUrl;
window.updateInfoButton = updateInfoButton;
