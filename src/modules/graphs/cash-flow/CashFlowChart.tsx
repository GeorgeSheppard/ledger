import type { ChartData, ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
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
  net: number;
}

/** Income above the zero line, spending below it, and the net as a dot, on one axis. */
export function CashFlowChart({ series }: { series: TimeSeries }) {
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

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8 } },
    interaction: { mode: 'index', axis: 'x', intersect: false },
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
    <div className="relative h-60 w-full">
      <Chart type="bar" data={data} options={options} aria-label="Income and spending" role="img" />
    </div>
  );
}
