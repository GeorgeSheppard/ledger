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
import type { LedgerData, SkippedTab, TabReport } from '../store/ledgerData';
import type { RemoteState, SheetLayout } from '../store/remote';
import {
  parseAccountTab,
  parseDashboardCell,
  parseMetadata,
  isLegacyPaychecksTab,
  PAYCHECK_COLUMNS,
  parsePaychecksTab,
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
  if (tab.title === DASHBOARD_TAB) return range(1, 2);
  if (tab.title === PAYCHECKS_TAB) return range(PAYCHECK_COLUMNS.length);
  if (tab.title.startsWith(RESERVED_TAB_PREFIX)) return null;
  return range(ACCOUNT_COLUMNS.length + 1);
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
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
  const tabReports: TabReport[] = [];
  const layout: SheetLayout = { rowCounts: {}, sheetIds: [] };
  let metadata: ReturnType<typeof parseMetadata> | null = null;
  let legacyCategories: Category[] = [];
  let legacyReport: TabReport | null = null;
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    layout.sheetIds.push(tab.sheetId);
    layout.rowCounts[tab.sheetId] = tab.gridProperties?.rowCount ?? 0;
    const values = valuesById.get(tab.sheetId) ?? [];
    if (tab.title === METADATA_TAB) {
      layout.metadataSheetId = tab.sheetId;
      metadata = parseMetadata(values.slice(1));
      tabReports.push({
        title: tab.title,
        kind: 'settings',
        imported: true,
        reason: `Ledger settings: ${plural(metadata.categories.length, 'category', 'categories')}${
          metadata.invertedAccounts.length > 0
            ? ` and ${plural(metadata.invertedAccounts.length, 'inverted account')}`
            : ''
        }.`,
      });
    } else if (tab.title === CATEGORIES_TAB) {
      layout.categoriesSheetId = tab.sheetId;
      legacyCategories = rowsToCategories(values.slice(1));
      legacyReport = {
        title: tab.title,
        kind: 'categories',
        imported: true,
        reason: `Categories from an older version of Ledger (${plural(legacyCategories.length, 'category', 'categories')}).`,
      };
      tabReports.push(legacyReport);
    } else if (tab.title === DASHBOARD_TAB) {
      layout.dashboardSheetId = tab.sheetId;
      data.dashboard = parseDashboardCell(values[1]?.[0]);
      tabReports.push({
        title: tab.title,
        kind: 'dashboard',
        imported: data.dashboard !== null,
        reason:
          data.dashboard !== null
            ? 'Your dashboard layout.'
            : 'No readable dashboard layout in cell A2, so the default dashboard is shown.',
      });
    } else if (tab.title === PAYCHECKS_TAB) {
      layout.paychecksSheetId = tab.sheetId;
      data.paychecks = parsePaychecksTab(values);
      if (isLegacyPaychecksTab(values)) layout.paychecksLegacy = true;
      tabReports.push({
        title: tab.title,
        kind: 'paychecks',
        imported: data.paychecks !== null,
        reason:
          data.paychecks !== null
            ? 'Your paychecks.'
            : `No paychecks found. Rows need a ${PAYCHECK_COLUMNS.join(' | ')} header, a valid date and a positive amount.`,
      });
    } else if (tab.title.startsWith(RESERVED_TAB_PREFIX)) {
      tabReports.push({
        title: tab.title,
        kind: 'reserved',
        imported: false,
        reason: `Tabs starting with ${RESERVED_TAB_PREFIX} are kept for Ledger's own settings, so this one is not read as an account. Rename it to import it.`,
      });
    } else {
      const parsed = parseAccountTab(values);
      if ('error' in parsed) {
        skippedTabs.push({ title: tab.title, reason: parsed.error });
        tabReports.push({
          title: tab.title,
          kind: 'account',
          imported: false,
          reason: parsed.error,
        });
        continue;
      }
      data.accounts.push({ id: tab.sheetId, name: tab.title });
      data.rows[tab.sheetId] = parsed.rows;
      tabReports.push({
        title: tab.title,
        kind: 'account',
        imported: true,
        reason: `Account with ${plural(parsed.rows.length, 'transaction')}.`,
      });
    }
  }
  // `_Metadata` replaces `_Categories`; the old tab is only read while there is no new one.
  data.categories = metadata ? metadata.categories : legacyCategories;
  if (metadata && legacyReport) {
    legacyReport.imported = false;
    legacyReport.reason = `Not read: the ${METADATA_TAB} tab holds the categories now, so this older tab is ignored.`;
  }
  const inverted = new Set(metadata?.invertedAccounts);
  data.accounts = data.accounts.map((a) => (inverted.has(a.name) ? { ...a, inverted: true } : a));
  return { data, skippedTabs, tabReports, layout };
}
