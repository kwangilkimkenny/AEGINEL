import { describe, it, expect } from 'vitest';
import { scanPii } from './pii-scanner';
import { DEFAULT_CONFIG } from './types';
import type { AeginelConfig } from './types';

const config: AeginelConfig = { ...DEFAULT_CONFIG };

describe('PII Scanner', () => {
  // ── Korean RRN (주민등록번호) ─────────────────────────────────────

  describe('Korean RRN', () => {
    it('should detect RRN with dash', () => {
      const matches = scanPii('주민번호: 880101-1234567', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('korean_rrn');
    });

    it('should reject invalid gender code', () => {
      const matches = scanPii('880101-5234567', config);
      expect(matches.length).toBe(0);
    });

    it('should detect RRN without dash (continuous 13 digits)', () => {
      const matches = scanPii('주민번호 8801011234567 입니다', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('korean_rrn');
    });

    it('should reject invalid month in continuous RRN', () => {
      // month 13 is invalid
      const matches = scanPii('8813011234567', config);
      expect(matches.length).toBe(0);
    });

    it('should mask RRN correctly', () => {
      const matches = scanPii('880101-1234567', config);
      expect(matches[0].value).toMatch(/880101-1\*\*\*567/);
    });
  });

  // ── Credit Card ───────────────────────────────────────────────────

  describe('Credit Card', () => {
    it('should detect Visa card with dashes', () => {
      const matches = scanPii('카드: 4111-1111-1111-1111', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('credit_card');
    });

    it('should reject numbers that fail Luhn check', () => {
      const matches = scanPii('4111-1111-1111-1112', config);
      expect(matches.length).toBe(0);
    });

    it('should mask credit card correctly', () => {
      const matches = scanPii('4111-1111-1111-1111', config);
      expect(matches[0].value).toBe('4111-****-****-1111');
    });
  });

  // ── Email ─────────────────────────────────────────────────────────

  describe('Email', () => {
    it('should detect email address', () => {
      const matches = scanPii('이메일: user@example.com', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('email');
    });

    it('should detect email with subdomain', () => {
      const matches = scanPii('admin@mail.company.co.kr', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('email');
    });

    it('should mask email correctly', () => {
      const matches = scanPii('user@example.com', config);
      expect(matches[0].value).toBe('u***@example.com');
    });
  });

  // ── Korean Phone ──────────────────────────────────────────────────

  describe('Korean Phone', () => {
    it('should detect phone with dashes', () => {
      const matches = scanPii('전화: 010-1234-5678', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('phone_kr');
    });

    it('should detect continuous phone number', () => {
      const matches = scanPii('전화 01012345678 입니다', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('phone_kr');
    });

    it('should mask phone correctly', () => {
      const matches = scanPii('010-1234-5678', config);
      expect(matches[0].value).toBe('010-****-5678');
    });
  });

  // ── International Phone ───────────────────────────────────────────

  describe('International Phone', () => {
    it('should detect international phone number', () => {
      const matches = scanPii('+82-10-1234-5678', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('phone_intl');
    });
  });

  // ── US SSN ────────────────────────────────────────────────────────

  describe('US SSN', () => {
    it('should detect valid SSN', () => {
      const matches = scanPii('SSN: 123-45-6789', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('ssn');
    });

    it('should reject SSN starting with 000', () => {
      const matches = scanPii('000-45-6789', config);
      expect(matches.length).toBe(0);
    });

    it('should reject SSN starting with 666', () => {
      const matches = scanPii('666-45-6789', config);
      expect(matches.length).toBe(0);
    });

    it('should mask SSN correctly', () => {
      const matches = scanPii('123-45-6789', config);
      expect(matches[0].value).toBe('***-**-6789');
    });
  });

  // ── Passport ──────────────────────────────────────────────────────

  describe('Passport', () => {
    it('should detect passport number', () => {
      const matches = scanPii('여권: M12345678', config);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('passport');
    });

    it('should mask passport correctly', () => {
      const matches = scanPii('M12345678', config);
      expect(matches[0].value).toBe('M1*****78');
    });
  });

  // ── Multiple PII & Dedup ──────────────────────────────────────────

  describe('Multiple PII & Dedup', () => {
    it('should detect multiple PII types', () => {
      const matches = scanPii('이메일: a@b.com, 전화: 010-1111-2222', config);
      expect(matches.length).toBe(2);
      const types = matches.map(m => m.type);
      expect(types).toContain('email');
      expect(types).toContain('phone_kr');
    });

    it('should not have overlapping matches', () => {
      const matches = scanPii('880101-1234567', config);
      for (let i = 0; i < matches.length; i++) {
        for (let j = i + 1; j < matches.length; j++) {
          const overlaps = matches[i].startIndex < matches[j].endIndex &&
                          matches[i].endIndex > matches[j].startIndex;
          expect(overlaps).toBe(false);
        }
      }
    });
  });

  // ── Config: disabled types ────────────────────────────────────────

  describe('Config: disabled types', () => {
    it('should return empty when PII detection is disabled', () => {
      const disabled: AeginelConfig = {
        ...config,
        pii: { ...config.pii, enabled: false },
      };
      const matches = scanPii('user@test.com 010-1234-5678', disabled);
      expect(matches.length).toBe(0);
    });

    it('should skip disabled PII type', () => {
      const noEmail: AeginelConfig = {
        ...config,
        pii: { ...config.pii, types: { ...config.pii.types, email: false } },
      };
      const matches = scanPii('user@test.com', noEmail);
      expect(matches.length).toBe(0);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should return empty for empty string', () => {
      expect(scanPii('', config)).toHaveLength(0);
    });

    it('should return empty for safe text', () => {
      expect(scanPii('안녕하세요 좋은 아침입니다', config)).toHaveLength(0);
    });

    it('should not match short digit sequences', () => {
      expect(scanPii('12345', config)).toHaveLength(0);
    });
  });
});
