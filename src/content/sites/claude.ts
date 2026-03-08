import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText } from './base';

export const claudeAdapter: SiteAdapter = {
  id: 'claude',
  name: 'Claude',

  getInputSelector() {
    // Claude uses ProseMirror contenteditable div
    return [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"].is-editor-empty',
      'div[contenteditable="true"][data-placeholder]',
      'fieldset div[contenteditable="true"]',
    ].join(', ');
  },

  getSubmitSelector() {
    return [
      'button[aria-label="Send Message"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      'fieldset button[type="button"]:last-of-type',
    ].join(', ');
  },

  getInputText(el: Element) {
    // ProseMirror may have <p> children; get innerText for proper newlines
    if (el instanceof HTMLElement && el.getAttribute('contenteditable') === 'true') {
      return el.innerText?.trim() ?? '';
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
};
