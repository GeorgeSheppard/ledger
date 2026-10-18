import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { paths } from '../../app/paths';
import { adjacentAccount, findAccountByParam } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { ImportDialog } from '../../modules/import/ui/ImportDialog';
import { useShortcut } from '../../state/shortcuts';
import { AccountNameForm } from './AccountNameForm';
import { AccountSummary } from './AccountSummary';
import { AccountSwitcher } from './AccountSwitcher';
import { TransactionTable } from './TransactionTable';
import { useAccountActions, useAccountsAndCategories, useTransactions } from './useAccountsData';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';

type NameForm = { kind: 'new' } | { kind: 'rename'; account: Account } | null;

/** `/accounts/:accountId`: one account's transactions with the account menu above them. */
export function AccountsPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const meta = useAccountsAndCategories();
  const accounts = meta.data?.accounts;
  const account = accounts && findAccountByParam(accounts, accountId);
  const transactions = useTransactions(account?.id);
  const actions = useAccountActions();
  const [nameForm, setNameForm] = useState<NameForm>(null);
  const [importing, setImporting] = useState(false);
  // The switcher menu lists "New account" with this shortcut.
  useShortcut('accounts.new', () => setNameForm({ kind: 'new' }), !nameForm && !importing);

  if (meta.status === 'loading')
    return (
      <Page title="Accounts">
        <PageMessage>Loading accounts…</PageMessage>
      </Page>
    );
  if (meta.status === 'error')
    return (
      <Page title="Accounts">
        <PageMessage>Could not load accounts: {meta.error.message}</PageMessage>
      </Page>
    );

  const { categories } = meta.data;

  const createAccount = async (name: string) => {
    const created = await actions.createAccount(name);
    setNameForm(null);
    navigate(paths.account(created.id));
  };

  const renameAccount = async (target: Account, name: string) => {
    await actions.renameAccount(target.id, name);
    setNameForm(null);
  };

  const go = (target: Account | undefined) => target && navigate(paths.account(target.id));

  if (!account) {
    return (
      <Page title="Account not found">
        <PageMessage>
          This account is not in your spreadsheet. <Link to={paths.accounts}>See all accounts</Link>
        </PageMessage>
      </Page>
    );
  }

  const several = meta.data.accounts.length > 1;
  const editingName = !!nameForm;
  // The import dialog has its own shortcuts, so the page's are off while it is open.
  const blocked = editingName || importing;
  const ready = transactions.status === 'ready';

  return (
    <Page
      title={account.name}
      actions={
        <>
          <AccountSwitcher
            accounts={meta.data.accounts}
            current={account}
            disabled={importing}
            onSelect={go}
            onNew={() => setNameForm({ kind: 'new' })}
          />
          <ActionButton
            shortcut="accounts.previous"
            variant="ghost"
            disabled={!several || blocked}
            aria-label="Previous account"
            onAction={() => go(adjacentAccount(meta.data.accounts, account.id, -1))}
          >
            ‹
          </ActionButton>
          <ActionButton
            shortcut="accounts.next"
            variant="ghost"
            disabled={!several || blocked}
            aria-label="Next account"
            onAction={() => go(adjacentAccount(meta.data.accounts, account.id, 1))}
          >
            ›
          </ActionButton>
          <ActionButton
            shortcut="accounts.rename"
            variant="ghost"
            disabled={blocked}
            onAction={() => setNameForm({ kind: 'rename', account })}
          >
            Rename
          </ActionButton>
          <ActionButton
            shortcut="accounts.import"
            disabled={blocked || !ready}
            onAction={() => setImporting(true)}
          >
            Import data
          </ActionButton>
        </>
      }
    >
      {nameForm && (
        <Card className="px-4 py-3">
          {nameForm.kind === 'new' ? (
            <AccountNameForm
              accounts={meta.data.accounts}
              onSubmit={createAccount}
              onCancel={() => setNameForm(null)}
            />
          ) : (
            <AccountNameForm
              accounts={meta.data.accounts}
              account={nameForm.account}
              onSubmit={(name) => renameAccount(nameForm.account, name)}
              onCancel={() => setNameForm(null)}
            />
          )}
        </Card>
      )}

      {transactions.status === 'loading' && <PageMessage>Loading transactions…</PageMessage>}
      {transactions.status === 'error' && (
        <PageMessage>Could not load transactions: {transactions.error.message}</PageMessage>
      )}
      {transactions.status === 'ready' && (
        <>
          <AccountSummary transactions={transactions.data} />
          <TransactionTable
            key={account.id}
            account={account}
            transactions={transactions.data}
            categories={categories}
            paused={importing}
          />
          {importing && (
            <ImportDialog
              account={account}
              transactions={transactions.data}
              categories={categories}
              onClose={() => setImporting(false)}
            />
          )}
        </>
      )}
    </Page>
  );
}

function PageMessage({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
