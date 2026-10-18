import type { TransactionInput } from '../../../lib/domain/types';
import { detectDateFormat, parseAmount, parseDate, type DateFormat } from './values';

/**
 * Turning parsed CSV rows into transactions: finding the header row, guessing which column holds
 * what, and converting each row with a (possibly user-corrected) mapping.
 */

export interface CsvTable {
  /** Column names. Generated (`Column 1`, …) when the file has no header row. */
  headers: string[];
  /** Data rows, each padded to `headers.length`. */
  rows: string[][];
  /** 1-based line in the file of each data row, for error messages. */
  lines: number[];
  hasHeader: boolean;
}

/** Column indexes for each field; null when the CSV has no such column. */
export interface ColumnMapping {
  date: number | null;
  /** A single signed amount column. Takes precedence over debit/credit when set. */
  amount: number | null;
  /** Money out, for exports that split amounts into two columns. */
  debit: number | null;
  /** Money in, for exports that split amounts into two columns. */
  credit: number | null;
  note: number | null;
  category: number | null;
  dateFormat: DateFormat;
  /** Flip every amount's sign, for exports (often credit cards) where spending is positive. */
  invertAmounts: boolean;
}

export type MappedField = 'date' | 'amount' | 'debit' | 'credit' | 'note' | 'category';

export const MAPPED_FIELDS: { field: MappedField; label: string }[] = [
  { field: 'date', label: 'Date' },
  { field: 'amount', label: 'Amount' },
  { field: 'debit', label: 'Money out' },
  { field: 'credit', label: 'Money in' },
  { field: 'note', label: 'Note' },
  { field: 'category', label: 'Category' },
];

/** Header names each field is recognised by, normalised (lower case, letters and digits only). */
const SYNONYMS: Record<MappedField, string[]> = {
  date: [
    'date',
    'transactiondate',
    'transdate',
    'postingdate',
    'posteddate',
    'bookingdate',
    'valuedate',
    'completeddate',
    'starteddate',
  ],
  amount: ['amount', 'transactionamount', 'value', 'netamount', 'sum'],
  debit: [
    'debit',
    'debits',
    'debitamount',
    'moneyout',
    'paidout',
    'withdrawal',
    'withdrawals',
    'out',
    'spent',
  ],
  credit: [
    'credit',
    'credits',
    'creditamount',
    'moneyin',
    'paidin',
    'deposit',
    'deposits',
    'in',
    'received',
  ],
  note: [
    'description',
    'transactiondescription',
    'details',
    'narrative',
    'memo',
    'note',
    'notes',
    'payee',
    'merchant',
    'name',
    'particulars',
    'reference',
  ],
  category: ['category', 'categories'],
};

/** Substrings that, when part of a longer header, still suggest the field. */
const CONTAINS: Partial<Record<MappedField, string[]>> = {
  date: ['date'],
  amount: ['amount'],
  note: ['description', 'narrative', 'payee', 'merchant'],
};

/** Headers that look like a field but are not, e.g. `Balance` or `Amount (balance)`. */
const NEVER = /balance|currency|fee/;

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function looksLikeData(cell: string): boolean {
  return detectDateFormat([cell]) !== null || parseAmount(cell) !== null;
}

/** The most common row length, which is the real table's width. */
function commonWidth(rows: readonly string[][]): number {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let best = 0;
  for (const [length, count] of counts) {
    if (count > (counts.get(best) ?? 0) || (count === counts.get(best) && length > best)) {
      best = length;
    }
  }
  return best;
}

/**
 * Builds a table from parsed rows. Skips preamble lines some banks put above the header (rows
 * with fewer cells than the widest row), and treats the first row as data rather than a header
 * when it already contains dates or numbers.
 */
export function toTable(parsed: readonly string[][], hasHeader?: boolean): CsvTable {
  const start = Math.max(
    0,
    parsed.findIndex((r) => r.length >= commonWidth(parsed))
  );
  const body = parsed.slice(start);
  const width = Math.max(0, ...body.map((r) => r.length));
  const header = hasHeader ?? !(body[0] ?? []).some(looksLikeData);
  const pad = (r: readonly string[]) => [...r, ...Array<string>(width - r.length).fill('')];
  const dataRows = header ? body.slice(1) : body;
  return {
    headers: header
      ? pad(body[0] ?? []).map((h, i) => h || `Column ${i + 1}`)
      : Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    rows: dataRows.map(pad),
    lines: dataRows.map((_, i) => start + i + (header ? 2 : 1)),
    hasHeader: header,
  };
}

