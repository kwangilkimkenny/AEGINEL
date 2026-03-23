// ── Aegis Personal Extension Engine Types ──────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LayerResult {
  id: number;
  name: string;
  score: number;
  maxScore: number;
  detected: boolean;
  categories: string[];
  latencyMs: number;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  input: string;
  site: string;
  score: number;
  level: RiskLevel;
  categories: string[];
  explanation: string;
  blocked: boolean;
  layers: LayerResult[];
  totalLatencyMs: number;
  piiDetected: PiiMatch[];
}

export interface PiiMatch {
  type: PiiType;
  value: string;       // masked (e.g., "880101-1***567")
  startIndex: number;
  endIndex: number;
}

export type PiiType =
  | 'korean_rrn'       // 주민등록번호
  | 'credit_card'      // 카드번호
  | 'email'            // 이메일
  | 'phone_kr'         // 한국 전화번호
  | 'phone_intl'       // 국제 전화번호
  | 'ssn'              // US SSN
  | 'passport';        // 여권번호

export interface PiiMapping {
  original: string;
  pseudonym: string;
  type: PiiType;
  position: { start: number; end: number };
}

export interface ProxyResult {
  originalText: string;
  proxiedText: string;
  mappings: PiiMapping[];
  piiCount: number;
}

export interface PiiProxyConfig {
  enabled: boolean;
  mode: 'auto' | 'confirm';
  showNotification: boolean;
}

export interface AegisServerConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  /** Timeout in ms for AEGIS API calls */
  timeoutMs: number;
  /** Which AEGIS endpoints to call */
  endpoints: {
    judge: boolean;
    jailbreakDetect: boolean;
    safetyCheck: boolean;
    classify: boolean;
    koreanAnalyze: boolean;
  };
}

export interface AegisServerResult {
  available: boolean;
  score: number;
  action: string;
  categories: string[];
  explanation: string;
  latencyMs: number;
  endpoint: string;
}

export interface DevLogEntry {
  timestamp: number;
  type: 'scan' | 'aegis' | 'ml' | 'health' | 'error';
  summary: string;
  details?: Record<string, unknown>;
}

export interface AegisUsageInfo {
  allocated: number;
  used: number;
  remaining: number;
  percentUsed: number;
  overageAllowed: boolean;
  period: { start: string; end: string };
  byEndpoint: Array<{ endpoint: string; calls: number }>;
}

export interface AeginelConfig {
  enabled: boolean;
  layers: {
    basicKeywords: boolean;
    jailbreak: boolean;
    injection: boolean;
    extraction: boolean;
    socialEngineering: boolean;
    koreanEvasion: boolean;
    encodingAttacks: boolean;
    multiTurn: boolean;
    semanticRisk: boolean;
  };
  pii: {
    enabled: boolean;
    types: Record<PiiType, boolean>;
  };
  piiProxy: PiiProxyConfig;
  sensitivity: number;  // 0.5 - 2.0 multiplier
  blockThreshold: number; // 0-100, default 60
  language: string; // 'auto' | SupportedLocale code
  allowlist: string[]; // domains to skip scanning
  aegisServer: AegisServerConfig;
  devMode: boolean;
}

export const DEFAULT_AEGIS_SERVER_CONFIG: AegisServerConfig = {
  enabled: false,
  baseUrl: 'https://api.aiaegis.io',
  apiKey: '',
  timeoutMs: 5000,
  endpoints: {
    judge: true,
    jailbreakDetect: false,
    safetyCheck: false,
    classify: false,
    koreanAnalyze: false,
  },
};

export const DEFAULT_CONFIG: AeginelConfig = {
  enabled: true,
  layers: {
    basicKeywords: true,
    jailbreak: true,
    injection: true,
    extraction: true,
    socialEngineering: true,
    koreanEvasion: true,
    encodingAttacks: true,
    multiTurn: true,
    semanticRisk: true,
  },
  pii: {
    enabled: true,
    types: {
      korean_rrn: true,
      credit_card: true,
      email: true,
      phone_kr: true,
      phone_intl: true,
      ssn: true,
      passport: true,
    },
  },
  piiProxy: {
    enabled: true,
    mode: 'auto',
    showNotification: true,
  },
  sensitivity: 1.0,
  blockThreshold: 60,
  language: 'auto',
  allowlist: [],
  aegisServer: DEFAULT_AEGIS_SERVER_CONFIG,
  devMode: false,
};
