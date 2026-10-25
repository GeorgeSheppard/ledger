import { useMemo } from 'react';
import { periodCashFlow } from '../../lib/metrics/dashboard';
import type { AccountLedger } from '../../lib/metrics/netWorth';
import type { Period } from '../../lib/metrics/period';
import { formatMoney } from '../../modules/graphs/shared/format';
import { cn } from '../../ui/cn';

interface SummaryStripProps {
  ledgers: readonly AccountLedger[];
  accountIds: readonly number[];
  period: Period;
  ignoredCategories: ReadonlySet<string>;
}

function Figure({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={cn('rounded-md border-2 border-rule px-5 py-4', className)}>
      <div className="text-xs font-bold tracking-wide uppercase opacity-90">{label}</div>
      <div className="mt-1 font-mono text-4xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
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
      <Figure
        label="Income"
        value={formatMoney(flow.income)}
        className="bg-tile-positive text-tile-fg"
      />
      <Figure
        label="Spending"
        value={formatMoney(flow.spending)}
        className="bg-tile-negative text-tile-fg"
      />
      <Figure
        label={flow.net >= 0 ? 'Left over' : 'Overspent'}
        value={formatMoney(Math.abs(flow.net))}
        className="bg-fg text-canvas"
      />
    </div>
  );
}
