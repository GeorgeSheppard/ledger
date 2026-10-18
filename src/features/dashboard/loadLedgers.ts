import type { LedgerRepository } from '../../lib/data/repository';
import type { Category } from '../../lib/domain/types';
import type { AccountLedger } from '../../lib/metrics/netWorth';

export interface DashboardData {
  ledgers: AccountLedger[];
  categories: Category[];
}

/** Everything the dashboard needs, in one query. Module-level so `useLedgerQuery` sees it as stable. */
export async function loadDashboardData(repository: LedgerRepository): Promise<DashboardData> {
  const [accounts, categories] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
  ]);
  const ledgers = await Promise.all(
    accounts.map(async (account) => ({
      account,
      transactions: await repository.listTransactions(account.id),
    }))
  );
  return { ledgers, categories };
}
