import type { ReactNode } from 'react';
import { cn } from '../../../ui/cn';
import { Swatch } from './ChartLegend';

export interface TooltipRow {
  label: string;
  value: string;
  /** Colour of the key mark beside the label. */
  color?: string;
  emphasis?: boolean;
}

interface ChartTooltipProps {
  title: ReactNode;
  rows: TooltipRow[];
  /** Anchor point in the chart's own pixel space. */
  x: number;
  y: number;
  chartWidth: number;
}

/** Floating tooltip for a chart. Flips to the left of the anchor near the right edge. */
export function ChartTooltip({ title, rows, x, y, chartWidth }: ChartTooltipProps) {
  const flip = x > chartWidth * 0.6;
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-10 min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg',
        flip
          ? '-translate-x-[calc(100%+14px)] -translate-y-1/2'
          : 'translate-x-3.5 -translate-y-1/2'
      )}
      style={{ left: x, top: y }}
      role="status"
    >
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'flex justify-between gap-4',
            row.emphasis ? 'font-semibold text-fg' : 'text-muted'
          )}
        >
          <span className="flex items-center gap-1.5">
            {row.color && <Swatch color={row.color} />}
            {row.label}
          </span>
          <span className="tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
