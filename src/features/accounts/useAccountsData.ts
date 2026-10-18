import { useMemo } from 'react';
import type { Account, Category, Transaction, TransactionInput } from '../../lib/domain/types';
import { asMoney } from '../../lib/accounts/inverted';
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

/**
 * Every account with its transactions in money terms (an inverted account's signs flipped, see
 * `lib/accounts/inverted.ts`), for the accounts summary page. Always ready.
 */
export function useAccountOverview(): QueryState<AccountOverview[]> {
  const { accounts, transactionsByAccount } = useLedger();
  return useMemo(
    () => ({
      status: 'ready',
      data: accounts.map((account) => ({
        account,
        transactions: asMoney(account, transactionsByAccount[account.id] ?? NO_TRANSACTIONS),
      })),
    }),
    [accounts, transactionsByAccount]
  );
}

/**
 * Transactions of one account, oldest first. Always ready: the sheet is loaded up front.
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
    setAccountInverted: (accountId: number, inverted: boolean) =>
      mutate((r) => r.setAccountInverted(accountId, inverted)),
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
