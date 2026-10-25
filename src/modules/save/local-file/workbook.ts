import type { Cell, Workbook, Worksheet } from 'exceljs';
import {
  ACCOUNT_COLUMNS,
  CATEGORIES_TAB,
  DASHBOARD_TAB,
  METADATA_TAB,
  PAYCHECKS_TAB,
} from '../../../lib/domain/types';
import { loadWorkbook, newWorkbook } from '../../../lib/files/xlsx';
import {
  DATE_FORMAT,
  METADATA_COLUMNS,
  metadataEntries,
  PAYCHECK_COLUMNS,
  paycheckValues,
} from '../../../lib/google/sheetFormat';
import type { LedgerData } from '../../../lib/store/ledgerData';
import { runningTotals } from '../../../lib/transactions/runningTotal';

/**
 * Writes a ledger as an `.xlsx` workbook in the same tab layout as the Google Sheet. Writing starts
 * again from the original file's bytes and only touches the tabs Ledger owns (accounts,
 * `_Metadata`, `_Dashboard`, `_Paychecks`). Every other tab, including `_` tabs other features
 * add, comes back exactly as it was read.
 */

function isoToUtcDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function sheetFor(workbook: Workbook, title: string, columns: readonly string[], widths: number[]) {
  const existing = workbook.getWorksheet(title);
  if (existing) return existing;
  const sheet = workbook.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
  columns.forEach((name, i) => {
    const cell = sheet.getCell(1, i + 1);
    cell.value = name;
    cell.font = { bold: true };
    sheet.getColumn(i + 1).width = widths[i] ?? 12;
  });
  return sheet;
}

/**
 * Fills rows 2 to `rowCount + 1`, then clears columns A to `width` of any rows below that held data.
 * `write` returns false for a row that has no data.
 */
function writeRows(
  sheet: Worksheet,
  rowCount: number,
  width: number,
  write: (row: number, cell: (column: number) => Cell) => boolean
) {
  const last = Math.max(rowCount, sheet.rowCount - 1);
  for (let index = 0; index < last; index++) {
    const row = index + 2;
    const used = write(row, (column) => sheet.getCell(row, column));
    if (!used)
      for (let column = 1; column <= width; column++) sheet.getCell(row, column).value = null;
  }
}

function writeAccount(sheet: Worksheet, rows: LedgerData['rows'][number]) {
  const totals = runningTotals(rows.map((row) => row.amount));
  writeRows(sheet, rows.length, ACCOUNT_COLUMNS.length, (row, cell) => {
    const input = rows[row - 2];
    if (!input) return false;
    const date = cell(1);
    date.value = isoToUtcDate(input.date);
    date.numFmt = DATE_FORMAT;
    cell(2).value = input.category;
    cell(3).value = input.amount;
    cell(4).value = input.note;
    // The result is stored too, so viewers that do not recalculate still show the balance.
    cell(5).value = { formula: `SUM($C$2:C${row})`, result: totals[row - 2] ?? 0 };
    return true;
  });
}

/**
 * The workbook for `data`. `original` is the file the ledger was opened from (or `null` for a new
 * one) and `knownAccountIds` the accounts that were read from it, so renamed accounts are renamed
 * in place and deleted ones are removed.
 */
export async function writeWorkbook(
  original: ArrayBuffer | Uint8Array | null,
  knownAccountIds: readonly number[],
  data: LedgerData
): Promise<Uint8Array> {
  const workbook = original ? await loadWorkbook(original) : await newWorkbook();

  // Removed first, so an account renamed to a deleted account's name does not clash with it.
  const wanted = new Set(data.accounts.map((account) => account.id));
  for (const id of knownAccountIds) if (!wanted.has(id)) workbook.removeWorksheet(id);

  for (const account of data.accounts) {
    const known = knownAccountIds.includes(account.id)
      ? workbook.getWorksheet(account.id)
      : undefined;
    const sheet = known ?? sheetFor(workbook, account.name, ACCOUNT_COLUMNS, [12, 18, 12, 36, 12]);
    sheet.name = account.name;
    writeAccount(sheet, data.rows[account.id] ?? []);
  }

  // `_Metadata` replaces the old `_Categories` tab, which goes once its contents are moved over.
  const entries = metadataEntries(data.categories, data.accounts);
  const metadata = sheetFor(workbook, METADATA_TAB, METADATA_COLUMNS, [12, 24, 12, 12]);
  writeRows(metadata, entries.length, METADATA_COLUMNS.length, (row, cell) => {
    const entry = entries[row - 2];
    if (!entry) return false;
    cell(1).value = entry.type;
    cell(2).value = entry.name;
    cell(3).value = entry.setting;
    cell(4).value = entry.value;
    return true;
  });
  const legacy = workbook.getWorksheet(CATEGORIES_TAB);
  if (legacy) workbook.removeWorksheet(legacy.id);

  // JSON tabs: header in A1, the value in A2. Created only once there is something to keep.
  const writeJsonTab = (title: string, header: string, value: LedgerData['dashboard']) => {
    const existing = workbook.getWorksheet(title);
    if (!existing && value === null) return;
    const sheet = existing ?? sheetFor(workbook, title, [header], [60]);
    sheet.getCell(2, 1).value = value === null ? null : JSON.stringify(value);
  };
  writeJsonTab(DASHBOARD_TAB, 'Config', data.dashboard);

  // `_Paychecks` is a table, one row per payslip line. A file from before that held JSON in A2;
  // its header and cell are replaced here.
  const lines = paycheckValues(data.paychecks);
  const existingPaychecks = workbook.getWorksheet(PAYCHECKS_TAB);
  if (existingPaychecks || lines.length > 0) {
    const sheet =
      existingPaychecks ??
      sheetFor(workbook, PAYCHECKS_TAB, PAYCHECK_COLUMNS, [12, 10, 12, 24, 12]);
    PAYCHECK_COLUMNS.forEach((name, i) => {
      const cell = sheet.getCell(1, i + 1);
      cell.value = name;
      cell.font = { bold: true };
    });
    writeRows(sheet, lines.length, PAYCHECK_COLUMNS.length, (row, cell) => {
      const line = lines[row - 2];
      if (!line) return false;
      const date = cell(1);
      date.value = isoToUtcDate(line[0]);
      date.numFmt = DATE_FORMAT;
      cell(2).value = line[1];
      cell(3).value = line[2];
      cell(4).value = line[3];
      cell(5).value = line[4];
      return true;
    });
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
