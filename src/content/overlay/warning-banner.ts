// ── AEGINEL Warning Banner (Shadow DOM) ────────────────────────────────────

import type { ScanResult, ProxyResult } from '../../engine/types';
import { t } from '../../i18n';
import styles from './styles.css?inline';

const BANNER_HOST_ID = 'aeginel-warning-host';
const MODAL_HOST_ID = 'aeginel-modal-host';
const PROTECTED_HOST_ID = 'aeginel-protected-host';
const PROXY_CONFIRM_HOST_ID = 'aeginel-proxy-confirm-host';
const HEALTH_HOST_ID = 'aeginel-health-host';

// ── Show Warning Banner ──────────────────────────────────────────────────

export function showWarningBanner(result: ScanResult, anchor: Element): void {
  hideWarningBanner();

  const host = document.createElement('div');
  host.id = BANNER_HOST_ID;
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
  title.textContent = `AEGINEL: ${t(`risk.${result.level}`)}`;

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

  anchor.parentElement?.insertBefore(host, anchor);
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

// ── Helpers ──────────────────────────────────────────────────────────────

function piiTypeLabel(type: string): string {
  return t(`piiTypes.${type}`) || type;
}
