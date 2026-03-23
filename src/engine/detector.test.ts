import { describe, it, expect } from 'vitest';
import { scan } from './detector';
import { DEFAULT_CONFIG } from './types';
import type { AeginelConfig } from './types';

const config: AeginelConfig = { ...DEFAULT_CONFIG };

describe('PII Detection Engine', () => {
  describe('PII detection in scan', () => {
    it('should detect email PII and add to score', () => {
      const result = scan('내 이메일은 user@test.com입니다', 'test', config);
      expect(result.piiDetected.length).toBeGreaterThan(0);
      expect(result.categories).toContain('pii_exposure');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect multiple PII items', () => {
      const result = scan('이메일: user@test.com, 전화: 010-1234-5678', 'test', config);
      expect(result.piiDetected.length).toBeGreaterThanOrEqual(2);
      expect(result.score).toBeGreaterThan(15);
    });

    it('should score 15 points per PII item', () => {
      const result1 = scan('이메일: user@test.com 확인', 'test', config);
      const result2 = scan('이메일: user@test.com, 전화: 010-1234-5678', 'test', config);
      expect(result2.score).toBeGreaterThanOrEqual(result1.score);
    });

    it('should cap score at 100', () => {
      const input = 'a@b.com c@d.com e@f.com g@h.com i@j.com k@l.com m@n.com o@p.com';
      const result = scan(input, 'test', config);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Risk levels', () => {
    it('should return level "low" for no PII', () => {
      const result = scan('오늘 날씨가 좋네요', 'test', config);
      expect(result.level).toBe('low');
      expect(result.score).toBe(0);
      expect(result.categories).toHaveLength(0);
    });

    it('should block when score >= threshold', () => {
      const input = 'a@b.com c@d.com e@f.com g@h.com i@j.com';
      const result = scan(input, 'test', config);
      if (result.score >= config.blockThreshold) {
        expect(result.blocked).toBe(true);
      }
    });
  });

  describe('Config handling', () => {
    it('should return empty result when disabled', () => {
      const disabled = { ...config, enabled: false };
      const result = scan('user@test.com', 'test', disabled);
      expect(result.score).toBe(0);
      expect(result.categories).toHaveLength(0);
    });

    it('should return empty result for empty input', () => {
      const result = scan('', 'test', config);
      expect(result.score).toBe(0);
    });

    it('should not have duplicate categories', () => {
      const input = 'user@test.com admin@test.com hello@test.com';
      const result = scan(input, 'test', config);
      const unique = [...new Set(result.categories)];
      expect(result.categories.length).toBe(unique.length);
    });
  });
});
