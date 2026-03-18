// ── Aegis Personal ML Classifier ────────────────────────────────────────────────────
// Bridge between the Service Worker and the Offscreen Document.
// The Service Worker cannot run WASM directly (MV3 constraint), so all
// ONNX inference is delegated to the offscreen page via messaging.
//
// Resilience: The offscreen document uses lazy-load + auto-release.
// This bridge handles SW restarts by re-checking offscreen existence,
// and retries once when the model is still loading on-demand.

const OFFSCREEN_URL = 'src/offscreen/offscreen.html';
let offscreenCreating = false;
let offscreenCreated = false;

// ── Types ────────────────────────────────────────────────────────────────────

export interface MlClassifyResult {
  success: boolean;
  labels: string[];
  scores: Record<string, number>;
  isHarmful: boolean;
  /** 0–40 range. Added on top of rule-based score. */
  mlScore: number;
  error?: string;
}

// ── Offscreen Lifecycle ──────────────────────────────────────────────────────

async function ensureOffscreen(): Promise<void> {
  // After SW restart, in-memory flag is stale — always verify via API
  if (offscreenCreated) {
    try {
      const exists = await chrome.offscreen.hasDocument?.() ?? false;
      if (exists) return;
      offscreenCreated = false;
    } catch {
      offscreenCreated = false;
    }
  }

  if (offscreenCreating) {
    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 5000;
      const check = setInterval(() => {
        if (!offscreenCreating || Date.now() >= deadline) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    return;
  }

  offscreenCreating = true;
  try {
    const existing = await chrome.offscreen.hasDocument?.() ?? false;
    if (!existing) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: 'Run WASM-based ML inference (Transformers.js ONNX) for prompt safety detection',
      });
    }
    offscreenCreated = true;
  } catch (err) {
    console.error('[Aegis ML] Offscreen creation failed:', err);
  } finally {
    offscreenCreating = false;
  }
}

async function sendToOffscreen(type: string, extra?: Record<string, unknown>): Promise<unknown> {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: 'offscreen', type, ...extra });
}

// ── Public API ───────────────────────────────────────────────────────────────

const FALLBACK: MlClassifyResult = {
  success: false, labels: [], scores: {}, isHarmful: false, mlScore: 0,
};

/**
 * Classify text via the offscreen ONNX guard model.
 * The model loads on-demand on first request; subsequent calls are instant.
 * If the model is loading (cold start / after idle release), retries once
 * after a short wait so the caller doesn't have to handle it.
 */
export async function mlClassify(text: string): Promise<MlClassifyResult> {
  try {
    let response = await sendToOffscreen('ML_CLASSIFY', { text }) as MlClassifyResult | null;

    // Model is loading on-demand — wait and retry once
    if (response?.error === 'MODEL_LOADING' || response?.error === 'MODEL_NOT_READY') {
      await new Promise(r => setTimeout(r, 3000));
      response = await sendToOffscreen('ML_CLASSIFY', { text }) as MlClassifyResult | null;
    }

    return response ?? FALLBACK;
  } catch (err) {
    const errMsg = String(err);
    // Offscreen gone — reset flag and retry once
    if (errMsg.includes('Receiving end does not exist') || errMsg.includes('disconnected')) {
      offscreenCreated = false;
      try {
        const retry = await sendToOffscreen('ML_CLASSIFY', { text }) as MlClassifyResult | null;
        return retry ?? FALLBACK;
      } catch {
        return FALLBACK;
      }
    }
    console.warn('[Aegis ML] classify error:', err);
    return FALLBACK;
  }
}

/**
 * Query whether the offscreen ML model is ready.
 */
export async function mlStatus(): Promise<{ ready: boolean; loading: boolean; standby?: boolean }> {
  try {
    const response = await sendToOffscreen('ML_STATUS');
    return (response as { ready: boolean; loading: boolean; standby?: boolean }) ?? { ready: false, loading: false, standby: true };
  } catch {
    return { ready: false, loading: false, standby: true };
  }
}
