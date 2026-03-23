// ── Aegis Personal Warning Banner (Shadow DOM) ────────────────────────────────────

import type { ScanResult, ProxyResult } from '../../engine/types';
import { t } from '../../i18n';
import styles from './styles.css?inline';

const BANNER_HOST_ID = 'aeginel-warning-host';
const MODAL_HOST_ID = 'aeginel-modal-host';
const PROTECTED_HOST_ID = 'aeginel-protected-host';
const PROXY_CONFIRM_HOST_ID = 'aeginel-proxy-confirm-host';
const HEALTH_HOST_ID = 'aeginel-health-host';
const SHIELD_HOST_ID = 'aeginel-shield-host';

// ── Show Warning Banner ──────────────────────────────────────────────────

export function showWarningBanner(result: ScanResult, anchor: Element): void {
  hideWarningBanner();

  const useFixed = shouldUseFixedPosition(anchor);

  const host = document.createElement('div');
  host.id = BANNER_HOST_ID;
  if (useFixed) {
    const inputEl = findNearbyInput(anchor);
    const targetEl = inputEl ?? anchor;
    const cRect = getContainerRect(targetEl);
    const bannerWidth = Math.min(cRect.width, 520);
    host.style.cssText = `position:fixed;z-index:2147483647;margin:0;padding:0;width:${bannerWidth}px;left:${cRect.left}px;bottom:${window.innerHeight - cRect.top + 54}px;`;
  } else {
    host.style.width = '100%';
    host.style.boxSizing = 'border-box';
  }
  const shadow = host.attachShadow({ mode: 'closed' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  // Build banner
  const banner = document.createElement('div');
  banner.className = `aeginel-banner level-${result.level}`;

  const shield = document.createElement('span');
  shield.className = 'aeginel-shield';
  shield.textContent = result.level === 'critical' ? '\u{1F6A8}' : result.level === 'high' ? '\u26A0\uFE0F' : '\u{1F6E1}\uFE0F';

  const content = document.createElement('div');
  content.className = 'aeginel-content';

  const title = document.createElement('div');
  title.className = 'aeginel-title';
  title.textContent = `Aegis: ${t(`risk.${result.level}`)}`;

  const detail = document.createElement('div');
  detail.className = 'aeginel-detail';
  const cats = result.categories.slice(0, 3).map(c => t(`categories.${c}`)).join(', ');
  const piiInfo = result.piiDetected.length > 0 ? ` | ${result.piiDetected.length} PII` : '';
  detail.textContent = `${cats}${piiInfo} — ${result.totalLatencyMs.toFixed(1)}ms`;

  content.appendChild(title);
  content.appendChild(detail);

  const score = document.createElement('span');
  score.className = 'aeginel-score';
  score.textContent = String(result.score);

  const close = document.createElement('button');
  close.className = 'aeginel-close';
  close.textContent = '\u2715';
  close.onclick = () => hideWarningBanner();

  banner.appendChild(shield);
  banner.appendChild(content);
  banner.appendChild(score);
  banner.appendChild(close);
  shadow.appendChild(banner);

  if (useFixed) {
    document.body.appendChild(host);
  } else {
    anchor.parentElement?.insertBefore(host, anchor);
  }
}

// ── Hide Warning Banner ──────────────────────────────────────────────────

export function hideWarningBanner(): void {
  document.getElementById(BANNER_HOST_ID)?.remove();
}

// ── Show Block Modal ─────────────────────────────────────────────────────

export function showBlockModal(
  result: ScanResult,
  anchor: Element,
  onOverride: () => void,
): void {
  hideBlockModal();

  const host = document.createElement('div');
  host.id = MODAL_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'aeginel-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'aeginel-modal';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'aeginel-modal-title';
  titleEl.textContent = `\u{1F6A8} ${t('banner.blocked')} (Score: ${result.score}/100)`;

  // Body
  const body = document.createElement('div');
  body.className = 'aeginel-modal-body';
  body.textContent = result.explanation;

  // Category tags
  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'aeginel-modal-categories';
  for (const cat of result.categories) {
    const tag = document.createElement('span');
    tag.className = 'aeginel-tag';
    tag.textContent = t(`categories.${cat}`);
    tagsContainer.appendChild(tag);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'aeginel-modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'aeginel-btn aeginel-btn-cancel';
  cancelBtn.textContent = t('banner.goBack');
  cancelBtn.onclick = () => hideBlockModal();

  const overrideBtn = document.createElement('button');
  overrideBtn.className = 'aeginel-btn aeginel-btn-override';
  overrideBtn.textContent = t('banner.sendAnyway');
  overrideBtn.onclick = () => {
    hideBlockModal();
    hideWarningBanner();
    onOverride();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(overrideBtn);

  modal.appendChild(titleEl);
  modal.appendChild(body);
  modal.appendChild(tagsContainer);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  shadow.appendChild(overlay);

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideBlockModal();
  });

  document.body.appendChild(host);
}

function hideBlockModal(): void {
  document.getElementById(MODAL_HOST_ID)?.remove();
}

// ── Show Protected Banner (PII Proxy notification) ──────────────────────

export function showProtectedBanner(piiCount: number, anchor: Element): void {
  hideProtectedBanner();

  const host = document.createElement('div');
  host.id = PROTECTED_HOST_ID;
  host.style.width = '100%';
  host.style.boxSizing = 'border-box';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const banner = document.createElement('div');
  banner.className = 'aeginel-banner aeginel-protected';

  const shield = document.createElement('span');
  shield.className = 'aeginel-shield';
  shield.textContent = '\u{1F6E1}\uFE0F';

  const content = document.createElement('div');
  content.className = 'aeginel-content';

  const title = document.createElement('div');
  title.className = 'aeginel-title';
  title.textContent = t('proxy.protected', { count: piiCount });

  const detail = document.createElement('div');
  detail.className = 'aeginel-detail';
  detail.textContent = 'PII Proxy';

  content.appendChild(title);
  content.appendChild(detail);

  const close = document.createElement('button');
  close.className = 'aeginel-close';
  close.textContent = '\u2715';
  close.onclick = () => hideProtectedBanner();

  banner.appendChild(shield);
  banner.appendChild(content);
  banner.appendChild(close);
  shadow.appendChild(banner);

  anchor.parentElement?.insertBefore(host, anchor);

  // Auto-dismiss after 3 seconds
  setTimeout(() => hideProtectedBanner(), 3000);
}

function hideProtectedBanner(): void {
  document.getElementById(PROTECTED_HOST_ID)?.remove();
}

// ── Show Proxy Confirm Modal ────────────────────────────────────────────

export function showProxyConfirmModal(
  result: ProxyResult,
  anchor: Element,
  onConfirm: () => void,
  onSkip: () => void,
): void {
  hideProxyConfirmModal();

  const host = document.createElement('div');
  host.id = PROXY_CONFIRM_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'aeginel-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'aeginel-modal';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'aeginel-modal-title aeginel-proxy-title';
  titleEl.textContent = `\u{1F6E1}\uFE0F ${t('proxy.confirmTitle')}`;

  // Description
  const desc = document.createElement('div');
  desc.className = 'aeginel-modal-body';
  desc.textContent = t('proxy.confirmDesc');

  // Mapping table
  const table = document.createElement('div');
  table.className = 'aeginel-proxy-table';

  for (const mapping of result.mappings) {
    const row = document.createElement('div');
    row.className = 'aeginel-proxy-row';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'aeginel-proxy-type';
    typeLabel.textContent = piiTypeLabel(mapping.type);

    const original = document.createElement('span');
    original.className = 'aeginel-proxy-original';
    original.textContent = mapping.original;

    const arrow = document.createElement('span');
    arrow.className = 'aeginel-proxy-arrow';
    arrow.textContent = '\u2192';

    const pseudonym = document.createElement('span');
    pseudonym.className = 'aeginel-proxy-pseudonym';
    pseudonym.textContent = mapping.pseudonym;

    row.appendChild(typeLabel);
    row.appendChild(original);
    row.appendChild(arrow);
    row.appendChild(pseudonym);
    table.appendChild(row);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'aeginel-modal-actions';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'aeginel-btn aeginel-btn-cancel';
  skipBtn.textContent = t('proxy.skip');
  skipBtn.onclick = () => {
    hideProxyConfirmModal();
    onSkip();
  };

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'aeginel-btn aeginel-btn-protect';
  confirmBtn.textContent = t('proxy.confirm');
  confirmBtn.onclick = () => {
    hideProxyConfirmModal();
    onConfirm();
  };

  actions.appendChild(skipBtn);
  actions.appendChild(confirmBtn);

  modal.appendChild(titleEl);
  modal.appendChild(desc);
  modal.appendChild(table);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  shadow.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideProxyConfirmModal();
      onSkip();
    }
  });

  document.body.appendChild(host);
}

