import { useMemo } from 'react';
import { widgetAccountIds, type Widget } from '../../lib/dashboard/config';
import { buildDashboard, type DashboardRange } from '../../lib/metrics/dashboard';
import type { MonthKey } from '../../lib/metrics/months';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import type { Paycheck } from '../../lib/paychecks/paychecks';
import type { LinkedFilters } from '../../lib/transactions/filterParams';
import { graphOf } from '../../modules/graphs';

export interface WidgetViewProps {
  widget: Widget;
  ledgers: AccountLedger[];
  paychecks: Paycheck[];
  /** Range for widgets that follow the page. */
  pageRange: DashboardRange;
  /** Lower-cased names of categories left out of income and spending. */
  ignoredCategories: ReadonlySet<string>;
  colorOf(category: string): string;
  /** The month picked on a spending chart, shared by every breakdown. */
  selectedMonth: MonthKey | null;
  onSelectMonth(month: MonthKey): void;
  /** Month stepping shortcuts are off while the layout is being edited. */
  interactive: boolean;
  openTransactions(filters: LinkedFilters): void;
}

/**
 * The body of one dashboard widget. Works out its accounts, range and data, then hands them to the
 * graph registered for the widget's kind, which draws it.
 */
export function WidgetView({
  widget,
  ledgers,
  paychecks,
  pageRange,
  ignoredCategories,
  colorOf,
  selectedMonth,
  onSelectMonth,
  interactive,
  openTransactions,
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
    () => buildDashboard(ledgers, range, accountIds, ignoredCategories),
    [ledgers, range, accountIds, ignoredCategories]
  );

  const graph = graphOf(widget.kind);
  if (!graph) return <p className="text-sm text-muted">This graph is no longer available.</p>;

  const month = selectedMonth && dashboard?.months.includes(selectedMonth) ? selectedMonth : null;
  return (
    <graph.View
      widget={widget}
      dashboard={dashboard}
      ledgers={ledgers}
      paychecks={paychecks}
      range={range}
      accountIds={accountIds}
      ignoredCategories={ignoredCategories}
      colorOf={colorOf}
      month={month}
      onSelectMonth={onSelectMonth}
      interactive={interactive}
      openTransactions={openTransactions}
    />
  );
}
