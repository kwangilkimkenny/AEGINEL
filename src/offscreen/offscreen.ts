// ── AEGINEL Offscreen Document ──────────────────────────────────────────────
// Runs inside an Offscreen Document (chrome.offscreen API, MV3).
// The Service Worker cannot run WASM directly, so ML inference is delegated here.
// Communication: chrome.runtime.onMessage / sendMessage

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pipeline is typed for single-label by default; we cast manually
import { pipeline, env } from '@huggingface/transformers';

// ── Config ──────────────────────────────────────────────────────────────────

// Point to the bundled model inside the extension's public/models/ directory.
// Transformers.js constructs: localModelPath + MODEL_KEY → models/guard/config.json
env.localModelPath = chrome.runtime.getURL('models/');
env.allowRemoteModels = false;
env.useBrowserCache = true;

const MODEL_KEY = 'guard';
const THRESHOLD = 0.5;
const MAX_LOAD_RETRIES = 2;

// ── State ────────────────────────────────────────────────────────────────────

// Loosely-typed to avoid Transformers.js generic-union complexity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClassifierFn = (text: string, opts?: Record<string, unknown>) => Promise<any>;

let classifierReady = false;
let classifierLoading = false;
let classifier: ClassifierFn | null = null;
let loadRetryCount = 0;
let lastLoadError: string | null = null;

// ── Model Loading ────────────────────────────────────────────────────────────

async function loadModel(): Promise<void> {
  if (classifierReady || classifierLoading) return;
  classifierLoading = true;

  try {
    console.log(`[AEGINEL Offscreen] Loading guard model (attempt ${loadRetryCount + 1})...`);
    // Cast to ClassifierFn to bypass complex union type from generics
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — Transformers.js overloaded pipeline() returns a union type too complex for TS
    classifier = (await pipeline('text-classification', MODEL_KEY)) as ClassifierFn;
    classifierReady = true;
    lastLoadError = null;
    loadRetryCount = 0;
    console.log('[AEGINEL Offscreen] Model ready.');

    // Report success to service worker
    reportStatus('ok');
  } catch (err) {
    const errorMsg = String(err);
    console.error('[AEGINEL Offscreen] Model load failed:', err);
    classifierReady = false;
    lastLoadError = errorMsg;
    loadRetryCount++;

    // Report error to service worker
    reportLoadError(errorMsg, loadRetryCount);

    // Retry with exponential backoff (max MAX_LOAD_RETRIES retries)
    if (loadRetryCount <= MAX_LOAD_RETRIES) {
      const delay = 1000 * Math.pow(2, loadRetryCount - 1); // 1s, 2s
      console.log(`[AEGINEL Offscreen] Retrying in ${delay}ms (attempt ${loadRetryCount + 1}/${MAX_LOAD_RETRIES + 1})...`);
      classifierLoading = false; // allow retry
      setTimeout(() => loadModel(), delay);
      return;
    }
    console.error(`[AEGINEL Offscreen] All ${MAX_LOAD_RETRIES + 1} load attempts failed. ML classification unavailable.`);
  } finally {
    classifierLoading = false;
  }
}

function reportLoadError(error: string, retryCount: number) {
  try {
    chrome.runtime.sendMessage({
      type: 'ML_LOAD_ERROR',
      payload: { error, retryCount },
    }).catch(() => { /* service worker may not be ready */ });
  } catch {
    // Extension context invalidated
  }
}

function reportStatus(status: 'ok' | 'degraded' | 'error', details?: string) {
  try {
    chrome.runtime.sendMessage({
      type: 'HEALTH_REPORT',
      payload: {
        source: 'offscreen-ml',
        status,
        details,
        timestamp: Date.now(),
      },
    }).catch(() => { /* service worker may not be ready */ });
  } catch {
    // Extension context invalidated
  }
}

// Start loading immediately when the offscreen doc is created
loadModel();

// ── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  switch (message.type) {
    case 'ML_CLASSIFY': {
      handleClassify(message.text as string).then(sendResponse);
      return true; // keep channel open for async
    }
    case 'ML_STATUS': {
      sendResponse({
        ready: classifierReady,
        loading: classifierLoading,
        retryCount: loadRetryCount,
        lastError: lastLoadError,
      });
      return false;
    }
    default:
      return false;
  }
});

// ── Classify ─────────────────────────────────────────────────────────────────

interface ClassifyResult {
  success: boolean;
  labels: string[];
  scores: Record<string, number>;
  isHarmful: boolean;
  /** 0–40 range, added to rule-based score */
  mlScore: number;
  error?: string;
}

async function handleClassify(text: string): Promise<ClassifyResult> {
  if (!classifierReady || !classifier) {
    return {
      success: false, labels: [], scores: {}, isHarmful: false, mlScore: 0,
      error: classifierLoading ? 'MODEL_LOADING' : 'MODEL_NOT_READY',
    };
  }

  try {
    // Return all label scores with sigmoid (multi-label model requires sigmoid, not softmax)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = await classifier(text, { function_to_apply: 'sigmoid', top_k: null });
    // Normalise to flat array regardless of batch wrapping
    const items: { label: string; score: number }[] = Array.isArray(raw)
      ? (Array.isArray(raw[0]) ? raw[0] : raw) as { label: string; score: number }[]
      : [];

    const scores: Record<string, number> = {};
    const detectedLabels: string[] = [];

    for (const item of items) {
      scores[item.label] = item.score;
      if (item.label !== 'safe' && item.score >= THRESHOLD) {
        detectedLabels.push(item.label);
      }
    }

    const isHarmful = detectedLabels.length > 0;

    // Scale max harmful confidence (0–1) to 0–40 points
    const maxConf = detectedLabels.reduce(
      (max, lbl) => Math.max(max, scores[lbl] ?? 0),
      0,
    );
    const mlScore = Math.round(maxConf * 40);

    return { success: true, labels: detectedLabels, scores, isHarmful, mlScore };
  } catch (err) {
    return {
      success: false, labels: [], scores: {}, isHarmful: false, mlScore: 0,
      error: String(err),
    };
  }
}
