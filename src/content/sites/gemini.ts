import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText } from './base';

export const geminiAdapter: SiteAdapter = {
  id: 'gemini',
  name: 'Gemini',

  getInputSelector() {
    // Gemini uses Quill or custom contenteditable
    return [
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="prompt"]',
      'div[contenteditable="true"][aria-label*="Enter"]',
      'rich-textarea div[contenteditable="true"]',
    ].join(', ');
  },

  getSubmitSelector() {
    return [
      'button[aria-label="Send message"]',
      'button.send-button',
      'button[aria-label="Submit"]',
      'mat-icon-button[aria-label*="Send"]',
    ].join(', ');
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
