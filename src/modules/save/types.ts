import type { LedgerData } from '../../lib/store/ledgerData';
import type { DownloadedFile, RemoteState } from '../../lib/store/remote';

export type { DownloadedFile };

/**
 * Pushes changes back to wherever the ledger came from. The store loads once, edits a working copy
 * in the browser (kept in IndexedDB), and hands the saver the last saved state plus the new one
 * whenever it saves, so a saver writes only what changed.
 */
export interface Saver {
  readonly id: string;
  /** Writes the difference between `base.data` and `next`. Returns the new saved state. */
  save(base: RemoteState, next: LedgerData): Promise<RemoteState>;
  /**
   * Only for a ledger kept in a file on the user's device. Builds the updated file, which is how
   * changes leave the browser, so there is no autosave and the Save button becomes Download.
   */
  download?(data: LedgerData): Promise<DownloadedFile>;
}
