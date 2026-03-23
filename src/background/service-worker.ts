// ── Aegis Personal Service Worker ─────────────────────────────────────────────────
// Hosts the PII detection engine, handles messages, manages badge + history.
// Attack defense is delegated to the AEGIS server (enterprise only).

import { scan } from '../engine/detector';
import { mergeConfig } from '../engine/config';
import { DEFAULT_CONFIG } from '../engine/types';
import type { AeginelConfig, ScanResult, AegisServerResult, DevLogEntry, HealthEntry } from '../engine/types';
import { PiiProxyEngine } from '../engine/pii-proxy';
import { AegisClient, mergeHybridScore } from '../engine/aegis-client';
import { initPiiNer } from '../engine/pii-ner-client';
import type { ExtensionMessage, ScanPhase } from '../shared/messages';
import { MAX_HISTORY_ITEMS } from '../shared/constants';
import { getConfig, setConfig, getScanHistory, setScanHistory, getStats, setStats, getWeeklyStats, updateWeeklyStats } from '../shared/storage';

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

// ── Health Status Tracking ──────────────────────────────────────────────

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

  await initPiiNer();

  if (aegisClient.isEnabled) {
    aegisClient.probeVersionAccess().catch(() => {});
  }
}

initialize();

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
        const tabId = sender?.tab?.id;

        // ── Phase 1: Local PII scan ──
        notifyProgress(tabId, 'pii', 'Scanning for personal information...');
        const piiResult = await scan(input, site, currentConfig);

        let localScore = piiResult.score;
        let localCategories = [...piiResult.categories];

        // ── Phase 2: AEGIS Server scan (enterprise — attack defense) ──
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

        let explanation = piiResult.explanation;
        if (aegisResult.available && aegisResult.score > 0) {
          explanation += ` Server(${aegisResult.endpoint}): ${aegisResult.action} (${aegisResult.score}).`;
        }

        const result: ScanResult = {
          ...piiResult,
          score: hybridScore,
          level: hybridLevel,
          blocked: hybridScore >= currentConfig.blockThreshold,
          categories: mergedCategories,
          explanation,
          localScore,
          serverAvailable: aegisResult.available,
          serverScore: aegisResult.score,
          serverAction: aegisResult.action || undefined,
          serverEndpoint: aegisResult.endpoint || undefined,
          serverLatencyMs: aegisResult.latencyMs || undefined,
          serverCategories: aegisResult.categories.length > 0 ? aegisResult.categories : undefined,
          serverExplanation: aegisResult.explanation || undefined,
          endpointDetails: aegisResult.endpointDetails,
        };
        lastScan = result;

        // ── Dev log ──
        pushLog({
          type: 'scan',
          summary: `[${site}] ${result.blocked ? 'BLOCKED' : result.level.toUpperCase()} score=${result.score}`,
          details: {
            input: input.slice(0, 80),
            piiScore: piiResult.score,
            piiCount: piiResult.piiDetected.length,
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

        // Push scan complete to content script for floating panel
        if (tabId != null) {
          chrome.tabs.sendMessage(tabId, { type: 'SCAN_COMPLETE', payload: result }).catch(() => {});
        }

        return { type: 'SCAN_RESULT', payload: result };
      }

      case 'PROXY_INPUT': {
        try {
          const { text, site, sessionId } = message.payload;
          const result = await proxyEngine.pseudonymize(text, currentConfig, sessionId);
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
        if (aegisClient.isEnabled) {
          aegisClient.probeVersionAccess().catch(() => {});
        }
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

      case 'AEGIS_CHECK_ACCESS': {
        const access = await aegisClient.probeVersionAccess();
        return { type: 'AEGIS_ACCESS_RESPONSE', payload: access };
      }

      case 'GET_DASHBOARD': {
        const dashStats = await getStats();
        const dashHistory = await getScanHistory();
        return {
          type: 'DASHBOARD_RESPONSE',
          payload: {
            lastScan,
            recentScans: dashHistory.slice(0, 20),
            health: { ...healthStatus },
            aegisEnabled: aegisClient.isEnabled,
            totalScans: dashStats.totalScans,
            piiProtected: totalPiiProtected,
          },
        };
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

      case 'GET_HEALTH': {
        return { type: 'HEALTH_RESPONSE', payload: healthStatus };
      }

      case 'OPEN_AEGIS_SETTINGS': {
        const url = chrome.runtime.getURL('src/popup/index.html#aegis');
        chrome.tabs.create({ url });
        return { ok: true };
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

  const sortedCategories = Object.entries(weekly.topCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

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
