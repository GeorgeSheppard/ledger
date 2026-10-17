import type { LedgerRepository } from '../../lib/data/repository';
import { useLedgerQuery } from '../../state/ledgerData';
import { Page } from '../../ui/Page';

const loadAccounts = (repository: LedgerRepository) => repository.listAccounts();

/**
 * Placeholder: owned by step 2 (accounts and transactions). Replace this file.
 * Shows the data hooks working end to end against the demo data.
 */
export function AccountsPage() {
  const accounts = useLedgerQuery(loadAccounts);
  return (
    <Page title="Accounts">
      {accounts.status === 'ready' && (
        <ul>
          {accounts.data.map((account) => (
            <li key={account.id}>{account.name}</li>
          ))}
        </ul>
      )}
    </Page>
  );
}
