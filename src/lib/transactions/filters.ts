import type { IsoDate, Transaction } from '../domain/types';
import { roundCents } from './amount';
import { findDuplicateIds, transactionKey } from './duplicates';

/** Which direction of money a filter keeps. */
export type AmountSign = 'any' | 'in' | 'out';

export interface TransactionFilters {
  /** Matches the note or category, ignoring case. Every word has to match somewhere. */
  search: string;
  /** Keep only these categories. `''` stands for "no category". Empty keeps everything. */
  categories: readonly string[];
  /** Keep only these accounts (ids). Empty keeps everything; only matters where accounts are mixed. */
  accounts: readonly number[];
  from: IsoDate | null;
  to: IsoDate | null;
  sign: AmountSign;
  /** Size limits, compared against the amount without its sign (so 20 means 20 in or out). */
  min: number | null;
  max: number | null;
  /** Keep only amounts equal to this (without its sign). Wins over `min` and `max`. */
  exact: number | null;
  /** Keep only transactions that have a twin (same date, amount and note). */
  duplicatesOnly: boolean;
  /** Keep only twins of the transaction with this `transactionKey`. */
  twinsOf: string | null;
}

export const noFilters: TransactionFilters = {
  search: '',
  categories: [],
  accounts: [],
  from: null,
  to: null,
  sign: 'any',
  min: null,
  max: null,
  exact: null,
  duplicatesOnly: false,
  twinsOf: null,
};

export function hasFilters(filters: TransactionFilters): boolean {
  return countFilters(filters) > 0;
}

/** How many separate filters are switched on, for the badge on the Filters button. */
export function countFilters(f: TransactionFilters): number {
  return [
    f.search.trim() !== '',
    f.categories.length > 0,
    f.accounts.length > 0,
    f.from !== null || f.to !== null,
    f.sign !== 'any',
    f.exact !== null || f.min !== null || f.max !== null,
    f.duplicatesOnly || f.twinsOf !== null,
  ].filter(Boolean).length;
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters
): Transaction[] {
  const words = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
  const categories = new Set(filters.categories);
  const accounts = new Set(filters.accounts);
  const duplicates = filters.duplicatesOnly ? findDuplicateIds(transactions) : null;
  return transactions.filter((t) => {
    if (words.length > 0) {
      const text = `${t.note} ${t.category}`.toLowerCase();
      if (!words.every((w) => text.includes(w))) return false;
    }
    if (categories.size > 0 && !categories.has(t.category)) return false;
    if (accounts.size > 0 && !accounts.has(t.accountId)) return false;
    if (filters.from && t.date < filters.from) return false;
    if (filters.to && t.date > filters.to) return false;
    if (filters.sign === 'in' && t.amount <= 0) return false;
    if (filters.sign === 'out' && t.amount >= 0) return false;
    const size = Math.abs(t.amount);
    if (filters.exact !== null) {
      if (Math.round(size * 100) !== Math.round(filters.exact * 100)) return false;
    } else {
      if (filters.min !== null && size < filters.min) return false;
      if (filters.max !== null && size > filters.max) return false;
    }
    if (duplicates && !duplicates.has(t.id)) return false;
    if (filters.twinsOf !== null && transactionKey(t) !== filters.twinsOf) return false;
    return true;
  });
}

export type SortKey = 'date' | 'category' | 'note' | 'amount' | 'total';
export type SortDirection = 'asc' | 'desc';
export interface Sort {
  key: SortKey;
  direction: SortDirection;
}

/** Newest first: how the table opens. */
export const defaultSort: Sort = { key: 'date', direction: 'desc' };

/** Whether the table is in its default order, which is the only one grouped under month headings. */
export function isDefaultSort(sort: Sort): boolean {
  return sort.key === defaultSort.key && sort.direction === defaultSort.direction;
}

/**
 * What clicking a column heading does. A column cycles unsorted, ascending, descending, then back
 * to unsorted (`null`, the default order). Dates go ascending first since descending is the default.
 */
export function nextSort(sort: Sort | null, key: SortKey): Sort | null {
  if (!sort || sort.key !== key) {
    return { key, direction: key === 'amount' || key === 'total' ? 'desc' : 'asc' };
  }
  const first: SortDirection = key === 'amount' || key === 'total' ? 'desc' : 'asc';
  return sort.direction === first ? { key, direction: first === 'asc' ? 'desc' : 'asc' } : null;
}

/**
 * Sorts a copy. Ties fall back to the sheet order (later row first when sorting newest first), so
 * rows on the same day keep a stable, predictable order.
 */
export function sortTransactions(transactions: readonly Transaction[], sort: Sort): Transaction[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const compare = (a: Transaction, b: Transaction): number => {
    switch (sort.key) {
      case 'date':
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      case 'category':
        return a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
      case 'note':
        return a.note.localeCompare(b.note, undefined, { sensitivity: 'base' });
      case 'amount':
        return a.amount - b.amount;
      case 'total':
        return a.total - b.total;
    }
  };
  return [...transactions].sort((a, b) => sign * compare(a, b) || sign * (a.row - b.row));
}

export interface FilteredTotals {
  count: number;
  moneyIn: number;
  moneyOut: number;
}

export function totalsOf(transactions: readonly Transaction[]): FilteredTotals {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of transactions) {
    if (t.amount > 0) moneyIn += t.amount;
    else moneyOut += t.amount;
  }
  return {
    count: transactions.length,
    moneyIn: roundCents(moneyIn),
    moneyOut: roundCents(moneyOut),
  };
}

/** Categories present in the transactions (`''` for none), most used first. */
export function categoriesInUse(transactions: readonly Transaction[]): string[] {
  const counts = new Map<string, number>();
  for (const t of transactions) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
