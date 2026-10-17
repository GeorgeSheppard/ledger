import type { ReactNode } from 'react';
import type { Dashboard } from '../../lib/metrics/dashboard';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { formatChange, formatMonthShort, formatPercent, formatWhole } from './format';

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

interface TileProps {
  label: string;
  value: string;
  footer?: ReactNode;
  hero?: boolean;
}

function Tile({ label, value, footer, hero }: TileProps) {
  return (
    <Card className={cn('flex flex-col gap-1 p-4', hero && 'col-span-2')}>
      <div className="text-sm text-muted">{label}</div>
      <div
        className={cn('font-semibold', hero ? 'text-5xl leading-tight tracking-tight' : 'text-2xl')}
      >
        {value}
      </div>
      {typeof footer === 'string' ? <div className="text-sm text-muted">{footer}</div> : footer}
    </Card>
  );
}

/** The headline numbers for the latest month. */
export function StatTiles({ dashboard }: { dashboard: Dashboard }) {
  const { latest } = dashboard;
  const month = formatMonthShort(latest.month);
  const previousMonth = dashboard.months.at(-2);
  const vsLast = previousMonth ? `vs ${formatMonthShort(previousMonth)}` : 'vs last month';

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
      <Tile
        hero
        label="Net worth"
        value={formatWhole(latest.netWorth)}
        footer={<Delta amount={latest.netWorthChange} upIsGood suffix={`in ${month}`} />}
      />
      <Tile
        label={`Spending in ${month}`}
        value={formatWhole(latest.spending)}
        footer={
          latest.previousSpending !== null && (
            <Delta
              amount={latest.spending - latest.previousSpending}
              upIsGood={false}
              suffix={vsLast}
            />
          )
        }
      />
      <Tile label={`Income in ${month}`} value={formatWhole(latest.income)} />
      <Tile
        label="Saved"
        value={latest.savingsRate === null ? '—' : formatPercent(latest.savingsRate)}
        footer={`of income in ${month}`}
      />
      <Tile
        label="Average monthly spending"
        value={formatWhole(latest.averageSpending)}
        footer={`over ${dashboard.months.length} months`}
      />
    </section>
  );
}