function hideProxyConfirmModal(): void {
  document.getElementById(PROXY_CONFIRM_HOST_ID)?.remove();
}

// ── Shield Status Indicator ──────────────────────────────────────────────
// Non-intrusive icon near the input area. Always visible when active.

export type ShieldStatus = 'safe' | 'pii' | 'warning' | 'danger' | 'idle' | 'loading';

const SHIELD_ICONS: Record<ShieldStatus, string> = {
  idle: '\u{1F6E1}\uFE0F',
  loading: '\u23F3',
  safe: '\u2705',
  pii: '\u{1F512}',
  warning: '\u26A0\uFE0F',
  danger: '\u{1F6A8}',
};

const SHIELD_COLORS: Record<ShieldStatus, { bg: string; border: string }> = {
  idle:    { bg: '#161b22', border: '#30363d' },
  loading: { bg: 'rgba(88,166,255,0.12)',  border: 'rgba(88,166,255,0.4)' },
  safe:    { bg: 'rgba(63,185,80,0.12)',   border: 'rgba(63,185,80,0.4)' },
  pii:     { bg: 'rgba(88,166,255,0.12)',  border: 'rgba(88,166,255,0.4)' },
  warning: { bg: 'rgba(210,153,34,0.12)',  border: 'rgba(210,153,34,0.4)' },
  danger:  { bg: 'rgba(248,81,73,0.12)',   border: 'rgba(248,81,73,0.4)' },
};

