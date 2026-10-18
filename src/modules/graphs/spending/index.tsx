import { onlyCategories } from '../../../lib/metrics/cashFlow';
import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NO_ACTIVITY, NoData } from '../shared/NoData';
import { SpendingChart } from './SpendingChart';

export const spendingGraph: Graph = {
  kind: 'spending',
  label: 'Spending by category, per month',
  defaultWidth: 4,
  usesCategories: true,
  title: () => 'Spending by category',
  View({ widget, dashboard, month, onSelectMonth, colorOf }) {
    if (!dashboard) return <NoData>No transactions in these accounts yet.</NoData>;
    const chosen = widget.categories;
    const categories = chosen.length
      ? dashboard.categories.filter((c) => chosen.includes(c))
      : dashboard.categories;
    if (!categories.length)
      return (
        <NoData>
          {chosen.length ? 'No spending in the chosen categories in this period.' : NO_ACTIVITY}
        </NoData>
      );
    return (
      <>
        <ChartLegend items={categories.map((c) => ({ label: c, color: colorOf(c) }))} />
        <SpendingChart
          flows={onlyCategories(dashboard.cashFlow, chosen)}
          categories={categories}
          colorOf={colorOf}
          selectedMonth={month ?? dashboard.months.at(-1)!}
          onSelectMonth={onSelectMonth}
        />
      </>
    );
  },
};
