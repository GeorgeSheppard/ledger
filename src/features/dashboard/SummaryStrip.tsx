import { useMemo } from 'react';
import { periodCashFlow } from '../../lib/metrics/dashboard';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import type { Period } from '../../lib/metrics/period';
import { formatMoney } from '../../modules/graphs/shared/format';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';

interface SummaryStripProps {
  ledgers: readonly AccountLedger[];
  accountIds: readonly number[];
  period: Period;
  ignoredCategories: ReadonlySet<string>;
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={cn('mt-1 text-3xl font-bold tracking-tight tabular-nums', tone)}>{value}</div>
    </Card>
  );
}

/** The period's headline numbers, big, above the graphs that explain them. */
export function SummaryStrip({
  ledgers,
  accountIds,
  period,
  ignoredCategories,
}: SummaryStripProps) {
  const flow = useMemo(
    () => periodCashFlow(ledgers, accountIds, period, ignoredCategories),
    [ledgers, accountIds, period, ignoredCategories]
  );
  return (
    <div aria-label="Summary of this view" className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <Figure label="Income" value={formatMoney(flow.income)} tone="text-positive" />
      <Figure label="Spending" value={formatMoney(flow.spending)} tone="text-negative" />
      <Figure
        label={flow.net >= 0 ? 'Left over' : 'Overspent'}
        value={formatMoney(Math.abs(flow.net))}
      />
    </div>
  );
}
