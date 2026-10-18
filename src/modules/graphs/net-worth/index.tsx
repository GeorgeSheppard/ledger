import type { Graph } from '../types';
import { NoData } from '../shared/NoData';
import { NetWorthChart } from './NetWorthChart';

export const netWorthGraph: Graph = {
  kind: 'netWorth',
  label: 'Net worth over time',
  defaultWidth: 3,
  title: () => 'Net worth',
  View({ dashboard }) {
    if (!dashboard) return <NoData>No transactions in these accounts yet.</NoData>;
    return (
      <NetWorthChart
        points={dashboard.netWorth}
        accounts={dashboard.accounts.map((a) => a.account)}
      />
    );
  },
};
