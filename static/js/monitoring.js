// System monitoring (CPU, RAM, disk, services)

import { API_BASE, FIXED_SERVICES_COUNT } from './config.js';
import { isAdmin } from './admin.js';

const MONITOR_REFRESH_INTERVAL = 5000; // 5 seconds

export async function loadSystemStatus() {
    try {
        const response = await fetch(`${API_BASE}/system/status`);
        const data = await response.json();

        if (data.error && response.status !== 200) {
            console.warn('System status:', data.error);
            return;
        }

        updateGauge('cpu-gauge', data.cpu || 0);
        updateGauge('ram-gauge', data.ram || 0);
        renderDiskBars(data.disks || []);
        renderServiceMatrix(data.services || []);
        updateMonitorTimestamp(data.timestamp);

    } catch (error) {
        console.error('Error loading system status:', error);
    }
}

export function updateGauge(gaugeId, percent) {
    const gauge = document.getElementById(gaugeId);
    if (!gauge) return;

    const fill = gauge.querySelector('.gauge-fill');
    const needle = gauge.querySelector('.gauge-needle');
    const value = gauge.querySelector('.gauge-value');

    // Arc length is 126 (half circle with radius 40)
    const offset = 126 - (126 * percent / 100);
    fill.style.strokeDashoffset = offset;

    // Needle rotation: -90deg (0%) to 90deg (100%)
    const rotation = -90 + (180 * percent / 100);
    needle.style.transform = `rotate(${rotation}deg)`;

    value.textContent = `${percent}%`;

    // Color coding
    fill.classList.remove('warning', 'danger');
    if (percent >= 90) {
        fill.classList.add('danger');
    } else if (percent >= 70) {
        fill.classList.add('warning');
    }
}

export function renderDiskBars(disks) {
    const container = document.getElementById('disk-bars');
    if (!container) return;

    if (disks.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.75rem;">--</span>';
        return;
    }

    container.innerHTML = disks.map((disk) => {
        const colorClass = disk.percent >= 90 ? 'danger' : (disk.percent >= 70 ? 'warning' : '');
        return `
            <div class="disk-bar">
                <div class="disk-bar-track">
                    <div class="disk-bar-fill ${colorClass}" style="height: ${disk.percent}%"></div>
                </div>
                <span class="disk-bar-value">${disk.percent}%</span>
            </div>
        `;
    }).join('');
}

// ResizeObserver pour recalculer la matrice lors du redimensionnement
let serviceMatrixObserver = null;

/**
 * Calcule la disposition optimale pour remplir tout l'espace
 * avec N points circulaires de taille egale.
 */
function calculateOptimalLayout(container, totalDots) {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (containerWidth === 0 || containerHeight === 0 || totalDots === 0) return;

    const GAP_RATIO = 0.15; // 15% d'espacement entre les points
    let bestConfig = { cols: 1, rows: totalDots, dotSize: 0 };

    // Tester chaque nombre de colonnes possible pour trouver la meilleure configuration
    for (let cols = 1; cols <= totalDots; cols++) {
        const rows = Math.ceil(totalDots / cols);
        const cellWidth = containerWidth / cols;
        const cellHeight = containerHeight / rows;
        const maxDotSize = Math.min(cellWidth, cellHeight) / (1 + GAP_RATIO);

        if (maxDotSize > bestConfig.dotSize) {
            bestConfig = { cols, rows, dotSize: maxDotSize };
        }
    }

    const gap = bestConfig.dotSize * GAP_RATIO;

    // Appliquer la configuration via CSS Grid
    container.style.gridTemplateColumns = `repeat(${bestConfig.cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${bestConfig.rows}, 1fr)`;
    container.style.gap = `${gap}px`;
    container.style.setProperty('--dot-size', `${Math.floor(bestConfig.dotSize)}px`);
}

export function renderServiceMatrix(services) {
    const container = document.getElementById('service-matrix');
    const label = document.getElementById('services-label');
    if (!container) return;

    if (services.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.75rem;">--</span>';
        if (label) label.textContent = 'Services';
        return;
    }

    const dockerCount = Math.max(0, services.length - FIXED_SERVICES_COUNT);
    const servicesCount = Math.min(services.length, FIXED_SERVICES_COUNT);

    if (label) {
        label.innerHTML = `Docker (<span class="count-docker">${dockerCount}</span>) / Services (<span class="count-service">${servicesCount}</span>)`;
    }

    container.innerHTML = services.map((service, index) => {
        // Support both formats: object {name, running} or boolean
        const isObject = typeof service === 'object' && service !== null;
        const isRunning = isObject ? service.running : service;
        const name = isObject ? service.name : '';

        const type = index < FIXED_SERVICES_COUNT ? 'is-service' : 'is-docker';
        const status = isRunning ? 'running' : 'stopped';
        const tooltip = isAdmin && name ? ` title="${name}"` : '';
        return `<div class="service-dot ${type} ${status}"${tooltip}></div>`;
    }).join('');

    // Calculer et appliquer la disposition optimale au prochain frame
    requestAnimationFrame(() => {
        calculateOptimalLayout(container, services.length);
    });

    // Configurer le ResizeObserver pour recalculer lors du redimensionnement
    if (!serviceMatrixObserver) {
        serviceMatrixObserver = new ResizeObserver(() => {
            const dots = container.querySelectorAll('.service-dot');
            if (dots.length > 0) {
                calculateOptimalLayout(container, dots.length);
            }
        });
        serviceMatrixObserver.observe(container);
    }
}

export function updateMonitorTimestamp(timestamp) {
    const el = document.getElementById('monitor-updated');
    if (!el || !timestamp) return;

    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = `Maj: ${timeStr}`;
}

export function startMonitoring() {
    loadSystemStatus();
    // Polling every 30 seconds instead of 5 (6x less requests)
    setInterval(loadSystemStatus, MONITOR_REFRESH_INTERVAL);
}
