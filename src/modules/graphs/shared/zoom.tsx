import type { Chart as ChartJs, ChartOptions } from 'chart.js';
import { useMemo, useState, type ReactNode } from 'react';
import {
  bucketSpan,
  DAY_MS,
  granularityFor,
  isoDateOf,
  type Bucket,
  type Granularity,
} from '../../../lib/metrics/buckets';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { ActionButton } from '../../../ui/ActionButton';
import type { IsoDate } from '../../../lib/domain/types';
import { formatTick } from './format';

/** Zooming stops at about two weeks on screen. */
const MIN_RANGE = 14 * DAY_MS;
const STEP = 1.6;

export type TimeRange = [from: number, to: number];

/** A bucket plus where it sits in the series, for a chart that only draws what is on screen. */
export interface ShownBucket {
  bucket: Bucket;
  /** Index into the series' buckets/cashFlow/netWorth arrays. */
  index: number;
}

export interface ZoomView {
  /** The time on screen, in ms. */
  range: TimeRange;
  full: TimeRange;
  granularity: Granularity;
  /** Buckets overlapping the view (plus a little either side), in order. */
  shown: ShownBucket[];
  zoomed: boolean;
  /** First and last day on screen, as ISO dates. */
  dates: { from: IsoDate; to: IsoDate };
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  /** Called by the chart when the user pans or pinches. */
  onChartZoom(chart: ChartJs): void;
}

/**
 * What a zoomable chart is showing: the part of the time range on screen, and how finely to cut it.
 * The view starts as the whole range and goes back to it when the data behind it changes. The chart
 * is controlled from here: `range` goes into its x scale, and its pan/zoom events come back through
 * `onChartZoom`.
 */
export function useZoomView(series: TimeSeries): ZoomView {
  const full = useMemo<TimeRange>(() => [series.startMs, series.endMs], [series]);
  const [state, setState] = useState<{ series: TimeSeries; range: TimeRange } | null>(null);
  const range = state?.series === series ? state.range : full;
  const set = (next: TimeRange) => setState({ series, range: next });

  const width = range[1] - range[0];
  const granularity = granularityFor(width / DAY_MS, (full[1] - full[0]) / width);
  const shown = useMemo(() => {
    const margin = (range[1] - range[0]) * 0.1;
    return series.buckets(granularity).flatMap((bucket, index) => {
      const [from, to] = bucketSpan(bucket);
      return to > range[0] - margin && from < range[1] + margin ? [{ bucket, index }] : [];
    });
  }, [series, granularity, range]);

  const zoomBy = (factor: number) => {
    const middle = (range[0] + range[1]) / 2;
    const half = Math.max(MIN_RANGE, Math.min(full[1] - full[0], width / factor)) / 2;
    const from = Math.max(full[0], Math.min(full[1] - 2 * half, middle - half));
    set([from, from + 2 * half]);
  };

  return {
    range,
    full,
    granularity,
    shown,
    zoomed: width < full[1] - full[0] - 1,
    dates: { from: isoDateOf(range[0]), to: isoDateOf(Math.max(range[0], range[1] - 1)) },
    zoomIn: () => zoomBy(STEP),
    zoomOut: () => zoomBy(1 / STEP),
    reset: () => set(full),
    onChartZoom: (chart) => {
      const x = chart.scales.x;
      if (x) set([x.min, x.max]);
    },
  };
}

/** Where along the time axis a bucket's mark goes: its middle (bars) or its end (balances). */
export type Anchor = 'middle' | 'end';

export function anchorTime(bucket: Bucket, anchor: Anchor): number {
  const [from, to] = bucketSpan(bucket);
  return anchor === 'middle' ? (from + to) / 2 : to;
}

/** Chart.js `x` scale for a view: exactly the visible range, labelled at the buckets, thinned to fit. */
export function timeScale(view: ZoomView, anchor: Anchor, labelColor: string) {
  return {
    type: 'linear' as const,
    min: view.range[0],
    max: view.range[1],
    border: { display: false },
    grid: { display: false },
    ticks: {
      autoSkip: false,
      maxRotation: 0,
      color: labelColor,
      // A balance is plotted at the end of its period, which is the start of the next one.
      callback: (value: string | number) =>
        formatTick(Number(value) - (anchor === 'end' ? 1 : 0), view.granularity),
    },
    afterBuildTicks: (scale: { width: number; ticks: { value: number }[] }) => {
      const times = view.shown
        .map(({ bucket }) => anchorTime(bucket, anchor))
        .filter((t) => t >= view.range[0] && t <= view.range[1]);
      const every = Math.max(1, Math.ceil((times.length * 52) / Math.max(scale.width, 1)));
      // Day labels are just numbers, so keep one on the 1st to say which month they belong to.
      const first =
        view.granularity === 'day' ? times.findIndex((t) => new Date(t).getUTCDate() === 1) : -1;
      const anchorIndex = first >= 0 ? first : times.length - 1;
      scale.ticks = times
        .filter((_, i) => (((i - anchorIndex) % every) + every) % every === 0)
        .map((value) => ({ value }));
    },
  };
}

/** The pan and zoom settings: drag to pan, pinch or Ctrl+scroll to zoom, along time only. */
export function zoomPlugin(view: ZoomView): NonNullable<ChartOptions['plugins']>['zoom'] {
  return {
    pan: { enabled: true, mode: 'x', threshold: 6, onPan: ({ chart }) => view.onChartZoom(chart) },
    zoom: {
      mode: 'x',
      wheel: { enabled: true, modifierKey: 'ctrl' },
      pinch: { enabled: true },
      onZoom: ({ chart }) => view.onChartZoom(chart),
    },
    limits: { x: { min: view.full[0], max: view.full[1], minRange: MIN_RANGE } },
  };
}

/** Buttons for zooming without a mouse wheel or pinch, plus room for the graph's own actions. */
export function ZoomControls({ view, children }: { view: ZoomView; children?: ReactNode }) {
  const wide = view.full[1] - view.full[0] <= MIN_RANGE;
  return (
    <div className="mb-2 flex flex-wrap items-center justify-end gap-1">
      <span className="no-keys:hidden mr-auto text-xs text-muted">
        Drag to pan, Ctrl and scroll to zoom
      </span>
      {children}
      <ActionButton
        variant="ghost"
        aria-label="Zoom out"
        disabled={!view.zoomed}
        onAction={view.zoomOut}
      >
        −
      </ActionButton>
      <ActionButton variant="ghost" aria-label="Zoom in" disabled={wide} onAction={view.zoomIn}>
        +
      </ActionButton>
      {view.zoomed && (
        <ActionButton variant="ghost" onAction={view.reset}>
          Reset
        </ActionButton>
      )}
    </div>
  );
}
