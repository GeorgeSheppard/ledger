import { useMemo, useState } from 'react';
import { isoDateOf } from '../../../lib/metrics/buckets';
import { surroundingPeriod } from '../../../lib/metrics/period';
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
    selectPeriod,
  }) {
    const [showNetWorth, setShowNetWorth] = useState(true);
    const shown = useMemo(
      () => surroundingPeriod(ledgers, period, isoDateOf(Date.now())),
      [ledgers, period]
    );
    const series = useMemo(
      () =>
        accountIds.length ? buildTimeSeries(ledgers, accountIds, shown, ignoredCategories) : null,
      [ledgers, accountIds, shown, ignoredCategories]
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
          ]}
        />
        {series ? (
          <AccountsChart
            series={series}
            period={period}
            lines={lines.filter((l) => l.on)}
            showNetWorth={showNetWorth}
            onSelectPeriod={selectPeriod}
          />
        ) : (
          <NoData>No accounts switched on. Click an account above to show it.</NoData>
        )}
      </>
    );
  },
};
