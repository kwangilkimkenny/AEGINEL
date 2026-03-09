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

// ── Weekly Stats (for reporting & share) ────────────────────────────────

export interface WeeklyStats {
  weekStart: number;       // timestamp of Monday 00:00
  totalScans: number;
  threatsBlocked: number;
  piiProtected: number;
  topCategories: Record<string, number>;  // category → count
  siteBreakdown: Record<string, number>;  // site → scan count
}

function getWeekStart(): number {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

export async function getWeeklyStats(): Promise<WeeklyStats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEEKLY_STATS);
  const stored = result[STORAGE_KEYS.WEEKLY_STATS] as WeeklyStats | undefined;
  const currentWeek = getWeekStart();

  // Reset if it's a new week
  if (!stored || stored.weekStart !== currentWeek) {
    const fresh: WeeklyStats = {
      weekStart: currentWeek,
      totalScans: 0,
      threatsBlocked: 0,
      piiProtected: 0,
      topCategories: {},
      siteBreakdown: {},
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.WEEKLY_STATS]: fresh });
    return fresh;
  }
  return stored;
}

export async function updateWeeklyStats(
  update: {
    scans?: number;
    blocked?: number;
    pii?: number;
    categories?: string[];
    site?: string;
  },
): Promise<void> {
  const stats = await getWeeklyStats();

  if (update.scans) stats.totalScans += update.scans;
  if (update.blocked) stats.threatsBlocked += update.blocked;
  if (update.pii) stats.piiProtected += update.pii;

  if (update.categories) {
    for (const cat of update.categories) {
      stats.topCategories[cat] = (stats.topCategories[cat] ?? 0) + 1;
    }
  }

  if (update.site) {
    stats.siteBreakdown[update.site] = (stats.siteBreakdown[update.site] ?? 0) + 1;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.WEEKLY_STATS]: stats });
}
