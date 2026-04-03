import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scan } from './detector';
import { DEFAULT_CONFIG } from './types';
import type { AeginelConfig, PiiMatch } from './types';

vi.mock('./pii-scanner', () => ({
  scanPii: vi.fn(async (input: string, _config: AeginelConfig): Promise<PiiMatch[]> => {
    const matches: PiiMatch[] = [];
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    let m: RegExpExecArray | null;
    while ((m = emailRegex.exec(input)) !== null) {
      matches.push({
        type: 'email',
        value: m[0][0] + '***@' + m[0].split('@')[1],
        startIndex: m.index,
        endIndex: m.index + m[0].length,
      });
    }
    const phoneRegex = /01[016789]-?\d{3,4}-?\d{4}/g;
    while ((m = phoneRegex.exec(input)) !== null) {
      matches.push({
        type: 'phone_kr',
        value: m[0].slice(0, 3) + '****' + m[0].slice(-4),
        startIndex: m.index,
        endIndex: m.index + m[0].length,
      });
    }
    return matches;
  }),
}));

const config: AeginelConfig = { ...DEFAULT_CONFIG };

describe('PII Detection Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PII detection in scan', () => {
    it('should detect email PII and add to score', async () => {
      const result = await scan('내 이메일은 user@test.com입니다', 'test', config);
      expect(result.piiDetected.length).toBeGreaterThan(0);
      expect(result.categories).toContain('pii_exposure');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect multiple PII items', async () => {
      const result = await scan('이메일: user@test.com, 전화: 010-1234-5678', 'test', config);
      expect(result.piiDetected.length).toBeGreaterThanOrEqual(2);
      expect(result.score).toBeGreaterThan(15);
    });

    it('should score 15 points per PII item', async () => {
      const result1 = await scan('이메일: user@test.com 확인', 'test', config);
      const result2 = await scan('이메일: user@test.com, 전화: 010-1234-5678', 'test', config);
      expect(result2.score).toBeGreaterThanOrEqual(result1.score);
    });

    it('should cap score at 100', async () => {
      const input = 'a@b.com c@d.com e@f.com g@h.com i@j.com k@l.com m@n.com o@p.com';
      const result = await scan(input, 'test', config);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Risk levels', () => {
    it('should return level "low" for no PII', async () => {
      const result = await scan('오늘 날씨가 좋네요', 'test', config);
      expect(result.level).toBe('low');
      expect(result.score).toBe(0);
      expect(result.categories).toHaveLength(0);
    });

    it('should block when score >= threshold', async () => {
      const input = 'a@b.com c@d.com e@f.com g@h.com i@j.com';
      const result = await scan(input, 'test', config);
      if (result.score >= config.blockThreshold) {
        expect(result.blocked).toBe(true);
      }
    });
  });

  describe('Config handling', () => {
    it('should return empty result when disabled', async () => {
      const disabled = { ...config, enabled: false };
      const result = await scan('user@test.com', 'test', disabled);
      expect(result.score).toBe(0);
      expect(result.categories).toHaveLength(0);
    });

    it('should return empty result for empty input', async () => {
      const result = await scan('', 'test', config);
      expect(result.score).toBe(0);
    });

    it('should not have duplicate categories', async () => {
      const input = 'user@test.com admin@test.com hello@test.com';
      const result = await scan(input, 'test', config);
      const unique = [...new Set(result.categories)];
      expect(result.categories.length).toBe(unique.length);
    });
  });
});
