import { useMemo } from 'react';
import { UNCATEGORISED } from '../../../lib/metrics/cashFlow';
import type { AccountLedger } from '../../../lib/metrics/netWorth';
import type { LinkedFilters } from '../../../lib/transactions/filterParams';
import { filterTransactions, noFilters } from '../../../lib/transactions/filters';
import { ActionButton } from '../../../ui/ActionButton';

interface ViewTransactionsProps {
  ledgers: AccountLedger[];
  /** The accounts the graph covers. */
  accountIds: number[];
  /** What the graph is showing: its dates, and the categories it was narrowed to (empty for all). */
  from: string;
  to: string;
  categories?: readonly string[];
  open(filters: LinkedFilters): void;
}

/**
 * "View transactions": opens every transaction behind a graph in one list, across the accounts it
 * covers and narrowed to the same dates and categories. Further filtering happens in that list.
 */
export function ViewTransactions({
  ledgers,
  accountIds,
  from,
  to,
  categories = [],
  open,
}: ViewTransactionsProps) {
  const filters = useMemo<LinkedFilters>(
    () => ({
      from,
      to,
      categories: categories.map((c) => (c === UNCATEGORISED ? '' : c)),
      accounts: accountIds,
    }),
    [from, to, categories, accountIds]
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
    <ActionButton variant="ghost" disabled={count === 0} onAction={() => open(filters)}>
      View transactions
    </ActionButton>
  );
}
