import type { Account } from '../domain/types';
import { monthlyCashFlow, spendingCategories, type MonthCashFlow } from './cashFlow';
import { addMonths, monthsBetween, type MonthKey } from './months';
import {
  dataMonthRange,
  netWorthByMonth,
  type AccountLedger,
  type NetWorthPoint,
} from './netWorth';
import { excludedFromCashFlow } from './transfers';

/**
 * Everything the dashboard shows, computed in one pass from every account's transactions. The
 * window ends at the latest month with data (not today), so a sheet that has not been updated for
 * a while still shows its last full picture.
 */

/** How many months the dashboard covers, ending at the latest month with data. */
export type DashboardRange = number | 'all';

export interface AccountSummary {
  account: Account;
  balance: number;
  /** Change in balance over the latest month. */
  change: number;
}

export interface CategorySpend {
  category: string;
  amount: number;
  /** Spend in the month before. */
  previous: number;
  /** Mean monthly spend across the range. */
  average: number;
}

export interface Dashboard {
  months: MonthKey[];
  netWorth: NetWorthPoint[];
  cashFlow: MonthCashFlow[];
  /** Cash flow for the month before the range, or null if the data starts inside the range. */
  previousCashFlow: MonthCashFlow | null;
  /** Categories with spending in the range, biggest total first. */
  categories: string[];
  accounts: AccountSummary[];
  latest: {
    month: MonthKey;
    netWorth: number;
    /** Change over the latest month. */
    netWorthChange: number;
    income: number;
    spending: number;
    /** Spending in the month before the latest, or null if there is no data that far back. */
    previousSpending: number | null;
    /** Share of income kept in the latest month (net / income), or null without income. */
    savingsRate: number | null;
    /** Mean monthly spending across the range. */
    averageSpending: number;
  };
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Returns null when there are no transactions at all. */
export function buildDashboard(
  ledgers: readonly AccountLedger[],
  range: DashboardRange
): Dashboard | null {
  const span = dataMonthRange(ledgers);
  if (!span) return null;

  const start =
    range === 'all' || addMonths(span.last, 1 - range) < span.first
      ? span.first
      : addMonths(span.last, 1 - range);
  // One extra month before the range so the first month has something to compare with. That makes
  // every series below at least two long, so the non-null assertions on them are safe.
  const withPrevious = monthsBetween(addMonths(start, -1), span.last);
  const months = withPrevious.slice(1);
  const hasPrevious = start > span.first;

  const all = ledgers.flatMap((l) => l.transactions);
  const flowsWithPrevious = monthlyCashFlow(all, withPrevious, excludedFromCashFlow(all));
  const worthWithPrevious = netWorthByMonth(ledgers, withPrevious);
  const cashFlow = flowsWithPrevious.slice(1);
  const netWorth = worthWithPrevious.slice(1);

  const latestFlow = flowsWithPrevious.at(-1)!;
  const priorFlow = flowsWithPrevious.at(-2)!;
  const latestWorth = worthWithPrevious.at(-1)!;
  const priorWorth = worthWithPrevious.at(-2)!;
  const previousSpending = months.length > 1 || hasPrevious ? priorFlow.spending : null;
  const balance = (point: NetWorthPoint, account: Account) => point.byAccount[account.id] ?? 0;

  return {
    months,
    netWorth,
    cashFlow,
    previousCashFlow: hasPrevious ? flowsWithPrevious[0]! : null,
    categories: spendingCategories(cashFlow),
    accounts: ledgers.map(({ account }) => ({
      account,
      balance: balance(latestWorth, account),
      change: round(balance(latestWorth, account) - balance(priorWorth, account)),
    })),
    latest: {
      month: latestFlow.month,
      netWorth: latestWorth.total,
      netWorthChange: round(latestWorth.total - priorWorth.total),
      income: latestFlow.income,
      spending: latestFlow.spending,
      previousSpending,
      savingsRate: latestFlow.income > 0 ? latestFlow.net / latestFlow.income : null,
      averageSpending: round(cashFlow.reduce((sum, f) => sum + f.spending, 0) / cashFlow.length),
    },
  };
}

/**
 * Spending per category in `month`, biggest first, with the month before and the range average for
 * comparison. Categories that only had spend in other months are included with an amount of 0.
 */
export function categoryBreakdown(dashboard: Dashboard, month: MonthKey): CategorySpend[] {
  const index = dashboard.months.indexOf(month);
  const flow = dashboard.cashFlow[index];
  if (!flow) return [];
  const before = index > 0 ? dashboard.cashFlow[index - 1] : dashboard.previousCashFlow;
  const count = dashboard.cashFlow.length;
  return dashboard.categories
    .map((category) => ({
      category,
      amount: flow.spendingByCategory[category] ?? 0,
      previous: before?.spendingByCategory[category] ?? 0,
      average: round(
        dashboard.cashFlow.reduce((sum, f) => sum + (f.spendingByCategory[category] ?? 0), 0) /
          count
      ),
    }))
    .sort((a, b) => b.amount - a.amount || b.average - a.average);
}
