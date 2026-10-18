import { useCallback } from 'react';
import type { LedgerRepository } from '../../lib/data/repository';
import type { Account, Category, Transaction, TransactionInput } from '../../lib/domain/types';
import { useLedgerMutation, useLedgerQuery, type QueryState } from '../../state/ledgerData';

const loadAccountsAndCategories = async (repository: LedgerRepository) => {
  const [accounts, categories] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
  ]);
  return { accounts, categories };
};

/** Every account (tab) and the category list. */
export function useAccountsAndCategories(): QueryState<{
  accounts: Account[];
  categories: Category[];
}> {
  return useLedgerQuery(loadAccountsAndCategories);
}

/**
 * Transactions of one account. While a different account's rows are still on screen after
 * switching, this reports `loading` so stale rows never show under the wrong account.
 */
export function useTransactions(accountId: number | undefined): QueryState<Transaction[]> {
  const load = useCallback(
    async (repository: LedgerRepository) => ({
      accountId,
      transactions: accountId === undefined ? [] : await repository.listTransactions(accountId),
    }),
    [accountId]
  );
  const state = useLedgerQuery(load);
  if (state.status !== 'ready') return state;
  if (state.data.accountId !== accountId) return { status: 'loading' };
  return { status: 'ready', data: state.data.transactions };
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
