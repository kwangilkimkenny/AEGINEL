import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText } from './base';
import { FALLBACK_INPUT_SELECTORS, FALLBACK_SUBMIT_SELECTORS } from './registry';

/** Try selectors in order, return first that matches an element in the DOM. */
function pickSelector(primary: string[], fallback: string[]): string {
  for (const sel of primary) {
    try { if (document.querySelector(sel)) return sel; } catch { /* skip */ }
  }
  for (const sel of fallback) {
    try { if (document.querySelector(sel)) return sel; } catch { /* skip */ }
  }
  return primary.join(', ');
}

const INPUT_SELECTORS = [
  '.ql-editor[contenteditable="true"]',
  'div[contenteditable="true"][aria-label*="prompt"]',
  'div[contenteditable="true"][aria-label*="Enter"]',
  'rich-textarea div[contenteditable="true"]',
];

const SUBMIT_SELECTORS = [
  'button[aria-label="Send message"]',
  'button.send-button',
  'button[aria-label="Submit"]',
  'mat-icon-button[aria-label*="Send"]',
];

export const geminiAdapter: SiteAdapter = {
  id: 'gemini',
  name: 'Gemini',

  getInputSelector() {
    return pickSelector(INPUT_SELECTORS, FALLBACK_INPUT_SELECTORS);
  },

  getSubmitSelector() {
    return pickSelector(SUBMIT_SELECTORS, FALLBACK_SUBMIT_SELECTORS);
  },

  getInputText(el: Element) {
    if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
      return el.innerText?.trim() ?? '';
    }
    return extractText(el);
  },

  getWarningAnchor() {
    return document.querySelector('.input-area')
      ?? document.querySelector('rich-textarea')
      ?? document.querySelector('main');
  },

  matches(hostname: string) {
    return hostname === 'gemini.google.com';
  },

  // ── PII Proxy ───────────────────────────────────────────────────────
  getResponseSelector() {
    return [
      '.model-response-text',
      'message-content .markdown',
      '.response-container .markdown',
    ].join(', ');
  },

  setInputText(el: Element, text: string) {
    setText(el, text);
  },

  isStreaming() {
    return document.querySelector('.streaming') !== null
      || document.querySelector('[data-is-streaming]') !== null;
  },
};
