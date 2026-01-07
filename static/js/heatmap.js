// Git heatmap visualization

import { API_BASE } from './config.js';
import { getMonthNames, getDayNames } from './utils.js';
import { isAdmin, showLoginModal, setDayViewSwitchCallback, setPendingSwitchToDayView } from './admin.js';

// State
let currentHeatmapData = null;
let currentView = 'week'; // Default to week view (GitHub style)
export let reposData = {}; // Store description and URL for tooltip

// Helper function to format date in local timezone (avoids toISOString() UTC conversion)
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Expose for external access
export function getCurrentHeatmapData() {
    return currentHeatmapData;
}

export function setCurrentView(view) {
    currentView = view;
}

export async function loadRepos() {
    try {
        const response = await fetch(`${API_BASE}/git/repos`);
        const data = await response.json();
        const select = document.getElementById('repo-select');
        if (!select) return;

        // Clear and repopulate
        select.innerHTML = '';

        // Store descriptions and URLs for tooltip
        reposData = {};
        data.repos.forEach(repo => {
            reposData[repo.id] = {
                description: repo.description || '',
                url: repo.url || ''
            };

            const option = document.createElement('option');
            option.value = repo.id;
            option.textContent = repo.displayName || repo.name;
            select.appendChild(option);
        });

        // Always select a repo: defaultRepo or first one
        if (data.repos.length > 0) {
            const selectedId = data.defaultRepo || data.repos[0].id;
            select.value = selectedId;
            // Trigger change event to load heatmap
            select.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Error loading repos:', error);
    }
}

export function renderCurrentView() {
    if (currentView === 'week') {
        renderHeatmapWeekly(currentHeatmapData);
    } else {
        renderHeatmapDaily(currentHeatmapData);
    }
}

export function renderStats(data) {
    const statsDiv = document.getElementById('heatmap-stats');
    if (!statsDiv) return;

    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${data.stats.totalCommits}</div>
            <div class="stat-label">${I18n.t('stats.totalCommits')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.uniqueDays}</div>
            <div class="stat-label">${I18n.t('stats.activeDays')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.peakHour}h</div>
            <div class="stat-label">${I18n.t('stats.peakHour')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.currentStreak || 0}</div>
            <div class="stat-label">${I18n.t('stats.currentStreak')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.busiestDay || '-'}</div>
            <div class="stat-label">${I18n.t('stats.favoriteDay')}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.stats.avgCommitsPerDay || 0}</div>
            <div class="stat-label">${I18n.t('stats.avgPerDay')}</div>
        </div>
    `;
}

// Weekly view (GitHub style)
export function renderHeatmapWeekly(data) {
    renderStats(data);

    const container = document.getElementById('heatmap-container');
    const wrapper = document.querySelector('.heatmap-wrapper');
    const heatmapMain = document.querySelector('.heatmap-main');
    if (!container || !wrapper || !heatmapMain) return;

    container.classList.add('view-week-container');
    wrapper.classList.add('view-week');
    heatmapMain.classList.add('centered');

    const hoursColumn = document.getElementById('hours-column');
    const daysRow = document.getElementById('days-row');
    const monthsRow = document.getElementById('months-row');

    // Day labels (weekdays)
    const dayNames = getDayNames();
    hoursColumn.innerHTML = '';
    for (let d = 0; d < 7; d++) {
        const label = document.createElement('div');
        label.className = 'hour-label';
        label.textContent = dayNames[d];
        hoursColumn.appendChild(label);
    }

    daysRow.innerHTML = '';
    monthsRow.innerHTML = '';

    // Aggregate commits by day (sum all hours)
    const dailyCommits = {};
    for (const [key, count] of Object.entries(data.commits)) {
        const dateStr = key.substring(0, 10); // YYYY-MM-DD
        dailyCommits[dateStr] = (dailyCommits[dateStr] || 0) + count;
    }

    // Find max for color scaling
    const maxCommits = Math.max(...Object.values(dailyCommits), 1);

    const startDate = new Date(data.sinceDate);
    const endDate = new Date();

    // Align to start of week (Sunday)
    const alignedStart = new Date(startDate);
    alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

    let currentDate = new Date(alignedStart);
    let currentMonth = -1;
    let weekIndex = 0;

    while (currentDate <= endDate) {
        const weekColumn = document.createElement('div');
        weekColumn.className = 'day-column';

        // First day of the week - check for month label
        const firstDayOfWeek = new Date(currentDate);
        if (firstDayOfWeek.getMonth() !== currentMonth && firstDayOfWeek <= endDate) {
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = getMonthNames()[firstDayOfWeek.getMonth()];
            monthLabel.style.left = (weekIndex * 16) + 'px';
            monthLabel.dataset.weekIndex = weekIndex;
            monthsRow.appendChild(monthLabel);
            currentMonth = firstDayOfWeek.getMonth();
            // Mark column as month start for separator
            if (weekIndex > 0) {
                weekColumn.classList.add('month-start');
            }
        }

        // Create 7 cells for each day of the week
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            const dateStr = formatLocalDate(currentDate);
            const count = dailyCommits[dateStr] || 0;
            const day = currentDate.getDate();
            const month = currentDate.getMonth();

            // Color levels based on relative activity (GitHub style: 5 levels)
            let level = 0;
            if (count > 0) {
                const ratio = count / maxCommits;
                if (ratio <= 0.25) level = 1;
                else if (ratio <= 0.5) level = 2;
                else if (ratio <= 0.75) level = 3;
                else level = 4;
            }

            // Gray out dates before start or after today
            if (currentDate < startDate || currentDate > endDate) {
                cell.style.opacity = '0.3';
            }

            cell.classList.add(`heat-${level}`);
            // Only show tooltip if there are commits
            if (count > 0) {
                cell.title = `${day} ${getMonthNames()[month]}: ${count} commit${count !== 1 ? 's' : ''}`;
            }
            weekColumn.appendChild(cell);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        daysRow.appendChild(weekColumn);
        weekIndex++;
    }

    monthsRow.style.width = (weekIndex * 16) + 'px';

    // Calculate optimal cell size to fill available space
    requestAnimationFrame(() => {
        const heatmapMain = document.querySelector('.heatmap-main');
        const availableWidth = heatmapMain.clientWidth - 50; // 50px for labels
        const gap = parseFloat(getComputedStyle(daysRow).gap) || 2;
        const totalGaps = (weekIndex - 1) * gap;
        const cellSize = Math.floor((availableWidth - totalGaps) / weekIndex);
        const clampedSize = Math.max(12, Math.min(cellSize, 28)); // Min 12px, max 28px

        wrapper.style.setProperty('--cell-size', clampedSize + 'px');

        // Update month label positions with new cell size
        const monthLabels = monthsRow.querySelectorAll('.month-label');
        monthLabels.forEach(label => {
            const weekIdx = parseInt(label.dataset.weekIndex);
            label.style.left = (weekIdx * (clampedSize + gap)) + 'px';
        });

        monthsRow.style.width = (weekIndex * (clampedSize + gap)) + 'px';
    });
}

// Daily view (24h per day)
export function renderHeatmapDaily(data) {
    renderStats(data);

    const container = document.getElementById('heatmap-container');
    const wrapper = document.querySelector('.heatmap-wrapper');
    const heatmapMain = document.querySelector('.heatmap-main');
    if (!container || !wrapper || !heatmapMain) return;

    container.classList.remove('view-week-container');
    wrapper.classList.remove('view-week');
    heatmapMain.classList.remove('centered');

    const hoursColumn = document.getElementById('hours-column');
    hoursColumn.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        const label = document.createElement('div');
        label.className = 'hour-label';
        label.textContent = h.toString().padStart(2, '0') + 'h';
        hoursColumn.appendChild(label);
    }

    const daysRow = document.getElementById('days-row');
    const monthsRow = document.getElementById('months-row');
    daysRow.innerHTML = '';
    monthsRow.innerHTML = '';

    const startDate = new Date(data.sinceDate);
    const endDate = new Date();
    let currentDate = new Date(startDate);
    let currentMonth = -1;
    let dayIndex = 0;

    while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        const day = currentDate.getDate();
        const month = currentDate.getMonth();

        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';

        if (month !== currentMonth) {
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = getMonthNames()[month];
            monthLabel.style.left = (dayIndex * 16) + 'px';
            monthLabel.dataset.dayIndex = dayIndex;
            monthsRow.appendChild(monthLabel);
            currentMonth = month;
            // Mark column as month start for separator
            if (dayIndex > 0) {
                dayColumn.classList.add('month-start');
            }
        }

        for (let hour = 0; hour < 24; hour++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            const hourStr = hour.toString().padStart(2, '0');
            const key = `${dateStr}-${hourStr}`;
            const count = data.commits[key] || 0;

            // GitHub style: 5 levels
            let level = 0;
            if (count >= 1) level = 1;
            if (count >= 2) level = 2;
            if (count >= 4) level = 3;
            if (count >= 6) level = 4;

            cell.classList.add(`heat-${level}`);
            // Only show tooltip if there are commits
            if (count > 0) {
                cell.title = `${day} ${getMonthNames()[month]} a ${hourStr}h: ${count} commit${count > 1 ? 's' : ''}`;
            }
            dayColumn.appendChild(cell);
        }

        daysRow.appendChild(dayColumn);
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
    }

    // Recalculate month positions dynamically based on actual cell size
    requestAnimationFrame(() => {
        const firstCell = daysRow.querySelector('.cell');
        if (!firstCell) return;

        const cellWidth = parseFloat(getComputedStyle(firstCell).width);
        const gap = parseFloat(getComputedStyle(daysRow).gap) || 2;
        const columnWidth = cellWidth + gap;

        const monthLabels = monthsRow.querySelectorAll('.month-label');
        monthLabels.forEach(label => {
            const idx = parseInt(label.dataset.dayIndex);
            label.style.left = (idx * columnWidth) + 'px';
        });

        const totalWidth = dayIndex * columnWidth;
        monthsRow.style.width = totalWidth + 'px';
    });
}

export function initHeatmapListeners() {
    // Register callback for day view switch after login
    setDayViewSwitchCallback(() => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.view-btn[data-view="day"]').classList.add('active');
        currentView = 'day';
        if (currentHeatmapData) {
            renderCurrentView();
        }
    });

    const repoSelect = document.getElementById('repo-select');
    if (repoSelect) {
        repoSelect.addEventListener('change', async (e) => {
            const repoId = e.target.value;
            const container = document.getElementById('heatmap-container');
            const loading = document.getElementById('heatmap-loading');
            const viewToggle = document.getElementById('view-toggle');

            // Update info button for current repo (imported from repos.js later, use window)
            if (window.updateInfoButton) {
                window.updateInfoButton(repoId);
            }

            if (!repoId) {
                container.style.display = 'none';
                viewToggle.style.display = 'none';
                return;
            }

            loading.style.display = 'block';
            container.style.display = 'none';

            try {
                const response = await fetch(`${API_BASE}/git/heatmap/${repoId}`);
                currentHeatmapData = await response.json();
                renderCurrentView();
                container.style.display = 'block';
                viewToggle.style.display = 'flex';
            } catch (error) {
                console.error('Error loading heatmap:', error);
            } finally {
                loading.style.display = 'none';
            }
        });
    }

    // View toggle handling
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;

            // Day view requires admin
            if (view === 'day' && !isAdmin) {
                setPendingSwitchToDayView(true);
                showLoginModal();
                return;
            }

            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = view;
            if (currentHeatmapData) {
                renderCurrentView();
            }
        });
    });
}

// Drag scroll state
let dragState = { isDown: false, startX: 0, scrollLeft: 0, element: null };

export function initDragScroll() {
    document.addEventListener('mousedown', (e) => {
        const heatmapMain = e.target.closest('.heatmap-main');
        if (!heatmapMain) return;

        dragState.isDown = true;
        dragState.element = heatmapMain;
        dragState.startX = e.pageX;
        dragState.scrollLeft = heatmapMain.scrollLeft;
        heatmapMain.classList.add('dragging');
    });

    document.addEventListener('mouseup', () => {
        if (dragState.element) {
            dragState.element.classList.remove('dragging');
        }
        dragState.isDown = false;
        dragState.element = null;
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragState.isDown || !dragState.element) return;
        e.preventDefault();
        const walk = (e.pageX - dragState.startX) * 1.5;
        dragState.element.scrollLeft = dragState.scrollLeft - walk;
    });
}
