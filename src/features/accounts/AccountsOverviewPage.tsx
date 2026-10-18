import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import type { Account } from '../../lib/domain/types';
import { formatAmount, roundCents } from '../../lib/transactions/amount';
import { summarizeAccount } from '../../lib/transactions/display';
import { todayIso } from '../../lib/transactions/dates';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Kbd } from '../../ui/Kbd';
import { Page } from '../../ui/Page';
import { formatDate } from '../../modules/import/ui/format';
import { AccountNameForm } from './AccountNameForm';
import { selectableRow } from './rowStyles';
import { useAccountActions, useAccountOverview } from './useAccountsData';

const GRID = 'grid grid-cols-[minmax(0,1fr)_110px_130px_140px] gap-2';

type NameForm = { kind: 'new' } | { kind: 'rename'; account: Account } | null;

/**
 * `/accounts`: a read-only summary of every account. The only edit here is the account name;
 * transactions are viewed and changed on each account's own page.
 */
export function AccountsOverviewPage() {
  const navigate = useNavigate();
  const overview = useAccountOverview();
  const actions = useAccountActions();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nameForm, setNameForm] = useState<NameForm>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const today = todayIso();
    return (overview.data ?? []).map(({ account, transactions }) => ({
      account,
      summary: summarizeAccount(transactions, today),
    }));
  }, [overview.data]);
  const accounts = useMemo(() => rows.map((r) => r.account), [rows]);
  const total = roundCents(rows.reduce((sum, r) => sum + r.summary.balance, 0));
  const selectedIndex = rows.findIndex((r) => r.account.id === selectedId);
  const selected = rows[selectedIndex]?.account;
  const browsing = !nameForm;

  useEffect(() => {
    if (selectedId === null) return;
    listRef.current
      ?.querySelector(`[data-account-id="${selectedId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const move = (delta: number) => {
    if (rows.length === 0) return;
    const from = selectedIndex === -1 ? (delta > 0 ? -1 : rows.length) : selectedIndex;
    const next = rows[Math.min(rows.length - 1, Math.max(0, from + delta))];
    if (next) setSelectedId(next.account.id);
  };
  useShortcut('accounts.down', () => move(1), browsing);
  useShortcut('accounts.up', () => move(-1), browsing);

  const createAccount = async (name: string) => {
    const created = await actions.createAccount(name);
    setNameForm(null);
    setSelectedId(created.id);
  };

  const renameAccount = async (account: Account, name: string) => {
    await actions.renameAccount(account.id, name);
    setNameForm(null);
  };

  if (overview.status === 'loading')
    return (
      <Page title="Accounts">
        <p className="text-sm text-muted">Loading accounts…</p>
      </Page>
    );
  if (overview.status === 'error')
    return (
      <Page title="Accounts">
        <p className="text-sm text-negative" role="alert">
          Could not load accounts: {overview.error.message}
        </p>
      </Page>
    );

  return (
    <Page
      title="Accounts"
      description="Every account in your spreadsheet. Open one to see and edit its transactions."
      actions={
        <>
          <ActionButton
            shortcut="accounts.open"
            variant="ghost"
            disabled={!selected || !browsing}
            onAction={() => selected && navigate(paths.account(selected.id))}
          >
            Open
          </ActionButton>
          <ActionButton
            shortcut="accounts.rename"
            variant="ghost"
            disabled={!selected || !browsing}
            onAction={() => selected && setNameForm({ kind: 'rename', account: selected })}
          >
            Rename
          </ActionButton>
          <ActionButton
            shortcut="accounts.new"
            disabled={!browsing}
            onAction={() => setNameForm({ kind: 'new' })}
          >
            New account
          </ActionButton>
        </>
      }
    >
      {nameForm?.kind === 'new' && (
        <Card className="px-4 py-3">
          <AccountNameForm
            accounts={accounts}
            onSubmit={createAccount}
            onCancel={() => setNameForm(null)}
          />
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-1 px-4 py-8 text-center text-sm text-muted">
          <p>No accounts yet.</p>
          <p className="inline-flex items-center gap-1.5">
            Press <Kbd shortcut="accounts.new" /> to create one.
          </p>
        </Card>
      ) : (
        <section className="flex min-w-0 flex-col" aria-label="Accounts" role="table">
          <div
            className={cn(
              GRID,
              'border-b border-line px-3 pb-2 text-xs font-semibold tracking-wide text-muted uppercase max-md:hidden'
            )}
            role="row"
          >
            <span role="columnheader">Account</span>
            <span role="columnheader" className="text-right">
              Transactions
            </span>
            <span role="columnheader" className="text-right">
              Last activity
            </span>
            <span role="columnheader" className="text-right">
              Balance
            </span>
          </div>
          <div className="flex flex-col pt-2" role="rowgroup" ref={listRef}>
            {rows.map(({ account, summary }) =>
              nameForm?.kind === 'rename' && nameForm.account.id === account.id ? (
                <Card key={account.id} className="my-0.5 px-3 py-2">
                  <AccountNameForm
                    accounts={accounts}
                    account={account}
                    onSubmit={(name) => renameAccount(account, name)}
                    onCancel={() => setNameForm(null)}
                  />
                </Card>
              ) : (
                <div
                  key={account.id}
                  role="row"
                  aria-selected={account.id === selectedId}
                  data-account-id={account.id}
                  className={selectableRow(
                    account.id === selectedId,
                    cn(GRID, 'max-md:grid-cols-[1fr_auto] max-md:py-2')
                  )}
                  onClick={() => navigate(paths.account(account.id))}
                >
                  <div role="cell" className="truncate font-medium">
                    {account.name}
                  </div>
                  <div role="cell" className="text-right text-muted tabular-nums max-md:hidden">
                    {summary.count}
                  </div>
                  <div
                    role="cell"
                    className="text-right whitespace-nowrap text-muted tabular-nums max-md:hidden"
                  >
                    {summary.lastDate ? formatDate(summary.lastDate) : '—'}
                  </div>
                  <div
                    role="cell"
                    className={cn(
                      'text-right whitespace-nowrap tabular-nums',
                      summary.balance < 0 && 'text-negative'
                    )}
                  >
                    {formatAmount(summary.balance)}
                  </div>
                </div>
              )
            )}
          </div>
          <div
            className={cn(
              GRID,
              'mt-2 border-t border-line px-3 pt-3 text-sm font-semibold max-md:grid-cols-[1fr_auto]'
            )}
            role="row"
          >
            <span role="cell">Total</span>
            <span className="max-md:hidden" />
            <span className="max-md:hidden" />
            <span
              role="cell"
              className={cn('text-right tabular-nums', total < 0 && 'text-negative')}
            >
              {formatAmount(total)}
            </span>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] text-muted max-md:hidden">
            <Kbd shortcut="accounts.down" />
            <Kbd shortcut="accounts.up" />
            to move, <Kbd shortcut="accounts.open" /> to open
          </p>
        </section>
      )}
    </Page>
  );
}
