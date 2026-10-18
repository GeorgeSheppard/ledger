import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { formatAmount, roundCents } from '../../lib/transactions/amount';
import { summarizeAccount } from '../../lib/transactions/display';
import { todayIso } from '../../lib/transactions/dates';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Page } from '../../ui/Page';
import { formatDate } from '../../modules/import/ui/format';
import { AccountNameForm } from './AccountNameForm';
import { useAccountActions, useAccountOverview } from './useAccountsData';

const GRID = 'grid grid-cols-[minmax(0,1fr)_110px_130px_140px] gap-2';

/**
 * `/accounts`: a summary of every account, with a way to add one. Click an account to open it;
 * renaming and transactions live on the account's own page.
 */
export function AccountsOverviewPage() {
  const navigate = useNavigate();
  const overview = useAccountOverview();
  const actions = useAccountActions();
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const today = todayIso();
    return (overview.data ?? []).map(({ account, transactions }) => ({
      account,
      summary: summarizeAccount(transactions, today),
    }));
  }, [overview.data]);
  const accounts = useMemo(() => rows.map((r) => r.account), [rows]);
  const total = roundCents(rows.reduce((sum, r) => sum + r.summary.balance, 0));

  const createAccount = async (name: string) => {
    const created = await actions.createAccount(name);
    setAdding(false);
    navigate(paths.account(created.id));
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
        <ActionButton disabled={adding} onAction={() => setAdding(true)}>
          New account
        </ActionButton>
      }
    >
      {adding && (
        <Card className="px-4 py-3">
          <AccountNameForm
            accounts={accounts}
            onSubmit={createAccount}
            onCancel={() => setAdding(false)}
          />
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-1 px-4 py-8 text-center text-sm text-muted">
          <p>No accounts yet. Use New account to create one.</p>
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
          <div className="flex flex-col pt-2" role="rowgroup">
            {rows.map(({ account, summary }) => (
              <div
                key={account.id}
                role="row"
                tabIndex={0}
                className={cn(
                  GRID,
                  'min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm transition-colors hover:bg-surface-hover max-md:grid-cols-[1fr_auto] max-md:py-2',
                  'focus-visible:outline-2 focus-visible:outline-accent'
                )}
                onClick={() => navigate(paths.account(account.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(paths.account(account.id));
                }}
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
            ))}
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
        </section>
      )}
    </Page>
  );
}