const SHIELD_TOOLTIPS: Record<ShieldStatus, string> = {
  idle: 'Aegis: Monitoring',
  loading: 'Aegis: Loading ML model...',
  safe: 'Aegis: Safe',
  pii: 'Aegis: PII detected — protected',
  warning: 'Aegis: Risk detected',
  danger: 'Aegis: High risk detected',
};

// ── Layout detection helpers ──────────────────────────────────────────────

const INPUT_CANDIDATES = [
  'textarea',
  '[contenteditable="true"][role="textbox"]',
  '[role="textbox"]',
  '[contenteditable="true"]',
  'input[type="text"]',
];

function findNearbyInput(anchor: Element): Element | null {
  for (const sel of INPUT_CANDIDATES) {
    try { const el = anchor.querySelector(sel); if (el) return el; } catch { /* skip */ }
  }
  if (anchor.parentElement) {
    for (const sel of INPUT_CANDIDATES) {
      try { const el = anchor.parentElement.querySelector(sel); if (el) return el; } catch { /* skip */ }
    }
  }
  for (const sel of INPUT_CANDIDATES) {
    try { const el = document.querySelector(sel); if (el) return el; } catch { /* skip */ }
  }
  return null;
}

function getContainerRect(inputEl: Element): DOMRect {
  const inputRect = inputEl.getBoundingClientRect();
  let best: DOMRect = inputRect;
  let el: Element | null = inputEl.parentElement;
  for (let i = 0; i < 8 && el; i++) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'main' || tag === 'body' || tag === 'html') break;
    const rect = el.getBoundingClientRect();
    if (rect.height > inputRect.height + 30 && rect.width > inputRect.width) {
      best = rect;
      break;
    }
    if (rect.height > best.height + 5) best = rect;
    el = el.parentElement;
  }
  return best;
}