function column(table: CsvTable, index: number): string[] {
  return table.rows.map((r) => r[index] ?? '');
}

/** Guesses the mapping from header names, falling back to the column contents. */
export function guessMapping(table: CsvTable): ColumnMapping {
  const used = new Set<number>();
  const normalized = table.headers.map(normalizeHeader);
  const take = (field: MappedField): number | null => {
    const candidates = normalized.map((h, i) => ({ h, i })).filter(({ i }) => !used.has(i));
    const pick =
      candidates.find(({ h }) => SYNONYMS[field].includes(h) && !NEVER.test(h)) ??
      candidates.find(
        ({ h }) => (CONTAINS[field] ?? []).some((part) => h.includes(part)) && !NEVER.test(h)
      );
    if (!pick) return null;
    used.add(pick.i);
    return pick.i;
  };

  let date = take('date');
  let amount = take('amount');
  const debit = amount === null ? take('debit') : null;
  const credit = amount === null ? take('credit') : null;
  const note = take('note');
  const category = take('category');

  // Headerless files, or headers we do not recognise: look at the data instead.
  const free = () => table.headers.map((_, i) => i).filter((i) => !used.has(i));
  if (date === null) {
    date = free().find((i) => detectDateFormat(column(table, i)) !== null) ?? null;
    if (date !== null) used.add(date);
  }
  if (amount === null && debit === null && credit === null) {
    amount =
      free().find((i) => {
        const values = column(table, i).filter((v) => v !== '');
        return values.length > 0 && values.every((v) => parseAmount(v) !== null);
      }) ?? null;
    if (amount !== null) used.add(amount);
  }
  let guessedNote = note;
  if (guessedNote === null) {
    guessedNote =
      free().find((i) => column(table, i).some((v) => v !== '' && !looksLikeData(v))) ?? null;
  }

  return {
    date,
    amount,
    debit,
    credit,
    note: guessedNote,
    category,
    dateFormat: (date !== null && detectDateFormat(column(table, date))) || 'dmy',
    invertAmounts: false,
  };
}

/** Problems that stop the mapping being used at all, e.g. no date column chosen. */
export function mappingProblems(mapping: ColumnMapping): string[] {
  const problems: string[] = [];
  if (mapping.date === null) problems.push('Choose the column that holds the date.');
  if (mapping.amount === null && mapping.debit === null && mapping.credit === null) {
    problems.push('Choose the amount column, or the money in and money out columns.');
  }
  return problems;
}

export type MappedRow =
  | { line: number; cells: string[]; input: TransactionInput; error?: undefined }
  | { line: number; cells: string[]; input?: undefined; error: string };

function rowAmount(cells: readonly string[], mapping: ColumnMapping): number | string {
  if (mapping.amount !== null) {
    const amount = parseAmount(cells[mapping.amount] ?? '');
    return amount ?? `"${cells[mapping.amount] ?? ''}" is not an amount`;
  }
  const debitCell = mapping.debit === null ? '' : (cells[mapping.debit] ?? '');
  const creditCell = mapping.credit === null ? '' : (cells[mapping.credit] ?? '');
  const debit = parseAmount(debitCell);
  const credit = parseAmount(creditCell);
  if (debitCell && debit === null) return `"${debitCell}" is not an amount`;
  if (creditCell && credit === null) return `"${creditCell}" is not an amount`;
  if (debit === null && credit === null) return 'No amount';
  return Math.round((Math.abs(credit ?? 0) - Math.abs(debit ?? 0)) * 100) / 100;
}

/** Converts every data row with the mapping. Rows that cannot be converted carry an error. */
export function applyMapping(table: CsvTable, mapping: ColumnMapping): MappedRow[] {
  return table.rows.map((cells, i) => {
    const line = table.lines[i] ?? i + 1;
    const dateCell = mapping.date === null ? '' : (cells[mapping.date] ?? '');
    const date = parseDate(dateCell, mapping.dateFormat);
    if (!date) {
      return { line, cells, error: dateCell ? `"${dateCell}" is not a date` : 'No date' };
    }
    const amount = rowAmount(cells, mapping);
    if (typeof amount === 'string') return { line, cells, error: amount };
    return {
      line,
      cells,
      input: {
        date,
        amount: mapping.invertAmounts && amount !== 0 ? -amount : amount,
        note: mapping.note === null ? '' : (cells[mapping.note] ?? ''),
        category: mapping.category === null ? '' : (cells[mapping.category] ?? ''),
      },
    };
  });
}
