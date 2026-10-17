import type { ReactNode } from 'react';

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
      className={`chart-tooltip${flip ? ' chart-tooltip--flip' : ''}`}
      style={{ left: x, top: y }}
      role="status"
    >
      <div className="chart-tooltip__title">{title}</div>
      {rows.map((row) => (
        <div
          key={row.label}
          className={`chart-tooltip__row${row.emphasis ? ' chart-tooltip__row--emphasis' : ''}`}
        >
          <span className="chart-tooltip__label">
            {row.color && <span className="chart-swatch" style={{ background: row.color }} />}
            {row.label}
          </span>
          <span className="chart-tooltip__value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
