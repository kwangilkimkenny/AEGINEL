import { useCallback } from 'react';
import type { ExtensionMessage } from '../../shared/messages';

export function useSendMessage() {
  return useCallback(async <T = unknown>(message: ExtensionMessage): Promise<T> => {
    return chrome.runtime.sendMessage(message);
  }, []);
}
