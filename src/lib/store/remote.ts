import type { LedgerData, SkippedTab } from './ledgerData';

/**
 * Where the spreadsheet really lives. The store loads it once, edits a local working copy, and hands
 * the remote the last saved copy plus the new one whenever it saves, so the remote can write only
 * what changed.
 */
export interface LedgerRemote {
  /** Reads the whole spreadsheet. */
  load(): Promise<RemoteState>;
  /** Writes the difference between `base.data` and `next`. Returns the new saved state. */
  save(base: RemoteState, next: LedgerData): Promise<RemoteState>;
}

export interface RemoteState {
  /** The data as it is in the sheet. */
  data: LedgerData;
  skippedTabs: SkippedTab[];
  /** Remote bookkeeping (grid sizes, tab ids). Plain JSON so it can be cached; only the remote reads it. */
  layout: SheetLayout;
}

export interface SheetLayout {
  /** Row count of every tab's grid, by sheet id. Writing past it needs the grid to grow first. */
  rowCounts: Record<number, number>;
  /** Every sheet id in use, including skipped and reserved tabs, so new tabs get a fresh one. */
  sheetIds: number[];
  categoriesSheetId?: number;
  dashboardSheetId?: number;
}

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
      layout: EMPTY_LAYOUT,
    };
  }

  async save(base: RemoteState, next: LedgerData): Promise<RemoteState> {
    this.saves++;
    this.data = structuredClone(next);
    return { ...base, data: structuredClone(next) };
  }
}
