import type { Graph } from '../types';
import { NoData } from '../shared/NoData';
import { useTimeSeries } from '../shared/useTimeSeries';
import { NetWorthChart } from './NetWorthChart';

export const netWorthGraph: Graph = {
  kind: 'netWorth',
  label: 'Net worth over time',
  defaultWidth: 3,
  title: () => 'Net worth',
  View(props) {
    const series = useTimeSeries(props);
    if (!props.dashboard || !series) return <NoData>No transactions in these accounts yet.</NoData>;
    return (
      <NetWorthChart series={series} accounts={props.dashboard.accounts.map((a) => a.account)} />
    );
  },
};
