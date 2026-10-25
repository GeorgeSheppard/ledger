import { useCallback, useState } from 'react';
import type { Period } from '../../lib/metrics/period';
import { emptyHistory, goBack, selectPeriod } from '../../lib/metrics/periodHistory';

/**
 * The dashboard's date range plus the ranges it came from, so a change of scale (a month picked
 * from a year, a drag on the balances graph) can be undone with `back` without touching filters.
 * `initial` is the range shown until the first change.
 */
export function usePeriodHistory(initial: Period | null) {
  const [history, setHistory] = useState(emptyHistory);
  const select = useCallback(
    (next: Period) => setHistory((h) => selectPeriod(h, initial, next)),
    [initial]
  );
  const back = useCallback(() => setHistory(goBack), []);
  return {
    period: history.picked ?? initial,
    select,
    back,
    canGoBack: history.past.length > 0,
  };
}
