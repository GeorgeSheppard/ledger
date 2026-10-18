import type { ReactNode } from 'react';
import type { StatMetric } from './metrics';
import type { Dashboard } from '../../../lib/metrics/dashboard';
import { cn } from '../../../ui/cn';
import { formatChange, formatMonthShort, formatPercent, formatWhole } from '../shared/format';

interface DeltaProps {
  amount: number;
  /** Whether an increase is good news (net worth) or bad news (spending). */
  upIsGood: boolean;
  suffix: string;
}

function Delta({ amount, upIsGood, suffix }: DeltaProps) {
  const good = amount !== 0 && amount > 0 === upIsGood;
  const bad = amount !== 0 && !good;
  return (
    <div className={cn('text-sm text-muted', good && 'text-positive', bad && 'text-negative')}>
      <span aria-hidden>{amount > 0 ? '▲' : amount < 0 ? '▼' : '•'}</span>{' '}
      {formatChange(amount, formatWhole)} <span className="text-muted">{suffix}</span>
    </div>
  );
}

function statValue(dashboard: Dashboard, metric: StatMetric): { value: string; footer: ReactNode } {
  const { latest } = dashboard;
  const month = formatMonthShort(latest.month);
  const previousMonth = dashboard.months.at(-2);
  const vsLast = previousMonth ? `vs ${formatMonthShort(previousMonth)}` : 'vs last month';
  switch (metric) {
    case 'netWorth':
      return {
        value: formatWhole(latest.netWorth),
        footer: <Delta amount={latest.netWorthChange} upIsGood suffix={`in ${month}`} />,
      };
    case 'spending':
      return {
        value: formatWhole(latest.spending),
        footer:
          latest.previousSpending === null ? (
            `in ${month}`
          ) : (
            <Delta
              amount={latest.spending - latest.previousSpending}
              upIsGood={false}
              suffix={vsLast}
            />
          ),
      };
    case 'income':
      return { value: formatWhole(latest.income), footer: `in ${month}` };
    case 'savingsRate':
      return {
        value: latest.savingsRate === null ? '—' : formatPercent(latest.savingsRate),
        footer: `of income in ${month}`,
      };
    case 'averageSpending':
      return {
        value: formatWhole(latest.averageSpending),
        footer: `over ${dashboard.months.length} months`,
      };
  }
}

/** One headline number for the latest month, with how it changed. */
export function StatTile({ dashboard, metric }: { dashboard: Dashboard; metric: StatMetric }) {
  const { value, footer } = statValue(dashboard, metric);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {typeof footer === 'string' ? <div className="text-sm text-muted">{footer}</div> : footer}
    </div>
  );
}
