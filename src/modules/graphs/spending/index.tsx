import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NoData } from '../shared/NoData';
import { ViewTransactions } from '../shared/ViewTransactions';
import { useTimeSeries } from '../shared/useTimeSeries';
import { SpendingChart } from './SpendingChart';

export const spendingGraph: Graph = {
  kind: 'spending',
  label: 'Spending by category, per month',
  defaultWidth: 4,
  usesCategories: true,
  title: () => 'Spending by category',
  View(props) {
    const { widget, dashboard, month, onSelectMonth, colorOf } = props;
    const series = useTimeSeries(props);
    if (!dashboard || !series) return <NoData>No transactions in these accounts yet.</NoData>;
    const chosen = widget.categories;
    const categories = chosen.length
      ? dashboard.categories.filter((c) => chosen.includes(c))
      : dashboard.categories;
    if (!categories.length) return <NoData>No spending in range.</NoData>;
    return (
      <>
        <ChartLegend items={categories.map((c) => ({ label: c, color: colorOf(c) }))} />
        <SpendingChart
          series={series}
          categories={categories}
          colorOf={colorOf}
          selectedMonth={month ?? dashboard.months.at(-1)!}
          onSelectMonth={onSelectMonth}
          toolbar={({ dates }) => (
            <ViewTransactions
              ledgers={props.ledgers}
              accountIds={props.accountIds}
              {...dates}
              categories={chosen}
              open={props.openTransactions}
            />
          )}
        />
      </>
    );
  },
};
