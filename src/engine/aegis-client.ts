// ── AEGIS Server API Client ──────────────────────────────────────────────────
// Calls AEGIS backend APIs for server-side judgment. Server verdicts are
// authoritative — local scan only serves as a fallback when the server is
// unreachable. Network failures gracefully degrade to local-only results.

import type { AegisServerConfig, AegisServerResult, AegisEndpointDetail, AegisUsageInfo, AegisVersionMap } from './types';

// ── /v1/judge ───────────────────────────────────────────────────────────────

interface JudgeRequest {
  prompt: string;
  metadata?: {
    site: string;
    local_score: number;
    local_categories: string[];
  };
}

interface JudgeRisk {
  label: string;
  severity: string;
  description?: string;
  score?: number;
  categories?: string[];
}

interface JudgeResponse {
  id: string;
  decision: 'Approve' | 'Modify' | 'Block' | 'Escalate' | 'Reask' | 'Throttle';
  confidence: number;
  risks: JudgeRisk[];
  layers: unknown[];
  latency_ms?: number;
}

// ── /v2/jailbreak/detect ────────────────────────────────────────────────────

interface JailbreakMatch {
  type: string;
  pattern: string;
  matched_text: string;
  confidence: number;
  severity: string;
  metadata?: unknown;
}

interface JailbreakDetectResponse {
  is_jailbreak: boolean;
  confidence: number;
  primary_type?: string;
  matches: JailbreakMatch[];
  latency_ms: number;
}

// ── /v2/safety/check ────────────────────────────────────────────────────────

interface SafetyCheckResponse {
  is_safe: boolean;
  category: string;
  categories: string[];
  flags: string[];
  confidence: number;
  scores: Record<string, number>;
  backend: string;
  latency_ms: number;
  overall_score: number;
  flagged_categories: string[];
}

// ── /v2/classify ─────────────────────────────────────────────────────────────

interface ClassifyResponse {
  category: string;
  categories: Array<{ name: string; confidence: number }>;
  confidence: number;
  latency_ms: number;
}

// ── /v3/korean/analyze ───────────────────────────────────────────────────────

interface KoreanAnalyzeResponse {
  is_safe: boolean;
  risk_score: number;
  categories: string[];
  details: Array<{ type: string; description: string; severity: string }>;
  latency_ms: number;
}

// ── /v1/usage ───────────────────────────────────────────────────────────────

interface UsageApiResponse {
  quota: { allocated: number; used: number; remaining: number };
  daily: Array<{ date: string; calls: number }>;
  by_version: Record<string, number>;
  by_endpoint: Array<{ endpoint: string; calls: number }>;
  overage: { allowed: boolean; rate: number };
  period: { start: string; end: string };
}

// Decision → score mapping. confidence is 0–1 where lower = riskier for
// non-Approve decisions, so we use fixed scores per decision type.
const DECISION_SCORES: Record<string, number> = {
  Approve: 0,
  Modify: 30,
  Reask: 40,
  Throttle: 50,
  Escalate: 60,
  Block: 80,
};

export type NetworkLogEntry = {
  method: 'GET' | 'POST';
  url: string;
  status: number | null;
  ok: boolean;
  latencyMs: number;
  error?: string;
  requestBody?: unknown;
  responseBody?: unknown;
};

// Endpoint → API version mapping
const ENDPOINT_VERSION: Record<string, string> = {
  judge: 'v1',
  jailbreakDetect: 'v2',
  safetyCheck: 'v2',
  classify: 'v2',
  koreanAnalyze: 'v3',
};

export class AegisClient {
  private config: AegisServerConfig;
  private abortController: AbortController | null = null;
  private _versionAccess: AegisVersionMap = {};
  onNetworkLog?: (entry: NetworkLogEntry) => void;

  constructor(config: AegisServerConfig) {
    this.config = config;
  }

  updateConfig(config: AegisServerConfig) {
    const keyChanged = config.apiKey !== this.config.apiKey || config.baseUrl !== this.config.baseUrl;
    this.config = config;
    if (keyChanged) this._versionAccess = {};
  }

  get isEnabled(): boolean {
    return this.config.enabled && !!this.config.baseUrl && !!this.config.apiKey;
  }

  cancel() {
    this.abortController?.abort();
    this.abortController = null;
  }

