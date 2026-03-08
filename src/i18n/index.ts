// ── AEGINEL i18n Engine ────────────────────────────────────────────────────
// Lightweight i18n with no external dependencies.
// Usage: t('settings.title') → "설정" or "Settings"

import en from './en.json';
import ko from './ko.json';
import es from './es.json';
import pt from './pt.json';
import fr from './fr.json';
import de from './de.json';
import ja from './ja.json';
import zh from './zh.json';
import it from './it.json';
import nl from './nl.json';
import ru from './ru.json';
import ar from './ar.json';
import tr from './tr.json';
import pl from './pl.json';
import vi from './vi.json';
import id from './id.json';
import th from './th.json';
import hi from './hi.json';
import sv from './sv.json';
import cs from './cs.json';

// ── Language Registry ───────────────────────────────────────────────────

export type SupportedLocale =
  | 'en' | 'es' | 'pt' | 'fr' | 'de'
  | 'ja' | 'ko' | 'zh' | 'it' | 'nl'
  | 'ru' | 'ar' | 'tr' | 'pl' | 'vi'
  | 'id' | 'th' | 'hi' | 'sv' | 'cs';

type TranslationMap = Record<string, unknown>;

const locales: Record<SupportedLocale, TranslationMap> = {
  en, ko, es, pt, fr, de, ja, zh, it, nl,
  ru, ar, tr, pl, vi, id, th, hi, sv, cs,
};

/** Display names for language selector */
export const LANGUAGE_OPTIONS: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'th', label: 'ไทย' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'sv', label: 'Svenska' },
  { code: 'cs', label: 'Čeština' },
];

// ── Current Language State ──────────────────────────────────────────────

let currentLocale: SupportedLocale = 'en';

/** Detect browser language and map to supported locale */
export function detectLocale(): SupportedLocale {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  const lang = nav.split('-')[0].toLowerCase();
  if (lang in locales) return lang as SupportedLocale;
  // Fallback mappings
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('pt')) return 'pt';
  return 'en';
}

/** Set the active locale */
export function setLocale(locale: string): void {
  if (locale === 'auto') {
    currentLocale = detectLocale();
  } else if (locale in locales) {
    currentLocale = locale as SupportedLocale;
  } else {
    currentLocale = 'en';
  }
}

/** Get the active locale */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

// ── Translation Function ────────────────────────────────────────────────

/**
 * Get a translated string by dot-separated key path.
 *
 * @param key - Dot-separated path, e.g. 'settings.title'
 * @param params - Optional interpolation, e.g. { count: 3 }
 * @returns Translated string, or key if not found
 *
 * @example
 *   t('guard')              // → "AEGINEL Guard" or "AEGINEL 가드"
 *   t('settings.title')     // → "Settings" or "설정"
 *   t('proxy.protected', { count: 3 })  // → "3개의 개인정보가 보호되었습니다"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const value = resolve(locales[currentLocale], key)
    ?? resolve(locales.en, key)  // fallback to English
    ?? key;                       // fallback to key itself

  if (typeof value !== 'string') return key;

  if (!params) return value;

  // Interpolate {{param}} placeholders
  return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{{${k}}}`
  );
}

/** Resolve a dot-separated key path in a nested object */
function resolve(obj: TranslationMap | undefined, key: string): unknown {
  if (!obj) return undefined;
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Initialize with English as default
setLocale('en');
