import type { IsoDate, Transaction } from '../domain/types';
import { cashFlowByPeriod, type PeriodCashFlow } from './cashFlow';
import { isIsoDate } from './months';
import type { AccountLedger } from './netWorth';
import { previousPeriod, type Period } from './period';
import { excludedFromCashFlow } from './transfers';

/**
 * What the dashboard's summary graphs need for the one date range it is showing. Transfers are
 * still matched across every account, so money moved out of a chosen account into one that is not
 * chosen is not counted as spending. `ignoredCategories` (lower-cased names) are left out of income
 * and spending but still count towards balances.
 */

/**
 * How many months a saved dashboard widget covered, or all of them. Layouts saved before the
 * dashboard followed one date range still carry it; it is read and written back but not used.
 */
export type DashboardRange = number | 'all';

export interface CategorySpend {
  category: string;
  /** Net spend in the period (a positive number). */
  amount: number;
  /** Spend in the period of the same length just before. */
  previous: number;
}

/** A row without a readable date cannot be placed; leave it out rather than sinking the page. */
function dated(ledgers: readonly AccountLedger[]): AccountLedger[] {
  return ledgers.map((l) => ({
    account: l.account,
    transactions: l.transactions.filter((t) => isIsoDate(t.date)),
  }));
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Whether `date` is inside `period`. */
export function inPeriod(date: IsoDate, period: Period): boolean {
  return date >= period.from && date <= period.to;
}

/** Income and spending of the chosen accounts over `period` as one number each, and per category. */
export function periodCashFlow(
  allLedgers: readonly AccountLedger[],
  accountIds: readonly number[],
  period: Period,
  ignoredCategories?: ReadonlySet<string>
): PeriodCashFlow {
  const ledgers = dated(allLedgers);
  const excluded = excludedFromCashFlow(
    ledgers.flatMap((l) => l.transactions),
    ignoredCategories
  );
  const chosen: Transaction[] = ledgers
    .filter((l) => accountIds.includes(l.account.id))
    .flatMap((l) => l.transactions);
  return cashFlowByPeriod(
    chosen,
    ['period'],
    (d) => (inPeriod(d, period) ? 'period' : ''),
    excluded
  )[0]!;
}

/**
 * Spending per category over `period`, biggest first, with the period before it for comparison.
 * Categories that only had spend before are included with an amount of 0.
 */
export function categoryBreakdown(
  ledgers: readonly AccountLedger[],
  accountIds: readonly number[],
  period: Period,
  ignoredCategories?: ReadonlySet<string>
): CategorySpend[] {
  const now = periodCashFlow(ledgers, accountIds, period, ignoredCategories);
  const before = periodCashFlow(ledgers, accountIds, previousPeriod(period), ignoredCategories);
  const names = new Set([
    ...Object.keys(now.spendingByCategory),
    ...Object.keys(before.spendingByCategory),
  ]);
  return [...names]
    .map((category) => ({
      category,
      amount: round(now.spendingByCategory[category] ?? 0),
      previous: round(before.spendingByCategory[category] ?? 0),
    }))
    .sort(
      (a, b) =>
        b.amount - a.amount || b.previous - a.previous || a.category.localeCompare(b.category)
    );
}
