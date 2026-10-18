import type { Transaction } from '../domain/types';

/**
 * Transactions that should not count as income or spending: money moved between the user's own
 * accounts, and opening balances. Both still count towards net worth.
 */

/** How far apart (in days) the two sides of a transfer may be dated. */
const TRANSFER_WINDOW_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Pairs each outgoing transaction with an incoming one of the same size in a different account,
 * dated within a few days. Each transaction is used in at most one pair; the closest date wins.
 * Returns the ids of every paired transaction.
 */
export function findTransfers(transactions: readonly Transaction[]): Set<string> {
  const incoming = new Map<number, Transaction[]>();
  for (const t of transactions) {
    if (t.amount <= 0) continue;
    const key = cents(t.amount);
    incoming.set(key, [...(incoming.get(key) ?? []), t]);
  }

  const paired = new Set<string>();
  const outgoing = transactions
    .filter((t) => t.amount < 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const out of outgoing) {
    const candidates = incoming.get(-cents(out.amount)) ?? [];
    let best: Transaction | undefined;
    let bestGap = Infinity;
    for (const into of candidates) {
      if (into.accountId === out.accountId || paired.has(into.id)) continue;
      const gap = Math.abs(dayNumber(into.date) - dayNumber(out.date));
      if (gap <= TRANSFER_WINDOW_DAYS && gap < bestGap) {
        best = into;
        bestGap = gap;
      }
    }
    if (best) {
      paired.add(out.id);
      paired.add(best.id);
    }
  }
  return paired;
}

/** An uncategorised first row whose note says "opening balance". */
export function isOpeningBalance(transaction: Transaction): boolean {
  return (
    transaction.row === 2 &&
    transaction.category === '' &&
    /opening balance/i.test(transaction.note)
  );
}

/** Ids of every transaction to leave out of income and spending. */
export function excludedFromCashFlow(transactions: readonly Transaction[]): Set<string> {
  const excluded = findTransfers(transactions);
  for (const t of transactions) if (isOpeningBalance(t)) excluded.add(t.id);
  return excluded;
}
