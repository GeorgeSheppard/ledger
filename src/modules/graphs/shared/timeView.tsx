import { useMemo } from 'react';
import {
  bucketSpan,
  DAY_MS,
  granularityFor,
  type Bucket,
  type Granularity,
} from '../../../lib/metrics/buckets';
import type { TimeSeries } from '../../../lib/metrics/timeSeries';
import { formatTick } from './format';

export type TimeRange = [from: number, to: number];

/** A bucket plus where it sits in the series, so a chart can look up its numbers. */
export interface ShownBucket {
  bucket: Bucket;
  /** Index into the series' buckets/cashFlow/netWorth arrays. */
  index: number;
}

export interface TimeView {
  /** The time on screen, in ms: all of the series. */
  range: TimeRange;
  granularity: Granularity;
  shown: ShownBucket[];
}

/**
 * What a time graph shows: the whole series, cut as finely as its length allows (a month of data
 * in days, a few months in weeks, longer in months). The graph's period is chosen elsewhere, so
 * there is nothing to pan or zoom here.
 */
export function useTimeView(series: TimeSeries): TimeView {
  return useMemo(() => {
    const granularity = granularityFor((series.endMs - series.startMs) / DAY_MS);
    return {
      range: [series.startMs, series.endMs],
      granularity,
      shown: series.buckets(granularity).map((bucket, index) => ({ bucket, index })),
    };
  }, [series]);
}

/** Where along the time axis a bucket's mark goes: its middle (bars) or its end (balances). */
export type Anchor = 'middle' | 'end';

export function anchorTime(bucket: Bucket, anchor: Anchor): number {
  const [from, to] = bucketSpan(bucket);
  return anchor === 'middle' ? (from + to) / 2 : to;
}

/** Chart.js `x` scale for a view: exactly the visible range, labelled at the buckets, thinned to fit. */
export function timeScale(view: TimeView, anchor: Anchor, labelColor: string) {
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
