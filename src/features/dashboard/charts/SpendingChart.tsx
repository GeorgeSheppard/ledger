import { useState } from 'react';
import { cn } from '../../../ui/cn';
import type { MonthCashFlow } from '../../../lib/metrics/cashFlow';
import type { MonthKey } from '../../../lib/metrics/months';
import { formatMoney, formatMonthLong } from '../format';
import { MonthAxis, YGrid } from './Axes';
import { ChartTooltip } from './ChartTooltip';
import { bandCenter, barPath, linearScale } from './scale';
import { CHART_CLASSES } from './theme';
import { useElementWidth } from './useElementWidth';

const HEIGHT = 260;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 48 };
const MAX_BAR = 24;
const GAP = 2;

interface SpendingChartProps {
  flows: MonthCashFlow[];
  /** Stack order, bottom first. */
  categories: string[];
  colorOf(category: string): string;
  selectedMonth: MonthKey;
  onSelectMonth(month: MonthKey): void;
}

/** Spending per month as stacked columns, one segment per category. Click a month to select it. */
export function SpendingChart({
  flows,
  categories,
  colorOf,
  selectedMonth,
  onSelectMonth,
}: SpendingChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ month: number; category: string } | null>(null);

  const y = linearScale(
    0,
    Math.max(...flows.map((f) => f.spending), 0),
    HEIGHT - MARGIN.bottom,
    MARGIN.top
  );
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const slot = (right - left) / flows.length;
  const barWidth = Math.min(MAX_BAR, slot * 0.6);
  const x = (i: number) => bandCenter(i, flows.length, left, right);
  const baseline = y(0);

  const hovered = hover && flows[hover.month];

  return (
    <div className={CHART_CLASSES.frame} ref={ref}>
      <svg
        className={CHART_CLASSES.svg}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Monthly spending by category"
        onMouseLeave={() => setHover(null)}
      >
        <YGrid y={y} left={left} right={right} />
        <MonthAxis months={flows.map((f) => f.month)} x={x} y={HEIGHT - 6} width={right - left} />
        {flows.map((flow, i) => {
          const present = categories.filter((c) => flow.spendingByCategory[c]);
          let top = baseline;
          const selected = flow.month === selectedMonth;
          return (
            <g
              key={flow.month}
              className="group cursor-pointer"
              onClick={() => onSelectMonth(flow.month)}
            >
              <rect
                className={cn(
                  selected
                    ? 'fill-surface-hover stroke-line'
                    : 'fill-transparent group-hover:fill-surface-hover'
                )}
                x={x(i) - slot / 2}
                y={MARGIN.top}
                width={slot}
                height={baseline - MARGIN.top}
              />
              {present.map((category, s) => {
                const height = baseline - y(flow.spendingByCategory[category] ?? 0);
                const start = top;
                top -= height;
                const isTop = s === present.length - 1;
                // Leave a surface-coloured gap above every segment but the top one.
                const end = isTop ? top : Math.min(start, top + GAP);
                if (start - end < 0.5) return null;
                return (
                  <path
                    key={category}
                    d={
                      isTop
                        ? barPath(x(i) - barWidth / 2, barWidth, start, end)
                        : `M${x(i) - barWidth / 2},${start} H${x(i) + barWidth / 2} V${end} H${x(i) - barWidth / 2} Z`
                    }
                    fill={colorOf(category)}
                    onMouseEnter={() => setHover({ month: i, category })}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && hovered && (
        <ChartTooltip
          title={formatMonthLong(hovered.month)}
          x={x(hover.month)}
          y={y(hovered.spending)}
          chartWidth={width}
          rows={[
            {
              label: hover.category,
              value: formatMoney(hovered.spendingByCategory[hover.category] ?? 0),
              color: colorOf(hover.category),
              emphasis: true,
            },
            { label: 'Total spending', value: formatMoney(hovered.spending) },
          ]}
        />
      )}
    </div>
  );
}
