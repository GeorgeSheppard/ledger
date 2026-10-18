import type { SheetProperties, GridRange } from './sheetsTypes';
import {
  ACCOUNT_COLUMNS,
  CATEGORIES_TAB,
  DASHBOARD_TAB,
  METADATA_TAB,
  PAYCHECKS_TAB,
  RESERVED_TAB_PREFIX,
} from '../domain/types';
import type { Category } from '../domain/types';
import type { LedgerData, SkippedTab } from '../store/ledgerData';
import type { RemoteState, SheetLayout } from '../store/remote';
import {
  parseAccountTab,
  parseDashboardCell,
  parseMetadata,
  parsePaychecksCell,
  METADATA_COLUMNS,
  rowsToCategories,
} from './sheetFormat';

/**
 * Reading a spreadsheet in Ledger's sheet format (docs/ARCHITECTURE.md, "Sheet format") from its
 * tab list and values. Shared by everything that reads that format: Google Sheets and `.xlsx` files.
 */

const CATEGORY_COLUMNS = ['Name', 'Color'] as const;

/** What to read from a tab, from row 1. Account tabs read one column past Total to spot extra columns. */
export function readRange(tab: SheetProperties): GridRange | null {
  const range = (columns: number, rows?: number): GridRange => ({
    sheetId: tab.sheetId,
    startRowIndex: 0,
    ...(rows === undefined ? {} : { endRowIndex: rows }),
    startColumnIndex: 0,
    endColumnIndex: columns,
  });
  if (tab.title === METADATA_TAB) return range(METADATA_COLUMNS.length);
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
  let metadata: ReturnType<typeof parseMetadata> | null = null;
  let legacyCategories: Category[] = [];
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    layout.sheetIds.push(tab.sheetId);
    layout.rowCounts[tab.sheetId] = tab.gridProperties?.rowCount ?? 0;
    const values = valuesById.get(tab.sheetId) ?? [];
    if (tab.title === METADATA_TAB) {
      layout.metadataSheetId = tab.sheetId;
      metadata = parseMetadata(values.slice(1));
    } else if (tab.title === CATEGORIES_TAB) {
      layout.categoriesSheetId = tab.sheetId;
      legacyCategories = rowsToCategories(values.slice(1));
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
  // `_Metadata` replaces `_Categories`; the old tab is only read while there is no new one.
  data.categories = metadata ? metadata.categories : legacyCategories;
  const inverted = new Set(metadata?.invertedAccounts);
  data.accounts = data.accounts.map((a) => (inverted.has(a.name) ? { ...a, inverted: true } : a));
  return { data, skippedTabs, layout };
}
