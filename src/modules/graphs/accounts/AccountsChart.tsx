import type { Chart, ChartData, ChartOptions, Plugin } from 'chart.js';
import { useEffect, useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { isoDateOf } from '../../../lib/metrics/buckets';
import type { Period } from '../../../lib/metrics/period';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors } from '../shared/chartjs';
import { formatBucket, formatCompact } from '../shared/format';
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

/** Pixels the pointer must move before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

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

  // The plugin outlives renders, so it reads what it needs from a ref.
  const chart = useRef<Chart<'line', Point[]>>(null);
  const live = useRef({ onSelectPeriod, stroke: colors.accent });
  useEffect(() => {
    live.current = { onSelectPeriod, stroke: colors.accent };
  });
  const select = useMemo<Plugin<'line'>>(() => {
    const state: { drag: { from: number; to: number; startPixel: number } | null } = { drag: null };
    const band = (chart: Chart, from: number, to: number) => {
      const x = chart.scales.x!;
      const { chartArea } = chart;
      const left = Math.max(
        chartArea.left,
        Math.min(x.getPixelForValue(from), x.getPixelForValue(to))
      );
      const right = Math.min(
        chartArea.right,
        Math.max(x.getPixelForValue(from), x.getPixelForValue(to))
      );
      return {
        left,
        width: Math.max(right - left, 1),
        top: chartArea.top,
        height: chartArea.height,
      };
    };
    return {
      id: 'selectPeriod',
      afterDatasetsDraw(chart) {
        const { drag } = state;
        if (!drag) return;
        const b = band(chart, drag.from, drag.to);
        chart.ctx.save();
        chart.ctx.fillStyle = `${live.current.stroke}33`;
        chart.ctx.fillRect(b.left, b.top, b.width, b.height);
        chart.ctx.restore();
      },
      afterEvent(chart, { event }) {
        const x = chart.scales.x;
        if (!x) return;
        const pixel = Math.max(chart.chartArea.left, Math.min(chart.chartArea.right, event.x ?? 0));
        const time = x.getValueForPixel(pixel) ?? 0;
        if (event.type === 'mousedown') {
          state.drag = { from: time, to: time, startPixel: pixel };
        } else if (event.type === 'mousemove' && state.drag) {
          state.drag.to = time;
          chart.draw();
        } else if (event.type === 'mouseout') {
          state.drag = null;
        } else if (event.type === 'mouseup' && state.drag) {
          const { drag } = state;
          const moved = Math.abs(pixel - drag.startPixel);
          const [a, b] = [drag.from, drag.to].sort((m, n) => m - n) as [number, number];
          state.drag = null;
          if (moved >= DRAG_THRESHOLD)
            live.current.onSelectPeriod({ from: isoDateOf(a), to: isoDateOf(b) });
          chart.draw();
        }
      },
    };
  }, []);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, right: 8 } },
    events: ['mousemove', 'mouseout', 'mousedown', 'mouseup'],
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
      <p className="mb-2 text-xs text-muted">Drag across the graph to zoom in to those dates.</p>
      <div className="relative h-64 w-full cursor-crosshair">
        <Line
          ref={chart}
          data={data}
          options={options}
          plugins={[select]}
          aria-label="Balances over time"
          role="img"
        />
      </div>
    </div>
  );
}
