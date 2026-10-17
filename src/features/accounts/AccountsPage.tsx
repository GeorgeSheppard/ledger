import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { paths } from '../../app/paths';
import { adjacentAccount, findAccountByParam } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { AccountNameForm } from './AccountNameForm';
import { AccountSummary } from './AccountSummary';
import { AccountSwitcher } from './AccountSwitcher';
import { TransactionTable } from './TransactionTable';
import { useAccountActions, useAccountsAndCategories, useTransactions } from './useAccountsData';
import './AccountsPage.css';

type NameForm = { kind: 'new' } | { kind: 'rename'; account: Account } | null;

/**
 * `/accounts/:accountId`: one account's transactions with the account menu above them.
 * `/accounts` redirects to the first account.
 */
export function AccountsPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const meta = useAccountsAndCategories();
  const accounts = meta.data?.accounts;
  const account = accounts && findAccountByParam(accounts, accountId);
  const transactions = useTransactions(account?.id);
  const actions = useAccountActions();
  const [nameForm, setNameForm] = useState<NameForm>(null);

  if (meta.status === 'loading') return <PageMessage>Loading accounts…</PageMessage>;
  if (meta.status === 'error')
    return <PageMessage>Could not load accounts: {meta.error.message}</PageMessage>;

  const { categories } = meta.data;
  const first = meta.data.accounts[0];
  if (!account && first && accountId === undefined)
    return <Navigate to={paths.account(first.id)} replace />;

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

  const newForm = nameForm?.kind === 'new' && (
    <AccountNameForm
      accounts={meta.data.accounts}
      onSubmit={createAccount}
      onCancel={() => setNameForm(null)}
    />
  );

  if (!account) {
    return (
      <div className="accounts-page">
        <div className="accounts-page__empty">
          <h1>{accountId === undefined ? 'No accounts yet' : 'Account not found'}</h1>
          <p>
            Each account is a tab in your spreadsheet with Date, Category, Amount, Note and Total
            columns.
          </p>
          {newForm || (
            <div className="accounts-page__empty-actions">
              <ActionButton
                shortcut="accounts.new"
                variant="primary"
                onAction={() => setNameForm({ kind: 'new' })}
              >
                New account
              </ActionButton>
              {first && (
                <ActionButton shortcut="accounts.next" onAction={() => go(first)}>
                  Open {first.name}
                </ActionButton>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const several = meta.data.accounts.length > 1;

  return (
    <div className="accounts-page">
      <header className="accounts-page__header">
        <div className="accounts-page__title-row">
          {nameForm ? (
            nameForm.kind === 'new' ? (
              newForm
            ) : (
              <AccountNameForm
                accounts={meta.data.accounts}
                account={nameForm.account}
                onSubmit={(name) => renameAccount(nameForm.account, name)}
                onCancel={() => setNameForm(null)}
              />
            )
          ) : (
            <AccountSwitcher
              accounts={meta.data.accounts}
              current={account}
              onSelect={go}
              onNew={() => setNameForm({ kind: 'new' })}
            />
          )}
          <div className="accounts-page__account-actions">
            <ActionButton
              shortcut="accounts.previous"
              variant="ghost"
              disabled={!several || !!nameForm}
              aria-label="Previous account"
              onAction={() => go(adjacentAccount(meta.data.accounts, account.id, -1))}
            >
              ‹
            </ActionButton>
            <ActionButton
              shortcut="accounts.next"
              variant="ghost"
              disabled={!several || !!nameForm}
              aria-label="Next account"
              onAction={() => go(adjacentAccount(meta.data.accounts, account.id, 1))}
            >
              ›
            </ActionButton>
            <ActionButton
              shortcut="accounts.rename"
              variant="ghost"
              disabled={!!nameForm}
              onAction={() => setNameForm({ kind: 'rename', account })}
            >
              Rename
            </ActionButton>
            <ActionButton
              shortcut="accounts.new"
              disabled={!!nameForm}
              onAction={() => setNameForm({ kind: 'new' })}
            >
              New account
            </ActionButton>
          </div>
        </div>
        {transactions.status === 'ready' && <AccountSummary transactions={transactions.data} />}
      </header>

      {transactions.status === 'loading' && <PageMessage>Loading transactions…</PageMessage>}
      {transactions.status === 'error' && (
        <PageMessage>Could not load transactions: {transactions.error.message}</PageMessage>
      )}
      {transactions.status === 'ready' && (
        <TransactionTable
          key={account.id}
          account={account}
          transactions={transactions.data}
          categories={categories}
        />
      )}
    </div>
  );
}

function PageMessage({ children }: { children: ReactNode }) {
  return <p className="accounts-page__message">{children}</p>;
}