  async scan(
    content: string,
    site: string,
    localScore: number,
    localCategories: string[],
  ): Promise<AegisServerResult> {
    if (!this.isEnabled) {
      return unavailable('disabled');
    }

    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const results: AegisServerResult[] = [];
    const promises: Promise<void>[] = [];
    const va = this._versionAccess;

    const canCall = (endpoint: string): boolean => {
      const version = ENDPOINT_VERSION[endpoint];
      return !version || va[version] !== 'denied';
    };

    if (this.config.endpoints.judge && canCall('judge')) {
      promises.push(
        this.callJudge(content, site, localScore, localCategories, signal)
          .then(r => { results.push(r); }),
      );
    }

    if (this.config.endpoints.jailbreakDetect && canCall('jailbreakDetect')) {
      promises.push(
        this.callJailbreakDetect(content, signal)
          .then(r => { results.push(r); }),
      );
    }

    if (this.config.endpoints.safetyCheck && canCall('safetyCheck')) {
      promises.push(
        this.callSafetyCheck(content, signal)
          .then(r => { results.push(r); }),
      );
    }

    if (this.config.endpoints.classify && canCall('classify')) {
      promises.push(
        this.callClassify(content, signal)
          .then(r => { results.push(r); }),
      );
    }

    if (this.config.endpoints.koreanAnalyze && canCall('koreanAnalyze')) {
      promises.push(
        this.callKoreanAnalyze(content, signal)
          .then(r => { results.push(r); }),
      );
    }

    if (promises.length === 0) {
      return unavailable('no-endpoints');
    }

    await Promise.allSettled(promises);

    const available = results.filter(r => r.available);
    if (available.length === 0) {
      return unavailable('all-failed');
    }

    // Merge: take the highest-risk result across all endpoints
    const merged = available.reduce((best, cur) =>
      cur.score > best.score ? cur : best,
    );

    const allCategories = [...new Set(available.flatMap(r => r.categories))];
    const totalLatency = available.reduce((sum, r) => Math.max(sum, r.latencyMs), 0);

    const endpointDetails: AegisEndpointDetail[] = available.map(r => ({
      endpoint: r.endpoint,
      action: r.action,
      score: r.score,
      categories: r.categories,
      explanation: r.explanation,
      latencyMs: r.latencyMs,
    }));

    return {
      available: true,
      score: merged.score,
      action: merged.action,
      categories: allCategories,
      explanation: available.map(r => r.explanation).filter(Boolean).join(' | '),
      latencyMs: totalLatency,
      endpoint: available.map(r => r.endpoint).join('+'),
      endpointDetails,
    };
  }

  // ── Individual endpoint callers ─────────────────────────────────────────

  private async callJudge(
    content: string,
    site: string,
    localScore: number,
    localCategories: string[],
    signal: AbortSignal,
  ): Promise<AegisServerResult> {
    const t0 = performance.now();
    try {
      const body: JudgeRequest = {
        prompt: content,
        metadata: { site, local_score: localScore, local_categories: localCategories },
      };

      const res = await this.fetchPost('/v1/judge', body as unknown as Record<string, unknown>, signal);
      const data = res as JudgeResponse;

      const baseScore = DECISION_SCORES[data.decision] ?? 50;
      // For non-Approve decisions, boost score by risk severity
      const maxRiskScore = Math.max(0, ...data.risks.map(r => (r.score ?? 0) * 100));
      const score = data.decision === 'Approve'
        ? 0
        : Math.min(Math.max(baseScore, Math.round(maxRiskScore)), 100);

      const categories = data.risks.flatMap(r =>
        [r.label, ...(r.categories ?? [])],
      ).filter(Boolean);

      const explanation = data.risks
        .map(r => r.description ?? `${r.label} (${r.severity})`)
        .join('; ');

      return {
        available: true,
        score,
        action: data.decision,
        categories: [...new Set(categories)],
        explanation: explanation || data.decision,
        latencyMs: performance.now() - t0,
        endpoint: '/v1/judge',
      };
    } catch (err) {
      console.warn('[Aegis Client] /v1/judge failed:', err);
      return { ...unavailable('/v1/judge-error'), latencyMs: performance.now() - t0 };
    }
  }

