import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NoData } from '../shared/NoData';
import { INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from '../shared/theme';
import { CashFlowChart } from './CashFlowChart';

export const cashFlowGraph: Graph = {
  kind: 'cashFlow',
  label: 'Income and spending',
  defaultWidth: 2,
  title: () => 'Income and spending',
  View({ dashboard }) {
    if (!dashboard) return <NoData>No transactions in these accounts yet.</NoData>;
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
  },
};
