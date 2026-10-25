import { z } from 'zod';
import type { Account, Category, IsoDate, TransactionInput } from '../domain/types';
import { ACCOUNT_COLUMNS } from '../domain/types';
import { categorySchema } from '../domain/schemas';
import type { JsonValue } from '../store/ledgerData';
import type { Paycheck } from '../paychecks/paychecks';
import { parsePaychecks, serializePaychecks } from '../paychecks/serialize';
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

export const METADATA_COLUMNS = ['Type', 'Name', 'Setting', 'Value'] as const;

/**
 * One row of `Ledger_Metadata`: `category | Food | color | #4f7cff`, `category | Transfers | excluded | TRUE`,
 * `category | Gym | archived | TRUE`, `category | Rent | account | Current` (once per account the category is limited to; none means
 * global) or `account | Visa | inverted | TRUE`.
 */
export interface MetadataEntry {
  type: 'category' | 'account';
  name: string;
  setting: string;
  value: string | boolean;
}

const flagSchema = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? /^(true|yes|1)$/i.test(v.trim()) : Boolean(v)));

/**
 * `Ledger_Metadata` values (from row 2, columns A–D). Rows are checked one by one: a row of an unknown
 * type or setting, or one with a blank name, is skipped, so a hand edit never stops the sheet
 * loading. Account names are the tab names of the accounts that are inverted.
 */
export function parseMetadata(values: readonly (readonly unknown[])[]): {
  categories: Category[];
  invertedAccounts: string[];
} {
  const categories: Category[] = [];
  const excluded: string[] = [];
  const archived: string[] = [];
  const scoped: { name: string; account: string }[] = [];
  const invertedAccounts: string[] = [];
  for (const cells of values) {
    const [type, name, setting] = [0, 1, 2].map((i) => textCell(cells[i]));
    if (!name) continue;
    if (type === 'category' && setting === 'color')
      categories.push(categorySchema.parse({ name, color: textCell(cells[3]) }));
    else if (type === 'category' && setting === 'excluded' && flagSchema.parse(cells[3] ?? false))
      excluded.push(name);
    else if (type === 'category' && setting === 'archived' && flagSchema.parse(cells[3] ?? false))
      archived.push(name);
    else if (type === 'category' && setting === 'account' && textCell(cells[3]))
      scoped.push({ name, account: textCell(cells[3]) });
    else if (type === 'account' && setting === 'inverted' && flagSchema.parse(cells[3] ?? false))
      invertedAccounts.push(name);
  }
  // Settings may come before or after the category's colour row, so they are applied at the end.
  // A category with only a setting row (no colour yet) still exists; the store gives it a colour.
  for (const name of excluded) {
    const known = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (known) known.excluded = true;
    else categories.push({ name, color: '', excluded: true });
  }
  for (const name of archived) {
    const known = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (known) known.archived = true;
    else categories.push({ name, color: '', archived: true });
  }
  for (const { name, account } of scoped) {
    let known = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!known) categories.push((known = { name, color: '' }));
    if (!known.accounts?.includes(account)) known.accounts = [...(known.accounts ?? []), account];
  }
  return { categories, invertedAccounts };
}

/** Everything `Ledger_Metadata` holds for these categories and accounts, in the order it is written. */
export function metadataEntries(
  categories: readonly Category[],
  accounts: readonly Account[]
): MetadataEntry[] {
  return [
    ...categories.map((c): MetadataEntry => ({
      type: 'category',
      name: c.name,
      setting: 'color',
      value: c.color,
    })),
    ...categories
      .filter((c) => c.excluded)
      .map((c): MetadataEntry => ({
        type: 'category',
        name: c.name,
        setting: 'excluded',
        value: true,
      })),
    ...categories
      .filter((c) => c.archived)
      .map((c): MetadataEntry => ({
        type: 'category',
        name: c.name,
        setting: 'archived',
        value: true,
      })),
    ...categories.flatMap((c) =>
      (c.accounts ?? []).map((account): MetadataEntry => ({
        type: 'category',
        name: c.name,
        setting: 'account',
        value: account,
      }))
    ),
    ...accounts
      .filter((a) => a.inverted)
      .map((a): MetadataEntry => ({
        type: 'account',
        name: a.name,
        setting: 'inverted',
        value: true,
      })),
  ];
}

export function metadataRow(entry: MetadataEntry): RowData {
  return {
    values: [
      stringCell(entry.type),
      stringCell(entry.name),
      stringCell(entry.setting),
      typeof entry.value === 'boolean'
        ? { userEnteredValue: { boolValue: entry.value } }
        : stringCell(entry.value),
    ],
  };
}

/** `Ledger_Dashboard` stores its config as JSON text in cell A2. Unreadable text counts as no config. */
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

export const PAYCHECK_COLUMNS = ['Date', 'Tax code', 'Type', 'Name', 'Amount'] as const;
/** The layout before the tax code: column B was a label separating payslips on the same day. Still read. */
const PAYCHECK_COLUMNS_V1 = ['Date', 'Paycheck', 'Type', 'Name', 'Amount'] as const;

