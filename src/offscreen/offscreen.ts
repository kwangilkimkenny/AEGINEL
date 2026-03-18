// ── Aegis Personal Offscreen Document ──────────────────────────────────────────────
// Runs inside an Offscreen Document (chrome.offscreen API, MV3).
// The Service Worker cannot run WASM directly, so ML inference is delegated here.
//
// Lifecycle: Lazy Load + Auto Release
//   - Tokenizer loads once on first request and stays resident (lightweight ~20MB)
//   - ONNX session loads on-demand when ML_CLASSIFY is received
//   - After IDLE_TIMEOUT_MS of no requests, session is released to free ~300MB
//   - Next request transparently reloads the session
//
// Tokenization: @huggingface/transformers AutoTokenizer (pure JS, handles SentencePiece)
// Inference:    onnxruntime-web InferenceSession (direct ONNX, bypasses Transformers.js pipeline)

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — AutoTokenizer type
import { AutoTokenizer, env } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';

// ── Transformers.js config (tokenizer only) ──────────────────────────────────
env.localModelPath = chrome.runtime.getURL('models/');
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;

// ── ONNX Runtime WASM config ─────────────────────────────────────────────────
ort.env.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

// ── Constants ────────────────────────────────────────────────────────────────
const LABEL_NAMES = [
  'safe', 'jailbreak', 'encoding_bypass', 'script_evasion',
  'social_engineering', 'prompt_injection', 'harmful_content',
] as const;
const THRESHOLD = 0.5;
const MAX_LENGTH = 256;
const MAX_LOAD_RETRIES = 2;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ── State ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizer: any = null;
let tokenizerReady = false;
let session: ort.InferenceSession | null = null;
let classifierReady = false;
let classifierLoading = false;
let loadRetryCount = 0;
let lastLoadError: string | null = null;
let loadStartTime = 0;
let loadDurationMs = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

// ── Idle Timer ───────────────────────────────────────────────────────────────

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(releaseSession, IDLE_TIMEOUT_MS);
}

function releaseSession() {
  if (!session) return;
  console.log('[Aegis Offscreen] Idle timeout — releasing ONNX session to free memory');
  try { session.release(); } catch { /* already released */ }
  session = null;
  classifierReady = false;
  loadDurationMs = 0;
  reportStatus('ok', 'standby');
}

// ── Tokenizer Loading (once, stays resident) ─────────────────────────────────

async function ensureTokenizer(): Promise<void> {
  if (tokenizerReady && tokenizer) return;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  tokenizer = await AutoTokenizer.from_pretrained('guard');
  tokenizerReady = true;
  console.log('[Aegis Offscreen] Tokenizer loaded');
}

// ── Model Loading (on-demand) ────────────────────────────────────────────────

