// ── AEGIS Floating Dashboard Panel (Shadow DOM) ─────────────────────────────────
// Draggable badge + expandable mini dashboard injected into web pages.
// Panel direction adapts based on badge position (4-quadrant).

import type { ScanResult, HealthEntry, PiiMatch, AegisEndpointDetail, DevLogEntry } from '../../engine/types';
import type { DashboardResponseMessage } from '../../shared/messages';
import { t } from '../../i18n';
import styles from './styles.css?inline';

const FLOAT_HOST_ID = 'aeginel-float-host';
const STORAGE_KEY_POS = 'aeginel_badge_pos';
const STORAGE_KEY_VIS = 'aeginel_badge_visible';
const STORAGE_KEY_THEME = 'aeginel_theme';

const BADGE_SIZE = 36;
const PANEL_WIDTH = 340;
const PANEL_MAX_H = 440;
const GAP = 8;

let _shadow: ShadowRoot | null = null;
let _host: HTMLElement | null = null;
let _panelOpen = false;
let _dashboardData: DashboardResponseMessage['payload'] | null = null;
let _selectedScanIdx: number | null = null;
let _survivalObserver: MutationObserver | null = null;
let _reinjectTimer: ReturnType<typeof setTimeout> | null = null;
let _theme: 'light' | 'dark' = 'light';

// ── Dev Logs state ───────────────────────────────────────────────────
let _activeTab: 'dashboard' | 'logs' = 'dashboard';
let _devLogs: DevLogEntry[] = [];
let _logFilter: DevLogEntry['type'] | 'all' = 'all';
let _logAutoRefresh = true;
let _logRefreshInterval: ReturnType<typeof setInterval> | null = null;
let _logExpandedIdx: number | null = null;

// ── Shared drag state ───────────────────────────────────────────────

let _isDragging = false;
let _dragStartX = 0;
let _dragStartY = 0;
let _dragHostStartX = 0;
let _dragHostStartY = 0;
let _dragMoved = false;
let _dragCaptureEl: HTMLElement | null = null;
let _dragTapFn: (() => void) | null = null;

