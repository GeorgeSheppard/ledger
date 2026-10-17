import type { Dashboard } from '../../lib/metrics/dashboard';
import { formatChange, formatMonthShort, formatPercent, formatWhole } from './format';

interface DeltaProps {
  amount: number;
  /** Whether an increase is good news (net worth) or bad news (spending). */
  upIsGood: boolean;
  suffix: string;
  format?: (amount: number) => string;
}

function Delta({ amount, upIsGood, suffix, format = formatWhole }: DeltaProps) {
  const tone = amount === 0 ? 'neutral' : amount > 0 === upIsGood ? 'good' : 'bad';
  return (
    <div className={`stat-tile__delta stat-tile__delta--${tone}`}>
      <span aria-hidden>{amount > 0 ? '▲' : amount < 0 ? '▼' : '•'}</span>{' '}
      {formatChange(amount, format)} <span className="stat-tile__delta-suffix">{suffix}</span>
    </div>
  );
}

/** The headline numbers for the latest month. */
export function StatTiles({ dashboard }: { dashboard: Dashboard }) {
  const { latest } = dashboard;
  const previousMonth = dashboard.months.length > 1 ? dashboard.months.at(-2)! : null;
  const vsLast = previousMonth ? `vs ${formatMonthShort(previousMonth)}` : 'vs last month';
  const monthName = formatMonthShort(latest.month);

  return (
    <section className="stat-tiles" aria-label="Summary">
      <div className="stat-tile stat-tile--hero">
        <div className="stat-tile__label">Net worth</div>
        <div className="stat-tile__value">{formatWhole(latest.netWorth)}</div>
        <Delta
          amount={latest.netWorthChange}
          upIsGood
          suffix={`in ${formatMonthShort(latest.month)}`}
        />
      </div>
      <div className="stat-tile">
        <div className="stat-tile__label">Spending in {monthName}</div>
        <div className="stat-tile__value">{formatWhole(latest.spending)}</div>
        {latest.previousSpending !== null && (
          <Delta
            amount={latest.spending - latest.previousSpending}
            upIsGood={false}
            suffix={vsLast}
          />
        )}
      </div>
      <div className="stat-tile">
        <div className="stat-tile__label">Income in {monthName}</div>
        <div className="stat-tile__value">{formatWhole(latest.income)}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-tile__label">Saved</div>
        <div className="stat-tile__value">
          {latest.savingsRate === null ? '—' : formatPercent(latest.savingsRate)}
        </div>
        <div className="stat-tile__note">of income in {formatMonthShort(latest.month)}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-tile__label">Average monthly spending</div>
        <div className="stat-tile__value">{formatWhole(latest.averageSpending)}</div>
        <div className="stat-tile__note">over {dashboard.months.length} months</div>
      </div>
    </section>
  );
}
