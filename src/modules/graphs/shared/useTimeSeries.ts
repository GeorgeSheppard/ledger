import { useMemo } from 'react';
import { buildTimeSeries, type TimeSeries } from '../../../lib/metrics/timeSeries';
import type { GraphViewProps } from '../types';

/** The widget's data at any level of detail, ready for a zoomable chart. Null without data. */
export function useTimeSeries({
  dashboard,
  ledgers,
  accountIds,
  ignoredCategories,
}: Pick<
  GraphViewProps,
  'dashboard' | 'ledgers' | 'accountIds' | 'ignoredCategories'
>): TimeSeries | null {
  const first = dashboard?.months[0];
  const last = dashboard?.months.at(-1);
  return useMemo(
    () =>
      first && last ? buildTimeSeries(ledgers, accountIds, first, last, ignoredCategories) : null,
    [ledgers, accountIds, first, last, ignoredCategories]
  );
}
