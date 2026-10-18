import type { Cell, CellValue, Workbook, Worksheet } from 'exceljs';
import type { LedgerData } from '../store/ledgerData';
import { ACCOUNT_COLUMNS, CATEGORIES_TAB } from '../domain/types';
import { DASHBOARD_TAB, parseSpreadsheet } from '../google/sheetsRemote';
import { DATE_FORMAT } from '../google/sheetFormat';
import type { RemoteState } from '../store/remote';
import { runningTotals } from '../transactions/runningTotal';

/**
 * Reads and writes a ledger as an `.xlsx` workbook, in the same tab layout as the Google Sheet (see
 * "Sheet format" in docs/ARCHITECTURE.md). Reading goes through the same parser as Sheets, so the
 * same strictness applies: a tab is an account only if its header is exactly
 * `Date | Category | Amount | Note | Total` and every row has a valid date and amount.
 *
 * Writing starts again from the original file's bytes and only touches the tabs Ledger owns
 * (accounts, `_Categories`, `_Dashboard`). Every other tab, including `_` tabs other features add,
 * comes back exactly as it was read.
 */

/** Columns read from each tab: Date to Total, plus one spare to spot extra columns in the header. */
const READ_COLUMNS = ACCOUNT_COLUMNS.length + 1;
const CATEGORY_COLUMNS = ['Name', 'Color'] as const;
const DASHBOARD_COLUMNS = ['Config'] as const;

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** One tab as plain values, row by row from row 1. */
export interface RawTab {
  id: number;
  title: string;
  values: unknown[][];
}

/** ExcelJS is large, so it is only fetched when a file is opened or downloaded. */
async function newWorkbook(): Promise<Workbook> {
  const exceljs = await import('exceljs');
  const Constructor = exceljs.Workbook ?? exceljs.default.Workbook;
  return new Constructor();
}

async function loadWorkbook(bytes: ArrayBuffer | Uint8Array): Promise<Workbook> {
  const workbook = await newWorkbook();
  try {
    await workbook.xlsx.load(bytes as ArrayBuffer);
  } catch {
    throw new Error('That does not look like an .xlsx spreadsheet.');
  }
  return workbook;
}

/** A cell as the plain value the Sheets parser expects: dates as ISO text, formulas as results. */
function plainValue(value: CellValue): unknown {
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if ('result' in value) return plainValue(value.result as CellValue);
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value) return String(value.text);
  return '';
}

function readTab(sheet: Worksheet): RawTab {
  const values: unknown[][] = [];
  for (let row = 1; row <= sheet.rowCount; row++) {
    const cells: unknown[] = [];
    for (let column = 1; column <= READ_COLUMNS; column++)
      cells.push(plainValue(sheet.getCell(row, column).value));
    values.push(cells);
  }
  return { id: sheet.id, title: sheet.name, values };
}

/** Every tab of an `.xlsx` file as plain values. */
export async function readWorkbookTabs(bytes: ArrayBuffer | Uint8Array): Promise<RawTab[]> {
  return (await loadWorkbook(bytes)).worksheets.map(readTab);
}

/**
 * The ledger in a set of tabs. Throws a readable error if nothing in the file is a Ledger account,
 * so a wrong file is explained rather than opened as an empty ledger.
 */
export function ledgerFromTabs(tabs: readonly RawTab[]): RemoteState {
  const state = parseSpreadsheet(
    tabs.map((tab, index) => ({ sheetId: tab.id, title: tab.title, index })),
    new Map(tabs.map((tab) => [tab.id, tab.values]))
  );
  if (state.data.accounts.length === 0) {
    if (tabs.length === 0) throw new Error('That file has no tabs.');
    const reasons = state.skippedTabs
      .slice(0, 3)
      .map((tab) => `“${tab.title}”: ${tab.reason}`)
      .join('; ');
    throw new Error(
      `No tab in that file has ${ACCOUNT_COLUMNS.join(' | ')} as its first row, so Ledger cannot read it as accounts.${reasons ? ` ${reasons}.` : ''}`
    );
  }
  return state;
}

// --- Writing ---

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

  const categories = sheetFor(workbook, CATEGORIES_TAB, CATEGORY_COLUMNS, [24, 12]);
  writeRows(categories, data.categories.length, CATEGORY_COLUMNS.length, (row, cell) => {
    const category = data.categories[row - 2];
    if (!category) return false;
    cell(1).value = category.name;
    cell(2).value = category.color;
    return true;
  });

  const dashboard = workbook.getWorksheet(DASHBOARD_TAB);
  if (dashboard || data.dashboard !== null) {
    const sheet = dashboard ?? sheetFor(workbook, DASHBOARD_TAB, DASHBOARD_COLUMNS, [60]);
    sheet.getCell(2, 1).value = data.dashboard === null ? null : JSON.stringify(data.dashboard);
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
