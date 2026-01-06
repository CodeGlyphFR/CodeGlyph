// Theme switcher (light/dark/auto)

export function initTheme() {
    const root = document.documentElement;
    const buttons = document.querySelectorAll('.theme-btn');
    const saved = localStorage.getItem('theme') || 'auto';

    function setTheme(theme) {
        root.className = root.className.replace(/\b(light|dark|auto)\b/g, '').trim();
        root.classList.add(theme);
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        localStorage.setItem('theme', theme);
    }

    setTheme(saved);
    buttons.forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
}
