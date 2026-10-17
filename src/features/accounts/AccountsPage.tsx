import type { LedgerRepository } from '../../lib/data/repository';
import { useLedgerQuery } from '../../state/ledgerData';

const loadAccounts = (repository: LedgerRepository) => repository.listAccounts();

/**
 * Placeholder: owned by step 2 (accounts and transactions). Replace this file.
 * Shows the data hooks working end to end against the demo data.
 */
export function AccountsPage() {
  const accounts = useLedgerQuery(loadAccounts);
  return (
    <div className="placeholder">
      <h1>Accounts</h1>
      {accounts.status === 'ready' && (
        <ul>
          {accounts.data.map((account) => (
            <li key={account.id}>{account.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
