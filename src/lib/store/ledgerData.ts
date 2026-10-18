import type { Account, Category, Transaction, TransactionInput } from '../domain/types';
import { RESERVED_TAB_PREFIX } from '../domain/types';
import { runningTotals } from '../transactions/runningTotal';

/**
 * The working copy of a whole spreadsheet, and the pure edits the store applies to it. Every edit
 * returns a new `LedgerData`; nothing here mutates its input.
 *
 * Rows are kept in date order (oldest first), so a row's position is the row it will occupy in the
 * sheet after the next save and the running total is always right.
 */

/** Anything `JSON.stringify` round-trips. Used for the dashboard config, whose shape the dashboard owns. */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface LedgerData {
  /** Account tabs in tab order. */
  accounts: Account[];
  /** Rows per account id, oldest first. */
  rows: Record<number, TransactionInput[]>;
  categories: Category[];
  /** Contents of the `_Dashboard` tab, or `null` when there is none yet. */
  dashboard: JsonValue | null;
  /** Contents of the `_Paychecks` tab, or `null` when there is none yet. */
  paychecks: JsonValue | null;
}

/** A tab that is not an account because it does not match the sheet format. */
export interface SkippedTab {
  title: string;
  reason: string;
}

/** What the UI reads: the working copy with row numbers and running totals filled in. */
export interface LedgerSnapshot {
  accounts: Account[];
  /** Transactions per account id, oldest first. */
  transactionsByAccount: Record<number, Transaction[]>;
  categories: Category[];
  dashboard: JsonValue | null;
  paychecks: JsonValue | null;
  /** Tabs ignored on load, so the UI can say why a tab is missing. */
  skippedTabs: SkippedTab[];
}

/** Rows arrays are never mutated, so their transactions can be reused across snapshots. */
const derived = new WeakMap<readonly TransactionInput[], Transaction[]>();

export function toSnapshot(data: LedgerData, skippedTabs: SkippedTab[]): LedgerSnapshot {
  const transactionsByAccount: Record<number, Transaction[]> = {};
  for (const account of data.accounts) {
    const rows = data.rows[account.id] ?? [];
    let transactions = derived.get(rows);
    if (transactions?.[0]?.accountId !== account.id && rows.length > 0) transactions = undefined;
    if (!transactions) {
      transactions = toTransactions(account.id, rows);
      derived.set(rows, transactions);
    }
    transactionsByAccount[account.id] = transactions;
  }
  return {
    accounts: data.accounts,
    transactionsByAccount,
    categories: data.categories,
    dashboard: data.dashboard,
    paychecks: data.paychecks ?? null,
    skippedTabs,
  };
}

export function toTransactions(
  accountId: number,
  rows: readonly TransactionInput[]
): Transaction[] {
  const totals = runningTotals(rows.map((r) => r.amount));
  return rows.map((input, i) => {
    const row = i + 2;
    return { ...input, id: `${accountId}:${row}`, accountId, row, total: totals[i] ?? 0 };
  });
}

/** Stable sort by date, so rows on the same day keep their order. */
export function sortByDate(rows: readonly TransactionInput[]): TransactionInput[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort(byDateThenIndex)
    .map(({ r }) => r);
}

function byDateThenIndex(
  a: { r: TransactionInput; i: number },
  b: { r: TransactionInput; i: number }
): number {
  return a.r.date < b.r.date ? -1 : a.r.date > b.r.date ? 1 : a.i - b.i;
}

export function isSortedByDate(rows: readonly TransactionInput[]): boolean {
  return rows.every((r, i) => i === 0 || rows[i - 1]!.date <= r.date);
}

