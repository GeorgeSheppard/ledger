import { useMemo } from 'react';
import { UNCATEGORISED } from '../../lib/metrics/cashFlow';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import type { Period } from '../../lib/metrics/period';
import { formatDay } from '../../lib/transactions/dates';
import type { LinkedFilters } from '../../lib/transactions/filterParams';
import { filterTransactions, noFilters } from '../../lib/transactions/filters';
import { ActionButton } from '../../ui/ActionButton';

interface ViewTransactionsProps {
  ledgers: AccountLedger[];
  period: Period;
  /** Accounts switched on. */
  accountIds: number[];
  /** Categories the dashboard is filtered to; empty for all. */
  categories: string[];
  open(filters: LinkedFilters): void;
}

/** What the current view covers, in words: its dates, accounts and categories. */
export function describeView(
  period: Period,
  accountCount: number,
  accountsShown: number,
  categories: readonly string[]
): string {
  const dates = `${formatDay(period.from)} ${period.from.slice(0, 4)} to ${formatDay(period.to)} ${period.to.slice(0, 4)}`;
  const accounts =
    accountsShown === accountCount
      ? 'all accounts'
      : `${accountsShown} of ${accountCount} accounts`;
  const chosen = categories.length ? categories.join(', ') : 'all categories';
  return `${dates} · ${accounts} · ${chosen}`;
}

/**
 * Opens every transaction behind the dashboard as it is now (its dates, switched-on accounts and
 * chosen categories) in the transactions list, where they can be filtered further.
 */
export function ViewTransactions({
  ledgers,
  period,
  accountIds,
  categories,
  open,
}: ViewTransactionsProps) {
  const filters = useMemo<LinkedFilters>(
    () => ({
      from: period.from,
      to: period.to,
      categories: categories.map((c) => (c === UNCATEGORISED ? '' : c)),
      // Covering every account is the same as not filtering by account.
      accounts: accountIds.length === ledgers.length ? [] : accountIds,
      sign: 'any',
    }),
    [period, categories, accountIds, ledgers.length]
  );
  const count = useMemo(
    () =>
      ledgers
        .filter((l) => accountIds.includes(l.account.id))
        .reduce(
          (sum, l) =>
            sum +
            filterTransactions(l.transactions, { ...noFilters, ...filters, accounts: [] }).length,
          0
        ),
    [ledgers, accountIds, filters]
  );

  return (
    <ActionButton
      shortcut="dashboard.viewTransactions"
      variant="primary"
      disabled={count === 0}
      onAction={() => open(filters)}
    >
      {`View ${count} transaction${count === 1 ? '' : 's'} in this view`}
    </ActionButton>
  );
}
