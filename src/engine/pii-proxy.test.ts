import { describe, it, expect, beforeEach } from 'vitest';
import { PiiProxyEngine } from './pii-proxy';
import { DEFAULT_CONFIG } from './types';
import type { AeginelConfig } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────

const config: AeginelConfig = { ...DEFAULT_CONFIG };
const SESSION = 'test-session-1';

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

// ── Tests ────────────────────────────────────────────────────────────────

describe('PiiProxyEngine', () => {
  let engine: PiiProxyEngine;

  beforeEach(() => {
    engine = new PiiProxyEngine();
  });

  // ── Basic pseudonymize / restore ────────────────────────────────────

  describe('pseudonymize', () => {
    it('should return unchanged text when no PII is found', () => {
      const result = engine.pseudonymize('안녕하세요 오늘 날씨가 좋네요', config, SESSION);
      expect(result.piiCount).toBe(0);
      expect(result.proxiedText).toBe(result.originalText);
      expect(result.mappings).toHaveLength(0);
    });

    it('should detect and replace Korean RRN (주민등록번호)', () => {
      const input = '내 주민번호는 880101-1234567입니다';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(1);
      expect(result.proxiedText).not.toContain('880101-1234567');
      expect(result.mappings[0].type).toBe('korean_rrn');
      expect(result.mappings[0].original).toBe('880101-1234567');
      // Pseudonym should follow YYMMDD-GNNNNNN format
      expect(result.mappings[0].pseudonym).toMatch(/^\d{6}-[1-4]\d{6}$/);
    });

    it('should detect and replace email', () => {
      const input = '이메일은 user@test.com입니다';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(1);
      expect(result.proxiedText).not.toContain('user@test.com');
      expect(result.mappings[0].type).toBe('email');
      expect(result.mappings[0].pseudonym).toMatch(/^user_[0-9a-f]+@example\.com$/);
    });

    it('should detect and replace Korean phone number', () => {
      const input = '전화번호 010-1234-5678로 연락주세요';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(1);
      expect(result.proxiedText).not.toContain('010-1234-5678');
      expect(result.mappings[0].type).toBe('phone_kr');
      // Should preserve 010- prefix and dash format
      expect(result.mappings[0].pseudonym).toMatch(/^010-\d{4}-\d{4}$/);
    });

    it('should detect and replace US SSN', () => {
      const input = 'My SSN is 123-45-6789';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(1);
      expect(result.proxiedText).not.toContain('123-45-6789');
      expect(result.mappings[0].type).toBe('ssn');
      expect(result.mappings[0].pseudonym).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    });

    it('should detect and replace passport number', () => {
      const input = '여권번호: M12345678';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(1);
      expect(result.proxiedText).not.toContain('M12345678');
      expect(result.mappings[0].type).toBe('passport');
      // Same length, starts with a letter
      const pseudo = result.mappings[0].pseudonym;
      expect(pseudo).toHaveLength('M12345678'.length);
      expect(pseudo).toMatch(/^[A-Z]\d{8}$/);
    });
  });

  // ── Multiple PII in one text ──────────────────────────────────────

  describe('multiple PII', () => {
    it('should detect and replace multiple PII items', () => {
      const input = '내 주민번호는 880101-1234567이고 이메일은 user@test.com입니다';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(2);
      expect(result.proxiedText).not.toContain('880101-1234567');
      expect(result.proxiedText).not.toContain('user@test.com');

      const types = result.mappings.map(m => m.type).sort();
      expect(types).toContain('korean_rrn');
      expect(types).toContain('email');
    });

    it('should handle three PII items', () => {
      const input = '이메일: user@test.com, 전화: 010-9876-5432, SSN: 234-56-7890';
      const result = engine.pseudonymize(input, config, SESSION);

      expect(result.piiCount).toBe(3);
      expect(result.proxiedText).not.toContain('user@test.com');
      expect(result.proxiedText).not.toContain('010-9876-5432');
      expect(result.proxiedText).not.toContain('234-56-7890');
    });
  });

  // ── Restore ───────────────────────────────────────────────────────

  describe('restore', () => {
    it('should restore pseudonyms to originals', () => {
      const input = '내 이메일은 user@test.com입니다';
      const result = engine.pseudonymize(input, config, SESSION);

      // Simulate LLM response containing the pseudonym
      const llmResponse = `받은 이메일 주소: ${result.mappings[0].pseudonym}`;
      const restored = engine.restore(llmResponse, SESSION);

      expect(restored).toContain('user@test.com');
      expect(restored).not.toContain(result.mappings[0].pseudonym);
    });

    it('should restore multiple pseudonyms in a response', () => {
      const input = '이메일: user@test.com, 전화: 010-1234-5678';
      const result = engine.pseudonymize(input, config, SESSION);

      const emailPseudo = result.mappings.find(m => m.type === 'email')!.pseudonym;
      const phonePseudo = result.mappings.find(m => m.type === 'phone_kr')!.pseudonym;

      const llmResponse = `이메일은 ${emailPseudo}이고 전화번호는 ${phonePseudo}입니다.`;
      const restored = engine.restore(llmResponse, SESSION);

      expect(restored).toContain('user@test.com');
      expect(restored).toContain('010-1234-5678');
    });

    it('should return text unchanged when no mappings exist', () => {
      const text = 'Hello, no pseudonyms here';
      const restored = engine.restore(text, 'unknown-session');
      expect(restored).toBe(text);
    });

    it('should return text unchanged when pseudonyms are not present', () => {
      engine.pseudonymize('이메일: user@test.com', config, SESSION);
      const text = '이것은 관련 없는 텍스트입니다';
      const restored = engine.restore(text, SESSION);
      expect(restored).toBe(text);
    });
  });

  // ── Session isolation ─────────────────────────────────────────────

  describe('session isolation', () => {
    it('should not cross-restore between sessions', () => {
      const s1 = 'session-a';
      const s2 = 'session-b';

      const r1 = engine.pseudonymize('이메일: a@test.com', config, s1);
      const r2 = engine.pseudonymize('이메일: b@other.com', config, s2);

      const pseudo1 = r1.mappings[0].pseudonym;
      const pseudo2 = r2.mappings[0].pseudonym;

      // Session A should only restore its own pseudonyms
      const restored1 = engine.restore(`Answer: ${pseudo2}`, s1);
      expect(restored1).not.toContain('b@other.com');

      // Session B should only restore its own pseudonyms
      const restored2 = engine.restore(`Answer: ${pseudo1}`, s2);
      expect(restored2).not.toContain('a@test.com');
    });

    it('should clear session mappings', () => {
      const result = engine.pseudonymize('이메일: user@test.com', config, SESSION);
      expect(engine.getTotalProtected()).toBeGreaterThan(0);

      engine.clearSession(SESSION);

      const restored = engine.restore(`Answer: ${result.mappings[0].pseudonym}`, SESSION);
      expect(restored).toContain(result.mappings[0].pseudonym); // not restored
    });
  });

  // ── Consistency: same original → same pseudonym in same session ───

  describe('consistency', () => {
    it('should reuse pseudonym for repeated PII in same session', () => {
      const input1 = '이메일: user@test.com 확인하세요';
      const r1 = engine.pseudonymize(input1, config, SESSION);

      const input2 = '다시 이메일: user@test.com 보내주세요';
      const r2 = engine.pseudonymize(input2, config, SESSION);

      expect(r1.mappings[0].pseudonym).toBe(r2.mappings[0].pseudonym);
    });
  });

  // ── Format preservation ───────────────────────────────────────────

  describe('format preservation', () => {
    it('Korean RRN pseudonym should be valid format', () => {
      const result = engine.pseudonymize('주민번호: 880101-1234567', config, SESSION);
      const pseudo = result.mappings[0].pseudonym;
      // YYMMDD-GNNNNNN: 6 digits, dash, 1-4 followed by 6 digits
      expect(pseudo).toMatch(/^\d{6}-[1-4]\d{6}$/);
      // Month should be 01-12
      const mm = parseInt(pseudo.slice(2, 4), 10);
      expect(mm).toBeGreaterThanOrEqual(1);
      expect(mm).toBeLessThanOrEqual(12);
      // Day should be 01-28
      const dd = parseInt(pseudo.slice(4, 6), 10);
      expect(dd).toBeGreaterThanOrEqual(1);
      expect(dd).toBeLessThanOrEqual(28);
    });

    it('phone number with dashes should preserve dash format', () => {
      const result = engine.pseudonymize('전화: 010-1234-5678', config, SESSION);
      expect(result.mappings[0].pseudonym).toMatch(/^010-\d{4}-\d{4}$/);
    });

    it('SSN pseudonym should be XXX-XX-XXXX format', () => {
      const result = engine.pseudonymize('SSN: 123-45-6789', config, SESSION);
      expect(result.mappings[0].pseudonym).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    });

    it('email pseudonym should be valid email format', () => {
      const result = engine.pseudonymize('이메일: hello@world.org', config, SESSION);
      expect(result.mappings[0].pseudonym).toMatch(/^user_[0-9a-f]+@example\.com$/);
    });

    it('passport pseudonym should preserve length', () => {
      const result = engine.pseudonymize('여권: M12345678', config, SESSION);
      const pseudo = result.mappings[0].pseudonym;
      expect(pseudo).toHaveLength(9); // M + 8 digits
      expect(pseudo).toMatch(/^[A-Z]\d{8}$/);
    });
  });

  // ── Config respect ────────────────────────────────────────────────

  describe('config respect', () => {
    it('should not detect PII when pii.enabled is false', () => {
      const disabledConfig: AeginelConfig = {
        ...config,
        pii: { ...config.pii, enabled: false },
      };
      const result = engine.pseudonymize('이메일: user@test.com', disabledConfig, SESSION);
      expect(result.piiCount).toBe(0);
      expect(result.proxiedText).toContain('user@test.com');
    });

    it('should not detect email when email type is disabled', () => {
      const noEmailConfig: AeginelConfig = {
        ...config,
        pii: { ...config.pii, types: { ...config.pii.types, email: false } },
      };
      const result = engine.pseudonymize('이메일: user@test.com', noEmailConfig, SESSION);
      expect(result.piiCount).toBe(0);
    });
  });

  // ── getTotalProtected ─────────────────────────────────────────────

  describe('getTotalProtected', () => {
    it('should track total protected count across sessions', () => {
      expect(engine.getTotalProtected()).toBe(0);

      engine.pseudonymize('이메일: a@test.com', config, 'session-1');
      expect(engine.getTotalProtected()).toBe(1);

      engine.pseudonymize('전화: 010-1234-5678', config, 'session-2');
      expect(engine.getTotalProtected()).toBe(2);
    });

    it('should decrease when session is cleared', () => {
      engine.pseudonymize('이메일: a@test.com', config, 'session-1');
      engine.pseudonymize('전화: 010-1234-5678', config, 'session-2');
      expect(engine.getTotalProtected()).toBe(2);

      engine.clearSession('session-1');
      expect(engine.getTotalProtected()).toBe(1);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = engine.pseudonymize('', config, SESSION);
      expect(result.piiCount).toBe(0);
      expect(result.proxiedText).toBe('');
    });

    it('should handle text with only PII (no surrounding text)', () => {
      const result = engine.pseudonymize('user@test.com', config, SESSION);
      expect(result.piiCount).toBe(1);
      expect(result.proxiedText).not.toContain('user@test.com');
      expect(result.proxiedText).toMatch(/^user_[0-9a-f]+@example\.com$/);
    });

    it('should not alter non-PII parts of text', () => {
      const result = engine.pseudonymize('Hello user@test.com world', config, SESSION);
      // "Hello " and " world" should be preserved
      expect(result.proxiedText).toMatch(/^Hello .+ world$/);
    });

    it('should handle restore on empty text', () => {
      engine.pseudonymize('이메일: user@test.com', config, SESSION);
      expect(engine.restore('', SESSION)).toBe('');
    });
  });
});
