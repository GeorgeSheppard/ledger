import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Period } from '../../../lib/metrics/period';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors } from '../shared/chartjs';
import { DRAG_EVENTS, useDragSelect } from '../shared/dragSelect';
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
  /** Covers the period and the data around it. */
  series: TimeSeries;
  /** Marked on the chart. */
  period: Period;
  /** The accounts switched on. */
  lines: AccountLine[];
  showNetWorth: boolean;
  /** Called with the days dragged across. */
  onSelectPeriod(period: Period): void;
}

/**
 * Every account's balance over time with net worth as one more line. The graph's period is shaded;
 * drag across the chart to pick a new one.
 */
export function AccountsChart({
  series,
  period,
  lines,
  showNetWorth,
  onSelectPeriod,
}: AccountsChartProps) {
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

  const { plugin } = useDragSelect(colors, onSelectPeriod, period);

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
      <p className="mb-2 text-xs text-muted">
        The shaded part is the dates shown. Drag across the graph to pick other dates.
      </p>
      <div className="relative h-64 w-full cursor-crosshair">
        <Line
          data={data}
          options={options}
          plugins={[plugin]}
          aria-label="Balances over time"
          role="img"
        />
      </div>
    </div>
  );
}
