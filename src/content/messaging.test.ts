import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock chrome.runtime.sendMessage ──────────────────────────────────────

const mockSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
});

// Import after mocking
import { sendMessage } from './messaging';

describe('sendMessage (retry logic)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMessage.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return response on first success', async () => {
    mockSendMessage.mockResolvedValueOnce({ type: 'OK', data: 42 });

    const result = await sendMessage({ type: 'TEST' });
    expect(result).toEqual({ type: 'OK', data: 42 });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient failure and succeed', async () => {
    mockSendMessage
      .mockRejectedValueOnce(new Error('Could not establish connection'))
      .mockResolvedValueOnce({ ok: true });

    const promise = sendMessage({ type: 'TEST' });

    // Advance past first retry delay (200ms)
    await vi.advanceTimersByTimeAsync(250);

    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('should retry up to 3 times then return null', async () => {
    mockSendMessage.mockRejectedValue(new Error('Service worker unavailable'));

    const promise = sendMessage({ type: 'TEST' });

    // Advance past all retry delays (200ms + 400ms + 800ms)
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result).toBeNull();
    expect(mockSendMessage).toHaveBeenCalledTimes(3);
  });

  it('should NOT retry on "Extension context invalidated"', async () => {
    mockSendMessage.mockRejectedValueOnce(
      new Error('Extension context invalidated'),
    );

    const result = await sendMessage({ type: 'TEST' });
    expect(result).toBeNull();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff delays', async () => {
    mockSendMessage
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ok: true });

    const promise = sendMessage({ type: 'TEST' });

    // First retry at 200ms
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    // Second retry at 400ms after first retry
    await vi.advanceTimersByTimeAsync(400);
    expect(mockSendMessage).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toEqual({ ok: true });
  });
});
