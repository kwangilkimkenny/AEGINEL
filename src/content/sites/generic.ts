// ── Generic Site Adapter ──────────────────────────────────────────────────
// Configuration-driven adapter that works with any AI service defined
// in the site registry. Eliminates the need for per-site adapter files
// for services that follow standard input/output patterns.
//
// When site-specific selectors all fail, universal ARIA/role-based
// fallback selectors are tried automatically.

import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText, normalizeInnerText } from './base';
import type { SiteConfig } from './registry';
import {
  FALLBACK_INPUT_SELECTORS,
  FALLBACK_SUBMIT_SELECTORS,
  FALLBACK_RESPONSE_SELECTORS,
} from './registry';

/**
 * Try each selector in order, return the first one that actually matches
 * an element in the DOM. If none match, return them all joined as a
 * comma-separated list (the caller's querySelectorAll will simply get 0 hits).
 */
function resolveSelector(primary: string[], fallback: string[]): string {
  // Try primary selectors first
  for (const sel of primary) {
    try {
      if (document.querySelector(sel)) return sel;
    } catch { /* invalid selector, skip */ }
  }
  // Try fallback selectors
  for (const sel of fallback) {
    try {
      if (document.querySelector(sel)) return sel;
    } catch { /* invalid selector, skip */ }
  }
  // Nothing matched — return all primaries so downstream code can
  // still try (the DOM might change later via SPA navigation)
  return primary.join(', ');
}

export function createGenericAdapter(config: SiteConfig): SiteAdapter {
  return {
    id: config.id,
    name: config.name,

    getInputSelector() {
      return resolveSelector(config.inputSelectors, FALLBACK_INPUT_SELECTORS);
    },

    getSubmitSelector() {
      return resolveSelector(config.submitSelectors, FALLBACK_SUBMIT_SELECTORS);
    },

    getInputText(el: Element) {
      if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
        return normalizeInnerText(el.innerText ?? '');
      }
      return extractText(el);
    },

    getWarningAnchor() {
      for (const selector of config.warningAnchorSelectors) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
      return document.querySelector('main') ?? document.body;
    },

    matches(hostname: string) {
      const matched = config.hostnames.includes(hostname);
      if (!matched) return false;

      // If pathPrefix is specified, also check the pathname
      if (config.pathPrefix) {
        return window.location.pathname.startsWith(config.pathPrefix);
      }
      return true;
    },

    getResponseSelector() {
      return resolveSelector(config.responseSelectors, FALLBACK_RESPONSE_SELECTORS);
    },

    setInputText(el: Element, text: string) {
      setText(el, text);
    },

    isStreaming() {
      return config.streamingSelectors.some(
        selector => {
          try {
            return document.querySelector(selector) !== null;
          } catch {
            return false;
          }
        },
      );
    },
  };
}
