// ── Aegis Personal Service Worker ─────────────────────────────────────────────────
// Hosts the detection engine, handles messages, manages badge + history.

import { scan } from '../engine/detector';
import { mergeConfig } from '../engine/config';
import { DEFAULT_CONFIG } from '../engine/types';
import type { AeginelConfig, ScanResult, AegisServerResult, DevLogEntry } from '../engine/types';
import { PiiProxyEngine } from '../engine/pii-proxy';
import { AegisClient, mergeHybridScore } from '../engine/aegis-client';
import type { ExtensionMessage, ScanPhase } from '../shared/messages';
import { MAX_HISTORY_ITEMS } from '../shared/constants';
import { getConfig, setConfig, getScanHistory, setScanHistory, getStats, setStats, getWeeklyStats, updateWeeklyStats } from '../shared/storage';
import { mlClassify, mlStatus } from '../engine/ml-classifier';

// ── State ────────────────────────────────────────────────────────────────

let currentConfig: AeginelConfig = DEFAULT_CONFIG;
let lastScan: ScanResult | null = null;
const proxyEngine = new PiiProxyEngine();
let totalPiiProtected = 0;
let aegisClient = new AegisClient(DEFAULT_CONFIG.aegisServer);

// ── Dev Logs ──────────────────────────────────────────────────────────

const MAX_DEV_LOGS = 200;
const devLogs: DevLogEntry[] = [];

function pushLog(entry: Omit<DevLogEntry, 'timestamp'>) {
  devLogs.push({ ...entry, timestamp: Date.now() });
  if (devLogs.length > MAX_DEV_LOGS) devLogs.shift();
}

function setupNetworkLogger(client: AegisClient) {
  client.onNetworkLog = (entry) => {
    const statusStr = entry.status != null ? `${entry.status}` : 'ERR';
    const summary = `${entry.method} ${entry.url} → ${statusStr} (${entry.latencyMs.toFixed(0)}ms)`;
    pushLog({
      type: entry.ok ? 'aegis' : 'error',
      summary,
      details: {
        method: entry.method,
        url: entry.url,
        status: entry.status,
        ok: entry.ok,
        latencyMs: Math.round(entry.latencyMs),
        ...(entry.error ? { error: entry.error } : {}),
        ...(entry.requestBody ? { requestBody: JSON.stringify(entry.requestBody).slice(0, 200) } : {}),
        ...(entry.responseBody ? { responseBody: JSON.stringify(entry.responseBody).slice(0, 500) } : {}),
      },
    });
  };
}

setupNetworkLogger(aegisClient);

// ── Conversation History Tracking ─────────────────────────────────────
// Tracks recent inputs per site (keyed by tab URL hostname), last 5 per site.

const MAX_CONVERSATION_HISTORY = 5;
const conversationHistory = new Map<string, string[]>();

function addToConversationHistory(hostname: string, input: string) {
  let history = conversationHistory.get(hostname);
  if (!history) {
    history = [];
    conversationHistory.set(hostname, history);
  }
  history.push(input);
  if (history.length > MAX_CONVERSATION_HISTORY) {
    history.shift();
  }
}

function getConversationHistory(hostname: string): string[] {
  return conversationHistory.get(hostname) ?? [];
}

function clearConversationHistoryForHost(hostname: string) {
  conversationHistory.delete(hostname);
}

// ── Health Status Tracking ──────────────────────────────────────────────

interface HealthEntry {
  source: string;
  status: 'ok' | 'degraded' | 'error';
  details?: string;
  brokenSelectors?: string[];
  timestamp: number;
}

const healthStatus: Record<string, HealthEntry> = {};

function recordHealth(entry: HealthEntry) {
  healthStatus[entry.source] = entry;
  if (entry.status === 'error') {
    console.warn(`[Aegis Health] ${entry.source}: ${entry.details ?? 'error'}`);
  }
}

// ── PII Mapping Persistence ──────────────────────────────────────────────
// MV3 service workers can be killed at any time; persist PII mappings to
// chrome.storage.session so they survive restarts within the browser session.

const PII_MAPPINGS_KEY = 'aeginel_pii_mappings';

