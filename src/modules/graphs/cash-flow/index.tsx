import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NoData } from '../shared/NoData';
import { INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from '../shared/theme';
import { ViewTransactions } from '../shared/ViewTransactions';
import { useTimeSeries } from '../shared/useTimeSeries';
import { CashFlowChart } from './CashFlowChart';

export const cashFlowGraph: Graph = {
  kind: 'cashFlow',
  label: 'Income and spending',
  defaultWidth: 2,
  title: () => 'Income and spending',
  View(props) {
    const series = useTimeSeries(props);
    if (!props.dashboard || !series) return <NoData>No transactions in these accounts yet.</NoData>;
    return (
      <>
        <ChartLegend
          items={[
            { label: 'Income', color: INCOME_COLOR },
            { label: 'Spending', color: SPENDING_COLOR },
            { label: 'Net', color: NET_COLOR, shape: 'dot' },
          ]}
        />
        <CashFlowChart
          series={series}
          toolbar={({ dates }) => (
            <ViewTransactions
              ledgers={props.ledgers}
              accountIds={props.accountIds}
              {...dates}
              open={props.openTransactions}
            />
          )}
        />
      </>
    );
  },
};
