import type { ScanResult, AeginelConfig } from '../engine/types';

// ── Message Types ────────────────────────────────────────────────────────

export type MessageType =
  | 'SCAN_INPUT'
  | 'SCAN_RESULT'
  | 'GET_STATUS'
  | 'STATUS_RESPONSE'
  | 'UPDATE_CONFIG'
  | 'GET_CONFIG'
  | 'CONFIG_RESPONSE'
  | 'GET_HISTORY'
  | 'HISTORY_RESPONSE'
  | 'CLEAR_HISTORY'
  | 'PROXY_INPUT'
  | 'RESTORE_RESPONSE'
  | 'GET_PROXY_STATS'
  | 'HEALTH_REPORT'
  | 'ML_LOAD_ERROR'
  | 'GET_HEALTH'
  | 'GET_ML_STATUS'
  | 'GET_WEEKLY_REPORT'
  | 'AEGIS_HEALTH_CHECK'
  | 'AEGIS_HEALTH_RESPONSE'
  | 'AEGIS_GET_USAGE'
  | 'AEGIS_USAGE_RESPONSE'
  | 'GET_DEV_LOGS'
  | 'DEV_LOGS_RESPONSE'
  | 'CLEAR_DEV_LOGS'
  | 'SCAN_PROGRESS';

export interface ScanInputMessage {
  type: 'SCAN_INPUT';
  payload: { input: string; site: string };
}

export interface ScanResultMessage {
  type: 'SCAN_RESULT';
  payload: ScanResult;
}

export interface GetStatusMessage {
  type: 'GET_STATUS';
}

export interface StatusResponseMessage {
  type: 'STATUS_RESPONSE';
  payload: {
    enabled: boolean;
    totalScans: number;
    threatsBlocked: number;
    lastScan: ScanResult | null;
  };
}

export interface UpdateConfigMessage {
  type: 'UPDATE_CONFIG';
  payload: Partial<AeginelConfig>;
}

export interface GetConfigMessage {
  type: 'GET_CONFIG';
}

export interface ConfigResponseMessage {
  type: 'CONFIG_RESPONSE';
  payload: AeginelConfig;
}

export interface GetHistoryMessage {
  type: 'GET_HISTORY';
}

export interface HistoryResponseMessage {
  type: 'HISTORY_RESPONSE';
  payload: ScanResult[];
}

export interface ClearHistoryMessage {
  type: 'CLEAR_HISTORY';
}

export interface ProxyInputMessage {
  type: 'PROXY_INPUT';
  payload: { text: string; site: string; sessionId: string };
}

export interface RestoreResponseMessage {
  type: 'RESTORE_RESPONSE';
  payload: { text: string; sessionId: string };
}

export interface GetProxyStatsMessage {
  type: 'GET_PROXY_STATS';
}

export interface HealthReportMessage {
  type: 'HEALTH_REPORT';
  payload: {
    source: string;
    status: 'ok' | 'degraded' | 'error';
    details?: string;
    brokenSelectors?: string[];
    timestamp: number;
  };
}

export interface MlLoadErrorMessage {
  type: 'ML_LOAD_ERROR';
  payload: {
    error: string;
    retryCount: number;
  };
}

export interface GetHealthMessage {
  type: 'GET_HEALTH';
}

export interface GetMlStatusMessage {
  type: 'GET_ML_STATUS';
}

export interface GetWeeklyReportMessage {
  type: 'GET_WEEKLY_REPORT';
}

export interface AegisHealthCheckMessage {
  type: 'AEGIS_HEALTH_CHECK';
}

export interface AegisHealthResponseMessage {
  type: 'AEGIS_HEALTH_RESPONSE';
  payload: {
    enabled: boolean;
    connected: boolean;
    latencyMs: number;
  };
}

export interface AegisGetUsageMessage {
  type: 'AEGIS_GET_USAGE';
}

export interface AegisUsageResponseMessage {
  type: 'AEGIS_USAGE_RESPONSE';
  payload: import('../engine/types').AegisUsageInfo | null;
}

export interface GetDevLogsMessage {
  type: 'GET_DEV_LOGS';
}

export interface DevLogsResponseMessage {
  type: 'DEV_LOGS_RESPONSE';
  payload: import('../engine/types').DevLogEntry[];
}

export interface ClearDevLogsMessage {
  type: 'CLEAR_DEV_LOGS';
}

export type ScanPhase = 'rules' | 'ml' | 'aegis' | 'done';

export interface ScanProgressMessage {
  type: 'SCAN_PROGRESS';
  payload: { phase: ScanPhase; detail: string };
}

export type ExtensionMessage =
  | ScanInputMessage
  | ScanResultMessage
  | GetStatusMessage
  | StatusResponseMessage
  | UpdateConfigMessage
  | GetConfigMessage
  | ConfigResponseMessage
  | GetHistoryMessage
  | HistoryResponseMessage
  | ClearHistoryMessage
  | ProxyInputMessage
  | RestoreResponseMessage
  | GetProxyStatsMessage
  | HealthReportMessage
  | MlLoadErrorMessage
  | GetHealthMessage
  | GetMlStatusMessage
  | GetWeeklyReportMessage
  | AegisHealthCheckMessage
  | AegisHealthResponseMessage
  | AegisGetUsageMessage
  | AegisUsageResponseMessage
  | GetDevLogsMessage
  | DevLogsResponseMessage
  | ClearDevLogsMessage
  | ScanProgressMessage;
