import { useMemo, useState } from 'react';
import { buildTimeSeries } from '../../../lib/metrics/timeSeries';
import type { Graph } from '../types';
import { ChartLegend } from '../shared/ChartLegend';
import { NoData } from '../shared/NoData';
import { NET_COLOR } from '../shared/theme';
import { AccountsChart } from './AccountsChart';

export const accountsGraph: Graph = {
  kind: 'accounts',
  title: 'Balances over time',
  width: 4,
  View({
    period,
    ledgers,
    accountIds,
    ignoredCategories,
    accountColorOf,
    toggleAccount,
    setAccounts,
    selectPeriod,
  }) {
    const [showNetWorth, setShowNetWorth] = useState(true);
    const series = useMemo(
      () => buildTimeSeries(ledgers, accountIds, period, ignoredCategories),
      [ledgers, accountIds, period, ignoredCategories]
    );
    const lines = ledgers.map(({ account }) => ({
      id: account.id,
      name: account.name,
      color: accountColorOf(account.id),
      on: accountIds.includes(account.id),
    }));
    return (
      <>
        <ChartLegend
          items={[
            {
              label: 'Net worth',
              color: NET_COLOR,
              shape: 'dot',
              on: showNetWorth,
              onToggle: () => setShowNetWorth((v) => !v),
            },
            ...lines.map((line) => ({
              label: line.name,
              color: line.color,
              shape: 'dot' as const,
              on: line.on,
              onToggle: () => toggleAccount(line.id),
            })),
            {
              label: accountIds.length ? 'Hide all' : 'Show all',
              onToggle: () => setAccounts(accountIds.length ? [] : lines.map((l) => l.id)),
            },
          ]}
        />
        {showNetWorth || accountIds.length ? (
          <AccountsChart
            series={series}
            lines={lines.filter((l) => l.on)}
            showNetWorth={showNetWorth}
            onSelectPeriod={selectPeriod}
          />
        ) : (
          <NoData>Nothing switched on. Click an account above to show it.</NoData>
        )}
      </>
    );
  },
};
