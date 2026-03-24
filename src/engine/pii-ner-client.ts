// ── PII NER Client ─────────────────────────────────────────────────────────────
// Manages the offscreen document lifecycle and proxies inference requests
// from the service worker to the PII NER ONNX model running offscreen.

const OFFSCREEN_URL = 'src/offscreen/pii-ner.html';
const INFERENCE_TIMEOUT_MS = 15_000;
const OFFSCREEN_CREATE_TIMEOUT_MS = 10_000;

export interface NerEntity {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

let creating: Promise<void> | null = null;
let offscreenReady = false;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenReady) {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
      });
      if (contexts.length > 0) return;
      offscreenReady = false;
    } catch {
      offscreenReady = false;
    }
  }

  if (creating) {
    await creating;
    return;
  }

  creating = (async () => {
    try {
      const existing = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
      });
      if (existing.length > 0) {
        offscreenReady = true;
        return;
      }
    } catch { /* proceed to create */ }

    await withTimeout(
      chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: 'Run PII NER ONNX model inference via WASM',
      }),
      OFFSCREEN_CREATE_TIMEOUT_MS,
      'Offscreen document creation',
    );
    offscreenReady = true;
  })();

  try {
    await creating;
  } finally {
    creating = null;
  }
}

let requestCounter = 0;

export async function runNerInference(text: string): Promise<NerEntity[]> {
  try {
    await ensureOffscreenDocument();
  } catch (err) {
    console.error('[PII-NER Client] Offscreen document setup failed:', err);
    return [];
  }

  const requestId = `ner-${Date.now()}-${++requestCounter}`;

  try {
    const response = await withTimeout(
      chrome.runtime.sendMessage({
        target: 'pii-ner-offscreen',
        action: 'inference',
        text,
        requestId,
      }),
      INFERENCE_TIMEOUT_MS,
      'NER inference',
    );

    if (response?.error) {
      console.error('[PII-NER Client] Inference error:', response.error);
      return [];
    }

    return response?.entities ?? [];
  } catch (err) {
    console.error('[PII-NER Client] Inference failed:', err);
    return [];
  }
}

export async function initPiiNer(): Promise<void> {
  try {
    await ensureOffscreenDocument();
    console.debug('[PII-NER Client] Offscreen document ready');
  } catch (err) {
    console.warn('[PII-NER Client] Failed to create offscreen document:', err);
  }
}