function onDragStart(e: PointerEvent, tapFn?: () => void) {
  if (!_host) return;
  const target = e.target as HTMLElement;
  if (target.closest('button')) return;

  _isDragging = true;
  _dragMoved = false;
  _dragStartX = e.clientX;
  _dragStartY = e.clientY;
  _dragHostStartX = _host.offsetLeft;
  _dragHostStartY = _host.offsetTop;
  _dragCaptureEl = e.currentTarget as HTMLElement;
  _dragTapFn = tapFn ?? null;
  _dragCaptureEl.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onDragMove(e: PointerEvent) {
  if (!_isDragging || !_host) return;
  const dx = e.clientX - _dragStartX;
  const dy = e.clientY - _dragStartY;
  if (!_dragMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
  _dragMoved = true;
  const newX = Math.max(-BADGE_SIZE / 2, Math.min(window.innerWidth - BADGE_SIZE / 2, _dragHostStartX + dx));
  const newY = Math.max(-BADGE_SIZE / 2, Math.min(window.innerHeight - BADGE_SIZE / 2, _dragHostStartY + dy));
  _host.style.left = `${newX}px`;
  _host.style.top = `${newY}px`;
}

function onDragEnd(e: PointerEvent) {
  if (!_isDragging) return;
  _isDragging = false;
  if (_dragMoved) {
    if (_host) savePosition(_host.offsetLeft, _host.offsetTop);
    if (_panelOpen) repositionPanel();
  } else if (_dragTapFn) {
    _dragTapFn();
  }
  _dragCaptureEl?.releasePointerCapture(e.pointerId);
  _dragCaptureEl = null;
  _dragTapFn = null;
}

function attachDragBehavior(el: HTMLElement, onTap?: () => void) {
  el.style.cursor = 'grab';
  el.addEventListener('pointerdown', (e) => {
    onDragStart(e, onTap);
    if (_isDragging) el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', (e) => onDragMove(e));
  el.addEventListener('pointerup', (e) => {
    onDragEnd(e);
    el.style.cursor = 'grab';
  });
}

// ── Level color helpers ──────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  low: '#3fb950', medium: '#d29922', high: '#db6d28', critical: '#f85149',
};

function getAegisStatus(data: DashboardResponseMessage['payload'] | null): 'ok' | 'degraded' | 'error' | 'off' {
  if (!data || !data.aegisEnabled) return 'off';
  const h = data.health['aegis-server'];
  if (!h) return 'ok';
  return h.status;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function actionToVerdict(action: string): string {
  const map: Record<string, string> = {
    approve: 'approve', block: 'block', modify: 'modify',
    escalate: 'escalate', reask: 'reask', throttle: 'throttle',
  };
  return map[action.toLowerCase()] || action.toLowerCase();
}

function verdictClass(action: string): string {
  const a = action.toLowerCase();
  if (a === 'approve') return 'verdict-approve';
  if (a === 'block') return 'verdict-block';
  return 'verdict-other';
}

function epVerdictClass(action: string): string {
  const a = action.toLowerCase();
  if (a === 'approve') return 'ep-approve';
  if (a === 'block') return 'ep-block';
  return 'ep-other';
}

function groupPiiByType(piiDetected: PiiMatch[]): Map<string, number> {
  const groups = new Map<string, number>();
  for (const pii of piiDetected) {
    groups.set(pii.type, (groups.get(pii.type) || 0) + 1);
  }
  return groups;
}

function categoryClass(cat: string): string {
  const danger = ['jailbreak', 'prompt_injection', 'harmful', 'violence', 'dangerous', 'self_harm', 'hate_speech'];
  const warning = ['pii_exposure', 'sensitive', 'sexual', 'harassment'];
  const safe = ['safe'];
  const lower = cat.toLowerCase();
  if (danger.some(d => lower.includes(d))) return 'cat-danger';
  if (warning.some(w => lower.includes(w))) return 'cat-warning';
  if (safe.some(s => lower === s)) return 'cat-safe';
  return 'cat-info';
}

function translateCategory(cat: string): string {
  const key = `categories.${cat}`;
  const translated = t(key);
  return translated !== key ? translated : cat.replace(/_/g, ' ');
}

function endpointDisplayName(endpoint: string): string {
  if (endpoint.includes('judge')) return t('floating.epJudge');
  if (endpoint.includes('jailbreak')) return t('floating.epJailbreak');
  if (endpoint.includes('safety')) return t('floating.epSafety');
  if (endpoint.includes('classify')) return t('floating.epClassify');
  if (endpoint.includes('korean')) return t('floating.epKorean');
  return endpoint.replace(/^\/v\d+\//, '');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Badge Position Persistence ──────────────────────────────────────

async function loadPosition(): Promise<{ x: number; y: number }> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_POS);
    if (stored[STORAGE_KEY_POS]) return stored[STORAGE_KEY_POS];
  } catch { /* ignore */ }
  return { x: window.innerWidth - BADGE_SIZE - 16, y: window.innerHeight - BADGE_SIZE - 16 };
}

async function savePosition(x: number, y: number) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_POS]: { x, y } });
  } catch { /* ignore */ }
}

export async function isBadgeVisible(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_VIS);
    return stored[STORAGE_KEY_VIS] !== false;
  } catch { return true; }
}

export async function setBadgeVisible(visible: boolean) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_VIS]: visible });
  } catch { /* ignore */ }
}

async function loadTheme(): Promise<'light' | 'dark'> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_THEME);
    return stored[STORAGE_KEY_THEME] === 'dark' ? 'dark' : 'light';
  } catch { return 'light'; }
}

async function saveTheme(theme: 'light' | 'dark') {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_THEME]: theme });
  } catch { /* ignore */ }
}

function applyTheme(theme: 'light' | 'dark') {
  _theme = theme;
  if (!_shadow) return;
  const container = _shadow.querySelector('.aeginel-theme-root') as HTMLElement | null;
  if (container) {
    container.dataset.theme = theme;
  }
  const badge = _shadow.querySelector('.aeginel-floating-badge') as HTMLElement | null;
  if (badge) {
    badge.dataset.theme = theme;
  }
}

function toggleTheme() {
  const next = _theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  saveTheme(next);
  renderPanel();
}

// ── Adaptive Panel Positioning ──────────────────────────────────────
// Determines which direction the panel should expand based on where
// the badge sits relative to viewport center.

