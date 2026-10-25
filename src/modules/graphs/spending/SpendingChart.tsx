import type { ChartData, ChartOptions, Plugin } from 'chart.js';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Bar } from 'react-chartjs-2';
import { dayStart, DAY_MS } from '../../../lib/metrics/buckets';
import { monthEnd, type MonthKey } from '../../../lib/metrics/months';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors, useChartsReady } from '../shared/chartjs';
import { formatBucket, formatCompact } from '../shared/format';
import {
  anchorTime,
  timeScale,
  useZoomView,
  zoomPlugin,
  ZoomControls,
  type ZoomView,
} from '../shared/zoom';

interface BarPoint {
  x: number;
  y: number;
  label: string;
  /** First day of the bucket, to know which month a click picks. */
  start: string;
}

interface SpendingChartProps {
  series: TimeSeries;
  /** Stack order, bottom first. */
  categories: string[];
  colorOf(category: string): string;
  selectedMonth: MonthKey;
  onSelectMonth(month: MonthKey): void;
  toolbar?: (view: ZoomView) => ReactNode;
}

/**
 * Spending as stacked columns, one segment per category, a month at a time until zoomed in to
 * weeks and days. Click a column to select its month. Drag to pan, pinch or Ctrl+scroll to zoom.
 */
export function SpendingChart({
  series,
  categories,
  colorOf,
  selectedMonth,
  onSelectMonth,
  toolbar,
}: SpendingChartProps) {
  const view = useZoomView(series);
  const colors = useChartColors();
  const ready = useChartsReady();
  const flows = series.cashFlow(view.granularity);

  const datasets = categories.map((category) => ({
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
      start: bucket.start,
    })),
  }));
  const data: ChartData<'bar', BarPoint[]> = { datasets };

  // The selected month is shaded behind the columns. The plugin outlives renders, so it reads the
  // month from a ref.
  const selected = useRef({ month: selectedMonth, fill: colors.surfaceHover, stroke: colors.line });
  useEffect(() => {
    selected.current = { month: selectedMonth, fill: colors.surfaceHover, stroke: colors.line };
  });
  const shade = useMemo<Plugin<'bar'>>(
    () => ({
      id: 'selectedMonth',
      beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const x = scales.x;
        if (!x) return;
        const from = x.getPixelForValue(dayStart(`${selected.current.month}-01`));
        const to = x.getPixelForValue(dayStart(monthEnd(selected.current.month)) + DAY_MS);
        const left = Math.max(chartArea.left, from);
        const right = Math.min(chartArea.right, to);
        if (right <= left) return;
        ctx.save();
        ctx.fillStyle = selected.current.fill;
        ctx.strokeStyle = selected.current.stroke;
        ctx.fillRect(left, chartArea.top, right - left, chartArea.height);
        ctx.strokeRect(left, chartArea.top, right - left, chartArea.height);
        ctx.restore();
      },
    }),
    []
  );

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8 } },
    interaction: { mode: 'index', axis: 'x', intersect: false },
    onClick: (_event, elements, chart) => {
      const first = elements[0];
      if (!first) return;
      const raw = chart.data.datasets[first.datasetIndex]?.data[first.index] as
        BarPoint | undefined;
      if (raw) onSelectMonth(raw.start.slice(0, 7));
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
      zoom: zoomPlugin(view),
      tooltip: { enabled: false },
    },
  };

  return (
    <div>
      <ZoomControls view={view}>{toolbar?.(view)}</ZoomControls>
      <div className="relative h-64 w-full">
        {ready && (
          <Bar
            data={data}
            options={options}
            plugins={[shade]}
            aria-label="Spending by category"
            role="img"
          />
        )}
      </div>
    </div>
  );
}
