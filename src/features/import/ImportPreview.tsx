import { useState } from 'react';
import type { ImportPlan, PlanRowStatus } from '../../lib/csv/importPlan';
import { useShortcut } from '../../state/shortcuts';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { Kbd } from '../../ui/Kbd';
import { formatAmount, formatDate } from './format';

type Filter = 'all' | PlanRowStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'existing', label: 'Already in account' },
  { id: 'invalid', label: "Can't read" },
];

const STATUS: Record<PlanRowStatus, { label: string; tone: 'accent' | 'neutral' | 'negative' }> = {
  new: { label: 'New', tone: 'accent' },
  existing: { label: 'Already in account', tone: 'neutral' },
  invalid: { label: "Can't read", tone: 'negative' },
};

const CELL = 'border-b border-line px-3 py-2 align-top';

/** Rendering thousands of rows at once is slow and nobody scrolls that far. */
const ROW_LIMIT = 500;

/** Every row of the file with what will happen to it. `f` cycles the filter. */
export function ImportPreview({ plan }: { plan: ImportPlan }) {
  const [filter, setFilter] = useState<Filter>('all');
  useShortcut('import.filter', () =>
    setFilter(
      (f) => FILTERS[(FILTERS.findIndex((x) => x.id === f) + 1) % FILTERS.length]?.id ?? 'all'
    )
  );

  const rows = plan.rows.filter((r) => filter === 'all' || r.status === filter);
  const count = (id: Filter) => (id === 'all' ? plan.rows.length : plan.counts[id]);

  return (
    <section className="flex flex-col gap-3" aria-label="Preview">
      <div className="flex flex-wrap items-center gap-1" role="tablist">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-full border border-transparent px-2.5 py-1 text-sm text-muted hover:bg-surface-hover',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              filter === id && 'border-line bg-surface font-semibold text-fg'
            )}
            onClick={() => setFilter(id)}
          >
            {label}
            <span className="text-xs tabular-nums">{count(id)}</span>
          </button>
        ))}
        <Kbd shortcut="import.filter" className="text-muted" />
      </div>

      <Card className="max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0">
          <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
            <tr>
              <th className={cn(CELL, 'w-px text-right font-semibold')}>Line</th>
              <th className={cn(CELL, 'font-semibold')}>Date</th>
              <th className={cn(CELL, 'font-semibold')}>Note</th>
              <th className={cn(CELL, 'font-semibold')}>Category</th>
              <th className={cn(CELL, 'text-right font-semibold')}>Amount</th>
              <th className={cn(CELL, 'font-semibold')}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, ROW_LIMIT).map((row) => (
              <tr key={row.line} className={cn(row.status === 'existing' && 'text-muted')}>
                <td className={cn(CELL, 'text-right text-xs text-muted tabular-nums')}>
                  {row.line}
                </td>
                {row.input ? (
                  <>
                    <td className={cn(CELL, 'whitespace-nowrap')}>{formatDate(row.input.date)}</td>
                    <td className={cn(CELL, 'max-w-[32ch]')}>{row.input.note}</td>
                    <td className={CELL}>{row.input.category}</td>
                    <td
                      className={cn(
                        CELL,
                        'text-right whitespace-nowrap tabular-nums',
                        row.status === 'existing'
                          ? 'text-muted'
                          : row.input.amount < 0
                            ? 'text-negative'
                            : 'text-positive'
                      )}
                    >
                      {formatAmount(row.input.amount)}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className={cn(CELL, 'text-negative')}>
                    {row.error}
                    <span className="mt-0.5 block text-xs text-muted tabular-nums">
                      {row.cells.join(', ')}
                    </span>
                  </td>
                )}
                <td className={CELL}>
                  <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={cn(CELL, 'text-center text-muted')}>
                  No rows here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {rows.length > ROW_LIMIT && (
        <p className="text-center text-sm text-muted">
          Showing the first {ROW_LIMIT} of {rows.length} rows. All of them will be imported.
        </p>
      )}
    </section>
  );
}
