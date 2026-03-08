// ── Generic Site Adapter ──────────────────────────────────────────────────
// Configuration-driven adapter that works with any AI service defined
// in the site registry. Eliminates the need for per-site adapter files
// for services that follow standard input/output patterns.

import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText } from './base';
import type { SiteConfig } from './registry';

export function createGenericAdapter(config: SiteConfig): SiteAdapter {
  return {
    id: config.id,
    name: config.name,

    getInputSelector() {
      return config.inputSelectors.join(', ');
    },

    getSubmitSelector() {
      return config.submitSelectors.join(', ');
    },

    getInputText(el: Element) {
      if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
        return el.innerText?.trim() ?? '';
      }
      return extractText(el);
    },

    getWarningAnchor() {
      for (const selector of config.warningAnchorSelectors) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
      return document.querySelector('main');
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
      return config.responseSelectors.join(', ');
    },

    setInputText(el: Element, text: string) {
      setText(el, text);
    },

    isStreaming() {
      return config.streamingSelectors.some(
        selector => document.querySelector(selector) !== null,
      );
    },
  };
}