function shouldUseFixedPosition(anchor: Element): boolean {
  const tag = anchor.tagName.toLowerCase();
  if (tag === 'form') return false;
  if (tag === 'main' || tag === 'body' || tag === 'html') return true;
  const parent = anchor.parentElement;
  if (!parent) return true;
  const parentTag = parent.tagName.toLowerCase();
  return parentTag === 'main' || parentTag === 'body' || parentTag === 'html';
}

// ── Fixed-position tracking ──────────────────────────────────────────────

let _shieldPositionCleanup: (() => void) | null = null;
let _shieldPositionRAF: number | null = null;

function updateShieldPosition(host: HTMLElement, target: Element): void {
  const rect = getContainerRect(target);
  host.style.left = `${rect.left}px`;
  host.style.top = `${Math.max(0, rect.top - 46)}px`;
}

function startShieldPositionTracking(host: HTMLElement, target: Element): void {
  stopShieldPositionTracking();
  const update = () => {
    if (!document.body.contains(host)) { stopShieldPositionTracking(); return; }
    updateShieldPosition(host, target);
  };
  const scheduleUpdate = () => {
    if (_shieldPositionRAF) cancelAnimationFrame(_shieldPositionRAF);
    _shieldPositionRAF = requestAnimationFrame(update);
  };
  document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true } as AddEventListenerOptions);
  window.addEventListener('resize', scheduleUpdate);
  _shieldPositionCleanup = () => {
    document.removeEventListener('scroll', scheduleUpdate, true);
    window.removeEventListener('resize', scheduleUpdate);
    if (_shieldPositionRAF) { cancelAnimationFrame(_shieldPositionRAF); _shieldPositionRAF = null; }
  };
}

function stopShieldPositionTracking(): void {
  _shieldPositionCleanup?.();
  _shieldPositionCleanup = null;
}

// ── Show / Hide Shield ───────────────────────────────────────────────────

let _shieldShadow: ShadowRoot | null = null;

export function updateShieldTooltip(tooltip: string): void {
  if (!_shieldShadow) return;
  const el = _shieldShadow.querySelector('.aeginel-shield-indicator') as HTMLElement | null;
  if (el) el.title = tooltip;
}

export function showShieldIndicator(status: ShieldStatus, anchor: Element): void {
  hideShieldIndicator();

  const host = document.createElement('div');
  host.id = SHIELD_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });
  _shieldShadow = shadow;

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const colors = SHIELD_COLORS[status];
  const shield = document.createElement('div');
  shield.className = 'aeginel-shield-indicator';
  shield.style.background = colors.bg;
  shield.style.borderColor = colors.border;
  shield.title = SHIELD_TOOLTIPS[status];
  shield.textContent = SHIELD_ICONS[status];
  shadow.appendChild(shield);

  if (shouldUseFixedPosition(anchor)) {
    const inputEl = findNearbyInput(anchor);
    const targetEl = inputEl ?? anchor;
    host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;margin:0;padding:0;width:auto;height:auto;display:inline-block;overflow:visible;';
    shield.style.pointerEvents = 'auto';
    document.body.appendChild(host);
    updateShieldPosition(host, targetEl);
    startShieldPositionTracking(host, targetEl);
  } else {
    host.style.cssText = 'display:inline-block;width:auto;height:auto;position:relative;z-index:999999;text-align:left;margin:0;padding:0;vertical-align:top;flex-shrink:0;';
    let inserted = false;
    if (anchor.parentElement) {
      try { anchor.parentElement.insertBefore(host, anchor); inserted = true; } catch { /* skip */ }
    }
    if (!inserted) {
      host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;margin:0;padding:0;width:auto;height:auto;';
      document.body.appendChild(host);
    }
  }
}

