import type { IngestOption } from './types';

/**
 * Remembers which way of getting a ledger in the user last chose, so the homepage can mark it
 * "Last used". Only the option's id is stored, never any data, and it survives Exit on purpose.
 */

const KEY = 'ledger.lastIngest';

/** The subset of `Storage` used here, so tests can pass a plain object. */
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** The id of the last-used option, or `null` if none is remembered or it no longer exists. */
export function loadLastUsedIngest(store: Store, options: readonly IngestOption[]): string | null {
  try {
    const id = store.getItem(KEY);
    return options.some((option) => option.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function rememberLastUsedIngest(store: Store, id: string): void {
  try {
    store.setItem(KEY, id);
  } catch {
    // Storage is unavailable: the badge is a convenience, so carry on without it.
  }
}
