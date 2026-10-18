import type { Account } from '../domain/types';
import { monthlyCashFlow, spendingCategories, type MonthCashFlow } from './cashFlow';
import { addMonths, isIsoDate, monthOf, monthsBetween, type MonthKey } from './months';
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
  /** Transactions dated after the last month shown (future-dated rows), left out of every number. */
  laterTransactions: number;
  /** Whether any month shown has income or spending. False means the range holds only balances. */
  hasActivity: boolean;
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

/** The current month, `YYYY-MM`, in local time. */
export function currentMonth(now: Date = new Date()): MonthKey {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Returns null when there are no dated transactions in the chosen accounts. The window ends at the
 * latest month with data that is not after `thisMonth`: one future-dated or mistyped row (a
 * scheduled payment, a year typo) would otherwise push the window past all the real data and leave
 * every graph empty. If all the data is in the future the window ends at its latest month instead.
 * `accountIds` limits
 * the dashboard to some accounts (all when omitted). Transfers are still matched across every
 * account, so money moved out of a chosen account into one that is not chosen is not counted as
 * spending.
 */
export function buildDashboard(
  allLedgers: readonly AccountLedger[],
  range: DashboardRange,
  accountIds?: readonly number[],
  thisMonth: MonthKey = currentMonth()
): Dashboard | null {
  // A row without a readable date cannot be placed in a month. Leave it out rather than letting it
  // sink the whole dashboard.
  const dated = allLedgers.map((l) => ({
    account: l.account,
    transactions: l.transactions.filter((t) => isIsoDate(t.date)),
  }));
  const ledgers = accountIds ? dated.filter((l) => accountIds.includes(l.account.id)) : dated;
  const dataSpan = dataMonthRange(ledgers);
  if (!dataSpan) return null;
  // The latest month with data that is not in the future; the sheet may not have this month yet.
  const pastMonths = ledgers.flatMap((l) =>
    l.transactions.map((t) => monthOf(t.date)).filter((m) => m <= thisMonth)
  );
  const span = {
    first: dataSpan.first,
    last: pastMonths.length ? pastMonths.reduce((a, b) => (a > b ? a : b)) : dataSpan.last,
  };
  const laterTransactions = ledgers.reduce(
    (sum, l) => sum + l.transactions.filter((t) => monthOf(t.date) > span.last).length,
    0
  );

  const start =
    range === 'all' || addMonths(span.last, 1 - range) < span.first
      ? span.first
      : addMonths(span.last, 1 - range);
  // One extra month before the range so the first month has something to compare with. That makes
  // every series below at least two long, so the non-null assertions on them are safe.
  const withPrevious = monthsBetween(addMonths(start, -1), span.last);
  const months = withPrevious.slice(1);
  const hasPrevious = start > span.first;

  const excluded = excludedFromCashFlow(dated.flatMap((l) => l.transactions));
  const all = ledgers.flatMap((l) => l.transactions);
  const flowsWithPrevious = monthlyCashFlow(all, withPrevious, excluded);
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
    laterTransactions,
    hasActivity: cashFlow.some((f) => f.income > 0 || f.spending > 0),
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
