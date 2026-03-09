// ── AEGINEL Enterprise Admin API ────────────────────────────────────────────
// API client for centralized policy management, audit logging, and
// fleet-wide configuration. This module is the bridge between the
// browser extension and an enterprise admin server.
//
// The API is designed to work with or without a server connection:
// - Offline: extension uses local config (DEFAULT_CONFIG)
// - Online: extension fetches policy from admin server + reports telemetry
//
// All communication uses JSON over HTTPS. No raw prompt text is ever sent
// to the server — only anonymized metadata (categories, scores, PII counts).

export interface AdminApiConfig {
  /** Admin server base URL (e.g., https://admin.aeginel.com/api/v1) */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Organization ID */
  orgId: string;
  /** Device/user identifier (hash, not PII) */
  deviceId: string;
  /** Whether enterprise mode is active */
  enabled: boolean;
}

export const DEFAULT_ADMIN_CONFIG: AdminApiConfig = {
  baseUrl: '',
  apiKey: '',
  orgId: '',
  deviceId: '',
  enabled: false,
};

// ── Policy Types ────────────────────────────────────────────────────────

export interface EnterprisePolicy {
  /** Policy version for cache invalidation */
  version: number;
  /** Global kill switch — disables extension for all users */
  forceDisabled: boolean;
  /** Override block threshold for the entire org */
  blockThreshold: number;
  /** Override sensitivity multiplier */
  sensitivity: number;
  /** Enforced detection layers (users cannot disable these) */
  enforcedLayers: string[];
  /** Sites blocked entirely (extension won't activate) */
  blockedSites: string[];
  /** Sites where PII proxy is mandatory */
  mandatoryPiiSites: string[];
  /** Custom blocked keyword patterns (added to Layer 1) */
  customKeywords: string[];
  /** Minimum PII proxy mode ('auto' | 'confirm') */
  minPiiProxyMode: 'auto' | 'confirm';
  /** Whether to report scan telemetry to admin server */
  reportTelemetry: boolean;
}

// ── Telemetry Types (no raw text ever sent) ─────────────────────────────

export interface ScanTelemetry {
  timestamp: number;
  site: string;
  score: number;
  level: string;
  categories: string[];
  blocked: boolean;
  piiCount: number;
  /** Rule-only score vs hybrid score */
  ruleScore: number;
  mlScore: number;
  latencyMs: number;
}

export interface AuditEvent {
  timestamp: number;
  type: 'scan' | 'block' | 'override' | 'pii_mask' | 'config_change';
  details: Record<string, unknown>;
  deviceId: string;
}

// ── API Client ──────────────────────────────────────────────────────────

export class AdminApiClient {
  private config: AdminApiConfig;
  private policyCache: EnterprisePolicy | null = null;
  private policyCacheTime = 0;
  private readonly POLICY_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(config: AdminApiConfig) {
    this.config = config;
  }

  get isEnabled(): boolean {
    return this.config.enabled && !!this.config.baseUrl && !!this.config.apiKey;
  }

  // ── Policy Fetch ────────────────────────────────────────────────────

  async fetchPolicy(): Promise<EnterprisePolicy | null> {
    if (!this.isEnabled) return null;

    // Return cache if fresh
    if (this.policyCache && Date.now() - this.policyCacheTime < this.POLICY_TTL_MS) {
      return this.policyCache;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/policy/${this.config.orgId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Device-Id': this.config.deviceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[AEGINEL Admin] Policy fetch failed: ${response.status}`);
        return this.policyCache; // Return stale cache
      }

      this.policyCache = await response.json() as EnterprisePolicy;
      this.policyCacheTime = Date.now();
      return this.policyCache;
    } catch (err) {
      console.warn('[AEGINEL Admin] Policy fetch error:', err);
      return this.policyCache; // Return stale cache on network error
    }
  }

  // ── Telemetry Reporting ─────────────────────────────────────────────

  async reportScan(telemetry: ScanTelemetry): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${this.config.baseUrl}/telemetry/${this.config.orgId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Device-Id': this.config.deviceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(telemetry),
      });
    } catch {
      // Fire-and-forget — telemetry loss is acceptable
    }
  }

  // ── Audit Event ─────────────────────────────────────────────────────

  async reportAuditEvent(event: Omit<AuditEvent, 'deviceId'>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${this.config.baseUrl}/audit/${this.config.orgId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Device-Id': this.config.deviceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          deviceId: this.config.deviceId,
        }),
      });
    } catch {
      // Fire-and-forget
    }
  }

  // ── Health Check ────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ── Policy Merger ───────────────────────────────────────────────────────
// Merges enterprise policy overrides into the user's local config.
// Enterprise settings take precedence (cannot be overridden by user).

import type { AeginelConfig } from '../engine/types';

export function applyEnterprisePolicy(
  localConfig: AeginelConfig,
  policy: EnterprisePolicy,
): AeginelConfig {
  const merged = { ...localConfig };

  // Force disable if policy says so
  if (policy.forceDisabled) {
    merged.enabled = false;
    return merged;
  }

  // Override thresholds (use stricter value)
  merged.blockThreshold = Math.min(localConfig.blockThreshold, policy.blockThreshold);
  merged.sensitivity = Math.max(localConfig.sensitivity, policy.sensitivity);

  // Enforce layers — user cannot disable these
  for (const layer of policy.enforcedLayers) {
    if (layer in merged.layers) {
      (merged.layers as Record<string, boolean>)[layer] = true;
    }
  }

  // Enforce PII proxy mode
  if (policy.minPiiProxyMode === 'confirm') {
    merged.piiProxy.mode = 'confirm';
  }

  // Force PII proxy on mandatory sites
  if (policy.mandatoryPiiSites.length > 0) {
    merged.piiProxy.enabled = true;
  }

  return merged;
}
