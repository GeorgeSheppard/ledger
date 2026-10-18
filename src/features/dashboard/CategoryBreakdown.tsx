import type { CategorySpend } from '../../lib/metrics/dashboard';
import { cn } from '../../ui/cn';
import { Swatch } from './charts/ChartLegend';
import { formatChange, formatMoney, formatWhole } from './format';

interface CategoryBreakdownProps {
  rows: CategorySpend[];
  colorOf(category: string): string;
}

const NUMBER = 'pl-3 text-right tabular-nums whitespace-nowrap';

/** Spending per category for one month, as bars with the change from the month before. */
export function CategoryBreakdown({ rows, colorOf }: CategoryBreakdownProps) {
  if (!rows.length) return <p className="text-sm text-muted">No spending this month.</p>;
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
          <th scope="col" className="text-right">
            vs prior
          </th>
          <th scope="col" className="text-right">
            Average
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const change = row.amount - row.previous;
          const color = colorOf(row.category);
          return (
            <tr key={row.category} className="[&>*]:py-1.5">
              <th scope="row" className="pr-3 text-left font-normal whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <Swatch color={color} />
                  {row.category}
                </span>
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
              <td className={cn(NUMBER, 'text-muted')}>{formatWhole(row.average)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
