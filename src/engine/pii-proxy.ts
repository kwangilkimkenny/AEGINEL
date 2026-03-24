// ── Aegis Personal PII Proxy Engine (가명화) ──────────────────────────────────────
// Pseudonymizes PII before sending to LLM, restores originals in responses.

import { scanPii } from './pii-scanner';
import type { AeginelConfig, PiiMapping, PiiMatch, PiiType, ProxyResult } from './types';

// ── Fake Value Generators ───────────────────────────────────────────────

function randomDigits(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => String(b % 10)).join('');
}

function randomLetter(): string {
  const arr = new Uint8Array(1);
  crypto.getRandomValues(arr);
  return String.fromCharCode(65 + (arr[0] % 26));
}

function randomHex(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => (b % 16).toString(16)).join('');
}

/** Generate a Luhn-valid credit card number with given prefix */
function generateLuhnNumber(prefix: string, totalLen: number): string {
  const body = prefix + randomDigits(totalLen - prefix.length - 1);
  // Compute Luhn check digit
  let sum = 0;
  let alt = true;
  for (let i = body.length - 1; i >= 0; i--) {
    let n = parseInt(body[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return body + String(checkDigit);
}

function generateFakeValue(type: PiiType, original: string): string {
  switch (type) {
    case 'korean_rrn': {
      // Format: YYMMDD-GNNNNNN — preserve format, randomize
      const yy = randomDigits(2);
      const mm = String(1 + (parseInt(randomDigits(1), 10) % 12)).padStart(2, '0');
      const dd = String(1 + (parseInt(randomDigits(1), 10) % 28)).padStart(2, '0');
      const gender = String(1 + (parseInt(randomDigits(1), 10) % 4));
      return `${yy}${mm}${dd}-${gender}${randomDigits(6)}`;
    }

    case 'credit_card': {
      // Preserve separator format from original
      const digits = original.replace(/\D/g, '');
      const prefix = digits[0] === '3' ? '37' : digits[0];
      const fake = generateLuhnNumber(prefix, digits.length);
      // Reconstruct with original separators
      const separators: string[] = [];
      let di = 0;
      for (const ch of original) {
        if (/\d/.test(ch)) {
          di++;
        } else {
          separators.push(`${di}:${ch}`);
        }
      }
      let result = fake;
      // Re-insert separators at original positions
      let offset = 0;
      for (const sep of separators) {
        const [posStr, ch] = sep.split(':');
        const pos = parseInt(posStr, 10) + offset;
        if (pos >= 0 && pos <= result.length) {
          result = result.slice(0, pos) + ch + result.slice(pos);
          offset++;
        }
      }
      return result;
    }

    case 'email': {
      const hex = randomHex(4);
      return `user_${hex}@example.com`;
    }

    case 'phone_kr': {
      // Preserve format: 010-XXXX-XXXX or 01012345678
      const hasDash = /[-–.]/.test(original);
      const prefix = original.replace(/\D/g, '').slice(0, 3);
      if (hasDash) {
        return `${prefix}-${randomDigits(4)}-${randomDigits(4)}`;
      }
      return `${prefix}${randomDigits(8)}`;
    }

    case 'phone_intl': {
      // Preserve + prefix and rough format
      const match = original.match(/^\+(\d{1,3})/);
      const cc = match ? match[1] : '1';
      return `+${cc}-${randomDigits(4)}-${randomDigits(4)}`;
    }

    case 'ssn': {
      // XXX-XX-XXXX — avoid invalid SSN prefixes (000, 666, 900-999)
      let area: string;
      do {
        area = randomDigits(3);
      } while (area === '000' || area === '666' || area[0] === '9');
      let group: string;
      do {
        group = randomDigits(2);
      } while (group === '00');
      let serial: string;
      do {
        serial = randomDigits(4);
      } while (serial === '0000');
      return `${area}-${group}-${serial}`;
    }

    case 'passport': {
      // Letter(s) + digits, same length
      const letterPart = original.match(/^[A-Z]+/)?.[0] ?? 'M';
      const digitLen = original.length - letterPart.length;
      let letters = '';
      for (let i = 0; i < letterPart.length; i++) letters += randomLetter();
      return `${letters}${randomDigits(digitLen)}`;
    }

    case 'givenname':
    case 'surname':
      return `User_${randomHex(3)}`;

    case 'username':
      return `user_${randomHex(4)}`;

    case 'dateofbirth': {
      const yy = 1970 + (parseInt(randomDigits(2), 10) % 40);
      const mm = String(1 + (parseInt(randomDigits(1), 10) % 12)).padStart(2, '0');
      const dd = String(1 + (parseInt(randomDigits(1), 10) % 28)).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }

    case 'idcard':
      return `ID${randomDigits(8)}`;

    case 'street':
      return `${randomDigits(3)} Example St`;

    case 'city':
      return 'Sampleville';

    case 'zipcode':
      return randomDigits(5);

    case 'buildingnum':
      return randomDigits(3);

    case 'ip_address':
      return `10.${parseInt(randomDigits(3), 10) % 256}.${parseInt(randomDigits(3), 10) % 256}.${parseInt(randomDigits(3), 10) % 256}`;

    case 'password':
      return `P@ss${randomHex(4)}!`;

    case 'accountnum':
      return randomDigits(original.replace(/\D/g, '').length || 10);

    case 'driverlicensenum':
      return `${randomLetter()}${randomLetter()}${randomDigits(6)}`;

    case 'company':
      return `Corp_${randomHex(3)}`;

    default:
      return `[REDACTED_${type}]`;
  }
}

// ── Overlapping Entity Resolution ───────────────────────────────────────
// NER models may produce overlapping spans of different types
// (e.g. "test" as USERNAME overlapping with "test@gmail.com" as EMAIL).
// Replacing overlapping spans corrupts indices, so we keep only
// non-overlapping entities, preferring longer (more specific) spans.

function removeOverlappingMatches(matches: PiiMatch[]): PiiMatch[] {
  if (matches.length <= 1) return matches;

  // Sort by start ascending, break ties by span length descending (longer wins)
  const sorted = [...matches].sort((a, b) => {
    if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
    return (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
  });

  const result: PiiMatch[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const curr = sorted[i];
    // Skip entities whose range overlaps with the last accepted entity
    if (curr.startIndex < last.endIndex) continue;
    result.push(curr);
  }
  return result;
}

// ── PiiProxyEngine ──────────────────────────────────────────────────────

const MAX_SESSIONS = 50;
const MAX_MAPPINGS_PER_SESSION = 500;

export class PiiProxyEngine {
  /** sessionId → PiiMapping[] */
  private sessionMappings = new Map<string, PiiMapping[]>();
  private persistCallback?: (data: Record<string, PiiMapping[]>) => void;

  /**
   * Register a callback that fires whenever mappings change,
   * so the caller (service worker) can persist them externally.
   */
  onMappingsChanged(cb: (data: Record<string, PiiMapping[]>) => void): void {
    this.persistCallback = cb;
  }

  /**
   * Serialize all session mappings for external storage.
   */
  exportMappings(): Record<string, PiiMapping[]> {
    const obj: Record<string, PiiMapping[]> = {};
    for (const [key, value] of this.sessionMappings.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Import previously persisted mappings (merge, not overwrite).
   */
  importMappings(data: Record<string, PiiMapping[]>): void {
    for (const [key, value] of Object.entries(data)) {
      if (!this.sessionMappings.has(key)) {
        this.sessionMappings.set(key, value);
      }
    }
  }

  private notifyPersist(): void {
    if (this.persistCallback) {
      this.persistCallback(this.exportMappings());
    }
  }

  /**
   * Detect PII in text and replace with format-preserving pseudonyms.
   */
  async pseudonymize(text: string, config: AeginelConfig, sessionId: string): Promise<ProxyResult> {
    const piiMatches = await scanPii(text, config);

    if (piiMatches.length === 0) {
      return { originalText: text, proxiedText: text, mappings: [], piiCount: 0 };
    }

    // Remove overlapping spans BEFORE replacement to prevent index corruption
    const deduped = removeOverlappingMatches(piiMatches);

    // Sort by position descending so we can replace from the end
    const sorted = [...deduped].sort((a, b) => b.startIndex - a.startIndex);

    const mappings: PiiMapping[] = [];
    let proxied = text;

    for (const pii of sorted) {
      const original = text.slice(pii.startIndex, pii.endIndex);
      // Check if we already have a mapping for this exact original value in this session
      const existing = this.sessionMappings.get(sessionId)
        ?.find((m) => m.original === original && m.type === pii.type);

      const pseudonym = existing?.pseudonym ?? generateFakeValue(pii.type, original);

      proxied = proxied.slice(0, pii.startIndex) + pseudonym + proxied.slice(pii.endIndex);

      mappings.push({
        original,
        pseudonym,
        type: pii.type,
        position: { start: pii.startIndex, end: pii.endIndex },
      });
    }

    // Store mappings for this session (append with limit)
    const prev = this.sessionMappings.get(sessionId) ?? [];
    const combined = [...prev, ...mappings];
    if (combined.length > MAX_MAPPINGS_PER_SESSION) {
      combined.splice(0, combined.length - MAX_MAPPINGS_PER_SESSION);
    }
    this.sessionMappings.set(sessionId, combined);

    // Evict oldest session if limit exceeded
    if (this.sessionMappings.size > MAX_SESSIONS) {
      const oldest = this.sessionMappings.keys().next().value;
      if (oldest) this.sessionMappings.delete(oldest);
    }

    this.notifyPersist();

    return {
      originalText: text,
      proxiedText: proxied,
      mappings: mappings.reverse(), // return in original order
      piiCount: mappings.length,
    };
  }

  /**
   * Restore pseudonyms back to originals in a response text.
   * First tries the exact session, then falls back to searching related sessions.
   */
  restore(text: string, sessionId: string): string {
    // First try exact session match (most common case)
    const sessionMappings = this.sessionMappings.get(sessionId);
    if (sessionMappings && sessionMappings.length > 0) {
      let restored = text;
      for (const mapping of sessionMappings) {
        restored = restored.split(mapping.pseudonym).join(mapping.original);
      }
      if (restored !== text) return restored;
    }

    // Fallback: search related sessions for matching pseudonyms
    // This handles cases where content script reloaded (SPA navigation on Gemini)
    // Only applies if:
    // 1. Session ID follows the expected format: siteId_timestamp
    // 2. Related sessions are from same site AND within 1 hour window
    const sessionParts = sessionId.split('_');
    if (sessionParts.length !== 2) {
      return text; // Not standard format, skip cross-session
    }

    const [sitePrefix, timestampStr] = sessionParts;
    const sessionTimestamp = parseInt(timestampStr, 10);
    if (isNaN(sessionTimestamp)) {
      return text; // Invalid timestamp, skip cross-session
    }

    const ONE_HOUR_MS = 60 * 60 * 1000;
    let restored = text;
    let foundAny = false;

    for (const [sid, mappings] of this.sessionMappings.entries()) {
      if (sid === sessionId) continue;

      const otherParts = sid.split('_');
      if (otherParts.length !== 2) continue;

      const [otherPrefix, otherTimestampStr] = otherParts;
      if (otherPrefix !== sitePrefix) continue;

      const otherTimestamp = parseInt(otherTimestampStr, 10);
      if (isNaN(otherTimestamp)) continue;

      // Only cross-restore within 1 hour window
      if (Math.abs(sessionTimestamp - otherTimestamp) > ONE_HOUR_MS) continue;

      for (const mapping of mappings) {
        if (restored.includes(mapping.pseudonym)) {
          restored = restored.split(mapping.pseudonym).join(mapping.original);
          foundAny = true;
        }
      }
    }

    if (foundAny) {
      console.debug('[Aegis] Cross-session PII restoration applied (SPA fallback)');
    }

    return restored;
  }

  /**
   * Clear all mappings for a session.
   */
  clearSession(sessionId: string): void {
    this.sessionMappings.delete(sessionId);
    this.notifyPersist();
  }

  /**
   * Get total number of protected PII items across all sessions.
   */
  getTotalProtected(): number {
    let total = 0;
    for (const mappings of this.sessionMappings.values()) {
      total += mappings.length;
    }
    return total;
  }
}
