import type { Account } from '../../lib/domain/types';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { paths } from '../../app/paths';
import { findAccountByParam } from '../../lib/accounts/accounts';
import { asMoney } from '../../lib/accounts/inverted';
import { ActionButton } from '../../ui/ActionButton';
import { ImportDialog } from '../../modules/import/ui/ImportDialog';
import { EditableTitle } from './EditableTitle';
import { AccountNameForm } from './AccountNameForm';
import { AccountSummary } from './AccountSummary';
import { AccountKind } from './AccountKind';
import { AccountSwitcher } from './AccountSwitcher';
import { TransactionTable } from './TransactionTable';
import { useAccountActions, useAccountsAndCategories, useTransactions } from './useAccountsData';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';

type NameForm = { kind: 'new' } | null;

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

  const editingName = !!nameForm;
  // The import dialog has its own shortcuts, so the page's are off while it is open.
  const blocked = editingName || importing;
  const ready = transactions.status === 'ready';

  return (
    <Page
      title={account.name}
      heading={
        <EditableTitle
          account={account}
          accounts={meta.data.accounts}
          disabled={blocked}
          onRename={(name) => actions.renameAccount(account.id, name)}
        />
      }
      actions={
        <>
          <AccountSwitcher
            accounts={meta.data.accounts}
            current={account}
            disabled={importing}
            onSelect={go}
            onNew={() => setNameForm({ kind: 'new' })}
          />
          <ActionButton disabled={blocked || !ready} onAction={() => setImporting(true)}>
            Import data
          </ActionButton>
        </>
      }
    >
      {nameForm && (
        <Card className="px-4 py-3">
          <AccountNameForm
            accounts={meta.data.accounts}
            onSubmit={createAccount}
            onCancel={() => setNameForm(null)}
          />
        </Card>
      )}

      {transactions.status === 'loading' && <PageMessage>Loading transactions…</PageMessage>}
      {transactions.status === 'error' && (
        <PageMessage>Could not load transactions: {transactions.error.message}</PageMessage>
      )}
      {transactions.status === 'ready' && (
        <>
          <AccountSummary transactions={asMoney(account, transactions.data)} />
          <AccountKind
            inverted={!!account.inverted}
            onChange={(inverted) => actions.setAccountInverted(account.id, inverted)}
          />
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
