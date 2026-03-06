import { useState, useEffect, useCallback } from 'react';

export function useStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    chrome.storage.local.get(key).then((result) => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
    });
  }, [key]);

  const setStoredValue = useCallback((val: T) => {
    setValue(val);
    chrome.storage.local.set({ [key]: val });
  }, [key]);

  return [value, setStoredValue];
}
