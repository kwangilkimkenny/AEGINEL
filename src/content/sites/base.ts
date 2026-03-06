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

  // Step 1: Select all existing content
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(htmlEl);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Step 2: Try execCommand('insertText') — goes through the editor's input pipeline
  const inserted = document.execCommand('insertText', false, text);

  if (!inserted) {
    // Fallback: use InputEvent which ProseMirror also listens to
    if (selection) {
      selection.deleteFromDocument();
    }
    // Clear and set via DOM, then fire proper InputEvent
    htmlEl.textContent = '';
    const textNode = document.createTextNode(text);
    htmlEl.appendChild(textNode);

    // Select the inserted text to update cursor position
    if (selection) {
      const newRange = document.createRange();
      newRange.selectNodeContents(htmlEl);
      newRange.collapse(false); // collapse to end
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    // Fire InputEvent with proper inputType so frameworks detect the change
    htmlEl.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
      data: text,
    }));
  }

  // Step 3: Additional events that React/Next.js/ProseMirror may listen to
  htmlEl.dispatchEvent(new Event('input', { bubbles: true }));
  htmlEl.dispatchEvent(new Event('change', { bubbles: true }));

  // Step 4: Trigger compositionend for CJK input method editors
  htmlEl.dispatchEvent(new CompositionEvent('compositionend', {
    bubbles: true,
    data: text,
  }));
}
