import { useMemo, useState } from 'react';
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
import { AccountBalances } from './AccountBalances';
import { CategoryBreakdown } from './CategoryBreakdown';
import { CashFlowChart, INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from './charts/CashFlowChart';
import { ChartLegend } from './charts/ChartLegend';
import { NetWorthChart } from './charts/NetWorthChart';
import { SpendingChart } from './charts/SpendingChart';
import { formatMonthLong } from './format';
import { loadDashboardData } from './loadLedgers';
import { StatTiles } from './StatTiles';
import './DashboardPage.css';

const RANGES: { range: DashboardRange; label: string; shortcut: ShortcutId }[] = [
  { range: 3, label: '3M', shortcut: 'dashboard.range3' },
  { range: 6, label: '6M', shortcut: 'dashboard.range6' },
  { range: 12, label: '12M', shortcut: 'dashboard.range12' },
  { range: 'all', label: 'All', shortcut: 'dashboard.rangeAll' },
];

/** Used for categories missing from the category list, and for uncategorised spending. */
const FALLBACK_COLOR = 'var(--chart-uncategorised)';

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

  if (query.status === 'loading')
    return <div className="dashboard dashboard__status">Loading…</div>;
  if (query.status === 'error')
    return (
      <div className="dashboard dashboard__status" role="alert">
        Could not load your spreadsheet: {query.error.message}
      </div>
    );

  if (!dashboard || !selectedMonth)
    return (
      <div className="dashboard">
        <h1 className="dashboard__title">Dashboard</h1>
        <div className="dashboard__panel dashboard__empty">
          <p>No transactions yet. Add some to an account or import a CSV to see your charts.</p>
          <p>
            <Link to={paths.accounts}>Go to accounts</Link> ·{' '}
            <Link to={paths.import}>Import CSV</Link>
          </p>
        </div>
      </div>
    );

  const accounts = query.data.ledgers.map((l) => l.account);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__subtitle">
            {formatMonthLong(months[0] ?? selectedMonth)} to{' '}
            {formatMonthLong(dashboard.latest.month)}
          </p>
        </div>
        <div className="dashboard__ranges" role="group" aria-label="Time range">
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
      </header>

      <StatTiles dashboard={dashboard} />

      <div className="dashboard__grid dashboard__grid--wide-left">
        <section className="dashboard__panel">
          <h2 className="dashboard__panel-title">Net worth</h2>
          <NetWorthChart points={dashboard.netWorth} accounts={accounts} />
        </section>
        <section className="dashboard__panel">
          <h2 className="dashboard__panel-title">Accounts</h2>
          <AccountBalances accounts={dashboard.accounts} />
        </section>
      </div>

      <section className="dashboard__panel">
        <div className="dashboard__panel-header">
          <h2 className="dashboard__panel-title">Spending by category</h2>
          <span className="dashboard__hint">Select a month to see its breakdown</span>
        </div>
        <ChartLegend items={dashboard.categories.map((c) => ({ label: c, color: colorOf(c) }))} />
        <SpendingChart
          flows={dashboard.cashFlow}
          categories={dashboard.categories}
          colorOf={colorOf}
          selectedMonth={selectedMonth}
          onSelectMonth={setPickedMonth}
        />
      </section>

      <div className="dashboard__grid">
        <section className="dashboard__panel">
          <div className="dashboard__panel-header">
            <h2 className="dashboard__panel-title">{formatMonthLong(selectedMonth)}</h2>
            <div className="dashboard__month-nav">
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
          </div>
          <CategoryBreakdown rows={categoryBreakdown(dashboard, selectedMonth)} colorOf={colorOf} />
        </section>
        <section className="dashboard__panel">
          <h2 className="dashboard__panel-title">Income and spending</h2>
          <ChartLegend
            items={[
              { label: 'Income', color: INCOME_COLOR },
              { label: 'Spending', color: SPENDING_COLOR },
              { label: 'Net', color: NET_COLOR, shape: 'dot' },
            ]}
          />
          <CashFlowChart flows={dashboard.cashFlow} />
        </section>
      </div>
    </div>
  );
}
