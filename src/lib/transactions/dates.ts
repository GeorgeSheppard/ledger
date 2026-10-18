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
