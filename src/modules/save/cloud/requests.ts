import type { Account, TransactionInput } from '../../../lib/domain/types';
import {
  ACCOUNT_COLUMNS,
  DASHBOARD_TAB,
  METADATA_TAB,
  PAYCHECKS_TAB,
} from '../../../lib/domain/types';
import {
  dashboardRow,
  headerRow,
  METADATA_COLUMNS,
  metadataEntries,
  metadataRow,
  paychecksRow,
  transactionRow,
} from '../../../lib/google/sheetFormat';
import type { GridRange, SheetsRequest } from '../../../lib/google/sheetsTypes';
import { sameData, sameJson, sameRows, type LedgerData } from '../../../lib/store/ledgerData';
import { newSheetId, type RemoteState, type SheetLayout } from '../../../lib/store/remote';

const DASHBOARD_COLUMNS = ['Config'] as const;
const PAYCHECKS_COLUMNS = ['Paychecks'] as const;
/** Fields written for transaction rows: values plus the date format, never the user's styling. */
const TRANSACTION_FIELDS = 'userEnteredValue,userEnteredFormat.numberFormat';
const NEW_TAB_ROWS = 1000;

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

  // `_Metadata` holds the categories and the per-account settings. A sheet that still has the old
  // `_Categories` tab is moved over on any save: the new tab is written and the old one deleted in
  // the same batch.
  const entries = metadataEntries(next.categories, next.accounts);
  const legacySheetId =
    layout.metadataSheetId === undefined && !sameData(base.data, next)
      ? layout.categoriesSheetId
      : undefined;
  if (
    legacySheetId !== undefined ||
    JSON.stringify(metadataEntries(base.data.categories, base.data.accounts)) !==
      JSON.stringify(entries)
  ) {
    let sheetId = layout.metadataSheetId;
    if (sheetId === undefined) {
      sheetId = layout.metadataSheetId = newSheetId(takenIds(layout, next));
      addTab(sheetId, METADATA_TAB, METADATA_COLUMNS, entries.length);
    } else fit(sheetId, entries.length);
    requests.push({
      updateCells: {
        range: dataRange(sheetId, METADATA_COLUMNS.length),
        rows: entries.map(metadataRow),
        fields: 'userEnteredValue',
      },
    });
    if (legacySheetId !== undefined) {
      requests.push({ deleteSheet: { sheetId: legacySheetId } });
      layout.sheetIds = layout.sheetIds.filter((id) => id !== legacySheetId);
      delete layout.rowCounts[legacySheetId];
      delete layout.categoriesSheetId;
    }
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
