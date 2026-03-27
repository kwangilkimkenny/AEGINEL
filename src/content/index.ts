// ── Aegis Personal Content Script ─────────────────────────────────────────────────
// Detects which LLM site we're on, watches input, sends to service worker.

import type { SiteAdapter } from './sites/base';
import { chatgptAdapter } from './sites/chatgpt';
import { claudeAdapter } from './sites/claude';
import { geminiAdapter } from './sites/gemini';
import { createGenericAdapter } from './sites/generic';
import { siteRegistry } from './sites/registry';
import { showWarningBanner, hideWarningBanner, showBlockModal, showProtectedBanner, showProxyConfirmModal, showHealthBanner, hideHealthBanner, showShieldIndicator, hideShieldIndicator, isShieldVisible, showDisconnectedBanner, updateShieldTooltip, updateShieldScanResult, getPiiModifications, resetPiiModifications } from './overlay/warning-banner';
import type { ShieldStatus } from './overlay/warning-banner';
import { showFloatingBadge, updateFloatingPanel, isFloatingBadgeShown } from './overlay/floating-panel';
import type { ScanResult, AeginelConfig, ProxyResult, PiiMapping } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/types';
import { DEBOUNCE_MS, INPUT_MIN_LENGTH } from '../shared/constants';
import { setLocale } from '../i18n';
import { sendMessage, onDisconnected } from './messaging';

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
  console.debug(`[Aegis] Site detected: ${adapter.name} (${adapter.id})`);
  initContentScript(adapter);
} else {
  console.debug(`[Aegis] No matching site adapter for: ${window.location.hostname}`);
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

  // Track shield status so it can be restored after DOM re-renders
  let lastShieldStatus: ShieldStatus = 'idle';

  // Guard against recursive submit during re-fire
  let isResubmitting = false;

  // Last proxy result — used for client-side user message restoration
  let lastProxyResult: ProxyResult | null = null;

  // Track consecutive health-check failures to avoid spamming banners
  let consecutiveHealthFailures = 0;
  let healthBannerShown = false;

  // ── Health Check: validate adapter selectors ────────────────────────
  function checkAdapterHealth() {
    // Only check input + submit — response elements don't exist until
    // the AI has replied at least once, so checking them on a fresh
    // conversation would always produce a false "degraded" warning.
    const selectors: Record<string, string> = {
      input: adapter.getInputSelector(),
      submit: adapter.getSubmitSelector(),
    };

    const brokenSelectors: string[] = [];
    for (const [name, selector] of Object.entries(selectors)) {
      try {
        const el = document.querySelector(selector);
        if (!el) {
          brokenSelectors.push(name);
        }
      } catch {
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
      setLocale(res.payload.uiLanguage ?? 'auto');
    }
  });

  // Watch for input changes
  function onInputChange(el: Element) {
    const text = adapter.getInputText(el);

    if (text.length < INPUT_MIN_LENGTH) {
      if (lastScannedText !== '') {
        lastScannedText = '';
        currentResult = null;
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
        hideWarningBanner();
        lastShieldStatus = 'idle';
        const anchor = adapter.getWarningAnchor();
        if (anchor) showShieldIndicator('idle', anchor);
      }
      return;
    }

    if (text === lastScannedText) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      lastScannedText = text;
      scanInput(text);
    }, DEBOUNCE_MS);
  }

  // Send to service worker for scanning (with retry)
  async function scanInput(input: string) {
    // Show loading shield while ML model may be cold-starting
    const anchor = adapter.getWarningAnchor();
    if (anchor && lastShieldStatus === 'idle') {
      showShieldIndicator('loading', anchor);
    }

    const response = await sendMessage<{ type?: string; payload?: ScanResult }>({
      type: 'SCAN_INPUT',
      payload: { input, site: adapter.name },
    });

    if (response?.type === 'SCAN_RESULT' && response.payload) {
      currentResult = response.payload;
      handleScanResult(response.payload);
    } else if (anchor) {
      showShieldIndicator(lastShieldStatus === 'loading' ? 'idle' : lastShieldStatus, anchor);
    }
  }

  const THREAT_CATEGORIES = new Set([
    'jailbreak', 'prompt_injection', 'harmful', 'violence',
    'dangerous', 'self_harm', 'hate_speech',
  ]);

  function hasThreatCategory(categories: string[]): boolean {
    return categories.some(c => THREAT_CATEGORIES.has(c.toLowerCase()));
  }

  // Handle scan result — silent-by-default
  // Only show full warning banner for high/critical risk.
  // For low/medium, show a non-intrusive shield icon.
  function handleScanResult(result: ScanResult) {
    const anchor = adapter.getWarningAnchor();

    updateShieldScanResult(result);

    if (result.score === 0 && result.piiDetected.length === 0) {
      hideWarningBanner();
      lastShieldStatus = 'safe';
      if (anchor) showShieldIndicator('safe', anchor);
      return;
    }

    // PII-only + proxy enabled → lock shield only, no banner
    const isPiiOnly = result.piiDetected.length > 0
      && !hasThreatCategory(result.categories);

    if (isPiiOnly && currentConfig.piiProxy.enabled) {
      hideWarningBanner();
      lastShieldStatus = 'pii';
      if (anchor) showShieldIndicator('pii', anchor);
      return;
    }

    // Determine shield status
    let shieldStatus: ShieldStatus = 'safe';
    if (result.piiDetected.length > 0) shieldStatus = 'pii';
    if (result.level === 'medium') shieldStatus = 'warning';
    if (result.level === 'high' || result.level === 'critical') shieldStatus = 'danger';

    if (!anchor) return;

    lastShieldStatus = shieldStatus;

    // Silent mode: low/medium risk → shield icon only (no banner)
    if (result.level === 'low' || result.level === 'medium') {
      hideWarningBanner();
      showShieldIndicator(shieldStatus, anchor);
      return;
    }

    // High/critical → full warning banner + shield
    showWarningBanner(result, anchor);
    showShieldIndicator(shieldStatus, anchor);
  }

  // ── PII Proxy: Pseudonymize before submit ─────────────────────────────

  function hideInputText(el: Element): void {
    const htmlEl = el as HTMLElement;
    htmlEl.style.setProperty('color', 'transparent', 'important');
    htmlEl.style.setProperty('caret-color', 'transparent', 'important');
  }

  function unhideInputText(el: Element): void {
    const htmlEl = el as HTMLElement;
    htmlEl.style.removeProperty('color');
    htmlEl.style.removeProperty('caret-color');
  }

  async function proxyAndSubmit(inputEl: Element, originalText: string): Promise<boolean> {
    const modifications = getPiiModifications();
    const response = await sendMessage<ProxyResult>({
      type: 'PROXY_INPUT',
      payload: { text: originalText, site: adapter.id, sessionId, modifications },
    });

    if (!response || response.piiCount === 0) {
      return false;
    }

    resetPiiModifications();
    const proxyResult: ProxyResult = response;
    lastProxyResult = proxyResult;
    const anchor = adapter.getWarningAnchor();

    if (currentConfig.piiProxy.mode === 'confirm' && anchor) {
      // Show confirmation modal
      return new Promise<boolean>((resolve) => {
        showProxyConfirmModal(proxyResult, anchor,
          () => {
            // User confirmed — hide text, swap, submit
            hideInputText(inputEl);
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

    // Auto mode — hide text so the user never sees the pseudonymized value
    hideInputText(inputEl);
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
      const isPiiOnlyBlock = !hasThreatCategory(currentResult.categories)
        && currentResult.piiDetected.length > 0;

      if (isPiiOnlyBlock && currentConfig.piiProxy.enabled) {
        // PII-only block with proxy enabled — skip modal, let proxy handle it.
        // Clear blocked so the proxy flow proceeds normally.
        currentResult = { ...currentResult, blocked: false };
        const anchor = adapter.getWarningAnchor();
        if (anchor) showShieldIndicator('pii', anchor);
      } else {
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
    }

    // PII Proxy: check if enabled (synchronous)
    if (!currentConfig.piiProxy.enabled) return;

    // Find input element and get text (synchronous)
    const inputEl = document.querySelector(adapter.getInputSelector());
    if (!inputEl) return;

    const text = adapter.getInputText(inputEl);
    if (text.length < INPUT_MIN_LENGTH) return;

    // All synchronous checks passed — prevent default NOW before any async work
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    let proxied = false;
    try {
      proxied = await proxyAndSubmit(inputEl, text);

      // Allow a small delay for the editor to sync after text replacement
      if (proxied) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch {
      // If proxy fails, still re-submit with original text
    }

    // Start watching for the user message bubble BEFORE submit fires,
    // so the MutationObserver is ready to catch newly added DOM nodes
    if (proxied && lastProxyResult && lastProxyResult.piiCount > 0) {
      restoreUserMessageInDom(lastProxyResult);
    }

    // Re-trigger submit
    triggerSubmit();

    // Immediately restore input visibility — the platform already captured
    // the pseudonymized value synchronously during the submit event
    if (proxied) {
      unhideInputText(inputEl);
    }
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

  // ── Local PII Restoration (client-side, no service worker round-trip) ──

  function restoreTextNodesLocally(container: Element, mappings: PiiMapping[]): boolean {
    return processNodeForRestore(container, mappings);
  }

  // ── User Message Restoration ──────────────────────────────────────────
  // After submit, the chat platform renders the user's message bubble
  // with pseudonymized text. This observer fires as a microtask (before
  // the browser paints), so the user never sees the pseudonymized value.

  // Build a regex that matches the same digits with optional separators (dashes, spaces, dots)
  // e.g. pseudonym "01057523572" also matches "010-5752-3572"
  function buildFuzzyDigitRegex(pseudonym: string): RegExp | null {
    const digits = pseudonym.replace(/\D/g, '');
    if (digits.length < 7) return null;
    const pattern = digits.split('').join('[\\s\\-–.]*');
    return new RegExp(pattern, 'g');
  }

  function textContainsPseudonym(text: string, mapping: PiiMapping): boolean {
    if (text.includes(mapping.pseudonym)) return true;
    const fuzzy = buildFuzzyDigitRegex(mapping.pseudonym);
    return fuzzy ? fuzzy.test(text) : false;
  }

  function replaceInText(text: string, mappings: PiiMapping[]): string | null {
    let result = text;
    let changed = false;
    for (const mapping of mappings) {
      if (result.includes(mapping.pseudonym)) {
        result = result.split(mapping.pseudonym).join(mapping.original);
        changed = true;
        continue;
      }
      // Fuzzy match: AI may reformat numbers (e.g. add dashes to phone numbers)
      const fuzzy = buildFuzzyDigitRegex(mapping.pseudonym);
      if (fuzzy) {
        const replaced = result.replace(fuzzy, mapping.original);
        if (replaced !== result) {
          result = replaced;
          changed = true;
        }
      }
    }
    return changed ? result : null;
  }

  function processNodeForRestore(node: Node, mappings: PiiMapping[]): boolean {
    if (node instanceof Text) {
      if (!node.textContent) return false;
      const replaced = replaceInText(node.textContent, mappings);
      if (replaced !== null) {
        node.textContent = replaced;
        return true;
      }
      return false;
    }

    if (!(node instanceof Element)) return false;

    // Quick check: does this element contain any pseudonym at all?
    const fullText = node.textContent ?? '';
    if (!mappings.some(m => textContainsPseudonym(fullText, m))) return false;

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode: Text | null;
    let found = false;
    while ((textNode = walker.nextNode() as Text | null)) {
      if (!textNode.textContent) continue;
      const replaced = replaceInText(textNode.textContent, mappings);
      if (replaced !== null) {
        textNode.textContent = replaced;
        found = true;
      }
    }
    return found;
  }

  // ── Persistent User Message Restoration ─────────────────────────────────
  // Frameworks like React/Angular may re-render and overwrite our DOM changes.
  // We need to continuously monitor and re-apply restoration.

  // Track active restoration watchers to prevent duplicates
  let activeUserMsgWatcher: MutationObserver | null = null;
  let activeUserMsgInterval: ReturnType<typeof setInterval> | null = null;

  function restoreUserMessageInDom(proxyResult: ProxyResult) {
    const mappings = proxyResult.mappings;
    if (mappings.length === 0) return;

    // Clean up previous watchers if any
    if (activeUserMsgWatcher) {
      activeUserMsgWatcher.disconnect();
      activeUserMsgWatcher = null;
    }
    if (activeUserMsgInterval) {
      clearInterval(activeUserMsgInterval);
      activeUserMsgInterval = null;
    }

    let restorationCount = 0;
    const MAX_RESTORATIONS = 50; // Prevent infinite loops
    const WATCH_DURATION_MS = 30000; // Watch for 30 seconds

    // Get user message selector if adapter provides one
    const userMsgSelector = adapter.getUserMessageSelector?.();

    // Function to scan and restore user messages
    function scanAndRestore(): boolean {
      let restored = false;

      // Strategy 1: Use adapter's user message selector
      if (userMsgSelector) {
        const userMsgEls = document.querySelectorAll(userMsgSelector);
        for (const userMsg of userMsgEls) {
          const text = userMsg.textContent ?? '';
          
          // Check if this message contains any pseudonyms
          if (mappings.some(m => textContainsPseudonym(text, m))) {
            if (processNodeForRestore(userMsg, mappings)) {
              restored = true;
            }
          }
        }
      }

      // Strategy 2: Scan entire main area for any remaining pseudonyms
      if (!restored) {
        const main = document.querySelector('main') ?? document.body;
        const fullText = main.textContent ?? '';
        
        if (mappings.some(m => textContainsPseudonym(fullText, m))) {
          if (processNodeForRestore(main, mappings)) {
            restored = true;
          }
        }
      }

      if (restored) {
        restorationCount++;
        console.debug(`[Aegis] User message restored (count: ${restorationCount})`);
      }

      return restored;
    }

    // MutationObserver to detect re-renders and re-apply restoration
    const userMsgObserver = new MutationObserver((mutations) => {
      if (restorationCount >= MAX_RESTORATIONS) {
        userMsgObserver.disconnect();
        console.debug('[Aegis] User message restoration limit reached');
        return;
      }

      // Check if any mutation reintroduced pseudonyms
      let needsRestore = false;
      
      for (const mutation of mutations) {
        const targetText = (mutation.target as Element).textContent ?? '';
        if (mappings.some(m => textContainsPseudonym(targetText, m))) {
          needsRestore = true;
          break;
        }
        
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            const nodeText = node.textContent ?? '';
            if (mappings.some(m => textContainsPseudonym(nodeText, m))) {
              needsRestore = true;
              break;
            }
          }
        }
        
        if (needsRestore) break;
      }

      if (needsRestore) {
        // Small delay to let the framework finish its update
        setTimeout(() => scanAndRestore(), 10);
      }
    });

    const main = document.querySelector('main') ?? document.body;
    userMsgObserver.observe(main, { 
      childList: true, 
      subtree: true, 
      characterData: true,
      characterDataOldValue: true,
    });
    activeUserMsgWatcher = userMsgObserver;

    // Periodic check as backup (for frameworks that batch updates)
    const checkInterval = setInterval(() => {
      if (restorationCount >= MAX_RESTORATIONS) {
        clearInterval(checkInterval);
        return;
      }

      const main = document.querySelector('main') ?? document.body;
      const fullText = main.textContent ?? '';
      
      // Only restore if pseudonyms are still present
      if (mappings.some(m => textContainsPseudonym(fullText, m))) {
        scanAndRestore();
      }
    }, 500);
    activeUserMsgInterval = checkInterval;

    // Initial restoration attempt
    setTimeout(() => scanAndRestore(), 50);
    setTimeout(() => scanAndRestore(), 150);
    setTimeout(() => scanAndRestore(), 300);

    // Stop watching after WATCH_DURATION_MS
    setTimeout(() => {
      userMsgObserver.disconnect();
      clearInterval(checkInterval);
      activeUserMsgWatcher = null;
      activeUserMsgInterval = null;
      console.debug(`[Aegis] User message watch ended (${restorationCount} restorations)`);
    }, WATCH_DURATION_MS);
  }

  // ── Response Watching (restore pseudonyms in AI responses) ────────────

  function watchResponses(): MutationObserver {
    const responseSelector = adapter.getResponseSelector();
    const userMsgSelector = adapter.getUserMessageSelector?.();
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    const restoredElements = new WeakSet<Element>();
    const restoredSnapshots = new WeakMap<Element, string>();
    let emptyResultCount = 0;

    async function tryRestoreAll() {
      if (adapter.isStreaming()) return;

      let responseEls = document.querySelectorAll(responseSelector);

      // Also include user messages for restoration (needed after page refresh)
      if (userMsgSelector) {
        const userMsgEls = document.querySelectorAll(userMsgSelector);
        if (userMsgEls.length > 0) {
          const combined = Array.from(responseEls);
          for (const el of userMsgEls) {
            if (!combined.includes(el)) combined.push(el);
          }
          responseEls = combined as unknown as NodeListOf<Element>;
        }
      }

      // Gemini fallback: if selectors don't match, try broader patterns
      if (responseEls.length === 0) {
        emptyResultCount++;
        if (emptyResultCount >= 3 && adapter.id === 'gemini') {
          // Try alternative Gemini selectors
          const fallbackSelectors = [
            '[class*="response"]',
            '[class*="model-response"]',
            '[class*="message-content"]',
          ];
          for (const sel of fallbackSelectors) {
            try {
              responseEls = document.querySelectorAll(sel);
              if (responseEls.length > 0) {
                console.debug(`[Aegis] Gemini fallback selector worked: ${sel}`);
                break;
              }
            } catch { /* skip invalid selector */ }
          }
        }
        if (responseEls.length === 0) return;
      } else {
        emptyResultCount = 0;
      }

      for (const el of responseEls) {
        const currentText = el.textContent ?? '';

        // Skip if already restored and content hasn't changed
        const snapshot = restoredSnapshots.get(el);
        if (snapshot !== undefined && snapshot === currentText) continue;

        // Check if this element likely contains pseudonyms
        if (lastProxyResult && lastProxyResult.piiCount > 0) {
          const hasPseudonyms = lastProxyResult.mappings.some(
            m => textContainsPseudonym(currentText, m)
          );
          if (!hasPseudonyms) {
            restoredSnapshots.set(el, currentText);
            continue;
          }
        }

      const beforeText = currentText;

        // Try enhanced deep restoration first (for Gemini shadow DOM)
        if (adapter.id === 'gemini' && lastProxyResult && lastProxyResult.piiCount > 0) {
          if (deepRestoreInElement(el, lastProxyResult.mappings)) {
            console.debug('[Aegis] Gemini deep restoration succeeded');
            restoredSnapshots.set(el, el.textContent ?? '');
            restoredElements.add(el);
            continue;
          }
        }

        await restoreInDom(el);
        const afterText = el.textContent ?? '';
        if (afterText !== beforeText) {
          restoredSnapshots.set(el, afterText);
          restoredElements.add(el);
        }
      }
    }

    const responseObserver = new MutationObserver(() => {
      if (restoreTimer) clearTimeout(restoreTimer);
      // Shorter delay for Gemini to catch streaming end faster
      const delay = adapter.id === 'gemini' ? 300 : 500;
      restoreTimer = setTimeout(tryRestoreAll, delay);
    });

    const main = document.querySelector('main') ?? document.body;
    responseObserver.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Periodic fallback: re-check the latest response every 2 seconds
    // For Gemini, check more frequently
    const checkInterval = adapter.id === 'gemini' ? 1500 : 2000;
    setInterval(tryRestoreAll, checkInterval);

    // Initial restoration on load: catch already-rendered messages after page
    // refresh. Stagger attempts to allow the service worker to fully initialize
    // and load persisted PII mappings from chrome.storage.session.
    setTimeout(tryRestoreAll, 500);
    setTimeout(tryRestoreAll, 1500);
    setTimeout(tryRestoreAll, 3000);

    return responseObserver;
  }

  async function restoreInDom(container: Element) {
    // First try client-side restoration if we have a recent proxy result
    if (lastProxyResult && lastProxyResult.piiCount > 0) {
      const restored = restoreTextNodesLocally(container, lastProxyResult.mappings);
      if (restored) {
        console.debug('[Aegis] Client-side restoration succeeded');
        return;
      }
    }

    // Fall back to service worker restoration (handles persisted mappings
    // from prior proxy calls or after service worker restart)
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    let restoredCount = 0;
    while ((node = walker.nextNode() as Text | null)) {
      if (!node.textContent) continue;
      const restored = await sendMessage<{ restoredText?: string }>({
        type: 'RESTORE_RESPONSE',
        payload: { text: node.textContent, sessionId },
      });
      if (restored?.restoredText && restored.restoredText !== node.textContent) {
        try {
          node.textContent = restored.restoredText;
          restoredCount++;
        } catch {
          // Node may have been removed from DOM during async operation
        }
      }
    }
    if (restoredCount > 0) {
      console.debug(`[Aegis] Service worker restoration: ${restoredCount} nodes`);
    }
  }

  // ── Enhanced Response Watching for Gemini ──────────────────────────────
  // Gemini uses custom elements and Shadow DOM which may require deeper traversal.

  function deepRestoreInElement(el: Element, mappings: PiiMapping[]): boolean {
    let found = false;

    // First try direct restoration
    if (processNodeForRestore(el, mappings)) {
      found = true;
    }

    // For Gemini: also check shadow roots if accessible
    if ((el as HTMLElement).shadowRoot) {
      const shadowWalker = document.createTreeWalker(
        (el as HTMLElement).shadowRoot!,
        NodeFilter.SHOW_TEXT
      );
      let textNode: Text | null;
      while ((textNode = shadowWalker.nextNode() as Text | null)) {
        if (!textNode.textContent) continue;
        const replaced = replaceInText(textNode.textContent, mappings);
        if (replaced !== null) {
          textNode.textContent = replaced;
          found = true;
        }
      }
    }

    // Recursively check child elements with shadow roots
    for (const child of el.querySelectorAll('*')) {
      if ((child as HTMLElement).shadowRoot) {
        if (deepRestoreInElement(child, mappings)) {
          found = true;
        }
      }
    }

    return found;
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

  let shieldProperlyPlaced = false;
  let shieldRetryTimer: ReturnType<typeof setTimeout> | null = null;

  function isGenericAnchor(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    return tag === 'main' || tag === 'body' || tag === 'html';
  }

  function scheduleShieldRetry(attempt = 0) {
    if (shieldRetryTimer) clearTimeout(shieldRetryTimer);
    if (attempt >= 50) return;

    // Fast retries initially (100ms × 10), then slower (300ms)
    const delay = attempt < 10 ? 100 : 300;
    shieldRetryTimer = setTimeout(() => {
      if (shieldProperlyPlaced) return;

      const anchor = adapter.getWarningAnchor();
      if (!anchor || isGenericAnchor(anchor)) {
        scheduleShieldRetry(attempt + 1);
        return;
      }

      hideShieldIndicator();
      showShieldIndicator(lastShieldStatus, anchor);
      shieldProperlyPlaced = true;
    }, delay);
  }

  function ensureShieldVisible() {
    const anchor = adapter.getWarningAnchor();
    if (!anchor) return;

    if (!shieldProperlyPlaced && !isGenericAnchor(anchor)) {
      hideShieldIndicator();
      showShieldIndicator(lastShieldStatus, anchor);
      shieldProperlyPlaced = true;
      return;
    }

    if (isShieldVisible()) return;

    if (isGenericAnchor(anchor)) {
      if (!shieldProperlyPlaced) scheduleShieldRetry();
      return;
    }

    showShieldIndicator(lastShieldStatus, anchor);
    shieldProperlyPlaced = true;
  }

  // ── SPA Navigation Detection ───────────────────────────────────────
  // ChatGPT/Claude etc. change conversations via pushState without a
  // full reload. Detect URL changes and reset scan state so the shield
  // returns to idle on a fresh conversation.

  let lastUrl = location.href;

  function checkForNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastScannedText = '';
      currentResult = null;
      lastShieldStatus = 'idle';
      shieldProperlyPlaced = false;
      hideWarningBanner();
      const anchor = adapter.getWarningAnchor();
      if (anchor) showShieldIndicator('idle', anchor);
    }
  }

  // MutationObserver for SPA navigation — debounced
  let spaTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (spaTimer) clearTimeout(spaTimer);
    spaTimer = setTimeout(() => {
      checkForNavigation();
      scanExistingElements();
      ensureShieldVisible();
      if (!isFloatingBadgeShown()) {
        showFloatingBadge();
      }
    }, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Store reference to response observer for cleanup
  let responseObserverRef: MutationObserver | null = null;

  // Cleanup: disconnect observers and clear timers on page unload/navigation
  function cleanup() {
    observer.disconnect();
    responseObserverRef?.disconnect();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (spaTimer) clearTimeout(spaTimer);
  }

  window.addEventListener('pagehide', cleanup);

  // Show initial idle shield
  function showIdleShield() {
    const anchor = adapter.getWarningAnchor();
    lastShieldStatus = 'idle';

    if (!anchor || isGenericAnchor(anchor)) {
      scheduleShieldRetry();
      return;
    }

    showShieldIndicator('idle', anchor);
    shieldProperlyPlaced = true;
  }

  // Initialize floating badge
  function initFloatingBadge() {
    showFloatingBadge();
  }

  // Initial attach
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanExistingElements();
      responseObserverRef = watchResponses();
      showIdleShield();
      initFloatingBadge();
      setTimeout(checkAdapterHealth, 2000);
    });
  } else {
    scanExistingElements();
    responseObserverRef = watchResponses();
    showIdleShield();
    initFloatingBadge();
    setTimeout(checkAdapterHealth, 2000);
  }

  // Periodic health check every 5 minutes to detect site layout changes
  const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(checkAdapterHealth, HEALTH_CHECK_INTERVAL_MS);

  // ── Scan Progress Updates ──────────────────────────────────────────
  const PHASE_TOOLTIPS: Record<string, string> = {
    pii: 'Aegis: Scanning for personal information...',
    aegis: 'Aegis: Checking AEGIS server...',
    done: 'Aegis: Done',
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'SCAN_PROGRESS' && msg.payload) {
      const { phase, detail } = msg.payload as { phase: string; detail: string };
      const tooltip = PHASE_TOOLTIPS[phase] ?? `Aegis: ${detail}`;
      updateShieldTooltip(tooltip);
    }
    if (msg?.type === 'SCAN_COMPLETE' && msg.payload) {
      updateFloatingPanel(msg.payload as ScanResult);
    }
  });

  // ── Disconnection Detection ──────────────────────────────────────────
  // Show a non-intrusive banner when the extension context is lost
  // (e.g. extension updated/reloaded while the page remains open).

  onDisconnected(() => {
    console.debug('[Aegis] Extension context lost — showing reconnect banner');
    showDisconnectedBanner();
  });

  // Heartbeat: periodically verify the connection is alive.
  // If the SW was killed and context invalidated silently (e.g. after
  // Mac sleep/wake), the heartbeat catches it and shows the banner.
  const HEARTBEAT_INTERVAL_MS = 30 * 1000;
  setInterval(() => {
    sendMessage({ type: 'GET_CONFIG' }).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
}
