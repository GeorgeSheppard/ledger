import { useCallback, useRef, useState } from 'react';

/**
 * Runs one async action at a time and tracks which one is in flight and the last error, for
 * buttons that call Google (sign in, open the picker, create a sheet).
 */
export function useAsyncAction<K extends string>() {
  const [busy, setBusy] = useState<K | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async (key: K, action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, []);

  return { busy, error, run };
}
