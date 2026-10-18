import type { Account } from '../domain/types';
import type { AccountSummary } from '../transactions/display';

/** How the accounts overview can be ordered. */
export type AccountSortKey = 'name' | 'lastActivity' | 'balance' | 'count';
export type AccountSortDirection = 'asc' | 'desc';
export interface AccountSort {
  key: AccountSortKey;
  direction: AccountSortDirection;
}

export interface AccountRow {
  account: Account;
  summary: AccountSummary;
}

export const ACCOUNT_SORT_LABELS: Record<AccountSortKey, string> = {
  name: 'Account',
  lastActivity: 'Last activity',
  balance: 'Balance',
  count: 'Transactions',
};

/**
 * What clicking a heading does: sort by it (names A to Z, numbers and dates largest first), or flip.
 * `null` is the sheet's own tab order, which is how the overview opens.
 */
export function nextAccountSort(sort: AccountSort | null, key: AccountSortKey): AccountSort {
  if (!sort || sort.key !== key) return { key, direction: key === 'name' ? 'asc' : 'desc' };
  return { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
}

/**
 * Sorts a copy. Accounts with no transactions have no last activity and always go last, whichever
 * way round the dates are. Ties keep the sheet's tab order (by id).
 */
export function sortAccountRows(rows: readonly AccountRow[], sort: AccountSort): AccountRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const byName = (a: AccountRow, b: AccountRow) =>
    a.account.name.localeCompare(b.account.name, undefined, { sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    if (sort.key === 'lastActivity') {
      const x = a.summary.lastDate;
      const y = b.summary.lastDate;
      if (x === null || y === null) {
        if (x !== y) return x === null ? 1 : -1;
      } else if (x !== y) return sign * (x < y ? -1 : 1);
    } else if (sort.key === 'name') {
      const c = byName(a, b);
      if (c !== 0) return sign * c;
    } else {
      const x = sort.key === 'balance' ? a.summary.balance : a.summary.count;
      const y = sort.key === 'balance' ? b.summary.balance : b.summary.count;
      if (x !== y) return sign * (x - y);
    }
    return a.account.id - b.account.id;
  });
}
