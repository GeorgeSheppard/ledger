import type { SheetProperties, GridRange } from './sheetsTypes';
import {
  ACCOUNT_COLUMNS,
  CATEGORIES_TAB,
  LEGACY_TAB_NAMES,
  METADATA_TAB,
  PAYCHECKS_TAB,
  isReservedTabName,
} from '../domain/types';
import type { Category } from '../domain/types';
import type { LedgerData, SkippedTab } from '../store/ledgerData';
import type { RemoteState, SheetLayout } from '../store/remote';
import {
  parseAccountTab,
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

type TabRole = 'metadata' | 'categories' | 'paychecks' | 'ignored' | 'account';

const NEW_TAB_ROLES: Readonly<Partial<Record<string, TabRole>>> = {
  [METADATA_TAB]: 'metadata',
  [PAYCHECKS_TAB]: 'paychecks',
};

/**
 * What each tab is for. The app's own tabs are found by their current name, or by the name they had
 * before the rename when there is no tab with the new one (`renames` then says what to call them on
 * the next save). Any other reserved name is left alone.
 */
function tabRoles(tabs: readonly SheetProperties[]): {
  roles: Map<number, TabRole>;
  renames: Record<number, string>;
} {
  const titles = new Set(tabs.map((tab) => tab.title));
  const roles = new Map<number, TabRole>();
  const renames: Record<number, string> = {};
  for (const tab of tabs) {
    const legacyOf = Object.entries(LEGACY_TAB_NAMES).find(([, old]) => old === tab.title)?.[0];
    let role: TabRole;
    const current = NEW_TAB_ROLES[tab.title];
    const migrated = legacyOf && !titles.has(legacyOf) ? NEW_TAB_ROLES[legacyOf] : undefined;
    if (current) role = current;
    else if (migrated && legacyOf) {
      role = migrated;
      renames[tab.sheetId] = legacyOf;
    } else if (tab.title === CATEGORIES_TAB) role = 'categories';
    else role = isReservedTabName(tab.title) ? 'ignored' : 'account';
    roles.set(tab.sheetId, role);
  }
  return { roles, renames };
}

/**
 * What to read from a tab, from row 1. Account tabs read one column past Total to spot extra columns.
 * `tabs` is the whole tab list, needed to tell a tab with an old app name from a clashing one.
 */
export function readRange(
  tab: SheetProperties,
  tabs: readonly SheetProperties[] = [tab]
): GridRange | null {
  const range = (columns: number, rows?: number): GridRange => ({
    sheetId: tab.sheetId,
    startRowIndex: 0,
    ...(rows === undefined ? {} : { endRowIndex: rows }),
    startColumnIndex: 0,
    endColumnIndex: columns,
  });
  switch (tabRoles(tabs).roles.get(tab.sheetId)) {
    case 'metadata':
      return range(METADATA_COLUMNS.length);
    case 'categories':
      return range(CATEGORY_COLUMNS.length);
    case 'paychecks':
      return range(PAYCHECK_COLUMNS.length);
    case 'account':
      return range(ACCOUNT_COLUMNS.length + 1);
    default:
      return null;
  }
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
    paychecks: null,
  };
  const skippedTabs: SkippedTab[] = [];
  const layout: SheetLayout = { rowCounts: {}, sheetIds: [] };
  let metadata: ReturnType<typeof parseMetadata> | null = null;
  let legacyCategories: Category[] = [];
  const { roles, renames } = tabRoles(tabs);
  if (Object.keys(renames).length > 0) layout.renames = renames;
  for (const tab of [...tabs].sort((a, b) => a.index - b.index)) {
    layout.sheetIds.push(tab.sheetId);
    layout.rowCounts[tab.sheetId] = tab.gridProperties?.rowCount ?? 0;
    const values = valuesById.get(tab.sheetId) ?? [];
    const role = roles.get(tab.sheetId);
    if (role === 'metadata') {
      layout.metadataSheetId = tab.sheetId;
      metadata = parseMetadata(values.slice(1));
    } else if (role === 'categories') {
      layout.categoriesSheetId = tab.sheetId;
      legacyCategories = rowsToCategories(values.slice(1));
    } else if (role === 'paychecks') {
      layout.paychecksSheetId = tab.sheetId;
      data.paychecks = parsePaychecksTab(values);
      if (isLegacyPaychecksTab(values)) layout.paychecksLegacy = true;
    } else if (role === 'account') {
      const parsed = parseAccountTab(values);
      if ('error' in parsed) {
        skippedTabs.push({ title: tab.title, reason: parsed.error });
        continue;
      }
      data.accounts.push({ id: tab.sheetId, name: tab.title });
      data.rows[tab.sheetId] = parsed.rows;
    }
  }
  // `Ledger_Metadata` replaces `_Categories`; the old tab is only read while there is no new one.
  data.categories = metadata ? metadata.categories : legacyCategories;
  const inverted = new Set(metadata?.invertedAccounts);
  data.accounts = data.accounts.map((a) => (inverted.has(a.name) ? { ...a, inverted: true } : a));
  return { data, skippedTabs, layout };
}
