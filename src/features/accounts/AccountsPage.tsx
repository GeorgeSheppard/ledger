import type { Account } from '../../lib/domain/types';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { paths } from '../../app/paths';
import { findAccountByParam } from '../../lib/accounts/accounts';
import { asMoney } from '../../lib/accounts/inverted';
import { filtersFromParams } from '../../lib/transactions/filterParams';
import { hasFilters } from '../../lib/transactions/filters';
import { ActionButton } from '../../ui/ActionButton';
import { ImportDialog } from '../../modules/import/ui/ImportDialog';
import { EditableTitle } from './EditableTitle';
import { AccountNameForm } from './AccountNameForm';
import { AccountSummary } from './AccountSummary';
import { AccountSettings } from './AccountSettings';
import { AccountSwitcher } from './AccountSwitcher';
import { TransactionTable } from './TransactionTable';
import { useAccountActions, useAccountsAndCategories, useTransactions } from './useAccountsData';
import { cn } from '../../ui/cn';
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
  const [params, setParams] = useSearchParams();
  const tab: AccountTab = params.get('tab') === 'settings' ? 'settings' : 'transactions';
  const linked = hasFilters(filtersFromParams(params)) ? filtersFromParams(params) : undefined;
  const showTab = (next: AccountTab) =>
    setParams(next === 'settings' ? { tab: 'settings' } : {}, { replace: true });

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
          <AccountTabs tab={tab} onChange={showTab} />
          {tab === 'settings' ? (
            <AccountSettings
              account={account}
              onInvertedChange={(inverted) => actions.setAccountInverted(account.id, inverted)}
            />
          ) : (
            <TransactionTable
              key={`${account.id}?${params.toString()}`}
              account={account}
              accounts={meta.data.accounts}
              initialFilters={linked}
              transactions={transactions.data}
              categories={categories}
              paused={importing}
            />
          )}
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

type AccountTab = 'transactions' | 'settings';

const TABS: { id: AccountTab; label: string }[] = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'settings', label: 'Settings' },
];

function AccountTabs({ tab, onChange }: { tab: AccountTab; onChange(tab: AccountTab): void }) {
  return (
    <div role="tablist" aria-label="Account" className="flex gap-1 border-b border-line">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={cn(
            '-mb-px cursor-pointer border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-fg',
            tab === id && 'border-accent font-medium text-fg'
          )}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PageMessage({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
