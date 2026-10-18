import { spreadsheetRefSchema } from '../../../lib/domain/schemas';
import type { SpreadsheetRef } from '../../../lib/domain/types';

/**
 * Remembers which spreadsheet the user connected, so returning to the app (or signing in again)
 * reopens it without going through the picker. Only the id and title are stored, never any data.
 */

const KEY = 'ledger.spreadsheet';

/** The subset of `Storage` used here, so tests can pass a plain object. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadRememberedSpreadsheet(store: KeyValueStore): SpreadsheetRef | null {
  try {
    const parsed = spreadsheetRefSchema.safeParse(JSON.parse(store.getItem(KEY) ?? 'null'));
    if (parsed.success) return parsed.data;
  } catch {
    // Corrupt value: treat as nothing remembered.
  }
  return null;
}

export function rememberSpreadsheet(store: KeyValueStore, spreadsheet: SpreadsheetRef): void {
  store.setItem(KEY, JSON.stringify({ id: spreadsheet.id, title: spreadsheet.title }));
}

export function forgetSpreadsheet(store: KeyValueStore): void {
  store.removeItem(KEY);
}

/** An in-memory `KeyValueStore`, for tests and for browsers that block storage. */
export function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

/**
 * `localStorage` or `sessionStorage` when the browser allows it, otherwise an in-memory stand-in
 * (some privacy modes throw on access), so the app still works for the current visit.
 */
export function browserStore(kind: 'local' | 'session'): KeyValueStore {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__ledger_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryStore();
  }
}
