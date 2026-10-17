import { useState } from 'react';
import type { MonthCashFlow } from '../../../lib/metrics/cashFlow';
import { formatChange, formatMoney, formatMonthLong } from '../format';
import { MonthAxis, YGrid } from './Axes';
import { ChartTooltip } from './ChartTooltip';
import { bandCenter, barPath, linearScale } from './scale';
import { CHART_CLASSES, INCOME_COLOR, NET_COLOR, SPENDING_COLOR } from './theme';
import { useElementWidth } from './useElementWidth';

const HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 48 };
const MAX_BAR = 24;

/** Income above the zero line, spending below it, and the month's net as a dot, on one axis. */
export function CashFlowChart({ flows }: { flows: MonthCashFlow[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const y = linearScale(
    Math.min(0, ...flows.map((f) => -f.spending)),
    Math.max(0, ...flows.map((f) => f.income)),
    HEIGHT - MARGIN.bottom,
    MARGIN.top
  );
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const slot = (right - left) / flows.length;
  const barWidth = Math.min(MAX_BAR, slot * 0.5);
  const x = (i: number) => bandCenter(i, flows.length, left, right);
  const zero = y(0);
  const hovered = hover === null ? undefined : flows[hover];

  return (
    <div className={CHART_CLASSES.frame} ref={ref}>
      <svg
        className={CHART_CLASSES.svg}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Monthly income and spending"
        onMouseLeave={() => setHover(null)}
      >
        <YGrid y={y} left={left} right={right} />
        <MonthAxis months={flows.map((f) => f.month)} x={x} y={HEIGHT - 6} width={right - left} />
        {flows.map((flow, i) => (
          <g key={flow.month} className={hover !== null && hover !== i ? 'opacity-40' : undefined}>
            {flow.income > 0 && (
              <path
                d={barPath(x(i) - barWidth / 2, barWidth, zero - 1, y(flow.income))}
                fill={INCOME_COLOR}
              />
            )}
            {flow.spending > 0 && (
              <path
                d={barPath(x(i) - barWidth / 2, barWidth, zero + 1, y(-flow.spending))}
                fill={SPENDING_COLOR}
              />
            )}
            <circle
              className={CHART_CLASSES.dot}
              cx={x(i)}
              cy={y(flow.net)}
              r={4.5}
              fill={NET_COLOR}
            />
            <rect
              className={CHART_CLASSES.hit}
              x={x(i) - slot / 2}
              y={MARGIN.top}
              width={slot}
              height={HEIGHT - MARGIN.top - MARGIN.bottom}
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && hovered && (
        <ChartTooltip
          title={formatMonthLong(hovered.month)}
          x={x(hover)}
          y={y(hovered.income)}
          chartWidth={width}
          rows={[
            { label: 'Income', value: formatMoney(hovered.income), color: INCOME_COLOR },
            { label: 'Spending', value: formatMoney(hovered.spending), color: SPENDING_COLOR },
            {
              label: 'Net',
              value: formatChange(hovered.net),
              color: NET_COLOR,
              emphasis: true,
            },
          ]}
        />
      )}
    </div>
  );
}
