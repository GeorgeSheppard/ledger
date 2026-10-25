import type { ChartData, ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
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
  income: number;
  spending: number;
  net: number;
  /** First and last day of the column, to pick as the dashboard's dates when it is clicked. */
  start: string;
  end: string;
}

interface CashFlowChartProps {
  series: TimeSeries;
  /** Called with the dates of the column clicked. */
  onSelectPeriod(period: Period): void;
}

/**
 * Income above the zero line, spending below it, and the net as a dot, on one axis. Drag across it
 * or click a column to make those dates the dashboard's.
 */
export function CashFlowChart({ series, onSelectPeriod }: CashFlowChartProps) {
  const view = useTimeView(series);
  const colors = useChartColors();
  const flows = series.cashFlow(view.granularity);

  const points = view.shown.map(({ bucket, index }) => {
    const flow = flows[index]!;
    return {
      x: anchorTime(bucket, 'middle'),
      label: formatBucket(bucket, view.granularity),
      income: flow.income,
      spending: flow.spending,
      net: flow.net,
      start: bucket.start,
      end: bucket.end,
    };
  });
  const bar = (key: 'income' | 'spending', color: string, sign: 1 | -1) => ({
    type: 'bar' as const,
    label: key === 'income' ? 'Income' : 'Spending',
    backgroundColor: color,
    maxBarThickness: 24,
    parsing: false as const,
    data: points.map<Point>((p) => ({ ...p, y: sign * p[key] })),
  });
  const data = {
    datasets: [
      bar('income', colors.positive, 1),
      bar('spending', colors.negative, -1),
      {
        type: 'line' as const,
        label: 'Net',
        showLine: false,
        parsing: false as const,
        pointRadius: 4.5,
        pointHoverRadius: 5.5,
        backgroundColor: colors.fg,
        borderColor: colors.surface,
        borderWidth: 2,
        data: points.map<Point>((p) => ({ ...p, y: p.net })),
      },
    ],
  } as ChartData<'bar', Point[]>;

  const { plugin, wasDrag } = useDragSelect(colors, onSelectPeriod);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    events: [...DRAG_EVENTS],
    maintainAspectRatio: false,
    layout: { padding: { top: 8 } },
    interaction: { mode: 'index', axis: 'x', intersect: false },
    onClick: (_event, elements, chart) => {
      if (wasDrag()) return;
      const first = elements[0];
      const raw = first && (chart.data.datasets[first.datasetIndex]?.data[first.index] as Point);
      if (raw) onSelectPeriod({ from: raw.start, to: raw.end });
    },
    scales: {
      x: { ...timeScale(view, 'middle', colors.muted), stacked: true },
      y: {
        stacked: true,
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
        Drag across the graph to pick other dates, or click a column to pick that one.
      </p>
      <div className="relative h-60 w-full cursor-crosshair">
        <Chart
          type="bar"
          data={data}
          options={options}
          aria-label="Income and spending"
          role="img"
          plugins={[plugin]}
        />
      </div>
    </div>
  );
}
