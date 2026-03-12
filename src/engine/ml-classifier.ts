// ── Aegis Personal ML Classifier ────────────────────────────────────────────────────
// Bridge between the Service Worker and the Offscreen Document.
// The Service Worker cannot run WASM directly (MV3 constraint), so all
// Transformers.js inference is delegated to the offscreen page via messaging.

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
  if (offscreenCreated) return;
  if (offscreenCreating) {
    // Wait for in-flight creation
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!offscreenCreating) { clearInterval(check); resolve(); }
      }, 100);
    });
    return;
  }

  offscreenCreating = true;
  try {
    // Check if already exists (Service Worker restarts lose state)
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

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Ask the Offscreen Document to classify `text` using the ONNX guard model.
 * Returns a result with `mlScore` in range 0–40 to augment the rule-based score.
 *
 * Falls back gracefully (mlScore=0) if model isn't loaded yet or offscreen
 * creation fails — the rule-based engine still works independently.
 */
export async function mlClassify(text: string): Promise<MlClassifyResult> {
  const FALLBACK: MlClassifyResult = {
    success: false, labels: [], scores: {}, isHarmful: false, mlScore: 0,
  };

  try {
    await ensureOffscreen();
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'ML_CLASSIFY',
      text,
    });
    return (response as MlClassifyResult) ?? FALLBACK;
  } catch (err) {
    console.warn('[Aegis ML] classify error:', err);
    return FALLBACK;
  }
}

/**
 * Query whether the offscreen ML model is ready.
 */
export async function mlStatus(): Promise<{ ready: boolean; loading: boolean }> {
  try {
    await ensureOffscreen();
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'ML_STATUS',
    });
    return response ?? { ready: false, loading: false };
  } catch {
    return { ready: false, loading: false };
  }
}
