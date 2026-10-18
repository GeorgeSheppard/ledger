import { categoryBreakdown } from '../../../lib/metrics/dashboard';
import { ActionButton } from '../../../ui/ActionButton';
import type { Graph } from '../types';
import { monthEnd } from '../../../lib/metrics/months';
import { ViewTransactions } from '../shared/ViewTransactions';
import { formatMonthLong } from '../shared/format';
import { NoData } from '../shared/NoData';
import { CategoryBreakdown } from './CategoryBreakdown';

export const breakdownGraph: Graph = {
  kind: 'breakdown',
  label: 'Category breakdown for a month',
  defaultWidth: 2,
  usesCategories: true,
  title: () => 'Category breakdown',
  View({
    widget,
    dashboard,
    month,
    onSelectMonth,
    colorOf,
    interactive,
    ledgers,
    accountIds,
    openTransactions,
  }) {
    if (!dashboard) return <NoData>No transactions in these accounts yet.</NoData>;
    const months = dashboard.months;
    const shown = month ?? months.at(-1)!;
    const monthIndex = months.indexOf(shown);
    const chosen = widget.categories;
    const rows = categoryBreakdown(dashboard, shown).filter(
      (row) => !chosen.length || chosen.includes(row.category)
    );
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">{formatMonthLong(shown)}</span>
          <div className="flex flex-wrap gap-1">
            <ViewTransactions
              ledgers={ledgers}
              accountIds={accountIds}
              from={`${shown}-01`}
              to={monthEnd(shown)}
              categories={chosen}
              open={openTransactions}
            />
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
  },
};
