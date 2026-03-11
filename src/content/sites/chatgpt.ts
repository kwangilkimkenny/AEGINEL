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
  '#prompt-textarea',
  'div.ProseMirror[contenteditable="true"]',
  'textarea[data-id="root"]',
];

const SUBMIT_SELECTORS = [
  '[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send"]',
  'form button[type="submit"]',
];

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  getInputSelector() {
    return pickSelector(INPUT_SELECTORS, FALLBACK_INPUT_SELECTORS);
  },

  getSubmitSelector() {
    return pickSelector(SUBMIT_SELECTORS, FALLBACK_SUBMIT_SELECTORS);
  },

  getInputText(el: Element) {
    // ProseMirror may have <p> children; get innerText for proper newlines
    if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
      return el.innerText?.trim() ?? '';
    }
    return extractText(el);
  },

  getWarningAnchor() {
    return document.querySelector('form')
      ?? document.querySelector('[class*="composer"]')
      ?? document.querySelector('main');
  },

  matches(hostname: string) {
    return hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
  },

  // ── PII Proxy ───────────────────────────────────────────────────────
  getResponseSelector() {
    // Multiple selectors for different ChatGPT versions
    return '.markdown.prose, [data-message-author-role="assistant"] .markdown, div.agent-turn .markdown';
  },

  setInputText(el: Element, text: string) {
    setText(el, text);
  },

  isStreaming() {
    return document.querySelector('.result-streaming') !== null
      || document.querySelector('[data-testid="stop-button"]') !== null;
  },

  getUserMessageSelector() {
    return [
      '[data-message-author-role="user"]',
      '.user-turn',
      '[data-testid="conversation-turn-user"]',
    ].join(', ');
  },
};
