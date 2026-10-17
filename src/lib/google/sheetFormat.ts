import type { Category, IsoDate, Transaction, TransactionInput } from '../domain/types';
import { ACCOUNT_COLUMNS } from '../domain/types';
import { runningTotals } from '../transactions/runningTotal';
import type { CellData, RowData } from './sheetsTypes';

/**
 * Converts between the sheet's cells and the app's domain types. Pure functions only; the
 * repository decides what to read and write, this module decides what the cells look like.
 *
 * Reads use `UNFORMATTED_VALUE` with `SERIAL_NUMBER` dates, so a cell arrives as a number, a string
 * or a boolean. Writes use typed `CellData` rather than "user entered" strings, so a note such as
 * `=HYPERLINK(...)` or `+44 20...` is stored as text and never interpreted as a formula.
 */

/** Day zero of Google Sheets (and Excel) date serials. */
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DATE_FORMAT = 'yyyy-mm-dd';

export function serialToIsoDate(serial: number): IsoDate {
  return new Date(SERIAL_EPOCH_MS + Math.floor(serial) * DAY_MS).toISOString().slice(0, 10);
}

export function isoDateToSerial(date: IsoDate): number {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - SERIAL_EPOCH_MS) / DAY_MS);
}

/** A date cell as an ISO date. Accepts serials and ISO text; anything else becomes `''`. */
export function parseDateCell(value: unknown): IsoDate {
  if (typeof value === 'number' && Number.isFinite(value)) return serialToIsoDate(value);
  if (typeof value === 'string' && ISO_DATE.test(value.trim())) return value.trim();
  return '';
}

/** A number cell. Tolerates text such as `£1,234.50` or `(12.00)` typed by hand; else `null`. */
export function parseNumberCell(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim().replace(/[,\s£$€]/g, '');
  const parenthesised = /^\((.*)\)$/.exec(text);
  if (parenthesised) text = `-${parenthesised[1]}`;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  return Number(text);
}

function textCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isBlankRow(row: readonly unknown[]): boolean {
  return row.every((cell) => textCell(cell) === '');
}

/**
 * Account tab values (from row 2, columns A–E) as transactions. Blank rows are skipped but still
 * count towards row numbers, so `row` always matches the sheet. If a Total cell is not a number
 * (missing or broken formula), the running total is computed instead.
 */
export function rowsToTransactions(
  accountId: number,
  values: readonly (readonly unknown[])[],
  firstRow = 2
): Transaction[] {
  const parsed = values
    .map((cells, index) => ({ cells, row: firstRow + index }))
    .filter(({ cells }) => !isBlankRow(cells))
    .map(({ cells, row }) => ({
      row,
      date: parseDateCell(cells[0]),
      category: textCell(cells[1]),
      amount: parseNumberCell(cells[2]) ?? 0,
      note: textCell(cells[3]),
      sheetTotal: parseNumberCell(cells[4]),
    }));
  const computed = runningTotals(parsed.map((t) => t.amount));
  return parsed.map(({ sheetTotal, ...t }, i) => ({
    id: `${accountId}:${t.row}`,
    accountId,
    ...t,
    total: sheetTotal ?? computed[i] ?? 0,
  }));
}

/** Running balance formula for a data row. Survives row deletions because the range shrinks. */
export function totalFormula(row: number): string {
  return `=SUM($C$2:C${row})`;
}

const dateCellFormat = { numberFormat: { type: 'DATE', pattern: DATE_FORMAT } } as const;

function dateCell(date: IsoDate): CellData {
  return {
    userEnteredValue: { numberValue: isoDateToSerial(date) },
    userEnteredFormat: dateCellFormat,
  };
}

function stringCell(value: string): CellData {
  return { userEnteredValue: { stringValue: value } };
}

/** Columns A–D of a transaction row. */
export function transactionInputCells(input: TransactionInput): CellData[] {
  return [
    dateCell(input.date),
    stringCell(input.category),
    { userEnteredValue: { numberValue: input.amount } },
    stringCell(input.note),
  ];
}

/** A full transaction row (A–E) for sheet row `row`, including the Total formula. */
export function transactionRow(input: TransactionInput, row: number): RowData {
  return {
    values: [
      ...transactionInputCells(input),
      { userEnteredValue: { formulaValue: totalFormula(row) } },
    ],
  };
}

export function headerRow(columns: readonly string[] = ACCOUNT_COLUMNS): RowData {
  return {
    values: columns.map((name) => ({
      ...stringCell(name),
      userEnteredFormat: { textFormat: { bold: true } },
    })),
  };
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FALLBACK_COLOR = '#8b8d98';

/** `_Categories` values (from row 2, columns A–B) as categories. Blank names are skipped. */
export function rowsToCategories(values: readonly (readonly unknown[])[]): Category[] {
  return values
    .map((cells) => ({ name: textCell(cells[0]), color: textCell(cells[1]) }))
    .filter((c) => c.name !== '')
    .map((c) => ({ name: c.name, color: HEX_COLOR.test(c.color) ? c.color : FALLBACK_COLOR }));
}

export function categoryRow(category: Category): RowData {
  return { values: [stringCell(category.name), stringCell(category.color)] };
}
