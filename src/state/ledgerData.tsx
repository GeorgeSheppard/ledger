import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LedgerRepository } from '../lib/data/repository';
import { useSession } from './session';

/**
 * Shared data-loading plumbing so every feature fetches and refreshes the same way.
 *
 * - `useRepository()` gives the connected `LedgerRepository`.
 * - `useLedgerQuery(load)` runs `load(repository)` and re-runs it whenever data changes.
 * - `useLedgerMutation()` wraps a write and then marks all queries stale, so e.g. the dashboard
 *   refreshes after a transaction is edited or a CSV is imported.
 */

interface LedgerDataApi {
  repository: LedgerRepository;
  version: number;
  invalidate(): void;
}

const LedgerDataContext = createContext<LedgerDataApi | null>(null);

/** Provides the repository to everything below. Render only when the session is connected. */
export function LedgerDataProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [version, setVersion] = useState(0);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const repository = session.status === 'connected' ? session.repository : null;
  const api = useMemo(
    () => (repository ? { repository, version, invalidate } : null),
    [repository, version, invalidate]
  );
  if (!api) throw new Error('LedgerDataProvider rendered without a connected spreadsheet');
  return <LedgerDataContext.Provider value={api}>{children}</LedgerDataContext.Provider>;
}

function useLedgerData(): LedgerDataApi {
  const api = useContext(LedgerDataContext);
  if (!api) throw new Error('Ledger data hooks must be used inside <LedgerDataProvider>');
  return api;
}

export function useRepository(): LedgerRepository {
  return useLedgerData().repository;
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'ready'; data: T; error?: undefined };

/**
 * Loads data from the repository. `load` must be stable (module-level, or `useCallback`) or it will
 * re-run every render. Keeps showing the previous data while a refresh is in flight.
 */
export function useLedgerQuery<T>(
  load: (repository: LedgerRepository) => Promise<T>
): QueryState<T> {
  const { repository, version } = useLedgerData();
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load(repository).then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      (error: unknown) =>
        !cancelled &&
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        })
    );
    return () => {
      cancelled = true;
    };
  }, [load, repository, version]);

  return state;
}

/** Returns `run(write)`: performs the write, then refreshes every `useLedgerQuery`. */
export function useLedgerMutation() {
  const { repository, invalidate } = useLedgerData();
  return useCallback(
    async <T,>(write: (repository: LedgerRepository) => Promise<T>): Promise<T> => {
      try {
        return await write(repository);
      } finally {
        invalidate();
      }
    },
    [repository, invalidate]
  );
}
