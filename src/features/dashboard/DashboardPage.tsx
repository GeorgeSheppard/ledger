import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/paths';
import {
  buildDashboard,
  categoryBreakdown,
  type DashboardRange,
} from '../../lib/metrics/dashboard';
import type { ShortcutId } from '../../lib/shortcuts/bindings';
import { useLedgerQuery } from '../../state/ledgerData';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Page } from '../../ui/Page';
import { AccountBalances } from './AccountBalances';
import { CategoryBreakdown } from './CategoryBreakdown';
import { CashFlowChart } from './charts/CashFlowChart';
import { ChartLegend } from './charts/ChartLegend';
import { NetWorthChart } from './charts/NetWorthChart';
import { SpendingChart } from './charts/SpendingChart';
import { FALLBACK_COLOR, INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from './charts/theme';
import { formatMonthLong } from './format';
import { loadDashboardData } from './loadLedgers';
import { StatTiles } from './StatTiles';

const RANGES: { range: DashboardRange; label: string; shortcut: ShortcutId }[] = [
  { range: 3, label: '3M', shortcut: 'dashboard.range3' },
  { range: 6, label: '6M', shortcut: 'dashboard.range6' },
  { range: 12, label: '12M', shortcut: 'dashboard.range12' },
  { range: 'all', label: 'All', shortcut: 'dashboard.rangeAll' },
];

interface PanelProps {
  title: string;
  /** Shown at the right of the title. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <Card className={cn('min-w-0 p-6', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

/** The signed-in homepage: net worth, spending and cash flow across every account. */
export function DashboardPage() {
  const query = useLedgerQuery(loadDashboardData);
  const [range, setRange] = useState<DashboardRange>(6);
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);

  const dashboard = useMemo(
    () => (query.data ? buildDashboard(query.data.ledgers, range) : null),
    [query.data, range]
  );
  const colorOf = useMemo(() => {
    const colors = new Map(query.data?.categories.map((c) => [c.name, c.color]));
    return (category: string) => colors.get(category) ?? FALLBACK_COLOR;
  }, [query.data]);

  const months = dashboard?.months ?? [];
  const selectedMonth = pickedMonth && months.includes(pickedMonth) ? pickedMonth : months.at(-1);
  const selectedIndex = selectedMonth ? months.indexOf(selectedMonth) : -1;
  const stepMonth = (by: number) => setPickedMonth(months[selectedIndex + by] ?? null);

  if (query.status === 'loading') return <Page title="Dashboard" description="Loading…" />;
  if (query.status === 'error')
    return (
      <Page title="Dashboard">
        <p role="alert" className="text-sm text-negative">
          Could not load your spreadsheet: {query.error.message}
        </p>
      </Page>
    );

  if (!dashboard || !selectedMonth)
    return (
      <Page title="Dashboard">
        <Card className="p-6 text-sm text-muted">
          <p>No transactions yet. Add some to an account or import a CSV to see your charts.</p>
          <p className="mt-2">
            <Link to={paths.accounts}>Go to accounts</Link> ·{' '}
            <Link to={paths.import}>Import CSV</Link>
          </p>
        </Card>
      </Page>
    );

  const accounts = query.data.ledgers.map((l) => l.account);

  return (
    <Page
      title="Dashboard"
      description={`${formatMonthLong(months[0] ?? selectedMonth)} to ${formatMonthLong(dashboard.latest.month)}`}
      actions={
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map((option) => (
            <ActionButton
              key={option.label}
              shortcut={option.shortcut}
              variant={option.range === range ? 'primary' : 'ghost'}
              aria-pressed={option.range === range}
              onAction={() => setRange(option.range)}
            >
              {option.label}
            </ActionButton>
          ))}
        </div>
      }
    >
      <StatTiles dashboard={dashboard} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Net worth" className="lg:col-span-2">
          <NetWorthChart points={dashboard.netWorth} accounts={accounts} />
        </Panel>
        <Panel title="Accounts">
          <AccountBalances accounts={dashboard.accounts} />
        </Panel>
      </div>

      <Panel
        title="Spending by category"
        aside={<span className="text-sm text-muted">Select a month to see its breakdown</span>}
      >
        <ChartLegend items={dashboard.categories.map((c) => ({ label: c, color: colorOf(c) }))} />
        <SpendingChart
          flows={dashboard.cashFlow}
          categories={dashboard.categories}
          colorOf={colorOf}
          selectedMonth={selectedMonth}
          onSelectMonth={setPickedMonth}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={formatMonthLong(selectedMonth)}
          aside={
            <div className="flex gap-1">
              <ActionButton
                shortcut="dashboard.previousMonth"
                variant="ghost"
                disabled={selectedIndex <= 0}
                onAction={() => stepMonth(-1)}
              >
                Previous
              </ActionButton>
              <ActionButton
                shortcut="dashboard.nextMonth"
                variant="ghost"
                disabled={selectedIndex >= months.length - 1}
                onAction={() => stepMonth(1)}
              >
                Next
              </ActionButton>
            </div>
          }
        >
          <CategoryBreakdown rows={categoryBreakdown(dashboard, selectedMonth)} colorOf={colorOf} />
        </Panel>
        <Panel title="Income and spending">
          <ChartLegend
            items={[
              { label: 'Income', color: INCOME_COLOR },
              { label: 'Spending', color: SPENDING_COLOR },
              { label: 'Net', color: NET_COLOR, shape: 'dot' },
            ]}
          />
          <CashFlowChart flows={dashboard.cashFlow} />
        </Panel>
      </div>
    </Page>
  );
}