/** Every account's rows in date order. Unsorted tabs come back changed, so the next save fixes them. */
export function sortAllByDate(data: LedgerData): LedgerData {
  const rows: Record<number, TransactionInput[]> = {};
  let changed = false;
  for (const [id, list] of Object.entries(data.rows)) {
    const sorted = isSortedByDate(list);
    rows[Number(id)] = sorted ? list : sortByDate(list);
    changed ||= !sorted;
  }
  return changed ? { ...data, rows } : data;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanInput(input: TransactionInput): TransactionInput {
  if (!ISO_DATE.test(input.date)) throw new Error(`Not a YYYY-MM-DD date: ${input.date}`);
  if (!Number.isFinite(input.amount)) throw new Error('Amount must be a number');
  return {
    date: input.date,
    category: input.category.trim(),
    amount: input.amount,
    note: input.note.trim(),
  };
}

/**
 * Inserts each input after the last row on or before its date. Returns the new rows and the
 * indexes the inputs ended up at, in input order.
 */
export function insertByDate(
  rows: readonly TransactionInput[],
  inputs: readonly TransactionInput[]
): { rows: TransactionInput[]; indexes: number[] } {
  const tagged = [
    ...rows.map((r) => ({ r, added: -1 })),
    ...inputs.map((r, n) => ({ r: cleanInput(r), added: n })),
  ];
  const sorted = tagged.map((t, i) => ({ ...t, i })).sort(byDateThenIndex);
  const indexes: number[] = new Array<number>(inputs.length);
  sorted.forEach((t, position) => {
    if (t.added >= 0) indexes[t.added] = position;
  });
  return { rows: sorted.map((t) => t.r), indexes };
}

function accountRows(data: LedgerData, accountId: number): TransactionInput[] {
  if (!data.accounts.some((a) => a.id === accountId))
    throw new Error(`Unknown account ${accountId}`);
  return data.rows[accountId] ?? [];
}

function rowIndex(rows: readonly TransactionInput[], row: number): number {
  const index = row - 2;
  if (!Number.isInteger(row) || index < 0 || index >= rows.length)
    throw new Error(`Unknown row ${row}`);
  return index;
}

/** A trimmed, unused tab name. `takenNames` are other tabs (e.g. skipped ones) that also block it. */
export function checkAccountName(
  data: LedgerData,
  name: string,
  takenNames: readonly string[],
  exceptId?: number
): string {
  const title = name.trim();
  if (!title) throw new Error('Account name is required');
  if (title.startsWith(RESERVED_TAB_PREFIX))
    throw new Error(`Account names cannot start with "${RESERVED_TAB_PREFIX}"`);
  const lower = title.toLowerCase();
  const clash =
    data.accounts.some((a) => a.id !== exceptId && a.name.toLowerCase() === lower) ||
    takenNames.some((n) => n.toLowerCase() === lower);
  if (clash) throw new Error(`There is already a tab called "${title}"`);
  return title;
}

export function createAccount(data: LedgerData, account: Account): LedgerData {
  return {
    ...data,
    accounts: [...data.accounts, account],
    rows: { ...data.rows, [account.id]: [] },
  };
}

export function renameAccount(data: LedgerData, accountId: number, name: string): LedgerData {
  accountRows(data, accountId);
  return {
    ...data,
    accounts: data.accounts.map((a) => (a.id === accountId ? { ...a, name } : a)),
  };
}

export function addTransactions(
  data: LedgerData,
  accountId: number,
  inputs: readonly TransactionInput[]
): { data: LedgerData; rows: number[] } {
  const inserted = insertByDate(accountRows(data, accountId), inputs);
  return {
    data: { ...data, rows: { ...data.rows, [accountId]: inserted.rows } },
    rows: inserted.indexes.map((i) => i + 2),
  };
}

/** Replaces a row. If its date changed it moves to keep date order. */
export function updateTransaction(
  data: LedgerData,
  accountId: number,
  row: number,
  input: TransactionInput
): LedgerData {
  const rows = accountRows(data, accountId);
  const index = rowIndex(rows, row);
  const clean = cleanInput(input);
  let next: TransactionInput[];
  if (clean.date === rows[index]!.date) next = rows.map((r, i) => (i === index ? clean : r));
  else
    next = insertByDate(
      rows.filter((_, i) => i !== index),
      [clean]
    ).rows;
  return { ...data, rows: { ...data.rows, [accountId]: next } };
}

export function deleteTransaction(data: LedgerData, accountId: number, row: number): LedgerData {
  const rows = accountRows(data, accountId);
  const index = rowIndex(rows, row);
  return { ...data, rows: { ...data.rows, [accountId]: rows.filter((_, i) => i !== index) } };
}

export function saveCategories(data: LedgerData, categories: readonly Category[]): LedgerData {
  return { ...data, categories: categories.map((c) => ({ ...c })) };
}

/** Renames a category and every transaction that used the old name. */
export function renameCategory(data: LedgerData, from: string, to: string): LedgerData {
  if (!from || from === to) return data;
  const rows: Record<number, TransactionInput[]> = {};
  for (const [id, list] of Object.entries(data.rows))
    rows[Number(id)] = list.some((r) => r.category === from)
      ? list.map((r) => (r.category === from ? { ...r, category: to } : r))
      : list;
  return {
    ...data,
    rows,
    categories: data.categories.map((c) => (c.name === from ? { ...c, name: to } : c)),
  };
}

export function setDashboard(data: LedgerData, config: JsonValue | null): LedgerData {
  return { ...data, dashboard: structuredClone(config) };
}

export function setPaychecks(data: LedgerData, config: JsonValue | null): LedgerData {
  return { ...data, paychecks: structuredClone(config) };
}

export function sameRows(a: readonly TransactionInput[], b: readonly TransactionInput[]): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => {
      const o = b[i]!;
      return (
        r.date === o.date && r.category === o.category && r.amount === o.amount && r.note === o.note
      );
    })
  );
}

