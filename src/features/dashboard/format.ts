import { parseMonth, type MonthKey } from '../../lib/metrics/months';

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
