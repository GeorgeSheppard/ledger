import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { Period } from '../../../lib/metrics/period';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors } from '../shared/chartjs';
import { formatBucket, formatCompact } from '../shared/format';
import { anchorTime, timeScale, useTimeView } from '../shared/timeView';

interface BarPoint {
  x: number;
  y: number;
  label: string;
  /** What the whole column adds up to, so the tooltip total is the real one. */
  total: number;
  /** First and last day of the column, to pick as the dashboard's dates when it is clicked. */
  start: string;
  end: string;
}

interface SpendingChartProps {
  /** Already narrowed to the chosen categories. */
  series: TimeSeries;
  /** Stack order, bottom first. Categories that only show up in a finer cut are added on top. */
  categories: string[];
  colorOf(category: string): string;
  /** Called with the dates of the column clicked. */
  onSelectPeriod(period: Period): void;
}

/**
 * Spending as stacked columns, one segment per category, cut into months, weeks or days to suit
 * the period. There is no tooltip; click a column to make its dates the dashboard's. Click a
 * category in the legend to filter to it.
 */
export function SpendingChart({ series, categories, colorOf, onSelectPeriod }: SpendingChartProps) {
  const view = useTimeView(series);
  const colors = useChartColors();
  const flows = series.cashFlow(view.granularity);

  // Netting happens per column, so a finer cut can have categories the period as a whole does not.
  const stacked = [...categories];
  for (const { index } of view.shown)
    for (const category of Object.keys(flows[index]!.spendingByCategory))
      if (!stacked.includes(category)) stacked.push(category);

  const datasets = stacked.map((category) => ({
    label: category,
    backgroundColor: colors.resolve(colorOf(category)),
    borderColor: colors.surface,
    borderWidth: 1,
    maxBarThickness: 28,
    parsing: false as const,
    data: view.shown.map<BarPoint>(({ bucket, index }) => ({
      x: anchorTime(bucket, 'middle'),
      y: flows[index]!.spendingByCategory[category] ?? 0,
      label: formatBucket(bucket, view.granularity),
      total: flows[index]!.spending,
      start: bucket.start,
      end: bucket.end,
    })),
  }));
  const data: ChartData<'bar', BarPoint[]> = { datasets };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8 } },
    interaction: { mode: 'index', axis: 'x', intersect: false },
    onClick: (_event, elements, chart) => {
      const first = elements[0];
      const raw = first && (chart.data.datasets[first.datasetIndex]?.data[first.index] as BarPoint);
      if (raw) onSelectPeriod({ from: raw.start, to: raw.end });
    },
    scales: {
      x: { ...timeScale(view, 'middle', colors.muted), stacked: true },
      y: {
        stacked: true,
        border: { display: false },
        grid: { color: colors.line },
        ticks: { color: colors.muted, callback: (v) => formatCompact(Number(v)) },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  return (
    <div className="relative h-64 w-full cursor-pointer">
      <Bar data={data} options={options} aria-label="Spending by category" role="img" />
    </div>
  );
}
