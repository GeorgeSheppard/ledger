import type { IsoDate } from '../domain/types';

/** Helpers for the `YYYY-MM-DD` dates used throughout the app. All calendar maths is UTC. */

export function isIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Today in the user's local timezone, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-10-17` → `2026-10`. */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2026-10-17` → `17 Oct` (locale dependent). Falls back to the raw text for bad dates. */
export function formatDay(date: IsoDate): string {
  return isIsoDate(date) ? dayFormatter.format(new Date(`${date}T00:00:00Z`)) : date;
}

/** `2026-10` → `October 2026` (locale dependent). */
export function formatMonth(key: string): string {
  const date = new Date(`${key}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? key : monthFormatter.format(date);
}

/** The year of a `YYYY-MM-DD` date, shown next to the day so rows from different years can be told apart. */
export function yearOf(date: IsoDate): string {
  return date.slice(0, 4);
}

export interface DatePreset {
  id: string;
  label: string;
  from: IsoDate;
  to: IsoDate;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`;
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Quick date ranges relative to `today`: this and last month, the last 12 months and this year. */
export function datePresets(today: IsoDate): DatePreset[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const lastY = m === 1 ? y - 1 : y;
  const lastM = m === 1 ? 12 : m - 1;
  const yearAgo = new Date(Date.UTC(y, m - 1, Number(today.slice(8, 10))));
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  yearAgo.setUTCDate(yearAgo.getUTCDate() + 1);
  return [
    { id: 'this-month', label: 'This month', from: iso(y, m, 1), to: iso(y, m, lastDayOf(y, m)) },
    {
      id: 'last-month',
      label: 'Last month',
      from: iso(lastY, lastM, 1),
      to: iso(lastY, lastM, lastDayOf(lastY, lastM)),
    },
    {
      id: 'last-12-months',
      label: 'Last 12 months',
      from: yearAgo.toISOString().slice(0, 10),
      to: today,
    },
    { id: 'this-year', label: 'This year', from: iso(y, 1, 1), to: iso(y, 12, 31) },
  ];
}
