// ── PII NER Offscreen Document ─────────────────────────────────────────────────
// Runs mBERT PII-NER ONNX model inference in an offscreen document context,
// which supports WASM and avoids service worker lifecycle limitations.

import { env, pipeline } from '@huggingface/transformers';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.useFSCache = false;

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

async function loadModel(): Promise<NerPipeline> {
  if (nerPipeline) return nerPipeline;
  if (loading) return loading;

  loading = (async () => {
    const modelUrl = chrome.runtime.getURL('models/pii-ner/');

    const pipe = await pipeline('token-classification', modelUrl, {
      local_files_only: true,
      device: 'wasm',
      dtype: 'fp32',
    });

    nerPipeline = pipe as unknown as NerPipeline;
    return nerPipeline;
  })();

  return loading;
}

async function runInference(text: string): Promise<NerEntity[]> {
  const pipe = await loadModel();

  const rawOutput = await pipe(text, { aggregation_strategy: 'simple' });

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
      start: r.start as number,
      end: r.end as number,
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

loadModel().catch((err) => {
  console.error('[PII-NER Offscreen] Model preload failed:', err);
});
