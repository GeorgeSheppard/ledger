import type { IsoDate } from '../domain/types';
import { monthEnd, monthOf, monthsBetween } from './months';

/** How finely a time series is cut: calendar months, Monday-to-Sunday weeks, or single days. */
export type Granularity = 'month' | 'week' | 'day';

/** One slice of time. `end` is the last day it covers. */
export interface Bucket {
  /** Identifies the bucket at its granularity: `YYYY-MM`, the Monday of the week, or the date. */
  key: string;
  start: IsoDate;
  end: IsoDate;
}

export const DAY_MS = 86_400_000;

/** Midnight UTC at the start of `date`. */
export function dayStart(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function isoDateOf(time: number): IsoDate {
  return new Date(time).toISOString().slice(0, 10);
}

/** Monday of the week `date` falls in. */
function weekStart(date: IsoDate): IsoDate {
  const time = dayStart(date);
  const sinceMonday = (new Date(time).getUTCDay() + 6) % 7;
  return isoDateOf(time - sinceMonday * DAY_MS);
}

export function bucketKeyOf(date: IsoDate, granularity: Granularity): string {
  if (granularity === 'month') return monthOf(date);
  return granularity === 'week' ? weekStart(date) : date;
}

/** Every bucket that overlaps `start`..`end` (inclusive), in order. The first and last may stick out. */
export function bucketsBetween(start: IsoDate, end: IsoDate, granularity: Granularity): Bucket[] {
  if (start > end) return [];
  if (granularity === 'month')
    return monthsBetween(monthOf(start), monthOf(end)).map((month) => ({
      key: month,
      start: `${month}-01`,
      end: monthEnd(month),
    }));
  const length = granularity === 'week' ? 7 : 1;
  const buckets: Bucket[] = [];
  const last = dayStart(end);
  for (
    let time = dayStart(granularity === 'week' ? weekStart(start) : start);
    time <= last;
    time += length * DAY_MS
  ) {
    const first = isoDateOf(time);
    buckets.push({ key: first, start: first, end: isoDateOf(time + (length - 1) * DAY_MS) });
  }
  return buckets;
}

/** When the bucket starts and stops, in ms: `[start, end)` with `end` being midnight after its last day. */
export function bucketSpan(bucket: Bucket): [number, number] {
  return [dayStart(bucket.start), dayStart(bucket.end) + DAY_MS];
}

/**
 * How finely to cut the time currently on screen. Zoomed out (or barely zoomed) it is months, as
 * the dashboard always was; zooming in switches to weeks and then days so more detail appears.
 * `zoom` is how many times narrower the view is than the whole range.
 */
export function granularityFor(visibleDays: number, zoom: number): Granularity {
  if (zoom < 2 || visibleDays >= 150) return 'month';
  return visibleDays >= 70 ? 'week' : 'day';
}
