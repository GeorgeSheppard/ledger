import type { Category, IsoDate, TransactionInput } from '../domain/types';
import { ACCOUNT_COLUMNS } from '../domain/types';
import { categorySchema } from '../domain/schemas';
import type { JsonValue } from '../store/ledgerData';
import { jsonSchema } from '../store/schemas';
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

const HEADER_WIDTH = ACCOUNT_COLUMNS.length;

/**
 * An account tab's values (from row 1, columns A–F) as rows, or why the tab is not an account.
 * Only tabs that match the format exactly are accepted: row 1 must be
 * `Date | Category | Amount | Note | Total` with nothing after it, and every non-blank row must have
 * a real date and a numeric amount. Totals are not read; the app computes them from the amounts.
 * Blank rows are dropped.
 */
export function parseAccountTab(
  values: readonly (readonly unknown[])[]
): { rows: TransactionInput[] } | { error: string } {
  const header = values[0] ?? [];
  const matches =
    ACCOUNT_COLUMNS.every((name, i) => textCell(header[i]) === name) &&
    header.slice(HEADER_WIDTH).every((cell) => textCell(cell) === '');
  if (!matches) return { error: `Row 1 is not ${ACCOUNT_COLUMNS.join(' | ')}` };
  const rows: TransactionInput[] = [];
  for (let i = 1; i < values.length; i++) {
    const cells = values[i]!.slice(0, HEADER_WIDTH);
    if (isBlankRow(cells)) continue;
    const date = parseDateCell(cells[0]);
    if (!date) return { error: `Row ${i + 1} has no valid date` };
    const amount = parseNumberCell(cells[2]);
    if (amount === null) return { error: `Row ${i + 1} has no valid amount` };
    rows.push({ date, category: textCell(cells[1]), amount, note: textCell(cells[3]) });
  }
  return { rows };
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

/**
 * `_Categories` values (from row 2, columns A–B) as categories. Blank names are skipped. A missing
 * or invalid colour comes back as `''`; the store gives those a palette colour when it opens.
 */
export function rowsToCategories(values: readonly (readonly unknown[])[]): Category[] {
  return values
    .map((cells) => ({ name: textCell(cells[0]), color: textCell(cells[1]) }))
    .filter((c) => c.name !== '')
    .map((c) => categorySchema.parse(c));
}

export function categoryRow(category: Category): RowData {
  return { values: [stringCell(category.name), stringCell(category.color)] };
}

/** `_Dashboard` stores its config as JSON text in cell A2. Unreadable text counts as no config. */
export function parseDashboardCell(value: unknown): JsonValue | null {
  const text = textCell(value);
  if (!text) return null;
  try {
    const parsed = jsonSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function dashboardRow(config: JsonValue | null): RowData {
  return { values: [config === null ? {} : stringCell(JSON.stringify(config))] };
}

/** `_Paychecks` stores its list as JSON text in cell A2, like `_Dashboard`. */
export const parsePaychecksCell = parseDashboardCell;
export const paychecksRow = dashboardRow;
