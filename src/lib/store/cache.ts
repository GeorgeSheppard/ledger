import type { LedgerData } from './ledgerData';
import type { RemoteState } from './remote';

/**
 * The working copy as kept in the browser, per spreadsheet. If the page closes before a save, the
 * next visit finds the unsaved edits here and replays them on top of a fresh read of the sheet.
 */
export interface CachedLedger {
  /** The last state read from or written to the sheet. */
  saved: RemoteState;
  /** The working copy, including edits not yet saved. */
  current: LedgerData;
}

export interface LedgerCache {
  get(spreadsheetId: string): Promise<CachedLedger | null>;
  put(spreadsheetId: string, value: CachedLedger): Promise<void>;
}

/** Keeps nothing. For the demo data, which starts fresh on every load. */
export const noCache: LedgerCache = {
  get: async () => null,
  put: async () => {},
};

export class MemoryCache implements LedgerCache {
  readonly entries = new Map<string, CachedLedger>();

  async get(spreadsheetId: string): Promise<CachedLedger | null> {
    const entry = this.entries.get(spreadsheetId);
    return entry ? structuredClone(entry) : null;
  }

  async put(spreadsheetId: string, value: CachedLedger): Promise<void> {
    this.entries.set(spreadsheetId, structuredClone(value));
  }
}

const DB_NAME = 'ledger';
const STORE_NAME = 'workingCopies';

/** `LedgerCache` in IndexedDB. Falls back to `noCache` where IndexedDB is unavailable. */
export function indexedDbCache(
  factory: IDBFactory | undefined = globalThis.indexedDB
): LedgerCache {
  if (!factory) return noCache;
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
    }));
  const run = async <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) => {
    const tx = (await open()).transaction(STORE_NAME, mode);
    return new Promise<T>((resolve, reject) => {
      const request = op(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB request failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB request aborted'));
    });
  };
  return {
    get: async (id) =>
      ((await run('readonly', (s) => s.get(id))) as CachedLedger | undefined) ?? null,
    put: async (id, value) => {
      await run('readwrite', (s) => s.put(value, id));
    },
  };
}
