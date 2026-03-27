// ── Aegis Personal Warning Banner (Shadow DOM) ────────────────────────────────────

import type { ScanResult, ProxyResult, PiiMatch, PiiModifications } from '../../engine/types';
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
let _shieldScanResult: ScanResult | null = null;
let _piiPopoverOpen = false;
let _baseShieldStatus: ShieldStatus = 'idle';

export function updateShieldScanResult(result: ScanResult): void {
  if (_shieldScanResult?.input !== result.input) {
    _cancelledPiiIndices.clear();
    _manualPiiItems = [];
    _previewPseudonyms.clear();
  }
  _shieldScanResult = result;
}

// ── PII Popover user modifications ──────────────────────────────────────

let _cancelledPiiIndices = new Set<number>();

interface ManualPiiItem {
  startIndex: number;
  endIndex: number;
  originalText: string;
  pseudonym: string;
}

let _manualPiiItems: ManualPiiItem[] = [];
let _previewPseudonyms = new Map<number, string>();
let _tooltipTimer: ReturnType<typeof setTimeout> | null = null;
let _editingManualIndex: number | null = null;
let _editBlurLocked = false;

let _dragSegInfo: {
  textArea: HTMLElement;
  mouseStartX: number;
  mouseStartY: number;
} | null = null;

interface ProtectedRange {
  start: number;
  end: number;
  type: string;
  piiIndex?: number;
  manualIndex?: number;
  isManual: boolean;
  pseudonym: string;
}

interface TextSegment {
  start: number;
  end: number;
  text: string;
  isProtected: boolean;
  protectedRange?: ProtectedRange;
}

