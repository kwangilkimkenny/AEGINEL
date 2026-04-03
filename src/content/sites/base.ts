// ── SiteAdapter Interface ────────────────────────────────────────────────

export interface SiteAdapter {
  /** Site identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** CSS selector for the main text input area */
  getInputSelector(): string;
  /** CSS selector for the submit/send button */
  getSubmitSelector(): string;
  /** Extract current input text from the DOM element */
  getInputText(el: Element): string;
  /** Where to anchor the warning banner (returns a parent element) */
  getWarningAnchor(): Element | null;
  /** Check if this adapter matches the current page */
  matches(hostname: string): boolean;

  // ── PII Proxy additions ─────────────────────────────────────────────
  /** CSS selector for LLM response containers */
  getResponseSelector(): string;
  /** Set text into the input element (for replacing with pseudonymized text) */
  setInputText(el: Element, text: string): void;
  /** Check if the LLM is currently streaming a response */
  isStreaming(): boolean;
  /** Optional: CSS selector for user message containers (for restoration) */
  getUserMessageSelector?(): string;
}

/**
 * innerText on contenteditable with <p> elements produces extra \n at
 * block boundaries. Collapse runs of 3+ newlines down to \n\n so a
 * single visual blank line stays a single blank line in our text.
 */
export function normalizeInnerText(raw: string): string {
  return raw.trim().replace(/\n{3,}/g, '\n\n');
}

export function getInputText(el: Element): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  // contenteditable divs (Claude, Gemini)
  return el.textContent?.trim() ?? '';
}

export function setInputText(el: Element, text: string): void {
  // ── Textarea / Input ──
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // ── Contenteditable editors ──
  const htmlEl = el as HTMLElement;
  htmlEl.focus();
  const selection = window.getSelection();
  const isProseMirror = !!htmlEl.closest('.ProseMirror');

  // ── Strategy A: Atomic selectAll + insertText ──
  // Uses browser-native selectAll (not Range API) so the editor framework
  // recognises the selection. insertText then replaces it atomically and
  // fires a trusted input event that updates React/Slate/etc. state.
  if (!isProseMirror || !text.includes('\n')) {
    document.execCommand('selectAll', false);
    if (document.execCommand('insertText', false, text)) {
      const actual = (htmlEl.innerText || htmlEl.textContent || '').trim();
      if (actual.length <= text.trim().length * 1.5) {
        dispatchChangeEvents(htmlEl, text);
        return;
      }
      // Content grew → insertText appended. Undo and fall through.
      document.execCommand('undo', false);
    }
  }

  // ── Strategy B: ProseMirror line-by-line (delete + insertParagraph) ──
  if (isProseMirror) {
    selectAllContent(htmlEl, selection);
    document.execCommand('delete', false);

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        document.execCommand('insertText', false, lines[i]);
      }
      if (i < lines.length - 1) {
        document.execCommand('insertParagraph', false);
      }
    }
    dispatchChangeEvents(htmlEl, text);
    return;
  }

  // ── Strategy C: Direct DOM replacement + React fiber state sync ──
  while (htmlEl.firstChild) htmlEl.removeChild(htmlEl.firstChild);

  const frag = document.createDocumentFragment();
  if (text.includes('\n')) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) frag.appendChild(document.createElement('br'));
      frag.appendChild(document.createTextNode(lines[i]));
    }
  } else {
    frag.appendChild(document.createTextNode(text));
  }
  htmlEl.appendChild(frag);

  if (selection) {
    const r = document.createRange();
    r.selectNodeContents(htmlEl);
    r.collapse(false);
    selection.removeAllRanges();
    selection.addRange(r);
  }

  dispatchChangeEvents(htmlEl, text);
}

function selectAllContent(el: HTMLElement, selection: Selection | null): void {
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}

function dispatchChangeEvents(el: HTMLElement, text: string): void {
  el.dispatchEvent(new InputEvent('input', {
    bubbles: true, cancelable: false, inputType: 'insertText', data: text,
  }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
