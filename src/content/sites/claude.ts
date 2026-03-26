import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText, normalizeInnerText } from './base';
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
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"].is-editor-empty',
  'div[contenteditable="true"][data-placeholder]',
  'fieldset div[contenteditable="true"]',
];

const SUBMIT_SELECTORS = [
  'button[aria-label="Send Message"]',
  'button[aria-label="Send message"]',
  'button[aria-label="Send"]',
  'fieldset button[type="button"]:last-of-type',
];

export const claudeAdapter: SiteAdapter = {
  id: 'claude',
  name: 'Claude',

  getInputSelector() {
    return pickSelector(INPUT_SELECTORS, FALLBACK_INPUT_SELECTORS);
  },

  getSubmitSelector() {
    return pickSelector(SUBMIT_SELECTORS, FALLBACK_SUBMIT_SELECTORS);
  },

  getInputText(el: Element) {
    // ProseMirror may have <p> children; get innerText for proper newlines
    if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
      return normalizeInnerText(el.innerText ?? '');
    }
    return extractText(el);
  },

  getWarningAnchor() {
    return document.querySelector('[class*="composer"]')
      ?? document.querySelector('fieldset')
      ?? document.querySelector('main');
  },

  matches(hostname: string) {
    return hostname === 'claude.ai';
  },

  // ── PII Proxy ───────────────────────────────────────────────────────
  getResponseSelector() {
    // Claude response containers — multiple fallback selectors
    return [
      'div.font-claude-message',
      '[data-is-streaming] .font-claude-message',
      'div[class*="claude-message"]',
      '[data-testid="chat-message-content"]',
    ].join(', ');
  },

  setInputText(el: Element, text: string) {
    setText(el, text);
  },

  isStreaming() {
    return document.querySelector('[data-is-streaming="true"]') !== null;
  },

  getUserMessageSelector() {
    return [
      'div.font-user-message',
      '[data-testid="user-message"]',
      '.human-turn',
    ].join(', ');
  },
};
