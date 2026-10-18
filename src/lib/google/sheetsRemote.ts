import type { Account, TransactionInput } from '../domain/types';
import {
  ACCOUNT_COLUMNS,
  CATEGORIES_TAB,
  PAYCHECKS_TAB,
  RESERVED_TAB_PREFIX,
} from '../domain/types';
import {
  sameCategories,
  sameJson,
  sameRows,
  type LedgerData,
  type SkippedTab,
} from '../store/ledgerData';
import { newSheetId, type LedgerRemote, type RemoteState, type SheetLayout } from '../store/remote';
import {
  categoryRow,
  dashboardRow,
  paychecksRow,
  headerRow,
  parseAccountTab,
  parseDashboardCell,
  parsePaychecksCell,
  rowsToCategories,
  transactionRow,
} from './sheetFormat';
import type { SheetsClient } from './sheetsClient';
import type { GridRange, SheetProperties, SheetsRequest } from './sheetsTypes';

/** Tab holding the dashboard layout as JSON in cell A2. */
export const DASHBOARD_TAB = '_Dashboard';

const CATEGORY_COLUMNS = ['Name', 'Color'] as const;
const DASHBOARD_COLUMNS = ['Config'] as const;
const PAYCHECKS_COLUMNS = ['Paychecks'] as const;
/** Fields written for transaction rows: values plus the date format, never the user's styling. */
const TRANSACTION_FIELDS = 'userEnteredValue,userEnteredFormat.numberFormat';
const NEW_TAB_ROWS = 1000;

/**
 * `LedgerRemote` for a Google Sheet (format in docs/ARCHITECTURE.md, "Sheet format").
 *
 * Loading costs two read requests whatever the number of tabs: the tab list, then every tab's
 * values in one batch. Saving costs one write request: every change since the last save goes into
 * a single `batchUpdate`, which Google applies atomically. Changed account tabs are rewritten whole,
 * in date order, with fresh Total formulas, so the running balance is always right.
 */
export function sheetsRemote(client: SheetsClient, spreadsheetId: string): LedgerRemote {
  return {
    async load() {
      const metadata = await client.getMetadata(spreadsheetId);
      const tabs = metadata.sheets.map((s) => s.properties).sort((a, b) => a.index - b.index);
      const reads = tabs.flatMap((tab) => {
        const range = readRange(tab);
        return range ? [{ tab, range }] : [];
      });
      const values = await client.readRanges(
        spreadsheetId,
        reads.map((r) => r.range)
      );
      const valuesById = new Map(reads.map((r, i) => [r.tab.sheetId, values[i] ?? []]));
      return parseSpreadsheet(tabs, valuesById);
    },
    async save(base, next) {
      const { requests, layout } = saveRequests(base, next);
      await client.batchUpdate(spreadsheetId, requests);
      return { data: next, skippedTabs: base.skippedTabs, layout };
    },
  };
}

/** What to read from a tab, from row 1. Account tabs read one column past Total to spot extra columns. */
function readRange(tab: SheetProperties): GridRange | null {
  const range = (columns: number, rows?: number): GridRange => ({
    sheetId: tab.sheetId,
    startRowIndex: 0,
    ...(rows === undefined ? {} : { endRowIndex: rows }),
    startColumnIndex: 0,
    endColumnIndex: columns,
  });
  if (tab.title === CATEGORIES_TAB) return range(CATEGORY_COLUMNS.length);
  if (tab.title === DASHBOARD_TAB || tab.title === PAYCHECKS_TAB) return range(1, 2);
  if (tab.title.startsWith(RESERVED_TAB_PREFIX)) return null;
  return range(ACCOUNT_COLUMNS.length + 1);
}

/** The loaded tabs as ledger data. Tabs that are not exactly in the account format are skipped. */
export function parseSpreadsheet(
  tabs: readonly SheetProperties[],
  valuesById: ReadonlyMap<number, unknown[][]>
): RemoteState {
  const data: LedgerData = {
    accounts: [],
    rows: {},
    categories: [],
    dashboard: null,
    paychecks: null,
  };
  const skippedTabs: SkippedTab[] = [];
  const layout: SheetLayout = { rowCounts: {}, sheetIds: [] };
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    layout.sheetIds.push(tab.sheetId);
    layout.rowCounts[tab.sheetId] = tab.gridProperties?.rowCount ?? 0;
    const values = valuesById.get(tab.sheetId) ?? [];
    if (tab.title === CATEGORIES_TAB) {
      layout.categoriesSheetId = tab.sheetId;
      data.categories = rowsToCategories(values.slice(1));
    } else if (tab.title === DASHBOARD_TAB) {
      layout.dashboardSheetId = tab.sheetId;
      data.dashboard = parseDashboardCell(values[1]?.[0]);
    } else if (tab.title === PAYCHECKS_TAB) {
      layout.paychecksSheetId = tab.sheetId;
      data.paychecks = parsePaychecksCell(values[1]?.[0]);
    } else if (!tab.title.startsWith(RESERVED_TAB_PREFIX)) {
      const parsed = parseAccountTab(values);
      if ('error' in parsed) {
        skippedTabs.push({ title: tab.title, reason: parsed.error });
        continue;
      }
      data.accounts.push({ id: tab.sheetId, name: tab.title });
      data.rows[tab.sheetId] = parsed.rows;
    }
  }
  return { data, skippedTabs, layout };
}

