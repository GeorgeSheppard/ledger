import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { LedgerRepository } from '../lib/data/repository';
import { indexedDbCache, noCache, type LedgerCache } from '../lib/store/cache';
import type { LedgerSnapshot } from '../lib/store/ledgerData';
import { LedgerStore, type SyncStatus } from '../lib/store/ledgerStore';
import { MemoryRemote, type DownloadedFile, type LedgerRemote } from '../lib/store/remote';
import { useSession } from './session';

/**
 * The connected spreadsheet, for every feature.
 *
 * - `useLedger()` is the whole spreadsheet, read synchronously. It re-renders on every edit.
 * - `useRepository()` is the store, for edits (`LedgerRepository` plus the dashboard config).
 * - `useSyncStatus()` says whether edits are saved to the sheet, and offers `save()`.
 *
 * The spreadsheet is read once when it is connected. Edits stay in this browser (IndexedDB) until
 * they are saved: automatically every minute, when the tab is hidden, or via `save()`.
 */

const LedgerStoreContext = createContext<LedgerStore | null>(null);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; store: LedgerStore }
  | { status: 'error'; error: Error };

/** One spreadsheet being opened (or open), shared by every mount of the provider. */
interface OpenedStore {
  spreadsheetId: string;
  state: LoadState;
  listeners: Set<() => void>;
  /** Stops autosave; `save` sends any unsaved edits first. Set while this is the active store. */
  close?: (save: boolean) => void;
}

/**
 * Stores by remote, so remounting the provider (e.g. navigating between pages that each render it)
 * reuses the loaded store instead of reading the sheet again. Only the active one autosaves.
 */
const opened = new WeakMap<LedgerRemote, OpenedStore>();
let active: OpenedStore | null = null;

let browserCache: LedgerCache | null = null;
function cacheFor(remote: LedgerRemote): LedgerCache {
  // The demo data starts fresh on every visit, and a file's contents never go into browser storage.
  if (remote instanceof MemoryRemote || remote.download) return noCache;
  return (browserCache ??= indexedDbCache());
}

/** The entry for `remote`, starting the load the first time it is asked for. */
function entryFor(remote: LedgerRemote, spreadsheetId: string): OpenedStore {
  const existing = opened.get(remote);
  if (existing) return existing;
  const entry: OpenedStore = { spreadsheetId, state: { status: 'loading' }, listeners: new Set() };
  const settle = (state: LoadState) => {
    entry.state = state;
    if (state.status === 'error') opened.delete(remote);
    if (state.status === 'ready' && active === entry) entry.close = keepSaving(state.store);
    for (const listener of entry.listeners) listener();
  };
  LedgerStore.open({ spreadsheetId, remote, cache: cacheFor(remote) }).then(
    (store) => settle({ status: 'ready', store }),
    (error: unknown) =>
      settle({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
  );
  opened.set(remote, entry);
  return entry;
}

/** Makes `entry` the store that autosaves, stopping the previous one. */
function activate(entry: OpenedStore) {
  if (active === entry) return;
  // Leaving a spreadsheet saves it. Reopening the same one (after signing in again) does not: the
  // new store picks up the unsaved edits from the browser cache, so only one store writes the sheet.
  active?.close?.(active.spreadsheetId !== entry.spreadsheetId);
  if (active) active.close = undefined;
  active = entry;
  if (entry.state.status === 'ready') entry.close = keepSaving(entry.state.store);
}

/**
 * Autosaves every minute and when the page is hidden. Returns a function that stops it.
 * A ledger kept in a file never saves itself; the browser warns before the tab closes instead,
 * because the changes exist nowhere else until they are downloaded.
 */
function keepSaving(store: LedgerStore): (save: boolean) => void {
  if (store.isFile) {
    const warn = (event: BeforeUnloadEvent) => {
      if (store.hasUnsavedChanges) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }
  const stopAutosave = store.startAutosave();
  const onHide = () => {
    if (document.visibilityState === 'hidden' && store.hasUnsavedChanges)
      store.save().catch(() => {});
  };
  document.addEventListener('visibilitychange', onHide);
  return (save) => {
    stopAutosave();
    document.removeEventListener('visibilitychange', onHide);
    if (save && store.hasUnsavedChanges) store.save().catch(() => {});
  };
}

/** Loads the connected spreadsheet once, then provides it. Render only when connected. */
export function LedgerDataProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (session.status !== 'connected')
    throw new Error('LedgerDataProvider rendered without a connected spreadsheet');
  const { remote, spreadsheet } = session;
  // Bumped by "Try again"; a failed entry is dropped, so the next render starts a new load.
  const [, setAttempt] = useState(0);
  const entry = entryFor(remote, spreadsheet.id);
  const subscribe = useCallback(
    (listener: () => void) => {
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    [entry]
  );
  const state = useSyncExternalStore(subscribe, () => entry.state);
  useEffect(() => activate(entry), [entry]);

  if (state.status === 'loading') return <LoadingScreen title={spreadsheet.title} />;
  if (state.status === 'error')
    return (
      <LoadingScreen
        title={spreadsheet.title}
        error={state.error}
        retry={() => setAttempt((n) => n + 1)}
      />
    );
  return <LedgerStoreContext.Provider value={state.store}>{children}</LedgerStoreContext.Provider>;
}

function LoadingScreen({
  title,
  error,
  retry,
}: {
  title: string;
  error?: Error;
  retry?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas p-6 text-sm text-fg">
      {error ? (
        <>
          <p className="font-semibold">Could not open {title}</p>
          <p className="max-w-md text-center text-muted">{error.message}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </>
      ) : (
        <p className="text-muted">Opening {title}…</p>
      )}
    </div>
  );
}

export function useLedgerStore(): LedgerStore {
  const store = useContext(LedgerStoreContext);
  if (!store) throw new Error('Ledger data hooks must be used inside <LedgerDataProvider>');
  return store;
}

/** The whole spreadsheet: accounts, transactions (oldest first), categories, dashboard config. */
export function useLedger(): LedgerSnapshot {
  const store = useLedgerStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/**
 * Whether edits have reached the sheet, and `save()` to send them now. For a ledger kept in a file
 * (`isFile`) there is no sheet: `download()` builds the updated file instead.
 */
export function useSyncStatus(): {
  status: SyncStatus;
  isFile: boolean;
  save(): Promise<void>;
  download(): Promise<DownloadedFile>;
} {
  const store = useLedgerStore();
  const status = useSyncExternalStore(store.subscribe, store.getStatus);
  const save = useCallback(() => store.save(), [store]);
  const download = useCallback(() => store.download(), [store]);
  return { status, isFile: store.isFile, save, download };
}

export function useRepository(): LedgerStore {
  return useLedgerStore();
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'ready'; data: T; error?: undefined };

/**
 * Older async API, kept so existing pages work. Prefer `useLedger()`, which never shows a loading
 * state. `load` must be stable (module-level, or `useCallback`). Re-runs after every edit.
 */
export function useLedgerQuery<T>(
  load: (repository: LedgerRepository) => Promise<T>
): QueryState<T> {
  const store = useLedgerStore();
  const snapshot = useLedger();
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load(store).then(
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
  }, [load, store, snapshot]);

  return state;
}

/** Returns `run(write)`. Kept for existing pages; calling the store directly does the same. */
export function useLedgerMutation() {
  const store = useLedgerStore();
  return useCallback(
    <T,>(write: (repository: LedgerRepository) => Promise<T>): Promise<T> => write(store),
    [store]
  );
}
