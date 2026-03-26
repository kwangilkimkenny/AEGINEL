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
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    // Use native setter to trigger React/framework change detection
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

  // ── Contenteditable / ProseMirror editors ──
  // Direct textContent manipulation bypasses ProseMirror's internal state.
  // We must go through the browser's editing pipeline so the framework
  // picks up the change and sends the updated text on submit.

  const htmlEl = el as HTMLElement;
  htmlEl.focus();

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(htmlEl);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // For multiline text, use insertParagraph to create proper <p> elements.
  // insertText with \n creates <br> which ProseMirror renders with extra spacing.
  if (text.includes('\n')) {
    document.execCommand('delete', false);

    // innerText may produce \n\n between <p> elements with CSS margins;
    // collapse to single \n since each represents one paragraph boundary.
    const lines = text.split('\n');
    let anyInserted = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        anyInserted = document.execCommand('insertText', false, lines[i]) || anyInserted;
      }
      if (i < lines.length - 1) {
        document.execCommand('insertParagraph', false);
      }
    }

    if (!anyInserted) {
      htmlEl.textContent = text;
      htmlEl.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: false, inputType: 'insertText', data: text,
      }));
    }

    htmlEl.dispatchEvent(new Event('input', { bubbles: true }));
    htmlEl.dispatchEvent(new Event('change', { bubbles: true }));
    htmlEl.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: text,
    }));
    return;
  }

  const inserted = document.execCommand('insertText', false, text);

  if (!inserted) {
    if (selection) {
      selection.deleteFromDocument();
    }
    htmlEl.textContent = '';
    const textNode = document.createTextNode(text);
    htmlEl.appendChild(textNode);

    if (selection) {
      const newRange = document.createRange();
      newRange.selectNodeContents(htmlEl);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    htmlEl.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
      data: text,
    }));
  }

  htmlEl.dispatchEvent(new Event('input', { bubbles: true }));
  htmlEl.dispatchEvent(new Event('change', { bubbles: true }));
  htmlEl.dispatchEvent(new CompositionEvent('compositionend', {
    bubbles: true,
    data: text,
  }));
}