  private async callJailbreakDetect(
    content: string,
    signal: AbortSignal,
  ): Promise<AegisServerResult> {
    const t0 = performance.now();
    try {
      const res = await this.fetchPost('/v2/jailbreak/detect', { text: content }, signal);
      const data = res as JailbreakDetectResponse;

      const score = data.is_jailbreak ? Math.round(data.confidence * 80) : 0;
      const categories: string[] = data.is_jailbreak
        ? ['jailbreak', data.primary_type, ...data.matches.map(m => m.type)].filter((v): v is string => !!v)
        : [];

      const explanation = data.is_jailbreak
        ? `Jailbreak: ${data.primary_type ?? 'unknown'} (conf: ${data.confidence.toFixed(2)})`
        : '';

      return {
        available: true,
        score,
        action: data.is_jailbreak ? 'Block' : 'Approve',
        categories: [...new Set(categories)],
        explanation,
        latencyMs: performance.now() - t0,
        endpoint: '/v2/jailbreak/detect',
      };
    } catch (err) {
      console.warn('[Aegis Client] /v2/jailbreak/detect failed:', err);
      return { ...unavailable('/v2/jailbreak-error'), latencyMs: performance.now() - t0 };
    }
  }

  private async callSafetyCheck(
    content: string,
    signal: AbortSignal,
  ): Promise<AegisServerResult> {
    const t0 = performance.now();
    try {
      const res = await this.fetchPost('/v2/safety/check', { text: content }, signal);
      const data = res as SafetyCheckResponse;

      const score = data.is_safe ? 0 : Math.round(data.overall_score * 100);

      return {
        available: true,
        score,
        action: data.is_safe ? 'Approve' : 'Block',
        categories: [...new Set([...data.flagged_categories, ...data.categories])],
        explanation: data.is_safe ? '' : `Unsafe: ${data.flagged_categories.join(', ')} (${data.category})`,
        latencyMs: performance.now() - t0,
        endpoint: '/v2/safety/check',
      };
    } catch (err) {
      console.warn('[Aegis Client] /v2/safety/check failed:', err);
      return { ...unavailable('/v2/safety-error'), latencyMs: performance.now() - t0 };
    }
  }

  private async callClassify(
    content: string,
    signal: AbortSignal,
  ): Promise<AegisServerResult> {
    const t0 = performance.now();
    try {
      const res = await this.fetchPost('/v2/classify', { text: content }, signal);
      const data = res as ClassifyResponse;

      const topCategory = data.categories?.[0];
      const score = topCategory
        ? Math.round(topCategory.confidence * 100)
        : 0;

      const categories = data.categories
        ?.map(c => c.name)
        .filter(Boolean) ?? [];

      return {
        available: true,
        score: Math.min(score, 100),
        action: data.category ?? 'unknown',
        categories: [...new Set(categories)],
        explanation: `Classification: ${data.category} (conf: ${(data.confidence ?? 0).toFixed(2)})`,
        latencyMs: performance.now() - t0,
        endpoint: '/v2/classify',
      };
    } catch (err) {
      console.warn('[Aegis Client] /v2/classify failed:', err);
      return { ...unavailable('/v2/classify-error'), latencyMs: performance.now() - t0 };
    }
  }

  private async callKoreanAnalyze(
    content: string,
    signal: AbortSignal,
  ): Promise<AegisServerResult> {
    const t0 = performance.now();
    try {
      const res = await this.fetchPost('/v3/korean/analyze', { text: content }, signal);
      const data = res as KoreanAnalyzeResponse;

      const score = data.is_safe ? 0 : Math.round((data.risk_score ?? 0) * 100);
      const categories = data.categories ?? [];
      const explanation = data.is_safe
        ? ''
        : data.details?.map(d => `${d.type}: ${d.description}`).join('; ') ?? '';

      return {
        available: true,
        score: Math.min(score, 100),
        action: data.is_safe ? 'Approve' : 'Block',
        categories: [...new Set(categories)],
        explanation,
        latencyMs: performance.now() - t0,
        endpoint: '/v3/korean/analyze',
      };
    } catch (err) {
      console.warn('[Aegis Client] /v3/korean/analyze failed:', err);
      return { ...unavailable('/v3/korean-error'), latencyMs: performance.now() - t0 };
    }
  }

  // ── Usage / Quota ───────────────────────────────────────────────────────

