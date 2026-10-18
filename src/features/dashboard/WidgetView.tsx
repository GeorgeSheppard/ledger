import { useMemo } from 'react';
import { widgetAccountIds, type Widget } from '../../lib/dashboard/config';
import type { Account } from '../../lib/domain/types';
import { onlyCategories } from '../../lib/metrics/cashFlow';
import {
  buildDashboard,
  categoryBreakdown,
  type DashboardRange,
} from '../../lib/metrics/dashboard';
import type { MonthKey } from '../../lib/metrics/months';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import { ActionButton } from '../../ui/ActionButton';
import { AccountBalances } from './AccountBalances';
import { CategoryBreakdown } from './CategoryBreakdown';
import { CashFlowChart } from './charts/CashFlowChart';
import { ChartLegend } from './charts/ChartLegend';
import { NetWorthChart } from './charts/NetWorthChart';
import { SpendingChart } from './charts/SpendingChart';
import { INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from './charts/theme';
import { formatMonthLong } from './format';
import { StatTile } from './StatTile';

export interface WidgetViewProps {
  widget: Widget;
  ledgers: AccountLedger[];
  /** Range for widgets that follow the page. */
  pageRange: DashboardRange;
  colorOf(category: string): string;
  /** The month picked on a spending chart, shared by every breakdown. */
  selectedMonth: MonthKey | null;
  onSelectMonth(month: MonthKey): void;
  /** Month stepping shortcuts are off while the layout is being edited. */
  interactive: boolean;
}

/** The body of one dashboard widget: its chart, list or number, for its accounts and range. */
export function WidgetView({
  widget,
  ledgers,
  pageRange,
  colorOf,
  selectedMonth,
  onSelectMonth,
  interactive,
}: WidgetViewProps) {
  const range = widget.range ?? pageRange;
  const accountIds = useMemo(
    () =>
      widgetAccountIds(
        widget,
        ledgers.map((l) => l.account.id)
      ),
    [widget, ledgers]
  );
  const dashboard = useMemo(
    () => buildDashboard(ledgers, range, accountIds),
    [ledgers, range, accountIds]
  );

  if (!dashboard)
    return <p className="text-sm text-muted">No transactions in these accounts yet.</p>;

  const months = dashboard.months;
  const month = selectedMonth && months.includes(selectedMonth) ? selectedMonth : months.at(-1)!;
  const monthIndex = months.indexOf(month);
  const chosen = widget.categories;
  const categories = chosen.length
    ? dashboard.categories.filter((c) => chosen.includes(c))
    : dashboard.categories;

  switch (widget.kind) {
    case 'stat':
      return <StatTile dashboard={dashboard} metric={widget.metric} />;

    case 'netWorth': {
      const accounts: Account[] = dashboard.accounts.map((a) => a.account);
      return <NetWorthChart points={dashboard.netWorth} accounts={accounts} />;
    }

    case 'balances':
      return <AccountBalances accounts={dashboard.accounts} />;

    case 'spending':
      if (!categories.length) return <p className="text-sm text-muted">No spending in range.</p>;
      return (
        <>
          <ChartLegend items={categories.map((c) => ({ label: c, color: colorOf(c) }))} />
          <SpendingChart
            flows={onlyCategories(dashboard.cashFlow, chosen)}
            categories={categories}
            colorOf={colorOf}
            selectedMonth={month}
            onSelectMonth={onSelectMonth}
          />
        </>
      );

    case 'breakdown': {
      const rows = categoryBreakdown(dashboard, month).filter(
        (row) => !chosen.length || chosen.includes(row.category)
      );
      return (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{formatMonthLong(month)}</span>
            <div className="flex gap-1">
              <ActionButton
                shortcut="dashboard.previousMonth"
                variant="ghost"
                disabled={!interactive || monthIndex <= 0}
                onAction={() => onSelectMonth(months[monthIndex - 1]!)}
              >
                Previous
              </ActionButton>
              <ActionButton
                shortcut="dashboard.nextMonth"
                variant="ghost"
                disabled={!interactive || monthIndex >= months.length - 1}
                onAction={() => onSelectMonth(months[monthIndex + 1]!)}
              >
                Next
              </ActionButton>
            </div>
          </div>
          <CategoryBreakdown rows={rows} colorOf={colorOf} />
        </>
      );
    }

    case 'cashFlow':
      return (
        <>
          <ChartLegend
            items={[
              { label: 'Income', color: INCOME_COLOR },
              { label: 'Spending', color: SPENDING_COLOR },
              { label: 'Net', color: NET_COLOR, shape: 'dot' },
            ]}
          />
          <CashFlowChart flows={dashboard.cashFlow} />
        </>
      );
  }
}