function repositionPanel() {
  if (!_shadow || !_host) return;
  const panel = _shadow.querySelector('.aeginel-floating-panel') as HTMLElement | null;
  if (!panel) return;

  const bx = _host.offsetLeft;
  const by = _host.offsetTop;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const isRight = bx + BADGE_SIZE / 2 > vw / 2;
  const isBottom = by + BADGE_SIZE / 2 > vh / 2;

  // Reset
  panel.style.position = 'absolute';
  panel.style.top = '';
  panel.style.bottom = '';
  panel.style.left = '';
  panel.style.right = '';

  if (isBottom) {
    // Panel above badge
    panel.style.bottom = `${BADGE_SIZE + GAP}px`;
  } else {
    // Panel below badge
    panel.style.top = `${BADGE_SIZE + GAP}px`;
  }

  if (isRight) {
    // Panel to the left — align right edge with badge right edge
    panel.style.right = '0';
  } else {
    // Panel to the right — align left edge with badge left edge
    panel.style.left = '0';
  }
}

// ── Scan Detail HTML (reusable) ──────────────────────────────────────

function buildScanDetailHtml(scan: ScanResult): string {
  let html = '';

  if (scan.serverAvailable) {
    const action = scan.serverAction || 'approve';
    const verdictKey = actionToVerdict(action);
    const verdictLabel = t(`floating.${verdictKey}`) || action;
    const latency = scan.serverLatencyMs ? `${Math.round(scan.serverLatencyMs)}ms` : '';

    html += `<div class="aeginel-verdict-card">
      <div class="aeginel-verdict-action">
        <span class="aeginel-verdict-badge ${verdictClass(action)}">${verdictLabel}</span>
        ${scan.blocked ? `<span class="aeginel-verdict-badge verdict-block">${t('floating.blocked')}</span>` : ''}
        ${latency ? `<span class="aeginel-verdict-latency">${latency}</span>` : ''}
      </div>
      <div class="aeginel-score-flow">
        <div class="aeginel-score-item">
          <div class="aeginel-score-item-value" style="color:${LEVEL_COLORS[scan.level] || '#e6edf3'}">${scan.localScore ?? 0}</div>
          <div class="aeginel-score-item-label">${t('floating.localScore')}</div>
        </div>
        <span class="aeginel-score-arrow">\u2192</span>
        <div class="aeginel-score-item">
          <div class="aeginel-score-item-value" style="color:${LEVEL_COLORS[scan.level] || '#e6edf3'}">${scan.serverScore ?? 0}</div>
          <div class="aeginel-score-item-label">${t('floating.serverScore')}</div>
        </div>
        <span class="aeginel-score-arrow">\u2192</span>
        <div class="aeginel-score-item">
          <div class="aeginel-score-item-value" style="color:${LEVEL_COLORS[scan.level] || '#e6edf3'}">${scan.score}</div>
          <div class="aeginel-score-item-label">${t('floating.finalScore')}</div>
        </div>
      </div>`;
  } else {
    const levelColor = LEVEL_COLORS[scan.level] || '#e6edf3';
    const levelLabel = t(`risk.${scan.level}`) || scan.level;

    html += `<div class="aeginel-local-card">
      <div class="aeginel-local-score-row">
        <span class="aeginel-local-score-num" style="color:${levelColor}">${scan.score}</span>
        <span class="aeginel-local-level-badge level-${scan.level}">${levelLabel}</span>
        ${scan.blocked ? `<span class="aeginel-verdict-badge verdict-block" style="margin-left:auto">${t('floating.blocked')}</span>` : ''}
      </div>`;
  }

  if (scan.piiDetected && scan.piiDetected.length > 0) {
    const groups = groupPiiByType(scan.piiDetected);
    html += `<div style="margin-top:8px">
      <div class="aeginel-panel-section-title">${t('floating.piiDetected')}</div>
      <div class="aeginel-pii-list">`;
    for (const [piiType, count] of groups) {
      const label = t(`piiTypes.${piiType}`) || piiType;
      html += `<span class="aeginel-pii-chip">${label}${count > 1 ? `<span class="aeginel-pii-chip-count">\u00d7${count}</span>` : ''}</span>`;
    }
    html += '</div></div>';
  }

  const allCats = [
    ...(scan.categories || []),
    ...(scan.serverCategories || []),
  ].filter((c, i, arr) => arr.indexOf(c) === i);

  if (allCats.length > 0) {
    html += `<div style="margin-top:8px">
      <div class="aeginel-panel-section-title">${t('floating.riskCategories')}</div>
      <div class="aeginel-cat-list">`;
    for (const cat of allCats) {
      html += `<span class="aeginel-cat-chip ${categoryClass(cat)}">${translateCategory(cat)}</span>`;
    }
    html += '</div></div>';
  }

  if (scan.serverExplanation && scan.serverAvailable) {
    html += `<div class="aeginel-explain">${escapeHtml(scan.serverExplanation)}</div>`;
  } else if (scan.explanation && scan.score > 0) {
    html += `<div class="aeginel-explain">${escapeHtml(scan.explanation)}</div>`;
  }

  html += '</div>';

  if (scan.endpointDetails && scan.endpointDetails.length > 0) {
    html += `<div class="aeginel-collapsible" style="margin-top:6px">
      <button class="aeginel-collapsible-toggle" data-action="toggle-analysis">
        <span>${t('floating.serverAnalysis')}</span>
        <svg class="aeginel-collapsible-arrow" width="8" height="8" viewBox="0 0 10 10"><path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="aeginel-collapsible-body" style="display:none">
        <div class="aeginel-ep-list">`;
    for (const ep of scan.endpointDetails) {
      const name = endpointDisplayName(ep.endpoint);
      const vclass = epVerdictClass(ep.action);
      const actionLabel = t(`floating.${actionToVerdict(ep.action)}`) || ep.action;
      const epLatency = `${Math.round(ep.latencyMs)}ms`;
      const fullExplanation = ep.explanation ? escapeHtml(ep.explanation) : '';

      html += `<div class="aeginel-ep-row">
        <span class="aeginel-ep-name">${name}</span>
        <span class="aeginel-ep-verdict ${vclass}">${actionLabel}</span>
        <span class="aeginel-ep-score">${ep.score}</span>
        <span class="aeginel-ep-time">${epLatency}</span>
      </div>`;
      if (fullExplanation) {
        html += `<div class="aeginel-ep-explain">${fullExplanation}</div>`;
      }
    }
    html += '</div></div></div>';
  }

  return html;
}

