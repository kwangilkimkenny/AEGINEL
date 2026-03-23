// ── Aegis Personal PII Detection Engine ───────────────────────────────────────────
// Scans user input for PII exposure. Attack defense is handled by AEGIS server
// (enterprise only).

import type { AeginelConfig, ScanResult, RiskLevel } from './types';
import { DEFAULT_CONFIG } from './types';
import { scanPii } from './pii-scanner';

let scanCounter = 0;

export function scan(input: string, site: string, config: AeginelConfig = DEFAULT_CONFIG): ScanResult {
  const id = `scan-${Date.now()}-${++scanCounter}`;
  const t0 = performance.now();

  if (!config.enabled || !input.trim()) {
    return emptyScanResult(id, input, site);
  }

  const piiDetected = scanPii(input, config);
  const piiScore = Math.min(piiDetected.length * 15, 100);
  const categories: string[] = piiDetected.length > 0 ? ['pii_exposure'] : [];
  const level = scoreToLevel(piiScore);

  return {
    id,
    timestamp: Date.now(),
    input: input.slice(0, 200),
    site,
    score: piiScore,
    level,
    categories,
    explanation: buildExplanation(piiScore, piiDetected.length),
    blocked: piiScore >= config.blockThreshold,
    totalLatencyMs: performance.now() - t0,
    piiDetected,
  };
}

function emptyScanResult(id: string, input: string, site: string): ScanResult {
  return {
    id, timestamp: Date.now(), input: input.slice(0, 200), site,
    score: 0, level: 'low', categories: [], explanation: 'No PII detected.',
    blocked: false, totalLatencyMs: 0, piiDetected: [],
  };
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function buildExplanation(score: number, piiCount: number): string {
  if (piiCount === 0) return 'No PII detected.';
  return `${piiCount} PII item(s) found. Risk: ${score}/100.`;
}
