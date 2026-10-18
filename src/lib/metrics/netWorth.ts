import type { Account, IsoDate, Transaction } from '../domain/types';
import { isIsoDate, monthEnd, monthOf, type MonthKey } from './months';

export interface AccountLedger {
  account: Account;
  transactions: Transaction[];
}

export interface PeriodNetWorth {
  /** Sum of every account's balance at the end of the period. */
  total: number;
  /** Balance per account id at the end of the period. */
  byAccount: Record<number, number>;
}

export interface NetWorthPoint extends PeriodNetWorth {
  month: MonthKey;
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Balance of one account at the end of each month. Computed from amounts by date rather than the
 * sheet's Total column, so it stays right when rows are not in date order.
 */
export function balanceByMonth(transactions: readonly Transaction[], months: MonthKey[]): number[] {
  return balanceAtEnds(transactions, months.map(monthEnd));
}

/** Balance of one account at the end of each of `ends` (ISO dates, in order). */
export function balanceAtEnds(transactions: readonly Transaction[], ends: IsoDate[]): number[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let i = 0;
  let balance = 0;
  return ends.map((end) => {
    for (let next = sorted[i]; next && next.date <= end; next = sorted[++i]) balance += next.amount;
    return round(balance);
  });
}

/** Net worth across all accounts at the end of each of `ends` (ISO dates, in order). */
export function netWorthAtEnds(
  ledgers: readonly AccountLedger[],
  ends: IsoDate[]
): PeriodNetWorth[] {
  const points = ends.map(() => ({ total: 0, byAccount: {} as Record<number, number> }));
  for (const { account, transactions } of ledgers) {
    balanceAtEnds(transactions, ends).forEach((balance, i) => {
      const point = points[i]!;
      point.byAccount[account.id] = balance;
      point.total = round(point.total + balance);
    });
  }
  return points;
}

/** Net worth across all accounts at the end of each month. */
export function netWorthByMonth(
  ledgers: readonly AccountLedger[],
  months: MonthKey[]
): NetWorthPoint[] {
  return netWorthAtEnds(ledgers, months.map(monthEnd)).map((point, i) => ({
    month: months[i]!,
    ...point,
  }));
}

/** The first and last month that any transaction falls in, or null when there are none. */
export function dataMonthRange(
  ledgers: readonly AccountLedger[]
): { first: MonthKey; last: MonthKey } | null {
  const dates = ledgers
    .flatMap((l) => l.transactions.map((t) => t.date))
    .filter(isIsoDate)
    .sort();
  const [first, last] = [dates[0], dates.at(-1)];
  return first && last ? { first: monthOf(first), last: monthOf(last) } : null;
}