// ── Dev Log Helpers ─────────────────────────────────────────────────

const LOG_TYPE_COLORS: Record<DevLogEntry['type'], string> = {
  scan: '#58a6ff', aegis: '#d2a8ff', health: '#3fb950', error: '#f85149',
};

const LOG_TYPE_LABELS: Record<DevLogEntry['type'], string> = {
  scan: 'SCAN', aegis: 'AEGIS', health: 'HEALTH', error: 'ERROR',
};

function formatLogTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function fetchDevLogs(): Promise<DevLogEntry[]> {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_DEV_LOGS' });
    if (res?.payload) return res.payload;
  } catch { /* ignore */ }
  return [];
}

async function clearDevLogs() {
  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_DEV_LOGS' });
  } catch { /* ignore */ }
  _devLogs = [];
  _logExpandedIdx = null;
  renderPanel();
}

function startLogAutoRefresh() {
  stopLogAutoRefresh();
  if (!_logAutoRefresh) return;
  _logRefreshInterval = setInterval(async () => {
    if (!_panelOpen || _activeTab !== 'logs') { stopLogAutoRefresh(); return; }
    _devLogs = await fetchDevLogs();
    renderPanel();
  }, 2000);
}

function stopLogAutoRefresh() {
  if (_logRefreshInterval) { clearInterval(_logRefreshInterval); _logRefreshInterval = null; }
}

