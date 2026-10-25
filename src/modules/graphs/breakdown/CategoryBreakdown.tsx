import type { CategorySpend } from '../../../lib/metrics/dashboard';
import type { Period } from '../../../lib/metrics/period';
import { formatDay } from '../../../lib/transactions/dates';
import { cn } from '../../../ui/cn';
import { Swatch } from '../shared/ChartLegend';
import { formatChange, formatMoney, formatWhole } from '../shared/format';

interface CategoryBreakdownProps {
  rows: CategorySpend[];
  /** Categories the dashboard is filtered to; empty for all. */
  chosen: string[];
  /** The dates "vs previous" compares with. */
  previous: Period;
  colorOf(category: string): string;
  onToggle(category: string): void;
}

const NUMBER = 'pl-3 text-right tabular-nums whitespace-nowrap';

/**
 * Spending per category over the period, as bars with the change from the period before. Click a
 * row to filter the dashboard to that category.
 */
export function CategoryBreakdown({
  rows,
  chosen,
  previous,
  colorOf,
  onToggle,
}: CategoryBreakdownProps) {
  if (!rows.length) return <p className="text-sm text-muted">No spending in these dates.</p>;
  const max = Math.max(...rows.map((r) => Math.max(r.amount, r.previous)), 1);
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-line text-xs text-muted">
        <tr className="[&>th]:py-1.5 [&>th]:font-normal">
          <th scope="col" className="text-left">
            Category
          </th>
          <th scope="col">
            <span className="sr-only">Share</span>
          </th>
          <th scope="col" className="text-right">
            Spent
          </th>
          <th
            scope="col"
            className="text-right"
            title={`Compared with ${formatDay(previous.from)} to ${formatDay(previous.to)}`}
          >
            vs previous
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const change = row.amount - row.previous;
          const color = colorOf(row.category);
          const on = !chosen.length || chosen.includes(row.category);
          return (
            <tr key={row.category} className={cn('[&>*]:py-1.5', !on && 'opacity-40')}>
              <th scope="row" className="pr-3 text-left font-normal whitespace-nowrap">
                <button
                  type="button"
                  aria-pressed={on}
                  className="flex cursor-pointer items-center gap-2 rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => onToggle(row.category)}
                >
                  <Swatch color={color} />
                  {row.category}
                </button>
              </th>
              <td className="w-2/5">
                <div className="relative h-2.5">
                  <div
                    className="h-full rounded-r"
                    style={{ width: `${(row.amount / max) * 100}%`, background: color }}
                  />
                  <div
                    className="absolute -inset-y-1 -ml-px w-0.5 bg-fg/50"
                    style={{ left: `${(row.previous / max) * 100}%` }}
                    title={`Previous ${formatMoney(row.previous)}`}
                  />
                </div>
              </td>
              <td className={NUMBER}>{formatMoney(row.amount)}</td>
              <td
                className={cn(
                  NUMBER,
                  'text-muted',
                  change > 0 && 'text-negative',
                  change < 0 && 'text-positive'
                )}
              >
                {formatChange(change, formatWhole)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
