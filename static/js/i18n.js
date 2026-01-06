/**
 * CodeGlyph i18n Module
 * Lightweight internationalization for vanilla JS
 */
const I18n = {
    currentLang: 'fr',
    translations: {},
    loaded: false,

    /**
     * Initialize i18n system
     */
    async init() {
        this.currentLang = localStorage.getItem('language') || 'fr';
        await this.loadTranslations(this.currentLang);
        this.updateDOM();
        this.updateLangButtons();
        this.loaded = true;
    },

    /**
     * Load translations from JSON file
     */
    async loadTranslations(lang) {
        try {
            const response = await fetch(`/i18n/${lang}.json?v=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.translations = await response.json();
        } catch (error) {
            console.error(`Failed to load translations for ${lang}:`, error);
            // Fallback to French if loading fails
            if (lang !== 'fr') {
                console.log('Falling back to French...');
                await this.loadTranslations('fr');
            }
        }
    },

    /**
     * Get translation by key with optional parameters
     * @param {string} key - Dot notation key (e.g., "header.themeLight")
     * @param {object} params - Parameters to replace in the string (e.g., {count: 5})
     * @returns {string|array} - Translated string or array
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) {
                console.warn(`Missing translation: ${key}`);
                return key;
            }
        }

        // If it's an array, return as-is
        if (Array.isArray(value)) {
            return value;
        }

        // Replace placeholders: {name} -> value
        if (typeof value === 'string') {
            return value.replace(/\{(\w+)\}/g, (_, name) => {
                return params[name] !== undefined ? params[name] : `{${name}}`;
            });
        }

        return value;
    },

    /**
     * Update all DOM elements with data-i18n attributes
     */
    updateDOM() {
        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = this.t(key);
            if (typeof translated === 'string') {
                el.textContent = translated;
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translated = this.t(key);
            if (typeof translated === 'string') {
                el.placeholder = translated;
            }
        });

        // Update titles (tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translated = this.t(key);
            if (typeof translated === 'string') {
                el.title = translated;
            }
        });

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLang;
    },

    /**
     * Update language button states
     */
    updateLangButtons() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
        });
    },

    /**
     * Change language
     * @param {string} lang - Language code ('fr' or 'en')
     */
    async setLanguage(lang) {
        if (lang === this.currentLang) return;

        localStorage.setItem('language', lang);
        this.currentLang = lang;
        await this.loadTranslations(lang);
        this.updateDOM();
        this.updateLangButtons();

        // Dispatch event for dynamic content updates
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    },

    /**
     * Get localized text from a bilingual object
     * Used for card descriptions that have {fr: "...", en: "..."} structure
     * @param {object} obj - Object containing the field
     * @param {string} field - Field name to get
     * @returns {string} - Localized text
     */
    getLocalizedText(obj, field) {
        if (!obj) return '';
        const value = obj[field];

        // If value is a bilingual object
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return value[this.currentLang] || value.fr || value.en || '';
        }

        // Legacy string format
        return value || '';
    },

    /**
     * Get current language
     * @returns {string} - Current language code
     */
    getLang() {
        return this.currentLang;
    }
};

// Initialize language button handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Handle language button clicks
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            I18n.setLanguage(btn.dataset.lang);
        });
    });
});
