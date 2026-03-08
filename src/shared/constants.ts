// ── Site URLs ────────────────────────────────────────────────────────────

export const SUPPORTED_SITES = [
  { id: 'chatgpt', name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'] },
  { id: 'claude', name: 'Claude', hosts: ['claude.ai'] },
  { id: 'gemini', name: 'Gemini', hosts: ['gemini.google.com'] },
] as const;

export type SiteId = typeof SUPPORTED_SITES[number]['id'];

// ── Storage Keys ─────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  CONFIG: 'aeginel_config',
  SCAN_HISTORY: 'aeginel_scan_history',
  STATS: 'aeginel_stats',
} as const;

// ── Limits ───────────────────────────────────────────────────────────────

export const MAX_HISTORY_ITEMS = 50;
export const DEBOUNCE_MS = 300;
export const INPUT_MIN_LENGTH = 5;
