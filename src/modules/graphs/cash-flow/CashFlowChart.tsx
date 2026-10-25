import type { ChartData, ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { Period } from '../../../lib/metrics/period';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors } from '../shared/chartjs';
import { formatBucket, formatCompact } from '../shared/format';
import { anchorTime, timeScale, useTimeView } from '../shared/timeView';

interface Point {
  x: number;
  y: number;
  label: string;
  income: number;
  spending: number;
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
 * Income above the zero line and spending below it, on one axis. Click a column
 * to make its dates the dashboard's.
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
    datasets: [bar('income', colors.positive, 1), bar('spending', colors.negative, -1)],
  } as ChartData<'bar', Point[]>;

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8 } },
    interaction: { mode: 'index', axis: 'x', intersect: false },
    onClick: (_event, elements, chart) => {
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
    <div className="relative h-60 w-full cursor-pointer">
      <Chart type="bar" data={data} options={options} aria-label="Income and spending" role="img" />
    </div>
  );
}
