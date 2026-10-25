import { useMemo } from 'react';
import { buildTimeSeries } from '../../../lib/metrics/timeSeries';
import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NoData } from '../shared/NoData';
import { INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from '../shared/theme';
import { CashFlowChart } from './CashFlowChart';

export const cashFlowGraph: Graph = {
  kind: 'cashFlow',
  title: 'Income and spending',
  width: 2,
  View({ period, ledgers, accountIds, categories, ignoredCategories, selectPeriod }) {
    const series = useMemo(
      () => buildTimeSeries(ledgers, accountIds, period, ignoredCategories, categories),
      [ledgers, accountIds, period, ignoredCategories, categories]
    );
    if (!accountIds.length) return <NoData>No accounts switched on.</NoData>;
    return (
      <>
        <ChartLegend
          items={[
            { label: 'Income', color: INCOME_COLOR },
            { label: 'Spending', color: SPENDING_COLOR },
            { label: 'Net', color: NET_COLOR, shape: 'dot' },
          ]}
        />
        <CashFlowChart series={series} onSelectPeriod={selectPeriod} />
      </>
    );
  },
};
