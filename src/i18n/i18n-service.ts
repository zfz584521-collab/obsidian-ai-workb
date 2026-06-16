/**
 * i18n Service - Singleton pattern for managing translations
 */

import { Translations, SupportedLanguage } from './types';
import { zhCN } from './lang/zh-CN';
import { en } from './lang/en';

/**
 * i18n Service - Singleton pattern for managing translations
 */
export class I18nService {
  private static instance: I18nService;
  private currentLanguage: SupportedLanguage = 'zh-CN';
  private translations: Translations;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.translations = zhCN;
  }

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /**
   * Set the current language
   */
  setLanguage(lang: SupportedLanguage | 'auto', obsidianLang?: string): void {
    let targetLang: SupportedLanguage;

    if (lang === 'auto') {
      // Follow Obsidian's language setting
      targetLang = this.getObsidianLanguage(obsidianLang);
    } else {
      targetLang = lang;
    }

    if (this.currentLanguage !== targetLang) {
      this.currentLanguage = targetLang;
      this.translations = this.loadTranslations(targetLang);
      this.notifyListeners();
    }
  }

  /**
   * Get current language code
   */
  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Get all translations
   */
  getTranslations(): Translations {
    return this.translations;
  }

  /**
   * Get a nested translation by key path
   * Supports dot notation: 'settings.apiConfig'
   */
  t(keyPath: string, params?: Record<string, string | number>): string {
    const keys = keyPath.split('.');
    let result: unknown = this.translations;

    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = (result as Record<string, unknown>)[key];
      } else {
        console.warn(`[i18n] Translation key not found: ${keyPath}`);
        return keyPath; // Return key path as fallback
      }
    }

    if (typeof result !== 'string') {
      console.warn(`[i18n] Translation value is not a string: ${keyPath}`);
      return keyPath;
    }

    // Replace parameters like {count}, {error}, etc.
    if (params) {
      return result.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : match;
      });
    }

    return result;
  }

  /**
   * Subscribe to language changes
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all subscribers of language change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Map Obsidian language to supported language
   */
  private getObsidianLanguage(obsidianLang?: string): SupportedLanguage {
    if (!obsidianLang) return 'zh-CN';

    // Obsidian uses language codes like 'zh', 'zh-CN', 'zh-TW', 'en', etc.
    const langMap: Record<string, SupportedLanguage> = {
      'zh': 'zh-CN',
      'zh-CN': 'zh-CN',
      'zh-TW': 'zh-CN', // Fallback to Simplified Chinese for now
      'en': 'en',
      'en-US': 'en',
      'en-GB': 'en',
    };

    return langMap[obsidianLang] || 'en';
  }

  /**
   * Get translations for a specific language
   */
  private loadTranslations(lang: SupportedLanguage): Translations {
    const translationsMap: Record<SupportedLanguage, Translations> = {
      'zh-CN': zhCN,
      'en': en,
    };

    return translationsMap[lang] || zhCN;
  }
}

// Export singleton instance
export const i18n = I18nService.getInstance();

// Export convenience function
export const t = i18n.t.bind(i18n);
