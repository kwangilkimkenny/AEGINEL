import type { SiteAdapter } from './base';
import { getInputText as extractText, setInputText as setText } from './base';

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',
  name: 'ChatGPT',

  getInputSelector() {
    // ChatGPT uses ProseMirror contenteditable div with id #prompt-textarea
    // Fallback selectors for older versions using textarea
    return '#prompt-textarea, div.ProseMirror[contenteditable="true"], textarea[data-id="root"]';
  },

  getSubmitSelector() {
    // Multiple fallback selectors for send button
    return [
      '[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send"]',
      'form button[type="submit"]',
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
};
