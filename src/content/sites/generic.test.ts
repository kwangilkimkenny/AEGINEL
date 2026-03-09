import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SiteConfig } from './registry';
import {
  FALLBACK_INPUT_SELECTORS,
  FALLBACK_SUBMIT_SELECTORS,
  FALLBACK_RESPONSE_SELECTORS,
} from './registry';

// ── Minimal DOM mock ────────────────────────────────────────────────────

let domElements: Record<string, boolean> = {};

const mockQuerySelector = vi.fn((selector: string) => {
  return domElements[selector] ? { tagName: 'DIV' } : null;
});

vi.stubGlobal('document', {
  querySelector: mockQuerySelector,
  querySelectorAll: vi.fn(() => []),
  body: { tagName: 'BODY' },
});

vi.stubGlobal('window', {
  location: { hostname: 'test.com', pathname: '/' },
});

// Import after mocking
import { createGenericAdapter } from './generic';

// ── Test Config ─────────────────────────────────────────────────────────

const testConfig: SiteConfig = {
  id: 'test-site',
  name: 'Test Site',
  hostnames: ['test.com'],
  inputSelectors: ['#specific-input', '.custom-textarea'],
  submitSelectors: ['#specific-submit', '.custom-send-btn'],
  responseSelectors: ['.custom-response'],
  warningAnchorSelectors: ['form', 'main'],
  streamingSelectors: ['.streaming-indicator'],
};

describe('createGenericAdapter (fallback selectors)', () => {
  beforeEach(() => {
    domElements = {};
    mockQuerySelector.mockClear();
  });

  describe('getInputSelector', () => {
    it('should return primary selector when it matches DOM', () => {
      domElements['#specific-input'] = true;
      const adapter = createGenericAdapter(testConfig);
      expect(adapter.getInputSelector()).toBe('#specific-input');
    });

    it('should return second primary selector when first fails', () => {
      domElements['.custom-textarea'] = true;
      const adapter = createGenericAdapter(testConfig);
      expect(adapter.getInputSelector()).toBe('.custom-textarea');
    });

    it('should fall back to universal selector when all primary fail', () => {
      // Only a fallback selector matches
      domElements['textarea'] = true;
      const adapter = createGenericAdapter(testConfig);
      const result = adapter.getInputSelector();
      expect(FALLBACK_INPUT_SELECTORS).toContain(result);
    });

    it('should return joined primary selectors when nothing matches', () => {
      // Nothing matches at all
      const adapter = createGenericAdapter(testConfig);
      const result = adapter.getInputSelector();
      expect(result).toBe('#specific-input, .custom-textarea');
    });
  });

  describe('getSubmitSelector', () => {
    it('should return primary submit selector when it matches', () => {
      domElements['#specific-submit'] = true;
      const adapter = createGenericAdapter(testConfig);
      expect(adapter.getSubmitSelector()).toBe('#specific-submit');
    });

    it('should fall back to universal submit selector', () => {
      domElements['button[type="submit"]'] = true;
      const adapter = createGenericAdapter(testConfig);
      const result = adapter.getSubmitSelector();
      expect(FALLBACK_SUBMIT_SELECTORS).toContain(result);
    });
  });

  describe('getResponseSelector', () => {
    it('should return primary response selector when it matches', () => {
      domElements['.custom-response'] = true;
      const adapter = createGenericAdapter(testConfig);
      expect(adapter.getResponseSelector()).toBe('.custom-response');
    });

    it('should fall back to universal response selectors', () => {
      domElements['[class*="markdown"]'] = true;
      const adapter = createGenericAdapter(testConfig);
      const result = adapter.getResponseSelector();
      expect(FALLBACK_RESPONSE_SELECTORS).toContain(result);
    });
  });

  describe('matches', () => {
    it('should match configured hostname', () => {
      const adapter = createGenericAdapter(testConfig);
      expect(adapter.matches('test.com')).toBe(true);
    });

    it('should not match unconfigured hostname', () => {
      const adapter = createGenericAdapter(testConfig);
      expect(adapter.matches('other.com')).toBe(false);
    });

    it('should check pathPrefix when configured', () => {
      const configWithPath: SiteConfig = {
        ...testConfig,
        hostnames: ['huggingface.co'],
        pathPrefix: '/chat',
      };

      // Mock pathname
      vi.stubGlobal('window', {
        location: { hostname: 'huggingface.co', pathname: '/chat/123' },
      });

      const adapter = createGenericAdapter(configWithPath);
      expect(adapter.matches('huggingface.co')).toBe(true);

      vi.stubGlobal('window', {
        location: { hostname: 'huggingface.co', pathname: '/models' },
      });

      const adapter2 = createGenericAdapter(configWithPath);
      expect(adapter2.matches('huggingface.co')).toBe(false);
    });
  });

  describe('getWarningAnchor', () => {
    it('should return first matching anchor selector', () => {
      domElements['form'] = true;
      const adapter = createGenericAdapter(testConfig);
      const anchor = adapter.getWarningAnchor();
      expect(anchor).toBeTruthy();
    });

    it('should fall back to document.body when nothing matches', () => {
      // Nothing matches including 'main'
      const adapter = createGenericAdapter(testConfig);
      const anchor = adapter.getWarningAnchor();
      // Falls back to document.body since document.querySelector('main') returns null
      expect(anchor).toEqual({ tagName: 'BODY' });
    });
  });
});

describe('fallback selector constants', () => {
  it('should have ARIA/role-based input selectors', () => {
    expect(FALLBACK_INPUT_SELECTORS).toContain('[role="textbox"][contenteditable="true"]');
    expect(FALLBACK_INPUT_SELECTORS).toContain('textarea');
  });

  it('should have ARIA-based submit selectors', () => {
    expect(FALLBACK_SUBMIT_SELECTORS).toContain('button[type="submit"]');
    const hasAriaLabel = FALLBACK_SUBMIT_SELECTORS.some(s => s.includes('aria-label'));
    expect(hasAriaLabel).toBe(true);
  });

  it('should have class-based response selectors', () => {
    expect(FALLBACK_RESPONSE_SELECTORS.length).toBeGreaterThan(0);
    const hasMarkdown = FALLBACK_RESPONSE_SELECTORS.some(s => s.includes('markdown'));
    expect(hasMarkdown).toBe(true);
  });
});
