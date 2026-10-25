import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import type { WidgetWidth } from '../../modules/graphs/types';
import { ignoredCategoryNames } from '../../lib/categories/categories';
import { defaultPeriod, firstDate } from '../../lib/metrics/period';
import { todayIso } from '../../lib/transactions/dates';
import { filterParams, type LinkedFilters } from '../../lib/transactions/filterParams';
import { GRAPHS } from '../../modules/graphs';
import { FALLBACK_COLOR, accountColor } from '../../modules/graphs/shared/theme';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { CardTitle } from '../../ui/CardTitle';
import { cn } from '../../ui/cn';
import { Page } from '../../ui/Page';
import { SummaryStrip } from './SummaryStrip';
import { PeriodPicker } from './PeriodPicker';
import { describeView, ViewTransactions } from './ViewTransactions';
import { useDashboardData } from './useDashboardData';
import { useViewHistory } from './useViewHistory';

/** Grid span per graph width: everything stacks on phones, at most 2 across on tablets. */
const SPANS: Record<WidgetWidth, string> = {
  1: 'lg:col-span-1',
  2: 'md:col-span-2 lg:col-span-2',
  3: 'md:col-span-2 lg:col-span-3',
  4: 'md:col-span-2 lg:col-span-4',
};

/** Adds `value` to `list`, or takes it out when it is already there. */
/**
 * The signed-in homepage: every graph drawn for one date range (a month to begin with), with
 * filters they all share. Switch accounts off in the balances legend, or click a category in the
 * spending graphs, and every graph follows.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { query, paychecks } = useDashboardData();

  const ledgers = query.data?.ledgers;
  const [today] = useState(todayIso);
  const initialPeriod = useMemo(
    () => (ledgers ? defaultPeriod(ledgers, today) : null),
    [ledgers, today]
  );
  const {
    period,
    categories,
    hiddenAccounts,
    select: setPicked,
    toggleCategory,
    toggleAccount,
    setAccounts: setShownAccounts,
    clearFilters,
  } = useViewHistory(initialPeriod);
  const ignored = useMemo(() => ignoredCategoryNames(query.data?.categories ?? []), [query.data]);
  const colorOf = useMemo(() => {
    const colors = new Map(query.data?.categories.map((c) => [c.name, c.color]));
    return (category: string) => colors.get(category) ?? FALLBACK_COLOR;
  }, [query.data]);
  const allIds = useMemo(() => ledgers?.map((l) => l.account.id) ?? [], [ledgers]);
  const accountIds = useMemo(
    () => allIds.filter((id) => !hiddenAccounts.includes(id)),
    [allIds, hiddenAccounts]
  );
  const accountColorOf = useCallback(
    (id: number) => accountColor(Math.max(0, allIds.indexOf(id))),
    [allIds]
  );
  const setAccounts = useCallback(
    (on: number[]) => setShownAccounts(allIds, on),
    [allIds, setShownAccounts]
  );

  if (query.status === 'loading') return <Page title="Dashboard" description="Loading…" />;
  if (query.status === 'error')
    return (
      <Page title="Dashboard">
        <p role="alert" className="text-sm text-negative">
          Could not load your spreadsheet: {query.error.message}
        </p>
      </Page>
    );

  const hasTransactions = query.data.ledgers.some((l) => l.transactions.length > 0);
  const filtered = hiddenAccounts.length > 0 || categories.length > 0;
  const openTransactions = (filters: LinkedFilters) => {
    const search = filterParams(filters);
    navigate(`${paths.transactions}${search ? `?${search}` : ''}`);
  };

  if (!hasTransactions || !period)
    return (
      <Page title="Dashboard">
        <Card className="p-6 text-sm text-muted">
          <p>No transactions yet. Add some to an account to see your graphs.</p>
          <p className="mt-2">
            <Link to={paths.accounts}>Go to accounts</Link>
          </p>
        </Card>
      </Page>
    );

  return (
    <Page title="Dashboard">
      {/* Sticky, so the dates can be changed (and the view opened) from anywhere on the page. */}
      <Card className="sticky top-[var(--ledger-bar-height,0px)] z-10 flex flex-wrap items-center justify-between gap-3 p-3 shadow-md md:p-4">
        <PeriodPicker
          period={period}
          today={today}
          first={firstDate(query.data.ledgers)}
          onChange={setPicked}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 text-sm text-muted max-md:hidden">
            {describeView(period, allIds.length, accountIds.length, categories)}
          </p>
          {filtered && (
            <ActionButton variant="ghost" onAction={clearFilters}>
              Clear filters
            </ActionButton>
          )}
          <ViewTransactions
            ledgers={query.data.ledgers}
            period={period}
            accountIds={accountIds}
            categories={categories}
            open={openTransactions}
          />
        </div>
      </Card>

      <SummaryStrip
        ledgers={query.data.ledgers}
        accountIds={accountIds}
        period={period}
        ignoredCategories={ignored}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {GRAPHS.map((graph) => (
          <Card key={graph.kind} className={cn('min-w-0 self-start p-5', SPANS[graph.width])}>
            <CardTitle>{graph.title}</CardTitle>
            <graph.View
              period={period}
              ledgers={query.data.ledgers}
              paychecks={paychecks}
              accountIds={accountIds}
              categories={categories}
              ignoredCategories={ignored}
              colorOf={colorOf}
              accountColorOf={accountColorOf}
              toggleAccount={toggleAccount}
              setAccounts={setAccounts}
              toggleCategory={toggleCategory}
              selectPeriod={setPicked}
            />
          </Card>
        ))}
      </div>
    </Page>
  );
}
