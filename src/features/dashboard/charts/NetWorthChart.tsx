import { useState } from 'react';
import type { Account } from '../../../lib/domain/types';
import type { NetWorthPoint } from '../../../lib/metrics/netWorth';
import { formatMoney, formatMonthLong, formatWhole } from '../format';
import { MonthAxis, YGrid } from './Axes';
import { ChartTooltip } from './ChartTooltip';
import { linearScale } from './scale';
import { useElementWidth } from './useElementWidth';

const HEIGHT = 240;
const MARGIN = { top: 16, right: 56, bottom: 28, left: 48 };

interface NetWorthChartProps {
  /** At least one point. */
  points: NetWorthPoint[];
  accounts: Account[];
}

/** Net worth at each month end: a 2px line over a light wash, with a crosshair tooltip. */
export function NetWorthChart({ points, accounts }: NetWorthChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const totals = points.map((p) => p.total);
  const y = linearScale(
    Math.min(...totals),
    Math.max(...totals),
    HEIGHT - MARGIN.bottom,
    MARGIN.top
  );
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const step = points.length > 1 ? (right - left) / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? left + i * step : (left + right) / 2);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.total)}`).join(' ');
  const baseline = y(y.domain[0]);
  const area = `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`;
  const last = points.length - 1;
  const first = points[0]!;
  const lastPoint = points[last]!;
  const focus = points[hover ?? last]!;
  const active = hover === null ? null : focus;

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Net worth from ${formatMonthLong(first.month)} to ${formatMonthLong(lastPoint.month)}`}
        onMouseLeave={() => setHover(null)}
      >
        <YGrid y={y} left={left} right={right} />
        <MonthAxis months={points.map((p) => p.month)} x={x} y={HEIGHT - 6} width={right - left} />
        <path className="net-worth-chart__area" d={area} />
        <path className="net-worth-chart__line" d={line} />
        {hover !== null && (
          <line
            className="chart-crosshair"
            x1={x(hover)}
            x2={x(hover)}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
          />
        )}
        <circle
          className="chart-dot net-worth-chart__dot"
          cx={x(hover ?? last)}
          cy={y(focus.total)}
          r={4.5}
        />
        {hover === null && (
          <text className="chart-value-label" x={x(last) + 10} y={y(lastPoint.total)} dy="0.32em">
            {formatWhole(lastPoint.total)}
          </text>
        )}
        {points.map((p, i) => (
          <rect
            key={p.month}
            className="chart-hit"
            x={x(i) - Math.max(step, 24) / 2}
            y={MARGIN.top}
            width={Math.max(step, 24)}
            height={HEIGHT - MARGIN.top - MARGIN.bottom}
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && active && (
        <ChartTooltip
          title={formatMonthLong(active.month)}
          x={x(hover)}
          y={y(active.total)}
          chartWidth={width}
          rows={[
            { label: 'Net worth', value: formatMoney(active.total), emphasis: true },
            ...accounts.map((account) => ({
              label: account.name,
              value: formatMoney(active.byAccount[account.id] ?? 0),
            })),
          ]}
        />
      )}
    </div>
  );
}
