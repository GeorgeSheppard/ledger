import {
  bucketKeyOf,
  bucketsBetween,
  dayStart,
  DAY_MS,
  type Bucket,
  type Granularity,
} from './buckets';
import { cashFlowByPeriod, type PeriodCashFlow } from './cashFlow';
import { monthEnd, isIsoDate, type MonthKey } from './months';
import { netWorthAtEnds, type AccountLedger, type PeriodNetWorth } from './netWorth';
import { excludedFromCashFlow } from './transfers';

/**
 * The dashboard's numbers at any level of detail, for the zoomable graphs. It covers the same months
 * as `buildDashboard` and answers the same questions (income, spending, balances), but cut into
 * weeks or days on request. Each cut is worked out the first time it is asked for.
 */
export interface TimeSeries {
  /** Start of the first month, in ms (midnight UTC). */
  startMs: number;
  /** Midnight after the last day of the last month, in ms. */
  endMs: number;
  buckets(granularity: Granularity): Bucket[];
  cashFlow(granularity: Granularity): PeriodCashFlow[];
  netWorth(granularity: Granularity): PeriodNetWorth[];
}

export function buildTimeSeries(
  allLedgers: readonly AccountLedger[],
  accountIds: readonly number[],
  firstMonth: MonthKey,
  lastMonth: MonthKey,
  ignoredCategories?: ReadonlySet<string>
): TimeSeries {
  // Same as the dashboard: rows without a readable date cannot be placed, so they are left out.
  const dated = allLedgers.map((l) => ({
    account: l.account,
    transactions: l.transactions.filter((t) => isIsoDate(t.date)),
  }));
  const ledgers = dated.filter((l) => accountIds.includes(l.account.id));
  const transactions = ledgers.flatMap((l) => l.transactions);
  const excluded = excludedFromCashFlow(
    dated.flatMap((l) => l.transactions),
    ignoredCategories
  );
  const first = `${firstMonth}-01`;
  const last = monthEnd(lastMonth);

  const cache = <T>(compute: (granularity: Granularity) => T) => {
    const done = new Map<Granularity, T>();
    return (granularity: Granularity) => {
      if (!done.has(granularity)) done.set(granularity, compute(granularity));
      return done.get(granularity)!;
    };
  };
  const buckets = cache((g) => bucketsBetween(first, last, g));
  return {
    startMs: dayStart(first),
    endMs: dayStart(last) + DAY_MS,
    buckets,
    cashFlow: cache((g) =>
      cashFlowByPeriod(
        transactions,
        buckets(g).map((b) => b.key),
        (date) => bucketKeyOf(date, g),
        excluded
      )
    ),
    netWorth: cache((g) =>
      netWorthAtEnds(
        ledgers,
        buckets(g).map((b) => b.end)
      )
    ),
  };
}
