import {
  bucketKeyOf,
  bucketsBetween,
  dayStart,
  DAY_MS,
  type Bucket,
  type Granularity,
} from './buckets';
import { cashFlowByPeriod, UNCATEGORISED, type PeriodCashFlow } from './cashFlow';
import { inPeriod } from './dashboard';
import { isIsoDate } from './months';
import { netWorthAtEnds, type AccountLedger, type PeriodNetWorth } from './netWorth';
import type { Period } from './period';
import { excludedFromCashFlow } from './transfers';

/**
 * The dashboard's numbers for one period at any level of detail, for the graphs: income and
 * spending, and the balance of every chosen account. Cut into months, weeks or days on request; each
 * cut is worked out the first time it is asked for. Buckets at the edges may stick out of the
 * period, but only transactions inside it are counted.
 */
export interface TimeSeries {
  /** Start of the period's first day, in ms (midnight UTC). */
  startMs: number;
  /** Midnight after the period's last day, in ms. */
  endMs: number;
  buckets(granularity: Granularity): Bucket[];
  /** Income and spending, limited to the chosen categories when there are any. */
  cashFlow(granularity: Granularity): PeriodCashFlow[];
  /** Balances at the end of each bucket. Not narrowed by category: a balance has no category. */
  netWorth(granularity: Granularity): PeriodNetWorth[];
}

export function buildTimeSeries(
  allLedgers: readonly AccountLedger[],
  accountIds: readonly number[],
  { from: first, to: last }: Period,
  ignoredCategories?: ReadonlySet<string>,
  categories: readonly string[] = []
): TimeSeries {
  // Same as the dashboard: rows without a readable date cannot be placed, so they are left out.
  const dated = allLedgers.map((l) => ({
    account: l.account,
    transactions: l.transactions.filter((t) => isIsoDate(t.date)),
  }));
  const ledgers = dated.filter((l) => accountIds.includes(l.account.id));
  const transactions = ledgers
    .flatMap((l) => l.transactions)
    .filter(
      (t) =>
        inPeriod(t.date, { from: first, to: last }) &&
        (!categories.length || categories.includes(t.category || UNCATEGORISED))
    );
  const excluded = excludedFromCashFlow(
    dated.flatMap((l) => l.transactions),
    ignoredCategories
  );

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
        // A balance is as of the end of the period, even when its last bucket carries on past it.
        buckets(g).map((b) => (b.end > last ? last : b.end))
      )
    ),
  };
}
