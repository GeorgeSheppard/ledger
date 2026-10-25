import type { Bucket, Granularity } from '../../../lib/metrics/buckets';
import { parseMonth, type MonthKey } from '../../../lib/metrics/months';

/** Display formatting for the dashboard. Amounts have no currency symbol; the sheet has none. */

const money = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
  return money.format(amount);
}

/** Rounded to whole units, for headline figures. */
export function formatWhole(amount: number): string {
  return whole.format(amount);
}

/** `+1,234` / `−56`, for changes. */
export function formatChange(amount: number, format = formatMoney): string {
  if (amount === 0) return format(0);
  return `${amount > 0 ? '+' : '−'}${format(Math.abs(amount))}`;
}

/** Axis ticks: 0, 2.5K, 10K. */
export function formatCompact(amount: number): string {
  return compact.format(amount);
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio);
}

function monthDate(month: MonthKey): Date {
  const { year, month: m } = parseMonth(month);
  return new Date(Date.UTC(year, m - 1, 1));
}

/** `Apr`, or `Apr 26` when `withYear`. */
export function formatMonthShort(month: MonthKey, withYear = false): string {
  return monthDate(month).toLocaleDateString(undefined, {
    month: 'short',
    ...(withYear ? { year: '2-digit' } : {}),
    timeZone: 'UTC',
  });
}

/** `April 2026`. */
export function formatMonthLong(month: MonthKey): string {
  return monthDate(month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const dayLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayLabelYear = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const dayLong = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Axis label for a point in time (ms, UTC): `Apr`, `6 Apr` or `6`. `withYear` adds the year
 * (`Apr 26`, `6 Apr 26`); the axis asks for it wherever the dates cross years.
 */
export function formatTick(time: number, granularity: Granularity, withYear = false): string {
  const date = new Date(time);
  if (granularity === 'month') return formatMonthShort(date.toISOString().slice(0, 7), withYear);
  if (granularity === 'week' || date.getUTCDate() === 1)
    return withYear ? dayLabelYear.format(date) : dayLabel.format(date);
  return String(date.getUTCDate());
}

/** Tooltip title for a bucket: `April 2026`, `Week of 6 Apr`, `Mon 6 Apr 2026`. */
export function formatBucket(bucket: Bucket, granularity: Granularity): string {
  if (granularity === 'month') return formatMonthLong(bucket.key);
  const start = new Date(`${bucket.start}T00:00:00Z`);
  return granularity === 'week'
    ? `Week of ${dayLabel.format(start)} ${start.getUTCFullYear()}`
    : dayLong.format(start);
}
