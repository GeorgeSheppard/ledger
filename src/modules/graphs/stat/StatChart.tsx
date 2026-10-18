import type { ChartData, ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors, useChartsReady } from '../shared/chartjs';
import { formatBucket, formatCompact, formatMoney, formatPercent } from '../shared/format';
import {
  anchorTime,
  timeScale,
  useZoomView,
  zoomPlugin,
  ZoomControls,
  type ZoomView,
} from '../shared/zoom';
import type { ReactNode } from 'react';
import { METRIC_LABELS, type StatMetric } from './metrics';

interface Point {
  x: number;
  y: number | null;
  label: string;
}

/** One value per period for a headline number, or null where it has none (a share of no income). */
function periodValues(metric: StatMetric, series: TimeSeries, view: ZoomView): (number | null)[] {
  const g = view.granularity;
  switch (metric) {
    case 'netWorth':
      return series.netWorth(g).map((w) => w.total);
    case 'income':
      return series.cashFlow(g).map((f) => f.income);
    case 'spending':
    case 'averageSpending':
      return series.cashFlow(g).map((f) => f.spending);
    case 'savingsRate':
      return series.cashFlow(g).map((f) => (f.income > 0 ? f.net / f.income : null));
  }
}

/**
 * A headline number over time, zoomable like the other graphs: a line for balances and shares, bars
 * for money in or out. Average spending is drawn as the spending it averages, with a dashed line at
 * the average.
 */
export function StatChart({
  metric,
  series,
  average,
  toolbar,
}: {
  metric: StatMetric;
  series: TimeSeries;
  /** The mean monthly spending, drawn across the chart for `averageSpending`. */
  average: number;
  toolbar?: (view: ZoomView) => ReactNode;
}) {
  const view = useZoomView(series);
  const colors = useChartColors();
  const ready = useChartsReady();
  const values = periodValues(metric, series, view);
  const isShare = metric === 'savingsRate';
  const isLine = metric === 'netWorth' || isShare;
  const anchor = metric === 'netWorth' ? 'end' : 'middle';
  const format = isShare ? formatPercent : formatMoney;

  const points = view.shown.map<Point>(({ bucket, index }) => ({
    x: anchorTime(bucket, anchor),
    y: values[index] ?? null,
    label: formatBucket(bucket, view.granularity),
  }));
  const barColor = metric === 'income' ? colors.positive : colors.accent;
  const datasets: unknown[] = [
    isLine
      ? {
          type: 'line',
          label: METRIC_LABELS[metric],
          data: points,
          parsing: false,
          borderColor: colors.accent,
          backgroundColor: `${colors.accent}1a`,
          fill: metric === 'netWorth' ? 'start' : false,
          borderWidth: 2,
          pointRadius: isShare ? 3 : 0,
          pointHoverRadius: 5,
          pointBackgroundColor: colors.accent,
          pointHoverBorderColor: colors.surface,
          pointHoverBorderWidth: 2,
          spanGaps: false,
          tension: 0,
        }
      : {
          type: 'bar',
          label: METRIC_LABELS[metric],
          data: points,
          parsing: false,
          backgroundColor: barColor,
          maxBarThickness: 24,
        },
  ];
  if (metric === 'averageSpending') {
    datasets.push({
      type: 'line',
      label: 'Average',
      data: [view.range[0], view.range[1]].map((x) => ({ x, y: average })),
      parsing: false,
      borderColor: colors.fg,
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
    });
  }

  const data = { datasets } as ChartData<'bar', Point[]>;
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, right: 8 } },
    interaction: isLine
      ? ({ mode: 'onLine', intersect: false } as ChartOptions<'bar'>['interaction'])
      : { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: timeScale(view, anchor, colors.muted),
      y: {
        border: { display: false },
        grid: { color: (ctx) => (ctx.tick.value === 0 ? colors.muted : colors.line) },
        ticks: {
          color: colors.muted,
          callback: (v) => (isShare ? formatPercent(Number(v)) : formatCompact(Number(v))),
        },
      },
    },
    plugins: {
      legend: { display: false },
      zoom: zoomPlugin(view),
      tooltip: {
        filter: (item) => item.dataset.label !== 'Average',
        backgroundColor: colors.surface,
        titleColor: colors.fg,
        bodyColor: colors.fg,
        borderColor: colors.line,
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items) => (items[0]?.raw as Point | undefined)?.label ?? '',
          label: (item) => {
            const y = (item.raw as Point).y;
            return `${METRIC_LABELS[metric]}  ${y === null ? '—' : format(y)}`;
          },
        },
      },
    },
  };

  return (
    <div>
      <ZoomControls view={view}>{toolbar?.(view)}</ZoomControls>
      <div className="relative h-72 w-full">
        {ready && (
          <Chart
            type="bar"
            data={data}
            options={options}
            aria-label={METRIC_LABELS[metric]}
            role="img"
          />
        )}
      </div>
    </div>
  );
}
