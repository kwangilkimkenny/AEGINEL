// ── AEGINEL Content Script ─────────────────────────────────────────────────
// Detects which LLM site we're on, watches input, sends to service worker.

import type { SiteAdapter } from './sites/base';
import { chatgptAdapter } from './sites/chatgpt';
import { claudeAdapter } from './sites/claude';
import { geminiAdapter } from './sites/gemini';
import { createGenericAdapter } from './sites/generic';
import { siteRegistry } from './sites/registry';
import { showWarningBanner, hideWarningBanner, showBlockModal, showProtectedBanner, showProxyConfirmModal, showHealthBanner, hideHealthBanner } from './overlay/warning-banner';
import type { ScanResult, AeginelConfig, ProxyResult } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/types';
import { DEBOUNCE_MS, INPUT_MIN_LENGTH } from '../shared/constants';
import { setLocale } from '../i18n';
import { sendMessage } from './messaging';

// ── Site Detection ───────────────────────────────────────────────────────
// Priority: hand-tuned adapters first, then generic registry-based adapters

const adapters: SiteAdapter[] = [
  chatgptAdapter,
  claudeAdapter,
  geminiAdapter,
  ...siteRegistry.map(createGenericAdapter),
];

function detectSite(): SiteAdapter | null {
  const hostname = window.location.hostname;
  return adapters.find(a => a.matches(hostname)) ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────────

const adapter = detectSite();
if (adapter) {
  initContentScript(adapter);
}

function initContentScript(adapter: SiteAdapter) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastScannedText = '';
  let currentResult: ScanResult | null = null;
  let currentConfig: AeginelConfig = DEFAULT_CONFIG;
  const sessionId = `${adapter.id}_${Date.now()}`;

  // Track attached elements to prevent duplicate listeners
  const attachedInputs = new WeakSet<Element>();
  const attachedSubmitBtns = new WeakSet<Element>();
  const attachedKeydownInputs = new WeakSet<Element>();

  // Guard against recursive submit during re-fire
  let isResubmitting = false;

  // Track consecutive health-check failures to avoid spamming banners
  let consecutiveHealthFailures = 0;
  let healthBannerShown = false;

  // ── Health Check: validate adapter selectors ────────────────────────
  function checkAdapterHealth() {
    const selectors: Record<string, string> = {
      input: adapter.getInputSelector(),
      submit: adapter.getSubmitSelector(),
      response: adapter.getResponseSelector(),
    };

    const brokenSelectors: string[] = [];
    for (const [name, selector] of Object.entries(selectors)) {
      try {
        const el = document.querySelector(selector);
        if (!el) {
          brokenSelectors.push(name);
        }
      } catch {
        // Invalid selector syntax
        brokenSelectors.push(name);
      }
    }

    const status = brokenSelectors.length === 0 ? 'ok'
      : brokenSelectors.includes('input') ? 'error'
      : 'degraded';

    // Visual notification logic
    if (status === 'ok') {
      consecutiveHealthFailures = 0;
      if (healthBannerShown) {
        hideHealthBanner();
        healthBannerShown = false;
      }
    } else {
      consecutiveHealthFailures++;
      // Show banner only after 2 consecutive failures (avoids transient SPA issues)
      if (consecutiveHealthFailures >= 2 && !healthBannerShown) {
        showHealthBanner(status as 'degraded' | 'error', brokenSelectors);
        healthBannerShown = true;
      }
    }

    reportHealth(status, brokenSelectors);
  }

  function reportHealth(
    status: 'ok' | 'degraded' | 'error',
    brokenSelectors: string[],
  ) {
    sendMessage({
      type: 'HEALTH_REPORT',
      payload: {
        source: `content-${adapter.id}`,
        status,
        details: brokenSelectors.length > 0
          ? `Broken selectors: ${brokenSelectors.join(', ')}`
          : undefined,
        brokenSelectors: brokenSelectors.length > 0 ? brokenSelectors : undefined,
        timestamp: Date.now(),
      },
    });
  }

  // Load config (with retry)
  sendMessage<{ payload?: AeginelConfig }>({ type: 'GET_CONFIG' }).then((res) => {
    if (res?.payload) {
      currentConfig = res.payload;
      setLocale(res.payload.language);
    }
  });

  // Watch for input changes
  function onInputChange(el: Element) {
    const text = adapter.getInputText(el);
    if (text === lastScannedText || text.length < INPUT_MIN_LENGTH) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      lastScannedText = text;
      scanInput(text);
    }, DEBOUNCE_MS);
  }

  // Send to service worker for scanning (with retry)
  async function scanInput(input: string) {
    const response = await sendMessage<{ type?: string; payload?: ScanResult }>({
      type: 'SCAN_INPUT',
      payload: { input, site: adapter.name },
    });

    if (response?.type === 'SCAN_RESULT' && response.payload) {
      currentResult = response.payload;
      handleScanResult(response.payload);
    }
  }

  // Handle scan result — show/hide warning
  function handleScanResult(result: ScanResult) {
    if (result.score === 0 && result.piiDetected.length === 0) {
      hideWarningBanner();
      return;
    }

    const anchor = adapter.getWarningAnchor();
    if (anchor) {
      showWarningBanner(result, anchor);
    }
  }

  // ── PII Proxy: Quick check if text likely has PII ───────────────────
  // Fast heuristic to avoid unnecessary submit interception
  function textMayContainPii(text: string): boolean {
    // Quick checks for common PII patterns
    // 6+ consecutive digits (RRN, card, phone, SSN)
    if (/\d{6,}/.test(text)) return true;
    // Digit groups with dashes (RRN, SSN, phone)
    if (/\d{2,4}[-–.]\d{2,4}/.test(text)) return true;
    // Email pattern
    if (/@[a-zA-Z0-9]/.test(text)) return true;
    // + prefix for international phone
    if (/\+\d{1,3}/.test(text)) return true;
    // Passport-like: letter(s) + 7+ digits
    if (/[A-Z]{1,2}\d{7}/.test(text)) return true;
    return false;
  }

  // ── PII Proxy: Pseudonymize before submit ─────────────────────────────

  async function proxyAndSubmit(inputEl: Element, originalText: string): Promise<boolean> {
    const response = await sendMessage<ProxyResult>({
      type: 'PROXY_INPUT',
      payload: { text: originalText, site: adapter.id, sessionId },
    });

    if (!response || response.piiCount === 0) {
      // No PII found, proceed normally
      return false;
    }

    const proxyResult: ProxyResult = response;
    const anchor = adapter.getWarningAnchor();

    if (currentConfig.piiProxy.mode === 'confirm' && anchor) {
      // Show confirmation modal
      return new Promise<boolean>((resolve) => {
        showProxyConfirmModal(proxyResult, anchor,
          () => {
            // User confirmed — replace text and submit
            adapter.setInputText(inputEl, proxyResult.proxiedText);
            if (currentConfig.piiProxy.showNotification && anchor) {
              showProtectedBanner(proxyResult.piiCount, anchor);
            }
            resolve(true);
          },
          () => {
            // User skipped — send original
            resolve(false);
          },
        );
      });
    }

    // Auto mode — silently replace
    adapter.setInputText(inputEl, proxyResult.proxiedText);
    if (currentConfig.piiProxy.showNotification && anchor) {
      showProtectedBanner(proxyResult.piiCount, anchor);
    }
    return true;
  }

  // ── Core submit handler (shared between click and Enter key) ────────
  // NOTE: This function must call e.preventDefault() synchronously before
  // any await, because the browser processes the default action at the end
  // of the current microtask. The "should intercept" checks are all
  // synchronous and placed before the first await.

  async function handleSubmitAttempt(e: Event) {
    // Skip if we're in the middle of a programmatic re-submit
    if (isResubmitting) return;

    // Check if blocked by threat detection (synchronous)
    if (currentResult?.blocked) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const anchor = adapter.getWarningAnchor();
      if (anchor) {
        showBlockModal(currentResult, anchor, () => {
          // User chose to override — allow submission
          currentResult = { ...currentResult!, blocked: false };
          triggerSubmit();
        });
      }
      return;
    }

    // PII Proxy: check if enabled (synchronous)
    if (!currentConfig.piiProxy.enabled) return;

    // Find input element and get text (synchronous)
    const inputEl = document.querySelector(adapter.getInputSelector());
    if (!inputEl) return;

    const text = adapter.getInputText(inputEl);
    if (text.length < INPUT_MIN_LENGTH) return;

    // Quick heuristic: skip interception if text unlikely to contain PII (synchronous)
    if (!textMayContainPii(text)) return;

    // All synchronous checks passed — prevent default NOW before any async work
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    try {
      const proxied = await proxyAndSubmit(inputEl, text);

      // Allow a small delay for the editor to sync after text replacement
      if (proxied) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch {
      // If proxy fails, still re-submit with original text
    }

    // Re-trigger submit
    triggerSubmit();
  }

  // ── Trigger submit programmatically ─────────────────────────────────

  function triggerSubmit() {
    isResubmitting = true;

    const btn = document.querySelector(adapter.getSubmitSelector());
    if (btn instanceof HTMLElement) {
      btn.click();
    } else {
      // Fallback: simulate Enter key on input
      const inputEl = document.querySelector(adapter.getInputSelector());
      if (inputEl instanceof HTMLElement) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }));
      }
    }

    // Reset guard after a tick
    setTimeout(() => {
      isResubmitting = false;
    }, 200);
  }

  // ── Intercept button click ──────────────────────────────────────────

  function interceptSubmitClick(e: Event) {
    handleSubmitAttempt(e);
  }

  // ── Intercept Enter key submission ──────────────────────────────────

  function interceptKeydown(e: Event) {
    if (!(e instanceof KeyboardEvent)) return;
    if (e.key !== 'Enter') return;

    // Shift+Enter = newline (not submit) on all platforms
    if (e.shiftKey) return;

    // On ChatGPT/Claude: Enter alone submits
    // On Gemini: Enter alone submits
    // Composition events (CJK IME) should not trigger submit
    if (e.isComposing) return;

    handleSubmitAttempt(e);
  }

  // ── Response Watching (restore pseudonyms) ────────────────────────────

  function watchResponses() {
    const responseSelector = adapter.getResponseSelector();
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    const restoredElements = new WeakSet<Element>();

    const responseObserver = new MutationObserver(() => {
      // Debounce: wait for streaming to complete
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(async () => {
        if (adapter.isStreaming()) return; // still streaming, wait

        // Find all response elements and restore pseudonyms
        const responseEls = document.querySelectorAll(responseSelector);
        if (responseEls.length === 0) return;

        // Get the last (newest) response
        const lastResponse = responseEls[responseEls.length - 1];
        if (restoredElements.has(lastResponse)) return;

        await restoreInDom(lastResponse);
        restoredElements.add(lastResponse);
      }, 500);
    });

    // Observe the main content area for response additions
    const main = document.querySelector('main') ?? document.body;
    responseObserver.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  async function restoreInDom(container: Element) {
    // Walk text nodes and replace pseudonyms with originals
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (!node.textContent) continue;
      const restored = await sendMessage<{ restoredText?: string }>({
        type: 'RESTORE_RESPONSE',
        payload: { text: node.textContent, sessionId },
      });
      if (restored?.restoredText && restored.restoredText !== node.textContent) {
        node.textContent = restored.restoredText;
      }
    }
  }

  // Attach listeners to input elements (with dedup)
  function attachToInput(el: Element) {
    if (attachedInputs.has(el)) return;
    attachedInputs.add(el);

    el.addEventListener('input', () => onInputChange(el));
    el.addEventListener('keyup', () => onInputChange(el));
  }

  // Attach Enter key interception on input elements (with dedup)
  function attachKeydownInterception(el: Element) {
    if (attachedKeydownInputs.has(el)) return;
    attachedKeydownInputs.add(el);

    el.addEventListener('keydown', interceptKeydown, true);
  }

  // Attach submit interception on button (with dedup)
  function attachSubmitInterception() {
    const selector = adapter.getSubmitSelector();
    const btn = document.querySelector(selector);
    if (btn && !attachedSubmitBtns.has(btn)) {
      attachedSubmitBtns.add(btn);
      btn.addEventListener('click', interceptSubmitClick, true);
    }
  }

  // Scan existing elements and attach listeners
  function scanExistingElements() {
    const selector = adapter.getInputSelector();
    document.querySelectorAll(selector).forEach((el) => {
      attachToInput(el);
      attachKeydownInterception(el);
    });
    attachSubmitInterception();
  }

  // MutationObserver for SPA navigation — debounced
  let spaTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (spaTimer) clearTimeout(spaTimer);
    spaTimer = setTimeout(() => {
      scanExistingElements();
    }, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial attach
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanExistingElements();
      watchResponses();
      // Run initial health check after a short delay to let the page render
      setTimeout(checkAdapterHealth, 2000);
    });
  } else {
    scanExistingElements();
    watchResponses();
    // Run initial health check after a short delay to let the page render
    setTimeout(checkAdapterHealth, 2000);
  }

  // Periodic health check every 5 minutes to detect site layout changes
  setInterval(checkAdapterHealth, 5 * 60 * 1000);
}
