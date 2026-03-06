// ── AEGINEL Service Worker ─────────────────────────────────────────────────
// Hosts the detection engine, handles messages, manages badge + history.

import { scan } from '../engine/detector';
import { mergeConfig } from '../engine/config';
import { DEFAULT_CONFIG } from '../engine/types';
import type { AeginelConfig, ScanResult } from '../engine/types';
import { PiiProxyEngine } from '../engine/pii-proxy';
import type { ExtensionMessage } from '../shared/messages';
import { MAX_HISTORY_ITEMS } from '../shared/constants';
import { getConfig, setConfig, getScanHistory, setScanHistory, getStats, setStats } from '../shared/storage';

// ── State ────────────────────────────────────────────────────────────────

let currentConfig: AeginelConfig = DEFAULT_CONFIG;
let lastScan: ScanResult | null = null;
const proxyEngine = new PiiProxyEngine();
let totalPiiProtected = 0;

// ── Init ─────────────────────────────────────────────────────────────────

async function initialize() {
  const stored = await getConfig();
  if (stored) {
    currentConfig = mergeConfig(stored);
  } else {
    await setConfig(DEFAULT_CONFIG);
  }
  updateBadge(null);
}

initialize();

// ── Message Handler ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // async response
  }
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'SCAN_INPUT': {
      const { input, site } = message.payload;
      const result = scan(input, site, currentConfig);
      lastScan = result;

      // Save to history
      const history = await getScanHistory();
      history.unshift(result);
      if (history.length > MAX_HISTORY_ITEMS) history.length = MAX_HISTORY_ITEMS;
      await setScanHistory(history);

      // Update stats
      const stats = await getStats();
      stats.totalScans++;
      if (result.blocked) stats.threatsBlocked++;
      await setStats(stats);

      // Update badge
      updateBadge(result);

      return { type: 'SCAN_RESULT', payload: result };
    }

    case 'PROXY_INPUT': {
      const { text, site, sessionId } = message.payload;
      const result = proxyEngine.pseudonymize(text, currentConfig, sessionId);
      totalPiiProtected += result.piiCount;
      return {
        originalText: result.originalText,
        proxiedText: result.proxiedText,
        mappings: result.mappings,
        piiCount: result.piiCount,
      };
    }

    case 'RESTORE_RESPONSE': {
      const { text, sessionId } = message.payload;
      const restoredText = proxyEngine.restore(text, sessionId);
      return { restoredText };
    }

    case 'GET_PROXY_STATS': {
      return { totalProtected: totalPiiProtected };
    }

    case 'GET_STATUS': {
      const stats = await getStats();
      return {
        type: 'STATUS_RESPONSE',
        payload: {
          enabled: currentConfig.enabled,
          totalScans: stats.totalScans,
          threatsBlocked: stats.threatsBlocked,
          lastScan,
        },
      };
    }

    case 'GET_CONFIG': {
      return { type: 'CONFIG_RESPONSE', payload: currentConfig };
    }

    case 'UPDATE_CONFIG': {
      currentConfig = mergeConfig(message.payload);
      await setConfig(currentConfig);
      return { type: 'CONFIG_RESPONSE', payload: currentConfig };
    }

    case 'GET_HISTORY': {
      const history = await getScanHistory();
      return { type: 'HISTORY_RESPONSE', payload: history };
    }

    case 'CLEAR_HISTORY': {
      await setScanHistory([]);
      const stats = await getStats();
      stats.totalScans = 0;
      stats.threatsBlocked = 0;
      await setStats(stats);
      lastScan = null;
      updateBadge(null);
      return { type: 'HISTORY_RESPONSE', payload: [] };
    }

    default:
      return null;
  }
}

// ── Badge ────────────────────────────────────────────────────────────────

function updateBadge(result: ScanResult | null) {
  if (!result || result.score === 0) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    return;
  }

  const { score, level } = result;
  const colors: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };

  chrome.action.setBadgeText({ text: String(score) });
  chrome.action.setBadgeBackgroundColor({ color: colors[level] || '#22c55e' });
}