const INCOME = 'Income';
const BENEFIT = 'Benefit in kind';
const DEDUCTION = 'Deduction';

/**
 * `Paychecks` is a plain table with one row per payslip line, so Excel can pivot and chart it:
 * `Date | Paycheck | Type | Name | Amount`. `Paycheck` is a label shared by the lines of one payslip
 * (two payslips on one day need different labels), `Type` is Income, Benefit in kind or Deduction,
 * and `Amount` is always positive. Older files kept the paychecks as JSON text in cell A2, like `Ledger_Dashboard`; that
 * is still read, and the next change to the paychecks writes the table.
 */
function hasHeader(values: readonly (readonly unknown[])[], columns: readonly string[]): boolean {
  const header = values[0] ?? [];
  return columns.every((name, i) => textCell(header[i]).toLowerCase() === name.toLowerCase());
}

function isPaycheckTable(values: readonly (readonly unknown[])[]): boolean {
  return hasHeader(values, PAYCHECK_COLUMNS) || hasHeader(values, PAYCHECK_COLUMNS_V1);
}

/** Whether the tab still has the old JSON layout (so the table has to replace its header too). */
export function isLegacyPaychecksTab(values: readonly (readonly unknown[])[]): boolean {
  return !isPaycheckTable(values);
}

/**
 * The paychecks in a `Paychecks` tab (from row 1) in the stored JSON shape, or `null` when there
 * are none. Rows that cannot be understood are skipped.
 */
export function parsePaychecksTab(values: readonly (readonly unknown[])[]): JsonValue | null {
  if (!isPaycheckTable(values)) {
    const stored = parseDashboardCell(values[1]?.[0]);
    return stored === null
      ? null
      : (serializePaychecks(parsePaychecks(stored)) as unknown as JsonValue);
  }
  const labelled = hasHeader(values, PAYCHECK_COLUMNS_V1);
  const byLabel = new Map<string, Paycheck>();
  for (const cells of values.slice(1)) {
    const date = parseDateCell(cells[0]);
    const label = labelled ? textCell(cells[1]) : '';
    const taxCode = labelled ? '' : textCell(cells[1]);
    const type = textCell(cells[2]).toLowerCase();
    const amount = parseNumberCell(cells[4]);
    if (!date || amount === null || !(amount > 0)) continue;
    if (type !== 'income' && type !== 'deduction' && type !== BENEFIT.toLowerCase()) continue;
    const key = `${date}|${label}`;
    let paycheck = byLabel.get(key);
    if (!paycheck) {
      paycheck = { id: `p${byLabel.size + 1}`, date, income: [], benefits: [], deductions: [] };
      byLabel.set(key, paycheck);
    }
    if (taxCode && !paycheck.taxCode) paycheck.taxCode = taxCode;
    const list =
      type === 'income'
        ? paycheck.income
        : type === 'deduction'
          ? paycheck.deductions
          : paycheck.benefits;
    list.push({ id: `l${list.length + 1}`, name: textCell(cells[3]), amount });
  }
  return byLabel.size === 0
    ? null
    : (serializePaychecks({ paychecks: [...byLabel.values()] }) as unknown as JsonValue);
}

/** The header row and one row per line of every paycheck, oldest paycheck first. */
export function paycheckRows(config: JsonValue | null): RowData[] {
  const rows: RowData[] = [headerRow(PAYCHECK_COLUMNS)];
  for (const paycheck of parsePaychecks(config).paychecks) {
    const line = (type: string, l: { name: string; amount: number }): RowData => ({
      values: [
        dateCell(paycheck.date),
        stringCell(paycheck.taxCode ?? ''),
        stringCell(type),
        stringCell(l.name),
        { userEnteredValue: { numberValue: l.amount } },
      ],
    });
    rows.push(...paycheck.income.map((l) => line(INCOME, l)));
    rows.push(...paycheck.benefits.map((l) => line(BENEFIT, l)));
    rows.push(...paycheck.deductions.map((l) => line(DEDUCTION, l)));
  }
  return rows;
}

/** The same rows as plain values, for writing an `.xlsx`: ISO dates, then the tax code, type, name and amount. */
export function paycheckValues(
  config: JsonValue | null
): [string, string, string, string, number][] {
  const out: [string, string, string, string, number][] = [];
  for (const paycheck of parsePaychecks(config).paychecks) {
    const code = paycheck.taxCode ?? '';
    for (const l of paycheck.income) out.push([paycheck.date, code, INCOME, l.name, l.amount]);
    for (const l of paycheck.benefits) out.push([paycheck.date, code, BENEFIT, l.name, l.amount]);
    for (const l of paycheck.deductions)
      out.push([paycheck.date, code, DEDUCTION, l.name, l.amount]);
  }
  return out;
}
