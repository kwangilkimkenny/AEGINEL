// ── PII NER Client ─────────────────────────────────────────────────────────────
// Manages the offscreen document lifecycle and proxies inference requests
// from the service worker to the PII NER ONNX model running offscreen.

const OFFSCREEN_URL = 'src/offscreen/pii-ner.html';

export interface NerEntity {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

let creating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });

  if (existingContexts.length > 0) return;

  if (creating) {
    await creating;
    return;
  }

  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Run PII NER ONNX model inference via WASM',
  });

  await creating;
  creating = null;
}

let requestCounter = 0;

export async function runNerInference(text: string): Promise<NerEntity[]> {
  await ensureOffscreenDocument();

  const requestId = `ner-${Date.now()}-${++requestCounter}`;

  const response = await chrome.runtime.sendMessage({
    target: 'pii-ner-offscreen',
    action: 'inference',
    text,
    requestId,
  });

  if (response?.error) {
    console.error('[PII-NER Client] Inference error:', response.error);
    return [];
  }

  return response?.entities ?? [];
}

export async function initPiiNer(): Promise<void> {
  try {
    await ensureOffscreenDocument();
  } catch (err) {
    console.warn('[PII-NER Client] Failed to create offscreen document:', err);
  }
}
