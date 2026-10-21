import { useMemo } from 'react';
import { isoDateOf } from '../../../lib/metrics/buckets';
import { dataMonthRange } from '../../../lib/metrics/netWorth';
import { buildTimeSeries, type TimeSeries } from '../../../lib/metrics/timeSeries';
import type { IsoDate } from '../../../lib/domain/types';
import type { MonthKey } from '../../../lib/metrics/months';
import type { GraphViewProps } from '../types';

/** A series over all the data of the chosen accounts, whose first window starts at `windowFirst`. */
export function seriesFor(
  ledgers: GraphViewProps['ledgers'],
  accountIds: number[],
  windowFirst: MonthKey,
  ignoredCategories: ReadonlySet<string>,
  today: IsoDate = isoDateOf(Date.now())
): TimeSeries | null {
  const chosen = ledgers.filter((l) => accountIds.includes(l.account.id));
  const span = dataMonthRange(chosen, today);
  if (!span) return null;
  return buildTimeSeries(
    ledgers,
    accountIds,
    span.first,
    span.last,
    ignoredCategories,
    windowFirst
  );
}

/**
 * The widget's data at any level of detail, ready for a zoomable chart. Null without data. It spans
 * all the data so the chart can pan anywhere; the widget's range only sets the window shown first.
 */
export function useTimeSeries({
  dashboard,
  ledgers,
  accountIds,
  ignoredCategories,
}: Pick<
  GraphViewProps,
  'dashboard' | 'ledgers' | 'accountIds' | 'ignoredCategories'
>): TimeSeries | null {
  const windowFirst = dashboard?.months[0];
  return useMemo(
    () => (windowFirst ? seriesFor(ledgers, accountIds, windowFirst, ignoredCategories) : null),
    [ledgers, accountIds, windowFirst, ignoredCategories]
  );
}
