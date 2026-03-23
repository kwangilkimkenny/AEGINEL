// ── Aegis Personal Extension Engine Types ──────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

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
  totalLatencyMs: number;
  piiDetected: PiiMatch[];
  localScore?: number;
  serverAvailable?: boolean;
  serverScore?: number;
  serverAction?: string;
  serverEndpoint?: string;
  serverLatencyMs?: number;
  serverCategories?: string[];
  serverExplanation?: string;
  endpointDetails?: AegisEndpointDetail[];
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
  | 'passport'         // 여권번호
  // NER model entity types
  | 'givenname'        // 이름
  | 'surname'          // 성
  | 'username'         // 사용자명
  | 'dateofbirth'      // 생년월일
  | 'idcard'           // 신분증번호
  | 'street'           // 도로명
  | 'city'             // 도시
  | 'zipcode'          // 우편번호
  | 'buildingnum'      // 건물번호
  | 'ip_address'       // IP 주소
  | 'password'         // 비밀번호
  | 'accountnum'       // 계좌번호
  | 'driverlicensenum' // 운전면허번호
  | 'company';         // 회사명

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

export interface AegisEndpointDetail {
  endpoint: string;
  action: string;
  score: number;
  categories: string[];
  explanation: string;
  latencyMs: number;
}

export interface AegisServerResult {
  available: boolean;
  score: number;
  action: string;
  categories: string[];
  explanation: string;
  latencyMs: number;
  endpoint: string;
  endpointDetails?: AegisEndpointDetail[];
}

export interface DevLogEntry {
  timestamp: number;
  type: 'scan' | 'aegis' | 'health' | 'error';
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

export interface HealthEntry {
  source: string;
  status: 'ok' | 'degraded' | 'error';
  details?: string;
  brokenSelectors?: string[];
  timestamp: number;
}

export type VersionAccess = 'allowed' | 'denied' | 'unknown';
export type AegisVersionMap = Record<string, VersionAccess>;

export type UiLanguage = 'auto' | 'en' | 'ko' | 'es';

export interface AeginelConfig {
  enabled: boolean;
  uiLanguage: UiLanguage;
  pii: {
    enabled: boolean;
    types: Record<PiiType, boolean>;
  };
  piiProxy: PiiProxyConfig;
  blockThreshold: number; // 0-100, default 60
  language: string; // 'auto' | SupportedLocale code — input detection language
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
  uiLanguage: 'auto',
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
      givenname: true,
      surname: true,
      username: true,
      dateofbirth: true,
      idcard: true,
      street: true,
      city: true,
      zipcode: true,
      buildingnum: true,
      ip_address: true,
      password: true,
      accountnum: true,
      driverlicensenum: true,
      company: true,
    },
  },
  piiProxy: {
    enabled: true,
    mode: 'auto',
    showNotification: true,
  },
  blockThreshold: 60,
  language: 'auto',
  allowlist: [],
  aegisServer: DEFAULT_AEGIS_SERVER_CONFIG,
  devMode: false,
};
