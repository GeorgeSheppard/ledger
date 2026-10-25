import { useCallback, useState } from 'react';
import type { Period } from '../../lib/metrics/period';
import {
  clearCategories as clearChosen,
  emptyHistory,
  goBack,
  selectPeriod,
  toggleCategory as toggleChosen,
} from '../../lib/metrics/viewHistory';

/**
 * The dashboard's date range and chosen categories, plus what they were before each change, so a
 * change of scale (a month picked from a year, a drag on the balances graph) or a category pick can
 * be undone with `back`. `initial` is the range shown until the first change.
 */
export function useViewHistory(initial: Period | null) {
  const [history, setHistory] = useState(emptyHistory);
  const select = useCallback(
    (next: Period) => setHistory((h) => selectPeriod(h, initial, next)),
    [initial]
  );
  const toggleCategory = useCallback(
    (category: string) => setHistory((h) => toggleChosen(h, initial, category)),
    [initial]
  );
  const clearCategories = useCallback(() => setHistory((h) => clearChosen(h, initial)), [initial]);
  const back = useCallback(() => setHistory(goBack), []);
  return {
    period: history.picked ?? initial,
    categories: history.categories,
    select,
    toggleCategory,
    clearCategories,
    back,
    canGoBack: history.past.length > 0,
  };
}