proxyEngine.onMappingsChanged(async (data) => {
  try {
    await chrome.storage.session.set({ [PII_MAPPINGS_KEY]: data });
  } catch {
    // storage.session may not be available in all contexts
  }
});

async function restorePiiMappings() {
  try {
    const stored = await chrome.storage.session.get(PII_MAPPINGS_KEY);
    if (stored[PII_MAPPINGS_KEY]) {
      proxyEngine.importMappings(stored[PII_MAPPINGS_KEY]);
    }
  } catch {
    // storage.session may not be available
  }
}

// ── Init ─────────────────────────────────────────────────────────────────

async function initialize() {
  const stored = await getConfig();
  if (stored) {
    currentConfig = mergeConfig(stored);
  } else {
    await setConfig(DEFAULT_CONFIG);
  }
  aegisClient.updateConfig(currentConfig.aegisServer);
  await restorePiiMappings();
  updateBadge(null);
}

initialize();

// ── Tab Cleanup: Clear conversation history on tab close / navigation ──

// Map tabId -> hostname for cleanup on tab removal
const tabHostnames = new Map<number, string>();

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    try {
      const newHostname = new URL(changeInfo.url).hostname;
      const previousHostname = tabHostnames.get(tabId);

      // If navigated to a different hostname, clear history for the old one
      if (previousHostname && previousHostname !== newHostname) {
        clearConversationHistoryForHost(previousHostname);
      }

      tabHostnames.set(tabId, newHostname);
    } catch {
      // Invalid URL, ignore
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const hostname = tabHostnames.get(tabId);
  if (hostname) {
    clearConversationHistoryForHost(hostname);
    tabHostnames.delete(tabId);
  }
});

// ── Message Handler ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // async response
  }
);

function notifyProgress(tabId: number | undefined, phase: ScanPhase, detail: string) {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, { type: 'SCAN_PROGRESS', payload: { phase, detail } }).catch(() => {});
}

