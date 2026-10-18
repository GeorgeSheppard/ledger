import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Account } from '../../../lib/domain/types';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { useChartColors, useChartsReady } from '../shared/chartjs';
import { formatBucket, formatCompact, formatMoney } from '../shared/format';
import {
  anchorTime,
  timeScale,
  useZoomView,
  zoomPlugin,
  ZoomControls,
  type ZoomView,
} from '../shared/zoom';
import type { ReactNode } from 'react';

interface Point {
  x: number;
  y: number;
  label: string;
  byAccount: Record<number, number>;
}

interface NetWorthChartProps {
  series: TimeSeries;
  accounts: Account[];
  toolbar?: (view: ZoomView) => ReactNode;
}

/** Net worth over time: a 2px line over a light wash. Drag to pan, pinch or Ctrl+scroll to zoom. */
export function NetWorthChart({ series, accounts, toolbar }: NetWorthChartProps) {
  const view = useZoomView(series);
  const colors = useChartColors();
  const ready = useChartsReady();
  const worth = series.netWorth(view.granularity);

  const points = view.shown.map<Point>(({ bucket, index }) => ({
    x: anchorTime(bucket, 'end'),
    y: worth[index]!.total,
    label: formatBucket(bucket, view.granularity),
    byAccount: worth[index]!.byAccount,
  }));

  const data: ChartData<'line', Point[]> = {
    datasets: [
      {
        data: points,
        parsing: false,
        borderColor: colors.accent,
        backgroundColor: `${colors.accent}1a`,
        fill: 'start',
        borderWidth: 2,
        borderJoinStyle: 'round',
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors.accent,
        pointHoverBorderColor: colors.surface,
        pointHoverBorderWidth: 2,
        tension: 0,
      },
    ],
  };
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, right: 8 } },
    interaction: { mode: 'onLine', intersect: false },
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
      zoom: zoomPlugin(view),
      tooltip: {
        backgroundColor: colors.surface,
        titleColor: colors.fg,
        bodyColor: colors.fg,
        borderColor: colors.line,
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items) => (items[0]?.raw as Point | undefined)?.label ?? '',
          label: (item) => `Net worth  ${formatMoney((item.raw as Point).y)}`,
          afterBody: (items) =>
            accounts.map(
              (a) =>
                `${a.name}  ${formatMoney((items[0]?.raw as Point | undefined)?.byAccount[a.id] ?? 0)}`
            ),
        },
      },
    },
  };

  return (
    <div>
      <ZoomControls view={view}>{toolbar?.(view)}</ZoomControls>
      <div className="relative h-60 w-full">
        {ready && (
          <Line data={data} options={options} aria-label="Net worth over time" role="img" />
        )}
      </div>
    </div>
  );
}
