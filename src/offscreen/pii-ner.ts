// ── PII NER Offscreen Document ─────────────────────────────────────────────────
// Runs PII-NER ONNX model inference in an offscreen document context.
// Model is fetched from HuggingFace Hub and cached in the browser.
// Auto-updates when a new model version is pushed to HF.

import { env, pipeline } from '@huggingface/transformers';

const HF_MODEL_ID = 'YATAV-ENT/aegis-personal-pii-ner';
const HF_VERSION_URL = `https://huggingface.co/${HF_MODEL_ID}/resolve/main/version.json`;
const MODEL_VERSION_KEY = 'pii_ner_model_version';

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;

const ortEnv = env.backends.onnx as Record<string, Record<string, unknown>>;
if (ortEnv?.wasm) {
  ortEnv.wasm.wasmPaths = chrome.runtime.getURL('ort/');
  ortEnv.wasm.numThreads = 1;
  ortEnv.wasm.proxy = false;
}

interface NerEntity {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

interface NerRequest {
  target: 'pii-ner-offscreen';
  action: 'inference';
  text: string;
  requestId: string;
}

type NerPipeline = (text: string, options?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;

let nerPipeline: NerPipeline | null = null;
let loading: Promise<NerPipeline> | null = null;
let loadFailed = false;

async function clearModelCache(): Promise<void> {
  const keys = await caches.keys();
  for (const key of keys) {
    if (key.includes('transformers') || key.includes('onnx')) {
      await caches.delete(key);
    }
  }
  nerPipeline = null;
  loading = null;
  loadFailed = false;
}

async function checkModelUpdate(): Promise<void> {
  try {
    const res = await fetch(HF_VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return;

    const data = await res.json();
    const latestVersion = data.version as string;
    if (!latestVersion) return;

    const stored = await chrome.storage.local.get(MODEL_VERSION_KEY);
    const cachedVersion = stored[MODEL_VERSION_KEY] as string | undefined;

    if (!cachedVersion || cachedVersion !== latestVersion) {
      console.debug(`[PII-NER] Model update: ${cachedVersion ?? 'none'} → ${latestVersion}, clearing cache...`);
      await clearModelCache();
    }

    await chrome.storage.local.set({ [MODEL_VERSION_KEY]: latestVersion });
  } catch {
    // Offline or API unavailable — use cached model
  }
}

async function loadModel(): Promise<NerPipeline> {
  if (nerPipeline) return nerPipeline;
  if (loadFailed) throw new Error('Model previously failed to load');
  if (loading) return loading;

  loading = (async () => {
    console.debug('[PII-NER Offscreen] Loading model from HF Hub:', HF_MODEL_ID);

    try {
      const pipe = await pipeline('token-classification', HF_MODEL_ID, {
        device: 'wasm',
        dtype: 'q8',
      });

      nerPipeline = pipe as unknown as NerPipeline;
      console.debug('[PII-NER Offscreen] Model loaded successfully');
      return nerPipeline;
    } catch (err) {
      loadFailed = true;
      loading = null;
      throw err;
    }
  })();

  return loading;
}

async function runInference(text: string): Promise<NerEntity[]> {
  const pipe = await loadModel();

  const rawOutput = await pipe(text);

  const results: Array<Record<string, unknown>> = Array.isArray(rawOutput)
    ? (Array.isArray(rawOutput[0]) ? rawOutput.flat() : rawOutput) as Array<Record<string, unknown>>
    : [rawOutput as Record<string, unknown>];

  return results
    .filter((r) => {
      const entity = (r.entity_group ?? r.entity) as string;
      return entity !== 'O' && (r.score as number) > 0.5;
    })
    .map((r) => ({
      entity: (r.entity_group ?? r.entity) as string,
      score: r.score as number,
      word: r.word as string,
      start: (typeof r.start === 'number' && !isNaN(r.start)) ? r.start : -1,
      end: (typeof r.end === 'number' && !isNaN(r.end)) ? r.end : -1,
    }));
}

chrome.runtime.onMessage.addListener(
  (message: NerRequest, _sender, sendResponse) => {
    if (message.target !== 'pii-ner-offscreen') return false;

    if (message.action === 'inference') {
      runInference(message.text)
        .then((entities) => {
          sendResponse({ requestId: message.requestId, entities, error: null });
        })
        .catch((err) => {
          console.error('[PII-NER Offscreen] Inference error:', err);
          sendResponse({ requestId: message.requestId, entities: [], error: String(err) });
        });
      return true;
    }

    return false;
  }
);

checkModelUpdate()
  .then(() => loadModel())
  .catch((err) => {
    console.error('[PII-NER Offscreen] Model preload failed:', err);
  });
