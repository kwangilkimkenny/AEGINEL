// ── Robust Chrome Extension Messaging ─────────────────────────────────────
// Wraps chrome.runtime.sendMessage with retry + exponential backoff to
// handle MV3 service-worker lifecycle issues (idle shutdown / restart).

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

/**
 * Send a message to the service worker with automatic retry.
 *
 * MV3 service workers can be terminated after ~30s of inactivity.
 * When the content script sends a message to a stopped worker, Chrome
 * restarts it — but the first attempt may fail with
 * "Could not establish connection. Receiving end does not exist."
 * Retrying after a short delay gives the worker time to initialise.
 */
export async function sendMessage<T = unknown>(message: unknown): Promise<T | null> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response as T;
    } catch (err) {
      lastError = err;
      const errMsg = String(err);

      // Extension context invalidated (e.g., extension updated/reloaded).
      // No point retrying — bail immediately.
      if (errMsg.includes('Extension context invalidated')) {
        return null;
      }

      // Service worker not ready yet — wait and retry
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.warn('[Aegis] Message send failed after retries:', lastError);
  return null;
}
