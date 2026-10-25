import { useCallback } from 'react';
import { samePeriod, type Period } from '../../lib/metrics/period';
import { useHistory, useUndoableState } from '../../state/history';
import { formatDay } from '../../lib/transactions/dates';

const SCOPE = 'dashboard';

/**
 * The dashboard's date range, chosen categories and switched-off accounts. Each change is recorded
 * in the app's undo history (Ctrl+Z), so a month picked from a year, a drag on the balances graph
 * or a category pick can be taken back. `initial` is the range shown until the first change.
 */
export function useViewHistory(initial: Period | null) {
  const history = useHistory();
  const [picked, setPicked] = useUndoableState<Period | null>(null, SCOPE);
  const [categories, setCategories] = useUndoableState<string[]>([], SCOPE);
  const [hiddenAccounts, setHiddenAccounts] = useUndoableState<number[]>([], SCOPE);
  const period = picked ?? initial;

  const select = useCallback(
    (next: Period) => {
      if (period && samePeriod(period, next)) return;
      setPicked(next, `Change dates to ${formatDay(next.from)} – ${formatDay(next.to)}`);
    },
    [period, setPicked]
  );
  const toggleCategory = useCallback(
    (category: string) =>
      categories.includes(category)
        ? setCategories(
            categories.filter((c) => c !== category),
            `Stop filtering by ${category}`
          )
        : setCategories([...categories, category], `Filter by ${category}`),
    [categories, setCategories]
  );
  const toggleAccount = useCallback(
    (id: number) =>
      setHiddenAccounts(
        hiddenAccounts.includes(id)
          ? hiddenAccounts.filter((h) => h !== id)
          : [...hiddenAccounts, id],
        'Show or hide an account'
      ),
    [hiddenAccounts, setHiddenAccounts]
  );
  /** Shows exactly the accounts in `shown`, out of `all`. */
  const setAccounts = useCallback(
    (all: number[], shown: number[]) =>
      setHiddenAccounts(
        all.filter((id) => !shown.includes(id)),
        'Show or hide accounts'
      ),
    [setHiddenAccounts]
  );
  const clearFilters = useCallback(
    () =>
      history.batch('Clear filters', () => {
        setHiddenAccounts([], 'Show every account');
        setCategories([], 'Clear categories');
      }),
    [history, setHiddenAccounts, setCategories]
  );
  return {
    period,
    categories,
    hiddenAccounts,
    select,
    toggleCategory,
    toggleAccount,
    setAccounts,
    clearFilters,
  };
}