export function isShieldVisible(): boolean {
  return document.getElementById(SHIELD_HOST_ID) !== null;
}

export function hideShieldIndicator(): void {
  stopShieldPositionTracking();
  document.getElementById(SHIELD_HOST_ID)?.remove();
  _shieldShadow = null;
}

// ── Show Health Status Banner ────────────────────────────────────────────

export function showHealthBanner(
  status: 'degraded' | 'error',
  brokenSelectors: string[],
): void {
  hideHealthBanner();

  const host = document.createElement('div');
  host.id = HEALTH_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const banner = document.createElement('div');
  banner.className = `aeginel-banner ${status === 'error' ? 'aeginel-health-error' : 'aeginel-health-degraded'}`;

  const icon = document.createElement('span');
  icon.className = 'aeginel-shield';
  icon.textContent = status === 'error' ? '\u26A0\uFE0F' : '\u2139\uFE0F';

  const content = document.createElement('div');
  content.className = 'aeginel-content';

  const title = document.createElement('div');
  title.className = 'aeginel-title';
  title.textContent = t(`health.${status}`);

  const detail = document.createElement('div');
  detail.className = 'aeginel-detail';
  detail.textContent = t('health.brokenDetail', { selectors: brokenSelectors.join(', ') });

  content.appendChild(title);
  content.appendChild(detail);

  const close = document.createElement('button');
  close.className = 'aeginel-close';
  close.textContent = '\u2715';
  close.title = t('health.dismiss');
  close.onclick = () => hideHealthBanner();

  banner.appendChild(icon);
  banner.appendChild(content);
  banner.appendChild(close);
  shadow.appendChild(banner);

  // Insert at top of body so it's always visible
  document.body.prepend(host);
}

export function hideHealthBanner(): void {
  document.getElementById(HEALTH_HOST_ID)?.remove();
}

// ── Disconnected Banner (extension context lost) ─────────────────────────

const DISCONNECTED_HOST_ID = 'aeginel-disconnected-host';
let disconnectedShown = false;

export function showDisconnectedBanner(): void {
  if (disconnectedShown) return;
  disconnectedShown = true;

  hideShieldIndicator();

  const host = document.createElement('div');
  host.id = DISCONNECTED_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const banner = document.createElement('div');
  banner.className = 'aeginel-banner aeginel-health-degraded';

  const icon = document.createElement('span');
  icon.className = 'aeginel-shield';
  icon.textContent = '\u{1F504}';

  const content = document.createElement('div');
  content.className = 'aeginel-content';

  const title = document.createElement('div');
  title.className = 'aeginel-title';
  title.textContent = 'Aegis: 연결이 끊겼습니다';

  const detail = document.createElement('div');
  detail.className = 'aeginel-detail';
  detail.textContent = '보호 기능을 복구하려면 새로고침이 필요합니다.';

  content.appendChild(title);
  content.appendChild(detail);

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'aeginel-close';
  refreshBtn.textContent = '↻';
  refreshBtn.title = '새로고침';
  refreshBtn.style.fontSize = '16px';
  refreshBtn.style.cursor = 'pointer';
  refreshBtn.onclick = () => location.reload();

  banner.appendChild(icon);
  banner.appendChild(content);
  banner.appendChild(refreshBtn);
  shadow.appendChild(banner);

  document.body.prepend(host);
}

export function hideDisconnectedBanner(): void {
  document.getElementById(DISCONNECTED_HOST_ID)?.remove();
  disconnectedShown = false;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function piiTypeLabel(type: string): string {
  return t(`piiTypes.${type}`) || type;
}
