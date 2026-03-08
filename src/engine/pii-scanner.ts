import type { PiiMatch, PiiType, AeginelConfig } from './types';

// ── PII Detection Patterns ──────────────────────────────────────────────

interface PiiPattern {
  type: PiiType;
  regex: RegExp;
  validate?: (match: string) => boolean;
  mask: (match: string) => string;
}

// Luhn checksum for credit cards
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Korean RRN validation (basic structure check)
function validateKoreanRRN(match: string): boolean {
  const clean = match.replace(/[-\s]/g, '');
  if (clean.length !== 13) return false;
  const gender = parseInt(clean[6], 10);
  return gender >= 1 && gender <= 4;
}

const PII_PATTERNS: PiiPattern[] = [
  {
    // 주민등록번호 (대시 포함): YYMMDD-GNNNNNN
    type: 'korean_rrn',
    regex: /\b(\d{6})\s*[-–]\s*([1-4]\d{6})\b/g,
    validate: (m) => validateKoreanRRN(m),
    mask: (m) => {
      const clean = m.replace(/[-–\s]/g, '');
      return `${clean.slice(0, 6)}-${clean[6]}***${clean.slice(10)}`;
    },
  },
  {
    // 주민등록번호 (대시 없음, 연속 13자리): YYMMDDGNNNNNN
    type: 'korean_rrn',
    regex: /(?<!\d)(\d{6})([1-4]\d{6})(?!\d)/g,
    validate: (m) => {
      const clean = m.replace(/\D/g, '');
      if (clean.length !== 13) return false;
      const mm = parseInt(clean.slice(2, 4), 10);
      const dd = parseInt(clean.slice(4, 6), 10);
      return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && parseInt(clean[6], 10) >= 1 && parseInt(clean[6], 10) <= 4;
    },
    mask: (m) => {
      const clean = m.replace(/\D/g, '');
      return `${clean.slice(0, 6)}-${clean[6]}***${clean.slice(10)}`;
    },
  },
  {
    // 신용카드번호 (구분자 포함): 4/5/6/3으로 시작, 13-19자리
    type: 'credit_card',
    regex: /\b([3-6]\d{3})\s*[-–]?\s*(\d{4})\s*[-–]?\s*(\d{4})\s*[-–]?\s*(\d{1,7})\b/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19 && luhnCheck(digits);
    },
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return `${digits.slice(0, 4)}-****-****-${digits.slice(-4)}`;
    },
  },
  {
    // 신용카드번호 (연속, 구분자 없음): 13-19자리 연속 숫자
    type: 'credit_card',
    regex: /(?<!\d)([3-6]\d{12,18})(?!\d)/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19 && luhnCheck(digits);
    },
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return `${digits.slice(0, 4)}-****-****-${digits.slice(-4)}`;
    },
  },
  {
    // 이메일
    type: 'email',
    regex: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    mask: (m) => {
      const [local, domain] = m.split('@');
      return `${local[0]}***@${domain}`;
    },
  },
  {
    // 한국 전화번호 (구분자 포함): 010-XXXX-XXXX, 02-XXX-XXXX 등
    type: 'phone_kr',
    regex: /\b(01[016789])\s*[-–.]?\s*(\d{3,4})\s*[-–.]?\s*(\d{4})\b/g,
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
    },
  },
  {
    // 한국 전화번호 (연속, 구분자 없음): 01012345678
    type: 'phone_kr',
    regex: /(?<!\d)(01[016789]\d{7,8})(?!\d)/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length === 10 || digits.length === 11;
    },
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
    },
  },
  {
    // 국제 전화번호: +XX-XXXXXXXX
    type: 'phone_intl',
    regex: /\+\d{1,3}\s*[-–.]?\s*\d{2,4}\s*[-–.]?\s*\d{3,4}\s*[-–.]?\s*\d{3,4}\b/g,
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return `+${digits.slice(0, 2)}-****-${digits.slice(-4)}`;
    },
  },
  {
    // US SSN (대시 포함): XXX-XX-XXXX
    type: 'ssn',
    regex: /\b(\d{3})\s*[-–]\s*(\d{2})\s*[-–]\s*(\d{4})\b/g,
    validate: (m) => {
      const parts = m.replace(/\s/g, '').split(/[-–]/);
      if (parts.length !== 3) return false;
      const [a, b, c] = parts;
      return a !== '000' && b !== '00' && c !== '0000' && a !== '666';
    },
    mask: (m) => {
      const digits = m.replace(/\D/g, '');
      return `***-**-${digits.slice(-4)}`;
    },
  },
  {
    // 여권번호: M12345678 패턴
    type: 'passport',
    regex: /\b([A-Z]{1,2}\d{7,8})\b/g,
    mask: (m) => `${m.slice(0, 2)}*****${m.slice(-2)}`,
  },
];

export function scanPii(input: string, config: AeginelConfig): PiiMatch[] {
  if (!config.pii.enabled) return [];

  const matches: PiiMatch[] = [];

  for (const pattern of PII_PATTERNS) {
    if (!config.pii.types[pattern.type]) continue;

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const value = match[0];
      if (pattern.validate && !pattern.validate(value)) continue;

      // Dedup: skip if this region overlaps with an existing match
      const start = match.index;
      const end = match.index + value.length;
      const overlaps = matches.some(
        (m) => start < m.endIndex && end > m.startIndex,
      );
      if (overlaps) continue;

      matches.push({
        type: pattern.type,
        value: pattern.mask(value),
        startIndex: start,
        endIndex: end,
      });
    }
  }

  return matches;
}