function buildDevLogContent(): string {
  const filtered = _logFilter === 'all' ? _devLogs : _devLogs.filter(l => l.type === _logFilter);
  const filterTypes: Array<DevLogEntry['type'] | 'all'> = ['all', 'scan', 'aegis', 'health', 'error'];
  const filterLabels: Record<string, string> = {
    all: t('floating.logFilterAll'), scan: t('floating.logFilterScan'),
    aegis: t('floating.logFilterAegis'), health: t('floating.logFilterHealth'), error: t('floating.logFilterError'),
  };

  let html = '<div class="aeginel-devlog-toolbar">';

  // Filter chips
  html += '<div class="aeginel-devlog-filters">';
  for (const ft of filterTypes) {
    const active = _logFilter === ft;
    html += `<button class="aeginel-devlog-filter-chip${active ? ' active' : ''}" data-log-filter="${ft}">${filterLabels[ft]}</button>`;
  }
  html += '</div>';

  // Right side: live toggle, count, clear
  html += '<div class="aeginel-devlog-actions">';
  html += `<button class="aeginel-devlog-live-btn${_logAutoRefresh ? ' active' : ''}" data-action="toggle-log-live">${_logAutoRefresh ? t('floating.logLive') : t('floating.logPaused')}</button>`;
  html += `<span class="aeginel-devlog-count">${t('floating.logEntries').replace('{{count}}', String(filtered.length))}</span>`;
  html += `<button class="aeginel-devlog-clear-btn" data-action="clear-logs">${t('floating.logClear')}</button>`;
  html += '</div></div>';

  // Log list
  html += '<div class="aeginel-devlog-list">';
  if (filtered.length === 0) {
    html += `<div class="aeginel-devlog-empty">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <div>${t('floating.logEmpty')}</div>
      <div class="aeginel-devlog-empty-hint">${t('floating.logEmptyHint')}</div>
    </div>`;
  } else {
    for (let i = filtered.length - 1; i >= 0; i--) {
      const log = filtered[i];
      const color = LOG_TYPE_COLORS[log.type];
      const isExpanded = _logExpandedIdx === i;
      html += `<div class="aeginel-devlog-entry${isExpanded ? ' expanded' : ''}" data-log-idx="${i}">
        <div class="aeginel-devlog-row">
          <span class="aeginel-devlog-time">${formatLogTime(log.timestamp)}</span>
          <span class="aeginel-devlog-type" style="color:${color};background:${color}15">${LOG_TYPE_LABELS[log.type]}</span>
          <span class="aeginel-devlog-summary">${escapeHtml(log.summary)}</span>
        </div>`;
      if (isExpanded && log.details) {
        html += '<div class="aeginel-devlog-details">';
        for (const [key, value] of Object.entries(log.details)) {
          const isBlockedRed = key === 'blocked' && value === true;
          const isHighScore = key === 'finalScore' && typeof value === 'number' && value >= 70;
          const valColor = isBlockedRed ? '#f85149' : isHighScore ? '#f0883e' : '';
          const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-');
          html += `<div class="aeginel-devlog-detail-row">
            <span class="aeginel-devlog-detail-key">${escapeHtml(key)}:</span>
            <span class="aeginel-devlog-detail-val"${valColor ? ` style="color:${valColor}"` : ''}>${escapeHtml(valStr)}</span>
          </div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
  }
  html += '</div>';
  return html;
}

// ── Build Panel HTML ────────────────────────────────────────────────

function buildPanelContent(data: DashboardResponseMessage['payload']): string {
  const status = getAegisStatus(data);
  const statusColor = status === 'ok' ? '#3fb950' : status === 'degraded' ? '#d29922' : status === 'error' ? '#f85149' : '#484f58';
  const statusLabel = status === 'ok' ? t('floating.connected')
    : status === 'degraded' ? t('floating.degraded')
    : status === 'error' ? t('floating.error')
    : t('floating.localOnly');

  let html = '';

  // Header
  const sunIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  html += `<div class="aeginel-panel-header">
    <div class="aeginel-panel-header-left">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span class="aeginel-panel-title">${t('floating.title')}</span>
      <div class="aeginel-panel-status" style="color:${statusColor}">
        <span class="aeginel-panel-status-dot" style="background:${statusColor}"></span>
        ${statusLabel}
      </div>
    </div>
    <div class="aeginel-panel-header-actions">
      <button class="aeginel-theme-toggle" data-action="toggle-theme" title="${_theme === 'light' ? 'Dark mode' : 'Light mode'}">${_theme === 'light' ? moonIcon : sunIcon}</button>
      <button class="aeginel-panel-close" data-action="close">&times;</button>
    </div>
  </div>`;

  // Tabs (only when devMode is enabled)
  if (data.devMode) {
    html += `<div class="aeginel-panel-tabs">
      <button class="aeginel-panel-tab${_activeTab === 'dashboard' ? ' active' : ''}" data-tab="dashboard">${t('floating.tabDashboard')}</button>
      <button class="aeginel-panel-tab${_activeTab === 'logs' ? ' active' : ''}" data-tab="logs">${t('floating.tabLogs')}</button>
    </div>`;
  }

  // Dev Logs tab view
  if (data.devMode && _activeTab === 'logs') {
    html += '<div class="aeginel-panel-body">';
    html += buildDevLogContent();
    html += '</div>';
    return html;
  }

  html += '<div class="aeginel-panel-body">';

  // Stats
  html += `<div class="aeginel-panel-section">
    <div class="aeginel-panel-stats">
      <div class="aeginel-panel-stat">
        <div class="aeginel-panel-stat-value">${data.totalScans}</div>
        <div class="aeginel-panel-stat-label">${t('floating.totalScans')}</div>
      </div>
      <div class="aeginel-panel-stat">
        <div class="aeginel-panel-stat-value">${data.piiProtected}</div>
        <div class="aeginel-panel-stat-label">${t('floating.piiProtected')}</div>
      </div>
    </div>
  </div>`;

  // Scan detail view (selected from history) or last scan
  const detailScan = _selectedScanIdx !== null ? data.recentScans[_selectedScanIdx] : data.lastScan;

  if (_selectedScanIdx !== null && detailScan) {
    html += `<div class="aeginel-panel-section">
      <button class="aeginel-detail-back" data-action="back-to-list">
        <svg width="8" height="8" viewBox="0 0 10 10"><path d="M6.5 2L3.5 5L6.5 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${t('floating.backToList')}
      </button>
      <div class="aeginel-detail-meta">${detailScan.site} · ${formatTime(detailScan.timestamp)}</div>
    </div>`;
    html += buildScanDetailHtml(detailScan);
  } else if (detailScan) {
    html += `<div class="aeginel-panel-section">
      <div class="aeginel-panel-section-title">${t('floating.scanDetails')}</div>
    </div>`;
    html += buildScanDetailHtml(detailScan);
  } else if (data.aegisEnabled) {
    html += `<div class="aeginel-panel-section">
      <div class="aeginel-panel-section-title">${t('floating.lastVerdict')}</div>
      <div style="padding:6px 0;font-size:10px;color:var(--text-tertiary)">${t('floating.noVerdict')}</div>
    </div>`;
  }

  // Server not connected prompt with connect button
  if (!data.aegisEnabled) {
    html += `<div class="aeginel-connect-prompt">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span style="flex:1">${t('floating.connectPrompt')}</span>
      <button class="aeginel-connect-btn" data-action="open-settings">${t('floating.connectBtn')}</button>
    </div>`;
  }

  // Recent scans (scrollable, max 5 visible rows) — hidden when viewing detail
  if (_selectedScanIdx !== null) {
    // detail view is showing, skip list
  } else if (data.recentScans.length > 0) {
    html += `<div class="aeginel-panel-section">
      <div class="aeginel-panel-section-title">${t('floating.recentScans')} <span style="font-weight:400;opacity:0.7">(${data.recentScans.length})</span></div>
      <div class="aeginel-scan-scroll">`;
    for (let i = 0; i < data.recentScans.length; i++) {
      const scan = data.recentScans[i];
      const color = LEVEL_COLORS[scan.level] || '#8b949e';
      const piiCount = scan.piiDetected?.length || 0;
      html += `<div class="aeginel-scan-item level-${scan.level}" data-scan-idx="${i}">
        <span class="aeginel-scan-score" style="color:${color}">${scan.score}</span>
        <span class="aeginel-scan-site">${scan.site}</span>
        <span class="aeginel-scan-meta">
          ${piiCount > 0 ? `<span class="aeginel-scan-pii">\u{1F512}${piiCount}</span>` : ''}
          ${scan.blocked ? `<span class="aeginel-scan-blocked-tag">${t('floating.blocked')}</span>` : ''}
        </span>
        <span class="aeginel-scan-time">${formatTime(scan.timestamp)}</span>
      </div>`;
    }
    html += '</div></div>';
  } else {
    html += `<div class="aeginel-panel-empty">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      ${t('floating.noScans')}
    </div>`;
  }

  html += '</div>';
  return html;
}

// ── Show / Update / Hide ────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardResponseMessage['payload'] | null> {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_DASHBOARD' });
    if (res?.type === 'DASHBOARD_RESPONSE' && res.payload) return res.payload;
    if (res?.payload) return res.payload;
    return res as DashboardResponseMessage['payload'];
  } catch { return null; }
}

function renderPanel() {
  if (!_shadow || !_panelOpen || !_dashboardData) return;
  const panel = _shadow.querySelector('.aeginel-floating-panel') as HTMLElement | null;
  if (panel) {
    panel.innerHTML = buildPanelContent(_dashboardData);
    panel.querySelector('[data-action="close"]')
      ?.addEventListener('click', () => togglePanel());
    panel.querySelector('[data-action="toggle-theme"]')
      ?.addEventListener('click', () => toggleTheme());
    panel.querySelector('[data-action="open-settings"]')
      ?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_AEGIS_SETTINGS' });
      });
    const header = panel.querySelector('.aeginel-panel-header') as HTMLElement | null;
    if (header) attachDragBehavior(header);

    // Tab switching
    panel.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'dashboard' | 'logs';
        if (tab === _activeTab) return;
        _activeTab = tab;
        _logExpandedIdx = null;
        if (tab === 'logs') {
          fetchDevLogs().then(logs => { _devLogs = logs; renderPanel(); startLogAutoRefresh(); });
        } else {
          stopLogAutoRefresh();
          renderPanel();
        }
      });
    });

    // Dev log event handlers
    if (_activeTab === 'logs') {
      panel.querySelectorAll('[data-log-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          _logFilter = (btn as HTMLElement).dataset.logFilter as DevLogEntry['type'] | 'all';
          _logExpandedIdx = null;
          renderPanel();
        });
      });
      panel.querySelector('[data-action="toggle-log-live"]')?.addEventListener('click', () => {
        _logAutoRefresh = !_logAutoRefresh;
        if (_logAutoRefresh) startLogAutoRefresh(); else stopLogAutoRefresh();
        renderPanel();
      });
      panel.querySelector('[data-action="clear-logs"]')?.addEventListener('click', () => clearDevLogs());
      panel.querySelectorAll('[data-log-idx]').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt((el as HTMLElement).dataset.logIdx ?? '', 10);
          if (!isNaN(idx)) {
            _logExpandedIdx = _logExpandedIdx === idx ? null : idx;
            renderPanel();
          }
        });
      });
    }

    // Dashboard tab event handlers
    panel.querySelectorAll('[data-action="toggle-analysis"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.closest('.aeginel-collapsible')?.querySelector('.aeginel-collapsible-body') as HTMLElement | null;
        if (!body) return;
        const expanded = body.style.display !== 'none';
        body.style.display = expanded ? 'none' : 'block';
        btn.classList.toggle('is-open', !expanded);
      });
    });
    panel.querySelectorAll('[data-scan-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt((el as HTMLElement).dataset.scanIdx ?? '', 10);
        if (!isNaN(idx)) {
          _selectedScanIdx = idx;
          renderPanel();
        }
      });
    });
    panel.querySelector('[data-action="back-to-list"]')
      ?.addEventListener('click', () => {
        _selectedScanIdx = null;
        renderPanel();
      });
  }
  repositionPanel();
}

function togglePanel() {
  if (!_shadow) return;
  const panel = _shadow.querySelector('.aeginel-floating-panel') as HTMLElement | null;
  if (!panel) return;

  _panelOpen = !_panelOpen;
  panel.style.display = _panelOpen ? 'block' : 'none';

  if (_panelOpen) {
    repositionPanel();
    fetchDashboard().then(async (data) => {
      if (data) {
        _dashboardData = data;
        if (_activeTab === 'logs' && data.devMode) {
          _devLogs = await fetchDevLogs();
          startLogAutoRefresh();
        }
        renderPanel();
      }
    });
  } else {
    stopLogAutoRefresh();
  }
}

async function refreshDashboard() {
  if (!_shadow) return;
  const data = await fetchDashboard();
  if (data) {
    _dashboardData = data;
    updateBadgeDot();
    if (_panelOpen) renderPanel();
  }
}

export function updateFloatingPanel(scanResult: ScanResult) {
  if (!_dashboardData) return;
  _dashboardData.lastScan = scanResult;
  _dashboardData.recentScans = [scanResult, ..._dashboardData.recentScans.filter(s => s.id !== scanResult.id)].slice(0, 20);
  _dashboardData.totalScans++;
  if (_panelOpen) renderPanel();
  updateBadgeDot();
}

function updateBadgeDot() {
  if (!_shadow) return;
  const dot = _shadow.querySelector('.aeginel-badge-dot') as HTMLElement | null;
  const badge = _shadow.querySelector('.aeginel-floating-badge') as HTMLElement | null;
  if (!dot || !badge) return;

  const status = getAegisStatus(_dashboardData);
  dot.className = `aeginel-badge-dot dot-${status}`;
  badge.className = `aeginel-floating-badge status-${status}`;
  badge.dataset.theme = _theme;
}

// ── Main Entry ──────────────────────────────────────────────────────

export async function showFloatingBadge() {
  hideFloatingBadge();

  const visible = await isBadgeVisible();
  if (!visible) return;

  const pos = await loadPosition();

  const host = document.createElement('div');
  host.id = FLOAT_HOST_ID;
  host.style.cssText = `position:fixed;z-index:2147483646;left:${pos.x}px;top:${pos.y}px;margin:0;padding:0;width:auto;height:auto;pointer-events:auto;`;
  _host = host;

  const shadow = host.attachShadow({ mode: 'closed' });
  _shadow = shadow;

  _theme = await loadTheme();

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  // Theme root — wraps everything for CSS variable scoping
  const themeRoot = document.createElement('div');
  themeRoot.className = 'aeginel-theme-root';
  themeRoot.dataset.theme = _theme;
  themeRoot.style.cssText = 'position:relative;display:inline-block;';

  // Badge
  const badge = document.createElement('div');
  badge.className = 'aeginel-floating-badge status-off';
  badge.dataset.theme = _theme;
  badge.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    <span class="aeginel-badge-dot dot-off"></span>
  `;

  // Panel (absolute positioned, direction set by repositionPanel)
  const panel = document.createElement('div');
  panel.className = 'aeginel-floating-panel';
  panel.style.position = 'absolute';
  panel.style.display = 'none';
  _panelOpen = false;

  themeRoot.appendChild(badge);
  themeRoot.appendChild(panel);
  shadow.appendChild(themeRoot);
  document.body.appendChild(host);

  // ── Drag logic (badge tap toggles panel) ──
  attachDragBehavior(badge, togglePanel);

  // Long press / right-click to hide badge entirely
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  badge.addEventListener('pointerdown', () => {
    longPressTimer = setTimeout(() => {
      setBadgeVisible(false);
      hideFloatingBadge();
    }, 1500);
  });
  badge.addEventListener('pointerup', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });
  badge.addEventListener('pointerleave', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });

  badge.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    setBadgeVisible(false);
    hideFloatingBadge();
  });

  // Load initial data, render panel, and position it
  const data = await fetchDashboard();
  if (data) {
    _dashboardData = data;
    updateBadgeDot();
    renderPanel();
  } else {
    repositionPanel();
  }

  // Auto-refresh when tab regains focus (e.g. after configuring AEGIS in another tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _shadow) {
      refreshDashboard();
    }
  });

  // Survival monitor: re-inject badge if it gets removed from DOM
  // (SPA frameworks like React may rebuild body children during navigation/hydration)
  startSurvivalMonitor();
}

