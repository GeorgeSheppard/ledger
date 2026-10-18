import { useMemo } from 'react';
import { UNCATEGORISED } from '../../../lib/metrics/cashFlow';
import type { AccountLedger } from '../../../lib/metrics/netWorth';
import type { LinkedFilters } from '../../../lib/transactions/filterParams';
import { filterTransactions, noFilters } from '../../../lib/transactions/filters';
import { ActionButton } from '../../../ui/ActionButton';
import { Menu } from '../../../ui/Menu';

interface ViewTransactionsProps {
  ledgers: AccountLedger[];
  /** The accounts the graph covers. */
  accountIds: number[];
  /** What the graph is showing: its dates, and the categories it was narrowed to (empty for all). */
  from: string;
  to: string;
  categories?: readonly string[];
  open(accountId: number, filters: LinkedFilters): void;
}

/**
 * "View transactions": opens the transactions behind a graph, narrowed to the same dates and
 * categories. Accounts are separate pages, so a graph over several accounts offers a menu of the
 * accounts that have matching transactions.
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
    () => ({ from, to, categories: categories.map((c) => (c === UNCATEGORISED ? '' : c)) }),
    [from, to, categories]
  );
  const matches = useMemo(
    () =>
      ledgers
        .filter((l) => accountIds.includes(l.account.id))
        .map((l) => ({
          account: l.account,
          count: filterTransactions(l.transactions, { ...noFilters, ...filters }).length,
        })),
    [ledgers, accountIds, filters]
  );
  const only = matches.length === 1 ? matches[0] : undefined;

  if (only)
    return (
      <ActionButton
        variant="ghost"
        disabled={only.count === 0}
        onAction={() => open(only.account.id, filters)}
      >
        View transactions
      </ActionButton>
    );
  return (
    <Menu
      label="View transactions in an account"
      buttonClassName="size-auto gap-1 border border-transparent px-2 py-1 text-sm text-fg md:px-2.5"
      items={matches.map(({ account, count }) => ({
        label: `${account.name} (${count.toLocaleString()})`,
        disabled: count === 0,
        onSelect: () => open(account.id, filters),
      }))}
    >
      View transactions ▾
    </Menu>
  );
}
