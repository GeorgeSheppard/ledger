import type { Chart, ChartData, ChartOptions, ChartType, Plugin } from 'chart.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Period } from '../../../lib/metrics/period';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors } from '../shared/chartjs';
import { DRAG_EVENTS, useDragSelect } from '../shared/dragSelect';
import { formatBucket, formatCompact, formatMoney } from '../shared/format';
import { anchorTime, timeScale, useTimeView } from '../shared/timeView';

interface Point {
  x: number;
  y: number;
  label: string;
}

export interface AccountLine {
  id: number;
  name: string;
  color: string;
}

interface AccountsChartProps {
  /** Covers the dashboard's period. */
  series: TimeSeries;
  /** The accounts switched on. */
  lines: AccountLine[];
  showNetWorth: boolean;
  /** Called with the days dragged across. */
  onSelectPeriod(period: Period): void;
}

/** Draws a thin vertical guide at the hovered point and reports which point that is. */
function useHoverGuide(color: string, onHover: (index: number | null) => void): Plugin {
  const live = useRef({ color, onHover, index: null as number | null });
  useEffect(() => {
    live.current.color = color;
    live.current.onHover = onHover;
  });
  return useMemo(() => {
    const plugin: Plugin<ChartType> = {
      id: 'hoverGuide',
      afterEvent(c: Chart, { event }) {
        let next: number | null = null;
        if (event.type !== 'mouseout' && event.x != null) {
          const { left, right } = c.chartArea;
          if (event.x >= left && event.x <= right) {
            const data = c.data.datasets[0]?.data as Point[] | undefined;
            const time = c.scales.x!.getValueForPixel(event.x) ?? 0;
            let best = Infinity;
            data?.forEach((p, i) => {
              const d = Math.abs(p.x - time);
              if (d < best) {
                best = d;
                next = i;
              }
            });
          }
        }
        if (next !== live.current.index) {
          live.current.index = next;
          live.current.onHover(next);
          c.draw();
        }
      },
      afterDatasetsDraw(c) {
        const { index, color: stroke } = live.current;
        const point = index == null ? undefined : (c.data.datasets[0]?.data[index] as Point);
        if (!point) return;
        const x = c.scales.x!.getPixelForValue(point.x);
        const { top, bottom } = c.chartArea;
        c.ctx.save();
        c.ctx.strokeStyle = stroke;
        c.ctx.lineWidth = 1;
        c.ctx.beginPath();
        c.ctx.moveTo(x, top);
        c.ctx.lineTo(x, bottom);
        c.ctx.stroke();
        c.ctx.restore();
      },
    };
    return plugin;
  }, []);
}

/**
 * Every account's balance over time with net worth as one more line. Drag across the chart to make
 * those dates the dashboard's, which zooms the chart (and the other graphs) in to them.
 */
export function AccountsChart({ series, lines, showNetWorth, onSelectPeriod }: AccountsChartProps) {
  const view = useTimeView(series);
  const colors = useChartColors();
  const worth = series.netWorth(view.granularity);

  const points = (value: (index: number) => number) =>
    view.shown.map<Point>(({ bucket, index }) => ({
      x: anchorTime(bucket, 'end'),
      y: value(index),
      label: formatBucket(bucket, view.granularity),
    }));
  const line = (label: string, color: string, width: number, data: Point[]) => ({
    label,
    data,
    parsing: false as const,
    borderColor: color,
    backgroundColor: color,
    borderWidth: width,
    borderJoinStyle: 'round' as const,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0,
  });
  const data: ChartData<'line', Point[]> = {
    datasets: [
      ...(showNetWorth
        ? [
            line(
              'Net worth',
              colors.fg,
              3,
              points((i) => worth[i]!.total)
            ),
          ]
        : []),
      ...lines.map((l) =>
        line(
          l.name,
          colors.resolve(l.color),
          1.75,
          points((i) => worth[i]!.byAccount[l.id] ?? 0)
        )
      ),
    ],
  };

  const { plugin } = useDragSelect(colors, onSelectPeriod);
  const [hover, setHover] = useState<number | null>(null);
  const guide = useHoverGuide(colors.muted, setHover);
  // The data changes under the hovered index (zoom, filters); an out-of-range index shows nothing.
  const hovered = hover == null ? undefined : data.datasets[0]?.data[hover];

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, right: 8 } },
    events: [...DRAG_EVENTS],
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: timeScale(view, 'end', colors.muted),
      y: {
        border: { display: false },
        grid: { color: (ctx) => (ctx.tick.value === 0 ? colors.muted : colors.line) },
        ticks: { color: colors.muted, callback: (v) => formatCompact(Number(v)) },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  return (
    <div>
      <div
        className="mb-2 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
        aria-live="off"
      >
        {hovered && hover != null ? (
          <>
            <span className="font-medium text-fg">{hovered.label}</span>
            {data.datasets.map((d) => (
              <span key={d.label} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: String(d.borderColor) }}
                />
                {d.label}
                <span className="text-fg tabular-nums">
                  {formatMoney((d.data[hover] as Point | undefined)?.y ?? 0)}
                </span>
              </span>
            ))}
          </>
        ) : (
          'Hover to see values. Drag across the graph to zoom in to those dates.'
        )}
      </div>
      <div className="relative h-64 w-full cursor-crosshair">
        <Line
          data={data}
          options={options}
          plugins={[plugin, guide]}
          aria-label="Balances over time"
          role="img"
        />
      </div>
    </div>
  );
}
