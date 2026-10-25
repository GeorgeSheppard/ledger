import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import {
  ACCOUNT_SORT_LABELS,
  nextAccountSort,
  sortAccountRows,
  type AccountSort,
  type AccountSortKey,
} from '../../lib/accounts/sort';
import { formatAmount, roundCents } from '../../lib/transactions/amount';
import { summarizeAccount } from '../../lib/transactions/display';
import { todayIso } from '../../lib/transactions/dates';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Page } from '../../ui/Page';
import { Select } from '../../ui/Select';
import { formatDate } from '../../modules/import/ui/format';
import { AccountNameForm } from './AccountNameForm';
import { AccountSettings } from './AccountSettings';
import { useAccountActions, useAccountOverview } from './useAccountsData';

const COLUMNS: { key: AccountSortKey; align?: 'right' }[] = [
  { key: 'name' },
  { key: 'count', align: 'right' },
  { key: 'lastActivity', align: 'right' },
  { key: 'balance', align: 'right' },
];

/** How a direction reads for each sort, for the mobile dropdown. */
function sortWords(key: AccountSortKey, direction: 'asc' | 'desc'): string {
  if (key === 'name') return direction === 'asc' ? 'A to Z' : 'Z to A';
  if (key === 'lastActivity') return direction === 'asc' ? 'oldest first' : 'newest first';
  return direction === 'asc' ? 'lowest first' : 'highest first';
}

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
  /** The account whose settings are open in place of its row. */
  const [editingId, setEditingId] = useState<number | null>(null);
  /** `null` is the sheet's own tab order. */
  const [sort, setSort] = useState<AccountSort | null>(null);

  const summaries = useMemo(() => {
    const today = todayIso();
    return (overview.data ?? []).map(({ account, transactions }) => ({
      account,
      summary: summarizeAccount(transactions, today),
    }));
  }, [overview.data]);
  const rows = useMemo(
    () => (sort ? sortAccountRows(summaries, sort) : summaries),
    [summaries, sort]
  );
  const accounts = useMemo(() => summaries.map((r) => r.account), [summaries]);
  const total = roundCents(summaries.reduce((sum, r) => sum + r.summary.balance, 0));

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
      description="Every account in your spreadsheet. Click one to change its settings."
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
          <div className="mb-3 flex items-center gap-2 text-sm text-muted md:hidden">
            <label htmlFor="account-sort">Sort by</label>
            <Select
              id="account-sort"
              value={sort ? `${sort.key}:${sort.direction}` : ''}
              onChange={(e) => {
                const [key, direction] = e.target.value.split(':');
                setSort(
                  key
                    ? {
                        key: key as AccountSortKey,
                        direction: direction as AccountSort['direction'],
                      }
                    : null
                );
              }}
            >
              <option value="">Spreadsheet order</option>
              {(Object.keys(ACCOUNT_SORT_LABELS) as AccountSortKey[]).flatMap((key) =>
                (['asc', 'desc'] as const).map((direction) => (
                  <option key={`${key}:${direction}`} value={`${key}:${direction}`}>
                    {ACCOUNT_SORT_LABELS[key]} ({sortWords(key, direction)})
                  </option>
                ))
              )}
            </Select>
          </div>
          <div
            className={cn(
              GRID,
              'border-b border-line px-3 pb-2 text-xs font-semibold tracking-wide text-muted uppercase max-md:hidden'
            )}
            role="row"
          >
            {COLUMNS.map(({ key, align }) => {
              const active = sort?.key === key;
              return (
                <span
                  key={key}
                  role="columnheader"
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className={cn(align === 'right' && 'text-right')}
                >
                  <button
                    type="button"
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1 uppercase hover:text-fg',
                      active && 'text-fg'
                    )}
                    onClick={() => setSort(nextAccountSort(sort, key))}
                  >
                    {ACCOUNT_SORT_LABELS[key]}
                    <span
                      aria-hidden="true"
                      className={cn('text-[0.625rem]', !active && 'opacity-0')}
                    >
                      {active && sort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  </button>
                </span>
              );
            })}
          </div>
          <div className="flex flex-col pt-2" role="rowgroup">
            {rows.map(({ account, summary }) =>
              editingId === account.id ? (
                <div
                  key={account.id}
                  role="row"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                >
                  <AccountSettings
                    account={account}
                    onInvertedChange={(inverted) =>
                      actions.setAccountInverted(account.id, inverted)
                    }
                    onClose={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={account.id}
                  role="row"
                  tabIndex={0}
                  className={cn(
                    GRID,
                    'min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm transition-colors hover:bg-surface-hover max-md:grid-cols-[1fr_auto] max-md:py-2',
                    'focus-visible:outline-2 focus-visible:outline-accent'
                  )}
                  onClick={() => setEditingId(account.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingId(account.id);
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
              )
            )}
          </div>
          <div
            className={cn(
              GRID,
              'mt-2 min-h-11 cursor-pointer items-center rounded-lg border-t border-line px-3 text-sm font-semibold transition-colors hover:bg-surface-hover max-md:grid-cols-[1fr_auto]',
              'focus-visible:outline-2 focus-visible:outline-accent'
            )}
            role="row"
            tabIndex={0}
            aria-label="Total, open all transactions"
            onClick={() => navigate(paths.transactions)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(paths.transactions);
            }}
          >
            <span role="cell">
              Total
              <span className="ml-2 font-normal text-muted">View all transactions ›</span>
            </span>
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
