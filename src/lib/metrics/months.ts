import type { IsoDate } from '../domain/types';

/** Calendar month, `YYYY-MM`. Sorts correctly as a string. */
export type MonthKey = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `date` is a `YYYY-MM-DD` date. Transactions from a hand-edited sheet may not be. */
export function isIsoDate(date: string): boolean {
  return ISO_DATE.test(date);
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function parseMonth(month: MonthKey): { year: number; month: number } {
  return { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
}

/** `month` shifted by `count` months (negative to go back). */
export function addMonths(month: MonthKey, count: number): MonthKey {
  const { year, month: m } = parseMonth(month);
  const index = year * 12 + (m - 1) + count;
  const y = Math.floor(index / 12);
  return `${String(y).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Every month from `from` to `to`, inclusive. Empty if `from` is after `to`. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) months.push(m);
  return months;
}

/** Last calendar day of the month, as an ISO date. */
export function monthEnd(month: MonthKey): IsoDate {
  const { year, month: m } = parseMonth(month);
  const day = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}
