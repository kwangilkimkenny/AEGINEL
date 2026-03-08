// ── AEGINEL PII Proxy Engine (가명화) ──────────────────────────────────────
// Pseudonymizes PII before sending to LLM, restores originals in responses.

import { scanPii } from './pii-scanner';
import type { AeginelConfig, PiiMapping, PiiType, ProxyResult } from './types';

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
        result = result.slice(0, pos) + ch + result.slice(pos);
        offset++;
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

    default:
      return `[REDACTED_${type}]`;
  }
}

// ── PiiProxyEngine ──────────────────────────────────────────────────────

const MAX_SESSIONS = 50;
const MAX_MAPPINGS_PER_SESSION = 500;

export class PiiProxyEngine {
  /** sessionId → PiiMapping[] */
  private sessionMappings = new Map<string, PiiMapping[]>();

  /**
   * Detect PII in text and replace with format-preserving pseudonyms.
   */
  pseudonymize(text: string, config: AeginelConfig, sessionId: string): ProxyResult {
    const piiMatches = scanPii(text, config);

    if (piiMatches.length === 0) {
      return { originalText: text, proxiedText: text, mappings: [], piiCount: 0 };
    }

    // Sort by position descending so we can replace from the end
    const sorted = [...piiMatches].sort((a, b) => b.startIndex - a.startIndex);

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

    return {
      originalText: text,
      proxiedText: proxied,
      mappings: mappings.reverse(), // return in original order
      piiCount: mappings.length,
    };
  }

  /**
   * Restore pseudonyms back to originals in a response text.
   */
  restore(text: string, sessionId: string): string {
    const mappings = this.sessionMappings.get(sessionId);
    if (!mappings || mappings.length === 0) return text;

    let restored = text;
    // Replace all pseudonyms with originals
    for (const mapping of mappings) {
      // Use split+join for global replacement (no regex special char issues)
      restored = restored.split(mapping.pseudonym).join(mapping.original);
    }
    return restored;
  }

  /**
   * Clear all mappings for a session.
   */
  clearSession(sessionId: string): void {
    this.sessionMappings.delete(sessionId);
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
