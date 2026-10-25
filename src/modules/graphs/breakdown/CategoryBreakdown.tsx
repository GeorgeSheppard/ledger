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
  /** The earlier periods (most recent first) whose average "vs average" compares with. */
  compared: Period[];
  colorOf(category: string): string;
  onToggle(category: string): void;
}

const NUMBER = 'pl-3 text-right tabular-nums whitespace-nowrap';

/**
 * Spending per category over the period, as bars with the change from the average of the periods before. Click a
 * row to filter the dashboard to that category.
 */
export function CategoryBreakdown({
  rows,
  chosen,
  compared,
  colorOf,
  onToggle,
}: CategoryBreakdownProps) {
  if (!rows.length) return <p className="text-sm text-muted">No spending in these dates.</p>;
  const oldest = compared.at(-1);
  const newest = compared[0];
  const explanation =
    oldest && newest
      ? `Compared with the average of the ${compared.length} ${compared.length === 1 ? 'period' : 'periods'} of the same length before, ${formatDay(oldest.from)} to ${formatDay(newest.to)}`
      : 'There is no earlier spending to compare with';
  const max = Math.max(...rows.map((r) => Math.max(r.amount, r.average)), 1);
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
          <th scope="col" className="text-right" title={explanation}>
            vs average
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const change = row.amount - row.average;
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
                    style={{ left: `${(row.average / max) * 100}%` }}
                    title={`Average ${formatMoney(row.average)}`}
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
      <caption className="caption-bottom pt-2 text-left text-xs text-muted">
        {oldest && newest ? (
          <>
            The tick on each bar is the usual spend: the average per period over the{' '}
            {compared.length} {compared.length === 1 ? 'period' : 'periods'} before (
            {formatDay(oldest.from)} to {formatDay(newest.to)}). The change on the right is this
            period against it.
          </>
        ) : (
          'No earlier history to compare with yet.'
        )}
      </caption>
    </table>
  );
}
