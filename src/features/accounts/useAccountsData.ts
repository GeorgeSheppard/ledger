import { useMemo } from 'react';
import type { Account, Category, Transaction, TransactionInput } from '../../lib/domain/types';
import { useLedger, useLedgerMutation, type QueryState } from '../../state/ledgerData';

const NO_TRANSACTIONS: Transaction[] = [];

/** Every account (tab) and the category list. Always ready: the sheet is loaded up front. */
export function useAccountsAndCategories(): QueryState<{
  accounts: Account[];
  categories: Category[];
}> {
  const { accounts, categories } = useLedger();
  return useMemo(
    () => ({ status: 'ready', data: { accounts, categories } }),
    [accounts, categories]
  );
}

export interface AccountOverview {
  account: Account;
  transactions: Transaction[];
}

const loadOverview = async (repository: LedgerRepository): Promise<AccountOverview[]> => {
  const accounts = await repository.listAccounts();
  return Promise.all(
    accounts.map(async (account) => ({
      account,
      transactions: await repository.listTransactions(account.id),
    }))
  );
};

/** Every account with its transactions, for the accounts summary page. */
export function useAccountOverview(): QueryState<AccountOverview[]> {
  return useLedgerQuery(loadOverview);
}

/**
 * Transactions of one account. While a different account's rows are still on screen after
 * switching, this reports `loading` so stale rows never show under the wrong account.
 */
export function useTransactions(accountId: number | undefined): QueryState<Transaction[]> {
  const { transactionsByAccount } = useLedger();
  const transactions =
    (accountId === undefined ? undefined : transactionsByAccount[accountId]) ?? NO_TRANSACTIONS;
  return useMemo(() => ({ status: 'ready', data: transactions }), [transactions]);
}

/** The writes the accounts page performs. Each refreshes every query once it finishes. */
export function useAccountActions() {
  const mutate = useLedgerMutation();
  return {
    createAccount: (name: string) => mutate((r) => r.createAccount(name.trim())),
    renameAccount: (accountId: number, name: string) =>
      mutate((r) => r.renameAccount(accountId, name.trim())),
    addTransaction: async (accountId: number, input: TransactionInput) => {
      const [added] = await mutate((r) => r.addTransactions(accountId, [input]));
      return added;
    },
    updateTransaction: (accountId: number, row: number, input: TransactionInput) =>
      mutate((r) => r.updateTransaction(accountId, row, input)),
    deleteTransaction: (accountId: number, row: number) =>
      mutate((r) => r.deleteTransaction(accountId, row)),
    saveCategories: (categories: Category[]) => mutate((r) => r.saveCategories(categories)),
  };
}