export function sameCategories(a: readonly Category[], b: readonly Category[]): boolean {
  return (
    a.length === b.length && a.every((c, i) => c.name === b[i]!.name && c.color === b[i]!.color)
  );
}

export function sameJson(
  a: JsonValue | null | undefined,
  b: JsonValue | null | undefined
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function sameData(a: LedgerData, b: LedgerData): boolean {
  if (a === b) return true;
  return (
    a.accounts.length === b.accounts.length &&
    a.accounts.every((acc, i) => {
      const other = b.accounts[i]!;
      return (
        acc.id === other.id &&
        acc.name === other.name &&
        sameRows(a.rows[acc.id] ?? [], b.rows[other.id] ?? [])
      );
    }) &&
    sameCategories(a.categories, b.categories) &&
    sameJson(a.dashboard, b.dashboard) &&
    sameJson(a.paychecks, b.paychecks)
  );
}

/**
 * Local edits that were not saved yet, replayed on top of a fresh copy of the sheet. Each account,
 * the category list and the dashboard are taken from `local` only if they changed locally since
 * `base` (the last copy saved to or loaded from the sheet); otherwise the fresh copy wins. So edits
 * made in Google Sheets to other tabs are kept.
 */
export function rebase(fresh: LedgerData, base: LedgerData, local: LedgerData): LedgerData {
  const baseById = new Map(base.accounts.map((a) => [a.id, a]));
  const localById = new Map(local.accounts.map((a) => [a.id, a]));
  const accounts: typeof fresh.accounts = [];
  const rows: Record<number, TransactionInput[]> = {};
  for (const account of fresh.accounts) {
    const before = baseById.get(account.id);
    const mine = localById.get(account.id);
    const freshRows = fresh.rows[account.id] ?? [];
    if (!before || !mine) {
      accounts.push(account);
      rows[account.id] = freshRows;
      continue;
    }
    const nameChanged = mine.name !== before.name;
    const rowsChanged = !sameRows(local.rows[mine.id] ?? [], base.rows[before.id] ?? []);
    accounts.push(nameChanged ? { ...account, name: mine.name } : account);
    rows[account.id] = rowsChanged ? (local.rows[mine.id] ?? []) : freshRows;
  }
  // Accounts created locally and never saved.
  const freshIds = new Set(fresh.accounts.map((a) => a.id));
  for (const account of local.accounts)
    if (!baseById.has(account.id) && !freshIds.has(account.id)) {
      accounts.push(account);
      rows[account.id] = local.rows[account.id] ?? [];
    }
  return {
    accounts,
    rows,
    categories: sameCategories(local.categories, base.categories)
      ? fresh.categories
      : local.categories,
    dashboard: sameJson(local.dashboard, base.dashboard) ? fresh.dashboard : local.dashboard,
    paychecks: sameJson(local.paychecks, base.paychecks)
      ? (fresh.paychecks ?? null)
      : (local.paychecks ?? null),
  };
}