  async fetchUsage(): Promise<AegisUsageInfo | null> {
    if (!this.isEnabled) return null;

    try {
      const data = await this.fetchGet('/v1/usage') as UsageApiResponse;

      return {
        allocated: data.quota.allocated,
        used: data.quota.used,
        remaining: data.quota.remaining,
        percentUsed: data.quota.allocated > 0
          ? Math.round((data.quota.used / data.quota.allocated) * 100)
          : 0,
        overageAllowed: data.overage?.allowed ?? false,
        period: data.period,
        byEndpoint: data.by_endpoint ?? [],
      };
    } catch (err) {
      console.warn('[Aegis Client] /v1/usage failed:', err);
      return null;
    }
  }

  // ── Version Access Probe ────────────────────────────────────────────────

  async probeVersionAccess(): Promise<AegisVersionMap> {
    if (!this.isEnabled) return { v1: 'unknown', v2: 'unknown', v3: 'unknown' };

    const probes: Array<{ version: string; path: string; body: Record<string, unknown> }> = [
      { version: 'v1', path: '/v1/judge', body: { prompt: '_access_check' } },
      { version: 'v2', path: '/v2/classify', body: { text: '_access_check' } },
      { version: 'v3', path: '/v3/korean/analyze', body: { text: '_access_check' } },
    ];

    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const access: AegisVersionMap = {};

    await Promise.allSettled(probes.map(async ({ version, path, body }) => {
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Source': 'aegis-personal',
          },
          body: JSON.stringify(body),
        });
        if (res.status === 403) {
          const data = await res.json().catch(() => null) as { code?: string } | null;
          access[version] = data?.code === 'API_VERSION_DENIED' ? 'denied' : 'allowed';
        } else {
          access[version] = 'allowed';
        }
      } catch {
        access[version] = 'unknown';
      }
    }));

    // Cascading: plan tiers are cumulative (v1 ⊂ v2 ⊂ v3).
    // If a lower version is denied, higher versions must also be denied.
    if (access.v1 === 'denied') {
      access.v2 = 'denied';
      access.v3 = 'denied';
    } else if (access.v2 === 'denied') {
      access.v3 = 'denied';
    }

    this._versionAccess = access;
    return access;
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────

  private async fetchPost(
    endpoint: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${endpoint}`;
    const timeoutId = setTimeout(() => this.cancel(), this.config.timeoutMs);
    const t0 = performance.now();
    let logged = false;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Source': 'aegis-personal',
        },
        body: JSON.stringify(body),
        signal,
      });

      let responseBody: unknown;
      try { responseBody = await response.json(); } catch { responseBody = null; }
      logged = true;
      this.onNetworkLog?.({
        method: 'POST', url, status: response.status, ok: response.ok,
        latencyMs: performance.now() - t0, requestBody: body, responseBody,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return responseBody;
    } catch (err) {
      if (!logged) {
        this.onNetworkLog?.({
          method: 'POST', url, status: null, ok: false,
          latencyMs: performance.now() - t0, requestBody: body, error: String(err),
        });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchGet(endpoint: string): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${endpoint}`;
    const t0 = performance.now();
    let logged = false;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey,
          'X-Source': 'aegis-personal',
        },
      });

      let responseBody: unknown;
      try { responseBody = await response.json(); } catch { responseBody = null; }
      logged = true;
      this.onNetworkLog?.({
        method: 'GET', url, status: response.status, ok: response.ok,
        latencyMs: performance.now() - t0, responseBody,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return responseBody;
    } catch (err) {
      if (!logged) {
        this.onNetworkLog?.({
          method: 'GET', url, status: null, ok: false,
          latencyMs: performance.now() - t0, error: String(err),
        });
      }
      throw err;
    }
  }
}

function unavailable(reason: string): AegisServerResult {
  return {
    available: false,
    score: 0,
    action: '',
    categories: [],
    explanation: reason,
    latencyMs: 0,
    endpoint: '',
  };
}

// ── Hybrid Score Merger ─────────────────────────────────────────────────────
// Server-authoritative: when AEGIS server responds, its verdict is the final
// authority. Local scan is only used as a pre-filter (to avoid expensive
// server calls for obviously safe input) and as a fallback when server is
// unavailable.

export function mergeHybridScore(
  localScore: number,
  serverResult: AegisServerResult,
): { score: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  if (!serverResult.available) {
    return { score: localScore, level: scoreToLevel(localScore) };
  }

  // Server is authoritative — use its score directly
  const finalScore = Math.min(serverResult.score, 100);
  return { score: finalScore, level: scoreToLevel(finalScore) };
}

function scoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}
