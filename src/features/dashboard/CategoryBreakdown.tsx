import type { CategorySpend } from '../../lib/metrics/dashboard';
import { formatChange, formatMoney, formatWhole } from './format';

interface CategoryBreakdownProps {
  rows: CategorySpend[];
  colorOf(category: string): string;
}

/** Spending per category for one month, as bars with the change from the month before. */
export function CategoryBreakdown({ rows, colorOf }: CategoryBreakdownProps) {
  const max = Math.max(...rows.map((r) => Math.max(r.amount, r.average)), 1);
  if (!rows.length) return <p className="dashboard__empty">No spending this month.</p>;
  return (
    <table className="category-breakdown">
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col" className="category-breakdown__bar-head">
            <span className="visually-hidden">Share</span>
          </th>
          <th scope="col">Spent</th>
          <th scope="col">vs prior</th>
          <th scope="col">Average</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const change = row.amount - row.previous;
          return (
            <tr key={row.category}>
              <th scope="row" className="category-breakdown__name">
                <span className="chart-swatch" style={{ background: colorOf(row.category) }} />
                {row.category}
              </th>
              <td className="category-breakdown__bar-cell">
                <div className="category-breakdown__track">
                  <div
                    className="category-breakdown__bar"
                    style={{
                      width: `${(row.amount / max) * 100}%`,
                      background: colorOf(row.category),
                    }}
                  />
                  <div
                    className="category-breakdown__average"
                    style={{ left: `${(row.average / max) * 100}%` }}
                    title={`Average ${formatMoney(row.average)}`}
                  />
                </div>
              </td>
              <td className="category-breakdown__number">{formatMoney(row.amount)}</td>
              <td
                className={`category-breakdown__number category-breakdown__change--${
                  change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
                }`}
              >
                {formatChange(change, formatWhole)}
              </td>
              <td className="category-breakdown__number category-breakdown__muted">
                {formatWhole(row.average)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
