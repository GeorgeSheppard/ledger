import type { Account, Transaction } from '../domain/types';
import { roundCents } from './amount';
import type { FilteredTotals } from './filters';

/** What one row contributes to money in or out: signed as the user's money, 0 if excluded. */
export function moneyOfRow(
  transaction: Transaction,
  accounts: readonly Account[],
  excluded: ReadonlySet<string> = new Set()
): number {
  if (excluded.has(transaction.id)) return 0;
  const inverted = accounts.some((a) => a.id === transaction.accountId && a.inverted);
  return inverted ? -transaction.amount : transaction.amount;
}

export interface CashFlowTotals extends FilteredTotals {
  /** Rows left out of the money totals: transfers, opening balances and ignored categories. */
  leftOut: number;
}

/**
 * Money in and out of `transactions` as the user's money sees it: an inverted account (credit card,
 * loan) has its signs flipped, and rows in `excluded` (see `excludedFromCashFlow`) are left out, so
 * moving money between accounts or paying off a card does not count as earning or spending.
 * `count` is every row given; `leftOut` how many of them were skipped.
 */
export function cashFlowTotals(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  excluded: ReadonlySet<string> = new Set()
): CashFlowTotals {
  let moneyIn = 0;
  let moneyOut = 0;
  let leftOut = 0;
  for (const t of transactions) {
    if (excluded.has(t.id)) leftOut++;
    const amount = moneyOfRow(t, accounts, excluded);
    if (amount > 0) moneyIn += amount;
    else moneyOut += amount;
  }
  return {
    count: transactions.length,
    moneyIn: roundCents(moneyIn),
    moneyOut: roundCents(moneyOut),
    leftOut,
  };
}
