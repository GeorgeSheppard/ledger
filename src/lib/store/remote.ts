import type { z } from 'zod';
import type { LedgerData, SkippedTab } from './ledgerData';
import type { remoteStateSchema, sheetLayoutSchema } from './schemas';

/**
 * Where the spreadsheet really lives. The store loads it once, edits a local working copy, and hands
 * the remote the last saved copy plus the new one whenever it saves, so the remote can write only
 * what changed.
 */
export interface LedgerRemote {
  /** Reads the whole spreadsheet. `onProgress` is told how far along it is, for the loading screen. */
  load(onProgress?: (progress: LoadProgress) => void): Promise<RemoteState>;
  /** Writes the difference between `base.data` and `next`. Returns the new saved state. */
  save(base: RemoteState, next: LedgerData): Promise<RemoteState>;
  /**
   * Only for a ledger kept in a file on the user's device. Builds the updated file, which is how
   * changes leave the browser, so there is no autosave and the Save button becomes Download.
   */
  download?(data: LedgerData): Promise<DownloadedFile>;
}

/** Where a load has got to: finding the tabs, then reading the ones named here. */
export type LoadProgress = { step: 'tabs' } | { step: 'values'; tabs: string[] };

export interface DownloadedFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export type RemoteState = z.infer<typeof remoteStateSchema>;
export type SheetLayout = z.infer<typeof sheetLayoutSchema>;

export const EMPTY_LAYOUT: SheetLayout = { rowCounts: {}, sheetIds: [] };

/** A sheet id for a new tab. The API accepts any positive int32 that is not already in use. */
export function newSheetId(taken: Iterable<number>, random: () => number = Math.random): number {
  const used = new Set(taken);
  for (;;) {
    const id = Math.floor(random() * 2_000_000_000) + 1;
    if (!used.has(id)) return id;
  }
}

/** A remote held in memory. Used for the demo data and in tests. */
export class MemoryRemote implements LedgerRemote {
  data: LedgerData;
  skippedTabs: SkippedTab[];
  loads = 0;
  saves = 0;

  constructor(data: LedgerData, skippedTabs: SkippedTab[] = []) {
    this.data = structuredClone(data);
    this.skippedTabs = skippedTabs;
  }

  async load(): Promise<RemoteState> {
    this.loads++;
    return {
      data: structuredClone(this.data),
      skippedTabs: this.skippedTabs,
      tabReports: [],
      layout: EMPTY_LAYOUT,
    };
  }

  async save(base: RemoteState, next: LedgerData): Promise<RemoteState> {
    this.saves++;
    this.data = structuredClone(next);
    return { ...base, data: structuredClone(next) };
  }
}
