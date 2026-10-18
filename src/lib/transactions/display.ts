import type { IsoDate, Transaction } from '../domain/types';
import { roundCents } from './amount';
import { monthKey } from './dates';

/**
 * How an account's transactions are presented. The sheet is append-only and its Total column is a
 * running balance in sheet order, so the newest row (the last one) is shown first and totals read
 * correctly from bottom to top.
 */
export function displayOrder(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.row - a.row);
}

export interface MonthGroup {
  /** `YYYY-MM`. */
  key: string;
  transactions: Transaction[];
  moneyIn: number;
  moneyOut: number;
}

/** Splits already-ordered transactions into runs of the same month, for month headings. */
export function groupByMonth(ordered: readonly Transaction[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const transaction of ordered) {
    const key = monthKey(transaction.date);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, transactions: [], moneyIn: 0, moneyOut: 0 };
      groups.push(group);
    }
    group.transactions.push(transaction);
    if (transaction.amount > 0) group.moneyIn = roundCents(group.moneyIn + transaction.amount);
    else group.moneyOut = roundCents(group.moneyOut + transaction.amount);
  }
  return groups;
}

export interface AccountSummary {
  /** Total of the last row in the sheet, i.e. the current balance. */
  balance: number;
  /** Money in and out during the month containing `today`. `moneyOut` is negative or zero. */
  monthIn: number;
  monthOut: number;
  count: number;
}

export function summarizeAccount(
  transactions: readonly Transaction[],
  today: IsoDate
): AccountSummary {
  const month = monthKey(today);
  let monthIn = 0;
  let monthOut = 0;
  let last: Transaction | undefined;
  for (const t of transactions) {
    if (!last || t.row > last.row) last = t;
    if (monthKey(t.date) !== month) continue;
    if (t.amount > 0) monthIn += t.amount;
    else monthOut += t.amount;
  }
  return {
    balance: last?.total ?? 0,
    monthIn: roundCents(monthIn),
    monthOut: roundCents(monthOut),
    count: transactions.length,
  };
}

/**
 * Which row to select after deleting `deleted`. Rows below it in the sheet move up one, so the
 * transaction shown next (the older one, at `row - 1`) keeps its id; when there is none, the newer
 * neighbour slides into the deleted row number.
 */
export function selectionAfterDelete(
  transactions: readonly Transaction[],
  deleted: Transaction
): string | null {
  const rows = new Set(transactions.map((t) => t.row));
  if (rows.has(deleted.row - 1)) return `${deleted.accountId}:${deleted.row - 1}`;
  if (rows.has(deleted.row + 1)) return deleted.id;
  return null;
}