async function loadModel(): Promise<void> {
  if (classifierReady || classifierLoading) return;
  classifierLoading = true;

  try {
    loadStartTime = Date.now();
    console.log(`[Aegis Offscreen] Loading guard model (attempt ${loadRetryCount + 1})...`);

    await ensureTokenizer();

    const modelUrl = chrome.runtime.getURL('models/guard/onnx/model_quantized.onnx');
    console.log('[Aegis Offscreen] Fetching ONNX model...');
    const resp = await fetch(modelUrl);
    if (!resp.ok) throw new Error(`Failed to fetch model: ${resp.status}`);
    const modelBuffer = await resp.arrayBuffer();
    console.log(`[Aegis Offscreen] Model fetched (${(modelBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);

    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
    });
    console.log('[Aegis Offscreen] ONNX inference session created');

    classifierReady = true;
    lastLoadError = null;
    loadRetryCount = 0;
    loadDurationMs = Date.now() - loadStartTime;
    console.log(`[Aegis Offscreen] Model ready in ${(loadDurationMs / 1000).toFixed(1)}s`);

    resetIdleTimer();
    reportStatus('ok');
  } catch (err) {
    const errorMsg = String(err);
    console.error('[Aegis Offscreen] Model load failed:', err);
    classifierReady = false;
    lastLoadError = errorMsg;
    loadRetryCount++;

    reportLoadError(errorMsg, loadRetryCount);

    if (loadRetryCount <= MAX_LOAD_RETRIES) {
      const delay = 1000 * Math.pow(2, loadRetryCount - 1);
      console.log(`[Aegis Offscreen] Retrying in ${delay}ms (attempt ${loadRetryCount + 1}/${MAX_LOAD_RETRIES + 1})...`);
      classifierLoading = false;
      setTimeout(() => loadModel(), delay);
      return;
    }
    console.error(`[Aegis Offscreen] All ${MAX_LOAD_RETRIES + 1} load attempts failed. ML classification unavailable.`);
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

// Pre-load tokenizer only (lightweight) — model loads on first classify request
ensureTokenizer().catch(() => {});

// ── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  switch (message.type) {
    case 'ML_CLASSIFY': {
      handleClassify(message.text as string).then(sendResponse);
      return true;
    }
    case 'ML_STATUS': {
      sendResponse({
        ready: classifierReady,
        loading: classifierLoading,
        standby: !classifierReady && !classifierLoading && !lastLoadError,
        retryCount: loadRetryCount,
        lastError: lastLoadError,
        loadDurationMs,
      });
      return false;
    }
    case 'ML_RELEASE': {
      releaseSession();
      sendResponse({ released: true });
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

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

async function handleClassify(text: string): Promise<ClassifyResult> {
  // On-demand load: if session not ready, trigger load and wait
  if (!classifierReady || !session) {
    if (!classifierLoading) {
      loadRetryCount = 0;
      await loadModel();
    } else {
      // Already loading — wait up to 10s for it to finish
      const deadline = Date.now() + 10000;
      while (classifierLoading && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  if (!classifierReady || !session || !tokenizer) {
    return {
      success: false, labels: [], scores: {}, isHarmful: false, mlScore: 0,
      error: classifierLoading ? 'MODEL_LOADING' : 'MODEL_NOT_READY',
    };
  }

  resetIdleTimer();

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const encoded = await tokenizer(text, {
      padding: 'max_length',
      truncation: true,
      max_length: MAX_LENGTH,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const seqLen: number = encoded.input_ids.dims[1] ?? encoded.input_ids.dims[0] ?? MAX_LENGTH;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const idsRaw = encoded.input_ids.data;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const maskRaw = encoded.attention_mask.data;

    const idsBigInt = idsRaw instanceof BigInt64Array
      ? idsRaw
      : BigInt64Array.from(Array.from(idsRaw as ArrayLike<number>).map(BigInt));
    const maskBigInt = maskRaw instanceof BigInt64Array
      ? maskRaw
      : BigInt64Array.from(Array.from(maskRaw as ArrayLike<number>).map(BigInt));

    const inputIds = new ort.Tensor('int64', idsBigInt, [1, seqLen]);
    const attentionMask = new ort.Tensor('int64', maskBigInt, [1, seqLen]);

    const output = await session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
    });

    const logitsData = Array.from(output.logits.data as Float32Array);

    const scores: Record<string, number> = {};
    const detectedLabels: string[] = [];

    for (let i = 0; i < LABEL_NAMES.length; i++) {
      const prob = sigmoid(logitsData[i]);
      scores[LABEL_NAMES[i]] = prob;
      if (LABEL_NAMES[i] !== 'safe' && prob >= THRESHOLD) {
        detectedLabels.push(LABEL_NAMES[i]);
      }
    }

    const isHarmful = detectedLabels.length > 0;

    const maxConf = detectedLabels.reduce(
      (max, lbl) => Math.max(max, scores[lbl] ?? 0),
      0,
    );
    const mlScore = Math.round(maxConf * 40);

    return { success: true, labels: detectedLabels, scores, isHarmful, mlScore };
  } catch (err) {
    console.error('[Aegis Offscreen] Classify error:', err);
    return {
      success: false, labels: [], scores: {}, isHarmful: false, mlScore: 0,
      error: String(err),
    };
  }
}
