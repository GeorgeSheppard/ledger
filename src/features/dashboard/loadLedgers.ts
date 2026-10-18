import { useMemo } from 'react';
import type { Category } from '../../lib/domain/types';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import { moneyLedgers } from '../../lib/accounts/inverted';
import { useLedger, type QueryState } from '../../state/ledgerData';

export interface DashboardData {
  ledgers: AccountLedger[];
  categories: Category[];
}

/** Everything the dashboard needs, with credit cards and loans in money terms (`lib/accounts/inverted.ts`). Always ready: the sheet is loaded up front. */
export function useLedgers(): QueryState<DashboardData> {
  const { accounts, transactionsByAccount, categories } = useLedger();
  return useMemo(() => {
    const ledgers = moneyLedgers(accounts, transactionsByAccount);
    return { status: 'ready', data: { ledgers, categories } };
  }, [accounts, transactionsByAccount, categories]);
}