/** The single batch that turns the sheet from `base.data` into `next`, and the layout after it. */
export function saveRequests(
  base: RemoteState,
  next: LedgerData
): { requests: SheetsRequest[]; layout: SheetLayout } {
  const layout: SheetLayout = structuredClone(base.layout);
  const requests: SheetsRequest[] = [];
  const before = new Map(base.data.accounts.map((a) => [a.id, a]));

  /** Adds a tab with a bold, frozen header row, sized for `dataRows` rows. */
  const addTab = (sheetId: number, title: string, columns: readonly string[], dataRows = 0) => {
    const rowCount = Math.max(NEW_TAB_ROWS, dataRows + 1);
    requests.push(...addTabRequests(sheetId, title, columns, rowCount));
    layout.sheetIds.push(sheetId);
    layout.rowCounts[sheetId] = rowCount;
  };
  /** Grows a tab's grid so `dataRows` rows fit under the header. */
  const fit = (sheetId: number, dataRows: number) => {
    const needed = dataRows + 1;
    const rowCount = layout.rowCounts[sheetId] ?? 0;
    if (needed <= rowCount) return;
    requests.push({ appendDimension: { sheetId, dimension: 'ROWS', length: needed - rowCount } });
    layout.rowCounts[sheetId] = needed;
  };

  for (const account of next.accounts) {
    const rows = next.rows[account.id] ?? [];
    const old = before.get(account.id);
    if (!old) {
      addTab(account.id, account.name, ACCOUNT_COLUMNS, rows.length);
      if (rows.length > 0) requests.push(writeAccountRows(account, rows));
      continue;
    }
    if (old.name !== account.name)
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: account.id, title: account.name },
          fields: 'title',
        },
      });
    if (!sameRows(base.data.rows[account.id] ?? [], rows)) {
      fit(account.id, rows.length);
      requests.push(writeAccountRows(account, rows));
    }
  }

  if (!sameCategories(base.data.categories, next.categories)) {
    let sheetId = layout.categoriesSheetId;
    if (sheetId === undefined) {
      sheetId = layout.categoriesSheetId = newSheetId(takenIds(layout, next));
      addTab(sheetId, CATEGORIES_TAB, CATEGORY_COLUMNS, next.categories.length);
    } else fit(sheetId, next.categories.length);
    requests.push({
      updateCells: {
        range: dataRange(sheetId, CATEGORY_COLUMNS.length),
        rows: next.categories.map(categoryRow),
        fields: 'userEnteredValue',
      },
    });
  }

  if (!sameJson(base.data.dashboard, next.dashboard)) {
    let sheetId = layout.dashboardSheetId;
    if (sheetId === undefined) {
      sheetId = layout.dashboardSheetId = newSheetId(takenIds(layout, next));
      addTab(sheetId, DASHBOARD_TAB, DASHBOARD_COLUMNS, 1);
    }
    requests.push({
      updateCells: {
        range: { ...dataRange(sheetId, 1), endRowIndex: 2 },
        rows: [dashboardRow(next.dashboard)],
        fields: 'userEnteredValue',
      },
    });
  }

  if (!sameJson(base.data.paychecks, next.paychecks)) {
    let sheetId = layout.paychecksSheetId;
    if (sheetId === undefined) {
      sheetId = layout.paychecksSheetId = newSheetId(takenIds(layout, next));
      addTab(sheetId, PAYCHECKS_TAB, PAYCHECKS_COLUMNS, 1);
    }
    requests.push({
      updateCells: {
        range: { ...dataRange(sheetId, 1), endRowIndex: 2 },
        rows: [paychecksRow(next.paychecks)],
        fields: 'userEnteredValue',
      },
    });
  }

  return { requests, layout };
}

/**
 * Rewrites an account's data rows. The range is open-ended, so rows below the new last row (left
 * over after a delete) are cleared.
 */
function writeAccountRows(account: Account, rows: readonly TransactionInput[]): SheetsRequest {
  return {
    updateCells: {
      range: dataRange(account.id, ACCOUNT_COLUMNS.length),
      rows: rows.map((input, i) => transactionRow(input, i + 2)),
      fields: TRANSACTION_FIELDS,
    },
  };
}

/** Row 2 onwards of the first `columns` columns. */
function dataRange(sheetId: number, columns: number): GridRange {
  return { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns };
}

function takenIds(layout: SheetLayout, next: LedgerData): number[] {
  return [...layout.sheetIds, ...next.accounts.map((a) => a.id)];
}

/** Requests that add a tab with a bold, frozen header row. */
export function addTabRequests(
  sheetId: number,
  title: string,
  columns: readonly string[],
  rowCount = NEW_TAB_ROWS
): SheetsRequest[] {
  return [
    {
      addSheet: {
        properties: {
          sheetId,
          title,
          gridProperties: { rowCount, columnCount: columns.length, frozenRowCount: 1 },
        },
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: [headerRow(columns)],
        fields: 'userEnteredValue,userEnteredFormat.textFormat',
      },
    },
  ];
}