function generatePreviewPseudonym(type: string, original: string): string {
  const rd = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  const rh = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  switch (type) {
    case 'email': return `user_${rh(4)}@example.com`;
    case 'phone_kr': return `010-${rd(4)}-${rd(4)}`;
    case 'phone_intl': return `+1-${rd(4)}-${rd(4)}`;
    case 'korean_rrn': return `${rd(6)}-${rd(7)}`;
    case 'credit_card': return `${rd(4)}-${rd(4)}-${rd(4)}-${rd(4)}`;
    case 'ssn': return `${rd(3)}-${rd(2)}-${rd(4)}`;
    case 'givenname': case 'surname': return `User_${rh(3)}`;
    case 'username': return `user_${rh(4)}`;
    case 'password': return `P@ss${rh(4)}!`;
    case 'ip_address': return `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    case 'dateofbirth': return `${1970 + Math.floor(Math.random() * 40)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`;
    case 'passport': return `M${rd(8)}`;
    case 'accountnum': return rd(original.replace(/\D/g, '').length || 10);
    default: return original.replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
  }
}

function getOrCreatePreviewPseudonym(index: number, match: PiiMatch): string {
  if (_previewPseudonyms.has(index)) return _previewPseudonyms.get(index)!;
  const preview = generatePreviewPseudonym(match.type, match.value);
  _previewPseudonyms.set(index, preview);
  return preview;
}

function generateManualPseudonym(text: string): string {
  const hasDigits = /\d/.test(text);
  const hasLetters = /[a-zA-Z\u3131-\u318E\uAC00-\uD7A3]/.test(text);
  if (hasDigits && !hasLetters) {
    return text.replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
  }
  if (hasLetters && !hasDigits) {
    const hex = Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `[MASKED_${hex}]`;
  }
  return text.replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
}

function getActiveProtectedCount(): number {
  let count = _shieldScanResult
    ? _shieldScanResult.piiDetected.length - _cancelledPiiIndices.size
    : 0;
  count += _manualPiiItems.length;
  return Math.max(0, count);
}

function getEffectiveShieldStatus(base: ShieldStatus): ShieldStatus {
  if (base === 'safe' && getActiveProtectedCount() > 0) {
    return 'pii';
  }
  return base;
}

function getProtectedRanges(): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  if (_shieldScanResult) {
    for (let i = 0; i < _shieldScanResult.piiDetected.length; i++) {
      if (_cancelledPiiIndices.has(i)) continue;
      const m = _shieldScanResult.piiDetected[i];
      ranges.push({
        start: m.startIndex, end: m.endIndex, type: m.type,
        piiIndex: i, isManual: false,
        pseudonym: getOrCreatePreviewPseudonym(i, m),
      });
    }
  }
  for (let i = 0; i < _manualPiiItems.length; i++) {
    const m = _manualPiiItems[i];
    ranges.push({
      start: m.startIndex, end: m.endIndex, type: 'manual',
      manualIndex: i, isManual: true, pseudonym: m.pseudonym,
    });
  }
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

function buildTextSegments(input: string, ranges: ProtectedRange[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let pos = 0;
  for (const range of ranges) {
    if (range.start > pos) {
      segments.push({ start: pos, end: range.start, text: input.slice(pos, range.start), isProtected: false });
    }
    segments.push({ start: range.start, end: range.end, text: input.slice(range.start, range.end), isProtected: true, protectedRange: range });
    pos = range.end;
  }
  if (pos < input.length) {
    segments.push({ start: pos, end: input.length, text: input.slice(pos), isProtected: false });
  }
  return segments;
}

function getCharIndexFromPoint(el: HTMLElement, x: number, y: number): number {
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;
  const text = (textNode as Text).textContent || '';
  if (text.length === 0) return 0;
  const range = document.createRange();
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i <= text.length; i++) {
    try {
      range.setStart(textNode, i);
      range.setEnd(textNode, i);
      const rect = range.getBoundingClientRect();
      const dist = Math.hypot(rect.left - x, rect.top + rect.height / 2 - y);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    } catch { break; }
  }
  return closestIdx;
}

export function updateShieldTooltip(tooltip: string): void {
  if (!_shieldShadow) return;
  const el = _shieldShadow.querySelector('.aeginel-shield-indicator') as HTMLElement | null;
  if (el) el.title = tooltip;
}

function getOrigIndexFromPointInTextArea(textArea: HTMLElement, x: number, y: number): number | null {
  let closestIndex: number | null = null;
  let closestDist = Infinity;
  const segs = textArea.querySelectorAll('.aeginel-pii-seg');
  for (const seg of segs) {
    const htmlSeg = seg as HTMLElement;
    const segStart = parseInt(htmlSeg.dataset.start!, 10);
    const textNode = htmlSeg.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;
    const text = (textNode as Text).textContent || '';
    if (text.length === 0) continue;
    const range = document.createRange();
    for (let i = 0; i <= text.length; i++) {
      try {
        range.setStart(textNode, i);
        range.setEnd(textNode, i);
        const rect = range.getBoundingClientRect();
        const dist = Math.hypot(rect.left - x, rect.top + rect.height / 2 - y);
        if (dist < closestDist) { closestDist = dist; closestIndex = segStart + i; }
      } catch { break; }
    }
  }
  return closestIndex;
}

function getWordBoundsAt(text: string, charIndex: number): [number, number] {
  const wordRegex = /[\w\u3131-\u318E\uAC00-\uD7A3]+/g;
  let match;
  while ((match = wordRegex.exec(text)) !== null) {
    if (match.index <= charIndex && match.index + match[0].length >= charIndex) {
      return [match.index, match.index + match[0].length];
    }
  }
  if (charIndex < text.length) return [charIndex, charIndex + 1];
  return [Math.max(0, charIndex - 1), charIndex];
}

function getUnprotectedSubranges(
  start: number, end: number, protectedRanges: ProtectedRange[],
): Array<{ start: number; end: number }> {
  const result: Array<{ start: number; end: number }> = [];
  let pos = start;
  for (const range of protectedRanges) {
    if (range.end <= pos) continue;
    if (range.start >= end) break;
    if (range.start > pos) {
      result.push({ start: pos, end: Math.min(range.start, end) });
    }
    pos = Math.max(pos, range.end);
  }
  if (pos < end) {
    result.push({ start: pos, end });
  }
  return result;
}

function buildPiiPopoverElement(matches: PiiMatch[], input: string): HTMLElement {
  const popover = document.createElement('div');
  popover.className = 'aeginel-pii-popover';

  const activeCount = getActiveProtectedCount();

  // Header
  const header = document.createElement('div');
  header.className = 'aeginel-pii-popover-header';
  const headerText = document.createElement('span');
  headerText.textContent = `${SHIELD_ICONS.pii} ${t('popover.title') || 'Privacy Protection'}`;
  header.appendChild(headerText);

  const countBadge = document.createElement('span');
  countBadge.className = 'aeginel-pii-popover-count';
  countBadge.textContent = String(activeCount);
  header.appendChild(countBadge);
  popover.appendChild(header);

  // Always-visible description
  const desc = document.createElement('div');
  desc.className = 'aeginel-pii-popover-desc';
  desc.textContent = t('popover.inlineDesc') || 'Highlighted data will be replaced with fake values when sent.';
  popover.appendChild(desc);

  // Text area with highlighted PII
  const textArea = document.createElement('div');
  textArea.className = 'aeginel-pii-text-area';

  const ranges = getProtectedRanges();
  const segments = buildTextSegments(input, ranges);

  for (const seg of segments) {
    if (seg.isProtected && seg.protectedRange) {
      const mark = document.createElement('mark');
      mark.className = 'aeginel-pii-hl-mark';
      mark.dataset.rangeStart = String(seg.start);
      mark.dataset.rangeEnd = String(seg.end);

      const range = seg.protectedRange;
      const isEditing = range.isManual && range.manualIndex === _editingManualIndex;

      if (isEditing) {
        mark.className = 'aeginel-pii-hl-mark aeginel-pii-hl-mark--editing';
        const manualIdx = range.manualIndex!;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'aeginel-pii-inline-input';
        input.value = range.pseudonym;
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.style.width = `${Math.max(range.pseudonym.length, 1)}ch`;

        input.addEventListener('input', (ev) => {
          ev.stopPropagation();
          input.style.width = `${Math.max(input.value.length, 1)}ch`;
        });

        const stopAll = (ev: Event) => { ev.stopPropagation(); ev.stopImmediatePropagation(); };
        input.addEventListener('mousedown', stopAll);
        input.addEventListener('mouseup', stopAll);
        input.addEventListener('click', stopAll);
        input.addEventListener('pointerdown', stopAll);
        input.addEventListener('pointerup', stopAll);
        input.addEventListener('focus', stopAll);

        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            _editBlurLocked = false;
            const val = input.value.trim();
            if (val && _manualPiiItems[manualIdx]) {
              _manualPiiItems[manualIdx].pseudonym = val;
            }
            _editingManualIndex = null;
            rebuildPopoverContent();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            _editBlurLocked = false;
            _editingManualIndex = null;
            rebuildPopoverContent();
          }
        });
        input.addEventListener('keyup', stopAll);
        input.addEventListener('keypress', stopAll);

        input.addEventListener('blur', () => {
          if (_editBlurLocked) return;
          const val = input.value.trim();
          if (val && _manualPiiItems[manualIdx]) {
            _manualPiiItems[manualIdx].pseudonym = val;
          }
          _editingManualIndex = null;
          rebuildPopoverContent();
        });

        mark.textContent = '';
        mark.appendChild(input);

        _editBlurLocked = true;
        setTimeout(() => {
          input.focus({ preventScroll: true });
          input.select();
          _editBlurLocked = false;
        }, 50);
      } else {
        mark.textContent = seg.text;
        mark.addEventListener('mouseenter', () => showPiiTooltip(mark, range));
        mark.addEventListener('mouseleave', () => {
          _tooltipTimer = setTimeout(() => {
            if (!_shieldShadow?.querySelector('.aeginel-pii-tooltip:hover')) hidePiiTooltip();
          }, 150);
        });
        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          if (range.isManual && range.manualIndex !== undefined) {
            _manualPiiItems.splice(range.manualIndex, 1);
          } else if (range.piiIndex !== undefined) {
            _cancelledPiiIndices.add(range.piiIndex);
          }
          hidePiiTooltip();
          rebuildPopoverContent();
        });
      }

      textArea.appendChild(mark);
    } else {
      const span = document.createElement('span');
      span.className = 'aeginel-pii-seg';
      span.textContent = seg.text;
      span.dataset.start = String(seg.start);
      span.dataset.end = String(seg.end);

      textArea.appendChild(span);
    }
  }

  textArea.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.aeginel-pii-hl-mark') || target.classList.contains('aeginel-pii-inline-input')) return;
    _dragSegInfo = { textArea, mouseStartX: e.clientX, mouseStartY: e.clientY };
  });

  textArea.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!_shieldScanResult) return;
    const target = e.target as HTMLElement;
    if (!target.classList.contains('aeginel-pii-seg')) return;
    const segStart = parseInt(target.dataset.start!, 10);
    const segText = _shieldScanResult.input.slice(segStart, parseInt(target.dataset.end!, 10));
    const charIdx = getCharIndexFromPoint(target, e.clientX, e.clientY);
    const [wordStart, wordEnd] = getWordBoundsAt(segText, charIdx);
    const word = segText.slice(wordStart, wordEnd);
    if (!word.trim()) return;
    try { window.getSelection()?.removeAllRanges(); } catch { /* ok */ }
    const pseudonym = generateManualPseudonym(word);
    _manualPiiItems.push({ startIndex: segStart + wordStart, endIndex: segStart + wordEnd, originalText: word, pseudonym });
    _editingManualIndex = _manualPiiItems.length - 1;
    rebuildPopoverContent();
  });

  // Mouseup handler for drag-to-select
  popover.addEventListener('mouseup', handleDragEnd);

  popover.appendChild(textArea);

  // Click outside inline input → confirm edit
  popover.addEventListener('mousedown', (e) => {
    if (_editingManualIndex !== null && !(e.target as HTMLElement)?.classList?.contains('aeginel-pii-inline-input')) {
      const inp = popover.querySelector('.aeginel-pii-inline-input') as HTMLInputElement | null;
      if (inp) {
        e.preventDefault();
        _editBlurLocked = false;
        const val = inp.value.trim();
        const idx = _editingManualIndex!;
        if (val && _manualPiiItems[idx]) {
          _manualPiiItems[idx].pseudonym = val;
        }
        _editingManualIndex = null;
        rebuildPopoverContent();
        return;
      }
    }
  });

  // Interaction hints
  const hintBar = document.createElement('div');
  hintBar.className = 'aeginel-pii-hint-bar';

  const clickHint = document.createElement('span');
  clickHint.className = 'aeginel-pii-hint-item';
  clickHint.textContent = t('popover.hintClick') || 'Click highlight \u2192 remove';
  hintBar.appendChild(clickHint);

  const sep = document.createElement('span');
  sep.className = 'aeginel-pii-hint-sep';
  sep.textContent = '\u00B7';
  hintBar.appendChild(sep);

  const dragHint = document.createElement('span');
  dragHint.className = 'aeginel-pii-hint-item';
  dragHint.textContent = t('popover.hintDrag') || 'Drag text \u2192 add mask';
  hintBar.appendChild(dragHint);

  popover.appendChild(hintBar);

  return popover;
}

function showPiiTooltip(markEl: HTMLElement, range: ProtectedRange): void {
  if (_tooltipTimer) { clearTimeout(_tooltipTimer); _tooltipTimer = null; }
  hidePiiTooltip();
  if (!_shieldShadow) return;

  const tooltip = document.createElement('div');
  tooltip.className = 'aeginel-pii-tooltip';

  if (range.type !== 'manual') {
    const typeChip = document.createElement('span');
    typeChip.className = 'aeginel-pii-tooltip-chip';
    typeChip.textContent = piiTypeLabel(range.type);
    tooltip.appendChild(typeChip);

    const arrow = document.createElement('span');
    arrow.className = 'aeginel-pii-tooltip-arrow';
    arrow.textContent = '\u2192';
    tooltip.appendChild(arrow);
  }

  const pseudo = document.createElement('span');
  pseudo.className = 'aeginel-pii-tooltip-pseudo';
  pseudo.textContent = range.pseudonym;
  tooltip.appendChild(pseudo);

  tooltip.addEventListener('mouseenter', () => {
    if (_tooltipTimer) { clearTimeout(_tooltipTimer); _tooltipTimer = null; }
  });
  tooltip.addEventListener('mouseleave', () => {
    _tooltipTimer = setTimeout(hidePiiTooltip, 150);
  });

  // Place tooltip inside the popover (absolute positioning relative to popover)
  const popover = _shieldShadow.querySelector('.aeginel-pii-popover') as HTMLElement;
  if (!popover) return;
  popover.appendChild(tooltip);

  const popoverRect = popover.getBoundingClientRect();
  const markRect = markEl.getBoundingClientRect();
  const ttRect = tooltip.getBoundingClientRect();

  let left = markRect.left - popoverRect.left + markRect.width / 2 - ttRect.width / 2;
  let top = markRect.top - popoverRect.top - ttRect.height - 8;

  left = Math.max(0, Math.min(left, popoverRect.width - ttRect.width));
  if (markRect.top - popoverRect.top < ttRect.height + 12) {
    top = markRect.bottom - popoverRect.top + 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hidePiiTooltip(): void {
  if (_tooltipTimer) { clearTimeout(_tooltipTimer); _tooltipTimer = null; }
  _shieldShadow?.querySelector('.aeginel-pii-tooltip')?.remove();
}

function handleDragEnd(e: MouseEvent): void {
  if (!_dragSegInfo || !_shieldScanResult) { _dragSegInfo = null; return; }

  const info = _dragSegInfo;
  _dragSegInfo = null;

  const dx = Math.abs(e.clientX - info.mouseStartX);
  const dy = Math.abs(e.clientY - info.mouseStartY);
  if (dx < 3 && dy < 3) return;

  const startIdx = getOrigIndexFromPointInTextArea(info.textArea, info.mouseStartX, info.mouseStartY);
  const endIdx = getOrigIndexFromPointInTextArea(info.textArea, e.clientX, e.clientY);
  if (startIdx === null || endIdx === null) return;

  const dragForward = startIdx <= endIdx;
  let origStart = Math.min(startIdx, endIdx);
  let origEnd = Math.max(startIdx, endIdx);
  if (origStart >= origEnd) return;

  let selectedText = _shieldScanResult.input.slice(origStart, origEnd);

  if (selectedText.includes('\n')) {
    if (dragForward) {
      const nlIdx = selectedText.indexOf('\n');
      origEnd = origStart + nlIdx;
    } else {
      const lastNl = selectedText.lastIndexOf('\n');
      origStart = origStart + lastNl + 1;
    }
    selectedText = _shieldScanResult.input.slice(origStart, origEnd);
  }
  if (!selectedText.trim() || origStart >= origEnd) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  try { window.getSelection()?.removeAllRanges(); } catch { /* ok */ }

  const existingRanges = getProtectedRanges();
  const subranges = getUnprotectedSubranges(origStart, origEnd, existingRanges);

  for (const sub of subranges) {
    const subText = _shieldScanResult!.input.slice(sub.start, sub.end);
    if (!subText.trim()) continue;
    const pseudonym = generateManualPseudonym(subText);
    _manualPiiItems.push({ startIndex: sub.start, endIndex: sub.end, originalText: subText, pseudonym });
  }

  if (subranges.length > 0) {
    _editingManualIndex = _manualPiiItems.length - 1;
    rebuildPopoverContent();
  }
}

function rebuildPopoverContent(): void {
  if (!_shieldShadow || !_shieldScanResult || !_piiPopoverOpen) return;
  const existing = _shieldShadow.querySelector('.aeginel-pii-popover');
  if (!existing) return;
  existing.remove();
  const newPopover = buildPiiPopoverElement(_shieldScanResult.piiDetected, _shieldScanResult.input);
  _shieldShadow.appendChild(newPopover);
  updateShieldBadge();
}

function updateShieldBadge(): void {
  if (!_shieldShadow) return;
  const shield = _shieldShadow.querySelector('.aeginel-shield-indicator') as HTMLElement | null;
  if (!shield) return;

  const count = getActiveProtectedCount();
  const effectiveStatus = getEffectiveShieldStatus(_baseShieldStatus);

  const iconNode = shield.firstChild;
  if (iconNode && iconNode.nodeType === Node.TEXT_NODE) {
    iconNode.textContent = SHIELD_ICONS[effectiveStatus];
  }

  const colors = SHIELD_COLORS[effectiveStatus];
  shield.style.background = colors.bg;
  shield.style.borderColor = colors.border;
  shield.title = SHIELD_TOOLTIPS[effectiveStatus];

  let badge = _shieldShadow.querySelector('.aeginel-shield-badge') as HTMLElement | null;
  if (effectiveStatus === 'pii' && count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'aeginel-shield-badge';
      shield.appendChild(badge);
    }
    badge.textContent = String(count);
    badge.style.display = '';
  } else if (badge) {
    badge.style.display = 'none';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function togglePiiPopover(): void {
  if (!_shieldShadow) return;

  const existing = _shieldShadow.querySelector('.aeginel-pii-popover');
  if (existing) {
    existing.remove();
    hidePiiTooltip();
    _piiPopoverOpen = false;
    return;
  }

  const matches = _shieldScanResult?.piiDetected;
  const input = _shieldScanResult?.input;
  if (!input) return;

  const popover = buildPiiPopoverElement(matches || [], input);
  _shieldShadow.appendChild(popover);
  _piiPopoverOpen = true;

  requestAnimationFrame(() => {
    const popoverRect = popover.getBoundingClientRect();
    if (popoverRect.bottom > window.innerHeight) {
      popover.classList.add('aeginel-pii-popover--above');
    }
  });

  const onClickOutside = (e: MouseEvent) => {
    // Closed shadow DOM hides internal elements from composedPath(),
    // so we check against the shadow host element instead.
    const shieldHost = document.getElementById(SHIELD_HOST_ID);
    if (!shieldHost) {
      _piiPopoverOpen = false;
      document.removeEventListener('click', onClickOutside, true);
      return;
    }
    const path = e.composedPath();
    if (!path.includes(shieldHost)) {
      const currentPopover = _shieldShadow?.querySelector('.aeginel-pii-popover');
      if (currentPopover) currentPopover.remove();
      hidePiiTooltip();
      _piiPopoverOpen = false;
      document.removeEventListener('click', onClickOutside, true);
    }
  };
  setTimeout(() => document.addEventListener('click', onClickOutside, true), 0);
}

export function showShieldIndicator(status: ShieldStatus, anchor: Element): void {
  hideShieldIndicator();
  _baseShieldStatus = status;
  const effectiveStatus = getEffectiveShieldStatus(status);

  const host = document.createElement('div');
  host.id = SHIELD_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed', delegatesFocus: true });
  _shieldShadow = shadow;

  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const colors = SHIELD_COLORS[effectiveStatus];
  const shield = document.createElement('div');
  shield.className = 'aeginel-shield-indicator';
  shield.style.background = colors.bg;
  shield.style.borderColor = colors.border;
  shield.style.cursor = status === 'idle' || status === 'loading' ? 'default' : 'pointer';
  shield.title = SHIELD_TOOLTIPS[effectiveStatus];
  shield.appendChild(document.createTextNode(SHIELD_ICONS[effectiveStatus]));

  if (effectiveStatus === 'pii') {
    const count = getActiveProtectedCount();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'aeginel-shield-badge';
      badge.textContent = String(count);
      shield.appendChild(badge);
    }
  }

  if (status !== 'idle' && status !== 'loading') {
    shield.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePiiPopover();
    });
  }

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
  if (type === 'manual') return t('popover.manualType') || 'Manual';
  return t(`piiTypes.${type}`) || type;
}

// ── PII Modifications Export (for proxy integration) ────────────────────

export function getPiiModifications(): PiiModifications {
  const excluded: Array<{ start: number; end: number }> = [];
  if (_shieldScanResult) {
    for (const idx of _cancelledPiiIndices) {
      const match = _shieldScanResult.piiDetected[idx];
      if (match) excluded.push({ start: match.startIndex, end: match.endIndex });
    }
  }
  return {
    excluded,
    manual: _manualPiiItems.map(m => ({
      start: m.startIndex, end: m.endIndex, pseudonym: m.pseudonym,
    })),
  };
}

export function resetPiiModifications(): void {
  _cancelledPiiIndices.clear();
  _manualPiiItems = [];
  _previewPseudonyms.clear();
}
