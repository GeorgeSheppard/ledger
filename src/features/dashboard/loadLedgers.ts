import { useMemo } from 'react';
import type { Category } from '../../lib/domain/types';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import { useLedger, type QueryState } from '../../state/ledgerData';

export interface DashboardData {
  ledgers: AccountLedger[];
  categories: Category[];
}

/** Everything the dashboard needs. Always ready: the sheet is loaded up front. */
export function useDashboardData(): QueryState<DashboardData> {
  const { accounts, transactionsByAccount, categories } = useLedger();
  return useMemo(() => {
    const ledgers = accounts.map((account) => ({
      account,
      transactions: transactionsByAccount[account.id] ?? [],
    }));
    return { status: 'ready', data: { ledgers, categories } };
  }, [accounts, transactionsByAccount, categories]);
}