async function handleMessage(message: ExtensionMessage, sender?: chrome.runtime.MessageSender): Promise<unknown> {
  try {
    switch (message.type) {
      case 'SCAN_INPUT': {
        const { input, site } = message.payload;

        // Derive history key from sender URL hostname (aligns with tab cleanup),
        // falling back to site adapter name
        let historyKey = site.toLowerCase().replace(/\s+/g, '_');
        if (sender?.url) {
          try {
            historyKey = new URL(sender.url).hostname;
          } catch { /* use fallback */ }
        }

        // Track tabId -> hostname for cleanup on tab close/navigation
        if (sender?.tab?.id != null) {
          tabHostnames.set(sender.tab.id, historyKey);
        }

        // Get prior conversation history (before adding current input)
        const convHistory = getConversationHistory(historyKey);

        // Add current input to conversation history
        addToConversationHistory(historyKey, input);

        const tabId = sender?.tab?.id;

        // ── Phase 1: Local scan (rule-based sync + ML async) ──
        notifyProgress(tabId, 'rules', 'Running 9-layer rule engine...');
        const ruleResult = scan(input, site, currentConfig, convHistory.length > 0 ? convHistory : undefined);

        notifyProgress(tabId, 'ml', 'Analyzing with ML model...');
        let mlResult = { success: false, labels: [] as string[], mlScore: 0, isHarmful: false };
        try {
          mlResult = await mlClassify(input);
        } catch (err) {
          console.warn('[Aegis] ML classify failed, using rule-only result:', err);
          recordHealth({
            source: 'ml-classifier',
            status: 'degraded',
            details: `ML classify error: ${String(err)}`,
            timestamp: Date.now(),
          });
          pushLog({ type: 'error', summary: `ML classify failed: ${String(err)}` });
        }

        const localScore = Math.min(ruleResult.score + mlResult.mlScore, 100);
        const localCategories = [...new Set([
          ...ruleResult.categories,
          ...mlResult.labels,
        ])];

        // ── Phase 2: AEGIS Server scan (async, non-blocking) ──
        let aegisResult: AegisServerResult = {
          available: false, score: 0, action: '', categories: [],
          explanation: '', latencyMs: 0, endpoint: '',
        };

        if (aegisClient.isEnabled) {
          notifyProgress(tabId, 'aegis', 'Checking AEGIS server...');
          try {
            aegisResult = await aegisClient.scan(input, site, localScore, localCategories);
            recordHealth({
              source: 'aegis-server',
              status: aegisResult.available ? 'ok' : 'degraded',
              details: aegisResult.available
                ? `${aegisResult.endpoint} (${aegisResult.latencyMs.toFixed(0)}ms)`
                : aegisResult.explanation,
              timestamp: Date.now(),
            });
            if (aegisResult.available) {
              pushLog({
                type: 'aegis',
                summary: `${aegisResult.endpoint} → ${aegisResult.action} (score=${aegisResult.score}, ${aegisResult.latencyMs.toFixed(0)}ms)`,
                details: {
                  endpoint: aegisResult.endpoint,
                  action: aegisResult.action,
                  score: aegisResult.score,
                  categories: aegisResult.categories,
                  latencyMs: aegisResult.latencyMs,
                },
              });
            }
          } catch (err) {
            console.warn('[Aegis] Server scan failed, using local-only result:', err);
            recordHealth({
              source: 'aegis-server',
              status: 'error',
              details: `Server scan error: ${String(err)}`,
              timestamp: Date.now(),
            });
            pushLog({ type: 'error', summary: `AEGIS server scan failed: ${String(err)}` });
          }
        }

        // ── Phase 3: Merge — server is authoritative when available ──
        const { score: hybridScore, level: hybridLevel } = mergeHybridScore(
          localScore,
          aegisResult,
        );

        const mergedCategories = [...new Set([
          ...localCategories,
          ...aegisResult.categories,
        ])];

        let explanation = ruleResult.explanation;
        if (mlResult.success && mlResult.isHarmful) {
          explanation += ` ML: ${mlResult.labels.join(', ')} detected.`;
        }
        if (aegisResult.available && aegisResult.score > 0) {
          explanation += ` Server(${aegisResult.endpoint}): ${aegisResult.action} (${aegisResult.score}).`;
        }

        const result: ScanResult = {
          ...ruleResult,
          score: hybridScore,
          level: hybridLevel,
          blocked: hybridScore >= currentConfig.blockThreshold,
          categories: mergedCategories,
          explanation,
        };
        lastScan = result;

        // ── Dev log ──
        pushLog({
          type: 'scan',
          summary: `[${site}] ${result.blocked ? 'BLOCKED' : result.level.toUpperCase()} score=${result.score}`,
          details: {
            input: input.slice(0, 80),
            ruleScore: ruleResult.score,
            mlScore: mlResult.mlScore,
            mlLabels: mlResult.labels,
            localScore,
            serverAvailable: aegisResult.available,
            serverAction: aegisResult.action || null,
            serverScore: aegisResult.score,
            serverEndpoint: aegisResult.endpoint || null,
            serverLatencyMs: aegisResult.latencyMs,
            finalScore: hybridScore,
            finalLevel: hybridLevel,
            blocked: result.blocked,
            categories: mergedCategories,
            totalLatencyMs: result.totalLatencyMs,
          },
        });

        // Update weekly stats
        await updateWeeklyStats({
          scans: 1,
          blocked: result.blocked ? 1 : 0,
          categories: result.categories.length > 0 ? result.categories : undefined,
          site,
        });

        // Save to history
        const scanHistory = await getScanHistory();
        scanHistory.unshift(result);
        if (scanHistory.length > MAX_HISTORY_ITEMS) scanHistory.length = MAX_HISTORY_ITEMS;
        await setScanHistory(scanHistory);

        // Update stats
        const stats = await getStats();
        stats.totalScans++;
        if (result.blocked) stats.threatsBlocked++;
        await setStats(stats);

        // Update badge
        updateBadge(result);

        notifyProgress(tabId, 'done', result.blocked ? 'Blocked' : result.level === 'low' ? 'Safe' : `Risk: ${result.level}`);

        return { type: 'SCAN_RESULT', payload: result };
      }

      case 'PROXY_INPUT': {
        try {
          const { text, site, sessionId } = message.payload;
          const result = proxyEngine.pseudonymize(text, currentConfig, sessionId);
          totalPiiProtected += result.piiCount;
          if (result.piiCount > 0) {
            await updateWeeklyStats({ pii: result.piiCount });
          }
          return {
            originalText: result.originalText,
            proxiedText: result.proxiedText,
            mappings: result.mappings,
            piiCount: result.piiCount,
          };
        } catch (err) {
          console.error('[Aegis] PII proxy failed:', err);
          return { originalText: message.payload.text, proxiedText: message.payload.text, mappings: [], piiCount: 0 };
        }
      }

      case 'RESTORE_RESPONSE': {
        try {
          const { text, sessionId } = message.payload;
          const restoredText = proxyEngine.restore(text, sessionId);
          return { restoredText };
        } catch (err) {
          console.error('[Aegis] PII restore failed:', err);
          return { restoredText: message.payload.text };
        }
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
        aegisClient.updateConfig(currentConfig.aegisServer);
        await setConfig(currentConfig);
        return { type: 'CONFIG_RESPONSE', payload: currentConfig };
      }

      case 'AEGIS_HEALTH_CHECK': {
        const usage = await aegisClient.fetchUsage();
        return {
          type: 'AEGIS_HEALTH_RESPONSE',
          payload: {
            enabled: aegisClient.isEnabled,
            connected: usage !== null,
            latencyMs: 0,
          },
        };
      }

      case 'AEGIS_GET_USAGE': {
        const usage = await aegisClient.fetchUsage();
        return { type: 'AEGIS_USAGE_RESPONSE', payload: usage };
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

      case 'GET_DEV_LOGS': {
        return { type: 'DEV_LOGS_RESPONSE', payload: [...devLogs] };
      }

      case 'CLEAR_DEV_LOGS': {
        devLogs.length = 0;
        return { type: 'DEV_LOGS_RESPONSE', payload: [] };
      }

      case 'HEALTH_REPORT': {
        recordHealth(message.payload);
        return { received: true };
      }

      case 'ML_LOAD_ERROR': {
        const { error, retryCount } = message.payload;
        recordHealth({
          source: 'ml-model',
          status: 'error',
          details: `Load failed (attempt ${retryCount}): ${error}`,
          timestamp: Date.now(),
        });
        // Notify user via notification API on final failure
        if (retryCount >= 2) {
          try {
            await chrome.notifications.create('ml-load-error', {
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
              title: 'Aegis: ML Model Error',
              message: 'The ML detection model failed to load. Rule-based detection is still active.',
            });
          } catch {
            // Notifications API may not be available
          }
        }
        return { received: true };
      }

      case 'GET_HEALTH': {
        return { type: 'HEALTH_RESPONSE', payload: healthStatus };
      }

      case 'GET_ML_STATUS': {
        return mlStatus();
      }

      case 'GET_WEEKLY_REPORT': {
        return generateWeeklyReport();
      }

      default:
        return null;
    }
  } catch (err) {
    console.error('[Aegis] Unhandled error in message handler:', err);
    return { error: String(err) };
  }
}

// ── Weekly Report Generator ──────────────────────────────────────────────

async function generateWeeklyReport() {
  const weekly = await getWeeklyStats();
  const stats = await getStats();

  // Sort categories by count
  const sortedCategories = Object.entries(weekly.topCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Sort sites by scan count
  const sortedSites = Object.entries(weekly.siteBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const weekStart = new Date(weekly.weekStart);
  const weekEnd = new Date(weekly.weekStart + 7 * 24 * 60 * 60 * 1000 - 1);

  return {
    type: 'WEEKLY_REPORT_RESPONSE',
    payload: {
      period: {
        start: weekStart.toISOString().slice(0, 10),
        end: weekEnd.toISOString().slice(0, 10),
      },
      thisWeek: {
        totalScans: weekly.totalScans,
        threatsBlocked: weekly.threatsBlocked,
        piiProtected: weekly.piiProtected,
        topCategories: sortedCategories,
        siteBreakdown: sortedSites,
      },
      allTime: {
        totalScans: stats.totalScans,
        threatsBlocked: stats.threatsBlocked,
      },
    },
  };
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
