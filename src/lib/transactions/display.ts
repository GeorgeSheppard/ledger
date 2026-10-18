import type { IsoDate, Transaction } from '../domain/types';
import { roundCents } from './amount';
import { monthKey } from './dates';

/**
 * How an account's transactions are presented: newest date first, whichever way round the sheet
 * keeps them. Rows on the same day keep their sheet order reversed, so the later row comes first.
 */
export function displayOrder(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) =>
    a.date === b.date ? b.row - a.row : a.date < b.date ? 1 : -1
  );
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
  /** Date of the newest transaction, or null when there are none. */
  lastDate: IsoDate | null;
}

export function summarizeAccount(
  transactions: readonly Transaction[],
  today: IsoDate
): AccountSummary {
  const month = monthKey(today);
  let monthIn = 0;
  let monthOut = 0;
  let last: Transaction | undefined;
  let lastDate: IsoDate | null = null;
  for (const t of transactions) {
    if (!last || t.row > last.row) last = t;
    if (!lastDate || t.date > lastDate) lastDate = t.date;
    if (monthKey(t.date) !== month) continue;
    if (t.amount > 0) monthIn += t.amount;
    else monthOut += t.amount;
  }
  return {
    balance: last?.total ?? 0,
    monthIn: roundCents(monthIn),
    monthOut: roundCents(monthOut),
    count: transactions.length,
    lastDate,
  };
}

/**
 * The id to select after deleting `deleted`: the transaction shown below it (or above it, at the
 * end of the list). Rows below the deleted one in the sheet move up one, so their ids shift.
 */
export function selectionAfterDelete(
  transactions: readonly Transaction[],
  deleted: Transaction
): string | null {
  const ordered = displayOrder(transactions);
  const index = ordered.findIndex((t) => t.id === deleted.id);
  const next = ordered[index + 1] ?? ordered[index - 1];
  if (index === -1 || !next) return null;
  const row = next.row > deleted.row ? next.row - 1 : next.row;
  return `${next.accountId}:${row}`;
}

/** One line of the transactions list: a month heading or a transaction. */
export type ListItem =
  | { kind: 'month'; key: string; moneyIn: number; moneyOut: number }
  | { kind: 'row'; transaction: Transaction };

/** Month headings followed by their rows, flattened so the list can be windowed. */
export function flattenGroups(groups: readonly MonthGroup[]): ListItem[] {
  const items: ListItem[] = [];
  for (const group of groups) {
    items.push({ kind: 'month', key: group.key, moneyIn: group.moneyIn, moneyOut: group.moneyOut });
    for (const transaction of group.transactions) items.push({ kind: 'row', transaction });
  }
  return items;
}
