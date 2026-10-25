import { useMemo } from 'react';
import { categoryBreakdown } from '../../../lib/metrics/dashboard';
import { buildTimeSeries } from '../../../lib/metrics/timeSeries';
import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NoData } from '../shared/NoData';
import { SpendingChart } from './SpendingChart';

export const spendingGraph: Graph = {
  kind: 'spending',
  title: 'Spending by category',
  width: 4,
  View({
    period,
    ledgers,
    accountIds,
    categories,
    ignoredCategories,
    colorOf,
    toggleCategory,
    selectPeriod,
  }) {
    // The legend always lists every category with spending, so a filtered one can be switched back on.
    const spent = useMemo(
      () =>
        categoryBreakdown(ledgers, accountIds, period, ignoredCategories)
          .filter((row) => row.amount > 0)
          .map((row) => row.category),
      [ledgers, accountIds, period, ignoredCategories]
    );
    const series = useMemo(
      () => buildTimeSeries(ledgers, accountIds, period, ignoredCategories, categories),
      [ledgers, accountIds, period, ignoredCategories, categories]
    );
    if (!accountIds.length) return <NoData>No accounts switched on.</NoData>;
    if (!spent.length) return <NoData>No spending in these dates.</NoData>;
    const stack = categories.length ? spent.filter((c) => categories.includes(c)) : spent;
    return (
      <>
        <ChartLegend
          items={spent.map((category) => ({
            label: category,
            color: colorOf(category),
            on: !categories.length || categories.includes(category),
            onToggle: () => toggleCategory(category),
          }))}
        />
        <SpendingChart
          series={series}
          categories={stack}
          colorOf={colorOf}
          onSelectPeriod={selectPeriod}
        />
      </>
    );
  },
};
