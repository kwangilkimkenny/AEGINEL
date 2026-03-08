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
  | 'GET_HEALTH';

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
  | GetHealthMessage;
