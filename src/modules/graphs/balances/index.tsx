import type { Graph } from '../types';
import { NoData } from '../shared/NoData';
import { AccountBalances } from './AccountBalances';

export const balancesGraph: Graph = {
  kind: 'balances',
  label: 'Account balances',
  defaultWidth: 1,
  title: () => 'Accounts',
  View({ dashboard }) {
    if (!dashboard) return <NoData>No transactions in these accounts yet.</NoData>;
    return <AccountBalances accounts={dashboard.accounts} />;
  },
};
