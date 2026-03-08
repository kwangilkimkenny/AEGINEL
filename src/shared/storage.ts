import { STORAGE_KEYS } from './constants';
import type { AeginelConfig, ScanResult } from '../engine/types';

// ── Typed Chrome Storage Wrapper ─────────────────────────────────────────

export async function getConfig(): Promise<AeginelConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
  return result[STORAGE_KEYS.CONFIG] ?? null;
}

export async function setConfig(config: AeginelConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
}

export async function getScanHistory(): Promise<ScanResult[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCAN_HISTORY);
  return result[STORAGE_KEYS.SCAN_HISTORY] ?? [];
}

export async function setScanHistory(history: ScanResult[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SCAN_HISTORY]: history });
}

export interface AeginelStats {
  totalScans: number;
  threatsBlocked: number;
}

export async function getStats(): Promise<AeginelStats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
  return result[STORAGE_KEYS.STATS] ?? { totalScans: 0, threatsBlocked: 0 };
}

export async function setStats(stats: AeginelStats): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}
