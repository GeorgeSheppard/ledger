import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { paths } from '../../app/paths';
import { filtersFromParams } from '../../lib/transactions/filterParams';
import { useLedger } from '../../state/ledgerData';
import { Page } from '../../ui/Page';
import { AccountSwitcher } from './AccountSwitcher';
import { TransactionTable } from './TransactionTable';
import { useCashFlowExclusions } from './useAccountsData';

/**
 * `/transactions`: the transactions of every account in one list, with an Account column. It is
 * "All accounts" in the account switcher and what the accounts overview's Total row opens, and a
 * graph's "View transactions" opens it with that graph's dates, categories and accounts already
 * filtered; from there it filters, edits and deletes like an account's own list.
 */
export function TransactionsPage() {
  const { accounts, categories, transactionsByAccount } = useLedger();
  const navigate = useNavigate();
  const excluded = useCashFlowExclusions();
  const [params] = useSearchParams();
  const transactions = useMemo(
    () => accounts.flatMap((account) => transactionsByAccount[account.id] ?? []),
    [accounts, transactionsByAccount]
  );

  return (
    <Page
      title="All transactions"
      actions={
        <AccountSwitcher
          accounts={accounts}
          current={null}
          onSelect={(account) => navigate(paths.account(account.id))}
          onSelectAll={() => navigate(paths.transactions)}
        />
      }
    >
      <TransactionTable
        key={params.toString()}
        account={null}
        accounts={accounts}
        transactions={transactions}
        categories={categories}
        excluded={excluded}
        initialFilters={filtersFromParams(params)}
      />
    </Page>
  );
}