export function hideFloatingBadge() {
  stopSurvivalMonitor();
  stopLogAutoRefresh();
  _shadow = null;
  _host = null;
  _panelOpen = false;
  document.getElementById(FLOAT_HOST_ID)?.remove();
}

export function isFloatingBadgeShown(): boolean {
  return document.getElementById(FLOAT_HOST_ID) !== null;
}

// React to visibility toggle from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY_VIS]) return;
  const visible = changes[STORAGE_KEY_VIS].newValue !== false;
  if (visible && !isFloatingBadgeShown()) {
    showFloatingBadge();
  } else if (!visible && isFloatingBadgeShown()) {
    hideFloatingBadge();
  }
});

// ── Survival Monitor ─────────────────────────────────────────────────
// SPA sites may rebuild document.body during hydration or navigation,
// removing our injected host element. This observer detects that and
// re-injects the badge automatically.

function startSurvivalMonitor() {
  stopSurvivalMonitor();

  _survivalObserver = new MutationObserver(() => {
    if (_host && !_host.isConnected) {
      scheduleReinject();
    }
  });

  _survivalObserver.observe(document.documentElement, {
    childList: true,
    subtree: false,
  });

  if (document.body) {
    _survivalObserver.observe(document.body, {
      childList: true,
      subtree: false,
    });
  }
}

function stopSurvivalMonitor() {
  _survivalObserver?.disconnect();
  _survivalObserver = null;
  if (_reinjectTimer) {
    clearTimeout(_reinjectTimer);
    _reinjectTimer = null;
  }
}

let _reinjectAttempts = 0;
const MAX_REINJECT = 10;

function scheduleReinject() {
  if (_reinjectTimer) return;
  if (_reinjectAttempts >= MAX_REINJECT) return;

  _reinjectTimer = setTimeout(() => {
    _reinjectTimer = null;
    _reinjectAttempts++;

    if (!_host || _host.isConnected) return;
    if (!document.body) return;

    // Re-attach the same host element to the current body
    try {
      document.body.appendChild(_host);
      if (_panelOpen) repositionPanel();
    } catch {
      // If re-attach fails, do a full re-init
      showFloatingBadge();
    }
  }, 100);
}
