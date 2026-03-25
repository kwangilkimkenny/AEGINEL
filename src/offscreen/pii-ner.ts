// ── PII NER Offscreen Document ─────────────────────────────────────────────────
// Runs PII-NER ONNX model inference in an offscreen document context.
// Model is fetched from HuggingFace Hub and cached in the browser.
// Auto-updates when a new model version is pushed to HF.

import { env, pipeline } from '@huggingface/transformers';

const HF_MODEL_ID = 'YATAV-ENT/aegis-personal-pii-ner';
const HF_VERSION_URL = `https://huggingface.co/${HF_MODEL_ID}/resolve/main/version.json`;
const HF_API_URL = `https://huggingface.co/api/models/${HF_MODEL_ID}`;
const MODEL_VERSION_KEY = 'pii_ner_model_version';
const MODEL_REVISION_KEY = 'pii_ner_model_revision';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

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
let currentRevision: string | undefined;
let initGate: Promise<void> | null = null;

async function clearModelCache(): Promise<void> {
  const keys = await caches.keys();
  for (const key of keys) {
    await caches.delete(key);
  }
  nerPipeline = null;
  loading = null;
  loadFailed = false;
}

async function fetchLatestRevision(): Promise<string | undefined> {
  try {
    const res = await fetch(HF_API_URL, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const data = await res.json();
    return (data.sha as string) || undefined;
  } catch {
    return undefined;
  }
}

async function checkModelUpdate(): Promise<void> {
  try {
    const res = await fetch(HF_VERSION_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('[PII-NER] version.json fetch failed:', res.status);
      return;
    }

    const data = await res.json();
    const latestVersion = data.version as string;
    if (!latestVersion) {
      console.warn('[PII-NER] version.json missing version field');
      return;
    }

    const cachedVersion = localStorage.getItem(MODEL_VERSION_KEY);

    if (!cachedVersion || cachedVersion !== latestVersion) {
      console.debug(`[PII-NER] Model update: ${cachedVersion ?? 'none'} → ${latestVersion}`);

      const sha = await fetchLatestRevision();
      if (sha) {
        currentRevision = sha;
        console.debug(`[PII-NER] Using revision: ${sha}`);
      }

      await clearModelCache();
      localStorage.setItem(MODEL_VERSION_KEY, latestVersion);
      localStorage.setItem(MODEL_REVISION_KEY, currentRevision ?? '');
    } else {
      currentRevision = localStorage.getItem(MODEL_REVISION_KEY) || undefined;
    }
  } catch (err) {
    console.error('[PII-NER] checkModelUpdate error:', err);
  }
}

async function loadModel(): Promise<NerPipeline> {
  if (nerPipeline) return nerPipeline;
  if (loadFailed) throw new Error('Model previously failed to load');
  if (loading) return loading;

  loading = (async () => {
    const opts: Record<string, unknown> = { device: 'wasm', dtype: 'q8' };
    if (currentRevision) opts.revision = currentRevision;

    console.debug('[PII-NER] Loading model:', HF_MODEL_ID, currentRevision ? `@${currentRevision.slice(0, 8)}` : '@main');

    try {
      const pipe = await pipeline('token-classification', HF_MODEL_ID, opts);
      nerPipeline = pipe as unknown as NerPipeline;
      console.debug('[PII-NER] Model loaded successfully');
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
  if (initGate) await initGate;

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

async function periodicUpdateCheck(): Promise<void> {
  const prevVersion = localStorage.getItem(MODEL_VERSION_KEY);

  try {
    const res = await fetch(HF_VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const latestVersion = data.version as string;
    if (!latestVersion || latestVersion === prevVersion) return;

    console.debug(`[PII-NER] Periodic check: update found ${prevVersion} → ${latestVersion}`);

    const sha = await fetchLatestRevision();
    if (sha) currentRevision = sha;

    await clearModelCache();
    localStorage.setItem(MODEL_VERSION_KEY, latestVersion);
    localStorage.setItem(MODEL_REVISION_KEY, currentRevision ?? '');

    await loadModel();
    console.debug('[PII-NER] Hot-reload complete');
  } catch (err) {
    console.error('[PII-NER] Periodic update check error:', err);
  }
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
          console.error('[PII-NER] Inference error:', err);
          sendResponse({ requestId: message.requestId, entities: [], error: String(err) });
        });
      return true;
    }

    return false;
  }
);

initGate = checkModelUpdate()
  .then(() => loadModel())
  .then(() => { initGate = null; })
  .catch((err) => {
    console.error('[PII-NER] Model preload failed:', err);
    initGate = null;
  });

setInterval(() => { periodicUpdateCheck(); }, CHECK_INTERVAL_MS);
